#!/usr/bin/env node
// rules-budget.mjs — what a write COSTS in firestore.rules, per line, and
// how far it sits from the 1,000-expression ceiling.
//
// WHY THIS EXISTS. Firestore stops a rule at 1,000 evaluated expressions
// and reports the stop as PERMISSION_DENIED — the same answer as a rule
// that said no. D429 measured the answer create path's thinnest legal
// arms at ~130 expressions of headroom, and D431 found the e2e already
// crossing the line thirteen times, every one an expected refusal, so the
// suite is green and cannot tell. RULES-BUDGET-PLAN.md is the plan; this
// is its Phase 0 — the instrument that gives every clause a number BEFORE
// any of them is moved. The plan's rule is that nothing is restructured on
// an estimate.
//
// TWO MEASUREMENTS, checked against each other.
//
//   cost      The emulator's rule-coverage report (the one rules-coverage.mjs
//             already reads) records how many times every expression in the
//             file evaluated. Snapshot it before one write, snapshot after,
//             and the difference is that write's evaluations — attributable
//             to the LINE, which is what says "this get() site costs 8" and
//             "this let ran on a write that never reached the arm".
//   headroom  D429's method, automated: append N filler conjuncts to the
//             rule under test and bisect for the N at which the write
//             flips. This is the ground truth for the ceiling itself; cost
//             is the ground truth for attribution. Where they disagree, the
//             filler number wins and the disagreement is reported, because
//             the report's units and Firestore's budget units are not
//             documented to be the same thing.
//
// AND A VERDICT that can tell the two kinds of no apart. The emulator's
// reason text — "maximum of 1000 expressions to evaluate has been reached"
// — does reach the client (rules.test.ts records it arriving on a positive
// control), so a refusal is classified as `refused` or `budget`. That is
// the distinction the suite's `assertFails` cannot make and the whole
// reason a legal write can cross the line unnoticed.
//
// RUNS INSIDE THE EMULATOR, like rules-coverage.mjs:
//
//   firebase emulators:exec --only firestore "node scripts/rules-budget.mjs"
//
// Options:
//   --write-baseline          write scripts/rules-budget-baseline.json
//   --ablate NAME=true|false  replace helper NAME's body with `return X;`
//                             and measure that variant instead (repeatable)
//   --fillers-on update       put the fillers on the UPDATE arm instead of
//                             create — answers whether the budget is per
//                             allow statement or per request
//   --max-fillers N           bisection upper bound (default 400)
//   --lines N                 how many top lines to print per probe (12)
//
// The pure parts — the rule transforms, the verdict classifier, the
// evaluation sum, the bisection — are exported and covered by
// rules-budget.test.mjs without an emulator, in the shape rules-coverage
// takes. A transform that cannot find its anchor text FAILS rather than
// returning the input unchanged: a filler that silently lands nowhere is a
// headroom measurement of nothing, which is D197's failure one script over.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE = join(root, "scripts", "rules-budget-baseline.json");
// Overridable so a frozen copy can be measured while the tree's own file
// is being edited — which is exactly the Phase 1 workflow: measure the
// base, restructure, measure the tree, compare.
const RULES = process.env.RULES_BUDGET_RULES || join(root, "firestore.rules");

// ── pure: rule transforms ───────────────────────────────────────────

/**
 * The last conjunct of the answer CREATE rule — the filler anchor. Since
 * Phase 1 (c) the rule ends in the routed `createArm()`; the anchors ride
 * inside each branch. The rule's own comment names this line as the
 * probe's landing and asks that it stay last.
 */
export const CREATE_TAIL = "&& createArm();";
/** The last conjunct of the answer UPDATE rule. */
export const UPDATE_TAIL = "|| request.time > resource.data.editedAt + duration.value(60, 's'));";

/**
 * One filler conjunct. ~3 expressions (a field read, a compare, the `&&`),
 * which is what D429 calibrated against. `surface` is chosen because every
 * answer carries it, so the filler is evaluated and never short-circuits.
 */
export const filler = (i) => `\n          && request.resource.data.surface != "zzfill${i}"`;

/** The answer document's match block — the fillers land inside it and nowhere else. */
export const ANSWERS_BLOCK = "match /answers/{aid}";

