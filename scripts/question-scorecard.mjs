// Question scorecard — the farm's eyes (QUESTION-FARM.md "The scorecard",
// D33). Reads the k-floored PUBLIC aggregates, scores every daily and feed
// question, and writes content/scorecard.json — the committed artifact the
// scheduled farm runs read to aim lanes 1–2 (replenishment/demand) and to
// learn what worked. This is Phase A of the demand-driven wiring plan.
//
// What "did well" honestly means here — and what it cannot mean:
//
//   - DRAW: the published `total`. For DAILY questions the deck epoch
//     (D30) makes this clean: under the no-wrap invariant each question
//     has served at most once, so totals compare directly (confounded
//     only by DAU drift between days — flagged, not corrected, in v1).
//     FEED questions accumulate for as long as they've been live, so they
//     are ranked only against each other.
//   - SPLIT QUALITY: how far from a landslide. The product's own bar
//     ("splits, not landslides" — a good daily divides people) as a
//     number, per type (scorecard-metrics.mjs; D33 as amended
//     2026-08-06). Categorical types: evenness = 1 − (maxShare − 1/n) /
//     (1 − 1/n). Scale/rating are ordinal, where maxShare mismeasures —
//     a crowd all answering 6–8 spreads over enough slots to look
//     "even" while being a consensus — so they score side balance ×
//     dispersion around the midpoint instead. Either way 1.0 = a real
//     split, 0.0 = unanimity (on an ordinal axis that includes
//     unanimity on the middle), and the number still lands in the same
//     `evenness` field every consumer reads.
//   - OPTION SHAPE: the same public counts, kept as per-option shares
//     (`optionShares` per question; `types`/`optionSlots` rollups). This
//     can only steer NEW questions: a shipped question's options are
//     never edited or reordered, because answers store (qid, optionIdx)
//     forever and a reorder silently re-keys them (the D30 re-key
//     failure class). What it is for: which forms split best, and
//     whether a 3rd/4th option earns its place, before the next
//     question is written.
//   - LEARN (2026-08-05): a separate bar, in a separate section — a card
//     the crowd gets right is not a landslide failure. Measured per
//     card: CALIBRATION (the authored cold-start `p` vs the measured
//     correct rate; `p` is also the difficulty input to "on your level",
//     D32) and TRAP SHARE (the fraction of WRONG votes landing on `t` —
//     a trap below uniform chance among the wrong options maps no
//     misconception; it is decoration). Findings aim the learn lane's
//     PR bodies; editing a shipped card stays a human PR at D32's
//     production-level bar.
//   - DUEL (2026-08-06, D40 part 3): its own section, its own units.
//     Plays are group-days from the reveal-time fold, totals are persons,
//     and for 1v1 the GUESS-MATCH RATE is the duel analogue of evenness —
//     near 100% is a dead question (guessable by heart, no tension), at
//     or under chance (1/options) is noise (no tells); the good zone is
//     the band between. `deadDuels`/`noisyDuels` are the retire-proposal
//     analogues the duel lane cites. Pick questions carry no counts by
//     design (their optionIdx values index each group's own member list),
//     so they score plays and draw only.
//   - PRODUCTION (2026-08-11, D97): the same daily/feed rows re-cut by
//     WHO WROTE them — content/provenance.json's source (editorial |
//     farm | community) and vintage batch. The upscale's improvement
//     loop runs on this: a farm run reads whether its own recent
//     vintages hold the editorial bar before writing more, and cites
//     the trend in its PR body. Same k-floored aggregates, no new read
//     path (the duel section's precedent).
//   - NOT the catalog surface, deliberately (2026-08-05): pick cards are
//     not seeded and no client write path exists yet, so any qid form
//     scored here would be an invented key — the D15 failure class.
//     Score catalogs when the surface goes live and defines its ids.
//   - NOT skip/pass rates: deliberately never collected (server-side
//     telemetry would be a privacy decision, not a tweak — QUESTION-FARM
//     out-of-scope list). NOT per-user anything: only the floored public
//     mirror is read, which by design exposes nothing below AGG_MIN_N.
//
// Modes:
//   --fetch            read the live public aggregates (needs
//                      FIREBASE_API_KEY, optional FIREBASE_PROJECT —
//                      default prvfire33). Signs in a throwaway anonymous
//                      auth user (rules require sign-in to read the
//                      public mirror; no answers are written, so it never
//                      touches aggregates or the D28 ledger).
//   --input <file>     read a JSON dump { qid: {counts,total,tooSmall} }
//                      (operator export, or a test fixture).
//   (no args)          re-print the summary from the committed
//                      content/scorecard.json — the farm's read path.
//
// Node stdlib only (global fetch), like every deploy-adjacent script.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitQualityOf, rollupProduction } from "./scorecard-metrics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "content", "scorecard.json");

