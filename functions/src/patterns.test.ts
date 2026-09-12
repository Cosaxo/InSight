// The sweep's pass logic, against an injected store (the calls.test.ts
// precedent — the real Firestore is not needed to prove which writes a
// function chooses to make). What matters here and is pinned:
//
//   1. CORE ONLY (D161) — a tail or ineligible entry never folds, by any
//      path. This is the fold half of the rule SCALE-RUNBOOK 2.1 records;
//      the eligible set compiles from the bank.
//   2. Idempotence — a retried schedule re-folds nothing (lastDay), and a
//      missed night folds on the next run, bounded by the catch-up window.
//   3. Entries without an option (pre-deploy ledger rows, catalog rows)
//      are skipped, not guessed.
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions", () => ({
  logger: { info() {}, warn() {}, error() {} },
}));

import {
  PATTERNS_CATCHUP_DAYS, PATTERNS_ITEMS, PATTERNS_ITEM_QIDS, PATTERNS_QIDS, PICK_QIDS, SGD_LAMBDA_U,
  firestorePatternsStore, runPatternsFit, utcDay,
  type PatternsLedgerEntry, type PatternsPublication, type PatternsStore,
} from "./patterns";
import { V2_QUESTIONS } from "./v2content";
import type { Firestore } from "firebase-admin/firestore";
import {
  PATTERNS_MIN_BASIS,
  PATTERNS_QUALITY_FLOOR,
  PATTERNS_QUALITY_NOTE,
  emptyModel,
  prequentialBits,
  type PatternsDisplacement,
  type PatternsModel,
  type PatternsQuality,
  type PatternsSeeds,
  type PatternsUserState,
} from "./patternsFit";
import { ALS_LAMBDAS_U, ALS_TAUS, PATTERNS_CROSSOVER_NIGHTS, procrustes, symmetricEigen } from "./patternsAls";
import { PATTERNS_SAMPLE_CAP, PATTERNS_SEED_PER_RUN, type SampleAddition, type SampleDoc } from "./patternsSamples";
import { WORLD_MAP_ID, WORLD_MAP_MIN_ANSWERS, worldMapId, type WorldMapDoc } from "./patternsWorld";
import { WORLD_ANSWER_SURFACES } from "./answerSurfaces";

const NOW = Date.UTC(2026, 7, 19, 3, 0, 0); // the 02:37 schedule's morning

const EMPTY_DISPLACEMENT: PatternsDisplacement = { space: "loading", n: 0, moved: 0, mean: 0, p50: 0, p90: 0, max: 0, perQ: {} };
const EMPTY_SEEDS: PatternsSeeds = { n: 0, meanCos: 0, share90: 0, meanNorm: 0, seedNorm: 0 };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function memoryStore(
  ledger: Record<string, PatternsLedgerEntry[]>,
  // The answers collection as the seed query would return it (D442): per
  // question, the newest cap of its world answers already projected to
  // additions. Absent means the question has no answers on disk.
  answers: Record<string, SampleAddition[]> = {},
) {
  const users = new Map<string, PatternsUserState>();
  const samples = new Map<string, SampleDoc>();
  const citySamples = new Map<string, SampleDoc>();
  const worldMaps = new Map<string, WorldMapDoc>();
  const state = {
    /** The voter samples as the last putSamples left them (D397). */
    samples,
    /** The per-city samples, by document id (runbook 2.5). */
    citySamples,
    /** The world map's position documents, by id (D462). */
    worldMaps,
    /** Every seed query the run paid for, in order (D442). */
    seedCalls: [] as string[],
    /** The publication as the last putModel left it — whole, cloned, the
     * way the Firestore store reads the document back (D395). */
    pub: null as PatternsPublication | null,
    users,
    putModelCalls: 0,
    breakPutModelOnce: false,
    // The shapes the older cases read, derived from the publication: the
    // ONLINE engine's model wherever it lives tonight, and the engine's
    // own scorecard fields. The setter seeds a pre-D395 document.
    get model(): (PatternsModel & { lastDay?: string }) | null {
      const p = this.pub;
      if (!p) return null;
      const rows = p.engine === "sgd" ? p.q : (p.candidates.sgd?.q ?? {});
      const q: PatternsModel["q"] = {};
      for (const [key, r] of Object.entries(rows)) q[key] = { v: r.v, n: r.n, sum: r.sum };
      return { k: p.k, q, lastDay: p.lastDay };
    },
    set model(m: (PatternsModel & { lastDay?: string }) | null) {
      this.pub = m
        ? {
          k: m.k, lastDay: m.lastDay ?? "", folded: 0, engine: "sgd",
          q: Object.fromEntries(Object.entries(m.q).map(([key, r]) => [key, { v: r.v, n: r.n, sum: r.sum }])),
          lambdaU: SGD_LAMBDA_U, displacement: EMPTY_DISPLACEMENT, seeds: EMPTY_SEEDS, candidates: {},
        }
        : null;
    },
    get quality(): PatternsQuality | null { return this.pub?.quality ?? null; },
    get displacement(): PatternsDisplacement | null { return this.pub?.displacement ?? null; },
    get seeds(): PatternsSeeds | null { return this.pub?.seeds ?? null; },
  };
  // PROJECTED, field by field, exactly as firestorePatternsStore does for
  // the per-person docs — and it used to hand back the same object
  // REFERENCE, so anything the fold hung on the state survived here for
  // free while the real store named `v` and `n` and nothing else. That is
  // how the retry guard shipped dead. A fake that carries more than its
  // subject proves nothing about it.
  const project = (s: PatternsUserState): PatternsUserState => ({
    v: [...s.v], n: s.n, ...(s.d ? { d: s.d } : {}), ...(s.a ? { a: { ...s.a } } : {}), ...(s.an ? { an: { ...s.an } } : {}), ...(s.p ? { p: { ...s.p } } : {}),
  });
  const store: PatternsStore = {
    async ledgerDay(day) { return ledger[day] ?? []; },
    async getModel() { return state.pub ? clone(state.pub) : null; },
    async putModel(pub) {
      if (state.breakPutModelOnce) {
        state.breakPutModelOnce = false;
        throw new Error("model write lost");
      }
      state.pub = clone(pub);
      state.putModelCalls++;
    },
    async getUsers(uids) {
      const out = new Map<string, PatternsUserState>();
      for (const uid of uids) {
        const s = users.get(uid);
        if (s) out.set(uid, project(s));
      }
      return out;
    },
    async putUsers(states) {
      for (const [uid, s] of states) users.set(uid, project(s));
    },
    async scanUsers(each) {
      for (const [uid, s] of [...users.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) each(uid, project(s));
    },
    async getSamples(qids) {
      const out = new Map<string, SampleDoc>();
      for (const qid of qids) { const d = samples.get(qid); if (d) out.set(qid, clone(d)); }
      return out;
    },
    async putSamples(next) {
      for (const [qid, d] of next) samples.set(qid, clone(d));
    },
    async getCitySamples(ids) {
      const out = new Map<string, SampleDoc>();
      for (const id of ids) { const d = citySamples.get(id); if (d) out.set(id, clone(d)); }
      return out;
    },
    async putCitySamples(next) {
      for (const [id, d] of next) citySamples.set(id, clone(d));
    },
    // What is published RIGHT NOW, before tonight's write — the real store
    // reads it by id range. The fold uses it to rewrite a country that
    // emptied out, so a fake that always answered nothing would hide
    // exactly the case this exists for.
    async listWorldMapIds() {
      return [...worldMaps.keys()];
    },
    async putWorldMaps(next) {
      // a set, not a merge — the run rebuilds each document whole
      worldMaps.clear();
      for (const [id, d] of next) worldMaps.set(id, clone(d));
    },
    async seedRows(qid) {
      state.seedCalls.push(qid);
      return clone(answers[qid] ?? []);
    },
  };
  return { store, state };
}

// two real eligible qids from the compiled bank, so the test moves with it
const [CORE_A, CORE_B] = [...PATTERNS_QIDS];
// A question the CANDIDATE's corpus names and the online engine's does
// not — the D395 widening. Derived rather than named, so it moves with
// the bank.
//
// The count is NOT written here, and that is the point rather than an
// omission. It said "263 of them today" and the true figure is 423: the
// bank went 913 → 1073 and `itemEligible` admits `surface === "test"`, so
// v2content's new deep items all entered the candidate corpus and the
// sentence was stale inside twenty-four hours. `check:figures` cannot hold
// it either — the number is the difference between two predicates that
// live in patterns.ts, and re-deriving them in an .mjs gate would be the
// second copy of an eligibility rule, which is the D197 failure. So it
// follows the gate's own advice for a figure it cannot compute: state the
// relationship, not the number.
const [WIDE_ONLY] = [...PATTERNS_ITEM_QIDS].filter((q) => !PATTERNS_QIDS.has(q));
const yesterday = utcDay(NOW, -1);
const twoBack = utcDay(NOW, -2);

describe("the eligible set", () => {
  it("is two-option daily plus core feed, and nothing else", () => {
    for (const q of V2_QUESTIONS) {
      const expected =
        Array.isArray(q.options) && q.options.length === 2 &&
        (q.surface === "daily" || (q.surface === "feed" && q.core === true));
      expect(PATTERNS_QIDS.has(q.id), q.id).toBe(expected);
    }
    // and the set is non-trivial — a bank change that empties it should fail loudly
    expect(PATTERNS_QIDS.size).toBeGreaterThan(50);
  });

  it("the candidate's corpus is every option-shaped core item, and its two-option rows are exactly the online engine's", () => {
    const bin = PATTERNS_ITEMS.filter((s) => s.kind === "bin").map((s) => s.key).sort();
    expect(bin).toEqual([...PATTERNS_QIDS].sort());
    // the instrument items join as ordinal rows (the owner's call, 2026-09-06)
    const test = V2_QUESTIONS.filter((q) => q.surface === "test");
    expect(test.length).toBeGreaterThan(100);
    for (const q of test) expect(PATTERNS_ITEMS.find((s) => s.key === q.id)?.kind, q.id).toBe("ord");
    // a multi-option pick becomes one pseudo-item per option, keyed off the qid
    const choice = V2_QUESTIONS.find((q) => q.surface === "daily" && q.type === "choice" && q.options.length === 4)!;
    expect(PATTERNS_ITEMS.filter((s) => s.qid === choice.id).map((s) => s.key)).toEqual([0, 1, 2, 3].map((i) => `${choice.id}~${i}`));
    // learn, pulse, call, catalog and the tail stay out
    for (const q of V2_QUESTIONS) {
      if (q.surface === "learn" || q.surface === "pulse" || q.surface === "call" || q.type === "catalog" || (q.surface === "feed" && q.core !== true)) {
        expect(PATTERNS_ITEM_QIDS.has(q.id), q.id).toBe(false);
      }
    }
  });
});

describe("what folds", () => {
  it("folds eligible entries and refuses tail, unknown and option-less ones", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: CORE_B, optionIdx: 1 },
        { uid: "u1", qid: "feed-tail-x", optionIdx: 0 },      // not in the bank → tail by definition
        { uid: "u1", qid: CORE_A },                            // pre-deploy row, no option
        { uid: "u2", qid: CORE_A, optionIdx: 1 },
        // …AND ONE ON ITS OWN PERSON. The option-less row above shares its
        // (uid, qid) with a real answer three lines up, so the per-day
        // last-wins dedupe collapses the two into one entry and every
        // count below is identical whether the option guard runs or not.
        // Measured: with the guard dropped this case stayed green, while
        // an option-less row folds as `encodeAnswer(undefined)` = -1 —
        // "option 1" — and overwrites that person's real answer. This row
        // has nothing to hide behind.
        { uid: "u3", qid: CORE_B },
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.folded).toBe(3);
    expect(r.users, "the person whose only row carries no answer was counted").toBe(2);
    expect(Object.keys(state.model?.q ?? {}).sort()).toEqual([CORE_A, CORE_B].sort());
    expect(state.model?.q[CORE_A].n).toBe(2);
    // THE SUM, not just the count — the count is what a dropped guard
    // leaves alone. u1 said option 0 (+1) and u2 option 1 (-1), so CORE_A
    // sums to 0; CORE_B has u1's single option 1 and nobody else.
    expect(state.model?.q[CORE_A].sum, "a row with no answer reached the published sum").toBe(0);
    expect(state.model?.q[CORE_B].sum).toBe(-1);
    expect(state.model?.q[CORE_B].n).toBe(1);
    expect(state.users.get("u1")?.n).toBe(2);
    expect(state.users.get("u2")?.n).toBe(1);
    expect(state.users.get("u3"), "an option-less row minted a person").toBeUndefined();
  });
});

