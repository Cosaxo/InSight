// replay.test.ts — the gate that turns "the answers are the source of
// truth" from a design sentence into a property.
//
// WHAT IS ACTUALLY BEING PROVEN. `onV2AnswerCreated` accumulates
// INCREMENTALLY: it reads the stored aggregate, adds one answer, writes it
// back, once per answer, forever. `replayFold` accumulates in a BATCH from
// the answers themselves. Those are different code paths, and every
// projection change in the plan (sharding the hot document, moving the
// breakdown onto per-dimension documents) assumes they agree. If they ever
// stop agreeing, a rebuild silently replaces a correct aggregate with a
// wrong one — during an incident, which is the only time anybody runs it.
//
// The reference fold below is transcribed from v2.ts's vote arm and calls
// the SAME `breakdownFor` the trigger calls, so what this compares is the
// accumulation strategy rather than two copies of the anchor logic. A
// divergence here means replay counts, orders or skips differently — which
// is exactly the class of bug worth a gate.

import { describe, it, expect } from "vitest";
import { breakdownFor, CANON_TOP_N, CATALOG_DOMAINS } from "./v2";
import {
  BREAKDOWN_MAX_BUCKETS, foldRankOrder, validRankOrder, catalogEntityKey,
  foldCanonAnchors, canonTopN, canonBreakdownFor,
  type BreakdownCounts, type CanonCounts,
} from "./pure";
import {
  replayFold, newFold, foldAnswerInto, finishFold, docStamp, armFor, rebuildRefusal,
  newRankFold, foldRankAnswerInto, newCanonFold, foldCanonAnswerInto, canonPublishable,
  type ReplayAnswer,
} from "./replay";

const QID = "daily-2026-08-24";

/** The trigger's vote arm, one answer at a time, holding its own state the
 *  way the stored document does. */
function liveAccumulate(qid: string, answers: readonly ReplayAnswer[]) {
  let counts: Record<string, number> = {};
  let total = 0;
  let by: BreakdownCounts = {};
  for (const a of answers) {
    const optionIdx = a.optionIdx;
    if (typeof optionIdx !== "number" || optionIdx < 0 || optionIdx > 19) continue;
    counts = { ...counts };
    counts[String(optionIdx)] = (counts[String(optionIdx)] || 0) + 1;
    total += 1;
    by = breakdownFor(qid, by, a.anchors, optionIdx);
  }
  return { counts, total, by };
}

function answer(uid: string, optionIdx: unknown, extra: Record<string, unknown> = {}): ReplayAnswer {
  return {
    uid,
    optionIdx,
    anchors: { ageBand: "25-34", gender: "Woman", city: "Oslo, NO", country: "NO", ...extra },
  };
}

describe("replay equals the trigger's incremental fold", () => {
  it("agrees on counts, total and the breakdown over a mixed batch", () => {
    const answers: ReplayAnswer[] = [
      answer("u1", 0),
      answer("u2", 1, { city: "Bergen, NO", gender: "Man" }),
      answer("u3", 1, { ageBand: "35-44" }),
      answer("u4", 0, { city: "Paris, FR", country: "FR" }),
      answer("u5", 2, { gender: "Non-binary" }),
      answer("u6", 1),
    ];
    const live = liveAccumulate(QID, answers);
    const replayed = replayFold(QID, answers);

    expect(replayed.total).toBe(live.total);
    expect(replayed.counts).toEqual(live.counts);
    expect(replayed.by).toEqual(live.by);
    expect(replayed.folded).toBe(6);
  });

  it("agrees when the batch is folded page by page, as the scan does", () => {
    const answers = Array.from({ length: 37 }, (_, i) =>
      answer(`u${i}`, i % 3, { city: `City${i % 5}, NO` }),
    );
    const live = liveAccumulate(QID, answers);

    // The callable folds each page into one accumulator rather than
    // materialising every answer — pin that this changes nothing.
    const state = newFold(QID);
    for (let i = 0; i < answers.length; i += 10) {
      for (const a of answers.slice(i, i + 10)) foldAnswerInto(state, a);
    }
    const paged = finishFold(state);

    expect(paged.total).toBe(live.total);
    expect(paged.counts).toEqual(live.counts);
    expect(paged.by).toEqual(live.by);
  });
});

