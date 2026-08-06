#!/usr/bin/env node
// check-purge-listeners.mjs — every store that persists insight.* state
// must hear the purge.
//
// WHY THIS EXISTS. purgeLocalTrace (src/v2/data/live.ts) removes every
// `insight.*` localStorage key on account deletion and uid change — but
// most of those keys are mirrors of module-scope (or long-mounted
// component) state, and the stores write the WHOLE map back on their next
// mutation. So deleting the keys was only half the wipe: the in-memory
// copy survived, and one interaction resurrected the previous account's
// data under the new uid. lens-defs shipped that way — its reset() even
// carried a comment claiming the wipe contract, with no caller (D50).
//
// The fix is an announcement: purgeLocalTrace dispatches
// `insight:local-purge`, and each store drops to its fresh-boot state on
// hearing it (D51). This script is what keeps that from decaying the way
// reset() did: a NEW store that persists an insight.* key and forgets the
// listener fails here, with the fix in the error message.
//
// THE RULE. A file that both (a) calls localStorage.setItem and (b) names
// an 'insight.' key must either register an insight:local-purge listener
// or be exempted below WITH ITS REASON — the check-appcheck shape: the
// exemption list is documentation, and a stale entry (file stops matching
// the predicate) fails too, so the list cannot outlive its subjects.
//
// WHAT THIS CANNOT SEE, stated so nobody over-trusts it: that the listener
// actually drops the right state, or drops it without save()-ing the key
// straight back. That half lives in src/v2/test/purge-wipe.test.ts, which
// drives representative stores through the seed → purge → remutate cycle
// and asserts nothing old survives on disk.
//
// Run: node scripts/check-purge-listeners.mjs   (wired into CI's lint job)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Files that write insight.* keys and legitimately carry no listener.
// Every entry is a claim a reviewer can check; a file listed here that no
// longer matches the predicate fails as stale.
const EXEMPT = {
  "src/v2/data/live.ts":
    "the dispatcher itself — its caches are uid-scoped (answers cache "
    + "stores the uid) or public content (bank, aggregates), and "
    + "uidChanged() rebuilds its state before the purge runs",
  "src/v2/data/deviceBind.ts":
    "the bind memo carries the uid and activationPlan compares it before "
    + "any use — a stale memo for another uid is inert",
  "src/v2/data/push.ts":
    "the token memo carries the uid and is compared before use; a new uid "
    + "re-registers and overwrites",
  "src/lib/sentry.ts":
    "the telemetry opt-in flag is read from storage on every check — no "
    + "in-memory copy exists to go stale",
  "src/v2/spec/test-overlay.jsx":
    "saves read the progress map fresh from storage each time and touch "
    + "only their own test's entry — nothing old is spread back",
  "src/v2/data/logic-score.ts":
    "stateless helpers (D53): the result loads per mount and every save "
    + "writes a whole fresh attempt — no module-scope copy exists to go "
    + "stale or be spread back",
  "src/v2/spec/profile-general.jsx":
    "component state whose persist effect also runs on mount, so any "
    + "post-purge mount writes defaults; only an editor already open "
    + "across the uid change is exposed, and it heals on close",
  "src/v2/ui/LiveDuelPanel.tsx":
    "a single name string, read per call and written only on explicit "
    + "save of the new value",
  "src/v2/ui/LivePrivacyPanel.tsx":
    "component state seeded per mount and written only on explicit save "
    + "of the new value",
};

const dirs = ["src/v2/spec", "src/v2/ui", "src/v2/data", "src/lib"];
const files = [];
for (const d of dirs) {
  const abs = join(root, d);
  for (const f of readdirSync(abs)) {
    const p = join(abs, f);
    if (!statSync(p).isFile()) continue;
    if (!/\.(jsx?|tsx?)$/.test(f) || /\.test\.[jt]sx?$/.test(f)) continue;
    files.push(p);
  }
}

// Comments do not count — a key or listener mentioned in prose is neither.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

let failed = false;
const matched = new Set();

for (const file of files) {
  const rel = file.slice(root.length + 1);
  const src = stripComments(readFileSync(file, "utf8"));
  const writes = /localStorage\s*\.\s*setItem/.test(src);
  const insightKey = /['"]insight\./.test(src);
  if (!(writes && insightKey)) continue;
  matched.add(rel);
  const listens = src.includes("insight:local-purge");
  if (listens || EXEMPT[rel]) continue;
  failed = true;
  console.error(
    `✗ ${rel} persists insight.* state but never hears the purge.\n`
    + "    Register a listener that drops the in-memory copy to its\n"
    + "    fresh-boot state (no save() — that re-creates the purged key):\n"
    + "      window.addEventListener('insight:local-purge', () => { … });\n"
    + "    or add an EXEMPT entry in scripts/check-purge-listeners.mjs\n"
    + "    with the reason it cannot resurrect old data.",
  );
}

for (const rel of Object.keys(EXEMPT)) {
  if (!matched.has(rel)) {
    failed = true;
    console.error(
      `✗ stale exemption: ${rel} no longer writes insight.* state (or was `
      + "moved) — remove its EXEMPT entry.",
    );
  }
}

if (failed) {
  console.error("\npurge-listener check FAILED (see docs at the top of this script).");
  process.exit(1);
}
console.log(
  `purge-listener check OK — ${matched.size} files persist insight.* state: `
  + `${matched.size - Object.keys(EXEMPT).length} listen, `
  + `${Object.keys(EXEMPT).length} exempt with reasons.`,
);
