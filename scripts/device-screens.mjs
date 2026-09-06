// Drive the built app through every screen at phone geometry, capture each
// one, and write a report of what the pixels cannot say by themselves.
//
//   npm run build                       # captures are of dist/, never the dev server
//   npm run screens                     # every profile, every scene → .device-screens/
//   node scripts/device-screens.mjs --out .nightb/screens/web
//   node scripts/device-screens.mjs --profile iphone-se --scene mirror-stops
//   node scripts/device-screens.mjs --list
//   node scripts/device-screens.mjs --android --out results/android
//
// WHY THIS EXISTS. Every gate in this repository reads names, types and
// counts; the mount suites render the whole App but into jsdom, which has
// no layout. So a row that wraps onto a third line on a 375px phone, a
// button that lands under the home indicator, a lens tab whose label no
// longer fits, a stop that paints nothing — all of it was invisible to CI
// and found, when it was found, by the owner on a phone. This is the pass
// the night shifts run instead: the same React tree the shells wrap,
// rendered by Chromium at the three screens that bracket the phones we
// ship to, walked screen by screen, with each capture checked for the
// facts a PNG hides (content wider than its box, a control off-screen, an
// uncaught error, the boundary's text, a tap that changed nothing) and
// then LOOKED AT — the report names the PNGs, and the reader opens them.
//
// Why Chromium and not only an emulator: gen-screenshots.mjs's reason —
// the shells wrap this exact tree, so a Chromium render at the phone's
// pixel geometry is the same UI a phone shows — plus one this file adds:
// the night shift's container has no /dev/kvm (measured 2026-09-06), so an
// Android emulator cannot run there at all and an iOS simulator needs
// macOS. `--android` is the same scenes attached to the app's real WebView
// on an emulator, which is what .github/workflows/device-screens.yml runs
// on a runner that has KVM; the report shape is identical so a reader
// compares the two directly.
//
// Demo build, deliberately. A build without VITE_V2_LIVE renders the demo
// deck, which every mount suite already renders: deterministic, no backend,
// no anonymous account created and no vote written to production on every
// nightly run. The first-launch walkthrough (D393) and the live boot are
// therefore NOT on this pass — walkthroughNeeded() is false in a demo
// build by design — and the report says so rather than pretending.
//
// Playwright is resolved from the ambient install, never from package.json
// (scripts/store-render.mjs has the reason and the one-line fix).

import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { ROOT, loadPlaywright, ensureServer } from "./store-render.mjs";
import { PROFILES, BOUNDARY_TEXT, slug, pageChecks, renderReport, summarize } from "./device-screens-lib.mjs";

// ── args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const has = (flag) => argv.includes(flag);
const outDir = resolve(ROOT, argOf("--out") || ".device-screens");
const onlyProfile = argOf("--profile");
const onlyScene = argOf("--scene");
const urlArg = argOf("--url");
const android = has("--android");
const pkg = argOf("--pkg") || "com.cosaxo.insight";

// ── drives ──────────────────────────────────────────────────────────
// Selectors go through roles and visible text, the way the mount suites
// and gen-screenshots.mjs find things, so a moved label breaks loudly here
// rather than quietly capturing the wrong screen.

// The daily's nav is the ruler — role="tab" stops labelled World · Circle ·
// 1v1 — and TWO rulers carry that label at once: the in-flow row and the
// compact copy the header holds ready to dock. The in-flow one is the one
// outside .app-header (smoke-nav.test.jsx resolves it the same way).
async function clickRulerStop(page, label) {
  await page.evaluate((want) => {
    const rulers = [...document.querySelectorAll('[role="tablist"][aria-label="How far this answer reaches"]')];
    const row = rulers.find((r) => !r.closest(".app-header"));
    const tab = row && [...row.querySelectorAll('[role="tab"]')].find((b) => b.textContent.trim() === want);
    if (!tab) throw new Error(`no in-flow ruler stop "${want}"`);
    tab.click();
  }, label);
}

