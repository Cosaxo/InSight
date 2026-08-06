// pure.test.ts — unit tests for the pure helpers. No emulator, no
// firebase: everything under test is deterministic given its inputs.

import { describe, it, expect } from "vitest";
import {
  CODE_ALPHABET,
  inviteCodeFromBytes,
  utcDayKey,
  prevDayKey,
  shouldReveal,
  nextStreak,
  PENDING_DAYS_KEEP,
  prunePendingDays,
  meetsKFloor,
  breakdownBucket,
  foldAnchors,
  publishableBreakdown,
  BREAKDOWN_MAX_BUCKETS,
  steppedBreakdown,
  shouldPublishAgg,
  catalogEntityKey,
  publishableCanon,
  buildModQueueFrom,
  tallyFlags,
  carriedEscalations,
  modVerdictError,
  modVerdictId,
  seedDocMatches,
  SEEDED_FIELDS,
  foldCanonAnchors,
  canonBreakdownFor,
  CANON_BY_MAX_ENTITIES,
  isPlausibleFcmToken,
  nextFcmTokens,
} from "./pure";

// ── invite codes ────────────────────────────────────────────────

describe("inviteCodeFromBytes", () => {
  it("uses the unambiguous alphabet (no 0/O/1/I/L)", () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    for (const bad of ["0", "O", "1", "I", "L"]) {
      expect(CODE_ALPHABET).not.toContain(bad);
    }
  });

  it("maps 8 bytes to 8 alphabet chars, modulo the alphabet", () => {
    const code = inviteCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(code).toBe(CODE_ALPHABET.slice(0, 8));
    expect(code).toHaveLength(8);
  });

  it("wraps bytes past the alphabet length (31 → index 0, 255 → 255 % 31)", () => {
    const code = inviteCodeFromBytes(
      new Uint8Array([31, 62, 255, 30, 0, 0, 0, 0]),
    );
    expect(code[0]).toBe(CODE_ALPHABET[0]);
    expect(code[1]).toBe(CODE_ALPHABET[0]);
    expect(code[2]).toBe(CODE_ALPHABET[255 % 31]);
    expect(code[3]).toBe(CODE_ALPHABET[30]);
  });

  it("only ever emits alphabet characters", () => {
    // Deterministic pseudo-random stub — every residue class shows up.
    const bytes = new Uint8Array(8).map((_, i) => (i * 97 + 13) % 256);
    for (const ch of inviteCodeFromBytes(bytes)) {
      expect(CODE_ALPHABET).toContain(ch);
    }
  });
});

// ── day keys ────────────────────────────────────────────────────

describe("utcDayKey / prevDayKey", () => {
  const T = Date.UTC(2026, 6, 27, 12, 0, 0); // 2026-07-27T12:00Z

  it("formats today's UTC date", () => {
    expect(utcDayKey(0, T)).toBe("2026-07-27");
  });

  it("offsets by whole days (yesterday, tomorrow)", () => {
    expect(utcDayKey(-1, T)).toBe("2026-07-26");
    expect(utcDayKey(1, T)).toBe("2026-07-28");
  });

  it("rolls over exactly at UTC midnight", () => {
    const beforeMidnight = Date.UTC(2026, 6, 27, 23, 59, 59, 999);
    const atMidnight = Date.UTC(2026, 6, 28, 0, 0, 0, 0);
    expect(utcDayKey(0, beforeMidnight)).toBe("2026-07-27");
    expect(utcDayKey(0, atMidnight)).toBe("2026-07-28");
  });

  it("prevDayKey crosses month and year boundaries", () => {
    expect(prevDayKey("2026-07-27")).toBe("2026-07-26");
    expect(prevDayKey("2026-07-01")).toBe("2026-06-30");
    expect(prevDayKey("2026-03-01")).toBe("2026-02-28"); // non-leap
    expect(prevDayKey("2024-03-01")).toBe("2024-02-29"); // leap
    expect(prevDayKey("2026-01-01")).toBe("2025-12-31");
  });

  it("utcDayKey(-1) and prevDayKey agree", () => {
    expect(utcDayKey(-1, T)).toBe(prevDayKey(utcDayKey(0, T)));
  });
});

// ── reveal conditions ───────────────────────────────────────────

describe("shouldReveal", () => {
  it("duo is both-or-nothing", () => {
    expect(shouldReveal("duo", 0)).toBe(false);
    expect(shouldReveal("duo", 1)).toBe(false);
    expect(shouldReveal("duo", 2)).toBe(true);
  });

  it("group reveals from one answer", () => {
    expect(shouldReveal("group", 0)).toBe(false);
    expect(shouldReveal("group", 1)).toBe(true);
    expect(shouldReveal("group", 5)).toBe(true);
  });

  it("unknown modes behave like group (the pipeline's default)", () => {
    expect(shouldReveal("", 1)).toBe(true);
    expect(shouldReveal("", 0)).toBe(false);
  });
});

// ── the pending-day marker ──────────────────────────────────────

