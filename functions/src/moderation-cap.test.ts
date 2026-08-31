// The per-author cap on the moderation queue, executed.
//
// WHY THIS FILE EXISTS. `MOD_QUEUE_PER_AUTHOR` is the only thing stopping
// one account owning the queue, and its own comment states the threat it
// closes: without it "three accounts and 75 flags could occupy the entire
// queue with 25 takes by one author, and every honest report below the
// floor of that block waited a generation behind it."
//
// It ran under nothing. Every other queue-shaping predicate —
// tallyFlagsInto, tallyFirstFlagInto, buildModQueueFrom, carriedEscalations
// — lives in pure.ts, is exported, and is pinned in pure.test.ts. This one
// sat inline in moderation.ts, unexported, reachable only from inside
// runBuildModQueue. Raising the cap by five left all 536 tests green, and
// the moderation e2e never posts a sixth take from one author, so the
// number could be off by any amount or inverted with every gate green.
//
// Exported for this, and nothing else changed.
import { describe, it, expect } from "vitest";
import { MOD_QUEUE_PER_AUTHOR, overAuthorCap } from "./moderation";

describe("overAuthorCap", () => {
  it("admits up to the cap and holds back the one after", () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < MOD_QUEUE_PER_AUTHOR; i++) {
      expect(overAuthorCap(seen, "u_loud"), `entry ${i + 1} was held back`).toBe(false);
    }
    expect(overAuthorCap(seen, "u_loud"), "the entry past the cap was admitted").toBe(true);
    // …and it stays capped rather than resetting on the next ask.
    expect(overAuthorCap(seen, "u_loud")).toBe(true);
  });

  it("counts each author separately", () => {
    // The half that matters as much: a cap that counted globally would
    // also satisfy the case above, and would throttle an honest queue.
    const seen = new Map<string, number>();
    for (let i = 0; i < MOD_QUEUE_PER_AUTHOR; i++) overAuthorCap(seen, "u_loud");
    expect(overAuthorCap(seen, "u_quiet"), "one loud author capped everyone else").toBe(false);
  });

  it("never caps an unknown author", () => {
    // Its own rule: refusing to queue a take because its author cannot be
    // read would hide content from moderation on a technicality. A take
    // written before authorUid was required, or a malformed doc.
    const seen = new Map<string, number>();
    for (const bad of [undefined, null, "", 7, {}]) {
      for (let i = 0; i < MOD_QUEUE_PER_AUTHOR + 2; i++) {
        expect(overAuthorCap(seen, bad), `${String(bad)} was capped`).toBe(false);
      }
    }
  });

  it("caps an author named `constructor` like any other", () => {
    // The reason the tally is a Map. On an object literal `seen.constructor`
    // reads back as the Object constructor — truthy, and `>= 5` against a
    // function is false, so that one account would have been exempt from
    // its own cap. Uids are Firebase-minted so this is belt-and-braces,
    // but an assertion is what keeps it a Map through the next refactor.
    const seen = new Map<string, number>();
    for (let i = 0; i < MOD_QUEUE_PER_AUTHOR; i++) {
      expect(overAuthorCap(seen, "constructor")).toBe(false);
    }
    expect(overAuthorCap(seen, "constructor"), "`constructor` walked past its own cap").toBe(true);
  });
});
