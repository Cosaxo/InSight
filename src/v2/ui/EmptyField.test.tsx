// @vitest-environment jsdom
//
// The empty constellation (D172) — the rings and you, drawn a SECOND
// time.
//
// D160 settled what an empty field is: still a field. This module exists
// because `LiveGroupsMirrorBody` is a static import and the similarity
// engine that already draws this is lazy, so forty lines were copied
// rather than a chunk moved. A licensed copy is only licensed while it
// stays a copy, and neither `tsc` nor `check:globals` can see the two
// drift apart — so half of this suite is about the duplication and half
// is about the one thing the original does not have, the door.
//
//   1. The drawing comes first and ALONE. Asked for a field and nothing
//      else, it draws the rings and you, with no chrome around the
//      nothing. The arm it replaced was a paragraph where the
//      constellation goes, which reads as a screen that was never built.
//   2. It is the SAME picture. `LiveCircleBody` says so in as many words
//      ("same picture, and no chunk fetched"), and the rings are the
//      scale a radius will be read on once somebody lands on them — so
//      the two files' geometry is compared against each other rather
//      than pinned to literals here, which would only re-state this file.
//   3. The words are the readable half. The drawing is `aria-hidden` and
//      announces nothing; the sentence is text. The two files DISAGREED
//      here when this suite was written — `SfEmptyField` handed the same
//      empty canvas to a screen reader as a group named "Similarity field
//      — closer to the centre is more like you", a promise about nodes
//      that are not there — and it was recorded rather than asserted,
//      because only one of the two could be right and it was not this
//      file's call. It was this file's answer that was right: D244 hides
//      the engine's empty canvas too, and its own suite pins both halves
//      (hidden while empty, named again the moment somebody is placed).
//   4. No action, no button. City fills as strangers answer and needs no
//      door; the two stops that cannot fill by waiting carry the only
//      buttons, and an empty state that grows a control it did not ask
//      for is promising a way out that does not exist.
//   5. The door opens on the NAV KEY, not the tab. `goTab("track")`
//      restores whatever daily scope was last open, so a button that says
//      group delivers a duel — the defect D190's call site comment names.
//      And the `goTab` FALLBACK takes the tab id alone, because
//      "track:group" matches no tab id and a fallback that navigates
//      nowhere is a dead button rather than a degraded one.
//   6. `prime` runs BEFORE the jump (D190). The feed answers the
//      topic-sheet request on the mount the jump causes, so a request
//      made after it is a request the screen has already stopped
//      listening for.
//
// `../data/live` is mocked because property 2 imports the similarity
// field, which imports Firebase and cannot boot in jsdom. EmptyField
// itself imports React and nothing else.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The store switched on is the whole surface the compared path touches —
// `SfEmptyField` reads no member of it. Hoisted so the factory below can
// close over it, the idiom every panel suite here uses.
const LIVE = vi.hoisted(() => ({ enabled: true, subscribe: () => () => {} }));
vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

import EmptyField from "./EmptyField";
import { PeopleField } from "./LiveSimilarityField";
import { registerNav, type NavHandlers } from "../data/nav";

/**
 * The two doors `app-shell.jsx` registers, installed the way the shell
 * installs them (D248). They were `window.goNav` / `window.goTab` until
 * the nav registry replaced the bridge; `registerNav` returns the teardown,
 * which is what `afterEach` now runs.
 */
let dropNav: (() => void) | null = null;
const installNav = (part: Partial<NavHandlers>) => { dropNav = registerNav(part); };

/**
 * The drawing's skeleton: every circle by radius and whether it is
 * dashed, plus whatever the canvas writes in words.
 *
 * Radius and dash are the grammar — three guide rings with the outermost
 * dashed because the scale keeps going, the accent halo, you. Colour is
 * left out on purpose: a token drifting apart in the two files is a
 * difference you can see and not a reading that is wrong, and pinning
 * fills would fail on a theme change that is correct in both.
 */
function skeleton(container: HTMLElement) {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  return {
    viewBox: svg.getAttribute("viewBox"),
    circles: [...svg.querySelectorAll("circle")].map(
      (c) => `r${c.getAttribute("r")}${c.getAttribute("stroke-dasharray") ? " dashed" : ""}`,
    ),
    text: [...svg.querySelectorAll("text")].map((t) => t.textContent),
  };
}

afterEach(() => {
  cleanup();
  // Left behind, these leak a navigating button into the next test — and
  // into every other suite in the run, since the registry is module state
  // but the habit is not.
  dropNav?.();
  dropNav = null;
});

// ── 1 · the drawing comes first, and alone ───────────────────────────

