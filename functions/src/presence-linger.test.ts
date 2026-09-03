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
