// Regenerates content/duel-sample.json — the FIXED slice of the duel bank
// that the JavaScript bundle carries (D430: learn's treatment, D284, one
// bank over).
//
// WHY THIS EXISTS. `spec/duels-data.js` imported the whole of
// `content/duel-questions.json`, so every duel question was compiled into
// the app under `check:content`'s 24 KiB cap. D284 left it there on
// purpose — a weekly lane at 14.6 KiB had years of slack — and the slack
// went in a week: the cast (D429) took the file to 22.8 KiB, and the burst
// (D426) runs the lane daily at 25 questions a run, so its next run would
// have crossed the cap. The cap's own instruction was this file, not a
// higher number.
//
// The live app never needed the import: a live build reads the seeded bank
// (`duelQFor` in data/deck.ts over the store's surface bank) and does not
// load `duels-data.js` at all — pinned in test/daily-live-duels.test.jsx.
// Only the DEMO build — no backend, App Store review, the screenshot run,
// every `smoke-*` suite — needs duel questions compiled in. This file is
// those questions.
//
// THE PROPERTY THAT MATTERS is D284's: not that the sample is small, but
// that its size does not move. The first PER_KIND served questions of each
// group kind and the first PER_DOMAIN of each 1v1 domain, in bank order,
// plus the scenario packs those role votes name — so an append at the end
// of a pool changes nothing here, and the lane can write ten thousand
// questions without the build noticing.
//
// DERIVED, NOT AUTHORED, and held to it by `check:duel-sample` on the same
// argument `check:content` makes for v2content.ts: a hand-maintained second
// copy of content is a copy that drifts, and the drift is silent — a demo
// build serving a question the bank retired, which the demo build is by
// definition unable to notice.
//
// Modes: default = check (exit 1 if the committed file differs);
//        --write = regenerate (`npm run build:duel-sample`).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "content", "duel-questions.json");
const OUT = join(root, "content", "duel-sample.json");

// Group questions per kind. The kinds are `check:content`'s closed set with
// one split: a `pick` that names a scenario pack is a ROLE VOTE (D429) and
// is counted apart from the plain member picks, because the demo's four
// seeded groups each walk the pool from their own offset (`gBase`, three
// apart) for a week, and the cast is what a group round is now — a sample
// that took "the first few picks" would be all plain picks and no pack.
//
// Eight role votes is two packs whole (a pack is four roles, QUESTION-FARM
// § The duel lane), so the demo shows the pack's hue changing rather than
// one colour forever. Four `us` and two `classic` keep `groupPortrait()`'s
// traits and the older kinds visible; four ratings put one on every
// group's week. Twenty-one in all, which is more than the sixteen slots
// the four seeded groups' weeks reach (offsets 0 · 3 · 6 · 9, seven days
// each), so no two seeded groups share a week.
export const PER_KIND = { us: 4, pick: 3, classic: 2, role: 8, rate: 4 };

// 1v1 questions per domain, both pools. FOUR because DOMAIN_MIN is four
// (`duels-data.js`): a domain row draws only once it holds four correct
// reads each way, and the demo's long records (f1 at 24 days, f12 at 16)
// walk the pool by streak depth and wrap — so a domain represented by one
// question would fill its row with the same question repeated, and a
// domain absent from the sample would never draw a row at all. The rows
// are the whole reason `sample-people.test.js` asks for records that deep.
export const PER_DOMAIN = 4;

// The sampling kind: `check:content`'s kind, except that a pick naming a
// pack is `role`. An entry without a kind is a classic (the seed's default,
// gen-v2content.mjs).
export const sampleKind = (q) =>
  (q.kind === "pick" && q.scen != null ? "role" : (q.kind ?? "classic"));

