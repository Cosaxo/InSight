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

const live = vi.hoisted(() => {
  const l = {
    enabled: true,
    myVotes: vi.fn((): Record<string, string> => ({})),
    aggregated: vi.fn((): unknown[] => []),
    coreFeedAggregated: vi.fn((): unknown[] => []),
    subscribe: vi.fn(() => () => {}),
    // The viewer's answers as option indexes (D396). Derived from the vote
    // mock by default — this file's option ids are `${qid}:${idx}` — so a
    // case that sets myVotes gets consistent evidence for free; a case
    // about the wider corpus sets it directly.
    answeredIndex: vi.fn((): Record<string, number> => Object.fromEntries(
      Object.entries(l.myVotes()).map(([qid, id]) => [qid, Number(String(id).split(":").pop())]),
    )),
    // The cohort prior's two inputs (D453): the viewer's own anchors and
    // a question's aggregate with its `by` cells. Empty and absent by
    // default, so every case above this block seals from the world exactly.
    anchors: vi.fn((): Record<string, string> => ({})),
    aggFor: vi.fn<(qid: string) => unknown>(() => null),
  };
  return l;
});
vi.mock("./live", () => ({ default: live }));

// One mutable holder the mocked getDoc reads through, so each test can
// publish its own loadings doc (or absence) without re-mocking.
const remote = vi.hoisted(() => ({
  doc: null as null | {
    k: number;
    engine?: string;
    lambdaU?: number;
    tau?: number;
    items?: Record<string, { kind: string; qid: string; opt?: number; nOptions: number; dim?: string; bucket?: string; entity?: string }>;
    q: Record<string, { v: number[]; n: number; sum: number; sd?: number }>;
  },
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
  // The nightly sample (D397): null means none published yet, and the
  // pair card falls back to the live picks — which is what every case
  // below that counts rows exercises. The case about the sample sets it.
  fetchVoterSample: vi.fn<(db: unknown, qid: string) => Promise<{ uid: string; optionIdx: number }[] | null>>(
    async () => null),
}));
vi.mock("./voters", () => ({
  fetchVoterPicks: voters.fetchVoterPicks,
  fetchVoters: voters.fetchVoters,
  fetchVoterSample: voters.fetchVoterSample,
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
  live.anchors.mockReturnValue({});
  live.aggFor.mockReturnValue(null);
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

  it("nextAsk asks what it knows least about, refuses a thin basis and skips the answered", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    // qa answered pins factor 0; qb (0.9, 0.1) is nearly called already,
    // qc (0, 1) is the direction nothing has spoken to — the information
    // rule asks qc first (the owner's call, 2026-09-06). thin (n=5) is
    // never offered.
    expect(PATTERNS.nextAsk()?.q.id).toBe("qc");
    live.myVotes.mockReturnValue({ qa: "qa:0", qc: "qc:0" });
    expect(PATTERNS.nextAsk()?.q.id).toBe("qb"); // thin stays refused
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: "qb:1", qc: "qc:0" });
    expect(PATTERNS.nextAsk()).toBeNull();
  });

  it("with nothing answered, the first eligible question in pool order is as informative as any", async () => {
    publishFixture();
    await ensureLive();
    // an empty solve leaves every direction equally undetermined up to
    // the loadings' own norms: qa (norm 1) and qc (norm 1) tie, and a tie
    // keeps pool order
    expect(PATTERNS.nextAsk()?.q.id).toBe("qa");
  });
});

