// Whether this build requires an account before the app is usable (D134).
//
// Its own module rather than a second export from LiveSignInGate.tsx, which
// is only half a lint rule (react-refresh wants a component file to export
// components): the honest reason is that this is a BUILD FACT and the gate
// is a screen, and the one place that must be able to read the fact without
// pulling in the screen is a test.
//
// A build flag, not a runtime setting. BOTH release workflows set it —
// `ios-release.yml` and `play-release.yml`, each defaulting it to `true`
// since D414 put the wall back up, and the iOS one refusing to upload
// without it. Every other build — the dev server, the demo bundle, the
// whole test suite — compiles the gate to a pass-through.
//
// D3's MECHANISM is what stays true everywhere: the session is still
// signed in anonymously at boot and every door but one links it rather
// than replacing it, so a uid and its history survive the wall. What D414
// reversed is D3's posture for a shipping build, not its plumbing.
export function signInRequired(): boolean {
  // Exactly "true". Vite substitutes the literal string it was given, so an
  // exported-but-empty shell variable, or a `1`, must not read as consent —
  // a wall turned on by a typo is the worst version of this feature.
  return import.meta.env.VITE_REQUIRE_SIGNIN === "true";
}
