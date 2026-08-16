// @vitest-environment jsdom
//
// LivePrivacyPanel is mostly copy, and copy is not worth a test that only
// re-types it. What IS worth one is the single irreversible control in the
// app: "Delete everything" calls deleteAccount, which wipes the profile, the
// answers and the auth account, and whose own sub-line says "There is no
// undo."
//
// Two properties, both about that button:
//   - it takes two deliberate taps, and the first one is what surfaces the
//     no-undo warning. A one-tap delete on a phone is a mis-tap away from an
//     unrecoverable wipe.
//   - a FAILED delete has to say so. deleteAccount deliberately refuses the
//     auth delete if any wipe phase failed, so it throws far more often than
//     most callables — and "nothing was lost, please retry" is only useful
//     if the user is shown it.
//
// Everything else here — telemetry toggle, name, Google linking — is covered
// only as far as "the control exists and reaches the store", which is what
// its own case asserts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  uid: "u_me",
  displayName: "Tester",
  deleteAccount: async () => {},
  linkGoogle: async () => {},
  saveDisplayName: async () => {},
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE }));
vi.mock("../../lib/sentry", () => ({
  telemetryEnabled: true,
  setTelemetryEnabled: () => {},
  reportError: () => {},
  setSentryUser: () => {},
}));

const { default: LivePrivacyPanel } = await import("./LivePrivacyPanel");

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.deleteAccount = async () => {};
  // location.reload is called on a successful delete; jsdom throws "not
  // implemented" on the real one.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});
afterEach(cleanup);

describe("LivePrivacyPanel · deleting an account takes two deliberate taps", () => {
  it("does not call deleteAccount on the first tap", () => {
    let called = 0;
    LIVE.deleteAccount = async () => { called++; };
    render(<LivePrivacyPanel />);

    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    expect(called, "the first tap wiped the account").toBe(0);
    // …and the first tap is what earns the warning.
    expect(screen.getByText(/There is no undo/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeTruthy();
  });

  it("calls it on the confirm tap", async () => {
    let called = 0;
    LIVE.deleteAccount = async () => { called++; };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete/i }));
    await vi.waitFor(() => expect(called).toBe(1));
  });

  it("backs out cleanly, leaving no armed delete behind", () => {
    let called = 0;
    LIVE.deleteAccount = async () => { called++; };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(screen.queryByRole("button", { name: /Yes, delete/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Delete…$/ })).toBeTruthy();
    expect(called).toBe(0);
  });
});

describe("LivePrivacyPanel · a refused deletion is shown, not swallowed", () => {
  it("surfaces the server's message when deleteAccount throws", async () => {
    // deleteAccount refuses the auth delete if ANY wipe phase failed, and
    // returns "Deletion incomplete (…) — nothing was lost, please retry."
    // Swallowing that leaves the user believing they are erased when they
    // are not, which is the worst outcome that path has.
    LIVE.deleteAccount = async () => {
      throw new Error("internal: Deletion incomplete (v2Groups) — nothing was lost, please retry.");
    };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete/i }));
    expect(await screen.findByText(/nothing was lost, please retry/i)).toBeTruthy();
  });

  it("does not reload the page when the delete failed", async () => {
    // The success path reloads into a fresh anonymous session. Reloading
    // after a failure would hide the error it just produced.
    LIVE.deleteAccount = async () => { throw new Error("nope"); };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete/i }));
    await screen.findByText(/nope/i);
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});

describe("LivePrivacyPanel · the disclosure does not promise anonymity the app never gives", () => {
  // The header comment above says copy is not worth a test that only
  // re-types it. These two are the exception, and they are here because
  // the copy went wrong exactly once in each direction.
  //
  // The takes bullet claimed world takes appear "always without a name"
  // from the D106 sweep until this test existed, while LiveTakesPanel
  // rendered LIVE.nameFor(authorUid) under a "posted under your name"
  // header — a panel whose entire purpose is matching what the app SAYS
  // to what the rules DO, promising an anonymity the rules never gave.
  //
  // So these assert on the *vocabulary of the retired model* rather than
  // on today's sentence: a rewrite may say this any way it likes, but it
  // may not go back to claiming namelessness or a floor.
  // Scoped to the takes bullet, not the whole panel: "anonymous" is
  // correct twice elsewhere here — the D3 anonymous session and the
  // uid-only crash reports — so a panel-wide negative match would forbid
  // two true sentences to catch one false one.
  const takesBullet = () => {
    render(<LivePrivacyPanel />);
    const li = [...document.querySelectorAll("li")]
      .find((el) => /\btakes?\b/i.test(el.textContent || ""));
    if (!li) throw new Error("no bullet about takes — the disclosure lost it entirely");
    return li.textContent || "";
  };

  it("says takes carry the author's name, and does not call them nameless", () => {
    const text = takesBullet();
    expect(text).toMatch(/posted under your name/i);
    expect(text).not.toMatch(/without a name|anonymous|nameless|no names/i);
  });

  it("does not re-promise the k-floor anywhere in the disclosure", () => {
    // The floor died at D98. The panel states the inverse — a count of 1
    // is visibly one person — and that is the claim that must survive,
    // because it is the one a user needs before answering.
    render(<LivePrivacyPanel />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/exact from the very first answer/i);
    expect(text).not.toMatch(/k-anonym|floored|withheld until|minimum (?:group|cohort)/i);
  });
});