describe("an empty field is still a field (D160, D172)", () => {
  it("draws the rings and you when it is handed nothing at all", () => {
    const { container } = render(<EmptyField />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("you")).toBeTruthy();
    // The card is the drawing and nothing else. Every slot is optional
    // and the Circle stop uses two of them, so an empty caption pill or
    // an empty sentence block is chrome drawn around nothing — visible
    // on the screen, invisible to a text query.
    expect(container.firstElementChild!.children).toHaveLength(1);
    expect(container.textContent).toBe("you");
  });

  it("draws the same picture the lazy engine draws", () => {
    // `PeopleField` with an empty roster is the public door to
    // `SfEmptyField`, which is the drawing this module was copied from.
    // The copy is licensed by `MAX_EAGER_KB` (check:bundle), not by the
    // two being allowed to say different things.
    const mine = render(<EmptyField>Follow someone and they appear here.</EmptyField>);
    const engine = render(
      <PeopleField people={[]} caption={null} emptyLine="Follow someone and they appear here." />,
    );

    const drawn = skeleton(mine.container);
    // Guard against the vacuous pass: two nulls are equal, and so are two
    // empty canvases.
    expect(drawn?.circles).toHaveLength(5);
    expect(drawn?.text).toEqual(["you"]);
    expect(drawn).toEqual(skeleton(engine.container));
  });
});

// ── 2 · what a screen reader gets ────────────────────────────────────

describe("the words are the readable half", () => {
  it("hides the drawing and leaves the sentence as text", () => {
    const { container } = render(
      <EmptyField caption="your circle">Follow someone and they appear here.</EmptyField>,
    );
    // Nothing to tap and nothing to read out: a group role wrapping an
    // empty field announces a population that is not there.
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    // …so the words have to be outside it, which is where the reader who
    // has not learned this tab's grammar is told what fills the rings.
    expect(container.querySelector("svg")!.textContent).toBe("you");
    expect(screen.getByText("your circle")).toBeTruthy();
    expect(screen.getByText(/Follow someone/)).toBeTruthy();
  });

  it("says the field's name, then what fills it, then the way out", () => {
    // One assertion for the whole card, in the order it is read. A slot
    // swapped for another compiles, keeps every word on the screen, and
    // turns the field's own name into the sentence explaining it.
    const { container } = render(
      <EmptyField caption="your circle" action={{ label: "Start a group →", nav: "track:group" }}>
        One question a day, revealed with names the morning after.
      </EmptyField>,
    );
    expect(container.textContent).toBe(
      "you" + "your circle" + "One question a day, revealed with names the morning after." + "Start a group →",
    );
  });
});

// ── 3 · the door ─────────────────────────────────────────────────────

describe("the one action a field cannot take for itself", () => {
  it("grows no button where there is nothing to tap", () => {
    // City fills as strangers answer. A button there would be a way out
    // of a state that is already on its way out of itself, and the label
    // it would have to carry does not exist.
    render(<EmptyField caption="Oslo">Nobody from Oslo yet — fills in as the city answers.</EmptyField>);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("sends the full nav key rather than the tab it starts with", () => {
    const goNav = vi.fn();
    const goTab = vi.fn();
    installNav({ goNav, goTab });
    render(
      <EmptyField action={{ label: "Start a group →", nav: "track:group" }}>
        One question a day, revealed with names the morning after.
      </EmptyField>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Start a group/ }));
    // The difference is one argument and the wrong one still navigates:
    // goTab("track") lands on whatever daily scope was last open, so a
    // user arriving from the 1v1 tab gets a duel from a button promising
    // a group. The key pins the mode.
    expect(goNav).toHaveBeenCalledWith("track:group");
    expect(goTab).not.toHaveBeenCalled();
  });

  it("falls back to the tab id alone on a host with no goNav", () => {
    const goTab = vi.fn();
    installNav({ goTab });
    render(
      <EmptyField action={{ label: "Start a group →", nav: "track:group" }}>
        One question a day, revealed with names the morning after.
      </EmptyField>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Start a group/ }));
    // `goTab` matches against tab ids, and "track:group" is not one — it
    // returns silently. Handing the whole key to the fallback is a button
    // that does nothing at all, which is worse than the imprecise jump
    // the fallback exists to make.
    expect(goTab).toHaveBeenCalledWith("track");
  });

  it("primes before it jumps (D190)", () => {
    // The feed owns the topic list and answers the request on the mount
    // the jump causes; the screen it lands on is already looking by the
    // time the handler returns. Asked afterwards, the one-shot sits set
    // until something else mounts and opens the sheet then — the door
    // lands you in the feed and stops, which is the device report D190
    // was opened by.
    const order: string[] = [];
    installNav({ goNav: () => { order.push("nav"); return true; } });
    render(
      <EmptyField action={{ label: "Pick topics →", nav: "track:world", prime: () => order.push("prime") }}>
        Every topic runs in your feed until you narrow it.
      </EmptyField>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Pick topics/ }));
    expect(order).toEqual(["prime", "nav"]);
  });
});
