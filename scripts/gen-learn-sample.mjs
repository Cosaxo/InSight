// Regenerates content/learn-sample.json — the FIXED slice of the learn bank
// that the JavaScript bundle carries (D284).
//
// WHY THIS EXISTS. `spec/learn-data.js` imported the whole of
// `content/learn-questions.json`, so every learn card was compiled into the
// app. Measured 2026-08-24: 146 cards were 33 KiB of a 34.5 kB chunk, and
// `check:bundle`'s total budget had ~13 kB left — about 39 more cards. The
// learn lane's own target is 288, so reaching the depth its budget already
// granted would have failed the build, roughly a fortnight out, as an error
// naming the bundle rather than the bank.
//
// The live path reads the seeded bank instead now. But the DEMO build has no
// backend at all — it is what App Store review sees, what the screenshot run
// captures, and what every `smoke-*` suite mounts — so Learn still needs
// cards compiled in. This file is those cards.
//
// THE PROPERTY THAT MATTERS is not that the sample is small. It is that its
// size does not move: PER_FIELD cards from each field, so the bundle stops
// tracking the bank and the lane can write ten thousand cards without the
// build noticing. A one-off trim would have bought a few months and left the
// same trap armed.
//
// DERIVED, NOT AUTHORED, and held to it by `check:learn-sample` on the same
// argument `check:content` makes for v2content.ts: a hand-maintained second
// copy of content is a copy that drifts, and the drift is silent — a demo
// build serving a card the bank retired, or missing the ids its own seeded
// progress refers to.
//
// Modes: default = check (exit 1 if the committed file differs);
//        --write = regenerate (`npm run build:learn-sample`).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "content", "learn-questions.json");
const OUT = join(root, "content", "learn-sample.json");

// Cards per field. FIVE, and the number is a floor set by the demo's own
// seeded progress rather than a taste call: `learn-progress.js`'s freshS()
// marks `cell2`, `cell4`, `sol1`, `sol5`, `cap1`, `cap4` and `sol2` as
// already met, so a sample that stopped at four would leave the demo holding
// mastery of a card it cannot draw. Ids run sequentially within a field, so
// "the first five" covers every one of them.
//
// Twelve fields at five is sixty cards ≈ 13 KiB — enough that a demo sitting
// never repeats (the feed serves one learn card per seven at the default
// rate), and every subject stays represented, which matters because the
// topic sheet lists fields and an empty subject reads as a broken app.
export const PER_FIELD = 5;

export function buildSample(src) {
  const taken = new Map();
  const cards = [];
  // Bank order, not sorted: the bank IS the order the lane appends in, and
  // taking the first N per field means the sample is stable under append —
  // a new card at the end of a field changes nothing here. Sorting by any
  // other key would make every append reshuffle the bundle.
  for (const card of src.cards) {
    const n = taken.get(card.f) ?? 0;
    if (n >= PER_FIELD) continue;
    taken.set(card.f, n + 1);
    cards.push(card);
  }
  // Subjects and fields ship WHOLE — they are the taxonomy, not the content:
  // twelve fields and five subjects are 1 KiB together, they do not grow with
  // the lane, and `freshF()` follows every field the bundle knows about, so a
  // trimmed list would silently narrow the demo's follow set as well.
  return { subjects: src.subjects, fields: src.fields, cards };
}

export function generate(src) {
  return `${JSON.stringify(buildSample(src), null, 2)}\n`;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const src = JSON.parse(readFileSync(SRC, "utf8"));
  const want = generate(src);
  if (process.argv.includes("--write")) {
    writeFileSync(OUT, want);
    const n = buildSample(src).cards.length;
    console.log(
      `gen-learn-sample: wrote content/learn-sample.json — ${n} cards `
      + `(${PER_FIELD}/field of ${src.cards.length}), ${(want.length / 1024).toFixed(1)} KiB`,
    );
  } else {
    let have = null;
    try {
      have = readFileSync(OUT, "utf8");
    } catch {
      /* absent — reported below as a mismatch */
    }
    if (have === want) {
      const n = buildSample(src).cards.length;
      console.log(
        `check:learn-sample: content/learn-sample.json in sync — ${n} cards `
        + `(${PER_FIELD}/field of ${src.cards.length})`,
      );
    } else {
      console.error(
        "check:learn-sample FAILED — content/learn-sample.json is not what "
        + "content/learn-questions.json generates.\n\n"
        + "  Run `npm run build:learn-sample` and commit the result.\n\n"
        + "  The sample is the slice of the bank the JS bundle carries, and it\n"
        + "  is DERIVED (D284). Editing it by hand makes the demo build serve\n"
        + "  cards the bank does not have — which no other gate can see,\n"
        + "  because the demo build is the one with no backend to disagree\n"
        + "  with it.",
      );
      process.exitCode = 1;
    }
  }
}
