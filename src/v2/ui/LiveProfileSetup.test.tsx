// @vitest-environment jsdom
//
// The account-creation questions (D151), and the two claims that make them
// worth a screen of their own rather than a note pointing at the profile.
//
//   1. THEY REACH THE ANCHOR MAP. Every answer snapshots the anchors at
//      vote time (D8) and answers are create-only (D5/D86), so an anchor
//      missing when you vote is missing from that answer forever — the
//      trigger folded it into no breakdown cell and no later edit can move
//      it. A screen that collected these into localStorage and not into
//      LIVE.saveAnchors would look identical and fix nothing.
//   2. THEY GO INTO THE PROFILE BLOB TOO. GeneralPanel mirrors
//      anchorsFrom(vitals) into saveAnchors on EVERY mount, deliberately
//      (it is how a fabricated anchor gets repaired). So anchors written
//      only server-side survive exactly until the profile overlay next
//      opens and are then replaced by the blob's empty vitals — silently.
//      This is the same trap setCityAnchor documents at length.
//
// And the shape of the ask: it is skippable in both directions, it never
// asks twice, and it holds no vocabulary of its own — the lists come from
// profile-general.jsx, which is the file check:anchors reads.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  ready: true,
  anchors: () => ({}) as Record<string, string>,
  saveAnchors: vi.fn((a: Record<string, string>) => { void a; }),
  // Identity, asked here since D190. `displayName` doubles as the gate's
  // other trigger — an account with anchors and no name is still asked.
  displayName: "",
  handle: "",
  saveDisplayName: vi.fn(async (n: string) => { void n; }),
  social: { claimHandle: vi.fn(async (h: string) => ({ handle: h })) },
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE, localName: () => "" }));

const { default: LiveProfileSetup } = await import("./LiveProfileSetup");
const { PROFILE_SETUP_LS, profileSetupNeeded, mountProfileSetup } = await import("./profileSetup");
const { PROFILE_GENERAL_LS } = await import("../data/cityAnchor");

const onDone = vi.fn();

beforeEach(() => {
  localStorage.clear();
  LIVE.enabled = true;
  LIVE.ready = true;
  LIVE.anchors = () => ({});
  // A name on the account by default, so the anchor cases below decide the
  // gate on their own subject rather than on D190's new trigger.
  LIVE.displayName = "Tester";
  LIVE.saveAnchors.mockClear();
  LIVE.saveDisplayName.mockClear();
  LIVE.social.claimHandle.mockClear();
  onDone.mockClear();
});
afterEach(cleanup);

// Its own root, so the render has to be flushed by hand — RTL's `render`
// is not what put it on the page.
const mount = () => act(() => { mountProfileSetup(); });
const settle = async (ms = 5) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };

// Answering a field is now two taps: open the app's own menu, choose a row
// (D275). It was `fireEvent.change` on a native <select>, which is the one
// thing these fields are no longer made of — an iOS <select> opens the
// PLATFORM's menu, and the whole point of the change is that this screen
// stops handing the reader something that is not the app.
//
// Awaited, because the sheet dismisses on the animation the rest of the
// app's sheets dismiss on: the VALUE lands on the tap, but the rows are
// still on the page for another frame, and a second field opened over them
// would have two "No answer" rows to choose between.
const pick = async (field: string | RegExp, value: string) => {
  fireEvent.click(screen.getByLabelText(field));
  fireEvent.click(screen.getByRole("option", { name: value }));
  await settle(260);
};
/** The rows a field offers, in order — its whole vocabulary. */
const optionsOf = async (field: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(field));
  const rows = screen.getAllByRole("option").map((o) => o.textContent || "");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await settle(260);
  return rows;
};
const blob = () => JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");


