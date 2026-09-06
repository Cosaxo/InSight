// question-neighbors.mjs — near-duplicate gate for the question banks, and
// the lookup tool the farm runs while writing (D63).
//
// WHY THIS EXISTS. Every content lane's dedup rule ("a new question must
// not restate an existing one in different clothes" — QUESTION-FARM.md) is
// enforced by a writer re-reading the whole corpus, and the corpus grows by
// up to 4 questions a day (D33). The only automated check was exact
// prompt-string equality per surface (check-content.mjs), which a single
// reworded word defeats: the archive's own demo fixtures prove the class —
// "Money can buy happiness." vs "Money buys happiness." are the same
// question and share not one exact string. This script measures that
// similarity instead of trusting it was checked.
//
// WHAT IT MEASURES. Token-set Jaccard over prompt + option labels:
// lowercase, diacritics folded, stopwords dropped, then each word folded to
// a stem and mapped through a concept lexicon (D123 — see below). Word order
// and phrasing furniture don't count; content words do. The deliberate
// twin fixtures (born as suggestion-board seeds; literal strings in the
// test since D288 §1 retired the board) score 1.000 and 0.667 under this
// metric while the closest legitimate in-domain pair scores 0.400 (measured
// 2026-08-13 across all five domains), and the gate sits between them at
// GATE = 0.5. That gap
// is narrower than D63's was, deliberately and with the arithmetic below.
//
// WHAT D123 ADDED, AND WHY. The metric shipped comparing surface words, so
// two whole classes of rewrite scored near zero and reached the human
// re-read as the only defence:
//   morphology — "Master one thing, or dabble in many?" against "Mastering
//     one skill, or dabbling in many?" scored 0.143, because the only
//     stemming was a plural -s.
//   synonyms   — "Money buys happiness." against "Can wealth make you
//     happy?" scored 0.000, sharing not one token.
// Both are now folded before the sets are built, and both pairs score at or
// above GATE.
//
// THE PRICE, MEASURED. Recall this size is not free: across the five domains
// the closest legitimate pair moved 0.333 → 0.400 (daily 0.286 → 0.333, feed
// 0.222 → 0.250, duel 0.300 → 0.400, pick and learn unchanged), so the
// headroom under GATE narrowed from 0.167 to 0.100. That is the right trade
// rather than a regression, because the pair that narrowed it is genuinely
// close: duel gp2 "Who gives the best advice?" against 047 "Better at giving
// advice, or taking it?" — two questions about advice that the old metric
// scored 0.167 only because it could not see "gives" and "giving" as one
// word. The gate stays at 0.5, and ALLOW stays the escape hatch D63 built it
// to be. If a future family of questions pushes a legitimate pair past 0.5,
// the answer is an ALLOW entry with a reason, not a quieter metric.
//
// Two alternatives were measured and REJECTED, recorded so nobody re-derives
// them: character-trigram Dice and the overlap coefficient both fire hardest
// on shared VOICE, not shared question — "Music is mostly for…" against
// "This decade is mostly for…" trigrams at 0.605, and "Cinema or sofa?"
// against "Best way to watch a final?" overlaps at 0.500. A gate on either
// would fail the product's own house style.
//
// WHAT IT STILL CANNOT MEASURE, so nobody retires the writing rule: a
// paraphrase carried by words the lexicon does not pair ("Are people getting
// kinder, or meaner?" against "Is kindness rising or falling?" scores 0.167 —
// one shared concept and nothing else), and any two prompts that ask one
// question through entirely different imagery. This gate is the measurable
// floor under the writing rule, not its replacement.
//
// DOMAINS. Pairs are scored within a surface's dedup domain, never across:
//   daily  — the spec archive Q (src/v2/spec/daily-questions.js), ids
//            computed positionally (dq/dqx via DQ_BASE) exactly as the
//            file itself does, so failures name real ids.
//   feed   — content/feed-questions.json
//   duel   — content/duel-questions.json, group + oneVsOne together
//            (D40: a duel lane dedups against both banks)
//   pick   — window.PICK_QS (src/v2/spec/pick-data.js)
//   learn  — content/learn-questions.json, scored on prompt + the CORRECT
//            answer only (D115). See below for why that one domain differs.
// The suggestions overlay (the board's SEED array, report-only on daily
// lookups) retired with the community board itself (D288 §1): the seeds
// are deleted from suggestions.js, and real asks live in Firestore where
// a source parse cannot reach them. Its sentinel duty — proving the
// detector sees byte-twins — lives on as literal strings in the test.
//
// LEARN, AND WHY IT SCORES DIFFERENTLY (D115, 2026-08-12). This header used
// to end "Learn cards are also out (v1): two cards may legitimately share the
// vocabulary of one fact." That reasoning was right about the measurement and
// wrong about the conclusion, and measuring separated the two. Scored like
// every other domain — prompt plus ALL option labels — the learn bank's
// closest pair is 0.444: sol1 "Which planet is closest to the Sun?" against
// sol2 "Which planet is hottest?", two genuinely different questions that
// collide only because a field's cards offer the same DISTRACTORS by
// construction (every planet card lists the same planets). Not enough room
// under GATE to gate honestly. But distractor overlap is not what a duplicate
// learn card is: a dupe is two cards teaching the same FACT, and a fact is a
// prompt plus its answer. Scored that way the bank's closest pair is 0.333 —
// cell4 "Where does an animal cell keep its DNA?" against cell6 "Which of
// these cells has no nucleus?" — the same wide, stable gap the other four
// domains sit in, so learn gates at the same GATE for the same reason.
// What still cannot be measured is unchanged and is why the writing rule
// stands: only a human can tell whether two differently-worded prompts test
// one fact (D32).
//
// Modes:
//   (no args)                      scan every domain; exit 1 on any pair
//                                  ≥ GATE not covered by ALLOW
//   --candidate "prompt"           rank the candidate against a domain
//     [--options "A|B|C"]          (default daily)
//     [--domain daily|feed|duel|pick|learn] [--top N]
//                                  For --domain learn, pass the correct
//                                  answer alone as --options: the domain is
//                                  scored on prompt + answer, and handing it
//                                  the distractors would score the candidate
//                                  on text the corpus side deliberately drops.
//   --batch <file.json>            pre-flight a whole run at once: every
//                                  candidate against its domain AND against
//                                  its BATCH SIBLINGS, one packet line each,
//                                  exit 1 on any pair ≥ GATE. Takes the same
//                                  file question-quality.mjs --batch takes,
//                                  so one candidates file pre-flights both
//                                  gates (D123). The sibling half is the
//                                  coverage --candidate never had: run it
//                                  per question and nothing compares the
//                                  questions to EACH OTHER — a run writing
//                                  eight at once could land two twins, and
//                                  every lane's budget is now bigger than
//                                  one (D97's 8/run daily, D115's 10/run
//                                  learn). CI's corpus scan catches that
//                                  pair, but only after the PR exists,
//                                  which is one human review too late.
//
// Node stdlib only, deterministic, like every gate here.
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Pairs a human has judged legitimately distinct despite scoring ≥ GATE.
// Key: "<idA>~<idB>" with ids sorted, value: the reason (shown on scan).
// Discipline: prefer rewriting or dropping the newer question — an entry
// here is a recorded exception, not a convenience. Empty today; the
// measured in-domain maximum is 0.333.
export const ALLOW = new Map([
  // The first entry since D63 built this hatch, and it is the case the
  // header predicted: "a future family of questions pushes a legitimate
  // pair past 0.5".
  //
  // pk09 "The best Pokémon name?" against pk13 "The best-named element?"
  // scores 0.500 on `best` + `name`, which is the entire overlap. The
  // domains are disjoint (pokemon / elements), the option sets share no
  // member, and pk13's own source comment names pk09 as the canon it is
  // modelled on — this is a question SHAPE being reused across catalogues,
  // deliberately, and the shape is what the metric can see.
  //
  // Recorded rather than rewritten because rewriting either prompt to dodge
  // the scorer would make it worse English to satisfy a lexical measure —
  // the failure mode this file's header rejects for the metric is the same
  // one it would be committing in the content. If "the best-named X" grows
  // a third member, that is the moment to ask whether the family is a
  // template rather than to add a third exemption.
  ["pk09~pk13", "different catalogues, shared question shape: `best`+`name` is the whole overlap"],
]);

