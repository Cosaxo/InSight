// Whether this build requires an account before the app is usable (D133).
//
// Its own module rather than a second export from LiveSignInGate.tsx, which
// is only half a lint rule (react-refresh wants a component file to export
// components): the honest reason is that this is a BUILD FACT and the gate
// is a screen, and the one place that must be able to read the fact without
// pulling in the screen is a test.
//
// A build flag, not a runtime setting. `ios-release.yml` sets it and
// nothing else does, so every other build — the dev server, the demo
// bundle, the whole test suite — compiles the gate to a pass-through.
// That is what keeps D3 (anonymous-first, "never a wall") true everywhere
// this one decision does not reach.
export function signInRequired(): boolean {
  // Exactly "true". Vite substitutes the literal string it was given, so an
  // exported-but-empty shell variable, or a `1`, must not read as consent —
  // a wall turned on by a typo is the worst version of this feature.
  return import.meta.env.VITE_REQUIRE_SIGNIN === "true";
}
