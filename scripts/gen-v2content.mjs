// Regenerates functions/src/v2content.ts — the launch question bank the
// v2 seed callable compiles in — from the canonical sources in /content.
//
// This is the recreated Phase-2 generator (the original lived only in
// session notes and was lost; recovery was proven by reproducing the
// committed file byte-for-byte before anything else changed). Byte
// identity IS the contract: check-content.mjs regenerates in memory and
// compares against the committed file on the deploy path, so any manual
// edit to v2content.ts, or any /content change without a regen, fails the
// gate. That only works if this script is deterministic down to the byte —
// hence the fixed property order, `JSON.stringify(…, null, 1)`, and the
// literal header below. Change any of those only together with a
// deliberate, reviewed regeneration of v2content.ts.
//
// Id scheme (stable forever — answers are immutable docs keyed by qid):
//   daily-NNN / duo-NNN      explicit "NNN" on the source entry (3 digits)
//   feed-<id> / group-<id>   explicit ids on the source entry
//   pick-<id>                the archive's own pk id, kept verbatim — the
//                            promote script copies it with the prompt, so
//                            a live pick card and its pick-data.js archive
//                            entry share one name (D14 go-live)
//   test-<key>-NN            explicit "NN" on each item in tests.json
//   lq-<lens>-<N>            explicit UNPADDED "N" on each item in
//                            lenses.json — the client minted these ids
//                            (lens-defs.js, `'lq-' + l.id + '-' + qi`)
//                            before the items had a backend, and devices
//                            hold local state keyed by them (D91)
// Every source entry MUST carry its id. The bank was positional once, and
// positional ids mean inserting mid-array re-keys every later question —
// silently attaching live immutable answers to the wrong prompt, the same
// failure class D15 refuses for catalogue keys. New entries mint the next
// free suffix deliberately; this script never invents one on its own.
//
// Modes: default = check (exit 1 if the committed file differs);
//        --write = regenerate the file (`npm run build:content`);
//        --assign-ids = one-time migration, idempotent: writes the current
//        positional suffix onto any entry that lacks an id.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(root, "content");
const OUT = join(root, "functions", "src", "v2content.ts");

// Shared by every `scale` question (daily and test surfaces). Not stored in
// the JSON sources — the 5-point agree scale is product-wide UI copy, and
// one constant here keeps 52 copies from drifting.
export const LIKERT = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];
const RATING = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
// The lens items' scale is the CLIENT's (lens-defs.js SCALE) — agree-first,
// the REVERSE of LIKERT — and stored optionIdx indexes it, which is what
// keeps world-feed's `4 - val` store inversion meaning what it means.
// Never swap LIKERT in here without swapping the client SCALE and every
// stored lens optionIdx with it.
export const LENS_SCALE = [
  "Strongly agree",
  "Agree",
  "Neutral",
  "Disagree",
  "Strongly disagree",
];

// ── continuum option synthesis (D114) ──
// A continuum answer is stored as an ordinary optionIdx (that is the whole
// design: the existing rules, fold, edit machinery and by-cells carry it
// unchanged), so the option LABELS are the answer's public face — the
// voters panel says "picked 60–64 yrs". They are synthesized from the
// question's range/plane exactly like LIKERT/RATING, so 12 copies cannot
// drift — and because a lo/hi/unit (or ax/ay) change would change these
// labels, the seed's D52 option freeze automatically freezes the range
// too, which is correct: stored answers are positions on it.
// 12 buckets: matches the demo texture's dist and sits under the fold's
// optionIdx ceiling (0..19, functions/src/v2.ts). The client quantizes
// with the same constants (world-feed.jsx dialBucket/fieldCell).
export const DIAL_BUCKETS = 12;
export const FIELD_COLS = 4;
export const FIELD_ROWS = 3;

export function dialOptions(q) {
  const span = q.hi - q.lo;
  const fmt = (v) => String(Math.round(v)) ;
  const unit = q.unit === "%" ? "%" : q.unit ? ` ${q.unit}` : "";
  return Array.from({ length: DIAL_BUCKETS }, (_, i) => {
    const a = q.lo + (span * i) / DIAL_BUCKETS;
    const b = q.lo + (span * (i + 1)) / DIAL_BUCKETS;
    return `${fmt(a)}–${fmt(b)}${unit}`;
  });
}

