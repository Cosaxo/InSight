// now-budget.mjs — the current-events lane's budget and window arithmetic
// (D351): what a run may write into `now`, what is live already, and which
// close dates are taken, so a batch staggers against the bank and not only
// against itself.
//
// WHY THIS EXISTS. D231 built the `now` topic — a question that stops being
// asked, three to twenty-one days, most at the short end — and left the
// writing to a person: "timeliness needs a human, and a news question
// written by an unsupervised job is what the farm's governance exists to
// prevent." The owner reversed that at D351 with one condition: the news
// has to come from somewhere other than the model. So this lane has the
// one rule no other lane needs — every story is FOUND, at run time, by
// searching — and a regulator whose job is smaller than the others':
// there is no stock to level (the topic empties itself) and no demand
// share (one topic), only a cap, the gate's window rules, and the bank's
// own close dates.
//
// WHAT BOUNDS THIS LANE. Not stock: a `now` question expires, so the
// topic cannot fill. Two things do:
//   1. THE NEWS. A run writes only stories it found by searching that
//      day, corroborated across SOURCES_MIN independent outlets and
//      published within FRESH_DAYS. A slow news day is a small batch or
//      a logged no-op — the catalog lane's rule, "a skipped day is fine,
//      a filler question is not". Measured 2026-09-01 from the session
//      environment, so the rule is sized to what a run can actually do:
//      every news domain tried (BBC, NRK, NYT, AP, Guardian, Al Jazeera,
//      NPR, VG, Google News, Wikipedia's current-events portal) is
//      refused at CONNECT by the egress proxy, and the session's page
//      fetch tool reports EGRESS_BLOCKED for the same hosts — but the
//      session's SEARCH tool runs outside the sandbox and returns
//      titles, outlets, URLs and a digest. A run can find a story and
//      cite it; it cannot open it. Two outlets is the bar that survives
//      that: one result is a headline, two independent ones are an
//      event. If the environment's policy is ever widened to news
//      domains, the bar tightens to "opened" (§ The now lane).
//   2. THE OPEN PR (single-gate shape, learn's and feed's): a merged
//      `now` question is a served one, so the lane carries ONE
//      unreviewed batch at a time and OPEN_MAX is the only stop.
//
// The constants (quoted in QUESTION-FARM.md and held equal by check:figures):
//   NOW_CAP     = 6   questions per run — a day's news that is worth a
//                     vote, not a day's news; and the size at which
//                     check:quality's batch rules (staggered closes, most
//                     windows short, most stories with more than two
//                     sides) have a batch to judge.
//   OPEN_MAX    = 6   unreviewed questions on the lane's open PR at which
//                     generation stops.
//   SOURCES_MIN = 2   independent outlets a story must appear in before
//                     the run may ask about it.
//   FRESH_DAYS  = 7   how old a story may be. Past a week it is not
//                     "happening now"; it is a feed `event` question
//                     wearing the wrong chip.
//
// The budget: 0 if open ≥ OPEN_MAX, else min(NOW_CAP, OPEN_MAX − open).
// Never zero for stock — there is no stock.
//
// This is an operator/run tool, not a CI gate — the CI-side rules for a
// `now` question (both window ends, 3–21 days, no prediction shape, the
// batch's staggered closes and short-end majority, the option-count habit)
// live in question-quality.mjs. Import-safe: the CLI runs only when invoked
// directly, so the arithmetic is unit-testable (now-budget.test.mjs, via
// test:scripts).
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NOW_TOPIC, WINDOW_MIN_DAYS, WINDOW_MAX_DAYS, WINDOW_SHORT_DAYS, windowDays } from "./question-quality.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const NOW_CAP = 6;
export const OPEN_MAX = 6;
export const SOURCES_MIN = 2;
export const FRESH_DAYS = 7;

const DAY = 86400000;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (key) => Date.parse(`${key}T00:00:00Z`);

// Pure: the budget the lane actually gets.
export function nowBudget({ open = 0 }) {
  if (open >= OPEN_MAX) {
    return {
      budget: 0,
      reason:
        `the open lane PR already carries ${open} unreviewed questions (OPEN_MAX ${OPEN_MAX}) — ` +
        "review is the work now, not writing. A now question merges straight into the feed",
    };
  }
  const budget = Math.min(NOW_CAP, OPEN_MAX - open);
  return {
    budget,
    reason:
      `${budget} this run (cap ${NOW_CAP}${open ? `, less the ${open} unreviewed on the open PR` : ""}) — ` +
      "as many as today's news carries; a slow day is a smaller batch, never a filler",
  };
}

