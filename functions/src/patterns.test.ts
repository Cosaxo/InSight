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

import { PATTERNS_QIDS, runPatternsFit, utcDay, type PatternsLedgerEntry, type PatternsStore } from "./patterns";
import { V2_QUESTIONS } from "./v2content";
import type { PatternsModel, PatternsUserState } from "./patternsFit";

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
