// omib-report.mjs — the §6 check: did the bank's calibration TRANSFER?
// (docs/OMIB-PLAN.md §6, D475)
//
//   node scripts/omib-report.mjs                      production, admin credentials
//   node scripts/omib-report.mjs --emulator           the local emulator
//   node scripts/omib-report.mjs --from docs.json     { ledger, histogram, adaptive? } saved earlier
//   … --json                                          the scorecard object instead of the page
//
// THE QUESTION. The Open Matrices Item Bank publishes, per item, a
// difficulty b and a discrimination a estimated on 2,572 people. Scoring by
// θ (functions/src/irt.ts) is a promise that the items behave the same way
// for this app's takers as for that sample — under a 90 s clock, on a
// phone, built from twenty shapes rather than picked from six. This report
// is the promise measured: for each item, how often it was solved here
// against how hard it was published to be.
//
// THE INSTRUMENT, corrected by its own test. The plan's first draft put the
// bar on r(b, solve rate) at −0.8. omib-report.test.mjs generated answers
// FROM the published parameters and read −0.76 at 400 attempts: b alone
// predicts a rate only through the item's discrimination and the
// population's θ, so the noise-free ceiling of that figure is −0.83 here,
// and the sightings' binomial noise sits under it. The verdict therefore
// rests on the rate the 2PL EXPECTS for each item at the θ̂ distribution
// actually observed, against the rate observed — linear by construction
// when the calibration holds (0.86 at 200 attempts, 0.93 at 400, 0.97 at
// 800 in that test) and near 0.1 when it does not. r ≥ 0.8 on that pair is
// the bar; the plan's r is still printed, beside its ceiling, so a reader
// who expected −0.8 sees why it was never going to arrive.
//
// WHAT IT READS — three public mirrors, exact counts and no identities:
//   v2_logic_norms/families   the stratified ledger: i_<n>_seen / _solved /
//                             _blank per item, first counted attempts only
//   v2_logic_norms/global     the θ̂ histogram: t0 … t39, 0.25 wide from −5
//   v2_logic_norms/adaptive   the adaptive ledger, exposure only (absent
//                             until the flip)
// and the bank's public parameters from content/omib.json. Never the key.
//
// WHY THE STRATIFIED LEDGER ALONE decides. Under adaptive administration
// every item is met near its taker's 50 % point, so its solve rate says
// nothing about b — which is why adaptive attempts fold into their own
// document (functions/src/logic.ts, finishOmib) and why the flip to
// adaptive waits on THIS number: flipping first would spoil the instrument.
//
// Run by hand until the counts justify a schedule; the pure half
// (`omibScorecard`) is what a console lane will call when they do.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * First counted attempts before a verdict is spoken. Three hundred, not
 * the norms' hundred: at 100 the expected-against-observed figure reads
 * 0.75 on a calibration that DID transfer (test, seed 7) — a false "did
 * not" — and clears the bar from 200 with little margin. "Hundreds", as
 * the plan said.
 */
export const OMIB_REPORT_MIN_N = 300;
/** An item enters the correlation once it has been seen this often. */
export const OMIB_REPORT_MIN_SEEN = 5;
/** The bar, on r(expected solve rate, observed solve rate) — see the header. */
export const OMIB_REPORT_FIT_BAR = 0.8;
/** The era the documents must carry — functions/src/omib.ts's OMIB_ERA, restated for a reader with no bank. */
export const OMIB_ERA = { bank: "omib", items: 25, gv: 1 };
const THETA_BINS = 40;
const THETA_BIN_WIDTH = 0.25;
const THETA_BIN_MIN = -5;
const STRATA = { 1: 2, 2: 6, 3: 9, 4: 6, 5: 2 };

/** The bank's public parameters: every item that has them. */
export function loadBank(path = resolve(here, "../content/omib.json")) {
  const j = JSON.parse(readFileSync(path, "utf8"));
  return j.items
    .filter((i) => typeof i.a === "number" && typeof i.b === "number")
    .map((i) => ({ n: i.n, a: i.a, b: i.b, rules: i.ruleCount }));
}

