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

// The nav registry (D248), not `window.goTab`. push.ts stopped casting
// its way onto window when app-shell's cross-links became a registry, so
// a test that stubs the global now stubs a door nothing opens.
import { registerNav } from "./nav";
import { _forgetPushListenersForTest } from "./push";

// Held so beforeEach can drop exactly what the last tap registered —
// registerNav's teardown is identity-checked, so `delete`-ing by key is
// not something a caller can do.
let dropNav: () => void = () => {};

const h = vi.hoisted(() => ({
  native: true,
  platform: "ios",
  permission: "prompt" as string,
  checks: 0,
  requests: 0,
  listeners: [] as string[],
  // What createChannel was actually handed. The ids matter (the server
  // names them on every send) and so do the descriptions — a channel's
  // description is the sentence Android shows on the one screen a person
  // uses to turn this off.
  channels: [] as Array<Record<string, unknown>>,
  // The tap handlers, so a notification can be delivered without a device.
  handlers: {} as Record<string, (a: unknown) => void>,
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
    createChannel: (c: Record<string, unknown>) => { h.channels.push(c); return Promise.resolve(); },
    addListener: (name: string, fn: (a: unknown) => void) => {
      h.listeners.push(name);
      h.handlers[name] = fn;
      return Promise.resolve({ remove() {} });
    },
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
  h.channels = [];
  h.handlers = {};
  h.registered = false;
  localStorage.clear();
  sessionStorage.clear();
  dropNav();
  dropNav = () => {};
  // The listener set is attached ONCE PER ACCOUNT and that state is
  // module-level, so without this every case after the first would find
  // the handlers already attached — to a fake the `h.handlers` reset above
  // has just emptied. Each case is a fresh boot.
  _forgetPushListenersForTest();
});

describe("the listener set is attached once, not once per call", () => {
  // `registerPush` runs more than once per session BY DESIGN: boot calls
  // it per uid, and `pushEarned` (live.ts) calls it again on every
  // createGroup / requestJoin / acceptInvite, deliberately without
  // consulting the boot's memo — the point of that call is to ASK at the
  // moment the permission is worth something. On a returning device that
  // already granted it, both get past the permission gate.
  //
  // Each call used to attach a full new set of three. One tap then ran the
  // handler N times: `note("notifOpen")` counted N — the sent→opened half
  // of D270's funnel, the only half the client owns — and
  // `insight-live-update` fired N times. `register()` re-firing
  // `registration` into every attached listener also raced several
  // `registerPushToken` callables per token, because the memo they dedupe
  // against is written only after the first returns.
  it("does not stack a second set when the same account registers again", async () => {
    h.permission = "granted";
    const { registerPush } = await import("./push");
    await registerPush("u1");
    expect(h.listeners.length, "the first registration attached nothing").toBe(3);
    await registerPush("u1", { ask: true });
    expect(h.listeners.length, "a second call attached a second set").toBe(3);
    // …and it still asks the platform for a token, which is what the
    // second call is FOR. Only the handlers are once.
    expect(h.registered).toBe(true);
  });

  it("…and does swap the set when the ACCOUNT changes", async () => {
    // Keyed by uid rather than a bare flag, because the handlers close over
    // `uid`: the registration handler writes `{uid, token}` and returns
    // early on a match, so a set left attached from a previous account
    // would file the new account's token under the old uid.
    h.permission = "granted";
    const { registerPush } = await import("./push");
    await registerPush("u1");
    h.listeners = [];
    await registerPush("u2");
    expect(h.listeners.length, "a new account inherited the old account's handlers").toBe(3);
  });
});

describe("registerPush — the prompt is asked for, not assumed", () => {
  it("does NOT prompt by default, which is what boot calls", () => {
    // The regression, stated as the default. `initLive` passes no options,
    // so if this ever flips back the boot prompt returns with it.
    return (async () => {
      const { registerPush } = await import("./push");
      await registerPush("u1");
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
      const { registerPush } = await import("./push");
      await registerPush("u1");
      expect(h.requests).toBe(0);
      expect(h.registered).toBe(true);
      expect(h.listeners).toContain("registration");
    })();
  });

  it("prompts only when the caller says the moment earned it", () => {
    return (async () => {
      const { registerPush } = await import("./push");
      await registerPush("u1", { ask: true });
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
      const { registerPush } = await import("./push");
      await registerPush("u1", { ask: true });
      expect(h.requests).toBe(1);
    })();
  });

  it("never asks a device that already refused", () => {
    // `denied` is terminal on iOS. Prompting again cannot show a dialog; it
    // can only waste a call, and reading it as promptable would be the bug
    // one layer along.
    return (async () => {
      h.permission = "denied";
      const { registerPush } = await import("./push");
      await registerPush("u1", { ask: true });
      expect(h.requests).toBe(0);
      expect(h.registered).toBe(false);
    })();
  });

  it("is a no-op off a native platform, whatever the caller asks for", () => {
    return (async () => {
      h.native = false;
      const { registerPush } = await import("./push");
      await registerPush("u1", { ask: true });
      expect(h.checks).toBe(0);
      expect(h.requests).toBe(0);
    })();
  });
});

// ── the two channels, and the tap that routes (D236) ─────────────

describe("channels", () => {
  const grant = async () => {
    h.platform = "android";
    h.permission = "granted";
    const { registerPush } = await import("./push");
    await registerPush("u1");
  };

  // Android 8+ DROPS a notification posted to a channel that does not
  // exist, and only while the app is backgrounded — which is exactly when
  // both of these matter. Nothing reports it.
  it("creates all three, so no class can be dropped", async () => {
    await grant();
    expect(h.channels.map((c) => c.id)).toEqual(["reveals", "invites", "turns"]);
  });

  // The description is a CLAIM, on the one screen the OS gives a person to
  // turn this off. An invitation posted to "reveals" would wear "When a
  // group or duo day is revealed" — false — and muting invitations would
  // cost them the reveal they opened the app for.
  it("describes each for what it actually sends", async () => {
    await grant();
    const byId = Object.fromEntries(h.channels.map((c) => [c.id, c]));
    expect(byId.reveals.description).toBe("When a round in a group or 1v1 is revealed.");
    // Both directions since D240 — an invitation to you, and somebody
    // asking to join a group you are in. One channel, because a
    // person muting one would mean to mute both.
    expect(byId.invites.description).toBe("When someone invites you, or asks to join your group.");
    // ROUNDS-PLAN §7.4: a nudge on its own channel, at default importance
    // — muting it keeps the reveal, and it never pops over what you are
    // doing the way the reveal (4) does.
    expect(byId.turns.description).toBe("When it's your turn in a 1v1 or group.");
    expect(byId.turns.importance).toBe(3);
    expect(byId.reveals.importance).toBe(4);
  });

  it("creates none on iOS, which has no channels", async () => {
    h.platform = "ios";
    h.permission = "granted";
    const { registerPush } = await import("./push");
    await registerPush("u1");
    expect(h.channels).toEqual([]);
  });
});

describe("a tapped notification lands somewhere", () => {
  const tap = async (data: Record<string, unknown>) => {
    h.platform = "android";
    h.permission = "granted";
    const goTab = vi.fn();
    dropNav = registerNav({ goTab });
    const { registerPush } = await import("./push");
    await registerPush("u1");
    h.handlers.pushNotificationActionPerformed({ notification: { data } });
    return goTab;
  };

  it("routes a reveal by gid, the way DailySplit resolves it", async () => {
    const goTab = await tap({ kind: "reveal", gid: "g1" });
    expect(sessionStorage.getItem("insight.pendingReveal")).toBe("g1");
    expect(goTab).toHaveBeenCalledWith("track");
  });

  // "Your turn" (ROUNDS-PLAN §7.4) lands on the same room the same way —
  // the person is a member, so the gid resolves.
  it("routes a turn by gid, like a reveal", async () => {
    const goTab = await tap({ kind: "turn", gid: "g1" });
    expect(sessionStorage.getItem("insight.pendingReveal")).toBe("g1");
    expect(goTab).toHaveBeenCalledWith("track");
  });

  // A push while the app is OPEN presents nothing (the config's job, see
  // push.ts's header) and is handed to the store as an event, so what it
  // announces is on screen rather than over it.
  it("hands a foreground arrival to the store, and presents nothing itself", async () => {
    h.platform = "ios";
    h.permission = "granted";
    const seen: Array<Record<string, unknown>> = [];
    const on = (e: Event) => { seen.push((e as CustomEvent).detail); };
    window.addEventListener("insight-push-received", on);
    let repaints = 0;
    const onLive = () => { repaints += 1; };
    window.addEventListener("insight-live-update", onLive);
    try {
      const { registerPush } = await import("./push");
      await registerPush("u1");
      expect(h.listeners).toContain("pushNotificationReceived");
      h.handlers.pushNotificationReceived({ data: { kind: "turn", gid: "g1" } });
      expect(seen).toEqual([{ kind: "turn", gid: "g1" }]);
      expect(repaints).toBe(1);
      // Nothing was stashed and nothing navigated: an arrival is not a tap.
      expect(sessionStorage.getItem("insight.pendingReveal")).toBeNull();
    } finally {
      window.removeEventListener("insight-push-received", on);
      window.removeEventListener("insight-live-update", onLive);
    }
  });

  // THE ASYMMETRY, pinned. An invitee is not a member yet, so the gid
  // would not resolve against LIVE.social.groups() and the tap would go
  // nowhere at all. The MODE routes instead — to the stop where LdInvites
  // already draws the row.
  it("routes an invite by mode, and stashes no gid", async () => {
    const goTab = await tap({ kind: "invite", gid: "g1", mode: "duo" });
    expect(sessionStorage.getItem("insight.pendingInvite")).toBe("duo");
    expect(sessionStorage.getItem("insight.pendingReveal")).toBeNull();
    expect(goTab).toHaveBeenCalledWith("track");
  });

  it("treats any other mode as the circle stop", async () => {
    await tap({ kind: "invite", gid: "g1" });
    expect(sessionStorage.getItem("insight.pendingInvite")).toBe("group");
  });

  // A payload this build does not know must not navigate: a tap that
  // silently jumps the user somewhere unrelated reads as a bug in the app,
  // not as a newer server.
  it("ignores a kind it does not know", async () => {
    const goTab = await tap({ kind: "something-later", gid: "g1" });
    expect(goTab).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("insight.pendingInvite")).toBeNull();
  });
});