describe("idempotence and catch-up", () => {
  it("a second run the same morning folds nothing", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    const again = await runPatternsFit(store, NOW);
    expect(again.folded).toBe(0);
    expect(state.model?.q[CORE_A].n).toBe(1);
  });

  // THE CRASH the case above cannot reach. "A second run the same
  // morning" works because the cursor was written; the cursor is written
  // ONCE, after the whole catch-up loop, while the user vectors are
  // written per day — so a crash inside the loop leaves the cursor behind
  // and the next run re-reads days those vectors already carry.
  // `foldUserDay` is a step, not a set, so it moved every touched
  // person's coordinate twice.
  it("a crash before the model is published does not step a vector twice", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    state.breakPutModelOnce = true;
    await expect(runPatternsFit(store, NOW)).rejects.toThrow("model write lost");
    const after = state.users.get("u1")!;
    expect(after.n, "the vector was written before the crash").toBe(1);
    expect(after.d, "and stamped with the day it folded").toBe(yesterday);
    expect(state.model, "the cursor never landed").toBeNull();

    const again = await runPatternsFit(store, NOW);
    expect(
      state.users.get("u1")!.n,
      "the vector was stepped twice — the crash left the cursor behind and "
      + "the retry re-read a day this person already carries",
    ).toBe(1);
    expect(again.folded).toBe(0);
    expect(again.users).toBe(0);
  });

  // …AND IT DOES NOT PUBLISH "NOBODY ANSWERED" ABOUT THAT DAY. The retry
  // guard above skips everybody the dead run stamped, so the re-walk scores
  // nothing — and a zero row in the series means exactly one thing, which
  // that day is not: the day HAD answers, they were folded, and the run
  // that folded them died before it could publish. The row would have sat
  // 90 days in the standing prequential record, and the ledger day is
  // consumed, so nothing could ever recompute it.
  it("a crashed day is not republished as a day nobody answered", async () => {
    const { store, state } = memoryStore({
      [twoBack]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }, { uid: "u2", qid: CORE_A, optionIdx: 1 }],
      [yesterday]: [{ uid: "u1", qid: CORE_B, optionIdx: 1 }, { uid: "u2", qid: CORE_B, optionIdx: 0 }],
    });
    state.breakPutModelOnce = true;
    await expect(runPatternsFit(store, NOW)).rejects.toThrow("model write lost");
    expect(state.quality, "nothing was published by the run that died").toBeNull();

    await runPatternsFit(store, NOW);
    const series = state.quality!.series;
    const zeros = series.filter((r) => r.n === 0).map((r) => r.day);
    // Only about the two days that HAD answers. The catch-up window's
    // genuinely empty days keep their zero rows, which is the putModel
    // zero-rather-than-nothing idiom saying something true.
    expect(zeros, "a day that had answers was published as a day with none")
      .not.toContain(twoBack);
    expect(zeros).not.toContain(yesterday);
    // …and the cursor still advanced, or the same days would be re-walked
    // every night forever: every person is stamped, so no later run can
    // ever score them.
    expect(state.model!.lastDay).toBe(yesterday);
  });

  it("keeps a day the retry actually scored, even though a dead run stamped some of it", async () => {
    // THE CASE THE `&&` EXISTS FOR, and the one neither test above
    // reaches: both of those are all-or-nothing — every person stamped, or
    // no entries at all. The guard drops a day only when it had entries
    // AND every one of them was already folded. A PARTIAL crash — the run
    // died after stamping some people and before stamping the rest — is
    // the ordinary shape of a crash, and there `write.size` is non-zero
    // and `refolded` is non-zero at the same time.
    //
    // Measured before this case existed: `&&` → `||` left all 616
    // functions tests green, and the day that really scored an
    // observation then vanished from the published series — the standing
    // 90-day prequential record D325 calls "the number any candidate
    // engine must beat", world-readable and unrecomputable once the
    // ledger day it describes has been consumed. `taste.test.ts` has this
    // exact case for its own fold; its twin here did not.
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "stamped", qid: CORE_A, optionIdx: 0 },
        { uid: "fresh", qid: CORE_A, optionIdx: 1 },
      ],
    });
    // What a dead run leaves behind: one person carrying the day's stamp,
    // one untouched. `d >= day` is the retry guard's own test.
    state.users.set("stamped", { v: Array(8).fill(0), n: 1, d: yesterday });

    await runPatternsFit(store, NOW);

    const row = state.quality!.series.find((r) => r.day === yesterday);
    expect(row, "the day the retry scored is missing from the series").toBeTruthy();
    expect(row!.n, "the day was published as one nobody answered").toBeGreaterThan(0);
    // …and the person the dead run never reached really was folded, so
    // this is a day that was scored rather than merely kept.
    expect(state.users.get("fresh")?.d).toBe(yesterday);
  });

  it("still drops the day when the only person the retry reached answered nothing it scores", async () => {
    // WHERE `write.size` AND `score.n` CAME APART, which is what D395 did
    // to the guard without anyone noticing. `write` holds everyone the
    // fold loop TOUCHED, and since the corpus widened that includes a
    // person whose only answer that day was a wider-corpus item: nothing
    // scores them — they never enter `byUid` — but their map is merged
    // and they are written.
    //
    // So one newcomer of that kind on a retried day made `write.size`
    // non-zero while the day's score was still n: 0, and the fabricated
    // "nobody answered" row went into the standing 90-day record for a day
    // that HAD a scored answer, folded by the run that died. The record is
    // world-readable and unrecomputable once the ledger day is consumed.
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "stamped", qid: CORE_A, optionIdx: 0 },
        // Not in the online engine's corpus, so it scores nothing — but it
        // IS in the candidate's, so the person is compacted and written.
        { uid: "wideOnly", qid: WIDE_ONLY, optionIdx: 0 },
      ],
    });
    state.users.set("stamped", { v: Array(8).fill(0), n: 1, d: yesterday });

    await runPatternsFit(store, NOW);

    const row = state.quality?.series.find((r) => r.day === yesterday);
    expect(row, "a fabricated n: 0 row reached the standing record").toBeFalsy();
    // The fixture has to be the one described, or the assertion above
    // passes for the wrong reason: the wider-corpus person really was
    // written, which is exactly what used to defeat the guard.
    expect(state.users.get("wideOnly")?.d, "fixture: the wide-only person was not written").toBe(yesterday);
  });

  it("publishes NO scorecard when every owed day crashed and there is no prior", async () => {
    // The hole in the case above's own scenario. When `scored` empties AND
    // there is no previous publish to carry forward, the fallback
    // manufactured `publishableQuality([{ day: yesterday, score:
    // emptyDayScore() }])` — the exact "nobody answered" row the drop
    // exists to suppress, published as the head of the series.
    //
    // Reachable, and this is the shape: a FIRST-EVER run with answers on
    // every day of the catch-up window, which dies before putModel. Every
    // person is stamped as folded, no model was written, so the retry
    // drops all seven days and has no prior. The case above escapes it
    // only because its window still holds five genuinely-empty days.
    const ledger: Record<string, Array<{ uid: string; qid: string; optionIdx: number }>> = {};
    for (let back = 1; back <= PATTERNS_CATCHUP_DAYS; back++) {
      ledger[utcDay(NOW, -back)] = [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u2", qid: CORE_A, optionIdx: 1 },
      ];
    }
    const { store, state } = memoryStore(ledger);
    state.breakPutModelOnce = true;
    await expect(runPatternsFit(store, NOW)).rejects.toThrow("model write lost");
    expect(state.quality, "nothing was published by the run that died").toBeNull();

    const r = await runPatternsFit(store, NOW);
    //  because the two absences differ by construction: the
    // memory store starts at null and the fix OMITS the field, so it is
    // undefined. Both mean the same thing here — nothing was published.
    expect(state.quality ?? null, "a run with nothing to score published a day nobody answered")
      .toBeNull();
    // The model itself still publishes and the cursor still advances —
    // the loadings are the product, the scorecard is the commentary.
    expect(state.model!.lastDay).toBe(yesterday);
    expect(r.bits).toBe(0);
  });

  it("a vector written before the stamp existed folds once, not never", async () => {
    // Every vector in production predates `d`. An absent stamp has to mean
    // "fold it", or this fix would freeze every existing coordinate.
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    state.users.set("u1", { v: [0, 0, 0, 0, 0, 0, 0, 0], n: 3 });
    const r = await runPatternsFit(store, NOW);
    expect(r.folded).toBe(1);
    expect(state.users.get("u1")!.n).toBe(4);
    expect(state.users.get("u1")!.d).toBe(yesterday);
  });

  it("a missed night folds on the next run, oldest day first", async () => {
    const dayBefore = utcDay(NOW, -2);
    const { store, state } = memoryStore({
      [dayBefore]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    // the model has folded up to three days ago; two nights are owed
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    const r = await runPatternsFit(store, NOW);
    expect(r.days).toBe(2);
    expect(state.model?.q[CORE_A].n).toBe(2);
    expect(state.model?.lastDay).toBe(yesterday);
  });

  it("a fresh model's first run asks the whole bounded window", async () => {
    const { store } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.days).toBe(7); // asked, not folded — six were empty
    expect(r.folded).toBe(1);
  });

  it("folds a D86 edit as ONE answer, not as two people disagreeing", async () => {
    // The ledger is a log of aggregate EVENTS. An optionIdx edit writes a
    // second entry under a fresh event.id, byte-identical in shape to the
    // create it supersedes — so a person who answered 0 and changed their
    // mind to 1 arrived here as two rows. Thirty of them folded as
    // {n: 60, marginal: 0}: a p0 of 0.500 against a truth of 0.050, which
    // inflates the basis nextAsk(minBasis = 8) gates the Oracle on.
    const { store } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },   // answered
        { uid: "u1", qid: CORE_A, optionIdx: 1 },   // …then edited
        { uid: "u2", qid: CORE_A, optionIdx: 1 },   // one real second person
      ],
    });
    const r = await runPatternsFit(store, NOW);
    // Two people, two observations — not three.
    expect(r.folded).toBe(2);
    expect(r.users).toBe(2);
  });

  it("keeps the LATEST answer of an edited pair, not the first", async () => {
    // Last-wins, because ledgerDay returns the day in `at` order. Taking the
    // first would fold the answer the user explicitly retracted, which is
    // worse than double-counting: it is confidently wrong rather than noisy.
    //
    // Read through the user state: u1's only surviving observation must be
    // the one u2 agrees with, so both users fold identically.
    const edited = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: CORE_A, optionIdx: 1 },
      ],
    });
    await runPatternsFit(edited.store, NOW);
    const plain = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 1 }],
    });
    await runPatternsFit(plain.store, NOW);
    expect(edited.state.users.get("u1")).toEqual(plain.state.users.get("u1"));
    expect(edited.state.model?.q).toEqual(plain.state.model?.q);
  });

  it("an edit made on a LATER day is a revision, not a second person", async () => {
    // The case the per-day dedupe could not see, and the common one: an
    // edit has no day window, so most of them land after the day the
    // answer was folded. Read as a first answer it put the same person in
    // `n` twice and left both answers in `sum` — thirty people who said 0
    // and changed to 1 published `{n: 60, marginal: 0}` where the truth is
    // `{n: 30, marginal: +1}`.
    const dayA = utcDay(NOW, -2);
    const dayB = utcDay(NOW, -1);
    const N = 30;
    const ledger: Record<string, PatternsLedgerEntry[]> = { [dayA]: [], [dayB]: [] };
    for (let i = 0; i < N; i++) {
      const uid = `u${i}`;
      ledger[dayA].push({ uid, qid: CORE_A, optionIdx: 1 });
      // the edit: option 1 → option 0, carrying what it moved away from
      ledger[dayB].push({ uid, qid: CORE_A, optionIdx: 0, fromIdx: 1 });
    }
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW);
    const L = state.model!.q[CORE_A];
    expect(L.n, "the population did not grow — one member changed their mind").toBe(N);
    expect(L.sum / L.n, "everyone now says option 0, which encodes +1").toBe(1);
  });

  it("counts the person once even when the create and the edit share a day", async () => {
    // The other order, which the per-day dedupe already handled and must
    // keep handling: a create and an edit on the same day is one person
    // with their final answer, never a revision of something unfolded.
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 1 },
        { uid: "u1", qid: CORE_A, optionIdx: 0, fromIdx: 1 },
      ],
    });
    await runPatternsFit(store, NOW);
    const L = state.model!.q[CORE_A];
    expect(L.n).toBe(1);
    expect(L.sum).toBe(1);
  });

  it("folds an edit written before the ledger carried fromIdx exactly as it used to", async () => {
    // History is not rewritten. An entry with no `fromIdx` is a first
    // answer by definition, so rows already in the ledger keep folding the
    // way they were folded — the fix is forward-looking and says so.
    const dayA = utcDay(NOW, -2);
    const dayB = utcDay(NOW, -1);
    const { store, state } = memoryStore({
      [dayA]: [{ uid: "u1", qid: CORE_A, optionIdx: 1 }],
      [dayB]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    expect(state.model!.q[CORE_A].n).toBe(2);
  });

  it("still folds two DIFFERENT questions from one person", async () => {
    // The dedup is per (person, question). Collapsing to one observation per
    // person would be the obvious wrong version of this fix, and it would
    // quietly halve the model's input.
    const { store } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: CORE_B, optionIdx: 1 },
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.folded).toBe(2);
    expect(r.users).toBe(1);
  });

  it("the catch-up window is bounded — an ancient lastDay does not scan the whole ledger", async () => {
    const { store, state } = memoryStore({});
    state.model = { k: 8, q: {}, lastDay: "2020-01-01" };
    const r = await runPatternsFit(store, NOW);
    // only the last PATTERNS_CATCHUP_DAYS days were even asked for
    expect(r.days).toBeLessThanOrEqual(7);
  });
});

