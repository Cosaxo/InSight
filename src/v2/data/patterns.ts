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
import { fetchVoterPicks, VOTER_FETCH_CAP } from "./voters";
import type { LiveQuestion } from "./deck";
import {
  DEFAULT_LAMBDA_U,
  mapGeometry,
  mostInformative,
  oracleGuess,
  ridgeSolve,
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

/** One row of the working (2026-08-26): a prior answer of the viewer's
 * that carried the sealed call, with the crowd split it contributed. */
export interface WorkingRow {
  /** The evidence question's id — the UI resolves it against the pool. */
  evId: string;
  /** The viewer's side on it. */
  side: 0 | 1;
  /** Of the people in both samples on the viewer's side, the share that
   * picked the CALLED side of the target. */
  share: number;
  /** People behind the share — the stated basis (D146). */
  n: number;
  /** The answer's pull on the call, for ink weight only — never printed. */
  w: number;
}
export interface Working {
  rows: WorkingRow[];
  /** Whether the sealed record named any evidence at all — the UI's
   * empty states differ: "guessed at the coin" is only true when it
   * did not. */
  hadEv: boolean;
  /**
   * WHY A NAMED ANSWER PRODUCED NO ROW, when none of them did. Three
   * different facts used to leave `rows` empty in the same way, and the
   * panel printed one sentence for all three — "under 12 in both
   * samples", a number the code could not promise:
   *
   *   thin   the crossing really was under the 12-voter floor
   *   weak   plenty of voters, but the lean did not reach 0.54 — the
   *          ORDINARY case, and the one most often mislabelled
   *   failed the voter-picks read rejected, which is not a fact about
   *          the crowd at all
   *
   * Set independently; more than one can be true across several answers.
   */
  thin: boolean;
  weak: boolean;
  failed: boolean;
}

/** A published row: the vector, its basis, the sum of raw encoded answers
 * (mean = sum/n for every kind) and an ordinal row's sd (D383). */
interface LoadingsRow { v: number[]; n: number; sum: number; sd?: number }
/** How a device encodes its own answer into a row — the candidate
 * engine's item metadata (D383); absent while the online engine owns the
 * rows, which are then all two-option. */
interface LoadingsItem { kind: "bin" | "ord" | "opt"; qid: string; opt?: number; nOptions: number }
interface LoadingsDoc {
  k: number;
  q: Record<string, LoadingsRow>;
  items?: Record<string, LoadingsItem>;
  /** The device ridge the engine's scorecard was measured at (D383). */
  lambdaU?: number;
  engine?: "sgd" | "als";
}

let loadings: LoadingsDoc | null = null;
let loaded = false; // fetched-and-absent is an answer too
let loading: Promise<void> | null = null;
let log: OracleRecord[] | null = null;
const saySessionCache = new Map<string, PairSay | null>();
const tellSessionCache = new Map<string, TellShare | null>();
// One bounded voter fetch per question per session, shared by every pair
// that touches it — say() used to refetch both lists per NEW pair, and the
// three-link card (2026-08-20 standalone) would have tripled that.
// Cleared with everything else on the purge event.
//
// PICKS ONLY, no names. This called `fetchVoters`, whose second half
// resolves every uid it saw into a profile — up to VOTER_FETCH_CAP
// documents, chunked 30 at a time, billed. The map it filled was a
// module-local `sayNames` that nothing on this path ever read: the pair
// card counts agreements, it does not name anybody. At four questions per
// Map-lens selection that was up to ~800 profile reads a session bought
// and thrown away. `fetchVoterPicks` is the same query without the second
// one.
const sayRowCache = new Map<string, Promise<{ uid: string; optionIdx: number }[]>>();
function sayRows(qid: string): Promise<{ uid: string; optionIdx: number }[]> {
  let p = sayRowCache.get(qid);
  if (!p) {
    p = (async () => {
      const db = await getDb();
      return fetchVoterPicks(db, qid);
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
        ? {
          k: (snap.get("k") as number) ?? 8,
          q: (snap.get("q") as LoadingsDoc["q"]) ?? {},
          ...(snap.get("items") ? { items: snap.get("items") as LoadingsDoc["items"] } : {}),
          ...(typeof snap.get("lambdaU") === "number" ? { lambdaU: snap.get("lambdaU") as number } : {}),
          ...(snap.get("engine") ? { engine: snap.get("engine") as LoadingsDoc["engine"] } : {}),
        }
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

/** The device ridge: the one the fit's scorecard was measured at, read
 * off the doc (D383), with the shipped value as the fallback for a
 * document that predates the field. */
function lambdaU(): number {
  return loadings?.lambdaU ?? DEFAULT_LAMBDA_U;
}

/**
 * The viewer's evidence: every answer of theirs the published rows can
 * encode, as the centred residuals the fit itself is written in (D384).
 * Under the candidate engine that is the whole corpus — a two-option
 * answer as ±1 minus the row's marginal, an ordinal one as the index
 * standardised by the row's mean and sd, a pick as ±1 against each of the
 * question's one-hot rows — and under the online engine its two-option
 * rows alone. Read through `LIVE.answeredIndex()`, the banks × the vote
 * mirror, so an instrument item counts whether or not its crowd counts
 * are cached here. `excludeQid` keeps a target's own answer out of the
 * solve that guesses it.
 */
function evidence(excludeQid?: string): { L: readonly number[]; r: number }[] {
  if (!LIVE.enabled || !loadings) return [];
  const answered = LIVE.answeredIndex();
  const meta = loadings.items;
  const out: { L: readonly number[]; r: number }[] = [];
  const centred = (row: LoadingsRow, x: number): number => x - row.sum / row.n;
  for (const [qid, idx] of Object.entries(answered)) {
    if (qid === excludeQid) continue;
    const row = loadings.q[qid];
    if (!meta) {
      // the online engine's rows: two-option only, ±1
      if (row && row.n > 0 && (idx === 0 || idx === 1)) out.push({ L: row.v, r: centred(row, idx === 0 ? 1 : -1) });
      continue;
    }
    const m = meta[qid];
    if (m && row && row.n > 0) {
      if (m.kind === "ord") {
        if (row.sd && row.sd >= 1e-6) out.push({ L: row.v, r: (idx - row.sum / row.n) / row.sd });
      } else if (m.kind === "bin") {
        out.push({ L: row.v, r: centred(row, idx === 0 ? 1 : -1) });
      }
      continue;
    }
    // a pick: one row per option, keyed off the qid
    for (let i = 0; ; i++) {
      const key = `${qid}~${i}`;
      const r = loadings.q[key];
      const mm = meta[key];
      if (!r || !mm) break;
      if (r.n > 0) out.push({ L: r.v, r: centred(r, idx === i ? 1 : -1) });
    }
  }
  return out;
}

export const PATTERNS = {
  /** Live and the loadings doc has been looked for (present or absent). */
  ready(): boolean { return !LIVE.enabled || loaded; },
  /** The fit has published something to draw. */
  hasLoadings(): boolean { return !!loadings && Object.keys(loadings.q).length > 0; },
  pool,
  /** The pool item the Oracle asks next: among the unanswered questions
   * with enough basis to guess against — reading a vector fitted on a
   * handful of answers as a prediction would be the map lying quietly —
   * the one whose loading points where the viewer's vector is least
   * determined (patternsMap.mostInformative; the owner's call,
   * 2026-09-06). It learns the viewer fastest and looks worst for a
   * while, because it asks what it cannot yet call. */
  nextAsk(minBasis = 8): PoolItem | null {
    const cands = pool().filter((p) => p.mine == null && p.n >= minBasis);
    if (!cands.length || !loadings) return null;
    const { invA } = ridgeSolve(evidence(), loadings.k, lambdaU());
    const i = mostInformative(invA, cands);
    return cands[i] ?? null;
  },
  /** The viewer's evidence, for a fold that solves them itself (the
   * People lens's own dot). */
  evidence,
  lambdaU,
  /** Seal the guess for a question — computed and PERSISTED before the
   * options render. Re-sealing an already-sealed question returns the
   * standing record: the first look is the one that counts. */
  seal(qid: string): OracleRecord | null {
    const existing = logSaved().find((r) => r.qid === qid);
    if (existing) return existing;
    const items = pool();
    const target = items.find((p) => p.q.id === qid);
    if (!target || !loadings) return null;
    // the viewer's vector from everything they have answered — every kind
    // the rows can encode — minus the target itself, under the ridge the
    // fit's scorecard was measured at
    const { theta } = ridgeSolve(evidence(qid), loadings.k, lambdaU());
    const g = oracleGuess(theta, target.L, target.marginal);
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
      // Top THREE since 2026-08-26 — the working shows up to three rows;
      // the old top-2 records stay valid, they just have less to show.
      rec.ev = answered
        .map((p, i) => {
          let s = 0;
          for (let k = 0; k < U[0].length; k++) s += U[0][k] * U[i + 1][k];
          return { id: p.q.id, w: Math.abs(s) * Math.abs((p.mine as number) - p.marginal) };
        })
        .sort((a, b) => b.w - a.w)
        .slice(0, 3)
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
  /** The working (2026-08-26): the sealed call rebuilt in the open. One
   * row per evidence question the GRADE named (grade-time evidence, held
   * on the record — not a fresh re-solve, so the rows really are answers
   * the viewer had given before the seal), each with the crowd split it
   * contributed, read through tell()'s shared caches: at most three
   * bounded fetches, most already paid for by say(). A row is kept only
   * when its tell actually points at the call (the 0.54 floor the single
   * tell line always used) — evidence that pulled the solve but cannot
   * be counted in the open is not shown as though it could.
   *
   * The weight is the same pull the grade ranked by, recomputed over the
   * CURRENT pool — it decides ink opacity, never a printed number, so
   * pool drift since the grade cannot change what the rows claim. */
  async working(qid: string): Promise<Working | null> {
    const rec = logSaved().find((r) => r.qid === qid);
    if (!rec || rec.mine == null || !loadings) return null;
    const evIds = rec.ev ?? [];
    if (!evIds.length) return { rows: [], hadEv: false, thin: false, weak: false, failed: false };
    const items = pool();
    const target = items.find((p) => p.q.id === qid);
    if (!target) return { rows: [], hadEv: true, thin: false, weak: false, failed: false };
    // the grade's own weight, for the rows that still resolve
    const answered = items.filter((p) => p.q.id !== qid && p.mine != null);
    const wOf = new Map<string, number>();
    if (answered.length) {
      const nodes: MapNode[] = [{ id: qid, L: target.L, n: target.n },
        ...answered.map((p) => ({ id: p.q.id, L: p.L, n: p.n }))];
      const { U } = mapGeometry(nodes);
      answered.forEach((p, i) => {
        let s = 0;
        for (let k = 0; k < U[0].length; k++) s += U[0][k] * U[i + 1][k];
        wOf.set(p.q.id, Math.abs(s) * Math.abs((p.mine as number) - p.marginal));
      });
    }
    const rows: WorkingRow[] = [];
    let thin = false, weak = false, failed = false;
    for (const evId of evIds) {
      const ev = items.find((p) => p.q.id === evId);
      if (!ev || ev.mine == null) continue; // the bank moved on — an unresolvable id is silence, not a guess
      const side: 0 | 1 = ev.mine === 1 ? 0 : 1;
      // The rejection is caught HERE rather than folded into the null
      // above, because "the read did not happen" and "the crossing is
      // under the floor" are different sentences and the panel says so.
      let share: TellShare | null = null;
      try {
        share = await this.tell(qid, evId, side);
        if (!share) thin = true;
      } catch { failed = true; }
      if (!share) continue;
      // Enough people, and they leaned — or enough people who did not.
      // This is the common way an answer drops out, and it was being
      // reported as a sample size.
      if (share.shares[rec.pred] < 0.54) { weak = true; continue; }
      rows.push({ evId, side, share: share.shares[rec.pred], n: share.n, w: wOf.get(evId) ?? 0 });
    }
    rows.sort((a, b) => b.w - a.w);
    return { rows, hadEv: true, thin, weak, failed };
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
  notify();
});

export default PATTERNS;
