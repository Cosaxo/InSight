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
// Everything else here — the name, the handle-as-fact — is covered only as
// far as "the control exists and reaches the store". Two describes near the
// end carry the settings rows D211 removed: Crash reports is pinned ABSENT,
// because a control that quietly returns re-offers what the server refuses;
// Sign-in is pinned PRESENT, because D219 removed the wall that had been
// D211's whole reason for dropping it and nothing went back for the row.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Store subscribers, so a test can drive a notify the way hydrate does. */
const subscribers = new Set<() => void>();
const notifyAll = () => { for (const fn of [...subscribers]) fn(); };
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  saveDisplayName: async () => {},
  // D331 — the compass row. Consented by default here so the row's ON
  // copy is what the existing cases render past; the OFF copy and the
  // withdrawal write have their own cases below.
  // The sign-in row's two members. `linked` is false by default because
  // that is what a store build produces: D219 took the wall down, so an
  // account is anonymous until someone taps this row.
  linked: false,
  linkGoogle: vi.fn(async () => {}),
  politicalConsented: vi.fn(() => true),
  setPoliticalConsent: vi.fn(async (on: boolean) => { void on; }),
  // A REAL notifier, not a no-op. The panel re-renders on every store
  // notify, and the case at the end of this file needs that path to exist
  // — with `() => () => {}` the store could correct itself and no render
  // would ever happen, so any "follows the store" assertion would be
  // measuring nothing.
  subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
}));
vi.mock("../data/live", () => ({ default: LIVE, localName: () => "" }));
// The walkthrough's mount (D393), reached from this panel by a dynamic
// import: mocked so the case below can assert the row asks for a
// RE-showing rather than mounting the real screen over the panel.
const WT = vi.hoisted(() => ({ mountWalkthrough: vi.fn(async (opts?: { again?: boolean }) => { void opts; }) }));
vi.mock("./walkthrough", () => ({ mountWalkthrough: WT.mountWalkthrough }));

const { default: LivePrivacyPanel } = await import("./LivePrivacyPanel");

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.linked = false;
  LIVE.linkGoogle.mockReset();
  LIVE.linkGoogle.mockResolvedValue(undefined);
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

// ── the panel states identity, it no longer edits it (D190 → D211) ────
//
// The history in two steps. The handle row offered a "Change" button and
// the rename behind it worked, so D190 made a handle claimed-once and
// left this panel a CLAIM control for accounts with none. D211 removed
// that too: the claim form is what an account whose handle has not
// hydrated is shown, where it reads as an offer to pick a new handle from
// settings — the thing D190 abolished. Identity is asked at first run
// (LiveProfileSetup); here a handle is a fact or absent, never a form.
//
// The server is still the gate (claimHandleV2 refuses a change); these
// are about the panel not offering what the server will refuse, which is
// the other half of the same promise.
describe("LivePrivacyPanel · a handle is a fact here, never a form", () => {
  afterEach(() => { LIVE.handle = ""; });

  it("offers no claim to an account without one — the row is simply absent", () => {
    LIVE.handle = "";
    render(<LivePrivacyPanel />);
    expect(screen.queryByRole("button", { name: /^Claim$/ })).toBeNull();
    expect(screen.queryByLabelText(/Your handle/i)).toBeNull();
    expect(screen.queryByText(/Your handle/)).toBeNull();
  });

  it("shows a claimed handle as a fact, with no way to change it", () => {
    LIVE.handle = "olaf";
    render(<LivePrivacyPanel />);
    expect(screen.getByText("@olaf")).toBeTruthy();
    // The control, in all three of its historical shapes.
    expect(screen.queryByRole("button", { name: /^Change$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Claim$/ })).toBeNull();
    expect(screen.queryByLabelText(/Your handle/i)).toBeNull();
    // And the panel says it, rather than leaving the absence to be inferred.
    expect(screen.getByText(/can’t be changed/i)).toBeTruthy();
  });
});

// ── one settings row still removed outright (D211) ────────────────────
//
// Crash reports: the toggle is gone and reporting is on by default (D76
// amended by D211); the recorded opt-outs of older builds stay honoured in
// sentry.ts, which sentry.test.ts pins. What is pinned HERE is only that
// the control does not quietly return.
describe("LivePrivacyPanel · no Crash-reports toggle", () => {
  it("renders neither the row nor its control", () => {
    render(<LivePrivacyPanel />);
    expect(screen.queryByText("Crash reports")).toBeNull();
    expect(screen.queryByRole("button", { name: /^(On|Off) ?✓?$/ })).toBeNull();
  });
});

