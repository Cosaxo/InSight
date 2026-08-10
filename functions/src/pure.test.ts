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
  scanDays,
  revealMembersFor,
  meetsKFloor,
  breakdownBucket,
  foldAnchors,
  publishableBreakdown,
  publishBreakdown,
  BREAKDOWN_MAX_BUCKETS,
  steppedBreakdown,
  shouldPublishAgg,
  catalogEntityKey,
  publishableCanon,
  buildModQueueFrom,
  tallyFlags,
  tallyFlagsInto,
  carriedEscalations,
  modVerdictError,
  modVerdictId,
  seedDocMatches,
  seedOptionConflict,
  describeSeedOptionConflicts,
  SEEDED_FIELDS,
  foldCanonAnchors,
  canonBreakdownFor,
  CANON_BY_MAX_ENTITIES,
  isPlausibleFcmToken,
  nextFcmTokens,
  duelAggDelta,
  foldDuelAgg,
  shouldPublishDuelAgg,
  publishableDuelAgg,
  revealQid,
  revealVotes,
  votesMatchingQid,
  presenceCellOk,
  presenceNeighbors,
  retargetCounts,
  retargetAnchors,
} from "./pure";
import { AGG_MIN_N, PUBLISH_EVERY } from "./v2";

// The DESIGN floor — what AGG_MIN_N returns to when D81's launch pause
// ends (the shipped value is 1 while it holds; see the cadence suite
// below for the pair). The folds take the k-floor as a parameter because
// the bucket cap now EVICTS a sub-floor bucket to admit a new one, and
// "sub-floor" is the publish path's decision, not the fold's to assume —
// which is also what keeps the floor-5 machinery tested while the shipped
// constant sits at 1.
const FLOOR = 5;

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

// ── which days a reveal run asks about ──────────────────────────

describe("scanDays", () => {
  const T = Date.UTC(2026, 6, 27, 12, 0, 0); // 2026-07-27T12:00Z

  it("covers the whole pending window, not just yesterday", () => {
    // The bug: the scan asked about utcDayKey(-1) and the schedule never
    // passed a day, so a group-day was revealable during the single UTC day
    // after it and never again — while rules accept a duel answer four days
    // late and onV2AnswerCreated re-adds the day to pendingDays whenever one
    // arrives. An answer syncing on D+2 re-opened a day nothing would ask
    // about again. Both members had answered; the day sat pending forever.
    expect(scanDays(undefined, T)).toEqual([
      "2026-07-26", "2026-07-25", "2026-07-24",
      "2026-07-23", "2026-07-22", "2026-07-21",
    ]);
  });

  it("matches the pruning window exactly", () => {
    // prunePendingDays drops anything older than PENDING_DAYS_KEEP, so a day
    // outside this window can never gain another answer. Asking about
    // exactly the days that can still change is the definition pendingDays
    // was given; the two drifting apart is how the gap reopens.
    expect(scanDays(undefined, T)).toHaveLength(PENDING_DAYS_KEEP);
    const oldest = scanDays(undefined, T)[PENDING_DAYS_KEEP - 1];
    expect(prunePendingDays([oldest], "x", oldest)).toEqual([oldest]);
    expect(prunePendingDays([prevDayKey(oldest)], "x", oldest)).toEqual([]);
  });

  it("an explicit day still means that day alone", () => {
    // The operator lever and every e2e leg pass one, and narrowing is what
    // an operator reaching for it during an incident usually wants.
    expect(scanDays("2026-01-01", T)).toEqual(["2026-01-01"]);
  });

  it("crosses a month boundary", () => {
    expect(scanDays(undefined, Date.UTC(2026, 7, 2, 3, 0, 0))).toEqual([
      "2026-08-01", "2026-07-31", "2026-07-30",
      "2026-07-29", "2026-07-28", "2026-07-27",
    ]);
  });
});

// ── who a day's reveal belongs to ───────────────────────────────

