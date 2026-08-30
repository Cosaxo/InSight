// pulse-collect.mjs — read the tree, return the pulse object. No I/O out,
// no argv, no process.exit: importing this file does nothing but define
// functions, which is what makes any of it testable.
//
// Split out of pulse.mjs for the reason cost-arith.mjs was split out of
// cost-model.mjs: collection and presentation fail differently, and a
// script whose body runs on import cannot be unit-tested at all. pulse.mjs
// is now the CLI (argv, the trail's file I/O, --check, writing); this is
// everything it computes. scripts/pulse.test.mjs exercises this file.
//
// Node stdlib only, like every deploy-adjacent script here.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  costModel, authCost, writesPerSec, CONTENTION_DAU, B, SCENARIOS,
  firestoreCost, functionsCost, totalCost, REGIONAL, LOCATION_LABEL,
} from "./cost-arith.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));
const has = (rel) => existsSync(join(ROOT, rel));

export const round2 = (n) => Math.round(n * 100) / 100;
export const round6 = (n) => Math.round(n * 1e6) / 1e6;
export const isoDay = (dayIndex) => new Date(dayIndex * 86400000).toISOString().slice(0, 10);

// ── 1 · cost ────────────────────────────────────────────────────
// Straight through cost-arith, which is also what cost-model.mjs prints.
// One arithmetic, two consumers: the console cannot disagree with the CLI
// about the bill, because there is nothing for it to disagree with.

export function collectCost(regional) {
  const { bank, model } = costModel({ regional });

  const scenarios = SCENARIOS.map(([dau, mature, label]) => {
    const now = model(dau, mature);
    const fixed = model(dau, mature, { staticBank: true });
    const wps = writesPerSec(dau);
    return {
      label, dau, mature,
      readsPerDay: Math.round(now.reads),
      writesPerDay: Math.round(now.writes),
      // The decomposition is the finding — COSTS.md's whole read section is
      // about which of these four dominates at which size.
      readsPerUser: Object.fromEntries(
        Object.entries(now.r).map(([k, v]) => [k, Math.round(v * 10) / 10]),
      ),
      firestoreUsd: round2(firestoreCost(now.cost)),
      functionsUsd: round2(functionsCost(now.cost)),
      totalUsd: round2(totalCost(now.cost)),
      // What the two recorded-but-unbuilt read fixes are worth at this size.
      // Kept beside the bill rather than in a footnote: the decision this
      // panel serves is "is it time to build them yet", and the answer is
      // the gap between these two numbers.
      withReadFixesUsd: round2(totalCost(fixed.cost)),
      savingUsd: round2(totalCost(now.cost) - totalCost(fixed.cost)),
      writesPerSec: Math.round(wps * 100) / 100,
      contended: wps >= 1,
      // Only if the project was upgraded — nobody has recorded which
      // billing mode prvfire33 is on, which is COSTS.md finding 3 and the
      // largest single unknown in this panel.
      identityPlatformUsd: round2(authCost(dau * B.mauMultiple)),
    };
  });

  return {
    region: regional === REGIONAL ? LOCATION_LABEL : "nam5 multi-region",
    seededBankDocs: bank,
    assumptions: { ...B },
    scenarios,
    walls: [
      {
        name: "D7 write contention on the shared daily aggregate",
        bindsAtDau: CONTENTION_DAU,
        kind: "technical",
        instrumented: true,
        note: "~1 write/sec/document; all of a day's dailies land on one doc inside the 4-hour window",
        source: "docs/DECISIONS.md D7; monitoring/onV2AnswerCreated-contention.json",
      },
      {
        name: "Deck listener fan-out overtakes every other read source",
        // Solved rather than asserted (D67). It was 50_000, which came from
        // nowhere; the crossover is where DAU/400 passes the flat sources,
        // and adding D67's rule and server reads pushed it LATER by raising
        // the baseline they have to beat from 26 reads/user/day to 46.
        bindsAtDau: 18_200,
        kind: "cost",
        instrumented: false,
        note: "DAU²/400 reads/day — 96% of all reads at 500k DAU. Fix is polling, not architecture",
        source: "docs/COSTS.md finding 2",
      },
      {
        name: "Identity Platform MAU cliff — IF the project is on that billing mode",
        bindsAtDau: Math.round(50_000 / B.mauMultiple),
        kind: "cost",
        instrumented: false,
        note: "$0 on plain Firebase Auth at any size; $505/mo at 150k MAU on Identity Platform. Console-only fact",
        source: "docs/COSTS.md finding 3; docs/SHIP-CHECKLIST.md §5",
      },
      {
        name: "Play Integrity standard quota on device activation",
        bindsAtDau: null,
        kind: "technical",
        instrumented: false,
        note: "~10k activations/day, bound by INSTALL rate not DAU — so it bites during a viral spike, which is when it hurts",
        source: "docs/DECISIONS.md D29",
      },
    ],
  };
}

// ── 2 · money ───────────────────────────────────────────────────
// Revenue is $0 and this panel says so. What it computes instead is the
// break-even surface: given the burn at each size, what would a path have
// to earn to cover it. That is the decision the owner actually faces —
// nobody is choosing between revenue streams yet, they are choosing what to
// charge — and it needs no revenue data to answer.
//
// The inputs live in monitoring/rates.json because they are the only
// numbers in this whole console that are neither derivable from the repo
// nor stated in a doc: they are the owner's pricing intent. Defaults are
// zero, so an unedited rate card produces an honest "no revenue modelled"
// rather than a flattering guess.