// The dock's DOM text is lowercase and CSS uppercases it — /mirror/i, not
// "Mirror" (found by dumping the tabbar, gen-screenshots.mjs says).
async function openMirror(page) {
  await page.getByRole("button", { name: /^mirror$/i }).first().click();
  await page.waitForTimeout(1200);
}

const mirrorRail = (page) => page.getByRole("tablist", { name: /how far the mirror reaches/i }).first();

async function mirrorStop(page, label) {
  await mirrorRail(page).getByRole("tab", { name: label, exact: true }).click();
  await page.waitForTimeout(900);
}

// Scroll the tallest scroller under the shell by a fraction of the
// viewport. The shell is position: fixed; overflow: hidden (spec/iOS.jsx),
// so the page itself never scrolls — the feed lives in an inner scroller,
// and which element that is depends on the tab, so it is found rather than
// named.
async function scrollMain(page, fraction) {
  return page.evaluate((f) => {
    const cands = [...document.querySelectorAll("body *")].filter((el) => {
      const cs = getComputedStyle(el);
      return (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 10;
    });
    cands.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    const el = cands[0];
    if (!el) return null;
    el.scrollTop += Math.round(el.clientHeight * f);
    return `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).trim().split(/\s+/)[0] : ""}`;
  }, fraction);
}

async function tabLabels(tablist) {
  return tablist.getByRole("tab").evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") || e.textContent.trim()).filter(Boolean));
}

// Each scene starts from a cold load of the app and drives from there.
// `c.snap(label)` captures + checks; `c.skip(reason)` records a scene that
// this build cannot show (the gated tab), which is a fact worth a line and
// never a failure.
const SCENES = [
  { id: "daily", about: "first paint — today's question at the World stop",
    async drive(p, c) { await c.snap("daily", { compare: false }); } },
  { id: "daily-reveal", about: "the split after a vote on today's question",
    async drive(p, c) {
      // The first option of today's card, whatever its text; `sd-opt` is
      // the ballot buttons' marker class (daily-split.jsx).
      await p.locator("button.sd-opt").first().click();
      await p.waitForTimeout(1600); // the split animates in
      await c.snap("daily-reveal");
    } },
  { id: "daily-feed", about: "the feed under the card, two screens down",
    async drive(p, c) {
      for (const n of [1, 2]) {
        const scroller = await scrollMain(p, 0.85);
        if (!scroller) throw new Error("nothing on the daily tab scrolls");
        await p.waitForTimeout(900);
        await c.snap(`daily-feed-${n}`);
      }
    } },
  { id: "daily-circle", about: "the Circle stop of the daily ruler",
    async drive(p, c) { await clickRulerStop(p, "Circle"); await p.waitForTimeout(900); await c.snap("daily-circle"); } },
  { id: "daily-1v1", about: "the 1v1 stop of the daily ruler",
    async drive(p, c) { await clickRulerStop(p, "1v1"); await p.waitForTimeout(900); await c.snap("daily-1v1"); } },
  { id: "mirror", about: "the Mirror tab as it lands",
    async drive(p, c) { await openMirror(p); await c.snap("mirror"); } },
  { id: "mirror-stops", about: "every stop of the Mirror's rail, in order",
    async drive(p, c) {
      await openMirror(p);
      const labels = await tabLabels(mirrorRail(p));
      if (!labels.length) throw new Error("the Mirror rail has no stops");
      for (const label of labels) { await mirrorStop(p, label); await c.snap(`mirror-${slug(label)}`); }
    } },
  { id: "mirror-lenses", about: "every lens of the World stop's lens row",
    async drive(p, c) {
      await openMirror(p);
      await mirrorStop(p, "World");
      const row = p.getByRole("tablist", { name: /^lenses$/i }).first();
      const labels = await tabLabels(row);
      if (!labels.length) throw new Error("the World stop has no lens row");
      for (const label of labels) {
        await row.getByRole("tab", { name: label, exact: true }).click();
        await p.waitForTimeout(900);
        await c.snap(`mirror-world-${slug(label)}`);
      }
    } },
  { id: "profile", about: "the profile overlay, then its test profiles",
    async drive(p, c) {
      await p.getByRole("button", { name: "Profile", exact: true }).click();
      await p.waitForTimeout(900);
      await c.snap("profile");
      // Count-free on purpose: the accessible name states the test count
      // in words and is derived from PASSIVE.KEYS, so a new test changes it.
      const chip = p.getByRole("button", { name: /Your \w+ profiles/ }).first();
      if (await chip.count()) {
        await chip.click({ force: true }); // a settling chip is never "still" (gen-screenshots run 9)
        await p.waitForTimeout(900);
        await c.snap("profile-tests");
      }
    } },
  { id: "search", about: "the search overlay",
    async drive(p, c) {
      await p.getByRole("button", { name: "Search", exact: true }).click();
      await p.waitForTimeout(900);
      await c.snap("search");
    } },
  { id: "patterns", about: "the Patterns tab, when the build has crossed its gate",
    async drive(p, c) {
      const tab = p.getByRole("button", { name: /^patterns$/i });
      if (!(await tab.count())) return c.skip("the tab is mounted on a data condition (D265) and this build has not crossed it — absent by design");
      await tab.first().click();
      await p.waitForTimeout(1200);
      await c.snap("patterns");
    } },
];

if (has("--list")) {
  for (const s of SCENES) console.log(`${s.id.padEnd(16)} ${s.about}`);
  process.exit(0);
}

const scenes = SCENES.filter((s) => !onlyScene || s.id === onlyScene);
if (!scenes.length) { console.error(`device-screens: unknown --scene. Have: ${SCENES.map((s) => s.id).join(", ")}`); process.exit(1); }

// ── the run ─────────────────────────────────────────────────────────
const pw = await loadPlaywright();
const report = {
  capturedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  source: null, mode: null, target: null,
  profiles: {}, screens: [], skipped: [],
};
const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");

// Wait for the app to be up: the dock appearing IS the ready signal in
// both modes (the app renders only after initLive().finally — main.jsx),
// then let the spec layer settle after first paint.
async function waitReady(page) {
  await page.getByRole("button", { name: /^mirror$/i }).first().waitFor({ timeout: 60_000 });
  try {
    await page.waitForFunction(
      () => !window.LIVE || !window.LIVE.demoInProd || !!window.LIVE.bootError, null, { timeout: 30_000 });
  } catch { /* a live build that never attached — recorded by readMode */ }
  await page.waitForTimeout(1200);
}

async function readMode(page) {
  return page.evaluate(() => ({
    live: !!(window.LIVE && window.LIVE.enabled),
    liveBuild: !!(window.LIVE && (window.LIVE.enabled || window.LIVE.demoInProd)),
    bootError: (window.LIVE && window.LIVE.bootError) || "",
  }));
}

// Event buffers per page, drained by every snap so a finding lands on the
// capture it belongs to rather than on the last one of the scene.
function watch(page) {
  const buf = { pageErrors: [], consoleErrors: [], failedRequests: [] };
  page.on("pageerror", (e) => buf.pageErrors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") buf.consoleErrors.push(m.text().slice(0, 300)); });
  page.on("requestfailed", (r) => {
    const why = (r.failure() && r.failure().errorText) || "";
    if (!/ERR_ABORTED/.test(why)) buf.failedRequests.push(`${why} ${r.url()}`.slice(0, 300));
  });
  page.on("response", (r) => { if (r.status() >= 400) buf.failedRequests.push(`${r.status()} ${r.url()}`.slice(0, 300)); });
  return {
    drain() {
      const out = { pageErrors: buf.pageErrors, consoleErrors: buf.consoleErrors, failedRequests: buf.failedRequests };
      buf.pageErrors = []; buf.consoleErrors = []; buf.failedRequests = [];
      return out;
    },
  };
}

/**
 * Run every scene against one profile. `open()` yields a fresh page at the
 * app's first paint; `frame()` captures the device's own screen when there
 * is one (the emulator), else the page.
 */
async function runProfile(profileId, profile, { open, close, frame }) {
  report.profiles[profileId] = { label: profile.label, width: profile.width, height: profile.height, scale: profile.scale };
  const dir = join(outDir, profileId);
  mkdirSync(dir, { recursive: true });
  // Clear stale captures so a renamed scene cannot leave an orphan PNG that
  // a reader takes for tonight's.
  if (!onlyScene) for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(join(dir, f));

  let n = 0;
  for (const scene of scenes) {
    const { page, watcher } = await open();
    let last = null;
    const ctx = {
      async snap(label, { compare = true } = {}) {
        await page.waitForTimeout(300);
        const web = await page.screenshot();
        const buf = frame ? await frame() : web;
        const hash = sha1(web);
        n += 1;
        const file = `${profileId}/${String(n).padStart(2, "0")}-${label}.png`;
        writeFileSync(join(outDir, file), buf);
        const checks = await page.evaluate(pageChecks, BOUNDARY_TEXT);
        const events = watcher.drain();
        const entry = { profile: profileId, scene: scene.id, n: String(n).padStart(2, "0"), id: label, file,
          checks, ...events, unchanged: compare && last !== null && last === hash };
        report.screens.push(entry);
        last = hash;
        const flags = [];
        if (checks.boundary) flags.push("BOUNDARY");
        if (events.pageErrors.length) flags.push("page error");
        if (entry.unchanged) flags.push("unchanged");
        if (checks.clipped.length) flags.push(`clipped ×${checks.clipped.length}`);
        if (checks.offscreen.length) flags.push(`off-screen ×${checks.offscreen.length}`);
        console.log(`  ${flags.some((f) => f === "BOUNDARY" || f === "page error") ? "✗" : "✓"} ${file}${flags.length ? "  ⚠ " + flags.join(", ") : ""}`);
        return entry;
      },
      skip(reason) { report.skipped.push({ id: scene.id, profile: profileId, reason }); console.log(`  – ${profileId}/${scene.id}  (skipped: ${reason})`); },
    };
    // The baseline the first snap compares against: what the screen looked
    // like before the drive touched it, so a single-capture scene can still
    // say "the tap changed nothing".
    last = sha1(await page.screenshot());
    try {
      await scene.drive(page, ctx);
    } catch (e) {
      // Capture whatever is on screen at the failure — the PNG is the
      // evidence — and carry on: one run reports every wall.
      const entry = await ctx.snap(`${scene.id}-FAILED`, { compare: false });
      entry.driveError = String(e && e.message ? e.message : e).slice(0, 300);
      console.log(`    drive failed: ${entry.driveError}`);
    }
    await close(page);
  }
}

if (!android) {
  // ── Chromium at phone geometry ────────────────────────────────────
  const { url, stop: stopServer } = await ensureServer(urlArg);
  report.source = url;
  // PLAYWRIGHT_CHROMIUM_EXECUTABLE escapes the version pin — see
  // gen-screenshots.mjs for why an environment with a preinstalled Chromium
  // needs it.
  const browser = await pw.chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {});
  const profiles = Object.entries(PROFILES).filter(([k]) => !onlyProfile || k === onlyProfile);
  if (!profiles.length) { console.error(`device-screens: unknown --profile. Have: ${Object.keys(PROFILES).join(", ")}`); process.exit(1); }

  for (const [profileId, profile] of profiles) {
    console.log(`\n${profile.label} — ${profile.width}×${profile.height} @${profile.scale}`);
    await runProfile(profileId, profile, {
      async open() {
        // A context per scene: storage is per context, so every scene
        // starts from the app's first launch rather than from the last
        // scene's votes.
        const context = await browser.newContext({
          viewport: { width: profile.width, height: profile.height },
          deviceScaleFactor: profile.scale,
          isMobile: true, hasTouch: true,
          userAgent: profile.userAgent,
          locale: "en-US", colorScheme: "light",
        });
        const page = await context.newPage();
        const watcher = watch(page);
        await page.goto(url, { waitUntil: "load" });
        await waitReady(page);
        if (report.mode === null) {
          const m = await readMode(page);
          report.mode = m.live ? "live" : "demo";
          if (!m.live && m.liveBuild) report.bootError = m.bootError || "live build did not attach";
        }
        return { page, watcher };
      },
      async close(page) { await page.context().close(); },
    });
  }
  await browser.close();
  stopServer();
} else {
  // ── the app's own WebView on an Android emulator ──────────────────
  // Playwright's Android support attaches over adb to any debuggable
  // WebView; Capacitor makes the debug build's WebView debuggable
  // (CapConfig: `webContentsDebuggingEnabled` defaults to the app's
  // debuggable flag). The workflow installs and launches the app first;
  // this half only attaches, so a launch crash shows up as "no WebView"
  // and the adb screenshot the workflow took before is the evidence.
  const devices = await pw._android.devices();
  if (!devices.length) { console.error("device-screens: no Android device on adb."); process.exit(1); }
  const device = devices[0];
  const model = device.model();
  const profileId = `android-${slug(model)}`;
  report.source = `android:${device.serial()}`;
  report.target = `${model} · ${pkg}`;
  console.log(`\n${model} — ${pkg}`);

  // A COLD START PER SCENE, the way a phone does it: stop the app, wipe its
  // data (localStorage with it — every scene is a first launch), start it,
  // attach to the WebView it opens. Not a reload: the lane's fourth run
  // attached fine and then lost the devtools target on `page.reload()` —
  // "Target page, context or browser has been closed" — because the
  // WebView's navigation replaces the target Playwright was holding. The
  // attach itself can land on the shell's initial about:blank a moment
  // before Capacitor loads the app, so it waits for the app's own URL and
  // re-attaches if that first target goes away under it.
  async function launch() {
    await device.shell(`am force-stop ${pkg}`);
    await device.shell(`pm clear ${pkg}`);
    await device.shell(`am start -W -n ${pkg}/.MainActivity`);
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const webview = await device.webView({ pkg }, { timeout: 90_000 });
        const page = await webview.page();
        const deadline = Date.now() + 20_000;
        while (!/localhost/.test(page.url()) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
        if (page.isClosed()) throw new Error("the WebView target closed while the app was loading");
        return page;
      } catch (e) {
        lastErr = e;
        console.log(`    attach attempt ${attempt} failed: ${String(e.message || e).slice(0, 120)}`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw lastErr;
  }

  const first = await launch();
  const size = await first.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, s: window.devicePixelRatio }));
  console.log(`  WebView ${size.w}×${size.h} @${size.s}`);
  await runProfile(profileId, { label: model, width: size.w, height: size.h, scale: size.s }, {
    async open() {
      const page = await launch();
      const watcher = watch(page);
      await waitReady(page);
      if (report.mode === null) {
        const m = await readMode(page);
        report.mode = m.live ? "live" : "demo";
        if (!m.live && m.liveBuild) report.bootError = m.bootError || "live build did not attach";
      }
      watcher.drain();
      return { page, watcher };
    },
    async close() {},
    // The device's own screen — status bar, keyboard, the WebView as the
    // phone composes it — which is the half a Chromium render cannot show.
    async frame() { return device.screenshot(); },
  });
  await device.close();
}

// ── report ──────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(join(outDir, "report.md"), renderReport(report));
const t = summarize(report);
console.log(`\ndevice-screens: mode = ${String(report.mode).toUpperCase()} · ${t.screens} screens · ${t.hard} hard / ${t.soft} soft finding(s)` +
  (t.skipped ? ` · ${t.skipped} skipped` : "") + `\n  → ${join(outDir, "report.md")}`);
if (report.bootError) console.log(`  live build in DEMO mode — ${report.bootError}`);
process.exit(t.hard ? 1 : 0);
