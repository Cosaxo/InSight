// report-lib.mjs — the pure half of the paid report builder (D229).
//
// docs/PAID-PLAN.md §2 is the contract this implements: every number in a
// report must be DERIVABLE FROM WORLD-READABLE DATA, and the honesty rules
// are the app's own — absent is absent (never zero-filled), a thin cell is
// counted rather than placed, and every sampled section states its basis.
// This file is arithmetic and rendering only: no fetch, no fs, no clock,
// so the whole of it is testable without credentials
// (build-report.test.mjs), and the I/O half (build-report.mjs) stays a
// thin shell whose only power is a signed-in user's.
//
// Two deliberate twins, named so drift has an address:
//   · decodeValue mirrors question-scorecard.mjs's decode — same REST wire.
//   · logicBandsFor mirrors src/v2/data/logicSplit.ts (D227): quarters of
//     the verified percentile, untested thins the basis and is never a
//     band. The app's copy is TypeScript and this script is stdlib-only,
//     so the four boundaries are restated here; both cite each other.

// ── Firestore REST decoding ─────────────────────────────────────────────
export function decodeValue(v) {
  if (v == null || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if (v.mapValue) {
    const out = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) out[k] = decodeValue(x);
    return out;
  }
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  return null;
}

export function decodeDoc(fields) {
  return decodeValue({ mapValue: { fields: fields || {} } });
}

// ── the series (PAID-PLAN §2: bucketed from public answeredAt stamps) ───
/**
 * Answers per UTC day, sorted ascending. A day nobody answered is ABSENT
 * from the result — the renderer draws the gap, it does not invent a zero
 * (the pulse store's first honesty rule, applied to a report).
 */
