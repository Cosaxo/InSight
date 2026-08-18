// Validates the committed question bank (functions/src/v2content.ts)
// against its sources in /content, plus the invariants the seed path and
// clients assume.
//
// The load-bearing check is byte identity: v2content.ts compiles into the
// deployed seed callable, so drift between it and /content is a statement
// about production, not style — a hand edit to the generated file, or a
// /content change without a regen, ships a bank nobody reviewed. The
// generator was lost once (it lived only in session notes); regenerating in
// memory on every run is what keeps it from being lost again unnoticed.
//
// The sanity checks guard the classes of content mistake nothing else
// catches before a device does: a duplicate id silently merging two
// questions into one Firestore doc, a scale question whose options drifted
// from the 5-point agree scale the client renders, a feed question filed
// under a topic that doesn't exist, a test item keyed to a dimension its
// own test doesn't declare.
//
// Regeneration stays a deliberate step: `npm run build:content`.
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAds, buildEntries, generate, loadContent, CONTENT_SOURCES, LENS_SCALE, LIKERT, dialOptions, fieldOptions, DIAL_BUCKETS } from "./gen-v2content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "functions", "src", "v2content.ts");

let committed;
try {
  committed = readFileSync(OUT, "utf8");
} catch {
  console.error(`check:content: ${OUT} is missing. Run \`npm run build:content\`.`);
  process.exit(1);
}

const errors = [];
let content, entries;
try {
  content = loadContent();
  entries = buildEntries(content);
} catch (e) {
  // A structural error (e.g. a source entry with no id) is not a lint
  // finding to accumulate — nothing downstream is meaningful without it.
  console.error(`check:content: ${e.message}`);
  process.exit(1);
}

// ---- drift: the committed file must be exactly what /content generates.
if (generate(content) !== committed) {
  errors.push(
    "functions/src/v2content.ts differs from what /content generates — " +
      "run `npm run build:content` and review the diff",
  );
}

// ---- ids: unique across the bank, and shaped per surface. Answers are
// immutable docs keyed by qid, so a malformed or colliding id is forever.
const ID_SHAPE = {
  daily: /^daily-\d{3}$/,
  feed: /^feed-[A-Za-z0-9]+$/,
  group: /^group-[A-Za-z0-9]+$/,
  duo: /^duo-\d{3}$/,
  // Two id families share the test surface: the core instruments'
  // `test-<key>-NN`, and the lens items' `lq-<lens>-<N>` — UNPADDED,
  // because the client minted those ids before the items had a backend
  // (lens-defs.js) and devices hold local state keyed by them (D91).
  test: /^(test-[a-z0-9]+-\d{2}|lq-[a-z]+-\d{1,2})$/,
  learn: /^learn-[a-z0-9]+$/,
  // The daily pulse's TEMPLATE ids (D139). Answers are keyed
  // {baseQid}_{day} against these, so the shape is forever like all of
  // them — and it must never admit an underscore, which is the day
  // separator the rules parse on.
  pulse: /^pulse-[a-z0-9]+$/,
  // Foresight CALL ids (D194). Answers are keyed on them like every other
  // world answer, and `v2_call_outcomes` is keyed on them too — so a
  // reshaped id would orphan a published grade from the call it graded.
  call: /^call-[a-z0-9]+$/,
};
const seenIds = new Set();
for (const q of entries) {
  if (seenIds.has(q.id)) errors.push(`duplicate id ${q.id}`);
  seenIds.add(q.id);
  if (!ID_SHAPE[q.surface]) errors.push(`${q.id}: unknown surface ${JSON.stringify(q.surface)}`);
  else if (!ID_SHAPE[q.surface].test(q.id)) errors.push(`${q.id}: id does not match the ${q.surface} shape`);
}

// ---- per-surface seq contiguity (the banks sort on it).
const seqBySurface = new Map();
for (const q of entries) {
  const want = seqBySurface.get(q.surface) ?? 0;
  if (q.seq !== want) errors.push(`${q.id}: seq ${q.seq}, expected ${want} (per-surface, contiguous)`);
  seqBySurface.set(q.surface, q.seq + 1);
}

