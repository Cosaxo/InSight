// cost-arith.mjs — the arithmetic behind docs/COSTS.md, as a module.
//
// Not runnable on its own. Same shape as store-render.mjs and
// spec-globals.mjs: a module two consumers share so the two cannot drift
// apart. Here the consumers are `cost-model.mjs` (the CLI that prints the
// tables COSTS.md quotes) and `pulse.mjs` (the decision console). Before
// this split there was one copy; the moment the console wanted the same
// numbers there would have been two, and the second would have been the
// one that went stale.
//
// Everything below moved out of cost-model.mjs unchanged. The only new
// thing is the shape: the price sheet is a parameter rather than a
// module-level `const` read from argv, so a caller can model both regions
// in one process.
//
// Node stdlib only, like every deploy-adjacent script here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── price sheet (Blaze) ─────────────────────────────────────────
// Multi-region nam5 is the Firebase default and what prvfire33 is on.
// Regional is roughly half; both are here so the choice is visible.
export const priceSheet = (regional) =>
  regional
    ? { read: 0.03e-5, write: 0.09e-5, del: 0.01e-5, store: 0.108 }
    : { read: 0.06e-5, write: 0.18e-5, del: 0.02e-5, store: 0.18 };

export const CPU_S = 0.000024;      // $/vCPU-second (Cloud Run tier 1)
export const MEM_S = 0.0000025;     // $/GiB-second
export const REQ = 0.4e-6;          // $/request

// Free tiers. Firestore's are per DAY; Cloud Run's are per MONTH.
export const FREE = { read: 50_000, write: 20_000, del: 20_000, storeGiB: 1 };
export const FREE_MO = { cpu: 180_000, mem: 360_000, req: 2_000_000 };

// ── app constants ───────────────────────────────────────────────
// Counted from the generated seed rather than hardcoded: the bank grows
// every promotion cycle (D30) and the cold-boot read cost grows with it.
export function bankDocs() {
  const src = readFileSync(join(ROOT, "functions/src/v2content.ts"), "utf8");
  const head = "V2_QUESTIONS: V2SeedQuestion[] = ";
  const body = src.slice(src.indexOf(head) + head.length);
  return JSON.parse(body.slice(0, body.lastIndexOf("];") + 1)).length;
}

// READ FROM SOURCE, NOT RETYPED. These four used to be hand-copied numbers
// with the real location in a trailing comment, which is precisely the shape
// of the bug D47 found: the model said 148 reseed reads for two days after
// D34 made the real answer 3, and nothing could notice because nothing was
// comparing. A comment naming the source file is not a link to it.
//
// Deliberately throwing rather than defaulting: a rename in deck.ts should
// break `npm run costs` loudly on the next run, not silently fall back to
// whatever was true in August. The scan is narrow on purpose — it matches
// the exact declaration, so a changed VALUE is picked up and a changed SHAPE
// is an error. Same trade bankDocs() below already takes.
function readNum(rel, re, what) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const m = src.match(re);
  if (!m) {
    throw new Error(
      `cost-arith: could not read ${what} from ${rel}.\n`
      + `    Pattern ${re} matched nothing. The constant was probably renamed or\n`
      + "    reshaped. Fix the pattern here — do NOT paste the number back in,\n"
      + "    which is the failure this function exists to prevent (D47).",
    );
  }
  return Number(m[1]);
}

// Deck listeners attached per boot — 7 onSnapshot subscriptions, and the
// single largest term in the boot read count.
export const DECK_DAYS = readNum(
  "src/v2/data/deck.ts", /export const DECK_DAYS = (\d+)/, "DECK_DAYS");

// live.ts hydrate() top-up cap: how many still-under-floor aggregates a boot
// will re-check at most.
export const AGG_CAP = readNum(
  "src/v2/data/live.ts", /const AGG_ID_CAP = (\d+)/, "AGG_ID_CAP");

