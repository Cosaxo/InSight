// pulse-budget.mjs — the pulse lane's generation budget as arithmetic
// (D481), adopting the 2026-08-22 owner note QUESTION-FARM.md carried for
// three weeks as "not adopted".
//
// WHY THIS LANE IS THE ODD ONE. Every other content lane writes something
// CONSUMABLE: a daily question is answered once and gone, a feed question
// can retire, a duel question is one round of many. A pulse is a STANDING
// card. Its option set freezes the day it ships (D52), its histories
// accrue against it forever, and `active: false` is a whole-series kill
// rather than a rotation — a retired pulse takes every line anyone ever
// drew with it off the screen.
//
// So the regulator every other lane needs — "how much runway is left" —
// is the wrong question here. Nothing drains. The question is HOW BIG THE
// LIBRARY SHOULD BE, and the honest unit is a ceiling the lane fills
// toward, one a week, and then stops.
//
// ─────────────────────────────────────────────────────────────────────
// WHAT SETS THE CEILING, and it is measured rather than chosen.
//
// `PULSE.ensureToday()` (src/v2/data/pulse.ts) reads today's aggregate
// for every pulse in the roster, by id, on every feed open. That read is
// `where(documentId(), "in", ids)`, and Firestore caps an `in` clause at
// THIRTY. So:
//
//   roster ≤ 30   → one query per feed open
//   roster 31-60  → two
//   roster 61-90  → three …
//
// Until D481 that was not a slope at all but a CLIFF: `fetchAggs` issued
// one un-chunked query, so at thirty-one pulses the read was rejected
// outright and every pulse card in the feed said it could not reach the
// crowd, for every user, permanently. This lane would have walked off it
// in about six months. D481 chunks the fetch, which is what turns the
// limit back into a price — and a price is something a ceiling can be
// argued from.
//
// ROSTER_CEILING is therefore 30: the largest library that costs what the
// roster costs today. That is a real number about this app rather than a
// preference, and it is the one figure here the owner may want moved —
// raising it is legal and costs one extra query per feed open per thirty
// pulses, which is on `docs/OWNER-LIST.md` with that arithmetic rather
// than decided here (D352: a limit may not shrink the thing on its own).
//
// ─────────────────────────────────────────────────────────────────────
// THE FILL RATE is one per run, and the run is weekly — the owner's
// "about one per week", kept literally. From today's five that is
// twenty-five weeks of lane, which is the pace a permanent thing
// deserves: a wrong daily question is gone tomorrow, a wrong pulse is a
// card everyone meets every day until somebody kills the series.
//
// PAST THE CEILING the lane does not stop having a job — it stops ADDING.
// What it writes then is a SWAP proposal: one pulse paused, one added,
// argued in the PR body. Never a pile. That is a judgement about which
// standing question has stopped earning its place, so it is written for a
// human and merged by one, which this lane is anyway (below).
//
// ─────────────────────────────────────────────────────────────────────
// PROPOSE-ONLY, unlike every D212 lane. The daily, feed, learn, duel and
// now lanes self-merge on green, and the argument for that is that the
// gates are the review. It does not reach here: those lanes write things
// that can be retired quietly, and the gate a pulse would have to clear
// is "would a line through this be worth reading in a month?", which no
// script can ask. The cost of a wrong pulse is forever, and that is a
// higher bar than D212's argument ever had to clear. So OPEN_MAX is 1: a
// PR waiting is a human not having merged it, and the answer to that is
// to wait, not to stack a second question behind it.
//
// This is an operator/run tool, not a CI gate — the CI-side pulse gates
// are `check:quality`'s pulse surface (the id, the five distinct steps,
// `since`, and the store-forms territory) and `check:figures`' count.
// Import-safe: the CLI runs only when invoked directly, so the arithmetic
// is unit-testable (pulse-budget.test.mjs, via test:scripts).
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** One query per feed open. See the header — this is the `in` cap, not a
 *  taste. */