// ── the fit's own scorecard (D325) ────────────────────────────────────
//
// The two bridge-approved instruments, at the run level: the prequential
// score is computed ON the fold (one step ahead, the model as it stood),
// and the displacement compares publish to publish. Both ride putModel;
// neither adds a read or a write.
describe("the scorecard the run publishes", () => {
  it("scores the day one step ahead and publishes pooled bits with the day's basis", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u2", qid: CORE_A, optionIdx: 0 },
      ],
    });
    const r = await runPatternsFit(store, NOW);
    const q = state.quality;
    expect(q?.day).toBe(yesterday);
    expect(q?.n).toBe(2);
    // u1 folds first (uid order): a never-seen question against a zero
    // vector is a coin — exactly 1 bit. u2 then faces a marginal of +1
    // and agrees with it: the Oracle link's own clamp price.
    const expected = (1 + prequentialBits(1, 1)) / 2;
    expect(q?.bits).toBeCloseTo(expected, 3);
    expect(r.bits).toBe(q?.bits);
    expect(q?.note).toBe(PATTERNS_QUALITY_NOTE);
    // Both people are fresh, so θ·L is zero and every guess IS the
    // marginal's: the baseline equals the fit's bits and skill is 0 — the
    // reading the probe found in production's own regime (D394).
    expect(q?.baselineBits).toBe(q?.bits);
    expect(q?.skill).toBe(0);
    expect(r.skill).toBe(0);
    // …and the seeds summary rides the publish: two loadings, both still
    // pointing where their hash put them
    expect(state.seeds?.n).toBe(1);
    expect(state.seeds?.meanCos).toBeCloseTo(1, 3);
    expect(r.seedCos).toBe(state.seeds?.meanCos);
  });

  it("keeps an n:0 row for an empty day rather than skipping the date", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    // a fresh model asks the whole bounded window; six of the seven days
    // held nothing and the series says so out loud
    const series = state.quality?.series ?? [];
    expect(series).toHaveLength(7);
    expect(series[series.length - 1]).toEqual({ day: yesterday, n: 1, bits: 1, baselineBits: 1 });
    expect(series.filter((row) => row.n === 0)).toHaveLength(6);
  });

  it("appends to the published series across runs instead of restarting it", async () => {
    const today = utcDay(NOW, 0);
    const ledger = {
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [today]: [{ uid: "u2", qid: CORE_A, optionIdx: 1 }],
    };
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW);
    const tomorrow = NOW + 24 * 3600 * 1000;
    await runPatternsFit(store, tomorrow);
    const series = state.quality?.series ?? [];
    expect(series).toHaveLength(8); // 7 from the first window + 1 owed day
    expect(series[series.length - 1]?.day).toBe(today);
  });

  it("publishes a question's own day only at the floor, pooled always (the verdict's condition)", async () => {
    const crowd = Array.from({ length: PATTERNS_QUALITY_FLOOR }, (_, i) => ({
      uid: `u${i}`,
      qid: CORE_A,
      optionIdx: (i % 2) as 0 | 1,
    }));
    const { store, state } = memoryStore({
      [yesterday]: [...crowd, { uid: "u0", qid: CORE_B, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    const q = state.quality;
    // CORE_B's one answer IS one person's surprisal — pooled only
    expect(q?.n).toBe(PATTERNS_QUALITY_FLOOR + 1);
    expect(Object.keys(q?.perQ ?? {})).toEqual([CORE_A]);
    expect(q?.perQ[CORE_A]?.n).toBe(PATTERNS_QUALITY_FLOOR);
    expect(q?.floor).toBe(PATTERNS_QUALITY_FLOOR);
  });

  it("measures displacement publish-to-publish, in loading space, unaligned", async () => {
    const today = utcDay(NOW, 0);
    const ledger = {
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u2", qid: CORE_A, optionIdx: 1 },
        { uid: "u1", qid: CORE_B, optionIdx: 0 },
      ],
      [today]: [{ uid: "u3", qid: CORE_A, optionIdx: 1 }],
    };
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW);
    // the first publish has nothing behind it to compare against
    expect(state.displacement).toMatchObject({ space: "loading", n: 0, moved: 0 });

    // Day 2's answerer carries a real vector — a fresh user's θ is all
    // zeros, and e·θ is the only term that moves a loading beyond the
    // 4 dp the publication keeps, so a cold crowd would (correctly)
    // measure as "nothing moved".
    state.users.set("u3", { v: [1, 0, 0, 0, 0, 0, 0, 0], n: 5 });
    await runPatternsFit(store, NOW + 24 * 3600 * 1000);
    const d = state.displacement;
    // both previously published questions are compared; only the one the
    // new day folded moved (CORE_B saw no answer, so it sat still)
    expect(d?.n).toBe(2);
    expect(d?.moved).toBe(1);
    expect(Object.keys(d?.perQ ?? {})).toEqual([CORE_A]);
    expect(d?.max).toBe(d?.perQ[CORE_A]);
    expect(d?.p50).toBe(0); // the median question did not move
  });
});

