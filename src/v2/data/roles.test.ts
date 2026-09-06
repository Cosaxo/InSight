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
import { blendRoles, chanceValue, duoRole, duoRoleDays, groupRole, groupRoleDays, optionsOn, steadiness, MIN_DUO, MIN_GROUP, type BankLookup } from "./roles";
// @ts-expect-error TS7016 — untyped spec module
import { IS_ARCHETYPES, IS_archScores, IS_matchArchetype } from "../spec/archetype-data.js";
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
    // …and the room reading (D386) is an ASIDE, not a fourth dim: the
    // table cannot see it yet, and a dim the signatures do not carry is
    // exactly what the registry cases below refuse.
    expect(r.dims.some((d) => d.id === "room")).toBe(false);
  });

  it("reads the room off your guess at where it would land (D386)", () => {
    // A group reveal with my guess: one day I called the winner, one day I
    // did not, one day the room was a 1–1 tie and my call named a side of
    // it (a hit — the top was shared), one day I did not guess.
    const g = (d: string, votes: Record<string, { optionIdx: number; guessIdx?: number }>) => ({ day: d, qid: "g1", votes });
    const hist = [
      g("2026-08-01", { me: { optionIdx: 0, guessIdx: 0 }, a: { optionIdx: 0 }, b: { optionIdx: 1 } }),
      g("2026-08-02", { me: { optionIdx: 1, guessIdx: 1 }, a: { optionIdx: 0 }, b: { optionIdx: 0 } }),
      g("2026-08-03", { me: { optionIdx: 0, guessIdx: 1 }, a: { optionIdx: 1 } }),
      g("2026-08-04", { me: { optionIdx: 0 }, a: { optionIdx: 0 } }),
    ];
    const r = groupRole(hist, ME)!;
    const room = r.asides!.find((x) => x.id === "room")!;
    expect(room.note).toBe("called where the room landed 2 of 3 times");
    expect(room.n).toBe(3);
    // Two hits, one miss on two-option days: (1 + 1 − 1) / 3 → 50 + 17.
    expect(room.value).toBe(67);
  });

  it("does not score a call on a room of one — that room is you", () => {
    const hist = [
      { day: "2026-08-01", qid: "g1", votes: { me: { optionIdx: 0, guessIdx: 0 } } },
      { day: "2026-08-02", qid: "g1", votes: { me: { optionIdx: 0, guessIdx: 0 } } },
    ];
    const r = groupRole(hist, ME)!;
    expect(r.asides!.find((x) => x.id === "room")).toBeUndefined();
  });
});

// ── the chance scale (D386, ROLES-PLAN §3.2) ────────────────────────────
describe("every rate is scored against luck", () => {
  const four: BankLookup = () => ({ options: ["a", "b", "c", "d"], kind: "day" });
  const two: BankLookup = () => ({ options: ["a", "b"], kind: "day" });

  it("lands on 50 at chance and 100 when right every day", () => {
    expect(chanceValue({ sum: 0, n: 0 })).toBe(50);
    // one hit in four on four-option days: 1 − 3·(1/3) = 0 → 50
    expect(chanceValue({ sum: 1 - 3 * (1 / 3), n: 4 })).toBe(50);
    expect(chanceValue({ sum: 4, n: 4 })).toBe(100);
  });

  it("a miss on a four-option day costs less than a miss on a two-option day", () => {
    // Three hits and a miss, both ways. On two options that is 75 —
    // exactly the raw rate, because on a coin the scale IS the rate. On
    // four options the miss costs a third: (3 − 1/3)/4 → 83.
    const hist = [
      day("2026-08-01", [0, 1], [1, 1]),
      day("2026-08-02", [0, 1], [1, 1]),
      day("2026-08-03", [0, 1], [1, 1]),
      day("2026-08-04", [0, 0], [1, 0]),
    ];
    const onTwo = duoRole(hist, ME, THEM, two)!.dims.find((d) => d.id === "read")!;
    const onFour = duoRole(hist, ME, THEM, four)!.dims.find((d) => d.id === "read")!;
    expect(onTwo.value).toBe(75);
    expect(onFour.value).toBe(83);
    // …and the receipt is the same plain count either way.
    expect(onTwo.note).toBe("right on 3 of your 4 guesses");
    expect(onFour.note).toBe(onTwo.note);
  });

  it("takes the option count from the bank, the roster on a pick day, or the votes", () => {
    const rev = { day: "d", qid: "q", votes: { me: { optionIdx: 3, guessIdx: 1 }, them: { optionIdx: 0, guessIdx: 5 } }, members: ["me", "them", "a", "b", "c"] };
    expect(optionsOn(rev, "q", four)).toBe(4);
    expect(optionsOn(rev, "q", () => ({ options: [], kind: "pick" }))).toBe(5);
    // No bank: the highest index the votes reach, plus one — a floor.
    expect(optionsOn(rev, "q")).toBe(6);
    // …never below two.
    expect(optionsOn({ day: "d", qid: "q", votes: { me: { optionIdx: 0 } } }, "q")).toBe(2);
  });

  it("scores independence against luck too, on the day's own count", () => {
    // Away from the majority on one of three two-option days: with, with,
    // away → (1 + 1 − 1)/3 → with 67, so own 33 — the raw figure, on a
    // coin. On four-option days the away day costs a third:
    // (1 + 1 − 1/3)/3 → with 78, so own 22.
    const hist = [
      gday("2026-08-01", { me: 0, a: 0, b: 0 }),
      gday("2026-08-02", { me: 1, a: 0, b: 0 }),
      gday("2026-08-03", { me: 0, a: 0, b: 0 }),
    ];
    expect(groupRole(hist, ME, two)!.dims.find((d) => d.id === "own")!.value).toBe(33);
    expect(groupRole(hist, ME, four)!.dims.find((d) => d.id === "own")!.value).toBe(22);
  });
});