describe("prunePendingDays", () => {
  // 6 days back from 2026-07-27, i.e. what revealGroupDay computes as the
  // oldest day a duel answer could still legally arrive for.
  const OLDEST = "2026-07-21";

  it("drops the settled day and keeps the rest", () => {
    expect(prunePendingDays(["2026-07-25", "2026-07-26", "2026-07-27"], "2026-07-26", OLDEST))
      .toEqual(["2026-07-25", "2026-07-27"]);
  });

  it("drops days older than the cutoff, so the array cannot grow forever", () => {
    // The case this exists for: a duo whose partner never plays leaves one
    // unsettled day per day played. Without the cutoff that is one string
    // per day on the group document, permanently.
    const year = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 6, 27) + i * 86400000);
      return d.toISOString().slice(0, 10);
    });
    const out = prunePendingDays(year, "2026-07-27", OLDEST);
    expect(out).toEqual(["2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24",
      "2026-07-25", "2026-07-26"]);
    expect(out.length).toBeLessThanOrEqual(PENDING_DAYS_KEEP);
  });

  it("keeps the cutoff day itself — the bound is inclusive", () => {
    expect(prunePendingDays([OLDEST], "2026-07-27", OLDEST)).toEqual([OLDEST]);
    expect(prunePendingDays(["2026-07-20"], "2026-07-27", OLDEST)).toEqual([]);
  });

  it("survives a missing, malformed or duplicated field", () => {
    // A group that has never played has no pendingDays at all, and that is
    // the normal state — it must read as "nothing pending", not throw.
    expect(prunePendingDays(undefined, "2026-07-27", OLDEST)).toEqual([]);
    expect(prunePendingDays(null, "2026-07-27", OLDEST)).toEqual([]);
    expect(prunePendingDays("2026-07-26", "2026-07-27", OLDEST)).toEqual([]);
    expect(prunePendingDays([1, null, {}, "2026-07-26"], "2026-07-27", OLDEST))
      .toEqual(["2026-07-26"]);
    // arrayUnion cannot produce duplicates, but a hand-repaired document can.
    expect(prunePendingDays(["2026-07-26", "2026-07-26"], "2026-07-27", OLDEST))
      .toEqual(["2026-07-26"]);
  });

  it("compares day keys lexicographically, which is chronological for ISO", () => {
    // The whole cutoff rests on this, and it is the assumption that breaks
    // first if the key format ever changes.
    expect("2026-01-02" < "2026-01-10").toBe(true);
    expect("2025-12-31" < "2026-01-01").toBe(true);
    expect(prunePendingDays(["2025-12-31", "2026-01-05"], "x", "2026-01-01"))
      .toEqual(["2026-01-05"]);
  });
});

// ── streaks ─────────────────────────────────────────────────────

describe("nextStreak", () => {
  it("extends when the previous reveal was the day before", () => {
    expect(nextStreak("2026-07-26", "2026-07-27", 4)).toBe(5);
  });

  it("resets to 1 after a gap", () => {
    expect(nextStreak("2026-07-24", "2026-07-27", 9)).toBe(1);
  });

  it("starts at 1 when there was never a reveal", () => {
    expect(nextStreak(null, "2026-07-27", 0)).toBe(1);
    expect(nextStreak(undefined, "2026-07-27", 0)).toBe(1);
  });

  it("extends across a month boundary", () => {
    expect(nextStreak("2026-06-30", "2026-07-01", 2)).toBe(3);
  });
});

// ── k-floor ─────────────────────────────────────────────────────

describe("meetsKFloor", () => {
  it("is exclusive below and inclusive at the floor", () => {
    expect(meetsKFloor(19, 20)).toBe(false);
    expect(meetsKFloor(20, 20)).toBe(true);
    expect(meetsKFloor(21, 20)).toBe(true);
  });

  it("handles the small city floor edges too", () => {
    expect(meetsKFloor(0, 3)).toBe(false);
    expect(meetsKFloor(2, 3)).toBe(false);
    expect(meetsKFloor(3, 3)).toBe(true);
  });
});

