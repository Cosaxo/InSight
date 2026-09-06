// Every callable either demands App Check attestation, or is named here
// with the reason it cannot.
//
// WHY THIS IS A GATE AND NOT A CONVENTION. App Check is the only control
// standing between the public surface and unlimited free anonymous
// accounts (D3, D10, D28). `enforceAppCheck` is a per-function option, so
// omitting it is silent: the function builds, deploys, passes every test
// and serves any caller on the internet. When this script was written six of
// eleven callables carried it and five did not, and nothing said which of
// those was a decision. The census has more than doubled since; the run
// prints the live one, and no number is restated here — this header said
// "six of the eleven" against a tree with twenty-six for long enough to be
// wrong by more than it was ever right.
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
import { stripComments } from "./strip-comments.mjs";
import { checkAppCheckPolarity, checkAppCheckProvenance } from "./appcheck-polarity.mjs";

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
// Each entry carries the `gate` its reason NAMES, and the run asserts the
// callable's body actually calls it. Until it did, the reason was prose the
// script printed and never read: it announced, as an OK line on the DEPLOY
// path, that seedContentV2 was "gated on SEED_ADMIN_UIDS" while checking
// only that the callable did not enforce App Check. Delete the
// assertOperator line from that function — the one that rewrites the whole
// question bank — and this gate went on saying it was protected.
const EXEMPT = {
  // Operator instruments (assertOperator, SEED_ADMIN_UIDS).
  seedContentV2: {
    gate: "assertOperator",
    reason:
      "operator callable, invoked by the Seed content workflow "
      + "(scripts/seed-content.mjs, SHIP-CHECKLIST §1) and by the e2e; "
      + "gated on SEED_ADMIN_UIDS",
  },
  revealDuelsNowV2: {
    gate: "assertOperator",
    reason:
      "operator callable, the scheduled scan's manual lever (D19 rollback "
      + "runbook); gated on SEED_ADMIN_UIDS",
  },
  fetchSuggestionsV2: {
    gate: "assertOperator",
    reason:
      "operator callable, invoked from the maintainer's dev session to read "
      + "the suggestion queue (docs/NEXT-FUNCTIONALITY.md §6) — no attested "
      + "app to call from; gated on SEED_ADMIN_UIDS",
  },
  reviewSuggestionV2: {
    gate: "assertOperator",
    reason:
      "operator callable, the suggestion queue's verdict instrument — same "
      + "caller and same reason as fetchSuggestionsV2; gated on "
      + "SEED_ADMIN_UIDS",
  },
  rebuildAggregateV2: {
    gate: "assertOperator",
    reason:
      "operator callable, D290's replay tool — rebuilds a question's "
      + "aggregate from the answers, reached from a console or "
      + "scripts/rebuild-aggregate.mjs during a D28 correction; no attested "
      + "app can run a repair, and a control that fails when it is most "
      + "needed is not a control; gated on SEED_ADMIN_UIDS",
  },

  // Moderation instruments (assertModerator, MOD_UIDS). The moderation
  // Routine runs in a dedicated low-privilege environment with no repo
  // checkout and no app (docs/MODERATION.md, D22) — there is no attested
  // client for it to call from, by design, because confinement is the
  // point of that environment.
  buildModQueueNow: {
    gate: "assertModerator",
    reason:
      "moderator callable, invoked by the out-of-app moderation Routine; "
      + "gated on MOD_UIDS",
  },
  fetchModQueue: {
    gate: "assertModerator",
    reason:
      "moderator callable, invoked by the out-of-app moderation Routine; "
      + "gated on MOD_UIDS",
  },
  submitModVerdict: {
    gate: "assertModerator",
    reason:
      "moderator callable, invoked by the out-of-app moderation Routine; "
      + "gated on MOD_UIDS",
  },
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


/**
 * Every callable declared in ONE source file, with whether it enforces
 * attestation and the body text its exemption is checked against.
 *
 * EXPORTED, and pure, because until check-appcheck.test.mjs there was no
 * test for this gate at all — and this gate is the only thing standing
 * between the public callable surface and unlimited free anonymous
 * accounts. Its own header records the failure it was written for and a
 * second one it shipped with; neither could be caught by anything but a
 * probe against the real tree, which is a thing nobody runs twice.
 *
 * `onCallSites` is counted separately from the parsed blocks on purpose:
 * a callable written in a form the pattern cannot read must FAIL the run,
 * not be skipped (check-a11y.mjs learned this the hard way — a file the
 * gate could not parse scored zero and reported clean).
 *
 * Takes source that has already had its comments blanked; see the caller.
 */
export function scanCallables(src, file = "") {
  const enforcing = [];
  const missing = [];
  const bodies = new Map();
  const onCallSites = (src.match(/\bonCall\s*(?:<[^>]*>)?\s*\(/g) || []).length;
  for (const m of src.matchAll(CALLABLE)) {
    const [, name, opts] = m;
    const where = file ? `${name} (functions/src/${file})` : name;
    // The callable's own body, for the exemption check: from this match to
    // the next top-level declaration, or the end of the file. Coarse on
    // purpose — it only ever answers "does this function call its gate",
    // and erring long is the safe direction for a question whose wrong
    // answer is a false ACCUSATION rather than a false clearance.
    const rest = src.slice(m.index);
    const next = rest.slice(1).search(/\n(?:export\s+)?const\s+\w+\s*=/);
    bodies.set(name, next === -1 ? rest : rest.slice(0, next + 1));
    if (/enforceAppCheck\s*:\s*ENFORCE_APP_CHECK\b/.test(opts)) {
      // …unless a spread comes AFTER it. Object literals take the last
      // writer, so `{ enforceAppCheck: ENFORCE_APP_CHECK, ...OPTS }` reads
      // correct to the regex above and enforces whatever OPTS says. Every
      // call site today spreads first (`{ ...LIGHT_CALLABLE, region,
      // enforceAppCheck: ENFORCE_APP_CHECK }`), which is the safe order, so
      // this refuses a shape that does not exist rather than describing one
      // that does.
      //
      // Re-applied inside `scanCallables` when the two night shifts were
      // composed: shift A extracted this loop into a pure function and gave
      // it a test, shift B added this rule to the loop's old home, and the
      // merge conflicted. Their structure is the better one and it is the
      // one that survived; this rule belongs inside it.
      const at = opts.search(/enforceAppCheck\s*:/);
      if (/\.\.\./.test(opts.slice(at))) {
        missing.push({
          name,
          where,
          note: "spreads another options object AFTER enforceAppCheck, which wins",
        });
      } else {
        enforcing.push({ name, where });
      }
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
  return { enforcing, missing, bodies, onCallSites };
}

const enforcing = [];
const missing = [];
// name -> source text of the callable, for the exemption gate check.
const bodies = new Map();
let onCallSites = 0;

// RECURSIVE, for the reason check-deploy-targets.mjs now is: a callable in a
// subdirectory is one this gate does not read, and `onCallSites` is counted
// inside this same loop — so an unread file contributes 0 to both sides of
// the cross-check below and the vacuity guard passes too.
for (const file of readdirSync(SRC, { recursive: true })
  .map((f) => String(f).split(sep).join("/"))
  .sort()) {
  if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
  // COMMENTS BLANKED FIRST, and this is the half of the gate below that
  // was missing rather than a tidy-up.
  //
  // The exemption check asks "does this callable call its allowlist gate"
  // with a plain regex over the raw source, so `// assertOperator(request);`
  // answered yes. Verified by probe on this tree: commenting out that one
  // line in seedContentV2 — the callable that rewrites the entire question
  // bank — left this gate green, which is verbatim the failure its own
  // header says it exists to prevent ("Removing assertOperator from
  // seedContentV2 left every gate in the repo green"). It closed the hole
  // for a DELETED line and not for a commented one, and a comment is how
  // that line actually goes away: somebody runs the seed against a local
  // emulator without an allowlisted uid and the comment survives the PR.
  //
  // Blanking rather than deleting, so every index and line number below
  // still points at the real file. It was a local copy of spec-globals.mjs's
  // `stripComments` for a good reason — this gate runs on
  // backend-checks.yml, which firebase-deploy.yml calls, and that module
  // scans the whole client spec layer at import time, so a deploy gate must
  // not import it. `strip-comments.mjs` is that reason answered rather than
  // worked around: it does no top-level work at all, so importing it cannot
  // fail because src/v2/spec moved.
  const src = stripComments(readFileSync(join(SRC, file), "utf8"));

  const one = scanCallables(src, file);
  enforcing.push(...one.enforcing);
  missing.push(...one.missing);
  for (const [k, v] of one.bodies) bodies.set(k, v);
  onCallSites += one.onCallSites;
}

/**
 * The gate's verdict: every problem it can report, as strings.
 *
 * EXPORTED and parameterised on the exemption table so a test can drive
 * it without the real tree — the four rules below all fail SILENTLY when
 * they stop working, because each one narrows a list and an empty list is
 * what "no problems" looks like.
 */
export function appCheckProblems({ enforcing, missing, bodies, onCallSites }, exempt) {
const found = enforcing.length + missing.length;
const errors = [];

// THE CONSTANT ITSELF, not just its name at the call sites.
//
// Everything above proves 20 callables all defer to `ENFORCE_APP_CHECK`.
// None of it asks what that value is, so flipping the escape hatch in
// ops.ts from opt-out to opt-in left this script printing "20 enforcing"
// while production attested nothing. Verified by mutation; see
// scripts/appcheck-polarity.mjs for why it is a truth table and not a
// string match.
errors.push(...checkAppCheckPolarity(readFileSync(join(SRC, "ops.ts"), "utf8")));

// …and that every callable is deferring to THAT constant. The two checks
// above are one indirection apart — this one matches the NAME at the call
// site, that one grades the VALUE in ops.ts — and nothing joined them, so a
// file that dropped the import and declared its own `const
// ENFORCE_APP_CHECK = false` was tsc-clean and left this script printing
// "20 enforcing". Measured against deviceBind.ts, restored after.
errors.push(...checkAppCheckProvenance(
  Object.fromEntries(
    readdirSync(SRC)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => [`functions/src/${f}`, readFileSync(join(SRC, f), "utf8")]),
  ),
));

if (found !== onCallSites) {
  errors.push(
    `read ${found} callable option blocks but found ${onCallSites} onCall(…) sites.\n`
    + "  A callable written in a form this script cannot parse is a callable it\n"
    + "  is not checking. Fix the pattern in scripts/check-appcheck.mjs.",
  );
}

const unexplained = missing.filter((m) => !(m.name in exempt));
if (unexplained.length) {
  errors.push(
    "these callables neither enforce App Check nor carry an exemption:\n"
    + unexplained.map((m) => `    ${m.where} — ${m.note}`).join("\n")
    + "\n\n  Add `enforceAppCheck: ENFORCE_APP_CHECK` to the options, or — if the\n"
    + "  caller genuinely cannot attest — add it to EXEMPT in this script with\n"
    + "  the reason and the allowlist that stands in for attestation.",
  );
}

const staleExemptions = enforcing.filter((e) => e.name in exempt);
if (staleExemptions.length) {
  errors.push(
    "these callables now enforce App Check but are still listed as exempt:\n"
    + staleExemptions.map((e) => `    ${e.where}`).join("\n")
    + "\n\n  Remove them from EXEMPT. An exemption that outlives its reason is a\n"
    + "  standing invitation to copy it onto the next callable.",
  );
}

// The exemption's own claim, checked rather than printed.
//
// Every entry above says the callable is "gated on SEED_ADMIN_UIDS" or "on
// MOD_UIDS". That sentence was the whole justification for skipping
// attestation on the DEPLOY path, and nothing read it: this script only ever
// confirmed the callable did NOT enforce App Check, which is the half that
// is true by construction for anything in this list. So the one control
// standing between seven callables and the open internet was asserted by
// prose. Removing assertOperator from seedContentV2 — the callable that
// rewrites the question bank — left every gate in the repo green.
const ungated = missing
  .filter((c) => c.name in exempt)
  .filter((c) => {
    const { gate } = exempt[c.name];
    const body = bodies.get(c.name) || "";
    return !new RegExp(`\\b${gate}\\s*\\(`).test(body);
  });
if (ungated.length) {
  errors.push(
    "these callables are exempt from App Check but do not call the gate\n"
    + "  their exemption names:\n"
    + ungated.map((c) => `    ${c.where} — expected ${exempt[c.name].gate}(…)`).join("\n")
    + "\n\n  An exemption is only as good as the allowlist that replaces\n"
    + "  attestation. If the gate moved, update EXEMPT; if it went, this\n"
    + "  callable is now open to any caller on the internet.",
  );
}

const known = new Set([...enforcing, ...missing].map((c) => c.name));
const ghosts = Object.keys(exempt).filter((n) => !known.has(n));
if (ghosts.length) {
  errors.push(
    `EXEMPT names callables that no longer exist: ${ghosts.join(", ")}.\n`
    + "  Delete the entries — a stale name makes the list read longer than the\n"
    + "  debt actually is.",
  );
}
return errors;
}

const errors = appCheckProblems({ enforcing, missing, bodies, onCallSites }, EXEMPT);
const found = enforcing.length + missing.length;
// Only a direct run prints or exits: importing this module for its
// exports must not take a test process down with it, and must not
// interleave a census into the test output.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
for (const c of [...enforcing].sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  enforced  ${c.name}`);
}
for (const c of [...missing].sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  exempt    ${c.name}  — ${EXEMPT[c.name]?.reason ?? c.note}`);
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
}
