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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// ── the SDK chunk that never arrives ──
//
// The header above declines to test the send-site gating because a mock
// deep enough to observe it would re-type Sentry's surface. This is the
// opposite shape and needs no surface at all: the chunk FAILS, so there is
// nothing to re-type — and the failure is what silences the rest of the
// session.
//
// After `sentryInit`'s catch, `loading` went false and `sdk` stayed null,
// so `reportError` neither captured nor queued; and its console mirror is
// gated on the DSN being ABSENT, which on a real build it is not. Two
// errors in, zero out, for the life of the page — after an offline blip or
// a deploy swapping the chunk mid-load, which is exactly when errors are
// worth having. The up-to-20 already queued went with it.
describe("after the SDK chunk fails to load", () => {
  afterEach(() => {
    vi.doUnmock("@sentry/capacitor");
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function loadWithBrokenChunk() {
    vi.doMock("@sentry/capacitor", () => { throw new Error("chunk load failed"); });
    // A REAL build: a DSN is configured, which is what closed the console
    // mirror, and not DEV, which is what would have reopened it.
    vi.stubEnv("VITE_SENTRY_DSN", "https://k@example.ingest.sentry.io/1");
    vi.stubEnv("DEV", false);
    vi.resetModules();
    return import("./sentry");
  }

  it("puts what it cannot send on the console instead of dropping it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await loadWithBrokenChunk();

    m.sentryInit();
    // Reported DURING the load — the boot window, which is when this
    // failure happens — so it lands in the queue.
    m.reportError(new Error("during"), { where: "boot" });
    await new Promise((r) => setTimeout(r, 0));
    // …and after it, when nothing is loading any more.
    m.reportError(new Error("after"), { where: "later" });

    expect(warn, "the load failure was not even warned about").toHaveBeenCalled();
    const said = error.mock.calls.map((c) => String(c[1]));
    expect(said, "the queued boot error was dropped").toContain("Error: during");
    expect(said, "every later error was dropped too").toContain("Error: after");
  });
});
