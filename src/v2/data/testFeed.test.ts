import { afterEach, describe, expect, it } from "vitest";
import { publishTestFeed, resetTestFeed, testFeedPool } from "./testFeed";

const DEMO = [{ id: "tq-political-0", test: "political" }];
const LIVE = [{ id: "test-political-0", test: "political" }];

afterEach(() => {
  resetTestFeed();
});

describe("testFeedPool", () => {
  it("hands back the caller's demo pool until a live build publishes", () => {
    expect(testFeedPool(DEMO)).toBe(DEMO);
  });

  it("hands back the live pool once published", () => {
    publishTestFeed(LIVE);
    expect(testFeedPool(DEMO)).toBe(LIVE);
  });

  // The arm that shipped D279's defect in reverse: a live build whose bank
  // carries no test items must serve NOTHING, not fall through to the demo
  // pool. `livePool ?? demo` rather than `livePool || demo` is the whole
  // difference, and an empty array is exactly the state a fresh backend is
  // in — so the wrong operator would have looked correct in every fixture
  // that seeded items and wrong on the one bank that matters.
  it("serves an empty live pool as empty, never as the demo pool", () => {
    publishTestFeed([]);
    expect(testFeedPool(DEMO)).toEqual([]);
  });

  it("re-publishes over a previous pool", () => {
    publishTestFeed(LIVE);
    publishTestFeed([]);
    expect(testFeedPool(DEMO)).toEqual([]);
  });

  it("goes back to the demo pool on reset", () => {
    publishTestFeed(LIVE);
    resetTestFeed();
    expect(testFeedPool(DEMO)).toBe(DEMO);
  });
});
