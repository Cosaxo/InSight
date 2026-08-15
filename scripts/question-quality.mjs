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
// THE LEARN SURFACE (D115, 2026-08-12). Learn was the last lane with no
// pre-flight at all, and the only one where that gap costs the most: dailies
// and feed questions pass two gates (archive PR, then a human promotion PR),
// but a merged learn card reaches production on the next reseed — "one gate
// instead of two means the PR review IS the production review"
// (QUESTION-FARM.md § the learn-card lane). The lane with the highest bar had
// the least mechanical support, so every learn rule was spent on a reviewer's
// attention. check:content already owns the STRUCTURAL half (four options, c/t
// in range, c≠t, p in 1..99, k 2..6 words); everything added here is a rule it
// does not cover, measured against the 96-card bank the way the daily bounds
// were measured against theirs.
//
// Modes:
//   (no args)              gate: form rules over daily / feed / duel / pick /
//                          learn, the demo pool's continuum entries
//                          (dial/field), provenance coverage
//                          (content/provenance.json ↔ the banks), and the
//                          id/bank headroom tripwires. Exit 1 on any
//                          violation.
//   --candidate "prompt"   pre-flight one candidate; prints a review-packet
//     [--surface daily|feed|learn]
//     [--type binary|choice|scale|rating|dilemma|vote|dial|field]
//     [--options "A|B|C"] [--tone light|blend|deep] [--tag "two words"]
//     [--cat "Top / Sub"]  (daily; for feed pass the bare topic id, e.g.
//     --cat sport) [--alts "Top / Sub, Top / Sub"] [--axis slug]
//     dial:  [--lo n] [--hi n] [--unit yrs] [--med n] [--dist "1,3,5,…"]
//            [--ends "low end|high end"] [--n 5000]
//     field: [--ax "left|right"] [--ay "bottom|top"] [--n 5000]
//            (cloud has no flag syntax — pre-flight fields via --batch)
//     learn: [--correct N] [--trap N] [--p NN] [--k "map label"]
//            [--why "one line"] [--field cell]
//   --batch <file.json>    pre-flight an array of candidate objects
//                          ({prompt, type, options?, tone?, tag?, cat?,
//                          alts?, axis?, surface?, and the dial/field
//                          fields verbatim}) plus the batch-mix rules a
//                          single candidate cannot express. Learn entries
//                          may be passed in their NATIVE card shape
//                          ({id, f, q, a, c, t, p, k, w}) — the same JSON
//                          that gets appended to
//                          content/learn-questions.json, so the thing
//                          pre-flighted is the thing shipped.
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
// vote and the continuum forms (dial/field, live since D114) are lane
// candidates; rank/duel are bank legacy (D12).
export const FEED_TYPES = new Set(["vote", "rank", "duel", "dial", "field", "path"]);
/**
 * A Crossroads walk is three binary forks, so its answer space is exactly
 * eight endings — and this is the order they are indexed in, everywhere.
 * It is what the synthesized option labels are generated from
 * (`pathOptions`, gen-v2content.mjs), so it is what a stored `optionIdx`
 * MEANS. Eight sits far under the fold's ceiling (0..19, functions/src/v2.ts).
 *
 * DERIVED, NOT AUTHORED, and that is the point. This constant has to exist
 * identically in two scripts that do not import each other (the same
 * duplication DIAL_BUCKETS lives with), and a hand-written array is a list
 * whose ORDER two copies can disagree about — at which cost: every walk
 * anyone has taken silently becomes a different ending, the exact failure
 * D52's option freeze exists to prevent. Two independent evaluations of
 * this expression cannot disagree; two transcriptions of a literal can.
 */
export const PATH_ENDINGS = ["A", "B"].flatMap((a) => ["A", "B"].flatMap((b) => ["A", "B"].map((c) => a + b + c)));
/**
 * The seven decision points above those endings: the opening, then A/B,
 * then AA…BB.
 *
 * The opening is `"_"` and NOT `""`, which is what it wants to be — a walk
 * is a string of choices and the opening is the empty one, so `nodes[walk]`
 * would index it directly. **Firestore refuses an empty map key**
 * ("Element at index 0 should not be an empty string"), and it refuses it
 * at write time inside the seed callable, which means no client gate could
 * have seen it: `check:quality`, `check:content`, `tsc`, the unit suite and
 * the mount tests were all green on a bank that could not be seeded. The
 * e2e loop caught it, which is the one thing that actually runs the seed.
 *
 * So the opening carries a sentinel and every reader maps `walk || "_"`.
 * One character in the content, one helper at each of the two readers.
 */
