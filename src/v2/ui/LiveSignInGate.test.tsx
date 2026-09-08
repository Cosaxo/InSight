// @vitest-environment jsdom
//
// The first-launch account wall (D134). It reverses D3 for one build, so
// the cases that matter most are the ones proving it is INERT everywhere
// else: a gate that leaked into the demo build, the dev server or a test
// would put a Google button in front of a session that has no Firebase
// behind it at all.
//
// Both halves are exercised here, and through the SAME entry point the app
// uses (SignInGate, the eager wrapper) rather than the screen directly —
// the split between them is a bundle-budget decision (see SignInGate's
// header), and a test that reached past the wrapper would stop noticing if
// the wiring between the two broke.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const linkGoogle = vi.fn(async () => {});
const linkApple = vi.fn(async () => {});
const emailSignIn = vi.fn(async () => {});
const emailCreate = vi.fn(async () => {});
const emailReset = vi.fn(async () => {});
const googleSignIn = vi.fn(async () => {});
const appleSignIn = vi.fn(async () => {});
const refreshVerification = vi.fn(async () => true);
const sendVerification = vi.fn(async () => {});
const abandonSignIn = vi.fn(async () => {});

vi.mock("../../lib/firebase", () => ({
  googleSignIn: (...a: unknown[]) => googleSignIn(...(a as [])),
  appleSignIn: (...a: unknown[]) => appleSignIn(...(a as [])),
}));

import LIVE from "../data/live";
import SignInGate from "./SignInGate";
import { signInRequired } from "./signInRequired";

const store = LIVE as unknown as Record<string, unknown>;
const saved = new Map<string, PropertyDescriptor | undefined>();

// The store's real members are getters with no setter, so a plain
// assignment throws in strict mode — the live-fixture lesson, in miniature.
function stub(k: string, value: unknown) {
  if (!saved.has(k)) saved.set(k, Object.getOwnPropertyDescriptor(store, k));
  Object.defineProperty(store, k, { value, writable: true, configurable: true });
}

const Child = () => <div>the app</div>;

// The screen is a dynamic import (React.lazy), so every case that expects
// to SEE it has to let the chunk resolve first. Synchronous cases — the
// pass-through arms — do not, and deliberately do not await: "the app
// rendered on the first frame" is the property those are about.
const gate = () => render(<SignInGate><Child /></SignInGate>);
async function gateReady() {
  const r = gate();
  // Every arm of the screen ends in at least one button ("Continue with
  // Google" and "Sign in with Apple", or "Try again"), so this is the one
  // wait that works for all of them. findBy* rather than a fixed number of
  // ticks: React.lazy memoises the resolved component, so only the FIRST
  // case in this file pays the suspend and a tick-counting helper would
  // pass for the wrong reason whenever the order changed.
  //
  // findAllBy, not findBy: the live arm has carried two doors since Apple
  // joined, and the singular form throws "found multiple elements" — which
  // reads as a broken screen rather than as a second button arriving.
  await screen.findAllByRole("button");
  return r;
}

beforeEach(() => {
  linkGoogle.mockClear();
  linkApple.mockClear();
  emailSignIn.mockClear();
  emailCreate.mockClear();
  emailReset.mockClear();
  googleSignIn.mockClear();
  refreshVerification.mockClear();
  sendVerification.mockClear();
  abandonSignIn.mockClear();
  stub("subscribe", () => () => {});
  stub("linkGoogle", linkGoogle);
  stub("linkApple", linkApple);
  stub("emailSignIn", emailSignIn);
  stub("emailCreate", emailCreate);
  stub("emailReset", emailReset);
  stub("refreshVerification", refreshVerification);
  stub("sendVerification", sendVerification);
  stub("abandonSignIn", abandonSignIn);
  stub("enabled", true);
  stub("linked", false);
  stub("needsEmailVerify", false);
  stub("accountEmail", null);
  stub("bootError", "");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  for (const [k, d] of saved) {
    if (d) Object.defineProperty(store, k, d);
    else delete store[k];
  }
  saved.clear();
});

describe("the gate is off unless the build asked for it", () => {
  it("renders the app on the first frame when the flag is unset", () => {
    // Synchronous on purpose: with the flag off the wrapper must not even
    // reach the lazy screen, so there is nothing to await. If this ever
    // needs an await, the deferral has stopped working.
    expect(signInRequired()).toBe(false);
    gate();
    expect(screen.getByText("the app")).toBeTruthy();
  });

  it("stays off when the flag is present but not \"true\"", () => {
    // Vite substitutes the literal string, so a shell that exported an
    // empty value must not read as consent.
    for (const v of ["", "false", "1", "yes"]) {
      vi.stubEnv("VITE_REQUIRE_SIGNIN", v);
      expect(signInRequired(), `"${v}" enabled the wall`).toBe(false);
    }
  });
});

