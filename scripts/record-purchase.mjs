// record-purchase.mjs — write one paid purchase record at contract time
// (PAID-PLAN §7, D288 §3; the runbook's phase 1).
//
//   node scripts/record-purchase.mjs --project prvfire33 \
//     --uid <buyerUid> --qid pd01 --scope city --place Oslo \
//     --prompt "Should the night buses run all night?" --options "All night,The hours are fine" \
//     --start 2026-08-24 --until 2026-09-21 --rate 0.16 --cap 4000 --cap-eur 640
//   node scripts/record-purchase.mjs --emulator --uid u1 --qid pd01 --scope world \
//     --prompt "Sunrise or sunset?" --options "Sunrise,Sunset" \
//     --start 2026-08-24 --until 2026-09-21 --rate 0.16 --cap 4000 --cap-eur 640
//
// Needs admin credentials (GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth
// application-default login`), or --emulator with FIRESTORE_EMULATOR_HOST.
//
// One of the collection's TWO pens since D304 — this script for
// hand-arranged contracts, the Stripe payment webhook (functions/src/
// paid.ts goLive) for the self-serve pipeline. Both are server-side:
// firestore.rules still says `write: if false` and rules.test.ts pins
// it, so there is no client write arm. The sentence that used to stand
// here — "a deployed endpoint that can mint contract records would be
// standing surface in exchange for nothing" — was true while selling
// was by hand and was retired ON PURPOSE by D304: the webhook mints a
// record only against a signature-verified Stripe payment, which is not
// nothing. This script remains for sales the machinery does not carry
// (reports sold standalone, subscriptions when they exist).
//
// The same sitting that records a purchase re-runs the pricing fold
// (scripts/build-pricing.mjs) and commits the changed content/pricing.json
// — the booked/open days and the demand index the door prints are read
// from that committed file, never from other buyers' rows. The reminder
// at the foot of a successful run says exactly that.
//
// What it validates, each bound a recorded rule rather than taste:
//   - dims ≤ 3, each of the published vocabulary (D228's coarseness
//     ceiling: past three, compounding printed dims starts shaping a
//     person-sized query)
//   - the window ≤ 366 days (PAID-PLAN §8's one-year line)
//   - the rate LOCKED at booking is positive, and it is the number the
//     buyer's room prints for the life of the contract (D164: billed per
//     answer against a cap)
//   - refuses to overwrite an existing record unless --amend says the
//     human means it — a contract is append-mostly, and a silent
//     overwrite is how a signed cap would drift

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};
const die = (msg) => { console.error(`record-purchase: ${msg}`); process.exit(1); };

const emulator = flag("emulator");
const projectId = opt("project") || (emulator ? "demo-insight" : undefined);
if (!projectId) die("--project is required (or --emulator)");
if (emulator && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

const uid = opt("uid");
const qid = opt("qid");
const kind = opt("kind") || "question";
const scope = opt("scope");
const place = opt("place") || null;
const cadence = opt("cadence") || "once";
const start = opt("start");
const until = opt("until");
const rate = Number(opt("rate"));
const cap = Number(opt("cap"));
const capEur = Number(opt("cap-eur"));
const dims = (opt("dims") || "").split(",").map((s) => s.trim()).filter(Boolean);
const prompt = opt("prompt");
const options = (opt("options") || "").split(",").map((s) => s.trim()).filter(Boolean);
const amend = flag("amend");

if (!uid) die("--uid <buyerUid> is required");
if (!qid) die("--qid <sponsored entry id> is required");
if (kind !== "question" && kind !== "subscription") die("--kind must be question or subscription");
if (!["city", "country", "world"].includes(scope || "")) die("--scope must be city, country or world");
if ((scope === "city" || scope === "country") && !place) die(`--place is required for scope ${scope}`);
if (cadence !== "once" && cadence !== "daily") die("--cadence must be once or daily");
if (!(rate > 0)) die("--rate must be a positive per-answer figure (locked at booking, D164)");
if (!(cap > 0) || !(capEur > 0)) die("--cap and --cap-eur must be positive (billing stops there)");
if (dims.length > 3) die(`${dims.length} dims — D228 caps the audience at three, each printed on the band`);
// The contract snapshots its own subject: the room must keep drawing a
// campaign whose question has since left the bank, and a contract that
// cannot state what was asked is not a record of anything.
if (!prompt) die("--prompt <the question as asked> is required");
if (options.length < 2) die("--options a,b[,c…] — at least two labels, comma-separated");

const DAY = 24 * 60 * 60 * 1000;
const parseDay = (s, name) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) die(`--${name} must be YYYY-MM-DD`);
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t)) die(`--${name}: ${s} is not a date`);
  return t;
};
const t0 = parseDay(start, "start");
const t1 = parseDay(until, "until");
if (t1 <= t0) die("--until must be after --start");
const days = Math.round((t1 - t0) / DAY);
if (days > 366) die(`${days}-day window — PAID-PLAN §8 caps a paid question at 366 days`);

// No credential key at all against the emulator — firebase-admin rejects
// an explicit `credential: undefined`, and the emulator wants none.
initializeApp(emulator ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

const pid = `${uid}_${qid}`;
const ref = db.collection("v2_purchases").doc(pid);
const existing = await ref.get();
if (existing.exists && !amend) {
  die(`v2_purchases/${pid} already exists — pass --amend if the contract really changed`);
}

await ref.set({
  uid,
  kind,
  qid,
  prompt,
  options,
  scope,
  place,
  dims,
  window: { start, until },
  cadence,
  budget: { cap, capEur, ratePerAnswer: rate },
  state: "running",
  // The room's shelf renders these as milestones; `ready` flips by a
  // later --amend run when a report is actually built (D251's builder).
  reports: existing.exists && amend && existing.get("reports")
    ? existing.get("reports")
    : [{ label: "Final report", ready: false, note: "at close" }],
  at: existing.exists ? existing.get("at") : FieldValue.serverTimestamp(),
});

console.log(`${existing.exists ? "amended" : "recorded"} v2_purchases/${pid}`);
console.log(`  ${kind} · ${scope}${place ? ` (${place})` : ""} · ${start} → ${until} (${days} days) · ${rate}/answer · cap ${cap} answers / €${capEur}`);
if (dims.length) console.log(`  dims: ${dims.join(" · ")}`);
console.log("\nSame sitting, before you stand up:");
console.log("  node scripts/build-pricing.mjs   # refold the ledger into content/pricing.json");
console.log("  …and commit the changed pricing.json — the door prints THAT file, never this row.");
