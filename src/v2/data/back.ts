// Android hardware/gesture back — native platforms only; a no-op on web.
//
// Capacitor does NOT handle this for you. With no listener registered, the
// system back gesture calls finish() on the Activity, so back from any
// overlay quit the app outright. Every Android tester hits that in the
// first minute, and it reads as a crash rather than a missing handler.
//
// The shell owns the meaning of "back" — which overlay is on top, whether a
// tab counts as a level — so this module owns only the platform wiring and
// takes a callback that returns whether it consumed the press.
import { Capacitor } from "@capacitor/core";

export type BackHandler = () => boolean;

let unlisten: null | (() => void) = null;

/**
 * Register the app's back handler. Returns a teardown function.
 *
 * `handler` returns true if it consumed the press (something closed), false
 * if there is nothing left to close — in which case the app exits, which is
 * what Android users expect from back at the root.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  // Re-registering replaces the previous listener rather than stacking a
  // second one: React strict mode mounts effects twice in development, and
  // two listeners would close two overlays per press.
  void teardown();
  let cancelled = false;
  void (async () => {
    try {
      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("backButton", () => {
        let consumed = false;
        try {
          consumed = handler();
        } catch {
          // A throwing handler must not strand the user with a dead back
          // button; treat it as "nothing to close" and let them leave.
          consumed = false;
        }
        if (!consumed) void App.exitApp();
      });
      if (cancelled) {
        void sub.remove();
        return;
      }
      unlisten = () => void sub.remove();
    } catch {
      /* plugin unavailable — back keeps its default behaviour */
    }
  })();
  return () => {
    cancelled = true;
    void teardown();
  };
}

function teardown(): void {
  if (unlisten) {
    try {
      unlisten();
    } catch {
      /* already gone */
    }
    unlisten = null;
  }
}

// Published on window for the spec layer, which resolves cross-module
// references by name at render time (see src/v2/README.md). main.jsx
// imports this module for the side effect.
//
// Plain `window.X = X` with a declare-global, matching live.ts: the shared
// scanner (scripts/spec-globals.mjs) recognises that form, and a cast like
// `(window as Record<string, unknown>).X = X` is invisible to it — which
// makes check:globals report the consumer as a dangling reference.
declare global {
  interface Window {
    registerBackHandler?: typeof registerBackHandler;
  }
}

window.registerBackHandler = registerBackHandler;