const args = process.argv.slice(2);
const FETCH = args.includes("--fetch");
const inputIdx = args.indexOf("--input");
const INPUT = inputIdx >= 0 ? args[inputIdx + 1] : null;

// ── the question banks under evaluation ──
const daily = JSON.parse(readFileSync(join(root, "content", "daily-questions.json"), "utf8"));
const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));
const learn = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
const duel = JSON.parse(readFileSync(join(root, "content", "duel-questions.json"), "utf8"));
// Provenance (D97) — who wrote each daily/feed question, and in which
// vintage. check:quality holds it exactly in step with the banks; the
// existsSync guard is only for a checkout mid-migration, mirroring how
// summarize() optional-chains sections older artifacts predate.
const provPath = join(root, "content", "provenance.json");
const provenance = existsSync(provPath) ? JSON.parse(readFileSync(provPath, "utf8")) : null;

// The deck epoch, cross-read from the client the same way check-pokedex
// reads CATALOG_MAX_ENTITY — a stale copy here would mis-derive "served".
const deckSrc = readFileSync(join(root, "src", "v2", "data", "deck.ts"), "utf8");
const epochM = deckSrc.match(/DECK_EPOCH = (\d+)/);
if (!epochM) {
  console.error("scorecard: DECK_EPOCH not found in src/v2/data/deck.ts");
  process.exit(1);
}
const DECK_EPOCH = Number(epochM[1]);
const todayIdx = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
const daysElapsed = Math.max(0, todayIdx - DECK_EPOCH);

// ── aggregate source ──
function decode(v) {
  if (v.integerValue != null) return Number(v.integerValue);
  if (v.doubleValue != null) return Number(v.doubleValue);
  if (v.booleanValue != null) return v.booleanValue;
  if (v.stringValue != null) return v.stringValue;
  if (v.mapValue) {
    const out = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) out[k] = decode(x);
    return out;
  }
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode);
  return null;
}

