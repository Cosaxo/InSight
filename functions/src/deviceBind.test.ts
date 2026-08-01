// D29's decision logic. The month rule IS the product guarantee ("one
// counted account per device per calendar month"), so these pin it at the
// boundaries rather than spot-checking a happy path: month rollovers, the
// never-seen device, the epoch encoding's collision cases, and the
// write-dates-vs-epoch precedence. The Apple JWT builder gets a real
// crypto round trip — a signature Apple would reject fails here, not in
// the first staging probe.
import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify as cryptoVerify } from "node:crypto";
import {
  buildAppleJwt,
  decideDeviceCheck,
  decideRecall,
  decodeRecall,
  encodeRecall,
  monthKey,
  recallEpoch,
} from "./deviceBind";

const at = (iso: string) => new Date(iso);

describe("monthKey", () => {
  it("is the UTC calendar month, zero-padded", () => {
    expect(monthKey(at("2026-08-01T00:00:00Z"))).toBe("2026-08");
    expect(monthKey(at("2026-12-31T23:59:59Z"))).toBe("2026-12");
    // The trap: a local-time implementation shifts this one across the
    // year boundary in any western timezone.
    expect(monthKey(at("2027-01-01T00:00:01Z"))).toBe("2027-01");
  });
});

describe("decideDeviceCheck (iOS month rule)", () => {
  const now = at("2026-08-15T12:00:00Z");
  it("allows a device Apple has never seen", () => {
    expect(decideDeviceCheck(null, now)).toBe(true);
  });
  it("allows when bit0 is clear, whatever the stamp says", () => {
    expect(decideDeviceCheck({ bit0: false, bit1: true, last_update_time: "2026-08" }, now)).toBe(true);
  });
  it("blocks a same-month activation", () => {
    expect(decideDeviceCheck({ bit0: true, bit1: false, last_update_time: "2026-08" }, now)).toBe(false);
  });
  it("allows again the next month", () => {
    expect(decideDeviceCheck({ bit0: true, bit1: false, last_update_time: "2026-07" }, now)).toBe(true);
  });
  it("separator differences in the stamp cannot flip the decision", () => {
    // Apple documents "YYYY-MM"; a "202608" would otherwise never equal
    // "2026-08" and the cooldown would silently vanish.
    expect(decideDeviceCheck({ bit0: true, bit1: false, last_update_time: "202608" }, now)).toBe(false);
  });
  it("a bit0 with no stamp fails open by one activation, not closed", () => {
    expect(decideDeviceCheck({ bit0: true, bit1: false }, now)).toBe(true);
  });
});

describe("recall epoch encoding (Android fallback)", () => {
  it("round-trips all seven non-zero states", () => {
    for (let s = 1; s <= 7; s++) expect(decodeRecall(encodeRecall(s))).toBe(s);
  });
  it("never emits state 0 — zero is reserved for the never-seen device", () => {
    // 24 consecutive months cover every residue of the mod-7 cycle twice.
    for (let m = 0; m < 24; m++) {
      const d = new Date(Date.UTC(2026, m, 15));
      expect(recallEpoch(d)).toBeGreaterThanOrEqual(1);
      expect(recallEpoch(d)).toBeLessThanOrEqual(7);
    }
  });
  it("changes every month and repeats exactly on the 7th", () => {
    const base = recallEpoch(at("2026-08-15T00:00:00Z"));
    expect(recallEpoch(at("2026-09-15T00:00:00Z"))).not.toBe(base);
    expect(recallEpoch(at("2027-03-15T00:00:00Z"))).toBe(base); // +7 months
  });
});

describe("decideRecall (Android)", () => {
  const now = at("2026-08-15T12:00:00Z");
  it("allows the never-seen device and writes the current epoch", () => {
    const { allow, next } = decideRecall(null, undefined, now);
    expect(allow).toBe(true);
    expect(decodeRecall(next)).toBe(recallEpoch(now));
  });
  it("all-clear values count as never seen", () => {
    expect(decideRecall(encodeRecall(0), undefined, now).allow).toBe(true);
  });
  it("epoch path: blocks the current epoch, allows any other", () => {
    expect(decideRecall(encodeRecall(recallEpoch(now)), undefined, now).allow).toBe(false);
    const other = (recallEpoch(now) % 7) + 1;
    expect(decideRecall(encodeRecall(other), undefined, now).allow).toBe(true);
  });
  it("write-dates path takes precedence: a current-month date blocks, whatever the epoch decode says", () => {
    // Every non-zero value must block under a current-month write date on
    // a set bit — including the six states whose epoch decode would allow.
    for (let s = 1; s <= 7; s++) {
      const values = encodeRecall(s);
      const dates = {
        ...(values.bitFirst ? { bitFirstWriteDate: "2026-08" } : {}),
        ...(values.bitSecond ? { bitSecondWriteDate: "2026-08" } : {}),
        ...(values.bitThird ? { bitThirdWriteDate: "2026-08" } : {}),
      };
      expect(decideRecall(values, dates, now).allow).toBe(false);
    }
  });
  it("a date on an UNSET bit is ignored — only set bits testify", () => {
    const values = { bitFirst: false, bitSecond: true, bitThird: false };
    const epochAllows = decodeRecall(values) !== recallEpoch(now);
    const res = decideRecall(values, { bitFirstWriteDate: "2026-08" }, now);
    expect(res.allow).toBe(epochAllows);
  });
  it("write-dates path: an old month allows, and the next write is the epoch encoding", () => {
    const values = { bitFirst: true, bitSecond: false, bitThird: false };
    const { allow, next } = decideRecall(values, { bitFirstWriteDate: "2026-07" }, now);
    expect(allow).toBe(true);
    expect(decodeRecall(next)).toBe(recallEpoch(now));
  });
  it("normalizes Google's date format against ours", () => {
    const values = { bitFirst: true, bitSecond: false, bitThird: false };
    expect(decideRecall(values, { bitFirstWriteDate: "202608" }, now).allow).toBe(false);
  });
});

describe("buildAppleJwt", () => {
  it("produces a compact ES256 JWT that verifies against the public key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = buildAppleJwt("TEAM123456", "KEY1234567", pem, at("2026-08-15T12:00:00Z"));
    const [h, p, s] = jwt.split(".");
    expect(h && p && s).toBeTruthy();
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    expect(header).toEqual({ alg: "ES256", kid: "KEY1234567" });
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload.iss).toBe("TEAM123456");
    expect(payload.iat).toBe(Math.floor(Date.parse("2026-08-15T12:00:00Z") / 1000));
    const okSig = cryptoVerify(
      "sha256",
      Buffer.from(`${h}.${p}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(s, "base64url"),
    );
    expect(okSig).toBe(true);
  });
  it("the signature is over header.payload — tampering breaks verification", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = buildAppleJwt("TEAM123456", "KEY1234567", pem, new Date(0));
    const [h, , s] = jwt.split(".");
    const forged = Buffer.from(JSON.stringify({ iss: "EVIL", iat: 0 })).toString("base64url");
    const okSig = cryptoVerify(
      "sha256",
      Buffer.from(`${h}.${forged}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(s, "base64url"),
    );
    expect(okSig).toBe(false);
  });
});
