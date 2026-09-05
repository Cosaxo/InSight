// Shared scanner for the spec layer's shared-global convention.
//
// Two consumers, one source of truth:
//   - scripts/check-spec-globals.mjs  reports dangling refs / unimported files
//   - eslint.config.js                seeds no-undef with the names that are
//                                     genuinely defined, so the rule can be ON
//                                     for the spec layer instead of disabled
//
// Before this split, eslint had no way to know which bare identifiers were
// legitimate globals, so no-undef was off for ~18.5kLOC — which is how two
// ReferenceErrors (ReactDOM at six portal sites, a bare `sign`) and a dead
// <GroupLevelTab> shipped without anything noticing.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments.mjs";
// Re-exported: check-spec-globals.mjs has imported it from here since
// before it had its own module, and the pair are read together.
export { stripComments };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specDir = join(root, "src/v2/spec");
const uiDir = join(root, "src/v2/ui");
// The typed data layer publishes globals too (live.ts's window.LIVE,
// back.ts's window.registerBackHandler). This used to name live.ts alone,
// which meant the SECOND data module to publish one was invisible here —
// its consumer read as a dangling reference and the check failed with the
// blame pointing at the consumer. Scanning the directory fixes the class.
const dataDir = join(root, "src/v2/data");

// Browser / runtime globals the spec layer legitimately reads off
// window without defining. Extend deliberately, not casually.
const RUNTIME_ALLOWLIST = new Set([
  // DOM / BOM
  "innerWidth", "innerHeight", "location", "navigator", "history",
  "localStorage", "sessionStorage", "matchMedia", "getSelection",
  "requestAnimationFrame", "cancelAnimationFrame", "setTimeout",
  "clearTimeout", "setInterval", "clearInterval", "addEventListener",
  "removeEventListener", "dispatchEvent", "scrollTo", "scrollY",
  "open", "alert", "confirm", "prompt", "getComputedStyle",
  "devicePixelRatio", "visualViewport", "crypto", "performance",
  "ResizeObserver", "IntersectionObserver", "MutationObserver",
  "parent", "postMessage", "focus", "blur", "close",
  // build-time / SDK globals defined outside the spec layer
  "Capacitor", "__APP_BUILD__",
  // This list held one more entry until 2026-07-31: GroupLevelBreakdown,
  // a lens referenced behind `window.X &&` whose defining module was
  // never ported. The guard meant it could not crash, so it sat here as
  // "known-dead" instead of being removed — which is how a dangling
  // reference gets to look like a feature flag. The branch is gone now.
  // Prefer that outcome to a new entry: anything parked here is a name
  // the checker has agreed to stop checking.
]);

