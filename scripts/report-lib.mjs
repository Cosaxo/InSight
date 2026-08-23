// report-lib.mjs — the question report builder (PAID-PLAN §2, §9.2 v1).
//
// Assembles and renders the report a buyer gets: one self-contained HTML
// page plus the CSV bundle (roll · edits · series). Run by hand per
// contract through scripts/build-report.mjs; exercised end-to-end against
// the emulated backend in firestore-tests/e2e-v2-loop.mjs §7g.
//
// THE ONE RULE, and the shape that holds it: every number must be
// derivable from world-readable data (PAID-PLAN §2; D225 removed the
// delivery promise and left exactly this). Two layers enforce it:
//
//   1. The caller signs in as an ANONYMOUS user and reads through the
//      client SDK, so `firestore.rules` itself refuses anything a
//      signed-in user could not read — the builder has no privileged
//      path to leak. (An admin-SDK builder would make the rule a
//      discipline; this makes it a property.)
//   2. `makeReader` refuses any collection not named in REPORT_READ_SET,
//      and counts what it touched (`reader.stats`), so the read set is a
//      tested list rather than a habit. scripts/report.test.mjs pins the
//      refusal; e2e §7g asserts a real build stayed inside the list.
//
// The DESIGN is the 2026-08-22 standalone's paid-report.jsx
// (design/standalone-2026-08-22/ — extracted per design/README.md's
// rule that uploads are ephemeral and the directory is the record).
// Sections, copy voice and the honesty states are its: an empty bucket
// is "none yet — still listed", a thin cell prints "shown exactly", and
// nothing is suppressed, because exact-from-the-first-answer is the
// product (D98). Two of the mock's rows do NOT ship, each for a stated
// reason the decision records carry:
//
//   · The per-AXIS five-band dims (the mock's "Big Five · Openness"
//     rows): the mock's bands are its own population-shaping numbers,
//     not a vocabulary the app anywhere defines — banding an axis is a
//     design decision nobody has taken, so the rows wait for it rather
//     than shipping an invented scale. (The TYPE cuts themselves ship:
//     permitted at D232, buildable at D233.)
//   · District / field-of-study rows — no such data exists anywhere.
//
// What DOES cut: the census dims from the aggregate's `by` map (exact,
// complete), Job folded from the roll's public vote-time snapshots
// (profession is deliberately never a SERVER dim — D8 — but the
// snapshots are world-readable and the fold is the reader's own
// arithmetic, the D146 class), the logic quarters (D227's bands), and —
// since D233 — the four instruments' TYPE cuts, run through the app's
// own matcher over the public testResults (permitted by D232's promise
// removal; buildable once the archetype module left the bridge).
//
// Twins, each pinned by scripts/report.test.mjs rather than imported:
// the client modules that own these (voters.ts, logicSplit.ts,
// similarity.ts) sit behind import chains that touch `window`/live.ts,
// so a direct import cannot load under node. The test reads the sources
// and fails when a twin drifts. The archetype MATCHER is not a twin:
// since D233's bridge conversion the module loads under plain node, so
// the report runs the app's own matcher on the app's own signatures.
import { ARCHETYPES, IS_matchArchetype } from "../src/v2/spec/archetype-data.js";

// ── twins (pinned to their client sources by report.test.mjs) ────────

/** voters.ts WORLD_ANSWER_SURFACES — the rules' collection-group value
 * test; a surface the rule does not list fails the whole query closed. */
export const WORLD_ANSWER_SURFACES = ["daily", "feed", "test", "learn", "pulse", "call"];

/** logicSplit.ts LOGIC_BANDS — top first, `lo` inclusive. */
export const LOGIC_BANDS = [
  { id: "top", label: "Top quarter", lo: 75 },
  { id: "upper", label: "Upper middle", lo: 50 },
  { id: "lower", label: "Lower middle", lo: 25 },
  { id: "bottom", label: "Bottom quarter", lo: 0 },
];

/** logicSplit.ts logicBandOf — a type test, not a null test, so a row
 * that never carried the field reads as untested rather than bottom. */
export function logicBandOf(pct) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  for (const b of LOGIC_BANDS) if (pct >= b.lo) return b.id;
  return "bottom";
}

/** similarity.ts parseLogicPct — testResults.logic.pctile, rounded and
 * clamped to 0..100, null for anything unusable. */
