// The four closed anchor vocabularies exist in two places, and the aggregate
// trigger buckets on the exact strings.
//
// WHY THIS IS A GATE. `foldAnchors` (functions/src/pure.ts) checks a value
// against BREAKDOWN_DIM_VOCAB before it may claim one of the 24 bucket slots
// in a dimension. The values a real user can send come from the <select>s the
// client renders, and since D151 there are TWO screens that render them — the
// profile's Basics card and the account-creation questions — both fed from
// one list module, src/v2/spec/profile-vitals.js, which is the client side
// read below. Nothing but this script holds that module and the server's
// vocabulary equal, and every way they can drift is silent:
//
//   - a label edited on the client stops matching, so that answer folds into
//     NO bucket — the answer still writes, the aggregate just never counts
//     it, and no error is raised anywhere;
//   - a value added on the client and not here is rejected the same way;
//   - a value here and not on the client is dead weight that only widens
//     what a scripted caller may send.
//
// That is not hypothetical. `Vocational / trade` shipped as an <select>
// option and was rejected by breakdownBucket for its entire life, because a
// slash is in that function's rejected character class. Nothing surfaced it.
// Rule 3 below is that bug turned into a check.
//
// AND WHY THE LENGTH RULE IS THE IMPORTANT ONE. A vocabulary SHORTER than
// BREAKDOWN_MAX_BUCKETS is what makes the dimension unexhaustible: there are
// fewer legal buckets than slots, so no caller can fill them with values that
// crowd real ones out. A vocabulary that grew past the cap would quietly
// become attackable again while every other rule here still passed.
//
// Same shape as check-cities.mjs, which holds the city catalogue to the same
// function's rules. Node stdlib only; it sits on the deploy path via
// backend-checks.yml, because the trigger it protects is deployed from there.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PURE = "functions/src/pure.ts";
const PROFILE = "src/v2/spec/profile-vitals.js";
const RULES = "firestore.rules";
const LIVE = "src/v2/data/live.ts";

const pure = readFileSync(resolve(root, PURE), "utf8");
const profile = readFileSync(resolve(root, PROFILE), "utf8");

const errors = [];

// ── the two rules pure.ts states as constants ───────────────────
function intConst(src, name, file) {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  if (!m) {
    errors.push(`${file}: could not read ${name}. Fix the pattern in this script.`);
    return null;
  }
  return Number(m[1]);
}
const MAX_BUCKETS = intConst(pure, "BREAKDOWN_MAX_BUCKETS", PURE);
const MAX_LABEL = intConst(pure, "BREAKDOWN_MAX_LABEL", PURE);

// breakdownBucket's rejected character class, read out of the function rather
// than restated — a copy here is the drift this file exists to prevent.
const classMatch = pure.match(/if \((\/\[[^\n]*?\/)\.test\(v\)\) return null;/);
if (!classMatch) {
  errors.push(`${PURE}: could not read breakdownBucket's rejected character class.`);
}
const REJECT = classMatch ? new RegExp(classMatch[1].slice(1, -1)) : null;

// ── the vocabularies, from both sides ───────────────────────────

// A bracketed array literal of single- or double-quoted strings, starting at
// `from`. Written by hand because both sides are source files rather than
// data, and neither may be imported: pure.ts is TypeScript, and this script
// runs as a plain node module outside the Vite graph the spec layer needs.
function arrayLiteralAt(src, from, what) {
  const open = src.indexOf("[", from);
  const close = src.indexOf("]", open);
  if (open === -1 || close === -1) {
    errors.push(`could not read the ${what} array. Fix the pattern in this script.`);
    return null;
  }
  const body = src.slice(open + 1, close);
  const out = [];
  for (const m of body.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
    out.push((m[1] ?? m[2]).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))).replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  if (!out.length) {
    errors.push(`the ${what} array parsed as EMPTY, which cannot be right.`);
    return null;
  }
  return out;
}

function serverVocab(dim) {
  const at = pure.indexOf(`${dim}: [`, pure.indexOf("BREAKDOWN_DIM_VOCAB"));
  if (at === -1) {
    errors.push(`${PURE}: BREAKDOWN_DIM_VOCAB has no ${dim} list.`);
    return null;
  }
  return arrayLiteralAt(pure, at, `${PURE} ${dim}`);
}

