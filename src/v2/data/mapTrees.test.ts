// @vitest-environment jsdom
//
// The Map's v28 branch folds (§5, D207), pinned on their honesty rules:
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
  pulseVotes: vi.fn<(pid: string) => Record<string, number>>(() => ({})),
  // the roster's live source (D203): empty until the bank hydrates
  pulseQs: vi.fn((): { id: string; prompt: string; options: string[] }[] => []),
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
  // pulseQs belongs in this list for the same reason as the five below, and
  // was the one missing from it. `afterEach`'s clearAllMocks resets CALLS,
  // never return values, so the bank a later case installs with
  // mockReturnValue outlives it — and the empty-bank case then reads a
  // hydrated bank and fails claiming "votes alone leaf nothing" is false.
  // Only reachable out of declaration order; reproduced with
  // `--sequence.shuffle --sequence.seed=4242`.
  live.pulseQs.mockReturnValue([]);
  live.pulseVotes.mockReturnValue({});
  live.myVotes.mockReturnValue({});
  live.foresightLog.mockReturnValue(null);
  live.callQs.mockReturnValue([]);
  live.callOutcomes.mockReturnValue(null);
});
afterEach(() => vi.clearAllMocks());

describe("the pulse branch", () => {
  it("live: no roster until the bank hydrates — votes alone leaf nothing", () => {
    // roster() reads LIVE.pulseQs() (D203); an empty bank means there is
    // nothing to NAME, so the honest result is no leaves, not a nameless dot
    live.pulseVotes.mockReturnValue({ [dayKey(0)]: 2 });
    expect(pulseTree()).toEqual({ cats: [], nodes: [] });
  });

  it("live: an answered bank pulse leafs, distance = consistency", () => {
    live.pulseQs.mockReturnValue([
      { id: "pulse-pace", prompt: "What pace was today?", options: ["Crawling", "Dragging", "Steady", "Brisk", "Flying"] },
    ]);
    live.pulseVotes.mockReturnValue({ [dayKey(0)]: 2, [dayKey(1)]: 3 }); // optionIdx → steps 3 and 4
    const tree = pulseTree();
    expect(tree.nodes).toHaveLength(1);
    const n = tree.nodes[0];
    expect(n.id).toBe("pulse-pace");
    expect(n.qid).toBe("pulse-pace");
    expect(n.ans).toBe("Steady"); // today's answer, optionIdx 2 → step 3
    expect(n.note).toBe("2 in a row");
    expect(n.typ).toBeGreaterThan(0);
    expect(n.typ).toBeLessThan(0.2); // 2 of 21 scheduled days kept
  });

  it("demo: only the first pulse may leaf, and only once answered", () => {
    live.enabled = false;
    // nothing answered by the DEMO persona's own hand — but the design
    // history serves answered days, which is the demo's shipped furniture
    const tree = pulseTree();
    expect(tree.cats.map((c) => c.id)).toEqual(["pulse"]);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].id).toBe("pulse-pace"); // DEMO_ROSTER's first
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
    // …and the same fact where a CONSUMER can key on it. `maj` is false for
    // a sealed call and false for a missed one, and the Map's "rare take"
    // ring reads `maj`: without this flag it drew a call that has not been
    // judged with the same mark as one the reader got wrong.
    expect(b.sealed, "a sealed call is indistinguishable from a missed one").toBe(true);
    expect(a.sealed, "a graded call was marked sealed").toBe(false);
  });

  it("a voided outcome (nobody scored) stays sealed rather than judged", () => {
    live.callQs.mockReturnValue([call("call-a")]);
    live.myVotes.mockReturnValue({ "call-a": "0" });
    live.callOutcomes.mockReturnValue({ "call-a": { outcomeIdx: -1 } });
    const n = foreTree().nodes[0];
    expect(n.note).toBe("sealed — outcome pending");
    expect(n.typ).toBe(0.5);
    expect(n.sealed, "a voided outcome is not a judgement either").toBe(true);
  });
});

// ── the consumer of all this, asserted as source text ──
//
// The ring is one expression inside a className in a 1000-line spec module,
// with no seam to render it through, and the flags it must respect live in
// three different folds. So it is pinned the way the house pins this class
// (map-live-qid.test.jsx's `MS.mode`): by reading the line.
//
// WHAT WAS WRONG: `n.daily && !n.learn && !n.maj` drew the bold hollow ring
// — "you answered against the crowd" — on every Crossroads walk and every
// pulse leaf, neither of which folds a crowd majority at all (a pulse's
// `typ` is your own consistency), and on every SEALED call, whose `maj` is
// false because nothing has been judged yet. `fore` is deliberately NOT
// excluded: foreTree computes `maj` on purpose for reads (`d.pct >= 50`)
// and for graded calls, so a blind-spot read and a genuinely missed call
// keep their ring.
describe("the Map's rare-take ring", () => {
  it("is gated on the folds that actually compute a majority", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    // process.cwd() rather than import.meta.url: this runner does not hand
    // the module a file: URL, and `new URL(...)` throws on what it does.
    const src = readFileSync(join(process.cwd(), "src/v2/spec/map-tab.jsx"), "utf8");
    const m = /\(n\.daily && [^?]*\? ' is-rare'/.exec(src);
    expect(m, "the rare-take ring moved or was renamed — move this case with it").not.toBeNull();
    const cond = m![0];
    for (const flag of ["!n.learn", "!n.walk", "!n.pulse", "!n.sealed", "!n.maj"]) {
      expect(cond, `the ring stopped excluding ${flag}`).toContain(flag);
    }
    expect(cond, "the ring excluded the whole fore family, which does compute maj")
      .not.toContain("!n.fore");
  });
});
