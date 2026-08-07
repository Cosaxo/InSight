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

import { readdirSync, readFileSync } from "node:fs";
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
// 2026-07-31, second pass: 47 → 23 (D24). The seven wf-scrim/wf-sheet
// bottom sheets now go through one `Sheet` component (primitives.jsx), and
// all eight full-screen overlays take `useDialog` — role, aria-modal,
// aria-label, Escape, focus trap, focus restore. The findings went with it
// for two structural reasons, not by silencing:
//   - the scrim is `role="presentation"`: a backdrop that dismisses is not a
//     control, and every sheet already ships a real Close button;
//   - the sheet's `onClick={(e) => e.stopPropagation()}` is GONE. It existed
//     only to stop the scrim's handler, and the scrim now tests
//     `e.target === e.currentTarget` instead. One check removed both halves.
//
// 2026-07-31, third pass: 23 → 19. relmap-panels' 4 findings were
// `onClick={(e) => e.stopPropagation()}` on the two panel bodies, and the
// fix was to DELETE them: they were dead code, guarding against a handler
// that does not exist. The map's deselect lives on the <svg>'s
// onPointerUp/onPointerDown, the panels are absolutely-positioned SIBLINGS
// of that svg, and a pointerdown on a panel never reaches it — so `drag`
// stays null and onPointerUp returns early. A click handler could not have
// stopped a pointer handler in any case; they are different event types.
// Confirmed in Chromium on both panels (person and hub) before removal:
// open the panel, click inside it, panel stays. Identical with and without.
//
// 2026-08-03, fourth pass: 19 → 11. profile-general's 8 were the whole of
// label-has-associated-control, in one contiguous block of the Basics editor,
// and they were two different bugs wearing one rule's name:
//   - Seven <label>Day<Select …/></label> rows. `Select` renders a NATIVE
//     <select>, so nesting was already valid implicit association and the
//     markup was accessible — the rule simply cannot see through a custom
//     component. Fixed by threading an `id` to the <select> and pairing it
//     with htmlFor, not by declaring `Select` in `controlComponents`:
//     that option would have made the rule accept the nesting on trust, and
//     kept accepting it if `Select` were ever rewritten as a div-based
//     dropdown. Explicit ids state the association where both the linter and
//     a reader of the call site can check it.
//   - One <label>City<CityPicker/></label>, which was a REAL defect and the
//     reason the first fix was worth doing properly. CityPicker renders a
//     <button> collapsed and an <input role="combobox"> open; both are
//     labelable, so the wrapper won the accessible-name computation and the
//     chosen city never reached a screen reader. ui/CityPicker.tsx still
//     carries the aria-label added to work around it. The wrapper is a plain
//     <span> caption now, so the cause is gone rather than compensated for.
// Verified by probe before committing to the approach: nesting a custom
// component fails the rule, htmlFor+id passes.
//
// What is left, and why each is a different bug:
//   - no-autofocus (8) and the rest: recorded above and in D21.
const BASELINE = {
  "src/v2/spec/app-shell.jsx": 1,
  "src/v2/spec/group-daily.jsx": 1,
  "src/v2/spec/relmap.jsx": 1,
  "src/v2/spec/suggestions.jsx": 1,
  "src/v2/spec/tweaks-panel.jsx": 1,
  "src/v2/spec/world-feed.jsx": 1,
  "src/v2/ui/CityPicker.tsx": 1,
  "src/v2/ui/PickSearch.tsx": 1,
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
const specTotal = total - outsideSpec.reduce((a, f) => a + actual[f], 0);

// ── the figures src/v2/README.md quotes ─────────────────────────
//
// WHY THIS IS HERE. Two paragraphs of that README quote counts this tree
// computes — the a11y baseline, and the number of deferred single-line
// eslint suppressions in the spec layer — and BOTH have gone stale. The
// suppression figure sat at 27 after the tree reached 30, in the very
// paragraph that says it is quoted inline *because* it previously claimed
// 42 long after the number moved. The a11y figure sat at 19 after the
// 2026-08-03 pass lowered the BASELINE below to 11.
//
// (That paragraph deliberately does not spell the directive out. A comment
// line here that BEGINS with the directive name is parsed by eslint as a
// real directive, not as prose — `npm run lint` failed on exactly that
// while this section was being written, reporting a rule named after the
// rest of the sentence. The scanner below matches the literal instead.)
//
// So the evidence is now two independent instances of the same failure,
// one of them a repeat inside the paragraph warning against it. A prose
// figure kept current by intention does not stay current; something has to
// hold it equal to the tree.
//
// It lives in THIS script rather than a new gate for one reason: this
// script already owns BASELINE, the source of truth for one of the two
// figures. A separate gate would either duplicate that literal — a second
// place to go stale, which is the bug — or re-run eslint over src/ to
// recompute it, doubling the slowest job in ci.yml. The suppression count
// is a cheap file scan and rides along rather than earning a gate of its
// own. Failures below say "documented figure" and name the sentence, so a
// doc mismatch never reads as an accessibility regression.
const README = "src/v2/README.md";
const readme = readFileSync(README, "utf8");
const docErrors = [];

// "The baseline is **11**: 9 in `spec/`, plus two deliberate…"
const baselineClaim = readme.match(/The baseline is \*\*(\d+)\*\*: (\d+) in `spec\/`/);
if (!baselineClaim) {
  docErrors.push(
    `${README}: could not find the "The baseline is **N**: M in \`spec/\`" sentence.\n`
    + "    Either it was reworded or the section was removed. If the figure is no\n"
    + "    longer quoted there, delete this check with it — a gate reading for a\n"
    + "    sentence that no longer exists is one nobody can satisfy.",
  );
} else {
  const [, claimedTotal, claimedSpec] = baselineClaim.map(Number);
  if (claimedTotal !== baseTotal || claimedSpec !== specTotal) {
    docErrors.push(
      `${README} states the baseline is ${claimedTotal} (${claimedSpec} in spec/);\n`
      + `    BASELINE in this script totals ${baseTotal} (${specTotal} in spec/).\n`
      + `    Correct the sentence to: "The baseline is **${baseTotal}**: ${specTotal} in \`spec/\`".`,
    );
  }
}

// The deferred React Compiler suppressions, counted the way the README's
// own `git grep -c` snippet counts them: lines carrying the directive, per
// file. Read from disk rather than shelling out to git, so the number is
// the same in a worktree, a CI checkout and an export.
let suppressions = 0;
let suppressionFiles = 0;
for (const f of readdirSync("src/v2/spec")) {
  if (!/\.jsx?$/.test(f)) continue;
  const hits = readFileSync(`src/v2/spec/${f}`, "utf8")
    .split("\n")
    .filter((l) => l.includes("eslint-disable-next-line")).length;
  if (hits) { suppressions += hits; suppressionFiles += 1; }
}

// "That count is **30 across 15 files**."
const suppressionClaim = readme.match(/That count is \*\*(\d+) across (\d+) files\*\*/);
if (!suppressionClaim) {
  docErrors.push(
    `${README}: could not find the "That count is **N across M files**" sentence.\n`
    + "    Same note as above — if the figure is no longer quoted, remove this check.",
  );
} else {
  const [, claimedN, claimedFiles] = suppressionClaim.map(Number);
  if (claimedN !== suppressions || claimedFiles !== suppressionFiles) {
    docErrors.push(
      `${README} states ${claimedN} suppressions across ${claimedFiles} files;\n`
      + `    src/v2/spec has ${suppressions} across ${suppressionFiles}.\n`
      + `    Correct the sentence to: "That count is **${suppressions} across ${suppressionFiles} files**".`,
    );
  }
}

if (docErrors.length) {
  console.error("\ncheck-a11y: documented figures no longer match the tree:\n");
  for (const e of docErrors) console.error(`  ${e}\n`);
  console.error(
    "  This is not an accessibility regression — the ratchet itself is fine.\n"
    + "  It is the README quoting a number that has moved, which is the one\n"
    + "  documentation error this repo keeps re-committing.",
  );
  process.exit(1);
}

console.log(
  `\ncheck:a11y OK — ${total} known findings, none new`
  + ` (${specTotal} in the ported spec layer,`
  + ` ${outsideSpec.length} deliberate elsewhere);`
  + ` ${suppressions} deferred suppressions across ${suppressionFiles} files;`
  + ` ${README} agrees with both`,
);
