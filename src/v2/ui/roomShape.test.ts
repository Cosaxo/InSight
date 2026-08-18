// The Near room's shape functions (D177).
//
// These are the seam between a server fold and three tabs that were all
// written for device-side aggregates, so what they mostly have to get
// right is the translation — and the two ways a translation can lie.
import { describe, expect, it } from "vitest";
import { roomQuestions, roomRows } from "./roomShape";
import type { LiveQuestion } from "../data/deck";

const q = (id: string, labels: string[]): LiveQuestion => ({
  id,
  cat: null,
  text: `Q ${id}`,
  dayLabel: "Today",
  options: labels.map((label, i) => ({ id: String(i), label, count: 0, color: "" })),
  comments: [],
  friends: [],
  live: true,
  noCountsYet: false,
  branch: "Mind",
  type: "binary",
} as unknown as LiveQuestion);

describe("roomQuestions", () => {
  it("reads the server's option map into a dense per-option array", () => {
    // The wire carries `{ "0": 3, "2": 1 }` — the same shape
    // v2_question_aggs uses, deliberately, so this walk is the one four
    // other surfaces already do.
    const out = roomQuestions([q("a", ["Yes", "No", "Both"])], { a: { "0": 3, "2": 1 } }, {});
    expect(out[0].counts).toEqual([3, 0, 1]);
  });

  it("keeps a question the room has not answered, at zero", () => {
    // Dropping it would make "nobody here has answered this" look like a
    // question that was never asked. It is a fact about the room and the
    // row is where it gets said.
    const out = roomQuestions([q("a", ["Yes", "No"])], {}, {});
    expect(out).toHaveLength(1);
    expect(out[0].counts).toEqual([0, 0]);
  });

  it("carries the viewer's own pick, and -1 when there isn't one", () => {
    // The Answers row marks your own pick in the room's split and prints
    // "62% of this room are with you" under it, and `mine` is the "you".
    // (It read Compare's sentence too until D193, when that lens stopped
    // folding option splits at all.) -1 rather than 0 for unanswered: 0 is
    // a real option index, and a viewer who never answered would otherwise
    // read as having picked the first one.
    const [answered, not] = roomQuestions(
      [q("a", ["Yes", "No"]), q("b", ["Yes", "No"])],
      {},
      { a: "1" },
    );
    expect(answered.mine).toBe(1);
    expect(not.mine).toBe(-1);
  });

  it("never invents a count for an option the server did not send", () => {
    // A malformed cell — a string, a null, a key past the option list —
    // has to read as zero rather than NaN. NaN in a counts array
    // propagates into every percentage the three tabs draw, and renders
    // as a blank rather than as an error.
    const out = roomQuestions(
      [q("a", ["Yes", "No"])],
      { a: { "0": "x" as unknown as number, "1": 2, "9": 5 } },
      {},
    );
    expect(out[0].counts).toEqual([0, 2]);
    expect(out[0].counts.every(Number.isFinite)).toBe(true);
  });

  it("gives Explore's baseline the room's own counts, since Explore is not here", () => {
    // `all` is the published globe on every cohort stop and is read by
    // exactly one lens. The room does not offer that lens, so this is the
    // room rather than a globe fetched to fill a field nothing looks at —
    // and it must not be a DIFFERENT crowd sitting in the shape a reader
    // could later wire up.
    const out = roomQuestions([q("a", ["Yes", "No"])], { a: { "0": 2 } }, {});
    expect(out[0].all).toEqual(out[0].counts);
  });
});

describe("roomRows", () => {
  it("sums each question's own n rather than sharing one across the tab", () => {
    // The Answers list prints "N answered" per row and its n=1 sentence
    // branches on it, so a shared total would make a question nobody here
    // answered claim the room's busiest one.
    const rows = roomRows(roomQuestions(
      [q("a", ["Yes", "No"]), q("b", ["Yes", "No"])],
      { a: { "0": 3, "1": 1 }, b: { "0": 1 } },
      {},
    ));
    expect(rows.map((r) => r.n)).toEqual([4, 1]);
  });
});