export const GATE = 0.5;

// ── tokenization ──
// Stopwords are phrasing furniture: dropping them is what makes "Would you
// take a pill that removed the need for sleep?" and "A pill that ends your
// need for sleep. Take it?" near-neighbours (0.667) instead of strangers.
// "yes"/"no"/"never" are here because as option labels they say nothing
// about which question is being asked.
const STOP = new Set(
  (
    "a an the or and of to in for is are was were be been being it its " +
    "you your yours we our ours i me my mine they them their this that " +
    "these those what which who whom whose when where how why would could " +
    "should can will shall do does did done have has had if than then so " +
    "not no yes never ever just really very about into over under again " +
    "more most much many as at on with by from up down out off"
  ).split(" "),
);

// ── morphological folding (D123) ──
// Suffix stripping, longest suffix first, applied to a FIXPOINT. The fixpoint
// is the load-bearing part: a single pass lands "master" on "mast" (the -er
// rule cannot tell an agent noun from a word that merely ends in those two
// letters) but "mastering" on "master", so the two forms end up further apart
// than they started. Iterating puts both on "mast". Over-stripping is
// harmless when it is applied EQUALLY to every form of the word; what is not
// harmless is a stem two forms disagree about.
//
// The suffix table is measured, not copied from a stemmer: every rule here
// merges at least one real pair in this corpus, and the whole table merges 70
// groups of the 1130-token vocabulary, each of which was read (the check is
// `question-neighbors.test.mjs` § the folder). Two collisions found that way
// are excluded by name rather than by weakening a rule that otherwise earns
// its place.
const KEEP = new Set([
  "meaning", // "meaning" (significance) is not "mean" (unkind) — the corpus
  // runs both: "Suffering can give life meaning." and "Are people getting
  // kinder, or meaner?"
  "everest", // -est would make the mountain "ever"
]);

