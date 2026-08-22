// pure.test.ts — unit tests for the pure helpers. No emulator, no
// firebase: everything under test is deterministic given its inputs.

import { describe, it, expect } from "vitest";
import {
  CODE_ALPHABET,
  HANDLE_MAX,
  HANDLE_MIN,
  inviteCodeFromBytes,
  normalizeHandle,
  RESERVED_HANDLES,
  utcDayKey,
  prevDayKey,
  shouldReveal,
  movesPresentState,
  nextStreak,
  PENDING_DAYS_KEEP,
  prunePendingDays,
  scanDays,
  revealMembersFor,
  breakdownBucket,
  foldAnchors,
  BREAKDOWN_MAX_BUCKETS,
  catalogEntityKey,
  buildModQueueFrom,
  tallyFirstFlagInto,
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
  canonTopN,
  canonBreakdownFor,
  CANON_BY_MAX_ENTITIES,
  isPlausibleFcmToken,
  nextFcmTokens,
  duelAggDelta,
  foldDuelAgg,
  publishableDuelAgg,
  revealQid,
  revealVotes,
  votesMatchingQid,
  ROOM_MIN_TYPED,
  ROOM_SAMPLE_CAP,
  ROOM_QUESTION_CAP,
  roomQids,
  tallyPicks,
  roomMix,
  presenceCellOk,
  presenceNeighbors,
  retargetCounts,
  retargetAnchors,
  foldEditFlow,
} from "./pure";

// The bucket-churn threshold (pure.ts BUCKET_EVICT_BELOW). Not a
// disclosure floor — D98 removed those; this is the document-growth
// bound that keeps a junk-value burst from blanking a dimension.
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