describe("what the answers reach", () => {
  it("writes the anchor map, not just the profile blob", async () => {
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Year", "1990");
    await pick("Month", "July");
    await pick("Day", "12");
    await pick("Gender", "Woman");
    await pick("Education", "Master's");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    expect(LIVE.saveAnchors).toHaveBeenCalledTimes(1);
    const saved = LIVE.saveAnchors.mock.calls[0][0];
    expect(saved.gender).toBe("Woman");
    expect(saved.education).toBe("Master's");
    expect(onDone).toHaveBeenCalled();
  });

  it("writes the age and its band, never the birthday", async () => {
    // The exact date never leaves the device — anchorsFrom derives an age
    // and a band from it and drops the rest, and this is the case that
    // keeps it that way. D155 added the age beside the band; the assertion
    // that matters is unchanged and is the last line.
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Year", "1990");
    await pick("Month", "July");
    await pick("Day", "12");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    const saved = LIVE.saveAnchors.mock.calls[0][0];
    expect(saved.ageBand).toMatch(/^\d{2}-\d{2}$|^65\+$|^Under 18$/);
    // A bare integer of at most three characters — the shape firestore.rules
    // caps, checked here so the cap is not the only thing asserting it.
    expect(saved.age).toMatch(/^\d{1,3}$/);
    expect(JSON.stringify(saved)).not.toMatch(/1990|July|"12"/);
  });

  it("mirrors into the profile blob, or the next profile open erases it", async () => {
    // GeneralPanel's mount effect replaces the whole anchor map from its
    // own blob. Saving server-side only would survive until then.
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Man");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    expect(blob().vitals.gender).toBe("Man");
  });

  it("leaves the rest of the profile blob byte-for-byte", async () => {
    localStorage.setItem(PROFILE_GENERAL_LS, JSON.stringify({
      vitals: { job: "Science" }, heroes: [{ n: "Ada" }], likes: ["rain"],
    }));
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Man");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    const b = blob();
    expect(b.heroes).toEqual([{ n: "Ada" }]);
    expect(b.likes).toEqual(["rain"]);
    // and the vital it did not ask about in this render survives
    expect(b.vitals.job).toBe("Science");
  });

  it("takes an answer back out — every field here is optional", async () => {
    // A native <select> gave this for free through its empty option; a
    // list of answers has to offer the row. Without it a mis-tap on a
    // first-run screen is permanent until the profile overlay is found.
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Man");
    expect(screen.getByRole("button", { name: "Save 1 of 7" })).toBeTruthy();
    await pick("Gender", "No answer");
    expect(screen.getByRole("button", { name: /Answer one to continue/ })).toBeTruthy();
  });
});

