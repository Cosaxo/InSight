// check-store-forms.test.mjs — pins rule 6's parser.
//
// Rule 6 compares two copies of Play's Data Safety form. Everything it can
// catch depends on `playRows` actually finding rows: a parser that matches
// nothing hands the comparison an empty list, every row agrees with
// nothing, and the gate is green. That is not a hypothetical failure mode
// in this repo — it is D179, D197 and D275, three times, always in a script
// whose job was to check something, so nothing else went red.
//
// The transposed-row case below is the one this gate was written for. §3's
// Precise location row carried its cells under the wrong headers from D175
// until 2026-09-01, and rules 1-5 were green through all of it because the
// Play half of that file had no machine-readable twin to disagree with.
import { describe, it, expect } from "vitest";
import { playRows, playCell } from "./check-store-forms.mjs";

const TABLE = `
## 3 · Play Data Safety — [PARKED — D42]

Some prose the parser must skip.

| Play category | Collected | Shared | Optional? | Purpose |
| --- | --- | --- | --- | --- |
| Personal info → User IDs | Yes | No | Required | App functionality |
| Personal info → Email address | Yes | No | Optional (Google linking only) | App functionality |
| Location → Precise location | **Yes** (D175) | No | **Optional** | App functionality |
| App activity | **No** | — | — | — |

Trailing prose.

## 4 · Something else

| Play category | Collected | Shared | Optional? | Purpose |
| --- | --- | --- | --- | --- |
| Not mine → do not read | Yes | No | Required | App functionality |
`;

describe("playCell", () => {
  it("takes the answer and drops the note a human reads", () => {
    expect(playCell("**Yes** (D175)")).toBe("Yes");
    expect(playCell("Optional (Google linking only)")).toBe("Optional");
    expect(playCell('**Required** (on with no switch since D211 — "users can choose" no longer holds)'))
      .toBe("Required");
  });

  it("leaves a plain answer alone", () => {
    expect(playCell("App functionality")).toBe("App functionality");
    expect(playCell(" — ")).toBe("—");
  });
});

describe("playRows", () => {
  const rows = playRows(TABLE);

  it("reads every row of §3 and stops at the next section", () => {
    // Four rows, not five: the §4 table below it must not be swept in.
    expect(rows.map((r) => r.category)).toEqual([
      "Personal info → User IDs",
      "Personal info → Email address",
      "Location → Precise location",
      "App activity",
    ]);
  });

  it("skips the header and the separator by what they say, not by position", () => {
    expect(rows.some((r) => /^Play category$/i.test(r.category))).toBe(false);
    expect(rows.some((r) => /^-+$/.test(r.category))).toBe(false);
  });

  it("reads Collected and Shared as booleans", () => {
    expect(rows[0].collected).toBe(true);
    expect(rows[0].shared).toBe(false);
  });

  it("reads an em-dash cell as null rather than as an answer", () => {
    const notCollected = rows.find((r) => r.category === "App activity");
    expect(notCollected.collected).toBe(false);
    expect(notCollected.shared).toBeNull();
    expect(notCollected.optional).toBeNull();
    expect(notCollected.purpose).toBeNull();
  });

  it("strips bold and the parenthetical from a decorated cell", () => {
    const precise = rows.find((r) => r.category === "Location → Precise location");
    expect(precise.collected).toBe(true);
    expect(precise.optional).toBe("Optional");
    expect(precise.purpose).toBe("App functionality");
  });

  // THE REGRESSION. Written as the transposition actually shipped: a
  // purpose under Shared, a note under Optional, "No" under Purpose. The
  // parser must report the cells AS WRITTEN so the comparison can disagree
  // with the JSON — a parser that "helpfully" normalised this into the
  // right shape would hide the bug it exists to surface.
  it("reports a transposed row as written, so the comparison can catch it", () => {
    const transposed = playRows(`
## 3 · Play Data Safety

| Play category | Collected | Shared | Optional? | Purpose |
| --- | --- | --- | --- | --- |
| Location → Precise location | **Yes** (D175) | App Functionality | Not linked to identity beyond the account | No |
`);
    expect(transposed).toHaveLength(1);
    expect(transposed[0].shared).toBe(false); // "App Functionality" is not "Yes"
    expect(transposed[0].optional).toBe("Not linked to identity beyond the account");
    expect(transposed[0].purpose).toBe("No");
  });

  // The silent-failure guard. Rule 6 treats an empty result as an error
  // rather than as agreement; this pins that an absent section really does
  // return empty, so that branch is reachable.
  it("returns nothing when the section is missing, rather than reading the whole file", () => {
    expect(playRows("# Some other document\n\n| a | b | c | d | e |\n")).toEqual([]);
  });

  it("ignores a table whose column count is not five", () => {
    expect(playRows(`
## 3 · Play Data Safety

| Play category | Collected |
| --- | --- |
| Personal info → User IDs | Yes |
`)).toEqual([]);
  });
});
