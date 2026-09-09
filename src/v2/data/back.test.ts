// @vitest-environment jsdom
//
// The Android back handler, which until now had run in no test at all.
//
// WHY THAT MATTERED. Every mount test takes this module's first line —
// `if (!Capacitor.isNativePlatform()) return () => {}` — so the listener
// wiring, the exit decision, the throwing-handler fallback and the
// double-registration guard had never executed. The module's own header
// states the cost of getting any of them wrong: "With no listener
// registered, the system back gesture calls finish() on the Activity, so
// back from any overlay quit the app outright. Every Android tester hits
// that in the first minute, and it reads as a crash."
//
// So the failures here are all device-only. Inverting `consumed` (back
// never exits at the root), losing the teardown (React strict mode mounts
// effects twice, so one press closes two overlays), or letting a throwing
// handler through, all pass tsc, eslint, check:globals and all five smoke
// files, and are caught by somebody holding a phone.
//
// The platform is faked, and only the platform: `@capacitor/core` reports
// native and `@capacitor/app` is a recording double. The module's own logic
// runs for real — which is the point, and is why the double records rather
// than asserts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  native: true,
  /** Listener registrations, in order. */
  added: [] as { event: string; cb: () => void; removed: boolean }[],
  exits: 0,
  /** Set to throw from addListener, for the plugin-unavailable case. */
  addThrows: false,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => h.native },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: async (event: string, cb: () => void) => {
      if (h.addThrows) throw new Error("plugin unavailable");
      const rec = { event, cb, removed: false };
      h.added.push(rec);
      return { remove: async () => { rec.removed = true; } };
    },
    exitApp: async () => { h.exits += 1; },
  },
}));

// The registration is async (it dynamic-imports @capacitor/app), so every
// case has to let the microtasks settle before the listener exists. A real
// timer would be a guess; this is the number of turns the module actually
// takes, and it fails loudly rather than asserting on a frame too early.
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

/** The registered back callback, or a failure naming what is missing. */
const press = () => {
  const live = h.added.filter((a) => !a.removed);
  expect(live, "no live backButton listener is registered").toHaveLength(1);
  expect(live[0].event).toBe("backButton");
  live[0].cb();
};

let mod: typeof import("./back");

beforeEach(async () => {
  vi.resetModules();
  h.native = true;
  h.added.length = 0;
  h.exits = 0;
  h.addThrows = false;
  mod = await import("./back");
});

afterEach(() => { delete window.registerBackHandler; });

describe("the Android back handler", () => {
  it("does nothing at all off a native platform", async () => {
    // The web build must not register anything: on a browser the back
    // gesture is history navigation and belongs to the browser.
    vi.resetModules();
    h.native = false;
    const web = await import("./back");
    const off = web.registerBackHandler(() => true);
    await settle();
    expect(h.added, "a web build registered a native back listener").toHaveLength(0);
    // …and its teardown is still callable, so the caller needs no branch.
    expect(() => off()).not.toThrow();
  });

  it("exits the app when the handler consumed nothing", async () => {
    // "Nothing left to close" is back at the root, and Android users expect
    // that to leave the app. This is the half that CANNOT be inferred from
    // the other: a handler returning false must reach exitApp.
    mod.registerBackHandler(() => false);
    await settle();
    press();
    expect(h.exits, "back at the root did not exit the app").toBe(1);
  });

  it("does not exit when the handler closed something", async () => {
    mod.registerBackHandler(() => true);
    await settle();
    press();
    expect(h.exits, "back closed an overlay AND quit the app").toBe(0);
  });

  it("treats a throwing handler as nothing-to-close rather than a dead button", async () => {
    // The module's own reasoning: a throwing handler must not strand the
    // user with a back button that does nothing. Letting them leave is the
    // safe direction, and it is a decision rather than a fallthrough.
    mod.registerBackHandler(() => { throw new Error("shell blew up"); });
    await settle();
    expect(() => press()).not.toThrow();
    expect(h.exits, "a throwing handler left the back button dead").toBe(1);
  });

  it("replaces the previous listener instead of stacking a second", async () => {
    // React strict mode mounts effects twice in development. Two live
    // listeners means one press closes two overlays — which looks like a
    // flaky shell and is a device-only symptom.
    const first: string[] = [];
    mod.registerBackHandler(() => { first.push("first"); return true; });
    await settle();
    mod.registerBackHandler(() => true);
    await settle();

    expect(h.added, "the second registration did not add a listener").toHaveLength(2);
    expect(h.added[0].removed, "the first listener was left live — two overlays per press").toBe(true);
    press();
    expect(first, "the replaced handler still ran").toEqual([]);
  });

  it("removes the listener its teardown was handed back for", async () => {
    const off = mod.registerBackHandler(() => true);
    await settle();
    expect(h.added.filter((a) => !a.removed)).toHaveLength(1);
    off();
    await settle();
    expect(h.added.every((a) => a.removed), "teardown left the listener live").toBe(true);
  });

  it("removes a listener that lands AFTER its teardown ran", async () => {
    // The registration is async, so a mount/unmount inside one turn resolves
    // the listener onto a component that is already gone. `cancelled` is
    // what removes it; without that the app keeps a listener calling into a
    // torn-down shell, which is the strict-mode case one beat earlier.
    const off = mod.registerBackHandler(() => true);
    off();                       // before the dynamic import resolves
    await settle();
    expect(h.added.every((a) => a.removed), "a listener outlived the teardown that raced it").toBe(true);
  });

  it("survives the plugin being unavailable", async () => {
    // Back then keeps its default behaviour, which is the honest outcome —
    // what must not happen is an unhandled rejection at startup.
    h.addThrows = true;
    expect(() => mod.registerBackHandler(() => true)).not.toThrow();
    await settle();
    expect(h.added).toHaveLength(0);
  });

  it("publishes itself on window for the spec layer", () => {
    // check:globals reads the `window.X = X` form statically; this is the
    // half a scanner cannot see, that the assignment actually happened.
    expect(window.registerBackHandler).toBe(mod.registerBackHandler);
  });
});
