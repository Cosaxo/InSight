// Validates the committed Pokédex catalogue (public/pokedex.txt) against
// the contract the `pick` picker parses it under.
//
// Deliberately does NOT regenerate from the `pokemon` package — the
// check-cities.mjs split: the source package is a one-off authoring tool,
// and what can actually break at runtime is the committed file. Everything
// the client assumes is checkable from the file alone: the line format, the
// key contiguity that keeps stored answers resolving to the right species,
// and name uniqueness so search results are unambiguous.
//
// Regeneration stays a manual step: `npm run build:pokedex`.
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(root, "public", "pokedex.txt");

let text;
try {
  text = readFileSync(FILE, "utf8");
} catch {
  console.error(`check:pokedex: ${FILE} is missing. Run \`npm run build:pokedex\`.`);
  process.exit(1);
}

const errors = [];
const lines = text.split("\n");
let headerCount = null;
let expectedDex = 1;
const seenNames = new Set();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const at = `line ${i + 1}`;
  if (line === "") {
    if (i !== lines.length - 1) errors.push(`${at}: blank line inside the file`);
    continue;
  }
  if (line.endsWith("\r")) {
    errors.push(`${at}: CRLF line ending — the parser splits on \\n only`);
    continue;
  }
  if (line.startsWith("#")) {
    const m = line.match(/# (\d+) species/);
    if (m) headerCount = Number(m[1]);
    continue;
  }
  const m = line.match(/^(\d+)\t(.+)$/);
  if (!m) {
    errors.push(`${at}: not \`dex<TAB>name\`: ${JSON.stringify(line)}`);
    continue;
  }
  const dex = Number(m[1]);
  const name = m[2];
  // Contiguity is the load-bearing check: stored answers are dex numbers,
  // so a gap or reorder here is a species silently unresolvable — or worse,
  // resolving to the wrong name.
  if (dex !== expectedDex) {
    errors.push(`${at}: dex ${dex}, expected ${expectedDex} (keys must be contiguous from 1)`);
  }
  expectedDex = dex + 1;
  if (name !== name.trim()) errors.push(`${at}: name has surrounding whitespace`);
  if (seenNames.has(name)) errors.push(`${at}: duplicate name ${JSON.stringify(name)}`);
  seenNames.add(name);
}

const count = expectedDex - 1;
if (headerCount === null) {
  errors.push("header: no `# <n> species` line to cross-check the count against");
} else if (headerCount !== count) {
  errors.push(`header says ${headerCount} species, file has ${count}`);
}

// The functions-side ceiling must agree with the committed catalogue:
// CATALOG_MAX_ENTITY (functions/src/v2.ts) is what the aggregate trigger
// validates entity keys against, so a regenerated, larger catalogue under a
// stale ceiling means new species that can be picked and never counted —
// the same silent failure class as a city that can't be a bucket key.
// COMMENT-STRIPPED, because `.match` takes the FIRST hit. A superseded
// value parked in a comment above the live `CATALOG_MAX_ENTITY` — or
// merely the constant named in its own doc-comment, which is house style
// here — pins this gate to the wrong number and the run goes green.
// Measured: with the old line left above a raised ceiling this gate
// printed its OK line and exited 0, on the DEPLOY path, while the thing
// it exists to catch (a catalogue larger than the trigger's ceiling, so
// new entries can be picked and never counted) was true.
//
// The class swept out of check-anchors, check-cities, account-level-lib
// and check-figures on 2026-09-05, and out of cost-arith tonight. These
// two were missed both times.
const FN = join(root, "functions", "src", "v2.ts");
try {
  const m = stripComments(readFileSync(FN, "utf8")).match(/CATALOG_MAX_ENTITY = (\d+)/);
  if (!m) {
    errors.push("functions/src/v2.ts: no CATALOG_MAX_ENTITY constant to cross-check");
  } else if (Number(m[1]) !== count) {
    errors.push(
      `CATALOG_MAX_ENTITY is ${m[1]} in functions/src/v2.ts, catalogue has ${count} — move them together`,
    );
  }
} catch {
  errors.push("functions/src/v2.ts unreadable — cannot cross-check CATALOG_MAX_ENTITY");
}

if (errors.length) {
  console.error(`check:pokedex: ${errors.length} problem(s) in ${FILE}`);
  for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`check:pokedex: ${count} species, keys contiguous, names unique`);
