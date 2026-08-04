#!/usr/bin/env node
// pulse.mjs — the decision console: one page that answers "what should I do
// about this next?" across cost, money, the question pipeline, and reach.
//
// WHY THIS EXISTS. Two instruments already existed and neither was a view.
// `cost-model.mjs` prints five scenarios of predicted bill. `question-
// scorecard.mjs` scores questions the crowd has already answered. Between
// them sat the things nobody was computing at all: what the bill nets
// against, how many days of question runway are left before D30's no-wrap
// invariant breaks, and how much of the backend has an instrument pointed
// at it. Those are decisions, and they were being made from memory.
//
// WHAT IT IS NOT. Not analytics. This repo ships no product analytics (see
// docs/data-inventory.md, "Not collected"), and this script does not change
// that: every number below comes from a committed file, the cost model's
// stated assumptions, or the k-floored public aggregates the scorecard
// already reads. Nothing here reads a user. docs/MONITORING.md carries the
// full list of what was deliberately NOT built and which record forbids it.
//
// WHAT IT IS NOT, PART 2: a gate. `--check` exists and exits non-zero, but
// it is deliberately not wired into CI — see the block above check() for the
// argument, which is the same one that keeps check:figures off the backend
// path.
//
//   node scripts/pulse.mjs               # write monitoring/pulse.json + .html
//   node scripts/pulse.mjs --json        # print the artifact, write nothing
//   node scripts/pulse.mjs --check       # operator gate: runway + staleness
//   node scripts/pulse.mjs --regional    # model the single-region price sheet
//
// Node stdlib only, like every deploy-adjacent script here.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  costModel, authCost, writesPerSec, CONTENTION_DAU, B, SCENARIOS,
  firestoreCost, functionsCost, totalCost,
} from "./cost-arith.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = join(ROOT, "monitoring", "pulse.json");
const OUT_HTML = join(ROOT, "monitoring", "pulse.html");

const args = process.argv.slice(2);
const REGIONAL = args.includes("--regional");
const CHECK = args.includes("--check");
const JSON_ONLY = args.includes("--json");

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));
const has = (rel) => existsSync(join(ROOT, rel));

// ── 1 · cost ────────────────────────────────────────────────────
// Straight through cost-arith, which is also what cost-model.mjs prints.
// One arithmetic, two consumers: the console cannot disagree with the CLI
// about the bill, because there is nothing for it to disagree with.