describe("per-anchor breakdowns", () => {
  // Since D9 the client sends the canonical catalogue key for `city` and
  // the ISO code (derived from it, never typed) for `country`.
  const anchors = (over: Record<string, unknown> = {}) => ({
    ageBand: "25-34", gender: "Women", country: "NO", ...over,
  });

  it("folds the closed-vocabulary anchors, and ignores junk buckets", () => {
    const by = {};
    foldAnchors(by, anchors({ city: "Oslo, NO", profession: "Carpenter" }), 1);
    // `profession` is still free text up to 80 chars and must never mint a
    // key. `city` may, since D9 — it comes from a fixed catalogue whose
    // every entry check-cities.mjs verifies against these same rules.
    expect(Object.keys(by).sort()).toEqual(["ageBand", "city", "country", "gender"]);
    expect(by).toMatchObject({
      ageBand: { "25-34": { "1": 1 } },
      city: { "Oslo, NO": { "1": 1 } },
      country: { NO: { "1": 1 } },
    });

    // empty, over-long and field-path-hostile values are skipped, not stored
    const junk = {};
    foldAnchors(junk, { ageBand: "  ", gender: "x".repeat(41), country: "a.b" }, 0);
    expect(junk).toEqual({});
    expect(breakdownBucket("  Norway  ")).toBe("Norway");
    expect(breakdownBucket(42)).toBeNull();
  });

  it("refuses city and country values outside their vocabulary shape", () => {
    // Anchors are written by the client onto its own answer doc and
    // firestore.rules can only cap their length, so the bucket cap is
    // reachable by anyone willing to send 24 junk cities. Without the shape
    // check that blanks the dimension for every other user of the question.
    const by = {};
    for (const bad of ["oslo", "Oslo, Norway", "Oslo,NO", "Oslo, no", "OSLO"]) {
      foldAnchors(by, { city: bad, country: bad }, 0);
    }
    expect(by).toEqual({});

    // …and the canonical forms still land.
    foldAnchors(by, { city: "Oslo, NO", country: "NO" }, 0);
    expect(Object.keys(by).sort()).toEqual(["city", "country"]);

    // A city name may itself contain a comma; the shape anchors on the tail.
    expect(breakdownBucket("Washington, D C, US", "city")).toBe("Washington, D C, US");
    // The dim is optional, and without it the check does not apply — the
    // other five dimensions still accept their own free-form labels.
    expect(breakdownBucket("oslo")).toBe("oslo");
    expect(breakdownBucket("Prefer not to say", "gender")).toBe("Prefer not to say");
  });

  it("refuses bucket labels that are keys on Object.prototype", () => {
    // Four of the six dimensions have no closed vocabulary, and
    // firestore.rules can only bound an anchor's LENGTH — verified against
    // the real ruleset in the emulator, where an anonymous account creates
    // an answer carrying `anchors: { gender: "__proto__" }` and is allowed.
    //
    // `byDim[bucket] = {}` with that label sets the PROTOTYPE, so the
    // per-option counter beneath it lands on Object.prototype and every
    // object minted afterwards in the process inherits it.
    for (const name of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
      expect(breakdownBucket(name, "gender")).toBeNull();
      expect(breakdownBucket(name)).toBeNull();
    }

    const before = Object.prototype as unknown as Record<string, unknown>;
    const by = {};
    foldAnchors(by, { gender: "__proto__", ageBand: "constructor" }, 3);
    expect(by).toEqual({});
    expect(before["3"]).toBeUndefined();
    // The consequence the guard exists for, stated as the assertion: an
    // unrelated object must not have grown a vote count.
    expect(({} as Record<string, unknown>)["3"]).toBeUndefined();

    // …and the same for the catalog transpose, which folds the same anchors.
    const entBy = {};
    foldCanonAnchors(entBy, { gender: "__proto__" }, "25");
    expect(entBy).toEqual({});
    expect(({} as Record<string, unknown>)["25"]).toBeUndefined();
  });

  it("caps distinct buckets per dimension but keeps counting known ones", () => {
    // `education` rather than `country`: the cap is what is under test, and
    // country now carries an ISO-shape check that a synthetic "C37" fails
    // for an unrelated reason.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS + 10; i++) {
      foldAnchors(by, { education: "E" + i }, 0);
    }
    expect(Object.keys(by.education)).toHaveLength(BREAKDOWN_MAX_BUCKETS);
    // a bucket already known keeps incrementing even once the cap is hit
    foldAnchors(by, { education: "E0" }, 0);
    expect(by.education.E0["0"]).toBe(2);
    // …and a new one past the cap is dropped rather than growing the doc
    expect(by.education["E99"]).toBeUndefined();
  });

  it("caps the city dimension too, using real catalogue keys", () => {
    // The cap matters most here: a global question can touch far more than
    // 24 cities, so this is the dimension that actually degrades in
    // production rather than in a test.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS + 10; i++) {
      foldAnchors(by, { city: `City${i}, NO` }, 0);
    }
    expect(Object.keys(by.city)).toHaveLength(BREAKDOWN_MAX_BUCKETS);
    foldAnchors(by, { city: "City0, NO" }, 0);
    expect(by.city["City0, NO"]["0"]).toBe(2);
    expect(by.city["City30, NO"]).toBeUndefined();
  });

  it("suppresses buckets whose total is below the floor", () => {
    const by = {
      gender: {
        Women: { "0": 6, "1": 4 },   // 10 — publishable
        Men: { "0": 5, "1": 3 },     // 8  — publishable
        Nonbinary: { "0": 1 },       // 1  — below floor
        Other: { "0": 2 },           // 2  — below floor
      },
    };
    const out = publishableBreakdown(by, 5);
    expect(Object.keys(out.gender).sort()).toEqual(["Men", "Women"]);
    expect(out.gender.Nonbinary).toBeUndefined();
  });

  // The property that makes the floor real rather than decorative.
  it("never leaves exactly one suppressed bucket recoverable by subtraction", () => {
    const by = {
      ageBand: {
        "18-24": { "0": 20 },  // published
        "25-34": { "0": 12 },  // smallest survivor — must be taken too
        "35-44": { "0": 3 },   // the only sub-floor bucket
      },
    };
    const out = publishableBreakdown(by, 5);
    // Without complementary suppression this would publish two buckets and a
    // reader knowing the dimension total (35) recovers 35-20-12 = 3 exactly.
    expect(out.ageBand).toBeUndefined();

    // With enough survivors, the complement is applied and the rest stand
    const wide = {
      country: {
        A: { "0": 30 }, B: { "0": 20 }, C: { "0": 14 }, D: { "0": 2 },
      },
    };
    const w = publishableBreakdown(wide, 5);
    expect(Object.keys(w.country).sort()).toEqual(["A", "B"]);  // C is the complement
    expect(w.country.D).toBeUndefined();
  });

  it("omits a dimension that cannot show a comparison", () => {
    // one surviving bucket is a population statement, not a split
    expect(publishableBreakdown({ gender: { Women: { "0": 40 } } }, 5)).toEqual({});
    // two clean buckets and nothing suppressed: published as-is
    const clean = { gender: { Women: { "0": 9 }, Men: { "0": 7 } } };
    expect(publishableBreakdown(clean, 5)).toEqual(clean);
  });

  // The floor's scope, pinned so it stays a decision rather than a
  // discovery. It bounds COHORT SIZE — how many people are in a bucket —
  // and says nothing about how lopsided that bucket's split may be. A
  // bucket sitting exactly on the floor can therefore publish a count of 1
  // for an option, which is one person's answer, disclosed to anyone who
  // already knows the other four. That is the documented k-anonymity
  // residual (D18), not a suppression bug — and the plain `counts` beside
  // it carry the identical property at the identical floor.
  //
  // If this test ever fails, the floor's unit changed. That is a D18
  // reversal and needs the record updated, not a green-again patch.
  it("publishes a lopsided split inside a bucket at the floor", () => {
    const by = {
      city: {
        "Oslo, NO": { "0": 4, "1": 1 },     // 5 — on the floor, 1 is a person
        "Bergen, NO": { "0": 3, "1": 3 },   // 6 — publishable
      },
    };
    const out = publishableBreakdown(by, 5);
    expect(out.city["Oslo, NO"]).toEqual({ "0": 4, "1": 1 });
    // …and the bucket total, not any single option, is what was tested
    // against the floor: a bucket of 4+1 clears it, a bucket of 4 does not.
    const below = { city: { "Oslo, NO": { "0": 4 }, "Bergen, NO": { "0": 9 } } };
    expect(publishableBreakdown(below, 5).city).toBeUndefined();
  });

  it("does not alias the private counts into the published copy", () => {
    const by = { gender: { Women: { "0": 9 }, Men: { "0": 7 } } };
    const out = publishableBreakdown(by, 5);
    out.gender.Women["0"] = 999;
    expect(by.gender.Women["0"]).toBe(9);
  });
});

