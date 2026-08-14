// @vitest-environment jsdom
//
// Pins D76's default: telemetry is ON unless an opt-out was recorded.
// The absent-key case is the one that fails on the pre-D76 code, where
// absence meant off. It matters because the claim lives in prose all
// over the tree — privacy.html's "on by default", the panel's
// "On (default)", the store forms — and flipping the comparison back
// would turn every one of them into fiction while lint, tsc,
// check:globals and check:store-forms all stay green. This is the only
// gate that executes the default.
//
// The send-site gating (an SDK initialised before an opt-out must not
// keep transmitting) is deliberately NOT tested here: it lives behind
// the dynamic SDK import, and a mock deep enough to observe it would
// re-type Sentry's surface — the panel-copy saga in sentry.ts documents
// the enforcement instead.

import { beforeEach, describe, expect, it } from "vitest";
import { setTelemetryEnabled, telemetryEnabled } from "./sentry";

beforeEach(() => localStorage.clear());

describe("telemetryEnabled — on unless an opt-out was recorded (D76)", () => {
  it("reads an absent flag as on", () => {
    expect(telemetryEnabled(), "a fresh install must report by default").toBe(true);
  });

  it("honours a recorded opt-out", () => {
    setTelemetryEnabled(false);
    expect(telemetryEnabled()).toBe(false);
  });

  it("an opt-out survives being read repeatedly, and an explicit re-enable lifts it", () => {
    setTelemetryEnabled(false);
    expect(telemetryEnabled()).toBe(false);
    expect(telemetryEnabled()).toBe(false);
    // setTelemetryEnabled(true) also calls sentryInit(); with no
    // VITE_SENTRY_DSN in the test env that is a no-op by design.
    setTelemetryEnabled(true);
    expect(telemetryEnabled()).toBe(true);
  });
});
