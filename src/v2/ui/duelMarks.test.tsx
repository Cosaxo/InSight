// @vitest-environment jsdom
//
// duelMarks — the three marks every social row in the daily is built out
// of (D156), and the one `check:panel-suites` listed as "glyph constants,
// no component". They are components, they render, and they can render the
// wrong person.
//
// `marks.test.ts` pins the arithmetic underneath: the hash, the two
// initials rules, the first-name helper. What only a render can execute is
// which of those rules each mark READS, which id it hands them, and what
// the result ends up looking and sounding like. Seven properties, each one
// a way a correct derivation still reaches the screen as a wrong person:
//
//   1. A mark is coloured by an ID, never by the name printed beside it.
//      Two members called Ada are two people, and a renamed circle is the
//      same circle — `markHue(name || uid)` compiles, reads tidier, and
//      quietly gives two strangers one colour.
//   2. It defers to `markHue` rather than hashing its own way, which is
//      the only reason one circle is one colour on every screen that
//      draws it (and the same colour it had in the prototype).
//   3. Shape is KIND. Round is a person, a rounded square is a circle,
//      and at rail size the shape is what resolves first — before the
//      colour, long before two 8px letters. So the square has to stay a
//      square at every size the panel ships it at.
//   4. Each mark reads its OWN initials rule. "The Sunday Club" is SC on
//      a circle and TS on a person; the swap survives tsc and every name
//      gate this repo has.
//   5. Nothing is invented from an id. No name means a dot and a tooltip
//      that says "Someone"; an initial or a tooltip made out of the uid
//      is a name we made up, shown to the person it is about.
//   6. In a row of marks, only YOURS speaks. The discs are decorative;
//      the pill is the word "you" and is the only thing in a reveal bar
//      that says you are in it.
//   7. The three are peers — one height at one size, type that scales
//      with the box, and a floor under the pill because "you" is three
//      glyphs where a mark is two.
//
// No store to mock: this file imports `./marks` and nothing else. The pure
// module is deliberately NOT stubbed, because half of what is asserted
// here is that each mark calls the right one of its two initials rules.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { markHue, personInitials } from "./marks";
import { DuelAv, GroupMark, YouChip } from "./duelMarks";

afterEach(cleanup);

// The sizes `LiveDuelPanel` actually draws each mark at — grepped from its
// call sites, not invented. The ladder is the point: a property that holds
// at the default and breaks at 20 breaks in the rail and the reveal bars,
// which is where most of these marks are.
const AV_SIZES = [20, 22, 26, 34, 38];
const MARK_SIZES = [26, 38, 52];
const CHIP_SIZES = [20, 22, 34];

// Each of the three renders exactly one span.
const draw = (node: ReactElement): HTMLElement =>
  render(node).container.firstElementChild as HTMLElement;

// The colour reaches the DOM as `oklch(0.52 0.13 <hue>)`, and jsdom keeps
// the function intact rather than dropping it as an unknown colour
// (probed) — so the hue is readable and comparable to `markHue`'s own.
// NaN when there is no hashed colour at all, which fails every comparison
// below rather than passing one by coincidence.
const hueOf = (el: HTMLElement): number => {
  const m = /oklch\([\d.]+ [\d.]+ ([\d.]+)\)/.exec(el.style.background);
  return m ? Number(m[1]) : NaN;
};

// What a screen reader is left with: the same DOM minus everything the
// component marked decorative.
const spoken = (root: HTMLElement): string => {
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copy.textContent || "").replace(/\s+/g, " ").trim();
};

describe("who a mark is", () => {
  it("colours a person by their uid, so two people called Ada are two people", () => {
    const a = draw(<DuelAv uid="u_ada" name="Ada" size={22} />);
    const b = draw(<DuelAv uid="u_kat" name="Ada" size={22} />);
    expect(hueOf(a)).toBe(markHue("u_ada"));
    expect(hueOf(b)).toBe(markHue("u_kat"));
    expect(hueOf(a)).not.toBe(hueOf(b));
  });

  it("keeps a person's colour when their display name changes", () => {
    // A rail is a row of coloured discs you learn by shade and position.
    // Hashing the name means everyone who fills in their surname becomes
    // somebody else, and nothing on the screen admits it.
    const before = draw(<DuelAv uid="u_ada" name="Ada" size={22} />);
    const after = draw(<DuelAv uid="u_ada" name="Ada Lovelace" size={22} />);
    expect(hueOf(after)).toBe(hueOf(before));
  });

  it("colours a circle by its gid, so renaming the circle does not repaint it", () => {
    const before = draw(<GroupMark gid="g_sun" name="Sunday Club" size={34} />);
    const after = draw(<GroupMark gid="g_sun" name="Monday Club" size={34} />);
    // Equal to the SHARED hash, not merely stable: a second hash here
    // would draw one circle in two colours across two screens, and each
    // screen would look right on its own.
    expect(hueOf(before)).toBe(markHue("g_sun"));
    expect(hueOf(after)).toBe(hueOf(before));
  });
});

describe("which shape says which kind", () => {
  it("draws a person round at every size the panel uses", () => {
    for (const size of AV_SIZES) {
      expect(draw(<DuelAv uid="u_ada" name="Ada Lovelace" size={size} />).style.borderRadius).toBe("50%");
    }
  });

  it("keeps a circle square-cornered at every size, never a second disc", () => {
    // The one cue that survives a 20px rail. A radius of half the side is
    // a circle by another name, so the corner has to stay under it.
    for (const size of MARK_SIZES) {
      const el = draw(<GroupMark gid="g_sun" name="The Sunday Club" size={size} />);
      expect(el.style.borderRadius.endsWith("px")).toBe(true);
      expect(parseFloat(el.style.borderRadius)).toBeGreaterThan(0);
      expect(parseFloat(el.style.borderRadius)).toBeLessThan(size / 2);
    }
  });

  it("grows the corner with the mark", () => {
    // A fixed radius passes the test above at all four sizes and still
    // looks wrong at both ends — nearly round at 26, a hard rectangle at
    // 52. The corner is a proportion of the side, so it has to move.
    const radii = MARK_SIZES.map((size) =>
      parseFloat(draw(<GroupMark gid="g_sun" name="The Sunday Club" size={size} />).style.borderRadius));
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThan(radii[i - 1]);
  });
});

