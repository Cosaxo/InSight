// Accessibility ratchet: the app may not get less keyboard-reachable.
//
// WHY A RATCHET RATHER THAN A CLEAN SWEEP. Every one of the findings below
// is in `src/v2/spec/` — the ~19.8k lines ported verbatim from the frozen
// prototype. The hand-written layer (`src/v2/ui/*.tsx`, `src/lib`) has
// **zero**. Fixing 16 files of ported JSX blind means adding key handlers and
// focus behaviour to components no test asserts the interaction of, which is
// the same trade src/v2/README.md refuses for the deferred React Compiler
// findings: "Changing effect re-run timing blind is a worse trade than
// recording the debt."
//
// What a ratchet buys that a blanket disable does not: new code cannot add
// to it, and the number can only be lowered deliberately. That is the same
// shape as check:bundle's budget — a ceiling you have to consciously raise,
// with a note saying why.
//
// The baseline is PER FILE, not a total. A total lets a fix in one file pay
// for a regression in another and reports green; per file, each one has to
// hold its own line.
//
// TO FIX SOME: do the work, then run this script — it prints the exact
// replacement literal, so lowering the baseline is a copy-paste and never a
// guess. Deleting a file's entry entirely is correct once it reaches zero.

import { ESLint } from "eslint";

// Findings per file, as of 2026-07-30. The rules behind almost all of them:
//   click-events-have-key-events + no-static-element-interactions — a <div>
//     with onClick and no role/tabIndex/key handler, so it is mouse-only.
//   label-has-associated-control — a <label> not tied to its input.
//   no-autofocus — the rule is right in general: focus moving without being
//     asked is disorienting on a screen reader.
//
// All but two entries are in spec/, the ported layer, and are deferred for
// the reason at the top of this file.
//
// The two that are NOT are a deliberate keep, recorded here rather than
// silenced with an inline disable — `npm run lint` runs
// --report-unused-disable-directives against a config that has no jsx-a11y
// rules in it, so a disable comment naming one would itself become a lint
// error. Both are `autoFocus` on the search field of a picker overlay the
// user has just opened by tapping it: they opened it to type, and the
// alternative is an overlay that needs a second tap to be usable. Revisit
// if either overlay ever opens without a direct user action.
// 2026-07-31: 69 → 47. Every remaining div+onClick that was genuinely a
// button became one — the map/mindmap graph nodes, the group-mirror rows and
// person chips, the test picker cards, the relmap preview tile. `.btn-bare`
// and the reset on `.mmt-node` are what let a <button> lay out like the <div>
// it replaced; `.mmt-astat-row` was the precedent.
//
// What is LEFT under click-events-have-key-events is not the same bug and
// will not be fixed by the same move:
//   - 24 of them are the modal scrim/sheet pair — `.wf-scrim` closes on
//     click, `.wf-sheet` swallows the click so it does not. Neither is a
//     button; a <button> wrapping a whole sheet would nest interactive
//     content and read as one enormous control. The right fix is
//     role="dialog" + aria-modal + Escape + a focus trap, and every one of
//     these sheets already ships a real <button aria-label="Close">, so the
//     keyboard path exists — it is the semantics that are missing.
//   - 4 are `onClick={(e) => e.stopPropagation()}` on relmap panels: pure
//     event plumbing, no interaction to expose at all.
const BASELINE = {
  "src/v2/ui/CityPicker.tsx": 1,     // autoFocus — see note above
  "src/v2/ui/PickSearch.tsx": 1,     // autoFocus — see note above
  "src/v2/spec/app-shell.jsx": 1,
  "src/v2/spec/consequence-beat.jsx": 2,
  "src/v2/spec/duo-daily.jsx": 4,
  "src/v2/spec/group-daily.jsx": 9,
  "src/v2/spec/passive-meter.jsx": 4,
  "src/v2/spec/profile-general.jsx": 8,
  "src/v2/spec/relmap-panels.jsx": 4,
  "src/v2/spec/relmap.jsx": 2,
  "src/v2/spec/suggestions.jsx": 1,
  "src/v2/spec/tweaks-panel.jsx": 1,
  "src/v2/spec/type-marks.jsx": 4,
  "src/v2/spec/world-feed.jsx": 5,
};

const eslint = new ESLint({ overrideConfigFile: "eslint.a11y.config.js" });
const results = await eslint.lintFiles(["src"]);

const actual = {};
const byRule = {};
const fatal = [];
for (const r of results) {
  const rel = r.filePath.replace(process.cwd() + "/", "");
  for (const m of r.messages) {
    // A file that does not PARSE reports one fatal message with a null
    // ruleId and no rule findings at all — which the jsx-a11y filter below
    // would drop, leaving the file counted as clean. That is not
    // hypothetical: the first version of eslint.a11y.config.js ran espree
    // over .tsx, so every hand-written panel silently scored zero, and the
    // ratchet cheerfully reported "none new" while a clickable <div>
    // injected into CityPicker went unnoticed. Unparsed is not clean.
    if (m.fatal) { fatal.push(`${rel}:${m.line} ${m.message}`); continue; }
    if (!m.ruleId?.startsWith("jsx-a11y/")) continue;
    actual[rel] = (actual[rel] || 0) + 1;
    byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1;
  }
}

if (fatal.length) {
  console.error("check-a11y: these files could not be parsed, so they were not checked:\n");
  for (const f of fatal) console.error(`  ${f}`);
  console.error("\nFix the parser in eslint.a11y.config.js. A file this gate cannot read\nis a file this gate is lying about.");
  process.exit(1);
}

const total = Object.values(actual).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(BASELINE).reduce((a, b) => a + b, 0);

const worse = [];
const better = [];
for (const file of new Set([...Object.keys(BASELINE), ...Object.keys(actual)])) {
  const was = BASELINE[file] || 0;
  const now = actual[file] || 0;
  if (now > was) worse.push({ file, was, now });
  else if (now < was) better.push({ file, was, now });
}

for (const [rule, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${rule}`);
}
console.log(`\n  total ${total} (baseline ${baseTotal})`);

if (worse.length) {
  console.error("\ncheck-a11y: these files got LESS accessible:\n");
  for (const w of worse) {
    console.error(`  ${w.file}: ${w.was} → ${w.now}`);
  }
  console.error(
    "\nA clickable <div> needs role=\"button\", tabIndex={0} and a key handler,\n"
    + "or it is unreachable without a mouse. If the element genuinely is not a\n"
    + "control, the fix is usually that it should not carry onClick.\n\n"
    + "Do NOT raise the baseline to make this pass. It only moves down.",
  );
  process.exit(1);
}

if (better.length) {
  console.error("\ncheck-a11y: fixed — now lower the baseline in this script.\n");
  for (const b of better) console.error(`  ${b.file}: ${b.was} → ${b.now}`);
  console.error("\nReplace BASELINE with:\n");
  const next = Object.keys(actual).sort()
    .map((f) => `  ${JSON.stringify(f)}: ${actual[f]},`).join("\n");
  console.error(`const BASELINE = {\n${next}\n};`);
  console.error(
    "\nThis is an error rather than a pass so the ratchet actually tightens:\n"
    + "a fix that leaves the old number behind buys nothing, because the next\n"
    + "regression fits under it silently.",
  );
  process.exit(1);
}

const outsideSpec = Object.keys(actual).filter((f) => !f.startsWith("src/v2/spec/"));
console.log(
  `\ncheck:a11y OK — ${total} known findings, none new`
  + ` (${total - outsideSpec.reduce((a, f) => a + actual[f], 0)} in the ported spec layer,`
  + ` ${outsideSpec.length} deliberate elsewhere)`,
);
