#!/usr/bin/env node
// budget-mode.mjs — pull or release the read breaker (D332).
//
//   node scripts/budget-mode.mjs --status                 # read the mode
//   node scripts/budget-mode.mjs --level 1 --reason "read runaway 03:10"
//   node scripts/budget-mode.mjs --level 0                # release
//   node scripts/budget-mode.mjs --emulator --level 1     # against the emulator
//
// Needs admin credentials (GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth
// application-default login`), or --emulator with FIRESTORE_EMULATOR_HOST.
// The project defaults to prvfire33 — the same default observe.mjs uses —
// so the 3am invocation is the short one.
//
// WHAT IT MOVES. One field, `budgetMode` on `v2_meta/app` — the document
// every client reads once per boot, so the lever costs no read of its own
// (src/v2/data/budgetMode.ts has the client half and the level table).
// Level 1 pauses the D98 social fetches: named who-voted, Kindred, Circle,
// takes — the `social` column of the cost model, ~354 of ~440 reads per
// user per day at 5,000 DAU. The answering loop, the aggregates and the
// Mirror's published-aggregate folds keep working, and every gated surface
// says it is paused rather than rendering an absent crowd as an empty one.
//
// WHAT IT DOES NOT DO. Propagation is per-BOOT: a session already running
// keeps its mode until the next cold start, so this shears the curve over
// hours, not seconds. The instant kill for hostile traffic is App Check
// enforcement on the Firestore API (console, and only if the soak was done
// in advance — docs/COSTS.md "What to actually do at 3am"); the last resort
// is detaching billing, which is an outage. This lever sits between them:
// no deploy, no outage, reversible with --level 0.
//
// Firestore.rules keeps v2_meta `allow write: if false`, so the admin SDK
// is the only pen — the same posture as record-purchase.mjs. The seed and
// the nightly fit both write this document with {merge: true}, so the
// field survives them (functions/src/patterns.ts's own comment: the fit
// owns two fields on a document the seed and the operator own the rest of).

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./admin-db.mjs";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};
const die = (msg) => { console.error(`budget-mode: ${msg}`); process.exit(1); };

const emulator = flag("emulator");
const projectId = opt("project") || (emulator ? "demo-insight" : "prvfire33");
if (emulator && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

const status = flag("status");
const levelRaw = opt("level");
if (!status && levelRaw === undefined) die("--level 0|1 (or --status) is required");
const level = status ? null : Number(levelRaw);
if (!status && !(level === 0 || level === 1)) {
  // Level 2 (thinning the answering loop's own reads) is reserved in the
  // client module and NOT built — a value the clients would read as "more
  // paused than level 1" without any surface saying so.
  die(`--level must be 0 or 1 — level 2 is reserved, not built (D332, src/v2/data/budgetMode.ts)`);
}

// NAMES THE DATABASE. `getFirestore()` binds to `(default)`, which this
// app does not use and which no longer exists — see scripts/admin-db.mjs.
const db = adminDb({ projectId, emulator });
const ref = db.collection("v2_meta").doc("app");

const snap = await ref.get();
const current = Number(snap.get("budgetMode") || 0);
const at = snap.get("budgetModeAt");
const why = snap.get("budgetModeReason");

if (status) {
  console.log(`budget-mode: ${projectId} is at level ${current}`
    + (current >= 1 ? " — the D98 social reads are PAUSED" : " — nothing paused")
    + (at?.toDate ? ` (set ${at.toDate().toISOString()}` : "")
    + (why ? `, reason: ${why})` : at?.toDate ? ")" : ""));
  process.exit(0);
}

if (level === current) {
  console.log(`budget-mode: ${projectId} already at level ${level} — nothing written`);
  process.exit(0);
}

await ref.set(
  {
    budgetMode: level,
    budgetModeAt: FieldValue.serverTimestamp(),
    // Bookkeeping for the next operator, not read by any client. Absent
    // clears a stale reason rather than leaving level 0 explained.
    budgetModeReason: level >= 1 ? (opt("reason") || "unrecorded") : FieldValue.delete(),
  },
  { merge: true },
);

if (level >= 1) {
  console.log(
    `budget-mode: ${projectId} set to level 1 (was ${current}).\n`
    + `  Paused, from each device's NEXT boot: named who-voted, Kindred, Circle, takes\n`
    + `  (~354 of ~440 reads/user/day at 5k DAU — docs/COSTS.md "Where the reads actually go").\n`
    + `  Every gated surface says it is paused; answering and the Mirror's folds keep working.\n`
    + `  Sessions already running keep reading until they restart — expect the curve to\n`
    + `  shear over hours. Release with: node scripts/budget-mode.mjs --level 0`,
  );
} else {
  console.log(
    `budget-mode: ${projectId} released to level 0 (was ${current}).\n`
    + `  The social surfaces resume on each device's next boot.`,
  );
}
