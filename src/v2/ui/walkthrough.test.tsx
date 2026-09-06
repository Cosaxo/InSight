// @vitest-environment jsdom
//
// walkthrough.tsx — the GATE, not the screen (D393).
//
// The screen's own claims are in `LiveWalkthrough.test.tsx`, which never
// imports the three functions here. This is the half that has to survive
// a reboot, a private window, an account deletion and a launch on a
// train: the persistence contract, and the promise main.jsx sequences
// the account questions behind. profileSetup.test.tsx's six properties,
// one screen earlier, plus two of this gate's own:
//
//   1. THE FACT IS ON THE DEVICE, NOT IN THE PROCESS — `walkthroughSeen`
//      re-reads storage on every call.
//   2. THE KEY IS INSIDE THE SWEPT NAMESPACE (D51), or it survives the
//      deletion and the next account on the device is never shown it.
//   3. A LIVE BUILD IS THE CONDITION, NOT A LIVE BOOT. `enabled` false
//      with `demoInProd` true is a first launch with no network, which
//      is a first launch; both false is the demo build, which is never
//      anybody's first launch and is where every mount suite runs.
//   4. A REFUSED STORAGE IS NOT A CRASH, and the screen still closes.
//   5. THE PURGE TAKES THE SCREEN DOWN WITHOUT RECORDING IT — a flag
//      written on the way out would be written under the NEW uid.
//   6. CLOSING TAKES THE HOST WITH IT, and records the showing on both
//      ways out, Start and Skip alike.
//   7. THE PROMISE SETTLES — on close, on the purge, and at once when
//      there is nothing to show — because the account questions wait on
//      it, and a promise that hangs is a form that never appears.
//   8. `again` SHOWS IT TO A DEVICE THAT HAS SEEN IT, which is the
//      account panel's row, and mounting twice is one screen.
//
// `../data/live` is mocked, not booted (it imports Firebase). Nothing
// else is: the gate's arithmetic and the real screen underneath it are
// what these cases execute.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  demoInProd: false,
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const {
  WALKTHROUGH_LS, walkthroughSeen, markWalkthroughSeen, walkthroughNeeded, mountWalkthrough,
} = await import("./walkthrough");

const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };

beforeEach(() => {
  localStorage.clear();
  LIVE.enabled = true;
  LIVE.demoInProd = false;
});
// The screen is on its own root, which RTL's cleanup does not know
// about, and its teardown is a tick late by design — so every case ends
// by taking down whatever it left up (the purge path, which records
// nothing) and letting that tick run. Without this a case that closes
// the screen and returns without settling hands the NEXT case a screen
// still on the page, and the gate's idempotence then returns it.
afterEach(async () => {
  cleanup();
  window.dispatchEvent(new Event("insight:local-purge"));
  await settle();
});

// Its own root, so the render has to be flushed by hand — RTL's `render`
// is not what put it on the page. `settled` reports whether the promise
// the mount hands back has resolved by the time it is read.
function mount(opts?: { again?: boolean }) {
  const state = { settled: false };
  let done: Promise<void> = Promise.resolve();
  act(() => { done = mountWalkthrough(opts); });
  void done.then(() => { state.settled = true; });
  return state;
}
const onScreen = () => screen.queryByRole("dialog", { name: /How InSight works/i }) !== null;
const walkToLast = () => {
  for (let i = 0; i < 8 && !screen.queryByRole("button", { name: /^(Start|Done)$/ }); i++) {
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
  }
};

describe("the fact is on the device, not in the process", () => {
  it("honours a flag an earlier session wrote, and settles at once", async () => {
    localStorage.setItem(WALKTHROUGH_LS, String(Date.now() - 86_400_000));
    expect(walkthroughSeen()).toBe(true);
    expect(walkthroughNeeded()).toBe(false);

    const p = mount();
    expect(onScreen()).toBe(false);
    await settle();
    expect(p.settled, "nothing to show, and the questions behind it would wait forever").toBe(true);
  });

  it("writes that same key, and reads its own write back", () => {
    expect(walkthroughSeen()).toBe(false);
    markWalkthroughSeen();
    expect(localStorage.getItem(WALKTHROUGH_LS)).toBeTruthy();
    expect(walkthroughSeen()).toBe(true);
  });
});

