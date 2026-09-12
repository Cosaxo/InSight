// verify-plan.mjs — what `npm run verify` runs, read out of the workflows
// that actually gate a pull request.
//
// WHY THIS EXISTS. There are 54 `check:*` gates plus five test runners, and
// until now the ONLY enumeration of them was ci.yml's lint job, one
// `- run:` at a time. So "have I run everything?" was answered by reading
// YAML, and `npm run lint` locally is eslint alone — which is how three
// separate breakages got through, every one of them a script that CHECKS
// something, so nothing else went red to give it away:
//
//   D179  a billed-read tripwire and a store-form assertion, both stale.
//   D197  one bank parser in three copies; the copy with a try/catch
//         reported an invented wire size instead of failing.
//   D275  a read tripwire counting `tx.get(` after the code moved to
//         `tx.getAll(`, so it counted zero and called it a regression.
//
// CLAUDE.md's own §2 names that class ("the fifth one hides, and that has
// shipped breakage three times") and `check:docs` rule 4 could not see it,
// because that rule reads `check:*` names and `test:scripts` is not one.
//
// WHY IT READS THE WORKFLOWS rather than carrying a list. A hand-kept list
// is the documentation error this repo keeps re-committing (D39,
// check:figures) and it would go stale in exactly the way that matters: a
// gate added to ci.yml and not to the list is a gate the pre-push sweep
// silently stops running, which is the defect this script exists to close,
// reproduced inside the fix. Derived from ci.yml and backend-checks.yml,
// the list cannot drift — a new gate step appears here the moment it
// appears in CI.
//
// THE RULE THAT MAKES IT HONEST: an unclassifiable command FAILS. Silent
// truncation reads as "covered everything" when it did not, so a step form
// this module does not recognise stops the run and names itself, rather
// than being dropped. That rule already earned itself once while this file
// was being written: the first extractor matched `- run:` only and missed
// the `- name:` + `run:` form, which is how both `npm audit` steps are
// written — two real checks, invisible.
//
// ITS OWN MODULE, no top-level work, for gate-placement.mjs's reason: the
// CLI runs subprocesses and exits, so a test that imported it would run
// the whole sweep as a side effect.

/** Full-line YAML comments are not steps. */
const stripComments = (src) =>
  String(src).split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

/**
 * Every command a workflow runs, in file order, with the `env:` and
 * `working-directory:` a step carries.
 *
 * BOTH STEP FORMS. `- run: cmd` is the common one; `- name: …` followed by
 * an indented `run: cmd` is what a step with a label writes, and matching
 * only the first missed both `npm audit` invocations. A `run: |` block is
 * returned as one step carrying its whole body, so a shell block is
 * classified once rather than line by line.
 *
 * ENV IS PART OF THE STEP, not decoration. ci.yml sets VITE_V2_LIVE and
 * VITE_SENTRY_DSN on its `npm run build` step, and `check:bundle` refuses
 * to grade a build that was not made as the shipping one — so a sweep that
 * read the command and dropped its environment would run the demo build
 * and then fail the next gate for a reason that has nothing to do with the
 * tree. That is the shape of red that teaches people to ignore a gate.
 *
 * @param {string} source  workflow YAML
 * @returns {Array<{command: string, block: boolean, env: Record<string,string>, cwd: string|null}>}
 */
