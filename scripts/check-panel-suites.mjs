// One test suite per hand-written panel — as a ratchet, not a sweep.
//
// WHY THIS IS A GATE. `src/v2/README.md` has said "one suite each,
// mutation-checked" about `src/v2/ui/` for a long time, and ORIENTATION §3
// repeats it. It was a convention, so it drifted: an audit found NINE
// panels with no suite at all, including PatternsTab — the entire shipped
// product of the on-trial third tab (D166 §1), at 4.71% branch coverage,
// where flipping one ternary tells every user they answered the opposite
// of what they did.
//
// These panels are where a wrong READING reaches a screen. The data layer
// beneath them is typed and tested; the panel is the last place a correct
// fold can be printed backwards, and it is the only place `tsc` cannot
// help — both of the defects that audit found type-check perfectly.
//
// A RATCHET, deliberately, and the same shape as check:a11y and
// check:globals rule 4: the debt is listed by name and the count may only
// go DOWN. A new panel needs a suite; an existing one gets its suite when
// someone touches it. Deleting a suite fails here, which is the direction
// that matters most — a panel that had one and lost it is worse than one
// that never had one, because the README's claim was true for a while.
//
// Node stdlib only. Client-only, so it belongs on ci.yml and NOT on
// backend-checks.yml — the placement rule every gate on that job obeys.

import { readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UI = join(root, "src", "v2", "ui");

// The panels still owed a suite, each with what a reader would want to
// know. Removing a name from this list is the only direction it moves.
//
// EMPTY SINCE D232, and the gate is now a floor rather than a ratchet:
// with nothing owed, `unexplained` fires on the next panel added without
// a suite. That is the direction this was always pointed at — the debt
// was ten when the list was written and the list is how it got to zero.
const OWED = {};

const panels = readdirSync(UI)
  .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
  .map((f) => f.slice(0, -4))
  .sort();

if (panels.length < 20) {
  console.error(`check-panel-suites FAILED: only ${panels.length} panels found — the walk is broken.`);
  process.exit(1);
}

const missing = panels.filter((p) => !existsSync(join(UI, `${p}.test.tsx`)));
const unexplained = missing.filter((p) => !(p in OWED));
const ghosts = Object.keys(OWED).filter((p) => !missing.includes(p));
const errors = [];

if (unexplained.length) {
  errors.push(
    "these panels have no test suite and are not on the recorded list:\n"
    + unexplained.map((p) => `    src/v2/ui/${p}.tsx`).join("\n")
    + "\n\n  Write src/v2/ui/<panel>.test.tsx. A panel is where a correct fold gets\n"
    + "  printed backwards, and it is the one place tsc cannot help.",
  );
}

if (ghosts.length) {
  errors.push(
    `these panels now HAVE a suite but are still listed as owed: ${ghosts.join(", ")}.\n`
    + "  Remove them from OWED in this script — the list is the debt, and a\n"
    + "  stale entry makes it read larger than it is.\n"
    + "  (If a suite was DELETED, that is what this gate is for: put it back.)",
  );
}

if (errors.length) {
  console.error("check-panel-suites FAILED:\n\n" + errors.join("\n\n"));
  process.exit(1);
}

const covered = panels.length - missing.length;
console.log(
  `check-panel-suites OK — ${covered}/${panels.length} panels carry a suite; `
  + `${missing.length} owed and recorded (this only moves down)`,
);
