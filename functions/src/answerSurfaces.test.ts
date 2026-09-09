// The server's copy of the world-answer surface list is held EQUAL to the
// client's, across the package boundary (D442).
//
// D197 is this repo's record of what a copy costs: one bank parser in
// three copies, and the copy with a try/catch reported an invented wire
// size instead of failing. This list has to exist twice — `functions/`
// cannot import `src/`, and the two packages do not share a build — so
// the copy is read off the client's own source the way engagement.test.ts
// reads its batch sites off engagement.ts: a change to either array fails
// here naming the other. The client's voters.test.ts pins ITS list against
// the value test in firestore.rules, so the three agree transitively.
//
// WHY THE CLIENT'S FILE AND NOT THE RULES: the seed's promise is that a
// seeded sample is the who-voted sheet's list — the same query the client
// runs — and the sheet's query is built from the client's array. The
// rules are what would refuse a drifted CLIENT list wholesale; nothing
// refuses a drifted server list, because the admin SDK walks past them,
// which is why this pin exists at all.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WORLD_ANSWER_SURFACES } from "./answerSurfaces";

const here = dirname(fileURLToPath(import.meta.url));

describe("WORLD_ANSWER_SURFACES, the server's copy", () => {
  it("equals the client's list in src/v2/data/voters.ts, read across the boundary", () => {
    const src = readFileSync(resolve(here, "../../src/v2/data/voters.ts"), "utf8");
    const m = /export const WORLD_ANSWER_SURFACES = \[([^\]]*)\] as const/.exec(src);
    expect(m, "the client's WORLD_ANSWER_SURFACES moved or changed shape — this pin is vacuous").not.toBeNull();
    const fromClient = m![1].split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean);
    expect(
      [...WORLD_ANSWER_SURFACES],
      "the server's surface list drifted from the client's: the seed would fill a sample "
      + "with a different crowd than the who-voted sheet shows, and nothing refuses it — "
      + "the admin SDK walks past the rules. Move both, and firestore.rules with them.",
    ).toEqual(fromClient);
  });

  it("never names a duel surface — those are sealed until the reveal", () => {
    expect(WORLD_ANSWER_SURFACES).not.toContain("group");
    expect(WORLD_ANSWER_SURFACES).not.toContain("duo");
  });
});
