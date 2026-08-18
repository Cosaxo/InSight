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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every .ts/.tsx under src/, so a new call site cannot hide in a new file. */
function clientRegionFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...clientRegionFiles(full));
    else if (/\.tsx?$/.test(e.name)) out.push(full);
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
      // (D198). An array, because gen-2 endpoints can carry several.
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

const bare = rows.filter((r) => r.mem == null || r.timeout == null || r.maxInst == null);
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

// ── the client calls the region the functions are served from (D198) ──
//
// Same two-independent-files shape as the database check above, and the
// same class of silent failure: `getFunctions(app, "<region>")` builds a
// URL, and a callable in a region nothing serves is a 404 the app surfaces
// as `internal` with nothing to read. Nothing fails at build, at deploy or
// in any test that mocks the SDK — the first signal is a user tapping a
// button that does nothing.
//
// It is a live question rather than a hypothetical one: D165 moved the
// DATABASE to europe-west1 and left every function in us-central1, so the
// pair is deliberately mismatched today (D198 records why) and the two
// halves that must agree are the client and the functions — not the
// functions and the database.
const served = [...new Set(rows.flatMap((r) => r.region || []))];
const CLIENT_GLOB = /getFunctions\((?:db\.)?app, "([a-z0-9-]+)"\)/g;
const clientPins = [];
for (const rel of clientRegionFiles(resolve(root, "src"))) {
  const src = readFileSync(rel, "utf8");
  for (const m of src.matchAll(CLIENT_GLOB)) clientPins.push({ rel, region: m[1] });
}
if (!clientPins.length) {
  console.error(
    "\ncheck-fn-runtime: found no `getFunctions(app, \"region\")` call sites in src/.\n"
    + "The client stopped naming a region, or the call shape changed — fix this\n"
    + "scan rather than letting the pairing go unchecked.",
  );
  process.exit(1);
}
const strayPins = served.length === 1 ? clientPins.filter((p) => p.region !== served[0]) : [];
if (served.length !== 1) {
  console.error(
    `\nfunctions are served from ${served.length} regions (${served.join(", ")}) —`
    + " this check cannot say which one the client should call.",
  );
  process.exit(1);
}
if (strayPins.length) {
  console.error(
    `\n${strayPins.length} client call site(s) name a region the functions are not served from`
    + ` (${JSON.stringify(served[0])}):`,
  );
  for (const p of strayPins) console.error(`  - ${p.rel.slice(root.length + 1)} → ${JSON.stringify(p.region)}`);
  console.error(
    "\nA callable in a region nothing serves is a 404 the app reports as\n"
    + "`internal`. Move the functions and the client together, or not at all.",
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
  + `${clientPins.length} client call site(s) on ${JSON.stringify(served[0])}, matching the deploy`,
);
