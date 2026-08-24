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
import { bankArrayFrom } from "./v2content-lib.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── price sheet (Blaze) ─────────────────────────────────────────
// Multi-region is the Firebase default and roughly DOUBLE a single region.
// Which one prvfire33 is on is not stated here any more — that sentence is
// what went stale at D165 — it is read from the tree as REGIONAL above.
// Both sheets stay so the counterfactual is one flag away.
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
  return bankArrayFrom(join(ROOT, "functions/src/v2content.ts")).length;
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
  // Numeric separators stripped: `60_000` is a legal literal and reads
  // better at millisecond scale, but Number("60_000") is NaN — which would
  // propagate as a silent NaN through every table rather than throwing.
  // A no-op for the `(\d+)` patterns above.
  return Number(String(m[1]).replace(/_/g, ""));
}

// The string form of the same trade, for the one input that is a place
// rather than a count.
function readStr(rel, re, what) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const m = src.match(re);
  if (!m) {
    throw new Error(
      `cost-arith: could not read ${what} from ${rel}.\n`
      + `    Pattern ${re} matched nothing. The constant was probably renamed or\n`
      + "    reshaped. Fix the pattern here — do NOT paste the value back in.",
    );
  }
  return m[1];
}

// WHERE THE DATABASE IS, read rather than assumed (D200).
//
// This was a default parameter — `costModel({ regional = false })` — with a
// comment beside the price sheet saying multi-region "is what prvfire33 is
// on". D165 moved production to a single region on 2026-08-15 and neither
// line changed, so every table in docs/COSTS.md and every `burnUsd` the
// pulse console published was roughly DOUBLE the real bill. Nothing caught
// it for three days because the region is an INPUT: check:figures compares
// quoted numbers against the tree, and the model was computing exactly what
// it had been told, correctly, from a false premise.
//
// So the premise now comes from the same file the backend gets the database
// from, and the flag became an override for the counterfactual rather than
// the way the truth is supplied.
export const LOCATION = readStr(
  "functions/src/db.ts", /export const FIRESTORE_LOCATION = "([^"]+)"/, "FIRESTORE_LOCATION");

/** True when production is on a single region — half the price of a multi-region. */
export const REGIONAL = LOCATION.includes("-");

/** How to name the location in output, so no caller spells it out again. */
export const LOCATION_LABEL = REGIONAL ? `${LOCATION} regional` : `${LOCATION} multi-region`;

// Deck listeners attached per boot — 7 onSnapshot subscriptions, and the
// single largest term in the boot read count.
export const DECK_DAYS = readNum(
  "src/v2/data/deck.ts", /export const DECK_DAYS = (\d+)/, "DECK_DAYS");

// live.ts hydrate() top-up cap: how many still-under-floor aggregates a boot
// will re-check at most.
export const AGG_CAP = readNum(
  "src/v2/data/live.ts", /const AGG_ID_CAP = (\d+)/, "AGG_ID_CAP");

// How long a hidden app keeps its snapshot listeners before detaching them.
//
// This is the bound on `B.onlineMin` below, and it is pinned here for the
// same reason the four social caps are: it is the only thing standing
// between the fan-out term and an unbounded tail. Before it existed,
// nothing tore a listener down outside a uid change or account deletion,
// so a resident WebView kept paying for every publish to today's aggregate
// for as long as the OS let it live — and `onlineMin` was a guess about
// human behaviour being used as if it were a fact about the code.
//
// It is not a term in the arithmetic, deliberately: what it does is make
// `onlineMin` MEAN what the model already assumed, rather than adding a
// correction on top of a wrong number. Reading it from source is the
// tripwire — delete the detach and `npm run costs` fails here rather than
// going on quoting a bill that assumed it.
export const IDLE_DETACH_MS = readNum(
  "src/v2/data/live.ts", /const IDLE_DETACH_MS = ([\d_]+)/, "IDLE_DETACH_MS");