// ── the day's kind (D386, ROLES-PLAN §3.7) ──────────────────────────────
describe("a mirror day is held apart", () => {
  // q1 is an ordinary day; qm asks each of you about the OTHER.
  const bank: BankLookup = (qid) => (qid === "qm"
    ? { options: ["Warm", "Sharp", "Steady", "Restless"], kind: "mirror" }
    : { options: ["a", "b"], kind: "day" });

  it("moves neither likeness nor insight, and lands in its own rows", () => {
    const hist = [
      day("2026-08-01", [0, 1], [1, 1]),
      day("2026-08-02", [0, 1], [1, 1]),
      day("2026-08-03", [0, 1], [1, 1]),
      // A mirror day where we each picked "Warm" about the other — the
      // same index, which is NOT the same answer about anything — and I
      // called what they said about me while they missed what I said.
      day("2026-08-04", [0, 0], [0, 2], "qm"),
      day("2026-08-05", [1, 3], [3, 1], "qm"),
    ];
    const r = duoRole(hist, ME, THEM, bank)!;
    const by = Object.fromEntries(r.dims.map((d) => [d.id, d]));
    expect(r.n).toBe(3);
    expect(by.read.note).toBe("right on 3 of your 3 guesses");
    expect(by.like.note).toBe("the same answer on 0 of 3 days");
    const asides = Object.fromEntries(r.asides!.map((a) => [a.id, a]));
    expect(asides.mirror.note).toBe("you called how they see you on 2 of 2 days");
    expect(asides.mirrorBy.note).toBe("they called how you see them on 1 of 2 days");
    expect(asides.mirror.n).toBe(2);
  });

  it("does not count toward the floor", () => {
    const hist = [
      day("2026-08-01", [0, 1], [1, 1]),
      day("2026-08-02", [0, 1], [1, 1]),
      day("2026-08-03", [0, 0], [0, 0], "qm"),
    ];
    expect(duoRoleDays(hist, ME, THEM, bank)).toBe(2);
    expect(duoRole(hist, ME, THEM, bank)).toBeNull();
    // Without a bank every day is an ordinary one — what every reveal
    // before the tag was seeded is.
    expect(duoRoleDays(hist, ME, THEM)).toBe(3);
  });
});

describe("projection — guessing your own answer (D386)", () => {
  it("is folded as an aside with its plain count", () => {
    // Guessed my own answer on two of four days, and one of those two
    // was right — projection and insight are different numbers.
    const hist = [
      day("2026-08-01", [0, 0], [0, 1]), // my guess = my answer, and right
      day("2026-08-02", [0, 0], [1, 1]), // my guess = my answer, and wrong
      day("2026-08-03", [0, 1], [1, 1]), // read them, right
      day("2026-08-04", [1, 0], [0, 1]), // read them, right
    ];
    const r = duoRole(hist, ME, THEM)!;
    const p = r.asides!.find((a) => a.id === "project")!;
    expect(p.note).toBe("guessed your own answer 2 of 4 times");
    expect(p.value).toBe(50);
    expect(r.dims.find((d) => d.id === "read")!.note).toBe("right on 3 of your 4 guesses");
  });
});

