// question-quality.mjs — the mechanical half of the question style guide
// (D97), and the pre-flight a lane run uses on candidates before a PR.
//
// WHY THIS EXISTS. The upscale (D97) raises how much the lanes may write,
// and every quality bar that was prose — "short, concrete", "tag is a
// two-or-three-word label", the option shapes, hard rule 6's ban on
// place-scoped civic questions — scaled only as far as a reviewer's
// attention. This script turns the checkable half of the style guide into
// a gate, so the human review spends itself on the judgments only a human
// can make (warmth, semantic dupes, "does this split or slide") instead of
// re-counting option arrays. Bounds are MEASURED from the corpus
// (2026-08-11: prompts 14–97 chars, tags 1–4 words, option labels 2–26
// chars), then given headroom — the D63 discipline: place the gate where
// the corpus sits, not where taste says it should.
//
// WHAT IT CANNOT MEASURE, so nobody retires the writing rules: warmth vs
// outrage, semantic near-dupes (check:neighbors owns the lexical half),
// whether a split is likely, and most of hard rule 6 — the place tripwire
// below catches the OBVIOUS form (a watched place name in the same
// question as a civic cue), not a paraphrase ("the fjord city", "our
// capital"). The farm manual's re-read stays the rule; this is its floor.
//
// Modes:
//   (no args)              gate: form rules over daily / feed / duel / pick /
//                          the demo pool's continuum entries (dial/field),
//                          provenance coverage (content/provenance.json ↔
//                          the banks), and the id/bank headroom tripwires.
//                          Exit 1 on any violation.
//   --candidate "prompt"   pre-flight one candidate; prints a review-packet
//     [--surface daily|feed]
//     [--type binary|choice|scale|rating|dilemma|vote|dial|field]
//     [--options "A|B|C"] [--tone light|blend|deep] [--tag "two words"]
//     [--cat "Top / Sub"]  (daily; for feed pass the bare topic id, e.g.
//     --cat sport) [--alts "Top / Sub, Top / Sub"] [--axis slug]
//     dial:  [--lo n] [--hi n] [--unit yrs] [--med n] [--dist "1,3,5,…"]
//            [--ends "low end|high end"] [--n 5000]
//     field: [--ax "left|right"] [--ay "bottom|top"] [--n 5000]
//            (cloud has no flag syntax — pre-flight fields via --batch)
//   --batch <file.json>    pre-flight an array of candidate objects
//                          ({prompt, type, options?, tone?, tag?, cat?,
//                          alts?, axis?, surface?, and the dial/field
//                          fields verbatim}) plus the batch-mix rules a
//                          single candidate cannot express.
//
// Node stdlib only, deterministic, like every gate here.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── measured bounds (see header for the measurement date and figures) ──
export const PROMPT_MAX = 120; // corpus max 97 — "short, concrete, blind-answerable"
export const OPTION_MAX = 32; // corpus max 26 — an option is a label, not a sentence
export const TAG_WORDS_MAX = 4; // corpus max 4 — "a two-or-three-word label", plus one of drift
export const TONES = new Set(["light", "blend", "deep"]);
// Option-count shapes per type, exactly as the corpus uses them. scale and
// rating carry no options (labels are synthesized: LIKERT / "1".."10") and
// MUST carry an axis — the ordinal split metric and the percentile copy
// both key on it (D33 as amended).
export const OPTION_SHAPES = {
  binary: [2, 2],
  choice: [3, 4],
  dilemma: [2, 3],
  scale: [0, 0],
  rating: [0, 0],
};
// The feed's closed type list. Until this set existed a novel feed type
// passed the gate silently (the daily surface had OPTION_SHAPES; the feed
// had nothing) — exactly how a wrong-shaped card would reach review unread.
// vote is the only live-bank candidate; rank/duel are bank legacy (D12);
// dial/field are the continuum forms, demo-pool only until the live
// continuum loop ships (see QUESTION-FARM.md § The feed lane).
export const FEED_TYPES = new Set(["vote", "rank", "duel", "dial", "field"]);
// A dial's crowd texture is exactly 12 buckets lo→hi. Pinned rather than
// free: world-feed.jsx's curve is drawn from it, and 12 fits the live
// fold's optionIdx ceiling (0..19, functions/src/v2.ts) — so a future
// promotion to the live bank can bucket answers 1:1 without a re-author.
export const DIAL_BUCKETS = 12;
// A field's cloud stays a sketch, not a census: enough dots to read as a
// crowd, few enough that the reveal's stagger (one span per dot) stays a
// beat. v20's authored clouds sit at 25–26.
export const CLOUD_DOTS_MIN = 8;
export const CLOUD_DOTS_MAX = 60;