describe("the flag is where the purge can reach it (D51)", () => {
  it("goes with the account, and the gate notices with no reload behind it", () => {
    localStorage.setItem("someone.else.v1", "kept");
    markWalkthroughSeen();
    expect(walkthroughNeeded()).toBe(false);

    // Exactly purgeLocalTrace's sweep (data/live.ts): every `insight.*`
    // key and nothing else.
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("insight.")) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));

    expect(walkthroughSeen()).toBe(false);
    expect(walkthroughNeeded()).toBe(true);
    expect(localStorage.getItem("someone.else.v1")).toBe("kept");
  });

  it("takes the screen down on the purge without recording it, and still settles", async () => {
    const p = mount();
    expect(onScreen()).toBe(true);
    act(() => { window.dispatchEvent(new Event("insight:local-purge")); });
    await settle();
    expect(onScreen()).toBe(false);
    // NOT written: the next account on this device has seen nothing.
    expect(walkthroughSeen()).toBe(false);
    expect(walkthroughNeeded()).toBe(true);
    expect(p.settled, "the questions behind it would never mount").toBe(true);
  });
});

describe("a live build is the condition, not a live boot", () => {
  it("shows on a first launch whose boot has not attached", () => {
    LIVE.enabled = false;
    LIVE.demoInProd = true;
    expect(walkthroughNeeded()).toBe(true);
  });

  it("never shows on the demo build", async () => {
    LIVE.enabled = false;
    LIVE.demoInProd = false;
    expect(walkthroughNeeded()).toBe(false);
    const p = mount();
    expect(onScreen()).toBe(false);
    await settle();
    expect(p.settled).toBe(true);
  });
});

describe("a browser that refuses storage", () => {
  it("is answered, not thrown at", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    try {
      expect(walkthroughSeen()).toBe(false);
      expect(walkthroughNeeded()).toBe(true);
    } finally { get.mockRestore(); }
  });

  it("can still close the screen when the write is refused", async () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded.", "QuotaExceededError");
    });
    try {
      mount();
      expect(onScreen()).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: /^Skip$/ }));
    } finally { set.mockRestore(); }
    await settle();
    expect(onScreen()).toBe(false);
  });
});

describe("what closing leaves behind", () => {
  it("takes its host off the page, records the showing, and settles — on Skip", async () => {
    const before = document.body.childElementCount;
    const p = mount();
    expect(document.body.childElementCount).toBe(before + 1);
    expect(p.settled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /^Skip$/ }));
    await settle();
    expect(onScreen()).toBe(false);
    expect(document.body.childElementCount).toBe(before);
    expect(walkthroughSeen(), "a skipped walkthrough was shown, and must not return").toBe(true);
    expect(p.settled).toBe(true);
  });

  it("…and on Start, from the last page", async () => {
    const p = mount();
    walkToLast();
    fireEvent.click(screen.getByRole("button", { name: /^Start$/ }));
    await settle();
    expect(onScreen()).toBe(false);
    expect(walkthroughSeen()).toBe(true);
    expect(p.settled).toBe(true);
  });

  it("records the showing BEFORE the unmount, so a crash on the way out cannot re-show it", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /^Skip$/ }));
    // Synchronously after the tap and before the deferred teardown has run.
    expect(walkthroughSeen()).toBe(true);
    expect(onScreen()).toBe(true);
  });
});

describe("again, and twice", () => {
  it("`again` shows it to a device that has seen it, and closes on Done", async () => {
    markWalkthroughSeen();
    expect(walkthroughNeeded()).toBe(false);
    const p = mount({ again: true });
    expect(onScreen()).toBe(true);
    walkToLast();
    fireEvent.click(screen.getByRole("button", { name: /^Done$/ }));
    await settle();
    expect(onScreen()).toBe(false);
    expect(p.settled).toBe(true);
  });

  it("mounting twice is one screen and one promise", async () => {
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => { first = mountWalkthrough(); });
    act(() => { second = mountWalkthrough({ again: true }); });
    expect(second).toBe(first);
    expect(screen.getAllByRole("dialog", { name: /How InSight works/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Skip$/ }));
    await settle();
    expect(onScreen()).toBe(false);
  });
});
