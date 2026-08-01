// The memo/plan logic that decides whether a boot attempts activation
// (D29). Pure functions only — the orchestration around them is exercised
// by the e2e (activation leg) and, for the native token paths, by the
// staging probe in docs/DEVICE-BIND.md. The month arithmetic must agree
// with the server's (functions/src/deviceBind.ts) — same UTC "YYYY-MM".
import { describe, expect, it } from "vitest";
import { activationPlan, memoAfter, monthKey, parseBindMemo } from "./deviceBind";

const at = (iso: string) => new Date(iso);

describe("parseBindMemo", () => {
  it("round-trips a valid memo and rejects garbage without throwing", () => {
    expect(parseBindMemo(JSON.stringify({ uid: "u1" }))).toEqual({ uid: "u1" });
    expect(parseBindMemo(null)).toBeNull();
    expect(parseBindMemo("not json")).toBeNull();
    expect(parseBindMemo(JSON.stringify({ nope: 1 }))).toBeNull();
    expect(parseBindMemo(JSON.stringify({ uid: "" }))).toBeNull();
  });
});

describe("activationPlan", () => {
  const now = at("2026-08-15T12:00:00Z");
  it("attempts for a never-seen or switched account", () => {
    expect(activationPlan(null, "u1", now)).toBe("attempt");
    expect(activationPlan({ uid: "other" }, "u1", now)).toBe("attempt");
  });
  it("skips once activated — no re-attestation every boot", () => {
    expect(activationPlan({ uid: "u1" }, "u1", now)).toBe("skip");
  });
  it("skips within the cooldown month, re-attempts after it rolls", () => {
    expect(activationPlan({ uid: "u1", until: "2026-08" }, "u1", now)).toBe("skip");
    expect(activationPlan({ uid: "u1", until: "2026-07" }, "u1", now)).toBe("attempt");
  });
  it("a switched account ignores the old account's cooldown", () => {
    // The cooldown is the DEVICE's, and the server re-checks it anyway —
    // but the new uid must attempt, or an account created next month on
    // this device would never activate at all.
    expect(activationPlan({ uid: "old", until: "2026-08" }, "u1", now)).toBe("attempt");
  });
});

describe("memoAfter", () => {
  const now = at("2026-08-15T12:00:00Z");
  it("ok settles the uid permanently", () => {
    expect(memoAfter("u1", { ok: true }, now)).toEqual({ uid: "u1" });
  });
  it("cooldown memoizes the observed month", () => {
    expect(memoAfter("u1", { ok: false, reason: "cooldown" }, now)).toEqual({
      uid: "u1",
      until: "2026-08",
    });
  });
  it("errors memoize nothing — the retry is the recovery path", () => {
    expect(memoAfter("u1", null, now)).toBeNull();
    expect(memoAfter("u1", { ok: false, reason: "unavailable" }, now)).toBeNull();
  });
});

describe("monthKey agreement", () => {
  it("is UTC and zero-padded, matching the server's", () => {
    expect(monthKey(at("2026-08-01T00:00:00Z"))).toBe("2026-08");
    expect(monthKey(at("2027-01-01T00:00:01Z"))).toBe("2027-01");
  });
});
