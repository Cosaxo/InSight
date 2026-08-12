// @vitest-environment jsdom
//
// The other half of scripts/check-purge-listeners.mjs: the scan proves a
// store REGISTERS for `insight:local-purge`; these cases prove what the
// listeners DO. Each store is driven through the resurrection scenario the
// event exists to prevent (D50/D51):
//
//   1. seed    — mutate through the public API; the insight.* key exists;
//   2. purge   — remove every insight.* key and dispatch the event,
//                exactly what purgeLocalTrace (data/live.ts) does;
//   3. fresh   — the store reads as fresh-boot and, critically, has NOT
//                written its key back (a save() in a listener would
//                re-create what the purge deleted);
//   4. remutate — one new-account mutation persists ONLY the new data.
//
// Step 4 is the bug itself: before the listeners, every one of these
// stores spread its surviving in-memory map into that save, resurrecting
// the previous account's data under the new uid.
//
// The lens store's cases live in lens-live.test.ts (it grew the first
// listener); world-feed's and daily-split's component listeners are
// covered in smoke-live.test.jsx, where a mounted tree exists to assert
// on. This file covers the module-scope stores.
import { beforeEach, describe, expect, it } from "vitest";
import "../spec/feed-read.js";
import "../spec/follows.js";
import "../spec/learn-feed.js";
import "../spec/test-definitions.js";
import "../spec/passive-progress.js";
import "../spec/pick-data.js";
import "../spec/place-stats.js";
import "../spec/world-subtopics.js";
import "../spec/suggestions.js";
import "../spec/world-feed-report.js";
// Named imports from untyped .js spec modules — the suppressions are
// scoped to exactly that (TS7016); the .jsx suites import these freely.
// @ts-expect-error TS7016 — untyped spec module
import { FRIENDS } from "../spec/follows.js";
// @ts-expect-error TS7016 — untyped spec module
import { DAILYQ } from "../spec/daily-questions.js";
// @ts-expect-error TS7016 — untyped spec module
import { DUELS } from "../spec/duels-data.js";
// @ts-expect-error TS7016 — untyped spec module
import { IS_DATA } from "../spec/sample-data.js";
// test-definitions left the global bridge (#85): the mirror and its persist
// are named exports now, no window aliases remain.
// @ts-expect-error TS7016 — untyped spec module
import { IS_TEST_RESULTS, persistTestResult } from "../spec/test-definitions.js";
// …as is passive-progress since the same conversion sweep.
// @ts-expect-error TS7016 — untyped spec module
import { PASSIVE } from "../spec/passive-progress.js";
// …and scenes since D106.
// @ts-expect-error TS7016 — untyped spec module
import { SCENES } from "../spec/scenes.js";
// …and the Learn pair since D107.
// @ts-expect-error TS7016 — untyped spec module
import { LEARN } from "../spec/learn-progress.js";
// @ts-expect-error TS7016 — untyped spec module
import { LEARN_CARDS } from "../spec/learn-data.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- the spec layer's
   window surface is untyped by design; these tests drive it as consumers do */
const W = window as any;

// Exactly purgeLocalTrace's behaviour: remove every insight.* key, then
// announce it.
function purge() {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("insight.")) doomed.push(k);
  }
  doomed.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event("insight:local-purge"));
}

const stored = (k: string) => localStorage.getItem(k);

// Every case starts from a purged world — which also proves the listeners
// are idempotent, since each test fires them again.
beforeEach(() => {
  purge();
});