// How often the public mirror is rewritten, in answers. Drives both the
// mature write multiplier and the listener fan-out rate.
//
// A CONSTANT 1 since D94, and deliberately not read from the source any
// more: it used to track functions/src/v2.ts's PUBLISH_EVERY, and that
// literal is gone — the publish cadence was a disclosure control (batch
// the increments so an onSnapshot watcher cannot attribute a step to a
// person) and D94 retired the whole principle.
//
// Kept as a named 1 rather than inlined, because the arithmetic it feeds
// is still real and got WORSE: the mirror is now rewritten on every
// answer, which is the write pressure D7's ~1/sec/document ceiling is
// about. Deleting the term would hide that in the model. If the cost ever
// forces batching back, it returns here as a performance number with no
// privacy claim attached — and this comment is the note saying so.
export const PUBLISH_EVERY = 1;

// HOT_TRIGGER, functions/src/ops.ts — memory in GiB, cpu, concurrency read
// from the deployed options object. `sec` is NOT read and cannot be: 200 ms
// is an estimate of wall-clock per invocation — two reads and two-to-three
// writes in one transaction — and is the softest input in this file. It sits
// beside three hard numbers, which is a trap worth naming: if you tune this
// object, only one of its four fields is a guess.
export const TRIG = {
  mem: readNum("functions/src/ops.ts",
    /export const HOT_TRIGGER = \{[^}]*memory: "(\d+)MiB"/s, "HOT_TRIGGER.memory") / 1024,
  cpu: readNum("functions/src/ops.ts",
    /export const HOT_TRIGGER = \{[^}]*cpu: (\d+)/s, "HOT_TRIGGER.cpu"),
  conc: readNum("functions/src/ops.ts",
    /export const HOT_TRIGGER = \{[^}]*concurrency: (\d+)/s, "HOT_TRIGGER.concurrency"),
  sec: 0.2,
};

// ── reads nobody was counting (D67) ─────────────────────────────
//
// Everything above this block counts reads the CLIENT issues. Those are not
// the only reads on the bill, and the three sources below were missing from
// the model entirely — which is why every billed row was roughly half of
// what it should have been.
//
// HAND-COUNTED, unlike DECK_DAYS and friends, and the difference is worth
// stating. Those are single constants a narrow regex can pin. These are
// counts of call SITES across a branchy rules file and three functions; a
// regex that tried to derive them would be a second implementation of
// Firestore's evaluator, wrong in its own way and silent about it. So they
// are counted by hand, the counting is written down here, and
// `scripts/pulse.test.mjs` carries a tripwire on the call-site totals in
// firestore.rules and functions/src — if someone adds a document access,
// that test fails and names this block.

// Rule-evaluation document accesses on the ANSWER-CREATE path. Every get()
// and exists() inside a security rule is a billed read charged to the
// project, on top of the operation that triggered it.
//
// World answer (isWorldAnswer, firestore.rules): three get() calls, all of
// the SAME /v2_questions/{aid} document — options.size(), active, surface.
// Duel answer (isDuelAnswer): three DISTINCT documents — the group, the
// day's reveal (exists), and the question.
//
// Same-document repeats are free, MEASURED rather than assumed: rules cap
// document accesses at 10 per single-document request, and a probe rule
// doing 15 get()s of one document passes while 11 get()s of 11 documents is
// refused. The limit counts distinct documents, so the evaluator's cache is
// real and the same cache is what billing sees. Counted per DISTINCT
// document accordingly; the un-deduped figures would be 3 and 5.
//
// Reads cost nothing here: v2_questions and v2_question_aggs are
// `allow read: if request.auth != null`, with no document access at all. So
// a boot pays no rule reads, and this term scales with answers, not opens.
//
// The ANSWER-EDIT arm (D86) adds two get() call sites — options.size() and
// the active check — both of the SAME /v2_questions document, so an edit's
// evaluation bills 1 read by the same dedup measurement as the world
// create's 3-sites-1-document. It is deliberately NOT a term in the model:
// the 60s per-answer cooldown caps edits at a fraction of create volume
// (a user editing at the theoretical cap all month still bills less than
// their own boot), and charging the create paths is what this model is
// for. If edits ever grow a real volume story, add an `edit: 1` term here
// and charge it from a measured edit rate, not a guess.
export const RULE_READS = { world: 1, duel: 3 };

