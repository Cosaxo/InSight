// Touch-zoom gate: no text field may declare its own font size.
//
// WHY THIS EXISTS. WKWebView and Mobile Safari auto-zoom the page when a
// text field takes focus whose computed font-size is under 16px, scaling by
// exactly 16/size. The app shell is `position: fixed; inset: 0`
// (spec/iOS.jsx), so nothing scales it back — no page to scroll to origin,
// no browser chrome to reset. The zoom outlives the field, the overlay and
// the tab, and the user sees an app that is permanently cropped on the
// right.
//
// It shipped that way. `.search-field input` was 15px, reachable from the
// header search icon on every screen, and three device screenshots 18
// minutes apart all measured 1.067 = 16/15. Nothing in the tree caught it:
// tsc, eslint, check:globals and the mount smoke tests are all blind to a
// number that is perfectly valid CSS.
//
// WHY A GATE RATHER THAN A TEST. The mount tests run in jsdom with vitest's
// CSS handling off, so a stylesheet-driven size never resolves there at all
// — the 15px that caused this would have passed. And the fields live behind
// six overlays and a bottom sheet, so a runtime walk would have to reach
// every one of them to say anything. A source scan sees all of them at once
// and needs nothing rendered.
//
// THE RULE. A text-entry field either says nothing about its font size, or
// says `var(--field-size)` — the token in styles.css that owns the 16px
// floor and carries the full reasoning. A literal is a failure even when it
// is 16 or larger: the point is that ONE place holds the number, because
// fifteen scattered copies is what produced the bug.
//
// Non-text inputs are exempt and listed below: iOS does not zoom for a
// slider or a checkbox, and `type="range"` in particular is styled by size
// everywhere in the map.
//
// WHAT THIS GATE DOES NOT SEE, written down because an undisclosed blind
// spot in a gate reads as a guarantee:
//
//  · NATIVE `&` NESTING, in two shapes — PROBED, not reasoned. The rule
//    matcher is `[^{}]+\{[^{}]*\}`, which finds innermost blocks only, and
//    the selector filter then wants a field in that block's OWN selector.
//    So `.sheet { & input { font-size: 15px } }` IS caught (the inner
//    selector says `input`), while both of these are not scanned at all:
//      input.answer { &:focus { font-size: 15px } }   ← inner names no field
//      input.answer { font-size: 15px; &:focus { … } }← a nested child hides
//                                                      the PARENT's own
//                                                      declarations from the
//                                                      innermost-only match
//    The second is the dangerous one: nesting anything inside a field's
//    rule takes that rule's own size out of this gate's sight. Nothing in
//    the tree nests today; the day something does, D105's exact bug is
//    unguarded again.
//  · A FIELD STYLED BY CLASS ALONE. The selector half looks for a field in
//    the selector (`input`, `textarea`, a `[type=…]`). A rule like
//    `.answer-box { font-size: 15px }` applied to an `<input className=
//    "answer-box">` sets a field's size and names no field, so it is
//    scanned and passes. Closing it means resolving class names across the
//    JSX, which is a different scanner.
//  · A SIZE COMPUTED AT RUNTIME — `fontSize: big ? 16 : 12`, a value out of
//    a props object, a style built by a helper this file does not resolve.
//    The const-lookup below reaches the common case (a named style object in
//    the same file) and no further.
//
// None of the three is used today, which is why they are notes and not
// failures. All three are how this gate goes quietly green on the failure
// it is named after.

import { pathToFileURL } from "node:url";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { stripComments } from "./strip-comments.mjs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");
const CSS = join(ROOT, "src/v2/styles.css");
const TOKEN = "var(--field-size)";

// Input types that never take a keyboard, so never trigger the focus zoom.
const NO_ZOOM = new Set([
  "range", "checkbox", "radio", "color", "button", "submit",
  "reset", "file", "image", "hidden",
]);

// src/dev/TweaksPanel.jsx is the design-time Tweaks panel: `if (!open) return null`
// and `open` only ever flips from a listener behind `import.meta.env.DEV`,
// so it does not exist in a production bundle and cannot be focused on a
// device. Its 11.5px `font:inherit` fields stay as the prototype drew them.
const SKIP_FILES = new Set(["src/dev/TweaksPanel.jsx"]);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(p)) out.push(p);
  }
  return out;
};