// ── the sign-in row, which D211 removed and D219 made necessary again ──
//
// THIS SUITE IS THE GUARD ON A STALE PREMISE, not on a widget. D211 took
// this row out because the D134 wall meant "the row could only ever read
// Linked ✓"; D219 removed the wall and left the row gone, so a store build
// shipped with no way to link an account anywhere. An anonymous session
// dies with the phone (D134's own words), so every reinstall minted a
// second account — the diffuse duplication that D54's scan cannot see and
// D28's correction cannot unwind, because neither has a uid list to work
// from. The cases below pin the two things that failure needed: that the
// offer EXISTS when the session is unlinked, and that taking it reaches
// the linker rather than the sign-in that would strand the session.
describe("LivePrivacyPanel · the sign-in row", () => {
  it("offers the link when the session is anonymous, and says what is at stake", () => {
    render(<LivePrivacyPanel />);
    expect(screen.getByText("Sign-in")).toBeTruthy();
    expect(screen.getByText(/live on this phone only/)).toBeTruthy();
  });

  it("LINKS rather than signs in — the difference is the session's answers", async () => {
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    // linkGoogle keeps the uid and every answer already given; googleSignIn
    // abandons them. Asserting on WHICH call is made is the only way to tell
    // the two apart from outside — D134 pins the same distinction at the gate.
    await waitFor(() => expect(LIVE.linkGoogle).toHaveBeenCalledTimes(1));
  });

  it("states the collision instead of abandoning the session", async () => {
    // Firebase refuses to merge two histories. The gate answers this with
    // "Sign in and leave this phone's answers" because it runs before there
    // are any; from settings that same control is a wipe wearing a login, so
    // this row must report and stop.
    LIVE.linkGoogle.mockRejectedValueOnce(new Error("auth/credential-already-in-use"));
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/already has an InSight history/));
    expect(screen.queryByRole("button", { name: /leave this phone/i })).toBeNull();
  });

  it("reads as a settled fact once linked, with no control", () => {
    LIVE.linked = true;
    render(<LivePrivacyPanel />);
    expect(screen.getByText("Linked ✓")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
    expect(screen.getByText(/survive a new phone/)).toBeTruthy();
  });
});

// The political compass row (D331).
//
// WHY IT IS TESTED HERE AT ALL, given that vote.test.ts already pins the
// gate and politicalConsent.test.ts the predicate: this row is the only
// place a user is ever told the compass exists, and it makes a claim about
// what turning it off DOES. A row whose button stopped calling the writer
// would leave a switch that reads "off" over a coordinate still published
// — the failure the whole record is about, wearing a working UI.
describe("LivePrivacyPanel · the political compass row", () => {
  it("says it is on, and does not withdraw on the first tap", () => {
    LIVE.politicalConsented.mockReturnValue(true);
    render(<LivePrivacyPanel />);
    expect(screen.getByText("Political compass")).toBeTruthy();
    expect(screen.getByText(/Anyone signed in can read it/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Turn off…" }));
    // Armed, not fired — the same two-tap shape Delete everything uses,
    // and for the same reason: this one deletes something.
    expect(LIVE.setPoliticalConsent).not.toHaveBeenCalled();
    expect(screen.getByText(/Copies anyone\s+already made are beyond us/)).toBeTruthy();
  });

  it("withdraws on the confirm tap", async () => {
    LIVE.politicalConsented.mockReturnValue(true);
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Turn off…" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, turn off" }));
    await waitFor(() => expect(LIVE.setPoliticalConsent).toHaveBeenCalledWith(false));
  });

  it("offers a one-tap turn-on when it is off, and says answers still count", () => {
    // No confirm step in this direction: turning it ON destroys nothing,
    // and a confirmation dialogue in front of a harmless action teaches
    // people to tap through the one in front of a harmful one.
    LIVE.politicalConsented.mockReturnValue(false);
    render(<LivePrivacyPanel />);
    expect(screen.getByText(/Your answers still count/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(LIVE.setPoliticalConsent).toHaveBeenCalledWith(true);
  });

  it("follows the store when consent arrives after the panel is open", async () => {
    // The row was a `useState` lazy initializer — read once per mount and
    // never again — while the profile's consent field fills late, in
    // hydrate. So an account that HAS consented, opening Account before
    // the profile document landed, was told "Off … no political profile is
    // built from them" while the coordinate was published.
    //
    // A claim about the server, made from a snapshot of what this device
    // happened to know at mount, which is the failure this panel's own
    // D327 note is written against.
    LIVE.politicalConsented.mockReturnValue(false);
    render(<LivePrivacyPanel />);
    expect(screen.getByText(/Your answers still count/)).toBeTruthy();
    // …hydration lands and the store now knows better. The panel already
    // re-renders on every notify; what it did not do was re-read.
    LIVE.politicalConsented.mockReturnValue(true);
    await act(async () => { notifyAll(); });
    expect(screen.queryByText(/Your answers still count/),
      "the row kept its mount-time snapshot after the store corrected it").toBeNull();
  });
});

describe("LivePrivacyPanel · the walkthrough can be shown again (D393)", () => {
  it("mounts it from its row as a re-showing, so the seen flag does not refuse it", async () => {
    // The gate refuses a device that has seen the walkthrough — which is
    // every device that has this panel open. `again` is what makes the
    // row a row rather than a button that does nothing.
    WT.mountWalkthrough.mockClear();
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Show again$/ }));
    await vi.waitFor(() => expect(WT.mountWalkthrough).toHaveBeenCalledTimes(1));
    expect(WT.mountWalkthrough).toHaveBeenCalledWith({ again: true });
  });
});