// Reads issued by Cloud Functions, per answer.
//
// The world trigger's aggregate transaction does exactly two: tx.get on the
// ledger event (dedup) and tx.get on the private aggregate. The catalog
// branch adds a third for the question's domain, but catalog is not live
// (D14), so the model charges the vote path.
//
// The duel branch of the same trigger does ZERO — it is one blind
// arrayUnion onto the group, deliberately ("one blind write, no read").
export const TRIGGER_READS = { world: 2, duel: 0 };

// The daily velocity scan (D54) reads every ledger entry written since its
// last run. One entry per world answer, so this is worldAnswers per user per
// day — a flat term the size of the boot's top-up and reseed combined, and
// invisible in the model until now. `.select()` narrows egress, not reads.
export const VELOCITY_READS_PER_LEDGER_ENTRY = 1;

// The reveal pipeline (revealGroupDay), per group-day actually revealed, for
// a group of M members:
//   1  the scan's own page read for the group document
//   1  revealRef.get() — the already-revealed short circuit
//   M  getAll(answers)
//   M  getAll(profiles, fieldMask)
// 2+M  the committing transaction: tx.getAll(revealRef, group, ...answers)
// = 4 + 3M, shared across M members.
export const revealReadsPerMember = (m) => (4 + 3 * m) / m;

// ── behaviour assumptions ───────────────────────────────────────
// The soft numbers. Every one of these is a guess about humans, not a fact
// about the code, which is why they are named and grouped rather than
// scattered through the arithmetic.
export const B = {
  worldAnswers: 3,     // daily + feed + learn
  duelAnswers: 1,
  boots: 1.4,          // app opens per active user per day
  onlineMin: 3,        // minutes with the app actually open
  peakWindowMin: 240,  // D7's 4-hour morning window
  mauMultiple: 3,      // MAU = 3 x DAU
  reseedsPerMonth: 4,  // the launch plan's weekly promotion cadence
  // How many bank documents a reseed actually changes. This is the input
  // D34 created and the model did not have: `runSeedV2` writes only changed
  // documents and the client pages `updatedAt > cursor`, so a promotion
  // costs the DELTA, not the bank. 7 is D30's promotion cadence — one new
  // daily question per day consumed.
  //
  // Before this existed the model had only a binary staticBank toggle: full
  // bank (369) or nothing (0). Neither is the shipped state, so the default
  // table described the pre-D34 world and overstated reads by ~145 per user
  // per day at every size — while COSTS.md's own prose already said the
  // real figure was ~3. Set to `bank` to recover the pre-D34 arithmetic.
  changedPerReseed: 7,
  // Members in the group a duel answer belongs to. 2 (a duo) is both the
  // product's emphasis and the WORSE case per user: revealReadsPerMember is
  // 4/m + 3, so a duo pays 5 reads per member per reveal where a 32-member
  // group pays 3.1. Raising this makes the reveal line cheaper, not dearer.
  duelGroupSize: 2,
};

// ── bytes, for the two lines the model billed as free (D67) ─────
//
// SOFTEST NUMBERS IN THIS FILE, and grouped so that is visible. Everything
// above is either read from source or a count of call sites; these are
// estimates of document sizes and a price this repo has never seen an
// invoice for. They are here because "not modelled" reads as "zero", and
// zero is the one value they certainly are not.
export const BYTES = {
  // The published aggregate — the document the listener fan-out ships on
  // every delivery, so at scale it is essentially the whole egress bill.
  // Range, not a point: a bare `{counts, total, tooSmall}` is a few hundred
  // bytes, while a full `by` breakdown is 6 dims x <=24 buckets x options
  // (BREAKDOWN_DIMS / BREAKDOWN_MAX_BUCKETS, functions/src/pure.ts). Which
  // one a real question looks like depends on how many users filled the
  // optional Basics card, which nobody knows yet — so the default is the
  // middle and COSTS.md quotes the band.
  aggDoc: 2_400,
  aggDocLow: 300,
  aggDocHigh: 7_000,
  // Everything else a boot pulls: bank questions measure 206 B each as
  // Firestore encodes them (78.4 KiB / 389 docs, counted from v2content.ts),
  // profiles and group docs are the same order.
  otherDoc: 250,
  // Index entries are billed as storage alongside the documents. The
  // multiplier is what index bytes add ON TOP of document bytes, and it is
  // low BECAUSE of the answers exemptions (D64): that collection now carries
  // one indexed field where it carried fifteen. Before them this was ~5x.
  indexMultiplier: 1.4,
};