// Cell labels read as positions, not coordinates: "tastes bad · high art".
// Columns run ax[0]→ax[1] left to right; rows run ay[1]→ay[0] TOP to
// bottom (screen order, y = 0 at the top — the same convention the demo
// clouds use). idx = row * FIELD_COLS + col, matching the client.
export function fieldOptions(q) {
  const cols = [q.ax[0], `lean ${q.ax[0]}`, `lean ${q.ax[1]}`, q.ax[1]];
  const rows = [q.ay[1], "middle", q.ay[0]];
  const out = [];
  for (const r of rows) for (const c of cols) out.push(`${c} · ${r}`);
  return out;
}

// ── Crossroads option synthesis (D136) ──
// Same design as the continuum forms above, one step further: a walk is
// three binary forks, so its answer space is eight endings and a finished
// walk stores as an ordinary optionIdx 0..7. The labels are the ENDING
// NAMES, in PATH_ENDINGS order — so the voters panel says "picked The
// Quiet Good", which is the most legible option label in the bank.
//
// The order is the contract. It is DERIVED rather than authored — here,
// in question-quality.mjs and in the client — precisely because it has to
// be identical in three places that do not share a module: two evaluations
// of this expression cannot disagree, two transcriptions of a literal can.
// Reordering it would silently reassign every stored walk, which is what
// the seed's D52 option freeze refuses.
export const PATH_ENDINGS = ["A", "B"].flatMap((a) => ["A", "B"].flatMap((b) => ["A", "B"].map((c) => a + b + c)));

export function pathOptions(q) {
  return PATH_ENDINGS.map((k) => q.endings[k].name);
}

// Domain → committed catalogue file under public/ (D14/D15). One map, one
// home, for the same reason CONTENT_SOURCES below is one: it was born as
// two transcriptions (promote-questions.mjs and check-content.mjs) that
// agreed by luck, and a domain added to one and not the other would let a
// card promote whose gate could not see its catalogue. Both import it now.
// The SERVER's copy is functions/src/v2.ts CATALOG_DOMAINS — different
// shape (domain → compiled key module), same key set; check:catalogs walks
// the files themselves.
export const CATALOG_FILES = {
  pokemon: "pokedex.txt", emoji: "emoji.txt", elements: "elements.txt",
  countries: "countries.txt", dogs: "dogs.txt", colors: "colors.txt",
  films: "films.txt", artists: "artists.txt", athletes: "athletes.txt",
};

// Catalogue picks run their own seq lane from here (D232, amended at
// review): `feed.questions.length + i` — the first cut — renumbered every
// shipped pick doc on any feed append, mismatching the whole pick bank at
// the next reseed for nothing. A fixed base keeps a pick's seq as stable
// as its id. 1000 leaves the feed ~888 appends of headroom; check-content
// fails the build before the lanes can collide.
export const PICK_SEQ_BASE = 1000;

// The banks this generator reads, as data rather than six inline literals —
// check-content.mjs holds /content to exactly this set, so an unread file
// cannot sit there being described as content (D137). Keep it the single
// place the filenames appear.
export const CONTENT_SOURCES = {
  daily: "daily-questions.json",
  feed: "feed-questions.json",
  pick: "pick-questions.json",
  duel: "duel-questions.json",
  tests: "tests.json",
  lenses: "lenses.json",
  learn: "learn-questions.json",
  pulse: "pulse-questions.json",
  call: "call-questions.json",
  ads: "ads.json",
};

export function loadContent() {
  const load = (name) =>
    JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
  return Object.fromEntries(
    Object.entries(CONTENT_SOURCES).map(([key, file]) => [key, load(file)]),
  );
}

// Builds the entries in emission order: daily → feed → picks → group →
// duo → romantic → test → learn → pulse → call. `seq` is per-surface and
// contiguous (the romantic pool continues the duo surface's counter), with
// ONE carve-out: catalogue picks share the feed surface but run their own
// lane from PICK_SEQ_BASE (see the constant); note the test surface
// runs ONE counter across all four tests (test-political-00 has seq 10, not 0).
// Property order in each entry is load-bearing — JSON.stringify preserves
// insertion order, and the drift gate compares bytes.
// Missing ids are a hard stop, not a fallback to position — falling back
// would quietly reintroduce the re-keying hazard the ids exist to close.
function requireId(q, where) {
  if (typeof q.id !== "string" || q.id === "") {
    throw new Error(
      `${where}: entry ${JSON.stringify(q.prompt ?? "?")} has no id — ` +
        "assign the next free suffix explicitly (see the id scheme in scripts/gen-v2content.mjs)",
    );
  }
  return q.id;
}