export function extractSteps(source) {
  const lines = stripComments(source).split("\n");
  const steps = [];

  // The step's sibling keys sit at the indent of `run:` itself (a `- run:`
  // line puts `run` two columns right of the dash). Read forward from the
  // command until a line at or left of that indent that is not one of them.
  const trailing = (from, keyIndent) => {
    const env = {};
    let cwd = null;
    for (let j = from; j < lines.length; j++) {
      const raw = lines[j];
      if (raw.trim() === "") continue;
      const indent = raw.length - raw.trimStart().length;
      if (indent < keyIndent) break;
      const t = raw.trim();
      if (indent === keyIndent && /^working-directory:/.test(t)) {
        cwd = t.slice("working-directory:".length).trim();
        continue;
      }
      if (indent === keyIndent && t === "env:") {
        for (let k = j + 1; k < lines.length; k++) {
          if (lines[k].trim() === "") continue;
          const ei = lines[k].length - lines[k].trimStart().length;
          if (ei <= keyIndent) break;
          const kv = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(lines[k].trim());
          if (!kv) break;
          env[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
          j = k;
        }
        continue;
      }
      break;
    }
    return { env, cwd };
  };

  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(- )?run:(.*)$/.exec(lines[i]);
    if (!m) continue;
    const keyIndent = m[1].length + (m[2] ? m[2].length : 0);
    const rest = m[3].trim();
    if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
      // A folded block: consume the more-indented lines under it.
      const body = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].trim() === "") { body.push(""); continue; }
        const indent = lines[j].length - lines[j].trimStart().length;
        if (indent <= keyIndent) break;
        body.push(lines[j].trim());
      }
      steps.push({ command: body.join("\n").trim(), block: true, ...trailing(j, keyIndent) });
      i = j - 1;
      continue;
    }
    if (rest) steps.push({ command: rest, block: false, ...trailing(i + 1, keyIndent) });
  }
  return steps;
}

/**
 * What a command needs in order to run, or null when this module has never
 * been taught about it.
 *
 * `null` is the interesting return: the caller turns it into a failure. The
 * categories are deliberately about the PREREQUISITE, not about how
 * interesting the step is — "needs Java 21" and "needs the Android SDK" are
 * facts a developer can act on, where "skipped" is not.
 */
export function classify(command) {
  const c = String(command).trim();

  // Emulator suites. `test:rules` boots Firestore and Storage; the e2e
  // drivers boot auth, firestore, functions and storage. Both go through
  // firebase-tools, which needs a JDK — CLAUDE.md §2 names Java 21.
  if (/^npm run (test:rules|test:e2e(:all|:erasure|:moderation)?)\b/.test(c))
    return { kind: "emulator", need: "Java 21 (Firebase emulators)" };

  // Native toolchains. Neither is a gate on the app's logic: cap sync
  // rewrites native config, gradle builds the Android shell.
  if (/^npx cap sync\b/.test(c)) return { kind: "native", need: "Capacitor native projects" };
  if (/^\.\/gradlew\b/.test(c)) return { kind: "native", need: "Android SDK + JDK" };

  // Environment setup, not a check. `npm ci` is how CI gets a tree at all;
  // running it from here would blow away a working node_modules mid-sweep.
  if (/^npm ci\b/.test(c)) return { kind: "setup", need: "already installed locally" };

  // `npm audit` reaches the registry and CI marks its whole job
  // continue-on-error, so a red audit is not a broken tree. Offered under
  // --all rather than run by default.
  if (/^npm audit\b/.test(c)) return { kind: "network", need: "npm registry" };

  // Everything that is a real, local check.
  if (/^npm run [\w:-]+( --prefix \w+)?$/.test(c)) return { kind: "gate", need: null };
  if (/^npm run \w+ --prefix \w+$/.test(c)) return { kind: "gate", need: null };

  // A shell block that only reports (git diff, echo) gates nothing.
  if (/^(if |git |echo )/.test(c)) return { kind: "report", need: "informational only" };

  return null;
}

/**
 * The sweep, built from workflow sources.
 *
 * DEDUPED, because five gates are wired into both ci.yml and
 * backend-checks.yml on purpose (what guards a PR guards production) and
 * `npm run build` appears in three jobs. First occurrence wins, so the
 * order is CI's order.
 *
 * @param {Map<string,string>|Iterable<[string,string]>} workflows  file → source
 */
export function buildPlan(workflows) {
  const seen = new Set();
  const gate = [];
  const deferred = [];
  const unknown = [];
  for (const [file, src] of workflows) {
    for (const { command, env, cwd } of extractSteps(src)) {
      const how = classify(command);
      if (!how) { unknown.push({ file, command }); continue; }
      if (seen.has(command)) continue;
      seen.add(command);
      const row = { command, file, env: env ?? {}, cwd: cwd ?? null, ...how };
      if (how.kind === "gate") gate.push(row);
      else deferred.push(row);
    }
  }
  return { gate, deferred, unknown };
}