// The same walk for stylesheets. Separate from the one above rather than a
// parameterised extension of it, because the two halves report differently
// and the JSX half's file floor must keep counting JSX files only.
const walkCss = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkCss(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
};

const failures = [];

// ── 1 · JSX/TSX: every <input> and <textarea> tag ───────────────────────────
//
// Matching the tag rather than parsing: these are all self-closing or
// attribute-only, and a tag regex that stops at the first `/>` or `>` at
// depth zero handles every one of them in this tree. Nested braces in
// attributes (style objects, arrow handlers) are what the depth counter is
// for — a naive /<input[^>]*>/ stops inside the first onChange.
export const tagsIn = (src, tag) => {
  const out = [];
  const open = new RegExp(`<${tag}(?=[\\s/>])`, "g");
  let m;
  while ((m = open.exec(src))) {
    let depth = 0, i = m.index + tag.length + 1, quote = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push({ text: src.slice(m.index, i + 1), index: m.index });
  }
  return out;
};

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

// Style objects declared at module or function scope and spread into a
// field (`style={{ ...sgInput }}`, `style={base}`). Resolved within the
// file, which is where every one of them lives today.
const styleConsts = (src) => {
  const map = new Map();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*React\.CSSProperties\s*)?=\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = m.index + m[0].length, quote = null;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    map.set(m[1], src.slice(m.index, i));
  }
  return map;
};

// A declared font size that is NOT the token. Captures the literal so the
// failure can name it.
//
// `font:` AS WELL AS `fontSize:`, because the shorthand sets font-size and
// matched neither half of this gate. That is not hypothetical here — it is
// already house style: viz-primitives.jsx uses `style={{ font: '600 10px …' }}`
// at three sites, and this file's own SKIP_FILES comment quotes
// TweaksPanel's `font:11.5px/1.4 …`. Measured before this line existed: a
// new field with `style={{ font: "12px system-ui" }}` was WALKED, read, and
// passed — the file was even counted in "14 files with a field" — while the
// same field with `fontSize: "12px"` failed correctly. 15px on a focusable
// field is D105's shipped bug and the only reason this gate exists.
//
// `fontFamily`/`fontWeight` do not match: after `font` the pattern demands
// optional space and then a colon, which "Family" is not.
//
// THE LAST DECLARATION, NOT THE FIRST. This read `.exec()` — one match, the
// leftmost — so a tag that set the token and then overrode it passed, and
// the gate's whole subject is the size a field ENDS UP with. React applies
// a style object's properties in order and a duplicate key keeps the later
// value, so the last one is what the browser draws; the same rule the CSS
// half below follows for the same reason. `{ fontSize: 'var(--field-size)',
// font: '600 12px system-ui' }` is D105's bug written in two declarations,
// and it read as compliant.
//
// It also returns the PROPERTY, so a failure can say `font:` when that is
// what the file wrote. The line used to report every hit as `fontSize:`,
// naming a declaration the file does not contain — the same wrongness
// badCssFontSize was already fixed for, left standing on this half.
export const badFontSize = (text) => {
  let last = null;
  for (const m of text.matchAll(/\b(fontSize|font)\s*:\s*([^,}\n]+)/g)) {
    last = { prop: m[1], value: m[2].trim() };
  }
  if (!last) return null;
  return last.value.includes(TOKEN) ? null : last;
};

// The stylesheet half of the same question. Returns the declared property
// as well as its value, so the failure line says `font:` when that is what
// the sheet wrote — it used to report every hit as "font-size", which for a
// shorthand names a declaration the file does not contain.
//
// LAST, not first, for the reason spelled out on the JSX half: a rule that
// writes `font: 600 12px x; font-size: var(--field-size)` draws at the
// token, and one that writes them the other way round draws at 12px. The
// cascade decides, and `.exec()` was reading the wrong end of it.
export const badCssFontSize = (body) => {
  let last = null;
  for (const m of body.matchAll(/(?:^|[;\s])(font(?:-size)?)\s*:\s*([^;]+)/g)) {
    last = { prop: m[1], value: m[2].trim() };
  }
  if (!last) return null;
  return last.value.includes(TOKEN) ? null : last;
};