// Internet egress, Google Cloud's rate rather than a Firestore line item.
// The free allowance is monthly, unlike Firestore's per-day tiers.
export const EGRESS_GIB = 0.12;
export const FREE_EGRESS_GIB_MO = 10;

export const SCENARIOS = [
  [50, false, "Launch / TestFlight"],
  [500, false, "Friends-of-friends"],
  [5_000, true, "Real traction"],
  [50_000, true, "Scale"],
  [500_000, true, "Hit"],
];

// Identity Platform MAU tiers. Only applies if the project was upgraded —
// plain Firebase Auth is free at any size. COSTS.md finding 3: nobody has
// recorded which one prvfire33 is on, and the gap is four figures a month.
const AUTH_TIERS = [[49_999, 0], [99_999, 0.0055], [999_999, 0.0046], [9_999_999, 0.0032]];

export function authCost(mau) {
  let c = 0, prev = 0;
  for (const [cap, rate] of AUTH_TIERS) {
    if (mau > prev) { c += (Math.min(mau, cap) - prev) * rate; prev = cap; }
  }
  return c;
}

// D7's ceiling, as a number rather than a warning: all of a day's daily
// answers land on one `v2_aggs_private/{qid}` document inside the morning
// window, and Firestore sustains roughly one write per second per document.
export const writesPerSec = (dau) => dau / (B.peakWindowMin * 60);

// The DAU at which that crosses 1.0 — the wall COSTS.md says binds first.
export const CONTENTION_DAU = B.peakWindowMin * 60;

/**
 * Bind the model to a price sheet. Everything downstream of the region
 * choice lives in here, so a caller that wants both regions gets two
 * independent models rather than a mutable global.
 */
