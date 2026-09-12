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
import { wfCarried, wfFeedMatch, wfStreamMix } from "../spec/world-feed-math.js";

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
  // This ran the grouping expression COPIED INTO THE TEST and asserted on
  // its own copy, which passes for any source — measured: teaching the
  // component's key about `also` left the whole suite green. The grouping
  // now lives in world-feed-math.js and these run it.
  it("a straddler appears once, however many doors it carries", () => {
    const straddler = { id: "s", cat: "sport", also: ["tech", "food"] };
    const mixed = wfStreamMix([straddler, { id: "t", cat: "tech" }]);
    expect(mixed.filter((q) => q.id === "s")).toHaveLength(1);
    expect(mixed).toHaveLength(2);
  });

  it("keeps every card exactly once across many streams", () => {
    // The general form, so the case above cannot be satisfied by a mix
    // that drops cards instead of duplicating them.
    const qs = [
      { id: "a", cat: "sport", also: ["tech"] },
      { id: "b", cat: "sport" },
      { id: "c", cat: "tech", also: ["sport", "food"] },
      { id: "d", cat: "food" },
      { id: "e", scene: "night", also: ["sport"] },
      { id: "f", cat: "tech", sub: "phones", also: ["sport"] },
    ];
    const mixed = wfStreamMix(qs);
    expect(mixed).toHaveLength(qs.length);
    expect(new Set(mixed.map((q) => q.id)).size).toBe(qs.length);
  });

  it("interleaves the streams rather than serving them in blocks", () => {
    // The other half of what the function is for: two cards from one
    // stream must not sit next to each other while another stream waits.
    const mixed = wfStreamMix([
      { id: "s1", cat: "sport" }, { id: "s2", cat: "sport" },
      { id: "t1", cat: "tech" }, { id: "t2", cat: "tech" },
    ]);
    expect(mixed.map((q) => q.id)).toEqual(["s1", "t1", "s2", "t2"]);
  });

  it("groups on the home topic, not on a door", () => {
    // A straddler and a card whose HOME is that door are different
    // streams, so they interleave rather than stacking.
    const mixed = wfStreamMix([
      { id: "a", cat: "sport", also: ["tech"] },
      { id: "b", cat: "sport", also: ["tech"] },
      { id: "c", cat: "tech" },
    ]);
    expect(mixed.map((q) => q.id)).toEqual(["a", "c", "b"]);
  });
});

describe("wfStreamMix's rotation — what makes a new sitting feel fresh", () => {
  // The sitting counter (data/feedSitting.ts) is this function's second
  // argument and its only new input. What the cases below hold is the
  // pair of properties everything downstream rests on: the order MOVES,
  // and the list is otherwise untouched.
  //
  // The second one is not a formality. The answered partition, the
  // weave's cadences and the paid places all count this list, so a
  // rotation that dropped or doubled a card would move a sponsor's
  // density — which is the unit of sale (D195, D377), and the one
  // property the feed's order was load-bearing for before this change.
  const QS = [
    { id: "s1", cat: "sport" }, { id: "s2", cat: "sport" }, { id: "s3", cat: "sport" },
    { id: "t1", cat: "tech" }, { id: "t2", cat: "tech" },
    { id: "f1", cat: "food" },
  ];

  it("is the identity at 0, which is the order a fresh install opens on", () => {
    // The counter starts at 0 on a device with nothing stored, so the
    // first feed anybody ever sees is the bank's own order — the one the
    // content lanes wrote. Every ordering case in this tree is written
    // against it, so this is also what keeps them meaningful.
    expect(wfStreamMix(QS, 0).map((q) => q.id)).toEqual(wfStreamMix(QS).map((q) => q.id));
  });

  it("opens on a different card at a different sitting", () => {
    // The owner's report is about meeting the same cards, so what has to
    // move is the HEAD, not merely the arrangement.
    const heads = new Set([0, 1, 2, 3].map((n) => wfStreamMix(QS, n)[0].id));
    expect(heads.size, "four sittings and the feed opened the same way").toBeGreaterThan(1);
  });

  it("rotates within a stream as well as between them", () => {
    // One rotation is not enough to change what you MEET: rotating only
    // the stream order deals the same three head cards in three orders.
    // With the leading stream also rotated, the leading TOPIC leads with
    // a different question.
    const firstSport = (n) => wfStreamMix(QS, n).find((q) => q.cat === "sport").id;
    expect(new Set([0, 1, 2].map(firstSport)).size,
      "the sport stream led with the same question at every sitting").toBeGreaterThan(1);
  });

  it("is a permutation at every rotation — nothing dropped, nothing doubled", () => {
    // Checked across more rotations than there are streams or cards, so a
    // modulo that went wrong at a wrap fails here rather than on an
    // invoice.
    for (let n = 0; n < 12; n++) {
      const ids = wfStreamMix(QS, n).map((q) => q.id);
      expect(ids, `rotation ${n} changed the list length`).toHaveLength(QS.length);
      expect(new Set(ids).size, `rotation ${n} dropped or doubled a card`).toBe(QS.length);
    }
  });

  it("still interleaves at every rotation, rather than serving blocks", () => {
    // The property the function existed for in the first place, held
    // across the new argument: a rotation that accidentally concatenated
    // the streams would satisfy every case above.
    for (let n = 0; n < 6; n++) {
      const cats = wfStreamMix(QS, n).map((q) => q.cat);
      expect(cats.slice(0, 3).length, `rotation ${n}`).toBe(3);
      expect(new Set(cats.slice(0, 3)).size, `rotation ${n} opened on one stream in a block`).toBe(3);
    }
  });

  it("survives an empty pool and a junk rotation rather than throwing", () => {
    // `rot` comes from a persisted counter, and a store is a thing that
    // can hold anything. A feed that threw here would be a blank tab.
    expect(wfStreamMix([], 3)).toEqual([]);
    expect(wfStreamMix(QS, -4).map((q) => q.id)).toEqual(wfStreamMix(QS, 0).map((q) => q.id));
    expect(wfStreamMix(QS, 1.7).map((q) => q.id)).toEqual(wfStreamMix(QS, 1).map((q) => q.id));
    expect(wfStreamMix(QS, NaN).map((q) => q.id)).toEqual(wfStreamMix(QS, 0).map((q) => q.id));
  });
});
