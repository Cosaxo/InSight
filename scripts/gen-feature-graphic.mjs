// Rasterise the Play Store feature graphic (1024×500, mandatory for
// every Play listing).
//
//   npm run build && node scripts/gen-feature-graphic.mjs
//
// Writes design/store/feature-graphic.png.
//
// The composition is built INSIDE the running app's document, not in a
// standalone HTML file: the script loads the real app, then replaces the
// body. That means --ink, --accent, --surface and Hanken Grotesk resolve
// to whatever the app's stylesheet says today, so the graphic cannot
// drift from the product's palette the way a hand-copied hex value
// would. Same reasoning as gen-icons.mjs rasterising from mark.svg
// rather than from a pasted PNG — one source, derived outputs.
//
// The mark is the same design/icon/mark.svg the launcher icons come
// from, inlined here so the two never disagree.
//
// Note the composition does NOT carry the .app class even though that is
// where the app's own chrome lives: .app sets flex-direction:column and
// padding-top:62px for the fixed header, which silently stacked and
// offset the first version of this graphic. The design tokens are on
// :root, so a plain div inherits the whole palette without the layout.
//
// Play crops and overlays this image in some placements (it can appear
// behind the app icon in store promos), so the composition stays
// centred with generous margins and nothing load-bearing near an edge.

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadPlaywright, ensureServer, pngSize } from "./store-render.mjs";

const W = 1024;
const H = 500;
const OUT_DIR = join(ROOT, "design/store");
const OUT = join(OUT_DIR, "feature-graphic.png");

const TAGLINE = "Answer one question. See where you stand.";

// Pull the <g id="mark"> group out of the icon master so the graphic and
// the launcher icons are provably the same artwork.
const markSvg = readFileSync(join(ROOT, "design/icon/mark.svg"), "utf8");
const markInner = markSvg.slice(markSvg.indexOf('<g id="mark">'), markSvg.lastIndexOf("</svg>"));
if (!markInner.startsWith('<g id="mark">')) {
  console.error("gen-feature-graphic: design/icon/mark.svg has no <g id=\"mark\"> group.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const urlArg = (() => { const i = argv.indexOf("--url"); return i >= 0 ? argv[i + 1] : null; })();

const { url, stop: stopServer } = await ensureServer(urlArg);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

await page.goto(url, { waitUntil: "networkidle" });
// The webfont is loaded by the app itself; wait for it rather than
// guessing a timeout, or the graphic renders in the fallback system
// sans and nobody notices until it is on the listing.
await page.evaluate(() => document.fonts.ready);

await page.evaluate(({ markInner, tagline, W, H }) => {
  document.documentElement.setAttribute("data-theme", "light");
  document.body.innerHTML = `
    <div style="
      width:${W}px;height:${H}px;margin:0;display:flex;flex-direction:row;
      align-items:center;justify-content:center;gap:52px;
      background:
        radial-gradient(120% 140% at 82% 18%, color-mix(in oklch, var(--accent) 13%, transparent), transparent 62%),
        var(--surface-a, var(--surface));
      font-family:var(--sans);overflow:hidden;">
      <svg viewBox="0 0 100 100" width="188" height="188" style="flex:none;filter:drop-shadow(0 10px 26px color-mix(in oklch, var(--shadow-ink) 20%, transparent))">${markInner}</svg>
      <div style="display:flex;flex-direction:column;gap:14px;max-width:520px">
        <div style="font-size:82px;font-weight:800;letter-spacing:-0.045em;line-height:1;color:var(--ink)">in<span style="color:var(--accent)">Sight</span></div>
        <div style="font-size:27px;font-weight:600;line-height:1.28;color:var(--ink-2);letter-spacing:-0.012em">${tagline}</div>
      </div>
    </div>`;
  document.body.style.cssText = "margin:0;padding:0;overflow:hidden";
}, { markInner, tagline: TAGLINE, W, H });

await page.waitForTimeout(400);
mkdirSync(OUT_DIR, { recursive: true });
await page.screenshot({ path: OUT });
await browser.close();
stopServer();

const size = pngSize(OUT);
if (!size || size[0] !== W || size[1] !== H) {
  console.error(`gen-feature-graphic: got ${size ? size.join("x") : "unreadable"}, Play requires ${W}x${H}`);
  process.exit(1);
}
console.log(`gen-feature-graphic: design/store/feature-graphic.png  ${size.join("×")}  ✓`);