// ── a circle you are in, either direction (D240) ───────────────────
describe("a tapped join notification", () => {
  const tap = async (data: Record<string, unknown>) => {
    h.platform = "android";
    h.permission = "granted";
    const goTab = vi.fn();
    dropNav = registerNav({ goTab });
    const { registerPush } = await import("./push");
    await registerPush("u1");
    h.handlers.pushNotificationActionPerformed({ notification: { data } });
    return goTab;
  };

  // BOTH name a circle this account is IN — you are a member of the one
  // somebody is asking to join, and you have just become a member of the
  // one that let you in — so the gid resolves and DailySplit can land on
  // that circle's own mode. That is the difference from an invitation,
  // whose gid resolves to nothing because the invitee is not a member.
  it("routes a request to the circle it is about", async () => {
    const goTab = await tap({ kind: "join-request", gid: "g1" });
    expect(sessionStorage.getItem("insight.pendingCircle")).toBe("g1");
    expect(goTab).toHaveBeenCalledWith("track");
  });

  it("routes an approval the same way", async () => {
    const goTab = await tap({ kind: "join-approved", gid: "g1" });
    expect(sessionStorage.getItem("insight.pendingCircle")).toBe("g1");
    expect(goTab).toHaveBeenCalledWith("track");
  });

  it("keeps the invitation path separate, since its gid resolves to nothing", async () => {
    await tap({ kind: "invite", gid: "g1", mode: "duo" });
    expect(sessionStorage.getItem("insight.pendingInvite")).toBe("duo");
    expect(sessionStorage.getItem("insight.pendingCircle")).toBeNull();
  });

  it("ignores a join payload with no circle on it", async () => {
    const goTab = await tap({ kind: "join-request" });
    expect(goTab).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("insight.pendingCircle")).toBeNull();
  });
});
