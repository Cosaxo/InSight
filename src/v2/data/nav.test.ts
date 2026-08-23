// The nav registry (D248) — the module that let app-shell's cross-links
// off the global bridge without drawing an ESM cycle.
//
// Four properties, and three of them are about REGISTRATION rather than
// dispatch, because that is where this module can be wrong in a way no
// caller would notice until a door stopped opening:
//
//   1. A call before the shell mounts NO-OPS. Every consumer used to write
//      `window.goTab && window.goTab(id)`; the registry owns that check
//      now, so if it throws instead, every one of those call sites becomes
//      a crash on the frame before mount.
//   2. Registration is ADDITIVE and teardown is NARROW. app-shell registers
//      in two effects with different dependency lists, so a whole-object
//      set would have the second wipe the first, and a clear-everything
//      teardown would have either take the other's handlers with it.
//   3. Teardown is IDENTITY-CHECKED. React can mount the next shell before
//      the old one's effect cleanup runs; deleting by key alone would
//      strand the live shell with no doors.
//   4. The doors dispatch to the CURRENT handler — a re-register replaces.
import { beforeEach, describe, expect, it, vi } from "vitest";

import NAV, { canNav, registerNav } from "./nav";

beforeEach(() => {
  // The module holds one map at module scope; clear it by registering
  // nothing and tearing that down is not enough, so register every key
  // and drop it.
  registerNav({
    goTab: () => {}, goNav: () => {}, openOverlay: () => {},
    openProfileTab: () => {}, openCity: () => {}, openPerson: () => {},
    openSuggestions: () => {}, openLogicTest: () => {},
  })();
});

describe("before the shell registers", () => {
  it("no-ops rather than throwing, on every door", () => {
    // The property every converted call site now leans on. A throw here is
    // a crash on the frame before mount, at fifteen call sites at once.
    expect(() => {
      NAV.goTab("track");
      NAV.goNav("track:world");
      NAV.openOverlay("relmap");
      NAV.openProfileTab("general");
      NAV.openCity("Oslo");
      NAV.openPerson({ id: 1 });
      NAV.openSuggestions();
      NAV.openLogicTest();
    }).not.toThrow();
  });

  it("says so, for the call sites that draw a door only when it exists", () => {
    expect(canNav("openPerson")).toBe(false);
    expect(NAV.can("goTab")).toBe(false);
  });
});

describe("registration", () => {
  it("dispatches to the registered handler", () => {
    const goTab = vi.fn();
    registerNav({ goTab });
    NAV.goTab("mirror");
    expect(goTab).toHaveBeenCalledWith("mirror");
    expect(canNav("goTab")).toBe(true);
  });

  it("is additive, so a second effect does not wipe the first", () => {
    // app-shell's real shape: `openSuggestions`/`openLogicTest` register in
    // an effect keyed on `openDeferred`, the rest in a mount-only one. A
    // whole-object set would drop whichever registered first.
    const goTab = vi.fn();
    const openSuggestions = vi.fn();
    registerNav({ goTab });
    registerNav({ openSuggestions });
    NAV.goTab("you");
    NAV.openSuggestions();
    expect(goTab).toHaveBeenCalled();
    expect(openSuggestions).toHaveBeenCalled();
  });

  it("tears down only its own keys", () => {
    const goTab = vi.fn();
    const openSuggestions = vi.fn();
    registerNav({ goTab });
    const dropSuggest = registerNav({ openSuggestions });
    dropSuggest();

    expect(canNav("openSuggestions")).toBe(false);
    expect(canNav("goTab"), "the other effect's door was torn down too").toBe(true);
    NAV.goTab("you");
    expect(goTab).toHaveBeenCalled();
  });

  it("a re-register replaces, and the old teardown does not strand it", () => {
    // The remount order React actually produces: the next shell registers
    // BEFORE the previous one's cleanup runs. Deleting by key alone would
    // leave the live shell with no doors at all.
    const first = vi.fn();
    const dropFirst = registerNav({ goTab: first });
    const second = vi.fn();
    registerNav({ goTab: second });

    dropFirst();

    expect(canNav("goTab"), "the remounted shell lost its door").toBe(true);
    NAV.goTab("track");
    expect(second).toHaveBeenCalledWith("track");
    expect(first).not.toHaveBeenCalled();
  });
});
