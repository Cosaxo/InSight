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
// The screen itself, for ONE case below: the wrapper never mounts it for a
// linked session, so the negative arm of D441's condition can only be
// observed on the screen. Every other case goes through the wrapper.
import LiveSignInGate from "./LiveSignInGate";
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
  // The wrapper's own read since D453 — the store composes the two flags
  // above into it, and answers off this device's last verdict until the
  // auth observer has spoken. Stubbed explicitly so no case here depends
  // on what jsdom's localStorage happens to hold; the composition itself
  // is pinned against real store state in `data/warm-boot.test.ts`.
  stub("wallPass", false);
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

  it("lets a passed session straight through, with no chunk to wait for", () => {
    stub("linked", true);
    stub("wallPass", true);
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
    // Sign-in from an anonymous session is the destructive call, so the
    // SECOND tap is the one that makes it (D441). The asking itself is the
    // case below; this one is about which call each tap ends in.
    fireEvent.click(await screen.findByText(/Sign in and leave this phone\u2019s answers/));
    expect(emailSignIn).toHaveBeenCalledWith("a@b.co", "secret1");
    expect(emailCreate).not.toHaveBeenCalled();

    // findBy, not getBy: the button reads "…" while the door is in flight
    // (the design's rule), so its label — and the enabled way back under
    // it — only come back once the sign-in above has settled. A getBy here
    // fails for a reason that looks like a missing control rather than a
    // pending promise. The in-use screen stays up after the call settles,
    // since only the store's observer lifts the wall.
    await screen.findByText(/Sign in and leave this phone\u2019s answers/);
    fireEvent.click(screen.getByText("Use a different account"));
    fireEvent.click(await screen.findByText("Create an account"));
    fireEvent.click(screen.getByText("Create account"));
    expect(emailCreate).toHaveBeenCalledWith("a@b.co", "secret1");
  });

  it("asks before it leaves this phone\u2019s answers — at the door the create path steers to", async () => {
    // Apple and Google get the in-use screen from Firebase refusing the
    // link. A password sign-in has no link to refuse: the call IS the
    // replacement, and the observer purges the session when it lands. So
    // from the day the wall went up this was the one door with no warning
    // — and the door "Sign in instead" points at. D441 is the owner's
    // "add it", and this case fails without it.
    await openEmail();
    fireEvent.click(screen.getByText("Create an account"));
    fill();
    emailCreate.mockRejectedValueOnce(Object.assign(new Error("nope"), { failure: "taken" }));
    fireEvent.click(screen.getByText("Create account"));
    fireEvent.click(await screen.findByText("Sign in instead"));
    fireEvent.click(await screen.findByText("Sign in"));
    // The consequence, in the words the other two doors use, and BEFORE
    // the call: nothing has been signed in yet.
    expect(await screen.findByText(/they are not merged/i)).toBeTruthy();
    expect(emailSignIn, "the first tap signed in").not.toHaveBeenCalled();
    expect(screen.getByText(/Sign in and leave this phone\u2019s answers/)).toBeTruthy();
    // …and a way back that does not take it, onto the form still filled.
    fireEvent.click(screen.getByText("Use a different account"));
    expect(emailSignIn).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("a@b.co");
  });

  it("does not claim a history it has not been told about", async () => {
    // The in-use screen is shared by three doors and reached two ways.
    // Apple and Google land on it because Firebase REFUSED the link — the
    // other account is established. The email door lands on it from the
    // condition alone, BEFORE emailSignIn is called, so at that moment the
    // typed address may have no account, or the wrong password; both come
    // back as failures on the second tap. Stating "That account already
    // has an InSight history" there is the app telling the user a fact it
    // has not got (D146: say what was measured). The cost is certain
    // either way, and the cost is what the screen is for.
    await openEmail();
    fill();
    fireEvent.click(screen.getByText("Sign in"));
    expect(await screen.findByText(/they are not merged/i)).toBeTruthy();
    expect(emailSignIn, "the claim was made after a call, not before").not.toHaveBeenCalled();
    expect(
      screen.queryByText(/already has an InSight history/i),
      "the email door asserted an account it had not asked about",
    ).toBeNull();

    // The control: the refused-link doors still name it, so this is not a
    // sweep that took the sentence off every screen.
    cleanup();
    linkGoogle.mockRejectedValueOnce(new Error("auth/credential-already-in-use"));
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    expect(
      await screen.findByText(/already has an InSight history/i),
      "the door that was refused stopped naming what it was refused for",
    ).toBeTruthy();
  });

  it("does not ask a linked session — the condition is the session, not the door", async () => {
    // Rendered WITHOUT the wrapper, deliberately and only here: SignInGate
    // never mounts the screen for a linked session, so this arm of the
    // condition is observable nowhere else. What it pins is that the
    // warning is keyed on having an anonymous history to leave, not on
    // which door was tapped — a screen that asked everyone would be a
    // second rule for one thing.
    stub("linked", true);
    render(<LiveSignInGate />);
    fireEvent.click(await screen.findByText("Use email instead"));
    fill();
    fireEvent.click(screen.getByText("Sign in"));
    expect(emailSignIn).toHaveBeenCalledWith("a@b.co", "secret1");
    expect(screen.queryByText(/they are not merged/i), "a linked session was asked").toBeNull();
  });

  it("every failure names a way out, not just a description", async () => {
    // The design's addition to the request, and the one worth a test: a
    // dead end on the one screen a person cannot get past is the failure.
    //
    // Since D441 a sign-in failure arrives on the SECOND tap, and the way
    // out it names is a control the form has — so it lands back on the
    // form, still filled, rather than on the in-use screen with nowhere to
    // retype the password.
    await openEmail();
    fill();
    emailSignIn.mockRejectedValueOnce(Object.assign(new Error("nope"), { failure: "wrong-password" }));
    fireEvent.click(screen.getByText("Sign in"));
    fireEvent.click(await screen.findByText(/Sign in and leave this phone\u2019s answers/));
    expect(await screen.findByText(/doesn\u2019t match this address/)).toBeTruthy();
    expect(screen.getByText("Forgot password?")).toBeTruthy();
    expect(screen.queryByText(/they are not merged/i), "the failure stayed on the in-use screen").toBeNull();
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("secret1");
  });

  it("offline turns the primary into Try again rather than blaming the password", async () => {
    await openEmail();
    fill();
    emailSignIn.mockRejectedValueOnce(Object.assign(new Error("net"), { failure: "offline" }));
    fireEvent.click(screen.getByText("Sign in"));
    // The second tap is the call (D441); the first one asks.
    fireEvent.click(await screen.findByText(/Sign in and leave this phone\u2019s answers/));
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
    // The rule itself moved into the store at D453 (`LIVE.wallPass`), and
    // is pinned there over real state — both arms, including the one this
    // case is named for, in `data/warm-boot.test.ts`. What stays here is
    // the wiring: a passed verdict reaches the app without the screen.
    stub("linked", true);
    stub("needsEmailVerify", false);
    stub("wallPass", true);
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
