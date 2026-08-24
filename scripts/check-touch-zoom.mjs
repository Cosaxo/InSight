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

import { readdirSync, readFileSync, statSync } from "node:fs";
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

const failures = [];

// ── 1 · JSX/TSX: every <input> and <textarea> tag ───────────────────────────
//
// Matching the tag rather than parsing: these are all self-closing or
// attribute-only, and a tag regex that stops at the first `/>` or `>` at
// depth zero handles every one of them in this tree. Nested braces in
// attributes (style objects, arrow handlers) are what the depth counter is
// for — a naive /<input[^>]*>/ stops inside the first onChange.
const tagsIn = (src, tag) => {
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
const badFontSize = (text) => {
  const m = /\bfontSize\s*:\s*([^,}\n]+)/.exec(text);
  if (!m) return null;
  const value = m[1].trim();
  return value.includes(TOKEN) ? null : value;
};

// A NON-EMPTY FLOOR, the shape check-deploy-targets.mjs already uses
// ("found NO exported functions, which cannot be right"). Without it this
// gate reports "every text field defers to --field-size ✓" and exits 0 on a
// walk that found nothing — so a moved directory, a renamed extension or a
// regex that stopped matching turns it green rather than red. Verified by
// mutation: stubbing readdirSync to [] left this gate at exit 0.
//
// The number is a floor, not a count: it only has to be far enough below
// the real one (89 files, of which a couple of dozen carry a field) that a
// legitimate deletion cannot trip it, while a broken walk always does.
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
for (const file of FILES) {
  const rel = relative(ROOT, file);
  if (SKIP_FILES.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  if (!/<(input|textarea)[\s/>]/.test(src)) continue;
  fieldFiles++;
  const consts = styleConsts(src);

  for (const tag of ["input", "textarea"]) {
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
          `${rel}:${lineOf(src, index)}  <${tag}> sets fontSize: ${bad} (${via})`,
        );
      }
    }
  }
}

// ── 2 · styles.css: rules whose selector targets a field ────────────────────
const css = readFileSync(CSS, "utf8");
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const [, selector, body] = m;
  if (!/\b(input|textarea)\b/.test(selector)) continue;
  if (/\[type=["']?(range|checkbox|radio|color)/.test(selector)) continue;
  const fs = /(?:^|[;\s])font-size\s*:\s*([^;]+)/.exec(body);
  if (fs && !fs[1].includes(TOKEN)) {
    failures.push(
      `src/v2/styles.css:${css.slice(0, m.index).split("\n").length}  `
      + `\`${selector.trim().replace(/\s+/g, " ")}\` sets font-size: ${fs[1].trim()}`,
    );
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

console.log(
  `check:touch-zoom — every text field defers to --field-size ✓ `
  + `(${fieldFiles} files with a field, of ${FILES.length} walked)`,
);
