// @vitest-environment jsdom
//
// "Your asks, newest first" — the ORDER, which is the only thing that list
// promises and the one thing it did not do.
//
// agoOf renders three different units: 'just now', '{n}h' and '{n}d'. The
// comparator read the bare integer out of whichever string it got, so 23h
// (23) sorted behind 9d (9), and any hours-old ask sorted behind any
// days-old ask with a smaller number. Since D288 §1 retired the community
// board this is the ONLY list the paid door draws, so the row a buyer has
// just submitted — and is looking for — was the one most likely to be
// pushed to the bottom.
//
// Driven through the DEMO path, which is the one that reaches the string
// parser: a live row carries `atMs` and is ordered by it exactly.

import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.unstubAllEnvs();
});

async function store(rows) {
  vi.stubEnv("VITE_V2_LIVE", "");
  // The saved rows are read at MODULE EVAL, so they have to be in place
  // before the import — the follow-seeds harness pattern. `mine()` prefers
  // them over the demo table, and they are the shape a locally-composed
  // ask lands in.
  localStorage.setItem("insight.suggestions.v1", JSON.stringify({ mine: rows }));
  vi.resetModules();
  return (await import("../spec/suggestions.js")).SUGGESTIONS;
}

describe("the door's own list is ordered by time, not by digits", () => {
  it("puts hours before days, whatever the numbers read", async () => {
    const S = await store([
      { id: "a", prompt: "nine days", ago: "9d", status: "review" },
      { id: "b", prompt: "twenty-three hours", ago: "23h", status: "review" },
      { id: "c", prompt: "two hours", ago: "2h", status: "review" },
      { id: "d", prompt: "three days", ago: "3d", status: "review" },
    ]);
    const order = S.mine().map((s) => s.id);
    expect(order, "hours sorted behind days because 23 > 9").toEqual(["c", "b", "d", "a"]);
  });

  it("keeps a brand-new ask at the top", async () => {
    // The case a buyer actually notices: they submit, and the row they came
    // back for has to be the first one.
    const S = await store([
      { id: "old", prompt: "last week", ago: "6d", status: "review" },
      { id: "new", prompt: "just submitted", ago: "just now", status: "review" },
    ]);
    expect(S.mine()[0].id).toBe("new");
  });
});