// How often the deck's aggregate is re-read while the app is visible (D129).
//
// Read from source for the same reason IDLE_DETACH_MS is: it is now the
// coefficient on the term that REPLACED the fan-out, and a model that
// hard-coded it would go stale the first time somebody tuned the interval
// for responsiveness without thinking about the bill.
//
// The honesty note this constant exists to fix: `pollAggs` used to set both
// `fanOut` and `reattach` to ZERO, i.e. it modelled polling as free. It is
// not — it is (minutes visible / interval) reads per user per day, plus one
// per foreground. Small, but "not modelled reads as free" is the exact D67
// failure, and it is worse here than usual because this is the term the
// whole cost case for D129 rests on. Pricing your own fix at zero is how
// you find out later that it was only mostly a fix.
export const AGG_POLL_MS = readNum(
  "src/v2/data/live.ts", /const AGG_POLL_MS = ([\d_]+)/, "AGG_POLL_MS");

// Documents one poll tick reads. ONE — only today's aggregate is hot, so
// `startAggPoll` ticks on `deckIds.slice(0, 1)` while the other six are
// refreshed on boot and on each foreground (which is what `reattach`
// charges). If that slice ever widens, this is the number that moves, and
// src/v2/data/idle-detach.test.ts is what fails first.
export const POLL_DOCS = 1;

// ── the D98 read surfaces (D102) ────────────────────────────────
// Named who-voted, Kindred and Circle all read OTHER USERS' answers on
// demand — the reversal's whole point, and a read family this model did
// not have a term for. "Not modelled reads as free" is the D67 lesson;
// these four bounds are what keep the family finite at all, so they are
// pinned to source the same way DECK_DAYS is.

// Voters one who-voted fetch returns, newest first (data/voters.ts). The
// crowd on a shared daily question is roughly "everyone active that day",
// so without this cap the sheet's cost is ~DAU reads per open.
export const VOTER_FETCH_CAP = readNum(
  "src/v2/data/voters.ts", /export const VOTER_FETCH_CAP = (\d+)/, "VOTER_FETCH_CAP");

// Voter lists Kindred walks — the viewer's own most recent answers, one
// capped who-voted query each (live.ts loadKindred).
export const KINDRED_QUESTIONS = readNum(
  "src/v2/data/live.ts", /const KINDRED_QUESTIONS = (\d+)/, "KINDRED_QUESTIONS");

// Circle: accounts one user can follow, and answers read per member on a
// stop open (data/circle.ts loadCircle — one query per member).
export const FOLLOW_CAP = readNum(
  "src/v2/data/circle.ts", /export const FOLLOW_CAP = (\d+)/, "FOLLOW_CAP");
export const CIRCLE_ANSWER_CAP = readNum(
  "src/v2/data/circle.ts", /export const CIRCLE_ANSWER_CAP = (\d+)/, "CIRCLE_ANSWER_CAP");

// How often the public mirror is rewritten, in answers. Drives both the
// mature write multiplier and the listener fan-out rate.
//
// A CONSTANT 1 since D98, and deliberately not read from the source any
// more: it used to track functions/src/v2.ts's PUBLISH_EVERY, and that
// literal is gone — the publish cadence was a disclosure control (batch
// the increments so an onSnapshot watcher cannot attribute a step to a
// person) and D98 retired the whole principle.
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
// A CALL answer (isCallAnswer, D194) bills 2: three get() sites on one
// /v2_questions document — 1 by the dedup measurement above — plus an
// exists() on /v2_call_outcomes/{aid}, which is a genuinely second
// document. That exists() is the clause refusing an answer once the call
// is graded, so the second read is the feature rather than an accident.
//
// NOT a term in the model below, and for a narrower reason than the edit
// arm's: this is a real answer-create path and would be charged, except
// that every call in the bank is `active: false` (D196), so no call answer
// can be written and charging it would model traffic that cannot exist.
// Recorded here rather than omitted so that re-enabling the surface is one
// term rather than a recount.
export const RULE_READS = { world: 1, duel: 3, call: 2 };