/**
 * Append `n` fillers before the terminating `;` of the answer create (or
 * update) rule. Scoped to the answers match block, because the create
 * rule's last conjunct — `isValidV2Anchors(…)` — is ALSO the last conjunct
 * of the profile's create rule, word for word, and the first run of this
 * script found it twice and refused. Throws unless the anchor is exactly
 * once inside the block.
 */
export function withFillers(rules, n, where = "create") {
  const at = rules.indexOf(ANSWERS_BLOCK);
  if (at === -1) throw new Error(`rules-budget: no \`${ANSWERS_BLOCK}\` block in the rules`);
  const head = rules.slice(0, at);
  const block = rules.slice(at);
  const tail = where === "update" ? UPDATE_TAIL : CREATE_TAIL;
  const count = block.split(tail).length - 1;
  if (count !== 1) {
    throw new Error(
      `rules-budget: the answer ${where} rule's tail anchor was found ${count} times in its block, expected 1.\n`
      + `  Anchor: ${tail}\n`
      + "  The rule changed shape; move the anchor here rather than measuring nothing.",
    );
  }
  const body = tail.slice(0, -1); // drop the ';'
  let fill = "";
  for (let i = 0; i < n; i += 1) fill += filler(i);
  return head + block.replace(tail, `${body}${fill};`);
}

/**
 * Replace a helper's body with `return VALUE;`. Helpers in this file are
 * `function NAME(…) {` at any indent, closed by a `}` at the SAME indent —
 * the rules formatter is consistent about that and this relies on it.
 */
export function ablate(rules, name, value) {
  const re = new RegExp(`^([ \\t]*)function ${name}\\(([^)]*)\\) \\{\\n[\\s\\S]*?\\n\\1\\}`, "m");
  const m = re.exec(rules);
  if (!m) throw new Error(`rules-budget: no helper named ${name}() to ablate`);
  const indent = m[1];
  return rules.replace(re, `${indent}function ${name}(${m[2]}) {\n${indent}  return ${value};\n${indent}}`);
}

// ── pure: verdicts and sums ─────────────────────────────────────────

export const BUDGET_TEXT = /maximum of 1000 expressions/i;

/** allowed | refused | budget, from a write's outcome. */
export function classify(err) {
  if (!err) return "allowed";
  const msg = String(err?.message || err);
  return BUDGET_TEXT.test(msg) ? "budget" : "refused";
}

/**
 * Total evaluations in a coverage report, and the same broken down by
 * line. Every node in the emulator's tree is one expression, and each of
 * its `values` carries a `count`; the sum over the tree is how many
 * expressions ran.
 */
export function evalCounts(data) {
  let total = 0;
  const byLine = new Map();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const n = (node.values || []).reduce((a, v) => a + (v?.count || 0), 0);
    if (n) {
      total += n;
      const line = node.sourcePosition?.line ?? 0;
      byLine.set(line, (byLine.get(line) || 0) + n);
    }
    for (const c of node.children || []) walk(c);
  };
  for (const n of data?.report || []) walk(n);
  return { total, byLine };
}

/** `after - before`, per line and in total; lines that did not move are dropped. */
export function delta(before, after) {
  const byLine = new Map();
  for (const [line, n] of after.byLine) {
    const d = n - (before.byLine.get(line) || 0);
    if (d) byLine.set(line, d);
  }
  return { total: after.total - before.total, byLine };
}

/**
 * Largest n in [lo, hi] for which `ok(n)` holds, assuming monotone (true
 * then false). Returns lo - 1 if even lo fails, hi if hi passes.
 */
export async function bisect(ok, lo, hi) {
  if (!(await ok(lo))) return lo - 1;
  if (await ok(hi)) return hi;
  let good = lo;
  let bad = hi;
  while (bad - good > 1) {
    const mid = Math.floor((good + bad) / 2);
    if (await ok(mid)) good = mid;
    else bad = mid;
  }
  return good;
}

