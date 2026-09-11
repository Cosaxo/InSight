// pending-mirror.test.ts — every optimistic answer write marks the
// mirror, or is exempt in writing.
//
// D357's closing rule is a sentence about the FUTURE: "If a surface ever
// writes an answer outside the five paths above, it marks and clears the
// mirror the same way, or its offline answer is the pre-D357 answer."
// Nothing enforced it, and two surfaces were already outside — `voteDuel`
// and `voteLate`, written before the mirror existed and never brought in.
//
// What that costs is the worst version of the failure D357 was written
// for. An answer written offline lives in the SDK's persisted queue and
// in this process's memory; a relaunch has the queue and not the memory.
// `roundsOf` gates whether a duel round is offered on `state.votes[aid]`
// alone, so the round comes back, the queue flushes the first create, and
// the second tap is a full overwrite of an existing duel answer — which
// D86 does not admit. The room is sealed with an option the person has
// just been told did not save.
//
// A SOURCE SCAN rather than a boot, deliberately. The behavioural half
// needs a seeded group, a duel bank and an open round, and it would pin
// the two functions that were wrong today. This pins the RULE, which is
// what the decision actually wrote down — and it is the only shape that
// catches the third surface, which does not exist yet.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = readFileSync(join(root, "src/v2/data/live.ts"), "utf8");

/** Every write of an answer document, by the line it is on. */
const WRITE_RE = /(?:setDoc|updateDoc)\(\s*doc\(db,\s*"v2_users",\s*uid,\s*"answers"/g;

/** The enclosing member's name for a line — the store is one object
 *  literal, so a member is `\n  name(` at two spaces of indent. */
function memberAt(lines: readonly string[], idx: number): string {
  for (let i = idx; i >= 0; i--) {
    const m = /^ {2}(?:async )?([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
    if (m) return m[1];
  }
  return "(top level)";
}

/** Written exemptions, each with the reason the decision gives. A new
 *  entry here is a claim about a surface, not a way past the rule. */
const EXEMPT: Record<string, string> = {
  // D357 names this one explicitly: a learn answer is not offered by the
  // deck, so a relaunch cannot re-offer it.
  learnAnswer: "D357 excludes it in writing — the deck never re-offers a learn card",
};

describe("D357's closing rule", () => {
  const lines = SRC.split("\n");
  const sites: { line: number; member: string }[] = [];
  lines.forEach((l, i) => {
    WRITE_RE.lastIndex = 0;
    if (WRITE_RE.test(l)) sites.push({ line: i + 1, member: memberAt(lines, i) });
  });

  it("finds the answer writes — vacuous otherwise", () => {
    // The floor. A renamed collection or a reshaped call would make every
    // assertion below pass over an empty list, which is the failure this
    // whole file is about, pointed at itself.
    expect(sites.length, "no answer write found — the scan stopped matching").toBeGreaterThan(5);
    expect(sites.map((s) => s.member)).toContain("vote");
  });

  it("every one of them marks the mirror, or is exempt with a reason", () => {
    // The member's whole body, from its own line to the next member.
    const starts = lines
      .map((l, i) => (/^ {2}(?:async )?[A-Za-z_$][\w$]*\s*\(/.test(l) ? i : -1))
      .filter((i) => i >= 0);
    const bodyOf = (line: number): string => {
      const at = starts.filter((i) => i < line).pop() ?? 0;
      const end = starts.find((i) => i >= line) ?? lines.length;
      return lines.slice(at, end).join("\n");
    };
    const offenders: string[] = [];
    for (const { line, member } of sites) {
      if (member in EXEMPT) continue;
      const body = bodyOf(line);
      if (!/markPending\(/.test(body)) offenders.push(`${member} (live.ts:${line}) never marks`);
      // …and the other half of the same rule, as TWO conditions rather
      // than one. D357 says "marks and clears the mirror" about the ack
      // AND the refusal, and an OR of the two accepted either alone: a
      // member that only rolled back passed while every acked answer
      // stayed marked for the next boot to re-offer, and a member that
      // only cleared passed while every refused one did. Both halves
      // exist on all six paths today; this is what keeps the seventh
      // from shipping with one.
      else {
        if (!/clearPending\(/.test(body)) offenders.push(`${member} (live.ts:${line}) marks and never clears on the ack`);
        if (!/rollbackPending\(/.test(body)) offenders.push(`${member} (live.ts:${line}) marks and never undoes a refusal`);
      }
    }
    expect(offenders, "an answer write outside the mirror — D357's closing rule").toEqual([]);
  });

  it("the exemptions are named surfaces that still exist", () => {
    // A stale exemption is how a rule quietly stops covering something.
    for (const [name, why] of Object.entries(EXEMPT)) {
      expect(sites.some((s) => s.member === name), `${name} is exempt but writes no answer — stale entry`).toBe(true);
      expect(why.length, `${name}'s exemption carries no reason`).toBeGreaterThan(20);
    }
  });
});