// Reads issued by Cloud Functions, per answer.
//
// The world trigger's aggregate transaction does exactly two: tx.get on the
// ledger event (dedup) and tx.get on the private aggregate. The catalog
// branch (live since D232) and the rank branch (D233) each add a third —
// the question doc, for the domain and the item count respectively — so a
// pick or rank answer costs 3 where a vote costs 2. The model still
// charges the vote path for every world answer, a DELIBERATE
// approximation rather than a stale one: `B.worldAnswers` has no per-type
// split to hang the extra read on, picks and ranks are a small slice of
// the bank (17 + 8 of 129 feed entries), and the error is one read per
// such answer, strictly under +50% on this term's smallest component.
// If the mix ever tilts toward catalogue/rank-heavy feeds, split the
// volume assumption before touching this constant.
//
// The duel branch of the same trigger does ZERO — it is one blind
// arrayUnion onto the group, deliberately ("one blind write, no read").
export const TRIGGER_READS = { world: 2, duel: 0 };

// The daily velocity scan (D54) reads every ledger entry written since its
// last run. One entry per world answer, so this is worldAnswers per user per
// day — a flat term the size of the boot's top-up and reseed combined, and
// invisible in the model until now. `.select()` narrows egress, not reads.
export const VELOCITY_READS_PER_LEDGER_ENTRY = 1;
// The Patterns fit (v28 §2, trial D166 §1), measured BEFORE the fold
// shipped per VISION-V28 §11.4: the nightly sweep re-reads the day's
// ledger as its vote log — the velocity scan's own shape, a second reader
// of the same entries — and carries each active answerer's latent vector,
// one state read and one state write per active user per day. The model
// doc itself is one read and one write per PROJECT per night, under any
// rounding here. The named lever if the ledger re-read ever matters at
// scale: flag eligible entries at write time and query the flag (a
// composite index), which drops the term by the ineligible share.
export const PATTERNS_READS_PER_LEDGER_ENTRY = 1;
export const PATTERNS_USER_STATE_OPS = 1;
// The engagement digest (R1/D268): a THIRD nightly reader of the same
// ledger entries. ENGAGEMENT-RUNBOOK 1.1's named decision, taken as a
// separate scan because velocity's cursor window and the digest's
// calendar days are different windowing semantics, and the coupling
// would cost more than the read this constant charges. Plus one
// bookkeeping state read+write per active answerer per night (the
// patterns shape — v2_users/{uid}/engagement/_state), and one public
// day doc per PROJECT per night, under any rounding here.
export const ENGAGEMENT_READS_PER_LEDGER_ENTRY = 1;
export const ENGAGEMENT_USER_STATE_OPS = 1;
// Rung 1's attention shards (R2/D270): one anonymous device shard per
// SAMPLED device per day — the client's own sampling constant, read from
// source (the D47 rule) because it is the designed lever if the fold's
// budget ever matters, and a model quoting yesterday's rate is the D34
// failure again. Each sampled device-day costs one shard write, one fold
// read, and one fold delete; the day-doc merge writes are per batch per
// day, under any rounding here.
export const ATTN_SAMPLE_RATE = readNum(
  "src/v2/data/engagement.ts", /SHARD_SAMPLE_RATE = ([\d.]+)/, "SHARD_SAMPLE_RATE");