// ── the mount signal (D265) ───────────────────────────────────────────
//
// The publication half, which the injected store above deliberately
// cannot see: `firestorePatternsStore` is what decides WHERE the numbers
// land, and the tab appearing at all depends on the second write landing
// on the document `hydrate()` reads. Without this, a fit that stopped
// writing the signal would leave the tab hidden on a database full of
// loadings — a failure with no error anywhere, which is the shape the
// store interface exists to keep testable.
describe("what the fit publishes for the tab's gate", () => {
  /** putModel touches two collections and nothing else, so the cast is a
   * claim this test can be read against rather than a hole. */
  const asDb = (fake: { collection: (name: string) => unknown }): Firestore =>
    fake as unknown as Firestore;

  /** Just enough Firestore for putModel: refs that record their writes. */
  function fakeDb() {
    const writes: { path: string; data: Record<string, unknown>; opts?: unknown }[] = [];
    const db = {
      collection(name: string) {
        return {
          doc(id: string) {
            return {
              set(data: Record<string, unknown>, opts?: unknown) {
                writes.push({ path: `${name}/${id}`, data, opts });
                return Promise.resolve();
              },
            };
          },
        };
      },
    };
    return { db, writes };
  }

  const modelWith = (basisByQid: Record<string, number>): PatternsModel => {
    const model = emptyModel();
    for (const [qid, n] of Object.entries(basisByQid)) {
      model.q[qid] = { v: Array.from({ length: model.k }, () => 0.1), n, sum: 0 };
    }
    return model;
  };

  // the scorecard fixtures putModel now carries (D325) — what the run
  // computed; this block only cares WHERE they land
  const QUALITY: PatternsQuality = {
    day: "2026-08-22",
    n: 12,
    bits: 0.91,
    baselineBits: 0.91,
    skill: 0,
    perQ: {},
    floor: PATTERNS_QUALITY_FLOOR,
    series: [{ day: "2026-08-22", n: 12, bits: 0.91, baselineBits: 0.91 }],
    note: PATTERNS_QUALITY_NOTE,
  };
  const DISPLACEMENT: PatternsDisplacement = {
    space: "loading", n: 0, moved: 0, mean: 0, p50: 0, p90: 0, max: 0, perQ: {},
  };
  const SEEDS: PatternsSeeds = { n: 3, meanCos: 1, share90: 1, meanNorm: 0.08, seedNorm: 0.0816 };

  const pubWith = (model: PatternsModel, extra: Partial<PatternsPublication> = {}): PatternsPublication => ({
    k: model.k,
    lastDay: "2026-08-22",
    folded: 12,
    engine: "sgd",
    q: Object.fromEntries(Object.entries(model.q).map(([key, r]) => [key, { v: r.v, n: r.n, sum: r.sum }])),
    lambdaU: SGD_LAMBDA_U,
    quality: QUALITY,
    displacement: DISPLACEMENT,
    seeds: SEEDS,
    candidates: {},
    ...extra,
  });

  it("writes the drawable count and its floor onto the meta doc, merged", async () => {
    const { db, writes } = fakeDb();
    // three published questions, two of them at the floor or better
    const model = modelWith({ a: PATTERNS_MIN_BASIS, b: PATTERNS_MIN_BASIS + 40, c: 1 });
    await firestorePatternsStore(asDb(db)).putModel(pubWith(model));

    expect(writes.map((w) => w.path)).toEqual(["v2_patterns/loadings", "v2_meta/app"]);
    const loadings = writes[0];
    // every vector still publishes, floor or no floor — the basis rides
    // with each one and the readers refuse per question
    expect(Object.keys(loadings.data.q as Record<string, unknown>)).toEqual(["a", "b", "c"]);
    // the scorecard rides the SAME write (D325): no extra doc, no extra
    // read for whoever comes to draw it
    expect(loadings.data.quality).toEqual(QUALITY);
    expect(loadings.data.displacement).toEqual(DISPLACEMENT);
    // …and the seed-distance summary (D394), a property of the model rather
    // than of a day, so it rides every publish
    expect(loadings.data.seeds).toEqual(SEEDS);
    // the whole publication, plus the server clock, and nothing undefined
    // for Firestore to refuse (D395)
    expect(loadings.data.engine).toBe("sgd");
    expect(loadings.data.lambdaU).toBe(SGD_LAMBDA_U);
    expect(loadings.data).toHaveProperty("at");
    expect(JSON.stringify(loadings.data)).not.toContain("undefined");

    const meta = writes[1];
    expect(meta.data).toEqual({ patternsPool: 2, patternsBasis: PATTERNS_MIN_BASIS });
    // MERGED, never set: contentRev, latestBuild, minBuild and updateUrl
    // live on this document and belong to the seed and the operator.
    expect(meta.opts).toEqual({ merge: true });
  });

  it("publishes a zero rather than nothing when no question is drawable yet", async () => {
    const { db, writes } = fakeDb();
    await firestorePatternsStore(asDb(db)).putModel(pubWith(modelWith({ a: 1, b: 2 })));
    // A field that stops being written is a field the client keeps
    // reading at its last value — so early nights say 0 out loud.
    expect(writes[1].data).toEqual({ patternsPool: 0, patternsBasis: PATTERNS_MIN_BASIS });
  });

  it("counts the pool over two-option rows only when the engine's corpus is wider", async () => {
    // The candidate engine publishes ordinal and one-hot rows beside the
    // two-option ones. The Map draws bin rows; the tab's gate counts what
    // the Map draws, so a corpus of well-fitted scale items does not open
    // a tab on rows no lens has a design for.
    const { db, writes } = fakeDb();
    const model = modelWith({ a: PATTERNS_MIN_BASIS, "s~0": PATTERNS_MIN_BASIS + 5, t: PATTERNS_MIN_BASIS + 9 });
    await firestorePatternsStore(asDb(db)).putModel(pubWith(model, {
      engine: "als",
      lambdaU: 2,
      items: {
        a: { kind: "bin", qid: "a", nOptions: 2 },
        "s~0": { kind: "opt", qid: "s", opt: 0, nOptions: 4 },
        t: { kind: "ord", qid: "t", nOptions: 5 },
      },
    }));
    expect(writes[1].data).toEqual({ patternsPool: 1, patternsBasis: PATTERNS_MIN_BASIS });
  });
});

// ── the candidate engine (D395) ───────────────────────────────────────
//
// The sweep compacts each day's answers onto the person's private map,
// scores the candidate one step ahead on the same two-option observations
// the online engine scores itself on, re-solves it over every map, and
// hands it the rows only after a fortnight of better skill. Everything
// here runs against the memory store; the arithmetic is patternsAls.test.ts's.
describe("the candidate engine (D395)", () => {
  const DAY = 24 * 3600 * 1000;
  const pad = (i: number) => `u${String(i).padStart(3, "0")}`;
  // a test item and a multi-option daily question from the real bank, so
  // the compaction case moves with it
  const TEST_ITEM = V2_QUESTIONS.find((q) => q.surface === "test")!.id;
  const CHOICE = V2_QUESTIONS.find((q) => q.surface === "daily" && q.type === "choice")!.id;

  it("compacts each day's answers onto the person's map — every core item, an edit overwriting", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: TEST_ITEM, optionIdx: 3 },
        { uid: "u1", qid: CHOICE, optionIdx: 2 },
        { uid: "u1", qid: "feed-tail-x", optionIdx: 1 },        // not in either corpus
        { uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 },  // the edit: last wins
        { uid: "u2", qid: TEST_ITEM, optionIdx: 0 },
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(state.users.get("u1")?.a).toEqual({ [CORE_A]: 1, [TEST_ITEM]: 3, [CHOICE]: 2 });
    // a person with only wider-corpus answers still gets a state doc, with
    // an untouched vector — the online engine never saw them
    const u2 = state.users.get("u2")!;
    expect(u2.a).toEqual({ [TEST_ITEM]: 0 });
    expect(u2.n).toBe(0);
    expect(u2.d).toBe(yesterday);
    expect(r.compacted).toBe(4);
    expect(r.folded, "the online engine still folds its two-option pair, once").toBe(1);
    expect(r.users).toBe(2);
  });

  it("a later day merges into the map rather than replacing it", async () => {
    const d2 = utcDay(NOW, -2);
    const { store, state } = memoryStore({
      [d2]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [{ uid: "u1", qid: TEST_ITEM, optionIdx: 2 }],
    });
    await runPatternsFit(store, NOW - DAY);
    expect(state.users.get("u1")?.a).toEqual({ [CORE_A]: 0 });
    await runPatternsFit(store, NOW);
    expect(state.users.get("u1")?.a).toEqual({ [CORE_A]: 0, [TEST_ITEM]: 2 });
  });

  it("publishes the candidate beside the engine's rows, with its own scorecard and the ridge it was scored at", async () => {
    const rows: PatternsLedgerEntry[] = [];
    for (let i = 0; i < 12; i++) {
      rows.push({ uid: pad(i), qid: CORE_A, optionIdx: i % 2 });
      rows.push({ uid: pad(i), qid: CORE_B, optionIdx: i % 2 });
    }
    const { store, state } = memoryStore({ [yesterday]: rows });
    const r = await runPatternsFit(store, NOW);
    const pub = state.pub!;
    expect(pub.engine).toBe("sgd");
    expect(pub.lambdaU).toBe(SGD_LAMBDA_U);
    expect(pub.items, "the online engine's rows carry no item metadata").toBeUndefined();
    expect(pub.candidates.sgd).toBeUndefined();
    const cand = pub.candidates.als!;
    expect(cand.q[CORE_A].n).toBe(12);
    expect(cand.q[CORE_A].v).toHaveLength(8);
    expect(cand.items?.[CORE_A]).toEqual({ kind: "bin", qid: CORE_A, nOptions: 2 });
    // scored on the same observations as the engine, against the same baseline
    expect(cand.quality?.n).toBe(pub.quality?.n);
    expect(cand.quality?.baselineBits).toBe(pub.quality?.baselineBits);
    expect(cand.streak).toBe(0);
    expect(ALS_LAMBDAS_U).toContain(cand.lambdaU);
    expect(Object.keys(cand.lambdaSweep ?? {})).toHaveLength(ALS_LAMBDAS_U.length);
    // and the link's slope beside the ridge (D460): swept on the same
    // days, published for the phone, the online engine's the shipped 1
    expect(ALS_TAUS).toContain(cand.tau);
    expect(Object.keys(cand.tauSweep ?? {})).toHaveLength(ALS_TAUS.length);
    expect(pub.tau).toBe(1);
    expect(r.engine).toBe("sgd");
    expect(r.crossed).toBe(false);
  });

  it("re-running the same ledger reproduces the candidate bit for bit", async () => {
    const rows: PatternsLedgerEntry[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push({ uid: pad(i), qid: CORE_A, optionIdx: i % 2 });
      rows.push({ uid: pad(i), qid: CORE_B, optionIdx: (i % 3) % 2 });
      rows.push({ uid: pad(i), qid: TEST_ITEM, optionIdx: i % 5 });
    }
    const one = memoryStore({ [yesterday]: rows });
    const two = memoryStore({ [yesterday]: rows });
    await runPatternsFit(one.store, NOW);
    await runPatternsFit(two.store, NOW);
    expect(JSON.stringify(one.state.pub!.candidates.als!.q)).toBe(JSON.stringify(two.state.pub!.candidates.als!.q));
  });

  it("hands the rows to the candidate after a fortnight of better skill, and moves the online engine to the bench", async () => {
    // Forty people answer CORE_A on the first night, half of them CORE_B on
    // the second — the same side as their CORE_A — and the other half CORE_B
    // on the third. The candidate fitted after night two has aligned rows
    // for both; on night three it predicts the second half's CORE_B from
    // their CORE_A one step ahead, while the online engine's vectors are
    // still their seeds.
    const N = 40;
    const d3 = utcDay(NOW, -3), d2 = utcDay(NOW, -2), d1 = utcDay(NOW, -1);
    const ledger: Record<string, PatternsLedgerEntry[]> = { [d3]: [], [d2]: [], [d1]: [] };
    for (let i = 0; i < N; i++) {
      ledger[d3].push({ uid: pad(i), qid: CORE_A, optionIdx: i % 2 });
      ledger[i < N / 2 ? d2 : d1].push({ uid: pad(i), qid: CORE_B, optionIdx: i % 2 });
    }
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW - 2 * DAY);
    await runPatternsFit(store, NOW - DAY);
    expect(state.pub!.candidates.als!.q[CORE_B].n).toBe(N / 2);
    // …and it had already won thirteen nights
    state.pub!.candidates.als!.streak = PATTERNS_CROSSOVER_NIGHTS - 1;
    const r = await runPatternsFit(store, NOW);
    expect(r.crossed).toBe(true);
    const pub = state.pub!;
    expect(pub.engine).toBe("als");
    expect(pub.crossedAt).toBe(d1);
    expect(pub.quality?.skill, "the night it crossed on, it predicted").toBeGreaterThan(0);
    expect(pub.items?.[CORE_A]?.kind).toBe("bin");
    expect(pub.q[CORE_B]?.n).toBe(N);
    expect(ALS_LAMBDAS_U).toContain(pub.lambdaU);
    // the online engine keeps running on the bench, streak reset
    expect(pub.candidates.als).toBeUndefined();
    expect(pub.candidates.sgd?.q[CORE_A]).toBeDefined();
    expect(pub.candidates.sgd?.streak).toBe(0);
    expect(pub.candidates.sgd?.lambdaU).toBe(SGD_LAMBDA_U);
    // the seeds summary is now about the rows the devices draw
    expect(pub.seeds.n).toBe(2);
    expect(pub.seeds.meanCos, "a solved model has left its seeds").toBeLessThan(0.9);
    // and the next night reads the ALS rows as the engine's and keeps going
    const again = await runPatternsFit(store, NOW + DAY);
    expect(again.engine).toBe("als");
    expect(state.pub!.engine).toBe("als");
    expect(state.pub!.crossedAt).toBe(d1);
  });

  it("rotates the crossing engine's rows onto the ones the devices were reading", async () => {
    // THE FIXTURE IS THE POINT. `procrustes` refuses unless the two row
    // sets share at least k keys AND those rows span all k directions, so
    // for a long time this path crossed without ever rotating anything:
    // every crossover fixture here shared two rows against k = 8, and the
    // block handed on the rows it was given, byte for byte. A wider
    // LEDGER does not fix it — the corpus that matters is the one the
    // fold produces — and neither does a wider corpus whose columns are
    // dependent: nine questions answered on six independent splits give
    // rows of rank six, and the refusal fires on the rank instead.
    //
    // So: nine questions, each on its own pseudo-random split of two
    // hundred people, which is full rank; a tenth that half of them
    // answer on d2 and half on d1, keyed to the first question's split so
    // the candidate has something to predict one step ahead that the
    // online engine's vectors cannot.
    const WIDE = [...PATTERNS_QIDS].slice(0, 10);
    const TELL = WIDE[WIDE.length - 1];
    const N = 200;
    // deterministic, balanced, and independent enough across j — the
    // published rows come out full rank, which the test asserts rather
    // than assumes
    const split = (i: number, j: number) => (Math.imul(i + 1, 2654435761) >>> (j * 3)) & 1;
    const d3 = utcDay(NOW, -3), d2 = utcDay(NOW, -2), d1 = utcDay(NOW, -1);
    const ledger: Record<string, PatternsLedgerEntry[]> = { [d3]: [], [d2]: [], [d1]: [] };
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < WIDE.length - 1; j++) {
        ledger[d3].push({ uid: pad(i), qid: WIDE[j], optionIdx: split(i, j) });
      }
      ledger[i < N / 2 ? d2 : d1].push({ uid: pad(i), qid: TELL, optionIdx: split(i, 0) });
    }
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW - 2 * DAY);
    await runPatternsFit(store, NOW - DAY);

    // what the devices were reading the night before the crossover
    const wasReading: Record<string, number[]> = {};
    for (const [qid, r] of Object.entries(state.pub!.q)) wasReading[qid] = r.v;
    expect(state.pub!.engine, "the online engine is still the one publishing").toBe("sgd");

    state.pub!.candidates.als!.streak = PATTERNS_CROSSOVER_NIGHTS - 1;
    const r = await runPatternsFit(store, NOW);
    expect(r.crossed).toBe(true);
    const after = state.pub!;
    expect(after.engine).toBe("als");
    const nowReading: Record<string, number[]> = {};
    for (const [qid, row] of Object.entries(after.q)) nowReading[qid] = row.v;

    // The two preconditions procrustes refuses on, asserted rather than
    // hoped for — a fixture that stops meeting either makes this test
    // pass on the identity while proving nothing.
    const k = after.k;
    const shared = Object.keys(nowReading).filter((qid) => wasReading[qid]);
    expect(shared.length, "too few shared rows: procrustes would refuse").toBeGreaterThanOrEqual(k);
    const spans = (rows: Record<string, number[]>) => {
      const G = Array.from({ length: k }, () => new Array<number>(k).fill(0));
      for (const v of Object.values(rows)) {
        for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) G[i][j] += (v[i] ?? 0) * (v[j] ?? 0);
      }
      return Math.min(...symmetricEigen(G).values);
    };
    expect(spans(nowReading), "the new rows do not span k: procrustes would refuse").toBeGreaterThan(1e-6);
    expect(spans(wasReading), "the old rows do not span k: procrustes would refuse").toBeGreaterThan(1e-6);

    // THE PROPERTY: the rows that got published are already carried onto
    // last night's as far as an orthogonal map can carry them, so fitting
    // one again finds nothing left to do. Measured with the rotation
    // deleted, same fixture: the residual comes back with off-diagonals
    // to 0.25 and the diagonal 0.09 off one, and the worst question's
    // cosine against the row it replaces falls from 0.68 to 0.44.
    const residual = procrustes(nowReading, wasReading, k);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
      expect(Math.abs(residual[i][j] - (i === j ? 1 : 0)),
        `the published rows were not aligned (residual[${i}][${j}])`).toBeLessThan(0.02);
    }
  });

  it("a night the candidate does not win resets its streak", async () => {
    const d2 = utcDay(NOW, -2);
    const ledger: Record<string, PatternsLedgerEntry[]> = { [d2]: [], [yesterday]: [] };
    for (let i = 0; i < 12; i++) ledger[d2].push({ uid: pad(i), qid: CORE_A, optionIdx: i % 2 });
    // twelve FRESH people: nothing in anyone's history to predict from, so
    // both engines guess the marginal and neither wins
    for (let i = 12; i < 24; i++) ledger[yesterday].push({ uid: pad(i), qid: CORE_A, optionIdx: i % 2 });
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW - DAY);
    state.pub!.candidates.als!.streak = 5;
    const r = await runPatternsFit(store, NOW);
    expect(r.crossed).toBe(false);
    expect(state.pub!.engine).toBe("sgd");
    expect(state.pub!.candidates.als!.streak).toBe(0);
    expect(state.pub!.candidates.als!.quality?.skill).toBe(0);
  });
});


