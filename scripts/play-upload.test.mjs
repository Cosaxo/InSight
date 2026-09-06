// play-upload.test.mjs — pins the parts of the Play upload that fail silently.
//
// The network half needs a Play account this project does not have, so it
// is not mocked: a mock of an API nobody has called would assert this
// file's own assumptions back at it and prove nothing. What IS tested is
// every value that produces an opaque error when wrong — Google rejects a
// malformed assertion with "invalid_grant" and names no field, and a bad
// track body is a 400 with a message about a oneof.
import { describe, it, expect } from "vitest";
import { jwtClaims, trackBody, parseArgs, b64url, TRACKS, PACKAGE } from "./play-upload.mjs";

describe("jwtClaims", () => {
  const c = jwtClaims("bot@project.iam.gserviceaccount.com", 1_700_000_000);

  it("names the token endpoint as the audience, not the API", () => {
    // A very easy mistake: the assertion is exchanged AT oauth2, for a
    // token used against androidpublisher. aud is the former.
    expect(c.aud).toBe("https://oauth2.googleapis.com/token");
  });

  it("asks for the androidpublisher scope", () => {
    expect(c.scope).toBe("https://www.googleapis.com/auth/androidpublisher");
  });

  it("expires in exactly one hour — Google's maximum", () => {
    expect(c.exp - c.iat).toBe(3600);
  });

  it("issues as the service account", () => {
    expect(c.iss).toBe("bot@project.iam.gserviceaccount.com");
  });
});

describe("b64url", () => {
  it("is URL-safe and unpadded, which a JWT requires", () => {
    // Bytes chosen to force both substitutions and padding.
    const out = b64url(Buffer.from([0xfb, 0xff, 0xfe, 0x00]));
    expect(out).not.toMatch(/[+/=]/);
    expect(b64url("a")).toBe("YQ");
  });
});

describe("trackBody", () => {
  it("sends the versionCode as a string, which the API requires", () => {
    // int64 fields are strings in Google's JSON mapping; a number here is
    // accepted by JSON.stringify and rejected by Play.
    expect(trackBody(29).releases[0].versionCodes).toEqual(["29"]);
  });

  it("marks the release completed rather than draft", () => {
    expect(trackBody(29).releases[0].status).toBe("completed");
  });

  it("omits the name entirely when none is given", () => {
    expect(trackBody(29).releases[0]).not.toHaveProperty("name");
    expect(trackBody(29, "2.0.0 (29)").releases[0].name).toBe("2.0.0 (29)");
  });
});

describe("parseArgs", () => {
  it("defaults to the internal track, never production", () => {
    expect(parseArgs(["--aab", "a.aab"]).track).toBe("internal");
  });

  it("accepts every track Play defines", () => {
    for (const t of TRACKS) {
      expect(parseArgs(["--aab", "a.aab", "--track", t]).track).toBe(t);
    }
  });

  it("refuses an unknown track rather than passing it through", () => {
    // Play answers a bad track with a 404 on the edit, which reads as a
    // permissions problem. Failing here names the actual mistake.
    expect(() => parseArgs(["--aab", "a.aab", "--track", "prod"])).toThrow(/unknown track/);
  });

  it("requires the bundle path", () => {
    expect(() => parseArgs(["--track", "internal"])).toThrow(/--aab/);
  });
});

describe("PACKAGE", () => {
  it("matches the applicationId the shell builds", () => {
    expect(PACKAGE).toBe("com.cosaxo.insight");
  });
});