function collectCost() {
  const { bank, model } = costModel({ regional: REGIONAL });

  const scenarios = SCENARIOS.map(([dau, mature, label]) => {
    const now = model(dau, mature);
    const fixed = model(dau, mature, { staticBank: true, pollAggs: true });
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
    region: REGIONAL ? "single-region" : "nam5 multi-region",
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
        bindsAtDau: 50_000,
        kind: "cost",
        instrumented: false,
        note: "DAU²/400 reads/day — 88% of the bill at 500k DAU. Fix is polling, not architecture",
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
function addressablePlaces() {
  const head = read("public/cities.txt").slice(0, 400);
  const m = head.match(/(\d[\d,]*) places in (\d+) countries/);
  return m
    ? { places: Number(m[1].replace(/,/g, "")), countries: Number(m[2]),
        source: "public/cities.txt header (generated by scripts/build-cities.mjs)" }
    : null;
}

function collectMoney(cost) {
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

// ── 3 · the question pipeline ───────────────────────────────────
// The most live panel: nearly all of it computes from committed files
// today, pre-launch, with no credentials. It also holds the one number in
// this console whose neglect causes a user-visible failure — the deck
// runway.

function collectPipeline() {
  const daily = readJson("content/daily-questions.json");
  const feed = readJson("content/feed-questions.json");
  const duel = readJson("content/duel-questions.json");
  const learn = readJson("content/learn-questions.json");
  const tests = readJson("content/tests.json");

  const banks = [
    { surface: "daily", count: daily.length, source: "content/daily-questions.json" },
    { surface: "feed", count: feed.questions.length, source: "content/feed-questions.json" },
    { surface: "duel · group", count: duel.group.length, source: "content/duel-questions.json" },
    { surface: "duel · 1v1", count: duel.oneVsOne.length, source: "content/duel-questions.json" },
    { surface: "learn", count: learn.cards.length, source: "content/learn-questions.json" },
    {
      surface: "test items",
      count: Object.values(tests).reduce(
        (a, t) => a + (Array.isArray(t?.questions) ? t.questions.length : 0), 0),
      source: "content/tests.json",
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
      // Consumption is one card per day; D30 records promotion at >=7/week
      // against a farm budget cap of 12/week, so sustained promotion grows
      // the bank faster than the calendar eats it.
      consumedPerWeek: 7,
      promotionNeededPerWeek: 7,
      farmBudgetPerWeek: 12,
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
function collectArchive(liveDaily) {
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
function collectScorecard() {
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
  const scored = [...(sc.daily?.scored || []), ...(sc.feed?.scored || [])];
  return {
    present: true,
    generatedAt: sc.generatedAt || null,
    ageDays,
    staleness,
    scoredQuestions: scored.length,
    // The product's own bar, as a distribution rather than an average: a
    // mean evenness hides the shape, and the shape is the thing ("splits,
    // not landslides"). Buckets, not a mean.
    evennessBuckets: bucketEvenness(scored),
    totalAnswers: scored.reduce((a, q) => a + (q.total || 0), 0),
    retireProposals: (sc.daily?.retireProposals?.length || 0)
      + (sc.feed?.retireProposals?.length || 0),
  };
}

function bucketEvenness(scored) {
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

function collectPopulation(pipeline) {
  const sc = pipeline.scorecard;
  const launched = sc.present && sc.totalAnswers > 0;

  return {
    state: launched ? "live" : "pre-launch",
    // Derivable today, from the k-floored public mirror the scorecard
    // already reads. These are FLOORS on real activity, not measurements —
    // a question below AGG_MIN_N publishes {tooSmall:true} and contributes
    // nothing, so every number here understates.
    live: [
      {
        metric: "answers counted, all published questions",
        value: launched ? sc.totalAnswers : null,
        source: "content/scorecard.json ← v2_question_aggs (k-floored)",
        caveat: "a floor, not a count: questions under AGG_MIN_N publish nothing",
      },
      {
        metric: "questions that have cleared the k-floor",
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
    ],
    // Unbuilt, not forbidden. The distinction matters: each of these could
    // be built without reversing anything, and each has a real cost.
    blocked: [
      {
        metric: "DAU / D1–D7 retention / answers-per-user",
        unblockedBy: "a server-side counting job over v2_agg_events",
        cost: "one scheduled function; the collection already exists (qid, uid, at, 90-day TTL) "
          + "and is already erased with the account",
        catch: "v2_agg_events was justified as fake-account attribution (D28). Counting distinct "
          + "uids per day is a NEW PURPOSE for existing data, which needs a recorded decision "
          + "before it is built — not new collection, but not free either",
      },
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
        metric: "per-user funnels, session analytics, engagement scoring",
        record: "docs/data-inventory.md — 'No product analytics of any kind ship today'",
        why: "there is no client event pipeline to read, by design. Adding one is a privacy "
          + "decision, not a monitoring tweak",
      },
      {
        metric: "retention or engagement sliced by anchor (age, gender, country, education…)",
        record: "D8 / D18 — the k-floor and complementary suppression",
        why: "the same suppression that stops a buyer identifying a person stops the owner "
          + "doing it. That is the guarantee working, not a gap in the tooling",
      },
      {
        metric: "anything sliced by political result",
        record: "D8; GDPR Art. 9",
        why: "special-category data. Never sliced by, never published, never leaves the owner doc",
      },
      {
        metric: "skip / pass / hesitation rates on questions",
        record: "docs/QUESTION-FARM.md, 'Deliberately out of scope'",
        why: "server-side telemetry on what a user declined to answer is a behavioural profile "
          + "with a friendlier name",
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

// ── 5 · instrumentation ─────────────────────────────────────────
// "Am I flying blind?" as a count. Scanned rather than listed, so a new
// function or a new alert policy shows up here without anyone remembering
// to add it — the failure mode this whole console exists to reduce.

function collectInstrumentation() {
  const fnFiles = readdirSync(join(ROOT, "functions/src"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  const functions = [];
  for (const f of fnFiles) {
    const src = read(`functions/src/${f}`);
    // The v2 export surface is what deploys. `export const x = onCall(` /
    // `onDocumentCreated(` / `onSchedule(` is the whole shape here; a
    // wrapper form would be missed, which is why the count is reported
    // beside the file list rather than asserted.
    for (const m of src.matchAll(/export const (\w+) = (onCall|onDocumentCreated|onSchedule)\b/g)) {
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

  const policyFiles = readdirSync(join(ROOT, "monitoring"))
    .filter((f) => f.endsWith(".json") && f !== "pulse.json" && f !== "rates.json");
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
      // The honest bit. These are committed JSON; nothing in
      // .github/workflows applies them, so a policy exists in the repo
      // whether or not it exists in Cloud Monitoring.
      appliedByCi: false,
    };
  });

  // Which functions any policy actually names. Substring rather than a
  // parse: the filters spell the function name in two casings (Cloud Run
  // service names are lowercased), so a case-insensitive contains is both
  // the simplest and the most forgiving test.
  const watchedNames = new Set();
  for (const f of policyFiles) {
    const raw = read(`monitoring/${f}`).toLowerCase();
    for (const fn of functions) if (raw.includes(fn.name.toLowerCase())) watchedNames.add(fn.name);
  }

  return {
    functions: functions.map((f) => ({ ...f, alerted: watchedNames.has(f.name) })),
    functionCount: functions.length,
    alertedCount: watchedNames.size,
    logMetrics,
    policies,
    note: "Alert policies are committed JSON. Nothing in .github/workflows applies them — "
      + "a policy here is a policy in the repo, not necessarily one in Cloud Monitoring. "
      + "docs/MONITORING.md records why that is currently the right trade.",
  };
}

// ── assembly ────────────────────────────────────────────────────

function collect() {
  const cost = collectCost();
  const pipeline = collectPipeline();
  return {
    // Day granularity, not a timestamp: this artifact is committed, and a
    // millisecond in the diff would make every regeneration look like a
    // change to something.
    generatedOn: isoDay(Math.floor(Date.now() / 86400000)),
    cost,
    money: collectMoney(cost),
    pipeline,
    population: collectPopulation(pipeline),
    instrumentation: collectInstrumentation(),
  };
}

// ── the trail ───────────────────────────────────────────────────
// A snapshot that overwrites itself cannot show a direction, and direction
// is most of what a decision needs — "the runway is 87 days" is worth much
// less than "the runway is 87 days and it was 94 last week." The scorecard
// has this problem too (one OUT path, overwritten every run, no history at
// all); this at least does not repeat it.
//
// JSONL, one row per DAY rather than per run: append-only so a regeneration
// can never destroy a past reading, and re-running on the same day replaces
// that day's row rather than adding a duplicate. Only the handful of figures
// worth trending — the full artifact is in pulse.json, and a trail that
// carried everything would be a second copy of it that nobody could read.
const OUT_TRAIL = join(ROOT, "monitoring", "pulse-trail.jsonl");

function trailRow(p) {
  return {
    on: p.generatedOn,
    runwayDays: p.pipeline.deck.runwayDays,
    dailyBank: p.pipeline.deck.dailyBank,
    totalQuestions: p.pipeline.totalQuestions,
    unpromoted: p.pipeline.archive.unpromoted,
    seededBankDocs: p.cost.seededBankDocs,
    burnUsd5k: p.money.breakEven[2].burnUsd,
    burnUsd50k: p.money.breakEven[3].burnUsd,
    revenueUsd: p.money.revenueUsdPerMonth,
    functionsAlerted: p.instrumentation.alertedCount,
    functionCount: p.instrumentation.functionCount,
    scorecardAgeDays: p.pipeline.scorecard.ageDays ?? null,
    answersCounted: p.pipeline.scorecard.totalAnswers ?? null,
  };
}

function appendTrail(p) {
  const row = trailRow(p);
  const prior = existsSync(OUT_TRAIL)
    ? readFileSync(OUT_TRAIL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const kept = prior.filter((r) => r.on !== row.on);
  const rows = [...kept, row].sort((a, b) => a.on.localeCompare(b.on));
  writeFileSync(OUT_TRAIL, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return rows;
}

function readTrail() {
  if (!existsSync(OUT_TRAIL)) return [];
  return readFileSync(OUT_TRAIL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// ── the operator gate ───────────────────────────────────────────
// `--check` is a REAL gate — it exits non-zero — and it is deliberately NOT
// in CI. The conditions it catches are content-operations conditions: the
// deck runway shortens by one every midnight whether or not anyone opened
// a pull request, so wiring this into CI would fail unrelated work on a
// Tuesday for a reason that pull request cannot fix. That is exactly the
// failure mode CLAUDE.md's rule about keeping client-only checks off the
// backend path is protecting against, pointed the other way.
//
// Where it belongs instead is the farm's scheduled run, beside the
// scorecard read it already does — a job that runs daily and whose job it
// IS to write questions. That wiring lives outside this repo, so this
// prints the recommendation rather than pretending to have done it.

const RUNWAY_FLOOR = 21;   // three weeks — two farm cycles of notice

function check(pulse) {
  const problems = [];
  const { deck, scorecard } = pulse.pipeline;

  if (deck.runwayDays < RUNWAY_FLOOR) {
    problems.push(
      `deck runway is ${deck.runwayDays} days (floor ${RUNWAY_FLOOR}).\n`
      + `    The daily bank holds ${deck.dailyBank} questions and the calendar has eaten\n`
      + `    ${deck.daysElapsed} of them since DECK_EPOCH. At zero, computeDeckIds starts\n`
      + `    wrapping again and the next reseed silently remaps every user's answered\n`
      + `    history once (D30, the residual limit). Nothing else in the tree notices.\n`
      + `    Fix: promote questions into content/daily-questions.json — ${deck.promotionNeededPerWeek}/week\n`
      + "    keeps the invariant, and the farm's budget cap allows "
      + `${deck.farmBudgetPerWeek}.`,
    );
  }

  if (scorecard.present && scorecard.staleness === "expired") {
    problems.push(
      `content/scorecard.json is ${scorecard.ageDays} days old (expired past 30).\n`
      + "    QUESTION-FARM.md's staleness rule puts the farm on lane 3 only until it is\n"
      + "    refreshed. Fix: npm run scorecard -- --fetch",
    );
  }

  if (problems.length) {
    console.error("\npulse --check: conditions that need an operator, not a commit:\n");
    for (const p of problems) console.error(`  ${p}\n`);
    return 1;
  }
  console.log(
    `pulse --check OK — deck runway ${deck.runwayDays} days, `
    + `scorecard ${scorecard.present ? scorecard.staleness : "absent (pre-launch)"}.`,
  );
  return 0;
}

// ── helpers ─────────────────────────────────────────────────────
const round2 = (n) => Math.round(n * 100) / 100;
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const isoDay = (dayIndex) => new Date(dayIndex * 86400000).toISOString().slice(0, 10);

// ── main ────────────────────────────────────────────────────────

const pulse = collect();

if (JSON_ONLY) {
  console.log(JSON.stringify({ ...pulse, trail: readTrail() }, null, 2));
} else if (CHECK) {
  process.exit(check(pulse));
} else {
  const { renderPulse } = await import("./pulse-render.mjs");
  const trail = appendTrail(pulse);
  writeFileSync(OUT_JSON, JSON.stringify(pulse, null, 2) + "\n");
  writeFileSync(OUT_HTML, renderPulse(pulse, trail));
  const { deck } = pulse.pipeline;
  console.log(
    `pulse: wrote monitoring/pulse.json and monitoring/pulse.html\n`
    + `  burn at ${pulse.cost.scenarios[2].label.toLowerCase()}: `
    + `$${pulse.money.breakEven[2].burnUsd}/mo · `
    + `deck runway ${deck.runwayDays} days · `
    + `${pulse.instrumentation.alertedCount}/${pulse.instrumentation.functionCount} functions alerted`,
  );
  console.log("  open monitoring/pulse.html in a browser (it is self-contained; no server needed)");
}
