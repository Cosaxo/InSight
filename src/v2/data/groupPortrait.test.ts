// The portrait is the last Mirror surface that used to be sample people;
// what replaced it must be arithmetic a user can verify against the rows
// on screen. These tests pin the cases that produce a wrong-but-plausible
// portrait: majority ties, days I skipped, members who barely overlap
// with me, and a history too thin to name a twin from.
import { describe, expect, it } from "vitest";
import { MIN_SHARED, groupPortrait, portraitRow } from "./groupPortrait";

const day = (n: number) => `2026-07-${String(n).padStart(2, "0")}`;
const rev = (n: number, votes: Record<string, number>) => ({
  day: day(n),
  qid: "q" + n,
  votes: Object.fromEntries(Object.entries(votes).map(([u, o]) => [u, { optionIdx: o }])),
});

describe("portraitRow", () => {
  it("counts votes and finds the majority", () => {
    const r = portraitRow(rev(1, { me: 0, a: 0, b: 1 }), "me")!;
    expect(r.counts).toEqual([2, 1]);
    expect(r.majorityIdx).toBe(0);
    expect(r.majorityN).toBe(2);
    expect(r.total).toBe(3);
    expect(r.mine).toBe(0);
    expect(r.withMajority).toBe(true);
  });

  it("a 2-2 tie leaves BOTH blocs with the majority", () => {
    const r = portraitRow(rev(1, { me: 1, a: 1, b: 0, c: 0 }), "me")!;
    // display picks the lowest index…
    expect(r.majorityIdx).toBe(0);
    // …but my side's count equals the max, so I am not "against" anything
    expect(r.withMajority).toBe(true);
  });

  it("a day I skipped has mine null and never counts as with", () => {
    const r = portraitRow(rev(1, { a: 0, b: 0 }), "me")!;
    expect(r.mine).toBeNull();
    expect(r.withMajority).toBe(false);
  });

  it("returns null for a reveal without usable votes", () => {
    expect(portraitRow({ day: day(1), votes: null }, "me")).toBeNull();
    expect(portraitRow({ day: day(1), votes: {} }, "me")).toBeNull();
  });

  it("keeps counts dense when an option got zero votes", () => {
    const r = portraitRow(rev(1, { me: 2, a: 2, b: 0 }), "me")!;
    expect(r.counts).toEqual([1, 0, 2]);
  });
});

describe("groupPortrait", () => {
  it("alignment is over days I PLAYED, not days that happened", () => {
    const p = groupPortrait(
      [
        rev(1, { me: 0, a: 0, b: 1 }), // played, with
        rev(2, { a: 0, b: 0 }), //         skipped
        rev(3, { me: 1, a: 0, b: 0 }), // played, against
      ],
      "me",
    );
    expect(p.days).toBe(3);
    expect(p.daysPlayed).toBe(2);
    expect(p.meWithMaj).toBe(1);
    expect(p.alignPct).toBe(50);
  });

  it("agreement is pairwise over SHARED days only", () => {
    const p = groupPortrait(
      [
        rev(1, { me: 0, a: 0 }), //        a agrees
        rev(2, { me: 1, a: 0, b: 1 }), //  a disagrees, b agrees
        rev(3, { me: 0, b: 1 }), //        b disagrees; a absent
      ],
      "me",
    );
    const a = p.people.find((x) => x.uid === "a")!;
    const b = p.people.find((x) => x.uid === "b")!;
    expect(a).toMatchObject({ shared: 2, agree: 1, pct: 50 });
    expect(b).toMatchObject({ shared: 2, agree: 1, pct: 50 });
  });

  it("one shared day is not enough to be named twin", () => {
    expect(MIN_SHARED).toBeGreaterThan(1);
    const p = groupPortrait([rev(1, { me: 0, a: 0 })], "me");
    expect(p.people[0]).toMatchObject({ uid: "a", pct: 100 });
    expect(p.twin).toBeNull();
    expect(p.contrarian).toBeNull();
  });

  it("twin is the highest-agreement eligible member, contrarian the lowest", () => {
    const p = groupPortrait(
      [
        rev(1, { me: 0, a: 0, b: 1 }),
        rev(2, { me: 0, a: 0, b: 1 }),
        rev(3, { me: 0, a: 1, b: 0 }),
      ],
      "me",
    );
    expect(p.twin!.uid).toBe("a"); // 2/3
    expect(p.contrarian!.uid).toBe("b"); // 1/3
  });

  it("contrarian needs a SECOND eligible member — the twin never doubles as it", () => {
    const p = groupPortrait([rev(1, { me: 0, a: 0 }), rev(2, { me: 0, a: 1 })], "me");
    expect(p.twin!.uid).toBe("a");
    expect(p.contrarian).toBeNull();
  });

  it("an empty history yields an empty portrait, not NaN", () => {
    const p = groupPortrait([], "me");
    expect(p).toMatchObject({ days: 0, daysPlayed: 0, meWithMaj: 0, alignPct: 0, twin: null });
    expect(p.rows).toEqual([]);
    expect(p.people).toEqual([]);
  });

  it("a null uid (signed-out edge) produces rows but no people", () => {
    const p = groupPortrait([rev(1, { a: 0, b: 1 })], null);
    expect(p.days).toBe(1);
    expect(p.people).toEqual([]);
  });
});

