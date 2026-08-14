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
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveProfileSetup } = await import("./LiveProfileSetup");
const { PROFILE_SETUP_LS, profileSetupNeeded, mountProfileSetup } = await import("./profileSetup");
const { PROFILE_GENERAL_LS } = await import("../data/cityAnchor");

const onDone = vi.fn();

beforeEach(() => {
  localStorage.clear();
  LIVE.enabled = true;
  LIVE.ready = true;
  LIVE.anchors = () => ({});
  LIVE.saveAnchors.mockClear();
  onDone.mockClear();
});
afterEach(cleanup);

const pick = (labelText: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(labelText), { target: { value } });
};
const blob = () => JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");

// Its own root, so the render has to be flushed by hand — RTL's `render`
// is not what put it on the page.
const mount = () => act(() => { mountProfileSetup(); });
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };


describe("what the answers reach", () => {
  it("writes the anchor map, not just the profile blob", () => {
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Year", "1990");
    pick("Month", "July");
    pick("Day", "12");
    pick("Gender", "Woman");
    pick("Education", "Master's");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    expect(LIVE.saveAnchors).toHaveBeenCalledTimes(1);
    const saved = LIVE.saveAnchors.mock.calls[0][0];
    expect(saved.gender).toBe("Woman");
    expect(saved.education).toBe("Master's");
    expect(onDone).toHaveBeenCalled();
  });

  it("writes the BAND, never the birthday", () => {
    // The exact date never leaves the device — anchorsFrom derives the band
    // and drops the rest, and this is the case that keeps it that way.
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Year", "1990");
    pick("Month", "July");
    pick("Day", "12");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    const saved = LIVE.saveAnchors.mock.calls[0][0];
    expect(saved.ageBand).toMatch(/^\d{2}-\d{2}$|^65\+$|^Under 18$/);
    expect(JSON.stringify(saved)).not.toMatch(/1990|July|"12"/);
  });

  it("mirrors into the profile blob, or the next profile open erases it", () => {
    // GeneralPanel's mount effect replaces the whole anchor map from its
    // own blob. Saving server-side only would survive until then.
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Gender", "Man");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    expect(blob().vitals.gender).toBe("Man");
  });

  it("leaves the rest of the profile blob byte-for-byte", () => {
    localStorage.setItem(PROFILE_GENERAL_LS, JSON.stringify({
      vitals: { job: "Science" }, heroes: [{ n: "Ada" }], likes: ["rain"],
    }));
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Gender", "Man");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    const b = blob();
    expect(b.heroes).toEqual([{ n: "Ada" }]);
    expect(b.likes).toEqual(["rain"]);
    // and the vital it did not ask about in this render survives
    expect(b.vitals.job).toBe("Science");
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
      pick("Gender", "Woman");
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

  it("counts what has been answered, so partial is visibly fine", () => {
    render(<LiveProfileSetup onDone={onDone} />);
    pick("Gender", "Woman");
    expect(screen.getByRole("button", { name: "Save 1 of 7" })).toBeTruthy();
    pick("Height", "170-179 cm");
    expect(screen.getByRole("button", { name: "Save 2 of 7" })).toBeTruthy();
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
    // check:anchors reads profile-general.jsx, so a label that drifted
    // here would silently stop that level counting in the aggregate.
    render(<LiveProfileSetup onDone={onDone} />);
    const opts = (name: string | RegExp) =>
      Array.from((screen.getByLabelText(name) as HTMLSelectElement).options)
        .map((o) => o.value).filter(Boolean);
    expect(opts("Gender")).toEqual(["Woman", "Man", "Non-binary", "Prefer not to say"]);
    expect(opts("Height")).toContain("190 cm or taller");
    expect(opts("Education")).toContain("Vocational or trade");
    expect(opts("Relationship")).toContain("Prefer not to say");
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