function clientVocab(name) {
  const at = profile.indexOf(`${name} = [`);
  if (at === -1) {
    errors.push(`${PROFILE}: no ${name}.`);
    return null;
  }
  return arrayLiteralAt(profile, at, `${PROFILE} ${name}`);
}

// ageBand is the only one the client does not hold as a flat list of labels:
// it derives from AGE_BANDS, whose third element is the label.
function clientAgeBands() {
  const at = profile.indexOf("AGE_BANDS = [");
  if (at === -1) {
    errors.push(`${PROFILE}: no AGE_BANDS.`);
    return null;
  }
  const close = profile.indexOf("];", at);
  const body = profile.slice(at, close);
  const out = [...body.matchAll(/\[\s*\d+\s*,\s*\d+\s*,\s*'((?:[^'\\]|\\.)*)'\s*\]/g)]
    .map((m) => m[1]);
  if (!out.length) {
    errors.push(`${PROFILE}: AGE_BANDS parsed as EMPTY, which cannot be right.`);
    return null;
  }
  return out;
}

const PAIRS = [
  { dim: "ageBand", client: clientAgeBands(), where: "AGE_BANDS" },
  { dim: "gender", client: clientVocab("GENDER_OPTS"), where: "GENDER_OPTS" },
  { dim: "education", client: clientVocab("EDU_OPTS"), where: "EDU_OPTS" },
  { dim: "relationship", client: clientVocab("REL_OPTS"), where: "REL_OPTS" },
  { dim: "heightBand", client: clientVocab("HEIGHT_OPTS"), where: "HEIGHT_OPTS" },
  // D328. The client list here is JOB_FIELDS — the derived bucket
  // vocabulary — and NOT JOB_OPTS, which is the pick and is deliberately
  // longer than the cap. Pairing the wrong one would fail rule 2 and be
  // right to: a 31-value dimension is exhaustible.
  { dim: "jobField", client: clientVocab("JOB_FIELDS"), where: "JOB_FIELDS" },
];

for (const p of PAIRS) {
  const server = serverVocab(p.dim);
  if (!server || !p.client) continue;

  // 1 · same values, same order.
  if (server.join("\u0000") !== p.client.join("\u0000")) {
    const onlyServer = server.filter((v) => !p.client.includes(v));
    const onlyClient = p.client.filter((v) => !server.includes(v));
    errors.push(
      `${p.dim}: BREAKDOWN_DIM_VOCAB and ${p.where} disagree.\n`
      + (onlyServer.length ? `    only in ${PURE}: ${JSON.stringify(onlyServer)}\n` : "")
      + (onlyClient.length ? `    only in ${PROFILE}: ${JSON.stringify(onlyClient)}\n` : "")
      + (!onlyServer.length && !onlyClient.length ? "    same values, different ORDER\n" : "")
      + "    A value the client can send and the server does not know folds\n"
      + "    into no bucket at all — the answer writes and is never counted.",
    );
  }

  // 2 · shorter than the cap. This is the rule that makes the dimension
  // unexhaustible; the others only keep it honest.
  if (MAX_BUCKETS !== null && server.length > MAX_BUCKETS) {
    errors.push(
      `${p.dim}: ${server.length} values against BREAKDOWN_MAX_BUCKETS=${MAX_BUCKETS}.\n`
      + "    A vocabulary longer than the cap can be exhausted by a caller\n"
      + "    sending legal values, which is the property closing it bought.",
    );
  }

  // 3 · every value survives breakdownBucket's own rules.
  for (const v of server) {
    if (REJECT && REJECT.test(v)) {
      errors.push(
        `${p.dim}: ${JSON.stringify(v)} contains a character breakdownBucket rejects.\n`
        + "    It would fold into no bucket. Rename it on BOTH sides.",
      );
    }
    if (MAX_LABEL !== null && v.length > MAX_LABEL) {
      errors.push(`${p.dim}: ${JSON.stringify(v)} is longer than BREAKDOWN_MAX_LABEL=${MAX_LABEL}.`);
    }
    if (v.trim() !== v || !v) {
      errors.push(`${p.dim}: ${JSON.stringify(v)} is empty or carries outer whitespace.`);
    }
    if (v in {}) {
      errors.push(`${p.dim}: ${JSON.stringify(v)} is a key on Object.prototype (see D47).`);
    }
  }

  // 4 · no duplicates — a repeated value is a slot spent twice and a sign
  // the two lists were merged by hand.
  const dupes = server.filter((v, i) => server.indexOf(v) !== i);
  if (dupes.length) errors.push(`${p.dim}: duplicate values ${JSON.stringify([...new Set(dupes)])}.`);
}

