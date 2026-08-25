// @vitest-environment jsdom
//
// The Patterns store's contract (v28 §2), pinned:
//
//   1. The Oracle's guess is SEALED — persisted to the log BEFORE the
//      caller gets it back, so nothing between "computed" and "options
//      rendered" can lose or reroll it. Re-sealing returns the standing
//      record: the first look is the one that counts. Same discipline as
//      the duel reveal, and it lives in a test the way `surface` pins
//      the duel seal.
//   2. Grading charges the sealed posterior with the ACTUAL answer,
//      exactly once, and names the answered questions that carried the
//      guess.
//   3. The pool is the JOIN of the published loadings against the bank's
//      own view models — a loading the bank cannot name is dropped, a
//      question with more than two options never enters, and a thin
//      basis is refused by nextAsk rather than guessed against.
//   4. The pair card states its basis and stays silent under it — fewer
//      than 12 people in both samples says nothing, and the verdict is
//      cached per session so a re-tap costs zero reads.
//   5. The purge drops the sealed log and the fetched loadings without
//      writing the key back (check:purge's contract).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const live = vi.hoisted(() => ({
  enabled: true,
  myVotes: vi.fn((): Record<string, string> => ({})),
  aggregated: vi.fn((): unknown[] => []),
  coreFeedAggregated: vi.fn((): unknown[] => []),
  subscribe: vi.fn(() => () => {}),
}));
vi.mock("./live", () => ({ default: live }));

// One mutable holder the mocked getDoc reads through, so each test can
// publish its own loadings doc (or absence) without re-mocking.
const remote = vi.hoisted(() => ({
  doc: null as null | { k: number; q: Record<string, { v: number[]; n: number; sum: number }> },
}));
vi.mock("../../lib/firebase", () => ({
  getDb: async () => ({}),
  getFirestoreApi: async () => ({
    doc: (_db: unknown, col: string, id: string) => ({ col, id }),
    getDoc: async () => ({
      exists: () => remote.doc != null,
      get: (k: string) => (remote.doc as unknown as Record<string, unknown>)?.[k],
    }),
  }),
}));

const voters = vi.hoisted(() => ({
  fetchVoterPicks: vi.fn<(db: unknown, qid: string) => Promise<{ uid: string; optionIdx: number }[]>>(
    async () => []),
  // Named here only so the case below can assert it is never reached. The
  // pair card counts agreements and names nobody, so the name-resolving
  // read is pure waste on this path — up to VOTER_FETCH_CAP profile
  // documents per question, billed, thrown away.
  fetchVoters: vi.fn(async () => []),
}));
vi.mock("./voters", () => ({
  fetchVoterPicks: voters.fetchVoterPicks,
  fetchVoters: voters.fetchVoters,
  VOTER_FETCH_CAP: 200,
}));

import { PATTERNS, ensureLive } from "./patterns";

const LS = "insight.patterns.oracle.v1";
const K = 8;
const vec = (...head: number[]): number[] =>
  Array.from({ length: K }, (_, i) => head[i] ?? 0);

const bankQ = (id: string, optCount = 2) => ({
  id,
  cat: "society",
  text: id,
  options: Array.from({ length: optCount }, (_, i) => ({
    id: `${id}:${i}`, label: `${id}-opt${i}`, count: 0, color: "#888888",
  })),
  noCountsYet: false,
  type: "binary",
});

/** A bank and a loadings doc that agree: qa answered (strong factor-0),
 * qb the unanswered factor-0 target, thin under-basis, ghost only in the
 * doc, trio only in the bank with three options — and qc arriving through
 * the CORE FEED half of the join (the fit folds both corpora). */
const publishFixture = () => {
  live.aggregated.mockReturnValue([bankQ("qa"), bankQ("qb"), bankQ("thin"), bankQ("trio", 3)]);
  live.coreFeedAggregated.mockReturnValue([bankQ("qc")]);
  remote.doc = {
    k: K,
    q: {
      qa: { v: vec(1, 0), n: 40, sum: 0 },
      qb: { v: vec(0.9, 0.1), n: 30, sum: 0 },
      thin: { v: vec(0.5, 0.5), n: 5, sum: 0 },
      ghost: { v: vec(0, 1), n: 50, sum: 0 },
      trio: { v: vec(0, 0.8), n: 25, sum: 0 },
      qc: { v: vec(0, 1), n: 20, sum: 0 },
    },
  };
};

