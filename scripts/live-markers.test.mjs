// What this can and cannot pin.
//
// The MEASUREMENT — that these three strings are in a live build and in no
// demo build — only a build can give, and the four-way table that
// established it is in live-markers.mjs beside the list. Nothing here
// rebuilds the app; a unit test that shelled out to `vite build` four
// times would be the slowest thing in this suite and would still be
// measuring rolldown rather than this module.
//
// What it pins is the ANSWER'S SHAPE, and specifically the direction of
// failure. Both callers refuse an artifact when a marker is missing, and
// both grade one when none is. Flip `missingLiveMarkers` to `.some()`
// semantics — return empty when ANY marker is present rather than when all
// are — and every case below still reads plausibly while check-bundle
// starts grading demo bundles and calling them the shipping one. That is
// the regression this file exists for, and the partial-presence cases are
// the ones that catch it.

import { describe, it, expect } from "vitest";
import { LIVE_MARKERS, missingLiveMarkers } from "./live-markers.mjs";

/** A `has` built from one blob of text, the way check-web-firebase asks. */
const inText = (text) => (m) => text.includes(m);
/** A `has` built from a marker set, the way a build either carries them or not. */
const carrying = (...present) => (m) => present.includes(m);

describe("live-markers: the marker list itself", () => {
  it("is a non-empty list of distinct, non-trivial strings", () => {
    expect(LIVE_MARKERS.length).toBeGreaterThan(0);
    expect(new Set(LIVE_MARKERS).size).toBe(LIVE_MARKERS.length);
    for (const m of LIVE_MARKERS) {
      expect(typeof m).toBe("string");
      // Short strings match by accident. "ci" as a Firebase project id once
      // satisfied a verbatim-inlining check in check-web-firebase for
      // exactly this reason — two characters appear in every bundle.
      expect(m.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("names no rolldown output, only the app's own vocabulary", () => {
    // D198's rule, kept enforceable: `prod-*.js`, `deviceBind-a1b2c3.js` and
    // friends are emit names, not promises. A marker that looks like a file
    // is a marker that a bundler rename silently invalidates.
    for (const m of LIVE_MARKERS) {
      expect(m).not.toMatch(/\.[cm]?js$/);
      expect(m).not.toMatch(/assets\//);
    }
  });
});

describe("live-markers: missingLiveMarkers", () => {
  it("reports nothing missing when the bundle carries all of them", () => {
    expect(missingLiveMarkers(carrying(...LIVE_MARKERS))).toEqual([]);
    const asBundle = `x${LIVE_MARKERS.join("y")}z`;
    expect(missingLiveMarkers(inText(asBundle))).toEqual([]);
  });

  it("reports every marker when the bundle carries none — the demo build", () => {
    expect(missingLiveMarkers(carrying())).toEqual(LIVE_MARKERS);
    expect(missingLiveMarkers(inText("const a=1;export{a};"))).toEqual(LIVE_MARKERS);
  });

  it("reports the REST when only some are present — the case that matters", () => {
    // This is the direction the whole thing turns on. All-but-one present
    // must still read as missing, or a single string surviving dead-code
    // elimination is enough to grade a demo bundle as the shipping one.
    for (const only of LIVE_MARKERS) {
      const missing = missingLiveMarkers(carrying(only));
      expect(missing).not.toEqual([]);
      expect(missing).not.toContain(only);
      expect(missing.length).toBe(LIVE_MARKERS.length - 1);
    }
    for (const dropped of LIVE_MARKERS) {
      const present = LIVE_MARKERS.filter((m) => m !== dropped);
      expect(missingLiveMarkers(carrying(...present))).toEqual([dropped]);
    }
  });

  it("preserves the declared order, so the error message is stable", () => {
    // The callers print this list. An order that moved between runs would
    // make two identical failures look like different ones.
    expect(missingLiveMarkers(carrying())).toEqual(LIVE_MARKERS);
  });

  it("is not fooled by a marker that merely resembles one", () => {
    // `patternsBasis` is the recorded near-miss: live-sounding, present in
    // every build. Nothing that is not literally in the list counts.
    const noise = "patternsBasis patternsPool v2_question v2_met insight.bankCache.v1";
    expect(missingLiveMarkers(inText(noise))).toEqual(LIVE_MARKERS);
  });
});