const SUFFIX = [
  // [suffix, replacement, min chars that must remain]
  ["iness", "y", 3], // happiness → happy (before -ness, which would give "happi")
  ["iest", "y", 3],
  ["ier", "y", 3],
  ["ness", "", 3],
  ["hood", "", 3],
  ["ship", "", 3],
  ["ment", "", 4],
  ["ion", "", 3], // min 3 keeps "union" whole; "mention" → "ment" collides with nothing
  ["ing", "", 3],
  ["est", "", 3],
  ["ed", "", 3],
  ["er", "", 3],
  ["ly", "", 3],
];

// CVC and not ending w/x/y — Porter's condition for restoring a dropped 'e'.
// "moved" → "mov" → "move", but "asked" → "ask" stays "ask".
const CVC = /[^aeiou][aeiou][^aeiouwxy]$/;

function foldStep(t) {
  if (t.length <= 4 || KEEP.has(t)) return t;
  for (const [suf, rep, min] of SUFFIX) {
    if (!t.endsWith(suf) || t.length - suf.length < min) continue;
    let base = t.slice(0, -suf.length);
    if (rep === "") {
      // "running" → "runn" → "run"; the undo and the 'e' restore are
      // alternatives, never both — "getting" → "gett" → "get", not "gete".
      if (/([bdgklmnprt])\1$/.test(base)) base = base.slice(0, -1);
      else if ((suf === "ing" || suf === "ed") && base.length <= 3 && CVC.test(base)) base += "e";
    }
    return base + rep;
  }
  // A trailing 'e' is dropped last, so "dabble" and "dabbling" both land on
  // "dabbl". Length > 4 keeps "care" off "car" and "hate" off "hat".
  return t.length > 4 && t.endsWith("e") ? t.slice(0, -1) : t;
}

export function foldWord(t) {
  for (let i = 0; i < 6 && t.length > 4; i++) {
    const next = foldStep(t);
    if (next === t) break;
    t = next;
  }
  return t;
}