beforeEach(async () => {
  localStorage.removeItem(LS);
  // the purge event is the store's own reset — drops the log, the
  // loadings and the say cache between tests
  window.dispatchEvent(new Event("insight:local-purge"));
  live.enabled = true;
  live.myVotes.mockReturnValue({});
  live.aggregated.mockReturnValue([]);
  remote.doc = null;
});
afterEach(() => vi.clearAllMocks());

describe("readiness", () => {
  it("is not ready until the loadings doc has been looked for", async () => {
    expect(PATTERNS.ready()).toBe(false);
    await ensureLive();
    expect(PATTERNS.ready()).toBe(true);
    expect(PATTERNS.hasLoadings()).toBe(false); // absent is an answer
  });

  it("demo mode is ready with nothing — the honest empty state", () => {
    live.enabled = false;
    expect(PATTERNS.ready()).toBe(true);
    expect(PATTERNS.hasLoadings()).toBe(false);
    expect(PATTERNS.pool()).toEqual([]);
  });
});

describe("the pool join", () => {
  it("draws only what BOTH the fit and the bank can name, two options only", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const ids = PATTERNS.pool().map((p) => p.q.id);
    // ghost unnamed, trio 3-option; qc arrives through the core-feed half
    expect(ids).toEqual(["qa", "qb", "thin", "qc"]);
    const qa = PATTERNS.pool().find((p) => p.q.id === "qa")!;
    expect(qa.mine).toBe(1); // option 0 encodes +1
    expect(qa.n).toBe(40);
  });

  it("nextAsk refuses a thin basis and skips the answered", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    // qa answered, qb has basis 30 — thin (n=5) is never offered
    expect(PATTERNS.nextAsk()?.q.id).toBe("qb");
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: "qb:1" });
    expect(PATTERNS.nextAsk()?.q.id).toBe("qc"); // thin stays refused
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: "qb:1", qc: "qc:0" });
    expect(PATTERNS.nextAsk()).toBeNull();
  });
});

describe("the seal", () => {
  it("persists the record BEFORE returning — sealed, not just computed", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const rec = PATTERNS.seal("qb");
    expect(rec).not.toBeNull();
    // the log on disk already carries it — a re-render or reload between
    // seal and answer cannot lose the guess
    const onDisk = JSON.parse(localStorage.getItem(LS) || "[]");
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].qid).toBe("qb");
    expect(onDisk[0].p0).toBe(rec!.p0);
  });

  it("leans with the viewer's answers — a factor-0 yes predicts option 0", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const rec = PATTERNS.seal("qb")!;
    expect(rec.pred).toBe(0);
    expect(rec.p0).toBeGreaterThan(0.5);
  });

  it("re-sealing returns the standing record — the first look counts", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const first = PATTERNS.seal("qb")!;
    // more answers arrive; the sealed guess must not move
    live.myVotes.mockReturnValue({ qa: "qa:1" });
    const again = PATTERNS.seal("qb")!;
    expect(again.p0).toBe(first.p0);
    expect(again.at).toBe(first.at);
    expect(JSON.parse(localStorage.getItem(LS) || "[]")).toHaveLength(1);
  });

  it("refuses a question it cannot see", async () => {
    publishFixture();
    await ensureLive();
    expect(PATTERNS.seal("ghost")).toBeNull();
    expect(localStorage.getItem(LS)).toBeNull();
  });
});

