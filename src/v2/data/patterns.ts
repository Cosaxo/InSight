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
// THE GUESS STARTS FROM THE VIEWER'S OWN GROUPS (D453, PATTERNS-PLAN.md
// §3). The fit centres every row on the world's split; the seal instead
// starts from how the viewer's age band, gender, country and the rest
// split on the question — the `by` cells the Mirror already reads,
// folded on the device against the viewer's own anchors
// (data/cohortPrior.ts) — and centres their evidence by the same prior,
// so the vector does not learn the demographics twice. The world-centred
// guess is sealed BESIDE it as the shadow, graded on the same answer, so
// `meter()` can say which of the two reads this viewer better: the
// verdict is a measurement on each device's own record, and ORACLE_CENTRE
// is the one word that flips which variant is live. Nothing new is read
// and nothing leaves the phone.
//
// AND THE FIT KNOWS THE ANCHORS TOO (D454). The candidate engine publishes
// an item per profile value the crowd carries — `anchor~gender~Woman`,
// a row like any pick's — and the viewer's own anchors are encoded
// against those rows as evidence, under the WORLD centre: there the
// demographics enter through the model, as they do for every stranger
// the People lens places from their frozen chips. Under the cohort centre
// they already entered through the prior, and twice is twice — so the two
// sealed variants are two clean answers to one question, and the meter
// decides between the cells and the rows.
//
// AND THE PICKS (D455): a catalogue question's popular entities are rows
// too — `pick-pk01~25` — and the viewer's own pick, which the vote mirror
// holds as the entity's digits, is encoded against them under BOTH
// centres: a pick is an answer, not a group. Its centre is the world's
// under either, because the cube's cells for a catalogue question are
// keyed by entity and cut to the board, so no cohort prior can be folded
// off them cheaply — the one row kind the cohort centre reads from the
// world, said here so it is a known gap and not a surprise.
//
// The pair card's "pick this — and N% pick that" is the one place a pair
// is counted directly, and only for the links actually on screen (the
// selected question's own few since the 2026-08-20 standalone, D215): the
// questions' voter samples intersected on the device (the D146 pattern —
// a bounded sample that states its basis), never a pairwise store. Rows
// are fetched once per question per session (sayRows), so three links
// sharing an endpoint cost four lists, not six.
import LIVE from "./live";
import { byOf, type CohortDim } from "./cohort";
import { cohortPrior, type CohortPrior } from "./cohortPrior";
import { getDb, getFirestoreApi } from "../../lib/firebase";
import { fetchVoterPicks, fetchVoterSample, VOTER_FETCH_CAP } from "./voters";
import type { LiveQuestion } from "./deck";
import {
  DEFAULT_LAMBDA_U,
  mapGeometry,
  nextToAsk,
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
  /** Which corpus the question came from — the daily archive or the core
   * feed (D457: the People lens fetches the daily's lists first, since
   * everyone answers the same daily). */
  surface: "daily" | "feed";
  L: number[];
  /** Answers the fit folded — the loading's basis. */
  n: number;
  /** The fit's own running marginal of the encoded answer. */
  marginal: number;
  /** The viewer's encoded answer (+1 option 0 / −1 option 1), or null. */
  mine: number | null;
}

/** Which split a guess starts from and its evidence is centred by
 * (D453): the world's, or the viewer's own groups'. */
export type OracleCentre = "world" | "cohort";
/** The centre the SEALED guess is drawn from. The other variant is sealed
 * beside it as the shadow and graded on the same answer, so the record
 * says which reads the viewer better before anybody has to believe it.
 * One word to flip; every record carries the centre it was sealed under,
 * so a flip cannot mislabel history. */
export const ORACLE_CENTRE: OracleCentre = "cohort";

/** One group that carried a sealed guess: the viewer's bucket in a dim,
 * the cell's basis, and its share of option 0 after shrinking. */
