#!/usr/bin/env node
// check-file-size.mjs — a shrink-only ratchet on the files that are
// getting too big to change safely.
//
// WHY IT EXISTS, and why this repo of all repos did not have one. The
// method here is "put a meter on it", and it works: `check:globals` rule 4
// took the shared-global bridge from 799 references to 30 by refusing to
// let the number rise. But every meter in the tree reads a RELATIONSHIP —
// coupling between modules, a doc against the code, a form against its
// twin — and none reads the simplest property there is, which is how big
// one file has got. So the three fastest-growing files in the tree grew
// unmeasured:
//
//   src/v2/data/live.ts       1,285 → 8,601 lines in 39 days, and one
//                             commit in ten in the whole repository lands
//                             in it — which is where lanes start colliding.
//   src/v2/spec/world-feed.jsx  a single 4,200-line class, 102 methods.
//   functions/src/v2content.ts  2,926 → 25,993 GENERATED lines in five
//                             weeks, statically imported into all 42 Cloud
//                             Functions, so every one parses it on every
//                             cold start. It has already hit the
//                             TypeScript TS2590 wall once and is split
//                             into BANK_0..BANK_6 to dodge it.
//
// None of that is broken today, which is exactly the window in which a
// meter is cheap and an extraction is not.
//
// WHAT THIS IS NOT: a line limit. There is no target, no "files should be
// under N lines", and no opinion here about whether a big file is bad. The
// only claim is that the ones already over the threshold may not get
// BIGGER without somebody deciding to raise a number in a diff — the same
// claim rule 4 makes about coupling, and for the same reason: a migration
// with no meter does not run, it gets described.
//
// HOW TO SATISFY IT. Split something out, then lower the number here (the
// script prints the new baseline). Or, if the growth is deliberate, raise
// it in the same commit that says why — which is the whole point: the
// growth becomes a decision instead of an accident.
//
// GENERATED FILES COUNT. v2content.ts is written by a builder, so "it is
// generated" is not an exemption — it is the reason: nobody reads a diff
// of it, so nothing else in the tree would ever notice it doubling.
//
// Run: node scripts/check-file-size.mjs

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The ceiling for each watched file, in lines. SHRINK-ONLY.
 *
 * Seeded 2026-09-09 at each file's then-current length, so the gate starts
 * green and every later line is a decision. A file not listed here is not
 * watched at all — this is a ratchet on known concentrations, not a policy
 * about the tree.
 */
export const SIZE_BASELINE = {
  // 8,648 after the first slice left for data/localWrite.ts
  // (D-2026-09-09h). It was 1,285 lines 39 days earlier.
  "src/v2/data/live.ts": 8648,
  "src/v2/spec/world-feed.jsx": 4612,
  "src/v2/ui/LiveDuelPanel.tsx": 2323,
  // The suites are watched too, and for the same reason rather than out of
  // tidiness: vote.test.ts is the file that pins the whole window.LIVE
  // surface, so it grows every time the store does, and a 4,000-line test
  // file is as hard to read a failure out of as a 4,000-line module.
  "src/v2/data/vote.test.ts": 4241,
  "firestore-tests/rules.test.ts": 4984,
  // GENERATED, and that is the reason it is here rather than an exemption:
  // nobody reads its diff, so nothing else in the tree would notice it
  // doubling — which it did, 2,926 → 25,993 in five weeks. It is imported
  // statically into all 42 Cloud Functions.
  "functions/src/v2content.ts": 25993,
  "functions/src/pure.ts": 2650,
};

export function lineCount(text) {
  // A trailing newline does not make a line. Counting `split("\n").length`
  // reports one more than every editor and every `wc -l`, and a baseline
  // that disagrees with the tool the reader will reach for is a baseline
  // they will assume is wrong.
  return text.length ? text.replace(/\n$/, "").split("\n").length : 0;
}

/** Every watched file's current size against its ceiling. Pure, so the
 *  test can drive it without a tree. */
export function sizeReport(sizes, baseline = SIZE_BASELINE) {
  const over = [];
  const under = [];
  for (const [file, max] of Object.entries(baseline)) {
    const n = sizes[file];
    if (n == null) {
      over.push({ file, now: null, max, kind: "missing" });
      continue;
    }
    if (n > max) over.push({ file, now: n, max, kind: "grew" });
    else if (n < max) under.push({ file, now: n, max });
  }
  return { over, under };
}

const isEntry = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntry) {
  const sizes = {};
  for (const file of Object.keys(SIZE_BASELINE)) {
    try {
      sizes[file] = lineCount(readFileSync(join(ROOT, file), "utf8"));
    } catch {
      sizes[file] = null;
    }
  }
  const { over, under } = sizeReport(sizes);

  if (over.length) {
    console.error("\ncheck-file-size: a watched file grew.\n");
    for (const r of over) {
      if (r.kind === "missing") {
        console.error(
          `  ${r.file} — not found.\n`
          + "    A watched file that moved is not a pass: the ratchet stops watching it\n"
          + "    silently, which is the D275 class. Update the path here, or drop the\n"
          + "    row deliberately.\n",
        );
      } else {
        console.error(
          `  ${r.file} — ${r.now} lines, ceiling ${r.max} (+${r.now - r.max}).\n`
          + "    Split something out and lower the number, or raise it in the same commit\n"
          + "    that says why. There is no target here; the only claim is that this file\n"
          + "    does not get bigger by accident.\n",
        );
      }
    }
    process.exit(1);
  }

  if (under.length) {
    console.error("\n✓ files shrank — now lower their ceilings in this script:\n");
    for (const r of under) console.error(`  "${r.file}": ${r.now},   // was ${r.max}`);
    console.error("");
    process.exit(1);
  }

  const total = Object.values(sizes).reduce((a, b) => a + (b ?? 0), 0);
  console.log(
    `check-file-size OK — ${Object.keys(SIZE_BASELINE).length} watched files at their ceilings, `
    + `${total.toLocaleString("en-US")} lines between them.`,
  );
}