// Rung 2's person rollups (R3/D272): one uid-keyed day rollup per active
// device per day (client-written, NOT sampled — it is the person channel),
// then the nightly fold's sweep: one page read and one folded-mark write
// per rollup, one fg-window read and write on the _state doc per rollup —
// and, 90 days later, the TTL delete. The fold does not delete rollups;
// the TTL is the deletion, which is why the delete line carries it.
export const ENGAGEMENT_ROLLUP_CLIENT_WRITES = 1;
export const ENGAGEMENT_ROLLUP_FOLD_READS = 2;
export const ENGAGEMENT_ROLLUP_FOLD_WRITES = 2;

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
  // daily + feed + learn + pulses. A pulse (D139) is one create-only,
  // day-keyed answer that is world-shaped in every charged pipeline: the
  // rules bill 1 read (three template get() sites, ONE document — the same
  // dedup as the world create's 3-sites-1-document), the trigger's
  // transaction folds it for 2, and its ledger entry feeds the velocity
  // scan like any other. Assuming the typical DAU answers it daily is the
  // same assumption the "daily" term already makes.
  //
  // THE ROSTER (D203) DID NOT MOVE THIS NUMBER, and the reason is the
  // cadence rather than optimism. Five pulses ship, but their DEFAULT
  // cadences are pace daily, energy and sleep weekly, focus and social
  // off — so the default roster asks 1 + 2/7 ≈ 1.29 pulse answers per
  // user per day against the 1 this term already assumes. Rounding that
  // into `worldAnswers` would move every figure in COSTS.md by ~0.3 of a
  // world answer (~$9/mo at 50 k DAU) on an assumption about how many
  // people raise a cadence, which is exactly the class of guess this
  // block exists to keep visible rather than bury.
  //
  // WHAT WOULD MOVE IT: every user setting every pulse to daily takes the
  // term 4 → 8 (~+$128/mo at 50 k, ~+$1,280 at 500 k). That is the
  // ceiling, it is a real number, and it is a product outcome rather than
  // a code change — so it belongs here, next to the assumption it would
  // break, rather than in a commit message.
  worldAnswers: 4,
  duelAnswers: 1,
  boots: 1.4,          // app opens per active user per day
  // Minutes per user per day with a snapshot LISTENER ATTACHED — not, as
  // this comment said until the idle detach shipped, "minutes with the app
  // actually open". The two are the same number only if something detaches
  // when the app is backgrounded, and for a long time nothing did: the only
  // teardown sites in live.ts were a uid change and account deletion, so a
  // resident WebView's listeners outlived the session that opened them and
  // the fan-out term was linear in a quantity no code bounded.
  //
  // The gloss was the bug, not the value. 3 is a fair estimate of time
  // spent looking at the app and always was; it was simply not what
  // Firestore was billing. Taken literally the difference is the whole
  // shape of the top rows — at 60 the 50k-DAU bill is $16,689/mo against
  // $1,224, and the fan-out crossover drops from ~30,800 DAU to ~1,538,
  // under D7's write-contention wall. IDLE_DETACH_MS above is what makes
  // the estimate true rather than hopeful; it caps the tail at one minute
  // per backgrounding instead of one OS eviction.
  onlineMin: 3,
  // Background→foreground cycles per user per day, and the newest soft
  // number in this block. It exists because the idle detach (D124) changed
  // the SHAPE of the fan-out input rather than only its value: what is
  // billed is `onlineMin + bgCycles × grace`, plus DECK_DAYS re-attach
  // reads per cycle. Before the detach, backgrounding cost an unbounded
  // tail and this term would have been meaningless; after it, the tail is
  // gone and this is what replaced it.
  //
  // 4 is a guess and a deliberately unflattering one — it says the app is
  // picked up and put down four times a day, which is more than 1.4 boots
  // implies because a boot is a cold start and a cycle is not. It is
  // exactly the kind of number a week of real usage settles, and it sits
  // here rather than inside the arithmetic so that it is visible as a
  // guess. Note the direction of the trade: raising this makes the detach
  // look worse and still never reaches the pre-detach cost, because that
  // one had no ceiling at all.
  bgCycles: 4,
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
  // bank or nothing. Neither is the shipped state, so the default table
  // described the pre-D34 world and overstated reads by ~145 per user
  // per day at every size — while COSTS.md's own prose already said the
  // real figure was ~3. Set to `bank` to recover the pre-D34 arithmetic.
  changedPerReseed: 7,
  // Members in the group a duel answer belongs to. 2 (a duo) is both the
  // product's emphasis and the WORSE case per user: revealReadsPerMember is
  // 4/m + 3, so a duo pays 5 reads per member per reveal where a 32-member
  // group pays 3.1. Raising this makes the reveal line cheaper, not dearer.
  duelGroupSize: 2,
  // ── how often the D98 surfaces are opened (D102) ──
  // The soft half of the `social` read term, and the same missing-input
  // shape D47 found with changedPerReseed: the term is charged per OPEN,
  // and nothing else in this block measures opens of a sheet. All three
  // are guesses about curiosity, not facts about the code — stated here
  // so the first week of real usage can correct a number instead of
  // discovering a category.
  sheetOpens: 0.15,   // who-voted sheets opened per user per day
  kindredViews: 0.03, // People-lens (Kindred) first views per user per day
  circleOpens: 0.1,   // Circle stop opens per user per day
  circleFollows: 5,   // accounts a typical circle holds (the cap is 50)
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
  // Everything else a boot pulls: bank questions measure ~238 B each as
  // Firestore encodes them (bank wire size over doc count — 119.3 KiB /
  // 513 at D102; recompute from check-figures' bankKiB when the bank
  // moves, which is how the previous figure here sat two promotion
  // cycles stale). Profiles and group docs are the same order, and so are
  // the answer docs the `social` term reads: optionIdx + surface + a
  // six-field anchors snapshot.
  otherDoc: 250,
  // Index entries are billed as storage alongside the documents. The
  // multiplier is what index bytes add ON TOP of document bytes, and it is
  // low BECAUSE of the answers exemptions (D64), which still hold for
  // eleven fields. The indexed set has grown since D64 wrote "one field
  // where it carried fifteen": answeredAt gained editedAt beside it (D86),
  // then the who-voted composite (D98) and the surface single-field that
  // Circle's query needs (D102) — call it a handful of entries per answer
  // against the ~15 the defaults would mint, so the pre-D64 figure was
  // ~5x. 1.4 stays as the blended estimate across ALL collections; if it
  // is ever re-derived, derive it from an invoice, not from this comment.
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
/**
 * The `social` term, decomposed and with its bounds overridable.
 *
 * Split out of readsPerUser at D129 for two reasons. First, this is the
 * largest read source below ~10 k DAU and the only one a product knob moves
 * directly, so "what would halving Kindred be worth" is a question somebody
 * will keep asking — and answering it by retyping the sub-terms into a
 * planning script is exactly the second-copy failure D47 caught.
 *
 * Second, the overrides are in the CAPS' OWN UNITS rather than as ratios. A
 * lever reading `{ kindredQuestions: 4 }` stays correct when KINDRED_QUESTIONS
 * moves; a lever reading `scale: 0.717` is a hand-computed figure that goes
 * stale silently, which is the one documentation error this repo keeps
 * re-committing.
 *
 * Defaults are the shipped constants, so calling it with no overrides is the
 * shipped app. `nameFactor` is the ×2 no-overlap ceiling on name resolution
 * (COSTS.md): 2 is "every voter is a stranger whose profile must be read",
 * 1 is "names are already known", and the truth is in between because crowds
 * overlap and the session cache already exists.
 */