// How many places there are to sell to — the ceiling the units-to-break-even
// column is measured against, and the thing that makes "per city per month" a
// definable unit at all. Read out of the generated catalogue's own header
// rather than typed, so it moves with the catalogue (which check:cities
// already holds equal to its source).
export function addressablePlaces() {
  const head = read("public/cities.txt").slice(0, 400);
  const m = head.match(/(\d[\d,]*) places in (\d+) countries/);
  return m
    ? { places: Number(m[1].replace(/,/g, "")), countries: Number(m[2]),
        source: "public/cities.txt header (generated by scripts/build-cities.mjs)" }
    : null;
}

export function collectMoney(cost) {
  const rates = readJson("monitoring/rates.json");

  const fixedUsd = rates.fixed.reduce((a, f) => a + f.usdPerMonth, 0);
  const paths = rates.paths.map((p) => ({
    ...p,
    monthlyUsd: round2(p.assumedUnits * p.assumedUsdPerUnit),
  }));
  const revenueUsd = round2(paths.reduce((a, p) => a + p.monthlyUsd, 0));

  const breakEven = cost.scenarios.map((s) => {
    const burn = round2(s.totalUsd + fixedUsd);
    return {
      label: s.label,
      dau: s.dau,
      infraUsd: s.totalUsd,
      fixedUsd: round2(fixedUsd),
      burnUsd: burn,
      netUsd: round2(revenueUsd - burn),
      // The two unit economics worth carrying. Cost per user is the number
      // that decides whether the product can ever work; ARPU-needed is the
      // same number pointed at the price list.
      usdPerDauMonth: round6(burn / s.dau),
      // What each priced path would have to sell to cover the whole burn on
      // its own. Null where the rate card has not priced that path yet —
      // an unpriced path is a question, not a zero.
      unitsToBreakEven: Object.fromEntries(
        paths.map((p) => [
          p.id,
          p.assumedUsdPerUnit > 0 ? Math.ceil(burn / p.assumedUsdPerUnit) : null,
        ]),
      ),
    };
  });

  return {
    fixed: rates.fixed,
    fixedUsdPerMonth: round2(fixedUsd),
    paths,
    revenueUsdPerMonth: revenueUsd,
    priced: paths.some((p) => p.assumedUsdPerUnit > 0),
    addressable: addressablePlaces(),
    breakEven,
    // Restated here rather than linked, because it is the constraint that
    // makes this panel small: the sold thing is the same floored aggregate
    // every user sees free, so there is no premium data tier to model.
    constraint: rates.constraint,
  };
}

// ── 2b · the guard: usage against revenue (D332) ────────────────
// The owner's 2026-08-27 ask, monitoring half: say OUT LOUD when the bill
// is outrunning what the app earns, before an invoice does. The lever half
// is the read breaker (`npm run budget:mode`, src/v2/data/budgetMode.ts).
//
// The comparison is deliberately modelled-cost-at-MEASURED-size, not the
// scenario table: the scenarios are fixed hypotheticals, and "are we over"
// is a question about the population we actually have — which the app can
// finally answer, because the engagement digest (R1/D268) publishes daily
// actives and the scorecard fetch commits them here. Revenue stays the
// rate card's number: recorded prices × recorded units, zero until the
// owner writes one down, which keeps the guard honest about a revenue
// that does not exist yet.
//
// The allowance is the tolerance, not a target. $50/month is COSTS.md's
// own budget arithmetic ("traction arrived, or something is wrong"): the
// modelled bill at launch sizes is ~$0–2 plus ~$28 fixed, so a red guard
// means either the model's inputs moved (users arrived — go price a
// path) or a term is missing (the model's own correction record, five
// times over) — and both are an operator's morning, not a quiet drift.
//
// What this deliberately is NOT: a measurement of the invoice. The model
// has been corrected four times for missing terms, so the guard can be
// wrong the way the model is wrong — the Cloud Billing budget (COSTS.md,
// console-side) is the control that fires on the OUTCOME, and this row
// exists so the repo-side console stops needing to be asked.

// How old the measured day may be before it stops being a measurement.
// Not a taste number: the guard's own measure is the max of the latest day
// and the SEVEN-day mean, so once the last committed day is older than that
// window, every input the guard averages is out of it — the figure it
// prices is a description of a week nobody is living in. The engagement
// trail moves only when a human runs `npm run scorecard -- --fetch`;
// nothing schedules it, which is exactly why a frozen file has to be able
// to say so rather than passing forever.
export const MEASURE_MAX_AGE_DAYS = 7;

