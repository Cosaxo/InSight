// @vitest-environment jsdom
//
// profileSetup.tsx — the GATE, not the screen (D151).
//
// The screen's own claims, the five reasons an account is or is not
// asked, the mount's idempotence and the purge listener's teardown are in
// `LiveProfileSetup.test.tsx`. What no case there touches is the half
// that has to survive a reboot, a private window and an account deletion:
// the persistence contract. `profileSetupSeen` and `markProfileSetupSeen`
// are not imported by that file at all.
//
// Five properties, each a way a correct decision reaches the wrong
// device:
//
//   1. THE FACT IS ON THE DEVICE, NOT IN THE PROCESS. `profileSetupSeen`
//      re-reads storage on every call, so a key an earlier session wrote
//      is honoured with nothing in memory saying so, and a key that goes
//      away stops counting the same instant. A boot-time snapshot of it
//      would pass every other test in this tree — this module's only
//      caller runs once, at boot, so nothing else would ever ask twice.
//   2. THE KEY IS INSIDE THE SWEPT NAMESPACE (D51). `purgeLocalTrace`
//      removes every `insight.*` key; this module's listener drops the
//      screen. Both halves are worthless if the flag is named outside
//      that prefix: it survives the deletion, and the NEXT account on the
//      same device is never asked. Nothing else in the tree — not
//      `check:purge`, which reads listeners — looks at the name.
//   3. SEEN BEATS EVERY REASON TO ASK. Both triggers, the empty anchor
//      map and D190's missing name, sit behind the flag on purpose.
//      Hoist the name clause above it and every account whose name never
//      landed meets the same screen every boot, which is the wall D3 says
//      this is not.
//   4. AN ANCHOR IS COUNTED BY ITS VALUE. The map is hydrated straight
//      off the profile document (`prof.get("anchors")`, live.ts) with no
//      client-side validation, so `{ gender: "" }` is a shape this gate
//      really sees. Counting KEYS reads it as answered, and an account
//      that has filled in nothing is never offered the questions.
//   5. A REFUSED STORAGE IS NOT A CRASH. The write runs on the way out of
//      the screen, ahead of the unmount — so an uncaught throw there
//      hands a private-window user a screen that will not close.
//   6. CLOSING TAKES THE HOST WITH IT. The root's unmount only empties
//      the div this module appended; D51 makes the mount/close cycle
//      repeatable inside one session, so the removal is what keeps a
//      dead ground from being left per account the device signs into.
//
// `../data/live` is mocked, not booted (it imports Firebase). Nothing
// else is: the gate's arithmetic and the real screen underneath it are
// what these cases execute.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  ready: true,
  anchors: () => ({}) as Record<string, string>,
  displayName: "",
  saveAnchors: vi.fn((a: Record<string, string>) => { void a; }),
  saveDisplayName: vi.fn(async (n: string) => { void n; }),
  // D331 — the consent ask lives on this screen; not consented by default.
  politicalConsented: vi.fn(() => false),
  politicalAnswered: vi.fn(() => false),
  setPoliticalConsent: vi.fn(async (on: boolean) => { void on; }),
  social: { claimHandle: vi.fn(async (h: string) => ({ handle: h })) },
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const {
  PROFILE_SETUP_LS, profileSetupSeen, markProfileSetupSeen,
  profileSetupNeeded, mountProfileSetup,
} = await import("./profileSetup");

beforeEach(() => {
  localStorage.clear();
  LIVE.enabled = true;
  LIVE.ready = true;
  LIVE.anchors = () => ({});
  // A name on the account by default, so a case about the flag or the
  // anchors is decided by its own subject rather than by D190's trigger.
  LIVE.displayName = "Tester";
});
afterEach(cleanup);

// Its own root, so the render has to be flushed by hand — RTL's `render`
// is not what put it on the page.
const mount = () => act(() => { mountProfileSetup(); });
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const onScreen = () => screen.queryByText(/A few things about you/i) !== null;

