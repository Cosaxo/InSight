// The client half of the presence-grid contract (D84). The vectors are
// duplicated verbatim in functions/src/pure.test.ts — the drift pattern
// floor.ts uses, because the two sides disagreeing about cell shape fails
// soft: an empty count that reads as "nobody nearby".

import { describe, expect, it } from "vitest";
import { presenceCell, PRESENCE_CELL_RE } from "./geo";

describe("presenceCell", () => {
  it("maps known places onto the shared vectors", () => {
    expect(presenceCell(59.9139, 10.7522)).toBe("5991_1075");   // Oslo centre
    expect(presenceCell(59.999, 10.749)).toBe("5999_1074");     // the pure-test cell
    expect(presenceCell(-33.7301, 151.2172)).toBe("-3374_15121"); // Sydney-ish
    expect(presenceCell(0, 0)).toBe("0_0");
    expect(presenceCell(89.999, -180)).toBe("8999_-18000");
  });

  it("negative coordinates floor toward the pole, not toward zero", () => {
    // Math.floor, not truncation: -33.7301 / 0.01 = -3373.01 floors to
    // -3374. Truncating would put a southern-hemisphere user one cell
    // north of where they stand — and the server's regex would still
    // accept it, so only this test catches it.
    expect(presenceCell(-0.001, -0.001)).toBe("-1_-1");
  });

  it("refuses garbage instead of minting a cell for it", () => {
    expect(presenceCell(NaN, 10)).toBeNull();
    expect(presenceCell(91, 0)).toBeNull();
    expect(presenceCell(0, 181)).toBeNull();
  });

  it("every cell it mints passes the server's own regex", () => {
    for (const [la, lo] of [[59.91, 10.75], [-33.73, 151.21], [89.99, 179.99], [-89.99, -180]]) {
      expect(presenceCell(la, lo)).toMatch(PRESENCE_CELL_RE);
    }
  });
});