describe("public-mirror publish cadence", () => {
  // AGG_MIN_N / PUBLISH_EVERY as shipped
  const pub = (total: number) => shouldPublishAgg(total, 5, 5);

  it("publishes nothing below the floor", () => {
    for (let t = 0; t < 5; t++) expect(pub(t)).toBe(false);
  });

  it("publishes on the floor crossing and then every 5th answer", () => {
    expect(pub(5)).toBe(true);
    expect(pub(10)).toBe(true);
    expect(pub(15)).toBe(true);
    expect(pub(100)).toBe(true);
  });

  // The property that closes the disclosure channel: between any two
  // publishes at least `every` answers land, so no observed step is one
  // person. Checked as a gap measurement rather than by spot values —
  // a spot check would survive a policy that publishes per answer above
  // some threshold, which is exactly the bug this replaced.
  it("never lets two publishes be fewer than 5 answers apart, at any size", () => {
    let last = -1;
    let smallestGap = Infinity;
    for (let t = 1; t <= 2000; t++) {
      if (!pub(t)) continue;
      if (last > 0) smallestGap = Math.min(smallestGap, t - last);
      last = t;
    }
    expect(smallestGap).toBe(5);
  });

  it("degrades safely if the floor is not a multiple of the cadence", () => {
    // first publish simply waits for the next multiple — later, never leakier
    expect(shouldPublishAgg(7, 7, 5)).toBe(false);
    expect(shouldPublishAgg(10, 7, 5)).toBe(true);
    // and a cadence of 1 is "publish every answer", the old behaviour,
    // kept expressible so a future operator choosing it does so knowingly
    expect(shouldPublishAgg(6, 5, 1)).toBe(true);
  });
});

describe("the same cadence, applied per bucket (steppedBreakdown)", () => {
  const FLOOR = 5;

  // The trigger's vote-path publish loop (v2.ts), reproduced so the property
  // is asserted against the composition that actually ships rather than
  // against steppedBreakdown alone. Returns every state a client holding an
  // onSnapshot on v2_question_aggs would observe.
  function replay(answers: { anchors: Record<string, string>; optionIdx: number }[]) {
    const by = {};
    let released = {};
    let total = 0;
    const seen: Record<string, Record<string, Record<string, number>>>[] = [];
    for (const a of answers) {
      total += 1;
      foldAnchors(by, a.anchors, a.optionIdx);
      if (total >= FLOOR && shouldPublishAgg(total, FLOOR, FLOOR)) {
        released = steppedBreakdown(by, released, FLOOR);
        seen.push(publishableBreakdown(released, FLOOR));
      }
    }
    return seen;
  }

  it("never moves a published bucket by fewer than the floor", () => {
    // The shape that made this necessary: anchors stay empty until the user
    // fills the Basics card (D8), so a five-answer window routinely carries
    // exactly one anchored answer — and that one answer used to move its
    // bucket, and every dimension of it, by exactly 1.
    const answers: { anchors: Record<string, string>; optionIdx: number }[] = [];
    for (let i = 0; i < 10; i++) answers.push({ anchors: { gender: "f" }, optionIdx: 0 });
    for (let i = 0; i < 10; i++) answers.push({ anchors: { gender: "m" }, optionIdx: 0 });
    for (let i = 0; i < 60; i++) {
      // one anchored answer per window of five
      answers.push({ anchors: { gender: i % 2 ? "f" : "m" }, optionIdx: 1 });
      for (let j = 0; j < 4; j++) answers.push({ anchors: {}, optionIdx: 0 });
    }

    const seen = replay(answers);
    expect(seen.length).toBeGreaterThan(10);

    const totalOf = (cell: Record<string, number>) =>
      Object.keys(cell).reduce((n, k) => n + cell[k], 0);

    let smallestNonZeroStep = Infinity;
    for (let i = 1; i < seen.length; i++) {
      for (const dim of Object.keys(seen[i])) {
        for (const bucket of Object.keys(seen[i][dim])) {
          const prev = seen[i - 1][dim]?.[bucket];
          if (!prev) continue; // first appearance discloses a whole ≥floor cohort
          const step = totalOf(seen[i][dim][bucket]) - totalOf(prev);
          if (step > 0) smallestNonZeroStep = Math.min(smallestNonZeroStep, step);
        }
      }
    }
    // Measured as a minimum over every adjacent pair, not spot-checked: a
    // spot check survives a policy that steps by one past some size, which
    // is the bug this closes.
    expect(smallestNonZeroStep).toBeGreaterThanOrEqual(FLOOR);
  });

  it("re-emits the previous value rather than freezing the document", () => {
    const by = { gender: { f: { "0": 5 } } };
    const released = steppedBreakdown(by, {}, FLOOR);
    expect(released).toEqual({ gender: { f: { "0": 5 } } });

    // one further answer: the bucket must read exactly as it did before
    foldAnchors(by, { gender: "f" }, 1);
    const next = steppedBreakdown(by, released, FLOOR);
    expect(next).toEqual({ gender: { f: { "0": 5 } } });
    expect(next.gender.f["1"]).toBeUndefined();

    // …and once the bucket has gained the floor, the true counts land whole
    for (let i = 0; i < 4; i++) foldAnchors(by, { gender: "f" }, 1);
    expect(steppedBreakdown(by, released, FLOOR)).toEqual({ gender: { f: { "0": 5, "1": 5 } } });
  });

  it("holds one bucket while another moves", () => {
    // Per bucket, not per dimension: a busy cohort must not carry a quiet
    // one past its own step.
    const released = { gender: { f: { "0": 5 }, m: { "0": 5 } } };
    const by = { gender: { f: { "0": 10 }, m: { "0": 6 } } };
    expect(steppedBreakdown(by, released, FLOOR)).toEqual({
      gender: { f: { "0": 10 }, m: { "0": 5 } },
    });
  });

  it("leaves the floor and complementary suppression to publishableBreakdown", () => {
    // steppedBreakdown gates WHEN a value moves, never whether it clears —
    // a sub-floor bucket passes through it and is dropped downstream.
    const stepped = steppedBreakdown({ gender: { f: { "0": 2 } } }, {}, FLOOR);
    expect(stepped).toEqual({ gender: { f: { "0": 2 } } });
    expect(publishableBreakdown(stepped, FLOOR)).toEqual({});
  });
});

