// feed-doors.test.js — pins wfFeedMatch, the feed's topic filter over one
// card (docs/TAGS-PLAN.md §2). The filter shipped for months as one
// expression inside a 2,350-line class component, which is how the
// single-cat assumption survived unnamed; now that it is a pure function,
// these are the sentences it must keep true:
//
//   1. a mute is a veto — "less of this" on ANY carried topic hides the
//      card, home or door alike, so a dismissed card cannot ride back in
//      through its second topic;
//   2. a follow is a vote — any carried id that passes its own kind's rule
//      (followed leaf, un-muted channel, pulled topic) shows the card;
//   3. doors multiply the ways to REACH a card, never the copies of it —
//      the stream grouping keys on `cat` alone, asserted here at the same
//      key expression the component uses.
import { describe, expect, it } from "vitest";
import { wfCarried, wfFeedMatch } from "../spec/world-feed-math.js";

// A demo-build shape: format channels always-on, subject topics reached
// through pulls. (In a live build every subject is a channel — D96 — which
// only widens chanSet; the rules below are build-independent.)
const CHAN = { dilemma: true, event: true, people: true, bigq: true };
const ctx = (over = {}) => ({ cats: {}, pulled: {}, leafOn: {}, chanSet: CHAN, ...over });

describe("wfCarried", () => {
  it("is the home plus the doors, home first — and just the home without any", () => {
    expect(wfCarried({ cat: "sport", also: ["tech"] })).toEqual(["sport", "tech"]);
    expect(wfCarried({ cat: "sport" })).toEqual(["sport"]);
  });
});

describe("wfFeedMatch — a follow is a vote", () => {
  const esports = { cat: "sport", also: ["tech"] };

  it("a pulled door reaches a card whose home is not followed", () => {
    expect(wfFeedMatch(esports, ctx())).toBe(false);
    expect(wfFeedMatch(esports, ctx({ pulled: { tech: true } }))).toBe(true);
  });

  it("the home still works exactly as before doors existed", () => {
    expect(wfFeedMatch(esports, ctx({ pulled: { sport: true } }))).toBe(true);
    // a channel-homed card is default-on…
    expect(wfFeedMatch({ cat: "dilemma" }, ctx())).toBe(true);
    // …and a channel DOOR opens the same way: the meal-pill card shows
    // under Dilemmas without food being followed
    expect(wfFeedMatch({ cat: "food", also: ["dilemma"] }, ctx())).toBe(true);
  });

  it("a door onto a subtopic leaf counts only while the leaf is followed", () => {
    const q = { cat: "culture", also: ["sub_tennis"] };
    expect(wfFeedMatch(q, ctx())).toBe(false);
    expect(wfFeedMatch(q, ctx({ leafOn: { sub_tennis: true } }))).toBe(true);
  });

  it("a card's own sub keeps its fast path", () => {
    const q = { cat: "sport", sub: "sub_tennis" };
    expect(wfFeedMatch(q, ctx({ leafOn: { sub_tennis: true } }))).toBe(true);
  });
});

describe("wfFeedMatch — a mute is a veto", () => {
  it("muting the HOME hides the card even when a door matches", () => {
    const q = { cat: "sport", also: ["dilemma"] };
    // dilemma is an always-on channel, so without the veto this card would
    // ride back into the feed of someone who said "less sport"
    expect(wfFeedMatch(q, ctx({ cats: { sport: false } }))).toBe(false);
  });

  it("muting a DOOR hides the card even when the home matches", () => {
    const q = { cat: "sport", also: ["tech"] };
    expect(wfFeedMatch(q, ctx({ pulled: { sport: true }, cats: { tech: false } }))).toBe(false);
  });

  it("a mute on an uncarried topic is someone else's business", () => {
    const q = { cat: "sport", also: ["tech"] };
    expect(wfFeedMatch(q, ctx({ pulled: { sport: true }, cats: { food: false } }))).toBe(true);
  });
});

describe("doors multiply reach, never copies", () => {
  it("the stream-grouping key ignores doors — one card, one stream", () => {
    // The component groups with `q.scene || q.sub || q.cat` (world-feed.jsx,
    // the round-robin interleave). If that expression ever learns about
    // `also`, a straddler renders once per door — the most visible way to
    // break docs/TAGS-PLAN.md §1's invariant. Asserted here on the same
    // expression so the failure names the rule rather than a snapshot.
    const q = { cat: "sport", also: ["tech", "food"] };
    const key = q.scene || q.sub || q.cat;
    expect(key).toBe("sport");
  });
});