describe("movesPresentState — which day may claim to be the present", () => {
  it("lets a newer day move the streak and lastRevealDay", () => {
    expect(movesPresentState("2026-07-26", "2026-07-27")).toBe(true);
    expect(movesPresentState("2026-07-20", "2026-07-27")).toBe(true);
  });

  it("refuses a day the group has already moved past", () => {
    // THE regression. scanDays() walks the pending window newest-first and
    // revealDuelsNowV2 defaults to `full` over six days, so a run routinely
    // reveals yesterday and THEN reaches an older day still pending. That
    // older reveal used to write lastRevealDay backwards and recompute the
    // streak from it — nextStreak("2026-07-27", "2026-07-25", 40) is 1,
    // because the 27th is not the day before the 25th. A duo watched a
    // 40-day streak become 1 for having a gap filled in.
    expect(movesPresentState("2026-07-27", "2026-07-25")).toBe(false);
    expect(nextStreak("2026-07-27", "2026-07-25", 40)).toBe(1);  // why it matters
  });

  it("refuses the same day twice", () => {
    // Belt to the reveal path's own `lastRevealDay === dayKey` early return:
    // a re-reveal must not extend a streak it already counted.
    expect(movesPresentState("2026-07-27", "2026-07-27")).toBe(false);
  });

  it("lets the first ever reveal through, whatever the field holds", () => {
    expect(movesPresentState(null, "2026-07-27")).toBe(true);
    expect(movesPresentState(undefined, "2026-07-27")).toBe(true);
    expect(movesPresentState("", "2026-07-27")).toBe(true);
    // A group written before the field existed, or one whose field was
    // corrupted to a non-string: treated as "never revealed" rather than
    // compared with >, which would be a string/number comparison returning
    // false and freezing the streak forever.
    expect(movesPresentState(42 as unknown as string, "2026-07-27")).toBe(true);
  });

  it("orders by date, which for YYYY-MM-DD is the string order", () => {
    // The whole predicate rests on this. Across a month and a year end,
    // where a naive day-number comparison would be the tempting mistake.
    expect(movesPresentState("2026-07-31", "2026-08-01")).toBe(true);
    expect(movesPresentState("2026-08-01", "2026-07-31")).toBe(false);
    expect(movesPresentState("2026-12-31", "2027-01-01")).toBe(true);
    expect(movesPresentState("2027-01-01", "2026-12-31")).toBe(false);
  });
});

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

  it("holds the bucket cap, on the dimension that can actually reach it", () => {
    // `city` and not `education`: the four <select> dimensions now check
    // membership, and their vocabularies are SHORTER than the cap, so they
    // can no longer reach it at all — which is the point of closing them.
    // 10,929 places against 24 slots is where the cap still bites.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (let i = 0; i < BREAKDOWN_MAX_BUCKETS + 10; i++) {
      foldAnchors(by, { city: `City${i}, NO` }, 0);
    }
    expect(Object.keys(by.city)).toHaveLength(BREAKDOWN_MAX_BUCKETS);
    // A bucket still IN the map keeps incrementing — the cap gates entry,
    // not counting. (City0 is gone by now: 34 arrivals into 24 slots, and
    // among all-equal buckets eviction is oldest-first.)
    const survivor = Object.keys(by.city)[0];
    foldAnchors(by, { city: survivor }, 0);
    expect(by.city[survivor]["0"]).toBe(2);
    // …and the document cannot grow past the cap however many arrive. This
    // is the D7 growth bound, and eviction must not have loosened it.
    for (let i = 100; i < 140; i++) foldAnchors(by, { city: `City${i}, NO` }, 0);
    expect(Object.keys(by.city).length).toBeLessThanOrEqual(BREAKDOWN_MAX_BUCKETS);
  });

  it("a closed vocabulary cannot reach the cap at all", () => {
    // The property that closes the slot-exhaustion hole for four of the six
    // dimensions, asserted as the inequality it actually is: there are fewer
    // legal buckets than slots, so no caller can crowd a real one out.
    // check:anchors holds the same inequality against the client's lists.
    const by: Record<string, Record<string, Record<string, number>>> = {};
    for (const v of ["Woman", "Man", "Non-binary", "Prefer not to say"]) {
      foldAnchors(by, { gender: v }, 0);
    }
    // …and 200 attempts at anything else buy nothing.
    for (let i = 0; i < 200; i++) foldAnchors(by, { gender: `G${i}` }, 0);
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
      foldAnchors(by, { city: `Junk${i}, NO` }, 0);
    }
    expect(Object.keys(by.city)).toHaveLength(BREAKDOWN_MAX_BUCKETS);

    // Real traffic now arrives. Two cities, so the churn has something to
    // prefer over the junk.
    for (let i = 0; i < FLOOR; i++) {
      foldAnchors(by, { city: "Oslo, NO" }, 1);
      foldAnchors(by, { city: "Bergen, NO" }, 0);
    }
    // Before the eviction rule existed both were refused outright and
    // `city` stayed blank for the life of the question.
    expect(by.city["Oslo, NO"]).toEqual({ "1": FLOOR });
    expect(by.city["Bergen, NO"]).toEqual({ "0": FLOOR });

    // …and once a bucket reaches BUCKET_EVICT_BELOW it is not evictable,
    // however many new values arrive. A published count that could vanish
    // is a worse failure than a dimension that degrades.
    for (let i = 0; i < 200; i++) foldAnchors(by, { city: `More${i}, NO` }, 0);
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
      for (let n = 0; n < FLOOR; n++) foldAnchors(by, { city: `Full${i}, NO` }, 0);
    }
    const before = { ...by.city };
    expect(Object.keys(before)).toHaveLength(BREAKDOWN_MAX_BUCKETS);

    foldAnchors(by, { city: "Newcomer, NO" }, 0);

    expect(by.city["Newcomer, NO"], "a publishable bucket was evicted for a newcomer")
      .toBeUndefined();
    expect(by.city).toEqual(before);
  });

  // The five publishableBreakdown cases that stood here — sub-floor
  // suppression, complementary suppression, the two-bucket minimum, the
  // lopsided-split carve-out and the defensive copy — went with the
  // function itself (D98). pure.ts keeps the record of what each one
  // defended; there is no publishable view left to test.
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
    foldAnchors(by, { ageBand: "25-34", city: "Oslo, NO" }, 0);
    foldAnchors(by, { ageBand: "25-34", city: "Oslo, NO" }, 0);
    retargetAnchors(by, { ageBand: "25-34", city: "Oslo, NO" }, 0, 2);
    expect(by).toEqual({
      ageBand: { "25-34": { "0": 1, "2": 1 } },
      city: { "Oslo, NO": { "0": 1, "2": 1 } },
    });
    // …and a fold followed by a retarget equals folding the new option
    // outright: the roundtrip leaves no residue.
    const edited = {};
    foldAnchors(edited, { ageBand: "25-34" }, 0);
    retargetAnchors(edited, { ageBand: "25-34" }, 0, 1);
    const direct = {};
    foldAnchors(direct, { ageBand: "25-34" }, 1);
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