// ── hard rule 6's tripwire ──
// A hand-kept watchlist, deliberately small: country names, demonyms, and
// big cities — NOT the 10,929-place city catalogue, whose names collide
// with ordinary English ("Nice", "Split", "Of") and would make the gate
// dishonest. A hit needs BOTH a watched place and a civic cue in the same
// question's text: "Mountains or sea?" and an Italian-cuisine option are
// personal flavor and pass; "Should Oslo ban cars downtown?" is sold
// inventory (QUESTION-FARM.md hard rule 6) and fails. Judged false
// positives go in ALLOW below with the reason, the neighbors pattern.
const PLACES = new Set((
  "norway sweden denmark finland iceland germany france spain italy " +
  "portugal netherlands belgium austria switzerland poland ukraine russia " +
  "china india japan korea brazil mexico canada america usa uk britain " +
  "england scotland wales ireland australia turkey greece egypt nigeria " +
  "kenya oslo bergen trondheim london paris berlin madrid rome stockholm " +
  "copenhagen helsinki tokyo beijing delhi moscow sydney toronto chicago " +
  "miami amsterdam brussels vienna zurich warsaw athens cairo lagos " +
  "nairobi norwegian swedish danish german french spanish italian british " +
  "english irish chinese indian japanese russian brazilian mexican " +
  "canadian australian turkish greek american european"
).split(" "));
const CIVIC = /\b(ban|bans|banned|tax|taxes|law|laws|government|mayor|council|citizens?|public transport|rent control|immigration|tourism|too expensive|policy|policies|elections?|vote for)\b/i;

// Findings a human has judged fine despite tripping a rule. Key is
// "<id>~<rule>" (rules are the slugs each error carries: place-civic,
// prompt, option-length, type-shape, axis, tone, tag, cat, alts, topic),
// value is the reason — printed on scan, so the exemption stays visible.
// Scoped per finding, the neighbors-ALLOW discipline: waiving one judged
// false positive must not silence every other rule for that question
// forever. Empty today; the corpus passes every bound.
const ALLOW = new Map([]);

// ── headroom tripwires ──
// Each fires while there is still time to take the decision it demands,
// which is the whole point: the failure modes here (an id shape breaking,
// a silently truncated bank fetch) are invisible at the moment they land.
export const DAILY_ID_WARN = 900; // of 999 — check-content pins /^daily-\d{3}$/
export const DAILY_ID_FAIL = 970; // an id-scheme decision is due before 999
export const BANK_WARN = 1200; // of live.ts limit(1500) — D30: pagination, never another raise
export const BANK_FAIL = 1400;

// ── corpus loading (the cross-read pattern promote/neighbors/scorecard use) ──
function extractLiteral(src, marker, at, openChar = "[", closeChar = "]") {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`${at}: marker not found: ${marker}`);
  const open = src.indexOf(openChar, start);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === openChar) depth++;
    else if (src[j] === closeChar) {
      depth--;
      if (depth === 0) {
        const lit = src.slice(open, j + 1);
        return vm.runInNewContext(openChar === "{" ? `(${lit})` : lit);
      }
    }
  }
  throw new Error(`${at}: unbalanced brackets after ${marker}`);
}