describe("the ask is an ask, not a wall", () => {
  it("skipping writes nothing and still closes", () => {
    // D3 is anonymous-first and "never a wall". A required demographic
    // form is also how you teach people to lie to one.
    render(<LiveProfileSetup onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    expect(LIVE.saveAnchors).not.toHaveBeenCalled();
    expect(blob()).toBeNull();
    expect(onDone).toHaveBeenCalled();
  });

  it("never asks twice, whichever way it was closed", async () => {
    // Through the mount, because the flag is the CALLER's to write now —
    // the screen reports the choice and profileSetup.tsx records that the
    // question was asked. Both ways out have to write it: an account that
    // skipped still has an empty anchor map, so nothing else would stop
    // the next boot asking again.
    for (const close of [/Skip for now/, /^Save/]) {
      localStorage.clear();
      LIVE.anchors = () => ({});
      expect(profileSetupNeeded()).toBe(true);
      mount();
      await pick("Gender", "Woman");
      fireEvent.click(screen.getByRole("button", { name: close }));
      await settle();
      expect(localStorage.getItem(PROFILE_SETUP_LS), String(close)).toBeTruthy();
      expect(profileSetupNeeded(), String(close)).toBe(false);
    }
  });

  it("does not offer to save nothing", () => {
    render(<LiveProfileSetup onDone={onDone} />);
    const save = screen.getByRole("button", { name: /Answer one to continue/ });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(save);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("counts what has been answered, so partial is visibly fine", async () => {
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Woman");
    expect(screen.getByRole("button", { name: "Save 1 of 7" })).toBeTruthy();
    await pick("Height", "170-179 cm");
    expect(screen.getByRole("button", { name: "Save 2 of 7" })).toBeTruthy();
  });
});

// ── identity, asked here and nowhere later (D190) ────────────────────
//
// The name was asked by the create-a-circle screen, in a field above the
// circle's name, and reported from a device as the wrong screen for it.
// The handle was only ever offered in the account panel, four taps deep,
// with a Change button that freed the old one.
//
// Both are facts about the ACCOUNT, so they are asked once, here, and read
// everywhere else. These are the two properties that makes true: what the
// screen writes, and that a refused handle keeps the screen up rather than
// closing over the failure.
describe("the name and the handle", () => {
  it("writes the name to the profile, not just to this screen", async () => {
    render(<LiveProfileSetup onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "  Olaf  " } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await settle();
    // Trimmed, and through the store — which is also what mirrors it onto
    // this device for the create-a-circle screen to read.
    expect(LIVE.saveDisplayName).toHaveBeenCalledWith("Olaf");
    expect(onDone).toHaveBeenCalled();
  });

  it("claims the handle, folded the way the server folds it", async () => {
    render(<LiveProfileSetup onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("Your handle"), { target: { value: "@Olaf_T" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await settle();
    // normalizeHandle is the same fold claimHandleV2 runs, so a handle this
    // screen sends is one the server will accept or refuse on availability
    // alone — never on a stray @ or a capital.
    expect(LIVE.social.claimHandle).toHaveBeenCalledWith("olaf_t");
  });

  it("keeps the screen up when the handle is taken, and says which", async () => {
    // The one failure on this screen a user has to see and can act on.
    // Closing over it would hand them an account with no handle and no
    // idea that the one they picked did not stick.
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("already-exists: that handle is taken"));
    render(<LiveProfileSetup onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("Your handle"), { target: { value: "olaf" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await settle();
    expect(screen.getByText(/@olaf is taken/i)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("saves the anchors before it touches the network", async () => {
    // Ordering, and it is load-bearing: the anchor write is synchronous
    // and the identity writes are round trips. Behind them, a screen
    // dismissed mid-flight would lose the anchors — which are the ones
    // that cannot be re-filed later (D8/D5).
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("already-exists"));
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Woman");
    fireEvent.change(screen.getByLabelText("Your handle"), { target: { value: "olaf" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save 1 of 7$/ }));
    // Synchronously, before any await settles.
    expect(LIVE.saveAnchors).toHaveBeenCalledTimes(1);
    await settle();
  });

  // ── the failure that was a locked door (D275) ──────────────────────
  //
  // Reported from a device, on the first screen of a new account: the
  // handle field said "Unauthenticated" in red and Save did nothing. That
  // word is firebase-functions', printed raw — a callable answers it when
  // App Check cannot attest the build, which is a fact about the REQUEST
  // and not about the handle. The screen treated it exactly like "taken":
  // stay up, print it, wait for a better handle. There is no better
  // handle. Every press failed the same way, with the anchors and the
  // name already saved behind it.
  //
  // These three are what makes that a door: it says what happened in the
  // app's own words, it can be retried, and it can be left.
  it("does not print the transport's own word at the reader", async () => {
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("Unauthenticated"));
    render(<LiveProfileSetup onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("Your handle"), { target: { value: "olaf" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await settle();
    expect(screen.queryByText(/Unauthenticated/i)).toBeNull();
    expect(screen.getByText(/Couldn’t claim @olaf just now/i)).toBeTruthy();
  });

  it("offers the claim again, and lets it be left behind", async () => {
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("internal"));
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Woman");
    fireEvent.change(screen.getByLabelText("Your handle"), { target: { value: "olaf" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save 1 of 7$/ }));
    await settle();
    expect(onDone).not.toHaveBeenCalled();

    // Retry: the same claim, not a second anchor write.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await settle();
    expect(LIVE.social.claimHandle).toHaveBeenCalledTimes(2);
    expect(LIVE.saveAnchors).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalled();
  });

  it("leaves with the anchors saved and the handle unclaimed", async () => {
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("unavailable"));
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Woman");
    fireEvent.change(screen.getByLabelText("Your handle"), { target: { value: "olaf" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save 1 of 7$/ }));
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Continue without a handle" }));
    await settle();
    // Left, rather than tried a third time — and the seven answers that
    // cannot be re-filed later are already written.
    expect(LIVE.social.claimHandle).toHaveBeenCalledTimes(1);
    expect(LIVE.saveAnchors.mock.calls[0][0].gender).toBe("Woman");
    expect(onDone).toHaveBeenCalled();
  });

  it("never leaves both buttons disabled", async () => {
    // The other half of the same trap: `busy` was cleared by hand at every
    // early return, so a throw from anywhere ELSE left a screen whose only
    // two controls were both dead. Nothing could be pressed, including the
    // one that abandons the screen.
    LIVE.saveAnchors.mockImplementationOnce(() => { throw new Error("boom"); });
    render(<LiveProfileSetup onDone={onDone} />);
    await pick("Gender", "Woman");
    fireEvent.click(screen.getByRole("button", { name: /^Save 1 of 7$/ }));
    await settle();
    expect(onDone).not.toHaveBeenCalled();
    const out = screen.getByRole("button", { name: /Skip for now/ }) as HTMLButtonElement;
    expect(out.disabled).toBe(false);
  });

  it("says a handle is picked once, before it is picked", () => {
    // claimHandleV2 refuses a change (D190), so this is the only moment
    // the choice can be informed.
    render(<LiveProfileSetup onDone={onDone} />);
    expect(screen.getByText(/picked once and can’t be changed/i)).toBeTruthy();
  });
});

describe("who gets asked", () => {
  it("asks an account with no anchors at all", () => {
    expect(profileSetupNeeded()).toBe(true);
  });

  it("does not ask an account that already answered these elsewhere", () => {
    // Every account that filled the Basics card in before this screen
    // existed. Re-asking them would be the app forgetting.
    LIVE.anchors = () => ({ gender: "Woman" });
    expect(profileSetupNeeded()).toBe(false);
  });

  it("asks an account with anchors but no name (D190)", () => {
    // The account this screen now exists for as much as the empty one:
    // it has been through the anchors and has nothing to be called, so
    // every screen that needs a name would go on asking for one.
    LIVE.anchors = () => ({ gender: "Woman" });
    LIVE.displayName = "";
    expect(profileSetupNeeded()).toBe(true);
  });

  it("does not ask before the store has hydrated", () => {
    // The anchors arrive with hydration. Deciding against a store that has
    // not finished loading asks everybody, every cold start.
    LIVE.ready = false;
    expect(profileSetupNeeded()).toBe(false);
  });

  it("never asks in a demo build", () => {
    // There is no account and no server to write to; the vitals there are
    // the sample persona.
    LIVE.enabled = false;
    expect(profileSetupNeeded()).toBe(false);
  });
});

describe("it holds no vocabulary of its own", () => {
  it("offers exactly the profile card's options, not a second list", async () => {
    // A copied list would pass tsc, eslint and every check — and
    // check:anchors reads profile-vitals.js, so a label that drifted here
    // would silently stop that level counting in the aggregate.
    //
    // The rows are read off the open menu now rather than off a <select>'s
    // `.options`, and the first one is the picker's own "No answer" — the
    // empty option every one of these fields used to carry, said out loud.
    render(<LiveProfileSetup onDone={onDone} />);
    expect(await optionsOf("Gender"))
      .toEqual(["No answer", "Woman", "Man", "Non-binary", "Prefer not to say"]);
    expect(await optionsOf("Height")).toContain("190 cm or taller");
    expect(await optionsOf("Education")).toContain("Vocational or trade");
    expect(await optionsOf("Relationship")).toContain("Prefer not to say");
  });
});

// ── the way in (D151) ────────────────────────────────────────────────
//
// The screen mounts into a root of its own, from main.jsx's dynamic
// import, rather than wrapping <App /> in a gate component. That is a
// bundle decision: MAX_EAGER_KB is the constant keeping the Firestore SDK
// out of first paint, it has no headroom, and a gate main.jsx had to
// import statically measured 1 KB over it. So the DECISION lives in this
// lazy chunk too, and these are the cases that hold it there.
describe("mounting", () => {
  it("puts nothing on the page when the account has been asked already", () => {
    LIVE.anchors = () => ({ gender: "Woman" });
    mount();
    expect(screen.queryByText(/A few things about you/i)).toBeNull();
  });

  it("mounts when it is needed, and only once", async () => {
    mount();
    mount();
    expect(screen.getAllByText(/A few things about you/i)).toHaveLength(1);
    // leave the page clean for the next case — this root is not RTL's
    fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    await settle();
  });

  it("takes itself off the page when it is done", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    // The unmount is deferred by a tick — React asks callers not to
    // unmount a root from inside its own render pass.
    await settle();
    expect(screen.queryByText(/A few things about you/i)).toBeNull();
  });
});

// ── the purge, heard (D51's contract, check:purge) ───────────────────
describe("an account deletion takes the screen with it", () => {
  it("drops the screen and writes no flag on insight:local-purge", async () => {
    // The flag itself cannot go stale — profileSetupSeen reads storage on
    // every call. What can is the SCREEN: purgeLocalTrace fires on account
    // deletion and on a uid change, and a setup screen already up belongs
    // to the session that just ended. Left there, its next tap would write
    // the key the purge had just removed, under the NEW uid, and the new
    // account would never be asked.
    mount();
    expect(screen.getByText(/A few things about you/i)).toBeTruthy();

    // The purge: the dispatcher clears the keys, then announces.
    localStorage.clear();
    await act(async () => {
      window.dispatchEvent(new Event("insight:local-purge"));
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(screen.queryByText(/A few things about you/i)).toBeNull();
    // Nothing written on the way out — so the next boot asks, which is the
    // right thing to do with an account that has answered nothing.
    expect(localStorage.getItem(PROFILE_SETUP_LS)).toBeNull();
    expect(profileSetupNeeded()).toBe(true);
  });

  it("lets the screen mount again afterwards", async () => {
    // The teardown has to clear the module's own `mounted` handle, or the
    // idempotence guard would refuse every later mount for the life of the
    // session.
    mount();
    localStorage.clear();
    await act(async () => {
      window.dispatchEvent(new Event("insight:local-purge"));
      await new Promise((r) => setTimeout(r, 5));
    });
    mount();
    expect(screen.getAllByText(/A few things about you/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    await settle();
  });
});
