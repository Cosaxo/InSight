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

import { PATTERNS_QIDS, firestorePatternsStore, runPatternsFit, utcDay, type PatternsLedgerEntry, type PatternsStore } from "./patterns";
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
  type PatternsUserState,
} from "./patternsFit";

const NOW = Date.UTC(2026, 7, 19, 3, 0, 0); // the 02:37 schedule's morning

function memoryStore(ledger: Record<string, PatternsLedgerEntry[]>) {
  const state: {
    model: (PatternsModel & { lastDay?: string }) | null;
    users: Map<string, PatternsUserState>;
    putModelCalls: number;
    breakPutModelOnce: boolean;
    quality: PatternsQuality | null;
    displacement: PatternsDisplacement | null;
  } = {
    model: null, users: new Map(), putModelCalls: 0,
    breakPutModelOnce: false, quality: null, displacement: null,
  };
  const store: PatternsStore = {
    async ledgerDay(day) { return ledger[day] ?? []; },
    // the real store hands the series back off the published doc — the
    // memory one hands back what the last putModel published
    async getModel() {
      return state.model ? { ...state.model, series: state.quality?.series ?? [] } : null;
    },
    async putModel(model, lastDay, folded, quality, displacement) {
      if (state.breakPutModelOnce) {
        state.breakPutModelOnce = false;
        throw new Error("model write lost");
      }
      state.model = { ...model, lastDay };
      state.quality = quality;
      state.displacement = displacement;
      state.putModelCalls++;
      void folded;
    },
    async getUsers(uids) {
      const out = new Map<string, PatternsUserState>();
      for (const uid of uids) { const s = state.users.get(uid); if (s) out.set(uid, s); }
      return out;
    },
    async putUsers(states) { for (const [uid, s] of states) state.users.set(uid, s); },
  };
  return { store, state };
}

// two real eligible qids from the compiled bank, so the test moves with it
const [CORE_A, CORE_B] = [...PATTERNS_QIDS];
const yesterday = utcDay(NOW, -1);

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
      ],
    });
    const r = await runPatternsFit(store, NOW);
    expect(r.folded).toBe(3);
    expect(r.users).toBe(2);
    expect(Object.keys(state.model?.q ?? {}).sort()).toEqual([CORE_A, CORE_B].sort());
    expect(state.model?.q[CORE_A].n).toBe(2);
    expect(state.users.get("u1")?.n).toBe(2);
    expect(state.users.get("u2")?.n).toBe(1);
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
    expect(series[series.length - 1]).toEqual({ day: yesterday, n: 1, bits: 1 });
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
    perQ: {},
    floor: PATTERNS_QUALITY_FLOOR,
    series: [{ day: "2026-08-22", n: 12, bits: 0.91 }],
    note: PATTERNS_QUALITY_NOTE,
  };
  const DISPLACEMENT: PatternsDisplacement = {
    space: "loading", n: 0, moved: 0, mean: 0, p50: 0, p90: 0, max: 0, perQ: {},
  };

  it("writes the drawable count and its floor onto the meta doc, merged", async () => {
    const { db, writes } = fakeDb();
    // three published questions, two of them at the floor or better
    const model = modelWith({ a: PATTERNS_MIN_BASIS, b: PATTERNS_MIN_BASIS + 40, c: 1 });
    await firestorePatternsStore(asDb(db)).putModel(model, "2026-08-22", 12, QUALITY, DISPLACEMENT);

    expect(writes.map((w) => w.path)).toEqual(["v2_patterns/loadings", "v2_meta/app"]);
    const loadings = writes[0];
    // every vector still publishes, floor or no floor — the basis rides
    // with each one and the readers refuse per question
    expect(Object.keys(loadings.data.q as Record<string, unknown>)).toEqual(["a", "b", "c"]);
    // the scorecard rides the SAME write (D325): no extra doc, no extra
    // read for whoever comes to draw it
    expect(loadings.data.quality).toEqual(QUALITY);
    expect(loadings.data.displacement).toEqual(DISPLACEMENT);

    const meta = writes[1];
    expect(meta.data).toEqual({ patternsPool: 2, patternsBasis: PATTERNS_MIN_BASIS });
    // MERGED, never set: contentRev, latestBuild, minBuild and updateUrl
    // live on this document and belong to the seed and the operator.
    expect(meta.opts).toEqual({ merge: true });
  });

  it("publishes a zero rather than nothing when no question is drawable yet", async () => {
    const { db, writes } = fakeDb();
    await firestorePatternsStore(asDb(db)).putModel(modelWith({ a: 1, b: 2 }), "2026-08-22", 2, QUALITY, DISPLACEMENT);
    // A field that stops being written is a field the client keeps
    // reading at its last value — so early nights say 0 out loud.
    expect(writes[1].data).toEqual({ patternsPool: 0, patternsBasis: PATTERNS_MIN_BASIS });
  });
});
