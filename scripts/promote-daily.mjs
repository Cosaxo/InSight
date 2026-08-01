// Promotion, productized (D30 gate two, mechanized by D36): copies
// not-yet-promoted daily questions from the spec archive
// (src/v2/spec/daily-questions.js, the holding pen) into
// content/daily-questions.json, verbatim, minting the next explicit ids.
// The farm may RUN this and open the resulting PR; a human still merges —
// the second gate becomes "merge or don't" instead of "find an hour",
// which is what keeps the never-repeat arithmetic from decaying silently.
//
// Verbatim is the contract reviewers check: this script never authors,
// never rewords (liveSync joins bank↔archive by prompt-string equality —
// a reworded promotion silently unhooks a question from the Map), never
// reorders, only appends. Default mode is a dry-run report with the
// runway arithmetic; --write applies. Run `npm run build:content`
// afterwards — check:content refuses the PR if you forget.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const CONTENT = join(root, "content", "daily-questions.json");

const spec = readFileSync(join(root, "src", "v2", "spec", "daily-questions.js"), "utf8");
const start = spec.indexOf("const Q = [");
const end = spec.indexOf("\n  ];", start);
if (start < 0 || end < 0) {
  console.error("promote-daily: Q literal not found in the spec archive");
  process.exit(1);
}
const Q = new Function("return [" + spec.slice(start + "const Q = [".length, end) + "]")();
const content = JSON.parse(readFileSync(CONTENT, "utf8"));

// Order correspondence is the invariant everything rests on: the live
// bank must be an exact prefix of the archive, prompt for prompt.
for (let i = 0; i < content.length; i++) {
  if (content[i].prompt !== Q[i].prompt) {
    console.error(
      `promote-daily: order mismatch at ${i}: content ${JSON.stringify(content[i].prompt)} vs archive ${JSON.stringify(Q[i].prompt)} — a mid-array edit happened somewhere; fix that before promoting`,
    );
    process.exit(1);
  }
}

// Runway arithmetic (D30): with the deck epoch, question idx serves on
// day epoch+idx, so runway = bank size − days elapsed.
const epochM = readFileSync(join(root, "src", "v2", "data", "deck.ts"), "utf8").match(/DECK_EPOCH = (\d+)/);
const daysElapsed = epochM
  ? Math.max(0, Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000) - Number(epochM[1]))
  : null;

const unpromoted = Q.length - content.length;
if (daysElapsed !== null) {
  console.log(
    `promote-daily: live bank ${content.length}, archive ${Q.length}, unpromoted ${unpromoted} · ` +
      `day ${daysElapsed} since epoch → ${content.length - daysElapsed} days of runway`,
  );
}
if (!unpromoted) {
  console.log("promote-daily: nothing to promote — archive and bank are level");
  process.exit(0);
}

const promoted = Q.slice(content.length).map((q, j) => {
  const e = { id: String(content.length + j).padStart(3, "0"), type: q.type, prompt: q.prompt, tag: q.tag };
  if (q.options) e.options = q.options;
  else e.axis = q.axis;
  e.tone = q.tone;
  e.cat = q.cat;
  e.alts = q.alts;
  // The farm's predicted split (D36) rides along — it is authored
  // metadata, dropped at emission, read back by the scorecard.
  if (q.pred) e.pred = q.pred;
  return e;
});

if (!WRITE) {
  console.log(
    `promote-daily: would append ids ${promoted[0].id}..${promoted[promoted.length - 1].id} — ` +
      "re-run with --write, then `npm run build:content`",
  );
  process.exit(0);
}
writeFileSync(CONTENT, JSON.stringify(content.concat(promoted), null, 2) + "\n");
console.log(
  `promote-daily: appended ${promoted.length} (ids ${promoted[0].id}..${promoted[promoted.length - 1].id}) — now run \`npm run build:content\``,
);