// What the bank holds against a day: live now, opening later, and the
// close dates already taken. `questions` are the bank's `now` entries
// ({ id, from, until, active? }); `today` is a YYYY-MM-DD day key.
export function nowLive(questions, today) {
  const t = dayMs(today);
  const rows = questions.filter((q) => q.active !== false && typeof q.from === "string" && typeof q.until === "string");
  const live = rows.filter((q) => dayMs(q.from) <= t && dayMs(q.until) >= t);
  const pending = rows.filter((q) => dayMs(q.from) > t);
  const taken = {};
  for (const q of [...live, ...pending]) taken[q.until] = (taken[q.until] ?? 0) + 1;
  return { live, pending, taken };
}

// Close dates a batch of `n` may use, starting from the short end and
// skipping any the bank already closes on — so the topic never empties in
// one day (check:quality's batch rule holds within a batch; this holds it
// against the bank too). Windows open today; `windowDays` is inclusive of
// both ends, so a 3-day window from today closes the day after tomorrow.
export function suggestCloses(taken, today, n = NOW_CAP) {
  const t = dayMs(today);
  const out = [];
  for (let days = WINDOW_MIN_DAYS; days <= WINDOW_MAX_DAYS && out.length < n; days++) {
    const until = dayKey(t + (days - 1) * DAY);
    if (taken[until]) continue;
    out.push({ days, until, short: days <= WINDOW_SHORT_DAYS });
  }
  return out;
}

export function loadNowQuestions() {
  const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));
  return feed.questions.filter((q) => q.cat === NOW_TOPIC);
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const openIdx = args.indexOf("--open");
  const open = openIdx >= 0 ? Number(args[openIdx + 1]) : 0;
  if (!Number.isInteger(open) || open < 0) {
    console.error("now-budget: --open takes a non-negative integer (questions on the open lane PR)");
    process.exit(1);
  }
  const today = dayKey(Date.now());
  const questions = loadNowQuestions();
  const { budget, reason } = nowBudget({ open });
  const { live, pending, taken } = nowLive(questions, today);

  console.log(`now-budget: lane budget ${budget} (cap ${NOW_CAP}/run)`);
  console.log(`  ${reason}`);
  console.log(
    `  bank: ${questions.length} ${NOW_TOPIC} questions ever · ${live.length} live today (${today})` +
      `${pending.length ? ` · ${pending.length} opening later` : ""}` +
      `${openIdx < 0 ? " · open PR assumed 0 — pass --open with the real count" : ""}`,
  );
  for (const q of live) {
    console.log(`    ${q.id} closes ${q.until} (${windowDays(q.from, q.until)}d) — ${String(q.prompt).slice(0, 60)}`);
  }
  const takenDates = Object.keys(taken).sort();
  console.log(`  closes taken: ${takenDates.length ? takenDates.join(", ") : "none"}`);
  const closes = suggestCloses(taken, today, budget || NOW_CAP);
  console.log(
    `  closes free (open today, short end first): ` +
      closes.map((c) => `${c.until} (${c.days}d${c.short ? "" : ", long"})`).join(", "),
  );
  // SAY WHAT THE LIST ALREADY KNOWS. `suggestCloses` walks outward from the
  // short end and stops when it has `n`, so once the bank holds the short
  // dates it keeps going into the long ones — and hands back a batch that
  // check:quality then refuses, because that rule wants most of a batch of
  // three or more sitting at the short end. The list was correct about
  // which dates are free and silent about the batch being illegal, so the
  // writer found out from a red gate instead of from the tool that told
  // them what to write.
  //
  // A WARNING, not a shorter list. Truncating here would quietly turn a
  // "the bank is full at the short end" day into a smaller quota with no
  // reason given, and the underlying conflict — the cap against how fast
  // short close dates free up — is a design question for the owner, not
  // something to decide from inside a suggestion helper.
  const short = closes.filter((c) => c.short).length;
  if (short * 2 < closes.length) {
    console.log(
      `  ⚠ only ${short} of these sits at the short end — check:quality refuses a batch of 3+ unless most do, ` +
        `so today's largest legal batch is ${Math.max(2, short * 2)}. The bank holds the short dates; ` +
        `write fewer rather than reaching for the long ones.`,
    );
  }
  console.log(
    `  source rule: every story FOUND by searching today, in at least ${SOURCES_MIN} independent outlets, ` +
      `published within ${FRESH_DAYS} days, cited by URL in the PR body — never from memory`,
  );
  process.exit(0);
}