// ---- options: scales must be exactly the agree scale, ratings exactly
// 1..10; group "pick" questions are the only legitimately empty options
// (members fill them client-side); everything else needs 2..10 choices.
const RATING = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
for (const q of entries) {
  if (!q.prompt || !q.prompt.trim()) errors.push(`${q.id}: empty prompt`);
  // The current-events serving window (docs/NEXT-FUNCTIONALITY.md §1):
  // feed-only — no other surface serves by date (the daily deck is
  // positional), and the client filter compares UTC day-key strings, so
  // the shape must be exactly that.
  if (q.until !== undefined) {
    if (q.surface !== "feed") errors.push(`${q.id}: \`until\` is the feed's current-events window — no other surface carries it`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(q.until)) errors.push(`${q.id}: \`until\` must be a YYYY-MM-DD UTC day key`);
  }
  // Sponsored questions (D195). Every rule here is a promise the card
  // makes on screen, held at the source so the disclosure cannot be
  // authored away — a paid question that renders as an ordinary one is the
  // single failure this whole path has to be unable to produce.
  if (q.sponsor !== undefined) {
    const s = q.sponsor;
    if (q.surface !== "feed") {
      errors.push(`${q.id}: only feed questions can be sponsored — the daily is one shared question and the tests are instruments`);
    }
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      errors.push(`${q.id}: sponsor must be an object`);
    } else {
      const extra = Object.keys(s).filter((k) => !["buyer", "audience"].includes(k));
      if (extra.length) errors.push(`${q.id}: sponsor carries ${extra.join(", ")} — only buyer and audience. No colour, no logo, no link`);
      if (typeof s.buyer !== "string" || !s.buyer.trim()) {
        errors.push(`${q.id}: a sponsored question names its buyer — an undisclosed one is the thing this field exists to prevent`);
      } else if (s.buyer.length > 40) {
        errors.push(`${q.id}: buyer name is ${s.buyer.length} chars (max 40) — it rides in a band, not a paragraph`);
      }
      if (s.audience !== undefined) {
        if (!s.audience || typeof s.audience !== "object" || Array.isArray(s.audience)) {
          errors.push(`${q.id}: sponsor.audience must be an object of dim → bucket`);
        } else if (Object.keys(s.audience).length !== 1) {
          // One tag, always. Two compound into targeting, which is the
          // line docs/MONETIZATION.md draws and the reason a sponsored
          // question may never be narrowed to a person.
          errors.push(`${q.id}: sponsor.audience carries ${Object.keys(s.audience).length} tags — exactly one, or none`);
        }
      }
    }
    // The window is `until`, not a second field, so the label the card
    // prints and the filter that stops serving it are ONE value.
    if (typeof q.until !== "string") {
      errors.push(`${q.id}: a sponsored question carries \`until\` — a paid slot is a window, and an open-ended one is inventory nobody sold`);
    }
    // docs/SCALE-PLAN.md §5: sponsored content lives in the TAIL. A paid
    // question inside the Mirror's corpus makes the honest aggregate a
    // paid-for sample, which is the one asset MONETIZATION.md names.
    if (q.core === true) {
      errors.push(`${q.id}: a sponsored question is never core — paid questions in the Mirror's corpus make the honest aggregate a paid-for sample`);
    }
  }
  if (q.type === "scale") {
    // Lens items run the client's agree-FIRST scale (lens-defs.js SCALE):
    // stored optionIdx indexes it, and world-feed's `4 - val` store
    // inversion depends on the order. Everything else on the scale type is
    // the shared disagree-first LIKERT. Either drifting fails here.
    const want = q.id.startsWith("lq-") ? LENS_SCALE : LIKERT;
    if (!same(q.options, want)) errors.push(`${q.id}: scale options are not the 5-point agree scale`);
  } else if (q.type === "rating") {
    if (!same(q.options, RATING)) errors.push(`${q.id}: rating options are not "1".."10"`);
  } else if (q.type === "pulse") {
    // The pulse's chart maps optionIdx 0..4 onto the 1..5 step axis
    // (ui/PulseTrends), so a pulse question has EXACTLY five authored
    // steps — a 3-step pulse would silently draw on the wrong scale.
    if (q.surface !== "pulse") errors.push(`${q.id}: pulse type outside the pulse surface`);
    if (q.options.length !== 5 || q.options.some((o) => !o || !o.trim())) {
      errors.push(`${q.id}: a pulse question carries exactly five non-empty steps`);
    }
  } else if (q.surface === "pulse") {
    errors.push(`${q.id}: the pulse surface carries only pulse-type questions`);
  } else if (q.type === "call") {
    // Two options, always, and the order IS the grade: index 0 is the call
    // coming true and index 1 is it not (callRubric.ts CALL_YES/CALL_NO).
    // A third option would have no verdict to map to, and a swapped pair
    // would mark every player backwards with nothing on screen to show it.
    // The rubric's own well-formedness is check:calls' — it needs the
    // module, and this gate stays dependency-free.
    if (q.surface !== "call") errors.push(`${q.id}: call type outside the call surface`);
    if (q.options.length !== 2 || q.options.some((o) => !o || !o.trim())) {
      errors.push(`${q.id}: a call carries exactly two non-empty options — index 0 is it coming true`);
    }
    if (q.tier !== "A") errors.push(`${q.id}: tier ${JSON.stringify(q.tier)} — only tier A is admitted (D127)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(q.resolvesAt))) {
      errors.push(`${q.id}: resolvesAt must be a YYYY-MM-DD UTC day key`);
    }
  } else if (q.surface === "call") {
    errors.push(`${q.id}: the call surface carries only call-type questions`);
  } else if (q.surface === "group" && q.topic === "pick") {
    if (q.options.length !== 0) errors.push(`${q.id}: pick questions carry no options`);
  } else if (q.type === "dial" || q.type === "field") {
    // Continuum options are SYNTHESIZED bucket/cell labels (D114): a
    // stored answer's optionIdx is a position in that exact grid, so the
    // committed labels must be exactly what the range/plane produces —
    // drift here re-keys live answers, the same failure D52 freezes. The
    // 12-bucket count also has to stay under the fold's optionIdx
    // ceiling (0..19, functions/src/v2.ts drops anything above).
    if (q.surface !== "feed") errors.push(`${q.id}: ${q.type} outside the feed surface — the continuum loop is feed-only`);
    if (q.type === "dial") {
      if (!(typeof q.lo === "number" && typeof q.hi === "number" && q.lo < q.hi)) {
        errors.push(`${q.id}: dial needs numeric lo < hi`);
      } else if (!same(q.options, dialOptions(q))) {
        errors.push(`${q.id}: dial options are not the ${DIAL_BUCKETS} synthesized bucket labels for lo=${q.lo} hi=${q.hi} unit=${JSON.stringify(q.unit ?? "")}`);
      }
      if (typeof q.unit !== "string" && !Array.isArray(q.ends)) {
        errors.push(`${q.id}: dial needs a unit or end labels — something has to say what the scale measures`);
      }
    } else {
      const twoShort = (a) => Array.isArray(a) && a.length === 2 && a.every((e) => typeof e === "string" && e.trim() && e.length <= 14);
      if (!twoShort(q.ax) || !twoShort(q.ay)) {
        errors.push(`${q.id}: field needs ax/ay as two end labels each, ≤14 chars (they compose into cell labels)`);
      } else if (!same(q.options, fieldOptions(q))) {
        errors.push(`${q.id}: field options are not the synthesized cell labels for its ax/ay`);
      }
    }
  } else if (q.options.length < 2 || q.options.length > 10) {
    errors.push(`${q.id}: ${q.options.length} options (want 2..10)`);
  }
}

// ---- feed ads (D197). Every rule here is a promise the card makes on
// screen, held at the source. The refusals are BY NAME rather than by
// omission — an ad that wanted a logo would fail with the word "logo" in
// the message, which makes adding one a conversation rather than a commit.
{
  const ads = buildAds(content);
  const seenAdIds = new Set();
  const ALLOWED = ["id", "advertiser", "headline", "body", "until", "audience", "active"];
  const REFUSED = {
    image: "an image", img: "an image", logo: "a logo", brand: "a brand",
    color: "a brand colour", colour: "a brand colour", url: "a link",
    href: "a link", link: "a link", cta: "a call to action", script: "a script",
    pixel: "a tracking pixel", track: "tracking",
  };
  // THE FIELD-NAME RULES READ THE SOURCE, NOT THE BUILT OUTPUT, and that is
  // the whole reason they work. `buildAds` maps the fields it knows and
  // drops the rest, so an ad carrying a logo would arrive here already
  // stripped of it — every refusal below would pass while the source file
  // said something the app does not do. Checked against the raw entries
  // instead, so the gate sees what an author actually wrote.
  const rawAds = content.ads?.ads ?? [];
  rawAds.forEach((raw, i) => {
    const at = `ads.json[${i}]${raw?.id ? ` (${raw.id})` : ""}`;
    for (const k of Object.keys(raw ?? {})) {
      if (ALLOWED.includes(k)) continue;
      const why = REFUSED[k.toLowerCase()];
      errors.push(
        why
          ? `${at}: an ad carries no ${k} — text only (D197), and ${why} is refused BY NAME rather than forgotten`
          : `${at}: unknown ad field ${JSON.stringify(k)}`,
      );
    }
  });
  for (const a of ads) {
    if (seenAdIds.has(a.id)) errors.push(`duplicate ad id ${a.id}`);
    seenAdIds.add(a.id);
    if (!/^ad-[a-z0-9]+$/.test(a.id)) errors.push(`${a.id}: ad id does not match ad-<id>`);
    for (const [k, cap] of [["advertiser", 40], ["headline", 70], ["body", 140]]) {
      const v = a[k];
      if (typeof v !== "string" || !v.trim()) errors.push(`${a.id}: ad needs a non-empty ${k}`);
      else if (v.length > cap) errors.push(`${a.id}: ${k} is ${v.length} chars (max ${cap})`);
      // A link cannot arrive through the prose either — the card renders
      // text, so a URL in it would be a link the app does not make tappable
      // and the reader would type by hand. That is a worse click-out, not a
      // clever one.
      else if (/https?:\/\/|www\.|\.com\b|\.no\b/i.test(v)) {
        errors.push(`${a.id}: ${k} carries a web address — an ad card has no tap-through (D197), and a typed-out one is a worse click-out rather than a clever one`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.until))) {
      errors.push(`${a.id}: an ad carries \`until\` as a YYYY-MM-DD UTC day — a slot with no window is inventory nobody sold`);
    }
    if (a.audience !== undefined) {
      if (!a.audience || typeof a.audience !== "object" || Array.isArray(a.audience)) {
        errors.push(`${a.id}: audience must be an object of dim → bucket`);
      } else if (Object.keys(a.audience).length !== 1) {
        errors.push(`${a.id}: audience carries ${Object.keys(a.audience).length} tags — exactly one, or none`);
      }
    }
  }
  // Ads and questions share one id space in the reader's head, and one
  // slot in the feed. A collision would be confusing rather than harmful,
  // which is exactly the kind of thing that survives to production.
  for (const a of ads) if (seenIds.has(a.id)) errors.push(`${a.id}: an ad and a question share an id`);
}

