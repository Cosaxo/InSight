// @vitest-environment jsdom
//
// The Map's v28 branch folds (§5, D202), pinned on their honesty rules:
//
//   1. Every leaf is real — a pulse leaf needs an answered day, a read
//      leaf a graded verdict, a call leaf a call you actually made — and
//      an empty branch is an empty tree, never a hub with nothing in it.
//   2. A call whose outcome has not published is SEALED (typ 0.5, said in
//      words), because "waiting" and "wrong" are different claims.
//   3. The demo leafs only the first pulse (D166 §3's rule) and no
//      Foresight at all — there is no honest demo log.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const live = vi.hoisted(() => ({
  enabled: true,
  pulseVotes: vi.fn<(qid: string) => Record<string, number>>(() => ({})),
  anchors: () => ({}),
  subscribe: () => () => {},
  votePulse: vi.fn(),
  myVotes: vi.fn((): Record<string, string> => ({})),
  foresightLog: vi.fn((): Record<string, unknown> | null => null),
  callQs: vi.fn((): unknown[] => []),
  callOutcomes: vi.fn((): Record<string, { outcomeIdx: number } | null> | null => null),
}));
vi.mock("./live", () => ({ default: live }));
vi.mock("../../lib/firebase", () => ({ getDb: vi.fn(), getFirestoreApi: vi.fn() }));

import { foreTree, pulseTree } from "./mapTrees";
import { PULSE } from "./pulse";

const dayKey = (back: number): string => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new Event("insight:local-purge")); // the pulse store's own reset
  live.enabled = true;
  live.pulseVotes.mockReturnValue({});
  live.myVotes.mockReturnValue({});
  live.foresightLog.mockReturnValue(null);
  live.callQs.mockReturnValue([]);
  live.callOutcomes.mockReturnValue(null);
});
afterEach(() => vi.clearAllMocks());

describe("the pulse branch", () => {
  it("live: leafs only pulses with an answered day, distance = consistency", () => {
    // live templates have not loaded in this harness — ready() is false —
    // so the honest result is NO leaves, not a nameless dot
    live.pulseVotes.mockReturnValue({ [dayKey(0)]: 2 });
    expect(pulseTree()).toEqual({ cats: [], nodes: [] });
  });

  it("demo: only the first pulse may leaf, and only once answered", () => {
    live.enabled = false;
    // nothing answered by the DEMO persona's own hand — but the design
    // history serves answered days, which is the demo's shipped furniture
    const tree = pulseTree();
    expect(tree.cats.map((c) => c.id)).toEqual(["pulse"]);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].id).toBe("pulse-" + PULSE.ROSTER[0].qid);
    expect(tree.nodes[0].pulse).toBe(true);
    expect(tree.nodes[0].typ).toBeGreaterThan(0);
    expect(tree.nodes[0].typ).toBeLessThan(1);
  });
});

describe("the Foresight branch", () => {
  const call = (id: string, prompt = id) => ({ id, prompt, options: ["Yes", "No"] });

  it("demo: no honest log, no branch", () => {
    live.enabled = false;
    expect(foreTree()).toEqual({ cats: [], nodes: [] });
  });

  it("reads leaf per graded dimension, accuracy as distance", () => {
    live.foresightLog.mockReturnValue({
      a: { id: "a", qid: "q1", dim: "age", bucket: "30s", guess: 0, correct: true, at: 1 },
      b: { id: "b", qid: "q2", dim: "age", bucket: "20s", guess: 1, correct: false, at: 2 },
      c: { id: "c", qid: "q3", dim: "edu", bucket: "uni", guess: 0, correct: true, at: 3 },
    });
    const tree = foreTree();
    expect(tree.cats.map((c) => c.id)).toEqual(["fore-reads"]);
    const age = tree.nodes.find((n) => n.id === "fore-read-age")!;
    expect(age.ans).toBe("1/2");
    expect(age.typ).toBeCloseTo(0.5, 5);
    expect(age.note).toBe("early days"); // 2 < 5 plays — no verdict yet
    const edu = tree.nodes.find((n) => n.id === "fore-read-edu")!;
    expect(edu.ans).toBe("1/1");
  });

  it("a made call is a leaf; ungraded stays SEALED, graded gets scored", () => {
    live.callQs.mockReturnValue([call("call-a"), call("call-b"), call("call-c")]);
    live.myVotes.mockReturnValue({ "call-a": "0", "call-b": "1" }); // call-c never made
    live.callOutcomes.mockReturnValue({ "call-a": { outcomeIdx: 0 }, "call-b": null });
    const tree = foreTree();
    expect(tree.cats.map((c) => c.id)).toEqual(["fore-calls"]);
    expect(tree.nodes.map((n) => n.id).sort()).toEqual(["fore-call-call-a", "fore-call-call-b"]);
    const a = tree.nodes.find((n) => n.id === "fore-call-call-a")!;
    expect(a.note).toBe("called it");
    expect(a.typ).toBe(0.9);
    const b = tree.nodes.find((n) => n.id === "fore-call-call-b")!;
    expect(b.note).toBe("sealed — outcome pending");
    expect(b.typ).toBe(0.5);
  });

  it("a voided outcome (nobody scored) stays sealed rather than judged", () => {
    live.callQs.mockReturnValue([call("call-a")]);
    live.myVotes.mockReturnValue({ "call-a": "0" });
    live.callOutcomes.mockReturnValue({ "call-a": { outcomeIdx: -1 } });
    const n = foreTree().nodes[0];
    expect(n.note).toBe("sealed — outcome pending");
    expect(n.typ).toBe(0.5);
  });
});