describe("catalog answers (pick questions — docs/CATALOG-QUESTIONS.md)", () => {
  const RANGE = { max: 1025 }; // pokemon: CATALOG_MAX_ENTITY as shipped

  it("stores only integer keys inside a contiguous catalogue's range", () => {
    expect(catalogEntityKey(25, RANGE)).toBe("25");
    expect(catalogEntityKey(1025, RANGE)).toBe("1025");
    // 0 is "Not listed" — a real answer, never an entity
    expect(catalogEntityKey(0, RANGE)).toBe("0");
    expect(catalogEntityKey(1026, RANGE)).toBeNull();
    expect(catalogEntityKey(-1, RANGE)).toBeNull();
    expect(catalogEntityKey(25.5, RANGE)).toBeNull();
    expect(catalogEntityKey("25", RANGE)).toBeNull();
    expect(catalogEntityKey(NaN, RANGE)).toBeNull();
    expect(catalogEntityKey(null, RANGE)).toBeNull();
  });

  it("validates sparse QID catalogues by membership, not range", () => {
    // Films/artists keys are Wikidata QID numeric parts (D15). A range
    // bound would admit every integer between two real QIDs, and each
    // junk key an attacker lands mints a private-doc bucket forever.
    const SPARSE = { keys: new Set([47703, 104123, 2831]) };
    expect(catalogEntityKey(47703, SPARSE)).toBe("47703");
    expect(catalogEntityKey(2831, SPARSE)).toBe("2831");
    expect(catalogEntityKey(0, SPARSE)).toBe("0"); // Not listed, every domain
    expect(catalogEntityKey(47704, SPARSE)).toBeNull(); // between real QIDs
    expect(catalogEntityKey(-1, SPARSE)).toBeNull();
    expect(catalogEntityKey(47703.5, SPARSE)).toBeNull();
    // An empty set is a domain whose catalogue is not yet generated:
    // nothing but "Not listed" validates, so nothing aggregates by
    // accident before the operator step (D15).
    const EMPTY = { keys: new Set<number>() };
    expect(catalogEntityKey(47703, EMPTY)).toBeNull();
    expect(catalogEntityKey(0, EMPTY)).toBe("0");
  });

  // The property that makes the canon's floor real rather than decorative.
  it("never leaves exactly one folded entity recoverable by subtraction", () => {
    // Without complementary suppression this would publish {25:20, 6:12}
    // and a reader knowing the total (35) recovers 35-20-12 = 3 — the
    // exact count of the one entity the floor was hiding.
    expect(publishableCanon({ "25": 20, "6": 12, "4": 3 }, 5, 10)).toEqual({
      top: { "25": 20 },
      rest: 15,
    });
    // …and the smallest survivor folds as a whole tie GROUP, or the fold
    // itself would rank equals arbitrarily: here the lone sub-floor entity
    // takes both 6-count entities down with it.
    expect(publishableCanon({ "25": 9, "6": 6, "7": 6, "4": 3 }, 5, 10)).toEqual({
      top: { "25": 9 },
      rest: 15,
    });
  });

  it("publishes nothing finer than the total when the fold empties the board", () => {
    // every entity below the floor
    expect(publishableCanon({ "1": 2, "2": 2, "3": 1 }, 5, 10)).toBeNull();
    // one entity above it, but publishing it names the one below by
    // subtraction, and folding it leaves nothing
    expect(publishableCanon({ "25": 20, "4": 3 }, 5, 10)).toBeNull();
  });

  it("caps at topN and folds boundary ties whole", () => {
    const ent: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) ent[String(i)] = 30 - i; // 29..18, distinct
    const out = publishableCanon(ent, 5, 10);
    expect(out).not.toBeNull();
    expect(Object.keys(out!.top)).toHaveLength(10);
    expect(out!.rest).toBe(19 + 18); // the two beyond the cap
    // Ties at the boundary: with topN 3 over [9,8,7,7], publishing one 7
    // would rank equals arbitrarily — the whole tie group folds.
    expect(publishableCanon({ "1": 9, "2": 8, "3": 7, "4": 7 }, 5, 3)).toEqual({
      top: { "1": 9, "2": 8 },
      rest: 14,
    });
  });

  it("counts 'Not listed' in the fold but never enumerates it", () => {
    // Key "0" dominates here and still must not lead the board; it lands in
    // rest, published as part of one bucket rather than as a standing.
    expect(publishableCanon({ "0": 50, "25": 10, "6": 7 }, 5, 10)).toEqual({
      top: { "25": 10, "6": 7 },
      rest: 50,
    });
  });

  it("publishes a clean board with rest 0 when everything clears", () => {
    expect(publishableCanon({ "25": 10, "6": 7 }, 5, 10)).toEqual({
      top: { "25": 10, "6": 7 },
      rest: 0,
    });
  });

  // Swept rather than spot-checked, like the cadence gap: the suppression
  // arithmetic has enough branches (floor cut, cap cut, tie fold,
  // complementary fold) that a hand-picked case can pass while a
  // neighbouring shape leaks. Every 4-entity board with counts 0..8 is
  // ~6.5k inputs — cheap, and exhaustive over the branch interactions.
  it("holds the invariants across every small board", () => {
    for (let a = 0; a <= 8; a++)
      for (let b = 0; b <= 8; b++)
        for (let c = 0; c <= 8; c++)
          for (let nl = 0; nl <= 8; nl++) {
            const ent = { "1": a, "2": b, "3": c, "0": nl };
            const total = a + b + c + nl;
            const out = publishableCanon(ent, 5, 2);
            if (!out) continue;
            const shown = Object.values(out.top).reduce((x, y) => x + y, 0);
            // nothing invented, nothing lost
            expect(shown + out.rest).toBe(total);
            // every published entity clears the floor
            for (const n of Object.values(out.top)) expect(n).toBeGreaterThanOrEqual(5);
            // never exactly one recoverable hole among the answered,
            // enumerable entities
            const answered = [a, b, c].filter((n) => n > 0).length;
            expect(answered - Object.keys(out.top).length).not.toBe(1);
          }
  });
});

