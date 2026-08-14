// Every callable either demands App Check attestation, or is named here
// with the reason it cannot.
//
// WHY THIS IS A GATE AND NOT A CONVENTION. App Check is the only control
// standing between the public surface and unlimited free anonymous
// accounts (D3, D10, D28). `enforceAppCheck` is a per-function option, so
// omitting it is silent: the function builds, deploys, passes every test
// and serves any caller on the internet. Six of the eleven callables carry
// it and five do not, and until this script existed nothing said which of
// those was a decision.
//
// WHAT IT CHECKS, and why not the compiled output. The natural place for
// this is check-fn-runtime.mjs, which already walks every exported function
// asserting explicit memory and timeout. It cannot work there: that script
// sets FUNCTIONS_EMULATOR=true to keep the import off the metadata server,
// and ENFORCE_APP_CHECK is *defined* as `FUNCTIONS_EMULATOR !== "true"`
// (functions/src/ops.ts), so every callable's `__endpoint.callableTrigger`
// reads `{}` under that env — enforcing and non-enforcing alike. Verified,
// not assumed. So this is a source scan.
//
// It demands the shared ENFORCE_APP_CHECK constant specifically, not merely
// the presence of the key: `enforceAppCheck: false` would satisfy a
// presence check while doing the opposite, and a hardcoded `true` would
// break every emulator suite, which is the whole reason the constant turns
// itself off there.
//
// Node stdlib only — it sits on the deploy path via backend-checks.yml,
// same discipline as check-deploy-targets and check-content.

import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "functions", "src");

// The callables that CANNOT attest, with the reason each one cannot.
//
// Both groups share a shape: they are gated on a uid allowlist held in a
// production environment variable (assertOperator → SEED_ADMIN_UIDS,
// assertModerator → MOD_UIDS, deliberately disjoint lists), and both are
// invoked from outside the app, where no App Check token exists to send.
// The allowlist is the control; attestation would refuse the only callers
// these have.
//
// This is a ratchet in both directions. Adding enforcement to one of these
// fails this script too, so the exemption cannot quietly outlive its
// reason — and it must not be added casually: the seed callable is the
// one remaining step of SHIP-CHECKLIST §1, and enforcing attestation on it
// would refuse the CI call that step is written around. (Until 2026-08-06
// that read "the console call", naming a caller that never existed — the
// app has no browser build. The exemption was right; only its stated
// caller was wrong, in all three places it was written down.)
const EXEMPT = {
  // Operator instruments (assertOperator, SEED_ADMIN_UIDS).
  seedContentV2:
    "operator callable, invoked by the Seed content workflow "
    + "(scripts/seed-content.mjs, SHIP-CHECKLIST §1) and by the e2e; "
    + "gated on SEED_ADMIN_UIDS",
  revealDuelsNowV2:
    "operator callable, the scheduled scan's manual lever (D19 rollback "
    + "runbook); gated on SEED_ADMIN_UIDS",
  fetchSuggestionsV2:
    "operator callable, invoked from the maintainer's dev session to read "
    + "the suggestion queue (docs/NEXT-FUNCTIONALITY.md §6) — no attested "
    + "app to call from; gated on SEED_ADMIN_UIDS",
  reviewSuggestionV2:
    "operator callable, the suggestion queue's verdict instrument — same "
    + "caller and same reason as fetchSuggestionsV2; gated on "
    + "SEED_ADMIN_UIDS",

  // Moderation instruments (assertModerator, MOD_UIDS). The moderation
  // Routine runs in a dedicated low-privilege environment with no repo
  // checkout and no app (docs/MODERATION.md, D22) — there is no attested
  // client for it to call from, by design, because confinement is the
  // point of that environment.
  buildModQueueNow:
    "moderator callable, invoked by the out-of-app moderation Routine; "
    + "gated on MOD_UIDS",
  fetchModQueue:
    "moderator callable, invoked by the out-of-app moderation Routine; "
    + "gated on MOD_UIDS",
  submitModVerdict:
    "moderator callable, invoked by the out-of-app moderation Routine; "
    + "gated on MOD_UIDS",
};