describe("the commutativity the rebuild rests on", () => {
  it("is order-independent while no dimension is saturated", () => {
    const answers = Array.from({ length: 20 }, (_, i) =>
      answer(`u${i}`, i % 2, { city: `City${i % 6}, NO` }),
    );
    const forward = replayFold(QID, answers);
    const backward = replayFold(QID, [...answers].reverse());

    expect(backward.counts).toEqual(forward.counts);
    expect(backward.by).toEqual(forward.by);
    expect(forward.cappedDims).toEqual([]);
  });

  it("the HOT map is not order-independent at the cap, and says so — hot ∪ tail is, exactly (D388)", () => {
    // More distinct cities than the cap, each with one answer, so every
    // arrival past the cap evicts a one-answer bucket — and WHICH one
    // depends on arrival order. That was the limit replay.ts's header
    // documented; since D388 the evicted cell moves to the tail instead of
    // vanishing, so the two folds agree on every cell once both documents
    // are read, and the flag now warns that the hot map alone is partial.
    const answers = Array.from({ length: BREAKDOWN_MAX_BUCKETS + 6 }, (_, i) =>
      answer(`u${i}`, 0, { city: `City${String(i).padStart(2, "0")}, NO` }),
    );
    const forward = replayFold(QID, answers);
    const backward = replayFold(QID, [...answers].reverse());

    // The plain counts never depend on order — only the hot breakdown does.
    expect(backward.counts).toEqual(forward.counts);
    expect(backward.total).toBe(forward.total);
    expect(Object.keys(backward.by.city).sort()).not.toEqual(Object.keys(forward.by.city).sort());

    // …and the outcome flags the dimension where that is true, so a report
    // cannot present the hot map as if it were the whole dimension.
    expect(forward.cappedDims).toContain("city");
    expect(Object.keys(forward.by.city).length).toBe(BREAKDOWN_MAX_BUCKETS);

    // The union is order-independent and complete: every city, every
    // answer, each bucket in exactly one of the two.
    const union = (o: typeof forward) => {
      const out: Record<string, Record<string, number>> = {};
      const take = (buckets: Record<string, Record<string, number>> | undefined) => {
        for (const [b, cell] of Object.entries(buckets ?? {})) {
          expect(out[b], `${b} is in both the hot map and the tail`).toBeUndefined();
          out[b] = { ...cell };
        }
      };
      take(o.by.city);
      for (const shard of Object.values(o.tail)) take(shard.city);
      return out;
    };
    const f = union(forward);
    expect(union(backward)).toEqual(f);
    expect(Object.keys(f)).toHaveLength(BREAKDOWN_MAX_BUCKETS + 6);
    expect(Object.values(f).reduce((a, c) => a + Object.values(c).reduce((x, y) => x + y, 0), 0)).toBe(forward.total);
    expect(Object.keys(forward.tail).length).toBeGreaterThan(0);
  });

  it("no dimension under the cap ever writes a tail", () => {
    const answers = Array.from({ length: 20 }, (_, i) => answer(`u${i}`, i % 2, { city: `City${i % 6}, NO` }));
    expect(replayFold(QID, answers).tail).toEqual({});
  });
});

