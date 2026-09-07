// walkthrough.tsx — whether the first-launch walkthrough still needs
// showing, and how it gets onto the page (D393).
//
// profileSetup.tsx's shape, one screen earlier, for its two reasons:
// react-refresh wants LiveWalkthrough.tsx to export a component and
// nothing else, and the screen calls none of this — the flag is written
// by whoever closed the screen, so the two never import each other in a
// circle. Reached only through main.jsx's dynamic import, so every byte
// here sits past first paint with the screen.
import { createRoot } from "react-dom/client";
import LIVE from "../data/live";
import LiveWalkthrough from "./LiveWalkthrough";

/**
 * Shown-or-skipped, on this device.
 *
 * Local, like PROFILE_SETUP_LS and for the same reason: this records
 * that a SCREEN was shown, which is a fact about an install rather than
 * about an account, and a Firestore read on every cold start is the
 * wrong price for never showing it twice across devices. Inside the
 * `insight.*` namespace D51's purge sweeps, on purpose: the next account
 * on a device that deleted one starts from the beginning, walkthrough
 * included, and the account panel's row shows it again to anyone else.
 */
export const WALKTHROUGH_LS = "insight.walkthrough.v1";

export function walkthroughSeen(): boolean {
  try { return !!localStorage.getItem(WALKTHROUGH_LS); } catch { return false; }
}

export function markWalkthroughSeen(): void {
  try { localStorage.setItem(WALKTHROUGH_LS, String(Date.now())); } catch { /* private mode */ }
}

/**
 * Whether this launch still owes the walkthrough.
 *
 * A LIVE BUILD, not a live boot. `enabled` is the boot having attached,
 * and a first launch with no network — the build is real, the train is
 * not — is exactly the launch with time for five screens; `demoInProd`
 * is live-build-and-not-attached by definition (data/live.ts), so the
 * pair spells VITE_V2_LIVE without this module reading the flag itself.
 * The demo build never shows it: every mount suite and the style diff
 * run there, and neither is anybody's first launch.
 */
export function walkthroughNeeded(): boolean {
  if (!LIVE.enabled && !LIVE.demoInProd) return false;
  return !walkthroughSeen();
}

/**
 * Its own root, not a wrapper around <App /> — profileSetup.tsx has the
 * bundle arithmetic (D151): a gate component would be imported by
 * main.jsx statically, and the eager ceiling has no room for even the
 * decision. The screen is `position: fixed` with its own ground, so it
 * needs no part of App's tree, and main.jsx's own comment warns that
 * changing the root element type remounts App and loses its state.
 *
 * `done` settles when the screen is off the page — closed by either
 * button, by Escape, or by the purge — and immediately when there is
 * nothing to show. main.jsx waits on it before mounting the account
 * questions, so the two first-launch screens run in order rather than
 * stacking. Idempotent: a second call while the screen is up returns the
 * same promise and mounts nothing.
 */
let mounted: {
  root: ReturnType<typeof createRoot>;
  host: HTMLElement;
  done: Promise<void>;
  finish: () => void;
} | null = null;

/**
 * Take the screen off the page without recording that it was shown.
 *
 * Deferred by a tick, because unmounting a root from inside its own
 * render pass is the one thing React asks callers not to do. The
 * promise settles AFTER the host is gone, so whatever waits on it mounts
 * onto a page this screen has already left.
 */
function teardown(): void {
  const m = mounted;
  if (!m) return;
  setTimeout(() => {
    // A double tap, or a purge that beat the close: already gone.
    if (mounted !== m) return;
    m.root.unmount();
    m.host.remove();
    mounted = null;
    m.finish();
  }, 0);
}

/**
 * The purge, heard (D51's contract, check:purge). `walkthroughSeen()`
 * keeps no in-memory copy, so the FLAG cannot go stale; the SCREEN can.
 * A walkthrough still up when the account changes under it would, on
 * its next tap, write the key the purge had just removed — under the
 * new uid, which would then never be shown it. So the screen goes and
 * the flag is not written on the way out; the next boot finds no key
 * and shows it, which is right for an account that has seen nothing.
 *
 * Module scope is safe here for profileSetup's reason: this module is
 * reached only through a dynamic import, so if the chunk never loaded
 * there is no screen and no state to drop.
 */
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", teardown);
}

/**
 * Mount the walkthrough, if this device still owes it — or unconditionally
 * with `again`, which is the account panel's row.
 */
export function mountWalkthrough(opts: { again?: boolean } = {}): Promise<void> {
  if (mounted) return mounted.done;
  if (typeof document === "undefined") return Promise.resolve();
  if (!opts.again && !walkthroughNeeded()) return Promise.resolve();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => { finish = resolve; });
  mounted = { root, host, done, finish };
  const close = () => {
    // Both ways out — Start and Skip — because what this records is
    // that the walkthrough was shown, and it was. Before the unmount, so
    // a crash on the way out cannot show the same five pages again on
    // the next boot.
    markWalkthroughSeen();
    teardown();
  };
  root.render(<LiveWalkthrough onDone={close} again={!!opts.again} />);
  return done;
}
