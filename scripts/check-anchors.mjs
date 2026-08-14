// The four closed anchor vocabularies exist in two places, and the aggregate
// trigger buckets on the exact strings.
//
// WHY THIS IS A GATE. `foldAnchors` (functions/src/pure.ts) checks a value
// against BREAKDOWN_DIM_VOCAB before it may claim one of the 24 bucket slots
// in a dimension. The values a real user can send come from the <select>s the
// client renders, and since D146 there are TWO screens that render them — the
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

if (errors.length) {
  console.error("\ncheck-anchors FAILED:\n");
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

const sizes = PAIRS.map((p) => `${p.dim} ${serverVocab(p.dim).length}`).join(", ");
console.log(
  `check:anchors OK — ${PAIRS.length} closed vocabularies match the profile's `
  + `<select>s (${sizes}), all under BREAKDOWN_MAX_BUCKETS=${MAX_BUCKETS}`,
);
