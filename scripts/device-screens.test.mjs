// device-screens.test.mjs — pins the half of the device pass that decides
// what a finding is, without a browser: the phone geometries, the
// severity of each check, the totals the night shift reads first, and
// the report's shape. The in-page checks themselves run only in Chromium
// (pageChecks is serialised into the page), so what is pinned about them
// here is the contract the runner relies on — that the function carries
// no module reference, and that its verdict fields are the ones classify
// reads.

import { describe, it, expect } from "vitest";
import { PROFILES, BOUNDARY_TEXT, slug, pageChecks, classify, summarize, renderReport } from "./device-screens-lib.mjs";

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
    // A reference to anything outside the function body would be
    // undefined inside the page. The boundary text is the one constant it
    // needs, and it arrives as the argument.
    const src = pageChecks.toString();
    expect(src).not.toMatch(/BOUNDARY_TEXT/);
    expect(src).not.toMatch(/\bslug\(/);
    expect(src).toMatch(/boundaryText/);
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