describe("twin / contrarian need a spread, not just a sample", () => {
  // MIN_SHARED bounds the SAMPLE. Nothing bounded the spread, and the
  // comparator's final clause is a uid tiebreak that never returns 0 — so a
  // fully tied list came out ordered by uid, and first and last got labelled.
  // LiveGroupsMirrorBody renders "breaks ranks" beside the person's literal
  // agreement count, so the screen contradicted itself.
  it("names nobody when every eligible member agrees identically", () => {
    // Three members, all 3/3 with me. Day two of a live group reaches this.
    const p = groupPortrait([
      rev(1, { me: 0, ann: 0, bo: 0, cy: 0 }),
      rev(2, { me: 1, ann: 1, bo: 1, cy: 1 }),
      rev(3, { me: 0, ann: 0, bo: 0, cy: 0 }),
    ], "me");
    expect(p.people.map((x) => x.pct)).toEqual([100, 100, 100]);
    expect(p.twin, "crowned a twin out of a three-way tie").toBeNull();
    expect(p.contrarian, "called someone a contrarian at 100% agreement").toBeNull();
  });

  it("names nobody when every eligible member disagrees identically", () => {
    // The inverse fires too: at 0% across the board, someone was crowned
    // "most like you".
    const p = groupPortrait([
      rev(1, { me: 0, ann: 1, bo: 1 }),
      rev(2, { me: 0, ann: 1, bo: 1 }),
    ], "me");
    expect(p.people.map((x) => x.pct)).toEqual([0, 0]);
    expect(p.twin).toBeNull();
    expect(p.contrarian).toBeNull();
  });

  it("still names both when there is a real spread", () => {
    const p = groupPortrait([
      rev(1, { me: 0, ann: 0, cy: 1 }),
      rev(2, { me: 0, ann: 0, cy: 1 }),
    ], "me");
    expect(p.twin!.uid).toBe("ann");
    expect(p.contrarian!.uid).toBe("cy");
  });
});