describe("the letters", () => {
  it("takes a person's initials from their name", () => {
    expect(draw(<DuelAv uid="u_ada" name="Ada Lovelace" />).textContent).toBe("AL");
    expect(draw(<DuelAv uid="u_ada" name="Ada" />).textContent).toBe("AD");
    // THROUGH THE COMPONENT, on the input where the two rules diverge.
    // The two lines above cannot see the swap this case exists for:
    // `groupInitials` also returns AL and AD for them, so a `DuelAv` wired
    // to the circle rule passes both. Only a leading "The" separates the
    // rules, and until this line the person side never rendered one — the
    // swap was caught two describes down, by the nameless dot, which is
    // incidental rather than the property claiming to hold it.
    expect(draw(<DuelAv uid="u_sun" name="The Sunday Club" />).textContent).toBe("TS");
  });

  it("reads a circle by the circle rule, which drops a leading The", () => {
    expect(draw(<GroupMark gid="g_sun" name="The Sunday Club" />).textContent).toBe("SC");
    // Asserted rather than left to the comment: the two rules diverge on
    // exactly this input, so the day `personInitials` also learns to drop
    // a "The", the line above stops discriminating and nothing else in
    // the tree would notice it had.
    expect(personInitials("The Sunday Club")).toBe("TS");
  });
});

describe("what is never invented from an id", () => {
  it("gives a nameless account a dot, not a letter out of its uid", () => {
    const el = draw(<DuelAv uid="u_9f3c" size={22} />);
    expect(el.textContent).toBe("·");
    // The id itself, nowhere on the mark: the hue is derived from it, the
    // glyphs and the tooltip are not. An account that set no name is
    // anonymous on the rail, not labelled with its primary key.
    expect(el.outerHTML).not.toContain("u_9f3c");
  });

  it("says Someone on hover, and the person's name when there is one", () => {
    expect(draw(<DuelAv uid="u_9f3c" size={22} />).title).toBe("Someone");
    expect(draw(<DuelAv uid="u_ada" name="Ada Lovelace" size={22} />).title).toBe("Ada Lovelace");
  });

  it("gives a nameless circle a question mark rather than an empty square", () => {
    expect(draw(<GroupMark gid="g_sun" size={34} />).textContent).toBe("?");
  });
});

describe("what a screen reader hears", () => {
  it("leaves only your own mark speaking in a row of them", () => {
    // The reveal bar is the sharp case: a row of discs for everyone who
    // picked an option, plus the pill if you are among them. The discs
    // are decorative — the reader is told the option and the tally, not
    // the faces — and the pill is not, because "you are in this bar" is
    // the one thing in that row nothing else states.
    const { container } = render(
      <div>
        <DuelAv uid="u_ada" name="Ada Lovelace" size={20} />
        <DuelAv uid="u_kat" name="Katherine Johnson" size={20} />
        <GroupMark gid="g_sun" name="The Sunday Club" size={20} />
        <YouChip size={20} />
      </div>,
    );
    expect(spoken(container)).toBe("you");
  });
});

describe("the pill", () => {
  it("is the word, at every size", () => {
    // Not an initial of your own name: you are the one person here who
    // never needs decoding, and a letter would have to be decoded.
    for (const size of CHIP_SIZES) {
      expect(draw(<YouChip size={size} />).textContent).toBe("you");
    }
  });

  it("holds a type floor the letters do not need", () => {
    // At the rail's 20px, the mark ratio puts "you" at 7px — three
    // lowercase glyphs where a disc has two capitals. The floor is why
    // the smallest chip in the app is still a word rather than a smudge.
    for (const size of CHIP_SIZES) {
      expect(parseFloat(draw(<YouChip size={size} />).style.fontSize)).toBeGreaterThanOrEqual(9.5);
    }
  });
});

describe("the three as one set", () => {
  it("sits at one height at one size, so a mixed row is a row", () => {
    for (const size of [20, 34]) {
      expect([
        draw(<DuelAv uid="u_ada" name="Ada Lovelace" size={size} />),
        draw(<GroupMark gid="g_sun" name="The Sunday Club" size={size} />),
        draw(<YouChip size={size} />),
      ].map((el) => el.style.height)).toEqual([`${size}px`, `${size}px`, `${size}px`]);
    }
  });

  it("scales its type with its box, so the letters stay inside the mark", () => {
    for (const [Mark, sizes] of [
      [(s: number) => <DuelAv uid="u_ada" name="Ada Lovelace" size={s} />, AV_SIZES],
      [(s: number) => <GroupMark gid="g_sun" name="The Sunday Club" size={s} />, MARK_SIZES],
    ] as Array<[(s: number) => ReactElement, number[]]>) {
      const pts = sizes.map((s) => parseFloat(draw(Mark(s)).style.fontSize));
      // Two glyphs centred in a box: a fixed size is legible at 38 and
      // spills out of the 20px rail disc.
      sizes.forEach((s, i) => expect(pts[i]).toBeLessThanOrEqual(s / 2));
      for (let i = 1; i < pts.length; i++) expect(pts[i]).toBeGreaterThan(pts[i - 1]);
    }
  });
});
