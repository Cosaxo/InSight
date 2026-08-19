// @vitest-environment jsdom
//
// Your role, as a test result (D204).
//
// Two things are worth pinning here and they pull in opposite directions.
//
//   · THE FOLD IS REAL. Every dimension is arithmetic over reveal
//     documents the app already fetches, so these cases build history by
//     hand and check the numbers rather than mocking the fold away. A
//     role card claims to be a measurement; if it were not, nothing on
//     screen would look different.
//   · THE INSTRUMENT MUST STAY MATCHABLE. `IS_archScores` assumes three
//     things about a type table — signatures extreme on the dims that
//     define them, shares summing to 100, and a baseline in IS_TEST_AVG
//     with exactly the fold's dim ids. All three are silent when broken:
//     the matcher still returns a type, just the wrong one. The registry
//     cases at the foot are the only thing that would notice.
import { describe, expect, it } from "vitest";
import { blendRoles, duoRole, groupRole, steadiness, MIN_DUO, MIN_GROUP } from "./roles";
// @ts-expect-error TS7016 — untyped spec module
import { IS_ARCHETYPES } from "../spec/archetype-data.js";
// @ts-expect-error TS7016 — untyped spec module
import { IS_TEST_AVG } from "../spec/test-definitions.js";

const ME = "me", THEM = "them";

/** One reveal day: my (option, guess) and theirs. */
const day = (
  d: string,
  mine: [number, number | undefined],
  theirs: [number, number | undefined],
  qid = "q1",
) => ({
  day: d, qid,
  votes: {
    [ME]: { optionIdx: mine[0], guessIdx: mine[1] },
    [THEM]: { optionIdx: theirs[0], guessIdx: theirs[1] },
  },
});

describe("steadiness — a run's lack of flips", () => {
  it("reads a clean run as steady and an alternating one as not", () => {
    expect(steadiness([true, true, true, true])).toBe(100);
    expect(steadiness([true, false, true, false])).toBe(0);
    expect(steadiness([true, true, false, false])).toBe(67);
  });

  it("returns the neutral rather than a flattering 100 with nothing to flip", () => {
    // One day has no flips to count. Calling that "perfectly steady" would
    // make a first duel the steadiest reading in the app.
    expect(steadiness([true])).toBe(50);
    expect(steadiness([])).toBe(50);
  });
});