// D290. The bottom of an agreement-ordered list is the least CONFIDENT
// member, not the least agreeing one — so once D277 §2 sorted on the Wilson
// lower bound, `eligible[last]` stopped meaning what "breaks ranks" says.
//
// WHY THE SUITE ABOVE COULD NOT SEE IT: every case in it gives all members
// the SAME `shared`, and at equal shared the rate order and the pct order
// coincide exactly. The bug lives entirely in unequal overlap, which is
// also the ordinary shape of a real group — people join on different days.
describe("uneven overlap: the label has to mean what it says", () => {
  // ann plays all ten days and matches on nine; bo joins late, two days,
  // matches on both. Rendered, the old code drew "breaks ranks" beside
  // bo's full accent bar and a literal "2/2".
  const annAndBo = () => {
    const out = [];
    for (let d = 1; d <= 10; d++) {
      const votes: Record<string, number> = { me: 0, ann: d === 10 ? 1 : 0 };
      if (d > 8) votes.bo = 0;              // bo: 2 shared days, both matched
      out.push(rev(d, votes));
    }
    return out;
  };

  it("never calls the highest-agreeing member the one who breaks ranks", () => {
    const p = groupPortrait(annAndBo(), "me");
    expect(p.people.map((x) => `${x.uid} ${x.agree}/${x.shared}`)).toEqual(["ann 9/10", "bo 2/2"]);
    // The regression, stated as the thing a reader would object to.
    expect(
      p.contrarian && p.contrarian.pct === Math.max(...p.people.map((x) => x.pct)),
      "labelled the group's highest agreement 'breaks ranks'",
    ).toBeFalsy();
  });

  it("names neither, because the only member who disagrees at all agrees most", () => {
    // Not a corner case — it is what this group honestly contains. ann is
    // both the closest and the only source of any disagreement, so there
    // is no contrast to draw and the truthful answer is no labels.
    const p = groupPortrait(annAndBo(), "me");
    expect(p.twin).toBeNull();
    expect(p.contrarian).toBeNull();
  });

  it("picks the real dissenter when uneven overlap contains one", () => {
    // ann 9/10 (thick, agrees), cy 2/2 DISagreeing, bo 2/2 agreeing.
    const out = [];
    for (let d = 1; d <= 10; d++) {
      const votes: Record<string, number> = { me: 0, ann: d === 10 ? 1 : 0 };
      if (d > 8) { votes.bo = 0; votes.cy = 1; }
      out.push(rev(d, votes));
    }
    const p = groupPortrait(out, "me");
    expect(p.contrarian!.uid).toBe("cy");     // 0/2, the only one who disagrees on every shared day
    expect(p.twin!.uid).not.toBe("cy");
    // and the twin is a thick 90%, not the thin perfect one — the D277
    // confidence bound doing its job at the end it was written for
    expect(p.twin!.uid).toBe("ann");
  });

  it("does not let a one-sided thin overlap outrank a thick disagreement", () => {
    // The mirror of D277 §2's own argument, at the other end: cy 1/8 is a
    // far better evidenced dissenter than a hypothetical 0/2, and the
    // bounded disagreement rate has to prefer it.
    const out = [];
    for (let d = 1; d <= 8; d++) out.push(rev(d, { me: 0, cy: d === 1 ? 0 : 1, ann: 0 }));
    out.push(rev(9, { me: 0, dd: 1, ann: 0 }));
    out.push(rev(10, { me: 0, dd: 1, ann: 0 }));
    const p = groupPortrait(out, "me");
    expect(p.contrarian!.uid).toBe("cy");     // 1/8 = 12%, over dd's 0/2
  });
});

describe("the pick-day snapshot (D224)", () => {
  // A pick vote may carry WHO its index meant, snapshotted by the
  // answering client. The row surfaces it only when the counted majority
  // votes agree — the index path a reader falls back to reads the CURRENT
  // roster order, which is the remapping hazard the snapshot removes.
  const pickRev = (n: number, votes: Record<string, { o: number; p?: string }>) => ({
    day: day(n),
    qid: "q" + n,
    votes: Object.fromEntries(
      Object.entries(votes).map(([u, v]) => [u, { optionIdx: v.o, ...(v.p ? { pickUid: v.p } : {}) }]),
    ),
  });

  it("majorityPickUid is the person the majority's own snapshots name", () => {
    const r = portraitRow(pickRev(1, { me: { o: 2, p: "b" }, a: { o: 2, p: "b" }, b: { o: 0, p: "me" } }), "me")!;
    expect(r.majorityIdx).toBe(2);
    expect(r.majorityPickUid).toBe("b");
    expect(r.minePickUid).toBe("b");
  });

  it("a split snapshot on one index yields null, never a guessed name", () => {
    // Two clients held different rosters, so the same index meant two
    // different people — the grouping itself is unsound for this day, and
    // that is not a thing to paper over with a name.
    const r = portraitRow(pickRev(1, { me: { o: 1, p: "a" }, a: { o: 1, p: "b" }, b: { o: 0 } }), "me")!;
    expect(r.majorityPickUid).toBeNull();
  });

  it("a majority where only some votes carry the snapshot uses the carriers' agreed name", () => {
    // Mixed client versions: the pre-D224 vote has no snapshot; the ones
    // that do agree, and their agreement is the best available truth.
    const r = portraitRow(pickRev(1, { me: { o: 1, p: "a" }, a: { o: 1 }, b: { o: 1, p: "a" } }), "me")!;
    expect(r.majorityPickUid).toBe("a");
  });

  it("pre-D224 reveals carry no snapshots and read as before", () => {
    const r = portraitRow(rev(1, { me: 0, a: 0, b: 1 }), "me")!;
    expect(r.majorityPickUid).toBeNull();
    expect(r.minePickUid).toBeNull();
  });

  it("my snapshot is mine even when I am against the majority", () => {
    const r = portraitRow(pickRev(1, { me: { o: 0, p: "a" }, a: { o: 1, p: "b" }, b: { o: 1, p: "b" } }), "me")!;
    expect(r.majorityPickUid).toBe("b");
    expect(r.minePickUid).toBe("a");
  });
});

