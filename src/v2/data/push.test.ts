// @vitest-environment jsdom
//
// WHEN the notification prompt is allowed to appear.
//
// This used to fire from `initLive`, during boot, before first render — so
// a fresh install's first act was an OS permission prompt for a
// notification class ("your reveal is out") that cannot fire until the
// person has joined a circle or started a 1v1.
//
// On iOS that decline is PERMANENT. There is no second prompt, so every
// user who tapped Not Now at a moment when nothing had earned it lost the
// shipped reveal push for good. The cost of asking early is not a worse
// conversion rate; it is the feature.
//
// So the parameter, and so this file: boot registers SILENTLY (a returning
// device that already granted permission, every launch) and only the acts
// that make a reveal possible may ask.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  native: true,
  platform: "ios",
  permission: "prompt" as string,
  checks: 0,
  requests: 0,
  listeners: [] as string[],
  registered: false,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => h.native,
    getPlatform: () => h.platform,
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: () => { h.checks += 1; return Promise.resolve({ receive: h.permission }); },
    requestPermissions: () => {
      h.requests += 1;
      // The user says no — the case that matters, because on iOS it is final.
      return Promise.resolve({ receive: h.permission === "prompt" ? "denied" : h.permission });
    },
    createChannel: () => Promise.resolve(),
    addListener: (name: string) => { h.listeners.push(name); return Promise.resolve({ remove() {} }); },
    register: () => { h.registered = true; return Promise.resolve(); },
  },
}));

vi.mock("../../lib/firebase", () => ({ getDb: () => Promise.resolve({}) }));
vi.mock("../../lib/sentry", () => ({ reportError: vi.fn() }));
vi.mock("../../lib/region", () => ({ FUNCTIONS_REGION: "europe-west1" }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(), httpsCallable: () => () => Promise.resolve({}) }));

beforeEach(() => {
  h.native = true;
  h.platform = "ios";
  h.permission = "prompt";
  h.checks = 0;
  h.requests = 0;
  h.listeners = [];
  h.registered = false;
  localStorage.clear();
});

describe("registerPushForReveals — the prompt is asked for, not assumed", () => {
  it("does NOT prompt by default, which is what boot calls", () => {
    // The regression, stated as the default. `initLive` passes no options,
    // so if this ever flips back the boot prompt returns with it.
    return (async () => {
      const { registerPushForReveals } = await import("./push");
      await registerPushForReveals("u1");
      expect(h.checks, "boot should still CHECK — a granted device re-registers").toBe(1);
      expect(h.requests, "boot asked the OS for permission").toBe(0);
      expect(h.registered, "an ungranted device registered anyway").toBe(false);
    })();
  });

  it("registers silently when permission was already granted", () => {
    // The returning user, every launch: no prompt, and the token write
    // still happens — which is the half boot must keep doing.
    return (async () => {
      h.permission = "granted";
      const { registerPushForReveals } = await import("./push");
      await registerPushForReveals("u1");
      expect(h.requests).toBe(0);
      expect(h.registered).toBe(true);
      expect(h.listeners).toContain("registration");
    })();
  });

  it("prompts only when the caller says the moment earned it", () => {
    return (async () => {
      const { registerPushForReveals } = await import("./push");
      await registerPushForReveals("u1", { ask: true });
      expect(h.requests, "an earning moment did not prompt").toBe(1);
    })();
  });

  it("asks in prompt-with-rationale too, which is Android's second chance", () => {
    // Android 13+ reports this after a first dismissal and it is still
    // promptable — the one platform where asking again is allowed, and
    // therefore the one where a too-early ask is recoverable.
    return (async () => {
      h.platform = "android";
      h.permission = "prompt-with-rationale";
      const { registerPushForReveals } = await import("./push");
      await registerPushForReveals("u1", { ask: true });
      expect(h.requests).toBe(1);
    })();
  });

  it("never asks a device that already refused", () => {
    // `denied` is terminal on iOS. Prompting again cannot show a dialog; it
    // can only waste a call, and reading it as promptable would be the bug
    // one layer along.
    return (async () => {
      h.permission = "denied";
      const { registerPushForReveals } = await import("./push");
      await registerPushForReveals("u1", { ask: true });
      expect(h.requests).toBe(0);
      expect(h.registered).toBe(false);
    })();
  });

  it("is a no-op off a native platform, whatever the caller asks for", () => {
    return (async () => {
      h.native = false;
      const { registerPushForReveals } = await import("./push");
      await registerPushForReveals("u1", { ask: true });
      expect(h.checks).toBe(0);
      expect(h.requests).toBe(0);
    })();
  });
});
