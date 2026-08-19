// The CALL resolver's four decisions (D194): grade, wait, void, skip.
//
// The rubric arithmetic itself is pinned on the client side
// (src/v2/data/callRubric.test.ts) against the byte-identical copy
// check:calls holds equal to this one, so it is not re-tested here. What
// IS here is the thing only this file decides: WHEN a sealed guess gets an
// answer, and what happens when the aggregate cannot give one — which is
// the branch that costs a real player their guess if it is wrong.
import { describe, expect, it, vi } from "vitest";
import {
  CALL_VOID_AFTER_DAYS,
  bankCalls,
  daysPastDue,
  isDue,
  runResolveCalls,
  type BankCall,
  type CallStore,
  type OutcomeDoc,
} from "./calls";
import { CALL_NO, CALL_VOID, CALL_YES, type CallRubric } from "./callRubric";

vi.mock("firebase-functions", () => ({
  logger: { info() {}, warn() {}, error() {} },
}));

/** A store over plain objects, recording what was published. */
function fakeStore(
  aggs: Record<string, { total?: number; counts?: Record<string, number>; by?: Record<string, Record<string, Record<string, number>>> }>,
  existing: Record<string, true> = {},
): CallStore & { written: Record<string, OutcomeDoc> } {
  const written: Record<string, OutcomeDoc> = {};
  return {
    written,
    async agg(qid) { return aggs[qid] ?? null; },
    async hasOutcome(qid) { return qid in existing || qid in written; },
    async putOutcome(qid, outcome) {
      // create-shaped: the first write wins, like Firestore's `create`.
      if (qid in written || qid in existing) return;
      written[qid] = outcome;
    },
  };
}

const AT = (day: string) => new Date(`${day}T12:00:00Z`);

describe("isDue", () => {
  it("grades on the resolvesAt day, never before", () => {
    expect(isDue("2026-10-01", AT("2026-09-30"))).toBe(false);
    expect(isDue("2026-10-01", AT("2026-10-01"))).toBe(true);
    expect(isDue("2026-10-01", AT("2026-10-02"))).toBe(true);
  });
  it("compares UTC day keys, so an instance's timezone cannot bring a call forward", () => {
    // 23:30 on 30 September in UTC is already 1 October in UTC+14. A
    // millisecond comparison against a local midnight would grade here.
    expect(isDue("2026-10-01", new Date("2026-09-30T23:30:00Z"))).toBe(false);
    expect(isDue("2026-10-01", new Date("2026-10-01T00:00:01Z"))).toBe(true);
  });
  it("refuses a malformed resolvesAt rather than grading on it", () => {
    expect(isDue("", AT("2030-01-01"))).toBe(false);
    expect(isDue("1 October", AT("2030-01-01"))).toBe(false);
  });
});

describe("daysPastDue", () => {
  it("counts whole UTC days, floored at zero", () => {
    expect(daysPastDue("2026-10-01", AT("2026-10-01"))).toBe(0);
    expect(daysPastDue("2026-10-01", AT("2026-10-08"))).toBe(7);
    expect(daysPastDue("2026-10-01", AT("2026-09-01"))).toBe(0);
  });
});

describe("the bank's calls", () => {
  it("offers NONE, because every entry is retired (D196)", () => {
    // The owner wants a prediction to be about a real upcoming EVENT; this
    // bank predicts the app's own future numbers, which is a different
    // game. Every entry is `active: false`, and a retired call is one
    // nobody could have answered — so it must not be graded at all. The
    // alternative is three VOID documents apologising for a game that was
    // never offered.
    expect(bankCalls()).toHaveLength(0);
  });

  it("would carry a rubric and a resolve day on every entry it did offer", () => {
    for (const c of bankCalls()) {
      expect(c.resolvesAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.rubric.kind).toBe("agg");
      expect(c.rubric.qid).toBeTruthy();
    }
  });
});

// One rubric of each shape, driven through the pass as FIXTURES rather than
// as live bank rows. They were the bank's own until D196 retired it — and
// the grading logic still has to be exercised, because a real-event rubric
// (the thing the owner actually wants) would arrive on top of exactly this
// machinery. A test that read the live bank would go quiet the moment the
// content was switched off, which is the worst moment to stop looking.
const calls: BankCall[] = [
  { id: "call-c01", resolvesAt: "2026-10-01", rubric: { kind: "agg", qid: "daily-000", test: "topShareAtLeast", threshold: 60 } },
  { id: "call-c02", resolvesAt: "2026-10-01", rubric: { kind: "agg", qid: "feed-f54", test: "slicesDisagree", dim: "ageBand", buckets: ["18-24", "55-64"] } },
  { id: "call-c03", resolvesAt: "2026-10-01", rubric: { kind: "agg", qid: "feed-f11", test: "turnoutAtLeast", threshold: 1000 } },
];
const byTest = (t: CallRubric["test"]) => calls.find((c) => c.rubric.test === t)!;