export interface SealedPriorRow {
  dim: CohortDim;
  bucket: string;
  n: number;
  p0: number;
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
  /** The centre `p0` was sealed under (D453). Absent on a record sealed
   * before it existed, which was the world's. */
  centre?: OracleCentre;
  /** The world's marginal of the encoded answer at seal time — the base
   * rate a guess is measured against (`baseBits`). */
  m0?: number;
  /** The cohort prior's marginal at seal time, `m0` where no group spoke. */
  mc?: number;
  /** The OTHER centre's guess, sealed at the same moment and graded on
   * the same answer — the shadow the meter compares against. */
  alt?: { p0: number; pred: 0 | 1; bits?: number };
  /** Surprisal of the actual answer under the base rate alone. */
  baseBits?: number;
  /** The groups that moved the sealed guess, with their basis — what the
   * working shows beside the evidence answers (D146). */
  prior?: SealedPriorRow[];
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

/** One side of a row, as the counted sentence names it: what to test a
 * sample row for, and the words for it. A catalogue side carries its
 * entity key instead of a label — the device names it from the
 * catalogue, which the card loads on the tap and this module never
 * needs. */
interface RowSide {
  label: string;
  entity?: string;
  /** The option index this side IS, where the row has one — what lets the
   * card say "you went the other way" from the viewer's own answer
   * without this module reading it (the 2026-08-20 standalone's rule). */
  idx?: number;
  test: (r: SayRow) => boolean;
}

/** The counted sentence between two DOTS (D460) — the pair card's own
 * 2×2, generalised from two-option questions to any two published rows.
 * The shape says what it counted and over whom, because every kind ends
 * up in the same sentence and only the basis tells them apart. */
export interface RowSay {
  /** "Pick X here — and N% pick Y". */
  pick: string;
  pickEntity?: string;
  then: string;
  thenEntity?: string;
  /** The option index the `then` side is, where the target row has one. */
  thenIdx?: number;
  pct: number;
  /** The unconditional share — the tick the card draws. */
  base: number;
  /** People the count is over: in both samples, or in the one sample when
   * a profile value is one side of it. */
  both: number;
  /** How the two were joined, because the sentence is only as good as
   * this: `both` = two samples intersected, `one` = one question's sample
   * cut by the frozen chips it already carries. */
  over: "both" | "one";
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
/** One group in the working (D453): the viewer's bucket, and of the
 * answers in that cell how many took the CALLED side, basis stated. */
export interface WorkingPriorRow {
  dim: CohortDim;
  bucket: string;
  share: number;
  n: number;
}
export interface Working {
  rows: WorkingRow[];
  /** The groups that carried the call and lean its way — the same 0.54
   * floor as the evidence rows, and the same twelve-answer basis floor
   * (D146). A group that spoke but did not lean is not a row. */
  prior?: WorkingPriorRow[];
  /** Whether the seal recorded any group at all — with none, the call
   * really did start from the crowd's own lean. */
  hadPrior?: boolean;
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
 * (mean = sum/n for every kind) and an ordinal row's sd (D395). */
interface LoadingsRow { v: number[]; n: number; sum: number; sd?: number }
/** How a device encodes its own answer into a row — the candidate
 * engine's item metadata (D395); absent while the online engine owns the
 * rows, which are then all two-option. */
interface LoadingsItem {
  kind: "bin" | "ord" | "opt" | "anc" | "pick";
  qid: string;
  opt?: number;
  nOptions: number;
  /** anc only (D454): the breakdown dim and the value the row stands for. */
  dim?: string;
  bucket?: string;
  /** pick only (D455): the catalogue entity the row stands for. */
  entity?: string;
}
interface LoadingsDoc {
  k: number;
  q: Record<string, LoadingsRow>;
  items?: Record<string, LoadingsItem>;
  /** The device ridge the engine's scorecard was measured at (D395). */
  lambdaU?: number;
  /** The link's slope it was measured at (D456); 1 on a document before it. */
  tau?: number;
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
// The row type carries what the SAMPLE carries: a vote's option index, a
// catalogue pick's entity (D455), and the answer's frozen chips (D8) —
// which is what lets a You bead be counted against a question inside that
// question's own sample, with no second list (D460).
type SayRow = { uid: string; optionIdx: number; entity?: string; anchors?: Readonly<Record<string, string>> };
const sayRowCache = new Map<string, Promise<SayRow[]>>();
function sayRows(qid: string): Promise<SayRow[]> {
  let p = sayRowCache.get(qid);
  if (!p) {
    p = (async () => {
      const db = await getDb();
      // The nightly sample first (D397): one document for the same rows the
      // live query would read two hundred documents for. The live query
      // stays as the fallback for a question no sample exists for yet.
      return (await fetchVoterSample(db, qid)) ?? fetchVoterPicks(db, qid);
    })();
    // a failed fetch must not be cached as the crowd — drop it so the next
    // open retries (the loadVoters absent-vs-empty rule, applied here)
    p.catch(() => { if (sayRowCache.get(qid) === p) sayRowCache.delete(qid); });
    sayRowCache.set(qid, p);
  }
  return p;
}
const rowSayCache = new Map<string, RowSay | null>();

/** The sides a dot can be tested for. One for a bead (it IS that answer),
 * two for a two-option dot or a scale (the search picks whichever lifts).
 * `median` is the scale's own, read off the sample it will be counted in
 * — a bank's option list says nothing about how people used it. */
function sidesOf(row: MapRow, sample: readonly SayRow[]): RowSide[] {
  if (row.kind === "opt") {
    const opt = row.opt ?? 0;
    return [{ label: row.label, idx: opt, test: (r) => r.optionIdx === opt }];
  }
  if (row.kind === "pick") {
    const e = row.entity ?? "";
    return [{ label: "", entity: e, test: (r) => r.entity === e }];
  }
  if (row.kind === "anc") {
    const dim = row.dim ?? "", bucket = row.bucket ?? "";
    return [{ label: row.label, test: (r) => r.anchors?.[dim] === bucket }];
  }
  if (row.kind === "ord") {
    const vals = sample.map((r) => r.optionIdx).filter((v) => Number.isInteger(v) && v >= 0).sort((a, b) => a - b);
    if (!vals.length) return [];
    const mid = vals[Math.floor(vals.length / 2)];
    return [
      { label: "high", test: (r) => r.optionIdx >= mid },
      { label: "low", test: (r) => r.optionIdx < mid },
    ];
  }
  return [
    { label: row.optionLabels?.[0] ?? "yes", idx: 0, test: (r) => r.optionIdx === 0 },
    { label: row.optionLabels?.[1] ?? "no", idx: 1, test: (r) => r.optionIdx === 1 },
  ];
}

/** The best positive-lift cell of a 2×2 built from two side lists over a
 * population of people each side can be tested on. The rule is `say`'s,
 * kept in one place so the two joins cannot drift apart. */
function bestLift(
  people: readonly SayRow[],
  as: readonly RowSide[],
  bs: readonly RowSide[],
  over: "both" | "one",
): RowSay | null {
  const both = people.length;
  if (both < 12) return null;
  let best: RowSay | null = null;
  for (const a of as) {
    const inA = people.filter(a.test);
    if (inA.length / both < 0.18) continue; // decent support only
    for (const b of bs) {
      const base = people.filter(b.test).length / both;
      const cond = inA.filter(b.test).length / inA.length;
      if (base <= 0 || cond / base <= 1) continue;
      if (!best || cond / base > best.pct / Math.max(1, best.base)) {
        best = {
          pick: a.label,
          ...(a.entity ? { pickEntity: a.entity } : {}),
          then: b.label,
          ...(b.entity ? { thenEntity: b.entity } : {}),
          ...(b.idx === undefined ? {} : { thenIdx: b.idx }),
          pct: Math.round(cond * 100),
          base: Math.round(base * 100),
          both,
          over,
        };
      }
    }
  }
  return best;
}

/** Two question rows: their samples intersected on the device. */
async function sayOverBoth(A: MapRow, B: MapRow): Promise<RowSay | null> {
  const [va, vb] = await Promise.all([sayRows(A.qid), sayRows(B.qid)]);
  const bByUid = new Map(vb.map((v) => [v.uid, v]));
  const people: SayRow[] = [];
  const asSide = sidesOf(A, va);
  const bsSide = sidesOf(B, vb);
  // the joined person carries BOTH answers, so the b-side tests read the
  // b sample's own row rather than the a sample's copy of that person
  const paired: { a: SayRow; b: SayRow }[] = [];
  for (const v of va) {
    const b = bByUid.get(v.uid);
    if (!b) continue;
    paired.push({ a: v, b });
    people.push(v);
  }
  if (!asSide.length || !bsSide.length) return null;
  const bs = bsSide.map((side) => ({
    ...side,
    test: (r: SayRow) => {
      const pair = paired.find((x) => x.a.uid === r.uid);
      return !!pair && side.test(pair.b);
    },
  }));
  return bestLift(people, asSide, bs, "both");
}

/** A profile value and a question row: the question's own sample, cut by
 * the frozen chips its rows already carry. */
async function sayOverOne(A: MapRow, B: MapRow): Promise<RowSay | null> {
  const anc = A.kind === "anc" ? A : B;
  const q = A.kind === "anc" ? B : A;
  const sample = await sayRows(q.qid);
  // only people whose answer froze the dim can be on either side of it
  const dim = anc.dim ?? "";
  const people = sample.filter((r) => typeof r.anchors?.[dim] === "string" && r.anchors[dim]);
  const sides = sidesOf(anc, people);
  const qs = sidesOf(q, people);
  if (!sides.length || !qs.length) return null;
  // the sentence always reads from the tapped dot; the caller passes it
  // first, so keep that order
  return A.kind === "anc" ? bestLift(people, sides, qs, "one") : bestLift(people, qs, sides, "one");
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
          ...(typeof snap.get("tau") === "number" ? { tau: snap.get("tau") as number } : {}),
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
  const corpora: [LiveQuestion[], "daily" | "feed"][] = [[LIVE.aggregated(), "daily"], [LIVE.coreFeedAggregated(), "feed"]];
  for (const [list, surface] of corpora) for (const q of list) {
    const row = loadings.q[q.id];
    if (!row || q.options.length !== 2 || seen.has(q.id)) continue;
    seen.add(q.id);
    out.push({
      q,
      surface,
      L: row.v,
      n: row.n,
      marginal: row.n > 0 ? row.sum / row.n : 0,
      mine: encodedMine(q, votes),
    });
  }
  return out;
}

/** One DOT on the Map (D460): a published row, which is one axis people
 * can lean along. A two-option question and a scale are one row each and
 * so one dot; a choice is one row per option, a catalogue card one per
 * popular pick, a profile value one of its own — bead groups, drawn
 * together and tapped as a group.
 *
 * The rule the whole design rests on: a dot is a ROW. It was already true
 * of the Map's two-option dots (one row each, which is why nobody noticed
 * it was a rule), and keeping it costs no new arithmetic — `edgesOf` has
 * always been cosines between rows. */
export interface MapRow {
  /** The published row's key — `qid`, `qid~opt`, `qid~entity`, or
   * `anchor~dim~bucket`. */
  key: string;
  kind: "bin" | "ord" | "opt" | "anc" | "pick";
  /** The question this row belongs to; the bead group's identity.
   * `anchor~{dim}` for a profile value. */
  qid: string;
  /** The question's own text — the card's head. */
  title: string;
  /** What THIS dot is: the option's label, the bucket, or "" where the
   * dot is the question itself (bin/ord) or needs a catalogue to name
   * (pick — the card loads it on the tap; a bead on the rim has no text). */
  label: string;
  /** The topic arc it sits under; anchors have their own arc (the You
   * ring), so theirs is null. */
  cat: string | null;
  /** The catalogue this row's entity belongs to, where it has one — what
   * the card needs to name and picture a bead. */
  domain?: string | null;
  L: number[];
  n: number;
  marginal: number;
  /** The viewer's own standing on this row: +1/−1 for bin, opt and pick,
   * the option INDEX for ord, +1/−1 for an anchor they carry, null when
   * they have not answered (or, for an anchor, left the dim empty). */
  mine: number | null;
  /** Both option labels, where the row IS a two-option question — its
   * two sides are the sentence's candidate picks (D460's `sidesOf`). */
  optionLabels?: [string, string];
  /** The question's own options, where it has them — what the card's
   * ballot votes with, and what a chip row is named from. Absent on an
   * anchor (no ballot) and on a catalogue card (its board is the feed's,
   * not a row of buttons). */
  options?: { id: string; label: string }[];
  /** The option index this row encodes, for the chip row's ordering. */
  opt?: number;
  entity?: string;
  dim?: string;
  bucket?: string;
}

/**
 * Every published row the bank can NAME, grouped by question (D460).
 *
 * The join is the pool's, one shelf wider: the loadings document's rows
 * against the two corpora the fit folds, plus the anchor rows, which name
 * no bank question at all. A row whose question the bank no longer
 * carries is dropped rather than drawn as a mystery dot — the pool's own
 * rule, and the reason a retired question leaves the Map the night it is
 * retired.
 *
 * NO NEW READ: `loadings.items` is the metadata the fit already publishes
 * so a device can encode its own answers (D395), and both corpora are
 * already in hand. A build whose engine publishes no `items` (the online
 * fit) has bin rows and nothing else, which is exactly the Map as it
 * stood before this existed.
 */
function rows(): MapRow[] {
  if (!LIVE.enabled || !loadings) return [];
  const items = loadings.items;
  const votes = LIVE.myVotes();
  const byQid = new Map<string, LiveQuestion>();
  for (const list of [LIVE.aggregated(), LIVE.coreFeedAggregated()]) {
    for (const q of list) if (!byQid.has(q.id)) byQid.set(q.id, q);
  }
  const out: MapRow[] = [];
  for (const [key, row] of Object.entries(loadings.q)) {
    const meta = items?.[key];
    const kind = meta?.kind ?? "bin";
    const marginal = row.n > 0 ? row.sum / row.n : 0;
    if (kind === "anc") {
      if (!meta?.dim || meta.bucket === undefined) continue;
      const carried = LIVE.anchors()[meta.dim as keyof ReturnType<typeof LIVE.anchors>];
      out.push({
        key, kind: "anc", qid: meta.qid, title: ANCHOR_TITLES[meta.dim] ?? meta.dim,
        label: meta.bucket, cat: null, L: row.v, n: row.n, marginal,
        mine: typeof carried === "string" && carried ? (carried === meta.bucket ? 1 : -1) : null,
        dim: meta.dim, bucket: meta.bucket,
      });
      continue;
    }
    const qid = meta?.qid ?? key;
    const q = byQid.get(qid);
    if (!q) continue;
    if (kind === "pick") {
      if (meta?.entity === undefined) continue;
      out.push({
        key, kind: "pick", qid, title: q.text, label: "", cat: q.cat, domain: q.domain,
        L: row.v, n: row.n, marginal,
        // a pick rides `myVotes` in optionIdx's place — the entity key as
        // a string, which is what `votePick` stores and the ledger carries
        mine: votes[qid] ? (votes[qid] === meta.entity ? 1 : -1) : null,
        entity: meta.entity,
      });
      continue;
    }
    const idx = optionIndexOf(q, votes);
    if (kind === "opt") {
      const opt = meta?.opt ?? 0;
      out.push({
        key, kind: "opt", qid, title: q.text,
        options: q.options.map((o) => ({ id: o.id, label: o.label })), label: q.options[opt]?.label ?? "", cat: q.cat,
        L: row.v, n: row.n, marginal,
        mine: idx == null ? null : idx === opt ? 1 : -1,
        opt,
      });
      continue;
    }
    if (kind === "ord") {
      out.push({
        key, kind: "ord", qid, title: q.text,
        options: q.options.map((o) => ({ id: o.id, label: o.label })), label: "", cat: q.cat,
        L: row.v, n: row.n, marginal, mine: idx,
      });
      continue;
    }
    if (q.options.length !== 2) continue;
    out.push({
      key, kind: "bin", qid, title: q.text, label: "", cat: q.cat,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
      optionLabels: [q.options[0]?.label ?? "", q.options[1]?.label ?? ""],
      L: row.v, n: row.n, marginal, mine: encodedMine(q, votes),
    });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}

/** The dim's noun, for the card's head on a You bead — the profile's own
 * words, not the cube's field names. */
const ANCHOR_TITLES: Record<string, string> = {
  ageBand: "Age",
  gender: "Gender",
  city: "City",
  country: "Country",
  education: "Education",
  relationship: "Relationship",
  heightBand: "Height",
  jobField: "Work",
};

/** The viewer's option INDEX on a question, or null — `myVotes` carries
 * option ids, and every kind but `bin` needs the index. */
function optionIndexOf(q: LiveQuestion, votes: Record<string, string>): number | null {
  const optId = votes[q.id];
  if (optId == null) return null;
  const i = q.options.findIndex((o) => o.id === optId);
  return i >= 0 ? i : null;
}

/** The device ridge: the one the fit's scorecard was measured at, read
 * off the doc (D395), with the shipped value as the fallback for a
 * document that predates the field. */
function lambdaU(): number {
  return loadings?.lambdaU ?? DEFAULT_LAMBDA_U;
}

/** The link's slope (D456), read off the doc like the ridge; the shipped
 * link for a document that predates the field. */
function tau(): number {
  return loadings?.tau ?? 1;
}

// ── the cohort prior (D453) ─────────────────────────────────────────────

/** The viewer's groups' prior on a question, over the world shares the
 * fit centres by — or null where no group can speak (no `by` cells in
 * hand, no anchors, no cell with answers), so a caller falls back to the
 * row's own marginal and the two centres are then byte-identical. */
function priorFor(qid: string, world: readonly number[]): CohortPrior | null {
  const by = byOf(LIVE.aggFor(qid) ?? undefined);
  if (!by) return null;
  const p = cohortPrior(by, LIVE.anchors() || {}, world);
  return p.rows.length ? p : null;
}

/** A two-option row's centre: the world's marginal of the encoded answer,
 * or under the cohort centre the viewer's groups' — `2·p0 − 1`. */
function binCentre(qid: string, row: LoadingsRow, centre: OracleCentre): number {
  const m = row.sum / row.n;
  if (centre !== "cohort") return m;
  const p = priorFor(qid, [(1 + m) / 2, (1 - m) / 2]);
  return p ? 2 * p.shares[0] - 1 : m;
}

/** An ordinal row's centre: the world mean of the index, or the groups'
 * mean over the question's own counts. The row publishes a mean and an
 * sd, not a distribution, so the world distribution comes off the
 * aggregate's counts; absent counts mean the world mean, exactly. */
function ordCentre(qid: string, row: LoadingsRow, nOptions: number, centre: OracleCentre): number {
  const mean = row.sum / row.n;
  if (centre !== "cohort") return mean;
  const counts = LIVE.aggFor(qid)?.counts;
  if (!counts) return mean;
  const world = Array.from({ length: nOptions }, (_, i) => counts[String(i)] || 0);
  const tot = world.reduce((a, b) => a + b, 0);
  if (tot <= 0) return mean;
  const p = priorFor(qid, world.map((c) => c / tot));
  return p ? p.shares.reduce((a, sh, i) => a + i * sh, 0) : mean;
}

/** A pick's prior over its options, the world shares read off its own
 * one-hot rows (each row's marginal is `2·share − 1`). */
function pickPrior(qid: string, meta: NonNullable<LoadingsDoc["items"]>, centre: OracleCentre): CohortPrior | null {
  if (centre !== "cohort" || !loadings) return null;
  const world: number[] = [];
  for (let i = 0; ; i++) {
    const key = `${qid}~${i}`;
    const r = loadings.q[key];
    if (!r || !meta[key]) break;
    world.push(r.n > 0 ? (1 + r.sum / r.n) / 2 : 0);
  }
  const tot = world.reduce((a, b) => a + b, 0);
  if (!world.length || tot <= 0) return null;
  return priorFor(qid, world.map((x) => x / tot));
}

/**
 * The viewer's evidence: every answer of theirs the published rows can
 * encode, as the centred residuals the fit itself is written in (D396).
 * Under the candidate engine that is the whole corpus — a two-option
 * answer as ±1 minus the row's marginal, an ordinal one as the index
 * standardised by the row's mean and sd, a pick as ±1 against each of the
 * question's one-hot rows — and under the online engine its two-option
 * rows alone. Read through `LIVE.answeredIndex()`, the banks × the vote
 * mirror, so an instrument item counts whether or not its crowd counts
 * are cached here. `excludeQid` keeps a target's own answer out of the
 * solve that guesses it.
 *
 * `centre` (D453) is what each residual is measured FROM: the world's
 * split, or the viewer's own groups'. The People lens keeps the world —
 * the crowd it places is centred by the world, and a viewer centred
 * differently would drift off their own crowd — and the seal uses the
 * same centre its guess starts from.
 */
function evidence(excludeQid?: string, centre: OracleCentre = "world"): { L: readonly number[]; r: number }[] {
  if (!LIVE.enabled || !loadings) return [];
  const answered = LIVE.answeredIndex();
  const meta = loadings.items;
  const out: { L: readonly number[]; r: number }[] = [];
  for (const [qid, idx] of Object.entries(answered)) {
    if (qid === excludeQid) continue;
    const row = loadings.q[qid];
    if (!meta) {
      // the online engine's rows: two-option only, ±1
      if (row && row.n > 0 && (idx === 0 || idx === 1)) {
        out.push({ L: row.v, r: (idx === 0 ? 1 : -1) - binCentre(qid, row, centre) });
      }
      continue;
    }
    const m = meta[qid];
    if (m && row && row.n > 0) {
      if (m.kind === "ord") {
        if (row.sd && row.sd >= 1e-6) out.push({ L: row.v, r: (idx - ordCentre(qid, row, m.nOptions, centre)) / row.sd });
      } else if (m.kind === "bin") {
        out.push({ L: row.v, r: (idx === 0 ? 1 : -1) - binCentre(qid, row, centre) });
      }
      continue;
    }
    // a pick: one row per option, keyed off the qid
    const prior = pickPrior(qid, meta, centre);
    for (let i = 0; ; i++) {
      const key = `${qid}~${i}`;
      const r = loadings.q[key];
      const mm = meta[key];
      if (!r || !mm) break;
      if (r.n > 0) {
        const mean = prior ? 2 * prior.shares[i] - 1 : r.sum / r.n;
        out.push({ L: r.v, r: (idx === i ? 1 : -1) - mean });
      }
    }
  }
  // The viewer's own catalogue picks against the pick rows (D455), under
  // both centres — a pick is an answer. The vote mirror holds a pick as
  // the entity's digits under the catalogue question's id (votePick), so
  // the row's question names it directly; an unanswered card is nothing.
  if (meta) {
    const votes = LIVE.myVotes();
    for (const [key, m] of Object.entries(meta)) {
      if (m.kind !== "pick" || m.entity === undefined || key === excludeQid) continue;
      const v = votes[m.qid];
      if (typeof v !== "string" || v === "") continue;
      const row = loadings.q[key];
      if (!row || row.n <= 0) continue;
      out.push({ L: row.v, r: (v === m.entity ? 1 : -1) - row.sum / row.n });
    }
  }
  // The viewer's own anchors against the anchor rows (D454), under the
  // world centre only — see the header. Encoded exactly as the fit
  // encodes everyone else's: +1 carrying the value, −1 carrying the dim
  // with another value, nothing for a dim left empty.
  if (meta && centre === "world") {
    const mine = LIVE.anchors() || {};
    for (const [key, m] of Object.entries(meta)) {
      if (m.kind !== "anc" || !m.dim || m.bucket === undefined) continue;
      const v = mine[m.dim];
      if (typeof v !== "string" || !v.trim()) continue;
      const row = loadings.q[key];
      if (!row || row.n <= 0) continue;
      out.push({ L: row.v, r: (v === m.bucket ? 1 : -1) - row.sum / row.n });
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
  /** Every published row the bank can name, grouped by question — what
   * the Map draws a dot per since D460. */
  rows,
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
    const lam = lambdaU();
    const t = tau();
    // what the answers have pinned — the precision is centre-agnostic —
    // and, for the call, the live centre's own lean on each candidate
    // (D456: learn first, then call; patternsMap.nextToAsk)
    const { invA } = ridgeSolve(evidence(), loadings.k, lam);
    const theta = ridgeSolve(evidence(undefined, ORACLE_CENTRE), loadings.k, lam).theta;
    const rows = loadings.q;
    const withLean = cands.map((p) => {
      const row = rows[p.q.id];
      const centre = row ? binCentre(p.q.id, row, ORACLE_CENTRE) : p.marginal;
      const g = oracleGuess(theta, p.L, centre, t);
      // the guess's distance from the crowd's base rate, in encoded units
      return { L: p.L, lean: Math.abs(2 * g.p0 - 1 - p.marginal) };
    });
    const turn = logSaved().filter((r) => r.bits != null).length;
    const i = nextToAsk(invA, withLean, lam, turn);
    return cands[i] ?? null;
  },
  /** The link's slope the fit chose (D456), for a reader that guesses
   * itself. */
  tau,
  /** The viewer's evidence, for a fold that solves them itself (the
   * People lens's own dot). */
  evidence,
  /** The anchor rows the fit published (D454), for a fold that solves
   * strangers from their frozen chips — the People lens's. Rows with a
   * basis only; never a pool item, since no bank question names them. */
  anchorRows(): { key: string; dim: string; bucket: string; L: readonly number[]; marginal: number }[] {
    if (!LIVE.enabled || !loadings?.items) return [];
    const out: { key: string; dim: string; bucket: string; L: readonly number[]; marginal: number }[] = [];
    for (const [key, m] of Object.entries(loadings.items)) {
      if (m.kind !== "anc" || !m.dim || m.bucket === undefined) continue;
      const row = loadings.q[key];
      if (!row || row.n <= 0) continue;
      out.push({ key, dim: m.dim, bucket: m.bucket, L: row.v, marginal: row.sum / row.n });
    }
    return out;
  },
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
    // fit's scorecard was measured at. TWICE (D453): once centred by the
    // world, once by the viewer's own groups, each guess starting from
    // its own centre. One is the seal, the other its shadow; both are
    // graded on the same answer, and the record says which was which.
    const lam = lambdaU();
    const t = tau();
    const thetaW = ridgeSolve(evidence(qid, "world"), loadings.k, lam).theta;
    const gw = oracleGuess(thetaW, target.L, target.marginal, t);
    const prior = priorFor(qid, [(1 + target.marginal) / 2, (1 - target.marginal) / 2]);
    const mc = prior ? 2 * prior.shares[0] - 1 : target.marginal;
    const thetaC = ridgeSolve(evidence(qid, "cohort"), loadings.k, lam).theta;
    const gc = oracleGuess(thetaC, target.L, mc, t);
    const [live, shadow] = ORACLE_CENTRE === "cohort" ? [gc, gw] : [gw, gc];
    const rec: OracleRecord = {
      qid,
      p0: live.p0,
      pred: live.pred,
      at: Date.now(),
      centre: ORACLE_CENTRE,
      m0: target.marginal,
      mc,
      alt: { p0: shadow.p0, pred: shadow.pred },
      ...(prior
        ? { prior: prior.rows.map((r) => ({ dim: r.dim, bucket: r.bucket, n: r.n, p0: r.shares[0] })) }
        : {}),
    };
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
    // the shadow and the base rate, on the same answer (D453) — a record
    // sealed before they existed carries neither and grades as it did
    if (rec.alt) rec.alt.bits = Math.round(surprisalBits(rec.alt.p0, mine) * 100) / 100;
    if (rec.m0 != null) rec.baseBits = Math.round(surprisalBits((1 + rec.m0) / 2, mine) * 100) / 100;
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
  /** The score strip: every graded record, oldest first — and, since
   * D453, the two centres side by side over the records that carry both
   * (`compared`), plus the base rate's own bits over the records that
   * stored it. Mean bits per graded answer, lower is better; `cohortBits`
   * against `worldBits` is the verdict on the prior for THIS viewer, and
   * either against `baseBits` is the skill the fit publishes for the
   * crowd, read on one person's record. */
  meter(): {
    records: OracleRecord[];
    called: number;
    avgBits: number;
    compared: number;
    cohortBits: number;
    worldBits: number;
    based: number;
    baseBits: number;
    /** Mean bits of the LIVE guess over the same records `baseBits` is
     * measured on — so `skill` compares like with like. */
    basedBits: number;
    /** 1 − basedBits/baseBits over the records that stored a base rate
     * (D456): the share of plain guessing's surprisal the Oracle removed
     * for this viewer. 0 with nothing to compare; negative is honest. */
    skill: number;
  } {
    const graded = logSaved().filter((r) => r.bits != null);
    const called = graded.filter((r) => r.pred === r.mine).length;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const avgBits = mean(graded.map((r) => r.bits as number));
    const both = graded.filter((r) => r.alt?.bits != null);
    const cohortBits = mean(both.map((r) => (r.centre === "cohort" ? (r.bits as number) : (r.alt!.bits as number))));
    const worldBits = mean(both.map((r) => (r.centre === "cohort" ? (r.alt!.bits as number) : (r.bits as number))));
    const withBase = graded.filter((r) => r.baseBits != null);
    const baseBits = mean(withBase.map((r) => r.baseBits as number));
    const basedBits = mean(withBase.map((r) => r.bits as number));
    return {
      records: graded,
      called,
      avgBits,
      compared: both.length,
      cohortBits,
      worldBits,
      based: withBase.length,
      baseBits,
      basedBits,
      skill: withBase.length && baseBits > 0 ? 1 - basedBits / baseBits : 0,
    };
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
  /**
   * The same table between two DOTS (D460) — what the Map's card says
   * once a dot can be an option, a catalogue pick, a scale or a profile
   * value rather than only a two-option question.
   *
   * ONE FOLD, three joins, because the honest basis differs:
   *
   *   · two question rows → their two bounded samples intersected, which
   *     is exactly what `say` has always done;
   *   · a profile value and a question row → the QUESTION's sample alone,
   *     cut by the frozen chips every row already carries (D8). No second
   *     list exists to intersect — an anchor has no sample of its own —
   *     and none is needed, which is why this is countable at all;
   *   · two profile values → nothing. Any question's sample could be
   *     cross-tabbed for it, and picking one would be picking the answer;
   *     the chord still draws, and the card says the fit's reading rather
   *     than a number.
   *
   * A side is what the DOT is: an option bead tests "picked this", a
   * catalogue bead "picked this entity", a scale "above the sample's
   * median", a two-option dot either side (the search below tries both).
   * Same lift rule as `say`: positive direction only, decent support,
   * a floor of twelve.
   */
  async sayRow(aKey: string, bKey: string): Promise<RowSay | null> {
    const key = `${aKey}>>${bKey}`;
    if (rowSayCache.has(key)) return rowSayCache.get(key) ?? null;
    const all = rows();
    const A = all.find((r) => r.key === aKey);
    const B = all.find((r) => r.key === bKey);
    // two beads of ONE question are the same answer's two faces: nobody
    // picked both, so the table is all zeros and the sentence would be a
    // tautology dressed as a finding
    if (!A || !B || A.qid === B.qid) return null;
    if (A.kind === "anc" && B.kind === "anc") return null;
    const out = A.kind === "anc" || B.kind === "anc"
      ? await sayOverOne(A, B)
      : await sayOverBoth(A, B);
    rowSayCache.set(key, out);
    return out;
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
    // The groups the seal recorded (D453), read off the record rather
    // than re-folded — they are what actually carried the call — kept on
    // the same two floors as the evidence rows: twelve answers in the
    // cell, and a lean of 0.54 toward the called side.
    const hadPrior = (rec.prior?.length ?? 0) > 0;
    const prior: WorkingPriorRow[] = (rec.prior ?? [])
      .map((r) => ({ dim: r.dim, bucket: r.bucket, n: r.n, share: rec.pred === 0 ? r.p0 : 1 - r.p0 }))
      .filter((r) => r.n >= 12 && r.share >= 0.54)
      .sort((a, b) => b.share - a.share || b.n - a.n);
    const evIds = rec.ev ?? [];
    if (!evIds.length) return { rows: [], prior, hadPrior, hadEv: false, thin: false, weak: false, failed: false };
    const items = pool();
    const target = items.find((p) => p.q.id === qid);
    if (!target) return { rows: [], prior, hadPrior, hadEv: true, thin: false, weak: false, failed: false };
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
    return { rows, prior, hadPrior, hadEv: true, thin, weak, failed };
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