describe("module stores drop their memory on the purge (D51)", () => {
  it("FEEDREAD: the read-room log", () => {
    W.FEEDREAD.log("purge-w-1", { maj: true });
    expect(W.FEEDREAD.stats().n).toBe(1);
    expect(stored("insight.readRoom.v1")).toContain("purge-w-1");
    purge();
    expect(W.FEEDREAD.stats().n).toBe(0);
    expect(stored("insight.readRoom.v1")).toBeNull();
    W.FEEDREAD.log("purge-w-2", { maj: false });
    expect(stored("insight.readRoom.v1")).toContain("purge-w-2");
    expect(stored("insight.readRoom.v1")).not.toContain("purge-w-1");
  });

  it("FRIENDS: the circle returns to its seed", () => {
    FRIENDS.unfriend("f1");
    expect(FRIENDS.list()).not.toContain("f1");
    purge();
    expect(FRIENDS.list()).toContain("f1"); // fresh-boot seed restored
    expect(stored("insight.friends.v1")).toBeNull();
    FRIENDS.invite("purge-p");
    const after = JSON.parse(stored("insight.friends.v1")!);
    expect(after.friends).toContain("f1"); // the unfriend did not survive
    expect(Object.keys(after.invited)).toEqual(["purge-p"]);
  });

  it("LEARN: the mastery map", () => {
    const cards = LEARN_CARDS as { id: string }[];
    LEARN.answer(cards[0].id, 0);
    expect(stored("insight.learn.v3")).toContain(cards[0].id);
    purge();
    expect(stored("insight.learn.v3")).toBeNull();
    LEARN.answer(cards[1].id, 0);
    const after = stored("insight.learn.v3")!;
    expect(after).toContain(cards[1].id);
    expect(JSON.parse(after).c[cards[0].id]).toBeUndefined();
  });

  it("LEARN_FEED: the frequency setting", () => {
    W.LEARN_FEED.setFreq("lots");
    expect(stored("insight.learnFreq.v1")).toBe("lots");
    purge();
    expect(W.LEARN_FEED.freq()).toBe("some");
    expect(stored("insight.learnFreq.v1")).toBeNull();
  });

  it("PASSIVE: test progress does not inflate the next account's rings", () => {
    const base = PASSIVE.passiveDone("values");
    PASSIVE.record({ id: "purge-tq-1", test: "values" });
    expect(PASSIVE.passiveDone("values")).toBe(base + 1);
    purge();
    expect(PASSIVE.passiveDone("values")).toBe(base);
    expect(stored("insight.passive.v1")).toBeNull();
    PASSIVE.record({ id: "purge-tq-2", test: "values" });
    const after = stored("insight.passive.v1")!;
    expect(after).toContain("purge-tq-2");
    expect(after).not.toContain("purge-tq-1");
  });

  it("PICKS: catalogue picks", () => {
    W.PICKS.pick("purge-q", 25);
    expect(W.PICKS.my("purge-q")).toBe(25);
    purge();
    expect(W.PICKS.my("purge-q")).toBeNull();
    expect(stored("insight.picks.v1")).toBeNull();
    W.PICKS.pick("purge-q2", 6);
    const after = stored("insight.picks.v1")!;
    expect(after).toContain("purge-q2");
    expect(after).not.toContain("purge-q\"");
  });

  it("PLACESTATS: place ratings", () => {
    W.PLACESTATS.rate("city", "nature", 9);
    expect(W.PLACESTATS.myScore("city", "nature")).toBe(9);
    purge();
    expect(W.PLACESTATS.myScore("city", "nature")).toBeNull();
    W.PLACESTATS.rate("city", "food", 5);
    const after = stored("insight.placeRatings.v1")!;
    expect(after).toContain("city:food");
    expect(after).not.toContain("city:nature");
  });

  it("SCENES: the follow list returns to the sample default", () => {
    const dflt = (IS_DATA.groups || []).filter((g: any) => g.joined).map((g: any) => g.id).sort();
    SCENES.follow("purge-scene");
    expect(SCENES.has("purge-scene")).toBe(true);
    purge();
    expect(SCENES.has("purge-scene")).toBe(false);
    expect(SCENES.list().sort()).toEqual(dflt);
    expect(stored("insight.scenes.v1")).toBeNull();
    SCENES.follow(dflt[0]); // idempotent follow persists defaults + itself
    expect(stored("insight.scenes.v1")).not.toContain("purge-scene");
  });

  it("SUBTOPICS: leaf follows return to the day-one default", () => {
    W.SUBTOPICS.unfollow("sub_tennis");
    expect(W.SUBTOPICS.has("sub_tennis")).toBe(false);
    purge();
    expect(W.SUBTOPICS.has("sub_tennis")).toBe(true); // default restored
    expect(stored("insight.subtopics.v1")).toBeNull();
    W.SUBTOPICS.follow("sub_football");
    expect(stored("insight.subtopics.v1")).toContain("sub_tennis"); // the unfollow did not survive
  });

  it("SUGGESTIONS: authored questions stop rendering as the new account's 'You'", () => {
    W.SUGGESTIONS.submit({ prompt: "purge-sentinel-question", type: "binary", options: ["a", "b"] });
    expect(W.SUGGESTIONS.counts().mine).toBe(1);
    purge();
    expect(W.SUGGESTIONS.counts().mine).toBe(0);
    expect(stored("insight.suggestions.v1")).toBeNull();
    W.SUGGESTIONS.toggleVote("sg01");
    const after = stored("insight.suggestions.v1")!;
    expect(after).toContain("sg01");
    expect(after).not.toContain("purge-sentinel-question");
  });

  it("DUELS: duel answers and social edits", () => {
    DUELS.answerDuo("purge-p", { a: 1 });
    expect(DUELS.myDuo("purge-p").a).toBe(1);
    purge();
    expect(DUELS.myDuo("purge-p").a).toBeUndefined();
    expect(stored("insight.duels.v1")).toBeNull();
    DUELS.answerDuo("purge-p2", { a: 0 });
    const after = stored("insight.duels.v1")!;
    expect(after).toContain("purge-p2");
    expect(after).not.toContain("purge-p\"");
  });

  it("WF_REPORT: the report history", () => {
    W.WF_REPORT.report("purge-take", "Spam");
    expect(W.WF_REPORT.has("purge-take")).toBe(true);
    purge();
    expect(W.WF_REPORT.has("purge-take")).toBe(false);
    expect(stored("insight.reports.v1")).toBeNull();
    W.WF_REPORT.report("purge-take2", "Spam");
    expect(stored("insight.reports.v1")).not.toContain("purge-take\"");
  });

  it("DAILYQ: daily answers and branch overrides", () => {
    DAILYQ.answer("purge-dq", 1);
    expect(stored("insight.dailyq.v1")).toContain("purge-dq");
    purge();
    expect(stored("insight.dailyq.v1")).toBeNull();
    expect(stored("insight.dailyq.cat.v1")).toBeNull();
    DAILYQ.answer("purge-dq2", 0);
    const after = stored("insight.dailyq.v1")!;
    expect(after).toContain("purge-dq2");
    expect(after).not.toContain("purge-dq\"");
  });

  it("IS_TEST_RESULTS: the mirror restores the pristine demo seed", () => {
    // The fresh-boot state of this object is the demo literal plus an
    // empty saved overlay — not an empty object — so the listener must
    // restore, not clear (test-definitions.js says why).
    const demoBig5 = JSON.stringify(IS_TEST_RESULTS.big5);
    persistTestResult("values", { title: "V", taken: "now", dims: [], sentinel: "purge-zz" });
    expect(IS_TEST_RESULTS.values.sentinel).toBe("purge-zz");
    expect(stored("insight.testResults.v2")).toContain("purge-zz");
    purge();
    expect(IS_TEST_RESULTS.values?.sentinel).toBeUndefined();
    expect(JSON.stringify(IS_TEST_RESULTS.big5)).toBe(demoBig5);
    expect(stored("insight.testResults.v2")).toBeNull();
    // the persist path reads storage fresh, so the next save carries only
    // the new account's result
    persistTestResult("big5", { title: "B", taken: "now", dims: [] });
    expect(stored("insight.testResults.v2")).not.toContain("purge-zz");
  });
});