describe("catalog breakdowns — segment orderings of the canon (D17)", () => {
  const anchors = (over: Record<string, unknown> = {}) => ({
    ageBand: "25-34", gender: "Women", country: "NO", ...over,
  });

  it("folds anchors per entity, sharing the vote fold's bucket rules", () => {
    const by = {};
    foldCanonAnchors(by, anchors({ city: "Oslo, NO", profession: "Carpenter" }), "25");
    foldCanonAnchors(by, anchors(), "25");
    foldCanonAnchors(by, anchors({ ageBand: "18-24" }), "6");
    expect(by).toMatchObject({
      ageBand: { "25-34": { "25": 2 }, "18-24": { "6": 1 } },
      gender: { Women: { "25": 2, "6": 1 } },
      city: { "Oslo, NO": { "25": 1 } },
    });
    // profession never mints a key — same closed list as foldAnchors
    expect(Object.keys(by)).not.toContain("profession");
  });

  it("caps distinct entities per cell; known entities keep counting", () => {
    // Options are rules-bounded at 20; entities are not — without this cap
    // one cell could hold the whole catalogue and the document-growth
    // bound collapses. Fill a cell to the cap, then check the cap's two
    // sides: a new entity is dropped, a known one still counts.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (let e = 1; e <= CANON_BY_MAX_ENTITIES; e++) {
      foldCanonAnchors(by, { gender: "Women" }, String(e));
    }
    foldCanonAnchors(by, { gender: "Women" }, "999"); // over the cap: dropped
    foldCanonAnchors(by, { gender: "Women" }, "1");   // known: keeps counting
    const cell = by.gender.Women;
    expect(Object.keys(cell)).toHaveLength(CANON_BY_MAX_ENTITIES);
    expect(cell["999"]).toBeUndefined();
    expect(cell["1"]).toBe(2);
  });

  it("publishes only the board's own entities, then the vote-path rules apply", () => {
    // A segment's local favourite that never made the global board (dex
    // 777) must not exist in the published slice — the D14 arithmetic.
    const entBy = {
      ageBand: {
        "18-24": { "25": 4, "6": 1, "777": 9 },  // shown-total 5 once 777 is gone
        "25-34": { "25": 6, "6": 2 },            // shown-total 8
        "35-44": { "777": 12 },                  // nothing on-board: cell vanishes
      },
    };
    const top = { "25": 30, "6": 11 }; // the published canon
    const out = publishableBreakdown(canonBreakdownFor(entBy, top), 5);
    // Both surviving buckets publish per-entity counts — including a 1
    // inside a ≥5 cohort, which is D8's k-argument, not a leak.
    expect(out).toEqual({
      ageBand: {
        "18-24": { "25": 4, "6": 1 },
        "25-34": { "25": 6, "6": 2 },
      },
    });
  });

  it("suppresses on the SHOWN total — over-suppression is the safe direction", () => {
    // The 18-24 cohort really has 12 answers, but only 3 are for on-board
    // entities; the floor sees 3 and the bucket folds. With one bucket
    // left the dimension cannot show a comparison and is omitted whole.
    const entBy = {
      ageBand: {
        "18-24": { "25": 3, "777": 9 },
        "25-34": { "25": 6 },
      },
    };
    expect(publishableBreakdown(canonBreakdownFor(entBy, { "25": 30 }), 5)).toEqual({});
  });
});

