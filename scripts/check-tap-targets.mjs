// Every button drawn under 44px carries a grown hit box, or is named here.
//
// WHY THIS IS A GATE. `jsx-a11y` has no size rule at all — it checks that a
// control has a role, a label and a key handler, and says nothing about
// whether a finger can land on it. So `check:a11y` reported 8 findings and
// green while fourteen controls in the tree were 7 to 26 pixels of real
// pressable area, including the Close button on every one of the app's
// bottom sheets. Apple asks for 44pt and Android for 48dp; the drawn size
// is a design choice and the HIT BOX is not, which is exactly what
// `.tap44` separates (styles.css §12 — it grows the box with a
// pseudo-element and changes nothing you can see).
//
// The failure this prevents is not a missing class. It is that the class
// exists, works, and gets forgotten: `world-feed.jsx` and
// `daily-split.jsx` drew the SAME 20px "About this question" control, one
// with `.tap44` and one without, for months.
//
// WHAT IT READS. Inline sizes on a `<button>` — both the JSX form
// (`<button style={{ width: 20, height: 20 }}>`) and the hyperscript form
// the ported modules use (`h('button', { style: { width: 20, ... } })`).
// A control sized only in CSS is invisible here; that is the honest limit
// of a source scan and the reason the two class-sized cases (.pm-chip,
// .wf-chip, .mmt-card-x) are handled in the stylesheet with a comment
// rather than pretended about here.
//
// Node stdlib only. Client-only, so it belongs on ci.yml and NOT on
// backend-checks.yml — nothing it says bears on whether a rules fix is
// safe to deploy, which is the placement rule every gate on that job obeys.

import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src", "v2");
const MIN = 44;

// Controls that are deliberately small AND deliberately not grown, each
// with the reason. Keyed by "file:label" so moving a control does not
// silently carry its exemption to a different one.
const EXEMPT = {
  // (none today — every small control in the tree carries .tap44 or
  // .tap44.is-tight. Entries here need a reason a reader can check, not a
  // note that the fix was awkward.)
};

const files = [];
for (const f of readdirSync(SRC, { recursive: true }).map((x) => String(x).split(sep).join("/"))) {
  if (/\.(jsx|tsx)$/.test(f) && !/\.test\./.test(f)) files.push(f);
}
if (files.length < 20) {
  console.error(`check-tap-targets FAILED: only ${files.length} files scanned — the walk is broken.`);
  process.exit(1);
}

// `width: 20` / `width: 20,` / `width: '20px'` inside a style object.
const SIZE = /\b(width|height)\s*:\s*'?"?(\d+(?:\.\d+)?)(?:px)?'?"?\s*[,}]/g;

/**
 * A control's own attributes: for JSX, up to the first `>` at brace depth
 * zero outside a string; for hyperscript, the balanced props object after
 * `h('button',`. Quotes are tracked because a `>` inside a string literal
 * (an aria-label, a `'\u203A'` chevron) is not a tag end either.
 */
function headOf(src, start, kind) {
  let i = start + (kind === "jsx" ? "<button".length : "h('button',".length);
  let quote = null;
  let depth = 0;
  if (kind === "h") {
    // Skip to the props object. A control written `h('button', null, …)`
    // has no attributes to read and no size to find.
    while (i < src.length && src[i] !== "{") { if (src[i] === ")") return src.slice(start, i); i++; }
  }
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote && src[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (kind === "h" && depth === 0) return src.slice(start, i + 1); }
    else if (c === ">" && depth === 0 && kind === "jsx") return src.slice(start, i + 1);
  }
  return src.slice(start, i);
}

const findings = [];
let buttons = 0;

for (const file of files.sort()) {
  const src = readFileSync(join(SRC, file), "utf8");
  // Each button and the text that follows it, up to the next element. Both
  // spellings, because the ported layer uses hyperscript and the hand-written
  // panels use JSX — a scan that read only one of them would report the
  // other clean, which is the check-a11y trap this file's header names.
  const opens = [
    ...src.matchAll(/<button\b/g),
    ...src.matchAll(/h\(\s*'button'\s*,/g),
  ].sort((a, b) => a.index - b.index);

  for (const m of opens) {
    buttons += 1;
    // The element's own attributes, read with a QUOTE- AND DEPTH-AWARE
    // scan rather than a split.
    //
    // It was `chunk.split(/>|\n\s*h\(/)[0]`, and the `>` that ends a
    // control's attributes is almost never the first `>` after `<button`:
    // `onClick={() => …}` puts one three attributes earlier. So every head
    // stopped at the arrow, and a `width: 26` after it was invisible.
    // Measured against this scan on the tree it was fixed on: the split
    // found **0** undersized controls, this finds **17** — including the
    // relmap panel's ✕ at 30px, the search overlay's close at 26px, and
    // the Mirror's 7px page dots. A gate written because "check:a11y
    // stayed green while every sheet's Close button was 26px" had the same
    // shape of hole one layer down.
    //
    // check-touch-zoom.mjs already carried the answer for the identical
    // problem — its `tagsIn` comment says "a naive /<input[^>]*>/ stops
    // inside the first onChange" — so this is that scan, generalised to
    // hyperscript's balanced props object.
    const head = headOf(src, m.index, m[0][0] === "<" ? "jsx" : "h");

    let small = null;
    for (const s of head.matchAll(SIZE)) {
      const px = Number(s[2]);
      if (px > 0 && px < MIN) { small = { axis: s[1], px }; break; }
    }
    if (!small) continue;
    // Grown? `.tap44` in this element's own className, in either spelling.
    if (/\btap44\b/.test(head)) continue;

    const label = (head.match(/aria-label['"]?\s*[:=]\s*['"{]?([^'"}\n,]{0,40})/) || [])[1]
      || "(unlabelled)";
    const key = `${file}:${label.trim()}`;
    if (key in EXEMPT) continue;
    const line = src.slice(0, m.index).split("\n").length;
    findings.push({ file, line, label: label.trim(), ...small });
  }
}

if (buttons < 50) {
  console.error(
    `check-tap-targets FAILED: matched only ${buttons} buttons across ${files.length} files.\n`
    + "  The element patterns stopped matching — a scan that finds nothing reports clean,\n"
    + "  which is the exact shape this gate exists to prevent elsewhere.",
  );
  process.exit(1);
}

if (findings.length) {
  console.error("check-tap-targets FAILED — controls drawn under 44px with no grown hit box:\n");
  for (const f of findings) {
    console.error(`    ${f.file}:${f.line}  ${f.axis} ${f.px}px  — ${f.label}`);
  }
  console.error(
    "\n  Add `tap44` to the element's className (styles.css §12): it grows the hit\n"
    + "  box with a pseudo-element and changes nothing you can see. For a control in\n"
    + "  a ROW of its own kind, use `tap44 is-tight` — the wide box would cover its\n"
    + "  neighbours and a near-miss would land on the wrong control.\n"
    + "  If it genuinely must stay small, add it to EXEMPT in this script with the\n"
    + "  reason.",
  );
  process.exit(1);
}

console.log(
  `check-tap-targets OK — ${buttons} buttons across ${files.length} files, `
  + `every inline size under ${MIN}px carries a grown hit box`
  + (Object.keys(EXEMPT).length ? `; ${Object.keys(EXEMPT).length} exempt with a reason` : ""),
);