/** The pure verdict, tested without a tree. All inputs in USD/month. */
export function guardVerdict({
  allowanceUsd, measuredActives, measuredAgeDays, burnUsd, revenueUsd,
}) {
  if (typeof allowanceUsd !== "number") {
    // No allowance recorded is a question, not a pass — the unpriced-path
    // rule. The check treats it as unarmed and says how to arm it.
    return { state: "unarmed" };
  }
  if (measuredActives == null) {
    // No committed engagement trail yet (pre-launch, or the fetch has
    // never run). Nothing to compare — say so rather than comparing a
    // scenario and calling it a measurement.
    return { state: "unmeasured", allowanceUsd };
  }
  const netBurnUsd = round2(burnUsd - revenueUsd);
  const figures = {
    allowanceUsd,
    measuredActives,
    measuredAgeDays: measuredAgeDays ?? null,
    burnUsd: round2(burnUsd),
    revenueUsd: round2(revenueUsd),
    netBurnUsd,
  };
  // Over wins over stale, deliberately. An overshoot is true at the size
  // it was priced at — the population would have to have SHRUNK for it to
  // be wrong, and the operator has to look either way because both states
  // page. What staleness can make unbelievable is the PASS, and that is
  // the reading this state exists for: the same asymmetry the scorecard
  // has carried since D33, one panel over.
  if (netBurnUsd > allowanceUsd) return { state: "over", ...figures };
  if (figures.measuredAgeDays != null && figures.measuredAgeDays > MEASURE_MAX_AGE_DAYS) {
    return { state: "stale", ...figures };
  }
  return { state: "ok", ...figures };
}

export function collectGuard(regional, money, engagement) {
  const rates = readJson("monitoring/rates.json");
  const allowanceUsd = typeof rates.guard?.maxNetBurnUsdPerMonth === "number"
    ? rates.guard.maxNetBurnUsdPerMonth
    : null;

  // The measured size: the larger of yesterday's actives and the 7-day
  // mean, so one quiet day cannot green a guard the week would trip. Null
  // (never 0) while no digest day exists — absent is not zero, the
  // engagement panel's own rule.
  const measured = engagement.present && engagement.days > 0
    ? Math.max(engagement.latest?.actives ?? 0, Math.ceil(engagement.weekMeanActives ?? 0))
    : null;

  let burnUsd = null;
  if (measured != null && allowanceUsd != null) {
    const { model } = costModel({ regional });
    // `mature` follows the model's own classification of the scenario
    // sizes (immature below 5k), so the guard prices a measured 800 DAU
    // the way the table would price it.
    const at = model(measured, measured >= 5_000);
    burnUsd = totalCost(at.cost) + money.fixedUsdPerMonth;
  }

  // Age of the day the guard is pricing, not of the fetch that wrote the
  // file: `fetchedOn` moves every time somebody re-runs the fetch, so a
  // trail that has stopped folding days would keep looking fresh.
  const measuredOn = engagement.present ? engagement.lastDay ?? null : null;
  const measuredAgeDays = measuredOn
    ? Math.floor((Date.now() - Date.parse(`${measuredOn}T00:00:00Z`)) / 86400000)
    : null;

  const verdict = guardVerdict({
    allowanceUsd,
    measuredActives: measured,
    measuredAgeDays,
    burnUsd: burnUsd ?? 0,
    revenueUsd: money.revenueUsdPerMonth,
  });

  return {
    ...verdict,
    measuredOn,
    basis: "modelled infra cost at the measured actives (max of latest day and 7-day mean, "
      + "monitoring/engagement.json) plus fixed costs, against recorded revenue "
      + "(monitoring/rates.json). A model, not an invoice — the Cloud Billing budget is "
      + "the outcome-side control (docs/COSTS.md).",
  };
}

// ── 3 · the question pipeline ───────────────────────────────────
// The most live panel: nearly all of it computes from committed files
// today, pre-launch, with no credentials. It also holds the one number in
// this console whose neglect causes a user-visible failure — the deck
// runway.

