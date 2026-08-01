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
//     number: evenness = 1 − (maxShare − 1/n) / (1 − 1/n), 1.0 = even,
//     0.0 = unanimous.
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
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "content", "scorecard.json");

const args = process.argv.slice(2);
const FETCH = args.includes("--fetch");
const inputIdx = args.indexOf("--input");
const INPUT = inputIdx >= 0 ? args[inputIdx + 1] : null;

// ── the question banks under evaluation ──
const daily = JSON.parse(readFileSync(join(root, "content", "daily-questions.json"), "utf8"));
const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));

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
const evenness = (counts, n) => {
  const vals = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const c = Number(counts[String(i)] || 0);
    vals.push(c);
    total += c;
  }
  if (total <= 0 || n <= 1) return null;
  const maxShare = Math.max(...vals) / total;
  return Math.max(0, Math.min(1, 1 - (maxShare - 1 / n) / (1 - 1 / n)));
};

function score(aggs) {
  const rows = [];
  daily.forEach((q, idx) => {
    const qid = `daily-${q.id}`;
    const n = q.options ? q.options.length : q.type === "rating" ? 10 : 5;
    const agg = aggs[qid];
    const served = idx < daysElapsed;
    const total = agg && agg.tooSmall === false ? Number(agg.total || 0) : 0;
    rows.push({
      qid,
      surface: "daily",
      topic: q.cat[0],
      prompt: q.prompt,
      served,
      total,
      evenness: agg && agg.tooSmall === false ? evenness(agg.counts || {}, n) : null,
      signal: agg ? (agg.tooSmall === false ? "scored" : "below-floor") : served ? "no-answers" : "unserved",
    });
  });
  feed.questions.forEach((q) => {
    if (q.type === "rank") return; // not live-servable (D12)
    const qid = `feed-${q.id}`;
    const n = q.options ? q.options.length : (q.items || []).length;
    const agg = aggs[qid];
    const total = agg && agg.tooSmall === false ? Number(agg.total || 0) : 0;
    rows.push({
      qid,
      surface: "feed",
      topic: q.cat,
      prompt: q.prompt,
      served: true, // the feed serves continuously
      total,
      evenness: agg && agg.tooSmall === false ? evenness(agg.counts || {}, n) : null,
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
    leaders: byScore.slice(0, 10).map(({ qid, prompt, total, evenness: e }) => ({ qid, prompt, total, evenness: e })),
    laggards: byScore.slice(-10).reverse().map(({ qid, prompt, total, evenness: e, grade }) => ({ qid, prompt, total, evenness: e, grade })),
    // Landslides are PROPOSALS for the operator's kill switch (active:
    // false), never auto-applied — the farm may cite them in a PR body;
    // only a human flips a question off.
    retireProposals: scored
      .filter((r) => r.grade === "landslide")
      .map(({ qid, prompt, total, evenness: e }) => ({ qid, prompt, total, evenness: e })),
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
  if (card.leaders.length) console.log(`  top: ${card.leaders.slice(0, 3).map((l) => JSON.stringify(l.prompt)).join(" · ")}`);
  if (card.retireProposals.length) console.log(`  retire proposals: ${card.retireProposals.map((r) => r.qid).join(", ")}`);
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