const num = (d, k) => (d && typeof d[k] === "number" ? d[k] : 0);
const isEra = (d) => Boolean(d) && d.bank === OMIB_ERA.bank && d.items === OMIB_ERA.items && d.gv === OMIB_ERA.gv;
const p2pl = (theta, a, b) => 1 / (1 + Math.exp(-a * (theta - b)));
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const round = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);

export function pearson(xs, ys) {
  if (xs.length < 3) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Ranks with ties averaged, then Pearson on the ranks. */
const ranks = (xs) => {
  const order = xs.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k][1]] = avg;
    i = j + 1;
  }
  return r;
};
export const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

/**
 * The scorecard, pure: three documents and the bank in, the numbers out.
 * Nothing here reads Firestore; the CLI below fetches and hands over.
 */
export function omibScorecard({ ledger, histogram, adaptive = null, bank }) {
  const era = { ledger: isEra(ledger), histogram: isEra(histogram), adaptive: adaptive ? isEra(adaptive) : null };
  const n = era.ledger ? num(ledger, "n") : 0;

  // ── the θ̂ distribution, off the histogram ──
  const counts = Array.from({ length: THETA_BINS }, (_, k) => (era.histogram ? num(histogram, `t${k}`) : 0));
  const nH = counts.reduce((s, c) => s + c, 0);
  const mids = counts.map((_, k) => THETA_BIN_MIN + THETA_BIN_WIDTH * (k + 0.5));
  const weights = counts.map((c) => (nH ? c / nH : 0));
  const thetaMean = nH ? mids.reduce((s, m, k) => s + m * weights[k], 0) : NaN;
  const thetaSd = nH ? Math.sqrt(mids.reduce((s, m, k) => s + (m - thetaMean) ** 2 * weights[k], 0)) : NaN;
  let acc = 0;
  let thetaMedian = NaN;
  for (let k = 0; k < THETA_BINS && nH; k++) {
    const before = acc;
    acc += counts[k];
    if (acc >= nH / 2) {
      // interpolate inside the median's bin
      thetaMedian = THETA_BIN_MIN + THETA_BIN_WIDTH * (k + (nH / 2 - before) / (counts[k] || 1));
      break;
    }
  }
  const shareBelowZero = nH ? counts.slice(0, THETA_BINS / 2).reduce((s, c) => s + c, 0) / nH : NaN;

  // ── per item: observed against published, and against the model at this population ──
  const items = bank.map((it) => {
    const seen = era.ledger ? num(ledger, `i_${it.n}_seen`) : 0;
    const solved = era.ledger ? num(ledger, `i_${it.n}_solved`) : 0;
    const blank = era.ledger ? num(ledger, `i_${it.n}_blank`) : 0;
    // what the 2PL predicts for this item over the θ̂ distribution actually
    // observed here — a stand-in for the true θ distribution (EAP shrinks
    // toward the prior, so the real spread is somewhat wider)
    const expected = nH ? mids.reduce((s, m, k) => s + weights[k] * p2pl(m, it.a, it.b), 0) : null;
    return {
      n: it.n, a: it.a, b: it.b, rules: it.rules, seen, solved, blank,
      p: seen ? solved / seen : null,
      blankRate: seen ? blank / seen : null,
      expected,
      resid: seen && expected != null ? solved / seen - expected : null,
    };
  });
  const inCorr = items.filter((i) => i.seen >= OMIB_REPORT_MIN_SEEN);
  // the plan's figure, and its ceiling: what r(b, rate) would read with no
  // noise at all, given this population and the items' discriminations
  const r = pearson(inCorr.map((i) => i.b), inCorr.map((i) => i.p));
  const rho = spearman(inCorr.map((i) => i.b), inCorr.map((i) => i.p));
  const rCeiling = nH ? pearson(inCorr.map((i) => i.b), inCorr.map((i) => i.expected)) : NaN;
  const rBlank = pearson(inCorr.map((i) => i.b), inCorr.map((i) => i.blankRate));
  // the verdict's figure: what the model expects at this population against what was seen
  const fitR = nH ? pearson(inCorr.map((i) => i.expected), inCorr.map((i) => i.p)) : NaN;
  const withResid = items.filter((i) => i.resid != null && i.seen >= OMIB_REPORT_MIN_SEEN);
  const mad = withResid.length ? mean(withResid.map((i) => Math.abs(i.resid))) : NaN;
  const worst = withResid.slice().sort((x, y) => Math.abs(y.resid) - Math.abs(x.resid)).slice(0, 5);
  const totalSeen = items.reduce((s, i) => s + i.seen, 0);
  const totalBlank = items.reduce((s, i) => s + i.blank, 0);

  // ── exposure: against what the strata's slots would give an item if every draw were even ──
  const strataSize = {};
  for (const it of bank) strataSize[it.rules] = (strataSize[it.rules] || 0) + 1;
  const exposure = (doc, docN) => {
    if (!doc) return null;
    const rows = bank.map((it) => {
      const seen = num(doc, `i_${it.n}_seen`);
      const expected = docN * ((STRATA[it.rules] || 0) / (strataSize[it.rules] || 1));
      return { n: it.n, rules: it.rules, b: it.b, seen, expected, ratio: expected ? seen / expected : null };
    });
    const sorted = rows.slice().sort((x, y) => (y.ratio ?? 0) - (x.ratio ?? 0));
    return { n: docN, most: sorted.slice(0, 5), least: sorted.slice(-5).reverse(), unseen: rows.filter((i) => i.seen === 0).length };
  };

  // ── the verdict ──
  let verdict;
  if (!era.ledger || !era.histogram) verdict = "another era";
  else if (n < OMIB_REPORT_MIN_N) verdict = "too early";
  else if (Number.isFinite(fitR) && fitR >= OMIB_REPORT_FIT_BAR) verdict = "transferred";
  else verdict = "did not transfer";

  return {
    verdict,
    bar: OMIB_REPORT_FIT_BAR,
    minN: OMIB_REPORT_MIN_N,
    era,
    n,
    itemsInCorrelation: inCorr.length,
    itemsSeen: items.filter((i) => i.seen > 0).length,
    itemsInBank: bank.length,
    fitR: round(fitR),
    r: round(r),
    rho: round(rho),
    rCeiling: round(rCeiling),
    meanSeen: inCorr.length ? round(mean(inCorr.map((i) => i.seen)), 1) : null,
    blankShare: totalSeen ? round(totalBlank / totalSeen) : null,
    rBlank: round(rBlank),
    theta: { n: nH, mean: round(thetaMean), sd: round(thetaSd), median: round(thetaMedian), shareBelowZero: round(shareBelowZero) },
    fit: { mad: round(mad), worst: worst.map((i) => ({ n: i.n, b: i.b, seen: i.seen, p: round(i.p), expected: round(i.expected), resid: round(i.resid) })) },
    exposure: { stratified: exposure(era.ledger ? ledger : null, n), adaptive: exposure(era.adaptive ? adaptive : null, adaptive ? num(adaptive, "n") : 0) },
  };
}