export function bucketByDay(stamps) {
  const days = new Map();
  for (const s of stamps) {
    if (typeof s !== "string" || s.length < 10) continue;
    const day = s.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    days.set(day, (days.get(day) || 0) + 1);
  }
  return [...days.entries()]
    .map(([day, n]) => ({ day, n }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

// ── second thoughts (the D226 matrix, rendered) ─────────────────────────
/**
 * The agg doc's `edits` map as rows, biggest flow first. Moves, not
 * people — the renderer says so, because the matrix's own doctrine is the
 * report's to repeat, not to improve on.
 */
export function flowRows(edits, options) {
  const rows = [];
  for (const [from, tos] of Object.entries(edits || {})) {
    for (const [to, n] of Object.entries(tos || {})) {
      if (!Number.isFinite(n) || n <= 0) continue;
      rows.push({
        from: Number(from), to: Number(to), n,
        fromLabel: options[Number(from)] ?? `option ${from}`,
        toLabel: options[Number(to)] ?? `option ${to}`,
      });
    }
  }
  return rows.sort((a, b) => b.n - a.n || a.from - b.from || a.to - b.to);
}

// ── the breakdown (exact, D98) ──────────────────────────────────────────
/** One dim's buckets with dense per-option counts, biggest bucket first.
 * Absent cells are zero — nothing here is suppressed, so the renderer may
 * print the zero (the inverse of the series rule, and both are D98). */
export function dimRows(by, dim, optionCount) {
  const cells = (by || {})[dim] || {};
  return Object.entries(cells)
    .map(([bucket, cell]) => {
      const counts = Array.from({ length: optionCount }, (_, i) => Number(cell?.[String(i)] || 0));
      return { bucket, n: counts.reduce((a, b) => a + b, 0), counts };
    })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.bucket.localeCompare(b.bucket));
}

// ── the logic cut (the D227 quarters, script twin) ──────────────────────
export const LOGIC_BANDS = [
  { id: "top", label: "Top quarter", lo: 75 },
  { id: "upper", label: "Upper middle", lo: 50 },
  { id: "lower", label: "Lower middle", lo: 25 },
  { id: "bottom", label: "Bottom quarter", lo: 0 },
];

export function logicBandOf(pct) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  for (const b of LOGIC_BANDS) if (pct >= b.lo) return b.id;
  return "bottom";
}

/** voters: [{ optionIdx, logic }] — logic null for the untested, who thin
 * the basis (scoredN vs sampleN) and never become a band. */
export function logicBandsFor(voters, optionCount) {
  const counts = new Map();
  let scoredN = 0;
  for (const v of voters) {
    const band = logicBandOf(v.logic);
    if (!band) continue;
    scoredN += 1;
    let row = counts.get(band);
    if (!row) counts.set(band, (row = Array.from({ length: optionCount }, () => 0)));
    if (v.optionIdx >= 0 && v.optionIdx < optionCount) row[v.optionIdx] += 1;
  }
  return {
    bands: LOGIC_BANDS.map((b) => ({
      band: b.id, label: b.label,
      counts: counts.get(b.id) || Array.from({ length: optionCount }, () => 0),
      n: (counts.get(b.id) || []).reduce((a, c) => a + c, 0),
    })).filter((r) => r.n > 0),
    sampleN: voters.length,
    scoredN,
  };
}

// ── similar questions ───────────────────────────────────────────────────
/** Cosine over the published loading vectors (v2_patterns/loadings —
 * { k, q: { qid: { v, n } } }). Only for questions the fit folded. */
export function cosineNeighbors(loadingsQ, qid, topK = 8) {
  const mine = loadingsQ?.[qid]?.v;
  if (!Array.isArray(mine) || !mine.length) return null;
  const mag = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  const mm = mag(mine);
  if (!mm) return null;
  const out = [];
  for (const [other, entry] of Object.entries(loadingsQ)) {
    if (other === qid || !Array.isArray(entry?.v) || entry.v.length !== mine.length) continue;
    const om = mag(entry.v);
    if (!om) continue;
    const dot = mine.reduce((a, x, i) => a + x * entry.v[i], 0);
    out.push({ qid: other, cos: dot / (mm * om), n: entry.n ?? 0 });
  }
  return out.sort((a, b) => b.cos - a.cos).slice(0, topK);
}

/**
 * Below this many shared voters, an association is a coin toss dressed as
 * a reading and the pair is LISTED as too thin, never scored — the
 * MIN_PLACE_AXES posture, applied to pairs of questions.
 */
export const MIN_SHARED = 30;

/**
 * Association between two questions over their shared voters, as Cramér's
 * V (0..1) — the standard measure for two categoricals, chosen over a
 * correlation coefficient because options are unordered.
 *
 * `a` and `b` are Maps of uid → optionIdx. Returns null under MIN_SHARED
 * or when either question is effectively constant across the shared set
 * (V's denominator needs at least a 2×2 of realized values).
 */
export function cramersV(a, b) {
  const pairs = [];
  for (const [uid, ai] of a) {
    const bi = b.get(uid);
    if (bi !== undefined) pairs.push([ai, bi]);
  }
  const n = pairs.length;
  if (n < MIN_SHARED) return null;
  const aVals = [...new Set(pairs.map((p) => p[0]))];
  const bVals = [...new Set(pairs.map((p) => p[1]))];
  const r = aVals.length;
  const c = bVals.length;
  if (r < 2 || c < 2) return null;
  const idxA = new Map(aVals.map((v, i) => [v, i]));
  const idxB = new Map(bVals.map((v, i) => [v, i]));
  const table = Array.from({ length: r }, () => Array.from({ length: c }, () => 0));
  for (const [ai, bi] of pairs) table[idxA.get(ai)][idxB.get(bi)] += 1;
  const rowSum = table.map((row) => row.reduce((x, y) => x + y, 0));
  const colSum = bVals.map((_, j) => table.reduce((x, row) => x + row[j], 0));
  let chi2 = 0;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const expected = (rowSum[i] * colSum[j]) / n;
      if (expected > 0) chi2 += ((table[i][j] - expected) ** 2) / expected;
    }
  }
  const v = Math.sqrt(chi2 / (n * Math.min(r - 1, c - 1)));
  return { v: Math.min(1, v), n };
}