// ---- duplicate prompts within a surface read as the same question twice.
const promptsBySurface = new Map();
for (const q of entries) {
  const key = `${q.surface}\u0000${q.prompt}`;
  if (promptsBySurface.has(key)) {
    errors.push(`${q.id}: duplicate prompt within ${q.surface} (also ${promptsBySurface.get(key)})`);
  }
  promptsBySurface.set(key, q.id);
}

// ---- feed topics must exist in the taxonomy the client renders.
const topicIds = new Set(content.feed.topics.map((t) => t.id));
for (const q of entries) {
  if (q.surface === "feed" && !topicIds.has(q.topic)) {
    errors.push(`${q.id}: feed topic ${JSON.stringify(q.topic)} not in feed-questions.json topics`);
  }
}

// ---- domain travels only on catalog questions: it names the key space
// the aggregate trigger validates `entity` answers against, so a domain on
// a vote question (or a catalog question without one) is a wiring mistake.
for (const q of entries) {
  if (q.type === "catalog" && (typeof q.domain !== "string" || !q.domain)) {
    errors.push(`${q.id}: catalog question without a domain`);
  } else if (q.type !== "catalog" && q.domain !== null) {
    errors.push(`${q.id}: domain ${JSON.stringify(q.domain)} on a non-catalog question`);
  }
}