// ── the voter samples (D397) ──────────────────────────────────────────
// ── the marginal's clamp ──────────────────────────────────────────────
//
// Every answer is ±1, so |sum| can never exceed n — and the fold enforces
// that as a CLAMP rather than an assumption, because one shape breaches it:
// a revision whose first answer this model never folded. A create that fell
// outside the catch-up window, or landed before the question became
// eligible, leaves the subtraction removing something that was never added.
// The comment at patternsFit.ts says exactly that; nothing exercised it,
// and deleting the two clamp lines left every runner green.
//
// Without them the marginal goes past 1 in absolute value, which is a
// probability the rest of the fold then reasons from.
describe("a revision whose create was never folded", () => {
  const pad = (i: number) => `u${String(i).padStart(3, "0")}`;

  it("cannot push a marginal past its own count", async () => {
    const day = utcDay(NOW, -1);
    // Two people answer option 0 — x = +1 each, so n = 2 and sum = +2, the
    // marginal already at its ceiling.
    const ledger: Record<string, PatternsLedgerEntry[]> = {
      [day]: [
        { uid: pad(1), qid: CORE_A, optionIdx: 0 },
        { uid: pad(2), qid: CORE_A, optionIdx: 0 },
        // …and a third whose CREATE this model never saw, editing 1 -> 0.
        // `fromIdx` is what marks it a revision (v2.ts's ledgerEntry), so
        // the fold adds x and subtracts a prev it never added: +1 - (-1)
        // takes sum to 4, against an n that a revision does not move.
        { uid: pad(3), qid: CORE_A, optionIdx: 0, fromIdx: 1 },
      ],
    };
    const { store, state } = memoryStore(ledger);
    await runPatternsFit(store, NOW);
    const row = state.pub!.q[CORE_A];
    expect(row, "the question was not published at all — this case proves nothing").toBeTruthy();
    expect(row.n, "the revision was counted as a new answer").toBe(2);
    expect(
      Math.abs(row.sum) <= row.n,
      `the marginal breached its own count: sum ${row.sum} against n ${row.n}, a mean of `
      + `${(row.sum / row.n).toFixed(2)} where every answer is +/-1`,
    ).toBe(true);
    expect(row.sum, "the clamp took the marginal somewhere other than its ceiling").toBe(2);
  });
});

