// Capture the store screenshot set from the real app.
//
//   npm run build            # the captures are of dist/, not the dev server
//   node scripts/gen-screenshots.mjs
//   node scripts/gen-screenshots.mjs --scene reveal --profile iphone-6.9
//
// Writes design/store/screenshots/<profile>/NN-<scene>.png plus a
// manifest.json recording which mode the app was in when captured.
//
// Why Chromium and not a device farm: the shells wrap this exact React
// tree, so a Chromium render at the store's pixel dimensions is the same
// UI a phone shows — these are honest app pixels, not a mockup. Device
// frames and captions are composition on top, and belong in whatever
// tool does the marketing layout, not here.
//
// Two things here exist because getting them wrong is silent:
//
//   1. Every capture's pixel dimensions are asserted against the store
//      spec before the file is kept. App Store Connect and Play both
//      reject a wrong-sized upload, but they reject it at the END of a
//      long manual upload flow, so the cheap place to find out is here.
//   2. The manifest records demo vs live mode, AND which captures show
//      affordances that only exist in demo. Demo-mode captures are a
//      legitimate fallback (SHIP-CHECKLIST §3 / LAUNCH-PLAN's imagery
//      plan prefer live, after real answers exist), but some of them are
//      not merely "sample data" — they show controls a real user never
//      gets. Comments and "Who voted" are gated on `!S.live` by D1, so a
//      demo reveal capture advertises a feature the shipped app does not
//      have on a live question. App Store 2.3.3 rejects screenshots that
//      do not reflect the app, and this is the honest reading of that
//      rule rather than a technicality.
//
//      The app's own `LIVE.demoInProd` flag suppresses those controls,
//      but it also raises a "Preview · sample people" banner — correct
//      behaviour for a degraded live build, wrong for a store asset. So
//      there is no clean demo capture of the reveal, which is exactly
//      why the plan says to capture against seeded production.

import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadPlaywright, ensureServer, pngSize } from "./store-render.mjs";

const OUT_ROOT = join(ROOT, "design/store/screenshots");

// Captions come from design/store/listing.json, which is the marketing copy
// file check-store-listing.mjs already owns. They used to be literals in
// SCENES below AND keys in that file, and three of the six had already
// drifted apart — the same "two copies of one string" shape D40 Part 1
// refuses for the duel banks. One source, and a missing key is an error
// rather than an undefined caption written into the manifest.
const CAPTIONS = JSON.parse(
  readFileSync(join(ROOT, "design/store/listing.json"), "utf8"),
).screenshotCaptions;

function captionFor(n, sceneId) {
  const key = `${n}-${sceneId}`;
  const caption = CAPTIONS[key];
  if (!caption) {
    console.error(
      `gen-screenshots: no caption for "${key}" in design/store/listing.json.\n`
      + "    Add it under screenshotCaptions — the key is the generated\n"
      + "    filename without .png, so it changes when a scene is renamed\n"
      + "    or reordered.");
    process.exit(1);
  }
  return caption;
}

// ── device profiles ─────────────────────────────────────────────────
// Apple 2026 only needs the largest device in each family and scales the
// rest down; TARGETED_DEVICE_FAMILY = 1 (iPhone only) in project.pbxproj,
// so the 13" iPad set every guide lists does not apply to this app.
// Play wants 9:16 phone shots; 1080x1920 is the recommended size.
const PROFILES = {
  "iphone-6.9": { width: 440, height: 956, scale: 3, expect: [1320, 2868], store: "App Store — iPhone 6.9\"" },
  "play-phone": { width: 360, height: 640, scale: 3, expect: [1080, 1920], store: "Play — phone" },
};

// ── scenes ──────────────────────────────────────────────────────────
// Each scene drives the real UI from a cold load. Selectors go through
// roles and visible text, so they break loudly when a label moves rather
// than silently capturing the wrong screen.
//
// Note the /mirror/i flag: the dock's DOM text is lowercase and CSS
// uppercases it, so a case-sensitive match finds nothing. Found by
// dumping the tabbar, not by reading the JSX.
const SCENES = [
  {
    id: "daily",
    async drive() {},
  },
  {
    id: "reveal",
    async drive(p) {
      await p.getByRole("button", { name: "Absolutely" }).first().click();
      await p.waitForTimeout(1400); // the split animates in
    },
  },
  {
    id: "mirror",
    async drive(p) {
      await p.getByRole("button", { name: /mirror/i }).first().click();
      await p.waitForTimeout(1200);
    },
  },
  {
    id: "duel",
    async drive(p) {
      await p.getByRole("button", { name: /1v1/ }).first().click();
      await p.waitForTimeout(900);
    },
  },
  {
    id: "group",
    async drive(p) {
      await p.getByRole("button", { name: /Group/ }).first().click();
      await p.waitForTimeout(900);
    },
  },
  {
    id: "profiles",
    async drive(p) {
      // Count-free on purpose: the accessible name states the test count in
      // words and is derived from PASSIVE.KEYS, so a new test changes it.
      await p.getByRole("button", { name: /Your \w+ profiles/ }).first().click();
      await p.waitForTimeout(900);
    },
  },
];

// ── args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const onlyScene = argOf("--scene");
const onlyProfile = argOf("--profile");
const urlArg = argOf("--url");

const profiles = Object.entries(PROFILES).filter(([k]) => !onlyProfile || k === onlyProfile);
const scenes = SCENES.filter((s) => !onlyScene || s.id === onlyScene);
if (!profiles.length) { console.error(`gen-screenshots: unknown --profile. Have: ${Object.keys(PROFILES).join(", ")}`); process.exit(1); }
if (!scenes.length) { console.error(`gen-screenshots: unknown --scene. Have: ${SCENES.map((s) => s.id).join(", ")}`); process.exit(1); }