describe("with the flag on", () => {
  beforeEach(() => vi.stubEnv("VITE_REQUIRE_SIGNIN", "true"));

  it("walls off the app until the session is linked", async () => {
    await gateReady();
    expect(screen.queryByText("the app")).toBeNull();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
    // Apple's door is not optional decoration: guideline 4.8 wants it
    // offered as prominently as any other social login the moment this
    // wall is the way in, so its ABSENCE is the regression to catch.
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
  });

  it("lets a linked session straight through, with no chunk to wait for", () => {
    stub("linked", true);
    gate();
    expect(screen.getByText("the app")).toBeTruthy();
  });

  it("LINKS rather than signs in — the anonymous session's answers survive", async () => {
    // The whole reason the wall is affordable: initLive() has already
    // signed in anonymously, so the tap is an upgrade of that uid, not a
    // new account. A gate that called googleSignIn() here would silently
    // strand every answer given before it appeared.
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    expect(linkGoogle).toHaveBeenCalledTimes(1);
    expect(googleSignIn).not.toHaveBeenCalled();
  });

  it("Apple LINKS too — the same property, the other door", async () => {
    // The reason this is its own case rather than a parameter on the one
    // above: the two doors are separate call paths, and a gate that linked
    // Google and signed in fresh with Apple would strand a session's
    // answers exactly as badly, while the Google case stayed green.
    await gateReady();
    fireEvent.click(screen.getByText("Sign in with Apple"));
    expect(linkApple).toHaveBeenCalledTimes(1);
    expect(googleSignIn).not.toHaveBeenCalled();
  });

  it("waits for a connection instead of falling back to the demo app", async () => {
    // A build whose premise is "your answers are kept" must not hand
    // someone sample questions when boot fails — the answers would not be
    // kept, and nothing on screen would say so.
    stub("enabled", false);
    stub("bootError", "still connecting — signing in");
    await gateReady();
    expect(screen.queryByText("the app")).toBeNull();
    expect(screen.queryByText("Continue with Google")).toBeNull();
    expect(screen.queryByText("Sign in with Apple")).toBeNull();
    expect(screen.getByText(/still connecting — signing in/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("names the cost when the Google account is already an InSight account", async () => {
    // Firebase refuses the link rather than merging, and the only way on is
    // to abandon this session. That must be a second, labelled tap — the
    // first one must never do it.
    linkGoogle.mockRejectedValueOnce(new Error("auth/credential-already-in-use"));
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    // The consequence is on the screen and on the button, in those words.
    expect(await screen.findByText(/they are not merged/i)).toBeTruthy();
    // \u2019, not '. Every other string on this screen and in
    // design/front-door-2026-09-07 uses the typographic apostrophe, and a
    // screen that mixes the two is one nobody proofreads twice. The prop
    // carries the character itself because an HTML entity in a STRING PROP
    // is not decoded — which is the bug this assertion caught.
    const btn = screen.getByText(/Sign in and leave this phone\u2019s answers/);
    expect(googleSignIn).not.toHaveBeenCalled();   // not yet — one more tap
    // …and there is a way back that does not take it.
    expect(screen.getByText("Use a different account")).toBeTruthy();
    fireEvent.click(btn);
    expect(googleSignIn).toHaveBeenCalledTimes(1);
  });

  it("recovers through the door the user chose, not always through Google", async () => {
    // The wall ships on iOS, where Apple is the LEAD door and reinstall is
    // the ordinary way to get here (D6 took Android backup away, so an
    // anonymous session dies with the handset) — which made
    // Apple → already-in-use the primary recovery path. It signed in with
    // GOOGLE: a different account, or a third one, after a screen that had
    // just said "sign in to it".
    linkApple.mockRejectedValueOnce(new Error("auth/credential-already-in-use"));
    await gateReady();
    fireEvent.click(screen.getByText("Sign in with Apple"));
    fireEvent.click(await screen.findByText(/Sign in and leave this phone\u2019s answers/));
    expect(appleSignIn, "the Apple door's recovery did not use Apple").toHaveBeenCalledTimes(1);
    expect(googleSignIn, "the Apple door's recovery reached for Google").not.toHaveBeenCalled();
  });

  it("shows any other failure rather than sitting there", async () => {
    // The store's auth observer never fires for a failed link, so an error
    // swallowed here is a permanently dead button.
    //
    // THE FIXTURE IS THE REAL SHAPE NOW, and that is the whole case. It
    // used to be `new Error("FirebaseError: popup blocked")`, which the SDK
    // does not produce and which the old one-colon strip happened to
    // reduce to "popup blocked" — so this passed while a person on the wall
    // read `Error (auth/popup-blocked).` Firebase's message is
    // `Firebase: Error (auth/<code>).`, and it is what these mocks reject
    // with from here on.
    linkGoogle.mockRejectedValueOnce(new Error("Firebase: Error (auth/popup-blocked)."));
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    const said = (await screen.findByRole("alert")).textContent ?? "";
    expect(said, "a raw Firebase code reached the screen").not.toMatch(/auth\//);
    expect(said, "the popup failure does not say what to do about it").toMatch(/pop-ups/i);
  });

  it("says the same thing about being offline that the email door does", async () => {
    // The condition both doors can meet, and the one that made the split
    // visible: the email door renders "You're offline. Check your
    // connection, then try again." while Apple and Google rendered
    // `Error (auth/network-request-failed).` for the same failure.
    linkApple.mockRejectedValueOnce(new Error("Firebase: Error (auth/network-request-failed)."));
    await gateReady();
    fireEvent.click(screen.getByText("Sign in with Apple"));
    const said = (await screen.findByRole("alert")).textContent ?? "";
    expect(said, "a raw Firebase code reached the screen").not.toMatch(/auth\//);
    expect(said).toMatch(/You\u2019re offline/);
  });

  it("says NOTHING when the person closed the sheet themselves", async () => {
    // Not an error to report. Before this it put
    // `Error (auth/popup-closed-by-user).` on screen for a deliberate tap.
    linkGoogle.mockRejectedValueOnce(new Error("Firebase: Error (auth/popup-closed-by-user)."));
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    // The door has to come back — a cancelled sheet that leaves the button
    // spinning is the dead button this describe block is about.
    expect(await screen.findByText("Continue with Google")).toBeTruthy();
    expect(screen.queryByRole("alert"), "a cancelled sign-in reported an error").toBeNull();
  });
});

// ── the email door ──────────────────────────────────────────────────
//
// Built to design/front-door-2026-09-07. What these pin is the part of
// that canvas a screenshot cannot hold: which call each control makes,
// and that a failure leaves a way out rather than a description.
describe("the email door", () => {
  beforeEach(() => vi.stubEnv("VITE_REQUIRE_SIGNIN", "true"));

  const openEmail = async () => {
    await gateReady();
    fireEvent.click(screen.getByText("Use email instead"));
  };
  const fill = (addr = "a@b.co", pw = "secret1") => {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: addr } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: pw } });
  };

  it("is folded by default, and the two one-tap doors are what you see", async () => {
    // The design's whole ordering argument: most people take a one-tap
    // door and should not read past a form to find it.
    await gateReady();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
    expect(screen.getByText("Use email instead")).toBeTruthy();
  });

  it("signs in with the address and password, and CREATE links instead", async () => {
    // Two calls, not one with a flag: create links the anonymous session
    // so answers survive, sign-in replaces it. Confusing them is how a
    // first cohort loses its history.
    await openEmail();
    fill();
    fireEvent.click(screen.getByText("Sign in"));
    expect(emailSignIn).toHaveBeenCalledWith("a@b.co", "secret1");
    expect(emailCreate).not.toHaveBeenCalled();

    // findBy, not getBy: the toggle is hidden while a door is in flight
    // (the design's rule), so it only comes back once the sign-in above
    // has settled. A getBy here fails for a reason that looks like a
    // missing control rather than a pending promise.
    fireEvent.click(await screen.findByText("Create an account"));
    fireEvent.click(screen.getByText("Create account"));
    expect(emailCreate).toHaveBeenCalledWith("a@b.co", "secret1");
  });

  it("every failure names a way out, not just a description", async () => {
    // The design's addition to the request, and the one worth a test: a
    // dead end on the one screen a person cannot get past is the failure.
    await openEmail();
    fill();
    emailSignIn.mockRejectedValueOnce(Object.assign(new Error("nope"), { failure: "taken" }));
    fireEvent.click(screen.getByText("Sign in"));
    expect(await screen.findByText(/already has an account/)).toBeTruthy();
    expect(screen.getByText("Sign in instead")).toBeTruthy();
  });

  it("offline turns the primary into Try again rather than blaming the password", async () => {
    await openEmail();
    fill();
    emailSignIn.mockRejectedValueOnce(Object.assign(new Error("net"), { failure: "offline" }));
    fireEvent.click(screen.getByText("Sign in"));
    expect(await screen.findByText(/You\u2019re offline/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("sends a reset and then offers nothing but the inbox", async () => {
    await openEmail();
    fill();
    fireEvent.click(screen.getByText("Forgot password?"));
    expect(emailReset).toHaveBeenCalledWith("a@b.co");
    expect(await screen.findByText("Check your inbox")).toBeTruthy();
    // The form is gone: leaving it up invites a second send.
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByText("Back to sign in")).toBeTruthy();
  });

  it("hides the toggle and the legal footer while the keyboard is up", async () => {
    // The reason the design gave a 375x667 phone its own artboard. Focus
    // is the honest proxy for the keyboard inside a WebView.
    await openEmail();
    expect(screen.getByText("Create an account")).toBeTruthy();
    expect(screen.getByText(/Answers on InSight are public/)).toBeTruthy();
    fireEvent.focus(screen.getByLabelText("Password"));
    expect(screen.queryByText("Create an account")).toBeNull();
    expect(screen.queryByText(/Answers on InSight are public/)).toBeNull();
  });

  it("does not let an unconfirmed address past the wall", async () => {
    // The gap the verify screen closes: Firebase creates the account the
    // moment it accepts the password, so `linked` is true while nothing
    // has shown the address belongs to whoever typed it.
    stub("linked", true);
    stub("needsEmailVerify", true);
    stub("accountEmail", "typo@b.co");
    await gateReady();
    expect(screen.queryByText("the app")).toBeNull();
    expect(screen.getByText("Confirm your address")).toBeTruthy();
    // Named from the STORE, so a relaunch — which empties the field the
    // address was typed into — still says which inbox to open.
    expect(screen.getByText("typo@b.co")).toBeTruthy();
    // And the doors are gone: there is nothing left to choose.
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });

  it("asks the SERVER whether the address was confirmed, and says so when it was not", async () => {
    // Following the link happens in a mail app; no token refresh reaches
    // this process on its own. A screen that read a cached flag would sit
    // there forever for someone who did everything right.
    stub("linked", true);
    stub("needsEmailVerify", true);
    refreshVerification.mockResolvedValueOnce(false);
    await gateReady();
    fireEvent.click(screen.getByText(/I\u2019ve confirmed it/));
    expect(refreshVerification).toHaveBeenCalledTimes(1);
    // A false changes no store flag, so nothing re-renders on its own —
    // the screen has to answer the question the tap asked or it reads as
    // a dead button.
    expect(await screen.findByText(/Not confirmed yet/)).toBeTruthy();
  });

  it("resends, and claims only what it attempted", async () => {
    // sendVerification is best-effort and never throws, so the sentence is
    // about the send, not about delivery.
    stub("linked", true);
    stub("needsEmailVerify", true);
    await gateReady();
    fireEvent.click(screen.getByText("Send it again"));
    expect(sendVerification).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Sent again/)).toBeTruthy();
  });

  it("offers a way out of a typo, or the wall is a locked room", async () => {
    // An account on an address nobody owns cannot be verified and cannot
    // be reset — the reset mail goes to the same wrong inbox. Without this
    // control the app is unreachable on that device forever.
    stub("linked", true);
    stub("needsEmailVerify", true);
    await gateReady();
    fireEvent.click(screen.getByText("Use a different address"));
    expect(abandonSignIn).toHaveBeenCalledTimes(1);
  });

  it("a confirmed account walks straight through", async () => {
    // The other side of the same rule, and the one that would strand every
    // Apple and Google account if `needsEmailVerify` were ever over-broad.
    stub("linked", true);
    stub("needsEmailVerify", false);
    gate();
    expect(screen.getByText("the app")).toBeTruthy();
  });

  it("says answers are public BEFORE anyone signs up", async () => {
    // D98's obligation pointed forward: learning it afterwards from a
    // stranger quoting your vote is the failure this sentence prevents.
    await gateReady();
    expect(screen.getByText(/Answers on InSight are public, yours included/)).toBeTruthy();
    expect(screen.getByText("Terms")).toBeTruthy();
    expect(screen.getByText("Privacy Policy")).toBeTruthy();
  });
});