describe("duoRole", () => {
  it("refuses under the floor rather than reading three days as a person", () => {
    const hist = [
      day("2026-08-01", [0, 1], [1, 0]),
      day("2026-08-02", [0, 1], [1, 0]),
    ];
    expect(hist.length).toBeLessThan(MIN_DUO);
    expect(duoRole(hist, ME, THEM)).toBeNull();
  });

  it("scores insight and legibility off the guesses, separately", () => {
    // I call them right 3 of 4; they call me right 1 of 4. The two are
    // deliberately different numbers — a fixture where they coincide
    // cannot tell the dims apart, which is the mistake this case caught
    // the first time it ran.
    const hist = [
      day("2026-08-01", [0, 1], [1, 1]), // my guess 1 = their 1 → hit; their guess 1 ≠ my 0 → miss
      day("2026-08-02", [0, 1], [1, 1]), // hit; miss
      day("2026-08-03", [0, 1], [1, 1]), // hit; miss
      day("2026-08-04", [0, 0], [1, 0]), // my guess 0 ≠ their 1 → miss; their guess 0 = my 0 → hit
    ];
    const r = duoRole(hist, ME, THEM);
    expect(r).not.toBeNull();
    const by = Object.fromEntries(r!.dims.map((d) => [d.id, d]));
    expect(by.read.value).toBe(75);
    expect(by.seen.value).toBe(25);
    expect(by.read.note).toBe("right on 3 of your 4 guesses");
    expect(by.seen.note).toBe("they're right on 1 of their 4");
  });

  it("scores likeness off the ANSWERS, on days neither of you guessed", () => {
    // The distinction the prototype's shared array cannot express: a day
    // with no guesses is unscoreable for read/seen and perfectly good for
    // likeness. Four guessed days plus two unguessed ones where we agreed.
    const hist = [
      day("2026-08-01", [0, 1], [1, 1]),
      day("2026-08-02", [0, 1], [1, 1]),
      day("2026-08-03", [0, 1], [1, 1]),
      day("2026-08-04", [0, 0], [1, 0]),
      day("2026-08-05", [1, undefined], [1, undefined]),
      day("2026-08-06", [0, undefined], [0, undefined]),
    ];
    const r = duoRole(hist, ME, THEM)!;
    const by = Object.fromEntries(r.dims.map((d) => [d.id, d]));
    // read/seen still see only the four guessed days…
    expect(by.read.note).toBe("right on 3 of your 4 guesses");
    // …while likeness sees all six, and we matched on the last two.
    expect(by.like.note).toBe("the same answer on 2 of 6 days");
    expect(by.like.value).toBe(33);
  });

  it("ignores a day the two of you answered different questions", () => {
    const hist = [
      day("2026-08-01", [0, 0], [0, 0]),
      day("2026-08-02", [0, 0], [0, 0]),
      day("2026-08-03", [0, 0], [0, 0]),
      { day: "2026-08-04", qid: "q1",
        votes: { [ME]: { optionIdx: 0, guessIdx: 0, qid: "qA" }, [THEM]: { optionIdx: 0, guessIdx: 0, qid: "qB" } } },
    ];
    const r = duoRole(hist, ME, THEM)!;
    const by = Object.fromEntries(r.dims.map((d) => [d.id, d]));
    expect(by.read.note).toBe("right on 3 of your 3 guesses");
    expect(by.like.note).toBe("the same answer on 3 of 3 days");
  });

  it("carries the day count as its weight", () => {
    const hist = Array.from({ length: 5 }, (_, i) => day(`2026-08-0${i + 1}`, [0, 0], [0, 0]));
    expect(duoRole(hist, ME, THEM)!.n).toBe(5);
  });
});

// One group reveal: every member's option, no guesses (groups do not guess).
const gday = (d: string, opts: Record<string, number>, qid = "g1") => ({
  day: d, qid,
  votes: Object.fromEntries(Object.entries(opts).map(([u, o]) => [u, { optionIdx: o }])),
});

describe("groupRole", () => {
  it("refuses under the floor", () => {
    expect(groupRole([gday("2026-08-01", { me: 0, a: 0, b: 1 })], ME)).toBeNull();
    expect(MIN_GROUP).toBe(2);
  });

  it("reads independence off the days you played, not the days revealed", () => {
    // Four revealed days, I played three, and was away from the majority
    // on one of them. Dividing by revealed days would make not turning up
    // look like independence.
    const hist = [
      gday("2026-08-01", { me: 0, a: 0, b: 0 }),
      gday("2026-08-02", { me: 1, a: 0, b: 0 }), // away
      gday("2026-08-03", { me: 0, a: 0, b: 0 }),
      gday("2026-08-04", { a: 0, b: 0 }),        // I did not play
    ];
    const r = groupRole(hist, ME)!;
    const by = Object.fromEntries(r.dims.map((d) => [d.id, d]));
    expect(r.n).toBe(3);
    expect(by.own.note).toBe("away from the majority on 1 of 3 days");
    expect(by.own.value).toBe(33);
  });

  it("weights centrality by shared days rather than by person", () => {
    // `a` is present throughout and agrees twice of three; `b` shows up
    // once and agrees. Counting people equally would let one day's member
    // move the number as much as a long-standing one.
    const hist = [
      gday("2026-08-01", { me: 0, a: 0, b: 0 }),
      gday("2026-08-02", { me: 0, a: 0 }),
      gday("2026-08-03", { me: 0, a: 1 }),
    ];
    const r = groupRole(hist, ME)!;
    const by = Object.fromEntries(r.dims.map((d) => [d.id, d]));
    // a: 2 of 3 · b: 1 of 1 → 3 of 4 shared days landed with me.
    expect(by.pull.note).toBe("others landed with you 3 of 4 times");
    expect(by.pull.value).toBe(75);
  });

  it("has exactly three dimensions — cast is not computed (D204)", () => {
    const hist = [
      gday("2026-08-01", { me: 0, a: 0 }),
      gday("2026-08-02", { me: 0, a: 0 }),
    ];
    const r = groupRole(hist, ME)!;
    expect(r.dims.map((d) => d.id)).toEqual(["own", "pull", "settle"]);
    // A constant 50 equal to the baseline would have contributed nothing
    // to any match while drawing an identical petal on every rose.
    expect(r.dims.some((d) => d.id === "cast")).toBe(false);
  });
});

