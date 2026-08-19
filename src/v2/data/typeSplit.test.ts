// @vitest-environment jsdom
//
// The per-type reading of one question, folded from the session's cached
// voter list. jsdom because the archetype matcher underneath publishes
// onto `window`.
//
// The cases below are mostly about HONESTY rather than arithmetic, because
// that is where this fold can do damage: it is the only cut on the
// who-voted sheet that is a bounded sample sitting beside exact published
// cells, so every property that keeps the two apart is pinned here.
import { describe, expect, it } from "vitest";
import { CORE_TEST_KINDS, parseTestResults } from "./similarity";
import { TYPE_SYSTEMS, typeNames, typeOfParsed } from "./typeMix";
import {
  SPLIT_TEST, TYPE_SPLIT_SMALL, TYPE_THIN, typeDivergence, typeSplitFor, uidsOfType,
  type ScoredVoter,
} from "./typeSplit";

const results = (dims: Record<string, number>) =>
  parseTestResults(
    { big5: { title: "Big Five", taken: "2026-08-01", dims: Object.entries(dims).map(([id, value]) => ({ id, label: id, value })) } },
    CORE_TEST_KINDS,
  );

// Two profiles far apart on extraversion, so they reliably match
// different archetypes without this file hard-coding a type name.
const QUIET = { O: 72, C: 55, E: 15, A: 58, N: 50 };
const LOUD = { O: 60, C: 32, E: 90, A: 58, N: 45 };
const QUIET_TYPE = typeOfParsed(results(QUIET)) as string;
const LOUD_TYPE = typeOfParsed(results(LOUD)) as string;

/** n voters of one profile, all picking the same option. */
const many = (dims: Record<string, number>, optionIdx: number, n: number, tag = "u"): ScoredVoter[] =>
  Array.from({ length: n }, (_, i) => ({ uid: `${tag}${i}`, optionIdx, results: results(dims) }));

describe("the two types are actually distinct", () => {
  // Guards the fixtures themselves: if the matcher ever collapses these
  // onto one name, every case below would still pass while testing
  // nothing.
  it("matches different archetypes", () => {
    expect(QUIET_TYPE).toBeTruthy();
    expect(LOUD_TYPE).toBeTruthy();
    expect(QUIET_TYPE).not.toBe(LOUD_TYPE);
  });
});