export const PATH_NODES = ["_", "A", "B", "AA", "AB", "BA", "BB"];
/** The opening fork's key — see PATH_NODES. `nodes[walk || PATH_ROOT]`. */
export const PATH_ROOT = "_";
/**
 * How long a fork's choice may run. Wider than OPTION_MAX because it is a
 * different kind of string: an option label is a noun the voters panel
 * prints after "picked", while a choice is a line of the story on a
 * full-width button that may wrap once. 40 is the prototype's longest
 * ("Decline — start job-hunting tonight", 35) with room, and still short
 * enough that two of them read as a fork rather than as paragraphs.
 */
export const PATH_CHOICE_MAX = 40;
// A dial's crowd texture is exactly 12 buckets lo→hi. Pinned rather than
// free: world-feed.jsx's curve is drawn from it, 12 fits the live fold's
// optionIdx ceiling (0..19, functions/src/v2.ts), and the live bank's
// synthesized bucket labels (D114) bucket answers 1:1 against it.
export const DIAL_BUCKETS = 12;
// A field's cloud stays a sketch, not a census: enough dots to read as a
// crowd, few enough that the reveal's stagger (one span per dot) stays a
// beat. v20's authored clouds sit at 25–26.
export const CLOUD_DOTS_MIN = 8;
export const CLOUD_DOTS_MAX = 60;

// ── the learn bounds (measured 2026-08-12 over the 96-card bank) ──
// LENGTH_TELL is the one giveaway a permuted option order cannot fix: a
// clause-long correct answer beside three one-word distractors is findable
// without knowing the fact. The corpus maximum is 2.29× — c207's "The Soviet
// Union" against "The USA", which is a name being longer than another name,
// not a tell — so the gate sits at 3.0 rather than hugging the measurement:
// tighter would fail honest content, which is how a gate earns a waiver and
// then gets ignored.
export const LEARN_LENGTH_TELL = 3.0;
// "never an argument, never more than ~20 words" (learn-data.js on `w`).
// Corpus runs 10–20; 24 is the same one-notch headroom TAG_WORDS_MAX gets.
export const LEARN_WHY_WORDS_MAX = 24;
// Per-field difficulty span. The level engine (learn-progress.js) targets a
// card whose p is nearest your level and clamps that level to LMIN..LMAX, so
// a field whose cards all cluster at one p cannot answer "on your level" for
// anybody — plan() still serves them, always as the worst available match.
// Corpus minimum span is 25 (Commonly confused, 46–71); the gate sits at 20.
export const LEARN_FIELD_SPAN_MIN = 20;
// The MCQ filler options this bank has never used and should not start using:
// they test whether the reader has met the form, not the fact. "Either" and
// "Neither" are deliberately NOT here — they are substantive answers on a
// grammar card (con3 offers both), and a rule that fails real content is worse
// than no rule.
const LEARN_FILLER = /^(all|none) of (the|these)\b|^both of\b/i;

