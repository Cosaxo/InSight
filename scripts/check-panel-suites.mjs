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

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UI = join(root, "src", "v2", "ui");

// The panels still owed a suite, each with what a reader would want to
// know. Removing a name from this list is the only direction it moves.
//
// EMPTY SINCE D242, and the gate is now a floor rather than a ratchet:
// with nothing owed, `unexplained` fires on the next panel added without
// a suite. That is the direction this was always pointed at — the debt
// was ten when the list was written and the list is how it got to zero.
const OWED = {};

// Recursive: a panel filed under a subdirectory would otherwise be
// invisible to this gate, which means it would owe no suite and the
// vacuity floor below would not notice — the debt list would simply be
// missing it.
const panels = readdirSync(UI, { recursive: true })
  .map((f) => String(f).split(sep).join("/"))
  .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
  .map((f) => f.slice(0, -4))
  .sort();

if (panels.length < 20) {
  console.error(`check-panel-suites FAILED: only ${panels.length} panels found — the walk is broken.`);
  process.exit(1);
}

const missing = panels.filter((p) => !existsSync(join(UI, `${p}.test.tsx`)));

// A FILE IS NOT A SUITE. `existsSync` was the whole test, and
// docs/ORIENTATION.md — which check:docs rule 4 points at this gate —
// claims "One test suite each, mutation-checked". Measured 2026-09-12: a
// new panel plus a two-line suite that never imports it passed this gate
// at "50/50 panels carry a suite", and passed vitest too. The direction
// that matters most is the one the header names — a panel that HAD a
// suite and lost it — and gutting one down to a trivial `it()` was
// invisible here.
//
// The cheapest honest check is that the suite names the thing it stands
// for: its own module identifier has to appear in it. That does not prove
// the case is good — nothing a gate can read does — but it refuses a file
// that is a suite for this panel in name only, which is the shape a
// gutting leaves behind.
//
// The panel's BASENAME rather than its path, because a subdirectory panel
// is imported as `./sub/Panel` from the suite beside it and as `Panel` in
// the JSX; and a `import … from "./Panel"` line satisfies it either way.
const hollow = panels
  .filter((p) => !missing.includes(p))
  .filter((p) => {
    const name = p.split("/").pop();
    return !readFileSync(join(UI, `${p}.test.tsx`), "utf8").includes(name);
  });
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

if (hollow.length) {
  errors.push(
    "these panels have a suite FILE that never names them:\n"
    + hollow.map((p) => `    src/v2/ui/${p}.test.tsx`).join("\n")
    + "\n\n  A suite that does not so much as mention its panel is not standing in\n"
    + "  for it. Import the panel and render it, or — if the file is genuinely\n"
    + "  about something else — move it and put the panel on OWED with the\n"
    + "  reason, so the debt reads true.",
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
