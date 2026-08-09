// floor.ts is the client's copy of the server's disclosure constants, and
// a copy is a drift waiting to happen — this suite is the thing that makes
// it safe to have one. Regex against the source rather than an import,
// because functions/ is a different tsconfig project and pulling its build
// into this one is the coupling both trees refuse.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGG_FLOOR, AGG_PUBLISH_EVERY } from "./floor";

const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("the client floor equals the server floor", () => {
  it("AGG_FLOOR equals AGG_MIN_N in functions/src/v2.ts", () => {
    const server = read("functions/src/v2.ts").match(/export const AGG_MIN_N = (\d+)/);
    // If the regex stops matching, the constant was renamed or turned into
    // an expression and this check silently became vacuous — fail on that.
    expect(server, "AGG_MIN_N literal not found in functions/src/v2.ts").not.toBeNull();
    expect(AGG_FLOOR).toBe(Number(server![1]));
  });

  it("AGG_PUBLISH_EVERY equals PUBLISH_EVERY in functions/src/v2.ts", () => {
    const server = read("functions/src/v2.ts").match(/export const PUBLISH_EVERY = (\d+)/);
    expect(server, "PUBLISH_EVERY literal not found in functions/src/v2.ts").not.toBeNull();
    expect(AGG_PUBLISH_EVERY).toBe(Number(server![1]));
  });

  it("moves the pair together: paused (1,1) or restored (5,5)", () => {
    // Same coupling the server suite pins (pure.test.ts) — asserted on this
    // side too so a half-reverted client fails locally without booting the
    // functions project.
    expect([AGG_FLOOR, AGG_PUBLISH_EVERY]).toEqual(AGG_FLOOR === 1 ? [1, 1] : [5, 5]);
  });
});