export function buildEntries(content = loadContent()) {
  const { daily, feed, pick, duel, tests, lenses, learn, pulse, call } = content;
  const entries = [];

  // `active: false` retires an entry from serving without touching its id
  // or history (deck.ts filters `active !== false`); `political: true`
  // marks an opinion item Art. 9-adjacent so D44's no-slice set picks it
  // up (v2.ts). Both optional, emitted only when set, so the common case
  // stays byte-identical to before they existed.
  const flags = (q) => ({
    ...(q.active === false ? { active: false } : {}),
    ...(q.political === true ? { political: true } : {}),
  });

  // `cat: ["Mind", "Outlook"]` → branch + sub. Both optional for the same
  // reason the flags are: an entry with no path emits neither key.
  const branchOf = (q) => {
    const path = Array.isArray(q.cat) ? q.cat : [];
    return {
      ...(path[0] ? { branch: String(path[0]) } : {}),
      ...(path[1] ? { sub: String(path[1]) } : {}),
    };
  };

  daily.forEach((q, i) => {
    entries.push({
      id: `daily-${requireId(q, `daily-questions.json[${i}]`)}`,
      surface: "daily",
      seq: i,
      type: q.type,
      // `domain` names the catalogue key space (pokemon/films/…) the
      // aggregate trigger validates `entity` answers against (D14/D15).
      // Non-null only on the pick block's `type: "catalog"` entries below;
      // carried on every entry so the seed path transports it uniformly.
      domain: q.domain ?? null,
      prompt: q.prompt,
      // scale/rating entries carry no options in the source — the scales
      // are synthesized; everything else lists its options explicitly.
      options:
        q.options ??
        (q.type === "scale" ? LIKERT : q.type === "rating" ? RATING : []),
      topic: q.tone,
      // The Map's taxonomy, which the seed used to drop on the floor.
      // `cat` is a [branch, sub-branch] path — Mind/Outlook,
      // Morals/Honesty — and it is the only real subject grouping the
      // bank carries; `topic` above is TONE (light/deep/blend), which
      // says how heavy a question is and nothing about what it is about.
      // The demo layer reads the path straight from its own copy of the
      // bank, so nothing noticed it was missing from the seed until the
      // Mirror's Answers lens needed to filter by it (D100) and had
      // three tone buckets to offer instead of fourteen subjects.
      //
      // Emitted only when present, like `flags` above: feed, duel and
      // test entries carry no path, and writing `branch: null` onto them
      // would mismatch every stored doc and spend a full-bank rewrite on
      // a field they never use.
      ...branchOf(q),
      // The short label the source has always carried and the seed always
      // dropped — "Nature access", "Getting around" (D187). The Mirror's
      // Scores card is the prototype's scorecard: a column of nouns beside
      // one shared 0-10 baseline, which is what lets eight rows read as a
      // single shape. Drawing the prompts there instead makes it a list of
      // sentences to read one at a time, which is the same reading in a
      // form nobody scans (docs/COPY.md — visual > word > sentence).
      ...(q.tag ? { tag: String(q.tag) } : {}),
      // Which Mirror stop may fold this question into its scorecard (D187).
      // Daily-only and emitted only when set: a question that rates no
      // place carries no key, and Scores draws only what names its stop.
      ...(q.rates ? { rates: String(q.rates) } : {}),
      // The background the card's ⓘ opens (D281), emitted here since
      // D311: the feed builder below carried this exact line and this one
      // did not, so the union-level seed-fields check stayed green while
      // the daily's context texts never left the repo — the production
      // seed's own `written` count was the first thing to disagree. The
      // per-surface half of that gate exists because of this absence.
      ...(typeof q.bg === "string" && q.bg ? { bg: q.bg } : {}),
      axis: q.axis ?? null,
      test: null,
      ...flags(q),
    });
  });

  // feed.questions is already in emission order; topics/channels metadata
  // is client-only and never emitted. Demo counts on vote/duel options and
  // rank crowd/votes are dropped — live counts come from real answers (D1).
  feed.questions.forEach((q, i) => {
    entries.push({
      id: `feed-${requireId(q, `feed-questions.json[${i}]`)}`,
      surface: "feed",
      seq: i,
      type: q.type,
      domain: q.domain ?? null,
      prompt: q.prompt,
      // Continuum entries author no options — their answer space is the
      // range/plane, and the bucket labels are synthesized (D114) so the
      // twelve copies cannot drift from the lo/hi/unit (or ax/ay) they
      // describe. Everything else lists its options (or rank items).
      options:
        q.type === "dial" ? dialOptions(q)
        : q.type === "field" ? fieldOptions(q)
        : q.type === "path" ? pathOptions(q)
        : q.options ? q.options.map((o) => o.label) : q.items,
      topic: q.cat,
      axis: null,
      test: null,
      // Doors (docs/TAGS-PLAN.md §1): the topics this question ALSO belongs
      // to. Reach only, never placement — the Map, kicker and stream
      // grouping stay on `topic` above; the filter, stock, search and the
      // scorecard's demand rollup read both. Emit-when-set like the flags
      // below, and validated at check:quality (committed ids, capped,
      // disjoint from the home) so an unknown door — which fails silently,
      // the card just never matches it — cannot reach the bank.
      ...(Array.isArray(q.also) && q.also.length ? { also: q.also.map(String) } : {}),
      // The range/plane copy the client renders from — emit-when-set, like
      // flags: only continuum entries carry these.
      ...(typeof q.lo === "number" ? { lo: q.lo } : {}),
      ...(typeof q.hi === "number" ? { hi: q.hi } : {}),
      ...(typeof q.unit === "string" ? { unit: q.unit } : {}),
      ...(Array.isArray(q.ends) ? { ends: q.ends } : {}),
      ...(Array.isArray(q.ax) ? { ax: q.ax } : {}),
      ...(Array.isArray(q.ay) ? { ay: q.ay } : {}),
      // Current-events window (docs/NEXT-FUNCTIONALITY.md §1, D231): a feed
      // entry with `until` stops being SERVED after that UTC day — a
      // client-side serving filter, emit-when-set. `active: false`
      // remains the hard, server-enforced kill; answers and aggregates
      // persist either way (the archive is the product).
      //
      // `from` is the other end, and it ships for one reason: the card
      // draws the window as a draining ring, and a ring needs the WHOLE
      // to know what fraction is left. Deriving the start from the
      // provenance batch date would work in the gate and nowhere else —
      // provenance.json is a repo file that never reaches a device.
      ...(typeof q.from === "string" ? { from: q.from } : {}),
      ...(typeof q.until === "string" ? { until: q.until } : {}),
      // Background — what the card's `i` opens (D281). Facts and
      // definitions where a question cannot be answered honestly without
      // them, never the arguments: those are the reveal's job, and a
      // sentence that leans is the app taking a side on its own poll.
      //
      // The reader has existed since the port (`WF_BGTEXT`,
      // world-feed.jsx), backed by `WORLD_BG` — a demo-pool map keyed by
      // demo ids. So a live build's `i` opened onto the rows and nothing
      // else, on every card in the bank. The `now` lane is what made that
      // cost visible: a reader who does not know what Evergrande is
      // cannot answer whether a life sentence is proportionate, and the
      // one control that would have told them was the one drawn palest.
      //
      // Emit-when-set, like every other optional above, and any surface
      // may carry one — the field is about whether the question needs
      // context, which is not a property of the lane.
      ...(typeof q.bg === "string" && q.bg ? { bg: q.bg } : {}),
      // Sponsored questions (D195, docs/MONETIZATION.md path 2). A paid
      // question is an ORDINARY question with three extra facts: who
      // bought it (`buyer`), and at most one coarse audience tag the
      // DEVICE matches against its own anchors. The window is not here —
      // it is `until` above, so the card's window label and the serving
      // filter cannot drift apart.
      //
      // What is deliberately absent: any brand colour, logo, click-out or
      // creative. A sponsor buys a question and its honest split; the
      // disclosure is the app's, never the buyer's.
      ...(q.sponsor ? { sponsor: q.sponsor } : {}),
      // Core/tail (docs/SCALE-PLAN.md §1). `core: true` means the question
      // is served to EVERYONE, unpersonalized, and is therefore part of the
      // corpus the Mirror's cohort readings may fold over. Emit-when-set
      // like the flags above, and the polarity is deliberate: ABSENT MEANS
      // TAIL, so a question that forgets the flag is under-included in a
      // reading rather than silently enlarging the Mirror's corpus. Thin
      // is survivable; a split quietly drawn from a self-selected audience
      // is not, which is the whole argument of SCALE-PLAN §1.
      //
      // Feed-only on purpose. Every other surface is core BY CONSTRUCTION
      // — the daily is one globally shared question, test items are what
      // Scores and the similarity fields are computed from, duels are
      // group-scoped and never world aggregates — so none of them carries
      // the key and none of them should be read through it.
      ...(q.core === true ? { core: true } : {}),
      // A path's story — the tree the card walks and the endings it names.
      // Emit-when-set for the same reason as the continuum copy above: no
      // other feed entry carries them, and writing them as null would
      // mismatch every stored doc.
      //
      // The choice SHARES (`p`) are deliberately dropped on the way through.
      // They are the demo pool's authored crowd, and live the crowd is the
      // aggregate — the same rule that drops demo vote counts two comments
      // up (D1). What survives is the prose and the shape.
      ...(q.type === "path"
        ? {
            title: q.title,
            intro: q.intro,
            hue: q.hue,
            nodes: Object.fromEntries(
              Object.entries(q.nodes).map(([k, n]) => [k, { q: n.q, a: n.a.map((c) => ({ t: c.t })) }]),
            ),
            endings: q.endings,
          }
        : {}),
      ...flags(q),
    });
  });

  // Catalogue picks (D14 gone live): one favourite from a shipped
  // catalogue, promoted out of the pick-data.js archive by
  // promote-questions.mjs — never hand-written here (QUESTION-FARM.md's
  // one-pen rule). Same `feed` surface as the cards they ride beside —
  // splitBanks and the card renderer route on `type` — but their OWN seq
  // lane from PICK_SEQ_BASE, not the feed counter continued: a pick's seq
  // must survive feed appends the way its id does (see the constant).
  // `options` is empty by construction: the catalogue is the answer
  // space, an answer is an `entity` key, and the aggregate trigger
  // validates it against the committed catalogue the doc's `domain`
  // names (CATALOG_DOMAINS, functions/src/v2.ts). No `core` flag ever:
  // an entity answer has no option share for a cohort fold to read, so
  // a pick card is tail by construction (D161's absent-means-tail).
  (pick?.questions ?? []).forEach((q, i) => {
    entries.push({
      id: `pick-${requireId(q, `pick-questions.json[${i}]`)}`,
      surface: "feed",
      seq: PICK_SEQ_BASE + i,
      type: "catalog",
      domain: q.domain,
      prompt: q.prompt,
      options: [],
      topic: q.cat,
      axis: null,
      test: null,
      // Doors ride here exactly as on feed entries (docs/TAGS-PLAN.md §1)
      // — a pick card's home is the fav channel, so a door is how it also
      // reaches its subject's shelf.
      ...(Array.isArray(q.also) && q.also.length ? { also: q.also.map(String) } : {}),
      ...flags(q),
    });
  });

  // Group array order is deliberately interleaved (us/pick/classic) — it is
  // the rotation order. Never sort it. `pick` questions have no options
  // (the group's members are the options, filled in client-side).
  duel.group.forEach((q, i) => {
    entries.push({
      id: `group-${requireId(q, `duel-questions.json group[${i}]`)}`,
      surface: "group",
      seq: i,
      type: "choice",
      domain: null,
      prompt: q.prompt,
      options: q.options ?? [],
      topic: q.kind ?? "classic",
      axis: null,
      test: null,
    });
  });

  duel.oneVsOne.forEach((q, i) => {
    entries.push({
      id: `duo-${requireId(q, `duel-questions.json oneVsOne[${i}]`)}`,
      surface: "duo",
      seq: i,
      // Always "binary" — the duo reveal renders a two-sided comparison
      // even for the 3–4-option prompts.
      type: "binary",
      domain: null,
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
    });
  });

  // The romantic 1v1 pool (D40 part 4): same duo surface — the rules and
  // the reveal treat it identically — distinguished by `mode`, which
  // duelQFor (deck.ts) filters on so only a pair whose duo doc says
  // `duoMode: "romantic"` draws from it. Ids and seq continue the duo
  // series; the pool's own light → deep order is its rotation order.
  // Source entries carry `active: false` deliberately (see flags above):
  // a pre-mode client's duelQFor has no pool filter, so an ACTIVE romantic
  // doc would rotate into friend-pair duels — the operator activates the
  // pool in the console once the mode-aware client is the fleet, and the
  // seed never rewrites active after create.
  (duel.romantic ?? []).forEach((q, i) => {
    entries.push({
      id: `duo-${requireId(q, `duel-questions.json romantic[${i}]`)}`,
      surface: "duo",
      seq: duel.oneVsOne.length + i,
      type: "binary",
      domain: null,
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
      mode: "romantic",
      ...flags(q),
    });
  });

  let testSeq = 0;
  for (const [key, t] of Object.entries(tests)) {
    t.questions.forEach((q, i) => {
      entries.push({
        id: `test-${key}-${requireId(q, `tests.json ${key}[${i}]`)}`,
        surface: "test",
        seq: testSeq++,
        type: "scale",
        domain: null,
        prompt: q.q,
        options: LIKERT,
        topic: "test",
        axis: q.d,
        test: key,
      });
    });
  }

  // Lens items (D91, reversing D50's device-only half): the minor
  // instruments' questions are world questions now, so their counts fold
  // and publish like any other card's. Same surface ("test" — the same
  // world-answer class as the core instruments' items, and splitBanks
  // routes both to the live feed bank) and the seq counter continues the
  // tests', but `test` stays null so buildFeedGlobals keeps them out of
  // TEST_FEED_QS: the client builds lens cards from IS_LENSES
  // (lens-defs.js) and reads only counts back through LIVE.lensAgg.
  // `political` on an item routes it into D44's no-slice set — the two
  // zero-sum trade propositions carry it (D91 records the judgement).
  for (const [key, l] of Object.entries(lenses)) {
    l.questions.forEach((q, i) => {
      entries.push({
        id: `lq-${key}-${requireId(q, `lenses.json ${key}[${i}]`)}`,
        surface: "test",
        seq: testSeq++,
        type: "scale",
        domain: null,
        prompt: q.q,
        options: LENS_SCALE,
        topic: "lens",
        axis: q.d,
        test: null,
        ...flags(q),
      });
    });
  }

  // Learn cards (D32, amended at D284): the doc now carries the WHOLE card
  // — prompt, options, the field as topic, and the correctness metadata
  // `c`/`t`/`p`/`k`/`w`.
  //
  // It used to carry only the first three, and the reasoning was sound
  // for its own sentence: "nothing server-side reads correctness, and
  // '% got it right' is counts[c]/total computed on the client, WHICH
  // SHIPS c IN THE BUNDLE ANYWAY." That last clause is the part D284
  // removed. `spec/learn-data.js` imported the entire card bank into the
  // JavaScript, so every card was compiled into the app — and
  // `check:bundle` had about thirteen kilobytes left, which is thirty-nine
  // more cards. The lane's own target of 24 a field would have failed the
  // build. The bundle now carries a FIXED demo sample and the live path
  // reads the bank, so the metadata has to travel with the document.
  //
  // WHAT THIS PUBLISHES, stated rather than assumed: the learn answer key
  // is now readable in a world-readable collection. It was already
  // readable — out of the JavaScript, by anyone, since D32 — so this
  // changes the channel and not the exposure, and Learn has never claimed
  // otherwise on screen. If the product ever wants a gradeable learn
  // score, D57's logic shape is the door (the server mints, withholds and
  // marks) and this line is where that decision lands.
  //
  // `w` is emit-when-set, like every other optional in this file: most
  // cards carry no why line and writing `w: null` across the bank would
  // rewrite every learn document to say nothing.
  learn.cards.forEach((q, i) => {
    entries.push({
      id: `learn-${requireId(q, `learn-questions.json[${i}]`)}`,
      surface: "learn",
      seq: i,
      type: "choice",
      domain: null,
      prompt: q.q,
      options: q.a,
      topic: q.f,
      axis: null,
      test: null,
      c: q.c,
      t: q.t,
      p: q.p,
      k: q.k,
      ...(typeof q.w === "string" && q.w ? { w: q.w } : {}),
    });
  });

  // The daily pulse (D139): TEMPLATE docs, one per pulse question — the
  // answers are day-keyed against the template's id ({baseQid}_{day},
  // firestore.rules isPulseAnswer), so the bank holds one doc per pulse
  // question forever, never one per day. Exactly five options each (the
  // trends y-axis is the 1..5 step scale); appended last so every
  // existing surface's seq and bytes stay put.
  (pulse?.questions ?? []).forEach((q, i) => {
    entries.push({
      id: `pulse-${requireId(q, `pulse-questions.json[${i}]`)}`,
      surface: "pulse",
      seq: i,
      type: "pulse",
      domain: null,
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
      ...flags(q),
    });
  });

  // Foresight CALL, tier A (D127, docs/FORESIGHT-CALLS.md): a question
  // sealed now and graded when it resolves. Two fields ride along and both
  // are OPERATIONAL rather than copy — `resolvesAt` is the earliest UTC day
  // the resolver may grade, `rubric` is the expression it RUNS. Emitted
  // last, after pulse, so no existing surface's seq or bytes move.
  //
  // The outcome is deliberately NOT a field here: runSeedV2 diffs each
  // question against its stored payload and skips unchanged docs, so
  // writing outcomes onto content the seed believes it owns would make
  // every reseed fight the resolver (FORESIGHT-CALLS §4). It lives in
  // v2_call_outcomes, admin-written, client-unwritable.
  (call?.questions ?? []).forEach((q, i) => {
    entries.push({
      id: `call-${requireId(q, `call-questions.json[${i}]`)}`,
      surface: "call",
      seq: i,
      type: "call",
      domain: null,
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
      tier: q.tier,
      resolvesAt: q.resolvesAt,
      rubric: q.rubric,
      ...flags(q),
    });
  });

  return entries;
}

