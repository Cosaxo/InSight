// SignInGate — the eager half of the first-launch account wall (D134).
//
// WHY THIS IS TWO FILES. The wall wraps `<App />` at the root, so whatever
// implements it is in the first-paint graph of EVERY build — including the
// ones where the flag is off and it can never render. Measured: the screen
// itself put 3 KB into an eager graph that had 2 KB of headroom left
// (`npm run check:bundle`), which is the gate telling the truth — a screen
// one build shows is not first-paint weight for the other builds.
//
// So the decision stays eager and tiny (`signInRequired`, a build
// constant), and the SCREEN is a dynamic import that only a build with the
// flag on ever fetches. `check:bundle`'s own advice, followed rather than
// argued with: "defer it (a dynamic import behind loadWorldFeed /
// loadOverlays / React.lazy)".
import React from "react";
import LIVE from "../data/live";
import { signInRequired } from "./signInRequired";

// Module scope, so the chunk request starts on the first render that needs
// it rather than on every one. Nothing evaluates the import until the
// element below is actually rendered, which is what keeps it out of the
// eager graph.
const Screen = React.lazy(() => import("./LiveSignInGate"));

function SignInGate({ children }: { children?: React.ReactNode }) {
  const [, tick] = React.useState(0);
  // `LIVE.linked` flips when the anonymous session is upgraded, and the
  // store announces that (D134's live.ts half) — without the subscription
  // the wall would stay up after a successful sign-in.
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);

  // An early return after hooks, which is safe here for a specific reason
  // rather than by luck: `signInRequired()` reads a value Vite substitutes
  // at BUILD time, so it is constant for the life of the process and the
  // hook order above can never change between renders of one instance.
  if (!signInRequired() || LIVE.linked) return <>{children}</>;

  // `null` rather than a spinner: this is a local chunk on a phone's own
  // disk, and a spinner that shows for one frame is worse than nothing.
  // The body's own background is already painted underneath.
  return (
    <React.Suspense fallback={null}>
      <Screen />
    </React.Suspense>
  );
}

export default SignInGate;