describe("the fact is on the device, not in the process", () => {
  it("honours a flag an earlier session wrote", () => {
    // Nothing in THIS process has called markProfileSetupSeen; the whole
    // record of the ask is the key, which is the only shape a returning
    // device ever presents. Yesterday's stamp, because the value records
    // when and the presence records whether.
    localStorage.setItem(PROFILE_SETUP_LS, String(Date.now() - 86_400_000));

    expect(profileSetupSeen()).toBe(true);
    expect(profileSetupNeeded()).toBe(false);
    // …and the caller main.jsx actually makes agrees, which is the only
    // way a user meets this decision.
    mount();
    expect(onScreen()).toBe(false);
  });

  it("writes that same key, and reads its own write back", () => {
    // The two halves are exported separately and used from opposite ends
    // of the module — the close handler writes, the gate reads — so the
    // constant being the key BOTH touch is a claim, not a restatement.
    expect(profileSetupSeen()).toBe(false);
    markProfileSetupSeen();
    expect(localStorage.getItem(PROFILE_SETUP_LS)).toBeTruthy();
    expect(profileSetupSeen()).toBe(true);
  });
});

describe("the flag is where the purge can reach it (D51)", () => {
  it("goes with the account, and the gate notices with no reload behind it", () => {
    // The uid-change path has no reload behind it (purgeLocalTrace's own
    // note), so "notices" is load-bearing: the sweep and the next ask can
    // happen in the same session.
    localStorage.setItem("someone.else.v1", "kept");
    markProfileSetupSeen();
    expect(profileSetupNeeded()).toBe(false);

    // Exactly purgeLocalTrace's sweep (data/live.ts): every `insight.*`
    // key and nothing else. The announcement that follows it is the
    // SCREEN's half and is asserted in LiveProfileSetup.test.tsx; this is
    // the KEY's, and it is the half a listener cannot supply.
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("insight.")) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));

    expect(profileSetupSeen()).toBe(false);
    expect(profileSetupNeeded()).toBe(true);
    // A prefix, not a wipe — otherwise this case would pass against a
    // flag named anything at all.
    expect(localStorage.getItem("someone.else.v1")).toBe("kept");
  });
});

describe("who is not asked again", () => {
  it("re-asks nobody who has closed it — name or no name", () => {
    // D190's clause returns TRUE for an account with no display name and
    // sits BELOW the flag deliberately. A name write is best-effort (it
    // is allowed to fail offline), so above the flag this clause meets
    // that user with the same seven questions on every cold start.
    LIVE.displayName = "";
    LIVE.anchors = () => ({ gender: "Woman" });
    markProfileSetupSeen();

    expect(profileSetupNeeded()).toBe(false);
  });

  it("counts an anchor by its value — a key with no value is not an answer", () => {
    // The map comes off the profile doc unvalidated, so a key present and
    // empty is a real shape rather than a hypothetical one.
    LIVE.anchors = () => ({ gender: "", city: "", education: "" });
    expect(profileSetupNeeded()).toBe(true);

    // The pair, so the case cannot pass against a gate that has stopped
    // reading the anchors at all.
    LIVE.anchors = () => ({ gender: "", city: "Oslo, NO" });
    expect(profileSetupNeeded()).toBe(false);
  });
});

describe("a browser that refuses storage", () => {
  it("is answered, not thrown at", () => {
    // Called from main.jsx's dynamic import, where the only handler is a
    // reportError: a throw here is not a caught edge case, it is the
    // screen never mounting for anybody in a private window.
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    try {
      expect(profileSetupSeen()).toBe(false);
      expect(profileSetupNeeded()).toBe(true);
    } finally { get.mockRestore(); }
  });

  it("can still close the screen when the write is refused", async () => {
    // The write is the first statement of the close handler and the
    // unmount is the second. Unguarded, the throw takes the teardown with
    // it and the user is left holding a screen with no way out — on a
    // device that, by definition, cannot remember the ask either way.
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded.", "QuotaExceededError");
    });
    try {
      mount();
      expect(onScreen()).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    } finally { set.mockRestore(); }
    // Restored before the deferred unmount runs, so the tick below is the
    // real teardown and not a second failure being swallowed.
    await settle();
    expect(onScreen()).toBe(false);
  });
});

describe("what closing leaves behind", () => {
  it("takes its host off the page, not just its render", async () => {
    // The root's unmount empties the host; only `host.remove()` deletes
    // it. D51 makes the mount/close cycle repeatable within one session
    // (purge → re-ask), so a host that stays is one dead ground per
    // account the device signs into.
    const before = document.body.childElementCount;
    mount();
    expect(document.body.childElementCount).toBe(before + 1);

    fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    await settle();
    expect(onScreen()).toBe(false);
    expect(document.body.childElementCount).toBe(before);
  });
});
