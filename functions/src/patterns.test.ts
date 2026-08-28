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

import { AXES_LABELS, PATTERNS_QIDS, firestorePatternsStore, runPatternsFit, utcDay, type PatternsLedgerEntry, type PatternsStore } from "./patterns";
import { TEST_ITEM_META, V2_QUESTIONS } from "./v2content";
import type { Firestore } from "firebase-admin/firestore";
import { PATTERNS_MIN_BASIS, emptyModel, type PatternsModel, type PatternsUserState } from "./patternsFit";
import { AXES_MIN_N, type PublishedAxes } from "./axesFit";

const NOW = Date.UTC(2026, 7, 19, 3, 0, 0); // the 02:37 schedule's morning

function memoryStore(
  ledger: Record<string, PatternsLedgerEntry[]>,
  testAnswers: Array<{ uid: string; qid: string; optionIdx: number }> = [],
) {
  const state: {
    model: (PatternsModel & { lastDay?: string }) | null;
    users: Map<string, PatternsUserState>;
    putModelCalls: number;
    axesPuts: PublishedAxes[];
  } = { model: null, users: new Map(), putModelCalls: 0, axesPuts: [] };
  const store: PatternsStore = {
    async ledgerDay(day) { return ledger[day] ?? []; },
    async getModel() { return state.model; },
    async putModel(model, lastDay, folded) {
      state.model = { ...model, lastDay };
      state.putModelCalls++;
      void folded;
    },
    async getUsers(uids) {
      const out = new Map<string, PatternsUserState>();
      for (const uid of uids) { const s = state.users.get(uid); if (s) out.set(uid, s); }
      return out;
    },
    async putUsers(states) { for (const [uid, s] of states) state.users.set(uid, s); },
    async allUserStates() { return new Map(state.users); },
    async testAnswers() { return testAnswers; },
    // The RECORDING fake (the D265 pattern): every folding run must call
    // this, an empty block included, so a fit that quietly stops writing
    // the axes block fails a test instead of shipping silence.
    async putAxes(axes) { state.axesPuts.push(axes); },
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

  it("NO TAUTOLOGY: no instrument item ever enters the latent space (AXES-RUNBOOK 1.1)", () => {
    // The axes projection is a cross-source reading precisely because the
    // fit never sees the instruments' own items — if one ever entered
    // PATTERNS_QIDS, "Openness points this way" would be the fit
    // rediscovering its own input. Pinned against the compiled meta, so a
    // bank or eligibility change that breaks the disjointness fails here.
    expect(TEST_ITEM_META.length).toBeGreaterThan(100);
    expect(TEST_ITEM_META.some((m) => m.invert)).toBe(true);
    for (const m of TEST_ITEM_META) {
      expect(PATTERNS_QIDS.has(m.qid), m.qid).toBe(false);
    }
  });
});

