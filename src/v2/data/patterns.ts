// The Patterns tab's store (v28 §2, trial per D166 §1) — the client half
// of the fold functions/src/patterns.ts publishes. Two honest sources and
// nothing else:
//
//   · v2_patterns/loadings — one public doc, fetched once per session:
//     per-question loading vectors from the nightly fit over the vote
//     log, each with the answer count it rests on. No loadings yet means
//     the tab SAYS so — the trial ships live-only, and the demo build
//     shows the same honest state rather than the prototype's 560
//     invented people (the narrowing D166 §1 licenses; the fabrication it
//     refuses).
//   · The viewer's own answers (LIVE.myVotes) joined against the bank —
//     the Oracle's evidence and the Map's filled-vs-hollow dots.
//
// The Oracle's guess is SEALED: computed and persisted BEFORE the options
// render (the duel-reveal discipline, pinned in patterns.test.ts), then
// graded in surprisal bits when the real answer lands through the
// ordinary vote path — the tab is a lens on the app, not a separate quiz.
// The estimate never leaves the phone: theta is a K×K ridge solve over
// loadings and answers the device already holds.
//
// The pair card's "pick this — and N% pick that" is the one place a pair
// is counted directly, and only for the links actually on screen (the
// selected question's own few since the 2026-08-20 standalone, D215): the
// questions' voter samples intersected on the device (the D146 pattern —
// a bounded sample that states its basis), never a pairwise store. Rows
// are fetched once per question per session (sayRows), so three links
// sharing an endpoint cost four lists, not six.
import LIVE from "./live";
import { getDb, getFirestoreApi } from "../../lib/firebase";
import { fetchVoters, VOTER_FETCH_CAP } from "./voters";
import type { LiveQuestion } from "./deck";
import {
  estimateTheta,
  mapGeometry,
  oracleGuess,
  surprisalBits,
  type MapNode,
} from "./patternsMap";

/** The sealed-and-graded log — swept with every other insight.* key by
 * purgeLocalTrace; the mounted copy drops on the purge event without
 * writing the key back (check:purge). */
const LS = "insight.patterns.oracle.v1";

export interface PoolItem {
  q: LiveQuestion;
  L: number[];
  /** Answers the fit folded — the loading's basis. */
  n: number;
  /** The fit's own running marginal of the encoded answer. */
  marginal: number;
  /** The viewer's encoded answer (+1 option 0 / −1 option 1), or null. */
  mine: number | null;
}

export interface OracleRecord {
  qid: string;
  /** Sealed BEFORE the options rendered. */
  p0: number;
  pred: 0 | 1;
  at: number;
  /** Graded once the answer lands. */
  mine?: 0 | 1;
  bits?: number;
  /** The answered questions that carried the guess — ids, strongest first. */
  ev?: string[];
}

export interface PairSay {
  /** Of the people in both samples who picked `pick`… */
  pick: string;
  /** …this share also picked `then`. */
  then: string;
  /** The option indices behind the labels — what lets the Map say "you
   * went the other way" from the viewer's own answers (2026-08-20
   * standalone), without this module reading them. */
  pickIdx: 0 | 1;
  thenIdx: 0 | 1;
  pct: number;
  /** The unconditional share, for the tick the card draws. */
  base: number;
  /** People in both bounded samples — the stated basis. */
  both: number;
}

/** The Oracle's evidence reading: among the people in both bounded
 * samples who took the viewer's side on the evidence question, the share
 * that picked each side of the target. */
export interface TellShare {
  shares: [number, number];
  /** People behind the shares — the stated basis (D146). */
  n: number;
}

interface LoadingsDoc { k: number; q: Record<string, { v: number[]; n: number; sum: number }> }

