// Every id an accessibility attribute POINTS AT must exist in the same file.
//
// WHY THIS EXISTS. `label-has-associated-control` (eslint.a11y.config.js,
// ratcheted by check-a11y.mjs) checks that a <label> carries an htmlFor. It
// does NOT check that the htmlFor resolves — a label pointing at
// "totally-dangling" while the control carries a different id passes the rule
// silently. Verified with a probe before this file was written.
//
// That gap was cheap to ignore while the association was structural: nesting
// the control inside the label cannot dangle. profile-general.jsx traded that
// for an explicit htmlFor/id pair on 2026-08-03 (better, because the linter
// and a reader can both see it) — and the trade introduced seven string
// matches spread across two attributes, where a one-sided rename breaks the
// association and lint, check:a11y, check:globals and `tsc -b` all stay green.
// That is the same failure shape data/vote.test.ts pins window.LIVE against:
// rename a member, every static gate passes, the thing blanks at runtime.
//
// So this is the static half of that guard, and it generalises past the one
// screen — aria-labelledby, aria-describedby and aria-controls dangle exactly
// the same way, and PickSearch.tsx / CityPicker.tsx already carry a real pair.
//
// THE ASYMMETRY IS DELIBERATE. References must resolve; definitions are
// collected permissively. Any `id=` anywhere in the file counts, including
// `<NavGlyph id={id}/>` (a nav tab key, not a DOM id) and the SVG gradient
// ids. Over-collecting definitions can only cause a MISSED failure, never a
// false one — and a gate that reds a green tree on a guess is a gate people
// learn to skip.
//
// WHAT THIS DOES NOT DO, stated here because the name oversells it:
//   - It does not verify the id reaches the DOM. `<Select id={x}/>` satisfies
//     it, and Select is a custom component; if Select stopped forwarding `id`
//     to its native <select> the pair would still match here. Only a render
//     catches that (see scratchpad note in the 2026-08-03 review).
//   - It does not resolve across files. An htmlFor in A pointing at an id in
//     B reads as dangling. That is bad practice rather than a supported case,
//     and no such pair exists today.
//   - It does not flag duplicate ids, or ids nothing points at. Both are real
//     defects; neither is this file's job, and both have false-positive
//     shapes (conditional branches, SVG defs) that need more than a regex.
//
// Run: npm run check:labels

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

// Attributes whose value NAMES an element elsewhere in the document.
// htmlFor holds exactly one id; the aria-* ones hold a space-separated list.
const REF_ATTRS = {
  htmlFor: { list: false },
  "aria-labelledby": { list: true },
  "aria-describedby": { list: true },
  "aria-controls": { list: true },
};

// Tests are excluded: they render fragments in isolation, so a fixture's
// htmlFor pointing at a control the fixture does not draw is not a defect.
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx|tsx)$/.test(entry) && !/\.test\.[jt]sx?$/.test(entry)) out.push(full);
  }
  return out;
}

// Same reasoning as scripts/spec-globals.mjs: a commented-out `id={x}` must
// not satisfy a live reference, and `htmlFor` written in prose must not raise
// a phantom one. profile-general.jsx has both — its Select comment says
// "point at it with htmlFor" — so this is load-bearing, not defensive.
// Newlines are preserved so reported line numbers stay true.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

// Read one JSX attribute value starting at `from` (the index just past `=`).
// Returns { raw, end } or null.
//
// Brace matching is counted, not regexed, and that is the whole reason this
// helper exists: htmlFor={`${uid}-bornD`} contains a `}` INSIDE the value, so
// a lazy /\{([^}]*)\}/ captures "`${uid" and every pair reads as dangling.
function readAttrValue(src, from) {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i++;
  const ch = src[i];
  if (ch === '"' || ch === "'") {
    const end = src.indexOf(ch, i + 1);
    if (end === -1) return null;
    return { raw: src.slice(i + 1, end), literal: true, end };
  }
  if (ch !== "{") return null;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { raw: src.slice(i + 1, j), literal: false, end: j };
    }
  }
  return null;
}