describe("what a rebuild is FOR", () => {
  it("subtracts a ring by rebuilding without it (D28)", () => {
    const honest = [answer("u1", 0), answer("u2", 1), answer("u3", 1)];
    const ring = [answer("bot1", 1), answer("bot2", 1), answer("bot3", 1)];
    const polluted = replayFold(QID, [...honest, ...ring]);
    const repaired = replayFold(QID, [...honest, ...ring], new Set(["bot1", "bot2", "bot3"]));

    expect(polluted.counts).toEqual({ "0": 1, "1": 5 });
    expect(repaired.counts).toEqual({ "0": 1, "1": 2 });
    expect(repaired.total).toBe(3);
    expect(repaired.excluded).toBe(3);
    // The excluded answers leave the breakdown too, not just the headline.
    expect(repaired.by.city["Oslo, NO"]).toEqual({ "0": 1, "1": 2 });
  });

  it("skips a malformed index instead of throwing the whole scan away", () => {
    const out = replayFold(QID, [
      answer("u1", 0),
      answer("u2", "one"),
      answer("u3", -1),
      answer("u4", 20),
      answer("u5", 19),
    ]);
    expect(out.folded).toBe(2);
    expect(out.skipped).toBe(3);
    expect(out.counts).toEqual({ "0": 1, "19": 1 });
  });
});

describe("the concurrency guard's stamp", () => {
  // Not the interleaving — that needs two writers racing a live scan and is
  // NOT covered by an automated test here; what is covered is the property
  // a wrong implementation would get wrong, and the e2e's 7h proves the
  // other direction (a quiet document does not abort a rebuild).
  const snap = (exists: boolean, seconds?: number, nanoseconds?: number) =>
    ({
      exists,
      updateTime: seconds === undefined ? undefined : { seconds, nanoseconds },
    }) as unknown as Parameters<typeof docStamp>[0];

  it("is null for a document that does not exist", () => {
    expect(docStamp(snap(false))).toBeNull();
    // …and an absent document is never equal to a present one, which is the
    // create case: a rebuild of a question whose aggregate appeared mid-scan
    // must abort rather than overwrite it.
    expect(docStamp(snap(false))).not.toBe(docStamp(snap(true, 100, 0)));
  });

  it("separates two writes one nanosecond apart", () => {
    // THE REASON THIS TEST EXISTS. `updateTime.toMillis()` is the obvious
    // implementation and it collides here — two folds inside one
    // millisecond is not a hypothetical, it is D7's contention case, i.e.
    // exactly the situation someone runs a rebuild in.
    expect(docStamp(snap(true, 1_700_000_000, 123_456_789)))
      .not.toBe(docStamp(snap(true, 1_700_000_000, 123_456_790)));
    // Same instant, same stamp — no false abort on a quiet document.
    expect(docStamp(snap(true, 1_700_000_000, 123_456_789)))
      .toBe(docStamp(snap(true, 1_700_000_000, 123_456_789)));
  });

  it("reports an unstamped document as unverifiable, not as unchanged", () => {
    // An earlier draft returned the string "unknown" here, which compares
    // EQUAL to itself — so an unstamped document read as "nothing changed"
    // and waved the write through, fail-open on the one path where the
    // guard can see nothing at all. `undefined` cannot be mistaken for a
    // match, and runRebuild refuses on it.
    expect(docStamp(snap(true))).toBeUndefined();
    expect(docStamp(snap(true))).not.toBe(docStamp(snap(true, 1, 1)));
  });
});

describe("which arm a question folds through", () => {
  // Decided by the QUESTION's type, not by sniffing the first answer —
  // rules admit one shape per type, so the question is the authority and a
  // stray answer of the wrong shape becomes an anomaly to report rather
  // than an arm to silently switch to.
  it("routes catalog and rank by name, and everything else to the vote fold", () => {
    expect(armFor("catalog")).toBe("catalog");
    expect(armFor("rank")).toBe("rank");
    // The other twelve types in the bank all carry optionIdx.
    for (const t of ["binary", "choice", "vote", "scale", "rating", "dial",
      "dilemma", "pulse", "field", "path", "duel", "call"]) {
      expect(armFor(t), t).toBe("vote");
    }
    // An unknown or missing type folds as a vote rather than throwing: the
    // vote arm's own index guard then skips anything that is not a vote,
    // so the failure is a reported skip instead of a refused rebuild.
    expect(armFor(undefined)).toBe("vote");
    expect(armFor("something-new")).toBe("vote");
  });
});

