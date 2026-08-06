#!/usr/bin/env node
// check-logic-sync.mjs — the logic generator's two copies stay byte-identical.
//
// WHY TWO COPIES EXIST. Verified logic attempts (D57) are scored
// server-side: logicSubmitV2 regenerates the form from the stored seed and
// marks the client's picks against it. That only means anything if the
// server generates EXACTLY the form the client rendered — a drifted server
// copy scores puzzles the player never saw, silently, for every player.
// The module is dependency-free by design, which is what makes a verbatim
// copy possible: src/v2/data/logic-gen.ts is the source of truth,
// functions/src/logic-gen.ts is the deployable copy (functions/tsconfig
// compiles only its own src/, so a cross-package import cannot reach the
// deploy bundle).
//
// WHY A GATE AND NOT A BUILD STEP. A build step that copies on deploy
// would leave the committed tree ambiguous about what production runs; a
// gate keeps both copies committed, reviewed, and provably equal — the
// same shape as check-catalogs holding the trigger's answer keys equal to
// the shipped catalogues. This runs in ci.yml's lint job and on the
// deploy path via backend-checks.yml, so what guards a PR guards
// production.
//
// The fix when it fires is one command, printed below.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "src/v2/data/logic-gen.ts";
const COPY = "functions/src/logic-gen.ts";

const src = readFileSync(resolve(root, SOURCE), "utf8");
const copy = readFileSync(resolve(root, COPY), "utf8");

if (src !== copy) {
  console.error(
    `check-logic-sync FAILED — ${COPY} differs from ${SOURCE}.\n`
    + `The server would score forms the client never rendered.\n`
    + `Fix: cp ${SOURCE} ${COPY}   (edit the source copy, never the functions one)`,
  );
  process.exit(1);
}
console.log(`check-logic-sync OK — ${COPY} is byte-identical to ${SOURCE} (${src.length} bytes).`);
