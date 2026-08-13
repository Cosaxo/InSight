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

import { existsSync } from "node:fs";
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
  + "timeout and maxInstances (the compute ceiling)",
);