describe("revealMembersFor", () => {
  const DAY = "2026-07-27";
  const at = (iso: string) => Date.parse(iso);

  it("excludes someone who joined after the day ended", () => {
    // The leak, exactly: day D is revealed by the D+1 scan, which runs every
    // 120 minutes, so a 00:05 joiner was a current member when the snapshot
    // was taken and read a day they were not in the group for.
    const members = ["old", "latecomer"];
    const joined = {
      old: at("2026-07-20T09:00:00Z"),
      latecomer: at("2026-07-28T00:05:00Z"),
    };
    expect(revealMembersFor(members, joined, DAY)).toEqual(["old"]);
  });

  it("includes someone who joined partway through the day", () => {
    // The bound is the END of the day, not its start — they were there for
    // it, and duel answers stay writable while the day is unrevealed, so
    // they may well have played it.
    const joined = { mid: at("2026-07-27T18:30:00Z") };
    expect(revealMembersFor(["mid"], joined, DAY)).toEqual(["mid"]);
  });

  it("includes a member joining in the last second, and excludes the first second after", () => {
    const joined = {
      justIn: at("2026-07-27T23:59:59.999Z"),
      justOut: at("2026-07-28T00:00:00.000Z"),
    };
    expect(revealMembersFor(["justIn", "justOut"], joined, DAY)).toEqual(["justIn"]);
  });

  it("includes members who predate the field", () => {
    // Not a fallback — the correct answer. createGroupV2/joinGroupV2 write
    // this from the day it shipped, so absence means the member joined
    // before that, which is before any day this is ever asked about.
    // Reading absence as "exclude" would blank every reveal for every group
    // that existed on deploy day.
    expect(revealMembersFor(["a", "b"], {}, DAY)).toEqual(["a", "b"]);
    expect(revealMembersFor(["a", "b"], { a: at("2026-07-01T00:00:00Z") }, DAY))
      .toEqual(["a", "b"]);
  });

  it("includes a member whose recorded time is unusable", () => {
    // Same permissive direction, and for the same reason: a reveal its own
    // members cannot read is a worse failure than one scoped too widely.
    for (const bad of [null, undefined, "2026-07-01", NaN, {}, 0 / 0]) {
      expect(revealMembersFor(["a"], { a: bad }, DAY)).toEqual(["a"]);
    }
  });

  it("includes anyone who played the day, whatever their join time says", () => {
    // Duel answers are accepted up to four days late, so a member can
    // legitimately land a vote for a day preceding their join — an offline
    // client flushing a queue, or a fresh group playing a recent day.
    // Excluding them would publish a reveal holding their own vote that they
    // alone could not read.
    const joined = { player: at("2026-08-01T00:00:00Z"), lurker: at("2026-08-01T00:00:00Z") };
    expect(revealMembersFor(["player", "lurker"], joined, DAY, ["player"]))
      .toEqual(["player"]);
  });

  it("can return an empty array, and says so rather than falling back", () => {
    // Everyone who played the day has left; everyone now in the group joined
    // after it. Nobody was there, so nobody may read it — the reveal still
    // writes, which settles the day for the scan.
    const joined = { newA: at("2026-08-01T00:00:00Z"), newB: at("2026-08-02T00:00:00Z") };
    expect(revealMembersFor(["newA", "newB"], joined, DAY)).toEqual([]);
  });

  it("does not read join times off the prototype", () => {
    // The group document's maps are keyed by uid, and D47 is the record of
    // what a prototype lookup does to a uid-keyed map read from Firestore.
    expect(revealMembersFor(["constructor"], {}, DAY)).toEqual(["constructor"]);
    expect(revealMembersFor(["toString"], {}, DAY)).toEqual(["toString"]);
  });

  it("degrades to the previous behaviour on a malformed day key", () => {
    // Server-generated (utcDayKey), so unreachable in the pipeline.
    const joined = { late: at("2030-01-01T00:00:00Z") };
    expect(revealMembersFor(["late"], joined, "not-a-day")).toEqual(["late"]);
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
  // Real vocabulary values. This fixture said `gender: "Women"` before the
  // vocabulary check existed — a string the profile's <select> has never
  // offered, which is exactly the drift check:anchors now prevents.
  const anchors = (over: Record<string, unknown> = {}) => ({
    ageBand: "25-34", gender: "Woman", country: "NO", ...over,
  });

  it("folds the closed-vocabulary anchors, and ignores junk buckets", () => {
    const by = {};
    foldAnchors(by, anchors({ city: "Oslo, NO", profession: "Carpenter" }), 1, FLOOR);
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
    foldAnchors(junk, { ageBand: "  ", gender: "x".repeat(41), country: "a.b" }, 0, FLOOR);
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
      foldAnchors(by, { city: bad, country: bad }, 0, FLOOR);
    }
    expect(by).toEqual({});

    // …and the canonical forms still land.
    foldAnchors(by, { city: "Oslo, NO", country: "NO" }, 0, FLOOR);
    expect(Object.keys(by).sort()).toEqual(["city", "country"]);

    // A city name may itself contain a comma; the shape anchors on the tail.
    expect(breakdownBucket("Washington, D C, US", "city")).toBe("Washington, D C, US");
    // The dim is optional, and without it neither the shape nor the
    // vocabulary applies — that overload is only reached by callers that do
    // not know which dimension they hold.
    expect(breakdownBucket("oslo")).toBe("oslo");
    // With the dim, the four closed dimensions accept their vocabulary and
    // nothing else. "Women" is the near-miss that matters: it reads like a
    // gender and the profile has never offered it.
    expect(breakdownBucket("Prefer not to say", "gender")).toBe("Prefer not to say");
    expect(breakdownBucket("Women", "gender")).toBeNull();
    expect(breakdownBucket("Doctorate", "education")).toBe("Doctorate");
    expect(breakdownBucket("PhD", "education")).toBeNull();
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
    foldAnchors(by, { gender: "__proto__", ageBand: "constructor" }, 3, FLOOR);
    expect(by).toEqual({});
    expect(before["3"]).toBeUndefined();
    // The consequence the guard exists for, stated as the assertion: an
    // unrelated object must not have grown a vote count.
    expect(({} as Record<string, unknown>)["3"]).toBeUndefined();

    // …and the same for the catalog transpose, which folds the same anchors.
    const entBy = {};
    foldCanonAnchors(entBy, { gender: "__proto__" }, "25", FLOOR);
    expect(entBy).toEqual({});
    expect(({} as Record<string, unknown>)["25"]).toBeUndefined();
  });

  it("holds the bucket cap, on the dimension that can actually reach it", () => {
    // `city` and not `education`: the four <select> dimensions now check
    // membership, and their vocabularies are SHORTER than the cap, so they
    // can no longer reach it at all — which is the point of closing them.
    // 10,929 places against 24 slots is where the cap still bites.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS + 10; i++) {
      foldAnchors(by, { city: `City${i}, NO` }, 0, FLOOR);
    }
    expect(Object.keys(by.city)).toHaveLength(BREAKDOWN_MAX_BUCKETS);
    // A bucket still IN the map keeps incrementing — the cap gates entry,
    // not counting. (City0 is gone by now: 34 arrivals into 24 slots, and
    // among all-equal buckets eviction is oldest-first.)
    const survivor = Object.keys(by.city)[0];
    foldAnchors(by, { city: survivor }, 0, FLOOR);
    expect(by.city[survivor]["0"]).toBe(2);
    // …and the document cannot grow past the cap however many arrive. This
    // is the D7 growth bound, and eviction must not have loosened it.
    for (let i = 100; i < 140; i++) foldAnchors(by, { city: `City${i}, NO` }, 0, FLOOR);
    expect(Object.keys(by.city).length).toBeLessThanOrEqual(BREAKDOWN_MAX_BUCKETS);
  });

  it("a closed vocabulary cannot reach the cap at all", () => {
    // The property that closes the slot-exhaustion hole for four of the six
    // dimensions, asserted as the inequality it actually is: there are fewer
    // legal buckets than slots, so no caller can crowd a real one out.
    // check:anchors holds the same inequality against the client's lists.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (const v of ["Woman", "Man", "Non-binary", "Prefer not to say"]) {
      foldAnchors(by, { gender: v }, 0, FLOOR);
    }
    // …and 200 attempts at anything else buy nothing.
    for (let i = 0; i < 200; i++) foldAnchors(by, { gender: `G${i}` }, 0, FLOOR);
    expect(Object.keys(by.gender).sort())
      .toEqual(["Man", "Non-binary", "Prefer not to say", "Woman"]);
    expect(Object.keys(by.gender).length).toBeLessThan(BREAKDOWN_MAX_BUCKETS);
  });

  it("evicts a sub-floor bucket to admit a new one, and never a published one", () => {
    // The attack the cap used to enable: fill all 24 slots with values that
    // are never published (one answer each), and every real city that
    // arrives afterwards is refused — the dimension is blank for the life of
    // the question, and no vocabulary can stop it because the catalogue is
    // far larger than the cap.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS; i++) {
      foldAnchors(by, { city: `Junk${i}, NO` }, 0, FLOOR);
    }
    expect(Object.keys(by.city)).toHaveLength(BREAKDOWN_MAX_BUCKETS);

    // Real traffic now arrives. Two cities, because publishableBreakdown
    // needs two surviving buckets to call anything a split — one bucket is a
    // population statement, not a comparison.
    for (let i = 0; i < FLOOR; i++) {
      foldAnchors(by, { city: "Oslo, NO" }, 1, FLOOR);
      foldAnchors(by, { city: "Bergen, NO" }, 0, FLOOR);
    }
    // Before this change both were refused outright and `city` published
    // nothing for the life of the question.
    expect(publishableBreakdown(by, FLOOR).city).toEqual({
      "Oslo, NO": { "1": FLOOR },
      "Bergen, NO": { "0": FLOOR },
    });

    // …and once a bucket is publishable it is not evictable, however many
    // new values arrive. A published count that could vanish is a worse
    // failure than a dimension that degrades.
    for (let i = 0; i < 200; i++) foldAnchors(by, { city: `More${i}, NO` }, 0, FLOOR);
    expect(by.city["Oslo, NO"], "a published bucket was evicted").toEqual({ "1": FLOOR });
    expect(by.city["Bergen, NO"], "a published bucket was evicted").toEqual({ "0": FLOOR });
    expect(Object.keys(by.city).length).toBeLessThanOrEqual(BREAKDOWN_MAX_BUCKETS);
  });

  it("refuses a new bucket outright once every slot is publishable", () => {
    // The case the assertion above CANNOT reach, and the one that matters
    // most: while any sub-floor bucket exists it is always the smaller
    // victim, so a published bucket is never even a candidate. Only when
    // every slot is at or above the floor does the floor guard itself decide
    // — and dropping it there would delete counts a reader has already seen.
    //
    // Written after mutating `victimTotal` from `floor` to `Infinity` and
    // watching the whole suite stay green.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS; i++) {
      for (let n = 0; n < FLOOR; n++) foldAnchors(by, { city: `Full${i}, NO` }, 0, FLOOR);
    }
    const before = { ...by.city };
    expect(Object.keys(before)).toHaveLength(BREAKDOWN_MAX_BUCKETS);

    foldAnchors(by, { city: "Newcomer, NO" }, 0, FLOOR);

    expect(by.city["Newcomer, NO"], "a publishable bucket was evicted for a newcomer")
      .toBeUndefined();
    expect(by.city).toEqual(before);
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

// ── the edit delta (D86) ────────────────────────────────────────
//
// An edit is -old/+new with the total unchanged. These pin the two
// properties the trigger leans on: counts refuse to clamp (absence means
// "create not folded yet" and is the retry signal), and the breakdown
// moves a vote only inside cells where the old vote is actually
// represented — bucket totals, the floor's quantity, never move.
describe("retargetCounts / retargetAnchors — the D86 edit delta", () => {
  it("moves one vote between options and keeps the sum", () => {
    const counts = { "0": 3, "1": 2 };
    expect(retargetCounts(counts, 0, 1)).toBe(true);
    expect(counts).toEqual({ "0": 2, "1": 3 });
  });

  it("deletes a zeroed row rather than storing a 0 — the create path's invariant", () => {
    const counts = { "0": 1, "1": 4 };
    expect(retargetCounts(counts, 0, 1)).toBe(true);
    expect(counts).toEqual({ "1": 5 });
    expect("0" in counts).toBe(false);
  });

  it("returns false untouched when the old option holds nothing — the retry signal", () => {
    // The update event beat the create event (Eventarc orders nothing).
    // The map must be left alone: a blind -1/+1 would clamp at zero, and
    // -old/+new only commutes with +old while nothing clamps.
    const counts = { "1": 2 };
    expect(retargetCounts(counts, 0, 1)).toBe(false);
    expect(counts).toEqual({ "1": 2 });
  });

  it("commutes with the create fold when the old option has other votes", () => {
    // Someone else already holds option 0, so an early-delivered edit can
    // proceed; the late create then adds the editor's original +0 and the
    // final state equals the in-order result.
    const early = { "0": 1 };            // another person's vote
    retargetCounts(early, 0, 1);         // edit first
    early["0"] = (early["0"] || 0) + 1;  // create folds afterwards
    const inOrder = { "0": 1 };
    inOrder["0"] = (inOrder["0"] || 0) + 1;  // create first
    retargetCounts(inOrder, 0, 1);           // then edit
    expect(early).toEqual(inOrder);
    expect(early).toEqual({ "0": 1, "1": 1 });
  });

  it("moves the vote in every anchored dim and keeps bucket totals fixed", () => {
    const by = {};
    foldAnchors(by, { ageBand: "25-34", city: "Oslo, NO" }, 0, FLOOR);
    foldAnchors(by, { ageBand: "25-34", city: "Oslo, NO" }, 0, FLOOR);
    retargetAnchors(by, { ageBand: "25-34", city: "Oslo, NO" }, 0, 2);
    expect(by).toEqual({
      ageBand: { "25-34": { "0": 1, "2": 1 } },
      city: { "Oslo, NO": { "0": 1, "2": 1 } },
    });
    // …and a fold followed by a retarget equals folding the new option
    // outright: the roundtrip leaves no residue.
    const edited = {};
    foldAnchors(edited, { ageBand: "25-34" }, 0, FLOOR);
    retargetAnchors(edited, { ageBand: "25-34" }, 0, 1);
    const direct = {};
    foldAnchors(direct, { ageBand: "25-34" }, 1, FLOOR);
    expect(edited).toEqual(direct);
  });

  it("skips a dim whose bucket is gone — increment included", () => {
    // The bucket the create folded into was evicted (or the create-time cap
    // skipped it). Incrementing anyway would inflate the bucket total by an
    // answer that is not in it — the one guarantee the fold keeps.
    const by = { ageBand: { "25-34": { "0": 1 } } };
    retargetAnchors(by, { ageBand: "35-44", city: "Oslo, NO" }, 0, 1);
    expect(by).toEqual({ ageBand: { "25-34": { "0": 1 } } });
  });

  it("skips a dim whose cell lacks the old option — a re-minted bucket", () => {
    // Bucket evicted after the create, then re-minted by other people's
    // answers to OTHER options: the editor's old vote is not represented,
    // so nothing moves and the bucket total stays honest.
    const by = { city: { "Oslo, NO": { "1": 3 } } };
    retargetAnchors(by, { city: "Oslo, NO" }, 0, 1);
    expect(by).toEqual({ city: { "Oslo, NO": { "1": 3 } } });
  });

  it("is a no-op on junk anchors, like the fold it mirrors", () => {
    const by = { ageBand: { "25-34": { "0": 1 } } };
    retargetAnchors(by, null, 0, 1);
    retargetAnchors(by, "not an object", 0, 1);
    retargetAnchors(by, { ageBand: "  ", gender: "Women", city: "oslo" }, 0, 1);
    expect(by).toEqual({ ageBand: { "25-34": { "0": 1 } } });
  });

  it("deletes a zeroed option key inside a cell", () => {
    const by = { gender: { Woman: { "0": 1, "1": 1 } } };
    retargetAnchors(by, { gender: "Woman" }, 0, 1);
    expect(by.gender.Woman).toEqual({ "1": 2 });
    expect("0" in by.gender.Woman).toBe(false);
  });
});

describe("public-mirror publish cadence — the design pair (5, 5), D81's revert target", () => {
  // NOT the shipped constants while the launch pause holds (see the suite
  // below for those). These pin the machinery at the floor it returns to,
  // so flipping D81 back is a two-literal edit and not a re-derivation.
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

describe("public-mirror publish cadence — the constants as shipped (D81 pause)", () => {
  // The launch pause: AGG_MIN_N and PUBLISH_EVERY sit at 1, so counts
  // publish from the first answer and every answer after it. Every observed
  // step IS one person's vote — that is the accepted disclosure D81
  // records, not an oversight this suite failed to catch.
  it("publishes from the first answer while the pause holds", () => {
    expect(shouldPublishAgg(1, AGG_MIN_N, PUBLISH_EVERY)).toBe(true);
    for (let t = 1; t <= 20; t++) {
      expect(shouldPublishAgg(t, AGG_MIN_N, PUBLISH_EVERY), `total ${t}`).toBe(true);
    }
  });

  it("keeps the pair coupled: paused together or restored together", () => {
    // A floor of 1 with a cadence of 5 holds the first four answers hostage
    // for no disclosure gain; the restored floor without the restored
    // cadence re-opens the one-vote-per-step stream D7's amendment closed.
    // Either edit alone fails here and names the other half.
    expect([AGG_MIN_N, PUBLISH_EVERY]).toEqual(AGG_MIN_N === 1 ? [1, 1] : [5, 5]);
  });
});

describe("the same cadence, applied per bucket (steppedBreakdown)", () => {

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
      foldAnchors(by, a.anchors, a.optionIdx, FLOOR);
      if (total >= FLOOR && shouldPublishAgg(total, FLOOR, FLOOR)) {
        // `released` is what was PUBLISHED, matching v2.ts — not what
        // steppedBreakdown returned. Simulating the latter is how this
        // helper agreed with a trigger that could never publish a
        // first-suppressed bucket (see the case below).
        released = publishableBreakdown(steppedBreakdown(by, released, FLOOR), FLOOR);
        seen.push(released);
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
    for (let i = 0; i < 10; i++) answers.push({ anchors: { gender: "Woman" }, optionIdx: 0 });
    for (let i = 0; i < 10; i++) answers.push({ anchors: { gender: "Man" }, optionIdx: 0 });
    for (let i = 0; i < 60; i++) {
      // one anchored answer per window of five
      answers.push({ anchors: { gender: i % 2 ? "Woman" : "Man" }, optionIdx: 1 });
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

  it("a bucket suppressed at first publication is not charged for it", () => {
    // The regression e2e-v2-loop.mjs caught. Two cohorts reach exactly the
    // floor on the publish at total 10, having been below it — and therefore
    // suppressed — at total 5. Measuring the step from steppedBreakdown's own
    // output charged them for a value no reader saw, so they needed TWICE
    // the floor and the breakdown never appeared at all.
    const by = {};
    for (let i = 0; i < 3; i++) foldAnchors(by, { gender: "Woman" }, 1, FLOOR);
    for (let i = 0; i < 2; i++) foldAnchors(by, { gender: "Man" }, 1, FLOOR);

    const atFive = publishableBreakdown(steppedBreakdown(by, {}, FLOOR), FLOOR);
    expect(atFive, "3 and 2 are both under the floor").toEqual({});

    for (let i = 0; i < 2; i++) foldAnchors(by, { gender: "Woman" }, 0, FLOOR);
    for (let i = 0; i < 3; i++) foldAnchors(by, { gender: "Man" }, 0, FLOOR);

    const atTen = publishableBreakdown(steppedBreakdown(by, atFive, FLOOR), FLOOR);
    expect(atTen.gender, "both cohorts reached the floor and still published nothing")
      .toEqual({ Woman: { "0": 2, "1": 3 }, Man: { "0": 3, "1": 2 } });
  });

  it("re-emits the previous value rather than freezing the document", () => {
    const by = { gender: { Woman: { "0": 5 } } };
    const released = steppedBreakdown(by, {}, FLOOR);
    expect(released).toEqual({ gender: { Woman: { "0": 5 } } });

    // one further answer: the bucket must read exactly as it did before
    foldAnchors(by, { gender: "Woman" }, 1, FLOOR);
    const next = steppedBreakdown(by, released, FLOOR);
    expect(next).toEqual({ gender: { Woman: { "0": 5 } } });
    expect(next.gender.Woman["1"]).toBeUndefined();

    // …and once the bucket has gained the floor, the true counts land whole
    for (let i = 0; i < 4; i++) foldAnchors(by, { gender: "Woman" }, 1, FLOOR);
    expect(steppedBreakdown(by, released, FLOOR)).toEqual({ gender: { Woman: { "0": 5, "1": 5 } } });
  });

  it("holds one bucket while another moves", () => {
    // Per bucket, not per dimension: a busy cohort must not carry a quiet
    // one past its own step.
    const released = { gender: { Woman: { "0": 5 }, Man: { "0": 5 } } };
    const by = { gender: { Woman: { "0": 10 }, Man: { "0": 6 } } };
    expect(steppedBreakdown(by, released, FLOOR)).toEqual({
      gender: { Woman: { "0": 10 }, Man: { "0": 5 } },
    });
  });

  it("leaves the floor and complementary suppression to publishableBreakdown", () => {
    // steppedBreakdown gates WHEN a value moves, never whether it clears —
    // a sub-floor bucket passes through it and is dropped downstream.
    const stepped = steppedBreakdown({ gender: { Woman: { "0": 2 } } }, {}, FLOOR);
    expect(stepped).toEqual({ gender: { Woman: { "0": 2 } } });
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
  // Real vocabulary values. This fixture said `gender: "Women"` before the
  // vocabulary check existed — a string the profile's <select> has never
  // offered, which is exactly the drift check:anchors now prevents.
  const anchors = (over: Record<string, unknown> = {}) => ({
    ageBand: "25-34", gender: "Woman", country: "NO", ...over,
  });

  it("folds anchors per entity, sharing the vote fold's bucket rules", () => {
    const by = {};
    foldCanonAnchors(by, anchors({ city: "Oslo, NO", profession: "Carpenter" }), "25", FLOOR);
    foldCanonAnchors(by, anchors(), "25", FLOOR);
    foldCanonAnchors(by, anchors({ ageBand: "18-24" }), "6", FLOOR);
    expect(by).toMatchObject({
      ageBand: { "25-34": { "25": 2 }, "18-24": { "6": 1 } },
      gender: { Woman: { "25": 2, "6": 1 } },
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
      foldCanonAnchors(by, { gender: "Woman" }, String(e), FLOOR);
    }
    foldCanonAnchors(by, { gender: "Woman" }, "999", FLOOR); // over the cap: dropped
    foldCanonAnchors(by, { gender: "Woman" }, "1", FLOOR);   // known: keeps counting
    const cell = by.gender.Woman;
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

  it("folds page by page to the same tally as one pass", () => {
    // v2_flags has no upper bound — MOD_ADVISORY makes the keep-verdict
    // sweep dead code, nothing else deletes a flag, and there is no TTL — so
    // runBuildModQueue pages through it instead of materialising it on a 256
    // MiB instance. The paged fold has to agree with the whole-collection
    // one, including across a page boundary that splits a take's flags.
    const all = ["t1", "t2", "t1", "t3", "t1", "t2", "constructor", "constructor"];
    const paged = new Map<string, number>();
    for (let i = 0; i < all.length; i += 3) {
      tallyFlagsInto(paged, all.slice(i, i + 3));
    }
    expect(Object.fromEntries(paged)).toEqual(tallyFlags(all));
    expect(Object.fromEntries(paged)).toEqual({ t1: 3, t2: 2, t3: 1, constructor: 2 });
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

describe("publishBreakdown — publish and baseline are the same value", () => {
  // The e2e's exact sequence, driven through the one function the trigger
  // calls. Two cohorts sit under the floor at total 5 and reach it at 10.
  it("publishes both cohorts once they reach the floor", () => {
    const by = {};
    for (let i = 0; i < 3; i++) foldAnchors(by, { gender: "Woman" }, 1, FLOOR);
    for (let i = 0; i < 2; i++) foldAnchors(by, { gender: "Man" }, 1, FLOOR);
    const atFive = publishBreakdown(by, {}, FLOOR);
    expect(atFive).toEqual({});

    for (let i = 0; i < 2; i++) foldAnchors(by, { gender: "Woman" }, 0, FLOOR);
    for (let i = 0; i < 3; i++) foldAnchors(by, { gender: "Man" }, 0, FLOOR);
    // Feeding the PREVIOUS return value back in is the whole contract — one
    // value, published and stored, so the caller cannot wire it two ways.
    expect(publishBreakdown(by, atFive, FLOOR).gender)
      .toEqual({ Woman: { "0": 2, "1": 3 }, Man: { "0": 3, "1": 2 } });
  });

  it("still refuses a step smaller than the floor once a bucket is visible", () => {
    const by = {};
    for (let i = 0; i < 5; i++) foldAnchors(by, { gender: "Woman" }, 0, FLOOR);
    for (let i = 0; i < 5; i++) foldAnchors(by, { gender: "Man" }, 0, FLOOR);
    const first = publishBreakdown(by, {}, FLOOR);
    expect(first.gender).toEqual({ Woman: { "0": 5 }, Man: { "0": 5 } });

    foldAnchors(by, { gender: "Woman" }, 1, FLOOR);
    expect(publishBreakdown(by, first, FLOOR).gender, "one vote moved a published bucket")
      .toEqual({ Woman: { "0": 5 }, Man: { "0": 5 } });
  });
});

describe("which question a reveal is published under (revealQid)", () => {
  it("returns the qid when every member answered the same one", () => {
    expect(revealQid(["q-a", "q-a", "q-a"])).toBe("q-a");
  });

  it("returns the qid the MOST members answered, not the first", () => {
    // The drifted client is first in memberUids order. Under the old
    // `qid = qid || s.get("qid")` the whole group's reveal was published
    // under q-drift, and every vote folded into q-drift's aggregate.
    expect(revealQid(["q-drift", "q-real", "q-real", "q-real"])).toBe("q-real");
  });

  it("breaks ties on qid, so member order cannot change the answer", () => {
    expect(revealQid(["q-b", "q-a"])).toBe("q-a");
    expect(revealQid(["q-a", "q-b"])).toBe("q-a");
    // The duo split — one each — is the tie that actually happens.
    expect(revealQid(["q-z", "q-c"])).toBe("q-c");
  });

  it("ignores answers carrying no usable qid, and returns null if none do", () => {
    expect(revealQid([undefined, null, "", 7, "q-a"])).toBe("q-a");
    expect(revealQid([undefined, null, ""])).toBeNull();
    expect(revealQid([])).toBeNull();
  });
});

describe("which votes may be folded into that question (votesMatchingQid)", () => {
  const e = (qid: unknown, optionIdx: number) => ({ qid, vote: { optionIdx } });

  it("keeps only the votes cast on the aggregate's question", () => {
    const entries = [e("q-a", 0), e("q-b", 1), e("q-a", 2)];
    expect(votesMatchingQid(entries, "q-a")).toEqual([{ optionIdx: 0 }, { optionIdx: 2 }]);
  });

  it("preserves order, because duo guesses are scored positionally", () => {
    const entries = [e("q-a", 5), e("q-a", 6)];
    expect(votesMatchingQid(entries, "q-a")).toEqual([{ optionIdx: 5 }, { optionIdx: 6 }]);
  });

  it("folds nothing when there is no question to fold into", () => {
    // Without the `if (!qid) return []` guard this still returned [] for the
    // case above, because no entry's qid equals null. The guard earns its
    // keep only against an entry that carries NO qid — `e.qid === null` would
    // otherwise match and fold a vote into a question that does not exist.
    expect(votesMatchingQid([{ qid: null, vote: { optionIdx: 0 } }], null)).toEqual([]);
    expect(votesMatchingQid([{ qid: undefined, vote: { optionIdx: 0 } }], null)).toEqual([]);
    expect(votesMatchingQid([e("q-a", 0)], null)).toEqual([]);
  });

  it("the split duo contributes one vote, so no guess is scored against a stranger", () => {
    // Partners on different bank revisions. Before the filter this reached
    // duelAggDelta as two votes, and `votes.length === 2` let it score a
    // guess against an answer to a different question.
    // q-z first, so first-wins and plurality-with-lexical-tie-break disagree:
    // first-wins would keep optionIdx 0, this must keep optionIdx 1.
    const entries = [e("q-z", 0), e("q-c", 1)];
    const kept = votesMatchingQid(entries, revealQid(entries.map((x) => x.qid)));
    expect(kept).toEqual([{ optionIdx: 1 }]);
    const d = duelAggDelta(kept, "duo", 2);
    expect(d).toEqual({
      plays: 1, total: 1, counts: { "1": 1 }, guessTotal: 0, guessMatches: 0,
    });
  });

  it("an in-range index from another question would otherwise land in a real bucket", () => {
    // The exact contamination the filter exists for: duelAggDelta's range
    // check cannot see it, because 1 is a legal option of q-a too.
    const entries = [e("q-a", 0), e("q-a", 0), e("q-b", 1)];
    expect(duelAggDelta(entries.map((x) => x.vote), "group", 4).counts)
      .toEqual({ "0": 2, "1": 1 });
    expect(duelAggDelta(votesMatchingQid(entries, "q-a"), "group", 4).counts)
      .toEqual({ "0": 2 });
  });
});

describe("the duel question-level signal (D40 part 3)", () => {
  const v = (optionIdx: number, guessIdx?: number) =>
    guessIdx === undefined ? { optionIdx } : { optionIdx, guessIdx };

  it("folds a group reveal into plays, total and per-option counts", () => {
    const d = duelAggDelta([v(0), v(2), v(0)], "group", 4);
    expect(d).toEqual({
      plays: 1, total: 3, counts: { "0": 2, "2": 1 }, guessTotal: 0, guessMatches: 0,
    });
  });

  it("scores duo guesses against the partner's actual pick", () => {
    // A picked 0 and guessed 1 — B did pick 1, so A called it. B picked 1
    // and guessed 1 — A picked 0, so B missed. Two guesses, one match.
    const d = duelAggDelta([v(0, 1), v(1, 1)], "duo", 2);
    expect(d.guessTotal).toBe(2);
    expect(d.guessMatches).toBe(1);
  });

  it("publishes a pick question as plays and total only — no cross-group counts", () => {
    // optionIdx values index each group's OWN member list (D12: wrong-shaped
    // data is worse than none), so optionCount is 0 and nothing folds.
    const d = duelAggDelta([v(0), v(3), v(1)], "group", 0);
    expect(d.counts).toEqual({});
    expect(d.total).toBe(3);
    expect(publishableDuelAgg(foldDuelAgg(undefined, d))).toEqual({
      plays: 1, total: 3, tooSmall: false,
    });
  });

  it("keeps an out-of-range answer in total but out of counts and guess scoring", () => {
    // The pool-flip race: one partner answered a different question, so the
    // pair did not coherently play this one — their guesses are noise.
    const d = duelAggDelta([v(0, 1), v(7, 0)], "duo", 2);
    expect(d.total).toBe(2);
    expect(d.counts).toEqual({ "0": 1 });
    expect(d.guessTotal).toBe(0);
  });

  it("skips a guess that names no real option, without losing the partner's", () => {
    const d = duelAggDelta([v(0, 9), v(1, 0)], "duo", 2);
    expect(d.guessTotal).toBe(1); // only the in-range guess counts…
    expect(d.guessMatches).toBe(1); // …and it called partner A's 0
  });

  it("accumulates across reveals and tolerates a missing or malformed prior doc", () => {
    const a = foldDuelAgg(undefined, duelAggDelta([v(0), v(1)], "group", 2));
    const b = foldDuelAgg(a, duelAggDelta([v(1), v(1)], "group", 2));
    expect(b).toEqual({
      plays: 2, total: 4, counts: { "0": 1, "1": 3 }, guessTotal: 0, guessMatches: 0,
    });
    const healed = foldDuelAgg(
      { plays: "x", total: null, counts: { "0": "bad", "1": 2 } },
      duelAggDelta([v(0)], "group", 2),
    );
    expect(healed).toEqual({
      plays: 1, total: 1, counts: { "0": 1, "1": 2 }, guessTotal: 0, guessMatches: 0,
    });
  });

  it("publishes on floor and multiple CROSSINGS — batch folds cannot go dark", () => {
    // Below the floor: never.
    expect(shouldPublishDuelAgg(0, 4, 5, 5)).toBe(false);
    // Crossing the floor publishes, even mid-band (4 → 6 skips exactly 5).
    expect(shouldPublishDuelAgg(4, 6, 5, 5)).toBe(true);
    // Inside a band: quiet.
    expect(shouldPublishDuelAgg(6, 9, 5, 5)).toBe(false);
    // Jumping OVER a multiple still publishes — the `% every` cadence the
    // vote path uses would stay silent here, which is the reason this
    // variant exists (a reveal folds a whole group-day at once).
    expect(shouldPublishDuelAgg(6, 12, 5, 5)).toBe(true);
    // Landing exactly on a multiple publishes, like the vote path.
    expect(shouldPublishDuelAgg(9, 10, 5, 5)).toBe(true);
    // No growth, no rewrite.
    expect(shouldPublishDuelAgg(10, 10, 5, 5)).toBe(false);
  });

  it("publishes guess fields only when a guess exists, counts only when any landed", () => {
    // A guessed B would pick 0 (B picked 1 — miss); B guessed A would pick
    // 1 (A picked 0 — miss): two guesses, zero matches.
    const duo = foldDuelAgg(undefined, duelAggDelta([v(0, 0), v(1, 1)], "duo", 2));
    expect(publishableDuelAgg(duo)).toEqual({
      plays: 1, total: 2, tooSmall: false,
      counts: { "0": 1, "1": 1 }, guessTotal: 2, guessMatches: 0,
    });
    const group = foldDuelAgg(undefined, duelAggDelta([v(0)], "group", 2));
    expect(publishableDuelAgg(group)).toEqual({
      plays: 1, total: 1, tooSmall: false, counts: { "0": 1 },
    });
  });
});

// ── D52: shipped option sets are immutable ──────────────────────

describe("seedOptionConflict — the edit the seed must refuse", () => {
  const desired = {
    surface: "daily", seq: 3, type: "binary", domain: null,
    prompt: "Messi or Ronaldo?", options: ["Messi", "Ronaldo"],
    topic: "light", axis: null, test: null,
  };

  it("passes a doc that does not exist yet — a create is never a re-key", () => {
    expect(seedOptionConflict("daily-003", null, desired)).toBeNull();
    expect(seedOptionConflict("daily-003", undefined, desired)).toBeNull();
  });

  it("passes an unchanged option set", () => {
    expect(seedOptionConflict("daily-003", { ...desired }, desired)).toBeNull();
  });

  it("refuses a reorder — the case that changes meaning without changing counts", () => {
    // Every stored answer keeps its optionIdx. Swapping the labels turns
    // every "Messi" vote into a "Ronaldo" vote, and no count moves, so
    // nothing downstream can notice.
    const c = seedOptionConflict("daily-003", { ...desired, options: ["Ronaldo", "Messi"] }, desired);
    expect(c).not.toBeNull();
    expect(c?.qid).toBe("daily-003");
    expect(c?.stored).toEqual(["Ronaldo", "Messi"]);
    expect(c?.desired).toEqual(["Messi", "Ronaldo"]);
  });

  it("refuses a relabel, a removal and an append alike", () => {
    const cases = [
      ["Messi", "CR7"],                     // relabel
      ["Messi"],                            // removal — later indices orphaned
      ["Messi", "Ronaldo", "Maradona"],     // append — changes what the question asked
    ];
    for (const options of cases) {
      expect(
        seedOptionConflict("daily-003", { ...desired, options }, desired),
        `${JSON.stringify(options)} should be refused`,
      ).not.toBeNull();
    }
  });

  it("allows a prompt edit on a live question — D52's own fix shape", () => {
    // D52's fix list is mostly prompt rewrites that preserve meaning
    // ("€500" → "a week's pay"). A prompt carries no index any answer
    // refers to, so it is editable and must stay that way — a guard that
    // blocked it would have blocked the content review it came from.
    const stored = { ...desired, prompt: "Who is better, Messi or Ronaldo?" };
    expect(seedOptionConflict("daily-003", stored, desired)).toBeNull();
    // …and the seed still rewrites it, because this is a separate question
    // from "should we write at all".
    expect(seedDocMatches(stored, desired)).toBe(false);
  });

  it("has nothing to protect when the stored doc has no option array", () => {
    // A question seeded before `options` existed has no vote keyed to an
    // index it never had. Refusing here would wedge the seed permanently.
    const noOptions = { ...desired } as Record<string, unknown>;
    delete noOptions.options;
    expect(seedOptionConflict("daily-003", noOptions, desired)).toBeNull();
    expect(seedOptionConflict("daily-003", { ...desired, options: "Messi,Ronaldo" }, desired)).toBeNull();
  });

  it("describes conflicts in a form an operator can act on", () => {
    const line = describeSeedOptionConflicts([
      { qid: "daily-003", stored: ["Messi", "Ronaldo"], desired: ["Ronaldo", "Messi"] },
      { qid: "f12", stored: ["Yes"], desired: ["Yes", "No"] },
    ]);
    expect(line).toContain("daily-003: [Messi | Ronaldo] -> [Ronaldo | Messi]");
    expect(line).toContain("f12: [Yes] -> [Yes | No]");
  });
});

describe("what the reveal doc records per vote (revealVotes)", () => {
  const en = (uid: string, qid: unknown, optionIdx: number) => ({ uid, qid, vote: { optionIdx } });

  it("writes the pre-D71 document unchanged when everyone answered the same question", () => {
    // The common case by an enormous margin. No stamp anywhere — which is
    // also what makes every reveal written before D71 read correctly.
    expect(revealVotes([en("a", "q-a", 0), en("b", "q-a", 1)], "q-a")).toEqual({
      a: { optionIdx: 0 },
      b: { optionIdx: 1 },
    });
  });

  it("stamps only the answers given to a different question", () => {
    expect(revealVotes([en("a", "q-a", 0), en("b", "q-b", 1)], "q-a")).toEqual({
      a: { optionIdx: 0 },
      b: { optionIdx: 1, qid: "q-b" },
    });
  });

  it("carries the guess through, stamped or not", () => {
    const withGuess = [
      { uid: "a", qid: "q-a", vote: { optionIdx: 0, guessIdx: 1 } },
      { uid: "b", qid: "q-b", vote: { optionIdx: 1, guessIdx: 0 } },
    ];
    expect(revealVotes(withGuess, "q-a")).toEqual({
      a: { optionIdx: 0, guessIdx: 1 },
      b: { optionIdx: 1, guessIdx: 0, qid: "q-b" },
    });
  });

  it("leaves a vote whose qid is missing or unusable unstamped", () => {
    // Nothing to say about it, and a stamp of null/"" would make the card
    // look up a question that cannot exist.
    expect(revealVotes([en("a", null, 0), en("b", "", 1), en("c", 7, 2)], "q-a")).toEqual({
      a: { optionIdx: 0 }, b: { optionIdx: 1 }, c: { optionIdx: 2 },
    });
  });

  it("does not mutate the votes it is given", () => {
    const v = { optionIdx: 0 };
    const out = revealVotes([{ uid: "a", qid: "q-b", vote: v }], "q-a");
    expect(v).toEqual({ optionIdx: 0 });
    expect(out.a).not.toBe(v);
  });

  it("agrees with the fold about who answered what", () => {
    // The two halves of D70/D71 read the same entries and must not disagree:
    // exactly the votes that go unstamped are the votes that get folded.
    const entries = [en("a", "q-a", 0), en("b", "q-b", 1), en("c", "q-a", 1)];
    const qid = revealQid(entries.map((x) => x.qid));
    const doc = revealVotes(entries, qid);
    const folded = votesMatchingQid(entries, qid);
    const unstamped = Object.keys(doc).filter((u) => !("qid" in doc[u]));
    expect(unstamped).toEqual(["a", "c"]);
    expect(folded).toHaveLength(unstamped.length);
  });
});

// ── presence cells (D84) ─────────────────────────────────────────────
//
// The vectors here are duplicated verbatim in src/v2/data/geo.test.ts —
// the two halves of the grid contract are pinned to the same answers, the
// floor.ts drift pattern, because a disagreement fails soft (an empty
// count that reads as "nobody nearby").

describe("presence cells", () => {
  it("accepts legal la_lo ids and refuses everything else", () => {
    expect(presenceCellOk("5999_1074")).toBe(true);   // Oslo-ish
    expect(presenceCellOk("-3373_15121")).toBe(true); // Sydney-ish
    expect(presenceCellOk("0_0")).toBe(true);
    expect(presenceCellOk("8999_-18000")).toBe(true); // last row, date line
    // Beyond the poles / the meridian span.
    expect(presenceCellOk("9000_0")).toBe(false);
    expect(presenceCellOk("-9001_0")).toBe(false);
    expect(presenceCellOk("0_18000")).toBe(false);
    // Shapes that try to smuggle precision or nonsense.
    expect(presenceCellOk("59.99_10.74")).toBe(false);
    expect(presenceCellOk("5999_1074_77")).toBe(false);
    expect(presenceCellOk("abc_def")).toBe(false);
    expect(presenceCellOk("")).toBe(false);
    expect(presenceCellOk(null)).toBe(false);
    expect(presenceCellOk(5999)).toBe(false);
  });

  it("returns the 3×3 neighborhood in the interior", () => {
    const n = presenceNeighbors("5999_1074");
    expect(n).toHaveLength(9);
    expect(n).toContain("5999_1074");
    expect(n).toContain("5998_1073");
    expect(n).toContain("6000_1075");
  });

  it("wraps longitude at the antimeridian instead of walking off it", () => {
    const n = presenceNeighbors("0_-18000");
    expect(n).toHaveLength(9);
    // The western neighbor of the western edge is the eastern edge.
    expect(n).toContain("0_17999");
    expect(n).not.toContain("0_-18001");
  });

  it("drops rows beyond the poles rather than inventing them", () => {
    const n = presenceNeighbors("8999_0");
    expect(n).toHaveLength(6); // no row above the top
    expect(n.every((c) => Number(c.split("_")[0]) <= 8999)).toBe(true);
  });

  it("returns nothing for an illegal cell — the callable's own guard", () => {
    expect(presenceNeighbors("9000_0")).toEqual([]);
    expect(presenceNeighbors("junk")).toEqual([]);
  });
});