export function loadCorpus() {
  const specSrc = readFileSync(join(root, "src", "v2", "spec", "daily-questions.js"), "utf8");
  const specQ = extractLiteral(specSrc, "const Q = [", "daily-questions.js");
  const catMeta = extractLiteral(specSrc, "const CAT_META = {", "daily-questions.js", "{", "}");
  const baseM = specSrc.match(/const DQ_BASE = (\d+)/);
  if (!baseM) throw new Error("daily-questions.js: DQ_BASE not found");
  const dqBase = Number(baseM[1]);
  const dailyIdOf = (i) =>
    i < dqBase
      ? "dq" + String(dqBase - i).padStart(2, "0")
      : "dqx" + String(i - dqBase + 1).padStart(2, "0");

  const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));
  const duel = JSON.parse(readFileSync(join(root, "content", "duel-questions.json"), "utf8"));
  const seed = JSON.parse(readFileSync(join(root, "content", "daily-questions.json"), "utf8"));
  const pick = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "pick-data.js"), "utf8"),
    "window.PICK_QS = [",
    "pick-data.js",
  );
  // The demo pool is prototype filler EXCEPT its continuum entries
  // (dial/field), which are lane-authored production copy — the feed lane
  // lands them here until the live continuum loop ships. The gate walks
  // exactly what the lane writes (the pick-data.js pattern), and only
  // that: dragging the rest of the demo pool through production bounds
  // would fail scene fillers that are not production copy.
  const wfd = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "world-feed-data.js"), "utf8"),
    "window.WORLD_FEED_QS = [",
    "world-feed-data.js",
  );
  return {
    specQ,
    dailyIdOf,
    catMeta,
    seed,
    feed,
    feedTopics: new Set(feed.topics.map((t) => t.id)),
    duel: [...duel.group, ...duel.oneVsOne, ...(duel.romantic ?? [])],
    pick,
    continuum: wfd.filter((q) => q.type === "dial" || q.type === "field"),
  };
}

// ── the rules ──
// ax/ay/ends join the sweep: a field's axis labels and a dial's end labels
// are prose the reader sees, so the place tripwire must see them too.
const textOf = (q) =>
  [
    q.prompt,
    ...(q.options || q.items || []).map((o) => (o && typeof o === "object" ? o.label : o)),
    ...(q.ax || []), ...(q.ay || []), ...(q.ends || []),
  ]
    .filter(Boolean)
    .join(" ");

export function placeCivicHit(q) {
  const text = textOf(q);
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  const hits = words.filter((w) => PLACES.has(w));
  if (!hits.length || !CIVIC.test(text)) return null;
  return { places: [...new Set(hits)], cue: text.match(CIVIC)[0] };
}