// ---- group kinds are a closed set (the reveal renders each differently).
for (const q of entries) {
  if (q.surface === "group" && !["us", "pick", "classic"].includes(q.topic)) {
    errors.push(`${q.id}: group kind ${JSON.stringify(q.topic)} not us/pick/classic`);
  }
}

// ---- test items must score against a dimension their test declares.
for (const [key, t] of Object.entries(content.tests)) {
  const dims = new Set(t.dims.map((d) => d.id));
  for (const q of entries) {
    if (q.test === key && !dims.has(q.axis)) {
      errors.push(`${q.id}: axis ${JSON.stringify(q.axis)} not a ${key} dimension`);
    }
  }
}

// ---- lens items the same way: the axis names the dimension the CLIENT
// scores the answer against (lens-defs.js), so a d/axis typo ships an item
// no lens can hear. lenses.json declares its dims for exactly this check;
// lens-content.test.ts binds the whole file to IS_LENSES, dims included.
for (const [key, l] of Object.entries(content.lenses)) {
  const dims = new Set(l.dims.map((d) => d.id));
  for (const q of entries) {
    if (q.id.startsWith(`lq-${key}-`) && !dims.has(q.axis)) {
      errors.push(`${q.id}: axis ${JSON.stringify(q.axis)} not a ${key} dimension`);
    }
  }
}

