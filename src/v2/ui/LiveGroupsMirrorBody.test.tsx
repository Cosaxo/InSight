// @vitest-environment jsdom
//
// LiveGroupsMirrorBody is the one panel that renders other people BY NAME,
// which D1 permits only inside a mutual circle. Everything it draws comes
// from reveal docs the viewer can already read, so it adds no disclosure of
// its own — but it does make claims ABOUT those people, and a wrong claim
// here is the fabrication the whole live Groups portrait replaced.
//
// The arithmetic is `data/groupPortrait.ts` and is well covered by
// groupPortrait.test.ts. What was not covered is this component: which
// claims it is willing to print, and which states it refuses to print
// anything for.
//
// The three properties worth executing, all of them recorded in D9's
// 2026-07-29 update:
//
//   - nobody is named "most like you" on fewer than MIN_SHARED shared days,
//     because one shared day is a coin flip and a label built on it is
//     exactly the invention this replaced;
//   - duos are excluded, because with two voters any disagreement is a 1-1
//     tie and the alignment ring would read 100% forever;
//   - a group with no reveals yet gets a sentence about sealing, not an
//     empty portrait or a zeroed one.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MIN_SHARED } from "../data/groupPortrait";

const LIVE = vi.hoisted(() => {
  const social = {
    groups: (mode?: string) => { void mode; return [] as Array<Record<string, unknown>>; },
    revealHistory: () => [] as Array<Record<string, unknown>>,
    loadRevealHistory: async () => {},
    bankQ: () => null as Record<string, unknown> | null,
  };
  return { enabled: true, uid: "u_me", social, subscribe: () => () => {} };
});
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveGroupsMirrorBody } = await import("./LiveGroupsMirrorBody");

const GROUP = {
  id: "g1",
  name: "The Crew",
  mode: "group",
  memberUids: ["u_me", "u_ada", "u_bo"],
  memberNames: { u_me: "Me", u_ada: "Ada", u_bo: "Bo" },
};

// One revealed day. `mine`/`ada`/`bo` are option indexes.
const day = (d: string, me: number, ada: number, bo: number) => ({
  day: d,
  qid: "group-gu0",
  votes: { u_me: { optionIdx: me }, u_ada: { optionIdx: ada }, u_bo: { optionIdx: bo } },
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.uid = "u_me";
  LIVE.social.groups = () => [GROUP];
  LIVE.social.revealHistory = () => [];
  LIVE.social.bankQ = () => ({ prompt: "Who moves first?", options: ["Left", "Right"] });
});
afterEach(cleanup);

describe("LiveGroupsMirrorBody · thin history makes no claims about people", () => {
  it(`names nobody "most like you" on fewer than ${MIN_SHARED} shared days`, () => {
    // One shared day, and on it Ada agreed with me perfectly. 100% — and
    // meaningless, because it is one coin flip. The panel must not print it.
    LIVE.social.revealHistory = () => [day("2026-07-29", 0, 0, 1)];
    render(<LiveGroupsMirrorBody />);
    const text = document.body.textContent || "";
    expect(text).not.toMatch(/most like you/i);
    expect(text).not.toMatch(/100%/);
  });

  it(`names someone once there ARE ${MIN_SHARED} shared days`, () => {
    // The control. Without it the assertion above passes for a panel that
    // never names anyone at all, which would be a different bug wearing the
    // same green tick.
    LIVE.social.revealHistory = () => [
      day("2026-07-29", 0, 0, 1),
      day("2026-07-28", 1, 1, 0),
    ];
    render(<LiveGroupsMirrorBody />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/Ada/);
  });
});