// ── CSV ─────────────────────────────────────────────────────────────────
export function csv(rows) {
  const cell = (x) => {
    const s = x == null ? "" : String(x);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

// ── HTML ────────────────────────────────────────────────────────────────
export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const pct = (n, total) => (total > 0 ? `${Math.round((100 * n) / total)}%` : "—");

function sectionOptionTable(options, counts, total) {
  const top = counts.indexOf(Math.max(...counts));
  return `<table><thead><tr><th>Option</th><th>Answers</th><th>Share</th></tr></thead><tbody>${
    options.map((label, i) =>
      `<tr${i === top && counts[i] > 0 ? ' class="top"' : ""}><td>${esc(label)}</td><td>${counts[i]}</td><td>${pct(counts[i], total)}</td></tr>`,
    ).join("")
  }</tbody></table>`;
}

/**
 * The whole report as one self-contained HTML page — inline styles, no
 * external asset, nothing fetched at view time. A report is a document a
 * buyer files, not an app; it has to say the same thing in ten years with
 * the server gone.
 *
 * Every sampled section prints its basis, and an absent section prints
 * WHY it is absent — "no edits yet" is a finding, a silently missing
 * heading is a question.
 */
export function renderReport(model) {
  const {
    qid, prompt, options, generatedOn,
    counts, total, series, flows, dims, dimLabels,
    logic, neighbors, associations, voterRows, capNote,
  } = model;

  const sections = [];

  sections.push(`<section><h2>The split</h2>${
    total > 0
      ? sectionOptionTable(options, counts, total)
      : "<p>Nobody has answered this question yet.</p>"
  }<p class="basis">Exact counts, published from the first answer — the same numbers any signed-in user reads in the app (D98).</p></section>`);

  sections.push(`<section><h2>Answers over time</h2>${
    series.length
      ? `<table><thead><tr><th>Day (UTC)</th><th>Answers</th></tr></thead><tbody>${
        series.map((r) => `<tr><td>${esc(r.day)}</td><td>${r.n}</td></tr>`).join("")
      }</tbody></table><p class="basis">Bucketed from each public answer's own timestamp. A day with no row had no answers — gaps are real, never zero-filled.</p>`
      : "<p>No answers yet, so no series.</p>"
  }</section>`);

  sections.push(`<section><h2>Second thoughts</h2>${
    flows.length
      ? `<table><thead><tr><th>First voted</th><th>Moved to</th><th>Moves</th></tr></thead><tbody>${
        flows.map((f) => `<tr><td>${esc(f.fromLabel)}</td><td>${esc(f.toLabel)}</td><td>${f.n}</td></tr>`).join("")
      }</tbody></table><p class="basis">The question's public edit-flow matrix (D226). It counts moves, not people — someone who edited twice appears under two pairs — and it accrues from 2026-08-22; edits before that date were never recorded.</p>`
      : "<p>Nobody has changed their answer on this question — or not since the matrix began accruing (2026-08-22).</p>"
  }</section>`);

  const dimBlocks = dims
    .filter((d) => d.rows.length)
    .map((d) => `<h3>${esc(dimLabels[d.dim] || d.dim)}</h3><table><thead><tr><th>Group</th><th>Answers</th>${
      options.map((o) => `<th>${esc(o)}</th>`).join("")
    }</tr></thead><tbody>${
      d.rows.map((r) => `<tr><td>${esc(r.bucket)}</td><td>${r.n}</td>${
        r.counts.map((c) => `<td>${c} (${pct(c, r.n)})</td>`).join("")
      }</tr>`).join("")
    }</tbody></table>`).join("");
  sections.push(`<section><h2>Who answered, by group</h2>${
    dimBlocks || "<p>No answer here carried profile details yet, so there are no group cells.</p>"
  }<p class="basis">The published per-cohort cells, exact at any size, cut by the profile snapshot each answer froze at vote time (D8). An absent group has zero answers — nothing is withheld.</p></section>`);

  sections.push(`<section><h2>By verified logic score</h2>${
    logic.bands.length
      ? `<table><thead><tr><th>Band</th><th>Answers</th>${options.map((o) => `<th>${esc(o)}</th>`).join("")}</tr></thead><tbody>${
        logic.bands.map((b) => `<tr><td>${esc(b.label)}</td><td>${b.n}</td>${
          b.counts.map((c) => `<td>${c} (${pct(c, b.n)})</td>`).join("")
        }</tr>`).join("")
      }</tbody></table>`
      : "<p>No voter here carries a verified logic score yet.</p>"
  }<p class="basis">Of ${logic.sampleN} voters read, ${logic.scoredN} carry a verified score; bands are quarters of its percentile (D227). The untested thin the basis and are never a band.</p></section>`);

  const simBody = [];
  if (neighbors?.length) {
    simBody.push(`<h3>Nearest by answering pattern (the nightly fit)</h3><table><thead><tr><th>Question</th><th>Similarity</th><th>Answers behind it</th></tr></thead><tbody>${
      neighbors.map((nb) => `<tr><td>${esc(nb.prompt || nb.qid)}</td><td>${nb.cos.toFixed(2)}</td><td>${nb.n}</td></tr>`).join("")
    }</tbody></table>`);
  }
  if (associations?.scored?.length || associations?.thin) {
    simBody.push(`<h3>Association over shared voters</h3>${
      associations.scored.length
        ? `<table><thead><tr><th>Question</th><th>Cram&eacute;r's V</th><th>Shared voters</th></tr></thead><tbody>${
          associations.scored.map((a) => `<tr><td>${esc(a.prompt || a.qid)}</td><td>${a.v.toFixed(2)}</td><td>${a.n}</td></tr>`).join("")
        }</tbody></table>`
        : ""
    }<p class="basis">Computed at build time from public answers, over the voters this question and each core question share. ${associations.thin} pair(s) had fewer than ${MIN_SHARED} shared voters and are counted here rather than scored.</p>`);
  }
  sections.push(`<section><h2>Most similar questions</h2>${
    simBody.length ? simBody.join("") : "<p>The pattern fit has not published yet and too few voters are shared with the core bank — this section fills in as the question collects answers.</p>"
  }</section>`);

  sections.push(`<section><h2>Who voted</h2><p>${voterRows} voter row(s) — the full roll, with names, picks, vote-time profile snapshots and logic scores, is in <code>voters.csv</code> beside this file.${capNote ? ` ${esc(capNote)}` : ""}</p><p class="basis">Answers are public and attributed (D98); this packages what any signed-in user could read, and nothing else.</p></section>`);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>InSight report — ${esc(qid)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 40px auto; max-width: 760px; padding: 0 16px; color: #1c1b1a; background: #fdfcfa; }
  h1 { font-size: 22px; line-height: 1.3; } h2 { font-size: 16px; margin-top: 34px; border-bottom: 1px solid #d9d5cf; padding-bottom: 5px; }
  h3 { font-size: 13.5px; margin: 18px 0 6px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: 5px 10px 5px 0; border-bottom: 1px solid #eceae6; font-variant-numeric: tabular-nums; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6d6862; }
  tr.top td { font-weight: 700; }
  .basis { font-size: 12px; color: #6d6862; line-height: 1.5; }
  .meta { font-size: 12.5px; color: #6d6862; }
  code { background: #f0eee9; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
</style></head><body>
<h1>${esc(prompt)}</h1>
<p class="meta">InSight report &middot; question <code>${esc(qid)}</code> &middot; built ${esc(generatedOn)} &middot; every figure in this document is derivable from data any signed-in user of the app can read.</p>
${sections.join("\n")}
</body></html>`;
}
