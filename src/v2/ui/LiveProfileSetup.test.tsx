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
// And the shape of the ask, which visual request 10 REVERSED: four fields
// are now required and there is no Skip. What that means for the cases
// below is that "it is skippable in both directions" is gone and its
// replacement is stricter — the button waits, the hint says what for, and
// nothing on the screen is ever marked wrong for being empty.
//
// It still holds no vocabulary of its own: the lists come from
// profile-vitals.js, which is the file check:anchors reads.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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
  // D331 — the political consent pair. Defaults to NOT consented, which
  // is the state a first-run screen is actually in.
  politicalConsented: vi.fn(() => false),
  // …and whether it was ANSWERED at all, which is the state a decline
  // leaves behind and consent alone cannot express.
  politicalAnswered: vi.fn(() => false),
  setPoliticalConsent: vi.fn(async (on: boolean) => { void on; }),
  social: { claimHandle: vi.fn(async (h: string) => ({ handle: h })) },
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE, localName: () => "" }));

// The catalogue, seeded rather than fetched — everything else about
// places.ts stays REAL, including `countryList`, which is what the Country
// row's options are. A hand-written list of countries here would be a
// second vocabulary, which is the thing the last describe in this file
// exists to forbid.
vi.mock("../data/places", async (importOriginal) => {
  const real = await importOriginal<typeof import("../data/places")>();
  const places = real.parseCatalogue([
    "NO", "Oslo\t580\t59.91\t10.75", "Bergen\t214\t60.39\t5.32",
    "SE", "Stockholm\t1515\t59.33\t18.06",
    "",
  ].join("\n"));
  return {
    ...real,
    default: { ...real.default, peek: () => places, load: async () => places },
  };
});

const { default: LiveProfileSetup } = await import("./LiveProfileSetup");
const { PROFILE_SETUP_LS, profileSetupNeeded, mountProfileSetup } = await import("./profileSetup");
const { PROFILE_GENERAL_LS } = await import("../data/cityAnchor");
const { backLayerCount, closeTopBackLayer, resetBackLayers } = await import("../data/backLayers");

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
  LIVE.setPoliticalConsent.mockClear();
  LIVE.politicalConsented.mockReturnValue(false);
  LIVE.politicalAnswered.mockReturnValue(false);
  LIVE.social.claimHandle.mockClear();
  onDone.mockClear();
});
afterEach(cleanup);

const pick = (labelText: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(labelText), { target: { value } });
};
const type = (labelText: string, value: string) => {
  fireEvent.change(screen.getByLabelText(labelText), { target: { value } });
};
const blob = () => JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");
const primary = () => screen.getByRole("button", { name: /^(Continue|Try again|Save handle)$/ });

/**
 * THE FOUR, answered. Every case that wants to get past the button starts
 * here, which is itself the property under test in the next describe: this
 * helper is the shortest route to a Continue that works, and there is no
 * shorter one.
 *
 * The name is seeded on the account by `beforeEach`, so three picks and no
 * typing is the minimum — a returning account is not asked to retype what
 * it is already called.
 */
const answerTheFour = () => {
  pick("Year of birth", "1990");
  pick("Gender", "Woman");
  pick("Country", "Norway");
};

// Its own root, so the render has to be flushed by hand — RTL's `render`
// is not what put it on the page.
const mount = () => act(() => { mountProfileSetup(); });
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
// The way out that survived request 10 — Android's hardware back, which
// `backLayers.ts` delivers to the layer this screen pushes.
const dismiss = () => act(() => { closeTopBackLayer(); });


