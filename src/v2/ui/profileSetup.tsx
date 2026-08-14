// profileSetup.tsx — whether the account-creation questions still need
// asking, and how they get onto the page (D150).
//
// A file of its own, beside LiveProfileSetup.tsx, for two reasons that
// happen to agree:
//
//   1. react-refresh wants a component file to export a component and
//      nothing else, and these are the "nothing else".
//   2. The screen calls none of it. The flag is written by whoever closed
//      the screen, not by the screen, so the two do not import each other
//      in a circle.
//
// Reached ONLY through main.jsx's dynamic import, so every byte here is
// deferred past first paint along with the screen — see mountProfileSetup
// for why the decision travels with the screen rather than living in an
// eager gate component.
import { createRoot } from "react-dom/client";
import LIVE from "../data/live";
import LiveProfileSetup from "./LiveProfileSetup";

/**
 * Asked-or-dismissed, on this device.
 *
 * Local rather than on the profile document, and that is the honest place
 * for it: this records that a SCREEN has been shown, which is a fact about
 * an install, not about an account. The cost of getting it wrong is one
 * extra ask on a new device, against a Firestore read on every cold start
 * to avoid it.
 */
export const PROFILE_SETUP_LS = "insight.profileSetup.v1";

export function profileSetupSeen(): boolean {
  try { return !!localStorage.getItem(PROFILE_SETUP_LS); } catch { return false; }
}

export function markProfileSetupSeen(): void {
  try { localStorage.setItem(PROFILE_SETUP_LS, String(Date.now())); } catch { /* private mode */ }
}

/**
 * Whether this account still needs asking.
 *
 * "Has any anchor at all", not "has all of them", and the difference
 * matters in both directions: a user who filled the Basics card in before
 * this screen existed must not be asked to do it again, and someone who
 * deliberately answered two of the seven and skipped the rest has already
 * been asked. The screen is for the empty case — which is every account
 * created before it ran.
 */
export function profileSetupNeeded(): boolean {
  if (!LIVE.enabled || !LIVE.ready) return false;
  if (profileSetupSeen()) return false;
  return !Object.values(LIVE.anchors() || {}).some((v) => !!v);
}

/**
 * Mount the questions, if this account still needs them.
 *
 * ITS OWN ROOT, NOT A WRAPPER AROUND <App />, and that is a bundle
 * decision rather than a structural preference. `MAX_EAGER_KB` in
 * scripts/check-bundle.mjs is the constant that keeps the Firestore SDK
 * out of first paint, it has no headroom, and its own note says a raise
 * there "would have been the thing to refuse". A gate component wrapping
 * the app would have to be imported by main.jsx statically — the decision
 * alone measured 1 KB over — so the whole thing, decision included, lives
 * behind main.jsx's dynamic import instead. What that costs is the fetch,
 * after first paint, on live builds only; what it buys is a first-paint
 * graph that did not move at all.
 *
 * A second root rather than a portal for the same reason: the screen is
 * `position: fixed` with its own ground, so it needs no part of App's
 * tree — and main.jsx's own comment warns that changing the root element
 * type remounts App and loses its state.
 *
 * Idempotent: called once from main.jsx today, and a second call while the
 * screen is up is a no-op rather than a second copy of it.
 */
let mounted: { root: ReturnType<typeof createRoot>; host: HTMLElement } | null = null;

export function mountProfileSetup(): void {
  if (mounted || typeof document === "undefined") return;
  if (!profileSetupNeeded()) return;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted = { root, host };
  const close = () => {
    // Both ways out — saved and skipped — because what this records is
    // that the question was asked, and it was. Before the unmount, so a
    // crash on the way out cannot re-ask the same seven questions on the
    // next boot.
    markProfileSetupSeen();
    // Deferred, because unmounting a root from inside its own render pass
    // is the one thing React asks callers not to do.
    setTimeout(() => {
      if (!mounted) return;
      mounted.root.unmount();
      mounted.host.remove();
      mounted = null;
    }, 0);
  };
  root.render(<LiveProfileSetup onDone={close} />);
}
