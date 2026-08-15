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

describe("firstName", () => {
  it("is the first word, and nothing when there is none", () => {
    expect(firstName("Ada Lovelace")).toBe("Ada");
    expect(firstName("  Ada  ")).toBe("Ada");
    expect(firstName("")).toBe("");
  });
});