// ── the probes ──────────────────────────────────────────────────────
//
// The seven legal creates are the budget test's own, payload for payload
// (rules.test.ts § "the heaviest LEGAL create"): all ten anchors at their
// bounds, because that is what a real device writes and every other case
// in the suite sends the cheap end. The refusals mirror the shapes the e2e
// hits (D431's thirteen). One update.

const U = { owner: "u_owner", friend: "u_friend", stranger: "u_stranger" };
const GID = "g_budget";
export const FAT = {
  city: "c".repeat(80), country: "n".repeat(80), ageBand: "b".repeat(20),
  age: "999", gender: "g".repeat(40), profession: "p".repeat(80),
  jobField: "j".repeat(40), education: "e".repeat(80),
  relationship: "r".repeat(40), heightBand: "h".repeat(20),
};

export const PROBES = [
  // legal creates
  { name: "world · all ten anchors at their bounds", expect: "allowed", uid: U.owner, aid: "daily-000",
    data: { qid: "daily-000", surface: "daily", optionIdx: 1, anchors: FAT } },
  { name: "duel · own bank", expect: "allowed", uid: U.owner, aid: `g_${GID}_r2`,
    data: { qid: "group-b0", surface: "group", optionIdx: 1, guessIdx: 0, gid: GID, round: 2, anchors: FAT } },
  { name: "duel · WORLD content (thinnest, D429)", expect: "allowed", uid: U.friend, aid: `g_${GID}_r2`,
    data: { qid: "feed-w0", surface: "group", optionIdx: 1, guessIdx: 0, gid: GID, round: 2, anchors: FAT } },
  { name: "duel · pick round (thinnest, D429)", expect: "allowed", uid: U.stranger, aid: `g_${GID}_r2`,
    data: { qid: "group-pick0", surface: "group", optionIdx: 1, guessIdx: 2, pickUid: U.friend, gid: GID, round: 2, anchors: FAT } },
  { name: "duel · late answer", expect: "allowed", uid: U.owner, aid: `g_${GID}_r1`,
    data: { qid: "group-b0", surface: "group", optionIdx: 0, late: true, gid: GID, round: 1, anchors: FAT } },
  { name: "rank", expect: "allowed", uid: U.owner, aid: "feed-rank0",
    data: { qid: "feed-rank0", surface: "feed", order: [2, 0, 1, 3], anchors: FAT } },
  { name: "duel · 32-member room", expect: "allowed", uid: "m31", aid: "g_g_big_r2",
    data: { qid: "group-b0", surface: "group", optionIdx: 1, guessIdx: 0, gid: "g_big", round: 2, anchors: FAT } },
  { name: "pulse", expect: "allowed", uid: U.owner, aid: "pulse-pace_2026-09-09",
    data: { qid: "pulse-pace_2026-09-09", baseQid: "pulse-pace", day: "2026-09-09", surface: "pulse", optionIdx: 1, anchors: FAT } },
  // refusals, in the e2e's shapes
  { name: "REFUSE · round already revealed", expect: "refused", uid: U.owner, aid: `g_${GID}_r1`,
    data: { qid: "group-b0", surface: "group", optionIdx: 0, guessIdx: 0, gid: GID, round: 1, anchors: FAT } },
  { name: "REFUSE · entity on a non-catalog question", expect: "refused", uid: U.owner, aid: "feed-w0",
    data: { qid: "feed-w0", surface: "feed", entity: 128514, anchors: FAT } },
  { name: "REFUSE · a second ranking on the same question", expect: "refused", uid: U.friend, aid: "feed-rank0",
    data: { qid: "feed-rank0", surface: "feed", order: [2, 0, 1, 3], anchors: FAT } },
  { name: "REFUSE · optionIdx on a rank question", expect: "refused", uid: U.stranger, aid: "feed-rank0",
    data: { qid: "feed-rank0", surface: "feed", optionIdx: 1, anchors: FAT } },
  { name: "REFUSE · world answer on a killed question", expect: "refused", uid: U.owner, aid: "daily-dead",
    data: { qid: "daily-dead", surface: "daily", optionIdx: 0, anchors: FAT } },
  { name: "REFUSE · non-member in a room", expect: "refused", uid: "nobody", aid: `g_${GID}_r2`,
    data: { qid: "group-b0", surface: "group", optionIdx: 1, guessIdx: 0, gid: GID, round: 2, anchors: FAT } },
  // one legal update (D86's one edit shape)
  { name: "update · optionIdx edit", expect: "allowed", uid: U.friend, aid: "daily-000", update: true,
    data: { optionIdx: 1 } },
];

