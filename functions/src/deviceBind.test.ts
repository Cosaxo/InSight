// D29's decision logic. The month rule IS the product guarantee ("one
// counted account per device per calendar month"), so these pin it at the
// boundaries rather than spot-checking a happy path: month rollovers, the
// never-seen device, the epoch encoding's collision cases, and the
// write-dates-vs-epoch precedence. The Apple JWT builder gets a real
// crypto round trip — a signature Apple would reject fails here, not in
// the first staging probe.
import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify as cryptoVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAppleJwt,
  decideDeviceCheck,
  decideRecall,
  readTwoBits,
  decodeRecall,
  encodeRecall,
  monthKey,
  recallEpoch,
  requestDetailsProblem,
  regradeWith,
  type RegradeAuth,
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

// ── what a 200 from Apple actually said ─────────────────────────────
//
// A device Apple has never seen answers 200 with the literal string
// "Failed to find bit state" rather than JSON. That is ONE documented
// body, and the caller used to fold every parse failure into the same
// value — which `decideDeviceCheck` reads as never-seen and ALLOWS. So a
// captive portal page, or a changed Apple error format, published the
// fact "this device has not activated this month" and opened the monthly
// cooldown (D29). `JSON.parse("123")` reached the same place by a second
// route: it succeeds, and `bit0` on a number is undefined.
//
// The 401/403 arm beside the call site already throws rather than
// granting. A failed READ is not a fact about the device, and this is
// that rule applied to the body.
describe("readTwoBits (what a 200 from Apple actually said)", () => {
  it("reads Apple's one documented non-JSON body as a never-seen device", () => {
    expect(readTwoBits("Failed to find bit state").kind).toBe("never-seen");
  });

  it("reads a real bit state as bits", () => {
    const r = readTwoBits(JSON.stringify({ bit0: true, bit1: false, last_update_time: "2026-09" }));
    expect(r.kind).toBe("bits");
    if (r.kind === "bits") expect(r.bits.bit0).toBe(true);
  });

  it("refuses to call anything else a never-seen device", () => {
    // Each of these used to become `null`, which allows.
    for (const body of [
      "<html>captive portal</html>",
      "",
      "Some new Apple error text",
      "123",            // valid JSON, and `bit0` on a number is undefined
      '"a string"',
      "null",
      "[]",
    ]) {
      expect(readTwoBits(body).kind, `a 200 body of ${JSON.stringify(body)} was read as a fact about the device`)
        .toBe("unreadable");
    }
  });

  it("and an unreadable body is not silently a bit state either", () => {
    // The other direction: "unreadable" must not be folded into `bits`
    // by the caller, or the cooldown reads whatever `bit0` happens to be.
    expect(readTwoBits("garbage")).toEqual({ kind: "unreadable" });
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
  // PLAY'S OWN SHAPE, not ours. These cases used to build
  // `{ bitFirstWriteDate: "2026-08" }` and call it "Google's date format".
  // Google sends `yyyymmFirst` as an int32 (202608). Different keys and a
  // different type, so the production filter emptied the list on every real
  // verdict and this whole branch was dead — while four cases here said it
  // worked, because the reader and the fixture shared one invention.
  it("write-dates path takes precedence: a current-month date blocks, whatever the epoch decode says", () => {
    // Every non-zero value must block under a current-month write date on
    // a set bit — including the six states whose epoch decode would allow.
    for (let s = 1; s <= 7; s++) {
      const values = encodeRecall(s);
      const dates = {
        ...(values.bitFirst ? { yyyymmFirst: 202608 } : {}),
        ...(values.bitSecond ? { yyyymmSecond: 202608 } : {}),
        ...(values.bitThird ? { yyyymmThird: 202608 } : {}),
      };
      expect(decideRecall(values, dates, now).allow).toBe(false);
    }
  });
  it("a date on an UNSET bit is ignored — only set bits testify", () => {
    const values = { bitFirst: false, bitSecond: true, bitThird: false };
    const epochAllows = decodeRecall(values) !== recallEpoch(now);
    const res = decideRecall(values, { yyyymmFirst: 202608 }, now);
    expect(res.allow).toBe(epochAllows);
  });
  it("write-dates path: an old month allows, and the next write is the epoch encoding", () => {
    const values = { bitFirst: true, bitSecond: false, bitThird: false };
    const { allow, next } = decideRecall(values, { yyyymmFirst: 202607 }, now);
    expect(allow).toBe(true);
    expect(decodeRecall(next)).toBe(recallEpoch(now));
  });
  it("takes the integer Play actually sends, and a numeric string too", () => {
    const values = { bitFirst: true, bitSecond: false, bitThird: false };
    expect(decideRecall(values, { yyyymmFirst: 202608 }, now).allow).toBe(false);
    // Belt and braces: this shape has been guessed wrong once already.
    expect(decideRecall(values, { yyyymmFirst: "202608" }, now).allow).toBe(false);
  });
  it("REFUSES to read the shape we invented, so it cannot come back", () => {
    // The old keys must now fall through to the epoch path rather than
    // being read as dates. Without this, someone restoring the old
    // interface would make four cases above pass again on a branch
    // production never reaches.
    const values = encodeRecall(recallEpoch(now));
    const invented = { bitFirstWriteDate: "2026-08", bitSecondWriteDate: "2026-08", bitThirdWriteDate: "2026-08" };
    // Epoch says block (the stamp is this month's), and the invented dates
    // must not be what decides it either way.
    expect(decideRecall(values, invented as never, now).allow).toBe(false);
    const other = encodeRecall((recallEpoch(now) % 7) + 1);
    // Epoch says allow. If the invented keys were read as a current-month
    // date, this would block.
    expect(decideRecall(other, invented as never, now).allow).toBe(true);
  });
});

describe("the Play Integrity call shape", () => {
  // NOTHING COVERED THIS, which is how it shipped wrong. No test makes the
  // network call, so the URL and the request field were free to be
  // anything — and they were: `v1/{pkg}:writeDeviceRecall` with
  // `{ values }`, where Google's method is `deviceRecall:write` under
  // `v1/{+packageName}` and the field is `newValues`.
  //
  // Verified against the live discovery document AND on the wire: the old
  // URL answers 404, this one answers 401 (auth required), and the decode
  // call beside it — which was always correct — also answers 401. So the
  // difference is the path, not the network.
  //
  // A source ratchet, because the alternative is a live call in a unit
  // test. It holds the two things that were wrong, and it is the same
  // shape this repo uses elsewhere for "do not re-fork this".
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "deviceBind.ts"), "utf8");
  // The `url:` line itself, not the whole file — the comment above that
  // call quotes the old path to explain what was wrong with it, and a
  // whole-file search would read the explanation as the defect. (It did,
  // first time round.)
  // Both Play calls this file makes, as a set. Taking "the first url" read
  // the decode call instead, and a whole-file search read the comment that
  // quotes the old path as the defect itself — so the assertion is on the
  // urls, all of them, named.
  const urls = [...src.matchAll(/url:\s*`([^`]+)`/g)].map((m) => m[1]);

  it("makes exactly the two Play calls it is supposed to", () => {
    expect(urls, "the number of Play calls changed — this ratchet needs re-reading").toHaveLength(2);
  });

  it("posts to Google's documented methods, not an invented one", () => {
    expect(urls.some((u) => u.endsWith(":decodeIntegrityToken")),
      "the token decode call moved").toBe(true);
    expect(urls.some((u) => u.endsWith("/deviceRecall:write")),
      "the recall write is not on `v1/{packageName}/deviceRecall:write`").toBe(true);
    expect(urls.some((u) => u.includes(":writeDeviceRecall")),
      "the old invented endpoint is back — it answers 404").toBe(false);
  });

  it("sends the request field Google's schema names", () => {
    expect(src, "the recall write stopped sending `newValues`")
      .toMatch(/data:\s*\{\s*integrityToken,\s*newValues:/);
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

// The Play Integrity request check (D342). Neither arm is reachable from
// the emulator — decodeIntegrityToken is a live Google call — so this is
// the only place either is exercised before a real handset runs it.
//
// The nonce arm exists because DEVICE-BIND.md's paste-ready Android
// snippet never set one, and IntegrityTokenRequest refuses to build
// without a nonce. Had that snippet been pasted it would have failed on
// every device, indistinguishably from the missing bridge it was meant to
// end. So the bridge now sends one and the server REQUIRES it: a payload
// carrying no nonce did not come from this app's bridge.
describe("requestDetailsProblem", () => {
  const PKG = "com.cosaxo.insight";

  it("passes a payload from this app carrying the nonce we sent", () => {
    expect(requestDetailsProblem({ requestPackageName: PKG, nonce: "n1" }, PKG, "n1")).toBeNull();
  });

  it("refuses a token minted for a different app", () => {
    expect(requestDetailsProblem({ requestPackageName: "com.evil.app", nonce: "n1" }, PKG, "n1"))
      .toBe("token is for a different app");
    // Absent is not "matches" — an undefined package must not read as ours.
    expect(requestDetailsProblem({ nonce: "n1" }, PKG, "n1")).toBe("token is for a different app");
    expect(requestDetailsProblem(undefined, PKG, "n1")).toBe("token is for a different app");
  });

  it("refuses when the caller sent no nonce at all", () => {
    // FAIL CLOSED. Accepting this would let a caller skip the check simply
    // by omitting the field, which is the shape of decorative security
    // this area has already shipped once.
    expect(requestDetailsProblem({ requestPackageName: PKG, nonce: "n1" }, PKG, undefined))
      .toBe("missing integrity nonce");
    expect(requestDetailsProblem({ requestPackageName: PKG, nonce: "n1" }, PKG, ""))
      .toBe("missing integrity nonce");
  });

  it("refuses when the signed nonce is not the one we sent", () => {
    expect(requestDetailsProblem({ requestPackageName: PKG, nonce: "other" }, PKG, "n1"))
      .toBe("integrity nonce does not match");
    // A payload with no nonce and a caller-supplied one: the token was not
    // minted for this request, whatever else it says.
    expect(requestDetailsProblem({ requestPackageName: PKG }, PKG, "n1"))
      .toBe("integrity nonce does not match");
  });

  it("checks the package BEFORE the nonce", () => {
    // Order matters for the log line: "different app" is the more specific
    // and more alarming finding, and a foreign token will usually also
    // carry a foreign nonce.
    expect(requestDetailsProblem({ requestPackageName: "com.evil.app" }, PKG, undefined))
      .toBe("token is for a different app");
  });
});

describe("regradeWith — the claim that decides whether a vote counts", () => {
  // Nothing reached this. Both invariants in its docblock inverted with the
  // whole functions suite green, and the e2e calls the callable once on a
  // fresh account and asserts only that it returned ok.
  const fakeAuth = (claims: Record<string, unknown> | undefined, providers: string[]) => {
    const written: Array<Record<string, unknown>> = [];
    return {
      written,
      auth: {
        getUser: async () => ({
          customClaims: claims,
          providerData: providers.map((providerId) => ({ providerId })),
        }),
        setCustomUserClaims: async (_uid: string, c: Record<string, unknown>) => {
          written.push(c);
        },
      } as RegradeAuth,
    };
  };

  it("NEVER LOWERS: a momentarily empty providerData does not demote", async () => {
    // The ratchet. Without it a transient read demotes someone, and a
    // demotion silently stops their votes counting with nothing on screen
    // to explain it.
    const { auth, written } = fakeAuth({ db: 2 }, []);
    expect(await regradeWith(auth, "u1", false)).toBe(2);
    expect(written, "a claim was rewritten when nothing rose").toEqual([]);
  });

  it("the cooldown re-grade still sees the device rung it already earned", async () => {
    // `deviceBound: deviceBoundNow || prior >= 1`. Drop the second half and
    // a re-grade that is not itself a device activation reads the account
    // as unbound, so level 2 becomes unreachable — the exact bug D343
    // records fixing.
    const { auth, written } = fakeAuth({ db: 1 }, ["google.com"]);
    expect(await regradeWith(auth, "u1", false)).toBe(2);
    expect(written).toHaveLength(1);
    expect(written[0].db).toBe(2);
  });

  it("keeps claims it did not set — the write is a merge, not a replace", async () => {
    // setCustomUserClaims overwrites the whole map, so a claim added
    // elsewhere has to survive an activation re-run.
    const { auth, written } = fakeAuth({ db: 0, admin: true }, ["google.com"]);
    await regradeWith(auth, "u1", true);
    expect(written[0], "a sibling claim was dropped by the re-grade")
      .toEqual({ db: 2, admin: true });
  });

  it("reads a non-integer claim as no claim at all", async () => {
    // firestore.rules compares with `>=`, which errors on a string or a
    // boolean and denies — so coercing here would read `db: true` as
    // level 1 and hand out a rung nobody earned.
    for (const bad of [true, "2", 1.5, null, undefined]) {
      const { auth } = fakeAuth({ db: bad } as Record<string, unknown>, []);
      expect(await regradeWith(auth, "u1", false), `db: ${String(bad)} was read as a level`)
        .toBe(0);
    }
  });

  it("writes nothing when there is nothing to raise", async () => {
    const { auth, written } = fakeAuth({ db: 0 }, []);
    expect(await regradeWith(auth, "u1", false)).toBe(0);
    expect(written).toEqual([]);
  });
});
