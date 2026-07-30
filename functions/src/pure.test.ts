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
  meetsKFloor,
  breakdownBucket,
  foldAnchors,
  publishableBreakdown,
  BREAKDOWN_MAX_BUCKETS,
  shouldPublishAgg,
  catalogEntityKey,
  publishableCanon,
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
  // residual (D15), not a suppression bug — and the plain `counts` beside
  // it carry the identical property at the identical floor.
  //
  // If this test ever fails, the floor's unit changed. That is a D15
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

describe("catalog answers (pick questions — docs/CATALOG-QUESTIONS.md)", () => {
  const MAX = 1025; // CATALOG_MAX_ENTITY as shipped

  it("stores only integer keys inside the catalogue's domain", () => {
    expect(catalogEntityKey(25, MAX)).toBe("25");
    expect(catalogEntityKey(1025, MAX)).toBe("1025");
    // 0 is "Not listed" — a real answer, never an entity
    expect(catalogEntityKey(0, MAX)).toBe("0");
    expect(catalogEntityKey(1026, MAX)).toBeNull();
    expect(catalogEntityKey(-1, MAX)).toBeNull();
    expect(catalogEntityKey(25.5, MAX)).toBeNull();
    expect(catalogEntityKey("25", MAX)).toBeNull();
    expect(catalogEntityKey(NaN, MAX)).toBeNull();
    expect(catalogEntityKey(null, MAX)).toBeNull();
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