// ── the emulator half ───────────────────────────────────────────────

function emulatorHost() {
  const h = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const [host, port] = h.split(":");
  return { host, port: Number(port) };
}

async function coverage(projectId) {
  const { host, port } = emulatorHost();
  const url = `http://${host}:${port}/emulator/v1/projects/${projectId}:ruleCoverage.html`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rules-budget: coverage report HTTP ${res.status} at ${url}`);
  const html = await res.text();
  const a = html.indexOf("const data = ");
  const b = html.indexOf("\n};", a);
  if (a === -1 || b === -1) {
    throw new Error("rules-budget: the coverage report is no longer `const data = {…};` — fix the parser, do not drop the check");
  }
  return evalCounts(JSON.parse(html.slice(a + "const data = ".length, b + 2)));
}

let seq = 0;
async function boot(rules, label) {
  const { initializeTestEnvironment } = await import("@firebase/rules-unit-testing");
  const { host, port } = emulatorHost();
  seq += 1;
  const projectId = `budget-${label}-${seq}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const env = await initializeTestEnvironment({ projectId, firestore: { rules, host, port } });
  return { env, projectId };
}

async function seed(env) {
  const { doc, setDoc, Timestamp } = await import("firebase/firestore");
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const q = (id, d) => setDoc(doc(db, "v2_questions", id), d);
    await q("daily-000", { surface: "daily", seq: 0, type: "binary", prompt: "?", options: ["a", "b"], active: true });
    await q("daily-dead", { surface: "daily", seq: 9, type: "binary", prompt: "?", options: ["a", "b"], active: false });
    await q("group-b0", { surface: "group", seq: 1, type: "classic", prompt: "?", options: ["a", "b"], active: true });
    await q("feed-w0", { surface: "feed", seq: 2, type: "vote", prompt: "?", options: ["a", "b"], active: true, core: true });
    await q("group-pick0", { surface: "group", seq: 3, type: "classic", topic: "pick", prompt: "?", options: [], active: true });
    await q("feed-rank0", { surface: "feed", seq: 4, type: "rank", prompt: "?", options: ["A", "B", "C", "D"], active: true });
    // The BASE question: isPulseAnswer reads `v2_questions/$(baseQid)`, not
    // the per-day aid. The first fixture seeded the aid and the probe ran
    // out of budget erroring on a missing document.
    await q("pulse-pace", { surface: "pulse", seq: 5, type: "vote", prompt: "?", options: ["a", "b", "c"], active: true });
    await setDoc(doc(db, "v2_groups", GID), { name: "Room", mode: "group", memberUids: [U.owner, U.friend, U.stranger], round: 2 });
    await setDoc(doc(db, "v2_groups", "g_big"), {
      name: "Crowd", mode: "group", memberUids: Array.from({ length: 32 }, (_, i) => `m${i}`), round: 2,
    });
    // The update probe's existing answer…
    await setDoc(doc(db, "v2_users", U.friend, "answers", "daily-000"), {
      qid: "daily-000", surface: "daily", optionIdx: 0, answeredAt: Timestamp.now(), anchors: {},
    });
    // …and the ranking that already exists, for the "second ranking"
    // refusal. The e2e's "duplicate ranking refused" is a second ANSWER to
    // a rank question, not a repeated index: isRankAnswer bounds the
    // order's length and never its distinctness, so [0,0,1,2] is a legal
    // order and the first fixture measured an allowed write as a refusal.
    await setDoc(doc(db, "v2_users", U.friend, "answers", "feed-rank0"), {
      qid: "feed-rank0", surface: "feed", order: [0, 1, 2, 3], answeredAt: Timestamp.now(), anchors: {},
    });
  });
}