// ── the concept lexicon (D123) ──
// Synonyms only. Morphology is the folder's job above, so a family here earns
// its place by pairing words no amount of suffix stripping brings together.
// Two rules for adding one, both about keeping the gate's false-positive rate
// at the zero it measures today:
//   1. At least one member must appear in the live corpus vocabulary — this
//      pairs words THIS product's writers actually reach for, not a thesaurus.
//   2. Re-run the corpus scan after adding. A family that moves a domain's
//      closest legitimate pair is a family that will fail a real question.
// Deliberately absent: "chance" from luck (it also means opportunity),
// "rest" from sleep (it also means remainder) and "reading" from book (the
// act is not the object — pairing them scored "Would you read a diary you
// kept at 15?" against an unrelated prompt).
const CONCEPTS = {
  film: ["movie", "cinema"],
  sea: ["ocean"],
  money: ["cash", "wealth"],
  child: ["kid"],
  phone: ["mobile", "smartphone"],
  smart: ["clever", "intelligent"],
  begin: ["start"],
  buy: ["purchase"],
  home: ["house"],
  talk: ["speak", "conversation"],
  angry: ["mad", "furious"],
  hard: ["difficult", "tough"],
  big: ["large", "huge"],
  city: ["town"],
  job: ["career", "profession"],
  tech: ["technology"],
  food: ["meal", "cuisine"],
  old: ["elderly"],
  die: ["death", "dead"],
  alone: ["lonely", "solitude"],
  luck: ["fortune"],
  travel: ["trip", "journey", "holiday", "vacation"],
  music: ["song", "tune"],
  book: ["novel"],
  country: ["nation"],
  partner: ["spouse", "husband", "wife"],
  remember: ["recall", "memory"],
  funny: ["humour", "humor"],
  war: ["conflict"],
  gift: ["present"],
};

// Both sides fold before they meet, so an entry can be written the way a
// person spells it ("movie") and still match the token the folder produces
// ("movi"). Writing the folded forms by hand would be a second place for the
// folder's rules to drift.
const CONCEPT = new Map();
for (const [canon, alts] of Object.entries(CONCEPTS)) {
  const to = foldWord(canon);
  for (const word of [canon, ...alts]) CONCEPT.set(foldWord(word), to);
}

export function tokensOf(text) {
  const norm = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // fold diacritics: Pokémon → pokemon
    .replace(/[’‘]/g, "'");
  const out = new Set();
  for (let t of norm.split(/[^a-z0-9]+/)) {
    if (!t || STOP.has(t)) continue;
    // plural first, so "movies" reaches the lexicon as "movie". The 'ss'
    // guard keeps "chess"/"less" intact.
    if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
    const folded = foldWord(t);
    out.add(CONCEPT.get(folded) ?? folded);
  }
  return out;
}

export function similarity(aTokens, bTokens) {
  let inter = 0;
  for (const t of aTokens) if (bTokens.has(t)) inter++;
  const union = aTokens.size + bTokens.size - inter;
  return union ? inter / union : 0;
}

// ── corpus loading ──
// The spec arrays are pure data literals; extract by bracket-matching and
// evaluate in a bare context — the same cross-read promote-questions.mjs
// and question-scorecard.mjs use, for the same reason: a copy here would
// drift.
function extractArray(src, marker, at) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`${at}: marker not found: ${marker}`);
  const open = src.indexOf("[", start);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "[") depth++;
    else if (src[j] === "]") {
      depth--;
      if (depth === 0) return vm.runInNewContext(src.slice(open, j + 1));
    }
  }
  throw new Error(`${at}: unbalanced brackets after ${marker}`);
}

// A question's comparable text: prompt plus whatever labels it offers.
// Feed options are {label,count} objects; rank questions carry items;
// continuum entries (dial/field, D113) label their scale ends instead —
// ax/ay/ends carry the semantic tokens an optionless form has.
//
// A CROSSROADS STORY IS ALMOST ENTIRELY INVISIBLE WITHOUT THE LAST CLAUSE,
// and the number is why it is here. A path carries no `options` — the gate
// on the other side refuses them, because its answer space is the eight
// endings and their labels are synthesized (D136) — no items, no ax/ay/ends.
// So `textOf` saw its prompt and nothing else: MEASURED at 4 tokens against
// 134 and 145 in the two live stories, i.e. 3% of the question, while the
// intro, all seven scene lines, all fourteen choices and all sixteen ending
// strings went uncompared. Two stories differing only in their one-line
// prompt would have scored 0.000 and passed.
//
// What this does NOT close, said plainly so the next reader does not trust
// it further than it goes: the same two stories score 0.107 compared WHOLE,
// far under the 0.5 gate, because they are the same KIND of story in
// different vocabulary — a moral test handed to a lone adult by accident.
// Token overlap cannot see genre. That is check:quality's `axis-spread` and
// the genre ratchet's job, and this fix is the narrower one it looks like:
// a gate that was reading 3% of its input now reads all of it.
function textOf(q) {
  const opts = (q.options || q.items || []).map((o) =>
    o && typeof o === "object" ? o.label : o,
  );
  const story = q.type === "path"
    ? [
        q.title, q.intro,
        ...Object.values(q.nodes || {}).flatMap((n) => [n.q, ...(n.a || []).map((c) => c.t)]),
        ...Object.values(q.endings || {}).flatMap((e) => [e.name, e.line]),
      ]
    : [];
  return [q.prompt, ...opts, ...story, ...(q.ax || []), ...(q.ay || []), ...(q.ends || [])]
    .filter(Boolean)
    .join(" ");
}