describe("the surfaces a rebuild must refuse rather than report clean", () => {
  // The scan keys on the BANK ID. Two surfaces break that, and both used to
  // fail quietly rather than loudly.
  it("refuses pulse, whose aggregates are keyed per day", () => {
    // A pulse answer carries `{qid}_{day}` as its own qid, so the bank id
    // matches NO answer: the rebuild scanned zero rows, found zero drift and
    // reported success — which rebuild-aggregate.mjs prints as "the published
    // aggregate already matches the answers". Passing the composite instead
    // fails the bank lookup, so the day's aggregate has no address here at
    // all, and the honest answer is to say so.
    const why = rebuildRefusal("pulse");
    expect(why).toBeTruthy();
    expect(why).toMatch(/\{qid\}_\{day\}/);
  });

  it("refuses the duel surfaces, where a rebuild would MINT an aggregate", () => {
    // onV2AnswerCreated returns before the world fold for these, so there is
    // no aggregate to repair — only one to invent, out of votes that stay
    // sealed until their reveal.
    for (const s of ["group", "duo"]) {
      expect(rebuildRefusal(s), s).toMatch(/sealed duel votes/);
    }
  });

  it("permits every surface the vote arm actually mirrors", () => {
    // The control: without it the two cases above pass for a predicate that
    // refuses everything, which would take the tool out of service entirely.
    for (const s of ["daily", "feed", "test", "learn", "call"]) {
      expect(rebuildRefusal(s), s).toBeNull();
    }
    // A question with no surface field is not a reason to refuse — the arm
    // and the index guards below it decide what a stray answer does.
    expect(rebuildRefusal(undefined)).toBeNull();
    expect(rebuildRefusal("")).toBeNull();
  });
});

describe("the RANK arm (D233)", () => {
  const N = 4;
  /** The trigger's rank arm, one answer at a time. */
  function liveRank(orders: readonly unknown[]) {
    let pos = new Array<number>(N).fill(0);
    let total = 0;
    for (const o of orders) {
      const order = validRankOrder(o, N);
      if (order === null) continue;
      pos = [...pos];
      foldRankOrder(pos, order);
      total += 1;
    }
    return { pos, total };
  }

  it("agrees with the trigger's incremental accumulation", () => {
    const orders = [[2, 0, 1, 3], [3, 2, 1, 0], [0, 1, 2, 3]];
    const live = liveRank(orders);
    const state = newRankFold("feed-f03", N);
    for (const [i, o] of orders.entries()) foldRankAnswerInto(state, { uid: `u${i}`, order: o });
    expect(state.pos).toEqual(live.pos);
    expect(state.total).toBe(live.total);
  });

  it("is EXACTLY order-independent — the strongest of the three arms", () => {
    // Position sums are plain addition: commutative, associative, and with
    // nothing to evict. So unlike the vote arm above a saturated
    // dimension, a rank rebuild is not "a correct fold" — it is THE fold,
    // and this test is what lets the tool say so.
    const orders = [[2, 0, 1, 3], [3, 2, 1, 0], [0, 1, 2, 3], [1, 3, 0, 2]];
    const fwd = newRankFold("q", N);
    for (const [i, o] of orders.entries()) foldRankAnswerInto(fwd, { uid: `u${i}`, order: o });
    const rev = newRankFold("q", N);
    for (const [i, o] of [...orders].reverse().entries()) foldRankAnswerInto(rev, { uid: `u${i}`, order: o });
    expect(rev.pos).toEqual(fwd.pos);
    expect(rev.total).toBe(fwd.total);
  });

  it("drops a non-permutation instead of folding it, and subtracts a ring", () => {
    const state = newRankFold("q", N);
    foldRankAnswerInto(state, { uid: "u1", order: [0, 1, 2, 3] });
    foldRankAnswerInto(state, { uid: "u2", order: [0, 0, 1, 2] }); // duplicate index
    foldRankAnswerInto(state, { uid: "u3", order: [0, 1, 2] });    // wrong length
    foldRankAnswerInto(state, { uid: "bot", order: [3, 2, 1, 0] }, new Set(["bot"]));
    expect(state.folded).toBe(1);
    expect(state.skipped).toBe(2);
    expect(state.excluded).toBe(1);
    expect(state.total).toBe(1);
  });
});