async function attempt(env, probe) {
  const { doc, setDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = env.authenticatedContext(probe.uid).firestore();
  const ref = doc(db, "v2_users", probe.uid, "answers", probe.aid);
  try {
    if (probe.update) await updateDoc(ref, { ...probe.data, editedAt: serverTimestamp() });
    else await setDoc(ref, { ...probe.data, answeredAt: serverTimestamp() });
    return "allowed";
  } catch (e) {
    return classify(e);
  }
}

/**
 * The coverage report, read until two consecutive reads agree. The
 * emulator does not promise the report is current the instant a write
 * returns, and the first version of this script — one project for every
 * probe, one snapshot either side of each write — attributed SIXTY
 * evaluations of an anchor-size line to a single write with ten anchors:
 * six writes' worth, misfiled. The lagging read is why every probe now
 * gets its own project (below); the settle is belt to that brace.
 */
async function settledCoverage(projectId) {
  let prev = await coverage(projectId);
  for (let i = 0; i < 6; i += 1) {
    await new Promise((r) => setTimeout(r, 120));
    const next = await coverage(projectId);
    if (next.total === prev.total) return next;
    prev = next;
  }
  return prev;
}

/**
 * One variant: for EVERY probe, a fresh project — boot, seed, one write,
 * one report. The seed runs with rules disabled, so it evaluates nothing
 * and the report holds exactly the probe's own evaluations; `pre` is
 * printed so a non-zero one is visible rather than silently subtracted.
 */
async function measureCosts(rules, label, topLines) {
  const out = [];
  for (const [i, p] of PROBES.entries()) {
    const { env, projectId } = await boot(rules, `${label}-c${i}`);
    try {
      await seed(env);
      const before = await settledCoverage(projectId);
      const verdict = await attempt(env, p);
      const after = await settledCoverage(projectId);
      const d = delta(before, after);
      const lines = [...d.byLine.entries()].sort((a, b) => b[1] - a[1]).slice(0, topLines);
      out.push({ name: p.name, expect: p.expect, verdict, cost: d.total, pre: before.total, lines });
    } finally {
      await env.cleanup();
    }
  }
  return out;
}

/** Does this rules text LOAD? A variant past the compile ceiling refuses at boot. */
async function compiles(rules, label) {
  try {
    const { env } = await boot(rules, label);
    await env.cleanup();
    return true;
  } catch (e) {
    if (/too complex to evaluate safely|Error compiling rules/i.test(String(e?.message || e))) return false;
    throw e;
  }
}

/**
 * The compile ceiling, in fillers: the largest N the ruleset still loads
 * with. D429 met this at 85 by hand and named it the LOUD ceiling — a
 * deploy fails rather than a person being refused. The first run of this
 * script began its bisection at 300, above it, and died on the compile
 * error instead of recording it; now it is a number of its own and the
 * headroom bisection stays beneath it.
 */
async function measureCompileCeiling(rules, label, where, maxFillers) {
  return bisect((n) => compiles(withFillers(rules, n, where), `${label}-k${n}`), 0, maxFillers);
}

/** Headroom per probe, in fillers: the largest N at which its verdict is unchanged. */
async function measureHeadroom(rules, label, where, maxFillers) {
  const out = new Map();
  for (const p of PROBES) {
    if (p.update && where !== "update") { out.set(p.name, null); continue; }
    if (!p.update && where === "update") { out.set(p.name, null); continue; }
    const cache = new Map();
    const ok = async (n) => {
      if (cache.has(n)) return cache.get(n);
      let verdict;
      try {
        const { env } = await boot(withFillers(rules, n, where), `${label}-f${n}`);
        try { await seed(env); verdict = await attempt(env, p); } finally { await env.cleanup(); }
      } catch (e) {
        // Past the compile ceiling the variant cannot load at all — that is
        // a failing N for every probe, not a crash.
        if (!/too complex to evaluate safely|Error compiling rules/i.test(String(e?.message || e))) throw e;
        verdict = "compile";
      }
      // "unchanged" means: an allowed write is still allowed, and a refused
      // write is still refused for a REASON rather than for budget.
      const still = p.expect === "allowed" ? verdict === "allowed" : verdict === "refused";
      cache.set(n, still);
      return still;
    };
    out.set(p.name, await bisect(ok, 0, maxFillers));
  }
  return out;
}

// ── CLI ─────────────────────────────────────────────────────────────

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = readFileSync(RULES, "utf8");
  let rules = base;
  const ablations = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === "--ablate") {
      // NAME=EXPR — any rules expression, not only true/false, so a helper
      // that returns a number (duelIndexSpace) or a map can be stubbed too.
      const eq = String(process.argv[i + 1]).indexOf("=");
      const name = String(process.argv[i + 1]).slice(0, eq);
      const value = String(process.argv[i + 1]).slice(eq + 1);
      rules = ablate(rules, name, value);
      ablations.push(`${name}=${value}`);
    }
  }
  const where = arg("--fillers-on", "create");
  const maxFillers = Number(arg("--max-fillers", "200"));
  const topLines = Number(arg("--lines", "12"));
  const label = ablations.length ? ablations.join("+") : "base";

  console.log(`rules-budget: ${label}${where === "update" ? " (fillers on the update arm)" : ""}`);
  const src = base.split("\n");

  // The compile ceiling first: it bounds the headroom bisection, and it is
  // a number the plan's gate wants on its own.
  const ceiling = await measureCompileCeiling(rules, label, where, maxFillers);
  console.log(`compile ceiling: the ruleset still loads with ${ceiling} fillers (≈${ceiling * 3} expressions) on the ${where} arm`);

  // COSTS FIRST, AND PRINTED FIRST. The headroom pass boots the emulator
  // ~10 times per probe and is where a transform will refuse; the cost
  // table is the cheaper, more informative half and must not be lost to a
  // failure in the other. The first run of this script lost it that way.
  const costs = await measureCosts(rules, label, topLines);
  console.log("\nprobe                                        verdict   cost   pre");
  for (const c of costs) {
    const flag = c.verdict !== c.expect ? "  ← EXPECTED " + c.expect : "";
    console.log(`${c.name.padEnd(44)} ${c.verdict.padEnd(8)} ${String(c.cost).padStart(5)} ${String(c.pre).padStart(5)}${flag}`);
  }
  console.log("\n— top lines per probe —");
  for (const c of costs) {
    console.log(`\n${c.name}`);
    for (const [line, n] of c.lines) {
      const text = (src[line - 1] || "").trim().slice(0, 78);
      console.log(`  L${String(line).padEnd(5)} ${String(n).padStart(4)}  ${text}`);
    }
  }

  const headroom = await measureHeadroom(rules, label, where, Math.max(0, ceiling));
  console.log("\nprobe                                        fillers  ≈exprs");
  for (const c of costs) {
    const h = headroom.get(c.name);
    // -1 is bisect's "even zero fillers fails": the write is already past
    // the line today, which for a refusal means refused BY BUDGET.
    const hs = h == null ? "     —" : h < 0 ? "  over" : String(h).padStart(6);
    const es = h == null || h < 0 ? "     —" : String(h * 3).padStart(6);
    console.log(`${c.name.padEnd(44)} ${hs}  ${es}`);
  }
  // Calibration: does the coverage sum agree with the filler headroom?
  console.log("\n— calibration (cost + 3·fillers should be ≈ 1000 on an allowed probe) —");
  for (const c of costs) {
    const h = headroom.get(c.name);
    if (h == null || h < 0 || c.expect !== "allowed") continue;
    console.log(`  ${c.name.padEnd(44)} ${String(c.cost + h * 3).padStart(5)}`);
  }

  const wrong = costs.filter((c) => c.verdict !== c.expect);
  if (wrong.length) {
    console.error(`\nrules-budget: ${wrong.length} probe(s) did not return the expected verdict:`);
    for (const c of wrong) console.error(`  ${c.name}: expected ${c.expect}, got ${c.verdict}`);
  }
  if (process.argv.includes("--write-baseline")) {
    const snapshot = {
      measured: new Date().toISOString().slice(0, 10),
      variant: label,
      probes: costs.map((c) => ({ name: c.name, expect: c.expect, verdict: c.verdict, cost: c.cost, fillers: headroom.get(c.name) })),
    };
    writeFileSync(BASELINE, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`\nrules-budget: baseline written — ${BASELINE}`);
  }
  process.exit(wrong.length ? 1 : 0);
}