let loadings: LoadingsDoc | null = null;
let loaded = false; // fetched-and-absent is an answer too
let loading: Promise<void> | null = null;
let log: OracleRecord[] | null = null;
const saySessionCache = new Map<string, PairSay | null>();
const tellSessionCache = new Map<string, TellShare | null>();
// One bounded voter fetch per question per session, shared by every pair
// that touches it — say() used to refetch both lists per NEW pair, and the
// three-link card (2026-08-20 standalone) would have tripled that. The
// names map is shared for the same reason resolveNames caches: crowds
// overlap. Cleared with everything else on the purge event.
const sayRowCache = new Map<string, Promise<{ uid: string; optionIdx: number }[]>>();
const sayNames: Record<string, string> = {};
function sayRows(qid: string): Promise<{ uid: string; optionIdx: number }[]> {
  let p = sayRowCache.get(qid);
  if (!p) {
    p = (async () => {
      const db = await getDb();
      return fetchVoters(db, qid, null, sayNames);
    })();
    // a failed fetch must not be cached as the crowd — drop it so the next
    // open retries (the loadVoters absent-vs-empty rule, applied here)
    p.catch(() => { if (sayRowCache.get(qid) === p) sayRowCache.delete(qid); });
    sayRowCache.set(qid, p);
  }
  return p;
}
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => { try { f(); } catch { /* a broken listener must not stop the rest */ } });

const logSaved = (): OracleRecord[] => {
  if (log) return log;
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "[]");
    log = Array.isArray(v) ? v.filter((r) => r && typeof r.qid === "string" && typeof r.p0 === "number") : [];
  } catch { log = []; }
  return log;
};

const persistLog = () => {
  try { localStorage.setItem(LS, JSON.stringify(logSaved().slice(-200))); } catch { /* best-effort — in-memory stays right */ }
};

/** One read per session: the loadings doc. Absent means the fit has not
 * run against this database yet — stored as an answer, not refetched. */