// Tests are excluded: they import what they exercise rather than reading it
// off the global scope, so scanning them would add references with no
// matching definition.
//
// THE RULE APPLIES TO ALL THREE DIRECTORIES, and used to be applied to one.
// The data/ loop below carried the exclusion and this loop did not, so the
// 39 `ui/*.test.tsx` files were scanned against the very comment that says
// they must not be — 243 files walked where the rule means 201. spec/ holds
// no test file, so ui/ was the whole of it.
//
// Measured before fixing, because a ratchet that MOVES on a fix is a
// different change from one that does not: rule 4's coupling count is 244
// either way. So this was latent rather than live — a test file that
// referenced a spec global would have inflated the count, or worse declared
// a name and masked a genuinely dangling reference in production code.
const notATest = (f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\.[jt]sx?$/.test(f);

const files = [];
for (const dir of [specDir, uiDir]) {
  for (const f of readdirSync(dir)) {
    if (notATest(f)) files.push(join(dir, f));
  }
}
for (const f of readdirSync(dataDir)) {
  if (notATest(f)) files.push(join(dataDir, f));
}
files.push(join(root, "src/v2/main.jsx"));
files.push(join(root, "src/v2/spec-index.js"));

const defined = new Set();
const referenced = new Map(); // name -> [file:line]
// name -> the set of root-relative files that assign it. A Set rather than
// a single owner because multi-writer globals are a real pattern here, not
// a bug: `WORLD_FEED_QS` is created by world-feed-data.js and appended to
// by world-catalogs.js and world-subtopics.js, then replaced wholesale by
// data/live.ts in live mode.
//
// It was a single "first assignment wins" map until 2026-08-03, and that
// mis-attributed exactly this case — readdir order made world-catalogs.js
// the owner, so world-feed-data.js's five reads of the global IT creates
// were counted as coupling to a file that only appends to it. Rule 4 asks
// "does this file assign the name?", which is the question that has an
// answer when several files do.
const definedBy = new Map();

const DEFINE_RES = [
  /(?:globalThis|window)\.([A-Za-z_$][\w$]*)\s*=[^=]/g,
  /Object\.assign\(\s*(?:globalThis|window)\s*,\s*\{([^}]*)\}/g,
  // The CAST form, which the typed layer has to use and which this scanner
  // could not see until D280:
  //
  //   (window as unknown as Record<string, unknown>).TEST_FEED_QS = …
  //
  // `data/` is scanned, so the file was read — the pattern above simply
  // does not match a `window` with a type assertion between it and the dot.
  // The cost of that blind spot was a shipped D1 violation. D249 converted
  // `world-feed.jsx`'s reader of `window.TEST_FEED_QS` to an ESM import of
  // the DEMO array and recorded the name as having no reader left, which
  // was true of the spec layer and false of the tree: `live.ts` was still
  // publishing the live pool here, into a name that now had no consumer.
  // Rule 5 — publications nothing reads — is exactly the rule for that, and
  // it could not fire because the publication was invisible.
  //
  // Seeing it costs nothing anywhere else: a cast write to a name something
  // still reads is an ordinary multi-writer publication, which `definedBy`
  // has modelled as a Set since 2026-08-03.
  /\(\s*(?:globalThis|window)\s+as\s+[^)]*\)\.([A-Za-z_$][\w$]*)\s*=[^=]/g,
];
const REF_RE = /(?:globalThis|window)\.([A-Za-z_$][\w$]*)/g;
// The READ side of the cast form, and the exact mirror of the D280 entry in
// DEFINE_RES above:
//
//   (window as { IS_DATA?: { … } }).IS_DATA?.me
//
// D280 taught this scanner to see a cast WRITE and stopped there, which left
// the other half of the same blind spot open — and it was not empty.
// `data/pulse.ts` read `window.IS_DATA` in this shape long after
// `sample-data.js` came off the bridge and stopped assigning to `window` at
// all, so rule 1 had a dangling reference in front of it and could not match
// the line. The name resolved to undefined on every demo build and the
// pulse card's city and country scopes silently drew "Your city" and "Your
// country" instead of the room's own place. Its neighbour two lines up read
// `window.IS_PULSE_HISTORY`, which nothing in the tree has ever written.
//
// Adding it costs the other rules nothing. Rule 5 asks a word-boundary
// question over all of src/ and never consults `referenced`; rule 6 filters
// its readers to files that are not the publisher, so a cast write inside
// the publishing file cannot mask it; and rule 4 counts a reference only
// when ANOTHER file assigns the name, which a self-write is not.
const CAST_REF_RE = /\(\s*(?:globalThis|window)\s+as\s+[^)]*\)\.([A-Za-z_$][\w$]*)/g;
// The publication idiom READS THE NAME IT PUBLISHES, and that made rule 5
// unable to fire on a whole class. `;globalThis.X = typeof X === 'undefined'
// ? globalThis.X : X;` contains a `globalThis.X` on its right-hand side, so
// every name written this way landed in `referenced` by its own hand — a
// publication nobody consumes looked, to the mirror rule, exactly like one
// that is load-bearing. Measured at the moment this was added: 176 names use
// the idiom and 117 of them appear in no other file in the tree, tests,
// scripts and index.html included.
//
// The fix is to blank the idiom out of a line before scanning it for
// references, rather than to skip the line: a line may publish X and
// legitimately read Y, and skipping it would stop checking Y. Same shape as
// D208 — a gate green for its whole life is not evidence that it can fire.
const SELF_PUBLISH_RE =
  /(?:globalThis|window)\.([A-Za-z_$][\w$]*)\s*=\s*typeof \1 === 'undefined' \? (?:globalThis|window)\.\1 : \1;/g;