/** The page, as the console prints its scorecards: a heading, the verdict, the numbers with their basis. */
export function renderScorecard(sc) {
  const L = [];
  const f = (x, d = 2) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(d));
  L.push("# OMIB calibration transfer — the §6 report");
  L.push("");
  const why = {
    "another era": "the ledger or the histogram is not the OMIB era's (bank omib, 25 items, gv 1) — nothing to read",
    "too early": `${sc.n} first attempts counted of the ${sc.minN} this needs before a verdict (expected-against-observed r ${f(sc.fitR)} so far)`,
    transferred: `expected-against-observed r = ${f(sc.fitR)} across ${sc.itemsInCorrelation} items, at or beyond the ${sc.bar} bar — the bank's parameters predict this app's solve rates`,
    "did not transfer": `expected-against-observed r = ${f(sc.fitR)} across ${sc.itemsInCorrelation} items, short of the ${sc.bar} bar — something about this administration differs from the calibration's`,
  };
  L.push(`**Verdict: ${sc.verdict}** — ${why[sc.verdict]}.`);
  L.push("");
  L.push(`- **attempts** — ${sc.n} first counted attempts on the stratified ledger; ${sc.itemsSeen} of ${sc.itemsInBank} bank items seen, ${sc.itemsInCorrelation} seen ≥ ${OMIB_REPORT_MIN_SEEN} times (mean ${f(sc.meanSeen, 1)} sightings each)`);
  L.push(`- **the model against the observation** — r ${f(sc.fitR)} between each item's expected solve rate (the 2PL at this population's θ̂) and its observed one; the bar is ${f(sc.bar, 1)}`);
  L.push(`- **b against solve rate, the plan's figure** — r ${f(sc.r)} · Spearman ρ ${f(sc.rho)} · against a noise-free ceiling of ${f(sc.rCeiling)} at this population (discrimination varies, so b alone never orders the rates perfectly)`);
  L.push(`- **the clock's signature** — ${f((sc.blankShare ?? 0) * 100, 1)} % of sightings ended blank; r(b, blank rate) ${f(sc.rBlank)} — harder items running out of time reads as a positive number here`);
  L.push(`- **the population** — θ̂ mean ${f(sc.theta.mean)} · SD ${f(sc.theta.sd)} · median ${f(sc.theta.median)} · ${f((sc.theta.shareBelowZero ?? 0) * 100, 0)} % below the calibration sample's median (n ${sc.theta.n}); a mean below 0 is expected — the sample was selected`);
  L.push(`- **fit at this population** — mean |observed − expected| ${f(sc.fit.mad)} over the items in the correlation; the five that moved most:`);
  for (const w of sc.fit.worst) L.push(`  - item ${w.n} (b ${f(w.b)}, seen ${w.seen}): solved ${f(w.p)} where the model expects ${f(w.expected)} (${w.resid > 0 ? "+" : ""}${f(w.resid)})`);
  const ex = (label, e) => {
    if (!e) { L.push(`- **exposure, ${label}** — no ledger yet`); return; }
    const row = (i) => `item ${i.n} (${i.rules}-rule, b ${f(i.b)}) ×${i.seen} against ${f(i.expected, 1)} even`;
    L.push(`- **exposure, ${label}** — n ${e.n}; ${e.unseen} items never drawn; most drawn: ${e.most.map(row).join(" · ")}; least: ${e.least.map(row).join(" · ")}`);
  };
  ex("stratified", sc.exposure.stratified);
  ex("adaptive", sc.exposure.adaptive);
  L.push("");
  L.push(`Basis: v2_logic_norms/{families, global, adaptive} (public mirrors, exact counts, first counted attempts only) against content/omib.json's published a and b. Bar (${f(sc.bar, 1)} on expected-against-observed) and floor (${sc.minN} attempts): docs/OMIB-PLAN.md §6, D475.`);
  return L.join("\n");
}

// ── the CLI ──
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (k) => args.includes(k);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  let docs;
  if (opt("--from")) {
    docs = JSON.parse(readFileSync(resolve(opt("--from")), "utf8"));
  } else {
    const { adminDb } = await import("./admin-db.mjs");
    const emulator = flag("--emulator") || Boolean(process.env.FIRESTORE_EMULATOR_HOST);
    const projectId = opt("--project") || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || (emulator ? "demo-insight" : undefined);
    const db = adminDb({ projectId, emulator });
    const read = async (id) => { const s = await db.collection("v2_logic_norms").doc(id).get(); return s.exists ? s.data() : null; };
    docs = { ledger: await read("families"), histogram: await read("global"), adaptive: await read("adaptive") };
  }
  const sc = omibScorecard({ ...docs, bank: loadBank() });
  process.stdout.write((flag("--json") ? JSON.stringify(sc, null, 2) : renderScorecard(sc)) + "\n");
}