describe("what the answers reach", () => {
  it("writes the anchor map, not just the profile blob", () => {
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    pick("Education", "Master's");
    fireEvent.click(primary());

    expect(LIVE.saveAnchors).toHaveBeenCalledTimes(1);
    const saved = LIVE.saveAnchors.mock.calls[0][0];
    expect(saved.gender).toBe("Woman");
    expect(saved.education).toBe("Master's");
    expect(onDone).toHaveBeenCalled();
  });

  it("does not swallow an anchor edited after a refused handle", async () => {
    // A refused handle keeps this screen up ON PURPOSE, so the person can
    // fix it — and anything else they fix on the way back is an EDIT. The
    // guard that stops the second press re-writing the first one's work
    // was a boolean latched on the first press, while the NAME half beside
    // it already keyed on content. So the two disagreed about what
    // "already written" meant, and every anchor touched between the
    // refusal and the retry was dropped without a word, on a screen that
    // then closed as though it had saved.
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("taken"));
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    // A handle is what makes the refusal reachable at all — the claim is
    // the one thing on this screen that can fail visibly, and it is the
    // reason the screen stays up for a second press.
    type("Handle", "olaf");
    fireEvent.click(primary());
    await waitFor(() => expect(LIVE.saveAnchors).toHaveBeenCalledTimes(1));
    expect(onDone, "the screen closed on a refused handle — there is no second press to test").not.toHaveBeenCalled();

    // …the screen is still up, and they add the education they had left.
    pick("Education", "Master's");
    fireEvent.click(primary());

    await waitFor(() => expect(
      LIVE.saveAnchors,
      "the second press wrote nothing — the edit made between the two was swallowed",
    ).toHaveBeenCalledTimes(2));
    const last = LIVE.saveAnchors.mock.calls[1][0];
    expect(last.education, "the level picked on the way back never reached the anchors").toBe("Master's");
    expect(blob().vitals.education, "…nor the profile blob the next open reads from").toBe("Master's");
  });

  it("writes the age and its band, never the birth year itself", () => {
    // The date never leaves the device — anchorsFrom derives an age and a
    // band from it and drops the rest, and this is the case that keeps it
    // that way. D155 added the age beside the band; the assertion that
    // matters is unchanged and is the last line.
    //
    // Since visual request 10 the screen asks for the YEAR alone rather
    // than a full date, which costs `calcAge` its month test: the exact
    // age runs up to a year high for a birthday later in the calendar
    // year. What it does not change is what is WRITTEN, which is what
    // this case is about.
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    fireEvent.click(primary());

    const saved = LIVE.saveAnchors.mock.calls[0][0];
    expect(saved.ageBand).toMatch(/^\d{2}-\d{2}$|^65\+$|^Under 18$/);
    // A bare integer of at most three characters — the shape firestore.rules
    // caps, checked here so the cap is not the only thing asserting it.
    expect(saved.age).toMatch(/^\d{1,3}$/);
    expect(JSON.stringify(saved)).not.toMatch(/1990/);
  });

  it("mirrors into the profile blob, or the next profile open erases it", () => {
    // GeneralPanel's mount effect replaces the whole anchor map from its
    // own blob. Saving server-side only would survive until then.
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    fireEvent.click(primary());
    expect(blob().vitals.gender).toBe("Woman");
  });

  it("leaves the rest of the profile blob byte-for-byte", () => {
    localStorage.setItem(PROFILE_GENERAL_LS, JSON.stringify({
      vitals: { job: "Science" }, heroes: [{ n: "Ada" }], likes: ["rain"],
    }));
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    fireEvent.click(primary());

    const b = blob();
    expect(b.heroes).toEqual([{ n: "Ada" }]);
    expect(b.likes).toEqual(["rain"]);
    // and the vital it did not ask about in this render survives
    expect(b.vitals.job).toBe("Science");
  });
});

