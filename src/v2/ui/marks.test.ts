import { describe, expect, it } from "vitest";
import { firstName, groupInitials, markHue, personInitials } from "./marks";

describe("markHue", () => {
  it("gives the same id the same hue every time", () => {
    // The whole point. The rail is a row of coloured marks you learn by
    // shade and position; a colour recomputed per session is worse than no
    // colour, because it teaches you something and then takes it back.
    expect(markHue("g_abc")).toBe(markHue("g_abc"));
  });

  it("stays inside a hue wheel", () => {
    for (const seed of ["", "a", "g_abc", "u_0123456789abcdef", "🙂"]) {
      const h = markHue(seed);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(360);
    }
  });

  it("separates ids that differ by one character", () => {
    // Circles created in the same session get adjacent-looking ids; a hash
    // that ignored the tail would draw them identically.
    expect(markHue("g_aaaa1")).not.toBe(markHue("g_aaaa2"));
  });

  it("matches group-daily.jsx's ghash rather than merely resembling it", () => {
    // Pinned against a value computed from the prototype's own expression,
    // because the point of copying the hash was that a circle keeps the
    // colour it had there. A "better" hash here is a silent redesign.
    const ghash = (s: string) => {
      let h = 9;
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489);
      return ((h ^ (h >>> 9)) >>> 0) / 4294967295;
    };
    for (const seed of ["g1", "the-sunday-club", "u_ada"]) {
      expect(markHue(seed)).toBe(Math.round(ghash(seed) * 360));
    }
  });
});

describe("personInitials", () => {
  it("takes one letter from each of the first two words", () => {
    expect(personInitials("Ada Lovelace")).toBe("AL");
    expect(personInitials("Ada Byron Lovelace")).toBe("AB");
  });

  it("takes two letters from a single-word name", () => {
    expect(personInitials("Ada")).toBe("AD");
  });

  it("returns nothing for an account that set no name", () => {
    // "" rather than a letter derived from the uid: an initial invented
    // from an id is a name we made up. The caller draws a dot.
    expect(personInitials("")).toBe("");
    expect(personInitials("   ")).toBe("");
  });
});

describe("groupInitials", () => {
  it("drops a leading The, which is never what a label says", () => {
    expect(groupInitials("The Sunday Club")).toBe("SC");
  });

  it("takes two letters from a one-word name", () => {
    expect(groupInitials("Family")).toBe("FA");
  });

  it("falls back to a question mark rather than an empty square", () => {
    expect(groupInitials("")).toBe("?");
  });
});

/**
 * A lone surrogate — the shape both folds used to emit. Spelled out rather
 * than `String.isWellFormed`, which needs an ES2024 lib this project does
 * not target, and this says the thing directly: a high surrogate must be
 * followed by a low one, and a low one must never stand alone.
 */
const loneSurrogate = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xdc00 && c <= 0xdfff) return true;
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(i + 1);
      if (!(n >= 0xdc00 && n <= 0xdfff)) return true;
      i++;
    }
  }
  return false;
};

describe("an astral character is one character (D238)", () => {
  // Both folds indexed UTF-16 CODE UNITS, so a word beginning with an
  // emoji, a mathematical alphanumeric or a CJK extension B glyph
  // contributed HALF of it — tofu on a rail whose whole job is telling
  // people apart. The same defect `data/avatar.ts` carried.
  it("keeps a whole glyph in a person's initials, first word or second", () => {
    expect(personInitials("🎈 Ada")).toBe("🎈A");
    expect(personInitials("Ada 🎈")).toBe("A🎈");
    expect(personInitials("𝒜da Test")).toBe("𝒜T");
    // The single-word branch was already right BY ACCIDENT — slice(0, 2)
    // takes both halves of one astral character — and is kept so the
    // accident cannot quietly become a regression.
    expect(personInitials("🎈")).toBe("🎈");
  });

  it("keeps a whole glyph in a circle's initials, leading The included", () => {
    expect(groupInitials("🎈 Club")).toBe("🎈C");
    expect(groupInitials("Club 🎈")).toBe("C🎈");
    // The "The" is stripped first, so the emoji becomes the FIRST word —
    // the path that has two chances to lose half a character.
    expect(groupInitials("The 🎈 Club")).toBe("🎈C");
    expect(groupInitials("🎈")).toBe("🎈");
  });

  it("never emits a lone surrogate, whatever it is handed", () => {
    // The property under all of the above, and the one that fails the
    // moment either fold goes back to indexing.
    for (const n of ["🎈 Ada", "Ada 🎈", "𝒜da Test", "Li 𠮷", "🎈", "The 🎈 Club", "🎈 Club"]) {
      expect(loneSurrogate(personInitials(n)), `personInitials(${n})`).toBe(false);
      expect(loneSurrogate(groupInitials(n)), `groupInitials(${n})`).toBe(false);
    }
  });
});

describe("firstName", () => {
  it("is the first word, and nothing when there is none", () => {
    expect(firstName("Ada Lovelace")).toBe("Ada");
    expect(firstName("  Ada  ")).toBe("Ada");
    expect(firstName("")).toBe("");
  });
});
