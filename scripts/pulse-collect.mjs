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
  firestoreCost, functionsCost, totalCost,
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
    region: regional ? "single-region" : "nam5 multi-region",
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

// ── 3 · the question pipeline ───────────────────────────────────
// The most live panel: nearly all of it computes from committed files
// today, pre-launch, with no credentials. It also holds the one number in
// this console whose neglect causes a user-visible failure — the deck
// runway.

export function collectPipeline() {
  const daily = readJson("content/daily-questions.json");
  const feed = readJson("content/feed-questions.json");
  const duel = readJson("content/duel-questions.json");
  const learn = readJson("content/learn-questions.json");
  const tests = readJson("content/tests.json");
  const lenses = readJson("content/lenses.json");
  const pulse = readJson("content/pulse-questions.json");

  const banks = [
    { surface: "daily", count: daily.length, source: "content/daily-questions.json" },
    { surface: "feed", count: feed.questions.length, source: "content/feed-questions.json" },
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
    belowFloor: cov.belowFloor ?? 0,
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
    // Derivable today, from the k-floored public mirror the scorecard
    // already reads. These are FLOORS on real activity, not measurements —
    // a question with no answers has no aggregate document and contributes
    // nothing, so every number here understates.
    live: [
      {
        metric: "answers counted, all published questions",
        value: launched ? sc.totalAnswers : null,
        source: "content/scorecard.json ← v2_question_aggs (k-floored)",
        caveat: "unanswered questions have no aggregate document yet",
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

export function collectInstrumentation() {
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
    note: "Alert policies are committed JSON, applied by `npm run monitoring:apply` "
      + "(idempotent, dry-run by default) rather than by any workflow — deliberately, "
      + "since a pipeline that can rewrite a policy can delete one silently. So a "
      + "policy listed here is a policy in the REPO, not necessarily one live in Cloud "
      + "Monitoring: the repo cannot know which, and this column never claims to.",
  };
}

// ── assembly ────────────────────────────────────────────────────

export function collect({ regional = false } = {}) {
  const cost = collectCost(regional);
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
