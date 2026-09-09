// @vitest-environment jsdom
//
// Pins D76's default: telemetry is ON unless an opt-out was recorded.
// The absent-key case is the one that fails on the pre-D76 code, where
// absence meant off. It matters because the claim lives in prose all
// over the tree — privacy.html's "on by default", the store forms — and
// flipping the comparison back would turn every one of them into fiction
// while lint, tsc, check:globals and check:store-forms all stay green.
// This is the only gate that executes the default.
//
// The account panel's off switch is gone (D211), so nothing writes the
// flag any more — the second case writes the KEY exactly as an older
// build's switch did, because those recorded opt-outs are what must stay
// honoured for as long as the storage carrying them lives.
//
// The send-site gating (an SDK initialised before an opt-out must not
// keep transmitting) is deliberately NOT tested here: it lives behind
// the dynamic SDK import, and a mock deep enough to observe it would
// re-type Sentry's surface — the panel-copy saga in sentry.ts documents
// the enforcement instead.

import { beforeEach, describe, expect, it } from "vitest";
import { telemetryEnabled } from "./sentry";

beforeEach(() => localStorage.clear());

describe("telemetryEnabled — on unless an opt-out was recorded (D76)", () => {
  it("reads an absent flag as on", () => {
    expect(telemetryEnabled(), "a fresh install must report by default").toBe(true);
  });

  it("honours an opt-out an older build recorded", () => {
    localStorage.setItem("insight.telemetry.v1", "false");
    expect(telemetryEnabled()).toBe(false);
    expect(telemetryEnabled(), "a read must not consume the record").toBe(false);
  });

  it("only the recorded 'false' opts out — any other residue stays on", () => {
    localStorage.setItem("insight.telemetry.v1", "true");
    expect(telemetryEnabled()).toBe(true);
  });
});
