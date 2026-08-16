// The profile photo's pure half (D177).
//
// The upload itself needs a browser and a bucket; what is testable without
// either is the part that carries the safety argument — the URL is BUILT
// from a token, so a stored field can never name a host we do not control.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { avatarPath, avatarUrl, tokenFromUrl } from "./avatar";

// The bucket is build config, so a test run has none. Stubbed rather than
// injected: reading it at call time is what lets a single build serve the
// emulator and production, and a parameter would only move the question.
beforeAll(() => { vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "b.appspot.com"); });
afterAll(() => { vi.unstubAllEnvs(); });

describe("avatarPath", () => {
  it("is one object per account, with no filename", () => {
    // The whole bound. `storage.rules`'s retired path records what a free
    // filename cost: unbounded objects and unbounded egress from an app
    // where an account is free. A fixed id makes a second upload an
    // overwrite instead of a new object.
    expect(avatarPath("u_abc")).toBe("avatars/u_abc");
  });
});

describe("avatarUrl", () => {
  it("builds the object's own URL from bucket and token", () => {
    const url = avatarUrl("u_abc", "tok-123");
    expect(url).toContain("/o/avatars%2Fu_abc?");
    expect(url).toContain("alt=media");
    expect(url).toContain("token=tok-123");
    expect(url.startsWith("https://firebasestorage.googleapis.com/")).toBe(true);
  });

  it("cannot be talked into pointing somewhere else", () => {
    // THE POINT OF STORING A TOKEN. A URL field could name an attacker's
    // host — every viewer's IP goes to it, and the image can change after
    // somebody reported it, which defeats the whole report loop. Here the
    // host and the path are ours by construction and the stored value is
    // only ever a query parameter. `firestore.rules` refuses a token with
    // a dot, colon or slash in it; this is the other end of that.
    const url = avatarUrl("u_abc", "https://evil.example/x.png");
    expect(url.startsWith("https://firebasestorage.googleapis.com/")).toBe(true);
    expect(url).toContain("/o/avatars%2Fu_abc?");
    // Escaped into the query, not spliced into the path.
    expect(url).not.toContain("//evil.example");
  });

  it("says nothing rather than half a URL when a piece is missing", () => {
    // Callers render initials on "", which is the permanent fallback. A
    // truthy broken URL would draw a broken image instead.
    expect(avatarUrl("u_abc", "")).toBe("");
    expect(avatarUrl("", "tok")).toBe("");
    // Including a build with no bucket at all — a demo build, or a
    // misconfigured one. Initials, not a broken image on every face.
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "");
    expect(avatarUrl("u_abc", "tok")).toBe("");
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "b.appspot.com");
  });
});

describe("tokenFromUrl", () => {
  it("lifts the token out of what getDownloadURL returns", () => {
    expect(tokenFromUrl(
      "https://firebasestorage.googleapis.com/v0/b/b.appspot.com/o/avatars%2Fu?alt=media&token=abc-123",
    )).toBe("abc-123");
    // Order is not promised by anything, so it is not assumed.
    expect(tokenFromUrl("https://x/y?token=zzz&alt=media")).toBe("zzz");
  });

  it("returns nothing for a URL that carries no token", () => {
    // Which the caller treats as a failed upload rather than writing an
    // empty token the rules would refuse anyway.
    expect(tokenFromUrl("https://x/y?alt=media")).toBe("");
    expect(tokenFromUrl("")).toBe("");
  });
});
