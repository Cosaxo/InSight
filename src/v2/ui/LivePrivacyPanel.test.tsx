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
// The claim list the CI gate reads, shared rather than re-typed (D183):
// a second copy of these patterns is a second thing to forget to update.
// @ts-expect-error TS7016 — plain .mjs gate script, no types
import { missingClaims, readPage } from "../../../scripts/check-policy-claims.mjs";

const LIVE = vi.hoisted(() => ({
  // D178: every named surface draws a face now, so a LIVE stand-in
  // that lacks this crashes the row rather than falling back to
  // initials. "" is the no-photo shape, which is most accounts.
  faceFor: () => "",
  myFace: () => "",
  setAvatar: async () => ({ ok: true }),
  removeAvatar: async () => {},
  flagAvatar: async () => {},
  flaggedAvatar: () => false,
  enabled: true,
  uid: "u_me",
  displayName: "Tester",
  // "" is an account with no handle — the state the claim control is for
  // (D190). A case below sets one and asserts the control is gone.
  handle: "",
  deleteAccount: async () => {},
  linkGoogle: async () => {},
  saveDisplayName: async () => {},
  social: { claimHandle: async (h: string) => ({ handle: h }) },
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE, localName: () => "" }));
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

// A DESCRIBE STOOD HERE — "the disclosure does not promise anonymity the
// app never gives" — and its two cases are gone with the bullets they read
// (D183). What they guarded is not:
//
// The takes bullet claimed world takes appear "always without a name" from
// the D106 sweep until that test existed, while LiveTakesPanel rendered
// LIVE.nameFor(authorUid) under a "posted under your name" header — a
// panel whose entire purpose is matching what the app SAYS to what the
// rules DO, promising an anonymity the rules never gave. The k-floor case
// was the same shape, one promise over.
//
// Both asserted on the *vocabulary of the retired model* rather than on a
// sentence, and that is precisely what `check:public-copy` does — over an
// enumerated file list that already includes web/privacy.html, which is
// where the takes and counts wording now lives. The guard did not move
// because it was never only here; the positive half ("takes carry your
// display name", "counts are exact") is a row in check-policy-claims.

describe("LivePrivacyPanel · off in demo mode", () => {
  it("renders nothing when LIVE is disabled", () => {
    // The panel makes claims about a real account. In demo mode there is no
    // account, so every one of them would be false.
    LIVE.enabled = false;
    const { container } = render(<LivePrivacyPanel />);
    expect(container.textContent).toBe("");
  });
});

describe("LivePrivacyPanel · the disclosure moved to the policy page (D183)", () => {
  // WHERE THESE ASSERTIONS USED TO POINT, and why they still exist.
  //
  // Three describes stood here — the takes bullet, the type cut, and
  // D172's "the list collapsed, the promises did not" — and every one of
  // them read a `<li>` out of the panel. The owner asked for the list to
  // leave the app and be disclosed elsewhere (D183), so the subject of all
  // three is gone from this component.
  //
  // They are NOT deleted with it. A promise nothing asserts is a promise
  // one tidy-up away from disappearing, which is exactly what D172's
  // source comment was written to prevent. What changed is the file they
  // read: the panel now owns the ROUTE, and web/privacy.html owns the
  // words — so these read the page the panel points at, through the same
  // claim list scripts/check-policy-claims.mjs gates in CI. One list, two
  // readers, no chance of them drifting apart.
  it("keeps the public-answers sentence open, and needs no tap for it", () => {
    render(<LivePrivacyPanel />);
    // The bluntest sentence in the app, and the one CLAUDE.md insists on:
    // a user learning that their answers are public from a stranger
    // quoting their vote back at them is what this panel exists to
    // prevent. A link is not a substitute for it.
    const openLine = [...document.querySelectorAll("div")].find(
      (el) => /Your answers are public/i.test(el.textContent || "") && !el.closest("details"),
    );
    expect(openLine, "the public-answers line stopped being open on arrival").toBeTruthy();
  });

  it("states no disclosure it no longer owns", () => {
    render(<LivePrivacyPanel />);
    // The negative half, and the reason it is worth a case: a bullet
    // re-added here would be a SECOND copy of a promise that is gated
    // somewhere else, and two copies is how the takes line came to say
    // "always without a name" while the takes panel said the opposite
    // (D106, the failure check:public-copy exists for).
    expect(document.querySelectorAll("details").length,
      "the collapsed disclosure came back — it lives in web/privacy.html now").toBe(0);
    expect(document.querySelectorAll("li").length,
      "disclosure bullets came back into the panel").toBe(0);
  });

  it("routes to the policy, and the policy is reachable off the bundle", () => {
    render(<LivePrivacyPanel />);
    // Both stores require the policy on the open web, and a link that
    // opened a bundled file would satisfy neither them nor a user who
    // pastes it somewhere. Asserted as the href rather than the label so
    // renaming the link cannot quietly break the route.
    const link = [...document.querySelectorAll("a")]
      .find((a) => /privacy\.html$/.test(a.getAttribute("href") || ""));
    expect(link, "the route to the disclosure is gone — the promises are now unreachable").toBeTruthy();
    expect(link!.getAttribute("href")).toMatch(/^https?:\/\//);
  });

  it("keeps every promise the panel gave up, on the page it points at", () => {
    // The four that exist because a specific decision made them true —
    // D9's coordinates, D84's square, D174's linger, D146's type cut —
    // plus the rest of the list, checked by label so a failure names the
    // decision rather than a regex.
    //
    // Opening that page to move them into found three ALREADY stale:
    // "kilometre-sized" (D175 shrank the grid five-fold), "goes stale
    // within minutes" (D174 made it three hours) and "a count is all that
    // comes back" (D177 made the room readable). The app was right and
    // the policy was wrong the whole time, which is the case for one
    // canonical copy — and for this case, rather than a promise to keep
    // the page in mind.
    expect(missingClaims(readPage())).toEqual([]);
  });
});

// ── the handle is claimed once (D190) ────────────────────────────────
//
// The row offered a "Change" button and the rename behind it worked: the
// callable took the new key and freed the old one in one transaction, so
// the address a user had handed people went back in the pool the same
// minute. A handle is how someone is ADDED to a circle (D122) — an address
// that can be reassigned is one nobody can be given.
//
// The server is the gate (claimHandleV2 refuses a change); these are about
// the panel not offering what the server will refuse, which is the other
// half of the same promise.
describe("LivePrivacyPanel · a handle is claimed once", () => {
  afterEach(() => { LIVE.handle = ""; });

  it("offers the claim only to an account that has no handle", () => {
    LIVE.handle = "";
    render(<LivePrivacyPanel />);
    expect(screen.getByRole("button", { name: /^Claim$/ })).toBeTruthy();
    // …and says so before the tap, because the tap cannot be taken back.
    expect(screen.getByText(/only get to pick once/i)).toBeTruthy();
  });

  it("shows a claimed handle as a fact, with no way to change it", () => {
    LIVE.handle = "olaf";
    render(<LivePrivacyPanel />);
    expect(screen.getByText("@olaf")).toBeTruthy();
    // The control, in both of its shapes. "Change" is the one that shipped.
    expect(screen.queryByRole("button", { name: /^Change$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Claim$/ })).toBeNull();
    expect(screen.queryByLabelText(/Your handle/i)).toBeNull();
    // And the panel says it, rather than leaving the absence to be inferred.
    expect(screen.getByText(/can’t be changed/i)).toBeTruthy();
  });
});