// Findings for one question. `surface` decides which rules apply: daily
// carries the full card shape (tone/tag/cat/alts/axis); feed carries topic;
// duel/pick get only the universal rules (prompt bounds, option bounds, the
// place tripwire) — their lane-specific shapes are check:content's job.
// Every error carries a stable `rule` slug: it is the ALLOW key's second
// half, so a waiver names exactly one finding, never the whole question.
export function checkQuestion(q, surface, ctx) {
  const errs = [];
  const warn = [];
  const err = (rule, msg) => errs.push({ rule, msg });

  if (!q.prompt || !String(q.prompt).trim()) err("prompt", "empty prompt");
  else if (q.prompt.length > PROMPT_MAX) {
    err("prompt", `prompt is ${q.prompt.length} chars (max ${PROMPT_MAX}) — short, concrete, blind-answerable`);
  }

  const opts = (q.options || []).map((o) => (o && typeof o === "object" ? o.label : o));
  for (const o of opts) {
    if (String(o).length > OPTION_MAX) {
      err("option-length", `option ${JSON.stringify(String(o))} is ${String(o).length} chars (max ${OPTION_MAX})`);
    }
  }

  const place = placeCivicHit(q);
  if (place) {
    err(
      "place-civic",
      `possible place-scoped civic question (hard rule 6): mentions ${place.places.join(", ")} beside ` +
        `"${place.cue}" — sold inventory, not archive filler. A human may record "<id>~place-civic" in ALLOW if judged personal.`,
    );
  }

  if (surface === "daily") {
    const shape = OPTION_SHAPES[q.type];
    if (!shape) err("type-shape", `unknown daily type ${JSON.stringify(q.type)}`);
    else if (opts.length < shape[0] || opts.length > shape[1]) {
      err("type-shape", `${q.type} carries ${opts.length} options (expected ${shape[0]}${shape[1] !== shape[0] ? `–${shape[1]}` : ""})`);
    }
    if ((q.type === "scale" || q.type === "rating") && !q.axis) {
      err("axis", `${q.type} without an axis — the ordinal split metric and the percentile copy both key on it`);
    }
    if (!TONES.has(q.tone)) err("tone", `tone ${JSON.stringify(q.tone)} is not light/blend/deep`);
    const tagWords = q.tag ? String(q.tag).trim().split(/\s+/).length : 0;
    if (!tagWords || tagWords > TAG_WORDS_MAX) {
      err("tag", `tag ${JSON.stringify(q.tag ?? "")} — a two-or-three-word label (max ${TAG_WORDS_MAX} words)`);
    }
    if (!Array.isArray(q.cat) || q.cat.length !== 2 || !ctx.catMeta[q.cat[0]]) {
      err("cat", `cat must be [Top, Sub] with Top in CAT_META (got ${JSON.stringify(q.cat)})`);
    }
    if (
      !Array.isArray(q.alts) || q.alts.length !== 2 ||
      q.alts.some((a) => !Array.isArray(a) || a.length !== 2 || !ctx.catMeta[a[0]])
    ) {
      err("alts", `alts must be two [Top, Sub] pairs with Tops in CAT_META (got ${JSON.stringify(q.alts)})`);
    }
  }

  if (surface === "feed") {
    if (!FEED_TYPES.has(q.type)) {
      err("type-shape", `unknown feed type ${JSON.stringify(q.type)} — vote|rank|duel|dial|field`);
    }
    if (q.type === "rank") warn.push("rank type — not live-servable (D12); fine in the bank, never a lane candidate");
    if (q.cat && !ctx.feedTopics.has(q.cat)) err("topic", `topic ${JSON.stringify(q.cat)} is not in the feed taxonomy`);

    // ── continuum shapes ── the whole entry is authored, crowd texture
    // included (the demo pool has no backend), so the gate holds the
    // texture to the same bar as the copy: a dial whose dist doesn't fit
    // the curve, or a field whose cloud drifts off the plane, renders
    // wrong in exactly the ways a reviewer stops seeing after ten cards.
    if (q.type === "dial") {
      if (opts.length) err("type-shape", "a dial carries no options — the range is the answer space");
      const num = (v) => typeof v === "number" && Number.isFinite(v);
      if (!num(q.lo) || !num(q.hi) || q.lo >= q.hi) {
        err("range", `dial needs numeric lo < hi (got lo ${JSON.stringify(q.lo)}, hi ${JSON.stringify(q.hi)})`);
      }
      if (!num(q.med) || (num(q.lo) && num(q.hi) && (q.med < q.lo || q.med > q.hi))) {
        err("med", `med ${JSON.stringify(q.med)} must be a number inside [lo, hi] — it is the "most say" line`);
      }
      if (!Array.isArray(q.dist) || q.dist.length !== DIAL_BUCKETS || q.dist.some((w) => !num(w) || w < 0) || !q.dist.some((w) => w > 0)) {
        err("dist", `dist must be ${DIAL_BUCKETS} non-negative buckets lo→hi with at least one > 0 (got ${Array.isArray(q.dist) ? q.dist.length + " buckets" : JSON.stringify(q.dist)})`);
      }
      const endsOk = Array.isArray(q.ends) && q.ends.length === 2 && q.ends.every((e) => typeof e === "string" && e.trim());
      if (q.ends !== undefined && !endsOk) err("ends", `ends must be two non-empty labels (got ${JSON.stringify(q.ends)})`);
      if (!endsOk && (typeof q.unit !== "string" || !q.unit.trim())) {
        err("ends", "a dial needs a unit or two end labels — something has to say what the scale measures");
      }
      for (const e of [...(q.ends || [])]) {
        if (String(e).length > OPTION_MAX) err("option-length", `end label ${JSON.stringify(String(e))} is ${String(e).length} chars (max ${OPTION_MAX})`);
      }
      if (!num(q.n) || q.n <= 0) err("n", `n ${JSON.stringify(q.n)} — the authored answer count the card's footer shows`);
    }
    if (q.type === "field") {
      if (opts.length) err("type-shape", "a field carries no options — the plane is the answer space");
      const num = (v) => typeof v === "number" && Number.isFinite(v);
      for (const [k, axis] of [["ax", q.ax], ["ay", q.ay]]) {
        if (!Array.isArray(axis) || axis.length !== 2 || axis.some((e) => typeof e !== "string" || !e.trim())) {
          err("ends", `${k} must be two non-empty end labels (got ${JSON.stringify(axis)})`);
        } else {
          for (const e of axis) {
            if (e.length > OPTION_MAX) err("option-length", `end label ${JSON.stringify(e)} is ${e.length} chars (max ${OPTION_MAX})`);
          }
        }
      }
      const cluster = (c) =>
        Array.isArray(c) && c.length === 4 && c.every(num) &&
        c[0] >= 0 && c[0] <= 100 && c[1] >= 0 && c[1] <= 100 &&
        c[2] >= 1 && Number.isInteger(c[2]) && c[3] > 0 && c[3] <= 50;
      const dots = Array.isArray(q.cloud) ? q.cloud.reduce((a, c) => a + (Array.isArray(c) ? c[2] || 0 : 0), 0) : 0;
      if (!Array.isArray(q.cloud) || !q.cloud.length || !q.cloud.every(cluster)) {
        err("cloud", `cloud must be [x, y, count, spread] clusters in 0–100 coords, spread ≤ 50 (got ${JSON.stringify(q.cloud)})`);
      } else if (dots < CLOUD_DOTS_MIN || dots > CLOUD_DOTS_MAX) {
        err("cloud", `cloud draws ${dots} dots (want ${CLOUD_DOTS_MIN}–${CLOUD_DOTS_MAX}) — a sketch of a crowd, not a census`);
      }
      if (!num(q.n) || q.n <= 0) err("n", `n ${JSON.stringify(q.n)} — the authored answer count the card's footer shows`);
    }
  }

  return { errs, warn };
}

