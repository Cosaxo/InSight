// @vitest-environment jsdom
//
// The dial's bucket→display round trip, on the REAL shipped dial questions.
//
// WHY THIS EXISTS. A dial answer is stored as one of 12 buckets, so a
// device that did not do the drag knows only the bucket and has to derive
// a number to show you. It used to show the bucket's MIDPOINT, and
// `dialFmt` rounds to an integer: when (hi-lo)/12 is a whole number every
// midpoint ends in .5, half-up rounding lands on the top edge of the
// bucket, and the printed value re-buckets ONE HIGHER than the answer it
// came from.
//
// What that looked like: you answer "3 h" on the 0-12 h phone question,
// open the app on a second device, and it says you said 4 h — and the
// surprise line under it quotes 4 back at you as your own answer. 11 of
// that dial's 12 buckets did it. Nothing covered the path: there is no
// live dial card in test/live-fixture.ts, so no mount suite reaches it.
//
// The invariant, which is the thing worth pinning rather than any
// particular number: THE VALUE SHOWN FOR A BUCKET MUST RE-BUCKET TO THAT
// BUCKET. Checked against content/feed-questions.json rather than an
// invented dial, so a new dial whose range breaks it fails here.
import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ESM, so `__dirname` does not exist here — eslint's no-undef is right and
// the file is what changes, not the config (CLAUDE.md's rule is the
// reverse only for a legitimate global the scanner cannot see).
const here = dirname(fileURLToPath(import.meta.url));

const raw = JSON.parse(readFileSync(resolve(here, "../../../content/feed-questions.json"), "utf8"));
const list = Array.isArray(raw) ? raw : (raw.questions || Object.values(raw).find(Array.isArray));
const DIALS = list.filter((q) => q.lo != null && q.hi != null);

let WF;
beforeAll(async () => {
  // world-feed.jsx is deferred past first paint (D25), so importing
  // spec-index alone leaves `globalThis.WorldFeed` unset — the loader is
  // what brings the class onto the bridge, exactly as the app does.
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WF = globalThis.WorldFeed;
});

it("the class is actually on the bridge — every case below is vacuous otherwise", () => {
  expect(typeof WF).toBe("function");
  expect(typeof WF.prototype.dialBucketShown).toBe("function");
});

