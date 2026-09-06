/**
 * THE LINGER IS TWO NUMBERS IN TWO LANGUAGES, AND NOTHING HELD THEM EQUAL.
 *
 * `firestore.rules:1816` says it plainly — "180 minutes is
 * PRESENCE_LINGER_MIN (functions/src/pure.ts). The two are hand-matched:
 * rules cannot import, so if that constant moves, this literal moves in
 * the same commit." `v2social.ts` said the same from the other side, and
 * tried to do something about it: a bare `void PRESENCE_LINGER_MIN;` under
 * a comment claiming "the constant is imported here to keep the two
 * definitions in one place". It kept nothing. The statement is a no-op,
 * the import was already used two functions up in `presenceExpiry`, and
 * moving the constant to 30 left all 588 functions tests and all 756
 * script tests green.
 *
 * What that costs is D174's promise about how long a position stands in a
 * room. If the constant moves alone, the rules keep admitting a
 * 180-minute `until` while `presenceExpiry` retires a legacy document
 * without one at the new number — the two disagreeing about presence, on
 * the one collection whose read deny exists for physical safety rather
 * than for privacy.
 *
 * `paid.test.ts` has the pattern: read the other language's file and hold
 * the two against each other, with a guard that fails loudly when the
 * regex stops finding its own target rather than passing on an empty
 * match.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PRESENCE_LINGER_MIN } from "./pure";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rules = readFileSync(resolve(root, "firestore.rules"), "utf8");

describe("the presence linger, in both languages", () => {
  // The `until` ceiling on the v2_presence write arm, and nothing else:
  // there are eleven `duration.value` calls in the file and ten of them
  // are other collections' windows.
  const arm = (() => {
    const block = /match \/v2_presence\/\{uid\} \{([\s\S]*?)\n {4}\}/.exec(rules);
    expect(block, "could not find the v2_presence block in firestore.rules").toBeTruthy();
    return block![1];
  })();

  it("caps `until` at the linger the functions use", () => {
    const m = /data\.until <= request\.time \+ duration\.value\((\d+), 'm'\)/.exec(arm);
    expect(m, "could not find the `until` ceiling on the v2_presence write arm").toBeTruthy();
    expect(Number(m![1])).toBe(PRESENCE_LINGER_MIN);
  });

  it("and the arm really is the presence one, not an empty match", () => {
    // Without this, a rename of the block would leave `arm` empty, the
    // regex above would find nothing, and the failure would read as "the
    // rules dropped the ceiling" instead of "this test lost its target".
    expect(arm).toContain("allow read: if false");
    expect(arm).toContain('"cell"');
    expect(arm.split("duration.value").length - 1, "the presence arm should hold exactly one duration ceiling").toBe(1);
  });

  it("states the linger in minutes, so the two units cannot drift apart", () => {
    // `presenceExpiry` multiplies by 60_000; the rules say `'m'`. A unit
    // change on either side is a silent factor of sixty.
    expect(/duration\.value\(\d+, 'm'\)/.test(arm)).toBe(true);
    const src = readFileSync(resolve(root, "functions/src/v2social.ts"), "utf8");
    expect(src).toContain("PRESENCE_LINGER_MIN * 60_000");
  });
});

/**
 * THE SESSION PAIR IS GONE, AND THIS PINS THAT IT STAYS GONE.
 *
 * Until D370 the near session was the same pair one shelf up, and it was
 * worse: `PRESENCE_SESSION_MIN` (pure.ts) had no reader anywhere in the
 * tree, and what actually governed D174's "visible for a while" was
 * `NEAR_SESSION_MS` in the client, which said twice that it mirrored the
 * server constant while nothing held them equal — 120 → 1 on the server
 * left every suite green. The case that stood here held the two numbers
 * together across the two languages.
 *
 * D370 made Near a switch: off or on, no timed session at all, on the
 * owner's "near should only have off and on". So there is no session
 * length on either side to hold equal, and the pin inverts — a session
 * constant reappearing on ONE side is exactly the unmatched pair coming
 * back, which is what this file exists to notice.
 */
describe("the near session is retired on both sides (D370)", () => {
  const near = readFileSync(resolve(root, "src/v2/data/near.ts"), "utf8");
  const pure = readFileSync(resolve(root, "functions/src/pure.ts"), "utf8");

  it("the client carries no session length and cites no server constant for one", () => {
    expect(/export const NEAR_SESSION_MS\b/.test(near), "NEAR_SESSION_MS came back to near.ts without its server twin").toBe(false);
    expect(near).not.toContain("PRESENCE_SESSION_MIN");
    // and the switch is what stands in its place
    expect(near).toMatch(/nearOptedIn|setNearOn/);
  });

  it("the server exports no session constant either, and says where it went", () => {
    expect(/export const PRESENCE_SESSION_MIN\b/.test(pure), "PRESENCE_SESSION_MIN came back to pure.ts with no reader").toBe(false);
    expect(pure).toMatch(/PRESENCE_SESSION_MIN = 120` stood here from D174 to D370/);
  });
});