describe("the axes block (AXES-PLAN §2: project, don't refit)", () => {
  // Two same-axis, non-inverted items from the real compiled meta, so the
  // fixture moves with the bank the way CORE_A/CORE_B do.
  const oItems = TEST_ITEM_META.filter(
    (m) => m.test === "big5" && m.dim === "O" && !m.invert,
  ).slice(0, 2);

  it("publishes a direction, its basis and its label once enough people are behind it", async () => {
    const answers: Array<{ uid: string; qid: string; optionIdx: number }> = [];
    const k = 8;
    const { store, state } = memoryStore(
      { [yesterday]: [{ uid: "u0", qid: CORE_A, optionIdx: 0 }] },
      answers,
    );
    // Ten fitted people whose θ[0] and Openness score rise together
    // LINEARLY (a step against a ramp honestly correlates at ~0.87, which
    // a first draft of this case learned the hard way) — the axis should
    // come out pointing along component 0, fit near 1. u0's θ moves a
    // hair when its ledger row folds; the tolerance absorbs it.
    for (let i = 0; i < 10; i++) {
      const uid = `u${i}`;
      state.users.set(uid, { v: [i, 0, 0, 0, 0, 0, 0, 0].slice(0, k), n: 3 });
      const idx = Math.min(4, Math.floor(i / 2));
      for (const m of oItems) answers.push({ uid, qid: m.qid, optionIdx: idx });
    }
    const r = await runPatternsFit(store, NOW);
    expect(state.axesPuts).toHaveLength(1);
    const axes = state.axesPuts[0];
    expect(r.axes).toBe(Object.keys(axes).length);
    const row = axes["big5.O"];
    expect(row).toBeTruthy();
    expect(row.n).toBe(10);
    expect(row.fit).toBeGreaterThan(0.95);
    expect(Math.abs(row.v[0])).toBeGreaterThan(0.99);
    expect(row.label).toBe(AXES_LABELS.get("big5.O"));
  });

  it("publishes an EMPTY block below the population floor — called, never silent", async () => {
    const answers: Array<{ uid: string; qid: string; optionIdx: number }> = [];
    const { store, state } = memoryStore(
      { [yesterday]: [{ uid: "u0", qid: CORE_A, optionIdx: 0 }] },
      answers,
    );
    for (let i = 0; i < AXES_MIN_N - 1; i++) {
      const uid = `u${i}`;
      state.users.set(uid, { v: [i, 0, 0, 0, 0, 0, 0, 0], n: 1 });
      for (const m of oItems) answers.push({ uid, qid: m.qid, optionIdx: i % 5 });
    }
    await runPatternsFit(store, NOW);
    // The write happened (the recording fake is the whole point) and the
    // block is empty — absent rows, not faked ones (D1).
    expect(state.axesPuts).toHaveLength(1);
    expect(Object.keys(state.axesPuts[0])).toEqual([]);
  });

  it("skips the sweep entirely on a no-op morning — the standing block is still the truth", async () => {
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    await runPatternsFit(store, NOW);
    expect(state.axesPuts).toHaveLength(1);
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

  it("writes the drawable count and its floor onto the meta doc, merged", async () => {
    const { db, writes } = fakeDb();
    // three published questions, two of them at the floor or better
    const model = modelWith({ a: PATTERNS_MIN_BASIS, b: PATTERNS_MIN_BASIS + 40, c: 1 });
    await firestorePatternsStore(asDb(db)).putModel(model, "2026-08-22", 12);

    expect(writes.map((w) => w.path)).toEqual(["v2_patterns/loadings", "v2_meta/app"]);
    const loadings = writes[0];
    // every vector still publishes, floor or no floor — the basis rides
    // with each one and the readers refuse per question
    expect(Object.keys(loadings.data.q as Record<string, unknown>)).toEqual(["a", "b", "c"]);

    const meta = writes[1];
    expect(meta.data).toEqual({ patternsPool: 2, patternsBasis: PATTERNS_MIN_BASIS });
    // MERGED, never set: contentRev, latestBuild, minBuild and updateUrl
    // live on this document and belong to the seed and the operator.
    expect(meta.opts).toEqual({ merge: true });
  });

  it("publishes a zero rather than nothing when no question is drawable yet", async () => {
    const { db, writes } = fakeDb();
    await firestorePatternsStore(asDb(db)).putModel(modelWith({ a: 1, b: 2 }), "2026-08-22", 2);
    // A field that stops being written is a field the client keeps
    // reading at its last value — so early nights say 0 out loud.
    expect(writes[1].data).toEqual({ patternsPool: 0, patternsBasis: PATTERNS_MIN_BASIS });
  });

  it("merges the axes block onto the loadings doc rather than replacing it", async () => {
    // putModel full-sets the doc and putAxes lands one write later; the
    // MERGE is what keeps that second write from wiping the loadings it
    // sits beside.
    const { db, writes } = fakeDb();
    const row = { v: [1, 0, 0, 0, 0, 0, 0, 0], n: 9, fit: 0.8, label: "Openness" };
    await firestorePatternsStore(asDb(db)).putAxes({ "big5.O": row });
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe("v2_patterns/loadings");
    expect((writes[0].data.axes as Record<string, unknown>)["big5.O"]).toEqual(row);
    expect(writes[0].opts).toEqual({ merge: true });
  });
});
