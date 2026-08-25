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
import { breakdownFor } from "./v2";
import { BREAKDOWN_MAX_BUCKETS, type BreakdownCounts } from "./pure";
import { replayFold, newFold, foldAnswerInto, finishFold, docStamp, type ReplayAnswer } from "./replay";

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

  it("is NOT order-independent once a dimension hits the bucket cap, and says so", () => {
    // More distinct cities than the cap, each with one answer, so every
    // arrival past the cap evicts a one-answer bucket — and WHICH one
    // depends on arrival order. This is the limit replay.ts's header
    // documents; the test exists so nobody discovers it during an incident.
    const answers = Array.from({ length: BREAKDOWN_MAX_BUCKETS + 6 }, (_, i) =>
      answer(`u${i}`, 0, { city: `City${String(i).padStart(2, "0")}, NO` }),
    );
    const forward = replayFold(QID, answers);
    const backward = replayFold(QID, [...answers].reverse());

    // The plain counts never depend on order — only the breakdown does.
    expect(backward.counts).toEqual(forward.counts);
    expect(backward.total).toBe(forward.total);
    expect(Object.keys(backward.by.city).sort()).not.toEqual(Object.keys(forward.by.city).sort());

    // …and the outcome flags the dimension where that is true, so a report
    // cannot present a saturated rebuild as if it were exact.
    expect(forward.cappedDims).toContain("city");
    expect(Object.keys(forward.by.city).length).toBe(BREAKDOWN_MAX_BUCKETS);
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