export function ensureLive(force = false): Promise<void> {
  if (!LIVE.enabled) return Promise.resolve();
  if (loaded && !force) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const db = await getDb();
      const { doc, getDoc } = await getFirestoreApi();
      const snap = await getDoc(doc(db, "v2_patterns", "loadings"));
      loadings = snap.exists()
        ? { k: (snap.get("k") as number) ?? 8, q: (snap.get("q") as LoadingsDoc["q"]) ?? {} }
        : null;
      loaded = true;
      notify();
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** The viewer's encoded answer on a question, or null. myVotes carries
 * option IDS; the encoding needs the index. */
function encodedMine(q: LiveQuestion, votes: Record<string, string>): number | null {
  const optId = votes[q.id];
  if (optId == null) return null;
  const idx = q.options.findIndex((o) => o.id === optId);
  if (idx === 0) return 1;
  if (idx === 1) return -1;
  return null;
}

/** The drawable pool: every published loading the client can NAME — the
 * join of the loadings doc against the bank's own view models, daily
 * archive plus core feed (the two corpora the fit folds). A loading whose
 * question the bank no longer carries is dropped rather than drawn as a
 * mystery dot. Two-option questions only, the fit's own rule. */
function pool(): PoolItem[] {
  if (!LIVE.enabled || !loadings) return [];
  const votes = LIVE.myVotes();
  const out: PoolItem[] = [];
  const seen = new Set<string>();
  for (const q of [...LIVE.aggregated(), ...LIVE.coreFeedAggregated()]) {
    const row = loadings.q[q.id];
    if (!row || q.options.length !== 2 || seen.has(q.id)) continue;
    seen.add(q.id);
    out.push({
      q,
      L: row.v,
      n: row.n,
      marginal: row.n > 0 ? row.sum / row.n : 0,
      mine: encodedMine(q, votes),
    });
  }
  return out;
}

/** The viewer's latent vector — a device-side solve over their own
 * answered pool. Never stored, never sent; recomputed per read. */
function theta(items: readonly PoolItem[], k: number): number[] {
  const obs = items
    .filter((p) => p.mine != null)
    .map((p) => ({ L: p.L, r: (p.mine as number) - p.marginal }));
  return estimateTheta(obs, k);
}

export const PATTERNS = {
  /** Live and the loadings doc has been looked for (present or absent). */
  ready(): boolean { return !LIVE.enabled || loaded; },
  /** The fit has published something to draw. */
  hasLoadings(): boolean { return !!loadings && Object.keys(loadings.q).length > 0; },
  pool,
  /** The pool item the Oracle asks next: the first unanswered question
   * with enough basis to guess against — reading a vector fitted on a
   * handful of answers as a prediction would be the map lying quietly. */
  nextAsk(minBasis = 8): PoolItem | null {
    return pool().find((p) => p.mine == null && p.n >= minBasis) ?? null;
  },
  /** Seal the guess for a question — computed and PERSISTED before the
   * options render. Re-sealing an already-sealed question returns the
   * standing record: the first look is the one that counts. */
  seal(qid: string): OracleRecord | null {
    const existing = logSaved().find((r) => r.qid === qid);
    if (existing) return existing;
    const items = pool();
    const target = items.find((p) => p.q.id === qid);
    if (!target || !loadings) return null;
    const th = theta(items.filter((p) => p.q.id !== qid), loadings.k);
    const g = oracleGuess(th, target.L, target.marginal);
    const rec: OracleRecord = { qid, p0: g.p0, pred: g.pred, at: Date.now() };
    logSaved().push(rec);
    persistLog();
    return rec;
  },
  /** Grade a sealed guess once the real answer exists. Idempotent; the
   * evidence is the answered questions most tied to this one, weighted
   * by how far their answer sat from the crowd's.
   *
   * Grades on the OPTIMISTIC vote (myVotes), the app's own idiom — a
   * rules-refused write rolls the vote back but the graded record
   * stands. Rare (refusals report through vote()'s own path), and the
   * seal's first-look rule means a re-ask shows the standing grade
   * rather than re-rolling it. */
  grade(qid: string): OracleRecord | null {
    const rec = logSaved().find((r) => r.qid === qid);
    if (!rec || rec.bits != null || !loadings) return rec ?? null;
    const items = pool();
    const target = items.find((p) => p.q.id === qid);
    if (!target || target.mine == null) return rec;
    const mine: 0 | 1 = target.mine === 1 ? 0 : 1;
    rec.mine = mine;
    rec.bits = Math.round(surprisalBits(rec.p0, mine) * 100) / 100;
    const answered = items.filter((p) => p.q.id !== qid && p.mine != null);
    if (answered.length) {
      const nodes: MapNode[] = [{ id: qid, L: target.L, n: target.n },
        ...answered.map((p) => ({ id: p.q.id, L: p.L, n: p.n }))];
      const { U } = mapGeometry(nodes);
      rec.ev = answered
        .map((p, i) => {
          let s = 0;
          for (let k = 0; k < U[0].length; k++) s += U[0][k] * U[i + 1][k];
          return { id: p.q.id, w: Math.abs(s) * Math.abs((p.mine as number) - p.marginal) };
        })
        .sort((a, b) => b.w - a.w)
        .slice(0, 2)
        .map((x) => x.id);
    }
    persistLog();
    notify();
    return rec;
  },
  /** The score strip: every graded record, oldest first. */
  meter(): { records: OracleRecord[]; called: number; avgBits: number } {
    const graded = logSaved().filter((r) => r.bits != null);
    const called = graded.filter((r) => r.pred === r.mine).length;
    const avgBits = graded.length
      ? graded.reduce((a, r) => a + (r.bits as number), 0) / graded.length
      : 0;
    return { records: graded, called, avgBits };
  },
  /** The pair card's exact table: the two questions' bounded voter
   * samples intersected on the device. Positive-lift direction only, the
   * prototype's own rule, and the basis is stated. Null = nothing worth
   * saying (too few in both samples, or no lift anywhere). */
  async say(qidA: string, qidB: string): Promise<PairSay | null> {
    // Directional key: the sentence reads A → B, so a pair opened from the
    // other end is a different sentence — the rows underneath are shared
    // through sayRows, so either order still costs one fetch per question.
    const key = `${qidA}>${qidB}`;
    if (saySessionCache.has(key)) return saySessionCache.get(key) ?? null;
    const items = pool();
    const A = items.find((p) => p.q.id === qidA);
    const B = items.find((p) => p.q.id === qidB);
    if (!A || !B) return null;
    const [va, vb] = await Promise.all([sayRows(qidA), sayRows(qidB)]);
    const bByUid = new Map(vb.map((v) => [v.uid, v.optionIdx]));
    const cells = [[0, 0], [0, 0]];
    let both = 0;
    for (const v of va) {
      const b = bByUid.get(v.uid);
      if (b == null || v.optionIdx > 1 || b > 1) continue;
      cells[v.optionIdx][b] += 1;
      both += 1;
    }
    let best: PairSay | null = null;
    if (both >= 12) {
      const colTotal = [cells[0][0] + cells[1][0], cells[0][1] + cells[1][1]];
      for (let x = 0; x < 2; x++) {
        const rowTotal = cells[x][0] + cells[x][1];
        if (rowTotal / both < 0.18) continue; // decent support only
        for (let y = 0; y < 2; y++) {
          const cond = cells[x][y] / rowTotal;
          const base = colTotal[y] / both;
          if (base <= 0 || cond / base <= 1) continue;
          if (!best || cond / base > best.pct / Math.max(1, best.base)) {
            best = {
              pick: A.q.options[x]?.label ?? "",
              then: B.q.options[y]?.label ?? "",
              pickIdx: x as 0 | 1,
              thenIdx: y as 0 | 1,
              pct: Math.round(cond * 100),
              base: Math.round(base * 100),
              both,
            };
          }
        }
      }
    }
    saySessionCache.set(key, best);
    return best;
  },
  /** The Oracle's evidence line (2026-08-20 standalone): among the people
   * in both bounded samples who took `evIdx` on the evidence question, how
   * the target splits. Null under 12 such people — a share from fewer says
   * nothing (the say() floor, D146). Same shared row cache as say(). */
  async tell(targetQid: string, evQid: string, evIdx: 0 | 1): Promise<TellShare | null> {
    const key = `${targetQid}?${evQid}:${evIdx}`;
    if (tellSessionCache.has(key)) return tellSessionCache.get(key) ?? null;
    const [vt, ve] = await Promise.all([sayRows(targetQid), sayRows(evQid)]);
    const tByUid = new Map(vt.map((v) => [v.uid, v.optionIdx]));
    let n = 0;
    let c0 = 0;
    for (const v of ve) {
      if (v.optionIdx !== evIdx) continue;
      const t = tByUid.get(v.uid);
      if (t === 0) { n += 1; c0 += 1; } else if (t === 1) { n += 1; }
    }
    const out: TellShare | null = n >= 12 ? { shares: [c0 / n, 1 - c0 / n], n } : null;
    tellSessionCache.set(key, out);
    return out;
  },
  VOTER_FETCH_CAP,
  ensureLive,
  subscribe(f: () => void): () => void {
    subs.add(f);
    const un = LIVE.enabled ? LIVE.subscribe?.(f) : undefined;
    return () => { subs.delete(f); if (un) un(); };
  },
};

// The purge (D51): the sealed log is account state; the loadings cache and
// the pair cache are session state keyed to it. All go — purgeLocalTrace
// has already swept the key, so the in-memory copies drop WITHOUT writing
// anything back.
window.addEventListener("insight:local-purge", () => {
  log = null;
  loadings = null;
  loaded = false;
  saySessionCache.clear();
  tellSessionCache.clear();
  sayRowCache.clear();
  for (const k of Object.keys(sayNames)) delete sayNames[k];
  notify();
});

export default PATTERNS;