describe("blendRoles", () => {
  it("weights by revealed days, so a short run cannot swing the portrait", () => {
    const long = { n: 20, dims: [{ id: "read", label: "Insight", value: 80, note: "x" }] };
    const short = { n: 2, dims: [{ id: "read", label: "Insight", value: 20, note: "y" }] };
    const b = blendRoles([long, short])!;
    expect(b.n).toBe(22);
    // (80·20 + 20·2) / 22 = 74.5 → 75, not the unweighted 50.
    expect(b.dims[0].value).toBe(75);
  });

  it("drops the receipts, because a count is false of an average", () => {
    const b = blendRoles([
      { n: 4, dims: [{ id: "read", label: "Insight", value: 50, note: "right on 2 of 4" }] },
      { n: 6, dims: [{ id: "read", label: "Insight", value: 50, note: "right on 3 of 6" }] },
    ])!;
    expect(b.dims[0].note).toBe("");
  });

  it("returns null with nothing to blend", () => {
    expect(blendRoles([])).toBeNull();
  });
});

// ── the registries the matcher silently depends on ──────────────────────
describe("the role instruments are matchable", () => {
  for (const kind of ["duo", "group"]) {
    it(`${kind}: shares sum to 100, so the rarity tax reads a distribution`, () => {
      const list = IS_ARCHETYPES[kind].list as { share: number }[];
      expect(list.reduce((a, t) => a + t.share, 0)).toBe(100);
    });

    it(`${kind}: every signature covers exactly the fold's dims`, () => {
      // A signature missing a dim is not an error anywhere — the matcher
      // just scores it against the baseline and returns a plausible wrong
      // answer. This is the only place that would notice.
      const want = Object.keys(IS_TEST_AVG[kind]).sort();
      for (const t of IS_ARCHETYPES[kind].list as { name: string; sig: Record<string, number> }[]) {
        expect(Object.keys(t.sig).sort(), `${t.name} signature`).toEqual(want);
      }
    });

    it(`${kind}: every type is extreme on at least one dim`, () => {
      // The matcher weights each dim by |sig − 50|, so a type that is
      // near-neutral everywhere can never win and is dead weight in the
      // table. This is what dropping `cast` would have done to The First
      // Pick and The Spark had they been kept.
      for (const t of IS_ARCHETYPES[kind].list as { name: string; sig: Record<string, number> }[]) {
        const far = Math.max(...Object.values(t.sig).map((v) => Math.abs(v - 50)));
        // 12 is the house's own observed floor (Communitarian, in the
        // politics table) — this asserts the role tables are no looser
        // than the four that shipped, not that they are tighter.
        expect(far, `${t.name} is near-neutral on every dim`).toBeGreaterThanOrEqual(12);
      }
    });

    it(`${kind}: no two types share a signature`, () => {
      const seen = new Set<string>();
      for (const t of IS_ARCHETYPES[kind].list as { name: string; sig: Record<string, number> }[]) {
        const key = JSON.stringify(t.sig);
        expect(seen.has(key), `${t.name} duplicates another signature`).toBe(false);
        seen.add(key);
      }
    });
  }

  it("the group table lost the three types cast alone made distinct", () => {
    const names = (IS_ARCHETYPES.group.list as { name: string }[]).map((t) => t.name);
    expect(names).toHaveLength(6);
    expect(names).not.toContain("The First Pick");
    expect(names).not.toContain("The Spark");
    // The Floater goes with them: without cast its signature is 46/46/44,
    // and the matcher weights by |sig − 50|, so it could never be picked.
    expect(names).not.toContain("The Floater");
  });
});