describe("the voter samples the sweep publishes", () => {
  const DAY = 24 * 3600 * 1000;
  const TEST_ITEM = V2_QUESTIONS.find((q) => q.surface === "test")!.id;

  it("writes one sample per question the day touched — uid, option, frozen chips — and the online rows are untouched", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0, anchors: { city: "Oslo, NO", ageBand: "25-34" } },
        { uid: "u2", qid: CORE_A, optionIdx: 1 },
        { uid: "u1", qid: TEST_ITEM, optionIdx: 3, anchors: { city: "Oslo, NO" } },
        { uid: "u1", qid: "feed-tail-x", optionIdx: 0, anchors: { city: "Oslo, NO" } },  // not in the corpus: no sample
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.samples).toBe(2);
    expect([...state.samples.keys()].sort()).toEqual([CORE_A, TEST_ITEM].sort());
    const s = state.samples.get(CORE_A)!;
    expect(s.n).toBe(2);
    expect(s.rows.u1).toEqual({ o: 0, a: { city: "Oslo, NO", ageBand: "25-34" }, d: yesterday });
    expect(s.rows.u2).toEqual({ o: 1, a: {}, d: yesterday });
    expect(state.samples.get(TEST_ITEM)!.rows.u1.o).toBe(3);
    // the fit's own rows are not a sample: nothing per-person in them
    expect(JSON.stringify(state.pub!.q)).not.toContain("u1");
  });

  it("moves a person to their edit and carries the sample across nights; a re-run of a day is a no-op", async () => {
    const d2 = utcDay(NOW, -2);
    const { store, state } = memoryStore({
      [d2]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }, { uid: "u2", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 }, { uid: "u3", qid: CORE_A, optionIdx: 1 }],
    });
    await runPatternsFit(store, NOW - DAY);
    expect(state.samples.get(CORE_A)!.n).toBe(2);
    await runPatternsFit(store, NOW);
    const s = state.samples.get(CORE_A)!;
    expect(s.n).toBe(3);
    expect(s.rows.u1).toEqual({ o: 1, a: {}, d: yesterday });
    expect(s.rows.u2.d).toBe(d2);
    const before = JSON.stringify(s);
    // the same morning again: nothing owed, nothing rewritten
    const again = await runPatternsFit(store, NOW);
    expect(again.samples).toBe(0);
    expect(JSON.stringify(state.samples.get(CORE_A))).toBe(before);
  });

  // WAS "…and refreshes the rows of a person who answered elsewhere
  // today". That half is gone, and it was the defect rather than the
  // feature: the day's stamp map is built from the day's LEDGER entries,
  // so it is the profile as of when the person answered, while
  // `profileFanout.restampSamples` writes the same three fields with the
  // profile as it stands now. Reaching every row the merge rewrote wrote
  // the older copy back over the fan-out's — nightly, on a world-readable
  // document, including republishing a political coordinate whose consent
  // had been withdrawn. What this case pins now is the half that is
  // sound: the day's OWN rows take the day's stamp.
  it("copies the person's stamp onto the row, and leaves rows the day did not write to the fan-out (runbook 2.2)", async () => {
    const d2 = utcDay(NOW, -2);
    const { store, state } = memoryStore({
      [d2]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0, n: "Olaf", s: { big5: { O: 70 } }, l: 55 },
        { uid: "u2", qid: CORE_A, optionIdx: 1 }, // an entry from before the stamp existed
      ],
      [yesterday]: [
        // u1 answered a DIFFERENT question today under a new name. CORE_A's
        // sample is rewritten for u2's addition — but u1 did not answer
        // CORE_A today, so their row there is not this pass's to restamp.
        { uid: "u1", qid: TEST_ITEM, optionIdx: 2, n: "Olaf T", s: { big5: { O: 71 } }, l: 56 },
        { uid: "u2", qid: CORE_A, optionIdx: 1, fromIdx: 1 },
        { uid: "u3", qid: CORE_A, optionIdx: 0, n: "", s: null, l: null },
      ],
    });
    await runPatternsFit(store, NOW - DAY);
    const before = state.samples.get(CORE_A)!;
    expect(before.rows.u1).toEqual({ o: 0, a: {}, d: d2, n: "Olaf", s: { big5: { O: 70 } }, l: 55 });
    expect(before.rows.u2).toEqual({ o: 1, a: {}, d: d2 });
    await runPatternsFit(store, NOW);
    const after = state.samples.get(CORE_A)!;
    expect(after.rows.u1, "the pass restamped a row whose question the person did not answer today")
      .toEqual({ o: 0, a: {}, d: d2, n: "Olaf", s: { big5: { O: 70 } }, l: 55 });
    expect(after.rows.u3, "a stamp of nothing is still a stamp").toEqual({ o: 0, a: {}, d: yesterday, n: "", s: null, l: null });
    // …and the question they DID answer today carries the new name, which
    // is the half that must survive the narrowing: that row is the day's
    // own, and the stamp riding it is today's.
    expect(state.samples.get(TEST_ITEM)!.rows.u1.n).toBe("Olaf T");
  });

  it("merges a per-city sample for every (question, city) the day touched, and counts them (runbook 2.5)", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0, anchors: { city: "Oslo, NO" }, n: "Olaf", s: null, l: null },
        { uid: "u2", qid: CORE_A, optionIdx: 1, anchors: { city: "Oslo, NO" } },
        { uid: "u3", qid: CORE_A, optionIdx: 1, anchors: { city: "Bergen, NO" } },
        { uid: "u4", qid: CORE_A, optionIdx: 1 }, // no city: the world sample only
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.samples).toBe(1);
    expect(r.citySamples).toBe(2);
    expect([...state.citySamples.keys()].sort()).toEqual([
      `city-${CORE_A}~Bergen%2C%20NO`, `city-${CORE_A}~Oslo%2C%20NO`,
    ]);
    const oslo = state.citySamples.get(`city-${CORE_A}~Oslo%2C%20NO`)!;
    expect(oslo.city).toBe("Oslo, NO");
    expect(oslo.qid).toBe(CORE_A);
    expect(oslo.n).toBe(2);
    expect(oslo.rows.u1).toEqual({ o: 0, a: { city: "Oslo, NO" }, d: yesterday, n: "Olaf", s: null, l: null });
    expect(oslo.rows.u4).toBeUndefined();
    expect(state.samples.get(CORE_A)!.n).toBe(4);
    // a re-run of the same morning owes nothing to either family
    const again = await runPatternsFit(store, NOW);
    expect(again.citySamples).toBe(0);
  });

  it("spends ONE city-pair budget across a catch-up, not one per owed day", async () => {
    // The twin of the seed budget's rule, and it was not being kept.
    // `citySampleAdditions` takes the night's budget as a DEFAULT
    // argument and the call site sits inside the day loop, so each owed
    // day started the 30,000 again — measured at exactly 2x on two days,
    // which at PATTERNS_CATCHUP_DAYS is ~210,000 reads and as many writes
    // inside one invocation with a 480 s deadline. The run that hits it
    // is the one that must not die: nothing advances `lastDay` until the
    // end, so a timeout here re-owes the same days tomorrow.
    //
    // Budget injected rather than built: proving this against the real
    // 30,000 would mean 30,001 fixture pairs and a minute of CI to
    // demonstrate arithmetic. Three is the same statement.
    const day = (qid: string, city: string, uid: string) =>
      ({ uid, qid, optionIdx: 0, anchors: { city } });
    const { store, state } = memoryStore({
      [twoBack]: [
        day(CORE_A, "Oslo, NO", "u1"), day(CORE_A, "Bergen, NO", "u2"),
        day(CORE_A, "Tromsø, NO", "u3"),
      ],
      [yesterday]: [
        day(CORE_B, "Malmö, SE", "u4"), day(CORE_B, "Lund, SE", "u5"),
        day(CORE_B, "Kiruna, SE", "u6"),
      ],
    });
    const r = await runPatternsFit(store, NOW, undefined, undefined, 4);
    // Three pairs on the first owed day, ONE left for the second. Per-day
    // budgets would have written all six.
    expect(r.citySamples, "each owed day spent its own city-pair budget").toBe(4);
    expect(state.citySamples.size).toBe(4);
    // …and the next run starts from a fresh budget, so nothing is lost —
    // the pairs the bound deferred are met when their day comes round.
    const fresh = await runPatternsFit(store, NOW, undefined, undefined, 4);
    expect(fresh.citySamples, "a re-run of the same morning owes nothing").toBe(0);
  });

  it("caps a sample at the newest two hundred", async () => {
    const rows: PatternsLedgerEntry[] = [];
    for (let i = 0; i < PATTERNS_SAMPLE_CAP + 25; i++) rows.push({ uid: `u${String(i).padStart(3, "0")}`, qid: CORE_A, optionIdx: i % 2 });
    const { store, state } = memoryStore({ [yesterday]: rows });
    await runPatternsFit(store, NOW);
    expect(state.samples.get(CORE_A)!.n).toBe(PATTERNS_SAMPLE_CAP);
    expect(PATTERNS_SAMPLE_CAP).toBe(200);
  });
});

describe("anchors as items (D458)", () => {
  const DAY = 24 * 3600 * 1000;
  const pad = (i: number) => `u${String(i).padStart(3, "0")}`;
  const TEST_ITEM = V2_QUESTIONS.find((q) => q.surface === "test")!.id;
  /** Twenty people whose gender decides CORE_A and CORE_B: even uids are
   * women who pick option 0, odd uids men who pick option 1. */
  const genderedDay = (from: number, count: number): PatternsLedgerEntry[] => {
    const rows: PatternsLedgerEntry[] = [];
    for (let i = from; i < from + count; i++) {
      const woman = i % 2 === 0;
      const anchors = { gender: woman ? "Woman" : "Man", ageBand: "25-34" };
      rows.push({ uid: pad(i), qid: CORE_A, optionIdx: woman ? 0 : 1, anchors });
      rows.push({ uid: pad(i), qid: CORE_B, optionIdx: woman ? 0 : 1, anchors });
    }
    return rows;
  };

  it("keeps each person's newest valid anchors on their state, and publishes an item per value enough people carry", async () => {
    const rows: PatternsLedgerEntry[] = [];
    for (let i = 0; i < 20; i++) {
      const woman = i % 2 === 0;
      // the older snapshot carries a city and two things that are not dims
      rows.push({ uid: pad(i), qid: CORE_A, optionIdx: woman ? 0 : 1, anchors: { gender: woman ? "Woman" : "Man", city: "Oslo, NO", age: "31", bogus: "x" } });
      // the newer one has no city: the snapshot replaces the whole map
      rows.push({ uid: pad(i), qid: CORE_B, optionIdx: woman ? 0 : 1, anchors: { gender: woman ? "Woman" : "Man", ageBand: "25-34" } });
    }
    // an entry whose anchors are all invalid carries none, and changes nothing
    rows.push({ uid: pad(0), qid: TEST_ITEM, optionIdx: 2, anchors: { gender: "not a vocabulary word" } });
    const { store, state } = memoryStore({ [yesterday]: rows });
    const r = await runPatternsFit(store, NOW);
    expect(state.users.get(pad(0))?.an).toEqual({ gender: "Woman", ageBand: "25-34" });
    expect(state.users.get(pad(1))?.an).toEqual({ gender: "Man", ageBand: "25-34" });
    const cand = state.pub!.candidates.als!;
    expect(cand.q["anchor~gender~Woman"]?.n, "everyone who filled the dim in").toBe(20);
    expect(cand.q["anchor~gender~Man"]?.n).toBe(20);
    expect(cand.q["anchor~gender~Woman"]?.sum, "ten carry it, ten carry the other value").toBe(0);
    expect(cand.q["anchor~ageBand~25-34"]?.n).toBe(20);
    expect(cand.q["anchor~city~Oslo, NO"], "the older snapshot's city went with it").toBeUndefined();
    expect(cand.items?.["anchor~gender~Woman"]).toEqual({ kind: "anc", qid: "anchor~gender", nOptions: 2, dim: "gender", bucket: "Woman" });
    // a value that decides the answers loads with them
    const woman = cand.q["anchor~gender~Woman"]!.v;
    const a = cand.q[CORE_A]!.v;
    const cos = woman.reduce((acc, x, i) => acc + x * a[i], 0)
      / (Math.hypot(...woman) * Math.hypot(...a));
    expect(Math.abs(cos)).toBeGreaterThan(0.7);
    // the online engine's rows, the pool gate and the Map never see an anchor row
    expect(Object.keys(state.pub!.q).some((k) => k.startsWith("anchor~"))).toBe(false);
    expect(r.engine).toBe("sgd");
  });

  it("a value under the floor is not an item; the scorecard solves a newcomer from their anchors one step ahead", async () => {
    const d2 = utcDay(NOW, -2);
    const { store, state } = memoryStore({
      // night one: forty people, gender decides both questions; three
      // non-binary people are under the floor
      [d2]: [
        ...genderedDay(0, 40),
        ...[100, 101, 102].map((i) => ({ uid: pad(i), qid: CORE_A, optionIdx: 0, anchors: { gender: "Non-binary" } })),
      ],
      // night two: forty NEWCOMERS, nothing answered before, their gender
      // on their first entries
      [yesterday]: genderedDay(200, 40),
    });
    await runPatternsFit(store, NOW - DAY);
    const first = state.pub!.candidates.als!;
    expect(first.q["anchor~gender~Non-binary"], "three people is not an item").toBeUndefined();
    expect(first.q["anchor~gender~Woman"]?.n, "the three still counted −1 on the kept rows").toBe(43);
    await runPatternsFit(store, NOW);
    const second = state.pub!.candidates.als!;
    // the newcomers were scored against night one's rows with their
    // anchors as their only evidence — and beat the marginal
    expect(second.quality?.n).toBe(80);
    expect(second.quality!.bits).toBeLessThan(second.quality!.baselineBits);
    expect(second.quality!.skill).toBeGreaterThan(0);
    // and their state carries the anchors for the nights to come
    expect(state.users.get(pad(200))?.an).toEqual({ gender: "Woman", ageBand: "25-34" });
    expect(state.users.get(pad(200))?.a).toEqual({ [CORE_A]: 0, [CORE_B]: 0 });
  });
});

