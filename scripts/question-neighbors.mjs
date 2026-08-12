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
// lowercase, diacritics folded, stopwords dropped, plural -s stemmed.
// Word order and phrasing furniture don't count; content words do. The
// deliberate suggestion-board twins score 1.000 and 0.667 under this
// metric while the closest legitimate in-domain pair scores 0.333
// (measured 2026-08-06 across all four domains) — a wide, stable gap, and
// the gate sits in it at GATE = 0.5.
//
// WHAT IT CANNOT MEASURE, so nobody retires the writing rule: synonym
// paraphrases ("Cats or dogs?" vs "Feline or canine?") share no tokens and
// score 0. This gate catches the lexical half of the dupe class; semantic
// dedup stays part of writing, exactly as the farm manual says.
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
// Deliberately NOT gated: suggestions.js seeds against the daily archive —
// two seeds are byte-level twins of dailies BY DESIGN (the board depicts
// the "picked → promoted" story), so gating them would red a green tree;
// the lookup mode still reports them so a writer sees the collision.
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
//     [--options "A|B|C"]          (default daily, plus the suggestion
//     [--domain daily|feed|duel|pick|learn] [--top N]   seeds when daily)
//                                  For --domain learn, pass the correct
//                                  answer alone as --options: the domain is
//                                  scored on prompt + answer, and handing it
//                                  the distractors would score the candidate
//                                  on text the corpus side deliberately drops.
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
const ALLOW = new Map([]);

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

export function tokensOf(text) {
  const norm = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // fold diacritics: Pokémon → pokemon
    .replace(/[’‘]/g, "'");
  const out = new Set();
  for (let t of norm.split(/[^a-z0-9]+/)) {
    if (!t || STOP.has(t)) continue;
    // plural fold only — real stemming over-merges short words. The 'ss'
    // guard keeps "chess"/"less" intact.
    if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
    out.add(t);
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
function textOf(q) {
  const opts = (q.options || q.items || []).map((o) =>
    o && typeof o === "object" ? o.label : o,
  );
  return [q.prompt, ...opts, ...(q.ax || []), ...(q.ay || []), ...(q.ends || [])]
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
    "window.PICK_QS = [",
    "pick-data.js",
  );
  const sugg = extractArray(
    readFileSync(join(root, "src", "v2", "spec", "suggestions.js"), "utf8"),
    "const SEED = [",
    "suggestions.js",
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
    "window.WORLD_FEED_QS = [",
    "world-feed-data.js",
  ).filter((q) => q.type === "dial" || q.type === "field");

  const entry = (id, q) => ({ id, prompt: q.prompt, tokens: tokensOf(textOf(q)) });
  // A continuum question exists in BOTH pools by design (D114): the content
  // entry is the live copy, the demo entry the same copy plus its authored
  // texture. Same id = same question, not a dupe — only demo entries the
  // content bank does not know join the domain.
  const feedIds = new Set(feed.map((q) => q.id));
  return {
    daily: specQ.map((q, i) => entry(dailyIdOf(i, dqBase), q)),
    feed: [...feed, ...continuum.filter((q) => !feedIds.has(q.id))].map((q) => entry(q.id, q)),
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
    // report-only overlay for the daily lookup, never a gated domain (the
    // header says why)
    suggestions: sugg.map((q) => entry(q.id, q)),
  };
}

export function scanDomain(list) {
  const hits = [];
  let closest = null;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const s = similarity(list[i].tokens, list[j].tokens);
      if (!closest || s > closest.s) closest = { s, a: list[i], b: list[j] };
      if (s >= GATE) {
        const key = [list[i].id, list[j].id].sort().join("~");
        if (!ALLOW.has(key)) hits.push({ s, a: list[i], b: list[j], key });
      }
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
  const domains = buildDomains();

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
    // Suggestions ride along on daily lookups: the farm's dedup rule names
    // them, they are just never gated (deliberate twins, header).
    const pool = domainName === "daily" ? [...domain, ...domains.suggestions] : domain;
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