describe("a dial answer shown from its bucket", () => {
  it("the shipped bank actually has dials to check — this file is vacuous without them", () => {
    expect(DIALS.length).toBeGreaterThan(0);
  });

  it("every bucket's shown value re-buckets to that same bucket, where an integer can", () => {
    const p = WF.prototype;
    const wrong = [];
    for (const q of DIALS) {
      for (let i = 0; i < 12; i++) {
        const shown = p.dialBucketShown.call(p, q, i);
        // The known limit, stated as a condition rather than a skip: on a
        // dial finer than one unit per bucket most buckets contain no
        // integer at all, so no integer display can sit inside them and
        // dialBucketShown falls back to the midpoint. Those are excluded
        // HERE and counted in the case below, so the exclusion cannot
        // quietly grow.
        if (!Number.isInteger(shown)) continue;
        if (p.dialBucket.call(p, q, shown) !== i) {
          wrong.push(`${q.id} (${q.lo}-${q.hi}) bucket ${i} shows ${shown}`);
        }
      }
    }
    expect(wrong, "a dial answer would print as a different answer than the "
      + "one stored — on a second device, this reads as the app changing "
      + "what you said").toEqual([]);
  });

  // THE CROWD'S NUMBER CAME OUT OF A DIFFERENT FUNCTION THAN YOURS.
  //
  // Everything above pins `dialBucketShown`, which is what your own answer
  // goes through. The "most say" line one line away on the same card went
  // through `dialMedOf`, which returned the RAW midpoint — the exact value
  // this file exists to say must not be printed. So on the 0-12 h dial you
  // answer 3 h and the card says "most say 4 h", out of the same bucket,
  // with both numbers derived from the same histogram.
  it("the crowd's median prints the same value your own answer would", () => {
    const p = WF.prototype;
    const wrong = [];
    for (const q of DIALS) {
      for (let i = 0; i < 12; i++) {
        // A histogram whose median lands in bucket i, and nothing else.
        const dist = Array.from({ length: 12 }, (_, k) => (k === i ? 10 : 0));
        const med = p.dialMedOf.call(p, q, dist);
        const shown = p.dialBucketShown.call(p, q, i);
        if (med !== shown) wrong.push(`${q.id} (${q.lo}-${q.hi}) bucket ${i}: crowd ${med}, you ${shown}`);
      }
    }
    expect(wrong, "the crowd's number and the viewer's own come from the same "
      + "bucket and would print differently").toEqual([]);
  });

  it("…and that is a real constraint, not two functions that happen to agree", () => {
    // The control. If every midpoint were already an integer inside its
    // bucket the case above would pass against the old code too — so this
    // asserts that at least one shipped dial HAS a bucket where the raw
    // midpoint and the shown value differ, which is the case that shipped.
    const p = WF.prototype;
    let differ = 0;
    for (const q of DIALS) {
      for (let i = 0; i < 12; i++) {
        if (p.dialBucketMid.call(p, q, i) !== p.dialBucketShown.call(p, q, i)) differ++;
      }
    }
    expect(differ, "no shipped dial distinguishes the midpoint from the shown "
      + "value, so the case above proves nothing").toBeGreaterThan(0);
  });

  // AND THE CROWD THAT WAS NOT THERE AT ALL. `dialDist` adds your own
  // bucket back so the curve is never empty right after you answer —
  // which on a card nobody else has answered leaves a distribution of
  // exactly ONE, drawn as a full-height curve labelled "How everyone
  // answered", with a dashed median and a "most say" line quoting your own
  // number back at you as the crowd's.
  //
  // A source assertion, on the same reasoning as learn-split's: there is
  // no live dial card in test/live-fixture.ts, so no mount suite reaches
  // this render at all — which is the sentence at the top of this file,
  // and why the first defect it was written for shipped.
  it("draws no crowd on a card that has no counts yet", () => {
    const src = readFileSync(resolve(here, "../spec/world-feed.jsx"), "utf8");
    const block = src.slice(src.indexOf("const noCrowd ="), src.indexOf("// ── field:"));
    expect(block, "the dial never asks whether there are counts").toContain("q.live && q.noCountsYet");
    // The three things that state a crowd, each behind it.
    expect(block, "the 'most say' line still prints without a crowd").toMatch(/noCrowd \? null : <span[^>]*>most say/);
    expect((block.match(/noCrowd \? null : <path/g) || []).length,
      "the curve still draws from a distribution of one").toBe(2);
    expect(block, "the dashed median still draws").toMatch(/noCrowd \? null : <line/);
    // …and the label stops claiming to be everyone.
    expect(block, "the chart is still labelled 'How everyone answered' with no crowd")
      .toMatch(/noCrowd \? 'Where you answered/);
    // …and it says WHY, the way the tiles on the same card already do.
    expect(block, "nothing tells the reader why the crowd is missing")
      .toContain("noCrowd ? this.renderFloorNote(big) : null");
  });

  it("the midpoint fallback is confined to dials finer than one unit per bucket", () => {
    // The residue, pinned so it cannot spread. If a WHOLE-unit dial ever
    // lands here, the fix above stopped covering the case it was written
    // for and this fails.
    const p = WF.prototype;
    for (const q of DIALS) {
      const step = (q.hi - q.lo) / 12;
      for (let i = 0; i < 12; i++) {
        const shown = p.dialBucketShown.call(p, q, i);
        if (Number.isInteger(shown)) continue;
        expect(
          step < 1,
          `${q.id} (${q.lo}-${q.hi}, step ${step}) fell back to a midpoint on `
          + `bucket ${i}, but its step is a whole unit — an integer exists in `
          + `that bucket and should have been found`,
        ).toBe(true);
      }
    }
  });

  it("the midpoint fallback is at least INSIDE its bucket, even when it cannot be printed as one", () => {
    // Separating the two failures: the stored value is right on a fine
    // dial and only the integer PRINT is lossy (dialFmt's resolution, on
    // the night list). If the fallback itself left the bucket, that would
    // be the original bug wearing a different mask.
    const p = WF.prototype;
    for (const q of DIALS) {
      for (let i = 0; i < 12; i++) {
        const shown = p.dialBucketShown.call(p, q, i);
        expect(p.dialBucket.call(p, q, shown)).toBe(i);
      }
    }
  });
});
