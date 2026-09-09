// The bucket cap's discards are observable only if the trigger says so —
// `evictForNewBucket` (pure.ts) ran silently from the day it was written,
// and the first question with answers from 25 cities would have dropped
// cohort counts with no line anywhere (D398, ALGORITHM-REFLECTION §4.4).
//
// What these pin is the reporting contract the alert chain rests on, not
// the fold (pure.test.ts has that): the structured half carries
// `metric: "agg_evict"` — the selector apply-monitoring's METRICS entry
// filters on, held by check:monitoring rule 4 — plus the qid, kind, dim
// and bucket an operator needs; one line per discard, so the metric counts
// discards; and silence when the attempt discarded nothing.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "firebase-functions";
import { logBucketCaps } from "./v2";

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe("logBucketCaps", () => {
  it("says nothing when the fold discarded nothing", () => {
    logBucketCaps("daily-000", []);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs one WARNING per discard, with the metric field and the parts an operator acts on", () => {
    logBucketCaps("daily-007", [
      { kind: "evicted", dim: "city", bucket: "Junk0, NO", total: 1 },
      { kind: "refused", dim: "country", bucket: "PT", total: 0 },
    ]);
    expect(warn).toHaveBeenCalledTimes(2);
    const [msg1, fields1] = warn.mock.calls[0];
    expect(msg1).toContain("daily-007");
    expect(msg1).toContain("Junk0, NO");
    expect(fields1).toEqual({
      metric: "agg_evict", qid: "daily-007", kind: "evicted", dim: "city", bucket: "Junk0, NO", total: 1,
    });
    const [msg2, fields2] = warn.mock.calls[1];
    expect(msg2).toContain("refused");
    expect(fields2).toMatchObject({ metric: "agg_evict", kind: "refused", dim: "country", bucket: "PT", total: 0 });
  });
});