// First N per key, in list order — the bank IS the order the lane appends
// in (rotation order for group, light → deep for the 1v1 pools), so taking
// the first N per key means the sample is stable under append: a new entry
// at the end of a pool changes nothing here. Sorting by any other key
// would make every append reshuffle the bundle.
function firstPer(list, keyOf, limitOf) {
  const taken = new Map();
  const out = [];
  for (const q of list) {
    const k = keyOf(q);
    const n = taken.get(k) ?? 0;
    if (n >= limitOf(k)) continue;
    taken.set(k, n + 1);
    out.push(q);
  }
  return out;
}

export function buildSample(src) {
  // The group pool skips retired entries (`active: false`) because the demo
  // does (`duels-data.js` filters them), and a kind's N counts questions
  // the demo can serve. So a RETIREMENT moves the sample — the next entry
  // of that kind slides in — and `check:duel-sample` says so on the pull
  // request that retires; `npm run build:duel-sample` is the whole fix.
  // The 1v1 pools are taken as the demo takes them, flags and all: the
  // romantic pool ships dark on live (D40 part 4) and the demo has drawn
  // it since the day it was written.
  const group = firstPer(
    (src.group ?? []).filter((q) => q.active !== false),
    sampleKind,
    (k) => {
      if (!(k in PER_KIND)) {
        // `check:content` holds the kinds to a closed set, so this is a
        // new kind that gate has been taught and this file has not. Fail
        // here rather than silently leave the kind out of every demo.
        throw new Error(
          `gen-duel-sample: group kind ${JSON.stringify(k)} has no PER_KIND entry — add one`,
        );
      }
      return PER_KIND[k];
    },
  );
  const domainOf = (q) => q.d ?? "";
  const oneVsOne = firstPer(src.oneVsOne ?? [], domainOf, () => PER_DOMAIN);
  const romantic = firstPer(src.romantic ?? [], domainOf, () => PER_DOMAIN);
  // Packs are DERIVED from the votes, not shipped whole: the lane opens a
  // pack whenever it writes four roles and a hue, so the pack list grows
  // with the bank, and only the packs a sampled vote names are anything
  // the demo can draw. Source order, so a pack's position is stable too.
  const named = new Set(group.filter((q) => q.scen != null).map((q) => q.scen));
  const scenarios = (src.scenarios ?? []).filter((s) => named.has(s.id));
  return { scenarios, group, oneVsOne, romantic };
}

export function generate(src) {
  return `${JSON.stringify(buildSample(src), null, 2)}\n`;
}

const describe = (src) => {
  const s = buildSample(src);
  return `${s.group.length} group (${s.scenarios.length} packs) · `
    + `${s.oneVsOne.length} 1v1 · ${s.romantic.length} romantic, of `
    + `${src.group.length} · ${src.oneVsOne.length} · ${src.romantic.length}`;
};

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const src = JSON.parse(readFileSync(SRC, "utf8"));
  const want = generate(src);
  if (process.argv.includes("--write")) {
    writeFileSync(OUT, want);
    console.log(
      `gen-duel-sample: wrote content/duel-sample.json — ${describe(src)}, `
      + `${(want.length / 1024).toFixed(1)} KiB`,
    );
  } else {
    let have = null;
    try {
      have = readFileSync(OUT, "utf8");
    } catch {
      /* absent — reported below as a mismatch */
    }
    if (have === want) {
      console.log(`check:duel-sample: content/duel-sample.json in sync — ${describe(src)}`);
    } else {
      console.error(
        "check:duel-sample FAILED — content/duel-sample.json is not what "
        + "content/duel-questions.json generates.\n\n"
        + "  Run `npm run build:duel-sample` and commit the result.\n\n"
        + "  The sample is the slice of the duel bank the JS bundle carries,\n"
        + "  and it is DERIVED (D430, D284's shape). Editing it by hand makes\n"
        + "  the demo build serve questions the bank does not have — which no\n"
        + "  other gate can see, because the demo build is the one with no\n"
        + "  backend to disagree with it. A retirement in the bank moves it\n"
        + "  too (the next entry of that kind slides in); the same command\n"
        + "  is the fix.",
      );
      process.exitCode = 1;
    }
  }
}
