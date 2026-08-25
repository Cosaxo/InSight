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
import { PATTERNS_MIN_BASIS, emptyModel, type PatternsModel, type PatternsUserState } from "./patternsFit";

const NOW = Date.UTC(2026, 7, 19, 3, 0, 0); // the 02:37 schedule's morning

function memoryStore(ledger: Record<string, PatternsLedgerEntry[]>) {
  const state: {
    model: (PatternsModel & { lastDay?: string }) | null;
    users: Map<string, PatternsUserState>;
    putModelCalls: number;
  } = { model: null, users: new Map(), putModelCalls: 0 };
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

// A D86 edit leaves TWO ledger rows, and the fit's last-wins dedup is
// built per day while `L.n`, `L.sum` and theta are cumulative across
// days. So the dedup covered a same-day edit and nothing else, and
// `editVote` has no recency bound at all — "answered yesterday, changed
// my mind today" is the ordinary case. `fromIdx` is what makes the second
// row legible as a correction rather than as a second person.
describe("an edit is a correction, not a second answer", () => {
  const dayBefore = utcDay(NOW, -2);

  it("a CROSS-DAY edit moves the marginal and leaves the basis alone", async () => {
    const { store, state } = memoryStore({
      [dayBefore]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 }],
    });
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    await runPatternsFit(store, NOW);
    const L = state.model!.q[CORE_A];
    // one person, holding option 1: basis 1, marginal −1 (not 2 and 0)
    expect(L.n).toBe(1);
    expect(L.sum).toBe(-1);
    // and the person has answered ONE question, not two
    expect(state.users.get("u1")?.n).toBe(1);
  });

  // The finding's own reproduction, at its own numbers.
  it("30 answer, 29 move: publishes the truth, not a coin flip on double the basis", async () => {
    const day1 = Array.from({ length: 30 }, (_, i) => (
      { uid: `u${i}`, qid: CORE_A, optionIdx: 0 }
    ));
    const day2 = Array.from({ length: 29 }, (_, i) => (
      { uid: `u${i}`, qid: CORE_A, optionIdx: 1, fromIdx: 0 }
    ));
    const { store, state } = memoryStore({ [dayBefore]: day1, [yesterday]: day2 });
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    await runPatternsFit(store, NOW);
    const L = state.model!.q[CORE_A];
    expect(L.n).toBe(30);   // was 59
    expect(L.sum).toBe(-28); // was +1
  });

  it("chains across days, telescoping to the latest opinion", async () => {
    // 0 → 1 → 0: back where they started, still one person, still +1.
    const { store, state } = memoryStore({
      [utcDay(NOW, -3)]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [dayBefore]: [{ uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 }],
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 0, fromIdx: 1 }],
    });
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -4) };
    await runPatternsFit(store, NOW);
    expect(state.model!.q[CORE_A]).toMatchObject({ n: 1, sum: 1 });
  });

  // The edge the per-day collapse has to get right, and the one a naive
  // "fromIdx means correction" would break: the create is deduped away,
  // so nothing has counted this person yet and the day MUST count as one.
  it("a same-day create+edit is still ONE observation, counted once", async () => {
    // The question already has a basis from somebody else, which is what
    // makes this case bite: with the create deduped away, reading the
    // surviving row as a correction would leave u1 out of `n` entirely and
    // silently undercount the question by one person. (An empty model
    // hides that — the `L.n > 0` guard in foldUserDay catches it there —
    // so the prior day's answer is load-bearing in this test.)
    const { store, state } = memoryStore({
      [dayBefore]: [{ uid: "u2", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 0 },
        { uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 },
      ],
    });
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    await runPatternsFit(store, NOW);
    // two people: u2 on option 0 (+1), u1 on option 1 (−1)
    expect(state.model!.q[CORE_A]).toMatchObject({ n: 2, sum: 0 });
    expect(state.users.get("u1")?.n).toBe(1);
  });

  it("…and reads the same if those two rows arrive the other way round", async () => {
    // `sawCreate` is a fact about the day rather than about a position in
    // it. A create's row precedes its edit's in practice — an edit that
    // beats its create is thrown back for redelivery — but a basis count
    // that is right in one arrival order and quietly short in the other
    // is not something to leave resting on "in practice".
    const { store, state } = memoryStore({
      [dayBefore]: [{ uid: "u2", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 },
        { uid: "u1", qid: CORE_A, optionIdx: 1 },
      ],
    });
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    await runPatternsFit(store, NOW);
    expect(state.model!.q[CORE_A]).toMatchObject({ n: 2, sum: 0 });
  });

  it("collapses several same-day edits from the FIRST value they left", async () => {
    // edits only, no create in the day: 0 → 1 → 0 within one day, against
    // a basis laid down the day before. Net effect on the marginal: none.
    const { store, state } = memoryStore({
      [dayBefore]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [
        { uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 },
        { uid: "u1", qid: CORE_A, optionIdx: 0, fromIdx: 1 },
      ],
    });
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    await runPatternsFit(store, NOW);
    expect(state.model!.q[CORE_A]).toMatchObject({ n: 1, sum: 1 });
  });

  it("folds a correction whose original was never seen as a first answer", async () => {
    // The create's day fell outside the catch-up window, so `L` has no
    // observation to correct. Counting it as one is the honest reading —
    // and the guard that stops `sum / n` being 0/0.
    const { store, state } = memoryStore({
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 1, fromIdx: 0 }],
    });
    await runPatternsFit(store, NOW);
    const L = state.model!.q[CORE_A];
    expect(L).toMatchObject({ n: 1, sum: -1 });
    expect(Number.isFinite(L.v[0])).toBe(true);
  });

  it("folds a pre-field row exactly as it always did", async () => {
    // Rows written before `fromIdx` existed are still inside the 90-day
    // ledger window. They carry no marker, so they fold as observations —
    // the old behaviour, which is the right thing to degrade to.
    const { store, state } = memoryStore({
      [dayBefore]: [{ uid: "u1", qid: CORE_A, optionIdx: 0 }],
      [yesterday]: [{ uid: "u1", qid: CORE_A, optionIdx: 1 }],
    });
    state.model = { k: 8, q: {}, lastDay: utcDay(NOW, -3) };
    await runPatternsFit(store, NOW);
    expect(state.model!.q[CORE_A]).toMatchObject({ n: 2, sum: 0 });
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
});
