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
          seen[own] = (seen[own] || 0) + 1;
          out[own + "#" + seen[own]] = {
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
const SCREENS = [
  ["daily-world", `() => { window.goTab && window.goTab('track'); }`],
  ["daily-group", `() => { const b=[...document.querySelectorAll('.sd-switch-btn')].find(x=>x.textContent.trim().startsWith('Group')); b&&b.click(); }`],
  ["daily-duo", `() => { const b=[...document.querySelectorAll('.sd-switch-btn')].find(x=>x.textContent.trim().startsWith('1v1')); b&&b.click(); }`],
  ["mirror-near", `() => { window.goTab && window.goTab('mirror'); }`],
  ["mirror-you", `() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.getAttribute('aria-label')==='You'); t&&t.click(); }`],
  ["mirror-circle", `() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.getAttribute('aria-label')==='Circle'); t&&t.click(); }`],
  ["mirror-world", `() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.getAttribute('aria-label')==='World'); t&&t.click(); }`],
];

const FIELDS = ["fontSize", "fontWeight", "fontFamily", "letterSpacing", "textTransform", "color", "bg", "radius", "padding"];
// Divergences the app makes on purpose. Keyed by the text they attach to.
const EXPECTED_MISSING = new Set(["skip"]);

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
  for (const [name, go] of SCREENS) {
    await page.evaluate(go);
    await page.waitForTimeout(1100);
    shots[name] = await page.evaluate(COLLECT);
  }
  await ctx.close();
  return { shots, errors };
}

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
let proto, app;
try {
  proto = await capture(browser, PROTO);
  app = await capture(browser, APP);
} finally {
  await browser.close();
}

const rows = [];
const missing = [];
let compared = 0;
for (const [screen] of SCREENS) {
  const A = proto.shots[screen] || {};
  const B = app.shots[screen] || {};
  for (const key of Object.keys(A)) {
    const text = key.replace(/#\d+$/, "");
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