describe("the CATALOG arm (D14/D17)", () => {
  const DOMAIN = "pokemon";
  const anchors = { ageBand: "25-34", gender: "Woman", city: "Oslo, NO", country: "NO" };

  /** The trigger's canon arm, one answer at a time. */
  function liveCanon(entities: readonly number[]) {
    const ent: CanonCounts = {};
    const entBy: BreakdownCounts = {};
    let total = 0;
    for (const e of entities) {
      const key = catalogEntityKey(e, CATALOG_DOMAINS[DOMAIN]);
      if (key === null) continue;
      ent[key] = (ent[key] || 0) + 1;
      total += 1;
      foldCanonAnchors(entBy, anchors, key);
    }
    const canon = canonTopN(ent, CANON_TOP_N);
    return { ent, entBy, total, top: canon.top, rest: canon.rest, by: canonBreakdownFor(entBy, canon.top) };
  }

  it("agrees with the trigger, accumulator and published board alike", () => {
    const entities = [25, 6, 25, 150, 6, 25, 1];
    const live = liveCanon(entities);
    const state = newCanonFold("pick-pk04", DOMAIN);
    for (const [i, e] of entities.entries()) {
      foldCanonAnswerInto(state, { uid: `u${i}`, entity: e, anchors });
    }
    expect(state.ent).toEqual(live.ent);
    expect(state.total).toBe(live.total);
    expect(state.entBy).toEqual(live.entBy);

    const board = canonPublishable(state);
    expect(board.top).toEqual(live.top);
    expect(board.rest).toBe(live.rest);
    expect(board.by).toEqual(live.by);
  });

  it("keeps the accumulator exact even where the board is a projection", () => {
    // The point of the private document: `ent` holds every entity, the
    // board holds the top N plus a scalar. A rebuild must reconstruct the
    // former, or the next answer folds from something it cannot fold from.
    const state = newCanonFold("q", DOMAIN);
    for (let i = 0; i < CANON_TOP_N + 5; i += 1) {
      // Descending popularity, so the tail is genuinely outside the board.
      for (let n = 0; n < CANON_TOP_N + 5 - i; n += 1) {
        foldCanonAnswerInto(state, { uid: `u${i}-${n}`, entity: i + 1, anchors });
      }
    }
    const board = canonPublishable(state);
    expect(Object.keys(state.ent).length).toBe(CANON_TOP_N + 5);
    expect(Object.keys(board.top).length).toBe(CANON_TOP_N);
    expect(board.rest).toBeGreaterThan(0);
    // …and the board still accounts for every answer.
    const onBoard = Object.values(board.top).reduce((a, b) => a + b, 0);
    expect(onBoard + board.rest).toBe(state.total);
  });

  it("refuses an unknown key and an unknown domain, and subtracts a ring", () => {
    const state = newCanonFold("q", DOMAIN);
    foldCanonAnswerInto(state, { uid: "u1", entity: 25, anchors });
    foldCanonAnswerInto(state, { uid: "u2", entity: 999999, anchors });  // past `max`
    foldCanonAnswerInto(state, { uid: "u3", entity: "pikachu", anchors }); // not an integer
    foldCanonAnswerInto(state, { uid: "bot", entity: 25, anchors }, new Set(["bot"]));
    expect(state.folded).toBe(1);
    expect(state.skipped).toBe(2);
    expect(state.excluded).toBe(1);
    expect(state.ent).toEqual({ "25": 1 });

    const unknown = newCanonFold("q", "not-a-domain");
    expect(foldCanonAnswerInto(unknown, { uid: "u", entity: 25, anchors })).toBe("skipped");
  });
});