// The header is emitted verbatim, ending mid-line so the array literal from
// JSON.stringify lands on the same line as the `=`. Terminator is `;\n`.
const HEADER =
  "// GENERATED from /content/*.json by scripts/gen-v2content.mjs — do not\n" +
  "// hand-edit. Regenerate with `npm run build:content`; `npm run\n" +
  "// check:content` compares this file byte-for-byte against what /content\n" +
  "// generates, on the deploy path, so a hand edit here (or a /content\n" +
  "// change without a regen) fails the gate.\n" +
  "// Canonical launch question bank for the v2 seed callable.\n" +
  "// `active`/`political` are optional and emitted only when set: absent means\n" +
  "// active (deck.ts filters `active !== false`) and sliceable (v2.ts's D44\n" +
  "// predicate checks `political === true` alongside `test === \"political\"`).\n" +
  "// `core` is feed-only (docs/SCALE-PLAN.md §1) and absent means TAIL — a\n" +
  "// question is in the Mirror's corpus only if it says so. Other surfaces do\n" +
  "// not carry the key because they are core by construction.\n" +
  "// `branch`/`sub` are the daily bank's [branch, sub-branch] subject path\n" +
  "// (D100) and are absent on every other surface, which carries no path.\n" +
  "// `tag` is the daily bank's short label for a question — the Mirror's\n" +
  "// Scores card is a column of nouns, not of sentences (D187).\n" +
  "// `rates` is daily-only and names the Mirror stop whose scorecard may fold\n" +
  "// a question (D187): city|country|world. Absent means the question rates\n" +
  "// no place, which is every other question in the bank.\n" +
  "// `lo`/`hi`/`unit`/`ends` (dial) and `ax`/`ay` (field) are the continuum\n" +
  "// forms' range/plane copy (D114), absent everywhere else; their options\n" +
  "// are synthesized bucket/cell labels, so the D52 option freeze freezes\n" +
  "// the range with them.\n" +
  "// `domain` is non-null only on `type: \"catalog\"` (pick) entries — the\n" +
  "// catalogue key space their `entity` answers validate against (D14/D15).\n" +
  "// Pick entries carry no options: the shipped catalogue is the answer\n" +
  "// space, and they are never `core` — an entity answer has no option\n" +
  "// share for a cohort fold to read.\n" +
  "// `also` is feed/pick-only (docs/TAGS-PLAN.md, D206): the topics a\n" +
  "// question ALSO belongs to beside its `topic` home. Reach, never\n" +
  "// placement — the client's filter/stock/search read topic ∪ also, the\n" +
  "// Map and grouping stay on `topic`. Emit-when-set; never on sponsored.\n" +
  "// `sponsor` is feed-only (D195): `{ buyer, audience?, link? }` on a question\n" +
  "// somebody paid to ask. The WINDOW is `until`, not a field here, so the\n" +
  "// label the card prints and the filter that stops serving it are one\n" +
  "// value. A sponsored question is never `core` — paid questions inside\n" +
  "// the Mirror's corpus would make the honest aggregate a paid-for sample.\n" +
  "// `tier`/`resolvesAt`/`rubric` are the CALL surface's only (D194): the\n" +
  "// admitted grading path, the earliest UTC day it may be graded, and the\n" +
  "// expression the resolver RUNS. The outcome is not here — it lives in\n" +
  "// v2_call_outcomes, so a reseed and the resolver never fight.\n" +
  "export interface V2SeedQuestion { id: string; surface: string; seq: number; type: string; domain: string | null; prompt: string; options: string[]; topic: string | null; also?: string[]; branch?: string; sub?: string; tag?: string; rates?: string; axis: string | null; test: string | null; mode?: string; active?: boolean; political?: boolean; core?: boolean; from?: string; until?: string; bg?: string; c?: number; t?: number; p?: number; k?: string; w?: string; lo?: number; hi?: number; unit?: string; ends?: string[]; ax?: string[]; ay?: string[]; title?: string; intro?: string; hue?: number; nodes?: Record<string, { q: string; a: Array<{ t: string }> }>; endings?: Record<string, { name: string; line: string }>; sponsor?: { buyer: string; audience?: Record<string, string>; link?: string }; tier?: string; resolvesAt?: string; rubric?: { kind: string; qid: string; test: string; threshold?: number; dim?: string; buckets?: string[] }; }\n" +
  "export const V2_QUESTIONS: V2SeedQuestion[] = ";

