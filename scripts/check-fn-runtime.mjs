// Every deployed Cloud Function must carry explicit runtime options.
//
// The gen-2 defaults are 256 MiB and 60 SECONDS. Every function here ran
// on them, which meant the full-collection aggregators hit the wall long
// before any of their in-code tripwires fired, and deleteAccount — a store
// requirement whose design deliberately refuses to delete the auth user on
// partial failure — turned a timeout into a job the user could never
// complete.
//
// The options are set globally in functions/src/ops.ts, but "we set it
// globally" is only true if ops.ts is evaluated before every function is
// defined. It is (ops.ts is imported by index/v2/v2social and imports none
// of them) — and the reason this check exists is that the natural place to
// put setGlobalOptions, index.ts, would NOT have worked: `export { x } from
// "./v2"` is a hoisted re-export, so v2's functions are defined before any
// statement in index.ts's body runs.
//
// Reads the compiled output, so run after `npm run build --prefix functions`.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { isExplicit } from "./fn-runtime-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every .ts/.tsx under src/, so a new call site cannot hide in a new file. */
function clientRegionFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...clientRegionFiles(full));
    // EVERY CLIENT SOURCE, not just the typed ones. This read `.ts`/`.tsx`
    // while `src/` holds 145 `.js`/`.jsx` files — the spec layer is almost
    // all of them — so `getFunctions(app, "europe-west1")` in any of those
    // was invisible to the one rule that exists to stop a second copy of
    // this value. Measured: the same line fails the gate in a `.ts` and
    // passes in a `.jsx`. Every call site is typed today, which is what
    // made the hole survivable and not what makes it safe.
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(full);
  }
  return out;
}
const entry = resolve(root, "functions/lib/index.js");

if (!existsSync(entry)) {
  console.error(
    `check-fn-runtime: no build at ${entry}\nRun \`npm run build --prefix functions\` first.`,
  );
  process.exit(1);
}

// Keeps the import from trying to reach the metadata server.
process.env.FUNCTIONS_EMULATOR = "true";

const mod = await import(pathToFileURL(entry).href);

const rows = [];
for (const [name, fn] of Object.entries(mod)) {
  const ep = fn?.__endpoint;
  if (ep) {
    rows.push({
      name,
      mem: ep.availableMemoryMb,
      timeout: ep.timeoutSeconds,
      concurrency: ep.concurrency,
      // The compute bill's only hard ceiling, and until it was asserted
      // here the only thing holding it up was setGlobalOptions being
      // inherited. docs/COSTS.md now quotes it as the bound on every
      // functions failure mode — a retry storm, a poison-pill redelivery
      // loop, a flood — at $649/month for one function pegged all month.
      // A per-function override that dropped it, or a future export that
      // set maxInstances: null to "scale freely", would leave that
      // paragraph asserting a ceiling that no longer exists.
      maxInst: ep.maxInstances,
      // D165's third silent failure, read off the DEPLOYED options rather
      // than the source. A Firestore trigger binds to `(default)` unless
      // told otherwise, so a trigger that lost this option deploys green,
      // stays healthy, lets every answer write — and never fires, because
      // it is watching a database nothing writes to. Nothing errors, so
      // the alert policy (which watches for the trigger ERRORING) says
      // nothing either; the first signal is a human noticing the Mirror
      // has stopped moving.
      db: ep.eventTrigger?.eventFilters?.database,
      // Where the function is SERVED, which the client has to name exactly
      // (D200). An array, because gen-2 endpoints can carry several.
      region: ep.region,
      isTrigger: !!ep.eventTrigger,
    });
  }
}

if (!rows.length) {
  console.error(
    "check-fn-runtime: found no functions with __endpoint metadata.\n"
    + "firebase-functions probably changed that internal shape — fix this\n"
    + "script rather than letting it pass vacuously.",
  );
  process.exit(1);
}

// NUMBERS, not merely "not null" — and the difference is the whole gate.
// The predicate and the reasoning behind it live in ./fn-runtime-lib.mjs,
// which exists so both can be tested: this file reads functions/lib at
// module scope, so importing it to test anything runs the whole check,
// which is why the assertion went untested and stayed unreachable.
const bare = rows.filter((r) => !isExplicit(r.mem) || !isExplicit(r.timeout) || !isExplicit(r.maxInst));
for (const r of rows) {
  console.log(
    `  ${r.name.padEnd(26)} mem=${String(r.mem).padStart(5)}MiB `
    + `timeout=${String(r.timeout).padStart(4)}s concurrency=${r.concurrency}`
    + ` maxInstances=${r.maxInst}`,
  );
}