// 4b · every profession a user can PICK maps to a field the server knows.
//
// D328's pair has a failure mode the vocabulary rules above cannot see:
// JOB_OPTS and JOB_FIELDS are both individually valid while an entry in
// the first maps to nothing, or to a string absent from the second. Either
// way that person's answers fold into no jobField bucket — the silent
// non-counting this whole file exists to refuse, one level further out.
//
// `jobFieldOf` returns '' for an unmapped pick ON PURPOSE (a profile
// written before D328 holds a string nothing claims to have grouped), so
// the miss cannot be caught at runtime either. It has to be caught here.
function clientMap(name) {
  const at = profile.indexOf(`${name} = {`);
  if (at === -1) {
    errors.push(`${PROFILE}: no ${name}.`);
    return null;
  }
  const close = profile.indexOf("\n};", at);
  const body = profile.slice(at, close);
  const out = new Map();
  for (const m of body.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)) {
    out.set(m[1].replace(/\\'/g, "'"), m[2].replace(/\\'/g, "'"));
  }
  if (!out.size) {
    errors.push(`${PROFILE}: ${name} parsed as EMPTY, which cannot be right.`);
    return null;
  }
  return out;
}

const jobOpts = clientVocab("JOB_OPTS");
const jobFields = clientVocab("JOB_FIELDS");
const jobFieldOf = clientMap("JOB_FIELD_OF");
if (jobOpts && jobFields && jobFieldOf) {
  const unmapped = jobOpts.filter((o) => !jobFieldOf.has(o));
  if (unmapped.length) {
    errors.push(
      `JOB_FIELD_OF does not map ${JSON.stringify(unmapped)}.\n`
      + "    Those picks fold into no jobField bucket — the answer writes\n"
      + "    and the breakdown never counts it.",
    );
  }
  const strays = [...new Set(jobFieldOf.values())].filter((f) => !jobFields.includes(f));
  if (strays.length) {
    errors.push(
      `JOB_FIELD_OF points at ${JSON.stringify(strays)}, absent from JOB_FIELDS.\n`
      + "    breakdownBucket checks membership, so those fold into nothing.",
    );
  }
  const orphanKeys = [...jobFieldOf.keys()].filter((k) => !jobOpts.includes(k));
  if (orphanKeys.length) {
    errors.push(
      `JOB_FIELD_OF maps ${JSON.stringify(orphanKeys)}, which JOB_OPTS does not offer.\n`
      + "    Dead weight, and a sign the two lists were edited apart.",
    );
  }
  // Not an error, but the reason the pick list may grow at all: if it ever
  // becomes shorter than the cap somebody will be tempted to make it the
  // dimension, and the headroom argument needs to survive that.
  const unusedFields = jobFields.filter((f) => ![...jobFieldOf.values()].includes(f));
  if (unusedFields.length) {
    errors.push(
      `JOB_FIELDS declares ${JSON.stringify(unusedFields)}, which no pick maps to.\n`
      + "    A bucket nobody can land in is a cell that never fills.",
    );
  }
}

// 5 · the dimensions pure.ts declares closed are exactly the ones checked
// here. A fifth added to BREAKDOWN_DIM_VOCAB without a pair above would be
// enforced by the trigger and held to nothing.
const vocabBlock = pure.slice(
  pure.indexOf("BREAKDOWN_DIM_VOCAB"),
  pure.indexOf("const VOCAB_SETS"),
);
const declaredDims = [...vocabBlock.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
const unchecked = declaredDims.filter((d) => !PAIRS.some((p) => p.dim === d));
if (unchecked.length) {
  errors.push(
    `BREAKDOWN_DIM_VOCAB declares ${unchecked.join(", ")}, which this script does not check.\n`
    + "    Add the matching client list to PAIRS in scripts/check-anchors.mjs.",
  );
}
if (!declaredDims.length) {
  errors.push(`${PURE}: BREAKDOWN_DIM_VOCAB parsed as EMPTY, which cannot be right.`);
}

// ── rule 5 · the per-field LENGTH caps, rules vs client ─────────
//
// A different pair from everything above — the vocabularies are about which
// VALUES fold into a bucket; this is about how long a value may be.
//
// firestore.rules is the enforcement; ANCHOR_FIELDS in live.ts is the copy
// the client truncates to, and its own comment said the two were kept "so
// the client and the ruleset can be diffed against each other by eye". By
// eye is what every other cross-deployable number here stopped being.
//
// THE FAILURE IS SILENT AND TOTAL. saveAnchors truncates to the CLIENT's
// number, so tightening a rule below its client value means the client emits
// a string the ruleset refuses — and because the anchors map is validated as
// one object, the WHOLE profile write fails. The profile simply stops
// saving, with nothing on screen to say so. The rules suite covers three of
// the nine caps and holds them against the ruleset rather than against
// ANCHOR_FIELDS, so it cannot see a divergence at all.
//
// `age: 3` is the sharpest of the nine: widen it to 4 in live.ts and nothing
// else in the tree notices.
const rules = readFileSync(resolve(root, RULES), "utf8");
const live = readFileSync(resolve(root, LIVE), "utf8");

const ruleCaps = new Map();
for (const m of rules.matchAll(
  /isOptionalShortString\(\s*anchors\.get\(\s*"(\w+)"\s*,\s*null\s*\)\s*,\s*(\d+)\s*\)/g,
)) ruleCaps.set(m[1], Number(m[2]));

const liveBlock = live.match(/const ANCHOR_FIELDS[^=]*=\s*\{([\s\S]*?)\}/);
const liveCaps = new Map();
if (liveBlock) {
  for (const m of liveBlock[1].matchAll(/(\w+)\s*:\s*(\d+)/g)) liveCaps.set(m[1], Number(m[2]));
}

// Both scans refuse to pass on nothing — an empty match is how a gate like
// this stops meaning anything without ever failing.
if (!ruleCaps.size) {
  errors.push(
    `${RULES}: found no isOptionalShortString(anchors.get("x", null), N) calls.\n`
    + "    The ruleset's anchor validation was rewritten — fix this scan.",
  );
} else if (!liveCaps.size) {
  errors.push(
    `${LIVE}: ANCHOR_FIELDS did not parse as a { name: number } object.\n`
    + "    Fix this scan rather than letting the pair go unchecked.",
  );
} else {
  const names = [...new Set([...ruleCaps.keys(), ...liveCaps.keys()])].sort();
  for (const n of names) {
    const r = ruleCaps.get(n);
    const c = liveCaps.get(n);
    if (r === undefined) {
      errors.push(`anchor "${n}" is capped at ${c} in ${LIVE} and is not validated in ${RULES}.`);
    } else if (c === undefined) {
      errors.push(
        `anchor "${n}" is capped at ${r} in ${RULES} and is missing from ANCHOR_FIELDS in ${LIVE}.\n`
        + "    The client would not truncate it, so an over-long value fails the whole write.",
      );
    } else if (r !== c) {
      errors.push(
        `anchor "${n}" is capped at ${r} in ${RULES} and ${c} in ${LIVE}.\n`
        + (c > r
          ? "    The client truncates to a length the ruleset refuses, so the ENTIRE\n"
            + "    anchors write fails and the profile silently stops saving."
          : "    The client truncates shorter than it needs to, so a legitimate value\n"
            + "    is clipped before it is ever sent."),
      );
    }
  }
}

// ── rule 7 · every breakdown dim has its index exemption ────────
//
// WHY THIS IS HERE AND NOT A PARAGRAPH. D64 measured it: Firestore indexes
// every scalar leaf ASC and DESC by default, INCLUDING each map subfield,
// so an un-exempted anchor key costs two index entries on every answer ever
// written — for a field no query in this repo filters on. D64 cut `answers`
// from 22 index entries per write to 2 by exempting them one path at a
// time, and D140 then wrote "the anchors.heightBand index exemption (the
// D64 storage-cost regression the checklist exists to not forget)" into a
// new-dim CHECKLIST.
//
// D328 added `jobField` and skipped that line. Nothing caught it: the
// exemption is absence-shaped — a missing row is a silently BILLED index,
// never an error — and no test, gate or type reads this file. A checklist
// item that has now been forgotten once is a gate's job, so this is the
// paragraph converted.
//
// TWO LISTS, because the first cut used the wrong one. The paragraph is
// about ANCHOR KEYS — what `anchorsFrom` stamps onto every answer — and
// the gate read BREAKDOWN_DIMS, which is the set of keys the aggregate
// BREAKS DOWN by. Those overlap and are not the same: `age` and
// `profession` are written onto every answer and are not dims, so a rule
// enumerating dims could not see either. `profession` happened to carry
// its exemption already; `age` did not, and the gate reported "every
// breakdown dim carries its exemption" while every answer ever written
// paid two index entries for it. D155 added `age` and `heightBand`
// together and only one of them got a row.
//
// So: the dims are still checked (a dim that is somehow not an anchor key
// would still be a billed index), and the anchor keys are checked too,
// read off `anchorsFrom`'s own return object rather than a hand-kept
// copy — the drift every other rule in this file exists to prevent.
const INDEXES = "firestore.indexes.json";
try {
  const dimsBlock = pure.slice(
    pure.indexOf("BREAKDOWN_DIMS = ["),
    pure.indexOf("] as const;", pure.indexOf("BREAKDOWN_DIMS = [")),
  );
  const dims = [...dimsBlock.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  const idx = JSON.parse(readFileSync(resolve(root, INDEXES), "utf8"));
  const exempt = new Set(
    (idx.fieldOverrides || [])
      .filter((f) => f.collectionGroup === "answers"
        && Array.isArray(f.indexes) && f.indexes.length === 0)
      .map((f) => f.fieldPath),
  );
  // The keys `anchorsFrom` actually returns — the thing the paragraph is
  // about. Sliced from the function rather than grepped file-wide so a
  // key name appearing in a comment cannot join the list.
  const anchorsBlock = profile.slice(
    profile.indexOf("return {", profile.indexOf("function anchorsFrom")),
    profile.indexOf("\n}", profile.indexOf("function anchorsFrom")),
  );
  const anchorKeys = [...anchorsBlock.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]);
  if (!dims.length) {
    errors.push(`${PURE}: BREAKDOWN_DIMS parsed as EMPTY, which cannot be right.`);
  }
  // A parse that finds nothing must be an error, never an empty pass —
  // this rule's whole failure mode is a check that silently covers less
  // than it says. The floor is deliberately below the real count so a
  // legitimate anchor removal does not trip it, and far above zero.
  if (anchorKeys.length < 8) {
    errors.push(
      `${PROFILE}: anchorsFrom's returned keys parsed as `
      + `[${anchorKeys.join(", ")}] — too few to be right. The function was `
      + "reshaped and this rule is now checking almost nothing.",
    );
  }
  for (const key of [...new Set([...dims, ...anchorKeys])]) {
    if (!exempt.has(`anchors.${key}`)) {
      errors.push(
        `${INDEXES}: no single-field exemption for "anchors.${key}".\n`
        + "    Every anchor key is written onto every answer and filtered on by\n"
        + "    nothing, so without a `\"indexes\": []` override Firestore keeps two\n"
        + "    index entries per answer for it — D64's storage-cost regression,\n"
        + "    which is billed silently and never raises anything.",
      );
    }
  }
} catch (e) {
  errors.push(`${INDEXES}: could not be read or parsed — ${e.message}`);
}

if (errors.length) {
  console.error("\ncheck-anchors FAILED:\n");
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

const sizes = PAIRS.map((p) => `${p.dim} ${serverVocab(p.dim).length}`).join(", ");
console.log(
  `check:anchors OK — ${PAIRS.length} closed vocabularies match the profile's `
  + `<select>s (${sizes}), all under BREAKDOWN_MAX_BUCKETS=${MAX_BUCKETS}; `
  + `${ruleCaps.size} length caps agree between ${RULES} and ${LIVE}; `
  + `every anchor key and breakdown dim carries its ${INDEXES} exemption`,
);
