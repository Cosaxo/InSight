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
