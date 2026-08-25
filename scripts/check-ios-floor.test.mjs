// The rule this gate turns on: a CSS feature above the floor is FATAL
// inside a custom property and PROGRESSIVE everywhere else.
//
// Get that backwards in either direction and the gate is useless in a
// different way each time. Call everything fatal and it fails the tree
// over `text-wrap: pretty`, which degrades to "text is not balanced" —
// noise, and noise is how a gate gets bypassed. Call everything
// progressive and it passes the exact bundle that shipped a page with no
// ground and no ink, which is the bug it was written for.
//
// The version table is deliberately NOT pinned here. Those numbers are
// facts about WebKit, not about this repo, and a test asserting
// `oklch === 15.4` would only assert that someone typed 15.4 twice. What
// is worth holding is the ordering behaviour and the classification.

import { describe, it, expect } from "vitest";
import {
  CSS_FEATURES, JS_APIS, iosNum, isInCustomProperty, scanCss,
} from "./check-ios-floor.mjs";

describe("iosNum — ordering, and the reason it is not parseFloat", () => {
  it("orders within a major version", () => {
    expect(iosNum("15.4")).toBeGreaterThan(iosNum("15.0"));
    expect(iosNum("16.2")).toBeGreaterThan(iosNum("15.4"));
    expect(iosNum("16.4")).toBeGreaterThan(iosNum("16.2"));
  });

  it("treats a bare major as its .0", () => {
    expect(iosNum("16")).toBe(iosNum("16.0"));
    expect(iosNum("16")).toBeLessThan(iosNum("16.2"));
  });

  it("does not let a two-digit minor outrank a major", () => {
    // parseFloat("16.10") === 16.1 < 16.4 is right by luck; the trap is
    // string compare, where "16.10" < "16.4". Neither is used.
    expect(iosNum("16.10")).toBeLessThan(iosNum("17.0"));
    expect(iosNum("17.0")).toBeGreaterThan(iosNum("16.4"));
  });
});

describe("isInCustomProperty — where the fatality comes from", () => {
  const cases = [
    ["--surface: oklch(0.9 0 0);", true, "a plain token definition"],
    ["  --ink:oklch(0.2 0 0);", true, "no space after the colon"],
    ["a{color:red;--x:oklch(0.5 0 0);}", true, "after a sibling declaration"],
    ["a{--x:oklch(0.5 0 0)}", true, "first in the block"],
    ["a{color: oklch(0.5 0 0);}", false, "an ordinary declaration"],
    ["a{background:linear-gradient(oklch(0.5 0 0),#fff)}", false, "nested in a value"],
    ["--x: color-mix(in oklch, var(--a) 50%, var(--b));", true, "color-mix in a token"],
  ];
  for (const [src, want, why] of cases) {
    it(`${want ? "fatal" : "progressive"}: ${why}`, () => {
      const i = src.search(/oklch\(|color-mix\(/);
      expect(isInCustomProperty(src, i)).toBe(want);
    });
  }
});

describe("scanCss — the two buckets", () => {
  it("puts a token definition in fatal and a declaration in progressive", () => {
    const css = [
      ":root{",
      "  --surface: oklch(0.965 0.004 75);",
      "  --shadow: color-mix(in oklch, var(--ink) 8%, transparent);",
      "}",
      ".card{ color: oklch(0.2 0 0); text-wrap: pretty; }",
    ].join("\n");
    const { fatal, progressive } = scanCss(css, "probe.css");

    expect(fatal.map((f) => f.feature).sort()).toEqual(["color-mix()", "oklch()"]);
    expect(fatal.every((f) => f.at.startsWith("probe.css:"))).toBe(true);

    const prog = progressive.map((p) => p.feature).sort();
    expect(prog).toContain("oklch()");        // the .card declaration
    expect(prog).toContain("text-wrap: pretty");
    // …and the token uses did NOT also land in progressive
    expect(progressive.filter((p) => p.feature === "oklch()")).toHaveLength(1);
  });

  it("reports nothing for a stylesheet that uses none of them", () => {
    const { fatal, progressive } = scanCss(".a{color:#fff;display:flex}", "plain.css");
    expect(fatal).toEqual([]);
    expect(progressive).toEqual([]);
  });

  it("counts every occurrence, not every line", () => {
    // Three tokens on one line is three sites; the real stylesheet has
    // exactly this shape and an off-by-line would under-report it.
    const css = ".x{--a:oklch(1 0 0);--b:oklch(1 0 0);--c:oklch(1 0 0)}";
    expect(scanCss(css, "x.css").fatal).toHaveLength(3);
  });

  it("does not mistake `in oklch` inside color-mix for an oklch() call", () => {
    // color-mix's colour space is a bare keyword. Counting it would
    // report oklch at sites that do not call it, which is the kind of
    // miscount that makes a gate's numbers untrustworthy.
    const { fatal } = scanCss("--x: color-mix(in oklch, #fff 50%, #000);", "y.css");
    expect(fatal.map((f) => f.feature)).toEqual(["color-mix()"]);
  });
});

describe("the feature tables", () => {
  it("give every entry a name, a global regex and a version", () => {
    for (const f of [...CSS_FEATURES, ...JS_APIS]) {
      expect(f.name, JSON.stringify(f)).toBeTruthy();
      expect(f.ios, f.name).toMatch(/^\d+(\.\d+)?$/);
      // A non-global regex makes matchAll throw, so this is the
      // difference between a new entry working and the gate crashing.
      expect(f.re.flags, f.name).toContain("g");
    }
  });

  it("names each feature once", () => {
    const names = CSS_FEATURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
