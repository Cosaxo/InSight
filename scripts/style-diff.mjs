// style-diff — compare the running app against the frozen prototype and
// report every element whose typography, colour or geometry disagrees.
//
// WHY THIS EXISTS
//
// The v14 port was done module by module and reviewed by eye. That method
// missed, and kept missing, exactly the class of thing eyes are worst at:
// a 26px headline that should be 30px, a chip with a chevron the prototype
// does not have, an option 2px short of its floor. Each one was found by a
// human staring at two screenshots, one at a time, over several rounds.
//
// It also missed something bigger. Comparing the two DOMs mechanically
// surfaced five feed cards that never rendered at all — the lens questions,
// starved by an `else if` whose cadence (8) was a multiple of the test
// cadence (4), so the lens branch was unreachable. Nothing else in the tree
// could have caught that: it type-checks, it lints, it renders a perfectly
// plausible feed. See src/v2/data/feed-interleave.test.ts.
//
// USAGE
//
//   npm run dev                    # in another shell
//   node scripts/style-diff.mjs    # needs playwright on NODE_PATH
//
// Playwright is deliberately NOT a dependency of this repo — the e2e suite
// drives the emulators over raw Node, and adding a browser to the install
// for a design tool would tax every CI run and every contributor's clone
// for something run a handful of times per port. Install it ad hoc:
//
//   npm i --no-save playwright   (or point PW_EXECUTABLE at a chromium)
//
// This is not wired into CI for the same reason, and because a design
// reference is not a correctness gate: the prototype is allowed to be
// wrong, and some divergences from it are deliberate (see below).
//
// DELIBERATE DIVERGENCES — expected in the report, do not "fix":
//
//   "skip"  the prototype offers skip on every unanswered card; the app
//           hides it on test and lens questions, because those fill an
//           instrument and a silent skip reads as a gap in your own
//           results rather than a question you passed on.
//
//   c03     the prototype's "Your favourite Pokémon" catalogue card and its
//           20 demo entries (Gengar … Bidoof) — dropped because pk01
//           (pick-data.js) already asks it against the real Pokédex (D27).
//           Its absence also shifts card positions, which pairs the feed's
//           "i" context buttons off-by-one and reports their two ink
//           colours swapped in both directions — noise from the same cause,
//           not a colour miss.
//
//           READ THAT AS A DEFECT, NOT AS AN EXCEPTION (D185). It was
//           filed here, under "deliberate", as though it were a fact about
//           c03. It is a fact about the JOIN: any count that differs
//           between the builds shifts every later occurrence of a repeated
//           string, and the pairs that come out of the shift look exactly
//           like design faults. It cost a confident, wrong finding on the
//           Groups stop — a `span` avatar paired against an svg `text`
//           glyph, reported as five differences on a file that had not
//           changed. Keying by tag as well as text (see COLLECT) removes
//           the worst of it; the rest is why a surprising row is worth
//           opening both DOMs over before it is written down.
//
//   ground  three surface values this repo tuned and the prototype never
//           took back: --surface-a mixes the accent at 98% (prototype 94%,
//           and re-declared per tab), the header/tabbar blur saturates at
//           1.4 (prototype 1.05), and .app-body::before is 320px at 6%
//           (prototype 440px at 10%). Together they are the "quieter
//           ground" this app ships; the v17 sync (D43) left them alone
//           deliberately. Expect them in every colour report.
//
// Anything else it reports is probably a miss.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// Resolved at runtime, not by a static import: playwright is not a
// dependency here (see the note above), and ESM ignores NODE_PATH, so a
// static import would be an unrecoverable crash rather than an instruction.
// PW_MODULE lets you point at an install living somewhere else entirely.
let chromium;
try {
  ({ chromium } = await import(process.env.PW_MODULE || "playwright"));
} catch {
  console.error(
    "style-diff needs playwright, which this repo deliberately does not depend on.\n" +
    "  npm i --no-save playwright\n" +
    "or point at an existing install:\n" +
    "  PW_MODULE=/path/to/node_modules/playwright/index.js node scripts/style-diff.mjs\n" +
    "If that install has no browsers, add PW_EXECUTABLE=/path/to/chromium.",
  );
  process.exit(2);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTO = process.env.PROTO_URL
  || "file://" + path.join(HERE, "..", "design", "InSight_standalone_18.html");
const APP = process.env.APP_URL || "http://localhost:5173/";
const EXE = process.env.PW_EXECUTABLE || undefined;

// Own text only — text belonging to this element rather than a descendant.
// That gives one row per rendered string, which is a stable join key across
// two builds whose DOM shapes differ.
//
// THE TAG IS PART OF THE KEY, AND IT HAS TO BE (D185). The key was text
// plus its nth occurrence, so the nth "LA" in one build paired with the nth
// "LA" in the other — fine until the two builds render a different NUMBER
// of them, at which point every occurrence after the first extra one pairs
// with its neighbour and the report fills with differences that are really
// just the offset.
//
// It is not a hypothetical: the Groups stop draws the same initials twice,
// as chip avatars (`span`) and as constellation nodes (svg `text`), and the
// demo roster for The Crew is five members in the prototype and seven here.
// The join therefore paired a `span` avatar against an svg `text` and
// reported the difference between a filled disc and a bare glyph — radius
// 50% vs 0, white vs ink, a background vs none — as five style faults on a
// module that is byte-identical to the prototype apart from its ESM
// conversion. That reads exactly like a real finding, and it cost a
// commit's worth of chasing.
//
// Keying by tag as well as text does not fix an off-by-one WITHIN one tag —
// nothing cheap does — but it stops the two worst cases, an svg glyph
// pairing with a div and a heading pairing with a button, and those are the
// pairs whose diffs look most like design drift.
const COLLECT = `(() => {
  const out = {};
  const seen = {};
  const walk = (el) => {
    for (const node of el.children) {
      const own = [...node.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(" ")
        .trim();
      if (own && own.length <= 60) {
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const cs = getComputedStyle(node);
          // localName, not tagName: an svg <text> reports 'text' here and
          // 'text' there, while tagName is case-shifted between the HTML
          // and SVG namespaces on some engines.
          const k = own + "@" + node.localName;
          seen[k] = (seen[k] || 0) + 1;
          out[k + "#" + seen[k]] = {
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, ""),
            letterSpacing: cs.letterSpacing,
            textTransform: cs.textTransform,
            color: cs.color,
            bg: cs.backgroundColor,
            radius: cs.borderRadius,
            padding: cs.padding,
          };
        }
      }
      walk(node);
    }
  };
  walk(document.querySelector(".app") || document.body);
  return out;
})()`;

// One entry per screen worth comparing. Each `go` runs in the page and
// leaves it on that screen; both builds get the same sequence.
//
// SCOPED TO A RULER BY ITS OWN NAME, and that is load-bearing (D185). Both
// rulers publish `[role=tab]`, and three of the labels collide — the
// daily's axis runs World · Circle · 1v1 and the Mirror's runs You · Circle
// · Groups · Near · City · Country · World. An unscoped `aria-label ===
// 'Circle'` therefore matches whichever ruler is on screen, which is the
// right answer by accident on one tab and the wrong one on the other.
//
// WHAT THESE USED TO SAY. Three steps drove `.sd-switch-btn`, the daily's
// mode switcher — a control the v17 sync replaced with the ruler (D43), so
// the class matches nothing in EITHER build and had not for six versions.
// A fourth called the Mirror's first screen `mirror-near`; the Mirror opens
// on You, so that name described a stop the sweep never visited. None of it
// showed, because the string-vs-IIFE bug below meant no step ran at all —
// two faults that hid each other, which is why the check that ends this
// file reports movement rather than trusting it.
const STOP = (ruler, label) =>
  `() => { const r=[...document.querySelectorAll('[role=tablist]')]`
  + `.find(x=>(x.getAttribute('aria-label')||'').includes(${JSON.stringify(ruler)}));`
  + ` if(!r) return; const t=[...r.querySelectorAll('[role=tab]')]`
  + `.find(x=>(x.getAttribute('aria-label')||x.textContent||'').trim()===${JSON.stringify(label)}); t&&t.click(); }`;
const DAILY = "How far this answer reaches";
const MIRROR = "How far the mirror reaches";

const SCREENS = [
  ["daily-world", `() => { window.goTab && window.goTab('track'); }`],
  ["daily-circle", STOP(DAILY, "Circle")],
  ["daily-duo", STOP(DAILY, "1v1")],
  ["daily-back", STOP(DAILY, "World")],
  ["mirror-you", `() => { window.goTab && window.goTab('mirror'); }`],
  ["mirror-circle", STOP(MIRROR, "Circle")],
  ["mirror-groups", STOP(MIRROR, "Groups")],
  ["mirror-near", STOP(MIRROR, "Near")],
  ["mirror-city", STOP(MIRROR, "City")],
  ["mirror-country", STOP(MIRROR, "Country")],
  ["mirror-world", STOP(MIRROR, "World")],
];

const FIELDS = ["fontSize", "fontWeight", "fontFamily", "letterSpacing", "textTransform", "color", "bg", "radius", "padding"];
// Divergences the app makes on purpose. Keyed by the text they attach to.
const EXPECTED_MISSING = new Set(["skip"]);

// What screen the page is actually on, cheaply. Not for the report — for
// the navigation check below, which is the whole reason it exists.
const WHERE = `(() => {
  const app = document.querySelector('.app');
  return (app && (app.getAttribute('data-view') || app.getAttribute('data-tab')) || '?')
    + '#' + document.querySelectorAll('.app *').length;
})()`;

async function capture(browser, url) {
  // 1440x900 puts both builds in the same centred 402px phone shell; at a
  // phone-width viewport the app fills the screen and the prototype does
  // not, so every measurement would differ for the wrong reason.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const shots = {};
  const where = {};
  for (const [name, go] of SCREENS) {
    // WRAPPED IN AN IIFE, AND THAT IS NOT A STYLE CHOICE (D185).
    //
    // `page.evaluate(str)` evaluates a STRING as an expression. Handed the
    // source of an arrow function it therefore builds a function and
    // throws it away — `evaluate('() => 1 + 1')` returns undefined, and
    // `evaluate('(() => 1 + 1)()')` returns 2. Every `go` below is an
    // arrow-function source, so from this tool's first commit until D185
    // not one of them ran: the loop captured whatever screen the app boots
    // on, once per entry, and diffed it against itself.
    //
    // The report that produced was "compared N elements across 7 screens"
    // with almost nothing to say, which is exactly what a passing run
    // looks like. That is the failure mode worth naming — a design gate
    // whose silence means "I never looked".
    await page.evaluate(`(${go})()`);
    await page.waitForTimeout(1100);
    shots[name] = await page.evaluate(COLLECT);
    where[name] = await page.evaluate(WHERE);
  }
  await ctx.close();
  return { shots, errors, where };
}

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
let proto, app;
try {
  proto = await capture(browser, PROTO);
  app = await capture(browser, APP);
} finally {
  await browser.close();
}

// DID THE WALK ACTUALLY WALK? (D185)
//
// The bug above was invisible because a tool that looks at one screen
// seven times reports the same shape as a tool that looks at seven. So
// this checks the only thing that distinguishes them: a `go` that lands on
// the screen it just came from did nothing, in whichever build it happened
// in. Reported per build, because a selector can rot on one side alone —
// the prototype is frozen and the app is not.
//
// Not fatal. A screen legitimately reachable only from another screen will
// repeat if its predecessor failed, so one broken selector prints several
// lines; the list is a worklist, not a verdict.
const stuck = [];
for (const build of [["prototype", proto], ["app", app]]) {
  const [label, cap] = build;
  let prev = null;
  for (const [screen] of SCREENS) {
    const here = cap.where[screen];
    if (prev !== null && here === prev) stuck.push(`${label}/${screen}`);
    prev = here;
  }
}
if (stuck.length) {
  console.log(`\n!! ${stuck.length} screen(s) did not move — their step ran and changed nothing,`);
  console.log(`   so what got compared is the screen before them, twice:`);
  console.log(`   ${stuck.join(", ")}`);
  console.log(`   Fix the step's selector in SCREENS before reading anything below.\n`);
}

const rows = [];
const missing = [];
let compared = 0;
for (const [screen] of SCREENS) {
  const A = proto.shots[screen] || {};
  const B = app.shots[screen] || {};
  for (const key of Object.keys(A)) {
    // key is `text@tag#n` (see COLLECT) — the report wants the text alone.
    const text = key.replace(/@[\w-]+#\d+$/, "");
    if (!(key in B)) {
      if (!EXPECTED_MISSING.has(text)) missing.push({ screen, text });
      continue;
    }
    compared++;
    const diffs = FIELDS.filter((f) => A[key][f] !== B[key][f]);
    if (diffs.length) rows.push({ screen, text, diffs: diffs.map((f) => ({ f, proto: A[key][f], app: B[key][f] })) });
  }
}

console.log(`compared ${compared} elements across ${SCREENS.length} screens`);
if (app.errors.length) console.log(`  APP PAGE ERRORS: ${JSON.stringify(app.errors.slice(0, 3))}`);

// Group by (field, protoValue, appValue): one source line usually explains
// dozens of rows, and the grouped view is the actual worklist.
const byCause = new Map();
for (const r of rows) {
  for (const d of r.diffs) {
    const k = `${d.f}: ${d.proto}  ->  ${d.app}`;
    if (!byCause.has(k)) byCause.set(k, []);
    byCause.get(k).push(`${r.screen}/${r.text}`);
  }
}
if (byCause.size) {
  console.log(`\n${byCause.size} distinct style differences (${rows.length} elements):`);
  for (const [cause, where] of [...byCause].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  [${String(where.length).padStart(4)}] ${cause}`);
    console.log(`          e.g. ${where.slice(0, 3).join("  |  ")}`);
  }
}

// Text the prototype renders and the app does not. This is the channel that
// found the starved lens cards — treat a jump here as missing UI, not noise.
if (missing.length) {
  const byText = new Map();
  for (const m of missing) byText.set(m.text, (byText.get(m.text) || 0) + 1);
  console.log(`\n${byText.size} strings in the prototype but not the app:`);
  for (const [text, n] of [...byText].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`  [${String(n).padStart(4)}] ${JSON.stringify(text)}`);
  }
}

const report = { compared, causes: byCause.size, elements: rows.length, missing: missing.length, rows, missingText: missing };
fs.writeFileSync(path.join(HERE, "..", "style-diff.json"), JSON.stringify(report, null, 1));
console.log(`\nfull report -> style-diff.json`);
if (!byCause.size && !missing.length) console.log("app matches the prototype on every compared element.");
