// The parser is the security boundary of the invite link: whatever it
// returns gets prefilled into a join form, so it must accept exactly the
// server's code shape and nothing else — however the URL was mangled in
// transit by a chat app, a QR scanner, or a hostile hand.
import { describe, expect, it } from "vitest";
import { inviteLinkFor, parseJoinCode } from "./links";

describe("parseJoinCode", () => {
  it("round-trips the link the app itself shares", () => {
    expect(parseJoinCode(inviteLinkFor("ABCD2345"))).toBe("ABCD2345");
  });

  it("accepts the shapes a join URL arrives in", () => {
    expect(parseJoinCode("https://prvfire33.web.app/join/QRSTUVWX")).toBe("QRSTUVWX");
    expect(parseJoinCode("https://prvfire33.web.app/join.html?c=QRSTUVWX")).toBe("QRSTUVWX");
    expect(parseJoinCode("/join/QRSTUVWX")).toBe("QRSTUVWX"); // relative (web boot)
    expect(parseJoinCode("insight://join/QRSTUVWX")).toBe("QRSTUVWX"); // custom scheme
    expect(parseJoinCode("https://prvfire33.web.app/join/qrstuvwx")).toBe("QRSTUVWX"); // case-folded
    expect(parseJoinCode("https://prvfire33.web.app/join/QRSTUVWX?utm_source=x")).toBe("QRSTUVWX");
  });

  it("rejects everything that is not a code", () => {
    expect(parseJoinCode("https://prvfire33.web.app/")).toBeNull();
    expect(parseJoinCode("https://prvfire33.web.app/privacy.html")).toBeNull();
    expect(parseJoinCode("https://prvfire33.web.app/join/")).toBeNull();
    // charset: 0/O/1/I/L are never minted (CODE_ALPHABET)
    expect(parseJoinCode("https://prvfire33.web.app/join/ABCD01IL")).toBeNull();
    // length bounds
    expect(parseJoinCode("https://prvfire33.web.app/join/ABC")).toBeNull();
    expect(parseJoinCode("https://prvfire33.web.app/join/" + "A".repeat(13))).toBeNull();
    // injection-shaped garbage stays out of the form
    expect(parseJoinCode("https://prvfire33.web.app/join/%3Cscript%3E")).toBeNull();
    expect(parseJoinCode("not a url at all \u0000")).toBeNull();
  });
});

// ── the custom scheme is the route that needs no fingerprint (D238) ──
//
// It was parsed here long before either platform registered it, so these
// pin what web/join.html's one button now depends on. `insight://join/X`
// puts "join" in the HOSTNAME rather than the path, which is why the
// matcher runs over host+path — and is why the Android filter declares
// android:host="join" rather than a pathPrefix.
describe("parseJoinCode · the insight:// scheme", () => {
  it("reads the code out of the authority-plus-path form", () => {
    expect(parseJoinCode("insight://join/ABCD2345")).toBe("ABCD2345");
  });

  it("folds case, the way a typed or forwarded link arrives", () => {
    expect(parseJoinCode("insight://join/abcd2345")).toBe("ABCD2345");
  });

  it("refuses a scheme URL whose token is not a code", () => {
    // The alphabet excludes 0/O/1/I/L, so these are mistyped or hostile
    // rather than merely unknown — and a token the app would refuse is
    // better refused before it becomes a callable round trip.
    expect(parseJoinCode("insight://join/ABC0O1IL")).toBeNull();
    expect(parseJoinCode("insight://join/")).toBeNull();
    expect(parseJoinCode("insight://somethingelse/ABCD2345")).toBeNull();
  });
});
