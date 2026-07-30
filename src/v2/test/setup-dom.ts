// setup-dom.ts — the browser surface jsdom does not implement, stubbed
// just far enough for the spec layer to mount.
//
// Loaded by every file under `--dir src` (vite.config.ts `setupFiles`),
// including the pure-logic suites that run in node. Everything below is
// therefore behind the `window` guard: in node there is nothing to patch
// and this file must cost nothing.
//
// The rule for what belongs here: a stub is legitimate when jsdom simply
// has no implementation (matchMedia, the observers, canvas) and the spec
// layer only needs the call not to throw. A stub that fakes a RESULT the
// test then asserts on would be testing the stub — if a case ever needs
// that, it wants a real browser, not another line here.

if (typeof window !== "undefined") {
  // jsdom ships no matchMedia at all. The spec layer reads `.matches` for
  // reduced-motion and dark-scheme checks, so returning a frozen "no" is
  // both honest and stable: tests render the default, non-reduced UI.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},      // deprecated, still called by some libs
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }

  // Neither observer exists in jsdom. Both are used for layout reactions
  // (sticky headers, in-view animations) that a mount test does not
  // exercise — the constructor merely has to succeed and observe() has to
  // be callable. Deliberately never firing a callback: a synthetic entry
  // would drive layout code with numbers no browser produced.
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = NoopObserver;
  }
  if (!("IntersectionObserver" in window)) {
    (window as unknown as Record<string, unknown>).IntersectionObserver = NoopObserver;
  }

  // jsdom defines scrollTo but throws "not implemented" when called, which
  // surfaces as a console error rather than a test failure — noise that
  // would train the reader to ignore console output. Same for the element
  // methods.
  window.scrollTo = () => {};
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};

  // The spec layer draws a few canvas textures. jsdom's getContext returns
  // null and logs "not implemented", and the drawing code then throws on
  // the null. Hand back a proxy whose every method is a no-op: the tests
  // assert on the tree, never on pixels.
  HTMLCanvasElement.prototype.getContext = (() =>
    new Proxy({}, {
      get: (_t, prop) => {
        // Canvas code reads properties (fillStyle, canvas, …) as well as
        // calling methods. A function is safe for both: assignment works,
        // and calling it is a no-op.
        if (prop === "canvas") return document.createElement("canvas");
        return () => {};
      },
      set: () => true,
    })) as unknown as HTMLCanvasElement["getContext"];
}
