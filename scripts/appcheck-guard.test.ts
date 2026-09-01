// Both directions of the build-time App Check refusal.
//
// The half that matters is that it FIRES. Until this file existed the guard
// had never run in CI at all — see the header of appcheck-guard.ts for which
// job misses it and why — so "the guard is enforced" was a claim with
// nothing behind it, about the one control D3 says stands between the public
// surface and unlimited free anonymous accounts.
import { describe, expect, it } from "vitest";
import { shipsDebugToken, shipsUnattested } from "./appcheck-guard.ts";

const web = {
  mode: "production",
  isNativeBuild: false,
  apiKey: "AIzaSyExample",
  siteKey: undefined as string | undefined,
};

describe("the production web build refuses to ship unattested", () => {
  it("refuses a real Firebase project with no site key", () => {
    expect(shipsUnattested(web)).toBe(true);
  });

  it("builds once the site key is there", () => {
    expect(shipsUnattested({ ...web, siteKey: "6LcExample" })).toBe(false);
  });

  // The three exemptions, each asserted separately so a failure names the
  // one that broke rather than "the guard changed".
  it("exempts a native build, which attests through the platform", () => {
    // iOS DeviceCheck and Play Integrity never consult the site key (D3), so
    // demanding one would refuse every store build.
    expect(shipsUnattested({ ...web, isNativeBuild: true })).toBe(false);
  });

  it("exempts a mock-mode build, which has no project to attest to", () => {
    expect(shipsUnattested({ ...web, apiKey: undefined })).toBe(false);
    expect(shipsUnattested({ ...web, apiKey: "" })).toBe(false);
  });

  it("exempts dev and preview — this is a release refusal, not a lint", () => {
    expect(shipsUnattested({ ...web, mode: "development" })).toBe(false);
    expect(shipsUnattested({ ...web, mode: "test" })).toBe(false);
  });

  // The precedence that is easy to get backwards: native wins over a missing
  // site key, and mode wins over everything. Written as a table because the
  // interesting part is the combination, not any single flag.
  it("holds when the exemptions overlap", () => {
    const cases: Array<[Partial<typeof web>, boolean]> = [
      [{ isNativeBuild: true, apiKey: undefined }, false],
      [{ isNativeBuild: true, siteKey: "6LcExample" }, false],
      [{ mode: "development", isNativeBuild: false, apiKey: "k" }, false],
      // …and the one shape that must still refuse, however it is reached.
      [{ isNativeBuild: false, apiKey: "k", siteKey: undefined }, true],
      [{ isNativeBuild: false, apiKey: "k", siteKey: "" }, true],
    ];
    for (const [over, expected] of cases) {
      expect(shipsUnattested({ ...web, ...over }), JSON.stringify(over)).toBe(expected);
    }
  });
});

// The second refusal, and the one whose absence would be silent: a debug
// token does not make a build LOOK broken. It makes it work — for everyone,
// including whoever holds the token.
describe("a production build refuses to ship the App Check bypass", () => {
  const prod = { mode: "production", isNativeBuild: false, apiKey: "AIzaSyExample" };

  it("refuses a production build carrying a debug token", () => {
    expect(shipsDebugToken({ ...prod, debug: "true" })).toBe(true);
    expect(shipsDebugToken({ ...prod, debug: "1a2b3c-token" })).toBe(true);
  });

  it("builds when the variable is unset or empty", () => {
    expect(shipsDebugToken({ ...prod })).toBe(false);
    expect(shipsDebugToken({ ...prod, debug: "" })).toBe(false);
  });

  it("exempts non-production modes — the capture build's whole escape", () => {
    // The screenshot job builds with --mode capture precisely so it can carry
    // a token without this firing. If that stops being true the job cannot
    // reach Firestore once enforcement is on, so it is asserted rather than
    // left to the workflow's comment.
    expect(shipsDebugToken({ ...prod, mode: "capture", debug: "tok" })).toBe(false);
    expect(shipsDebugToken({ ...prod, mode: "development", debug: "tok" })).toBe(false);
  });

  it("does NOT exempt a native build, and that is the deliberate part", () => {
    // CAPACITOR_BUILD=1 looks like it makes the flag inert, because native
    // takes its debug token from platform env vars. The screenshot job sets
    // that variable and runs the bundle in a browser, on the web path, where
    // the bypass is real — so the exemption would be false for its own
    // biggest user. See the predicate's comment.
    expect(shipsDebugToken({ ...prod, isNativeBuild: true, debug: "tok" })).toBe(true);
  });

  it("can fire together with the site-key refusal, and then order decides", () => {
    // Written after the first version of this test asserted the opposite and
    // failed, which is the useful half. `shipsUnattested` knows nothing about
    // the debug flag, so a production build with a token and NO site key
    // trips both — and vite.config.ts throws the debug one first on purpose:
    // "set the site key" is the wrong remedy for a bypass, and following it
    // clears the other guard while leaving the bypass in the bundle.
    const both = { ...prod, siteKey: undefined, debug: "tok" };
    expect(shipsUnattested(both)).toBe(true);
    expect(shipsDebugToken(both)).toBe(true);
    // With a key present only the bypass is left to catch.
    const keyed = { ...prod, siteKey: "6LcExample", debug: "tok" };
    expect(shipsUnattested(keyed)).toBe(false);
    expect(shipsDebugToken(keyed)).toBe(true);
  });
});
