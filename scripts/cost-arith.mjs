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

// How often the public mirror is rewritten. Drives both the mature write
// multiplier and the listener fan-out rate.
export const PUBLISH_EVERY = readNum(
  "functions/src/v2.ts", /const PUBLISH_EVERY = (\d+)/, "PUBLISH_EVERY");

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
};

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

  // Reads decompose into exactly four sources — see COSTS.md "Where the
  // reads actually go". Keeping them separate is the whole point: the
  // totals are unremarkable, the decomposition is where the findings live.
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
    return { boot, topUp, reseed, fanOut };
  }

  function model(dau, mature, opts = {}) {
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
    const storeGiB =
      (dau * (B.worldAnswers + B.duelAnswers) * 0.5 * 365 +
        dau * B.worldAnswers * 0.4 * 90) / 1024 / 1024;

    const over = (used, free) => Math.max(0, used - free);
    const cost = {
      reads: over(reads, FREE.read) * P.read * 30,
      writes: over(writes, FREE.write) * P.write * 30,
      deletes: over(deletes, FREE.del) * P.del * 30,
      storage: over(storeGiB, FREE.storeGiB) * P.store,
      cpu: over(cpu * 30, FREE_MO.cpu) * CPU_S,
      mem: over(mem * 30, FREE_MO.mem) * MEM_S,
      req: over(inv * 30, FREE_MO.req) * REQ,
    };
    return { r, reads, writes, inv, storeGiB, cost };
  }

  return { P, bank, model, readsPerUser };
}

// Convenience for callers that only want the bill: the seven cost lines
// summed, and the Firestore/Functions split COSTS.md's table reports.
export const totalCost = (c) => Object.values(c).reduce((a, b) => a + b, 0);
export const firestoreCost = (c) => c.reads + c.writes + c.deletes + c.storage;
export const functionsCost = (c) => c.cpu + c.mem + c.req;