// ── the four, and why they are four (visual request 10) ──────────────
//
// The owner's report on build 33 was "some of them should ve requierd
// before skiping", which the canvas read as self-cancelling: a skip you
// must answer four questions to reach is not a skip. So the button waits
// and there is nothing beside it.
//
// The half of this file's old reasoning that D414 retired was "never a
// wall". The half that STANDS is that a required field does not produce
// truth, it produces a value — which is why these cases are about which
// four, how the screen says so, and what it does NOT do to the other
// seven.
describe("the four it waits for", () => {
  it("will not continue on nothing, and says what it is waiting for", () => {
    render(<LiveProfileSetup onDone={onDone} />);
    expect((primary() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(primary());
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText(/Fill in the four above to continue/)).toBeTruthy();
  });

  it("is not satisfied by seven optional answers", () => {
    // The case that says the gate is on the FOUR rather than on a count.
    // Every optional field answered and not one of the required ones is
    // still not ready — which is also the shape of the bug a `filled > 0`
    // gate would have.
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Education", "Master's");
    pick("Work", "Science");
    pick("Relationship", "Prefer not to say");
    pick("Height", "170-179 cm");
    expect((primary() as HTMLButtonElement).disabled, "seven optional answers unlocked the button").toBe(true);
  });

  it("counts a country that arrived through the CITY", () => {
    // The Country row is required and the City row is not, but a catalogue
    // key CARRIES its country — so somebody who named their city has
    // answered the country question and must not be asked it again.
    // Read off the anchors rather than off the control for exactly this.
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Year of birth", "1990");
    pick("Gender", "Woman");
    // The picker is a closed button until it is tapped — that is the row's
    // whole shape, and the search input does not exist before it.
    fireEvent.click(screen.getByRole("button", { name: /Choose your city/i }));
    fireEvent.change(screen.getByLabelText("Search cities"), { target: { value: "Bergen" } });
    fireEvent.click(screen.getByText("Bergen"));
    expect((primary() as HTMLButtonElement).disabled, "a city was picked and the country still reads unanswered").toBe(false);
    fireEvent.click(primary());
    expect(LIVE.saveAnchors.mock.calls[0][0].country).toBe("NO");
  });

  it("offers no way to skip the sheet", () => {
    // The button that used to sit under the primary. Its absence IS the
    // decision, so it is asserted rather than assumed — a stray
    // re-introduction would otherwise pass every other case here.
    render(<LiveProfileSetup onDone={onDone} />);
    expect(screen.queryByRole("button", { name: /Skip for now/ })).toBeNull();
    // …and no counter either: "Save 3 of 7" was a progress bar for a form.
    expect(screen.queryByRole("button", { name: /\d of \d/ })).toBeNull();
  });

  it("still lets the platform's own back button out", () => {
    // Not a contradiction of the line above. A screen that traps the
    // hardware back button is one the store rejects, and `profileSetup.tsx`
    // writes the seen-flag on both ways out — so a dismissal is remembered
    // exactly as a Continue is. What the screen no longer does is OFFER a
    // second, easier button beside the one that asks.
    resetBackLayers();
    render(<LiveProfileSetup onDone={onDone} />);
    expect(closeTopBackLayer()).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(LIVE.saveAnchors, "a dismissal wrote anchors nobody entered").not.toHaveBeenCalled();
  });

  it("marks nothing wrong for being empty", () => {
    // The other half of "a required field produces a value, not a truth":
    // the screen asks, it does not accuse. The ONE red on this screen
    // belongs to a handle somebody else holds, and the case below is what
    // proves that colour is reachable at all — so an implementation that
    // simply never coloured anything could not pass both.
    const { container } = render(<LiveProfileSetup onDone={onDone} />);
    const reds = Array.from(container.querySelectorAll<HTMLElement>("*"))
      .filter((el) => /oklch\(0\.5 0\.19 25\)/.test(el.style.color + el.style.borderColor));
    expect(reds, "an unanswered field is drawn as an error").toHaveLength(0);
    expect(screen.queryByText(/\*/), "an asterisk legend came back").toBeNull();
  });

  it("never asks twice, whichever way it was closed", async () => {
    // Through the mount, because the flag is the CALLER's to write now —
    // the screen reports the choice and profileSetup.tsx records that the
    // question was asked. Both ways out have to write it: an account that
    // dismissed still has an empty anchor map, so nothing else would stop
    // the next boot asking again.
    for (const close of ["dismiss", "continue"] as const) {
      localStorage.clear();
      resetBackLayers();
      LIVE.anchors = () => ({});
      expect(profileSetupNeeded()).toBe(true);
      mount();
      if (close === "continue") {
        answerTheFour();
        fireEvent.click(primary());
      } else {
        dismiss();
      }
      await settle();
      expect(localStorage.getItem(PROFILE_SETUP_LS), close).toBeTruthy();
      expect(profileSetupNeeded(), close).toBe(false);
    }
  });

  // A DECLINE IS AN ANSWER. The comment above this screen's own seed says
  // so: "someone who taps 'Not these' and then leaves has decided, and
  // losing that to a dismissed screen would re-ask them tomorrow — which
  // is how a refusal quietly becomes a nag." The seed then read consent
  // alone, so a decline came back identical to never having been asked and
  // neither button was marked.
  const marked = (label: string) => {
    const b = screen.getByText(label).closest("button")!;
    return b.style.border.includes("var(--ink)");
  };

  it("shows a recorded decline as the answer it was, not as a fresh ask", () => {
    LIVE.politicalConsented.mockReturnValue(false);
    LIVE.politicalAnswered.mockReturnValue(true);
    render(<LiveProfileSetup onDone={onDone} />);
    expect(marked("Not these"), "a declined account is asked again with "
      + "neither button marked — their refusal is invisible to the screen "
      + "built to honour it").toBe(true);
    expect(marked("Yes, build it")).toBe(false);
  });

  it("shows consent as consent, and an unanswered ask as neither", () => {
    // The two states that already worked, asserted here so the fix cannot
    // have been made by marking something unconditionally.
    LIVE.politicalConsented.mockReturnValue(true);
    LIVE.politicalAnswered.mockReturnValue(true);
    const { unmount } = render(<LiveProfileSetup onDone={onDone} />);
    expect(marked("Yes, build it")).toBe(true);
    expect(marked("Not these")).toBe(false);
    unmount();

    LIVE.politicalConsented.mockReturnValue(false);
    LIVE.politicalAnswered.mockReturnValue(false);
    render(<LiveProfileSetup onDone={onDone} />);
    expect(marked("Not these")).toBe(false);
    expect(marked("Yes, build it")).toBe(false);
  });

  it("does not require the political consent to continue", () => {
    // D331's ask is a CONSENT, and a consent you cannot decline is not
    // one. So it is deliberately outside the four: the button opens on the
    // demographics alone, with the politics question unanswered.
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    expect((primary() as HTMLButtonElement).disabled).toBe(false);
    expect(LIVE.setPoliticalConsent, "the screen answered the consent on the user's behalf").not.toHaveBeenCalled();
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
// everywhere else. These are the properties that makes true: what the
// screen writes, and that a refused handle keeps the screen up rather than
// closing over the failure.
describe("the name and the handle", () => {
  it("writes the name to the profile, not just to this screen", async () => {
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    type("Display name", "  Olaf  ");
    fireEvent.click(primary());
    await settle();
    // Trimmed, and through the store — which is also what mirrors it onto
    // this device for the create-a-circle screen to read.
    expect(LIVE.saveDisplayName).toHaveBeenCalledWith("Olaf");
    expect(onDone).toHaveBeenCalled();
  });

  it("is one of the four — a blank name does not get past the button", () => {
    // Every reveal needs something to call you (D190), so this is the one
    // required field that is not a demographic.
    LIVE.displayName = "";
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Year of birth", "1990");
    pick("Gender", "Woman");
    pick("Country", "Norway");
    expect((primary() as HTMLButtonElement).disabled).toBe(true);
    type("Display name", "Olaf");
    expect((primary() as HTMLButtonElement).disabled).toBe(false);
  });

  it("claims the handle, folded the way the server folds it", async () => {
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    type("Handle", "@Olaf_T");
    fireEvent.click(primary());
    await settle();
    // normalizeHandle is the same fold claimHandleV2 runs, so a handle this
    // screen sends is one the server will accept or refuse on availability
    // alone — never on a stray @ or a capital.
    expect(LIVE.social.claimHandle).toHaveBeenCalledWith("olaf_t");
  });

  it("keeps the screen up when the handle is taken, and says what was saved", async () => {
    // The one failure on this screen a user has to see and can act on.
    // Closing over it would hand them an account with no handle and no
    // idea that the one they picked did not stick — and the second
    // sentence is what makes staying here a correction rather than a
    // re-do: everything else is already written by the time they read it.
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("already-exists: that handle is taken"));
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    type("Handle", "olaf");
    fireEvent.click(primary());
    await settle();
    expect(screen.getByText(/@olaf is taken\. Everything else is saved\./i)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    expect(LIVE.saveAnchors, "the anchors were not written before the claim failed").toHaveBeenCalledTimes(1);
    // …and the primary now names the only thing left to do.
    expect(screen.getByRole("button", { name: "Save handle" })).toBeTruthy();
  });

  it("offers to drop the handle rather than the sheet", async () => {
    // The only skip left on the screen, and it skips ONE FIELD: a handle
    // somebody else holds is the one failure a person cannot fix by trying
    // harder.
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("already-exists"));
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    type("Handle", "olaf");
    fireEvent.click(primary());
    await settle();

    LIVE.social.claimHandle.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Skip the handle for now/ }));
    await settle();
    expect(LIVE.social.claimHandle, "it tried to claim the taken handle again").not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("calls a network failure offline rather than calling the handle taken", async () => {
    // The claim is the ONE thing here that needs the network: uniqueness
    // is decided by the server, so it cannot ride Firestore's offline
    // queue the way the anchors and the name do. Reporting a dropped
    // connection as "@olaf is taken" would be a claim about somebody
    // else's account made from no evidence at all — and it would send the
    // person off to pick a different handle they did not need to.
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("unavailable: network error"));
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    type("Handle", "olaf");
    fireEvent.click(primary());
    await settle();
    // The front door's sentence, word for word — the two screens are one
    // arrival and must not have two vocabularies for one condition.
    expect(screen.getByText(/You’re offline\. Check your connection, then try again\./)).toBeTruthy();
    expect(screen.queryByText(/is taken/)).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("says a handle is claimed once, before it is claimed", () => {
    // claimHandleV2 refuses a change (D190), so this is the only moment
    // the choice can be informed — and the group heading's promise that
    // things can be changed later does not cover it, which is why the
    // handle sits outside that card and says so itself.
    render(<LiveProfileSetup onDone={onDone} />);
    expect(screen.getByText(/claimed once and can’t be changed/i)).toBeTruthy();
  });

  it("saves the anchors before it touches the network", async () => {
    // Ordering, and it is load-bearing: the anchor write is synchronous
    // and the identity writes are round trips. Behind them, a screen
    // dismissed mid-flight would lose the anchors — which are the ones
    // that cannot be re-filed later (D8/D5).
    LIVE.social.claimHandle.mockRejectedValueOnce(new Error("already-exists"));
    render(<LiveProfileSetup onDone={onDone} />);
    answerTheFour();
    type("Handle", "olaf");
    fireEvent.click(primary());
    // Synchronously, before any await settles.
    expect(LIVE.saveAnchors).toHaveBeenCalledTimes(1);
    await settle();
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
  it("offers exactly the profile card's options, not a second list", () => {
    // A copied list would pass tsc, eslint and every check — and
    // check:anchors reads profile-vitals.js, so a label that drifted here
    // would silently stop that level counting in the aggregate.
    render(<LiveProfileSetup onDone={onDone} />);
    const opts = (name: string | RegExp) =>
      Array.from((screen.getByLabelText(name) as HTMLSelectElement).options)
        .map((o) => o.value).filter(Boolean);
    expect(opts("Gender")).toEqual(["Woman", "Man", "Non-binary", "Prefer not to say"]);
    expect(opts("Height")).toContain("190 cm or taller");
    expect(opts("Education")).toContain("Vocational or trade");
    expect(opts("Relationship")).toContain("Prefer not to say");
  });

  it("takes the countries from the cities catalogue, and stores the CODE", () => {
    // The row shows a localised country name and the anchor is the ISO
    // code, because `functions/src/pure.ts` holds the country bucket to
    // /^[A-Z]{2}$/. A row that stored its own label would produce a bucket
    // the fold silently declines to count — no error anywhere, just a
    // Country stop that never fills.
    render(<LiveProfileSetup onDone={onDone} />);
    const opts = Array.from((screen.getByLabelText("Country") as HTMLSelectElement).options)
      .map((o) => o.value).filter(Boolean);
    expect(opts).toEqual(["Norway", "Sweden"]);
    answerTheFour();
    fireEvent.click(primary());
    expect(LIVE.saveAnchors.mock.calls[0][0].country).toBe("NO");
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
  beforeEach(() => { resetBackLayers(); });

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
    dismiss();
    await settle();
  });

  it("takes itself off the page when it is done", async () => {
    mount();
    dismiss();
    // The unmount is deferred by a tick — React asks callers not to
    // unmount a root from inside its own render pass.
    await settle();
    expect(screen.queryByText(/A few things about you/i)).toBeNull();
  });
});

// ── the purge, heard (D51's contract, check:purge) ───────────────────
describe("an account deletion takes the screen with it", () => {
  beforeEach(() => { resetBackLayers(); });

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
    dismiss();
    await settle();
  });
});

// ── Android's back button ────────────────────────────────────────────
//
// The same gap the walkthrough had, on the screen directly behind it:
// this is a full-screen overlay on its own root outside `<App/>`, so the
// shell's handler (person → city → overlay → tab) finds nothing to peel,
// returns false, and `back.ts` calls `App.exitApp()`. The app quits with
// the questions still on screen — and since `markProfileSetupSeen()` hangs
// off `onDone` alone, the quit records nothing and the next launch asks
// them all again.
//
// Since visual request 10 this is the ONLY way out other than answering,
// which raises rather than lowers the stakes on it.
describe("the hardware back button", () => {
  beforeEach(() => { resetBackLayers(); });

  it("registers a layer, so back does not fall through to exitApp", () => {
    render(<LiveProfileSetup onDone={onDone} />);
    expect(backLayerCount(), "nothing would peel this screen").toBe(1);
    expect(closeTopBackLayer(), "the back press was not consumed").toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("leaves the stack empty on unmount", () => {
    const { unmount } = render(<LiveProfileSetup onDone={onDone} />);
    expect(backLayerCount()).toBe(1);
    unmount();
    expect(backLayerCount()).toBe(0);
  });
});

// ── the sheet fits the phone (build 33) ────────────────────────────
//
// The owner's screenshot of build 33 showed every field running off the
// right edge, the sentence about the handle cut mid-word. One property:
// the column is `width: 100%` with 22px of padding a side, and
// `src/v2/styles.css` has NO universal `* { box-sizing: border-box }` —
// it is set per rule, which is exactly the arrangement that makes an
// inline style like this one wrong by default rather than right by
// default.
//
// jsdom computes no layout, so this cannot assert a rendered width. What
// it CAN do is pin the property whose absence produced the overflow, on
// the element that carries the padding — which is the fact that was
// missing, not a proxy for it.
describe("the column fits its phone", () => {
  it("sizes the padded column as a border box", () => {
    const { container } = render(<LiveProfileSetup onDone={onDone} />);
    // The one element with horizontal padding and a percentage width.
    const col = Array.from(container.querySelectorAll("div")).find((d) => {
      const s = (d as HTMLElement).style;
      return s.width === "100%" && /\d+px/.test(s.paddingLeft || "");
    }) as HTMLElement | undefined;
    expect(col, "the padded column is gone — re-point this test").toBeTruthy();
    expect(
      col!.style.boxSizing,
      "width:100% plus horizontal padding overflows the viewport by twice "
      + "the padding; styles.css has no universal border-box reset",
    ).toBe("border-box");
  });
});
