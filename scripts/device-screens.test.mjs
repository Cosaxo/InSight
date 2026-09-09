// device-screens.test.mjs — pins the half of the device pass that decides
// what a finding is, without a browser: the phone geometries, the
// severity of each check, the totals the night shift reads first, and
// the report's shape. The in-page checks themselves run only in Chromium
// (pageChecks is serialised into the page), so what is pinned about them
// here is the contract the runner relies on — that the function carries
// no module reference, and that its verdict fields are the ones classify
// reads.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILES, BOUNDARY_TEXT, slug, pageChecks, classify, summarize, renderReport } from "./device-screens-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const clean = { checks: { textChars: 900, boundary: false, overflowX: false, clipped: [], offscreen: [], brokenImages: [], fontsFailed: 0, fontStatus: "loaded" },
  pageErrors: [], consoleErrors: [], failedRequests: [], unchanged: false };
const snap = (over = {}, checks = {}) => ({ profile: "iphone-se", scene: "mirror", n: "07", id: "mirror", file: "iphone-se/07-mirror.png",
  ...clean, ...over, checks: { ...clean.checks, ...checks } });

describe("the profiles", () => {
  it("are full-screen phone panels, not browser viewports", () => {
    // Playwright's iPhone descriptors subtract Safari's chrome (393×659 for
    // a 15 Pro); a Capacitor WebView fills the panel. Pinned so nobody
    // "fixes" these back to the descriptor values.
    expect(PROFILES["iphone-15-pro"]).toMatchObject({ width: 393, height: 852, scale: 3 });
    expect(PROFILES["iphone-se"]).toMatchObject({ width: 375, height: 667, scale: 2 });
    expect(PROFILES["pixel-7"]).toMatchObject({ width: 412, height: 915 });
    for (const p of Object.values(PROFILES)) {
      expect(p.height).toBeGreaterThan(p.width);
      expect(p.userAgent).toMatch(/Mobile/);
      expect(p.label).toBeTruthy();
    }
  });
  it("send a phone's user agent for their platform", () => {
    expect(PROFILES["pixel-7"].userAgent).toMatch(/Android/);
    expect(PROFILES["iphone-se"].userAgent).toMatch(/iPhone/);
  });
});

describe("slug", () => {
  it("makes a file-safe id and never an empty one", () => {
    expect(slug("Near")).toBe("near");
    expect(slug("1v1")).toBe("1v1");
    expect(slug("Who voted what")).toBe("who-voted-what");
    expect(slug("You — centre")).toBe("you-centre");
    expect(slug("···")).toBe("screen");
  });
});