describe("the grade", () => {
  it("charges the sealed posterior with the actual answer and names the evidence", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const sealed = PATTERNS.seal("qb")!;
    // the viewer defies the guess: predicted option 0, answered option 1
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: "qb:1" });
    const rec = PATTERNS.grade("qb")!;
    expect(rec.mine).toBe(1);
    expect(rec.bits).toBeGreaterThan(-Math.log2(sealed.p0)); // a miss costs more than the hit would have
    expect(rec.ev).toEqual(["qa"]); // the answer that carried the guess
  });

  it("is idempotent — a second grade never re-rolls the bits", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    PATTERNS.seal("qb");
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: "qb:0" });
    const first = PATTERNS.grade("qb")!;
    const again = PATTERNS.grade("qb")!;
    expect(again.bits).toBe(first.bits);
    expect(again.mine).toBe(first.mine);
  });

  it("without the answer, the record stays sealed and ungraded", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    PATTERNS.seal("qb");
    const rec = PATTERNS.grade("qb")!;
    expect(rec.bits).toBeUndefined();
    expect(PATTERNS.meter().records).toHaveLength(0);
  });
});

describe("the meter", () => {
  it("counts called guesses and averages the bits over graded records", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const sealed = PATTERNS.seal("qb")!;
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: `qb:${sealed.pred}` });
    PATTERNS.grade("qb");
    const m = PATTERNS.meter();
    expect(m.records).toHaveLength(1);
    expect(m.called).toBe(1);
    expect(m.avgBits).toBeCloseTo(-Math.log2(sealed.p0), 2);
  });
});

describe("the pair card", () => {
  const overlap = (n: number, split: (i: number) => [number, number]) => {
    voters.fetchVoterPicks.mockImplementation(async (_db: unknown, qid: string) =>
      Array.from({ length: n }, (_, i) => ({
        uid: `u${i}`,
        optionIdx: qid === "qa" ? split(i)[0] : split(i)[1],
      })));
  };

  it("states the strongest positive-lift direction with its basis", async () => {
    publishFixture();
    await ensureLive();
    // ten people picked qa:0 → qb:0, ten picked qa:1 → qb:1
    overlap(20, (i) => (i < 10 ? [0, 0] : [1, 1]));
    const say = await PATTERNS.say("qa", "qb");
    expect(say).toEqual({
      pick: "qa-opt0", then: "qb-opt0", pickIdx: 0, thenIdx: 0, pct: 100, base: 50, both: 20,
    });
  });

  it("says nothing under 12 people in both samples", async () => {
    publishFixture();
    await ensureLive();
    overlap(11, (i) => (i < 6 ? [0, 0] : [1, 1]));
    expect(await PATTERNS.say("qa", "qb")).toBeNull();
  });

  it("caches the verdict per session — a re-tap costs zero reads", async () => {
    publishFixture();
    await ensureLive();
    overlap(20, (i) => (i < 10 ? [0, 0] : [1, 1]));
    await PATTERNS.say("qa", "qb");
    expect(voters.fetchVoterPicks).toHaveBeenCalledTimes(2); // one per question
    await PATTERNS.say("qa", "qb");
    await PATTERNS.say("qb", "qa"); // same pair, either order
    expect(voters.fetchVoterPicks).toHaveBeenCalledTimes(2);
  });

  it("reads picks only — never the profile documents behind the names", async () => {
    // The card says "people who picked X also picked Y". It draws no
    // names, so `fetchVoters`' second half — resolveNames, up to
    // VOTER_FETCH_CAP profile reads chunked 30 at a time — bought a map
    // nothing on this path read. A regression here is invisible on
    // screen and shows up only on the bill.
    publishFixture();
    await ensureLive();
    overlap(20, (i) => (i < 10 ? [0, 0] : [1, 1]));
    await PATTERNS.say("qa", "qb");
    expect(voters.fetchVoterPicks).toHaveBeenCalled();
    expect(voters.fetchVoters).not.toHaveBeenCalled();
  });
});

describe("the purge", () => {
  it("drops the log and the loadings without writing the key back", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    PATTERNS.seal("qb");
    expect(localStorage.getItem(LS)).not.toBeNull();
    localStorage.removeItem(LS); // purgeLocalTrace has already swept it
    window.dispatchEvent(new Event("insight:local-purge"));
    expect(localStorage.getItem(LS)).toBeNull(); // nothing wrote it back
    expect(PATTERNS.hasLoadings()).toBe(false);
    expect(PATTERNS.ready()).toBe(false); // a re-entry refetches honestly
    expect(PATTERNS.meter().records).toHaveLength(0);
  });
});