export function collectPipeline() {
  const daily = readJson("content/daily-questions.json");
  const feed = readJson("content/feed-questions.json");
  const pick = readJson("content/pick-questions.json");
  const duel = readJson("content/duel-questions.json");
  const learn = readJson("content/learn-questions.json");
  const tests = readJson("content/tests.json");
  const lenses = readJson("content/lenses.json");
  const pulse = readJson("content/pulse-questions.json");
  const call = readJson("content/call-questions.json");

  const banks = [
    { surface: "daily", count: daily.length, source: "content/daily-questions.json" },
    { surface: "feed", count: feed.questions.length, source: "content/feed-questions.json" },
    // Catalogue picks (D232) — feed-surface docs from their own content
    // file, promoted out of the pick archive. The two-path bank-size
    // check caught this row missing the day the bank went live, which
    // makes it FOUR for four: every new bank has arrived through that
    // assertion rather than through anybody remembering this list.
    { surface: "pick", count: pick.questions.length, source: "content/pick-questions.json" },
    { surface: "duel · group", count: duel.group.length, source: "content/duel-questions.json" },
    { surface: "duel · 1v1", count: duel.oneVsOne.length, source: "content/duel-questions.json" },
    // Seeded active:false until the mode-aware client is the fleet (D40
    // part 4) — still bank docs, so still counted; the two-path bank-size
    // check in pulse.test.mjs is what caught this row missing.
    { surface: "duel · romantic", count: (duel.romantic ?? []).length, source: "content/duel-questions.json" },
    { surface: "learn", count: learn.cards.length, source: "content/learn-questions.json" },
    // The daily pulse's TEMPLATE docs (D139) — answers key {baseQid}_{day}
    // against these, so the bank holds one doc per pulse question however
    // many days it runs. The two-path bank-size check in pulse.test.mjs is
    // what caught THIS row missing, same as romantic's above.
    { surface: "pulse", count: pulse.questions.length, source: "content/pulse-questions.json" },
    // Foresight CALLs (D194). Every one is `active: false` today (D196) —
    // still bank docs, so still counted, exactly like the romantic pool
    // two rows up. The two-path bank-size check caught this row missing
    // too, which makes it three for three: every new bank has arrived
    // through that assertion rather than through anybody remembering.
    //
    // Feed ADS are deliberately NOT here. They are not questions, they are
    // seeded to v2_ads rather than v2_questions, and this total is checked
    // against a parse of V2_QUESTIONS — counting them would break the very
    // agreement this row exists to keep.
    { surface: "call", count: call.questions.length, source: "content/call-questions.json" },
    {
      surface: "test items",
      count: Object.values(tests).reduce(
        (a, t) => a + (Array.isArray(t?.questions) ? t.questions.length : 0), 0),
      source: "content/tests.json",
    },
    // The minor instruments' items, seeded on the SAME "test" surface since
    // D91 — their own row here because the console reads /content, where
    // they are their own file, and a lens item is a different content
    // family from a core-test item however the bank files it.
    {
      surface: "lens items",
      count: Object.values(lenses).reduce(
        (a, l) => a + (Array.isArray(l?.questions) ? l.questions.length : 0), 0),
      source: "content/lenses.json",
    },
  ];

  // The deck epoch, cross-read from the client the same way the scorecard
  // and check-pokedex read their constants — a stale copy here would
  // mis-derive the runway, which is the whole point of the tile.
  const deckSrc = read("src/v2/data/deck.ts");
  const epochM = deckSrc.match(/DECK_EPOCH = (\d+)/);
  if (!epochM) throw new Error("pulse: DECK_EPOCH not found in src/v2/data/deck.ts");
  const epoch = Number(epochM[1]);
  const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
  const daysElapsed = Math.max(0, today - epoch);

  // D30's no-wrap invariant: while n >= days-since-epoch, `computeDeckIds`
  // never wraps and appending questions moves no served day's mapping.
  // Past it the wrap returns and one reseed remaps a user's answered
  // history once — silently. Nothing else in the tree can notice this:
  // deck.test.ts pins the property, but a unit test cannot know today's
  // date relative to the shipped bank, which is exactly why it is here.
  const dailyCount = banks[0].count;
  const runwayDays = dailyCount - daysElapsed;

  // The farm's per-run cap, cross-read from the budget regulator (D97)
  // the same way DECK_EPOCH is read above — this used to be a hand-typed
  // 12 (D30's weekly figure), which D33's re-pace had already outdated:
  // exactly the stale-copy class the cross-read pattern exists for. Note
  // it is a CEILING: the regulator pins sustained output to promotion
  // throughput, so runCap × 7 is catch-up potential, not a forecast.
  const budgetSrc = read("scripts/farm-budget.mjs");
  const capM = budgetSrc.match(/export const RUN_CAP = (\d+)/);
  if (!capM) throw new Error("pulse: RUN_CAP not found in scripts/farm-budget.mjs");

  const scorecard = collectScorecard();

  return {
    banks,
    totalQuestions: banks.reduce((a, b) => a + b.count, 0),
    archive: collectArchive(daily),
    deck: {
      epoch,
      today,
      daysElapsed,
      dailyBank: dailyCount,
      runwayDays,
      // Consumption is one card per day; D30 records promotion at >=7/week,
      // and the farm's generation ceiling (D97's regulator, cross-read
      // above) sits far above it, so sustained promotion grows the bank
      // faster than the calendar eats it.
      consumedPerWeek: 7,
      promotionNeededPerWeek: 7,
      farmBudgetPerWeek: Number(capM[1]) * 7,
      wrapsOn: isoDay(epoch + dailyCount),
      status: runwayDays > 60 ? "good" : runwayDays > 21 ? "warning" : "critical",
    },
    scorecard,
  };
}