async function fetchAggs() {
  const project = process.env.FIREBASE_PROJECT || "prvfire33";
  const key = process.env.FIREBASE_API_KEY;
  if (!key) {
    console.error("scorecard: --fetch needs FIREBASE_API_KEY (the public web API key)");
    process.exit(1);
  }
  const auth = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
  );
  if (!auth.ok) {
    console.error(`scorecard: anonymous sign-in failed (${auth.status}) — is Anonymous auth enabled?`);
    process.exit(1);
  }
  const { idToken } = await auth.json();
  const aggs = {};
  let pageToken = "";
  do {
    const url =
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/v2_question_aggs` +
      `?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${idToken}` } });
    if (!res.ok) {
      console.error(`scorecard: aggregate read failed (${res.status}): ${await res.text()}`);
      process.exit(1);
    }
    const body = await res.json();
    for (const d of body.documents || []) {
      const qid = d.name.split("/").pop();
      aggs[qid] = decode({ mapValue: { fields: d.fields || {} } });
    }
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return aggs;
}

// ── scoring ──
const optionShares = (counts, n) => {
  const vals = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const c = Number(counts[String(i)] || 0);
    vals.push(c);
    total += c;
  }
  if (total <= 0 || n <= 1) return null;
  return vals.map((c) => c / total);
};

const round3 = (v) => +v.toFixed(3);

function score(aggs) {
  const rows = [];
  daily.forEach((q, idx) => {
    const qid = `daily-${q.id}`;
    const n = q.options ? q.options.length : q.type === "rating" ? 10 : 5;
    const agg = aggs[qid];
    const served = idx < daysElapsed;
    const total = agg && agg.tooSmall === false ? Number(agg.total || 0) : 0;
    const sh = agg && agg.tooSmall === false ? optionShares(agg.counts || {}, n) : null;
    rows.push({
      qid,
      surface: "daily",
      topic: q.cat[0],
      type: q.type,
      prompt: q.prompt,
      served,
      total,
      evenness: sh ? splitQualityOf(q.type, sh, n) : null,
      optionShares: sh ? sh.map(round3) : null,
      signal: agg ? (agg.tooSmall === false ? "scored" : "below-floor") : served ? "no-answers" : "unserved",
    });
  });
  feed.questions.forEach((q) => {
    if (q.type === "rank") return; // not live-servable (D12)
    const qid = `feed-${q.id}`;
    const n = q.options ? q.options.length : (q.items || []).length;
    const agg = aggs[qid];
    const total = agg && agg.tooSmall === false ? Number(agg.total || 0) : 0;
    const sh = agg && agg.tooSmall === false ? optionShares(agg.counts || {}, n) : null;
    rows.push({
      qid,
      surface: "feed",
      topic: q.cat,
      type: q.type,
      prompt: q.prompt,
      served: true, // the feed serves continuously
      total,
      evenness: sh ? splitQualityOf(q.type, sh, n) : null,
      optionShares: sh ? sh.map(round3) : null,
      signal: agg ? (agg.tooSmall === false ? "scored" : "below-floor") : "no-answers",
    });
  });

  // Grades are per-surface (daily totals are per-serve-day, feed totals
  // are cumulative — never rank them against each other).
  for (const surface of ["daily", "feed"]) {
    const scored = rows.filter((r) => r.surface === surface && r.signal === "scored");
    const totals = scored.map((r) => r.total).sort((a, b) => a - b);
    const median = totals.length ? totals[Math.floor(totals.length / 2)] : 0;
    for (const r of scored) {
      // A landslide needs volume before it's a verdict on the question
      // rather than on a tiny early sample.
      if (r.evenness !== null && r.evenness < 0.18 && r.total >= 20) r.grade = "landslide";
      else if (r.evenness !== null && r.evenness >= 0.5 && r.total >= median) r.grade = "strong";
      else if (r.total < median * 0.5 && totals.length >= 8) r.grade = "low-draw";
      else r.grade = "middling";
    }
  }

  // Topic rollups — the demand signal lanes 1–2 read.
  const topics = {};
  for (const r of rows) {
    const t = (topics[r.topic] ||= {
      questions: 0, scored: 0, answers: 0, evenSum: 0, strong: 0, landslides: 0,
    });
    t.questions++;
    if (r.signal === "scored") {
      t.scored++;
      t.answers += r.total;
      t.evenSum += r.evenness ?? 0;
      if (r.grade === "strong") t.strong++;
      if (r.grade === "landslide") t.landslides++;
    }
  }
  for (const t of Object.values(topics)) {
    t.avgEvenness = t.scored ? +(t.evenSum / t.scored).toFixed(3) : null;
    delete t.evenSum;
  }

  // Form rollups — which question SHAPES earn their place. Per surface,
  // for the same reason grades are: daily and feed totals never compare.
  const types = { daily: {}, feed: {} };
  for (const r of rows) {
    const t = (types[r.surface][r.type] ||= { questions: 0, scored: 0, answers: 0, evenSum: 0, strong: 0, landslides: 0 });
    t.questions++;
    if (r.signal === "scored") {
      t.scored++;
      t.answers += r.total;
      t.evenSum += r.evenness ?? 0;
      if (r.grade === "strong") t.strong++;
      if (r.grade === "landslide") t.landslides++;
    }
  }
  for (const surf of Object.values(types)) {
    for (const t of Object.values(surf)) {
      t.avgEvenness = t.scored ? +(t.evenSum / t.scored).toFixed(3) : null;
      delete t.evenSum;
    }
  }

  // Slot diagnostics per (surface, type/optionCount). avgMinShare is the
  // honest "does the weakest option earn its place" number — a set whose
  // weakest slot averages ~0 is carrying an option nobody wanted. The
  // positional avgShares are label-stable only for scale/rating (fixed
  // labels); for binary/choice the slot order is authorial, so read them
  // as distribution shape, not as "slot 3 is bad".
  const optionSlots = { daily: {}, feed: {} };
  for (const r of rows) {
    if (!r.optionShares) continue;
    const key = `${r.type}/${r.optionShares.length}`;
    const s = (optionSlots[r.surface][key] ||= {
      questions: 0, minSum: 0, sums: Array(r.optionShares.length).fill(0),
    });
    s.questions++;
    s.minSum += Math.min(...r.optionShares);
    r.optionShares.forEach((v, i) => { s.sums[i] += v; });
  }
  for (const surf of Object.values(optionSlots)) {
    for (const s of Object.values(surf)) {
      s.avgMinShare = round3(s.minSum / s.questions);
      s.avgShares = s.sums.map((v) => round3(v / s.questions));
      delete s.minSum;
      delete s.sums;
    }
  }

  // ── the learn surface: a separate ledger, because the bar differs ──
  // Correct-heavy is fine here; what the lane needs measured is whether
  // the authored numbers were honest. Rows never join the daily/feed
  // grading, leaders, or retire proposals.
  const learnRows = [];
  learn.cards.forEach((card) => {
    const qid = `learn-${card.id}`; // the client's answer key (live.ts)
    const n = card.a.length;
    const agg = aggs[qid];
    const isScored = agg && agg.tooSmall === false;
    const sh = isScored ? optionShares(agg.counts || {}, n) : null;
    const total = isScored ? Number(agg.total || 0) : 0;
    const measuredP = sh ? sh[card.c] : null;
    const wrongShare = sh ? 1 - sh[card.c] : null;
    learnRows.push({
      qid,
      field: card.f,
      n,
      prompt: card.q,
      total,
      authoredP: round3(card.p / 100),
      measuredP: measuredP === null ? null : round3(measuredP),
      gap: measuredP === null ? null : round3(measuredP - card.p / 100),
      // share of the WRONG vote landing on the trap — null until someone
      // is wrong; a fully-correct crowd says nothing about `t`.
      trapShare: wrongShare ? round3(sh[card.t] / wrongShare) : null,
      wrongCount: wrongShare === null ? 0 : Math.round(total * wrongShare),
      signal: agg ? (isScored ? "scored" : "below-floor") : "no-answers",
    });
  });
  const learnFields = {};
  for (const r of learnRows) {
    const f = (learnFields[r.field] ||= { cards: 0, scored: 0, answers: 0, gapSum: 0 });
    f.cards++;
    if (r.signal === "scored") {
      f.scored++;
      f.answers += r.total;
      f.gapSum += Math.abs(r.gap ?? 0);
    }
  }
  for (const f of Object.values(learnFields)) {
    f.avgAbsGap = f.scored ? +(f.gapSum / f.scored).toFixed(3) : null;
    delete f.gapSum;
  }
  const learnScored = learnRows.filter((r) => r.signal === "scored");
  // Volume gates mirror the landslide rule's reasoning: a verdict on an
  // authored number needs volume before it is a verdict on the number
  // rather than on a tiny early sample.
  const miscalibrated = learnScored
    .filter((r) => r.total >= 20 && r.gap !== null)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 10)
    .map(({ qid, prompt, total, authoredP, measuredP, gap }) => ({ qid, prompt, total, authoredP, measuredP, gap }));
  const weakTraps = learnScored
    .filter((r) => r.trapShare !== null && r.wrongCount >= 10 && r.trapShare < 1 / (r.n - 1))
    .map(({ qid, prompt, total, trapShare, wrongCount }) => ({ qid, prompt, total, trapShare, wrongCount }));

  // ── the duel surface: its own ledger, because the units differ ──
  // Aggregates arrive from the reveal-time fold (D40 part 3) as
  // `duel-<qid>` docs: plays are group-days, totals are persons, and for
  // 1v1 the guess-match rate is the duel analogue of evenness — matches
  // near 100% mean no tension (a dead question), matches near chance
  // (1/options) mean no tells (noise); the good zone is the band between.
  // Rows never join the daily/feed grading or leaders: plays are
  // cumulative like feed totals and rank only against each other.
  const duelRows = [];
  const duelRow = (q, mode, docId) => {
    const qid = `duel-${docId}`;
    const n = (q.options || []).length;
    const agg = aggs[qid];
    const isScored = agg && agg.tooSmall === false;
    const sh = isScored && n >= 2 ? optionShares(agg.counts || {}, n) : null;
    const guessTotal = isScored ? Number(agg.guessTotal || 0) : 0;
    duelRows.push({
      qid,
      mode, // group | duo | romantic
      kind: q.kind ?? (mode === "group" ? "classic" : null),
      prompt: q.prompt,
      plays: isScored ? Number(agg.plays || 0) : 0,
      total: isScored ? Number(agg.total || 0) : 0,
      // Duel options are unordered — the categorical bar, or null for
      // pick questions (whose per-option counts are deliberately never
      // aggregated) and below-floor rows.
      evenness: sh ? splitQualityOf("choice", sh, n) : null,
      guessTotal,
      guessMatches: isScored ? Number(agg.guessMatches || 0) : 0,
      guessMatchRate:
        guessTotal > 0 ? round3(Number(agg.guessMatches || 0) / guessTotal) : null,
      chance: n >= 2 ? round3(1 / n) : null,
      signal: agg
        ? (isScored ? "scored" : "below-floor")
        : q.active === false ? "unserved" : "no-answers",
    });
  };
  duel.group.forEach((q) => duelRow(q, "group", `group-${q.id}`));
  duel.oneVsOne.forEach((q) => duelRow(q, "duo", `duo-${q.id}`));
  (duel.romantic ?? []).forEach((q) => duelRow(q, "romantic", `duo-${q.id}`));
  const duelScored = duelRows.filter((r) => r.signal === "scored");
  // Advisory lists, retire-proposal style — cited in a duel lane's PR
  // body, never auto-applied. Volume gates mirror the landslide rule's
  // reasoning: a verdict needs volume before it judges the question.
  const deadDuels = duelScored
    .filter((r) => r.guessTotal >= 20 && r.guessMatchRate >= 0.9)
    .map(({ qid, prompt, guessTotal, guessMatchRate }) => ({ qid, prompt, guessTotal, guessMatchRate }));
  const noisyDuels = duelScored
    .filter((r) => r.guessTotal >= 20 && r.chance !== null && r.guessMatchRate <= r.chance)
    .map(({ qid, prompt, guessTotal, guessMatchRate, chance }) => ({ qid, prompt, guessTotal, guessMatchRate, chance }));
  const duelModes = {};
  for (const r of duelRows) {
    const m = (duelModes[r.mode] ||= { questions: 0, scored: 0, plays: 0, answers: 0 });
    m.questions++;
    if (r.signal === "scored") {
      m.scored++;
      m.plays += r.plays;
      m.answers += r.total;
    }
  }

  const scored = rows.filter((r) => r.signal === "scored");
  const byScore = scored
    .slice()
    .sort((a, b) => (b.evenness ?? 0) * b.total - (a.evenness ?? 0) * a.total);
  return {
    generatedAt: new Date().toISOString(),
    daysSinceEpoch: daysElapsed,
    coverage: {
      questions: rows.length,
      scored: scored.length,
      belowFloor: rows.filter((r) => r.signal === "below-floor").length,
      unserved: rows.filter((r) => r.signal === "unserved").length,
    },
    topics,
    types,
    optionSlots,
    // Leaders/laggards carry their optionShares so a run can imitate (or
    // avoid) the SHAPE of a split, not just its score.
    leaders: byScore.slice(0, 10).map(({ qid, prompt, total, evenness: e, optionShares: o }) => ({ qid, prompt, total, evenness: e, optionShares: o })),
    laggards: byScore.slice(-10).reverse().map(({ qid, prompt, total, evenness: e, grade, optionShares: o }) => ({ qid, prompt, total, evenness: e, grade, optionShares: o })),
    // The farm measuring itself (D97): the same scored rows, re-cut by
    // provenance source and vintage. A run reads this before writing —
    // "is my output holding the editorial bar, which vintage's shapes
    // won" — and cites its own trend in the PR body. Same aggregates,
    // no new read path.
    production: provenance ? rollupProduction(rows, provenance) : null,
    // Landslides are PROPOSALS for the operator's kill switch (active:
    // false), never auto-applied — the farm may cite them in a PR body;
    // only a human flips a question off.
    retireProposals: scored
      .filter((r) => r.grade === "landslide")
      .map(({ qid, prompt, total, evenness: e, optionShares: o }) => ({ qid, prompt, total, evenness: e, optionShares: o })),
    learn: {
      coverage: {
        cards: learnRows.length,
        scored: learnScored.length,
        belowFloor: learnRows.filter((r) => r.signal === "below-floor").length,
      },
      fields: learnFields,
      // Advisory for the learn lane's PR bodies — like retireProposals,
      // never auto-applied: a `p` correction or a trap swap on a shipped
      // card is a human PR at D32's production-level bar.
      miscalibrated,
      weakTraps,
      perCard: learnRows,
    },
    duel: {
      coverage: {
        questions: duelRows.length,
        scored: duelScored.length,
        belowFloor: duelRows.filter((r) => r.signal === "below-floor").length,
        unserved: duelRows.filter((r) => r.signal === "unserved").length,
      },
      modes: duelModes,
      // Advisory for the duel lane's PR bodies (QUESTION-FARM.md), same
      // never-auto-applied rule as retireProposals: dead = guessable by
      // heart (no tension), noisy = at or under chance (no tells).
      deadDuels,
      noisyDuels,
      perQuestion: duelRows,
    },
    perQuestion: rows,
  };
}

function summarize(card) {
  const c = card.coverage;
  console.log(
    `scorecard: ${c.scored}/${c.questions} scored (${c.belowFloor} below floor, ` +
      `${c.unserved} unserved) · generated ${card.generatedAt}`,
  );
  const staleDays = (Date.now() - Date.parse(card.generatedAt)) / 864e5;
  if (staleDays > 14) {
    console.log(`  ⚠ ${Math.floor(staleDays)} days old — treat demand signals as advisory (D33)`);
  }
  for (const [t, v] of Object.entries(card.topics).sort((a, b) => b[1].answers - a[1].answers).slice(0, 8)) {
    console.log(`  ${t}: ${v.scored}/${v.questions} scored · ${v.answers} answers · evenness ${v.avgEvenness ?? "—"}`);
  }
  // Optional-chained: a scorecard committed before the form rollups
  // existed still summarizes cleanly.
  for (const surface of ["daily", "feed"]) {
    const forms = Object.entries(card.types?.[surface] || {}).filter(([, v]) => v.scored);
    if (forms.length) {
      console.log(`  ${surface} forms: ` + forms.map(([k, v]) => `${k} ${v.avgEvenness ?? "—"} (${v.scored})`).join(" · "));
    }
  }
  if (card.leaders.length) console.log(`  top: ${card.leaders.slice(0, 3).map((l) => JSON.stringify(l.prompt)).join(" · ")}`);
  if (card.retireProposals.length) console.log(`  retire proposals: ${card.retireProposals.map((r) => r.qid).join(", ")}`);
  // Optional-chained: a scorecard committed before the production section
  // (D97) existed still summarizes cleanly.
  const sources = Object.entries(card.production?.bySource || {}).filter(([, v]) => v.scored);
  if (sources.length) {
    console.log(
      "  production: " +
        sources.map(([s, v]) => `${s} ${v.avgEvenness ?? "—"} (${v.scored} scored)`).join(" · "),
    );
  }
  // Optional-chained: a scorecard committed before the learn section
  // existed still summarizes cleanly.
  const lc = card.learn?.coverage;
  if (lc) {
    const worst = card.learn.miscalibrated?.[0];
    console.log(
      `  learn: ${lc.scored}/${lc.cards} scored` +
        (worst ? ` · worst calibration ${JSON.stringify(worst.prompt)} (authored ${worst.authoredP}, measured ${worst.measuredP})` : "") +
        (card.learn.weakTraps?.length ? ` · weak traps: ${card.learn.weakTraps.map((t) => t.qid).join(", ")}` : ""),
    );
  }
  // Same optional-chaining rule for the duel section (D40 part 3).
  const dc = card.duel?.coverage;
  if (dc) {
    console.log(
      `  duel: ${dc.scored}/${dc.questions} scored` +
        (dc.unserved ? ` (${dc.unserved} unserved)` : "") +
        (card.duel.deadDuels?.length ? ` · dead: ${card.duel.deadDuels.map((d) => d.qid).join(", ")}` : "") +
        (card.duel.noisyDuels?.length ? ` · noisy: ${card.duel.noisyDuels.map((d) => d.qid).join(", ")}` : ""),
    );
  }
}

if (FETCH || INPUT) {
  const aggs = INPUT ? JSON.parse(readFileSync(resolve(INPUT), "utf8")) : await fetchAggs();
  const card = score(aggs);
  writeFileSync(OUT, JSON.stringify(card, null, 2) + "\n");
  console.log(`scorecard: wrote ${OUT}`);
  summarize(card);
} else {
  let card;
  try {
    card = JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    console.error("scorecard: no committed content/scorecard.json yet — run with --fetch (or --input <dump>)");
    process.exit(1);
  }
  summarize(card);
}