export function costModel({ regional = false, bank = bankDocs() } = {}) {
  const P = priceSheet(regional);

  // Reads decompose into six sources — see COSTS.md "Where the reads
  // actually go". Keeping them separate is the whole point: the totals are
  // unremarkable, the decomposition is where the findings live.
  //
  // It was four until D67 added `rules` and `server`. Those two are flat in
  // DAU and together are larger than boot's top-up, reseed and the whole
  // fan-out combined at every size below ~10k DAU — which is to say the
  // model's shape below the walls was wrong, not just its total.
  function readsPerUser(dau, { mature, staticBank = false, pollAggs = false }) {
    const boot = (1 + 1 + 1 + DECK_DAYS + 1 + 2 + 2) * B.boots;
    // A question under the floor is re-read at most once per 6 h, so roughly
    // one boot in four pays for it. Mature communities have few left.
    const topUp = ((mature ? 5 : AGG_CAP) / 4) * B.boots;
    // Charged per MAU, not per DAU: a monthly visitor pays for every
    // promotion since their last visit, not just the ones since yesterday.
    // Post-D34 that is the delta (7 changed docs), not the bank (369) —
    // `staticBank` is the REMAINING unbuilt fix (serve the bank off Hosting,
    // which takes this to zero), not the one that shipped.
    const changed = staticBank ? 0 : B.changedPerReseed;
    const reseed = (changed * B.reseedsPerMonth * B.mauMultiple) / 30;
    // The quadratic one. Publishes scale with DAU; concurrent listeners
    // scale with DAU; every delivery is a billed read. ~1 of the 3 world
    // answers is the globally shared daily, which is the hot document.
    const concurrent = dau / (B.peakWindowMin / B.onlineMin);
    const fanOut = pollAggs ? 0 : concurrent * (B.worldAnswers / PUBLISH_EVERY) / 3;
    // Charged to the project on every answer create, on top of the write.
    const rules =
      B.worldAnswers * RULE_READS.world + B.duelAnswers * RULE_READS.duel;
    // Reads the SERVER issues: the aggregate transaction, the nightly
    // velocity scan walking the day's ledger, and the reveal pipeline.
    const server =
      B.worldAnswers * TRIGGER_READS.world
      + B.duelAnswers * TRIGGER_READS.duel
      + B.worldAnswers * VELOCITY_READS_PER_LEDGER_ENTRY
      + B.duelAnswers * revealReadsPerMember(B.duelGroupSize);
    return { boot, topUp, reseed, fanOut, rules, server };
  }

  // `aggBytes` selects which end of the published-aggregate size band to
  // charge egress at: "aggDocLow" | "aggDoc" | "aggDocHigh". COSTS.md quotes
  // the band because the swing variable — how many users fill the optional
  // Basics card, which is what puts a `by` breakdown in the document — is
  // not knowable before launch.
  function model(dau, mature, opts = {}) {
    const { aggBytes = "aggDoc" } = opts;
    const r = readsPerUser(dau, { mature, ...opts });
    const reads = Object.values(r).reduce((a, b) => a + b, 0) * dau;
    // Below the floor the public mirror is rewritten on EVERY answer; above
    // it, once per five. The cold-start period is the expensive one.
    const pub = mature ? 1 / PUBLISH_EVERY : 1;
    const writes = dau * (B.worldAnswers * (1 + 2 + pub) + B.duelAnswers * 2 + 0.2);
    const deletes = dau * B.worldAnswers; // ledger TTL, 90 days later
    const inv = dau * (B.worldAnswers + B.duelAnswers);
    // Concurrency 20 only pays off under queue pressure; at low volume each
    // invocation effectively owns its instance for the request.
    const pack = Math.min(TRIG.conc, Math.max(1, dau / 500));
    const cpu = (inv * TRIG.sec * TRIG.cpu) / pack;
    const mem = (inv * TRIG.sec * TRIG.mem) / pack;
    // Documents, then index entries on top of them. The multiplier is an
    // estimate (BYTES.indexMultiplier); the model billed 1.0 until D67,
    // which is the one value it cannot be.
    const docGiB =
      (dau * (B.worldAnswers + B.duelAnswers) * 0.5 * 365 +
        dau * B.worldAnswers * 0.4 * 90) / 1024 / 1024;
    const storeGiB = docGiB * BYTES.indexMultiplier;

    // Egress. Weighted rather than averaged, because the mix matters: the
    // fan-out ships the aggregate document — the big one — on every single
    // delivery, and at scale the fan-out IS the read count.
    const egressGiBMo =
      ((r.fanOut * BYTES[aggBytes] + (Object.values(r).reduce((a, b) => a + b, 0) - r.fanOut) * BYTES.otherDoc)
        * dau * 30) / 1024 ** 3;

    const over = (used, free) => Math.max(0, used - free);
    const cost = {
      reads: over(reads, FREE.read) * P.read * 30,
      writes: over(writes, FREE.write) * P.write * 30,
      deletes: over(deletes, FREE.del) * P.del * 30,
      storage: over(storeGiB, FREE.storeGiB) * P.store,
      egress: over(egressGiBMo, FREE_EGRESS_GIB_MO) * EGRESS_GIB,
      cpu: over(cpu * 30, FREE_MO.cpu) * CPU_S,
      mem: over(mem * 30, FREE_MO.mem) * MEM_S,
      req: over(inv * 30, FREE_MO.req) * REQ,
    };
    return { r, reads, writes, inv, storeGiB, docGiB, egressGiBMo, cost };
  }

  return { P, bank, model, readsPerUser };
}

// Convenience for callers that only want the bill: the eight cost lines
// summed, and the Firestore/Functions split COSTS.md's table reports.
//
// Egress counts as Firestore here. It is billed by Google Cloud networking
// rather than by Firestore, but it is bytes Firestore served and putting it
// in its own column would leave COSTS.md's two columns no longer summing to
// its own total — a worse lie than the categorical one.
export const totalCost = (c) => Object.values(c).reduce((a, b) => a + b, 0);
export const firestoreCost = (c) =>
  c.reads + c.writes + c.deletes + c.storage + c.egress;
export const functionsCost = (c) => c.cpu + c.mem + c.req;
