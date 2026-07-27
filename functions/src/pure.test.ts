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
  topMedia,
  summarise,
  averagePersonality,
  ageBucket,
  tally,
  topInterests,
  slugifyCity,
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

// ── rollup math ─────────────────────────────────────────────────

describe("summarise", () => {
  it("returns empty arrays for zero vectors", () => {
    expect(summarise([])).toEqual({ mean: [], stdev: [] });
  });

  it("is the identity (with zero stdev) for a single vector", () => {
    expect(summarise([[10, 20, 30, 40, 50]])).toEqual({
      mean: [10, 20, 30, 40, 50],
      stdev: [0, 0, 0, 0, 0],
    });
  });

  it("computes per-axis mean and population stdev, rounded to 2dp", () => {
    const { mean, stdev } = summarise([
      [0, 10],
      [10, 10],
    ]);
    expect(mean).toEqual([5, 10]);
    expect(stdev).toEqual([5, 0]);
  });

  it("rounds to two decimals", () => {
    const { mean } = summarise([[1], [2], [3]]);
    expect(mean).toEqual([2]);
    const thirds = summarise([[1], [1], [2]]);
    expect(thirds.mean).toEqual([1.33]);
  });
});

describe("averagePersonality", () => {
  it("returns null for no vectors", () => {
    expect(averagePersonality([])).toBeNull();
  });

  it("averages five axes and rounds to integers", () => {
    expect(
      averagePersonality([
        [10, 20, 30, 40, 50],
        [11, 21, 31, 41, 51],
      ]),
    ).toEqual([11, 21, 31, 41, 51]); // 10.5 etc round up
  });
});

// ── demographic bucketing ───────────────────────────────────────

describe("ageBucket", () => {
  it("buckets on decade boundaries", () => {
    expect(ageBucket(19)).toBe("<20");
    expect(ageBucket(20)).toBe("20-29");
    expect(ageBucket(29)).toBe("20-29");
    expect(ageBucket(30)).toBe("30-39");
    expect(ageBucket(49)).toBe("40-49");
    expect(ageBucket(50)).toBe("50+");
  });
});

describe("tally", () => {
  it("returns ratios summing to ~1, rounded to 3dp", () => {
    expect(tally(["a", "a", "b", "c"])).toEqual({
      a: 0.5,
      b: 0.25,
      c: 0.25,
    });
  });

  it("skips falsy values and returns {} for nothing countable", () => {
    expect(tally([])).toEqual({});
    expect(tally(["" as string])).toEqual({});
  });
});

describe("topInterests", () => {
  it("counts each user's interest once, case-insensitively", () => {
    const top = topInterests(
      [
        ["Chess", "chess", "Hiking"],
        ["chess"],
      ],
      8,
    );
    expect(top[0]).toEqual({ name: "Chess", count: 2 });
    expect(top[1]).toEqual({ name: "Hiking", count: 1 });
  });

  it("caps the list at k", () => {
    expect(topInterests([["a", "b", "c"]], 2)).toHaveLength(2);
  });
});

describe("topMedia", () => {
  it("dedupes per user, tallies across users, keeps top-k per category", () => {
    const top = topMedia(
      [
        { music: ["Radiohead", "radiohead ", "Bach"] },
        { music: ["Radiohead"], film: ["Heat"] },
      ],
      1,
    );
    expect(top.music).toEqual([{ name: "Radiohead", count: 2 }]);
    expect(top.film).toEqual([{ name: "Heat", count: 1 }]);
    expect(top.books).toBeUndefined();
  });

  it("returns {} when nobody shared anything", () => {
    expect(topMedia([], 5)).toEqual({});
    expect(topMedia([{}], 5)).toEqual({});
  });
});

// ── city slugs ──────────────────────────────────────────────────

describe("slugifyCity", () => {
  it("lowercases, strips diacritics, collapses separators", () => {
    expect(slugifyCity("São Paulo")).toBe("sao-paulo");
    expect(slugifyCity("  New   York!! ")).toBe("new-york");
    expect(slugifyCity("Tromsø")).toBe("troms"); // ø is not a combining mark — dropped, not mapped
  });

  it("trims leading/trailing dashes and caps at 80 chars", () => {
    expect(slugifyCity("---Oslo---")).toBe("oslo");
    expect(slugifyCity("x".repeat(100))).toHaveLength(80);
  });

  it("returns empty for names with no usable characters", () => {
    expect(slugifyCity("!!!")).toBe("");
  });
});
