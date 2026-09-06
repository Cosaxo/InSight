// source-pins.test.mjs — no gate may read past a comment.
//
// A gate that cross-reads a value out of another file does it with
// `readFileSync(...).match(/NAME = (\d+)/)`, and `.match` returns the FIRST
// hit. So a superseded value parked in a comment above the live
// declaration — house style in this tree, which explains its constants
// where they live — is what the gate compares against, and the run goes
// green while the thing it exists to catch is true.
//
// Four gates have been caught this way and every one was measured, not
// argued:
//   check-anchors, check-cities, account-level-lib, check-figures  (swept
//     2026-09-05: "a retuned value with its old line parked above it made
//     the gate report the SUPERSEDED number and exit 0")
//   cost-arith        — a commented `DECK_DAYS = 3` repriced boot 21 → 15
//     reads and the Hit scenario $2,568 → $2,462, test:scripts green
//   check-pokedex     — old ceiling parked above a raised one: "1025
//     species, keys contiguous" printed, exit 0, ON THE DEPLOY PATH
//   check-elements    — the same, exit 0
//   check-fn-runtime  — old region parked above `us-central1`: exit 0,
//     also on the deploy path, comparing the right answer to itself while
//     the client called the wrong region
//
// So this is a CLASS ratchet rather than three more single pins: the next
// gate to cross-read a constant fails here on the day it is written,
// instead of on the day someone leaves a note above a value.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(root, "scripts");

/** A regex run straight over a file read, with nothing stripping comments. */
const RAW_MATCH = /readFileSync\([^)]*\)\s*\n?\s*\.match\(/;

const gates = readdirSync(SCRIPTS)
  .filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"))
  .map((f) => ({ f, src: readFileSync(join(SCRIPTS, f), "utf8") }));

describe("no gate reads a constant past a comment", () => {
  it("finds the gates to check — vacuous otherwise", () => {
    // The floor. A glob that stopped matching would make every assertion
    // below pass over an empty list, which is the failure this whole file
    // is about, pointed at itself.
    expect(gates.length).toBeGreaterThan(20);
    expect(gates.some((g) => g.f === "check-pokedex.mjs")).toBe(true);
  });

  it("has no direct .match over an unstripped read", () => {
    const offenders = [];
    for (const { f, src } of gates) {
      for (const [i, line] of src.split("\n").entries()) {
        if (!/readFileSync/.test(line)) continue;
        // Two-line form counts too — the region read spans a line break.
        const window = line + "\n" + (src.split("\n")[i + 1] ?? "");
        if (RAW_MATCH.test(window) && !/stripComments/.test(window)) {
          offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      }
    }
    expect(
      offenders,
      "a gate reads a constant out of raw source — wrap the read in stripComments()",
    ).toEqual([]);
  });

  it("the three that were caught now strip, named so a revert is loud", () => {
    const named = ["check-pokedex.mjs", "check-elements.mjs", "check-fn-runtime.mjs", "cost-arith.mjs"];
    for (const f of named) {
      const g = gates.find((x) => x.f === f);
      expect(g, `${f} vanished — this ratchet no longer covers it`).toBeTruthy();
      expect(g.src, `${f} stopped importing the stripper`)
        .toContain('from "./strip-comments.mjs"');
    }
  });

  it("every gate that reads the iOS plist strips XML comments first", () => {
    // THE SAME DEFECT IN A SECOND SYNTAX. `check-ios-location`'s reader
    // scanned for `<key>NAME</key>` with `indexOf` over raw bytes, so a key
    // inside `<!-- … -->` read exactly like a live one; `check-store-forms`
    // tolerated a comment BETWEEN key and value while reading the first
    // `<key>` wherever it was. Measured, each restored: commenting out the
    // WhenInUse purpose string left check:ios-location at exit 0 (deleting
    // it correctly failed), and commenting out
    // `NSLocationDefaultAccuracyReduced` left BOTH gates at exit 0 with the
    // store label still asserted against a key not in the shipped app.
    //
    // One is the gate whose absence returns ITMS-90683 by email a build
    // number later; the other is a store attestation, which CLAUDE.md puts
    // outside the D334 ask. `check-policy-claims` and `check-public-copy`
    // had already met this and strip; these two never did.
    // Gates that look up a KEY's value, not every gate that opens the file.
    // The direction matters and it is not symmetric: a gate reading a
    // required value must not read a commented-out one as live, while a
    // gate scanning for a FORBIDDEN pattern (check-store-copy, hunting
    // unfilled placeholders) must not have comments stripped — that would
    // hide a placeholder rather than report it, and the safe direction
    // there is noise. Same distinction the deploy-targets rule makes about
    // its own `--only` list.
    const readers = gates.filter((g) => /Info\.plist/.test(g.src) && /<key>/.test(g.src));
    expect(readers.length, "no gate reads a plist key — this rule went vacuous").toBeGreaterThan(1);
    for (const g of readers) {
      expect(g.src, `${g.f} reads Info.plist without stripping XML comments`)
        .toMatch(/stripXmlComments\(/);
    }
  });

  it("the rule can actually fail — a positive control on the matcher", () => {
    // Without this, a regex that stopped matching anything would make the
    // sweep above green forever.
    const bad = 'const m = readFileSync(FN, "utf8").match(/X = (\\d+)/);';
    expect(RAW_MATCH.test(bad)).toBe(true);
    const good = 'const m = stripComments(readFileSync(FN, "utf8")).match(/X = (\\d+)/);';
    expect(RAW_MATCH.test(good) && !/stripComments/.test(good)).toBe(false);
  });
});

// ── a gate must actually RUN when it is run ─────────────────────────
//
// A second class, in the same file and for the same reason as the first:
// the failure is a gate reporting nothing while the thing it exists to
// catch is true.
//
// `import.meta.url === `file://${process.argv[1]}`` compares a URL against
// a path. `import.meta.url` percent-encodes and `process.argv[1]` does
// not, so on any checkout path containing a space — or any other character
// a URL escapes — the guard is false, the whole check body behind it never
// executes, and the script exits 0 having printed nothing. Not a wrong
// answer: no answer, indistinguishable from a pass.
//
// Measured 2026-09-06 on two identical trees differing only in whether the
// directory name contained a space, both carrying the defect
// `check:account-level` exists to catch: exit 1 with the correct diagnosis
// from the unspaced path, exit 0 and zero bytes of output from the spaced
// one. Nine scripts carried it, one of them (`check-account-level`) on the
// deploy path via backend-checks.yml, and one (`rules-coverage`) inside
// `npm run test:rules`.
//
// The safe form was already the majority spelling here — thirteen scripts
// used `resolve(process.argv[1]) === fileURLToPath(import.meta.url)` — so
// this ratchet pins the majority rather than inventing a rule.
describe("no gate hides behind a path-fragile main-module guard", () => {
  it("finds the gates to check — vacuous otherwise", () => {
    expect(gates.length).toBeGreaterThan(20);
  });

  it("nobody compares import.meta.url to a raw argv path", () => {
    const offenders = gates
      .filter((g) => /import\.meta\.url\s*===\s*`file:\/\/\$\{process\.argv\[1\]\}`/.test(g.src))
      .map((g) => g.f);
    expect(
      offenders,
      "a script's whole body sits behind a guard that is false on any path with a space "
        + "— it will exit 0 having checked nothing. Use "
        + "`process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)`.",
    ).toEqual([]);
  });
});
