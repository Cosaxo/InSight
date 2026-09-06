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
    items?: Record<string, { kind: string; qid: string; opt?: number; nOptions: number }>;
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
    expect(w).toEqual({ rows: [], hadEv: false, thin: false, weak: false, failed: false });
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