const { url, stop: stopServer } = await ensureServer(urlArg);
const { chromium } = await loadPlaywright();
// PLAYWRIGHT_CHROMIUM_EXECUTABLE escapes the version pin. Playwright bakes a
// browser BUILD NUMBER into the path it looks for, so an environment with a
// preinstalled Chromium (CI images, sandboxes) fails with "Executable doesn't
// exist at .../chromium_headless_shell-<n>" whenever the installed playwright
// is not the exact version that image was built against — and the advice it
// prints, `npx playwright install`, is the one thing such an environment
// usually forbids. Unset in normal use, so the checklist's
// `npx playwright install chromium` path is unchanged.
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {},
);
const problems = [];
const notShippable = new Set();
const manifest = { capturedFrom: url, mode: null, profiles: {} };

for (const [profileId, cfg] of profiles) {
  const dir = join(OUT_ROOT, profileId);
  mkdirSync(dir, { recursive: true });
  // Clear stale captures so a renamed scene cannot leave an orphan file
  // that gets uploaded by a human globbing the directory.
  if (!onlyScene) for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(join(dir, f));

  const shots = [];
  for (const [i, scene] of scenes.entries()) {
    const page = await browser.newPage({
      viewport: { width: cfg.width, height: cfg.height },
      deviceScaleFactor: cfg.scale,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200); // spec layer settles after first paint

    if (manifest.mode === null) {
      manifest.mode = await page.evaluate(() =>
        (window.LIVE && window.LIVE.enabled) ? "live" : "demo");
    }

    await scene.drive(page);
    await page.waitForTimeout(500);

    // Demo-only affordances, by their accessible names. Checked on the
    // live DOM rather than eyeballed later, because "is that button in
    // the shipped app?" is not answerable from a PNG.
    //
    // BOTH SURVIVE D94, and the reason narrowed rather than went away.
    // D94 made answers public, so named who-voted is a real shipped
    // feature now — but these two controls open the DEMO's sheets, whose
    // people come from sample-data.js. Fabricated people in a store
    // screenshot is the D1 half that D94 did not touch, and it is still
    // a 2.3.3 problem.
    //
    // Note the live who-voted button is a DIFFERENT accessible name
    // ("who voted", world-feed.jsx) from the demo one ("Who voted what",
    // daily-split.jsx), so an honest live capture showing real named
    // voters does not trip this. That near-collision is the whole reason
    // to match on exact labels here rather than a substring.
    const demoOnly = await page.evaluate(() =>
      ["Comments", "Who voted what"].filter((label) => {
        const el = document.querySelector(`[aria-label="${label}"]`);
        return el && el.getBoundingClientRect().width > 0;
      }));

    const n = String((onlyScene ? SCENES.findIndex((s) => s.id === scene.id) : i) + 1).padStart(2, "0");
    const file = join(dir, `${n}-${scene.id}.png`);
    await page.screenshot({ path: file });
    await page.close();

    const size = pngSize(file);
    const ok = size && size[0] === cfg.expect[0] && size[1] === cfg.expect[1];
    if (!ok) problems.push(`${profileId}/${scene.id}: got ${size ? size.join("x") : "unreadable"}, store wants ${cfg.expect.join("x")}`);
    if (errors.length) problems.push(`${profileId}/${scene.id}: page error — ${errors[0].slice(0, 160)}`);

    console.log(
      `  ${ok && !errors.length ? "✓" : "✗"} ${profileId}/${n}-${scene.id}.png  ${size ? size.join("×") : "?"}` +
      (demoOnly.length ? `  ⚠ demo-only UI: ${demoOnly.join(", ")}` : ""));
    shots.push({
      file: `${n}-${scene.id}.png`, scene: scene.id, caption: captionFor(n, scene.id),
      ...(demoOnly.length ? { demoOnlyAffordances: demoOnly } : {}),
    });
    if (demoOnly.length) notShippable.add(`${scene.id} (${demoOnly.join(", ")})`);
  }
  manifest.profiles[profileId] = { store: cfg.store, expect: cfg.expect.join("×"), shots };
}

await browser.close();
stopServer();

// notShippableAsIs is set BEFORE the write. It used to be assigned on the
// next line, so the field was computed, printed to the console, and then
// discarded — the file never carried it. That only became load-bearing when
// asc-push started refusing to upload captures the manifest flags, because
// a consumer reading the file saw a summary that was never there.
manifest.notShippableAsIs = [...notShippable];

mkdirSync(OUT_ROOT, { recursive: true });
writeFileSync(join(OUT_ROOT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\ngen-screenshots: mode = ${manifest.mode.toUpperCase()}`);
if (manifest.mode === "demo") {
  console.log(
    "  Demo data. Legitimate as a preview, but the plan wants captures\n" +
    "  against seeded production once real answers exist — the world split\n" +
    "  is the number that should be measured. docs/LAUNCH-RUNBOOK.md 4.1.",
  );
}
if (notShippable.size) {
  console.log(
    `\n  DO NOT UPLOAD ${notShippable.size} of these as-is:\n` +
    [...notShippable].map((s) => `    - ${s}`).join("\n") +
    "\n  Those controls are gated on !S.live (D1) — a real user never sees\n" +
    "  them on a live question, and App Store 2.3.3 wants screenshots that\n" +
    "  reflect the app. Recapture in live mode.",
  );
}
if (problems.length) {
  console.error(`\ngen-screenshots: ${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`gen-screenshots: ${scenes.length} scene(s) × ${profiles.length} profile(s) → design/store/screenshots/`);
