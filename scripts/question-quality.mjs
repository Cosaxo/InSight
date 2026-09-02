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
import { bankArray } from "./v2content-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── measured bounds (see header for the measurement date and figures) ──
export const PROMPT_MAX = 120; // corpus max 97 — "short, concrete, blind-answerable"
export const OPTION_MAX = 32; // corpus max 26 — an option is a label, not a sentence
export const TAG_WORDS_MAX = 4; // corpus max 4 — "a two-or-three-word label", plus one of drift
// Doors per question (docs/TAGS-PLAN.md §1). A ceiling, not a target: `also`
// is for genuine straddlers, and a question that needs three doors is usually
// a vague question — the same nose PROMPT_MAX encodes. The demand arithmetic
// makes broad tagging pointless (credit is conserved, a door never adds any);
// this cap is what makes it impossible to try at scale anyway.
export const ALSO_MAX = 2;
// Background text (D281) — what the card's `i` opens. The bounds are the
// demo pool's own, measured: `WORLD_BG` in world-subtopics.js holds 24
// entries running 152–236 characters over one to three sentences, written
// by a person against the brief this field inherits ("facts and
// definitions only, never the arguments" — world-feed.jsx's own comment on
// the sheet it draws).
//
// The FLOOR is the load-bearing half and the one nobody expects. A ceiling
// stops a card growing an essay; a floor stops the other failure, which is
// worse because it looks like the feature working: a background that says
// "Evergrande is a Chinese property developer" promotes the button to its
// stronger ring, opens a sheet, and leaves the reader exactly as unable to
// answer as before. If a question is worth a background at all it is worth
// the facts that make it answerable, and 90 characters is under the
// shortest thing in the corpus that ever did.
export const BG_MIN = 90;
export const BG_MAX = 320; // corpus max 236, plus room for a third clause
// The unambiguous half of "never the arguments". Every one of these is a
// sentence taking a side or telling the reader what to think, and none of
// them appears anywhere in the 24 backgrounds the demo pool already ships
// — which is the test that the list refuses a register rather than a
// vocabulary. Deliberately short: a longer list would start catching
// ordinary reporting ("critics said", "the ruling was upheld"), and the
// half a regex cannot see belongs to the reviewing run either way.
const BG_ARGUES = /\b(should(n't| not)?\b|obviously|clearly the|the (right|only) answer|it is (wrong|right) to|most (people|experts|economists) (agree|think)|there is no (real )?(case|argument) for)\b/i;
// ── the current-events lane (D231, docs/NEXT-FUNCTIONALITY.md §1) ──
//
// `now` is the one topic whose questions expire. §1 asks for "a bounded
// window so 'current' cannot mean months", and these are that bound, in
// days SERVED (inclusive of both ends — a question opened and closed on
// the same day serves for 1).
//
// MIN exists because a window shorter than a weekend is not a question,
// it is a poll of whoever happened to open the app on a Tuesday; the
// feed's own quality signal is per-question evenness, and a split
// measured on a handful of answers is noise (feed-budget.mjs's dilution
// bound, said about time instead of stock).
//
// MAX is §1's sentence made arithmetic. Three weeks is the outer edge of
// what a reader would still call current; past it the topic is lying in
// its own name.
//
// SHORT is the owner's direction (2026-08-23): every question gets the
// window that fits it, but most should sit at the low end. A batch rule
// rather than a per-question one, because "most" is a property of a
// batch — a single 20-day question is a judgement call, six of them is a
// lane that has quietly become a monthly.
export const NOW_TOPIC = "now";
export const WINDOW_MIN_DAYS = 3;
export const WINDOW_MAX_DAYS = 21;
export const WINDOW_SHORT_DAYS = 7;

/** Days served, both ends inclusive. Null unless both ends are real day keys. */
export function windowDays(from, until) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(until))) return null;
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${until}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000) + 1;
}