export function parseLogicPct(raw) {
  if (!raw || typeof raw !== "object") return null;
  const logic = raw.logic;
  if (!logic || typeof logic !== "object") return null;
  const pct = Number(logic.pctile);
  if (!Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** similarity.ts parseTestResults, one instrument's arm, in the dims-array
 * shape the matcher takes — same defensive read, same clamps, pinned
 * against the real parse by the test. */
export function parseTestDims(raw, kind) {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw[kind];
  if (!entry || typeof entry !== "object") return null;
  const dims = entry.dims;
  if (!Array.isArray(dims)) return null;
  const out = [];
  for (const d of dims.slice(0, 12)) {
    if (!d || typeof d !== "object") continue;
    const id = d.id;
    const value = Number(d.value);
    if (typeof id !== "string" || !id || !Number.isFinite(value)) continue;
    out.push({ id, value: Math.max(0, Math.min(100, Math.round(value))) });
  }
  return out.length ? out : null;
}

/** The four instruments the report cuts by, with the names the app shows
 * (similarity.ts CORE_TEST_KINDS, display names per data-inventory).
 * Permitted since D232 removed the never-group promise; buildable since
 * D233 put the matcher within reach of node. */
export const REPORT_TYPE_CUTS = [
  ["big5", "Big Five"],
  ["political", "Politics"],
  ["values", "Values"],
  ["attachment", "Social"],
];

// ── bounds (each stated on the page wherever it binds) ───────────────

/** Collection-group page size; termination is on a short page, never on
 * a count believed in advance (the bank fetch's own argument, D161). */
export const ROLL_PAGE = 300;
/** Firestore `in` cap — voters.ts UID_CHUNK. */
export const UID_CHUNK = 30;
/** Voters joined for the neighbour ranking — most recent first, because
 * the roll walk is already newest-first (the app's own recency bias,
 * stated as the basis). */
export const NEIGHBOUR_SAMPLE = 300;
/** Shared-voter floor under which a pair says nothing — the exact-pair
 * card's own floor (PATTERNS.say is silent under 12 in both samples). */
export const NEIGHBOUR_MIN_SHARED = 12;
export const NEIGHBOURS_SHOWN = 5;
/** Below this many people a row states its own size ("shown exactly"). */
export const THIN_EXACT = 8;
/** From→to rows printed on the page; the full matrix is edits.csv. */
export const EDIT_PAIRS_SHOWN = 8;

/** Root collections (plus the `answers` collection group) the builder
 * may touch. Everything here is `allow read: if request.auth != null` in
 * firestore.rules; the guard below refuses the rest by name. */
export const REPORT_READ_SET = Object.freeze([
  "v2_questions",
  "v2_question_aggs",
  "v2_users",
  "answers", // the collection group under v2_users/{uid}
]);

// ── the guarded reader ───────────────────────────────────────────────

/**
 * Wrap an injected client-SDK surface so every access names its
 * collection and the off-list ones throw before any request is made.
 *
 * `fs` is { db, collection, collectionGroup, doc, getDoc, getDocs,
 * query, where, orderBy, limit, startAfter, documentId } — passed in so
 * the CLI, the e2e harness and the unit tests hand in the SDK (or a
 * fake) they already hold, and this module imports no Firebase at all.
 */
/** The guard itself, exported so the test can pin the refusal. */
export function assertReadable(name) {
  if (!REPORT_READ_SET.includes(name)) {
    throw new Error(
      `report reader refused collection "${name}" — not in REPORT_READ_SET. ` +
      `A report must be derivable from world-readable data (PAID-PLAN §2).`,
    );
  }
}

export function makeReader(fs) {
  const stats = { reads: {}, queries: 0 };
  const touch = (name, n) => {
    assertReadable(name);
    stats.reads[name] = (stats.reads[name] || 0) + n;
  };

  async function getDocById(colName, id) {
    touch(colName, 1);
    stats.queries += 1;
    const snap = await fs.getDoc(fs.doc(fs.db, colName, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  return {
    stats,
    getQuestion: (qid) => getDocById("v2_questions", qid),
    getAgg: (qid) => getDocById("v2_question_aggs", qid),

    /** The full who-voted roll — the app's exact query (voters.ts),
     * walked to the end from its own cursor: the D101 rule's paging
     * answer instead of its cap. */
    async walkRoll(qid) {
      const rows = [];
      let cursor = null;
      for (;;) {
        const parts = [
          fs.collectionGroup(fs.db, "answers"),
          fs.where("qid", "==", qid),
          fs.where("surface", "in", [...WORLD_ANSWER_SURFACES]),
          fs.orderBy("answeredAt", "desc"),
          fs.limit(ROLL_PAGE),
        ];
        if (cursor) parts.push(fs.startAfter(cursor));
        stats.queries += 1;
        const snap = await fs.getDocs(fs.query(...parts));
        touch("answers", snap.docs.length);
        for (const d of snap.docs) {
          const path = d.ref.path.split("/");
          const i = path.indexOf("v2_users");
          const uid = i >= 0 ? path[i + 1] : null;
          const optionIdx = d.get("optionIdx");
          // catalog answers carry `entity`, not `optionIdx` (voters.ts
          // skips them the same way — a different surface, a different
          // renderer, and not a column to coerce into).
          if (!uid || typeof optionIdx !== "number") continue;
          rows.push({
            uid,
            optionIdx,
            anchors: d.get("anchors") || {},
            answeredAt: tsToDate(d.get("answeredAt")),
            editedAt: tsToDate(d.get("editedAt")),
          });
        }
        if (snap.docs.length < ROLL_PAGE) return rows;
        cursor = snap.docs[snap.docs.length - 1];
      }
    },

    /** uid → { name, logic } from the public profiles, chunked on the
     * `in` cap the way voters.ts resolves names. */
    async getProfiles(uids) {
      const out = {};
      const seen = new Set();
      const flat = uids.filter((u) => u && !seen.has(u) && seen.add(u));
      for (let i = 0; i < flat.length; i += UID_CHUNK) {
        const chunk = flat.slice(i, i + UID_CHUNK);
        stats.queries += 1;
        const snap = await fs.getDocs(fs.query(
          fs.collection(fs.db, "v2_users"),
          fs.where(fs.documentId(), "in", chunk),
        ));
        touch("v2_users", snap.docs.length);
        for (const d of snap.docs) {
          const n = d.get("displayName");
          const tests = d.get("testResults");
          out[d.id] = {
            name: typeof n === "string" ? n.trim().slice(0, 60) : "",
            logic: parseLogicPct(tests),
            tests: tests ?? null,
          };
        }
        for (const u of chunk) if (!(u in out)) out[u] = { name: "", logic: null, tests: null };
      }
      return out;
    },

    /** One voter's answers to the candidate questions, by document id —
     * the answers subcollection is keyed by qid, so this is a batched
     * exact-id read, never a scan.
     *
     * The rules' answers read is `owner || surface in […]` — a VALUE
     * test a list query must carry a matching filter for, or be refused
     * wholesale (the rule's own D65 comment). Two shapes were measured
     * against the emulator before this one (the probe is in this
     * change's history): a `documentId() in` filter is one the rules
     * engine will not prove field filters across, so the id constraint
     * rides on the `qid` FIELD instead — the schema pins qid == doc id,
     * so the two are the same read. The surface arm is an EQUALITY, one
     * query per candidate surface (30 ids × 1 = 30 disjunctions, the
     * cap; a second `in` would blow it at this chunk size), and the
     * candidates are daily/feed by the patterns predicate anyway. */
    async getAnswersFor(uid, qids) {
      const out = {};
      for (let i = 0; i < qids.length; i += UID_CHUNK) {
        const chunk = qids.slice(i, i + UID_CHUNK);
        for (const surface of ["daily", "feed"]) {
          stats.queries += 1;
          const snap = await fs.getDocs(fs.query(
            fs.collection(fs.db, "v2_users", uid, "answers"),
            fs.where("qid", "in", chunk),
            fs.where("surface", "==", surface),
          ));
          touch("answers", snap.docs.length);
          for (const d of snap.docs) {
            const idx = d.get("optionIdx");
            if (typeof idx === "number") out[d.id] = idx;
          }
        }
      }
      return out;
    },

    /** The neighbour corpus: the patterns fit's own predicate (D161 —
     * two options, daily or core feed), applied to the bank directly so
     * there is no second list to drift. */
    async listPatternCandidates(exceptQid) {
      const out = [];
      for (const surface of ["daily", "feed"]) {
        stats.queries += 1;
        const snap = await fs.getDocs(fs.query(
          fs.collection(fs.db, "v2_questions"),
          fs.where("surface", "==", surface),
        ));
        touch("v2_questions", snap.docs.length);
        for (const d of snap.docs) {
          const q = d.data();
          if (d.id === exceptQid) continue;
          if (!Array.isArray(q.options) || q.options.length !== 2) continue;
          if (surface === "feed" && q.core !== true) continue;
          if (q.active === false) continue;
          out.push({ id: d.id, prompt: q.prompt || d.id, options: q.options });
        }
      }
      return out;
    },
  };
}

const tsToDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  return null;
};

// ── pure folds ───────────────────────────────────────────────────────

export const fmt = (n) => Number(n || 0).toLocaleString("en-US");

/** The edits matrix as printable pairs, biggest move first. */
export function editPairs(edits) {
  const pairs = [];
  for (const [from, row] of Object.entries(edits || {})) {
    for (const [to, n] of Object.entries(row || {})) {
      if (typeof n === "number" && n > 0) pairs.push({ from: Number(from), to: Number(to), n });
    }
  }
  pairs.sort((a, b) => b.n - a.n || a.from - b.from || a.to - b.to);
  return pairs;
}

/** Net movement per option: inflow − outflow, dense to optionCount. */
export function editNet(edits, optionCount) {
  const net = Array.from({ length: Math.max(0, optionCount) }, () => 0);
  for (const p of editPairs(edits)) {
    if (p.from >= 0 && p.from < net.length) net[p.from] -= p.n;
    if (p.to >= 0 && p.to < net.length) net[p.to] += p.n;
  }
  return net;
}

export const totalMoves = (edits) => editPairs(edits).reduce((a, p) => a + p.n, 0);

/** UTC day key — the pulse machinery's grain, and the honest one for
 * stamps that are themselves UTC server times. */
export const utcDay = (d) => d.toISOString().slice(0, 10);

/** Answers per UTC day, per CURRENT option, oldest day first. The stamp
 * is answeredAt — frozen at first answer (D86), so the series reads
 * "when people first answered", with each bar split by where their
 * answer stands now. The page's basis line says exactly that. */
export function seriesFromRoll(roll, optionCount) {
  const byDay = new Map();
  for (const r of roll) {
    if (!r.answeredAt) continue;
    const key = utcDay(r.answeredAt);
    if (!byDay.has(key)) byDay.set(key, Array.from({ length: optionCount }, () => 0));
    const counts = byDay.get(key);
    if (r.optionIdx >= 0 && r.optionIdx < optionCount) counts[r.optionIdx] += 1;
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, counts]) => ({ day, counts, t: counts.reduce((a, b) => a + b, 0) }));
}

/**
 * One dim's rows from the aggregate's `by` map — exact, complete, a
 * census. `vocab` (when the dim has a closed one) lists the empty
 * buckets too: an absent cell is ZERO, not withheld (D98), and the
 * design's rule is that an empty bucket stays listed. Open dims (city,
 * country) list observed buckets only — nobody can enumerate every city.
 */
export function dimRowsFromBy(byDim, optionCount, total, vocab) {
  const rows = [];
  const seen = new Set();
  const rowFor = (label, cell) => {
    const counts = Array.from({ length: optionCount }, (_, i) => (cell || {})[String(i)] || 0);
    return { label, counts, t: counts.reduce((a, b) => a + b, 0) };
  };
  for (const label of vocab || []) {
    seen.add(label);
    rows.push(rowFor(label, (byDim || {})[label]));
  }
  for (const [label, cell] of Object.entries(byDim || {})) {
    if (!seen.has(label)) rows.push(rowFor(label, cell));
  }
  if (!vocab) rows.sort((a, b) => b.t - a.t || (a.label < b.label ? -1 : 1));
  const shared = rows.reduce((a, r) => a + r.t, 0);
  return { rows, shared, notShared: Math.max(0, total - shared) };
}

/** One dim folded from the roll's own vote-time snapshots — for the
 * anchors the server deliberately publishes no cells for (profession,
 * D8). Same arithmetic any signed-in reader could run. */
export function dimRowsFromRoll(roll, anchorKey, optionCount) {
  const byLabel = new Map();
  for (const r of roll) {
    const v = r.anchors ? r.anchors[anchorKey] : null;
    if (typeof v !== "string" || !v) continue;
    if (!byLabel.has(v)) byLabel.set(v, Array.from({ length: optionCount }, () => 0));
    const counts = byLabel.get(v);
    if (r.optionIdx >= 0 && r.optionIdx < optionCount) counts[r.optionIdx] += 1;
  }
  const rows = [...byLabel.entries()]
    .map(([label, counts]) => ({ label, counts, t: counts.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.t - a.t || (a.label < b.label ? -1 : 1));
  const shared = rows.reduce((a, r) => a + r.t, 0);
  return { rows, shared, notShared: Math.max(0, roll.length - shared) };
}

/** The logic cut: the roll grouped by verified band, quarters first,
 * untested last — listed, never dropped (D227's shape). */
export function logicCut(roll, profiles, optionCount) {
  const rowFor = (label) => ({ label, counts: Array.from({ length: optionCount }, () => 0), t: 0 });
  const rows = LOGIC_BANDS.map((b) => rowFor(b.label));
  const untested = rowFor("Untested");
  let verified = 0;
  for (const r of roll) {
    const band = logicBandOf((profiles[r.uid] || {}).logic);
    const row = band ? rows[LOGIC_BANDS.findIndex((b) => b.id === band)] : untested;
    if (band) verified += 1;
    row.t += 1;
    if (r.optionIdx >= 0 && r.optionIdx < optionCount) row.counts[r.optionIdx] += 1;
  }
  return { rows: [...rows, untested], verified };
}

/** One instrument's type name for a voter, or null for the untested —
 * the app's own nearest-signature matcher over the public result. */
export function typeNameOf(tests, kind) {
  const dims = parseTestDims(tests, kind);
  if (!dims) return null;
  const hit = IS_matchArchetype(kind, dims);
  return hit ? hit.list[hit.idx].name : null;
}

/** The type cut: the roll grouped by matched archetype on one
 * instrument — every named type listed (empty ones at zero, the
 * design's rule), untested last as a full row, never dropped. */
export function typeCut(roll, profiles, kind, optionCount) {
  const sys = ARCHETYPES[kind];
  const rowFor = (label) => ({ label, counts: Array.from({ length: optionCount }, () => 0), t: 0 });
  const rows = sys.list.map((a) => rowFor(a.name));
  const byName = new Map(rows.map((r) => [r.label, r]));
  const untested = rowFor("Untested");
  let tested = 0;
  for (const r of roll) {
    const name = typeNameOf((profiles[r.uid] || {}).tests, kind);
    const row = name ? byName.get(name) : untested;
    if (name) tested += 1;
    if (!row) continue;
    row.t += 1;
    if (r.optionIdx >= 0 && r.optionIdx < optionCount) row.counts[r.optionIdx] += 1;
  }
  return { rows: [...rows, untested], tested };
}

/** Cramér's V between the main question and one candidate over the
 * joined sample — for 2×2 (the patterns predicate guarantees the
 * candidate side) this is |phi|. */
export function cramersV(pairs, rMain, rCand) {
  const n = pairs.length;
  if (!n) return 0;
  const rowT = Array.from({ length: rMain }, () => 0);
  const colT = Array.from({ length: rCand }, () => 0);
  const cell = Array.from({ length: rMain }, () => Array.from({ length: rCand }, () => 0));
  for (const [a, b] of pairs) {
    if (a < 0 || a >= rMain || b < 0 || b >= rCand) continue;
    rowT[a] += 1; colT[b] += 1; cell[a][b] += 1;
  }
  let chi2 = 0;
  for (let i = 0; i < rMain; i++) {
    for (let j = 0; j < rCand; j++) {
      const e = (rowT[i] * colT[j]) / n;
      if (e > 0) chi2 += ((cell[i][j] - e) ** 2) / e;
    }
  }
  const k = Math.min(rMain, rCand) - 1;
  return k > 0 ? Math.sqrt(chi2 / (n * k)) : 0;
}

/** Per main-option conditional mode at the candidate: among this
 * question's voters for option i who also answered the neighbour, what
 * most of them chose there — the design card's own sentence. */
export function condModes(pairs, rMain, candOptions) {
  const out = [];
  for (let i = 0; i < rMain; i++) {
    const counts = Array.from({ length: candOptions.length }, () => 0);
    let n = 0;
    for (const [a, b] of pairs) {
      if (a !== i || b < 0 || b >= counts.length) continue;
      counts[b] += 1; n += 1;
    }
    if (!n) { out.push(null); continue; }
    const best = counts.indexOf(Math.max(...counts));
    out.push({ label: candOptions[best], pct: Math.round((counts[best] / n) * 100), n });
  }
  return out;
}

// ── assembly ─────────────────────────────────────────────────────────

/**
 * Build the report's data from a guarded reader. `vocab` is
 * { dims: BREAKDOWN_DIMS, byDim: BREAKDOWN_DIM_VOCAB } handed in from
 * functions/lib/pure.js by both call sites — injected so this module
 * never grows a second copy of a list check:anchors already guards.
 */
export async function buildReportData(reader, { qid, vocab, now = new Date(), neighbourSample = NEIGHBOUR_SAMPLE }) {
  const question = await reader.getQuestion(qid);
  if (!question) throw new Error(`question ${qid} does not exist`);
  const options = (question.options || []).map((o) => (typeof o === "string" ? o : o.label || String(o)));
  if (options.length < 2) throw new Error(`question ${qid} has no options to report on`);

  const agg = (await reader.getAgg(qid)) || {};
  const counts = Array.from({ length: options.length }, (_, i) => (agg.counts || {})[String(i)] || 0);
  const total = typeof agg.total === "number" ? agg.total : counts.reduce((a, b) => a + b, 0);

  const roll = await reader.walkRoll(qid);
  const profiles = await reader.getProfiles(roll.map((r) => r.uid));

  const dims = (vocab.dims || []).map((dim) => ({
    key: dim,
    ...dimRowsFromBy((agg.by || {})[dim], options.length, total, vocab.byDim ? vocab.byDim[dim] : undefined),
  }));
  const job = dimRowsFromRoll(roll, "profession", options.length);

  const pairsList = editPairs(agg.edits);
  const logic = logicCut(roll, profiles, options.length);
  const typeCuts = REPORT_TYPE_CUTS.map(([kind, title]) => (
    { kind, title, ...typeCut(roll, profiles, kind, options.length) }
  ));

  // neighbours — a bounded joined sample, most recent voters first
  const sample = roll.slice(0, neighbourSample);
  const candidates = await reader.listPatternCandidates(qid);
  const joined = new Map(); // candidate qid → [ [mainIdx, candIdx] ]
  for (const voter of sample) {
    const theirs = await reader.getAnswersFor(voter.uid, candidates.map((c) => c.id));
    for (const [cid, idx] of Object.entries(theirs)) {
      if (!joined.has(cid)) joined.set(cid, []);
      joined.get(cid).push([voter.optionIdx, idx]);
    }
  }
  const neighbours = candidates
    .map((c) => {
      const pairs = joined.get(c.id) || [];
      if (pairs.length < NEIGHBOUR_MIN_SHARED) return null;
      return {
        prompt: c.prompt,
        shared: pairs.length,
        v: cramersV(pairs, options.length, c.options.length),
        modes: condModes(pairs, options.length, c.options.map((o) => (typeof o === "string" ? o : o.label))),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.v - a.v || b.shared - a.shared)
    .slice(0, NEIGHBOURS_SHOWN);

  return {
    qid,
    prompt: question.prompt || qid,
    options,
    sponsor: question.sponsor || null,
    until: question.until || null,
    counts,
    total,
    roll: roll.map((r) => {
      const p = profiles[r.uid] || {};
      return {
        name: p.name || "",
        optionIdx: r.optionIdx,
        anchors: r.anchors,
        answeredAt: r.answeredAt ? r.answeredAt.toISOString() : "",
        editedAt: r.editedAt ? r.editedAt.toISOString() : "",
        logicBand: logicBandOf(p.logic),
        types: Object.fromEntries(REPORT_TYPE_CUTS.map(([kind]) => [kind, typeNameOf(p.tests, kind)])),
      };
    }),
    dims,
    job,
    edits: { pairs: pairsList, net: editNet(agg.edits, options.length), moves: totalMoves(agg.edits) },
    series: seriesFromRoll(roll, options.length),
    logic,
    typeCuts,
    neighbours,
    neighbourBasis: { sampled: sample.length, candidates: candidates.length, floor: NEIGHBOUR_MIN_SHARED },
    generatedAt: now.toISOString(),
    stats: reader.stats,
  };
}

// ── rendering ────────────────────────────────────────────────────────

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

/** roll.csv · edits.csv · series.csv — the bundle beside the page. */
export function renderCsvs(data) {
  const anchorKeys = [...new Set(data.roll.flatMap((r) => Object.keys(r.anchors || {})))].sort();
  const roll = toCsv([
    ["name", "option", ...anchorKeys, "answeredAt", "editedAt", "logicBand",
      ...REPORT_TYPE_CUTS.map(([, title]) => `${title} type`)],
    ...data.roll.map((r) => [
      r.name, data.options[r.optionIdx] ?? r.optionIdx,
      ...anchorKeys.map((k) => (r.anchors || {})[k] || ""),
      r.answeredAt, r.editedAt, r.logicBand || "untested",
      ...REPORT_TYPE_CUTS.map(([kind]) => (r.types || {})[kind] || "untested"),
    ]),
  ]);
  const edits = toCsv([
    ["from", "to", "moves"],
    ...data.edits.pairs.map((p) => [data.options[p.from] ?? p.from, data.options[p.to] ?? p.to, p.n]),
  ]);
  const series = toCsv([
    ["day", ...data.options, "total"],
    ...data.series.map((d) => [d.day, ...d.counts, d.t]),
  ]);
  return { roll, edits, series };
}

// The app's accent family (src/v2/styles.css) — one lightness, one
// chroma, so any pair or cycle of these reads as one system. Order puts
// the report's two-option case on the design's own indigo/sienna.
export const OPTION_HUES = [235, 40, 150, 85, 8, 195, 282];
const hue = (i) => `oklch(0.52 0.14 ${OPTION_HUES[i % OPTION_HUES.length]})`;
const hueInk = (i) => `color-mix(in oklch, ${hue(i)}, var(--ink) 12%)`;

const K = `font-size:10.5px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--ink-3)`;
const BASIS = `margin-top:12px;padding-top:8px;border-top:1px solid color-mix(in oklch, var(--rule) 62%, transparent);font-size:11px;font-weight:600;color:var(--ink-3);line-height:1.5`;

const kicker = (title, right) =>
  `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">` +
  `<span style="${K}">${esc(title)}</span>` +
  (right ? `<span style="font-size:10.5px;font-weight:600;color:var(--ink-3);text-align:right">${right}</span>` : "") +
  `</div>`;

const legend = (options) =>
  `<span style="display:inline-flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end">` +
  options.map((label, i) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:var(--ink-3)">` +
    `<span style="width:8px;height:8px;border-radius:50%;background:${hue(i)}"></span>${esc(label)}</span>`,
  ).join("") + `</span>`;

const stackBar = (counts, h) => {
  const t = counts.reduce((a, b) => a + b, 0);
  const segs = t > 0
    ? counts.map((n, i) => (n > 0 ? `<div style="width:${(n / t) * 100}%;background:${hue(i)}"></div>` : "")).join("")
    : "";
  return `<div style="height:${h}px;border-radius:999px;background:var(--surface-3);overflow:hidden;display:flex;gap:2px">${segs}</div>`;
};

// One bucket line: label + counts above, bar below; thin and empty cells
// stated in the design's own words.
const bucketRow = (r) => {
  const nums = r.t === 0
    ? `<span style="color:var(--ink)">0</span><span style="font-weight:600;color:var(--ink-3)"> · none yet — still listed</span>`
    : r.counts.map((n, i) => `<span style="color:${hueInk(i)}">${fmt(n)}</span>`).join(`<span style="font-weight:600;color:var(--ink-3)"> · </span>`) +
      (r.t < THIN_EXACT ? `<span style="font-weight:600;color:var(--ink-3)"> · ${r.t} ${r.t === 1 ? "person" : "people"} — shown exactly</span>` : "");
  return `<div style="margin-top:9px">` +
    `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">` +
    `<span style="font-size:12.5px;font-weight:650;color:var(--ink-2);min-width:0">${esc(r.label)}</span>` +
    `<span style="flex-shrink:0;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums">${nums}</span>` +
    `</div><div style="margin-top:5px">${stackBar(r.counts, 10)}</div></div>`;
};

const card = (body, style) => `<div class="card"${style ? ` style="${style}"` : ""}>${body}</div>`;

const DIM_TITLES = {
  ageBand: "Age band", gender: "Gender", city: "City", country: "Country",
  education: "Education — level", relationship: "Relationship", heightBand: "Height band",
};

/** The report page — the 2026-08-22 standalone's paid-report.jsx,
 * translated to static HTML: same cards, same copy voice, same honesty
 * states, `<details>` standing in for the accordion. */
export function renderReportHtml(data) {
  const { options, counts, total } = data;
  const day = data.generatedAt.slice(0, 10);

  const masthead = data.sponsor
    ? card(
      `<div style="display:flex;align-items:center;gap:10px;padding:9px 15px;background:var(--ink);color:var(--surface)">` +
      `<span style="width:10px;height:10px;border-radius:2px;background:var(--surface);flex-shrink:0"></span>` +
      `<span style="font-size:12px;font-weight:800;letter-spacing:0.16em;flex-shrink:0">PAID</span>` +
      (data.sponsor.buyer
        ? `<span style="width:1px;height:13px;background:color-mix(in oklch, var(--surface) 42%, transparent);flex-shrink:0"></span>` +
          `<span style="font-size:13.5px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">asked by ${esc(data.sponsor.buyer)}</span>`
        : "") +
      `</div>` +
      `<div style="padding:14px 16px 15px">` +
      `<div style="font-size:19px;font-weight:800;letter-spacing:-0.02em;line-height:1.22;color:var(--ink)">${esc(data.prompt)}</div>` +
      `<div style="margin-top:9px;font-size:12px;font-weight:600;color:var(--ink-3)">${data.until ? `asked until ${esc(data.until)} · ` : ""}report generated ${day}</div>` +
      `</div>`,
      "padding:0;overflow:hidden")
    : card(
      `<div style="font-size:19px;font-weight:800;letter-spacing:-0.02em;line-height:1.22;color:var(--ink)">${esc(data.prompt)}</div>` +
      `<div style="margin-top:9px;font-size:12px;font-weight:600;color:var(--ink-3)">a question from the public bank · report generated ${day}</div>`);

  const split = card(
    kicker("The split", "each person&rsquo;s latest answer") +
    `<div style="margin-top:10px;display:flex;align-items:baseline;gap:8px">` +
    `<span style="font-size:30px;font-weight:800;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)">${fmt(total)}</span>` +
    `<span style="font-size:12.5px;font-weight:600;color:var(--ink-2)">answers · one per person</span></div>` +
    options.map((label, i) =>
      `<div style="margin-top:11px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">` +
      `<span style="font-size:13.5px;font-weight:750;color:var(--ink)">${esc(label)}</span>` +
      `<span style="font-size:12.5px;font-variant-numeric:tabular-nums"><span style="font-weight:700;color:var(--ink)">${fmt(counts[i])}</span>` +
      `<span style="color:var(--ink-3)"> · </span><span style="font-weight:800;color:${hueInk(i)}">${total ? Math.round((counts[i] / total) * 100) : 0}%</span></span></div>` +
      `<div style="margin-top:5px;height:12px;border-radius:999px;background:var(--surface-3);overflow:hidden">` +
      `<div style="width:${total ? (counts[i] / total) * 100 : 0}%;height:100%;border-radius:999px;background:${hue(i)}"></div></div></div>`,
    ).join(""));

  const maxDay = Math.max(1, ...data.series.map((d) => d.t));
  let cum = 0;
  const pts = data.series.map((d, i) => {
    cum += d.t;
    return `${(((i + 0.5) / data.series.length) * 100).toFixed(1)},${(58 - (cum / Math.max(1, total)) * 50).toFixed(1)}`;
  }).join(" ");
  const seriesCard = data.series.length === 0
    ? card(kicker("Answers over time") + `<div style="${BASIS};border-top:none;padding-top:2px">No answers yet — the series starts with the first one.</div>`)
    : card(
      kicker("Answers over time", legend(options)) +
      `<div style="position:relative;height:58px;margin-top:14px"><div style="position:absolute;inset:0;display:flex;align-items:flex-end;gap:4px">` +
      data.series.map((d) => {
        const h = 5 + (d.t / maxDay) * 34;
        const segs = d.t > 0
          ? d.counts.map((n, i) => (n > 0 ? `<div style="height:${Math.max(2, Math.round((h * n) / d.t))}px;background:${hue(i)}"></div>` : "")).join("")
          : `<div style="height:2px;background:var(--surface-3)"></div>`;
        return `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px">` +
          `<span style="font-size:9.5px;font-weight:650;color:var(--ink-3);font-variant-numeric:tabular-nums">${fmt(d.t)}</span>` +
          `<div style="width:100%;display:flex;flex-direction:column;gap:1px;border-radius:3px 3px 2px 2px;overflow:hidden">${segs}</div></div>`;
      }).join("") +
      `</div><svg viewBox="0 0 100 58" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none">` +
      `<polyline points="${pts}" fill="none" stroke="var(--ink)" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg></div>` +
      `<div style="display:flex;gap:4px;margin-top:4px">` +
      data.series.map((d) => `<span style="flex:1;text-align:center;font-size:9.5px;font-weight:600;color:var(--ink-3)">${esc(d.day.slice(5))}</span>`).join("") +
      `</div>` +
      `<div style="${BASIS}">Stacked by where each answer stands now, on the day it was first given (the public answeredAt stamps) · the line is the running total · full series: series.csv.</div>`);

  // Second thoughts — MOVES, not people (D226): one person editing twice
  // appears under two pairs, so the mock's "N answers changed at least
  // once" claim is one this data cannot make, and the copy says moves.
  const editsCard = card(
    kicker("Second thoughts", "so far") +
    (data.edits.moves === 0
      ? `<div style="margin-top:10px;font-size:12.5px;font-weight:600;color:var(--ink-2);line-height:1.5">No vote has moved yet (as of ${day}).</div>`
      : data.edits.pairs.slice(0, EDIT_PAIRS_SHOWN).map((p) =>
        `<div style="display:flex;align-items:center;gap:8px;padding:9px 0 1px;font-size:12.5px">` +
        `<span style="font-weight:700;color:var(--ink)">${esc(options[p.from] ?? p.from)}</span><span style="color:var(--ink-3)">&rarr;</span>` +
        `<span style="font-weight:700;color:var(--ink)">${esc(options[p.to] ?? p.to)}</span>` +
        `<span style="flex:1;border-bottom:1px dotted color-mix(in oklch, var(--rule), var(--ink) 12%);margin:0 2px"></span>` +
        `<span style="font-weight:750;font-variant-numeric:tabular-nums;color:var(--ink)">${fmt(p.n)}</span></div>`,
      ).join("") +
      (data.edits.pairs.length > EDIT_PAIRS_SHOWN
        ? `<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--ink-3)">+ ${fmt(data.edits.pairs.length - EDIT_PAIRS_SHOWN)} smaller moves — all in edits.csv</div>` : "") +
      `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px">` +
      options.map((label, i) =>
        `<span style="display:inline-flex;align-items:center;gap:6px;border:0.5px solid var(--rule);border-radius:999px;padding:3px 10px;background:var(--surface);font-size:11px;font-weight:650;color:var(--ink-2)">` +
        `<span style="width:7px;height:7px;border-radius:50%;background:${hue(i)}"></span>${esc(label)}` +
        `<span style="font-weight:800;color:${hueInk(i)};font-variant-numeric:tabular-nums">${(data.edits.net[i] >= 0 ? "+" : "&minus;") + fmt(Math.abs(data.edits.net[i]))}</span></span>`,
      ).join("") + `</div>`) +
    `<div style="${BASIS}">${fmt(data.edits.moves)} ${data.edits.moves === 1 ? "move" : "moves"} between options so far — moves, not people (someone changing twice counts twice), and the split above counts each person&rsquo;s latest answer. Full matrix: edits.csv.</div>`);

  const dimSection = (title, rows, right, extraHtml, open) =>
    `<details${open ? " open" : ""} style="border-bottom:1px solid color-mix(in oklch, var(--rule) 62%, transparent)">` +
    `<summary style="display:flex;align-items:center;gap:10px;padding:11px 0;cursor:pointer;list-style:none">` +
    `<span style="flex:1;min-width:0;font-size:13.5px;font-weight:650;letter-spacing:-0.01em;color:var(--ink)">${esc(title)}</span>` +
    `<span style="flex-shrink:0;font-size:10.5px;font-weight:600;color:var(--ink-3);font-variant-numeric:tabular-nums">${right}</span>` +
    `<span class="chev" style="flex-shrink:0;font-size:11px;color:var(--ink-3)">&#9662;</span></summary>` +
    `<div style="padding:0 0 13px">` + rows.map(bucketRow).join("") + (extraHtml || "") +
    `</div></details>`;

  // The census dims' remainder is a footnote line, not a bucket: "did
  // not share this" is an absence of a cohort, where the cuts' Untested
  // is a real row with its own split.
  const notSharedNote = (n) => (n > 0
    ? `<div style="margin-top:9px;display:flex;align-items:baseline;justify-content:space-between;gap:8px">` +
      `<span style="font-size:12.5px;font-weight:650;color:var(--ink-2)">Not shared</span>` +
      `<span style="flex-shrink:0;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums">` +
      `<span style="color:var(--ink)">${fmt(n)}</span><span style="font-weight:600;color:var(--ink-3)"> · did not share this</span></span></div>`
    : "");

  const whoCard = card(
    kicker("Who answered", legend(options)) +
    `<div style="margin-top:14px"><div style="${K};font-size:9.5px;opacity:0.85">Demographics</div>` +
    data.dims.map((d) => dimSection(
      DIM_TITLES[d.key] || d.key, d.rows, `shared by ${fmt(d.shared)}`,
      notSharedNote(d.notShared), d.key === "ageBand",
    )).join("") +
    dimSection("Job", data.job.rows, `shared by ${fmt(data.job.shared)}`, notSharedNote(data.job.notShared)) +
    `</div>` +
    data.typeCuts.map((cut) =>
      `<div style="margin-top:14px"><div style="${K};font-size:9.5px;opacity:0.85">${esc(cut.title)}</div>` +
      dimSection(`${cut.title} — type`, cut.rows, `tested ${fmt(cut.tested)}`) +
      `</div>`,
    ).join("") +
    `<div style="${BASIS}">Census cuts are the aggregate&rsquo;s own published cells — exact, complete, an absent bucket is zero (D98). Job is folded from the answers&rsquo; public vote-time snapshots, and the four type cuts run the app&rsquo;s own nearest-signature matcher over the public testResults — the same reads anyone in the app can make. Cohorts as they stood at vote time · an empty bucket stays listed at zero, small counts print exactly, and the Untested row is the remainder — shown, never dropped.</div>`);

  const logicCard = card(
    kicker("The logic cut", "verified in the timed in-app test") +
    `<div style="margin-top:2px">` + data.logic.rows.map(bucketRow).join("") + `</div>` +
    `<div style="${BASIS}">${fmt(data.logic.verified)} of ${fmt(total)} voters verified; quarters are of the verified percentile, against all verified users, not this question&rsquo;s voters. The untested row is the remainder — shown, never dropped.</div>`);

  const neighboursCard = card(
    kicker("Similar questions", `top ${NEIGHBOURS_SHOWN} · what each side chose there`) +
    (data.neighbours.length === 0
      ? `<div style="margin-top:10px;font-size:12.5px;font-weight:600;color:var(--ink-2);line-height:1.5">No neighbour clears the ${NEIGHBOUR_MIN_SHARED}-shared-voter floor yet — stated rather than padded.</div>`
      : data.neighbours.map((nb, i) =>
        `<div style="padding:11px 0;${i < data.neighbours.length - 1 ? "border-bottom:1px solid color-mix(in oklch, var(--rule) 62%, transparent)" : ""}">` +
        `<div style="font-size:13px;font-weight:700;line-height:1.32;color:var(--ink)">${esc(nb.prompt)}</div>` +
        `<div style="margin-top:7px;display:flex;flex-direction:column;gap:5px">` +
        nb.modes.map((m, oi) => m
          ? `<div style="display:flex;align-items:center;gap:7px">` +
            `<span style="width:7px;height:7px;border-radius:50%;background:${hue(oi)};flex-shrink:0"></span>` +
            `<span style="flex:1;min-width:0;font-size:11.5px;font-weight:600;color:var(--ink-2)">most chose <span style="font-weight:750;color:var(--ink)">${esc(m.label)}</span></span>` +
            `<span style="flex-shrink:0;font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:${hueInk(oi)}">${m.pct}%</span></div>`
          : "").join("") +
        `</div><div style="margin-top:5px;font-size:10.5px;font-weight:600;color:var(--ink-3)">shared voters · ${fmt(nb.shared)}</div></div>`,
      ).join("")) +
    `<div style="${BASIS}">Top ${NEIGHBOURS_SHOWN} by shared-voter correlation over the ${fmt(data.neighbourBasis.sampled)} most recent voters, against the app&rsquo;s ${fmt(data.neighbourBasis.candidates)} core two-option questions; pairs under ${data.neighbourBasis.floor} shared voters say nothing and are not ranked. Each line: among this question&rsquo;s voters for that option who also answered the neighbour, what most of them chose there.</div>`);

  const bundle =
    `<div style="margin:18px 2px 8px"><div style="${K}">In the buyer&rsquo;s bundle</div>` +
    `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px">` +
    [`report.html — this page`, `roll.csv · ${fmt(data.roll.length)} rows`, `edits.csv · ${fmt(data.edits.pairs.length)} rows`, `series.csv · ${fmt(data.series.length)} days`]
      .map((c) => `<span style="border:0.5px solid var(--rule);border-radius:999px;padding:3px 10px;background:var(--surface-2);font-size:11px;font-weight:650;color:var(--ink-2)">${esc(c)}</span>`).join("") +
    `</div><div style="margin-top:12px;font-size:11px;font-weight:600;color:var(--ink-3);line-height:1.5">The roll lists public app names and cohorts at vote time — the same who-voted list every card shows. Counts and cuts, never a private profile: every number here is derivable from what any signed-in user can read.</div></div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>InSight · question report</title>
<style>
  :root {
    --surface: oklch(0.965 0.004 75); --surface-2: oklch(0.994 0.0025 80);
    --surface-3: oklch(0.936 0.005 74); --rule: oklch(0.905 0.006 74);
    --ink: oklch(0.216 0.011 70); --ink-2: oklch(0.41 0.011 68); --ink-3: oklch(0.51 0.010 68);
    --sans: 'Hanken Grotesk', -apple-system, system-ui, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--surface); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .page { max-width: 560px; margin: 0 auto; padding: 22px 16px 40px; }
  .card { background: var(--surface-2); border: 1px solid color-mix(in oklch, var(--rule), transparent 25%);
    border-radius: 18px; padding: 16px 16px 14px; margin-top: 14px;
    box-shadow: 0 1px 1px oklch(0.24 0.02 275 / 0.04), 0 2px 6px -2px oklch(0.24 0.02 275 / 0.07), 0 12px 28px -14px oklch(0.24 0.02 275 / 0.16); }
  details > summary::-webkit-details-marker { display: none; }
  details[open] .chev { transform: rotate(180deg); }
  details[open] > summary span:first-child { font-weight: 800; }
  @media print { .card { break-inside: avoid; box-shadow: none; } body { background: white; } }
</style></head><body>
<div class="page">
  <div style="display:flex;align-items:center;gap:8px">
    <span style="width:12px;height:12px;border-radius:50%;border:3px solid var(--ink)"></span>
    <span style="font-size:14px;font-weight:800;letter-spacing:-0.01em">InSight</span>
    <span style="font-size:11px;font-weight:600;color:var(--ink-3);margin-left:auto">Question report · ${day}</span>
  </div>
  <div style="margin:14px 2px 0;font-size:12.5px;font-weight:600;color:var(--ink-2);line-height:1.5">
    ${data.sponsor ? "This report is the buyer&rsquo;s — and every number in it is still derivable from the app&rsquo;s public counts, so nothing here says more than the app does." : "Every number in this report is derivable from the app&rsquo;s public counts — nothing here says more than the app does."}
  </div>
  ${masthead}${split}${seriesCard}${editsCard}${whoCard}${logicCard}${neighboursCard}${bundle}
</div>
<script>addEventListener("beforeprint",()=>document.querySelectorAll("details").forEach((d)=>{d.open=true}));</script>
</body></html>`;
}