// The promotion backlog: archive entries that have never been promoted into
// the live bank. It answers the half of "do I need to write questions this
// week" that the runway cannot — a short runway with a full archive is a
// promotion PR, a short runway with an empty one is a writing session, and
// those are different afternoons.
//
// Joined by PROMPT STRING, because that is how the app itself joins them:
// liveSync (src/v2/spec/daily-questions.js) attaches seeded bank entries to
// archive entries by prompt equality and warns on orphans, and D30's
// promotion step copies prompts byte-for-byte for exactly this reason. So
// the orphan count below is not a bookkeeping curiosity — it is the same
// join the client does at runtime, checked statically.
//
// Both quote styles, deliberately: 6 of the 90 archive prompts contain an
// apostrophe and are double-quoted. A single-quote-only scan reports those
// six as orphans, which looks exactly like real drift. Measured, not
// guessed — that false positive is what prompted this comment.
export function collectArchive(liveDaily) {
  const src = read("src/v2/spec/daily-questions.js");
  const re = /prompt: (?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  const archive = [...src.matchAll(re)].map((m) => (m[1] ?? m[2]).replace(/\\(['"])/g, "$1"));

  const liveSet = new Set(liveDaily.map((q) => q.prompt));
  const archiveSet = new Set(archive);
  const unpromoted = archive.filter((p) => !liveSet.has(p));
  const orphans = liveDaily.filter((q) => !archiveSet.has(q.prompt)).map((q) => q.id);

  return {
    archiveEntries: archive.length,
    unpromoted: unpromoted.length,
    // A live question with no archive counterpart means liveSync will warn
    // and the demo layer will not join it. Never expected to be non-zero.
    orphans: orphans.length,
    orphanIds: orphans,
    source: "src/v2/spec/daily-questions.js ↔ content/daily-questions.json, joined by prompt",
  };
}

// The scorecard is the farm's eyes (D33) and this console does NOT
// re-implement its fetch: it reads the committed artifact, exactly like a
// scheduled farm run does. Two fetch paths against the same aggregates
// would be two things to keep in step, and the second one would drift.
export function collectScorecard() {
  if (!has("content/scorecard.json")) {
    return {
      present: false,
      staleness: "missing",
      note: "no committed content/scorecard.json — run `npm run scorecard -- --fetch`. "
        + "Pre-launch this is expected: there are no answers to score yet.",
    };
  }
  const sc = readJson("content/scorecard.json");
  const ageDays = sc.generatedAt
    ? Math.floor((Date.now() - Date.parse(sc.generatedAt)) / 86400000)
    : null;
  // QUESTION-FARM.md's own staleness rule, restated as data so the panel
  // and the farm cannot disagree about when a signal stops counting.
  const staleness = ageDays == null ? "unknown"
    : ageDays > 30 ? "expired"
    : ageDays > 14 ? "advisory"
    : "fresh";
  // THE SHAPE IS READ FROM THE REAL ARTIFACT, and it is worth saying why
  // that sentence had to be written twice. This first shipped against an
  // INVENTED shape — `sc.daily.scored` / `sc.feed.scored` — because no
  // scorecard existed yet to look at, and the unit test fixtured the same
  // invention, so it agreed with itself and proved nothing. When the first
  // real `content/scorecard.json` landed the collector read four fields
  // that do not exist and reported zero scored questions.
  //
  // The dangerous part is that zero LOOKED right: pre-launch nothing has
  // been answered, so the wrong reading and the true one were the same
  // number, and it would have stayed zero forever after launch. A fixture
  // you wrote yourself cannot catch that — the test now reads the committed
  // artifact.
  //
  // Real shape (scripts/question-scorecard.mjs): `coverage` is the rollup,
  // `perQuestion[]` carries {qid, surface, topic, type, total, evenness,
  // optionShares, served, signal}, and leaders/laggards/retireProposals are
  // top-level arrays rather than per-surface ones.
  const perQuestion = Array.isArray(sc.perQuestion) ? sc.perQuestion : [];
  const cov = sc.coverage || {};
  return {
    present: true,
    generatedAt: sc.generatedAt || null,
    ageDays,
    staleness,
    scoredQuestions: cov.scored ?? 0,
    // Questions that exist but the deck has not reached yet. Pre-launch this
    // is most of the bank and says nothing; after launch a stubbornly high
    // number means the deck is not getting through what has been written.
    unserved: cov.unserved ?? 0,
    questionsTracked: cov.questions ?? perQuestion.length,
    // The product's own bar, as a distribution rather than an average: a
    // mean evenness hides the shape, and the shape is the thing ("splits,
    // not landslides"). Buckets, not a mean.
    evennessBuckets: bucketEvenness(perQuestion),
    totalAnswers: perQuestion.reduce((a, q) => a + (q.total || 0), 0),
    retireProposals: (sc.retireProposals || []).length,
    learnCards: sc.learn?.coverage?.cards ?? 0,
    learnScored: sc.learn?.coverage?.scored ?? 0,
  };
}

export function bucketEvenness(scored) {
  const edges = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];
  const labels = ["landslide", "lopsided", "leaning", "split", "even"];
  const counts = labels.map(() => 0);
  for (const q of scored) {
    if (typeof q.evenness !== "number") continue;
    for (let i = 0; i < labels.length; i++) {
      if (q.evenness >= edges[i] && q.evenness < edges[i + 1]) { counts[i]++; break; }
    }
  }
  return labels.map((label, i) => ({ label, count: counts[i] }));
}

// ── 4 · population ──────────────────────────────────────────────
// The panel that mostly refuses. "User analysis" in the ordinary sense —
// funnels, cohort retention, session analytics — does not exist here and
// cannot be added without reversing a decision record. What this returns is
// the honest three-way split: what is derivable, what is merely unbuilt,
// and what is off the table. docs/MONITORING.md carries the argument; this
// carries the list, so the console shows the refusals rather than showing
// four empty charts and letting the reader assume the data is coming.

export function collectPopulation(pipeline) {
  const sc = pipeline.scorecard;
  const launched = sc.present && sc.totalAnswers > 0;

  return {
    state: launched ? "live" : "pre-launch",
    // Derivable today, from the public aggregate mirror the scorecard
    // already reads. These are FLOORS on real activity, not measurements —
    // a question with no answers has no aggregate document and contributes
    // nothing, so every number here understates.
    live: [
      {
        metric: "answers counted, all published questions",
        value: launched ? sc.totalAnswers : null,
        source: "content/scorecard.json ← v2_question_aggs",
        caveat: "unanswered questions have no aggregate document yet",
      },
      {
        metric: "questions carrying at least one answer",
        value: launched ? sc.scoredQuestions : null,
        source: "content/scorecard.json",
        caveat: "the honest proxy for 'is anyone here' before any analytics exist",
      },
      {
        metric: "DAU floor from today's daily question",
        value: null,
        source: "v2_question_aggs/{today's qid}.total",
        caveat: "one answer per user per day on the shared daily makes its total a DAU floor. "
          + "Not yet extracted — the scorecard scores questions, it does not date them",
      },
      {
        metric: "DAU, D1/D7/D30 cohort returns, streak deaths — nightly since D268",
        value: null,
        source: "monitoring/engagement.json ← v2_engagement_daily ← digestEngagementV2",
        caveat: "counts ANSWERING accounts — floors, not measurements: a person who opens and "
          + "answers nothing is invisible at rung 0 (docs/ENGAGEMENT-PLAN.md §2). The "
          + "engagement panel below draws the trail",
      },
    ],
    // Unbuilt, not forbidden. The distinction matters: each of these could
    // be built without reversing anything, and each has a real cost.
    blocked: [
      // The DAU/retention row that stood here graduated to the live column
      // on 2026-08-23: D268 is the recorded decision its catch demanded,
      // and digestEngagementV2 is the counting job. The catch was real and
      // was honoured in the order it asked for — record first, then build.
      {
        metric: "real spend vs the modelled bill",
        unblockedBy: "a Cloud Billing BigQuery export, or a monthly figure pasted into rates.json",
        cost: "console setup; the export is free, the BigQuery storage is not quite",
        catch: "everything in the cost panel is a PREDICTION until this exists. COSTS.md was "
          + "written to be diffed against the first invoice — nothing has diffed it yet",
      },
      {
        metric: "install → first answer conversion",
        unblockedBy: "store console figures (installs) against the DAU floor above",
        cost: "manual, monthly, two numbers",
        catch: "the store side is not in this repo and never will be; this stays a paste-in",
      },
    ],
    // Off the table. Each names the record it would reverse, because
    // "we decided not to" is only useful with the decision attached.
    refused: [
      {
        metric: "per-user RAW behaviour — event streams, reading history, per-target views",
        record: "D269, the binding ceiling. The old row here ('per-user funnels, session "
          + "analytics, engagement scoring') was reversed rung by rung — D268, D270, D271, "
          + "D272 — each with its record, its rules arms and its store-form move",
        why: "what ships is bounded by construction: the rollup carries no question id "
          + "(rules-refused), is readable by nobody including its owner, and expires at 90 "
          + "days; the shards are unlinkable even to a device. What D269 keeps out is the "
          + "dossier shapes — logs, sequences, who-viewed-whom, hesitation — and any anchor "
          + "or Art. 9 slice",
      },
      {
        metric: "retention or engagement sliced by anchor (age, gender, country, education…)",
        record: "docs/MONITORING.md § Off the table — re-affirmed after D98 as an analytics "
          + "decision standing on its own; D8",
        why: "nothing technical stops this since D98 deleted the floor — the anchors are public "
          + "and the fold is a query away. It stays refused because per-cohort engagement "
          + "scoring is the behavioural model MONETIZATION.md rules out, and the digest holds "
          + "the line by construction: its store reads uid, qid and dates, and can reach no "
          + "anchor",
      },
      {
        metric: "anything sliced by political result",
        record: "D8; GDPR Art. 9",
        why: "special-category data. Never sliced by, never published, never leaves the owner doc",
      },
      {
        metric: "per-PERSON skip/pass lists, and hesitation timing anywhere",
        record: "docs/QUESTION-FARM.md's line, narrowed at D271 the way D163 narrowed this "
          + "table's last row: per-QUESTION aggregate skip rates now ship (the scorecard's "
          + "attention columns); a person's list and per-option deliberation timing stay "
          + "refused under D269",
        why: "a question's pass rate is a fact about content; a person's passes are a "
          + "behavioural profile with a friendlier name, and the shards' unlinkability is "
          + "what keeps the first from ever becoming the second",
      },
      {
        metric: "per-user content selection, ad targeting profiles",
        record: "docs/MONETIZATION.md — 'Ruled out by standing posture'",
        why: "server-side per-user selection is the moment a behavioural profile exists, "
          + "whatever the intent. The ad path that survives is contextual",
      },
    ],
  };
}

// ── 4b · engagement (R1/D268) ───────────────────────────────────
// The digest trail: anonymous per-day population counts, folded nightly
// by digestEngagementV2 into v2_engagement_daily and committed here by
// `npm run scorecard -- --fetch` (one fetch path — the scorecard's own).
// Everything below is a fold over the committed file; the pure half is
// exported separately so the arithmetic tests without a tree.

/** Fold an array of v2_engagement_daily day docs into the panel reading.
 * Null-aware on purpose: a cohort day the digest never folded has no
 * firstTime count, so its rate is UNKNOWN (null), never 0% — and a `of`
 * of zero is a known-empty cohort, which is a different fact. */
export function engagementFromDays(days) {
  const all = [...(days || [])]
    .filter((d) => d && typeof d.day === "string")
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  // Digest rows only, for the digest's own metrics: a doc holding just
  // late-shard attention (its day predates the digest's catch-up) has no
  // `actives`, and reading it as a zero-actives day would be the
  // absent≠zero failure wearing a new face.
  const rows = all.filter((d) => typeof d.actives === "number");
  // The newest attention section, wherever it landed (R2/D270): reach is
  // devices that used the feature at all — bucketing cannot distort it —
  // and est is the midpoint estimate, both already scaled by the
  // sampling rate at fold time.
  const attnRow = [...all].reverse().find((d) => d.attn && typeof d.attn === "object");
  const attn = attnRow
    ? {
        day: attnRow.day,
        devices: attnRow.attn.devices ?? 0,
        features: Object.entries(attnRow.attn.s || {})
          .map(([key, v]) => ({ key, reach: v?.reach ?? 0, est: v?.est ?? 0 }))
          .sort((a, b) => b.reach - a.reach),
        // R4/D271: how many questions carried counts, not the counts
        // themselves — the per-question table is the scorecard's job.
        qidCount: Object.keys(attnRow.attn.q || {}).length,
      }
    : null;
  // The person channel's fold (R3/D272), newest day that has one.
  const peopleRow = [...all].reverse().find((d) => d.people && typeof d.people === "object");
  const people = peopleRow
    ? (() => {
        const p = peopleRow.people;
        const sessions = p.sessions ?? 0;
        return {
          day: peopleRow.day,
          rollups: p.rollups ?? 0,
          sessions,
          quiet: p.quiet ?? 0,
          quietShare: sessions > 0 ? round2((p.quiet ?? 0) / sessions) : null,
          fading: p.fading ?? 0,
          reachedEnd: p.depthEnd ?? 0,
        };
      })()
    : null;
  if (!rows.length) {
    const bare = { days: 0 };
    if (attn) bare.attn = attn;
    if (people) bare.people = people;
    return bare;
  }
  const latest = rows[rows.length - 1];
  const last7 = rows.slice(-7);
  // Days inside the span the digest never folded — the console draws
  // these as gaps, never as zeros (the pulse-trail rule; a zero day is a
  // REAL doc with actives: 0).
  const spanDays =
    Math.round((Date.parse(`${latest.day}T00:00:00Z`) - Date.parse(`${rows[0].day}T00:00:00Z`)) / 86400000) + 1;
  const rate = (r) => {
    const returned = r?.returned ?? 0;
    const of = r?.of ?? null;
    return { returned, of, rate: of == null || of === 0 ? null : round2(returned / of) };
  };
  return {
    days: rows.length,
    gaps: spanDays - rows.length,
    firstDay: rows[0].day,
    lastDay: latest.day,
    latest: {
      day: latest.day,
      actives: latest.actives ?? 0,
      firstTime: latest.firstTime ?? 0,
      votes: latest.votes ?? 0,
      events: latest.events ?? 0,
      streaksBroken: latest.streaksBroken ?? 0,
      bySurface: latest.bySurface || {},
    },
    weekMeanActives: round2(last7.reduce((a, d) => a + (d.actives || 0), 0) / last7.length),
    returned: {
      d1: rate(latest.returned?.d1),
      d7: rate(latest.returned?.d7),
      d30: rate(latest.returned?.d30),
    },
    attn,
    people,
  };
}

export function collectEngagement() {
  if (!has("monitoring/engagement.json")) {
    return {
      present: false,
      note: "no committed monitoring/engagement.json — `npm run scorecard -- --fetch` writes it "
        + "from the public v2_engagement_daily trail once digestEngagementV2 has folded a day "
        + "(R1/D268). Before the first deploy this is expected: the digest has never run.",
    };
  }
  const raw = readJson("monitoring/engagement.json");
  return { present: true, fetchedOn: raw.fetchedOn || null, ...engagementFromDays(raw.days) };
}

// ── 5 · instrumentation ─────────────────────────────────────────
// "Am I flying blind?" as a count. Scanned rather than listed, so a new
// function or a new alert policy shows up here without anyone remembering
// to add it — the failure mode this whole console exists to reduce.

export function collectInstrumentation() {
  const fnFiles = readdirSync(join(ROOT, "functions/src"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  const functions = [];
  for (const f of fnFiles) {
    const src = read(`functions/src/${f}`);
    // The v2 export surface is what deploys, and the trigger KIND is read
    // rather than listed. Naming three of them —
    // onCall/onDocumentCreated/onSchedule — silently dropped the two the
    // tree grew afterwards: `onDocumentUpdated` (D86's answer-edit fold)
    // and `onRequest` (the Stripe webhook, D313). Neither has an alert
    // policy, so the console's "am I flying blind?" panel reported
    // 40 of 42 functions and the two it could not see were the two least
    // watched. `check:figures` reads the same surface with `on[A-Z]`, and
    // now so does this; a wrapper form would still be missed, which is why
    // the count is reported beside the file list rather than asserted.
    for (const m of src.matchAll(/export const (\w+) = (on[A-Z]\w+)\b/g)) {
      functions.push({ name: m[1], kind: m[2], file: `functions/src/${f}` });
    }
  }

  const logMetrics = [];
  for (const f of fnFiles) {
    const src = read(`functions/src/${f}`);
    for (const m of src.matchAll(/metric:\s*"([\w-]+)"/g)) {
      logMetrics.push({
        name: m[1],
        file: `functions/src/${f}`,
        line: src.slice(0, m.index).split("\n").length,
      });
    }
  }

  // WHAT COUNTS AS A POLICY, by SHAPE rather than by name. This filter was
  // a denylist — every .json in monitoring/ except pulse.json and
  // rates.json — which meant any new non-policy file dropped in here
  // silently became a row in the alert table with `undefined` for its name.
  //
  // Not hypothetical: the first `scorecard --fetch` to write
  // monitoring/engagement.json (2026-08-26) produced exactly that, and the
  // only reason it had never happened before is that no third kind of file
  // had ever landed in this directory. A denylist that must be edited for
  // every new file is a denylist that will be forgotten; a Cloud Monitoring
  // alert policy always carries displayName and conditions, so ask for
  // those instead and the question stops being maintained by hand.
  const policyFiles = readdirSync(join(ROOT, "monitoring"))
    .filter((f) => f.endsWith(".json"))
    .filter((f) => {
      // try/catch because this now parses EVERY .json in the directory,
      // and one of them is monitoring/pulse.json — machine-written by
      // scripts/pulse.mjs and gitignored, so the file here most likely to
      // be caught half-written by an interrupted run. Without the guard an
      // interrupted `npm run pulse` makes the NEXT `npm run pulse` throw a
      // JSON syntax error naming a position and no file.
      //
      // Shape alone is the right test here, unlike in check-monitoring:
      // the gate is what must CATCH a policy missing displayName, so it
      // deliberately admits malformed ones. This only draws a table, and a
      // row it cannot name is a row headed `undefined`.
      let p;
      try { p = readJson(`monitoring/${f}`); } catch { return false; }
      return typeof p.displayName === "string" && Array.isArray(p.conditions);
    });
  const policies = policyFiles.map((f) => {
    const p = readJson(`monitoring/${f}`);
    const cond = p.conditions?.[0] || {};
    return {
      file: `monitoring/${f}`,
      displayName: p.displayName,
      watches: cond.conditionMatchedLog
        ? "log match"
        : cond.conditionThreshold
          ? `threshold on ${cond.conditionThreshold.filter?.match(/user\/([\w-]+)/)?.[1] || "a metric"}`
          : "unknown",
      enabled: p.enabled === true,
      // The honest bit. These are committed JSON; nothing applies them
      // AUTOMATICALLY — monitoring.yml is workflow_dispatch only, with
      // `apply` off by default and never on the deploy path — so a policy
      // exists in the repo whether or not it exists in Cloud Monitoring.
      appliedByCi: false,
    };
  });

  // Which functions any policy actually WATCHES. Substring rather than a
  // parse: the filters spell the function name in two casings (Cloud Run
  // service names are lowercased), so a case-insensitive contains is both
  // the simplest and the most forgiving test.
  //
  // Scanned over `displayName` + `conditions` — what the policy IS — and
  // deliberately NOT `documentation`, which is the runbook and names
  // functions the policy does not watch. Reading the raw file swept the
  // runbook too: scheduledDuelReveals-silent.json tells the operator to run
  // revealDuelsNowV2 as the first response, and that counted the callable
  // as alerted — 3 of 14 on a console whose honest answer was 2. Coverage
  // that rises because someone wrote a BETTER runbook is precisely the
  // flattering direction a survey must not miscount in.
  //
  // Both halves are load-bearing, and conditions alone is not enough: a
  // policy can watch a function without naming it in a filter. The reveal
  // policy's condition names the log-based metric (duel_reveal_run), never
  // the function — so a conditions-only test reported 1 of 14 and dropped a
  // real alert. displayName is where that policy says what it is about.
  const watchedNames = new Set();
  for (const f of policyFiles) {
    const p = readJson(`monitoring/${f}`) || {};
    const scope = `${p.displayName || ""} ${JSON.stringify(p.conditions ?? [])}`.toLowerCase();
    for (const fn of functions) if (scope.includes(fn.name.toLowerCase())) watchedNames.add(fn.name);
  }

  return {
    functions: functions.map((f) => ({ ...f, alerted: watchedNames.has(f.name) })),
    functionCount: functions.length,
    alertedCount: watchedNames.size,
    logMetrics,
    policies,
    note: "Alert policies are committed JSON, put live by dispatching the Arm "
      + "monitoring workflow or by `npm run monitoring:apply` (idempotent, dry-run "
      + "by default). Never on the deploy path — deliberately, since a pipeline "
      + "that can rewrite a policy can delete one silently in a deploy that was "
      + "about something else. So a policy listed here is a policy in the REPO, not "
      + "necessarily one live in Cloud Monitoring: this column reads the tree and "
      + "never claims otherwise. `npm run observe` is what reads the project.",
  };
}

// ── assembly ────────────────────────────────────────────────────

export function collect({ regional = REGIONAL } = {}) {
  const cost = collectCost(regional);
  const pipeline = collectPipeline();
  const money = collectMoney(cost);
  const engagement = collectEngagement();
  return {
    // Day granularity, not a timestamp: this artifact is committed, and a
    // millisecond in the diff would make every regeneration look like a
    // change to something.
    generatedOn: isoDay(Math.floor(Date.now() / 86400000)),
    cost,
    money,
    guard: collectGuard(regional, money, engagement),
    pipeline,
    population: collectPopulation(pipeline),
    engagement,
    instrumentation: collectInstrumentation(),
  };
}