describe("FCM token registration helpers", () => {
  const tok = (n: number, ch = "a") => "iid" + ch.repeat(20) + ":APA91b" + ch.repeat(n);

  it("accepts a realistic token and rejects the garbage classes", () => {
    expect(isPlausibleFcmToken(tok(140))).toBe(true);
    expect(isPlausibleFcmToken("")).toBe(false);
    expect(isPlausibleFcmToken("short:APA91b")).toBe(false); // truncation
    expect(isPlausibleFcmToken("x".repeat(500))).toBe(false); // runaway
    expect(isPlausibleFcmToken(tok(140) + " ")).toBe(false); // whitespace
    expect(isPlausibleFcmToken(tok(140).slice(0, 120) + "\n" + "a".repeat(40))).toBe(false);
    expect(isPlausibleFcmToken(42)).toBe(false);
    expect(isPlausibleFcmToken(null)).toBe(false);
    expect(isPlausibleFcmToken([tok(140)])).toBe(false);
  });

  it("adds a token once, idempotently", () => {
    expect(nextFcmTokens([], "T1", null, 10)).toEqual(["T1"]);
    expect(nextFcmTokens(["T1"], "T1", null, 10)).toEqual(["T1"]);
    expect(nextFcmTokens(["T1", "T2"], "T2", null, 10)).toEqual(["T1", "T2"]);
  });

  it("drops the rotated predecessor in the same step", () => {
    expect(nextFcmTokens(["OLD", "T2"], "NEW", "OLD", 10)).toEqual(["T2", "NEW"]);
    // remove of something absent is a no-op, not an error
    expect(nextFcmTokens(["T2"], "NEW", "GONE", 10)).toEqual(["T2", "NEW"]);
  });

  it("evicts oldest-first past the cap, never the token just registered", () => {
    const cur = ["a", "b", "c"];
    expect(nextFcmTokens(cur, "d", null, 3)).toEqual(["b", "c", "d"]);
    expect(nextFcmTokens(cur, "d", null, 1)).toEqual(["d"]);
  });

  it("treats a corrupt current value as empty rather than throwing", () => {
    expect(nextFcmTokens("not-an-array", "T", null, 10)).toEqual(["T"]);
    expect(nextFcmTokens([1, null, "keep"], "T", null, 10)).toEqual(["keep", "T"]);
  });
});

describe("moderation — queue fold + verdict channel (docs/MODERATION.md)", () => {
  it("queues only takes at the flag threshold, most-flagged first, capped", () => {
    const counts = { a: 5, b: 2, c: 9, d: 3, e: 3 };
    // threshold 3 drops b; ties (d,e) break by id so equal inputs give
    // equal queues; cap 3 folds the tail
    expect(buildModQueueFrom(counts, 3, 3)).toEqual([
      { takeId: "c", flags: 9 },
      { takeId: "a", flags: 5 },
      { takeId: "d", flags: 3 },
    ]);
    expect(buildModQueueFrom(counts, 10, 25)).toEqual([]);
  });

  it("tallies a take whose id is a prototype key, and queues it", () => {
    // takeId is the take's DOCUMENT ID, and firestore.rules lets any circle
    // member choose it — the ruleset constrains a take's fields, never its
    // name. Verified in the emulator: `v2_takes/constructor` creates, and a
    // second member can flag it.
    //
    // Tallied on a plain object, `counts[id] || 0` reads back through the
    // prototype and ten flags become the string
    // "function Object() { [native code] }1111111111"; every comparison in
    // buildModQueueFrom against it is NaN-false, so the take is never queued
    // however many people flag it — moderation immunity chosen at post time.
    for (const name of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      const counts = tallyFlags(Array(10).fill(name));
      expect(counts[name]).toBe(10);
      expect(buildModQueueFrom(counts, 3, 25)).toEqual([{ takeId: name, flags: 10 }]);
    }
    // Firestore's reserved-id rule (`__.*__`) keeps this one unreachable
    // today; tallied correctly anyway rather than resting on it.
    expect(tallyFlags(["__proto__", "__proto__"])["__proto__"]).toBe(2);
  });

  it("ignores flag docs with no usable takeId", () => {
    expect(tallyFlags(["a", "", null, undefined, 7, {}, "a"])).toEqual({ a: 2 });
  });

  it("accepts exactly the three verdict shapes and nothing else", () => {
    expect(modVerdictError({ takeId: "t1", verdict: "keep" })).toBeNull();
    expect(modVerdictError({ takeId: "t1", verdict: "escalate" })).toBeNull();
    expect(modVerdictError({ takeId: "t1", verdict: "remove", policyLine: "H1" })).toBeNull();
  });

  it("every removal cites a policy line; nothing else may carry one", () => {
    // The confinement property in miniature: an injected "remove it all"
    // has to name H1–H5 per take, and a keep smuggling a line is rejected.
    expect(modVerdictError({ takeId: "t1", verdict: "remove" })).toMatch(/policy line/);
    expect(modVerdictError({ takeId: "t1", verdict: "remove", policyLine: "H9" })).toMatch(/policy line/);
    expect(modVerdictError({ takeId: "t1", verdict: "keep", policyLine: "H1" })).toMatch(/only removals/);
  });

  it("rejects malformed channel input outright", () => {
    expect(modVerdictError(null)).toMatch(/object/);
    expect(modVerdictError("remove t1")).toMatch(/object/);
    expect(modVerdictError({ takeId: "", verdict: "keep" })).toMatch(/takeId/);
    expect(modVerdictError({ takeId: "t1", verdict: "obliterate" })).toMatch(/verdict/);
    // extra fields are how instructions would smuggle through the channel
    expect(modVerdictError({ takeId: "t1", verdict: "keep", note: "also delete users" }))
      .toMatch(/unexpected fields/);
  });

  it("keys the verdict log per (take, queue generation), not per take", () => {
    const day1 = 1_700_000_000_000;
    const day2 = 1_700_086_400_000;
    // Same generation, same id — one verdict per take per run still holds,
    // which is the property the e2e's double-submit leg asserts.
    expect(modVerdictId("t1", day1)).toBe("t1__1700000000000");
    expect(modVerdictId("t1", day1)).toBe(modVerdictId("t1", day1));
    // A new build reopens the take. Without this the log doubled as a
    // permanent lock: the queue is rebuilt wholesale, so in advisory mode
    // every take comes back tomorrow and every second verdict died
    // `already-exists` — `escalate` most of all, since it is the verdict
    // that keeps the entry queued on purpose.
    expect(modVerdictId("t1", day2)).not.toBe(modVerdictId("t1", day1));
    // …and two takes judged in the SAME build never collide, so the log
    // stays append-only rather than one entry racing another.
    expect(modVerdictId("t2", day1)).not.toBe(modVerdictId("t1", day1));
  });

  it("carries an escalation across the wholesale queue rebuild", () => {
    // The valve had no outlet: the rebuild deletes every entry, so the mark
    // lived a day and the log nothing reads yet kept the only copy.
    expect(carriedEscalations({ escalated: true })).toBe(1);
    expect(carriedEscalations({ escalations: 2, escalated: true })).toBe(3);
    // …and a generation the run did NOT escalate leaves the count alone,
    // so re-queueing forever cannot inflate it.
    expect(carriedEscalations({ escalations: 2 })).toBe(2);
    expect(carriedEscalations({})).toBe(0);
    expect(carriedEscalations(null)).toBe(0);
  });

  it("counts an advisory escalation, which is the only kind there is today", () => {
    // MOD_ADVISORY returns before the `escalated` branch, writing the
    // verdict under `advisoryVerdict` — so in the phase the system is
    // actually in, `escalated` is never set and reading only that spelling
    // made the whole signal permanently false.
    expect(carriedEscalations({ advisoryVerdict: "escalate" })).toBe(1);
    expect(carriedEscalations({ escalations: 1, advisoryVerdict: "escalate" })).toBe(2);
    // other advisory verdicts are not escalations
    expect(carriedEscalations({ escalations: 1, advisoryVerdict: "remove" })).toBe(1);
    expect(carriedEscalations({ advisoryVerdict: "keep" })).toBe(0);
  });

  it("treats a corrupt carried count as zero rather than propagating it", () => {
    expect(carriedEscalations({ escalations: "3", escalated: true })).toBe(1);
    expect(carriedEscalations({ escalations: -5 })).toBe(0);
    expect(carriedEscalations({ escalations: 1.5, escalated: true })).toBe(1);
    expect(carriedEscalations({ escalations: NaN })).toBe(0);
  });

  it("falls back to the bare takeId when the generation is unknown", () => {
    // Fail-SAFE, not fail-open. A queue entry with no usable `queuedAt`
    // (one written before generations existed) keeps the old id, so a
    // verdict already in the log still blocks a second one. Defaulting the
    // other way would let a missing timestamp re-open a settled take.
    expect(modVerdictId("t1", 0)).toBe("t1");
    expect(modVerdictId("t1", -1)).toBe("t1");
    expect(modVerdictId("t1", NaN)).toBe("t1");
    expect(modVerdictId("t1", Infinity)).toBe("t1");
  });
});

