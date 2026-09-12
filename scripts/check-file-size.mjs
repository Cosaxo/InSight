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
/**
 * The watched files, and HOW each is watched. Two modes, because two
 * different things go wrong:
 *
 *   `ratchet` — a hand-written file, held at an EXACT figure. Growing
 *     fails; shrinking fails too, asking for the number to come down with
 *     it (check:globals rule 4's shape). This is the mode that makes the
 *     next 500 lines a decision.
 *
 *   `ceiling` — a GENERATED file that legitimately grows every day.
 *     A maximum, not a ratchet: under it is silence, over it is a
 *     failure. Shrinking is never a failure here.
 *
 * THE SECOND MODE EXISTS BECAUSE THE FIRST ONE WAS WRONG FOR ONE FILE, and
 * the error is worth keeping written down. `functions/src/v2content.ts` was
 * seeded as a ratchet on 2026-09-09 and would have failed on the very next
 * day's content lanes — which self-merge on green (D212), so a gate that
 * reds every morning does not get fixed, it gets deleted. A daily-appended
 * artifact has no "did not grow" state to hold it to. What it HAS is a
 * wall: the TypeScript TS2590 limit it has already hit once, and the
 * cold-start parse every one of the 42 Cloud Functions pays. So the number
 * for it is that wall with room to reach it, not yesterday's length.
 */
export const SIZE_BASELINE = {
  // 9,257, and the arithmetic is the argument for the meter rather than
  // an embarrassment to be smoothed over. The first slice took ~90 lines
  // out for data/localWrite.ts (D-2026-09-09h) and put the branch at
  // 8,648; `main` ADDED 409 over the same three nights, reaching 9,179 on
  // its own tip, and the merge of the two is 9,257. So the file grew four
  // times faster than it was being split, on nights when somebody was
  // actively splitting it. It was 1,285 lines 40 days earlier. Every
  // raise here is deliberate and lands in the commit that says why —
  // which is the whole claim: not that the file has a target, but that it
  // cannot get bigger without someone signing for it.
  // 9,257 -> 9,283 at the 2026-09-11 22:45 merge (main's 26 commits: the
  // Patterns items work, D457-D464). Two hours after the entry above said
  // the file grows four times faster than it is split, it grew again.
  //
  // 9,283 -> 9,492 at the 2026-09-12 11:06 merge (main's 41 commits), and
  // this is the raise worth reading rather than any single number: ALL SIX
  // hand-written ratchets tripped at once, for the first time since the
  // gate was added three days ago. +209 here, +134 in world-feed.jsx, +93
  // in vote.test.ts, +54 in LiveDuelPanel.tsx, +28 in pure.ts, +9 in
  // rules.test.ts. In three days this branch has raised live.ts's line
  // three times and lowered it once, by 90 lines, which is the whole of
  // what D-2026-09-09h's slice bought. A meter that only ever goes up is
  // still telling the truth — the truth is just not the one anyone wanted.
  // Every raise is signed for, which remains the whole and only claim.
  "src/v2/data/live.ts": { mode: "ratchet", lines: 9492 },
  // +31 from main's feed work at the 2026-09-11 merge.
  "src/v2/spec/world-feed.jsx": { mode: "ratchet", lines: 4784 },
  // +19 on 2026-09-12: the 1v1 sheet's door to the friends overlay and the
  // note on why the sheet has one (D-2026-09-12a's amendment).
  "src/v2/ui/LiveDuelPanel.tsx": { mode: "ratchet", lines: 2396 },
  // The suites are watched too, and for the same reason rather than out of
  // tidiness: vote.test.ts is the file that pins the whole window.LIVE
  // surface, so it grows every time the store does, and a 4,000-line test
  // file is as hard to read a failure out of as a 4,000-line module.
  // Both raised at the 2026-09-11 merge: +191 and +151 of real coverage
  // from main's shifts. Growth that buys assertions is still growth a
  // reader has to walk, so it is signed for here rather than exempted.
  "src/v2/data/vote.test.ts": { mode: "ratchet", lines: 4554 },
  "firestore-tests/rules.test.ts": { mode: "ratchet", lines: 5359 },
  "functions/src/pure.ts": { mode: "ratchet", lines: 2833 },
  // GENERATED and appended daily by the content lanes — hence `ceiling`.
  // 40,000 is chosen from what actually breaks rather than from taste: it
  // is ~1.4x today's 28,442, the file went 2,926 → 28,442 in five weeks,
  // and it has already hit TS2590 once (it is split into BANK_0..BANK_6 to
  // dodge that). Crossing this is the signal to move the bank out of the
  // JavaScript rather than to raise the number again — which is the
  // conversation the wall is here to force while there is still room.
  "functions/src/v2content.ts": { mode: "ceiling", lines: 40000 },
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
  for (const [file, spec] of Object.entries(baseline)) {
    const { mode, lines: max } = spec;
    const n = sizes[file];
    if (n == null) {
      over.push({ file, now: null, max, mode, kind: "missing" });
      continue;
    }
    if (n > max) over.push({ file, now: n, max, mode, kind: "grew" });
    // A `ceiling` file is ALLOWED to be under its number — that is the
    // whole difference between the modes. Only a ratchet asks for its
    // figure to follow a shrink down.
    else if (n < max && mode === "ratchet") under.push({ file, now: n, max, mode });
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
          `  ${r.file} — ${r.now} lines, ${r.mode === "ceiling" ? "hard ceiling" : "ratchet"} ${r.max} (+${r.now - r.max}).\n`
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
    for (const r of under) console.error(`  "${r.file}": { mode: "ratchet", lines: ${r.now} },   // was ${r.max}`);
    console.error("");
    process.exit(1);
  }

  const total = Object.values(sizes).reduce((a, b) => a + (b ?? 0), 0);
  console.log(
    `check-file-size OK — ${Object.keys(SIZE_BASELINE).length} watched files at their ceilings, `
    + `${total.toLocaleString("en-US")} lines between them.`,
  );
}