// Batch-mix rules — what a single candidate cannot express. "A thin topic
// should get a spread, not twelve deep ones" (QUESTION-FARM.md § Writing).
export function checkBatch(batch) {
  const errs = [];
  const daily = batch.filter((q) => (q.surface || "daily") === "daily");
  if (daily.length >= 3) {
    const tones = new Set(daily.map((q) => q.tone).filter(Boolean));
    if (tones.size < 2) {
      errs.push(`a batch of ${daily.length} daily questions carries one tone (${[...tones][0] ?? "none"}) — spread the tones`);
    }
    const types = {};
    for (const q of daily) types[q.type] = (types[q.type] || 0) + 1;
    const [topType, topCount] = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    if (topCount > Math.ceil(daily.length * 0.75)) {
      errs.push(`${topCount} of ${daily.length} daily questions are ${topType} — vary the forms (the scorecard's optionSlots say which earn their place)`);
    }
  }
  return errs;
}

// ── provenance coverage ──
// content/provenance.json is the join the scorecard's production section
// (D97) reads to measure farm vintages against editorial questions. It is
// only worth reading while it is EXACTLY in step with the banks — a missing
// row silently drops a question out of the vintage rollup, which is the
// stale-figure failure class (D39) wearing a JSON hat. promote-questions.mjs
// maintains the daily side; lane PRs maintain the feed side.
export function checkProvenance(corpus) {
  const errs = [];
  const path = join(root, "content", "provenance.json");
  if (!existsSync(path)) return ["content/provenance.json is missing — the D97 vintage join has nothing to read"];
  const prov = JSON.parse(readFileSync(path, "utf8"));
  const SOURCES = new Set(["editorial", "farm", "community"]);

  for (const [surface, bank] of [
    ["daily", corpus.seed.map((q) => q.id)],
    ["feed", corpus.feed.questions.map((q) => q.id)],
  ]) {
    const rows = prov[surface] || {};
    for (const id of bank) {
      if (!rows[id]) errs.push(`provenance: ${surface} ${id} has no row — every bank entry carries its source`);
    }
    for (const id of Object.keys(rows)) {
      if (!bank.includes(id)) errs.push(`provenance: ${surface} ${id} is not in the bank — a row outlived its question?`);
      else if (!SOURCES.has(rows[id].source)) {
        errs.push(`provenance: ${surface} ${id} source ${JSON.stringify(rows[id].source)} — editorial|farm|community`);
      }
    }
  }
  const dailyRows = prov.daily || {};
  for (const [id, row] of Object.entries(dailyRows)) {
    if (row.archiveId && !/^dqx?\d+$/.test(row.archiveId)) {
      errs.push(`provenance: daily ${id} archiveId ${JSON.stringify(row.archiveId)} is not a dq/dqx id`);
    }
  }
  return errs;
}