describe("runResolveCalls", () => {
  it("does nothing before the resolve day", async () => {
    const c = calls[0];
    const store = fakeStore({ [c.rubric.qid]: { total: 100, counts: { "0": 90, "1": 10 } } });
    const s = await runResolveCalls(new Date("2000-01-01T00:00:00Z"), store, calls);
    expect(s).toEqual({ due: 0, resolved: 0, voided: 0, waiting: 0, faulty: 0 });
    expect(store.written).toEqual({});
  });

  it("grades a due call on the published aggregate and publishes what it read", async () => {
    const c = byTest("topShareAtLeast");
    const agg = { total: 100, counts: { "0": 90, "1": 10 } };
    const store = fakeStore({ [c.rubric.qid]: agg });
    await runResolveCalls(AT(c.resolvesAt), store, calls);
    const out = store.written[c.id];
    expect(out.outcomeIdx).toBe(CALL_YES);
    expect(out.resolvedBy).toBe("auto");
    // The basis travels with the claim — this is the field that lets the
    // device re-grade rather than trust (FORESIGHT-CALLS §6).
    expect(out.inputs).toEqual({ qid: c.rubric.qid, total: 100, counts: agg.counts });
  });

  it("grades the other way when the numbers say so", async () => {
    const c = byTest("topShareAtLeast");
    const store = fakeStore({ [c.rubric.qid]: { total: 100, counts: { "0": 51, "1": 49 } } });
    await runResolveCalls(AT(c.resolvesAt), store, calls);
    expect(store.written[c.id].outcomeIdx).toBe(CALL_NO);
  });

  it("waits — and does not guess — while the aggregate cannot answer", async () => {
    const store = fakeStore({});
    const s = await runResolveCalls(AT(calls[0].resolvesAt), store, calls);
    expect(s.waiting).toBe(calls.length);
    expect(s.resolved).toBe(0);
    expect(s.voided).toBe(0);
    // The load-bearing assertion: an unreadable aggregate publishes
    // NOTHING. A resolver that wrote a default here would mark every
    // player who called it correctly as wrong.
    expect(store.written).toEqual({});
  });

  it("voids once the wait has run out, and says why", async () => {
    const c = calls[0];
    const late = new Date(Date.parse(`${c.resolvesAt}T00:00:00Z`) + CALL_VOID_AFTER_DAYS * 86_400_000);
    const store = fakeStore({});
    const s = await runResolveCalls(late, store, calls);
    expect(s.voided).toBe(calls.length);
    expect(store.written[c.id].outcomeIdx).toBe(CALL_VOID);
    expect(store.written[c.id].note).toContain(c.rubric.qid);
  });

  it("does not void one day early", async () => {
    const c = calls[0];
    const nearly = new Date(Date.parse(`${c.resolvesAt}T00:00:00Z`) + (CALL_VOID_AFTER_DAYS - 1) * 86_400_000);
    const s = await runResolveCalls(nearly, fakeStore({}), calls);
    expect(s.voided).toBe(0);
    expect(s.waiting).toBe(calls.length);
  });

  it("never re-grades a call that already has an outcome", async () => {
    const c = byTest("topShareAtLeast");
    const store = fakeStore(
      { [c.rubric.qid]: { total: 100, counts: { "0": 90, "1": 10 } } },
      { [c.id]: true },
    );
    const s = await runResolveCalls(AT(c.resolvesAt), store, calls);
    expect(store.written[c.id]).toBeUndefined();
    // …and it is not counted as work, so the log line means what it says.
    expect(s.due).toBe(calls.length - 1);
  });

  it("reads a slice call from `by`, and waits when a named slice is empty", async () => {
    const c = byTest("slicesDisagree");
    const [a, b] = c.rubric.buckets!;
    const dim = c.rubric.dim!;
    const disagree = {
      total: 40,
      counts: { "0": 20, "1": 20 },
      by: { [dim]: { [a]: { "0": 12, "1": 3 }, [b]: { "0": 3, "1": 12 } } },
    };
    const store = fakeStore({ [c.rubric.qid]: disagree });
    await runResolveCalls(AT(c.resolvesAt), store, calls);
    expect(store.written[c.id].outcomeIdx).toBe(CALL_YES);

    // One slice missing: the aggregate has answers but not the ones this
    // call is about. That is "not yet", never "they agree".
    const half = { total: 40, counts: { "0": 20, "1": 20 }, by: { [dim]: { [a]: { "0": 12, "1": 3 } } } };
    const store2 = fakeStore({ [c.rubric.qid]: half });
    await runResolveCalls(AT(c.resolvesAt), store2, calls);
    expect(store2.written[c.id]).toBeUndefined();
  });

  it("counts a turnout call on the aggregate's total", async () => {
    const c = byTest("turnoutAtLeast");
    const n = c.rubric.threshold!;
    const under = fakeStore({ [c.rubric.qid]: { total: n - 1, counts: { "0": n - 1 } } });
    await runResolveCalls(AT(c.resolvesAt), under, calls);
    expect(under.written[c.id].outcomeIdx).toBe(CALL_NO);

    const over = fakeStore({ [c.rubric.qid]: { total: n, counts: { "0": n } } });
    await runResolveCalls(AT(c.resolvesAt), over, calls);
    expect(over.written[c.id].outcomeIdx).toBe(CALL_YES);
  });
});