// An expression's identity is its source text with whitespace removed, so
// `${uid}-job` matches `${ uid }-job`. Anything cleverer would need a parser,
// and anything less would report a formatting change as a broken label.
const norm = (s) => s.replace(/\s+/g, "");

const problems = [];
let refCount = 0;
let fileCount = 0;

for (const file of walk(srcDir)) {
  const src = stripComments(readFileSync(file, "utf8"));
  const rel = file.slice(root.length + 1);
  fileCount++;

  // Definitions: every `id=` in the file, literal or expression.
  const ids = new Set();
  const idRe = /(?<![\w-])id\s*=/g;
  let m;
  while ((m = idRe.exec(src))) {
    const val = readAttrValue(src, m.index + m[0].length);
    if (!val) continue;
    ids.add(norm(val.raw));
    idRe.lastIndex = val.end;
  }

  // References: must resolve against the set above.
  for (const [attr, { list }] of Object.entries(REF_ATTRS)) {
    const refRe = new RegExp(`(?<![\\w-])${attr}\\s*=`, "g");
    while ((m = refRe.exec(src))) {
      const val = readAttrValue(src, m.index + m[0].length);
      if (!val) continue;
      refRe.lastIndex = val.end;
      const line = src.slice(0, m.index).split("\n").length;
      // A literal aria-labelledby may name several ids; an expression is one
      // opaque token, because splitting `${a} ${b}` would invent references.
      const tokens = val.literal && list
        ? val.raw.trim().split(/\s+/).filter(Boolean)
        : [val.raw];
      for (const t of tokens) {
        refCount++;
        if (!ids.has(norm(t))) {
          // Echo the source form — {expr} vs "literal" — so the reported
          // text can be searched for verbatim in the file it names.
          const shown = val.literal ? `"${t.trim()}"` : `{${t.trim()}}`;
          problems.push({ rel, line, attr, shown });
        }
      }
    }
  }
}

if (problems.length) {
  console.error("check-labels: these point at an id that does not exist in the same file:\n");
  for (const p of problems) {
    console.error(`  ${p.rel}:${p.line}  ${p.attr}=${p.shown}`);
  }
  console.error(
    "\nEach one is an association the browser will not make: the label or"
    + "\naria-* reference resolves to nothing, so the control is left unnamed."
    + "\njsx-a11y checks that the attribute is PRESENT, never that it resolves,"
    + "\nso nothing else in this repo fails on it."
    + "\n\nFix the pair, do not delete the reference — dropping htmlFor puts the"
    + "\nfinding back on check:a11y's ratchet, which is the same bug wearing a"
    + "\ndifferent hat.",
  );
  process.exit(1);
}

// A NON-EMPTY FLOOR on both halves, the shape check-deploy-targets.mjs
// already uses ("found NO exported functions, which cannot be right").
//
// Without it this gate prints "OK — 0 id reference(s) across 0 files, all
// resolve" and exits 0, which is the exact sentence a broken walk produces
// and a reader skims past. Verified by mutation: stubbing readdirSync to []
// left it at exit 0.
//
// BOTH halves, because they break separately. `fileCount` catches a walk
// that found nothing; `refCount` catches a walk that is healthy while the
// htmlFor/aria-* regexes are what stopped matching — and it is the second
// one that is likely, since those patterns are the fiddly part. The
// reference count is small (11 today) and only moves when someone edits an
// association, so a floor of 1 is the honest bound: anything higher would
// fail a legitimate refactor that nested a label instead, which is the
// shape this gate exists to encourage.
if (fileCount < 40 || refCount < 1) {
  console.error(
    `check-labels FAILED: walked ${fileCount} files and found ${refCount} id `
    + "reference(s), which cannot be right.\nFix this scan rather than letting "
    + "it pass vacuously — a gate that reports OK on nothing is worse than no "
    + "gate, because it is also an argument against looking.",
  );
  process.exit(1);
}

console.log(
  `check-labels OK — ${refCount} id reference(s) across ${fileCount} files, all resolve.`,
);