describe("LivePrivacyPanel · off in demo mode", () => {
  it("renders nothing when LIVE is disabled", () => {
    // The panel makes claims about a real account. In demo mode there is no
    // account, so every one of them would be false.
    LIVE.enabled = false;
    const { container } = render(<LivePrivacyPanel />);
    expect(container.textContent).toBe("");
  });
});

describe("LivePrivacyPanel · the type cut's disclosure", () => {
  // Pinned for the same reason the takes bullet is: the claim it replaces
  // ("a test result is never a breakdown dim, so nothing is ever
  // cross-tabbed by it") was TRUE and is now only half true, and the half
  // that died is the half a user would want to know. A future sweep that
  // deletes this bullet to tidy the list has to argue with an assertion.
  const typeBullet = () => {
    render(<LivePrivacyPanel />);
    const li = [...document.querySelectorAll("li")]
      .find((el) => /Big Five/i.test(el.textContent || ""));
    if (!li) throw new Error("no bullet about the type cut — the disclosure lost it entirely");
    return li.textContent || "";
  };

  it("says answers can be grouped by type", () => {
    expect(typeBullet()).toMatch(/grouped by your Big Five type/i);
  });

  it("says the grouping reaches answers given before the type existed", () => {
    // The retroactive half. It is the one property a reader cannot guess
    // from "answers are public" plus "results are public", because every
    // other cut on the same sheet is frozen at vote time.
    expect(typeBullet()).toMatch(/before you had a type/i);
  });

  it("keeps the Art. 9 instruments out of it, in writing", () => {
    // data/typeMix.TYPE_TEST is the enforcement; this is the promise.
    // They are pinned in two places on purpose — the code one is a
    // constant a refactor could widen without touching any copy.
    expect(typeBullet()).toMatch(/politics, values and social results are never used/i);
  });
});


describe("LivePrivacyPanel · the list collapsed, the promises did not (D171)", () => {
  it("keeps the public-answers sentence open and everything else one tap away", () => {
    render(<LivePrivacyPanel />);
    // Open on arrival, because a user learning this from a stranger
    // quoting their vote is what the panel exists to prevent (CLAUDE.md).
    // getAllBy: the open sentence and the first bullet inside the details
    // both say it, which is deliberate — the summary line is the one that
    // must not need a tap, and the bullet is the full version.
    expect(screen.getAllByText(/Your answers are public/i).length).toBeGreaterThan(0);
    const openLine = [...document.querySelectorAll("div")].find(
      (el) => /Your answers are public/i.test(el.textContent || "") && !el.closest("details"),
    );
    expect(openLine, "the public-answers line moved inside the disclosure").toBeTruthy();

    // The rest is behind a real disclosure widget, and `details` renders
    // its children into the DOM whether open or shut — so this asserts
    // REACHABILITY, which is what the stores and D9/D84/D98/D146 need,
    // not visibility.
    const d = document.querySelector("details");
    if (!d) throw new Error("the disclosure widget is gone");
    expect(d.querySelectorAll("li").length,
      "bullets were deleted rather than collapsed").toBe(10);

    // The four that exist because a specific decision made them true. If
    // one of these ever disappears it should be because its decision was
    // reversed, not because a layout pass thinned the list.
    const text = d.textContent || "";
    expect(text, "D9's location promise").toMatch(/never your coordinates/i);
    // Tracks the grid: "kilometre-sized" until D174 moved it to 0.002°
    // (~200 m) in the same commit that made the fix precise. This guard
    // is the reason the copy could not quietly fall behind the constant.
    expect(text, "D84's presence promise").toMatch(/200-metre grid square/i);
    expect(text, "D173's linger, which the copy missed for one commit")
      .toMatch(/three hours after you close the app/i);
    expect(text, "D146's type cut").toMatch(/grouped by your Big Five type/i);
    expect(text, "the exact-counts promise").toMatch(/counts\s+are exact/i);
  });
});
