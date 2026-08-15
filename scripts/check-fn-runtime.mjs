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

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
      // D157's third silent failure, read off the DEPLOYED options rather
      // than the source. A Firestore trigger binds to `(default)` unless
      // told otherwise, so a trigger that lost this option deploys green,
      // stays healthy, lets every answer write — and never fires, because
      // it is watching a database nothing writes to. Nothing errors, so
      // the alert policy (which watches for the trigger ERRORING) says
      // nothing either; the first signal is a human noticing the Mirror
      // has stopped moving.
      db: ep.eventTrigger?.eventFilters?.database,
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

// Every Firestore trigger fires on the database the deploy targets (D157).
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
    + " firebase.json deploys rules to (D157):",
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
  + `${triggers.length} Firestore trigger(s) on database ${JSON.stringify(expectedDb)}, matching firebase.json`,
);