// The counts commute (-old/+new against +old); the matrix only ever grows,
// because a move is an event that happened rather than a state to keep in
// balance — so what these pin is the growth arithmetic and the "moves, not
// people" shape a report will read.
describe("foldEditFlow — the D226 edit-flow matrix", () => {
  it("mints the from-row and counts the first move", () => {
    const edits = {};
    foldEditFlow(edits, 1, 0);
    expect(edits).toEqual({ "1": { "0": 1 } });
  });

  it("accumulates repeat moves in one cell and fans out per destination", () => {
    const edits = {};
    foldEditFlow(edits, 1, 0);
    foldEditFlow(edits, 1, 0);
    foldEditFlow(edits, 1, 2);
    expect(edits).toEqual({ "1": { "0": 2, "2": 1 } });
  });

  it("counts moves rather than people — a two-step journey leaves two cells", () => {
    // One person voting 0→1 then 1→2 is two trigger deliveries, and the
    // matrix records both: stitching them into one 0→2 journey would need
    // the per-answer receipt the fold deliberately does not keep.
    const edits = {};
    foldEditFlow(edits, 0, 1);
    foldEditFlow(edits, 1, 2);
    expect(edits).toEqual({ "0": { "1": 1 }, "1": { "2": 1 } });
  });

  it("keys cells the way the sibling maps do — strings, minted on demand", () => {
    const edits = { "3": { "0": 4 } };
    foldEditFlow(edits, 3, 0);
    foldEditFlow(edits, 0, 3);
    expect(edits).toEqual({ "3": { "0": 5 }, "0": { "3": 1 } });
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

  // D98: no floor, no complementary fold, no tie fold. `rest` is the tail
  // outside the top N and nothing else. The three cases that used to live
  // here — recoverable-hole folding, whole-tie-group folding, and the
  // null board when suppression emptied it — went with publishableCanon.
  it("publishes every answered entity, at any count", () => {
    expect(canonTopN({ "25": 20, "6": 12, "4": 3 }, 10)).toEqual({
      top: { "25": 20, "6": 12, "4": 3 },
      rest: 0,
    });
    // A one-vote entity is as publishable as a twenty-vote one.
    expect(canonTopN({ "1": 2, "2": 2, "3": 1 }, 10)).toEqual({
      top: { "1": 2, "2": 2, "3": 1 },
      rest: 0,
    });
  });

  it("caps at topN and puts the remainder in rest", () => {
    const ent: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) ent[String(i)] = 30 - i; // 29..18, distinct
    const out = canonTopN(ent, 10);
    expect(Object.keys(out.top)).toHaveLength(10);
    expect(out.rest).toBe(19 + 18); // the two beyond the cap
    // A boundary tie is now cut by the cap like anything else — equals may
    // land on opposite sides, which is a display-ordering wrinkle rather
    // than the disclosure problem the whole-group fold existed for.
    expect(canonTopN({ "1": 9, "2": 8, "3": 7, "4": 7 }, 3)).toEqual({
      top: { "1": 9, "2": 8, "3": 7 },
      rest: 7,
    });
  });

  it("counts 'Not listed' in the fold but never enumerates it", () => {
    // Key "0" dominates here and still must not lead the board; it lands in
    // rest, published as part of one bucket rather than as a standing.
    expect(canonTopN({ "0": 50, "25": 10, "6": 7 }, 10)).toEqual({
      top: { "25": 10, "6": 7 },
      rest: 50,
    });
  });

  it("publishes a clean board with rest 0 when everything clears", () => {
    expect(canonTopN({ "25": 10, "6": 7 }, 10)).toEqual({
      top: { "25": 10, "6": 7 },
      rest: 0,
    });
  });

  // Swept rather than spot-checked. Only one invariant survives D98 — the
  // conservation one — but it is the one that matters: a board plus its
  // rest must still account for every answer, or the leaderboard is
  // inventing or losing votes. Every 4-entity board with counts 0..8 is
  // ~6.5k inputs, cheap and exhaustive over the branches.
  it("holds the invariants across every small board", () => {
    for (let a = 0; a <= 8; a++)
      for (let b = 0; b <= 8; b++)
        for (let c = 0; c <= 8; c++)
          for (let nl = 0; nl <= 8; nl++) {
            const ent = { "1": a, "2": b, "3": c, "0": nl };
            const total = a + b + c + nl;
            const out = canonTopN(ent, 2);
            const shown = Object.values(out.top).reduce((x, y) => x + y, 0);
            // nothing invented, nothing lost
            expect(shown + out.rest).toBe(total);
            // the cap is a cap
            expect(Object.keys(out.top).length).toBeLessThanOrEqual(2);
            // "Not listed" never takes a standing
            expect("0" in out.top).toBe(false);
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
    foldCanonAnchors(by, anchors({ city: "Oslo, NO", profession: "Carpenter" }), "25");
    foldCanonAnchors(by, anchors(), "25");
    foldCanonAnchors(by, anchors({ ageBand: "18-24" }), "6");
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
      foldCanonAnchors(by, { gender: "Woman" }, String(e));
    }
    foldCanonAnchors(by, { gender: "Woman" }, "999"); // over the cap: dropped
    foldCanonAnchors(by, { gender: "Woman" }, "1");   // known: keeps counting
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
    const out = canonBreakdownFor(entBy, top);
    // Every surviving cell publishes whole (D98). The 35-44 bucket still
    // vanishes, and for a reason that is not disclosure: none of its
    // answers are for an entity on the board, so it has no ordering to
    // show.
    expect(out).toEqual({
      ageBand: {
        "18-24": { "25": 4, "6": 1 },
        "25-34": { "25": 6, "6": 2 },
      },
    });
  });

  it("keeps a thin bucket rather than folding it", () => {
    // The 18-24 cohort has 12 answers but only 3 for on-board entities.
    // The floor used to see 3, fold the bucket, then omit the whole
    // dimension for having one bucket left. Both rules are gone: a
    // three-answer segment ordering is a real, if small, thing to show.
    const entBy = {
      ageBand: {
        "18-24": { "25": 3, "777": 9 },
        "25-34": { "25": 6 },
      },
    };
    expect(canonBreakdownFor(entBy, { "25": 30 })).toEqual({
      ageBand: { "18-24": { "25": 3 }, "25-34": { "25": 6 } },
    });
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

  it("breaks a tie on the earliest flag, not on the client-chosen id", () => {
    // The control, not a nicety. At the floor most takes sit on exactly
    // minFlags, so the tie-break decides the whole queue below the busy
    // head — and a world take's id is `qid + "_" + uid` with qid a free
    // 1-120 char string, so id-ascending let anyone mint `!`-prefixed ids
    // and sort to the front of every generation for three flags each.
    const counts = { "!squat": 3, honest: 3, older: 3 };
    const firstAt = new Map([["!squat", 3_000], ["honest", 2_000], ["older", 1_000]]);
    expect(buildModQueueFrom(counts, 3, 25, firstAt).map((r) => r.takeId))
      .toEqual(["older", "honest", "!squat"]);
    // …and without the map it is the old order, which is what the squatter
    // was buying.
    expect(buildModQueueFrom(counts, 3, 25).map((r) => r.takeId))
      .toEqual(["!squat", "honest", "older"]);
  });

  it("keeps flag count ahead of age, and stays a total order without stamps", () => {
    // Age breaks TIES; it does not outrank the count. A take flagged once
    // long ago must not precede one flagged nine times this morning.
    const counts = { old1: 3, hot: 9 };
    const firstAt = new Map([["old1", 1], ["hot", 9_999]]);
    expect(buildModQueueFrom(counts, 3, 25, firstAt).map((r) => r.takeId))
      .toEqual(["hot", "old1"]);
    // Two takes with no usable stamp are both Infinity. Subtracting would
    // give NaN and fall through to the id compare by accident; comparing
    // gives 0 and falls through by decision. Same result, and the reason
    // the comparator is written the way it is.
    const nostamp = buildModQueueFrom({ b: 3, a: 3 }, 3, 25, new Map());
    expect(nostamp.map((r) => r.takeId)).toEqual(["a", "b"]);
  });

  it("folds the earliest flag per take and ignores unusable stamps", () => {
    const firstAt = tallyFirstFlagInto(new Map(), [
      { takeId: "t", at: 500 },
      { takeId: "t", at: 200 },   // earlier wins
      { takeId: "t", at: 900 },
      { takeId: "u", at: undefined },  // pre-`at` flag: skipped, not 0
      { takeId: "u", at: "nope" },     // non-numeric: skipped
      { takeId: "", at: 1 },           // no take: skipped
      { takeId: 7, at: 1 },            // not a string: skipped
    ]);
    expect(firstAt.get("t")).toBe(200);
    // Skipped rather than defaulted — a 0 would sort `u` to the FRONT of
    // its tie, which is the opposite of what an unknown age deserves.
    expect(firstAt.has("u")).toBe(false);
    expect(firstAt.size).toBe(1);
  });

  it("does not let a settled target's flags rank it forever", () => {
    // The queue-starvation shape, at the level this module can see it: the
    // fold has no idea a take is hidden, so `k` here is a CANDIDATE window
    // and moderation.ts stops at the real size once it has that many live
    // entries. Cutting to the size here handed the dead ones' slots to
    // nobody. Twenty-five settled takes at the top and a window of 25
    // returns exactly the twenty-five that will all be skipped.
    const counts: Record<string, number> = {};
    for (let i = 0; i < 25; i++) counts[`settled${i}`] = 9;
    counts.live = 3;
    expect(buildModQueueFrom(counts, 3, 25).map((r) => r.takeId)).not.toContain("live");
    // With the window, the live take is reachable behind them.
    expect(buildModQueueFrom(counts, 3, 100).map((r) => r.takeId)).toContain("live");
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

  // Crossroads (D136) put OBJECTS in SEEDED_FIELDS for the first time.
  // Before the structural arm they compared by reference, so both path docs
  // read as changed on every seed run — a rewrite of live question docs,
  // reported as legitimate content drift, forever.
  describe("the story fields (D136)", () => {
    const story = {
      nodes: { "": { q: "A fork", a: [{ t: "left" }, { t: "right" }] } },
      endings: { AAA: { name: "An End", line: "It ends." } },
    };
    const withStory = { ...desired, ...story };

    it("matches an identical tree without rewriting it", () => {
      // Fresh object literals, not the same references — which is exactly
      // what a Firestore read gives back.
      expect(seedDocMatches({
        ...withStory,
        nodes: { "": { q: "A fork", a: [{ t: "left" }, { t: "right" }] } },
        endings: { AAA: { name: "An End", line: "It ends." } },
      }, withStory)).toBe(true);
    });

    it("ignores key order, because Firestore does not promise it", () => {
      expect(seedDocMatches({
        ...withStory,
        endings: { AAA: { line: "It ends.", name: "An End" } },
      }, withStory)).toBe(true);
    });

    it("catches an edit anywhere in the tree", () => {
      const changed = (nodes) => seedDocMatches({ ...withStory, nodes }, withStory);
      // a reworded fork…
      expect(changed({ "": { q: "A DIFFERENT fork", a: [{ t: "left" }, { t: "right" }] } })).toBe(false);
      // …a reworded choice…
      expect(changed({ "": { q: "A fork", a: [{ t: "LEFT" }, { t: "right" }] } })).toBe(false);
      // …a dropped choice…
      expect(changed({ "": { q: "A fork", a: [{ t: "left" }] } })).toBe(false);
      // …and a dropped node.
      expect(seedDocMatches({ ...withStory, nodes: {} }, withStory)).toBe(false);
      // An ending's line is prose too, and it is on the card.
      expect(seedDocMatches({
        ...withStory, endings: { AAA: { name: "An End", line: "It ends DIFFERENTLY." } },
      }, withStory)).toBe(false);
    });

    it("refuses a tree that is not an object at all", () => {
      expect(seedDocMatches({ ...withStory, nodes: "a fork" }, withStory)).toBe(false);
      expect(seedDocMatches({ ...withStory, nodes: [] }, withStory)).toBe(false);
      expect(seedDocMatches({ ...withStory, nodes: null }, withStory)).toBe(false);
    });
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
      plays: 1, total: 3,
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

  // The crossing-based publish cadence (shouldPublishDuelAgg) was tested
  // here. D98 removed it — every fold publishes — so there is no cadence
  // left to have an off-by-one in.

  it("publishes guess fields only when a guess exists, counts only when any landed", () => {
    // A guessed B would pick 0 (B picked 1 — miss); B guessed A would pick
    // 1 (A picked 0 — miss): two guesses, zero matches.
    const duo = foldDuelAgg(undefined, duelAggDelta([v(0, 0), v(1, 1)], "duo", 2));
    expect(publishableDuelAgg(duo)).toEqual({
      plays: 1, total: 2,
      counts: { "0": 1, "1": 1 }, guessTotal: 2, guessMatches: 0,
    });
    const group = foldDuelAgg(undefined, duelAggDelta([v(0)], "group", 2));
    expect(publishableDuelAgg(group)).toEqual({
      plays: 1, total: 1, counts: { "0": 1 },
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
    expect(presenceCellOk("29999_5374")).toBe(true);  // Oslo-ish
    expect(presenceCellOk("-16866_75608")).toBe(true); // Sydney-ish
    expect(presenceCellOk("0_0")).toBe(true);
    expect(presenceCellOk("44999_-90000")).toBe(true); // last row, date line
    // Beyond the poles / the meridian span.
    expect(presenceCellOk("45000_0")).toBe(false);
    expect(presenceCellOk("-45001_0")).toBe(false);
    expect(presenceCellOk("0_90000")).toBe(false);
    // Shapes that try to smuggle precision or nonsense.
    expect(presenceCellOk("59.99_10.74")).toBe(false);
    expect(presenceCellOk("29999_5374_77")).toBe(false);
    expect(presenceCellOk("abc_def")).toBe(false);
    expect(presenceCellOk("")).toBe(false);
    expect(presenceCellOk(null)).toBe(false);
    expect(presenceCellOk(29999)).toBe(false);
  });

  it("returns the 3×3 neighborhood in the interior", () => {
    const n = presenceNeighbors("29999_5374");
    expect(n).toHaveLength(9);
    expect(n).toContain("29999_5374");
    expect(n).toContain("29998_5373");
    expect(n).toContain("30000_5375");
  });

  it("wraps longitude at the antimeridian instead of walking off it", () => {
    const n = presenceNeighbors("0_-90000");
    expect(n).toHaveLength(9);
    // The western neighbor of the western edge is the eastern edge.
    expect(n).toContain("0_89999");
    expect(n).not.toContain("0_-90001");
  });

  it("drops rows beyond the poles rather than inventing them", () => {
    const n = presenceNeighbors("44999_0");
    expect(n).toHaveLength(6); // no row above the top
    expect(n.every((c) => Number(c.split("_")[0]) <= 44999)).toBe(true);
  });

  it("returns nothing for an illegal cell — the callable's own guard", () => {
    expect(presenceNeighbors("45000_0")).toEqual([]);
    expect(presenceNeighbors("junk")).toEqual([]);
  });
});

// ── handles (D122) ────────────────────────────────────────────────
//
// The uniqueness registry is keyed on whatever this function returns, so
// every case below is really one claim: two people who think they typed
// the same handle must land on the same key, and two people who think
// they typed different ones must not.

describe("normalizeHandle", () => {
  it("folds the ways one handle gets typed onto one key", () => {
    for (const raw of ["olaf", "Olaf", "OLAF", "@olaf", " @Olaf ", "@@olaf"]) {
      expect(normalizeHandle(raw), `"${raw}"`).toBe("olaf");
    }
  });

  it("accepts letters, digits and underscore, and nothing else", () => {
    expect(normalizeHandle("olaf_2")).toBe("olaf_2");
    expect(normalizeHandle("a1_b2")).toBe("a1_b2");
    // The rejected set is the point: a dot is a Firestore path segment, a
    // slash is a path separator, and everything non-ASCII is where the
    // industrial-grade lookalikes live.
    for (const bad of ["ol.af", "ol/af", "ol af", "ol-af", "olaf!", "ólaf", "оlaf", "olaf​"]) {
      expect(normalizeHandle(bad), `"${bad}" was accepted`).toBeNull();
    }
  });

  it("holds the length bounds at both ends", () => {
    expect(normalizeHandle("a".repeat(HANDLE_MIN - 1))).toBeNull();
    expect(normalizeHandle("a".repeat(HANDLE_MIN))).toBe("a".repeat(HANDLE_MIN));
    expect(normalizeHandle("a".repeat(HANDLE_MAX))).toBe("a".repeat(HANDLE_MAX));
    expect(normalizeHandle("a".repeat(HANDLE_MAX + 1))).toBeNull();
    // …and measures the CANONICAL form, not the typed one: "@" and the
    // spaces around it are not part of the handle, so a name at the limit
    // must not be refused for the sigil someone typed in front of it.
    expect(normalizeHandle(` @${"a".repeat(HANDLE_MAX)} `)).toBe("a".repeat(HANDLE_MAX));
  });

  it("refuses an all-digit handle — that reads as an id, not a name", () => {
    expect(normalizeHandle("12345")).toBeNull();
    // One letter is enough to make it a name again.
    expect(normalizeHandle("12345a")).toBe("12345a");
  });

  it("refuses the reserved names, sigil and casing included", () => {
    // An account called `insight` or `support` is a phishing kit, and one
    // called `join` collides with the app's own URL segments.
    for (const word of ["insight", "admin", "support", "join", "privacy", "me"]) {
      expect(RESERVED_HANDLES.has(word), `${word} is not on the list`).toBe(true);
      expect(normalizeHandle(word), `"${word}" was claimable`).toBeNull();
      expect(normalizeHandle(`@${word.toUpperCase()}`), `"@${word.toUpperCase()}" got through`).toBeNull();
    }
  });

  it("returns null for anything that is not a string", () => {
    // The callable hands this `request.data?.handle` straight from the
    // wire, so every shape a JSON body can carry has to land on null
    // rather than on a throw or a coerced key.
    for (const bad of [undefined, null, 42, {}, [], true, { toString: () => "olaf" }]) {
      expect(normalizeHandle(bad as unknown), String(bad)).toBeNull();
    }
  });
});

// ── the room's mix (D176) ────────────────────────────────────────────
//
// The fold behind "mostly Hosts and Explorers". What it must NOT do is
// most of the value: no shares, a floor, and an order that does not
// flicker — each of those is a differencing defence, not a style choice.
describe("roomMix", () => {
  const many = (name: string, k: number) => Array.from({ length: k }, () => name);

  it("ranks the types present, most common first", () => {
    const m = roomMix([...many("Host", 5), ...many("Explorer", 3), ...many("Planner", 1)]);
    expect(m?.top).toEqual(["Host", "Explorer", "Planner"]);
    expect(m?.n).toBe(9);
  });

  it("returns names only — a share is the differencing attack handed over", () => {
    const m = roomMix(many("Host", 12));
    // Whatever else the shape gains, it must never gain a percentage: at
    // room sizes a share moves visibly when one person walks in.
    expect(JSON.stringify(m)).not.toMatch(/\d+(\.\d+)?%|share|pct/i);
  });

  it("refuses below the floor rather than drawing a thin room", () => {
    expect(roomMix(many("Host", ROOM_MIN_TYPED - 1))).toBeNull();
    expect(roomMix(many("Host", ROOM_MIN_TYPED))).not.toBeNull();
  });

  it("counts only phones that carried a type, and says so in n", () => {
    // The headline count of phones nearby is bigger than this; the mix
    // must not borrow it. Untyped entries vanish from both the tally and
    // the basis rather than being counted as an unknown type.
    const m = roomMix([...many("Host", 8), undefined, null, "", "   "]);
    expect(m?.n).toBe(8);
    expect(m?.top).toEqual(["Host"]);
  });

  it("keeps a stable order when two types tie", () => {
    // A tie that resolves differently between beats makes the reading
    // flicker, and a flicker is a signal an observer can read.
    const a = roomMix([...many("Host", 4), ...many("Explorer", 4)]);
    const b = roomMix([...many("Explorer", 4), ...many("Host", 4)]);
    expect(a?.top).toEqual(b?.top);
  });

  it("keeps at most three names, however many types are in the room", () => {
    const m = roomMix([
      ...many("Host", 5), ...many("Explorer", 4), ...many("Planner", 3),
      ...many("Diplomat", 2), ...many("Live Wire", 1),
    ]);
    expect(m?.top).toHaveLength(3);
  });

  // THE TRUNCATION HAS TO DECLARE ITSELF (D176, D102's rule).
  //
  // The fold reads at most ROOM_SAMPLE_CAP presence docs, so in a stadium
  // `n` is a floor on the typed crowd rather than its size. Printing it
  // bare would say "60 people here have taken the test" of a field with
  // three thousand — not a fabricated number, but a slice presented as the
  // room, which is the failure D102 repaired on the who-voted sheet.
  it("declares a capped sample, because past the cap n is a floor not a size", () => {
    const m = roomMix(many("Host", ROOM_SAMPLE_CAP), ROOM_MIN_TYPED, ROOM_SAMPLE_CAP);
    expect(m?.capped).toBe(true);
    expect(m?.n).toBe(ROOM_SAMPLE_CAP);
    // Under the cap it is exact, and the flag is ABSENT rather than false —
    // the card renders "60+" on truthiness.
    expect(roomMix(many("Host", ROOM_SAMPLE_CAP - 1))?.capped).toBeUndefined();
  });

  it("counts the cap against the SAMPLE, not against the typed tally", () => {
    // Sixty docs read, nine of them typed: the ranking still came out of a
    // slice, so it is the slice that has to be declared. Testing this the
    // other way round (capping on `n`) would let a crowded, mostly-untyped
    // room print an exact-looking basis drawn from a truncated read.
    const sample = [...many("Host", 9), ...Array.from({ length: 51 }, () => undefined)];
    expect(sample).toHaveLength(ROOM_SAMPLE_CAP);
    const m = roomMix(sample, ROOM_MIN_TYPED, ROOM_SAMPLE_CAP);
    expect(m?.n).toBe(9);
    expect(m?.capped).toBe(true);
  });
});

// ── the room, read (D177) ───────────────────────────────────────────
describe("tallyPicks", () => {
  it("counts picks into the aggregate's own shape", () => {
    // Deliberately the `{ "0": n }` map v2_question_aggs uses: the client
    // already turns exactly this into an option array, so the room's
    // counts arrive in a shape four surfaces already read.
    expect(tallyPicks([0, 1, 0, 2, 0])).toEqual({ "0": 3, "1": 1, "2": 1 });
  });

  it("drops anything that is not an option index", () => {
    // An answer document is written by a client, so this is the door. A
    // -1 (the client's "unanswered"), a float or a string would key a
    // bucket no option list has a slot for — the client's
    // `cell[String(i)]` walk would never look at it, so the count would
    // exist, be wrong, and be invisible.
    expect(tallyPicks([0, -1, 1.5, "2" as unknown as number, null, undefined, 1]))
      .toEqual({ "0": 1, "1": 1 });
  });

  it("has no floor, and that is the D98 rule rather than an oversight", () => {
    // A floor on an answer split would protect the answer, and answers
    // are public. The room's roster is disclosed by the People tab
    // anyway, so hiding a one-person split conceals nothing a reader
    // could not get by tapping a name. What a thin split needs is its `n`
    // shown beside it, which is what every other surface does.
    expect(tallyPicks([1])).toEqual({ "1": 1 });
  });
});

describe("roomQids", () => {
  it("takes a clean list and caps it", () => {
    const many = Array.from({ length: 40 }, (_, i) => `q${i}`);
    expect(roomQids(many)).toHaveLength(ROOM_QUESTION_CAP);
    expect(roomQids(["a", "b"])).toEqual(["a", "b"]);
  });

  it("de-duplicates, because a repeated qid folds and pays twice", () => {
    expect(roomQids(["a", "a", "b", "a"])).toEqual(["a", "b"]);
  });

  // THE DOOR. These strings are concatenated into a document path
  // (`v2_users/{uid}/answers/{qid}`), so a slash or a dot segment is a
  // path injection rather than a bad id — refused here rather than
  // escaped downstream, because there is exactly one place to get it
  // right.
  it("refuses anything that could reach outside the answers collection", () => {
    expect(roomQids(["../../v2_users", "a/b", ".", "..", "", "   "])).toEqual([]);
    expect(roomQids([{ id: "x" }, 3, null, undefined])).toEqual([]);
    expect(roomQids(["x".repeat(121)])).toEqual([]);
    expect(roomQids("not an array")).toEqual([]);
  });
});