// ---- learn cards: the client-side correctness metadata never reaches the
// server doc, so this is the only gate that sees it. A c/t mistake ships a
// card that teaches the wrong answer; an unknown field orphans the card
// from every follow list and level.
{
  const fieldIds = new Set(content.learn.fields.map((f) => f.id));
  const subjIds = new Set(content.learn.subjects.map((s) => s.id));
  for (const f of content.learn.fields) {
    if (!subjIds.has(f.subject)) errors.push(`learn field ${f.id}: unknown subject ${JSON.stringify(f.subject)}`);
  }
  for (const card of content.learn.cards) {
    const at = `learn card ${card.id ?? "?"}`;
    if (!fieldIds.has(card.f)) errors.push(`${at}: unknown field ${JSON.stringify(card.f)}`);
    if (!Array.isArray(card.a) || card.a.length !== 4) errors.push(`${at}: needs exactly 4 options`);
    else {
      if (!(card.c >= 0 && card.c < 4)) errors.push(`${at}: correct index ${card.c} out of range`);
      if (!(card.t >= 0 && card.t < 4)) errors.push(`${at}: trap index ${card.t} out of range`);
      if (card.c === card.t) errors.push(`${at}: the trap IS the correct answer`);
    }
    if (!(card.p >= 1 && card.p <= 99)) errors.push(`${at}: p ${card.p} outside 1..99`);
    // "the fact in three words" is the doc's aspiration; the shipped bank
    // runs 2..6 — bound it there so the map labels stay label-sized.
    const kw = String(card.k ?? "").trim().split(/\s+/).filter(Boolean).length;
    if (kw < 2 || kw > 6) errors.push(`${at}: k is ${kw} words (want 2..6)`);
  }
}

// ---- every file in /content is accounted for.
//
// The generator names the six banks it loads, so a file nobody loads is
// invisible here — it just sits, and the README describes it as content.
// `archetypes.json` did exactly that (D137): 12 KB read by no script and no
// source, whose live counterpart is `src/v2/spec/archetype-data.js`, and the
// two had diverged to different names in nearly every slot. That is worse
// than dead weight — /content is documented as the source of truth, so
// editing the stale copy looks like changing the app and changes nothing.
//
// The rule: a .json here is a generator input, or it is listed below WITH
// its reason. A stale entry fails too (listed but absent, or listed and
// loaded anyway), the check-purge-listeners shape, so the list cannot
// outlive its subjects.
const NOT_SEEDED = {
  "provenance.json":
    "measurement metadata, not content — who wrote each question and in "
    + "which vintage (D97); read by check:quality and the scorecard rollup",
  "scorecard.json":
    "generated measurement output, read by the scorecard renderer; never "
    + "an input to the bank",
};

const contentFiles = readdirSync(join(root, "content"))
  .filter((f) => f.endsWith(".json"));
const loaded = new Set(Object.values(CONTENT_SOURCES));
for (const f of contentFiles) {
  if (loaded.has(f) || NOT_SEEDED[f]) continue;
  errors.push(
    `content/${f} is read by nothing — not a generator input, not listed in `
    + "NOT_SEEDED. Either wire it up, or delete it and its README row: an "
    + "unread file under /content reads as content and is not.",
  );
}
for (const [f, why] of Object.entries(NOT_SEEDED)) {
  if (!contentFiles.includes(f)) {
    errors.push(`NOT_SEEDED lists content/${f} ("${why}") but the file is gone — drop the entry`);
  } else if (loaded.has(f)) {
    errors.push(`NOT_SEEDED lists content/${f} as never seeded, but the generator loads it — drop the entry`);
  }
}

if (errors.length) {
  console.error(`check:content: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
  process.exit(1);
}

const counts = {};
for (const q of entries) counts[q.surface] = (counts[q.surface] ?? 0) + 1;
console.log(
  `check:content: v2content.ts in sync — ${entries.length} questions (` +
    Object.entries(counts).map(([s, n]) => `${s} ${n}`).join(" · ") +
    ")",
);