// p's legal range is not taste — it is read from the level engine's own clamp
// (learn-progress.js `const LMIN = 24, LMAX = 92`), because a card outside it
// is one no reader is ever AT the level for. Cross-read rather than copied so
// the two cannot drift; a scan that stops matching throws instead of silently
// widening the gate to everything (the check-figures discipline).
function learnLevelBounds() {
  const src = readFileSync(join(root, "src", "v2", "spec", "learn-progress.js"), "utf8");
  const m = src.match(/const LMIN = (\d+),\s*LMAX = (\d+)/);
  if (!m) {
    throw new Error(
      "learn-progress.js no longer declares `const LMIN = N, LMAX = N` — fix this scan. "
      + "A p-range gate reading nothing is worse than no gate.",
    );
  }
  return { LMIN: Number(m[1]), LMAX: Number(m[2]) };
}

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
// Bank headroom. These guarded live.ts's `limit(1500)` until D153 paged
// that fetch, at which point the ceiling they watched stopped existing —
// so they were re-pointed rather than deleted, because the NEXT silent
// ceiling wants the same alarm at a different number.
//
// The next one is the localStorage bank cache. live.ts writes the whole
// bank to `insight.bankCache.v2` inside a try/catch that ignores failure,
// so crossing the browser quota does not break the app: it silently stops
// caching, and every boot then pays a full bank fetch forever. A cost
// cliff with no symptom is exactly this gate's subject.
//
// Arithmetic: the quota is ~5 MB per origin, the bank is one of ~29
// `insight.*` keys, so budget it roughly half. checkHeadroom() derives
// bytes-per-document from the seed itself rather than assuming, and these
// counts are that estimate rounded to something a human can hold:
// 6,000 docs ≈ 1.5 MB, 10,000 ≈ 2.5 MB.
// D154's sampled audit: one AI-reviewed question in this many gets read by
// a person. A starting figure, not a measured one — move it with what the
// audit actually finds.
export const AUDIT_ONE_IN = 20;
export const BANK_WARN = 6000;
export const BANK_FAIL = 10000;

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
  const pulse = JSON.parse(readFileSync(join(root, "content", "pulse-questions.json"), "utf8")).questions;
  const pick = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "pick-data.js"), "utf8"),
    "window.PICK_QS = [",
    "pick-data.js",
  );
  const learn = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
  // The demo pool is prototype filler EXCEPT its continuum entries
  // (dial/field), which are lane-authored production copy — the feed lane
  // lands them here until the live continuum loop ships. The gate walks
  // exactly what the lane writes (the pick-data.js pattern), and only
  // that: dragging the rest of the demo pool through production bounds
  // would fail scene fillers that are not production copy.
  const wfdSrc = readFileSync(join(root, "src", "v2", "spec", "world-feed-data.js"), "utf8");
  const wfd = extractLiteral(wfdSrc, "window.WORLD_FEED_QS = [", "world-feed-data.js");
  // Pick cards file themselves against WORLD_TOPICS, which is a SUPERSET of
  // the feed's own taxonomy: `fav` and `places` are real topic ids that
  // world-feed filters out of the feed's chip row. So a pick card's `cat` is
  // checked against this set and a feed question's against feed.topics —
  // one vocabulary would reject every card that ships today.
  const worldTopics = extractLiteral(wfdSrc, "window.WORLD_TOPICS = [", "world-feed-data.js");
  return {
    specQ,
    dailyIdOf,
    catMeta,
    seed,
    feed,
    feedTopics: new Set(feed.topics.map((t) => t.id)),
    worldTopics: new Set(worldTopics.map((t) => t.id)),
    duel: [...duel.group, ...duel.oneVsOne, ...(duel.romantic ?? [])],
    pick,
    learn,
    pulse,
    learnLevels: learnLevelBounds(),
    continuum: wfd.filter((q) => q.type === "dial" || q.type === "field"),
  };
}