export const ROSTER_CEILING = 30;
/** "About one per week", the owner's rate, kept literally. */
export const RUN_CAP = 1;
/** A PR waiting is a human not having merged it. */
export const OPEN_MAX = 1;

/** Every pulse the bank holds that anybody can answer. `active: false` is
 *  a killed series — it draws nothing and costs no read, so it does not
 *  occupy a place in the library either. */
export function loadRoster() {
  const bank = JSON.parse(readFileSync(join(root, "content", "pulse-questions.json"), "utf8"));
  return (bank.questions || []).filter((q) => q.active !== false);
}

/**
 * Pure: everything the CLI prints derives from this, so the test pins the
 * budget the lane actually gets.
 *
 * `roster` is the live pulse list; `open` is how many unreviewed pulses
 * already sit on the lane's open PR.
 */
export function pulseBudget({ roster, open = 0 }) {
  const size = roster.length;
  const room = Math.max(0, ROSTER_CEILING - size);

  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      size,
      room,
      mode: "waiting",
      reason:
        `the lane's open PR already carries ${open} unreviewed pulse${open === 1 ? "" : "s"} `
        + `(OPEN_MAX ${OPEN_MAX}) — this lane is propose-only, so an open PR means a human has `
        + "not merged it yet. Waiting is the correct response; a second question behind the "
        + "first is a pile.",
    };
  }

  if (room === 0) {
    return {
      budget: 0,
      size,
      room,
      mode: "swap",
      reason:
        `the roster is full at ${size} (ROSTER_CEILING ${ROSTER_CEILING} — the largest library `
        + "that costs one Firestore read per feed open). The lane's job past the ceiling is a "
        + "SWAP proposal, not a question: name the pulse that has stopped earning its place, "
        + "argue why in the PR body, and propose pausing it for the one you would add. Never "
        + "a pile. Raising the ceiling is an owner call and costs one extra query per feed "
        + "open per thirty pulses (docs/OWNER-LIST.md).",
    };
  }

  return {
    budget: Math.min(RUN_CAP, room),
    size,
    room,
    mode: "add",
    reason:
      `${size} pulses of ${ROSTER_CEILING}; ${room} place${room === 1 ? "" : "s"} left in the `
      + "library. One a week is the rate a permanent card deserves — a wrong daily question is "
      + "gone tomorrow, a wrong pulse is met every day until somebody kills the series.",
  };
}

// ── CLI ────────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  const open = Number(arg("--open") ?? 0) || 0;
  const roster = loadRoster();
  const b = pulseBudget({ roster, open });

  console.log("");
  console.log(`  pulse lane budget: ${b.budget}`);
  console.log(`  roster ${b.size}/${ROSTER_CEILING}${open ? ` · ${open} unreviewed on the open PR` : ""}`);
  console.log("");
  console.log(`  ${b.reason}`);
  console.log("");
  if (b.budget > 0) {
    console.log("  Every new pulse carries, and check:quality refuses it without:");
    console.log("    · an id of lowercase and hyphens, NO underscore (the rules parse");
    console.log("      the day off `{qid}_{YYYY-MM-DD}`)");
    console.log("    · exactly five distinct, ordered steps — the chart's y-axis IS the scale");
    console.log("    · `since`: YYYY-MM-DD, the day it starts asking, so the reading does");
    console.log("      not count the days before it existed as misses (D479)");
    console.log("    · `territory`: one the store forms are already answered for (D166 §3)");
    console.log("");
    console.log("  Pre-flight the exact JSON before you append it:");
    console.log("    npm run check:quality -- --batch pulse.json");
    console.log("");
    console.log("  And argue the one thing no gate can ask: would a LINE through this");
    console.log("  be worth reading in a month? A pulse that is not worth a line is a");
    console.log("  feed question, and the feed lane writes those.");
    console.log("");
  }
}
