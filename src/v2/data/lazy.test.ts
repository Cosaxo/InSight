import { describe, expect, it } from "vitest";
import { retryable } from "./lazy";

// The bug this file pins: `if (!p) p = load()` caches a REJECTED promise
// exactly as it caches a resolved one, so one failed chunk fetch removed the
// World feed and five overlays for the rest of the session. Every case below
// was mutation-checked against the old shape rather than assumed: reverting
// lazy.ts to a plain `if (!inflight) inflight = load()` fails the last three
// cases and passes the first two. A test that only covered the success path
// would have passed on the bug — which is exactly how it shipped.
describe("retryable", () => {
  it("calls the loader once and reuses the result", async () => {
    let calls = 0;
    const load = retryable(async () => {
      calls++;
      return "chunk";
    });

    expect(await load()).toBe("chunk");
    expect(await load()).toBe("chunk");
    expect(await load()).toBe("chunk");
    expect(calls).toBe(1);
  });

  it("shares one in-flight promise with concurrent callers", async () => {
    let calls = 0;
    let release: (v: string) => void = () => {};
    const load = retryable(() => {
      calls++;
      return new Promise<string>((resolve) => {
        release = resolve;
      });
    });

    const a = load();
    const b = load();
    // Same promise object, not merely the same value: this is what stops one
    // deferred group from becoming two parallel downloads.
    expect(a).toBe(b);
    expect(calls).toBe(1);

    release("chunk");
    expect(await a).toBe("chunk");
    expect(await b).toBe("chunk");
    expect(calls).toBe(1);
  });

  it("retries after a failure instead of replaying it", async () => {
    let calls = 0;
    const load = retryable(async () => {
      calls++;
      throw new Error("chunk fetch failed #" + calls);
    });

    await expect(load()).rejects.toThrow("chunk fetch failed #1");
    // The old shape returned the SAME rejection here, forever.
    await expect(load()).rejects.toThrow("chunk fetch failed #2");
    await expect(load()).rejects.toThrow("chunk fetch failed #3");
    expect(calls).toBe(3);
  });

  it("caches the success that follows a failure", async () => {
    let calls = 0;
    const load = retryable(async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return "chunk";
    });

    await expect(load()).rejects.toThrow("offline");
    expect(await load()).toBe("chunk");
    expect(await load()).toBe("chunk");
    // 2, not 3: recovery must not cost a fetch on every later call.
    expect(calls).toBe(2);
  });

  it("clears the slot before rethrowing, so a synchronous retry works", async () => {
    let calls = 0;
    const load = retryable(async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return "chunk";
    });

    // The shape app-shell's openers have: catch, then immediately ask again.
    // A `finally`-based clear would still be pending at this point.
    const result = await load().catch(() => load());
    expect(result).toBe("chunk");
    expect(calls).toBe(2);
  });
});
