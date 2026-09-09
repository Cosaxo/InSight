#!/usr/bin/env node
// duel-live-audit.mjs — production's 1v1 and group questions against the bank.
//
// WHY THIS EXISTS. A duel question lives in three places: the bank
// (`content/duel-questions.json`), Firestore (`v2_questions`, written by the
// seed after every deploy) and the phone (a cached bank keyed by
// `contentRev`). Two of the three can drift on purpose: the seed never
// rewrites `active` (SHIP-CHECKLIST § the remaining step — retirement is a
// console act), and a returning device keeps its cached bank until
// `contentRev` moves (D34). So after a design change the bank can retire a
// question production still deals, and production can hold packs no phone
// has seen — and until this script nothing in the tree could say which.
// CAST-ROLLOUT-PLAN.md §2 is the rollout this measures for; step 3 is the
// read-only run, step 4 is `--apply`.
//
// WHAT --apply DOES, EXACTLY. It sets `active: false` on the questions the
// bank retires and production still serves — nothing else. It never
// re-lights a question (lighting a pool is a design act, the romantic
// pool's row), never touches content (that is the seed's), and prints every
// id it changes before and after. A run without `--apply` changes nothing.
//
// Usage:
//   node scripts/duel-live-audit.mjs --project prvfire33           # report
//   node scripts/duel-live-audit.mjs --project prvfire33 --apply   # flip the retired
//
// Needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key,
// like every operator script here (scrub-v1-discoverable.mjs has why), and
// reads the `insight` database through admin-db.mjs, never `(default)`.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Bank pool → the id prefix the seed writes it under (gen-v2content.mjs). */
export const POOLS = { group: "group", oneVsOne: "duo", romantic: "duo" };

/**
 * Every duel question the bank holds, keyed by its live document id, with
 * the pool it came from and whether the bank still serves it. `scenarios`
 * is not a pool: a pack is a label on role votes, not a question.
 */
export function bankIds(bank) {
  const out = new Map();
  for (const [pool, prefix] of Object.entries(POOLS)) {
    for (const q of bank[pool] || []) {
      if (!q || q.id == null) continue;
      out.set(`${prefix}-${q.id}`, { pool, active: q.active !== false, kind: q.kind || "choice" });
    }
  }
  return out;
}

/**
 * The disagreement between the bank and production, in the four shapes a
 * reader has to act on differently:
 *   retiredButLive — the bank retired it, production still deals it: the
 *                    flip (`--apply`), then bump_rev.
 *   liveButOff     — the bank serves it, production has it off: somebody
 *                    killed it by hand; the bank is the record, so either
 *                    retire it there or re-light it — a decision, not a flip.
 *   missingActive  — the bank serves it and production has no document:
 *                    the seed has not run since it was added.
 *   missingRetired — never seeded and already retired: nothing to do.
 *   extra          — production holds a duel question the bank does not:
 *                    an id the bank lost, or a document written by hand.
 */
export function diffBank(bank, live) {
  const byPool = {};
  const out = { byPool, retiredButLive: [], liveButOff: [], missingActive: [], missingRetired: [], extra: [] };
  for (const [id, b] of bank) {
    const p = (byPool[b.pool] ??= { bank: 0, active: 0, seeded: 0 });
    p.bank += 1;
    if (b.active) p.active += 1;
    const l = live.get(id);
    if (!l) { (b.active ? out.missingActive : out.missingRetired).push(id); continue; }
    p.seeded += 1;
    if (!b.active && l.active !== false) out.retiredButLive.push(id);
    if (b.active && l.active === false) out.liveButOff.push(id);
  }
  for (const id of live.keys()) if (!bank.has(id)) out.extra.push(id);
  for (const k of ["retiredButLive", "liveButOff", "missingActive", "missingRetired", "extra"]) out[k].sort();
  return out;
}

/** Days since a Firestore timestamp, or "never" — for the contentRev line. */
export function ageDays(ts, now = Date.now()) {
  const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : typeof ts === "number" ? ts : null;
  if (ms == null) return "never";
  return String(Math.floor((now - ms) / 86_400_000));
}

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const projectId = arg("--project", process.env.GCLOUD_PROJECT || "prvfire33");
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      "duel-live-audit: set GOOGLE_APPLICATION_CREDENTIALS to a service-account key\n"
      + "  (the deploy's own, written to a file), or FIRESTORE_EMULATOR_HOST to audit an emulator.",
    );
    process.exit(2);
  }
  const { adminDb } = await import("./admin-db.mjs");
  const { FieldValue } = await import("firebase-admin/firestore");
  const db = adminDb({ projectId, emulator: Boolean(process.env.FIRESTORE_EMULATOR_HOST) });
  const bank = bankIds(JSON.parse(readFileSync(new URL("../content/duel-questions.json", import.meta.url), "utf8")));
  const snap = await db.collection("v2_questions").where("surface", "in", ["group", "duo"]).get();
  const live = new Map(snap.docs.map((d) => [d.id, { active: d.get("active") }]));
  const meta = await db.doc("v2_meta/app").get();
  const d = diffBank(bank, live);

  console.log(`duel-live-audit: project ${projectId}, database insight — bank ${bank.size} duel questions, production ${live.size}`);
  console.log(`contentRev: ${meta.exists ? `${ageDays(meta.get("contentRev"))} day(s) old` : "no v2_meta/app"} — a returning device re-reads its bank only when it moves`);
  console.log("\npool        bank  active  seeded");
  for (const [pool, p] of Object.entries(d.byPool)) {
    console.log(`${pool.padEnd(10)} ${String(p.bank).padStart(5)} ${String(p.active).padStart(7)} ${String(p.seeded).padStart(7)}`);
  }
  const row = (label, ids, note) => console.log(`\n${label}: ${ids.length}${ids.length ? `\n  ${ids.join(" ")}` : ""}${note ? `\n  ${note}` : ""}`);
  row("retired in the bank, still dealt in production", d.retiredButLive, "→ the flip (--apply), then Seed content with bump_rev");
  row("served by the bank, killed by hand in production", d.liveButOff, "→ a decision: retire it in the bank, or re-light it in the console");
  row("served by the bank, no document in production", d.missingActive, "→ the seed has not run since they were added");
  row("retired and never seeded", d.missingRetired, "→ nothing to do");
  row("in production, not in the bank", d.extra, "→ an id the bank lost, or a document written by hand");

  if (!apply) {
    console.log(`\nRead-only. ${d.retiredButLive.length} flip(s) waiting; re-run with --apply to set active:false on exactly those.`);
    process.exit(0);
  }
  if (!d.retiredButLive.length) { console.log("\nNothing to flip."); process.exit(0); }
  const batch = db.batch();
  for (const id of d.retiredButLive) batch.update(db.collection("v2_questions").doc(id), { active: false, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  const after = await db.getAll(...d.retiredButLive.map((id) => db.collection("v2_questions").doc(id)));
  const off = after.filter((s) => s.get("active") === false).length;
  console.log(`\nFlipped ${off} of ${d.retiredButLive.length} to active:false. Now: Actions → Seed content → bump_rev ticked, so every device re-reads the bank.`);
  process.exit(off === d.retiredButLive.length ? 0 : 1);
}