export function socialTerms(dau, mature, o = {}) {
  const voterCap = o.voterCap ?? VOTER_FETCH_CAP;
  const kindredQs = o.kindredQuestions ?? KINDRED_QUESTIONS;
  const circleCap = o.circleAnswerCap ?? CIRCLE_ANSWER_CAP;
  const names = o.nameFactor ?? 2;
  // The crowd a capped fetch returns is min(cap, ~DAU): the daily deck is
  // globally shared, so a question's crowd is roughly everyone active that
  // day until the cap binds.
  const crowd = Math.min(voterCap, dau);
  return {
    whoVoted: B.sheetOpens * crowd * names,
    kindred: B.kindredViews * kindredQs * crowd * names,
    // A member's answer set grows with account AGE, not DAU.
    circle: B.circleOpens * B.circleFollows
      * Math.min(circleCap, B.worldAnswers * (mature ? 90 : 10)),
  };
}

export function costModel({ regional = REGIONAL, bank = bankDocs() } = {}) {
  const P = priceSheet(regional);

  // Reads decompose into seven sources — see COSTS.md "Where the reads
  // actually go". Keeping them separate is the whole point: the totals are
  // unremarkable, the decomposition is where the findings live.
  //
  // It was four until D67 added `rules` and `server`, and six until D102
  // added `social` — the D98 surfaces (who-voted, Kindred, Circle) had
  // been reading other users' answers for a day with no term at all,
  // which is the D67 failure recommitted while its correction note sat
  // forty lines up. If a key is added here, scripts/pulse.test.mjs pins
  // the key set and names the consumers that must move with it.
  // `publishEvery`, `deckListeners` and the social overrides are LEVER inputs
  // (D129): each names a change somebody could make, in the units of the
  // thing they would change, so scripts/cost-levers.mjs can price a plan
  // without re-deriving any of this. Every default is the shipped value, so
  // a caller that passes nothing models the shipped app — the property
  // pulse.test.mjs pins.
  function readsPerUser(dau, {
    mature, staticBank = false, streamAggs = false,
    publishEvery = PUBLISH_EVERY, deckListeners = DECK_DAYS, social: socialOpts = {},
  }) {
    const boot = (1 + 1 + 1 + DECK_DAYS + 1 + 2 + 2) * B.boots;
    // A question under the floor is re-read at most once per 6 h, so roughly
    // one boot in four pays for it. Mature communities have few left.
    const topUp = ((mature ? 5 : AGG_CAP) / 4) * B.boots;
    // Charged per MAU, not per DAU: a monthly visitor pays for every
    // promotion since their last visit, not just the ones since yesterday.
    // Post-D34 that is the delta (7 changed docs), not the whole bank —
    // `staticBank` is the REMAINING unbuilt fix (serve the bank off Hosting,
    // which takes this to zero), not the one that shipped.
    const changed = staticBank ? 0 : B.changedPerReseed;
    const reseed = (changed * B.reseedsPerMonth * B.mauMultiple) / 30;
    // The quadratic one. Publishes scale with DAU; concurrent listeners
    // scale with DAU; every delivery is a billed read. ~1 of the 3 world
    // answers is the globally shared daily, which is the hot document.
    // LISTENER-minutes, not foreground minutes. The idle detach (D124)
    // means a backgrounded app keeps listening for IDLE_DETACH_MS and then
    // stops, so every background→foreground cycle adds one grace period to
    // the time being billed. Before the detach this was unbounded and the
    // model simply assumed `onlineMin`; now it is
    //   foreground time + (cycles × grace)
    // which is a number the code determines rather than one the model
    // hopes for — but it is NOT `onlineMin` on its own, and saying so is
    // the point. `bgCycles` is the new soft input and it is a guess like
    // the rest; the arithmetic below is what makes it visible.
    const listenerMin = B.onlineMin + B.bgCycles * (IDLE_DETACH_MS / 60_000);
    const concurrent = dau / (B.peakWindowMin / listenerMin);
    // Polling is NOT free, and this term used to say it was. What a polled
    // client pays is one tick per AGG_POLL_MS of VISIBLE time — onlineMin,
    // not listenerMin, because the poll stops on hide with no grace period
    // (a timer costs nothing to re-arm, unlike an onSnapshot re-attach).
    // Flat in DAU, which is the entire point: the streamed version was
    // quadratic because every stranger's answer was a delivery, and nobody
    // else's behaviour appears in the polled expression at all.
    const fanOut = streamAggs
      ? concurrent * (B.worldAnswers / publishEvery) / 3
      : (B.onlineMin / (AGG_POLL_MS / 60_000)) * POLL_DOCS;
    // The other half of the same trade, and the reason the detach is a
    // grace period rather than an immediate drop: coming back re-attaches
    // the deck listeners, and an onSnapshot attach delivers the document
    // once. So each cycle costs DECK_DAYS reads, paid to avoid a whole
    // background's worth of fan-out. It is a good trade at every modelled
    // size — the break-even is ~7 reads against the publish rate on the
    // shared daily — but it is not free, and an unnamed cost is the D67
    // failure however small it is.
    // `deckListeners` is the lever: only TODAY's aggregate is hot, so a
    // client that streams one document and fetches the other six once pays
    // one read per cycle instead of DECK_DAYS. It does not touch fanOut —
    // that term already charges the hot document only.
    //
    // Polling does not make this zero either, and for a reason worth
    // stating: `startAggPoll` refreshes the WHOLE deck on every foreground,
    // not just today, because the six back days are answerable and a card
    // showing week-old counts is the thing polling must not become. So the
    // term survives D129 unchanged at DECK_DAYS per cycle — the saving was
    // entirely in the fan-out, and this is now the SECOND-largest client
    // term precisely because the largest one went away.
    //
    // One expression for both arms, because `deckListeners` means the same
    // quantity either way: documents this client pays for on each return to
    // the foreground. Streamed they were re-attached listeners, polled they
    // are re-read documents, and Firestore bills them identically.
    const reattach = B.bgCycles * deckListeners;
    // Charged to the project on every answer create, on top of the write.
    const rules =
      B.worldAnswers * RULE_READS.world + B.duelAnswers * RULE_READS.duel;
    // Reads the SERVER issues: the aggregate transaction, the three
    // nightly ledger readers (velocity scan, Patterns fit, engagement
    // digest — each re-reads the day's entries, the fit and the digest
    // each adding one state read per active user), and the reveal
    // pipeline.
    const server =
      B.worldAnswers * TRIGGER_READS.world
      + B.duelAnswers * TRIGGER_READS.duel
      + B.worldAnswers * VELOCITY_READS_PER_LEDGER_ENTRY
      + B.worldAnswers * PATTERNS_READS_PER_LEDGER_ENTRY
      + PATTERNS_USER_STATE_OPS
      + B.worldAnswers * ENGAGEMENT_READS_PER_LEDGER_ENTRY
      + ENGAGEMENT_USER_STATE_OPS
      + ATTN_SAMPLE_RATE // the shard fold reads each sampled device's shard once
      + ENGAGEMENT_ROLLUP_FOLD_READS // the rollup fold's rollup + fg-state reads
      + B.duelAnswers * revealReadsPerMember(B.duelGroupSize);
    // The D98 surfaces (D102): who-voted, Kindred, Circle — a client
    // reading OTHER users' answers on demand. One key rather than three
    // because they are one mechanism at three surfaces; the split lives in
    // the terms below. Each charges (answer docs + name resolution), and
    // names are ≤1 profile doc per distinct voter on the first surface
    // that sees them, ~0 after (session cache) — so the ×2 is the
    // no-overlap ceiling, not the steady state. The crowd a capped fetch
    // returns is min(cap, ~DAU): the daily deck is globally shared, so a
    // question's crowd is roughly everyone active that day until the cap
    // binds at DAU ≈ VOTER_FETCH_CAP — above that, `social` is flat.
    // Decomposed in socialTerms() above, which is also where the caps become
    // overridable. Summed back to one key here because the key set is pinned
    // (pulse.test.mjs) and load-bearing for pulse's stacked bar and COSTS.md's
    // table — the sub-terms are a planning input, not a ninth read source.
    const social = Object.values(socialTerms(dau, mature, socialOpts))
      .reduce((a, b) => a + b, 0);
    return { boot, topUp, reseed, fanOut, reattach, rules, server, social };
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
    // The public mirror is rewritten on every answer at every size — D98
    // removed the cadence AND the floor, so there is no immature phase
    // for a discount to differ from. This was `mature ? 1/PUBLISH_EVERY
    // : 1` — a ternary both of whose arms became 1, wearing the floor's
    // comment two decisions after the floor died. If batching ever
    // returns (as a performance measure — PUBLISH_EVERY's note), it now
    // discounts every phase, which is what a floorless world means.
    const pub = 1 / PUBLISH_EVERY;
    // + the Patterns fit's and the engagement digest's one state write
    // each per active user per night, + one attention shard per sampled
    // device per day (its fold-side day-doc merge rides per batch).
    const writes = dau * (B.worldAnswers * (1 + 2 + pub) + B.duelAnswers * 2 + PATTERNS_USER_STATE_OPS + ENGAGEMENT_USER_STATE_OPS + ATTN_SAMPLE_RATE + ENGAGEMENT_ROLLUP_CLIENT_WRITES + ENGAGEMENT_ROLLUP_FOLD_WRITES + 0.2);
    // ledger TTL 90 days later, + the shard fold deleting what it folded,
    // + the rollup TTL 90 days later (R3/D272)
    const deletes = dau * (B.worldAnswers + ATTN_SAMPLE_RATE + 1);
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
