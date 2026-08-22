// @vitest-environment jsdom
//
// The one face (D178), drawn wherever a person is named.
//
// `LiveRoomTabs.test.tsx` proves a ROW gets a photo where there is one.
// This is the component underneath, and what only it can be asked are the
// states a list will not sit still for: a token that stopped resolving, a
// row handed a new person, and every shape a display name can take. Six
// properties, each one a way a correct store reaches the screen as the
// wrong person:
//
//   1. Each face is ITS OWN. Two avatars side by side draw two tokens; a
//      captured uid dresses a whole list in one stranger's photo, which is
//      the only defect here that looking twice does not correct.
//   2. The branch is on the URL, not on the token. `avatarUrl` (the real
//      module — the store is mocked, the folds are not) says "" for a
//      build with no bucket, and a panel that asked the token instead
//      would put `<img src="">` on every face in a demo build.
//   3. A FAILED load is initials, not a hole — the file header's own rule:
//      an object replaced or a bucket gone unreachable has to look like an
//      account with no photo, because that is now what it is.
//   4. …and the failure belongs to the UID, not the slot. Near re-orders
//      under a mounted component and React keeps state at the POSITION, so
//      a boolean would carry one person's dead token onto whoever scrolls
//      into their row.
//   5. The photo is NAMED, the initials are SILENT. On Near's People tab
//      the face is the row's content, so a screen reader is told whose it
//      is; the initials are a drawing of a name the row already says, and
//      announcing "AL" next to "Ada Lovelace" is that fact twice.
//   6. The initials themselves — `initialsOf` is executed, never stubbed,
//      and this is the only suite that executes it at all. A "?" over an
//      account that HAS a name, or two letters lifted from the wrong
//      words, is a person mislabelled in the one place the app draws
//      identity. The astral-character case was a DEFECT when this suite
//      was written and is fixed at D228; the case now holds the fix.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The whole of what this panel asks the store: one token lookup. Mocked
// because `../data/live` boots Firebase, not because the value is hard to
// produce.
const LIVE = vi.hoisted(() => ({
  faceFor: (() => "") as (uid: string) => string,
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: Avatar } = await import("./Avatar");

// The URL is built from build config and a test run has none, so without
// this every case below would fall back to initials and the photo half of
// the suite would pass for the wrong reason. Per-test rather than once,
// because one case takes the bucket away again.
beforeEach(() => {
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "b.appspot.com");
  LIVE.faceFor = () => "";
});
afterEach(cleanup);
afterAll(() => { vi.unstubAllEnvs(); });

/** The glyphs on screen for a name with no photo behind it. */
const initialsFor = (name: string): string =>
  render(<Avatar uid="u_ada" name={name} />).container.textContent ?? "";

describe("photo or initials, per person", () => {
  it("draws each account's own token, and no letters under either", () => {
    LIVE.faceFor = (uid: string) => (uid === "u_ada" ? "tok-ada" : "tok-grace");
    const { container } = render(<>
      <Avatar uid="u_ada" name="Ada Lovelace" />
      <Avatar uid="u_grace" name="Grace Hopper" />
    </>);

    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? "");
    expect(srcs).toHaveLength(2);
    // Both halves of each URL: the path says whose object it is, the token
    // says which upload. Sharing either across the two rows is the
    // mix-up — and a suite that only counted the images would not see it.
    expect(srcs[0]).toContain("avatars%2Fu_ada");
    expect(srcs[0]).toContain("token=tok-ada");
    expect(srcs[1]).toContain("avatars%2Fu_grace");
    expect(srcs[1]).toContain("token=tok-grace");
    // The fallback is a fallback: no initials sitting behind a photo,
    // where a transparent PNG would show both.
    expect(container.textContent).toBe("");
  });

  it("re-reads the token when the SAME slot is handed a different person", () => {
    // The case above mounts two avatars side by side, so each instance
    // captures its own correct uid on its own first render — a
    // capture-on-first-render bug survives it untouched, which is how
    // property 1 came to be unheld. React keeps state by POSITION, and
    // Near re-orders its roster under mounted components, so the failure
    // is one instance being handed a second person: the classic
    // `useRef(uid)` / `useState(() => LIVE.faceFor(uid))` mistake then
    // draws the first person's photo under the second person's name, for
    // as long as the list is on screen.
    LIVE.faceFor = (uid: string) => (uid === "u_ada" ? "tok-ada" : "tok-grace");
    const { container, rerender } = render(<Avatar uid="u_ada" name="Ada Lovelace" />);
    expect(container.querySelector("img")?.getAttribute("src") ?? "").toContain("token=tok-ada");

    rerender(<Avatar uid="u_grace" name="Grace Hopper" />);
    const src = container.querySelector("img")?.getAttribute("src") ?? "";
    expect(src, "the slot kept the previous person's token").toContain("token=tok-grace");
    expect(src).toContain("avatars%2Fu_grace");
    expect(src, "the slot kept the previous person's object").not.toContain("u_ada");
  });

  it("falls back to initials for an account with no photo", () => {
    // The permanent state for most accounts, not a placeholder waiting.
    const { container } = render(<Avatar uid="u_ada" name="Ada Lovelace" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AL");
  });

  it("draws initials rather than an empty <img> in a build with no bucket", () => {
    // A demo build, or a misconfigured one: the token is real and the URL
    // is not buildable. The branch has to be on the URL — asking the token
    // instead puts a broken-image glyph on every face in the app.
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "");
    LIVE.faceFor = () => "tok-ada";
    const { container } = render(<Avatar uid="u_ada" name="Ada Lovelace" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AL");
  });
});

describe("a photo that will not load", () => {
  it("becomes initials rather than a broken image", () => {
    // The header's rule: a token that no longer resolves has to look like
    // no photo. Nothing upstream can know this happened — the document is
    // fine, the object is not.
    LIVE.faceFor = () => "tok-gone";
    const { container } = render(<Avatar uid="u_ada" name="Ada Lovelace" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AL");
  });

  it("keeps one person's dead token off the next person's row", () => {
    // Near and Kindred re-rank under a mounted list: React keeps component
    // state at the POSITION, so this row is handed a different person
    // while the failure is still remembered. Keyed by uid it clears
    // itself; kept as a boolean it hides a photo that loads perfectly.
    LIVE.faceFor = (uid: string) => `tok-${uid}`;
    const { container, rerender } = render(<Avatar uid="u_ada" name="Ada Lovelace" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();

    rerender(<Avatar uid="u_grace" name="Grace Hopper" />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("avatars%2Fu_grace");
  });
});

describe("what is said out loud", () => {
  it("names whose photo it is", () => {
    // Named, not decorative: on Near's People tab the face IS the row's
    // content, so the screen reader user gets the fact the sighted one
    // does.
    LIVE.faceFor = () => "tok-ada";
    render(<Avatar uid="u_ada" name="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace’s photo" })).toBeTruthy();
  });

  it("still says it for an account with no name", () => {
    // A display name is optional (see "?" below), and "’s photo" with
    // nothing in front of it is what a missing ternary sounds like.
    LIVE.faceFor = () => "tok-ada";
    render(<Avatar uid="u_ada" name="" />);
    expect(screen.getByRole("img", { name: "Their photo" })).toBeTruthy();
  });

  it("keeps the initials out of the accessibility tree", () => {
    // Every caller draws this beside the name it was built from, so an
    // announced "AL" is the same fact twice — and it is a drawing, not a
    // word: "?" read aloud is worse still.
    const { container } = render(<Avatar uid="u_ada" name="Ada Lovelace" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the initials, which are the permanent fallback", () => {
  it("takes the first word and the LAST, however many are between", () => {
    expect(initialsFor("Ada Lovelace")).toBe("AL");
    // A middle name must not displace the family name: AB is a different
    // person, and the second word is the one a naive fold reaches for.
    expect(initialsFor("Ada B. Lovelace")).toBe("AL");
    expect(initialsFor("Ada Byron King Lovelace")).toBe("AL");
  });

  it("gives a one-word name two letters, and a one-letter name one", () => {
    // A mononym is a real display name, and one initial in a circle sized
    // for two reads as a truncation rather than a name.
    expect(initialsFor("Ada")).toBe("AD");
    expect(initialsFor("b")).toBe("B");
  });

  it("reads the name, not the way it was spaced or cased", () => {
    // Names arrive from a free-text field and from paste: ragged spacing
    // is ordinary, and it is what turns "first character of the string"
    // into a blank circle.
    expect(initialsFor("  Ada   Lovelace  ")).toBe("AL");
    expect(initialsFor("Ada\tLovelace")).toBe("AL");
    expect(initialsFor("ada lovelace")).toBe("AL");
  });

  it("says ? only when there is genuinely no name", () => {
    // "?" is a real state — a display name is optional — but it is the
    // state for NO name. An account that has told the app who it is,
    // drawn as unknown, is the visible defect on the other side.
    expect(initialsFor("")).toBe("?");
    expect(initialsFor("   ")).toBe("?");
  });

  it("draws a non-Latin name in its own script", () => {
    // Cyrillic А and К (U+0410, U+041A), not the Latin lookalikes:
    // uppercasing is per-script, and the failure to watch for is a "?" or
    // a dropped diacritic rather than a wrong letter.
    expect(initialsFor("Анна Каренина")).toBe("АК");
    expect(initialsFor("josé ólafur")).toBe("JÓ");
    // CJK names carry no space, so the one-word rule hands back the first
    // two characters — which is the reading a person expects, and it only
    // works because the fold is uppercase-then-slice on real characters.
    expect(initialsFor("山田太郎")).toBe("山田");
  });

  it("keeps a whole astral character, first word or last (D228)", () => {
    // WAS A PINNED DEFECT, now the fix. `initialsOf` indexed UTF-16 code
    // UNITS, so a word beginning with an emoji, a mathematical
    // alphanumeric or a CJK extension B glyph contributed HALF of it —
    // "Ada 🎈" drew "A\uD83C", an unpaired surrogate rendering as tofu
    // beside a correct letter. Code points now, both branches.
    expect(initialsFor("Ada 🎈")).toBe("A🎈");
    expect(initialsFor("🎈 Ada")).toBe("🎈A");
    // The one-word branch was already right BY ACCIDENT — `slice(0, 2)`
    // happens to take both halves of one astral character — which is why
    // the bug survived every by-hand reading. Kept so the accident cannot
    // quietly become a regression.
    expect(initialsFor("🎈")).toBe("🎈");
    // The property under all four, and the one a reader would actually
    // notice: whatever comes out is renderable text, never a lone
    // surrogate. This is what fails if the fold goes back to indexing.
    // Spelled out rather than `String.isWellFormed`, which needs an ES2024
    // lib this project does not target — and this says the thing directly:
    // a high surrogate must be followed by a low one, and a low one must
    // never stand alone. That is exactly what indexing code units breaks.
    const loneSurrogate = (s: string): boolean => {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c >= 0xdc00 && c <= 0xdfff) return true;             // low, unpaired
        if (c >= 0xd800 && c <= 0xdbff) {
          const n = s.charCodeAt(i + 1);
          if (!(n >= 0xdc00 && n <= 0xdfff)) return true;        // high, unfollowed
          i++;
        }
      }
      return false;
    };
    for (const name of ["Ada 🎈", "🎈 Ada", "𝒜da Test", "Li 𠮷", "🎈"]) {
      expect(loneSurrogate(initialsFor(name)), `${name} produced a lone surrogate`).toBe(false);
    }
  });
});