export function dailyIdOf(i, dqBase) {
  return i < dqBase
    ? "dq" + String(dqBase - i).padStart(2, "0")
    : "dqx" + String(i - dqBase + 1).padStart(2, "0");
}

export function buildDomains() {
  const specSrc = readFileSync(join(root, "src", "v2", "spec", "daily-questions.js"), "utf8");
  const specQ = extractArray(specSrc, "const Q = [", "daily-questions.js");
  const baseM = specSrc.match(/const DQ_BASE = (\d+)/);
  if (!baseM) throw new Error("daily-questions.js: DQ_BASE not found");
  const dqBase = Number(baseM[1]);

  const pickQ = extractArray(
    readFileSync(join(root, "src", "v2", "spec", "pick-data.js"), "utf8"),
    // `PICK_QS = [`, not `window.PICK_QS = [`: the array is a named export
    // now (the window mirror is assigned from it further down), and this
    // marker matches either shape — which is the point, since a marker
    // that names the bridge breaks the day the module crosses it.
    "PICK_QS = [",
    "pick-data.js",
  );
  const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8")).questions;
  const duel = JSON.parse(readFileSync(join(root, "content", "duel-questions.json"), "utf8"));
  const learn = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8")).cards;
  // The feed's dedup domain spans BOTH destinations the lane writes
  // (QUESTION-FARM.md § The feed lane): the content bank, and the demo
  // pool's lane-authored continuum entries (dial/field, D113). The pools
  // serve different builds, but a dial near-twin of a bank vote still
  // reads as "I already answered that" — and will literally become one
  // if the entry ever promotes.
  const continuum = extractArray(
    readFileSync(join(root, "src", "v2", "spec", "world-feed-data.js"), "utf8"),
    "const WFD_DEMO_POOL = [",
    "world-feed-data.js",
  ).filter((q) => q.type === "dial" || q.type === "field");

  const entry = (id, q) => ({ id, prompt: q.prompt, tokens: tokensOf(textOf(q)) });
  // A continuum question exists in BOTH pools by design (D114): the content
  // entry is the live copy, the demo entry the same copy plus its authored
  // texture. Same id = same question, not a dupe — only demo entries the
  // content bank does not know join the domain.
  const feedIds = new Set(feed.map((q) => q.id));
  // A retired entry (`active: false`, D52's shape) leaves the domain. The
  // gate exists so the feed never asks one question twice, and a retired
  // question is not asked at all — while its REPLACEMENT carries the same
  // prompt by design: the only way to change a shipped dial's range is to
  // retire the id and append a new one (D114's freeze; D358 did it for
  // fourteen), so scoring the pair would fail every legitimate
  // replacement at 1.000 and push each into ALLOW as a non-exception.
  // The retired entries stay in the bank file (the seed and the deck read
  // the flag there), and stay in `feedIds`: a demo twin of a retired id is
  // still that id, not a new dupe.
  const live = feed.filter((q) => q.active !== false);
  return {
    daily: specQ.map((q, i) => entry(dailyIdOf(i, dqBase), q)),
    feed: [...live, ...continuum.filter((q) => !feedIds.has(q.id))].map((q) => entry(q.id, q)),
    duel: [
      ...duel.group.map((q) => entry(q.id, q)),
      ...duel.oneVsOne.map((q) => entry(q.id, q)),
      // The romantic 1v1 pool (D40 part 4) shares the duo id series and the
      // dedup domain: the pools are disjoint at serve time, but a pair can
      // flip between them, so a near-twin across pools still reads as "I
      // already answered that".
      ...(duel.romantic ?? []).map((q) => entry(q.id, q)),
    ],
    pick: pickQ.map((q) => entry(q.id, q)),
    // Prompt + the correct answer, never the distractors (header).
    learn: learn.map((c) => ({ id: c.id, prompt: c.q, tokens: tokensOf([c.q, c.a[c.c]].join(" ")) })),
  };
}

