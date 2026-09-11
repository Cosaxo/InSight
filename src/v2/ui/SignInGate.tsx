// SignInGate — the eager half of the first-launch account wall (D134).
//
// WHY THIS IS TWO FILES. The wall wraps `<App />` at the root, so whatever
// implements it is in the first-paint graph of EVERY build — including the
// ones where the flag is off and it can never render. Measured: the screen
// itself put 3 KB into an eager graph that had no room for it
// (`npm run check:bundle`), which is the gate telling the truth — a screen
// one build shows is not first-paint weight for the other builds.
//
// No headroom figure here on purpose. The first draft said "2 KB of
// headroom left" and that was a number from a LOCAL build, where the
// absent Sentry chunk makes the totals disagree with CI's — the same trap
// that failed this branch's first CI run, written into a comment. The
// ceilings and the arithmetic live in scripts/check-bundle.mjs; this file
// says only which way the deferral went.
//
// So the decision stays eager and tiny (`signInRequired`, a build
// constant), and the SCREEN is a dynamic import that only a build with the
// flag on ever fetches. `check:bundle`'s own advice, followed rather than
// argued with: "defer it (a dynamic import behind loadWorldFeed /
// loadOverlays / React.lazy)".
import React from "react";
import LIVE from "../data/live";
import { signInRequired } from "./signInRequired";

// A SLOT, NOT A `React.lazy` — the shape `data/mirrorChunk.ts` and the
// Map's slot already use, and its header states the reason in as many
// words: "a React.lazy caches a rejection". There it costs one tab for
// the rest of the session. HERE IT COSTS THE APP.
//
// This component wraps `<App />` at the ROOT, and the only ErrorBoundary
// in the tree is inside app-shell — below it, and not even rendered while
// the wall is up. So a rejected `import("./LiveSignInGate")` rethrows
// through Suspense into nothing, React unmounts the root, and the device
// is left on an empty `#root` with the native splash already hidden.
// Measured 2026-09-11 with the import mocked to reject: the rejection
// escaped the tree uncaught and `container.innerHTML` was `""`. A second
// probe pinned the other half — a lazy whose loader fails once and then
// succeeds is called exactly ONCE across two mounts and rethrows the
// cached error on the second, so nothing short of a relaunch recovers.
//
// This is the shipping path, not an edge: both release workflows default
// `VITE_REQUIRE_SIGNIN` to `'true'`, so every install renders this on
// first launch and on every launch until the account is linked and
// verified. The failure it needs is an ordinary one — a blip, an asset
// swapped by a deploy, the flaky native file read `data/lazy.ts` exists
// for.
//
// The slot keeps every property the deferral was for: the import is still
// dynamic, still only fetched by a build with the flag on, and this file
// stays the eager tiny half (`check:bundle`).
const RETRY_MS = 400;
const RETRY_MAX = 6;

function SignInGate({ children }: { children?: React.ReactNode }) {
  const [, tick] = React.useState(0);
  const [Screen, setScreen] = React.useState<React.ComponentType | null>(null);
  // `LIVE.wallPass` flips when the anonymous session is upgraded, and the
  // store announces that (D134's live.ts half) — without the subscription
  // the wall would stay up after a successful sign-in. Since D453 it also
  // carries the correction in the other direction: the first thing auth
  // says is announced even when it moves neither flag, which is the only
  // way a wall opened off the mirror can close again.
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);

  // Computed before the effect and read by both, so the two cannot
  // disagree about whether the wall is up. Same build constant as the
  // return below — see the note there for why an early return after hooks
  // is safe in this component.
  //
  // ONE STORE MEMBER RATHER THAN THE TWO FLAGS COMPOSED HERE (D453).
  // `linked` and `needsEmailVerify` are both false until the auth
  // observer has spoken, and this component renders long before that —
  // D356 releases the render off the device's own caches, before the
  // Auth SDK has even been imported. So composing them here meant the
  // wall was UP for every returning signed-in user until the auth
  // restore landed, and then came down: the flash the owner reported
  // from a device on 2026-09-11. `wallPass` answers provisionally off
  // the verdict auth last handed this device and switches to auth's own
  // word the moment there is one, announcing the correction through the
  // subscription above — so a session that really did end still meets
  // the wall, a beat later instead of a beat early.
  const wall = signInRequired() && !LIVE.wallPass;

  // THE FETCH, WITH A RETRY, because the whole point of leaving
  // `React.lazy` is that a first failure must not be final. Bounded: six
  // attempts at 400ms is about two and a half seconds of a bad moment,
  // after which a relaunch is the honest answer and the loop stops rather
  // than hammering a device that is plainly offline. The wall stays up
  // throughout — `children` is not rendered — so a failure here never
  // opens the app to somebody the flag is meant to stop.
  React.useEffect(() => {
    if (!wall || Screen) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const load = (): void => {
      void import("./LiveSignInGate").then(
        (m) => { if (live) setScreen(() => m.default); },
        () => {
          // Deliberately silent to the user and deliberately NOT rethrown:
          // rethrowing from here is what put the rejection in front of a
          // root with nothing to catch it.
          if (!live || ++tries >= RETRY_MAX) return;
          timer = setTimeout(load, RETRY_MS);
        },
      );
    };
    load();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [wall, Screen]);

  // An early return after hooks, which is safe here for a specific reason
  // rather than by luck: `signInRequired()` reads a value Vite substitutes
  // at BUILD time, so it is constant for the life of the process and the
  // hook order above can never change between renders of one instance.
  //
  // What `wallPass` is composed of, and why it is TWO conditions rather
  // than one, is written at the getter (`data/live.ts`) — it moved there
  // with the composition, because the unverified-address arm is a fact
  // about the account rather than about this component.
  if (!wall) {
    return <>{children}</>;
  }

  // `null` rather than a spinner: this is a local chunk on a phone's own
  // disk, and a spinner that shows for one frame is worse than nothing.
  // The body's own background is already painted underneath — which is
  // also what the retries above are drawn against, so a slow load looks
  // like a slow launch rather than like a broken one.
  return Screen ? <Screen /> : null;
}

export default SignInGate;