describe("typeSplitFor", () => {
  it("groups each type's answers onto the question's own options", () => {
    const split = typeSplitFor([...many(QUIET, 0, 10), ...many(LOUD, 1, 10, "v")], 3);
    const quiet = split.ranked.find((r) => r.type === QUIET_TYPE);
    const loud = split.ranked.find((r) => r.type === LOUD_TYPE);
    expect(quiet?.counts).toEqual([10, 0, 0]);
    expect(loud?.counts).toEqual([0, 10, 0]);
  });

  it("keeps the sample and the typed sample as different numbers", () => {
    // The gap between them is the whole honesty of the card: 6 answers
    // read, 4 of them from people carrying a result.
    const split = typeSplitFor(
      [...many(QUIET, 0, 4), { uid: "x1", optionIdx: 1, results: null }, { uid: "x2", optionIdx: 2, results: null }],
      3,
    );
    expect(split.sampleN).toBe(6);
    expect(split.typedN).toBe(4);
  });

  it("does not bucket the untyped as a type", () => {
    const split = typeSplitFor([{ uid: "x1", optionIdx: 0, results: null }], 2);
    expect(split.ranked).toEqual([]);
    expect(split.thin).toEqual([]);
    expect(split.typedN).toBe(0);
    // Every defined type is reported absent rather than one "Unknown"
    // bucket appearing beside the real ones.
    expect(split.absent).toEqual(typeNames());
  });

  it("lists a thin type but refuses to rank it", () => {
    const split = typeSplitFor([...many(QUIET, 0, TYPE_THIN), ...many(LOUD, 1, TYPE_THIN - 1, "v")], 2);
    expect(split.ranked.map((r) => r.type)).toEqual([QUIET_TYPE]);
    expect(split.thin.map((r) => r.type)).toEqual([LOUD_TYPE]);
  });

  it("names absent types instead of drawing them as slivers", () => {
    const split = typeSplitFor(many(QUIET, 0, 10), 2);
    expect(split.absent).toContain(LOUD_TYPE);
    expect(split.absent).not.toContain(QUIET_TYPE);
    expect(split.absent.length).toBe(typeNames().length - 1);
  });

  it("withholds shares until the typed sample can carry them", () => {
    expect(typeSplitFor(many(QUIET, 0, TYPE_SPLIT_SMALL - 1), 2).enough).toBe(false);
    expect(typeSplitFor(many(QUIET, 0, TYPE_SPLIT_SMALL), 2).enough).toBe(true);
  });

  it("folds the typed sample's own overall, not the census", () => {
    // The baseline the divergence line subtracts has to come from the
    // same people the bars did, or the gap mixes the type's effect with
    // the sample's.
    const split = typeSplitFor([...many(QUIET, 0, 10), ...many(LOUD, 1, 30, "v")], 2);
    expect(split.overall).toEqual([10, 30]);
  });

  it("counts a typed voter whose answer lands in no column, but does not draw them", () => {
    // A catalog answer carries `entity`, not an option index. It is still
    // a typed person who answered, so it must not vanish from the basis —
    // but n has to equal what the bars add up to or the row lies about
    // its own picture.
    const split = typeSplitFor([...many(QUIET, 0, 3), ...many(QUIET, 9, 2, "v")], 2);
    expect(split.typedN).toBe(5);
    const row = [...split.ranked, ...split.thin].find((r) => r.type === QUIET_TYPE);
    expect(row?.counts).toEqual([3, 0]);
    expect(row?.n).toBe(3);
  });

  it("returns dense counts, so an option nobody picked keeps its column", () => {
    const split = typeSplitFor(many(QUIET, 0, 10), 4);
    const row = split.ranked.find((r) => r.type === QUIET_TYPE);
    expect(row?.counts).toHaveLength(4);
  });

  it("survives an empty list without inventing a reading", () => {
    const split = typeSplitFor([], 3);
    expect(split.sampleN).toBe(0);
    expect(split.typedN).toBe(0);
    expect(split.enough).toBe(false);
    expect(split.overall).toEqual([0, 0, 0]);
    expect(split.ranked).toEqual([]);
  });

  it("carries the viewer's own type through untouched", () => {
    expect(typeSplitFor([], 2, QUIET_TYPE).mine).toBe(QUIET_TYPE);
    expect(typeSplitFor([], 2).mine).toBeNull();
  });

  it("is retroactive by construction — the answer never carries the score", () => {
    // The point of the whole module. Nothing in a ScoredVoter says WHEN
    // the person was typed; the fold reads the score standing today
    // against the answer as given. So the same historical answers regroup
    // the moment a result appears, which is exactly what a stamped-at-
    // vote-time breakdown dim could never do.
    const answers: ScoredVoter[] = [
      { uid: "a", optionIdx: 0, results: null },
      { uid: "b", optionIdx: 1, results: null },
    ];
    expect(typeSplitFor(answers, 2).typedN).toBe(0);
    const laterTyped = answers.map((v) => ({ ...v, results: results(QUIET) }));
    const after = typeSplitFor(laterTyped, 2);
    expect(after.typedN).toBe(2);
    // Both original answers are now counted under the type.
    expect([...after.ranked, ...after.thin].find((r) => r.type === QUIET_TYPE)?.counts).toEqual([1, 1]);
  });
});