export function scanDomain(list) {
  const hits = [];
  let closest = null;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const s = similarity(list[i].tokens, list[j].tokens);
      const key = [list[i].id, list[j].id].sort().join("~");
      const allowed = ALLOW.has(key);
      // `closest` skips ALLOWED pairs, and that is what makes ALLOW work at
      // all. It used to be computed before the exemption was consulted, so
      // an allowed pair still counted as the margin-spender — and the
      // "keeps a measured margin under GATE" case asserts `closest.s <
      // GATE`. An ALLOW entry therefore silenced one test and could never
      // silence the other, which made the escape hatch this file's header
      // advertises unusable. Nobody noticed because ALLOW was empty from
      // D63 until the first pair actually needed it.
      //
      // The test's own words are the specification: it names this "the
      // closest LEGITIMATE pair", and a pair carrying a written exemption is
      // an accepted one rather than a legitimate near-miss.
      if (!allowed && (!closest || s > closest.s)) closest = { s, a: list[i], b: list[j] };
      if (s >= GATE && !allowed) hits.push({ s, a: list[i], b: list[j], key });
    }
  }
  return { hits, closest };
}

function rankAgainst(cTokens, list, top) {
  return list
    .map((e) => ({ s: similarity(cTokens, e.tokens), e }))
    .sort((x, y) => y.s - x.s)
    .slice(0, top);
}

// ── batch pre-flight (D123) ──
// One candidate from the batch file, in whichever shape its lane authors.
// A learn card arrives native (`f`/`q`/`a`/`c`) and is scored on prompt plus
// the CORRECT answer, exactly as the learn corpus is — question-quality.mjs
// reads the same tell for the same reason, so one file pre-flights both.
export function batchEntryOf(raw, i) {
  const isLearn = raw.domain === "learn" || raw.surface === "learn" || (raw.f && raw.a && raw.q);
  const domain = isLearn ? "learn" : raw.domain || raw.surface || "daily";
  const prompt = isLearn ? raw.q : raw.prompt;
  const text = isLearn ? [raw.q, raw.a?.[raw.c ?? 0]].filter(Boolean).join(" ") : textOf(raw);
  return { id: raw.id || `candidate[${i}]`, prompt, domain, tokens: tokensOf(text) };
}