// ── headroom tripwires ──
export function checkHeadroom(corpus) {
  const errs = [];
  const warn = [];
  const maxDailyId = Math.max(...corpus.seed.map((q) => Number(q.id)));
  if (maxDailyId >= DAILY_ID_FAIL) {
    errs.push(
      `daily ids reach ${maxDailyId} of 999 (check-content pins /^daily-\\d{3}$/) — the id-scheme decision is due NOW, before the shape breaks`,
    );
  } else if (maxDailyId >= DAILY_ID_WARN) {
    warn.push(`daily ids at ${maxDailyId} of 999 — an id-scheme decision is approaching`);
  }

  const v2content = readFileSync(join(root, "functions", "src", "v2content.ts"), "utf8");
  const bankSize = (v2content.match(/"id":\s*"[^"]+"/g) || []).length;
  if (bankSize >= BANK_FAIL) {
    errs.push(
      `seeded bank holds ${bankSize} docs against live.ts limit(1500) — build bank pagination (D30: never another raise) before promoting more`,
    );
  } else if (bankSize >= BANK_WARN) {
    warn.push(`seeded bank at ${bankSize} of the 1500 fetch ceiling — pagination (D30) is approaching`);
  }
  return { errs, warn };
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const corpus = loadCorpus();

  const candidateOf = (raw) => ({
    surface: raw.surface || "daily",
    prompt: raw.prompt,
    type: raw.type || "binary",
    options: raw.options,
    tone: raw.tone,
    tag: raw.tag,
    cat: raw.cat,
    alts: raw.alts,
    axis: raw.axis,
    // continuum fields, verbatim — a --batch pre-flight checks the exact
    // object the lane will land, crowd texture included
    lo: raw.lo, hi: raw.hi, unit: raw.unit, med: raw.med, dist: raw.dist,
    ends: raw.ends, ax: raw.ax, ay: raw.ay, cloud: raw.cloud, n: raw.n,
  });

  const printPacket = (q, i) => {
    const { errs, warn } = checkQuestion(q, q.surface, corpus);
    const head = `${i != null ? `[${i}] ` : ""}${JSON.stringify(q.prompt ?? "")} (${q.surface}/${q.type})`;
    if (!errs.length && !warn.length) console.log(`  ✓ ${head}`);
    else {
      console.log(`  ${errs.length ? "✗" : "•"} ${head}`);
      for (const e of errs) console.log(`      ✗ ${e.msg}`);
      for (const w of warn) console.log(`      • ${w}`);
    }
    return errs.length;
  };

  const candidate = flag("--candidate");
  const batchFile = flag("--batch");

  if (candidate) {
    const pairsOf = (s) =>
      (s || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => p.split("/").map((x) => x.trim()));
    const surface = flag("--surface") || "daily";
    const q = candidateOf({
      surface,
      prompt: candidate,
      type: flag("--type") || "binary",
      options: (flag("--options") || "").split("|").filter(Boolean),
      tone: flag("--tone") || undefined,
      tag: flag("--tag") || undefined,
      // The two surfaces spell `cat` differently: daily carries a
      // [Top, Sub] pair ("Travel / Places"), feed carries a bare topic id
      // ("sport") that the taxonomy rule compares as a string — routing
      // feed through pairsOf made every topic-carrying feed candidate
      // fail its own taxonomy check (found by the D97 review pass).
      cat: flag("--cat")
        ? surface === "feed" ? flag("--cat").trim() : pairsOf(flag("--cat"))[0]
        : undefined,
      alts: flag("--alts") ? pairsOf(flag("--alts")) : undefined,
      axis: flag("--axis") || undefined,
      // dial/field candidates. A field's cloud has no flag syntax worth
      // inventing — pre-flight fields via --batch with the full object.
      lo: flag("--lo") != null ? Number(flag("--lo")) : undefined,
      hi: flag("--hi") != null ? Number(flag("--hi")) : undefined,
      unit: flag("--unit") ?? undefined,
      med: flag("--med") != null ? Number(flag("--med")) : undefined,
      dist: flag("--dist") ? flag("--dist").split(",").map((x) => Number(x.trim())) : undefined,
      ends: flag("--ends") ? flag("--ends").split("|").map((x) => x.trim()) : undefined,
      ax: flag("--ax") ? flag("--ax").split("|").map((x) => x.trim()) : undefined,
      ay: flag("--ay") ? flag("--ay").split("|").map((x) => x.trim()) : undefined,
      n: flag("--n") != null ? Number(flag("--n")) : undefined,
    });
    console.log("quality pre-flight (paste the packet in the PR body):");
    process.exit(printPacket(q) ? 1 : 0);
  }

  if (batchFile) {
    const batch = JSON.parse(readFileSync(resolve(batchFile), "utf8")).map(candidateOf);
    console.log(`quality pre-flight, batch of ${batch.length}:`);
    let failed = 0;
    batch.forEach((q, i) => { failed += printPacket(q, i); });
    for (const e of checkBatch(batch)) {
      failed++;
      console.log(`  ✗ batch: ${e}`);
    }
    process.exit(failed ? 1 : 0);
  }

  // gate mode
  let failed = false;
  const report = (label, id, errs, warn) => {
    for (const e of errs) {
      // Per-finding waivers, and each one prints its recorded reason — an
      // exemption that is both scoped and visible, so an allowed place
      // false-positive cannot quietly absorb a later prompt-length or
      // shape violation on the same question.
      const key = `${id}~${e.rule}`;
      if (ALLOW.has(key)) {
        console.log(`  · allowed ${label} ${key}: ${ALLOW.get(key)}`);
        continue;
      }
      failed = true;
      console.error(`  ✗ ${label} ${id}: ${e.msg}`);
    }
    for (const w of warn) console.log(`  • ${label} ${id}: ${w}`);
  };

  corpus.specQ.forEach((q, i) => {
    const { errs, warn } = checkQuestion(q, "daily", corpus);
    report("daily", corpus.dailyIdOf(i), errs, warn);
  });
  corpus.feed.questions.forEach((q) => {
    const { errs } = checkQuestion(q, "feed", corpus);
    // rank's warn line stays out of gate output: the bank legitimately
    // holds 8 rank questions (D12 keeps them out of the LIVE feed, not the
    // bank), and a warning printed 8 times every CI run is noise.
    report("feed", q.id, errs, []);
  });
  corpus.duel.forEach((q) => {
    const { errs, warn } = checkQuestion(q, "duel", corpus);
    report("duel", q.id, errs, warn);
  });
  corpus.pick.forEach((q) => {
    const { errs, warn } = checkQuestion(q, "pick", corpus);
    report("pick", q.id, errs, warn);
  });
  // lane-authored continuum entries in the demo pool — feed rules apply
  // (they are feed questions; the pool is just where they live until the
  // live continuum loop ships). No provenance rows yet for the same
  // reason: checkProvenance joins the CONTENT banks, and these are not
  // in one — the row arrives with the promotion.
  corpus.continuum.forEach((q) => {
    const { errs } = checkQuestion(q, "feed", corpus);
    report("feed(demo)", q.id, errs, []);
  });

  for (const e of checkProvenance(corpus)) {
    failed = true;
    console.error(`  ✗ ${e}`);
  }
  const head = checkHeadroom(corpus);
  for (const e of head.errs) {
    failed = true;
    console.error(`  ✗ ${e}`);
  }
  for (const w of head.warn) console.log(`  • ${w}`);

  const n = corpus.specQ.length + corpus.feed.questions.length + corpus.duel.length + corpus.pick.length + corpus.continuum.length;
  console.log(`quality: ${n} questions checked${failed ? "" : " · all bounds hold"}`);
  process.exit(failed ? 1 : 0);
}