describe("the evidence and the ridge (D396)", () => {
  /** The candidate engine's document: two-option rows beside an ordinal
   * scale and a three-option pick, with the metadata that says which. */
  const publishWide = () => {
    live.aggregated.mockReturnValue([bankQ("qa"), bankQ("qb"), bankQ("scale", 5), bankQ("pick", 3)]);
    live.coreFeedAggregated.mockReturnValue([]);
    remote.doc = {
      k: K,
      engine: "als",
      lambdaU: 2,
      q: {
        qa: { v: vec(1, 0), n: 40, sum: 0 },
        qb: { v: vec(0.9, 0.1), n: 30, sum: 0 },
        scale: { v: vec(0, 1), n: 50, sum: 100, sd: 1.25 },
        "pick~0": { v: vec(0.5, 0.5), n: 20, sum: -10 },
        "pick~1": { v: vec(-0.5, 0.5), n: 20, sum: 0 },
        "pick~2": { v: vec(0, -1), n: 20, sum: 10 },
      },
      items: {
        qa: { kind: "bin", qid: "qa", nOptions: 2 },
        qb: { kind: "bin", qid: "qb", nOptions: 2 },
        scale: { kind: "ord", qid: "scale", nOptions: 5 },
        "pick~0": { kind: "opt", qid: "pick", opt: 0, nOptions: 3 },
        "pick~1": { kind: "opt", qid: "pick", opt: 1, nOptions: 3 },
        "pick~2": { kind: "opt", qid: "pick", opt: 2, nOptions: 3 },
      },
    };
  };

  it("reads the ridge off the document, and falls back to the shipped value", async () => {
    publishFixture();
    await ensureLive();
    expect(PATTERNS.lambdaU()).toBe(0.5);
    publishWide();
    await ensureLive(true);
    expect(PATTERNS.lambdaU()).toBe(2);
  });

  it("encodes every kind the rows can carry — bin ±1, ord standardised, pick one-hot — and the pool still draws two-option only", async () => {
    publishWide();
    live.myVotes.mockReturnValue({ qa: "qa:1", scale: "scale:4", pick: "pick:2" });
    await ensureLive();
    const ev = PATTERNS.evidence();
    // qa: option 1 → −1, marginal 0 → r = −1
    expect(ev).toContainEqual({ L: vec(1, 0), r: -1 });
    // scale: index 4 against mean 2, sd 1.25 → +1.6
    expect(ev.find((o) => o.L === remote.doc!.q.scale.v)?.r).toBeCloseTo(1.6, 9);
    // pick option 2: −1 against pick~0's mean −0.5 → −0.5; +1 against pick~2's mean 0.5 → +0.5
    expect(ev.find((o) => o.L === remote.doc!.q["pick~0"].v)?.r).toBeCloseTo(-0.5, 9);
    expect(ev.find((o) => o.L === remote.doc!.q["pick~1"].v)?.r).toBeCloseTo(-1, 9);
    expect(ev.find((o) => o.L === remote.doc!.q["pick~2"].v)?.r).toBeCloseTo(0.5, 9);
    expect(ev).toHaveLength(5);
    // the drawn pool is unchanged: two-option questions, nothing else
    expect(PATTERNS.pool().map((p) => p.q.id)).toEqual(["qa", "qb"]);
    // and the seal reads the wider evidence: a scale answer along factor 1
    // says nothing about qb (factor 0), the qa answer says option 1
    const rec = PATTERNS.seal("qb")!;
    expect(rec.pred).toBe(1);
  });

  it("an ordinal row with no spread and a row with no basis carry nothing", async () => {
    publishWide();
    remote.doc!.q.scale = { v: vec(0, 1), n: 50, sum: 100, sd: 0 };
    remote.doc!.q.qa = { v: vec(1, 0), n: 0, sum: 0 };
    live.myVotes.mockReturnValue({ qa: "qa:0", scale: "scale:3" });
    await ensureLive();
    expect(PATTERNS.evidence()).toEqual([]);
  });

  it("under the online engine's rows, only two-option answers are evidence", async () => {
    publishFixture(); // no `items`: the online engine's document
    live.myVotes.mockReturnValue({ qa: "qa:0", trio: "trio:2" });
    await ensureLive();
    // trio has a row in this fixture but three options; the online rows
    // are two-option by construction, so an index of 2 is not ±1 and is
    // not read as one
    expect(PATTERNS.evidence()).toEqual([{ L: vec(1, 0), r: 1 }]);
    // and a target's own answer stays out of the solve that guesses it
    expect(PATTERNS.evidence("qa")).toEqual([]);
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

describe("the pair card reads the nightly sample first (D397)", () => {
  it("counts the sample's rows and never issues the live query when a sample exists", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const crowd = (side: number) => Array.from({ length: 20 }, (_, i) => ({ uid: `s${i}`, optionIdx: i < 15 ? side : 1 - side }));
    voters.fetchVoterSample.mockImplementation(async (_db, qid) => (qid === "qa" ? crowd(0) : crowd(0)));
    const say = await PATTERNS.say("qa", "qb");
    expect(say?.both).toBe(20);
    expect(voters.fetchVoterPicks).not.toHaveBeenCalled();
    expect(voters.fetchVoterSample).toHaveBeenCalledTimes(2);
  });

  it("falls back to the live picks for a question with no sample yet", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    voters.fetchVoterSample.mockResolvedValue(null);
    voters.fetchVoterPicks.mockResolvedValue([]);
    await PATTERNS.say("qa", "qb");
    expect(voters.fetchVoterPicks).toHaveBeenCalledTimes(2);
  });
});

describe("the working (2026-08-26)", () => {
  const overlap = (n: number, split: (i: number) => [number, number]) => {
    voters.fetchVoterPicks.mockImplementation(async (_db: unknown, qid: string) =>
      Array.from({ length: n }, (_, i) => ({
        uid: `u${i}`,
        optionIdx: qid === "qa" ? split(i)[0] : split(i)[1],
      })));
  };
  const gradeQb = () => {
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    const sealed = PATTERNS.seal("qb")!;
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: `qb:${sealed.pred}` });
    return PATTERNS.grade("qb")!;
  };

  it("rebuilds the graded call as rows: the evidence answer, its tell, its basis", async () => {
    publishFixture();
    await ensureLive();
    // 15 people on each qa side, each side sticking together on qb — so
    // the viewer's side (qa:0) clears the 12-in-both-samples floor and
    // the tell points at the call
    overlap(30, (i) => (i < 15 ? [0, 0] : [1, 1]));
    const rec = gradeQb();
    const w = (await PATTERNS.working("qb"))!;
    expect(w.hadEv).toBe(true);
    expect(w.rows).toHaveLength(1);
    expect(w.rows[0]).toMatchObject({ evId: "qa", side: 0, n: 15 });
    expect(w.rows[0].share).toBeGreaterThanOrEqual(0.54); // points at the call, or it is not a row
    expect(w.rows[0].share).toBeCloseTo(1, 5);
    expect(rec.ev).toContain("qa");
  });

  it("a call carried by nothing says so — hadEv false, no rows", async () => {
    publishFixture();
    await ensureLive();
    // no other answers: the seal falls back to the crowd's own lean and
    // the grade names no evidence
    const sealed = PATTERNS.seal("qb")!;
    live.myVotes.mockReturnValue({ qb: `qb:${sealed.pred}` });
    PATTERNS.grade("qb");
    const w = (await PATTERNS.working("qb"))!;
    // The three reason flags are all false here, and that is the point of
    // reading them exactly: a call with no evidence at all is not thin,
    // not weak and not a failed read — it is the coin, and the panel says
    // so with its own sentence.
    expect(w).toEqual({ rows: [], prior: [], hadPrior: false, hadEv: false, thin: false, weak: false, failed: false });
  });

  it("evidence below the 12-in-both-samples floor is thinness, not a bar", async () => {
    publishFixture();
    await ensureLive();
    // only 8 people on the viewer's qa side — the tell refuses (D146),
    // so the row is absent while hadEv stays true: the UI's two empty
    // states must stay distinguishable
    overlap(16, (i) => (i < 8 ? [0, 0] : [1, 1]));
    gradeQb();
    const w = (await PATTERNS.working("qb"))!;
    expect(w.hadEv).toBe(true);
    expect(w.rows).toHaveLength(0);
  });

  it("is bounded like the tell it rides — one picks fetch per question, cached", async () => {
    publishFixture();
    await ensureLive();
    overlap(30, (i) => (i < 15 ? [0, 0] : [1, 1]));
    gradeQb();
    await PATTERNS.working("qb");
    expect(voters.fetchVoterPicks).toHaveBeenCalledTimes(2); // qb + qa
    expect(voters.fetchVoters).not.toHaveBeenCalled(); // picks only, never profiles
    await PATTERNS.working("qb");
    expect(voters.fetchVoterPicks).toHaveBeenCalledTimes(2); // the session caches held
  });

  it("refuses an ungraded or unknown record", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    PATTERNS.seal("qb"); // sealed, never graded
    expect(await PATTERNS.working("qb")).toBeNull();
    expect(await PATTERNS.working("ghost")).toBeNull();
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

describe("the cohort prior (D453)", () => {
  /** An aggregate whose cells split by the viewer's groups: on qb the
   * viewer's age band leans hard to option 0, their gender is split
   * evenly, and the world (the row's sum) is a coin. */
  const cells = (age: [number, number], gender: [number, number] = [30, 30]) => ({
    counts: { "0": 50, "1": 50 },
    total: 100,
    by: {
      ageBand: { "55-64": { "0": age[0], "1": age[1] } },
      gender: { male: { "0": gender[0], "1": gender[1] } },
    },
  });
  const me = { ageBand: "55-64", gender: "male" };

  it("seals the guess from the viewer's groups' split, with the world guess beside it as the shadow", async () => {
    publishFixture();
    live.anchors.mockReturnValue(me);
    live.aggFor.mockImplementation((qid: string) => (qid === "qb" ? cells([90, 10]) : null));
    await ensureLive();
    const rec = PATTERNS.seal("qb")!;
    // no answers, so θ is zero and the guess IS the prior: the age cell
    // shrunk by twenty world answers is (90 + 10)/120 = 0.83; the gender
    // cell is even and moves nothing
    expect(rec.centre).toBe("cohort");
    expect(rec.p0).toBeCloseTo(0.833, 2);
    expect(rec.pred).toBe(0);
    expect(rec.alt).toEqual({ p0: 0.5, pred: 0 }); // the world's coin
    expect(rec.m0).toBe(0);
    expect(rec.mc).toBeCloseTo(0.667, 2);
    expect(rec.prior).toEqual([
      { dim: "ageBand", bucket: "55-64", n: 100, p0: expect.closeTo(0.833, 2) },
      { dim: "gender", bucket: "male", n: 60, p0: 0.5 },
    ]);
    // persisted whole, so the shadow survives a relaunch
    expect(JSON.parse(localStorage.getItem(LS)!)[0].alt.p0).toBe(0.5);
  });

  it("a small cell moves the guess less than a large one — the shrink toward the world", async () => {
    publishFixture();
    live.anchors.mockReturnValue(me);
    live.aggFor.mockImplementation((qid: string) => (qid === "qb" ? cells([5, 0]) : null));
    await ensureLive();
    // five unanimous answers: (5 + 10)/25 = 0.6, not 1
    expect(PATTERNS.seal("qb")!.p0).toBeCloseTo(0.6, 2);
  });

  it("with no group able to speak the two centres are identical and nothing is recorded as a prior", async () => {
    publishFixture();
    // an opt-out and an empty value are not groups; and qb has no cells at all
    live.anchors.mockReturnValue({ ageBand: "", gender: "Prefer not to say" });
    live.aggFor.mockImplementation((qid: string) => (qid === "qb" ? cells([90, 10]) : null));
    await ensureLive();
    const rec = PATTERNS.seal("qb")!;
    expect(rec.p0).toBe(0.5);
    expect(rec.alt?.p0).toBe(0.5);
    expect(rec.mc).toBe(rec.m0);
    expect(rec.prior).toBeUndefined();
  });

  it("centres the evidence by the same prior, so the vector does not learn the demographics twice", async () => {
    publishFixture();
    live.anchors.mockReturnValue(me);
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    // the viewer's age band leans to option 0 on qa as well: (95 + 10)/120
    live.aggFor.mockImplementation((qid: string) => (qid === "qa" ? cells([95, 5]) : null));
    await ensureLive();
    const world = PATTERNS.evidence(undefined, "world");
    const cohort = PATTERNS.evidence(undefined, "cohort");
    expect(world).toHaveLength(1);
    expect(world[0].r).toBe(1); // +1 against a coin
    expect(cohort[0].r).toBeCloseTo(1 - (2 * (105 / 120) - 1), 3); // +1 against the group's own lean
    expect(Math.abs(cohort[0].r)).toBeLessThan(Math.abs(world[0].r));
    // the default is the world — the People lens's crowd is centred there
    expect(PATTERNS.evidence()[0].r).toBe(1);
  });

  it("grades the seal, the shadow and the base rate on the same answer, and the meter reads the two centres side by side", async () => {
    publishFixture();
    live.anchors.mockReturnValue(me);
    live.aggFor.mockImplementation((qid: string) => (qid === "qb" ? cells([90, 10]) : null));
    await ensureLive();
    PATTERNS.seal("qb");
    // the viewer breaks the group's lean: option 1
    live.myVotes.mockReturnValue({ qb: "qb:1" });
    const rec = PATTERNS.grade("qb")!;
    expect(rec.mine).toBe(1);
    expect(rec.bits).toBeGreaterThan(rec.alt!.bits!); // the prior was surer, and wrong
    expect(rec.alt!.bits).toBe(1); // the coin costs one bit either way
    expect(rec.baseBits).toBe(1);
    const m = PATTERNS.meter();
    expect(m.compared).toBe(1);
    expect(m.cohortBits).toBe(rec.bits);
    expect(m.worldBits).toBe(1);
    expect(m.based).toBe(1);
    expect(m.baseBits).toBe(1);
  });

  it("a record sealed before the shadow existed still grades, and stays out of the comparison", async () => {
    publishFixture();
    localStorage.setItem(LS, JSON.stringify([{ qid: "qa", p0: 0.7, pred: 0, at: 1 }]));
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    const rec = PATTERNS.grade("qa")!;
    expect(rec.bits).toBeCloseTo(0.51, 2);
    expect(rec.alt).toBeUndefined();
    expect(rec.baseBits).toBeUndefined();
    const m = PATTERNS.meter();
    expect(m.records).toHaveLength(1);
    expect(m.compared).toBe(0);
    expect(m.based).toBe(0);
  });

  it("the working shows the groups that leaned toward the call, on the evidence rows' own floors", async () => {
    publishFixture();
    live.anchors.mockReturnValue(me);
    live.aggFor.mockImplementation((qid: string) => (qid === "qb" ? cells([90, 10]) : null));
    await ensureLive();
    PATTERNS.seal("qb");
    live.myVotes.mockReturnValue({ qb: "qb:0" });
    PATTERNS.grade("qb");
    const w = (await PATTERNS.working("qb"))!;
    expect(w.hadEv).toBe(false); // nothing answered before the seal
    expect(w.hadPrior).toBe(true);
    // the even gender cell spoke but did not lean — not a row
    expect(w.prior).toEqual([{ dim: "ageBand", bucket: "55-64", n: 100, share: expect.closeTo(0.833, 2) }]);
  });

  it("a thin cell is not a row in the working, though it moved the seal", async () => {
    publishFixture();
    live.anchors.mockReturnValue(me);
    live.aggFor.mockImplementation((qid: string) => (qid === "qb" ? cells([11, 0], [0, 0]) : null));
    await ensureLive();
    const rec = PATTERNS.seal("qb")!;
    expect(rec.prior).toHaveLength(1); // eleven answers moved it a little
    live.myVotes.mockReturnValue({ qb: "qb:0" });
    PATTERNS.grade("qb");
    const w = (await PATTERNS.working("qb"))!;
    expect(w.hadPrior).toBe(true);
    expect(w.prior).toEqual([]); // under twelve, it is not a sentence
  });
});

describe("anchor rows (D454)", () => {
  /** The candidate's document with two gender rows and one age row that
   * has no basis yet. */
  const publishAnchored = () => {
    live.aggregated.mockReturnValue([bankQ("qa"), bankQ("qb")]);
    live.coreFeedAggregated.mockReturnValue([]);
    remote.doc = {
      k: K,
      engine: "als",
      lambdaU: 1,
      q: {
        qa: { v: vec(1, 0), n: 40, sum: 0 },
        qb: { v: vec(0.9, 0.1), n: 30, sum: 0 },
        "anchor~gender~Woman": { v: vec(0.8, 0), n: 50, sum: 10 },
        "anchor~gender~Man": { v: vec(-0.8, 0), n: 50, sum: -10 },
        "anchor~ageBand~25-34": { v: vec(0, 0.5), n: 0, sum: 0 },
      },
      items: {
        qa: { kind: "bin", qid: "qa", nOptions: 2 },
        qb: { kind: "bin", qid: "qb", nOptions: 2 },
        "anchor~gender~Woman": { kind: "anc", qid: "anchor~gender", nOptions: 2, dim: "gender", bucket: "Woman" },
        "anchor~gender~Man": { kind: "anc", qid: "anchor~gender", nOptions: 2, dim: "gender", bucket: "Man" },
        "anchor~ageBand~25-34": { kind: "anc", qid: "anchor~ageBand", nOptions: 1, dim: "ageBand", bucket: "25-34" },
      },
    };
  };

  it("reads the viewer's own anchors as evidence under the world centre, and never under the cohort centre", async () => {
    publishAnchored();
    live.anchors.mockReturnValue({ gender: "Woman", ageBand: "25-34", city: "Oslo, NO" });
    await ensureLive();
    const world = PATTERNS.evidence();
    // the Woman row: +1 − 10/50; the Man row: −1 + 10/50; the age row has
    // no basis and the city no row
    expect(world).toHaveLength(2);
    expect(world[0].L).toEqual(vec(0.8, 0));
    expect(world[0].r).toBeCloseTo(0.8, 12);
    expect(world[1].r).toBeCloseTo(-0.8, 12);
    expect(PATTERNS.evidence(undefined, "cohort")).toEqual([]);
    // an empty or absent value is no observation
    live.anchors.mockReturnValue({ gender: " ", city: "Oslo, NO" });
    expect(PATTERNS.evidence()).toEqual([]);
    // the pool is the bank's questions and nothing else
    expect(PATTERNS.pool().map((p) => p.q.id)).toEqual(["qa", "qb"]);
  });

  it("the world-centred guess starts from the anchors before the first answer, beside the cohort one", async () => {
    publishAnchored();
    live.anchors.mockReturnValue({ gender: "Woman" });
    await ensureLive();
    const rec = PATTERNS.seal("qa")!;
    // the live seal is the cohort variant: no cells in hand, so the coin;
    // the shadow is the world variant, and a woman here leans to option 0
    expect(rec.centre).toBe("cohort");
    expect(rec.p0).toBe(0.5);
    expect(rec.alt!.p0).toBeGreaterThan(0.5);
    expect(rec.alt!.pred).toBe(0);
  });

  it("anchorRows() lists the rows with a basis, for the People fold", async () => {
    publishAnchored();
    await ensureLive();
    expect(PATTERNS.anchorRows()).toEqual([
      { key: "anchor~gender~Woman", dim: "gender", bucket: "Woman", L: vec(0.8, 0), marginal: 0.2 },
      { key: "anchor~gender~Man", dim: "gender", bucket: "Man", L: vec(-0.8, 0), marginal: -0.2 },
    ]);
    // the online engine's document carries no items, so no rows
    publishFixture();
    await ensureLive(true);
    expect(PATTERNS.anchorRows()).toEqual([]);
  });
});

describe("pick rows (D455)", () => {
  /** The candidate's document with a catalogue question's two popular
   * entities as rows, beside a two-option question. */
  const publishPicks = () => {
    live.aggregated.mockReturnValue([bankQ("qa"), bankQ("qb")]);
    live.coreFeedAggregated.mockReturnValue([]);
    remote.doc = {
      k: K,
      engine: "als",
      lambdaU: 1,
      q: {
        qa: { v: vec(1, 0), n: 40, sum: 0 },
        qb: { v: vec(0.9, 0.1), n: 30, sum: 0 },
        "pick-x~25": { v: vec(0.7, 0), n: 60, sum: -20 },
        "pick-x~6": { v: vec(-0.7, 0), n: 60, sum: -30 },
      },
      items: {
        qa: { kind: "bin", qid: "qa", nOptions: 2 },
        qb: { kind: "bin", qid: "qb", nOptions: 2 },
        "pick-x~25": { kind: "pick", qid: "pick-x", nOptions: 2, entity: "25" },
        "pick-x~6": { kind: "pick", qid: "pick-x", nOptions: 2, entity: "6" },
      },
    };
  };

  it("reads the viewer's own pick as evidence under both centres, and a rare pick as neither of these", async () => {
    publishPicks();
    // the vote mirror holds a pick as the entity's digits (votePick)
    live.myVotes.mockReturnValue({ "pick-x": "25" });
    await ensureLive();
    for (const centre of ["world", "cohort"] as const) {
      const ev = PATTERNS.evidence(undefined, centre);
      expect(ev).toHaveLength(2);
      expect(ev[0].L).toEqual(vec(0.7, 0));
      expect(ev[0].r).toBeCloseTo(1 - (-20 / 60), 12); // picked it
      expect(ev[1].r).toBeCloseTo(-1 - (-30 / 60), 12); // did not pick the other
    }
    live.myVotes.mockReturnValue({ "pick-x": "999" });
    const rare = PATTERNS.evidence();
    expect(rare.map((o, i) => Math.sign(o.r + [-20 / 60, -30 / 60][i]))).toEqual([-1, -1]);
    // an unanswered card is nothing, and the pool is still the bank's two-option questions
    live.myVotes.mockReturnValue({});
    expect(PATTERNS.evidence()).toEqual([]);
    expect(PATTERNS.pool().map((p) => p.q.id)).toEqual(["qa", "qb"]);
    expect(PATTERNS.anchorRows()).toEqual([]);
  });
});

describe("the slope and the schedule on the store (D456)", () => {
  it("reads tau off the document — 1 when absent — and seals with it", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    expect(PATTERNS.tau()).toBe(1);
    // qa answered pins factor 0 at θ₀ = 1/1.5; qb (0.9, 0.1) leans 0.6
    expect(PATTERNS.seal("qb")!.p0).toBeCloseTo(0.8, 9);
    // the same document with a slope of 2: the lean doubles, into the clamp
    // (the purge drops the store's copies; the key itself is the sweep's,
    // so the test clears it as purgeLocalTrace would have)
    window.dispatchEvent(new Event("insight:local-purge"));
    localStorage.removeItem(LS);
    publishFixture();
    remote.doc = { ...remote.doc!, tau: 2 };
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    expect(PATTERNS.tau()).toBe(2);
    expect(PATTERNS.seal("qb")!.p0).toBe(0.95);
  });

  it("asks the surest call once the answers pin the vector, and the informative one every fourth turn", async () => {
    publishFixture();
    live.aggregated.mockReturnValue([bankQ("qa"), bankQ("qb"), bankQ("qc"), bankQ("qd")]);
    remote.doc!.q.qd = { v: vec(0.3, 0.9), n: 30, sum: 0 };
    // qa (+1) and qc (−1) answered: both factors pinned at λ 0.5 — every
    // open question's share is under a half — so the call is the surest:
    // qb leans 0.53, qd 0.4
    live.myVotes.mockReturnValue({ qa: "qa:0", qc: "qc:1" });
    await ensureLive();
    expect(PATTERNS.nextAsk()?.q.id).toBe("qb");
    // three graded answers on the record: the fourth turn learns — qd's
    // loading is the less determined of the two
    localStorage.setItem(LS, JSON.stringify([1, 2, 3].map((i) => ({ qid: `x${i}`, p0: 0.5, pred: 0, at: i, mine: 0, bits: 1 }))));
    window.dispatchEvent(new Event("insight:local-purge"));
    localStorage.setItem(LS, JSON.stringify([1, 2, 3].map((i) => ({ qid: `x${i}`, p0: 0.5, pred: 0, at: i, mine: 0, bits: 1 }))));
    publishFixture();
    live.aggregated.mockReturnValue([bankQ("qa"), bankQ("qb"), bankQ("qc"), bankQ("qd")]);
    remote.doc!.q.qd = { v: vec(0.3, 0.9), n: 30, sum: 0 };
    live.myVotes.mockReturnValue({ qa: "qa:0", qc: "qc:1" });
    await ensureLive();
    expect(PATTERNS.meter().records).toHaveLength(3);
    expect(PATTERNS.nextAsk()?.q.id).toBe("qd");
  });

  it("the meter says skill over the records that stored a base rate", async () => {
    publishFixture();
    live.myVotes.mockReturnValue({ qa: "qa:0" });
    await ensureLive();
    PATTERNS.seal("qb"); // p0 0.8 against a coin
    live.myVotes.mockReturnValue({ qa: "qa:0", qb: "qb:0" });
    PATTERNS.grade("qb");
    const m = PATTERNS.meter();
    expect(m.based).toBe(1);
    expect(m.baseBits).toBe(1);
    expect(m.basedBits).toBeCloseTo(-Math.log2(0.8), 2);
    expect(m.skill).toBeCloseTo(1 + Math.log2(0.8), 2);
    // a record with no base rate is outside the comparison, and an empty
    // meter is zero rather than a division
    localStorage.setItem(LS, JSON.stringify([{ qid: "qa", p0: 0.7, pred: 0, at: 1, mine: 0, bits: 0.51 }]));
    window.dispatchEvent(new Event("insight:local-purge"));
    localStorage.setItem(LS, JSON.stringify([{ qid: "qa", p0: 0.7, pred: 0, at: 1, mine: 0, bits: 0.51 }]));
    expect(PATTERNS.meter().skill).toBe(0);
    expect(PATTERNS.meter().based).toBe(0);
  });
});
