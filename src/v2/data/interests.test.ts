// @vitest-environment jsdom
//
// Stated topic preferences (D128). Two kinds of case here, and the second
// kind is the more important one:
//
//   · the store behaves (three states, persistence, the purge);
//   · the store is only READ where it is allowed to be read.
//
// That second one is a source assertion rather than a behavioural test,
// which is unusual and deliberate. The constraint it holds — feed only,
// never the daily question and never the Mirror — cannot fail loudly. A
// Mirror quietly weighted toward the cohorts you like still renders a
// perfectly convincing screen; it just stops being a mirror. Nothing else
// in the suite would notice.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// A FRESH module per case. The store reads localStorage once at module
// scope (the shape data/mutes.ts uses), so a cached module would carry the
// previous test's weights — and the persistence case below is specifically
// about what a reload sees. `?t=<random>` looks like the obvious way to do
// this and is not: Vite parses the query as a loader and throws.
const load = async () => {
  vi.resetModules();
  return import("./interests");
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("the three states", () => {
  it("is NEUTRAL for a topic nobody has touched", async () => {
    const I = await load();
    expect(I.interestIn("sport")).toBe(0);
    expect(I.hasStated()).toBe(false);
  });

  it("states more and less, and reads them back", async () => {
    const I = await load();
    I.setInterest("sport", I.MORE);
    I.setInterest("tech", I.MUTED);
    expect(I.interestIn("sport")).toBe(1);
    expect(I.interestIn("tech")).toBe(-1);
    expect(I.statedInterests()).toEqual({ sport: 1, tech: -1 });
  });

  it("DELETES on neutral rather than storing a zero", async () => {
    // "I turned this back to normal" and "I never said anything" are the
    // same state. Storing them differently would show a topic as touched
    // in the panel after the user had undone it.
    const I = await load();
    I.setInterest("sport", I.MORE);
    I.setInterest("sport", I.NEUTRAL);
    expect(I.statedInterests()).toEqual({});
    expect(I.hasStated()).toBe(false);
  });

  it("persists, and drops a stored value that is not one of the three", async () => {
    const I = await load();
    I.setInterest("food", I.MUTED);
    localStorage.setItem(
      "insight.topicInterest.v1",
      JSON.stringify({ ...JSON.parse(localStorage.getItem("insight.topicInterest.v1") || "{}"), music: 0.7 }),
    );
    const I2 = await load();
    expect(I2.interestIn("food")).toBe(-1);
    // 0.7 came from a version that meant something else; rounding it
    // would invent a preference the user never stated.
    expect(I2.interestIn("music")).toBe(0);
  });

  it("resets, and notifies subscribers", async () => {
    const I = await load();
    let beats = 0;
    const off = I.subscribeInterests(() => { beats++; });
    I.setInterest("sport", I.MORE);
    I.resetInterests();
    off();
    expect(I.hasStated()).toBe(false);
    expect(beats).toBe(2);
    // A no-op set does not wake the tree.
    const before = beats;
    I.setInterest("sport", I.NEUTRAL);
    expect(beats).toBe(before);
  });

  it("clears on the local purge without re-creating its key (D51)", async () => {
    // The real purge removes every `insight.` key and THEN dispatches
    // (live.ts purgeLocalTrace), so the test does both — dispatching
    // alone would be testing a sequence that never happens. The property
    // that matters is the second half: the listener must not save(), or
    // it writes the key straight back after the wipe removed it.
    const I = await load();
    I.setInterest("sport", I.MORE);
    expect(localStorage.getItem("insight.topicInterest.v1")).not.toBeNull();
    localStorage.removeItem("insight.topicInterest.v1");
    window.dispatchEvent(new Event("insight:local-purge"));
    expect(I.hasStated()).toBe(false);
    expect(localStorage.getItem("insight.topicInterest.v1")).toBeNull();
  });
});

describe("applyInterests", () => {
  interface Card { id: string; cat: string | null }
  const pool: Card[] = [
    { id: "a", cat: "sport" }, { id: "b", cat: "tech" },
    { id: "c", cat: "food" }, { id: "d", cat: null },
  ];
  const topicOf = (x: Card) => x.cat;

  it("drops muted topics and moves 'more' forward", async () => {
    const I = await load();
    I.setInterest("tech", I.MUTED);
    I.setInterest("food", I.MORE);
    expect(I.applyInterests(pool, topicOf).map((x: Card) => x.id)).toEqual(["c", "a", "d"]);
  });

  it("is a STABLE partition, not a sort", async () => {
    // Two 'more' topics keep their original order relative to each other,
    // and so does everything else. A comparator on the weight would let a
    // preference silently re-rank a pool whose order already carries
    // meaning — freshness, and the lens-card cadence.
    const I = await load();
    I.setInterest("sport", I.MORE);
    I.setInterest("food", I.MORE);
    expect(I.applyInterests(pool, topicOf).map((x: Card) => x.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("keeps an untagged card whatever is stated", async () => {
    // An untagged card is not evidence of anything, and dropping it would
    // let a content bug read as a user preference.
    const I = await load();
    I.setInterest("sport", I.MUTED);
    I.setInterest("tech", I.MUTED);
    I.setInterest("food", I.MUTED);
    expect(I.applyInterests(pool, topicOf).map((x: Card) => x.id)).toEqual(["d"]);
  });

  it("returns the pool untouched when nothing is stated", async () => {
    const I = await load();
    expect(I.applyInterests(pool, topicOf).map((x: Card) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("where it may be read — the constraint that cannot fail loudly", () => {
  // Every source file that imports data/interests, found rather than
  // listed, so a new reader appears here without anyone remembering to
  // add it.
  const root = resolve(__dirname, "../../..");
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
    }
    return out;
  };

  it("is read only by the feed, its own panel, and its own tests", () => {
    const readers = walk(join(root, "src"))
      // The module itself, and test files: a test reading the thing it
      // tests says nothing about where the app reads it.
      .filter((p) => !p.endsWith("interests.ts") && !/\.test\./.test(p))
      .filter((p) => /from ["'][^"']*data\/interests["']|from ["']\.\/interests/.test(readFileSync(p, "utf8")))
      .map((p) => p.slice(root.length + 1).replace(/\\/g, "/"))
      .sort();

    // The allowlist. Adding a Mirror or daily-question module here should
    // feel wrong, because it is: the feed may adapt to what you asked
    // for, and the one blind question a day may not — it is the same
    // question for everyone, which is what makes the populations
    // comparable at all.
    const ALLOWED = [
      "src/v2/data/live.ts",            // buildFeedGlobals, the feed pool
      "src/v2/ui/LiveInterestsPanel.tsx",
    ];
    expect(readers).toEqual(ALLOWED);
  });
});