describe("LiveGroupsMirrorBody · states it refuses to fake", () => {
  it("says answers are sealed when the group has no reveals yet", () => {
    LIVE.social.revealHistory = () => [];
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText(/answers stay sealed until the morning after/i)).toBeTruthy();
    // Not a zeroed portrait: an alignment of 0 of 0 days would read as
    // "you never agree with these people".
    expect(document.body.textContent).not.toMatch(/0 of 0/);
  });

  it("offers to start one when there are no groups, rather than rendering blank", () => {
    LIVE.social.groups = () => [];
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText(/No groups yet/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start a group/i })).toBeTruthy();
  });

  it("sends Start-a-group to the GROUP scope, not just the daily tab", () => {
    // goTab("track") restores whatever daily scope was last open, so a user
    // coming from the 1v1 tab landed back on 1v1 — a button that promises a
    // group and delivers a duel. The pin is on the goNav key, because the
    // difference is one argument and the wrong one still "navigates".
    const goNav = vi.fn();
    (window as unknown as { goNav?: (k: string) => void }).goNav = goNav;
    try {
      LIVE.social.groups = () => [];
      render(<LiveGroupsMirrorBody />);
      screen.getByRole("button", { name: /Start a group/i }).click();
      expect(goNav).toHaveBeenCalledWith("track:group");
    } finally {
      delete (window as unknown as { goNav?: (k: string) => void }).goNav;
    }
  });

  it("renders nothing at all when LIVE is off", () => {
    // The spec layer picks the demo body in that case; drawing both, or
    // drawing this one against an empty store, is the failure.
    LIVE.enabled = false;
    const { container } = render(<LiveGroupsMirrorBody />);
    expect(container.textContent).toBe("");
  });
});

describe("LiveGroupsMirrorBody · duos are excluded by construction (D9)", () => {
  it("asks the store for groups only, never duos", () => {
    // With two voters every disagreement is a 1-1 tie, so "with the
    // majority" is always true and the ring would read 100% forever. The
    // exclusion is a filter argument at the call site, which is easy to drop
    // and impossible to notice — the panel would just start showing duos
    // with a perfect score.
    const seen: Array<string | undefined> = [];
    LIVE.social.groups = (mode?: string) => { seen.push(mode); return [GROUP]; };
    render(<LiveGroupsMirrorBody />);
    expect(seen).toContain("group");
    expect(seen).not.toContain(undefined);
  });
});

describe("LiveGroupsMirrorBody · the day rows say what was actually chosen", () => {
  beforeEach(() => {
    LIVE.social.revealHistory = () => [
      day("2026-07-29", 0, 0, 1),
      day("2026-07-28", 1, 1, 0),
    ];
  });

  it("labels the majority option from the bank, not the option index", () => {
    render(<LiveGroupsMirrorBody />);
    // 2 of 3 picked index 0 on the 29th -> "Left"; index 1 on the 28th ->
    // "Right". Printing "Option 1" instead would be the fallback path for a
    // question the bank cannot resolve, and would be wrong here.
    expect(screen.getAllByText("Left").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Right").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Option \d/);
  });

  it("falls back to a member's name for a pick question with no bank options", () => {
    // "pick" questions carry no bank options — their options ARE the
    // members — so the label has to resolve through memberUids instead.
    LIVE.social.bankQ = () => ({ prompt: "Who would you trust with a secret?", options: [] });
    render(<LiveGroupsMirrorBody />);
    // index 0 -> memberUids[0] -> "Me"; the row label is the picked member.
    expect(document.body.textContent).not.toMatch(/Option \d/);
    expect(document.body.textContent).toMatch(/Me|Ada|Bo/);
  });

  it("reports alignment over days the viewer actually played", () => {
    // I played both days and was with the majority on both.
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText(/2 of 2 days/i)).toBeTruthy();
  });

  it("does not count days the viewer sat out as days they lost", () => {
    // No vote from u_me on the 28th. The denominator is days played, not
    // days revealed — counting a skipped day as a miss would make the ring
    // punish absence and read as disagreement.
    LIVE.social.revealHistory = () => [
      day("2026-07-29", 0, 0, 1),
      { day: "2026-07-28", qid: "group-gu0", votes: { u_ada: { optionIdx: 1 }, u_bo: { optionIdx: 0 } } },
    ];
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText(/1 of 1 days/i)).toBeTruthy();
  });
});

describe("LiveGroupsMirrorBody · the expand row is reachable without a mouse", () => {
  it("renders each day as a button with aria-expanded", () => {
    // It was a clickable <div>, which no keyboard could open. Asserted here
    // rather than left to the a11y ratchet, because the ratchet only counts
    // findings — it would stay green if this regressed to a <div> carrying
    // a role and a tabIndex but no working key handler.
    LIVE.social.revealHistory = () => [day("2026-07-29", 0, 0, 1)];
    render(<LiveGroupsMirrorBody />);
    const rows = screen.getAllByRole("button", { expanded: false });
    expect(rows.length).toBeGreaterThan(0);
  });
});