// A learn card wears different field names than every other surface (q/a
// rather than prompt/options). Normalising at the boundary is what lets the
// UNIVERSAL rules — prompt bounds, option-label bounds, the place tripwire —
// apply to learn for free, which is most of the point of adding the surface
// here rather than writing a sixth standalone script.
export function learnView(card) {
  return { ...card, surface: "learn", prompt: card.q ?? card.prompt, options: card.a ?? card.options };
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
// carries the full card shape (tone/tag/cat/alts/axis); feed and pick carry a
// topic; duel gets only the universal rules (prompt bounds, option bounds, the
// place tripwire) — their lane-specific shapes are check:content's job.
// Every error carries a stable `rule` slug: it is the ALLOW key's second
// half, so a waiver names exactly one finding, never the whole question.
//
// `mode.texture` — a continuum question exists in two forms (D114): the
// DEMO-POOL entry carries an authored crowd (med/dist/cloud/n) because the
// demo has no backend, and the CONTENT entry carries none because the live
// crowd is the aggregate. Texture rules apply only where texture belongs;
// a content entry CARRYING texture is its own error, because an authored
// crowd in the live bank would be a fabricated one.
export function checkQuestion(q, surface, ctx, mode = {}) {
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

  // Hard rule 6 is an OPINION-surface rule and does not reach learn, which is
  // a scoping decision rather than an exemption: the rule's own test is
  // "whether the answer split is mainly interesting to the PLACE rather than
  // to the person answering", and a card with a correct answer has no such
  // split to sell — its wrong answers are a misconception map, and nobody is
  // buying "52% know written law started in Mesopotamia" as insight into
  // Mesopotamians. Measured before scoping it out: the tripwire fired on anc3,
  // that exact card, and 14 of 96 cards name a watched place while history and
  // geography are 4 of the 12 fields — so the false positives grow with the
  // bank. A gate that reliably cries wolf on legitimate content is one whose
  // waivers stop being read.
  const place = surface === "learn" ? null : placeCivicHit(q);
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
      err("type-shape", `unknown feed type ${JSON.stringify(q.type)} — vote|rank|duel|dial|field|path`);
    }
    if (q.type === "rank") warn.push("rank type — not live-servable (D12); fine in the bank, never a lane candidate");
    // `cat` is REQUIRED, not merely validated-if-present. Every feed question
    // in the bank carries one, so this held by luck for as long as only humans
    // wrote them; a topic-less card has a broken kicker and never appears in
    // the topic filter, which is a question nobody can find rather than a
    // question that reads oddly. The feed lane runs on a schedule now, so the
    // rule that was true in the data becomes a rule in the gate.
    if (!q.cat) err("topic", "a feed question needs a topic — without one its kicker is broken and the topic filter cannot reach it");
    else if (!ctx.feedTopics.has(q.cat)) err("topic", `topic ${JSON.stringify(q.cat)} is not in the feed taxonomy`);

    // Core/tail must be DECLARED, not defaulted (docs/SCALE-PLAN.md §1).
    //
    // The generated bank treats an absent `core` as tail, which is the safe
    // reading direction — but "safe default" and "nobody decided" are the
    // same bytes, and only one of them is a classification. So the source
    // has to say which, in so many words, and the whole point of the gate
    // is WHEN it says it: at creation, one question at a time, while the
    // author still has the question in their head. Retro-classifying a bank
    // is a per-question judgement call, and the cost of deferring it is
    // paid in one lump at whatever size the bank has reached by then.
    //
    // Feed-only, because feed is the only surface where the distinction is
    // real: the daily is one globally shared question, test items feed
    // Scores, duels never become world aggregates.
    //
    // Live content only. `mode.texture` marks the spec layer's demo pool,
    // which is prototype filler that never reaches the seeded bank and so
    // has nothing to classify — the same carve-out the texture rules make
    // in the other direction just below.
    if (!mode.texture && typeof q.core !== "boolean") {
      err("core", "a feed question must declare `core` (true = served to everyone and foldable into the Mirror's readings, false = personalized tail) — see docs/SCALE-PLAN.md §1");
    }

    // ── continuum shapes ── the whole entry is authored, crowd texture
    // included (the demo pool has no backend), so the gate holds the
    // texture to the same bar as the copy: a dial whose dist doesn't fit
    // the curve, or a field whose cloud drifts off the plane, renders
    // wrong in exactly the ways a reviewer stops seeing after ten cards.
    const texture = !!(mode && mode.texture);
    if ((q.type === "dial" || q.type === "field") && !texture) {
      for (const k of ["med", "dist", "cloud", "n"]) {
        if (q[k] !== undefined) {
          err("texture", `${k} on a content entry — authored crowd texture belongs in the demo pool; the live crowd is the aggregate`);
        }
      }
    }
    if (q.type === "dial") {
      if (opts.length) err("type-shape", "a dial carries no options — the range is the answer space");
      const num = (v) => typeof v === "number" && Number.isFinite(v);
      if (!num(q.lo) || !num(q.hi) || q.lo >= q.hi) {
        err("range", `dial needs numeric lo < hi (got lo ${JSON.stringify(q.lo)}, hi ${JSON.stringify(q.hi)})`);
      }
      if (texture) {
        if (!num(q.med) || (num(q.lo) && num(q.hi) && (q.med < q.lo || q.med > q.hi))) {
          err("med", `med ${JSON.stringify(q.med)} must be a number inside [lo, hi] — it is the "most say" line`);
        }
        if (!Array.isArray(q.dist) || q.dist.length !== DIAL_BUCKETS || q.dist.some((w) => !num(w) || w < 0) || !q.dist.some((w) => w > 0)) {
          err("dist", `dist must be ${DIAL_BUCKETS} non-negative buckets lo→hi with at least one > 0 (got ${Array.isArray(q.dist) ? q.dist.length + " buckets" : JSON.stringify(q.dist)})`);
        }
      }
      const endsOk = Array.isArray(q.ends) && q.ends.length === 2 && q.ends.every((e) => typeof e === "string" && e.trim());
      if (q.ends !== undefined && !endsOk) err("ends", `ends must be two non-empty labels (got ${JSON.stringify(q.ends)})`);
      if (!endsOk && (typeof q.unit !== "string" || !q.unit.trim())) {
        err("ends", "a dial needs a unit or two end labels — something has to say what the scale measures");
      }
      for (const e of [...(q.ends || [])]) {
        if (String(e).length > OPTION_MAX) err("option-length", `end label ${JSON.stringify(String(e))} is ${String(e).length} chars (max ${OPTION_MAX})`);
      }
      if (texture && (!num(q.n) || q.n <= 0)) err("n", `n ${JSON.stringify(q.n)} — the authored answer count the card's footer shows`);
    }
    if (q.type === "field") {
      if (opts.length) err("type-shape", "a field carries no options — the plane is the answer space");
      const num = (v) => typeof v === "number" && Number.isFinite(v);
      for (const [k, axis] of [["ax", q.ax], ["ay", q.ay]]) {
        if (!Array.isArray(axis) || axis.length !== 2 || axis.some((e) => typeof e !== "string" || !e.trim())) {
          err("ends", `${k} must be two non-empty end labels (got ${JSON.stringify(axis)})`);
        } else {
          for (const e of axis) {
            // 14, not OPTION_MAX: these ends compose into the synthesized
            // cell labels ("lean tastes good · middle"), and the composed
            // label is what the voters panel prints
            if (e.length > 14) err("option-length", `end label ${JSON.stringify(e)} is ${e.length} chars (max 14 — it composes into cell labels)`);
          }
        }
      }
      if (texture) {
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
    // ── Crossroads (D136) ── a story, not a question: seven decision
    // points, three forks deep, eight named endings. The gate holds the
    // TREE's shape rather than its prose, because the shape is what the
    // stored answer means — an eighth ending going missing would silently
    // renumber the other seven (see PATH_ENDINGS).
    if (q.type === "path") {
      if (opts.length) err("type-shape", "a path carries no options — its endings are the answer space, and their labels are synthesized");
      if (typeof q.title !== "string" || !q.title.trim()) err("title", "a path needs a title — it is what the card and the voters panel name");
      if (typeof q.intro !== "string" || !q.intro.trim()) err("intro", "a path needs an intro — the scene before the first fork");
      const nodes = q.nodes && typeof q.nodes === "object" ? q.nodes : null;
      if (!nodes) {
        err("nodes", `nodes must be an object keyed by "" | A | B | AA…BB (got ${JSON.stringify(q.nodes)})`);
      } else {
        const keys = Object.keys(nodes).sort();
        if (keys.join(",") !== [...PATH_NODES].sort().join(",")) {
          err("nodes", `nodes must be exactly ${PATH_NODES.map((k) => JSON.stringify(k)).join(", ")} (got ${JSON.stringify(keys)})`);
        }
        for (const k of PATH_NODES) {
          const n = nodes[k];
          if (!n || typeof n.q !== "string" || !n.q.trim()) { err("nodes", `node ${JSON.stringify(k)} needs a q`); continue; }
          if (!Array.isArray(n.a) || n.a.length !== 2) { err("nodes", `node ${JSON.stringify(k)} needs exactly two choices`); continue; }
          for (const c of n.a) {
            if (!c || typeof c.t !== "string" || !c.t.trim()) err("nodes", `node ${JSON.stringify(k)} has a choice with no text`);
            // NOT OPTION_MAX, deliberately. OPTION_MAX bounds a label that
            // ends up in the voters panel ("picked …"); a fork's choice
            // never does — the ENDING name is this question's option label,
            // and that is held to OPTION_MAX below. What bounds a choice is
            // the button it sits on, which is full-width and may wrap once.
            else if (c.t.length > PATH_CHOICE_MAX) err("option-length", `choice ${JSON.stringify(c.t)} is ${c.t.length} chars (max ${PATH_CHOICE_MAX})`);
            // `p` is the DEMO's authored branch share. It is legal only in
            // the demo pool, for the same reason med/dist/cloud are: live,
            // the crowd is the aggregate (D136).
            if (c.p !== undefined && !texture) {
              err("texture", "p on a content entry — an authored branch share belongs in the demo pool; the live crowd is the aggregate");
            }
            if (texture && (typeof c.p !== "number" || !(c.p > 0) || !(c.p < 100))) {
              err("texture", `choice ${JSON.stringify(c.t)} needs an authored share p in 1..99 (got ${JSON.stringify(c.p)})`);
            }
          }
          if (texture && n.a.every((c) => typeof c.p === "number") && n.a[0].p + n.a[1].p !== 100) {
            err("texture", `node ${JSON.stringify(k)}'s two shares must total 100 (got ${n.a[0].p} + ${n.a[1].p})`);
          }
        }
      }
      const ends = q.endings && typeof q.endings === "object" ? q.endings : null;
      if (!ends) {
        err("endings", `endings must be an object keyed by the eight walks (got ${JSON.stringify(q.endings)})`);
      } else {
        const keys = Object.keys(ends).sort();
        if (keys.join(",") !== [...PATH_ENDINGS].sort().join(",")) {
          err("endings", `endings must be exactly the eight walks ${PATH_ENDINGS.join(", ")} (got ${JSON.stringify(keys)})`);
        }
        for (const k of PATH_ENDINGS) {
          const e = ends[k];
          if (!e || typeof e.name !== "string" || !e.name.trim()) { err("endings", `ending ${k} needs a name`); continue; }
          // The name IS the synthesized option label, so it is bound by the
          // same ceiling every other option label is — the voters panel
          // prints it as "picked <name>".
          if (e.name.length > OPTION_MAX) err("option-length", `ending name ${JSON.stringify(e.name)} is ${e.name.length} chars (max ${OPTION_MAX})`);
          if (typeof e.line !== "string" || !e.line.trim()) err("endings", `ending ${k} needs a line — the sentence the walk earns`);
        }
        const names = PATH_ENDINGS.map((k) => ends[k] && ends[k].name).filter(Boolean);
        if (new Set(names).size !== names.length) {
          err("endings", "two endings share a name — the labels are the answer space and must be distinguishable");
        }
      }
    }
  }

  // Learn's own rules. Everything check:content already validates (four
  // options, c/t in range, c≠t, p in 1..99, k 2..6 words) is deliberately
  // absent — two gates disagreeing about the same rule is how one of them
  // gets edited to match the other and both stop meaning anything.
  if (surface === "feed" && q.until !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(q.until))) {
    err("type-shape", "`until` (the current-events window) must be a YYYY-MM-DD UTC day key");
  }

  if (surface === "pick") {
    // The catalog contract's rule 3 — "Every card carries a `cat`, always" —
    // had no gate behind it: pick got the universal rules only, and all
    // thirteen shipped cards happen to carry `cat: 'fav'`. A card without one
    // has a broken kicker and no place in the topic filter, which is the
    // catalog lane's own wording for why the rule exists. The vocabulary is
    // WORLD_TOPICS rather than the feed's taxonomy: `fav` is a real topic id
    // the feed's chip row filters out, and it is the one every card uses.
    if (!q.cat) err("topic", "a pick card needs a cat (catalog contract rule 3) — without one its kicker is broken and the topic filter cannot reach it");
    else if (!ctx.worldTopics.has(q.cat)) err("topic", `cat ${JSON.stringify(q.cat)} is not a WORLD_TOPICS id`);
  }

  if (surface === "pulse") {
    // The trends y-axis is the 1..5 step scale (D139): exactly five
    // ordered steps, no more forms. The universal rules above already
    // hold the prompt/option bounds and the place tripwire.
    if (q.type !== "pulse") err("type-shape", `pulse questions carry type "pulse", not ${JSON.stringify(q.type)}`);
    if ((q.options || []).length !== 5) err("type-shape", "a pulse question carries exactly five steps");
  }

  if (surface === "learn") {
    const seen = new Map();
    for (const o of opts) {
      const fold = String(o).toLowerCase().trim().replace(/\s+/g, " ");
      if (seen.has(fold)) {
        err("learn-dupe-option", `options ${seen.get(fold)} and ${JSON.stringify(String(o))} are the same answer — a card offers four`);
      }
      seen.set(fold, JSON.stringify(String(o)));
      if (LEARN_FILLER.test(String(o).trim())) {
        err("learn-filler", `option ${JSON.stringify(String(o))} tests whether the reader has met the FORM, not the fact`);
      }
    }

    const c = q.c;
    if (typeof c === "number" && opts[c] != null && opts.length > 1) {
      const others = opts.filter((_, i) => i !== c).map((o) => String(o).length);
      const ratio = String(opts[c]).length / Math.max(...others, 1);
      if (ratio > LEARN_LENGTH_TELL) {
        err(
          "learn-length-tell",
          `the correct option is ${ratio.toFixed(1)}× the longest distractor (max ${LEARN_LENGTH_TELL}) — ` +
            "findable without the fact. Lengthen the distractors rather than trimming the answer.",
        );
      }
    }

    const { LMIN, LMAX } = ctx.learnLevels;
    if (typeof q.p === "number" && (q.p < LMIN || q.p > LMAX)) {
      err(
        "learn-p-range",
        `p ${q.p} is outside the level engine's ${LMIN}..${LMAX} clamp — no reader is ever AT this card's level, ` +
          "so it can only ever be served as the worst available match",
      );
    }

    if (q.w) {
      const words = String(q.w).trim().split(/\s+/).filter(Boolean).length;
      if (words > LEARN_WHY_WORDS_MAX) {
        err("learn-why", `w is ${words} words (max ${LEARN_WHY_WORDS_MAX}) — one line of why, never an argument`);
      }
    }

    const k = String(q.k ?? "").trim();
    if (k) {
      if (/\?$/.test(k) || /^(what|which|who|when|where|why|how)\b/i.test(k)) {
        err("learn-label", `k ${JSON.stringify(k)} is a question — the map label is the FACT, and it has to be true standing alone`);
      }
      if (k.toLowerCase() === String(q.prompt ?? "").trim().toLowerCase()) {
        err("learn-label", "k restates the prompt — the map would file this card under the question it asks");
      }
    }
  }

  return { errs, warn };
}