describe("typeDivergence", () => {
  it("finds the option a type is most unusual on", () => {
    const split = typeSplitFor([...many(QUIET, 0, 20), ...many(LOUD, 1, 20, "v")], 2);
    const row = split.ranked.find((r) => r.type === QUIET_TYPE)!;
    const d = typeDivergence(row, split.overall);
    // Quiet took option 0 unanimously; the typed sample split it 50/50.
    expect(d).toEqual({ optionIdx: 0, gap: 50, higher: true });
  });

  it("refuses a row too thin to have a reading", () => {
    const split = typeSplitFor([...many(QUIET, 0, TYPE_THIN - 1), ...many(LOUD, 1, 20, "v")], 2);
    const row = split.thin.find((r) => r.type === QUIET_TYPE)!;
    expect(typeDivergence(row, split.overall)).toBeNull();
  });

  it("returns null when a type answers exactly like the typed sample", () => {
    const split = typeSplitFor([...many(QUIET, 0, 10), ...many(QUIET, 1, 10, "v")], 2);
    const row = split.ranked.find((r) => r.type === QUIET_TYPE)!;
    expect(typeDivergence(row, split.overall)).toBeNull();
  });

  it("reports a direction, not just a size", () => {
    // Asymmetric on purpose. A two-option question is always a symmetric
    // tie — over-picking A and under-picking B are the same number — so
    // it cannot test direction at all; see the tie case below.
    // QUIET 15/5/0, LOUD 5/5/10 → typed overall 20/10/10 = 50/25/25.
    // QUIET reads 75/25/0, so its widest gap is +25 on option 0.
    const voters = [
      ...many(QUIET, 0, 15), ...many(QUIET, 1, 5, "q1"),
      ...many(LOUD, 0, 5, "v0"), ...many(LOUD, 1, 5, "v1"), ...many(LOUD, 2, 10, "v2"),
    ];
    const split = typeSplitFor(voters, 3);
    expect(split.overall).toEqual([20, 10, 10]);
    expect(typeDivergence(split.ranked.find((r) => r.type === QUIET_TYPE)!, split.overall))
      .toEqual({ optionIdx: 0, gap: 25, higher: true });
    // The other side of the same sample reads the other way.
    expect(typeDivergence(split.ranked.find((r) => r.type === LOUD_TYPE)!, split.overall)?.higher)
      .toBe(false);
  });

  it("breaks a tie the way cohort.divergence does — the first option wins", () => {
    // Not arbitrary-but-harmless: this sheet draws the published
    // divergence line and this one, and a different tie-break would have
    // the two sentences disagree about the same numbers. Both scan with a
    // strict `d > gap`, so the earliest option keeps it. On a binary that
    // means the reading can come out as "less likely to say A" where
    // "more likely to say B" is the same fact — true either way, and the
    // consistency is worth more than the phrasing.
    const split = typeSplitFor([...many(QUIET, 1, 20), ...many(LOUD, 0, 20, "v")], 2);
    const row = split.ranked.find((r) => r.type === QUIET_TYPE)!;
    expect(typeDivergence(row, split.overall)).toEqual({ optionIdx: 0, gap: 50, higher: false });
  });
});

describe("uidsOfType", () => {
  it("returns exactly the people the bars counted", () => {
    const voters = [...many(QUIET, 0, 3), ...many(LOUD, 1, 2, "v")];
    const ids = uidsOfType(voters, QUIET_TYPE);
    expect(ids.size).toBe(3);
    expect([...ids].every((u) => u.startsWith("u"))).toBe(true);
  });

  it("excludes the untyped", () => {
    const voters: ScoredVoter[] = [...many(QUIET, 0, 2), { uid: "x1", optionIdx: 0, results: null }];
    expect(uidsOfType(voters, QUIET_TYPE).has("x1")).toBe(false);
  });

  it("agrees with the fold's own count", () => {
    // The roster and the bars must not type people two different ways.
    const voters = [...many(QUIET, 0, 5), ...many(LOUD, 1, 4, "v")];
    const split = typeSplitFor(voters, 2);
    for (const row of [...split.ranked, ...split.thin]) {
      expect(uidsOfType(voters, row.type).size).toBe(row.n);
    }
  });
});

// ── the scope that survived D199 ──────────────────────────────────────
//
// D199 widened the population MIX to every instrument and demoted
// `typeMix.TYPE_TEST` from an enforcement point to a default. The promise
// in web/privacy.html that did NOT move is this module's: answers are
// grouped by the Big Five and by nothing else. That promise used to be
// enforced by a constant in another file; this case is what enforces it
// now, so a later widening of the mix cannot carry the split with it.
describe("SPLIT_TEST — answers group by the Big Five only", () => {
  it("is the Big Five, and that is a decision rather than a default", () => {
    expect(SPLIT_TEST).toBe("big5");
  });

  it("names an instrument the archetype module actually defines", () => {
    expect(TYPE_SYSTEMS.some((s) => s.kind === SPLIT_TEST)).toBe(true);
  });

  it("draws the Big Five's own type list, not whichever the mix is on", () => {
    // typeNames() defaults to typeMix.TYPE_TEST. If someone later changes
    // that default, this stays pinned to the Big Five's roster because the
    // fold passes SPLIT_TEST explicitly at every call site.
    expect(typeSplitRosterIsBigFive()).toBe(true);
  });
});

/** The split's own row roster, compared against the Big Five's. */
function typeSplitRosterIsBigFive(): boolean {
  const big5 = typeNames("big5");
  const split = typeSplitFor([], 2, null).absent;
  return split.length === big5.length && split.every((t, i) => t === big5[i]);
}