describe("pageChecks", () => {
  it("is self-contained, because page.evaluate serialises it by source", () => {
    // A reference to anything outside the function body is `undefined`
    // inside the page — not a lint error, not a type error, a
    // ReferenceError at run time in a browser this suite never opens. In
    // device-screens.mjs that lands in every scene's catch, so `classify`
    // marks each screen `hard` and the whole nightly pass exits 1 with no
    // usable check data.
    //
    // THE LIST IS DERIVED, NOT WRITTEN. This asserted two names —
    // BOUNDARY_TEXT and slug( — which is a denylist of the mistakes
    // already made. Measured: adding
    // `const _labels = Object.values(PROFILES).map((x) => x.label);` inside
    // pageChecks passed 15/15, while re-running the serialised source the
    // way page.evaluate does gave "ReferenceError: PROFILES is not
    // defined". eslint cannot help either — PROFILES is a legitimate
    // module binding, and the file is `File ignored` at that.
    //
    // So the names come out of the module itself: every top-level
    // declaration in device-screens-lib.mjs, minus this function and its
    // own parameter. A new export is covered the day it is added.
    const lib = readFileSync(join(root, "scripts/device-screens-lib.mjs"), "utf8");
    const declared = [...lib.matchAll(/^export (?:const|let|function|class)\s+(\w+)/gm)]
      .map((m) => m[1])
      .concat([...lib.matchAll(/^(?:const|let|function|class)\s+(\w+)/gm)].map((m) => m[1]))
      .filter((n) => n !== "pageChecks");
    // Vacuity guard: a regex that stopped matching would make the sweep
    // below pass over an empty list, which is this case's own subject.
    expect(declared.length, "no top-level declarations found in device-screens-lib.mjs").toBeGreaterThan(4);
    expect(declared, "the module's own exports are no longer in the derived list").toContain("PROFILES");

    // String literals removed first: `pageChecks` legitimately contains
    // selectors and copy, and a name inside quoted text is not a reference.
    const src = pageChecks.toString()
      .replace(/`(?:[^`\\]|\\[\s\S])*`/g, (lit) => [...lit.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(" "))
      .replace(/'(?:[^'\\]|\\[\s\S])*'/g, " ")
      .replace(/"(?:[^"\\]|\\[\s\S])*"/g, " ");
    const leaks = declared.filter((n) => new RegExp(`\\b${n}\\b`).test(src));
    expect(
      leaks,
      "pageChecks references a module binding — page.evaluate serialises it by SOURCE, so that name is undefined in the page "
        + "and every scene lands in its catch",
    ).toEqual([]);
    // …and the one thing it must still reach for arrives as an argument.
    expect(pageChecks.toString()).toMatch(/boundaryText/);
  });
  it("names the boundary's own text", () => {
    expect(BOUNDARY_TEXT).toBe("This view hit a snag.");
  });
});

describe("classify", () => {
  it("finds nothing on a clean screen", () => {
    expect(classify(snap())).toEqual([]);
  });
  it("makes the boundary, a page error and a failed drive HARD — the run fails on those alone", () => {
    const hard = classify(snap({ pageErrors: ["TypeError: x is not a function"], driveError: "no in-flow ruler stop" }, { boundary: true }));
    expect(hard.map((f) => f.severity)).toEqual(["hard", "hard", "hard"]);
    expect(hard.map((f) => f.kind)).toEqual(["drive failed", "error boundary", "page error"]);
    expect(hard[1].detail).toContain(BOUNDARY_TEXT);
  });
  it("keeps the leads soft — a rail clips on purpose, a reader decides", () => {
    const soft = classify(snap(
      { unchanged: true, consoleErrors: ["[InSight] boundary caught"], failedRequests: ["404 /x.png"] },
      { overflowX: true, clipped: [{ el: "<span> \"establishment\"", by: 7, overflow: "visible", inView: false }],
        offscreen: [{ el: "<button> \"Go\"", left: 380, right: 420 }], brokenImages: ["/a.png"], fontsFailed: 1, textChars: 12 }));
    expect(soft.every((f) => f.severity === "soft")).toBe(true);
    expect(soft.map((f) => f.kind)).toEqual([
      "unchanged", "looks empty", "page overflows sideways", "control off-screen", "text wider than its box",
      "broken image", "webfont failed", "console.error", "request failed",
    ]);
    // A lead below the fold says so, because the PNG will not show it.
    expect(soft.find((f) => f.kind === "text wider than its box").detail).toContain("below the fold");
  });
  it("does not call a broken screen empty as well", () => {
    const fs = classify(snap({}, { boundary: true, textChars: 20 }));
    expect(fs.map((f) => f.kind)).toEqual(["error boundary"]);
  });
  it("orders hard before soft inside one screen", () => {
    const fs = classify(snap({ unchanged: true, pageErrors: ["boom"] }));
    expect(fs.map((f) => f.severity)).toEqual(["hard", "soft"]);
  });
});

describe("summarize", () => {
  it("counts findings by severity over every screen, plus the skips", () => {
    const report = { screens: [snap(), snap({ pageErrors: ["boom"] }), snap({ unchanged: true })], skipped: [{ id: "patterns", reason: "gated" }] };
    expect(summarize(report)).toEqual({ hard: 1, soft: 1, screens: 3, skipped: 1 });
  });
  it("counts a run that ended early as hard, and the report says so first", () => {
    const report = { capturedAt: "2026-09-06T21:00:00Z", source: "android:emulator-5554", mode: "demo",
      fatal: "WebView attach timed out after 100s\n    at launch (device-screens.mjs:1:1)",
      profiles: {}, screens: [snap()], skipped: [] };
    expect(summarize(report).hard).toBe(1);
    const md = renderReport(report);
    const findings = md.slice(md.indexOf("## Findings"), md.indexOf("## Screens"));
    expect(findings).toContain("[hard] the run ended early");
    expect(findings).toContain("WebView attach timed out after 100s");
    expect(findings).not.toContain("at launch"); // the first line, not the stack
  });
});

describe("renderReport", () => {
  const report = {
    capturedAt: "2026-09-06T21:00:00Z", source: "http://localhost:4173/", mode: "demo",
    profiles: { "iphone-se": { label: "iPhone SE", width: 375, height: 667, scale: 2 } },
    screens: [snap({ n: "01", id: "daily", file: "iphone-se/01-daily.png" }),
      snap({ pageErrors: ["TypeError: boom"] }),
      snap({ n: "19", id: "mirror-world-compare", file: "iphone-se/19-mirror-world-compare.png" }, { clipped: [{ el: "<span> \"establishment\"", by: 7, overflow: "visible", inView: true }] })],
    skipped: [{ id: "patterns", profile: "iphone-se", reason: "gated (D265)" }],
  };
  const md = renderReport(report);
  it("leads with the totals and the findings, hard first, each naming its PNG", () => {
    expect(md.split("\n")[0]).toBe("# Device screens — 2026-09-06T21:00:00Z");
    expect(md).toContain("**DEMO**");
    expect(md).toContain("**1 hard** / 1 soft");
    const findings = md.slice(md.indexOf("## Findings"), md.indexOf("## Screens"));
    const hardAt = findings.indexOf("[hard]");
    const softAt = findings.indexOf("[soft]");
    expect(hardAt).toBeGreaterThan(-1);
    expect(softAt).toBeGreaterThan(hardAt);
    expect(findings).toContain("`iphone-se/07-mirror.png`");
    expect(findings).toContain("`iphone-se/19-mirror-world-compare.png`");
  });
  it("lists every screen per profile with a mark, and the skips with their reason", () => {
    expect(md).toContain("### iPhone SE (375×667 @2)");
    expect(md).toContain("| 01 | daily | `iphone-se/01-daily.png` | ✓ |");
    expect(md).toContain("| 07 | mirror | `iphone-se/07-mirror.png` | ✗ page error |");
    expect(md).toContain("△ text wider than its box");
    expect(md).toContain("- **patterns** — gated (D265)");
  });
  it("says plainly when the checks found nothing, so a clean run is not read as an empty one", () => {
    const quiet = renderReport({ ...report, screens: [snap()], skipped: [] });
    expect(quiet).toContain("None from the automatic checks");
    expect(quiet).not.toContain("## Skipped");
  });
});