describe("the whole-world map's positions (D462)", () => {
  const pad = (i: number) => `u${String(i).padStart(3, "0")}`;

  it("publishes a rounded position and an answer count per person, by country", async () => {
    const rows: PatternsLedgerEntry[] = [];
    // twenty people, ten Norwegian and ten Swedish, whose country decides
    // how they answer — so the two groups solve to opposite sides
    for (let i = 0; i < 20; i++) {
      const no = i % 2 === 0;
      const anchors = { country: no ? "NO" : "SE", gender: no ? "Woman" : "Man" };
      for (const [qid, opt] of [[CORE_A, no ? 0 : 1], [CORE_B, no ? 0 : 1]] as [string, number][]) {
        rows.push({ uid: pad(i), qid, optionIdx: opt, anchors });
      }
    }
    const { store, state } = memoryStore({ [yesterday]: rows });
    const r = await runPatternsFit(store, NOW);
    // two answers each is under the floor: nobody is placed, and the
    // world document is still written (empty) rather than left stale
    expect(r.worldPlaced).toBe(0);
    expect(state.worldMaps.get(WORLD_MAP_ID)!.n).toBe(0);
    expect([...state.worldMaps.keys()]).toEqual([WORLD_MAP_ID]);
  });

  it("places everyone over the floor, in the same space the devices draw", async () => {
    const qids = [...PATTERNS_ITEM_QIDS].slice(0, WORLD_MAP_MIN_ANSWERS + 2);
    const rows: PatternsLedgerEntry[] = [];
    for (let i = 0; i < 12; i++) {
      const no = i % 2 === 0;
      // the country anchor is the two-letter code the cube counts
        const anchors = { country: no ? "NO" : "SE" };
      qids.forEach((qid, j) => {
        // the two countries answer oppositely on all but the last card
        const opt = j === qids.length - 1 ? i % 2 : no ? 0 : 1;
        rows.push({ uid: pad(i), qid, optionIdx: opt, anchors });
      });
    }
    const { store, state } = memoryStore({ [yesterday]: rows });
    const r = await runPatternsFit(store, NOW);
    expect(r.worldPlaced).toBe(12);
    expect(r.worldMaps).toBe(3); // Norway, Sweden, and the world
    const no = state.worldMaps.get(worldMapId("NO"))!;
    expect(no.country).toBe("NO");
    expect(no.n).toBe(6);
    expect(no.total).toBe(6);
    expect(no.day).toBe(yesterday);
    const row = no.rows[pad(0)];
    expect(row.n, "the answer count, not the observation count").toBe(qids.length);
    // a POSITION: two rounded numbers on the unit circle, nothing else
    expect(Object.keys(row).sort()).toEqual(["n", "x", "y"]);
    expect(row.x).toBe(Math.round(row.x * 100) / 100);
    expect(Math.hypot(row.x, row.y)).toBeLessThanOrEqual(1.02);
    // and the two countries are on opposite sides of the space, which is
    // the whole claim of the lens: position carries the answers
    const se = state.worldMaps.get(worldMapId("SE"))!;
    const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;
    expect(dot(no.rows[pad(0)], no.rows[pad(2)]), "two Norwegians agree").toBeGreaterThan(0);
    expect(dot(no.rows[pad(0)], se.rows[pad(1)]), "a Norwegian and a Swede do not").toBeLessThan(0);
    // the world document holds them all, and says so
    const world = state.worldMaps.get(WORLD_MAP_ID)!;
    expect(world.n).toBe(12);
    expect(world.total).toBe(12);
    expect(world.country).toBeUndefined();
    // nothing about a position reaches the loadings document itself
    expect(JSON.stringify(state.pub).includes(pad(0))).toBe(false);
  });

  it("a country that emptied out is rewritten, not left drawing last night's people", async () => {
    // The build emits one document per country with somebody in it
    // TONIGHT, and the write is a set per emitted id — so a country whose
    // last placed account moved its chip, fell under the floor or deleted
    // itself kept yesterday's document, and the lens drew those people as
    // that country's crowd, stated as current, with no way to know better.
    // The world's own document is rebuilt every night and could never go
    // stale this way, which is why only the small ones were exposed.
    const qids = [...PATTERNS_ITEM_QIDS].slice(0, WORLD_MAP_MIN_ANSWERS + 2);
    const night = (country: string) => {
      const rows: Array<{ uid: string; qid: string; optionIdx: number; anchors: { country: string } }> = [];
      for (let i = 0; i < 12; i++) {
        qids.forEach((qid, j) => {
          rows.push({ uid: pad(i), qid, optionIdx: j === qids.length - 1 ? i % 2 : i % 2, anchors: { country } });
        });
      }
      return rows;
    };
    const { store, state } = memoryStore({ [yesterday]: night("NO") });
    await runPatternsFit(store, NOW);
    expect(state.worldMaps.has(worldMapId("NO")), "the fixture never published Norway").toBe(true);
    expect(state.worldMaps.get(worldMapId("NO"))!.n).toBeGreaterThan(0);

    // …and the next night everybody is somewhere else.
    const day2 = "2026-09-10";
    const { store: s2, state: st2 } = memoryStore({ [day2]: night("SE") });
    for (const [id, d] of state.worldMaps) st2.worldMaps.set(id, d);
    await runPatternsFit(s2, new Date(Date.parse(`${day2}T00:00:00Z`) + 26 * 3600 * 1000));
    const no = st2.worldMaps.get(worldMapId("NO"));
    expect(no, "Norway's document vanished instead of being emptied").toBeTruthy();
    expect(no!.n, "Norway still publishes people who are no longer in it").toBe(0);
    expect(Object.keys(no!.rows), "the rows outlived the country's last member").toEqual([]);
    expect(st2.worldMaps.get(worldMapId("SE"))!.n).toBeGreaterThan(0);
  });

  it("a night with nothing owed does not touch them", async () => {
    const { store, state } = memoryStore({ [yesterday]: [{ uid: pad(0), qid: CORE_A, optionIdx: 0 }] });
    await runPatternsFit(store, NOW);
    const first = state.worldMaps.size;
    expect(first).toBe(1); // the world document, empty — one answer is under the floor
    state.worldMaps.clear();
    // the same run again: the day is already folded, so it returns before
    // the fit and writes nothing at all
    const again = await runPatternsFit(store, NOW);
    expect(again.worldMaps).toBe(0);
    expect(again.worldPlaced).toBe(0);
    expect(state.worldMaps.size).toBe(0);
  });
});

describe("catalogue picks as items (D459)", () => {
  const pad = (i: number) => `u${String(i).padStart(3, "0")}`;
  const PICK = [...PICK_QIDS][0];

  it("every catalogue card in the bank is a pick question, and nothing else is", () => {
    const cats = V2_QUESTIONS.filter((q) => q.type === "catalog");
    expect(cats.length).toBeGreaterThan(0);
    expect(PICK_QIDS.size).toBe(cats.length);
    for (const q of cats) expect(PICK_QIDS.has(q.id)).toBe(true);
    // none of them is a two-option item — a pick is never a pool question
    for (const qid of PICK_QIDS) expect(PATTERNS_ITEM_QIDS.has(qid)).toBe(false);
  });

  it("compacts a person's picks beside their map, samples them, and publishes an item per entity enough people picked", async () => {
    const rows: PatternsLedgerEntry[] = [];
    for (let i = 0; i < 24; i++) {
      // the first sixteen pick 25 (the women) or 6 (the men) with their
      // vote; the last eight pick something rare and vote the other way
      const rare = i >= 16;
      const woman = i % 2 === 0;
      const entity = rare ? String(100 + i) : woman ? "25" : "6";
      const anchors = { gender: woman ? "Woman" : "Man" };
      rows.push({ uid: pad(i), qid: CORE_A, optionIdx: rare ? 1 : woman ? 0 : 1, anchors });
      rows.push({ uid: pad(i), qid: PICK, entity, anchors });
    }
    rows.push({ uid: pad(0), qid: PICK, entity: "" });            // no key: nothing
    rows.push({ uid: pad(0), qid: CORE_B, entity: "25" });         // a pick on a vote question: nothing
    const { store, state } = memoryStore({ [yesterday]: rows });
    const r = await runPatternsFit(store, NOW);
    expect(state.users.get(pad(0))?.p).toEqual({ [PICK]: "25" });
    expect(state.users.get(pad(1))?.p).toEqual({ [PICK]: "6" });
    expect(state.users.get(pad(0))?.a).toEqual({ [CORE_A]: 0 });
    expect(r.compacted, "24 votes and 24 picks").toBe(48);
    // the sample carries the pick where a vote has its option
    const sample = state.samples.get(PICK)!;
    expect(sample.n).toBe(24);
    expect(sample.rows[pad(0)]).toEqual({ e: "25", a: { gender: "Woman" }, d: yesterday });
    expect(sample.rows[pad(1)].o).toBeUndefined();
    // the items: 25 and 6 clear the floor of eight, the rare picks do not
    const cand = state.pub!.candidates.als!;
    expect(cand.q[`${PICK}~25`]?.n, "everyone who answered the card").toBe(24);
    expect(cand.q[`${PICK}~6`]?.n).toBe(24);
    expect(Object.keys(cand.q).filter((k) => k.startsWith(`${PICK}~`))).toEqual([`${PICK}~25`, `${PICK}~6`]);
    expect(cand.items?.[`${PICK}~25`]).toEqual({ kind: "pick", qid: PICK, nOptions: 2, entity: "25" });
    // never on the engine's two-option rows
    expect(Object.keys(state.pub!.q).some((k) => k.startsWith(PICK))).toBe(false);
    // a pick that decides the vote loads with it
    const v25 = cand.q[`${PICK}~25`]!.v;
    const a = cand.q[CORE_A]!.v;
    const cos = v25.reduce((acc, x, i) => acc + x * a[i], 0) / (Math.hypot(...v25) * Math.hypot(...a));
    expect(Math.abs(cos)).toBeGreaterThan(0.6);
  });

  it("a person with picks and no votes is still fitted, and a later pick joins the map", async () => {
    const DAY = 24 * 3600 * 1000;
    const d2 = utcDay(NOW, -2);
    const rows1: PatternsLedgerEntry[] = [];
    for (let i = 0; i < 10; i++) rows1.push({ uid: pad(i), qid: PICK, entity: "25" });
    const { store, state } = memoryStore({
      [d2]: rows1,
      [yesterday]: [{ uid: pad(0), qid: [...PICK_QIDS][1], entity: "7" }],
    });
    await runPatternsFit(store, NOW - DAY);
    expect(state.users.get(pad(0))?.p).toEqual({ [PICK]: "25" });
    expect(state.users.get(pad(0))?.a).toBeUndefined();
    expect(state.pub!.candidates.als!.q[`${PICK}~25`]?.n).toBe(10);
    await runPatternsFit(store, NOW);
    expect(state.users.get(pad(0))?.p).toEqual({ [PICK]: "25", [[...PICK_QIDS][1]]: "7" });
  });
});