// Only when RUN, so a test can import the two matchers above without this
// walking src/, reading every sheet and calling process.exit.
// THE ENTRY GUARD USES pathToFileURL, not a `file://` template.
// `import.meta.url` percent-encodes; a template literal does not. On a
// checkout whose path holds a space, a `#`, a `%` or a non-ASCII
// character — "/Users/olaf/My Projects/InSight" — the two never match, so
// this file is imported and the gate below simply does not run: exit 0,
// zero output, nothing checked. Measured on a copy of this tree under a
// path with a space: a real violation reported by the gate on a normal
// path produced rc=0 and no output there. CI's path is clean, so this was
// latent there and live for anyone running the gates before pushing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // A NON-EMPTY FLOOR, the shape check-deploy-targets.mjs already uses
  // ("found NO exported functions, which cannot be right"). Without it this
  // gate reports "every text field defers to --field-size ✓" and exits 0 on a
  // walk that found nothing — so a moved directory, a renamed extension or a
  // regex that stopped matching turns it green rather than red. Verified by
  // mutation: stubbing readdirSync to [] left this gate at exit 0.
  //
  // The number is a floor, not a count: it only has to be far enough below
  // the real one that a legitimate deletion cannot trip it, while a broken
  // walk always does.
  //
  // The real one is NOT quoted here. It said "89 files, of which a couple
  // of dozen carry a field" and the walk now finds 400 with 13 — 4.5x out,
  // wrong in both numbers, inside a gate, and check:figures has no entry
  // for either. Anyone re-tuning this floor would have read a sentence
  // that is false. The OK line this script prints on every run states both
  // live counts, so read that instead: a figure typed once and never
  // recomputed is the one documentation error this repo keeps
  // re-committing (D39), and a second hand-typed pair would just restart
  // the clock on it.
  const FILES = walk(SRC);
  if (FILES.length < 40) {
    console.error(
      `check:touch-zoom FAILED: the walk found ${FILES.length} source files, `
      + "which cannot be right.\nFix this scan rather than letting it pass "
      + "vacuously — a gate that reports OK on nothing is worse than no gate.",
    );
    process.exit(1);
  }

  let fieldFiles = 0;
  let fieldTags = 0;
  for (const file of FILES) {
    const rel = relative(ROOT, file);
    if (SKIP_FILES.has(rel)) continue;
    // COMMENTS BLANKED BEFORE ANYTHING READS THE SOURCE, and the tag
    // scanner is why. It tracks `"`, `'` and backtick as string
    // delimiters and knows nothing about comments — so an ordinary
    // apostrophe inside a comment within an opening tag ("the rule's",
    // "the Mirror's") opens a phantom string, after which `{`, `}` and the
    // closing `>` are all skipped and the scan runs on until the next
    // straight quote.
    //
    // Measured on this tree: one `<input>` whose real tag is 795
    // characters was returned as 2331 — the field, a whole button, two
    // spans, a closing div and a function signature. That is a live hole,
    // not just an obstacle: a field with a comment containing an
    // apostrophe and `fontSize: 13` passes, because the swallowed text
    // reaches a `type="checkbox"` on the NEXT element and the no-zoom
    // exemption then applies to the wrong tag. D105's shipped bug, walking
    // straight through the gate written for it.
    //
    // Blanking rather than deleting keeps every offset, so `lineOf` still
    // reports the real line. `styleConsts` below has the identical loop
    // and is fixed by the same line.
    const src = stripComments(readFileSync(file, "utf8"));
    if (!/<(input|textarea)[\s/>]/.test(src)) continue;
    fieldFiles++;
    const consts = styleConsts(src);

    for (const tag of ["input", "textarea"]) {
      fieldTags += tagsIn(src, tag).length;
      for (const { text, index } of tagsIn(src, tag)) {
        const type = /\btype\s*=\s*["']([a-z]+)["']/.exec(text);
        if (type && NO_ZOOM.has(type[1])) continue;

        // the tag's own inline style
        let bad = badFontSize(text);
        let via = "inline";

        // …and any style object it spreads or passes wholesale
        if (!bad) {
          for (const name of new Set(
            [...text.matchAll(/(?:\.\.\.|style=\{)\s*([A-Za-z_$][\w$]*)/g)].map((x) => x[1]),
          )) {
            const decl = consts.get(name);
            const fromConst = decl && badFontSize(decl);
            if (fromConst) { bad = fromConst; via = `style object \`${name}\``; break; }
          }
        }

        if (bad) {
          failures.push(
            `${rel}:${lineOf(src, index)}  <${tag}> sets ${bad.prop}: ${bad.value} (${via})`,
          );
        }
      }
    }
  }

  // ── 2 · the stylesheets: rules whose selector targets a field ───────────────
  //
  // DISCOVERED, not named. This half read `src/v2/styles.css` and nothing
  // else, which left `src/v2/ui/patterns.css` — the app's other real
  // stylesheet, imported by PatternsTab.tsx — entirely unscanned. D105's bug
  // WAS a stylesheet rule (`.search-field input` at 15px), so the one failure
  // mode this gate is named after was unguarded in half the CSS that ships,
  // on the tab D265 has just put back in the bar.
  //
  // The floor below is the same shape as the JSX walk's: a discovery that
  // finds nothing, or loses the sheet that owns the token, has to fail rather
  // than report every field clean.
  const SHEETS = walkCss(SRC);
  if (!SHEETS.includes(CSS)) {
    console.error(
      `check:touch-zoom FAILED: the stylesheet walk found ${SHEETS.length} sheet(s) `
      + "and src/v2/styles.css was not among them.\nThat file owns --field-size, so "
      + "a walk that misses it is broken, not clean.",
    );
    process.exit(1);
  }
  for (const sheet of SHEETS) {
    const css = readFileSync(sheet, "utf8");
    const rel = relative(ROOT, sheet);
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = m;
      if (!/\b(input|textarea)\b/.test(selector)) continue;
      if (/\[type=["']?(range|checkbox|radio|color)/.test(selector)) continue;
      const fs = badCssFontSize(body);
      if (fs) {
        failures.push(
          `${rel}:${css.slice(0, m.index).split("\n").length}  `
          + `\`${selector.trim().replace(/\s+/g, " ")}\` sets ${fs.prop}: ${fs.value}`,
        );
      }
    }
  }

  if (failures.length) {
    console.error(
      `\ncheck:touch-zoom — ${failures.length} text field(s) set their own font size:\n`,
    );
    for (const f of failures) console.error(`  ${f}`);
    console.error(
      "\nA field under 16px makes iOS zoom the whole app on focus, and the app"
      + "\nshell is position:fixed so nothing zooms it back. Use"
      + `\n\`fontSize: '${TOKEN}'\` (or drop the declaration) — styles.css owns the`
      + "\nnumber and the reasoning.\n",
    );
    process.exit(1);
  }

  // …and the second half of the same floor: the walk can be healthy while the
  // `<input|textarea>` filter is what stopped matching, which is the same
  // vacuous pass one layer in. The count is reported rather than swallowed so
  // the number is visible when it moves.
  if (!fieldFiles) {
    console.error(
      "check:touch-zoom FAILED: not one file in the walk contains an <input> "
      + "or <textarea>.\nThe tag filter is broken — fix it rather than letting "
      + "this pass vacuously.",
    );
    process.exit(1);
  }

  // …AND THE SCANNER ITSELF, which neither floor above measured. `fieldFiles`
  // counts files matching a whole-file regex, never `tagsIn`'s output — so
  // the JSX half could be entirely dead with both floors satisfied.
  // Measured: breaking the tag regex left this gate green on its file
  // count, because the files still contained the string. (That figure was
  // quoted here as "13 files with a field" and was already stale when it
  // was written: the commit directly before this one moved comment-
  // blanking ahead of the count, which took it to 12. A measured number
  // typed into a comment is the documentation error D39 is about, and a
  // gate's own reasoning is the worst place for one — the next person
  // re-tuning this floor reads it. Run the gate for the live figure.) `tagsIn` is the
  // thing that decides what is examined, so it is what the floor has to
  // count. check-tap-targets already does this correctly.
  if (!fieldTags) {
    console.error(
      "check:touch-zoom FAILED: the tag scanner returned no <input> or "
      + `<textarea> at all, across ${fieldFiles} file(s) that contain one.`
      + "\nThe scanner is broken — fix it rather than letting this pass "
      + "vacuously.",
    );
    process.exit(1);
  }

  console.log(
    `check:touch-zoom — every text field defers to --field-size ✓ `
    + `(${fieldFiles} files with a field, of ${FILES.length} walked)`,
  );
}