// `export const NAME = onCall(` followed by its options object literal.
// [^}] matches newlines, so the multi-line form (deleteAccount,
// activateDeviceV2) is covered by the same pattern. The `//` alternative
// is not decoration: deleteAccount carries a two-line comment between the
// paren and the brace, and without it that callable — the one whose
// failure mode is a job the user can never complete — was the single
// function this gate silently skipped. The site count below is what
// surfaced it.
//
// The options object is read up to its FIRST closing brace, so a nested
// object inside it would truncate the match. That fails toward noise
// rather than silence — a truncated match loses `enforceAppCheck` and the
// callable is reported as unattested — which is the direction this gate
// has to fail in.
const CALLABLE =
  /export\s+const\s+(\w+)\s*=\s*onCall\s*(?:<[^>]*>)?\s*\(\s*(?:\/\/[^\n]*\n\s*)*\{([^}]*)\}/g;

const enforcing = [];
const missing = [];
let onCallSites = 0;

// RECURSIVE, for the reason check-deploy-targets.mjs now is: a callable in a
// subdirectory is one this gate does not read, and `onCallSites` is counted
// inside this same loop — so an unread file contributes 0 to both sides of
// the cross-check below and the vacuity guard passes too.
for (const file of readdirSync(SRC, { recursive: true })
  .map((f) => String(f).split(sep).join("/"))
  .sort()) {
  if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
  const src = readFileSync(join(SRC, file), "utf8");

  // Counted separately from the matches below so a callable written in a
  // form this regex cannot read fails the run instead of being skipped.
  // check-a11y.mjs learned this the hard way: a file the gate cannot parse
  // scores zero and reports clean.
  onCallSites += (src.match(/\bonCall\s*(?:<[^>]*>)?\s*\(/g) || []).length;

  for (const [, name, opts] of src.matchAll(CALLABLE)) {
    const where = `${name} (functions/src/${file})`;
    if (/enforceAppCheck\s*:\s*ENFORCE_APP_CHECK\b/.test(opts)) {
      enforcing.push({ name, where });
    } else if (/enforceAppCheck/.test(opts)) {
      // Present but not the shared constant — the one shape that looks
      // right and is not.
      missing.push({
        name,
        where,
        note: "sets enforceAppCheck to something other than ENFORCE_APP_CHECK",
      });
    } else {
      missing.push({ name, where, note: "no enforceAppCheck" });
    }
  }
}

const found = enforcing.length + missing.length;
const errors = [];

if (found !== onCallSites) {
  errors.push(
    `read ${found} callable option blocks but found ${onCallSites} onCall(…) sites.\n`
    + "  A callable written in a form this script cannot parse is a callable it\n"
    + "  is not checking. Fix the pattern in scripts/check-appcheck.mjs.",
  );
}

const unexplained = missing.filter((m) => !(m.name in EXEMPT));
if (unexplained.length) {
  errors.push(
    "these callables neither enforce App Check nor carry an exemption:\n"
    + unexplained.map((m) => `    ${m.where} — ${m.note}`).join("\n")
    + "\n\n  Add `enforceAppCheck: ENFORCE_APP_CHECK` to the options, or — if the\n"
    + "  caller genuinely cannot attest — add it to EXEMPT in this script with\n"
    + "  the reason and the allowlist that stands in for attestation.",
  );
}

const staleExemptions = enforcing.filter((e) => e.name in EXEMPT);
if (staleExemptions.length) {
  errors.push(
    "these callables now enforce App Check but are still listed as exempt:\n"
    + staleExemptions.map((e) => `    ${e.where}`).join("\n")
    + "\n\n  Remove them from EXEMPT. An exemption that outlives its reason is a\n"
    + "  standing invitation to copy it onto the next callable.",
  );
}

const known = new Set([...enforcing, ...missing].map((c) => c.name));
const ghosts = Object.keys(EXEMPT).filter((n) => !known.has(n));
if (ghosts.length) {
  errors.push(
    `EXEMPT names callables that no longer exist: ${ghosts.join(", ")}.\n`
    + "  Delete the entries — a stale name makes the list read longer than the\n"
    + "  debt actually is.",
  );
}

for (const c of [...enforcing].sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  enforced  ${c.name}`);
}
for (const c of [...missing].sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  exempt    ${c.name}  — ${EXEMPT[c.name] ?? c.note}`);
}

if (errors.length) {
  console.error("\ncheck-appcheck FAILED:\n");
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

console.log(
  `\ncheck:appcheck OK — ${found} callables, `
  + `${enforcing.length} enforcing App Check, ${missing.length} exempt with a recorded reason`,
);