// Every Firestore trigger fires on the database the deploy targets (D165).
//
// MEASURED, not assumed, and the measurement changed this check. Omitting
// the option does not leave `database` undefined — the SDK fills in the
// literal `"(default)"`. So an "is it set?" test is dead code, and a
// "do they agree?" test passes happily when BOTH triggers have lost it,
// which is exactly the case worth catching.
//
// The expected value is cross-read from firebase.json's deploy target
// rather than from the functions' own constant. Two independent files have
// to say the same thing, so the rules can never be deployed to one
// database while the triggers watch another.
const expectedDb = (() => {
  const cfg = JSON.parse(readFileSync(resolve(root, "firebase.json"), "utf8")).firestore;
  const entries = Array.isArray(cfg) ? cfg : [cfg];
  const ids = [...new Set(entries.map((e) => e.database || "(default)"))];
  return ids.length === 1 ? ids[0] : null;
})();
const triggers = rows.filter((r) => r.isTrigger);
const wrongDb = expectedDb ? triggers.filter((r) => (r.db || "(default)") !== expectedDb) : [];
if (expectedDb === null) {
  console.error("\nfirebase.json targets more than one Firestore database — this check cannot pick one.");
  process.exit(1);
}
if (wrongDb.length) {
  console.error(
    `\n${wrongDb.length} Firestore trigger(s) not on ${JSON.stringify(expectedDb)}, which is what`
    + " firebase.json deploys rules to (D165):",
  );
  for (const r of wrongDb) console.error(`  - ${r.name} → ${JSON.stringify(r.db || "(default)")}`);
  console.error(
    "\nAdd `database: FIRESTORE_DB_ID` to the trigger options. A trigger on the\n"
    + "wrong database deploys green, stays healthy, and never fires — nothing\n"
    + "errors, so nothing alerts, and the first signal is a human noticing the\n"
    + "Mirror has stopped moving.",
  );
  process.exit(1);
}

// ── the client calls the region the functions are served from (D200) ──
//
// Same two-independent-files shape as the database check above, and the
// same class of silent failure: `getFunctions(app, "<region>")` builds a
// URL, and a callable in a region nothing serves is a 404 the app surfaces
// as `internal` with nothing to read. Nothing fails at build, at deploy or
// in any test that mocks the SDK — the first signal is a user tapping a
// button that does nothing.
//
// It was a live mismatch when this check was written: D165 moved the
// DATABASE and left the functions where they were, and D200 measured the
// split before D201 closed it. The two halves that must agree are the
// client and the functions — not the functions and the database, which may
// legitimately differ.
//
// TWO RULES, because the constant and the literals fail differently. The
// client names its region ONCE (src/lib/region.ts, D201), so rule one is a
// single comparison against the compiled endpoints. Rule two is what keeps
// that true: any call site that goes back to spelling the region out is a
// second copy, and a second copy is how one of them ends up stale — which
// is the whole reason D201 collapsed eight of them into one.
const served = [...new Set(rows.flatMap((r) => r.region || []))];
if (served.length !== 1) {
  console.error(
    `\nfunctions are served from ${served.length} regions (${served.join(", ")}) —`
    + " this check cannot say which one the client should call.",
  );
  process.exit(1);
}

const REGION_TS = resolve(root, "src/lib/region.ts");
const clientRegion = (() => {
  const m = readFileSync(REGION_TS, "utf8").match(/export const FUNCTIONS_REGION = "([^"]+)"/);
  return m ? m[1] : null;
})();
if (!clientRegion) {
  console.error(
    "\ncheck-fn-runtime: could not read FUNCTIONS_REGION from src/lib/region.ts.\n"
    + "It was renamed or reshaped — fix this scan rather than letting the\n"
    + "client/server pairing go unchecked.",
  );
  process.exit(1);
}
if (clientRegion !== served[0]) {
  console.error(
    `\nthe client calls ${JSON.stringify(clientRegion)} and the functions are served from`
    + ` ${JSON.stringify(served[0])}.\n\n`
    + "A callable in a region nothing serves is a 404 the app reports as\n"
    + "`internal` with nothing in it to read — no build, deploy or mocked test\n"
    + "fails, and the first signal is a button that does nothing. Move\n"
    + "src/lib/region.ts and functions/src/ops.ts together, or neither.",
  );
  process.exit(1);
}

// Rule two: nobody spells it out again. Scoped to the call shape rather
// than to the string, so it catches a NEW literal in any region — the
// failure is the second copy, not the value in it.
const RELITERAL = /getFunctions\([^)]*?["']([a-z]+-[a-z]+\d|nam\d|eur\d)["']/g;
const relit = [];
for (const rel of clientRegionFiles(resolve(root, "src"))) {
  if (rel === REGION_TS) continue;
  for (const m of readFileSync(rel, "utf8").matchAll(RELITERAL)) {
    relit.push({ rel, region: m[1] });
  }
}
if (relit.length) {
  console.error(`\n${relit.length} call site(s) name a region literally instead of importing it:`);
  for (const p of relit) console.error(`  - ${p.rel.slice(root.length + 1)} → ${JSON.stringify(p.region)}`);
  console.error(
    "\nImport FUNCTIONS_REGION from src/lib/region.ts. A second copy of this\n"
    + "value is how the first one goes stale (D165 missed 37 call sites;\n"
    + "D200 found the region spelled out in eight files).",
  );
  process.exit(1);
}

if (bare.length) {
  console.error(
    `\n${bare.length} function(s) missing an explicit memory, timeout or maxInstances:`,
  );
  for (const r of bare) console.error(`  - ${r.name}`);
  console.error(
    "\nIf a new module defines functions, make sure it imports ./ops (which\n"
    + "sets the global options) before defining them.",
  );
  process.exit(1);
}

console.log(
  `\nfn-runtime OK — ${rows.length} functions, all with explicit memory, `
  + "timeout and maxInstances (the compute ceiling); "
  + `${triggers.length} Firestore trigger(s) on database ${JSON.stringify(expectedDb)}, matching firebase.json; `
  + `client on ${JSON.stringify(clientRegion)}, matching the deploy`,
);
