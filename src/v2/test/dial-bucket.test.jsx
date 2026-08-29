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