// ── seeded on first touch (D442) ──────────────────────────────────────
//
// The sample's only input was the ledger day, and a person answers a
// question once — so as D397 shipped, everyone who answered before the
// samples existed never arrived, and a long-standing question published
// a SHORT sample the reader could not tell from a complete one, landing
// on the 12-voter floors as `thin` (the OWNER-LIST row the owner answered
// 2026-09-09: seed on first touch, bounded at 25 a night). Pinned:
//
//   1. an unstamped sample is seeded from the bounded query, then takes
//      the day — the seed's rows and the day's rows in one document;
//   2. a stamped sample is never read again — the stamp is the whole
//      idempotence, whether this run set it or an earlier night's did;
//   3. the bound is per RUN: the 26th unstamped question waits for the
//      next night, a catch-up's days share one budget, and a sample the
//      budget cannot seed is not CREATED short — an existing one still
//      takes the day;
//   4. a D86 edit the ledger already moved meets the seed as a tie — one
//      row, the edited option, never a rollback and never a second
//      person — in all three orders the two can arrive in;
//   5. the Firestore store's seed is the who-voted sheet's own query, and
//      its projection is the addition's.
describe("seeding the voter samples on first touch (D442)", () => {
  const DAY = 24 * 3600 * 1000;
  const today = utcDay(NOW, 0);
  const threeBack = utcDay(NOW, -3);
  // one more corpus question than a night's budget, in the order the run
  // walks them (sorted qids), so the one that waits is known
  const MANY = [...PATTERNS_ITEM_QIDS].sort().slice(0, PATTERNS_SEED_PER_RUN + 1);
  const LAST = MANY[MANY.length - 1];
  const seedOf = (qids: readonly string[]): Record<string, SampleAddition[]> =>
    Object.fromEntries(qids.map((qid) => [qid, [{ uid: `old-${qid}`, optionIdx: 0, day: threeBack }]]));

  it("a question with no sample is seeded from the bounded query, then takes the day", async () => {
    const { store, state } = memoryStore(
      { [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0, anchors: { city: "Oslo, NO" } }] },
      {
        [CORE_A]: [
          { uid: "old1", optionIdx: 1, anchors: { city: "Bergen, NO" }, day: threeBack },
          { uid: "old2", optionIdx: 0, day: twoBack },
        ],
      },
    );
    const r = await runPatternsFit(store, NOW);
    expect(state.seedCalls).toEqual([CORE_A]);
    expect(r.seeded).toBe(1);
    expect(r.samples).toBe(1);
    const s = state.samples.get(CORE_A)!;
    expect(s.n).toBe(3);
    expect(s.rows.old1).toEqual({ o: 1, a: { city: "Bergen, NO" }, d: threeBack });
    expect(s.rows.old2).toEqual({ o: 0, a: {}, d: twoBack });
    expect(s.rows.u1).toEqual({ o: 0, a: { city: "Oslo, NO" }, d: yesterday });
    expect(s.seeded).toBe(today);
  });

  it("a seeded question is never read again — on the next night, or when the document arrived stamped", async () => {
    const { store, state } = memoryStore(
      {
        [twoBack]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
        [yesterday]: [{ uid: "u2", qid: CORE_A, optionIdx: 1 }, { uid: "u2", qid: CORE_B, optionIdx: 1 }],
      },
      { [CORE_A]: [{ uid: "old1", optionIdx: 1, day: threeBack }], [CORE_B]: [{ uid: "old9", optionIdx: 0, day: threeBack }] },
    );
    // CORE_B's document was seeded by an earlier night's run
    state.samples.set(CORE_B, { qid: CORE_B, rows: { z: { o: 0, a: {}, d: threeBack } }, n: 1, seeded: threeBack });
    await runPatternsFit(store, NOW - DAY); // folds twoBack: CORE_A met, seeded
    expect(state.seedCalls).toEqual([CORE_A]);
    expect(state.samples.get(CORE_A)!.seeded).toBe(utcDay(NOW - DAY, 0));
    const r = await runPatternsFit(store, NOW); // folds yesterday: both met, neither read
    expect(state.seedCalls, "a stamped sample was re-read").toEqual([CORE_A]);
    expect(r.seeded).toBe(0);
    expect(r.samples).toBe(2);
    expect(state.samples.get(CORE_A)!.n).toBe(3);
    expect(state.samples.get(CORE_A)!.seeded).toBe(utcDay(NOW - DAY, 0));
    const b = state.samples.get(CORE_B)!;
    expect(b.n).toBe(2);
    expect(b.rows.old9, "a sample that arrived stamped was re-seeded").toBeUndefined();
    expect(b.seeded).toBe(threeBack);
  });

  it("the 26th unstamped question on one night waits for the next — the bound is per run, not per day, and it is not created short", async () => {
    const half = Math.floor(MANY.length / 2);
    // one person answers every one of them, split across two owed days
    const ledger: Record<string, PatternsLedgerEntry[]> = {
      [twoBack]: MANY.slice(0, half).map((qid) => ({ uid: "u1", qid, optionIdx: 0 })),
      [yesterday]: MANY.slice(half).map((qid) => ({ uid: "u1", qid, optionIdx: 0 })),
    };
    const answers = seedOf(MANY);
    // the answers collection holds u1's answer to LAST too — the seed reads
    // the answers themselves, so a day the sample skipped is not lost to it
    answers[LAST].push({ uid: "u1", optionIdx: 0, day: yesterday });
    const { store, state } = memoryStore(ledger, answers);
    const r = await runPatternsFit(store, NOW);
    expect(state.seedCalls.length, "two owed days each spent their own budget").toBe(PATTERNS_SEED_PER_RUN);
    expect(r.seeded).toBe(PATTERNS_SEED_PER_RUN);
    expect(state.seedCalls).not.toContain(LAST);
    expect(state.samples.has(LAST), "a sample was created short rather than left to the live query").toBe(false);
    expect(r.samples).toBe(PATTERNS_SEED_PER_RUN);
    for (const qid of MANY.slice(0, -1)) expect(state.samples.get(qid)!.seeded).toBe(today);
    // the next night meets it again, with a fresh budget
    ledger[today] = [{ uid: "u2", qid: LAST, optionIdx: 1 }];
    const r2 = await runPatternsFit(store, NOW + DAY);
    expect(r2.seeded).toBe(1);
    expect(state.seedCalls.length).toBe(PATTERNS_SEED_PER_RUN + 1);
    expect(state.seedCalls[PATTERNS_SEED_PER_RUN]).toBe(LAST);
    const s = state.samples.get(LAST)!;
    expect(s.n).toBe(3);
    expect(s.rows.u1, "the day the sample skipped did not come back through the seed").toEqual({ o: 0, a: {}, d: yesterday });
    expect(s.rows.u2.d).toBe(today);
    expect(s.seeded).toBe(utcDay(NOW + DAY, 0));
  });

  it("with the budget spent, a sample that already exists still takes the day — and is seeded the night after", async () => {
    // 25 fresh questions ahead of LAST in qid order, and a pre-D442
    // document of LAST's own, fed by the ledger alone
    const ledger: Record<string, PatternsLedgerEntry[]> = { [yesterday]: MANY.map((qid) => ({ uid: "u1", qid, optionIdx: 0 })) };
    const { store, state } = memoryStore(ledger, seedOf(MANY));
    state.samples.set(LAST, { qid: LAST, rows: { s1: { o: 1, a: {}, d: threeBack } }, n: 1 });
    const r = await runPatternsFit(store, NOW);
    expect(state.seedCalls).not.toContain(LAST);
    expect(r.samples, "the existing sample was not rewritten with the day").toBe(PATTERNS_SEED_PER_RUN + 1);
    const s = state.samples.get(LAST)!;
    expect(s.n).toBe(2);
    expect(s.rows.u1.d).toBe(yesterday);
    expect(s.seeded, "an unseeded sample was stamped without its query").toBeUndefined();
    ledger[today] = [{ uid: "u2", qid: LAST, optionIdx: 1 }];
    await runPatternsFit(store, NOW + DAY);
    expect(state.seedCalls[state.seedCalls.length - 1]).toBe(LAST);
    const after = state.samples.get(LAST)!;
    expect(after.seeded).toBe(utcDay(NOW + DAY, 0));
    expect(after.n).toBe(4); // s1, u1, u2, and the seed's old-LAST
  });

  it("a D86 edit the ledger already moved is a tie with the seed — one row, the edited option, no rollback", async () => {
    // (a) the edit was folded by an earlier night into a sample that
    //     predates the seed; the document on disk carries the edited
    //     option under its editedAt day
    {
      const { store, state } = memoryStore(
        { [yesterday]: [{ uid: "u2", qid: CORE_A, optionIdx: 0 }] },
        { [CORE_A]: [{ uid: "u1", optionIdx: 1, day: twoBack }] },
      );
      state.samples.set(CORE_A, { qid: CORE_A, rows: { u1: { o: 1, a: {}, d: twoBack } }, n: 1 });
      await runPatternsFit(store, NOW);
      const s = state.samples.get(CORE_A)!;
      expect(state.seedCalls).toEqual([CORE_A]);
      expect(s.n, "the seed's copy of an edit the ledger moved counted as a second person").toBe(2);
      expect(s.rows.u1).toEqual({ o: 1, a: {}, d: twoBack });
      expect(s.seeded).toBe(today);
    }
    // (b) the create and the edit are both owed tonight; the seed runs on
    //     the first day met and already holds the edited document
    {
      const { store, state } = memoryStore(
        {
          [twoBack]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
          [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 }],
        },
        { [CORE_A]: [{ uid: "u1", optionIdx: 1, day: yesterday }] },
      );
      await runPatternsFit(store, NOW);
      expect(state.seedCalls).toEqual([CORE_A]);
      const s = state.samples.get(CORE_A)!;
      expect(s.n).toBe(1);
      expect(s.rows.u1, "the create's older day rolled the seeded row back").toEqual({ o: 1, a: {}, d: yesterday });
      // the fit's own basis agrees: one person, not two who disagree
      expect(state.pub!.q[CORE_A].n).toBe(1);
    }
    // (c) the seed came first, the edit the night after: the row moves,
    //     nobody is added, nothing is re-read
    {
      const ledger: Record<string, PatternsLedgerEntry[]> = { [twoBack]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }] };
      const { store, state } = memoryStore(ledger, { [CORE_A]: [{ uid: "u1", optionIdx: 0, day: twoBack }] });
      await runPatternsFit(store, NOW - DAY);
      expect(state.samples.get(CORE_A)!.rows.u1).toEqual({ o: 0, a: {}, d: twoBack });
      ledger[yesterday] = [{ uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 }];
      await runPatternsFit(store, NOW);
      const s = state.samples.get(CORE_A)!;
      expect(state.seedCalls).toEqual([CORE_A]);
      expect(s.n).toBe(1);
      expect(s.rows.u1).toEqual({ o: 1, a: {}, d: yesterday });
    }
  });

  it("the store's seed is the who-voted sheet's own query, projected to additions", async () => {
    const TS = (ms: number) => ({ toMillis: () => ms });
    const calls: unknown[][] = [];
    const docs = [
      // a D86 edit: the edited option, under its editedAt day; a non-string chip dropped
      { uid: "u1", data: { optionIdx: 1, anchors: { city: "Oslo, NO", n: 3 }, answeredAt: TS(Date.UTC(2026, 7, 10)), editedAt: TS(Date.UTC(2026, 7, 12)) } },
      { uid: "u2", data: { optionIdx: 0, answeredAt: TS(Date.UTC(2026, 7, 11)) } },
      // a catalog answer carries `entity` and no option column: skipped, not coerced
      { uid: "u3", data: { entity: 42, answeredAt: TS(Date.UTC(2026, 7, 11)) } },
    ];
    const q = {
      where(...a: unknown[]) { calls.push(["where", ...a]); return q; },
      orderBy(...a: unknown[]) { calls.push(["orderBy", ...a]); return q; },
      limit(...a: unknown[]) { calls.push(["limit", ...a]); return q; },
      select(...a: unknown[]) { calls.push(["select", ...a]); return q; },
      async get() {
        return {
          docs: docs.map((d) => ({
            ref: { parent: { parent: { id: d.uid } } },
            get: (f: string) => (d.data as Record<string, unknown>)[f],
          })),
        };
      },
    };
    const db = {
      collection() { return { doc() { return {}; } }; },
      collectionGroup(name: string) { calls.push(["collectionGroup", name]); return q; },
    };
    const rows = await firestorePatternsStore(db as unknown as Firestore).seedRows(CORE_A);
    expect(calls).toEqual([
      ["collectionGroup", "answers"],
      ["where", "qid", "==", CORE_A],
      ["where", "surface", "in", [...WORLD_ANSWER_SURFACES]],
      ["orderBy", "answeredAt", "desc"],
      ["limit", PATTERNS_SAMPLE_CAP],
      ["select", "optionIdx", "anchors", "answeredAt", "editedAt"],
    ]);
    expect(rows).toEqual([
      { uid: "u1", optionIdx: 1, anchors: { city: "Oslo, NO" }, day: "2026-08-12" },
      { uid: "u2", optionIdx: 0, day: "2026-08-11" },
    ]);
  });
});