// Feed ads (D197, docs/MONETIZATION.md path 3). A SEPARATE array from the
// questions, and separate is the whole point: an ad takes no answer, folds
// into no aggregate and carries no options, so putting it in the question
// bank would mean every consumer of that bank — splitBanks, the quality
// gate, the velocity ceiling, the aggregate trigger — learning to skip it.
// One collection each instead, and neither has to know about the other.
export function buildAds(content = loadContent()) {
  return (content.ads?.ads ?? []).map((a, i) => ({
    id: `ad-${requireId(a, `ads.json[${i}]`)}`,
    seq: i,
    advertiser: a.advertiser,
    headline: a.headline,
    body: a.body,
    until: a.until,
    ...(a.audience ? { audience: a.audience } : {}),
    ...(a.active === false ? { active: false } : {}),
  }));
}

const ADS_HEADER =
  "\n// Feed ads (D197) — docs/MONETIZATION.md path 3, and NOT path 2's\n" +
  "// sponsored questions. An ad takes no answer and folds into no\n" +
  "// aggregate, which is why it is a separate array and a separate\n" +
  "// collection: nothing that reads the question bank has to learn to skip\n" +
  "// it. Text only, no link, one coarse audience tag matched on the DEVICE.\n" +
  "export interface V2SeedAd { id: string; seq: number; advertiser: string; headline: string; body: string; until: string; audience?: Record<string, string>; active?: boolean; }\n" +
  "export const V2_ADS: V2SeedAd[] = ";