describe("seedDocMatches — the seed's write skip", () => {
  const desired = {
    surface: "daily", seq: 3, type: "binary", domain: null,
    prompt: "Messi or Ronaldo?", options: ["Messi", "Ronaldo"],
    topic: "light", axis: null, test: null,
  };

  it("matches a stored doc that already says the same thing", () => {
    expect(seedDocMatches({ ...desired }, desired)).toBe(true);
  });

  it("ignores fields the seed does not own", () => {
    // `active` is the operational kill switch and `updatedAt` is the
    // cursor the skip exists to keep meaningful. A doc that differs only
    // in those must NOT be rewritten — rewriting it would flip a killed
    // question back on and re-invalidate every client's cache entry.
    expect(seedDocMatches({ ...desired, active: false, updatedAt: 123 }, desired)).toBe(true);
  });

  it("treats a missing doc as a write", () => {
    expect(seedDocMatches(null, desired)).toBe(false);
    expect(seedDocMatches(undefined, desired)).toBe(false);
  });

  it("catches every seeded field changing", () => {
    for (const f of SEEDED_FIELDS) {
      const stored: Record<string, unknown> = { ...desired };
      stored[f] = f === "options" ? ["Messi", "Maradona"] : "CHANGED";
      expect(seedDocMatches(stored, desired), `${f} should force a write`).toBe(false);
    }
  });

  it("compares options element-wise, including order and length", () => {
    expect(seedDocMatches({ ...desired, options: ["Ronaldo", "Messi"] }, desired)).toBe(false);
    expect(seedDocMatches({ ...desired, options: ["Messi"] }, desired)).toBe(false);
    expect(seedDocMatches({ ...desired, options: "Messi,Ronaldo" }, desired)).toBe(false);
  });

  it("upgrades a doc seeded before a field existed", () => {
    // The absent-vs-null distinction is the whole reason this is strict:
    // `domain` was added for D14/D15 and docs seeded before it read back
    // undefined. Those must be rewritten so catalog answers can aggregate.
    const old = { ...desired } as Record<string, unknown>;
    delete old.domain;
    expect(seedDocMatches(old, { ...desired, domain: "pokemon" })).toBe(false);
    // …but a null domain and an absent one describe the same question, so
    // the common case does not churn every doc on every deploy.
    expect(seedDocMatches(old, desired)).toBe(true);
  });
});