// Scores every candidate against its domain AND against its siblings. The
// sibling half is the whole point: --candidate run N times compares N
// questions to the corpus and never to each other.
//
// `siblings` is the full ranked list, `siblingHits` only the pairs at or over
// GATE. Both exist because reporting and failing are different jobs, and the
// first draft of this conflated them: two candidates written one after the
// other — "Best seat on a long train ride?" and "Best place to sit on a long
// train journey?" — score 0.455, near-twins by any reading, and printing
// nothing at all under GATE told the writer they were unrelated. The gate
// decides on the hits; the writer decides on the number. That is the same
// split the corpus half has always had, where the top neighbour prints
// whatever it scores.
export function scanBatch(entries, domains, top = 3) {
  return entries.map((c, i) => {
    const corpus = domains[c.domain];
    if (!corpus) return { c, unknown: true, near: [], siblings: [], siblingHits: [] };
    const pool = corpus;
    const siblings = entries
      // Cross-domain siblings are scored too: a run may write into more than
      // one lane, and two twins are still twins when they land on different
      // surfaces. D63 keeps cross-SURFACE corpus pairs out of the gate
      // deliberately (a daily and a feed may run one tension at different
      // depths) — but that is an editorial call about questions already
      // shipped, not a licence to write the same question twice today.
      .flatMap((o, j) => (j === i ? [] : [{ s: similarity(c.tokens, o.tokens), e: o }]))
      .sort((x, y) => y.s - x.s);
    return {
      c,
      near: rankAgainst(c.tokens, pool, top),
      siblings,
      siblingHits: siblings.filter((x) => x.s >= GATE),
    };
  });
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
  const candidate = flag("--candidate");
  const batchFile = flag("--batch");
  const domains = buildDomains();

  if (batchFile) {
    const raw = JSON.parse(readFileSync(resolve(batchFile), "utf8"));
    const entries = (Array.isArray(raw) ? raw : raw.questions || raw.cards || []).map(batchEntryOf);
    console.log(`neighbors pre-flight, batch of ${entries.length}:`);
    let failed = false;
    for (const { c, unknown, near, siblings, siblingHits } of scanBatch(entries, domains)) {
      if (unknown) {
        failed = true;
        console.log(`  ✗ ${JSON.stringify(c.prompt)} — unknown domain ${c.domain}`);
        continue;
      }
      const best = near[0];
      const kin = siblings[0];
      const over = (best && best.s >= GATE) || siblingHits.length > 0;
      if (over) failed = true;
      // The packet line the PR body wants: one question, both its top scores,
      // and what each scored against. The farm manual asks runs to cite
      // exactly this, so print it in a form that pastes — and print the
      // sibling number even when it is under the gate, because "closest in
      // this batch: 0.455" is the writer's cue to re-read, not the gate's
      // cue to fail.
      console.log(
        `  ${over ? "✗" : "✓"} ${JSON.stringify(c.prompt)} (${c.domain})  ` +
          `top ${best ? `${best.s.toFixed(3)} ${best.e.id}` : "n/a"}` +
          (kin ? ` · batch ${kin.s.toFixed(3)}` : ""),
      );
      for (const { s, e } of near.slice(1)) console.log(`      ${s.toFixed(3)}  ${e.id}  ${JSON.stringify(e.prompt)}`);
      if (kin) console.log(`      ${kin.s.toFixed(3)}  (batch)  ${JSON.stringify(kin.e.prompt)}`);
      if (best && best.s >= GATE) {
        console.log(
          `      ✗ ≥ ${GATE} against the ${c.domain} bank: ${best.e.id} ${JSON.stringify(best.e.prompt)}\n` +
            `        Rewrite or drop it — appending this would fail check:neighbors.`,
        );
      }
      for (const { s, e } of siblingHits) {
        console.log(
          `      ✗ ${s.toFixed(3)} ≥ ${GATE} against a SIBLING in this batch: ${JSON.stringify(e.prompt)}\n` +
            `        Two questions written in one run restate each other — drop one.`,
        );
      }
    }
    process.exit(failed ? 1 : 0);
  }

  if (candidate) {
    const domainName = flag("--domain") || "daily";
    const top = Number(flag("--top") || 5);
    const domain = domains[domainName];
    if (!domain) {
      console.error(`neighbors: unknown domain ${domainName} (daily|feed|duel|pick|learn)`);
      process.exit(1);
    }
    const options = (flag("--options") || "").split("|").filter(Boolean);
    const cTokens = tokensOf([candidate, ...options].join(" "));
    const pool = domain;
    console.log(`neighbors of ${JSON.stringify(candidate)} in ${domainName}:`);
    for (const { s, e } of rankAgainst(cTokens, pool, top)) {
      const mark = s >= GATE ? "  ← ≥ GATE: would fail the scan once appended" : "";
      console.log(`  ${s.toFixed(3)}  ${e.id}  ${JSON.stringify(e.prompt)}${mark}`);
    }
    process.exit(0);
  }

  // gate mode
  let failed = false;
  for (const name of ["daily", "feed", "duel", "pick", "learn"]) {
    const { hits, closest } = scanDomain(domains[name]);
    const closeLabel = closest
      ? `closest ${closest.s.toFixed(3)} (${closest.a.id} ~ ${closest.b.id})`
      : "no pairs";
    console.log(`neighbors: ${name} ${domains[name].length} questions · ${closeLabel}`);
    for (const h of hits) {
      failed = true;
      console.error(
        `  ✗ ${h.s.toFixed(3)} ≥ ${GATE}: ${h.a.id} ${JSON.stringify(h.a.prompt)} ~ ` +
          `${h.b.id} ${JSON.stringify(h.b.prompt)}\n` +
          `    Rewrite or drop one — or, if a human judges them genuinely ` +
          `different questions, record the pair in ALLOW with the reason.`,
      );
    }
  }
  process.exit(failed ? 1 : 0);
}