export function generate(content = loadContent()) {
  return HEADER + JSON.stringify(buildEntries(content), null, 1) + ";\n"
    + ADS_HEADER + JSON.stringify(buildAds(content), null, 1) + ";\n";
}

// CLI — guarded so check-content.mjs can import the builders without
// triggering a check run.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const WRITE = process.argv.includes("--write");

  if (process.argv.includes("--assign-ids")) {
    // Migration from positional to explicit ids, idempotent: only entries
    // without an id get one, and the suffix written is exactly the position
    // the entry already emits under — so the generated output (and
    // therefore v2content.ts) does not change by a byte. All three sources
    // round-trip `JSON.stringify(…, null, 2) + "\n"` losslessly (probed
    // before this mode existed), which is what makes an in-place rewrite
    // a minimal diff.
    const pad = (n, w) => String(n).padStart(w, "0");
    const withId = (q, id) => (q.id === undefined ? { id, ...q } : q);
    const rewrite = (name, transform) => {
      const path = join(CONTENT, name);
      const data = transform(JSON.parse(readFileSync(path, "utf8")));
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    };
    rewrite("daily-questions.json", (d) =>
      d.map((q, i) => withId(q, pad(i, 3))),
    );
    rewrite("duel-questions.json", (d) => ({
      ...d,
      oneVsOne: d.oneVsOne.map((q, i) => withId(q, pad(i, 3))),
    }));
    rewrite("tests.json", (tests) => {
      for (const t of Object.values(tests)) {
        t.questions = t.questions.map((q, i) => withId(q, pad(i, 2)));
      }
      return tests;
    });
    console.log(
      "gen-v2content: assigned missing ids in place — confirm with the default check mode",
    );
    process.exit(0);
  }

  let generated;
  try {
    generated = generate();
  } catch (e) {
    console.error(`gen-v2content: ${e.message}`);
    process.exit(1);
  }
  let committed = null;
  try {
    committed = readFileSync(OUT, "utf8");
  } catch {
    // Missing file: check mode fails below; write mode creates it.
  }

  if (WRITE) {
    if (generated === committed) {
      console.log(`gen-v2content: ${OUT} already up to date`);
    } else {
      writeFileSync(OUT, generated);
      console.log(
        `gen-v2content: wrote ${OUT} (${generated.length} chars) — review the diff before committing`,
      );
    }
  } else if (generated === committed) {
    console.log(
      `gen-v2content: ${OUT} in sync (${generated.length} chars)`,
    );
  } else {
    const gLines = generated.split("\n");
    const cLines = (committed ?? "").split("\n");
    let firstDiff = 0;
    while (
      firstDiff < gLines.length &&
      firstDiff < cLines.length &&
      gLines[firstDiff] === cLines[firstDiff]
    ) {
      firstDiff++;
    }
    console.error(
      `gen-v2content: ${OUT} is out of sync with /content — first difference at line ${firstDiff + 1} ` +
        `(generated ${gLines.length} lines, committed ${cLines.length}). ` +
        "Run `npm run build:content` and review the diff.",
    );
    process.exit(1);
  }
}