// ── a day the group did not all get the same question (D70/D71) ──
// duelQFor uses the bank LENGTH as its modulus, so a promotion remaps the
// rotation for whoever refreshed their cache first. The reveal is published
// under the plurality question and stamps `qid` on the answers that were
// given to something else. Nothing that compares two optionIdx values may
// look across that line: option 2 of one prompt has nothing to do with
// option 2 of another.
describe("votes answered against a different question", () => {
  // b was asked something else that day
  const split = (n: number, votes: Record<string, number>, odd: Record<string, string>) => ({
    day: day(n),
    qid: "q" + n,
    votes: Object.fromEntries(
      Object.entries(votes).map(([u, o]) => [u, odd[u] ? { optionIdx: o, qid: odd[u] } : { optionIdx: o }]),
    ),
  });

  it("keeps the off-question answer out of the counts, and says how many", () => {
    const r = portraitRow(split(1, { me: 0, a: 0, b: 0 }, { b: "q-other" }), "me")!;
    // b also picked 0 — but of a different question's options, so counting
    // it would show a unanimous 3-0 the group never gave.
    expect(r.counts).toEqual([2]);
    expect(r.total).toBe(2);
    expect(r.offQuestion).toBe(1);
    expect(r.mine).toBe(0);
    expect(r.mineOffQuestion).toBe(false);
  });

  it("when the off-question answer is MINE, the day is not one I played", () => {
    const r = portraitRow(split(1, { me: 2, a: 0, b: 0 }, { me: "q-other" }), "me")!;
    expect(r.mine).toBeNull();
    expect(r.mineOffQuestion).toBe(true);
    // …so it cannot count toward alignment either
    expect(r.withMajority).toBe(false);
    const p = groupPortrait([split(1, { me: 2, a: 0, b: 0 }, { me: "q-other" })], "me");
    expect(p.daysPlayed).toBe(0);
    expect(p.alignPct).toBe(0);
  });

  it("a day we answered different questions is not a shared day", () => {
    // Two days. On day 2, b was asked something else and happens to have
    // picked the same index as me. Before the qid check that read as
    // agreement, and 2/2 named b my twin.
    const reveals = [
      split(1, { me: 0, b: 1 }, {}),
      split(2, { me: 0, b: 0 }, { b: "q-other" }),
    ];
    const p = groupPortrait(reveals, "me");
    const b = p.people.find((x) => x.uid === "b")!;
    expect(b.shared).toBe(1);
    expect(b.agree).toBe(0);
    expect(b.pct).toBe(0);
    // one shared day is below MIN_SHARED, so no label is claimed at all
    expect(p.twin).toBeNull();
  });

  it("a reveal where EVERY answer was to another question yields no row", () => {
    // Not a day of unanimous agreement — a day with nothing to count.
    expect(portraitRow(split(1, { me: 0, a: 0 }, { me: "q-x", a: "q-y" }), "me")).toBeNull();
  });

  it("reveals written before D71 carry no per-vote qid and are unaffected", () => {
    const r = portraitRow(rev(1, { me: 0, a: 0, b: 1 }), "me")!;
    expect(r.offQuestion).toBe(0);
    expect(r.mineOffQuestion).toBe(false);
    expect(r.total).toBe(3);
  });
});