describe("blendRoles blends the asides on their own days", () => {
  it("weights each aside by its own count, not the setting's", () => {
    const a = { n: 10, dims: [{ id: "read", label: "Insight", value: 50, note: "" }],
      asides: [{ id: "room", label: "Reading the room", value: 80, note: "x", n: 2 }] };
    const b = { n: 2, dims: [{ id: "read", label: "Insight", value: 50, note: "" }],
      asides: [{ id: "room", label: "Reading the room", value: 20, note: "y", n: 6 }] };
    const out = blendRoles([a, b])!;
    // (80·2 + 20·6) / 8 = 35 — the setting with fewer days has MORE guessed days.
    expect(out.asides).toEqual([{ id: "room", label: "Reading the room", value: 35, note: "", n: 8 }]);
  });
});

// ── rule 4: a type is in the running only when its defining dims are (D386) ──
describe("the matcher refuses a type whose defining dim is absent", () => {
  it("scores it at Infinity and never picks it", () => {
    // The Outlier is defined by `own` and by `pull` (10 against a
    // baseline of 70). Hand the matcher a fold with no `pull` and it is
    // out of the running, however well `own` fits.
    const sc = IS_archScores("group", [{ id: "own", value: 88 }, { id: "settle", value: 54 }]) as { score: number; eligible: boolean }[];
    const outlier = (IS_ARCHETYPES.group.list as { name: string }[]).findIndex((t) => t.name === "The Outlier");
    expect(sc[outlier].eligible).toBe(false);
    expect(sc[outlier].score).toBe(Infinity);
    const m = IS_matchArchetype("group", [{ id: "own", value: 88 }, { id: "settle", value: 54 }]);
    expect(m && m.list[m.idx].name).not.toBe("The Outlier");
  });

  it("changes nothing when every dim is present — every score is finite", () => {
    for (const kind of ["duo", "group"]) {
      const dims = Object.keys(IS_TEST_AVG[kind]).map((id) => ({ id, value: 50 }));
      const sc = IS_archScores(kind, dims) as { score: number; eligible: boolean }[];
      expect(sc.every((x) => x.eligible && Number.isFinite(x.score)), kind).toBe(true);
    }
  });

  it("returns null when nothing is eligible, rather than a plausible wrong type", () => {
    // No shipped table can be emptied this way — every one has a type
    // near-neutral on all but one dim — so the null path is pinned on a
    // one-type table added for the case and removed after it. The tables
    // object is the module's own export, so this is the real matcher on a
    // real registry entry, not a mock.
    const tables = IS_ARCHETYPES as Record<string, unknown>;
    tables.__probe = { list: [{ name: "The Only", share: 100, line: "", sig: { a: 90, b: 50 } }] };
    try {
      // `a` defines The Only (90 against a default baseline of 50) and the
      // fold has no `a` → nothing is eligible → null, not The Only.
      expect(IS_matchArchetype("__probe", [{ id: "b", value: 50 }])).toBeNull();
      // …and with `a` present it is picked, which is the control.
      const m = IS_matchArchetype("__probe", [{ id: "a", value: 88 }, { id: "b", value: 50 }]);
      expect(m && m.list[m.idx].name).toBe("The Only");
    } finally {
      delete tables.__probe;
    }
  });
});

describe("the floor's own unit, for thin rows", () => {
  it("duoRoleDays counts scored days, not revealed days", () => {
    // Three revealed days, guesses on two — a thin row saying "3 of 3"
    // here would promise a role the fold then refuses.
    const hist = [
      day("2026-08-01", [0, 1], [1, 1]),
      day("2026-08-02", [0, 1], [1, 1]),
      day("2026-08-03", [0, undefined], [1, undefined]),
    ];
    expect(duoRoleDays(hist, ME, THEM)).toBe(2);
    // The count agrees with the gate: under MIN_DUO here, so no role…
    expect(duoRole(hist, ME, THEM)).toBeNull();
  });

  it("groupRoleDays counts days you played, matching groupRole's gate", () => {
    const hist = [
      gday("2026-08-01", { me: 0, a: 0 }),
      gday("2026-08-02", { a: 0, b: 1 }), // revealed, but I sat it out
    ];
    expect(groupRoleDays(hist, ME)).toBe(1);
    expect(groupRole(hist, ME)).toBeNull();
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