// <Foo> / <Foo.Bar> / <Foo /> — capitalised leading segment only, which is
// how JSX distinguishes a component from an html element.
//
// The leading group excludes an identifier character, `)`, `]` or `.`
// before the `<`, so TypeScript generics (Array<Foo>, useState<Bar>,
// Map<K,V>) are not mistaken for tags. Only applied to files that can
// contain JSX at all — a .ts file has no tags, only generics.
const JSX_RE = /(?:^|[^\w$)\].])<([A-Z][\w$]*)\b/g;
// `h(Foo, …)` — the same reference as `<Foo …>`, written through a
// createElement alias. Found by converting primitives.jsx (D39):
// daily-split.jsx renders `h(Sheet, {…})`, which rule 3 could not see
// because it is not a tag and rule 1 could not see because it is not
// `window.X`. Only `no-undef` was watching it, and no-undef counts
// nothing.
//
// That is a hole in the ratchet as well as in the checker: a new bare
// reference written this way would not have moved the number. Capitalised
// first argument only, exactly like JSX — a lowercase `h(x)` is an
// ordinary call, and `h` itself is a local number in five other files
// (never called, so it cannot match). Same `local` treatment as a tag:
// an imported or locally declared component is not a global reference.
const CREATE_EL_RE = /(?:^|[^\w$.])h\(\s*([A-Z][\w$]*)/g;

// Comments must not count as definitions or references: a commented-out
// `window.Foo = …` would otherwise satisfy a real dangling reference, and a
// `<Foo/>` inside a doc comment would raise a phantom one.

for (const file of files) {
  const src = stripComments(readFileSync(file, "utf8"));
  const rel = file.slice(root.length + 1);
  const own = (name) => {
    defined.add(name);
    if (!definedBy.has(name)) definedBy.set(name, new Set());
    definedBy.get(name).add(rel);
  };
  for (const re of DEFINE_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      if (re === DEFINE_RES[1]) {
        // Object.assign(globalThis, { A, B: x }) — take the keys.
        for (const part of m[1].split(",")) {
          const key = part.split(":")[0].trim();
          if (/^[A-Za-z_$][\w$]*$/.test(key)) own(key);
        }
      } else {
        own(m[1]);
      }
    }
  }
  // Names this file defines locally — a component declared and used in the
  // same file resolves lexically and is not a global reference at all.
  // Covers function/class/const declarations, imports, and destructured
  // locals (`const { Card, Row } = window.PRIMS`).
  const localNames = new Set();
  for (const re of [
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Z][\w$]*)/g,
    /(?:^|\n)\s*(?:export\s+)?class\s+([A-Z][\w$]*)/g,
    /(?:const|let|var)\s+([A-Z][\w$]*)\s*[=:]/g,
    /import\s+(?:\*\s+as\s+)?([A-Z][\w$]*)/g,
    /import\s*\{([^}]*)\}/g,
    // The MIXED form — `import Mark, { Link } from` — which the two lines
    // above split between them and neither finished: the first sees the
    // default and stops at the comma, the second wants the brace right
    // after `import`. Nothing in the spec layer had imported a default and
    // a named binding on one line until world-feed.jsx took SponsorLink
    // beside SponsorMark (D378), and the named half read as a dangling
    // global. Seen by rule 3, fixed here rather than by an exception.
    /import\s+[A-Za-z_$][\w$]*\s*,\s*\{([^}]*)\}/g,
    /(?:const|let|var)\s*\{([^}]*)\}\s*=/g,
    // The whole declarator list, because the third pattern above only sees
    // the FIRST one: `const st = this.state, h = React.createElement, F =
    // React.Fragment;` declares F locally, and without this line F reads as
    // an undefined global. Found by the h(Foo, …) rule, which is what first
    // made daily-split.jsx's `h(F, …)` visible at all.
    /(?:const|let|var)\s+([^;\n]+)/g,
  ]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      for (const part of m[1].split(",")) {
        // Initialiser first, then any `key: alias` rename — in that order,
        // so `F = React.Fragment` yields F rather than the tail of its
        // value, and `{ Card: C }` still yields C.
        //
        // The bracket strip is for ARRAY destructuring, which the patterns
        // above see as `[RelMap` and `setRelMap]` and then reject for the
        // punctuation — so `const [RelMap, setRelMap] = useState(null)`
        // declared no local at all, and `<RelMap/>` beneath it read as a
        // dangling global. Nothing in the spec layer had ever held a
        // COMPONENT in array-destructured state, which is why a gap this
        // plain survived: the miss is invisible unless the name is also a
        // JSX tag. Found by D200 doing exactly that.
        const key = part.split("=")[0].split(":").pop().trim()
          .replace(/^\.\.\./, "").replace(/^\[|\]$/g, "");
        if (/^[A-Za-z_$][\w$]*$/.test(key)) localNames.add(key);
      }
    }
  }

  const canHaveJsx = /\.(jsx|tsx)$/.test(file);
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const at = `${file.slice(root.length + 1)}:${i + 1}`;
    // `local` applies to JSX tags only. An explicit `window.X` is a global
    // reference whatever else the file declares — suppressing it because a
    // same-named local exists would silently stop checking it.
    const note = (name, { local } = {}) => {
      if (RUNTIME_ALLOWLIST.has(name)) return;
      if (local && localNames.has(name)) return;
      if (!referenced.has(name)) referenced.set(name, []);
      referenced.get(name).push(at);
    };
    // Blank out any self-publishing statement first — see SELF_PUBLISH_RE.
    // Replaced with spaces rather than removed so nothing on either side of
    // it joins up into a name that was never written.
    SELF_PUBLISH_RE.lastIndex = 0;
    const scanLine = line.replace(SELF_PUBLISH_RE, (t) => " ".repeat(t.length));
    REF_RE.lastIndex = 0;
    let m;
    while ((m = REF_RE.exec(scanLine))) note(m[1]);
    CAST_REF_RE.lastIndex = 0;
    while ((m = CAST_REF_RE.exec(scanLine))) note(m[1]);
    // A capitalised JSX tag resolves through the shared global scope at
    // render time, exactly like window.X — and renaming a component while
    // missing one call site was caught by NOTHING before this rule: the
    // checker only matched window.X, and eslint's no-undef is off for
    // these files.
    if (canHaveJsx) {
      JSX_RE.lastIndex = 0;
      while ((m = JSX_RE.exec(line))) note(m[1], { local: true });
    }
    // Not gated on canHaveJsx: a .js module can call createElement too, and
    // there are no generics there to confuse it with.
    CREATE_EL_RE.lastIndex = 0;
    while ((m = CREATE_EL_RE.exec(line))) note(m[1], { local: true });
  });
}


export function collectSpecGlobals() {
  return { defined, definedBy, referenced, files, specDir, root, RUNTIME_ALLOWLIST };
}