// A prediction is a CALL, not a feed question (§1's first boundary, D127).
// "Should X resign?" is an opinion and belongs here; "Will X win on
// Sunday?" needs a sealed answer and a resolved outcome, and must arrive
// through docs/FORESIGHT-CALLS.md's door or not at all — an unresolved
// call takes the player's guess and never comes back.
//
// A TRIPWIRE, not a proof: the two shapes it catches are the prompt that
// OPENS as a future interrogative, and the one that pins a claim to a
// resolution date. "AI will replace most jobs — agree?" is an opinion
// about the future that no rubric can settle, and it passes both, which
// is correct. Judged false positives go in ALLOW under `call-shape`.
const CALL_OPENER = /^\s*(will|won't|who will|what will|when will|how many\b[^?]*\bwill|which\b[^?]*\bwill)\b/i;
const CALL_DATED = /\bwill\b[^?]*\b(by (the end of|next|this)?\s*\w|before (the|next|this)\b|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|this (week|month)\b|next (week|month)\b)/i;
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
// The Mirror stops whose scorecard a daily question may declare itself
// part of (D187's `rates`), and the types that scorecard can average. Both
// halves are gated because both failures are SILENT: a typo'd scope puts a
// question on no stop's card, and a `rates` question written as a `choice`
// is dropped by the lens's own type filter. Either way the row simply is
// not there, which looks exactly like a question nobody has written yet —
// the class of failure D187 exists to close, reappearing one layer down.
export const RATES_SCOPES = new Set(["city", "country", "world"]);
const RATES_TYPES = new Set(["rating", "scale"]);
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
/**
 * What a fork TURNS — the thing the two choices trade against each other.
 * Every node declares one, and no walk may turn the same axis twice.
 *
 * WHY A GATE AND NOT A SENTENCE IN THE MANUAL. A tree whose three forks all
 * turn one axis does not have eight endings; it has one gradient sampled at
 * eight points, and the reveal — "1 in 12 walks your road" — then ranks the
 * reader along that gradient instead of placing them. Both stories D136
 * shipped do exactly this (see PATH_AXIS_LEGACY), which is the measurement
 * that produced this rule: the manual said nothing about axes, so the lane
 * wrote the same story twice and every gate was green.
 *
 * The vocabulary is CLOSED, for the reason `cat` is: an open one is a free
 * text field, and three free text fields can be three spellings of one axis
 * ("money", "cash", "greed") that this rule would then read as a spread.
 * Widen it in a PR that says which story needed the new axis and why an
 * existing one could not carry it — the same contract § When no category
 * fits puts on a new topic.
 *
 * AUTHORING-TIME ONLY. `axis` never reaches a device: gen-v2content.mjs
 * REBUILDS each node (`{ q, a: [{ t }] }`) rather than spreading it, which
 * is the same whitelist that already drops the demo pool's authored `p`
 * shares. So this annotation costs no wire bytes, no seeded field, no
 * `SEEDED_FIELDS` comparison and no reseed of the two live docs — verified
 * by check:content, which regenerates v2content.ts and diffs it.
 */
export const PATH_AXES = new Set([
  "risk",       // safety / exposure
  "time",       // now / later
  "company",    // alone / with someone
  "disclosure", // say it / keep it
  "ownership",  // keep it / give it up
  "certainty",  // find out / stay not-knowing
  "effort",     // push / coast
  "loyalty",    // to a person / to a principle
]);
/**
 * The two stories that cannot obey the axis rule, and why it is a permanent
 * exemption rather than a to-do.
 *
 * A path's OPTIONS are its eight ending names (pathOptions, gen-v2content),
 * so renaming one is an option edit — frozen by D52 and refused by the seed,
 * because the stored optionIdx would silently mean a different ending. And
 * both trees encode their single axis IN those names: pt1's A-branch endings
 * are "The Honest Trade" / "Finders, Keepers" / "The Long Way Round", which
 * only make sense if forks 2 and 3 both turn `ownership`. Re-axing the forks
 * without renaming the endings would leave a walk whose choices no longer
 * lead to the name it lands on. So the fork prose cannot be fixed and the
 * names cannot be changed: the honest options are to exempt them or to
 * retire them (`active: false`, the operator's call, D52).
 *
 * They still count as PREDECESSORS for the genre ratchet — which is what
 * makes the next path have to leave `dilemma` — and they still carry their
 * axis annotations, so the defect is visible in the data rather than
 * implied by its absence. The waiver is on the SPREAD rule alone
 * (`axis-spread`), never on `axis`: a scoped exemption, the ALLOW
 * discipline, so this cannot quietly become permission to skip the field.
 */
export const PATH_AXIS_LEGACY = new Map([
  // Measured after annotating both trees, not estimated: pt1 is flat on 6
  // of its 8 walks (certainty → ownership → ownership, four ways, plus
  // certainty → effort → effort twice) and pt2 on 8 of 8 (disclosure and
  // loyalty in every arrangement of three). pt2 has no varied walk at all,
  // which is the sharpest version of the finding: a reader who walks it
  // twice down different roads is answering the same question twice.
  ["pt1", "D136's first story — 6 of 8 walks flat, and its ending names are frozen by D52"],
  ["pt2", "D136's second story — 8 of 8 walks flat, same freeze"],
]);
/**
 * How far back the genre ratchet looks. A new path's topic must differ from
 * the `cat` of each of the PATH_GENRE_LOOKBACK paths before it — two, which
 * is the smallest window that forces a third topic rather than an A-B-A-B
 * alternation, and small enough to stay satisfiable: the taxonomy carries
 * ten topics and this rule only ever rules out two of them.
 *
 * The corpus it is measured against is Crossroads' own sequence, not the
 * feed's — one path every few weeks is a different cadence from eight votes
 * a run, and a topic that repeats across two ADJACENT stories is the one a
 * reader actually experiences as "this is the dilemma card again".
 */
export const PATH_GENRE_LOOKBACK = 2;
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
// big cities — NOT the ~11k-place city catalogue, whose names collide
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
// Install headroom (D349 amendment, 2026-09-01). These guarded live.ts's
// `limit(1500)` until D161 paged that fetch, then the localStorage quota
// (gone at D312), then "every cached row read into memory each boot" —
// counted as the SEEDED bank, which after D320/D321 is the wrong quantity:
// the bank is not what a device holds. The owner's question that retired
// the count: "does youtube have a limit to how many videos can exist or
// twitter how many tweets?" A bank-size FAILURE was a question limit in
// everything but name, and the constant is gone.
//
// What every fresh device IS handed whole — the boot surfaces (daily, test,
// group, duo, pulse, call) plus the feed's core (D321: "core ships whole,
// always") — is the install fetch, and that is what INSTALL_WARN watches:
// a WARNING, never an error, at the size where a fresh install's first
// fetch wants re-arguing (about 1 MB at the seed's measured bytes per
// document; ~460 docs today, moving at the daily's promotion pace and the
// core's curation, so years out). The paged surfaces — learn and the feed
// tail — are not counted: a device fetches them a page at a time. What a
// device ACCUMULATES over months of paging is a device-side design (an
// eviction rule for unanswered pages — BANK-DELIVERY §4, D349 amendment),
// not a number a content gate can hold, and never a reason to stop
// writing questions. checkHeadroom() still derives bytes-per-document
// from the seed itself so the message moves when the documents do.
// D162's sampled audit: one AI-reviewed question in this many gets read by
// a person. A starting figure, not a measured one — move it with what the
// audit actually finds.
export const AUDIT_ONE_IN = 20;
export const INSTALL_WARN = 4000;
export const INSTALL_SURFACES = new Set(["daily", "test", "group", "duo", "pulse", "call"]);

/** How many seed rows a fresh device is handed whole: the boot surfaces
 * plus the feed's core (D321). The paged surfaces are not in it. */
export function installDocs(rows) {
  return rows.filter((q) => INSTALL_SURFACES.has(q.surface) || (q.surface === "feed" && q.core === true)).length;
}

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
    // `PICK_QS = [`, not `window.PICK_QS = [`: the array is a named export
    // now (the window mirror is assigned from it further down), and this
    // marker matches either shape — which is the point, since a marker
    // that names the bridge breaks the day the module crosses it.
    "PICK_QS = [",
    "pick-data.js",
  );
  // The LIVE pick seed (D14 go-live): the archive entries above that were
  // promoted. Validated with the same pick rules, held byte-equal to the
  // archive by id, and covered by provenance like every live bank.
  const pickSeed = JSON.parse(
    readFileSync(join(root, "content", "pick-questions.json"), "utf8"),
  ).questions;
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
  // The marker followed the source: WORLD_TOPICS became a named export
  // when the Patterns tab started importing it (the WPAL precedent), with
  // `window.WORLD_TOPICS = WORLD_TOPICS` kept beneath for spec consumers.
  const worldTopics = extractLiteral(wfdSrc, "export const WORLD_TOPICS = [", "world-feed-data.js");
  // The subtopic tree, for `also` (docs/TAGS-PLAN.md §1): a door may be a
  // leaf, and the leaf→parent map is what the redundancy rule below reads —
  // following a parent already gives you everything under it
  // (world-subtopics.js), so a card carrying both says one thing twice.
  const worldSubs = extractLiteral(
    readFileSync(join(root, "src", "v2", "spec", "world-subtopics.js"), "utf8"),
    // `const`, not `window.` — the publication was swept at D210 (nothing
    // read the global; the file reads the value lexically). This marker is a
    // TEXT dependency on a declaration form, which no grep for the name can
    // see and which `question-quality.test.mjs` is the only thing that
    // catches: it is what failed the sweep's first run.
    "const WORLD_SUBTOPICS = [",
    "world-subtopics.js",
  );
  return {
    specQ,
    dailyIdOf,
    catMeta,
    seed,
    feed,
    feedTopics: new Set(feed.topics.map((t) => t.id)),
    worldTopics: new Set(worldTopics.map((t) => t.id)),
    subParents: new Map(worldSubs.map((s) => [s.id, s.parent])),
    duel: [...duel.group, ...duel.oneVsOne, ...(duel.romantic ?? [])],
    pick,
    pickSeed,
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

// ── the tragedy tripwire (D235) ──
//
// The owner's rule, on reading the first current-events batch: these
// questions should avoid tragedies — a terror attack being the named
// example — because it is an easy way to get the app in trouble.
//
// WHY IT IS A RULE AND NOT TASTE. News skews to catastrophe, so a lane
// whose whole job is "what is happening now" walks into one most weeks.
// A vote card under a death toll is a body count with buttons: it asks a
// crowd to take a side on somebody's worst day, and since D98 it then
// PUBLISHES the exact split doing so. There is no version of that which
// reads as anything but the app monetising a funeral, and no answer to a
// journalist asking why it exists.
//
// TWO TIERS, because one word list would either miss the thing or fail
// honest content. The plain list is unambiguous whatever surrounds it.
// The second fires only on an EVENT word beside a CASUALTY word, which is
// what separates "markets crashed 8% — panic or noise?" (an event word,
// no toll, fine) from "the crash that killed 14" (both, and not ours to
// ask). Measured over the whole 653-entry bank the day it was written:
// zero entries fire, and the three that trip a single tier are exactly
// the content the conjunction exists to spare — the Library of
// Alexandria's earthquake, what a gladiator fight ended in, and the Book
// of the Dead.
//
// LEARN IS CARVED OUT, the same way it is for the place tripwire above
// and for a sharper reason than symmetry: a learn card has a RIGHT
// ANSWER. "Who was assassinated in 44 BC?" is history with one correct
// response; it does not ask anybody to take a side, which is the entire
// thing this rule is about. Every other surface asks for a side.
//
// A TRIPWIRE, NOT THE RULE. The rule lives in QUESTION-FARM.md and cannot
// be written as a word list, because the same prompt can be ordinary in a
// quiet week and grotesque in the week of an attack — "is airport
// security theatre?" being the clean example — and no gate can see the
// week. What this catches is the unambiguous case; judging the rest is
// the writing run's job and the audit's. Judged false positives go in
// ALLOW under `tragedy`, with the reason, the neighbours pattern.
const TRAGEDY_PLAIN = /\b(terror|terrorist|terrorism|massacres?|genocide|atroci\w+|war crimes?|mass shooting|suicide bomb\w*|beheading|lynching|manslaughter|murder(ed|s)?|assassinat\w+|hostages?|kidnapp\w+|abduct\w+|torture|rape|p?a?edophil\w+)\b/i;
const TRAGEDY_EVENT = /\b(attacks?|bombing|shootings?|stabbing|strikes?|crash(ed|es)?|derail\w*|sinking|quake|earthquake|floods?|wildfires?|hurricane|famine|outbreak|siege|raid)\b/i;
const TRAGEDY_TOLL = /\b(death toll|casualt\w+|fatalit\w+|killed|dead|died|deaths|victims?|wounded|injured|mourn\w+|funerals?|bodies|survivors?|missing)\b/i;

export function tragedyHit(q) {
  const text = textOf(q);
  const plain = text.match(TRAGEDY_PLAIN);
  if (plain) return { kind: "plain", cue: plain[0] };
  const event = text.match(TRAGEDY_EVENT);
  const toll = text.match(TRAGEDY_TOLL);
  if (event && toll) return { kind: "casualty", cue: `${event[0]} … ${toll[0]}` };
  return null;
}

// ── doors (docs/TAGS-PLAN.md) ──
// `also` is reach, never placement: the Map, kicker and stream grouping stay
// on `cat`; the filter, stock, search and demand rollup read cat ∪ also.
// These are the rules conservation cannot enforce by itself. An unknown id is
// a door onto nothing and fails SILENTLY — the card serves, the filter just
// never matches the door — which is the same failure class as a typo'd
// `rates` scope, so it gets the same treatment: refused at the gate, not
// discovered in production. The vocabulary is closed for the reason `cat`'s
// is (farm hard rule 3): an open one is a free-text field wearing a schema.
function checkAlso(q, topicVocab, ctx, err) {
  if (q.also === undefined) return;
  if (q.scene) {
    // A scene is a room, not a topic; the filter matches room cards on the
    // room alone (docs/TAGS-PLAN.md §2). A door here would be a publication
    // nothing reads — check:globals rule 5's smell, arriving as content.
    err("also", "a scene card cannot carry `also` — the filter matches room cards on the room alone, so a door here is metadata nothing reads");
    return;
  }
  if (!Array.isArray(q.also) || q.also.some((t) => typeof t !== "string" || !t.trim())) {
    err("also", `also must be an array of topic ids (got ${JSON.stringify(q.also)})`);
    return;
  }
  if (!q.also.length) {
    // Emit-when-set end to end: an empty array is "nobody decided" wearing
    // a decision's bytes — the same argument `core` makes about absence.
    err("also", "empty `also` — omit the key on a question with no doors");
    return;
  }
  if (q.also.length > ALSO_MAX) {
    err("also", `${q.also.length} doors (max ${ALSO_MAX}) — a question that needs more is usually a vague question (docs/TAGS-PLAN.md §1)`);
  }
  const seen = new Set();
  for (const t of q.also) {
    if (seen.has(t)) err("also", `door ${JSON.stringify(t)} repeats`);
    seen.add(t);
    if (t === q.cat) err("also", `door ${JSON.stringify(t)} repeats the home — \`cat\` already places the card there`);
    else if (!topicVocab.has(t) && !ctx.subParents.has(t)) {
      err("also", `door ${JSON.stringify(t)} is not a committed topic or subtopic id — the vocabulary is closed (farm hard rule 3; new topics go through § When no category fits)`);
    }
  }
  // Parent/leaf redundancy, both directions: following a parent gives you
  // everything under it, so home-or-door carrying a leaf AND its parent is
  // one claim stated twice — and twice the demand credit dilution for it.
  const carried = [q.cat, ...q.also];
  for (const t of carried) {
    const parent = ctx.subParents.get(t);
    if (parent && carried.includes(parent)) {
      err("also", `${JSON.stringify(t)} and its parent ${JSON.stringify(parent)} are both carried — following the parent already reaches the leaf`);
    }
  }
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

  // ── background, the card's `i` (D281) ────────────────────────────
  //
  // check:content owns the SHAPE (a non-blank, untrimmed-free string).
  // What lives here is editorial: is it long enough to be worth opening,
  // short enough to read on a card, and is it FACTS rather than a case?
  //
  // The last of those three is the one a gate can only half-see, so it
  // only refuses the unambiguous form: a background that asks a question
  // back, or that tells the reader what to conclude. "Most economists
  // agree the sentence is excessive" is a side wearing a fact's clothes,
  // and a poll whose context argues for one option is not a poll. The
  // rest is the reviewing run's, exactly like the tragedy tripwire — a
  // sentence can lean without using any of these words.
  if (q.bg !== undefined) {
    const bg = String(q.bg).trim();
    if (!bg) {
      err("bg", "`bg` is present and empty — the card falls back to the pale button and nobody learns the field was authored");
    } else if (bg.length < BG_MIN) {
      err("bg", `background is ${bg.length} chars (min ${BG_MIN}) — a sheet that opens on a half-fact leaves the reader where they were`);
    } else if (bg.length > BG_MAX) {
      err("bg", `background is ${bg.length} chars (max ${BG_MAX}) — facts and definitions, not the arguments; the arguments are the reveal`);
    }
    if (bg && bg.endsWith("?")) {
      err("bg", "the background asks a question — the card already asked one; this is where its terms get explained");
    }
    if (bg && BG_ARGUES.test(bg)) {
      err("bg", "the background argues rather than informs — a poll whose context leans is a poll about its own framing (a judged false positive goes in ALLOW under `bg`)");
    }
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
  // Doors are a feed-surface mechanic (pick rides the same filter). On the
  // daily the near-neighbour is `alts` — CANDIDATE placements the crowd
  // votes between, not extra reach — and on every other surface a door is
  // metadata nothing reads, which is how fields rot into lore.
  if (q.also !== undefined && surface !== "feed" && surface !== "pick") {
    err("also", `\`also\` is feed/pick only (docs/TAGS-PLAN.md §1) — on ${surface} nothing reads doors${surface === "daily" ? ", and alternative placements are `alts`" : ""}`);
  }

  // Same carve-out as the place rule below, for the reason in the
  // tripwire's own header: a learn card has a right answer, so it can name
  // an atrocity as history without asking anyone to take a side.
  const tragedy = surface === "learn" ? null : tragedyHit(q);
  if (tragedy) {
    err(
      "tragedy",
      `reads as a question about a tragedy ("${tragedy.cue}") — this app does not put suffering to a vote (D235), ` +
        "and a published split on one is how it ends up in a story about itself. " +
        'A human may record "<id>~tragedy" in ALLOW if judged clear.',
    );
  }

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
    if (q.rates !== undefined) {
      if (!RATES_SCOPES.has(q.rates)) {
        err("rates", `rates ${JSON.stringify(q.rates)} — city|country|world (D187); anything else names no stop, so the question lands on no scorecard`);
      }
      if (!RATES_TYPES.has(q.type)) {
        err("rates", `a \`rates\` question is ${q.type} — the scorecard AVERAGES it (D187), and only rating|scale carry a magnitude to average`);
      }
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
    // rank is live-servable since D233 (answers carry an order); whether
    // the FARM may author one is the lane contract's question
    // (QUESTION-FARM.md), not a per-question warning's.
    // `cat` is REQUIRED, not merely validated-if-present. Every feed question
    // in the bank carries one, so this held by luck for as long as only humans
    // wrote them; a topic-less card has a broken kicker and never appears in
    // the topic filter, which is a question nobody can find rather than a
    // question that reads oddly. The feed lane runs on a schedule now, so the
    // rule that was true in the data becomes a rule in the gate.
    if (!q.cat) err("topic", "a feed question needs a topic — without one its kicker is broken and the topic filter cannot reach it");
    else if (!ctx.feedTopics.has(q.cat)) err("topic", `topic ${JSON.stringify(q.cat)} is not in the feed taxonomy`);

    checkAlso(q, ctx.feedTopics, ctx, err);

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

    // ── the current-events lane (D231) ──
    //
    // check:content owns the SHAPE of the two window fields (day keys,
    // feed-only, ordered) and the core refusal. What lives here is
    // editorial: whether the window is one a reader would still call
    // current, and whether the question is a question this lane may ask
    // at all. The two gates deliberately do not restate each other.
    const windowed = q.from !== undefined || q.until !== undefined;
    if (q.cat === NOW_TOPIC && !(typeof q.from === "string" && typeof q.until === "string")) {
      // Both ends, always. A `now` card with no close never stops being
      // served, which is the whole failure the topic exists to avoid; one
      // with no open cannot draw its remaining fraction, so the ring would
      // have to guess — and a guessed deadline on a real one is worse than
      // no ring at all.
      err("window", `a ${NOW_TOPIC} question carries both \`from\` and \`until\` — the lane's promise is that it stops being asked`);
    }
    if (windowed && q.cat !== NOW_TOPIC && !q.sponsor) {
      // A window on an ordinary topic is a card that vanishes from a chip
      // row that gives the reader no reason to expect it. Sponsored slots
      // are the one other windowed thing, and they announce themselves
      // with a band (D195).
      err("window", `a window belongs to the ${NOW_TOPIC} topic or a sponsored slot — an ordinary card that quietly expires is stock a reader cannot account for`);
    }
    const days = windowDays(q.from, q.until);
    if (days !== null && (days < WINDOW_MIN_DAYS || days > WINDOW_MAX_DAYS)) {
      err("window", `the window runs ${days} day${days === 1 ? "" : "s"} (${WINDOW_MIN_DAYS}-${WINDOW_MAX_DAYS}) — shorter polls whoever opened the app that day, longer stops being current`);
    }
    if (q.cat === NOW_TOPIC) {
      const text = [q.prompt, ...(q.options || []).map((o) => (o && typeof o === "object" ? o.label : o))].filter(Boolean).join(" ");
      if (CALL_OPENER.test(String(q.prompt || "")) || CALL_DATED.test(text)) {
        err("call-shape", "this reads as a prediction, not an opinion — a resolved call needs a sealed answer and an executable rubric (docs/FORESIGHT-CALLS.md, D127), and must arrive through that door");
      }
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
          // What this fork TURNS. Required on every node including the two
          // legacy stories — their waiver is on the spread rule below, so
          // the single-axis tree stays legible in the data rather than
          // being described by a missing field (the `core` argument: absent
          // and false are the same bytes, and only one is a decision).
          if (typeof n.axis !== "string" || !PATH_AXES.has(n.axis)) {
            err("axis", `node ${JSON.stringify(k)} needs an axis from ${[...PATH_AXES].join("|")} (got ${JSON.stringify(n.axis)})`);
          }
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
        // Three forks, three axes — checked per WALK rather than per tree,
        // because the tree is not one sequence of forks but eight, and a
        // story can be honestly varied down one branch and flat down
        // another (pt1 is: `_`→B→BA turns three, `_`→A→AA turns one).
        // A walk is what a reader actually experiences, so it is the unit.
        if (!PATH_AXIS_LEGACY.has(q.id)) {
          const flat = [];
          for (const e of PATH_ENDINGS) {
            const axes = [0, 1, 2].map((d) => (nodes[e.slice(0, d) || PATH_ROOT] || {}).axis);
            // Only judge walks whose three nodes all declared one — an
            // undeclared axis is already an error above, and reporting it
            // twice would make the annotation rule look like two bugs.
            if (axes.every((a) => PATH_AXES.has(a)) && new Set(axes).size < 3) {
              flat.push(`${e} (${axes.join(" → ")})`);
            }
          }
          if (flat.length) {
            err(
              "axis-spread",
              `${flat.length} of ${PATH_ENDINGS.length} walks turn one axis twice: ${flat.slice(0, 3).join(", ")}` +
                `${flat.length > 3 ? ", …" : ""} — three forks, three axes, or the eight endings are one gradient ` +
                "sampled eight times and the reveal ranks the reader instead of placing them",
            );
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

    // Same doors, wider vocabulary — a pick card's cat already validates
    // against WORLD_TOPICS (the superset holding `fav`/`places`), so its
    // doors do too.
    checkAlso(q, ctx.worldTopics, ctx, err);
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

  // The feed's batch rules, which did not exist until the Crossroads review
  // went looking for them. checkBatch had a daily arm and a learn arm and
  // nothing else, so the feed lane — which writes the LARGEST batch of the
  // three (§ The feed lane) — could legally land eight votes on one topic
  // and the pre-flight would print eight ✓ and no batch line.
  //
  // Two rules, both the daily arm's shape rather than new inventions: the
  // form rule is why `dial`, `field` and `path` are authorable at all, and
  // the topic rule is the budget's own instruction ("spreads across thin
  // topics rather than chunking into one", feed-budget.mjs) said at the one
  // moment a run can still obey it. The 0.75 ceiling is shared with daily
  // deliberately — a batch of eight may be six votes, which is honest,
  // and may not be seven.
  // The current-events lane is not the budgeted farm lane, and the two
  // rules below cannot judge it (D231). TOPIC spread is meaningless: `now`
  // batches are single-topic by construction, so the rule would fail every
  // batch this lane can legally write. FORM spread is meaningless for a
  // reason worth writing down: the two continuum forms are authored TWICE,
  // the second copy being permanent demo texture in world-feed-data.js,
  // and a question about this week's news has no business becoming a card
  // the demo build shows forever — while a `path` needs eight endings it
  // would outlive by a fortnight. So the lane writes votes, and the form
  // rule is not a bar it can clear, only one it can trip over.
  //
  // What replaces them is the rule this lane actually needs: windows.
  const now = batch.filter((q) => q.surface === "feed" && q.cat === NOW_TOPIC);
  const feed = batch.filter((q) => q.surface === "feed" && q.cat !== NOW_TOPIC);
  if (now.length >= 3) {
    // Distinct closes, because a batch that expires together empties the
    // topic in one day — and a topic filter offering an empty chip is
    // §1's own "reads as abandoned", which it names as worse than not
    // having the topic at all. Staggering is also the honest thing: six
    // stories do not stop being current on the same afternoon.
    const closes = now.map((q) => q.until);
    const dupes = closes.filter((d, i) => closes.indexOf(d) !== i);
    if (dupes.length) {
      errs.push(`${new Set(dupes).size} close date(s) shared across the batch (${[...new Set(dupes)].join(", ")}) — stagger them, or the topic empties in one day`);
    }
    // "Each question gets the window that fits it, but most should be
    // towards the lower end" (the owner, 2026-08-23). Half is the
    // arithmetic reading of "most" that a batch of three can still satisfy.
    const short = now.filter((q) => {
      const d = windowDays(q.from, q.until);
      return d !== null && d <= WINDOW_SHORT_DAYS;
    }).length;
    if (short * 2 < now.length) {
      errs.push(`${short} of ${now.length} ${NOW_TOPIC} questions run ${WINDOW_SHORT_DAYS} days or less — most of a batch should sit at the short end, or the lane is a monthly wearing a daily's name`);
    }
    // …and the same shape pointed at the answer space (D281). The lane's
    // first batch was six questions and twelve options, and nothing had
    // ever said not to: `check:content` allows 2–10, the fold allows
    // twenty, and the bank already ships three- and four-option votes.
    // The owner read the shipped six on a device and named it — "recent
    // events should often have more options, some of them have too few".
    //
    // A BATCH RULE rather than a per-question one, because two is right
    // often enough that a floor would be wrong: "about right / too far"
    // on a sentence is a genuine binary, and a gate cannot tell that from
    // a three-way story squeezed into two. What a gate CAN see is a whole
    // batch in which no story turned out to have a third side, which is a
    // claim about the news that is almost never true — it is the writer's
    // habit showing. Same 3-question threshold and same "most" arithmetic
    // as the window rule above, so the lane has one shape to learn.
    //
    // The cost of getting this wrong is asymmetric, which is why it is an
    // error and not a note: a window can be re-authored, but a shipped
    // card's options are frozen for the life of the bank (answers key on
    // `optionIdx` — the D30 re-key rule), so the only repair for a card
    // that needed a third option is a successor card.
    const binary = now.filter((q) => (q.options || []).length <= 2).length;
    if (binary * 2 > now.length) {
      errs.push(`${binary} of ${now.length} ${NOW_TOPIC} questions offer two options — give a story the sides it has; two is for a story that is genuinely two-sided, and a whole batch of them is a habit rather than the news`);
    }
  }
  if (feed.length >= 3) {
    const dominant = (key, label, extra) => {
      const seen = {};
      for (const q of feed) if (q[key]) seen[q[key]] = (seen[q[key]] || 0) + 1;
      const top = Object.entries(seen).sort((a, b) => b[1] - a[1])[0];
      if (!top) {
        errs.push(`a batch of ${feed.length} feed questions declares no ${label} — the gate cannot judge the spread`);
        return;
      }
      if (top[1] > Math.ceil(feed.length * 0.75)) {
        errs.push(`${top[1]} of ${feed.length} feed questions are ${label} ${top[0]} — ${extra}`);
      }
    };
    dominant("type", "form", "vary the forms; dial, field and path exist because a feed of votes reads as one question asked repeatedly");
    dominant("cat", "topic", "spread across topics — the regulator picks thin ones for a reason (feed-budget.mjs)");
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

// ── the Crossroads genre ratchet ──
//
// A path's topic must differ from the topic of each of the
// PATH_GENRE_LOOKBACK paths before it in the bank.
//
// This is a CORPUS rule and not a batch one, unlike everything in
// checkBatch: the feed lane writes eight questions a run and at most one of
// them is a story, so "vary the forms within the batch" can never see two
// paths at once. What a reader experiences is the SEQUENCE — Crossroads
// holds one pinned slot at the head of the feed (D136), so consecutive
// stories are consecutive on screen in a way consecutive votes are not.
//
// Measured, which is why it exists: both live stories are `dilemma`, in a
// bank spanning ten topics. Nothing was wrong with either question; what
// was missing was any rule that noticed the corner they share.
//
// The first PATH_GENRE_LOOKBACK stories are unchecked by construction —
// they have no predecessors — so the two D136 shipped need no waiver here,
// and they still count as predecessors for the third, which is exactly the
// pressure this rule is for.
export function checkPathGenre(corpus) {
  const errs = [];
  const paths = corpus.feed.questions.filter((q) => q.type === "path");
  paths.forEach((q, i) => {
    if (i < PATH_GENRE_LOOKBACK) return;
    const clash = paths.slice(i - PATH_GENRE_LOOKBACK, i).filter((p) => p.cat === q.cat);
    if (!clash.length) return;
    errs.push(
      `feed ${q.id}: a Crossroads story on ${JSON.stringify(q.cat)} within ${PATH_GENRE_LOOKBACK} of ` +
        `${clash.map((p) => p.id).join(", ")} — the pinned slot shows one story at a time, so two in a row on ` +
        "one topic IS the reader's whole experience of Crossroads; pick a topic the last two did not use",
    );
  });
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
  if (!existsSync(path)) {
    return { errs: ["content/provenance.json is missing — the D97 vintage join has nothing to read"], warn: [] };
  }
  const prov = JSON.parse(readFileSync(path, "utf8"));
  // `sponsor` joined at D195 (docs/MONETIZATION.md path 2). It is a source
  // like the others — who wrote the question — and it is the one that has
  // to be true in BOTH directions: a sponsored question with an editorial
  // provenance row would launder a paid question into the vintage rollup
  // as house content, and an unpaid question filed as `sponsor` would put a
  // PAID band on something nobody bought.
  const SOURCES = new Set(["editorial", "farm", "community", "sponsor"]);

  for (const [surface, bank] of [
    ["daily", corpus.seed.map((q) => q.id)],
    ["feed", corpus.feed.questions.map((q) => q.id)],
    // The live pick seed (D14 go-live). Rows are keyed by the archive's
    // own pk id — which IS the seed id, so no archiveId field to rot.
    ["pick", corpus.pickSeed.map((q) => q.id)],
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
  // ── sponsorship, both directions (D195) ──
  {
    const feedRows = prov.feed || {};
    const paid = new Set(
      corpus.feed.questions.filter((q) => q.sponsor !== undefined).map((q) => q.id),
    );
    for (const id of paid) {
      if (feedRows[id] && feedRows[id].source !== "sponsor") {
        errs.push(`provenance: feed ${id} carries a sponsor block but is filed as ${JSON.stringify(feedRows[id].source)} — a paid question filed as house content is undisclosed inventory`);
      }
    }
    for (const [id, row] of Object.entries(feedRows)) {
      if (row.source === "sponsor" && !paid.has(id)) {
        errs.push(`provenance: feed ${id} is filed as sponsor but carries no sponsor block — the card would wear no PAID band`);
      }
    }
  }

  const dailyRows = prov.daily || {};
  for (const [id, row] of Object.entries(dailyRows)) {
    if (row.archiveId && !/^dqx?\d+$/.test(row.archiveId)) {
      errs.push(`provenance: daily ${id} archiveId ${JSON.stringify(row.archiveId)} is not a dq/dqx id`);
    }
  }

  // ── review (D162) ──
  //
  // D162 replaced per-item human review with AI review plus a sampled
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
  for (const surface of ["daily", "feed", "pick"]) {
    for (const [id, row] of Object.entries(prov[surface] || {})) {
      if (row.source !== "farm" && row.source !== "community") continue;
      const r = row.review;
      if (!r || typeof r !== "object") {
        errs.push(`provenance: ${surface} ${id} is ${row.source} with no \`review\` — D162: nothing enters the bank unread`);
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
  // batch: at D162's 1-in-20 a weekly batch of seven rounds to zero, so a
  // per-batch gate would pass while nothing was ever audited. Cumulative
  // is the only shape that binds at both sizes.
  //
  // A WARNING since D212, not an error. As an error this was a human gate
  // wearing a sampling rate: a person falling behind on audits turned CI
  // red, which stopped the lanes — the exact dependence the owner removed.
  // The sample keeps its D162 job (the only check on a reviewer that shares
  // the generator's blind spots) but does it retrospectively: the gate
  // reports the shortfall on every run, the operator audits on their own
  // clock, and the kill switch (`active: false`) is what handles anything
  // the audit then finds. What stays an ERROR above is the review verdict
  // itself and its explicit `audited` boolean — those are facts a run must
  // state, not work a person must keep up with.
  const warn = [];
  if (aiReviewed.length) {
    const want = Math.ceil(aiReviewed.length / AUDIT_ONE_IN);
    const got = aiReviewed.filter((r) => r.audited).length;
    if (got < want) {
      warn.push(
        `provenance: ${got} of ${aiReviewed.length} ai-reviewed questions carry an audit, want ≥ ${want} `
        + `(D162's 1-in-${AUDIT_ONE_IN}, retrospective since D212) — audit when you can; the shortfall accrues, it does not block`,
      );
    }
  }
  return { errs, warn };
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
  // Measured, not assumed: the same wire-size scan check-figures runs, so
  // the estimate moves when the documents do (adding `core` to 82 entries
  // moved it by ~1 KiB and check:figures caught that on COSTS.md).
  let rows = null;
  try {
    rows = bankArray(v2content);
  } catch {
    // The fallback stays, and the comment it used to carry was too
    // relaxed about it: this path reports an INVENTED wire size rather
    // than failing, so a parser that quietly stopped working would move
    // a documented figure with nothing to show for it. That is exactly
    // what happened when V2_ADS arrived (D197) — the other two copies
    // of this scan crashed and this one silently guessed. It survives
    // because a scorecard is not worth crashing a gate over; the scan
    // itself now lives in one place so it cannot half-break again.
    rows = null;
  }
  const bankSize = rows ? rows.length : (v2content.match(/"id":\s*"[^"]+"/g) || []).length;
  const bankBytes = rows ? JSON.stringify(rows).length : bankSize * 250;
  const mb = (n) => ((bankBytes / Math.max(bankSize, 1)) * n / 1024 / 1024).toFixed(1);
  const install = rows ? installDocs(rows) : 0;
  if (install >= INSTALL_WARN) {
    warn.push(
      `a fresh install is handed ${install} docs whole ≈ ${mb(install)} MB (the boot surfaces plus the feed's core) — `
      + "the first fetch wants re-arguing before this doubles (BANK-DELIVERY §4). The paged surfaces are not "
      + "counted, and no bank size fails this gate (D349 amendment)",
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

  // `--new-path` — the skeleton, not a template with words in it.
  //
  // A path is 38 authored strings under exactly-spelled keys, which is the
  // most hand-assembly this repo asks of a writing lane by a wide margin,
  // and the two failures D136 records are both assembly failures rather
  // than craft ones: the seed's whitelist dropped a field nobody noticed
  // was missing, and the opening fork was keyed `""` — which no local gate
  // could catch, because Firestore refuses an empty map key at WRITE time,
  // inside the seed callable, five gates and 984 unit tests later.
  //
  // So the scaffold's job is the keys: the `_` sentinel already in place,
  // all seven nodes, all eight endings, and an empty `axis` on each fork so
  // the rule is visible while the story is being written rather than at the
  // gate. It emits no prose on purpose — a template with example sentences
  // in it is a thing that gets half-edited and shipped.
  if (args.includes("--new-path")) {
    const blank = { axis: "", q: "", a: [{ t: "" }, { t: "" }] };
    console.log(JSON.stringify({
      id: "ptN", core: true, cat: "", type: "path", hue: 0,
      title: "", prompt: "", intro: "",
      nodes: Object.fromEntries(PATH_NODES.map((k) => [k, { ...blank, a: blank.a.map((c) => ({ ...c })) }])),
      endings: Object.fromEntries(PATH_ENDINGS.map((k) => [k, { name: "", line: "" }])),
    }, null, 2));
    console.error(
      `\n  axis: one of ${[...PATH_AXES].join(" | ")}\n` +
      `  no walk may turn one axis twice — see QUESTION-FARM.md § Crossroads stories\n` +
      `  cat: not one the last ${PATH_GENRE_LOOKBACK} stories used\n` +
      "  pre-flight with --batch (a tree has no flag syntax worth inventing)\n",
    );
    process.exit(0);
  }

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
      // A path's story, verbatim and for the same reason — and `id`, which
      // no other candidate needs: PATH_AXIS_LEGACY is keyed by it, so a
      // pre-flight that dropped it would judge a legacy story by the rule
      // the corpus gate waives and report a failure CI does not have.
      id: raw.id,
      title: raw.title, intro: raw.intro, nodes: raw.nodes, endings: raw.endings,
      // …and `core`, which only a path candidate needs today: the SCALE-PLAN
      // rule is scoped to content-form entries (`!mode.texture`), so it stays
      // silent on the dial/field candidates that pre-flight as demo-pool
      // copy and would otherwise have fired on every story for a field the
      // candidate did in fact declare and this function dropped.
      core: raw.core,
      // …and the ask window, for the reason `id` is here (D231): the window
      // rules read both ends and `sponsor` decides which of them applies, so
      // a pre-flight that dropped them would print six ✓ on a batch CI is
      // about to refuse — and the batch rules below would compare six
      // `undefined` closes and call them a collision.
      from: raw.from, until: raw.until, sponsor: raw.sponsor,
    };
  };

  const printPacket = (q, i) => {
    // Candidates pre-flight as the demo-pool form — texture included —
    // because that is the half the lane authors first; the content entry
    // is the same copy with the texture stripped.
    //
    // EXCEPT a path, which has no demo half to author: a continuum question
    // is written twice and a story is "written once, in the content bank"
    // (§ The feed lane). Its demo twin lives in spec/paths-data.js, which is
    // client code the lane does not touch. Found by probing rather than by
    // reading: a pre-flighted story failed with fourteen demands for an
    // authored branch share `p` — texture the live form must NOT carry, so
    // the packet was telling a run to write the one thing the content gate
    // would then reject it for.
    const { errs, warn } = checkQuestion(q, q.surface, corpus, { texture: q.type !== "path" });
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
    // The genre ratchet, run against the bank WITH this batch appended —
    // the corpus gate says the same thing a few minutes later in CI, and
    // this is the moment a run can still pick a different topic. Appending
    // is what makes it answer for the candidate: checkPathGenre reads a
    // path's predecessors, and a candidate that is not in the list has none.
    const withBatch = { feed: { questions: [...corpus.feed.questions, ...batch.filter((q) => q.type === "path")] } };
    for (const e of checkPathGenre(withBatch)) {
      failed++;
      console.log(`  ✗ ${e}`);
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
    // warns stay out of the feed walk's gate output (the old rank
    // exclusion warning printed 8 times per run until D233 retired it;
    // the suppression outlived it in case a future type earns one).
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
  // The LIVE pick seed (D14 gone live) — the archive entries above,
  // promoted. Two checks: the same pick rules (a hand edit to the seed
  // alone should fail exactly like one to the archive), and PARITY with
  // the archive by id, because the whole promote-script contract is
  // byte-for-byte copies — a retyped prompt or a swapped domain here is
  // the drift the script exists to make impossible, so the gate holds it.
  {
    const byPk = new Map(corpus.pick.map((q) => [q.id, q]));
    corpus.pickSeed.forEach((q) => {
      const { errs, warn } = checkQuestion(q, "pick", corpus);
      report("pick(seed)", q.id, errs, warn);
      const arch = byPk.get(q.id);
      const drift = !arch ? "has no archive entry — the seed is promoted FROM pick-data.js, never authored directly"
        : arch.prompt !== q.prompt ? `prompt differs from the archive's ${JSON.stringify(arch.prompt)}`
        : arch.domain !== q.domain ? `domain differs from the archive's ${JSON.stringify(arch.domain)}`
        : arch.cat !== q.cat ? `cat differs from the archive's ${JSON.stringify(arch.cat)}`
        : null;
      if (drift) {
        failed = true;
        console.error(`  ✗ pick(seed) ${q.id}: ${drift}`);
      }
    });
  }
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
  for (const e of checkPathGenre(corpus)) {
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

  const prov = checkProvenance(corpus);
  for (const e of prov.errs) {
    failed = true;
    console.error(`  ✗ ${e}`);
  }
  for (const w of prov.warn) console.log(`  • ${w}`);
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