// Per-FIELD rules — what no single card can express. A field is the unit the
// scheduler serves from (LEARN.plan filters to the fields you follow), so
// difficulty coverage is a property of the field, not of any card in it.
export function checkLearnFields(corpus) {
  const errs = [];
  const byField = new Map();
  for (const card of corpus.learn.cards) {
    if (!byField.has(card.f)) byField.set(card.f, []);
    byField.get(card.f).push(card.p);
  }
  for (const [field, ps] of byField) {
    const span = Math.max(...ps) - Math.min(...ps);
    if (span < LEARN_FIELD_SPAN_MIN) {
      errs.push(
        `learn field ${field}: p spans ${span} points (${Math.min(...ps)}–${Math.max(...ps)}, min ${LEARN_FIELD_SPAN_MIN}) — ` +
          `${ps.length} cards at one difficulty cannot answer "on your level" for anybody`,
      );
    }
  }
  return errs;
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

  // Learn's batch rule is difficulty, for the same reason the field rule is:
  // a run that writes eight cards at p≈60 has widened a field's card count
  // without widening what it can serve. The batch is the unit a run controls,
  // so this is where the instruction lands while there is still time to obey
  // it — the field gate below only says so once the cards are committed.
  const learn = batch.filter((q) => q.surface === "learn");
  const ps = learn.map((q) => q.p).filter((p) => typeof p === "number");
  if (learn.length >= 3 && ps.length) {
    const span = Math.max(...ps) - Math.min(...ps);
    if (span < LEARN_FIELD_SPAN_MIN) {
      errs.push(
        `${learn.length} learn cards spanning ${span} points of difficulty (${Math.min(...ps)}–${Math.max(...ps)}, ` +
          `min ${LEARN_FIELD_SPAN_MIN}) — write across the level range, not at the middle of it`,
      );
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

  // ── review (D154) ──
  //
  // D154 replaced per-item human review with AI review plus a sampled
  // human audit. The failure that invites is obvious and quiet: "the AI
  // reviewed it" is a claim nobody can check after the fact, and a lane
  // under time pressure can simply stop doing it with no artifact missing.
  // So the verdict rides the provenance row a question already needs to
  // enter the bank, and this gate is what makes "reviewed" a FACT.
  //
  // Editorial rows are exempt because editorial IS the human — the
  // two-gate design's whole point. Only content this repo did not
  // hand-write has to prove it was read.
  const aiReviewed = [];
  for (const surface of ["daily", "feed"]) {
    for (const [id, row] of Object.entries(prov[surface] || {})) {
      if (row.source !== "farm" && row.source !== "community") continue;
      const r = row.review;
      if (!r || typeof r !== "object") {
        errs.push(`provenance: ${surface} ${id} is ${row.source} with no \`review\` — D154: nothing enters the bank unread`);
        continue;
      }
      if (r.by !== "ai" && r.by !== "human") {
        errs.push(`provenance: ${surface} ${id} review.by ${JSON.stringify(r.by)} — ai|human`);
      }
      // An AI review must state the audit decision rather than omit it.
      // Absent and false are the same bytes to a reader, and only one of
      // them is a decision — the same argument the `core` flag makes.
      if (r.by === "ai") {
        if (typeof r.audited !== "boolean") {
          errs.push(`provenance: ${surface} ${id} is ai-reviewed without an explicit \`audited\` boolean — say whether it was in the human sample`);
        } else aiReviewed.push({ surface, id, audited: r.audited });
      }
    }
  }
  // The audit RATE, across every AI-reviewed question rather than per
  // batch: at D154's 1-in-20 a weekly batch of seven rounds to zero, so a
  // per-batch gate would pass while nothing was ever audited. Cumulative
  // is the only shape that binds at both sizes.
  if (aiReviewed.length) {
    const want = Math.ceil(aiReviewed.length / AUDIT_ONE_IN);
    const got = aiReviewed.filter((r) => r.audited).length;
    if (got < want) {
      errs.push(
        `provenance: ${got} of ${aiReviewed.length} ai-reviewed questions carry an audit, want ≥ ${want} `
        + `(D154's 1-in-${AUDIT_ONE_IN}) — the sample is the only check on a reviewer that shares the generator's blind spots`,
      );
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
  // Measured, not assumed: the same wire-size scan check-figures runs, so
  // the estimate moves when the documents do (adding `core` to 82 entries
  // moved it by ~1 KiB and check:figures caught that on COSTS.md).
  const bankBytes = (() => {
    const head = "V2_QUESTIONS: V2SeedQuestion[] = ";
    const body = v2content.slice(v2content.indexOf(head) + head.length);
    try {
      return JSON.stringify(JSON.parse(body.slice(0, body.lastIndexOf("];") + 1))).length;
    } catch {
      return bankSize * 250; // the scan's shape changed; fall back rather than crash the gate
    }
  })();
  const cacheMB = (n) => ((bankBytes / Math.max(bankSize, 1)) * n / 1024 / 1024).toFixed(1);
  if (bankSize >= BANK_FAIL) {
    errs.push(
      `seeded bank holds ${bankSize} docs ≈ ${cacheMB(bankSize)} MB of localStorage cache — over budget. `
      + "live.ts caches the whole bank in `insight.bankCache.v2` and SWALLOWS a quota failure, so crossing this "
      + "does not break anything: it silently stops caching and every boot pays a full bank fetch forever. "
      + "Move the cache off localStorage (IndexedDB) before promoting more.",
    );
  } else if (bankSize >= BANK_WARN) {
    warn.push(
      `seeded bank at ${bankSize} docs ≈ ${cacheMB(bankSize)} MB of localStorage cache — the quota is the next `
      + "silent ceiling (a failed write is caught and ignored), so plan the move to IndexedDB",
    );
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

  const candidateOf = (raw) => {
    // A learn card arrives in its native shape (q/a/c/t/p/k/w/f) so a run can
    // pre-flight the exact JSON it is about to append. `f` is the tell: no
    // other surface carries it, and requiring --surface learn on a batch of
    // cards that already say what they are would just be a step to forget.
    if (raw.surface === "learn" || (raw.f && raw.a && raw.q)) {
      return { ...learnView(raw), type: raw.type || "know" };
    }
    return {
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
    };
  };

  const printPacket = (q, i) => {
    // Candidates pre-flight as the demo-pool form — texture included —
    // because that is the half the lane authors first; the content entry
    // is the same copy with the texture stripped.
    const { errs, warn } = checkQuestion(q, q.surface, corpus, { texture: true });
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
    const num = (name) => (flag(name) == null ? undefined : Number(flag(name)));
    const q = candidateOf({
      surface,
      prompt: candidate,
      // learn's own fields, ignored by every other surface's rules
      ...(surface === "learn"
        ? {
            q: candidate,
            a: (flag("--options") || "").split("|").filter(Boolean),
            f: flag("--field") || undefined,
            c: num("--correct") ?? 0,
            t: num("--trap"),
            p: num("--p"),
            k: flag("--k") || undefined,
            w: flag("--why") || undefined,
          }
        : {}),
      // A learn card's type is not a choice the writer makes — every card is
      // the same four-option know card — so the daily default must not leak
      // onto it and print "learn/binary" in a packet a reviewer reads.
      type: flag("--type") || (surface === "learn" ? "know" : "binary"),
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
  corpus.learn.cards.forEach((card) => {
    const { errs, warn } = checkQuestion(learnView(card), "learn", corpus);
    report("learn", card.id, errs, warn);
  });
  corpus.pulse.forEach((q) => {
    const { errs, warn } = checkQuestion(q, "pulse", corpus);
    report("pulse", q.id, errs, warn);
  });
  for (const e of checkLearnFields(corpus)) {
    failed = true;
    console.error(`  ✗ ${e}`);
  }
  // the demo pool's continuum entries — feed rules plus the texture rules:
  // this is the half that carries the authored crowd (D114), mirroring the
  // texture-less content entries the feed walk above already covered.
  corpus.continuum.forEach((q) => {
    const { errs } = checkQuestion(q, "feed", corpus, { texture: true });
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

  const n = corpus.specQ.length + corpus.feed.questions.length + corpus.duel.length
    + corpus.pick.length + corpus.continuum.length + corpus.learn.cards.length;
  console.log(`quality: ${n} questions checked${failed ? "" : " · all bounds hold"}`);
  process.exit(failed ? 1 : 0);
}
