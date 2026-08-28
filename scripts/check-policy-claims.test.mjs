// The gate has to FAIL when a promise is deleted, or it is decoration.
//
// This is the same case scripts/check-public-copy.test.mjs makes for its
// own checker, and it matters more here: check-policy-claims is the ONLY
// thing standing behind the disclosures D183 took out of the account
// panel. A checker that silently matches nothing would leave the tree
// looking guarded while the promises quietly went.
//
// So the properties are: it passes on the page as it stands, and it names
// the right claim when that claim is cut out of a copy of the page.
import { describe, expect, it } from "vitest";
import { CLAIMS, missingClaims, readPage } from "./check-policy-claims.mjs";

const page = readPage();

describe("check-policy-claims", () => {
  it("passes on the page in the tree", () => {
    expect(missingClaims(page)).toEqual([]);
  });

  it("has a claim for each of the decisions that produced one", () => {
    // Not a count — a count would be a figure to maintain (D39). What is
    // asserted is that the four disclosures with a decision behind them
    // are each represented, by the label a failure would print.
    const labels = CLAIMS.map(([l]) => l).join("\n");
    for (const d of ["D9", "D84", "D98", "D146", "D174", "D175", "D177", "D178", "D330"]) {
      expect(labels, `no claim traces to ${d}`).toMatch(new RegExp(`\\b${d}\\b`));
    }
  });

  // The real property. Each claim is deleted from a COPY of the page in
  // turn, and the checker has to notice exactly that one — which also
  // proves no two patterns are secretly the same pattern.
  it.each(CLAIMS.map(([label, test]) => [label, test]))(
    "notices when %s is cut out", (label, test) => {
      // Two shapes of claim: a regex whose match is the sentence (cut the
      // match), and a predicate asserting an ABSENCE (put the retired
      // wording back). Both have to fail closed.
      const broken = typeof test === "function"
        ? page + "\n<p>kilometre-sized</p>\n"
        : page.replace(test, "");
      expect(broken, `deleting "${label}" changed nothing — the pattern matches no text`)
        .not.toBe(page);
      expect(missingClaims(broken)).toContain(label);
    });

  // Commenting a disclosure out deletes it from the page as surely as
  // cutting it: the reader sees nothing either way. This ran over the raw
  // bytes and read a commented claim as present, which is the one failure
  // this gate exists to prevent — a live promise vanishing from the only
  // place D183 leaves it.
  it.each(CLAIMS.filter(([, t]) => typeof t !== "function").map(([label, t]) => [label, t]))(
    "notices when %s is commented out rather than cut", (label, test) => {
      const commented = page.replace(test, (m) => `<!-- ${m} -->`);
      expect(commented, `commenting "${label}" changed nothing`).not.toBe(page);
      expect(missingClaims(commented)).toContain(label);
    });

  it("passes a page that only reWORDS a claim around its load-bearing token", () => {
    // The patterns are meant to be loose about prose and strict about the
    // number, the duration and the name — so an editor may improve a
    // sentence without tripping the gate, and may not drop the token a
    // reader is actually owed.
    const reworded = page.replace(
      "It keeps counting for up to three hours after you close the app, and",
      "It carries on for as long as three hours after you close the app, and");
    expect(reworded, "the sentence this case rewords is gone").not.toBe(page);
    expect(missingClaims(reworded)).toEqual([]);
  });
});
