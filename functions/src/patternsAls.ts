// patternsAls.ts — the candidate engine (D395): the shipped MODEL with a
// batch SOLVER, over the whole corpus rather than its two-option half.
//
// THE MODEL is patternsFit.ts's, unchanged: an answer is encoded and
// centred by its item's own mean, r = x − mean, and r ≈ θ·L with θ a
// person's K numbers and L an item's. Every device reader — the Map's
// cosine, `estimateTheta`, `marginal + θ·L`, `surprisalBits` — assumes
// exactly this, which is why the candidate keeps it: the vectors it
// publishes drop into the same `q` rows and every client fold reads them
// unchanged.
//
// THE SOLVER is different, and that is the whole point. patternsFit.ts
// takes one damped SGD step per observation as the day folds; measured on
// a log shaped like the app's own (docs/ALGORITHM-REFLECTION.md §1, D394)
// its vectors never leave their hash seeds, because the bilinear step
// only ignites when the same person answers the same question many times
// and D5 forbids that. This engine instead re-solves every night by
// ALTERNATING RIDGE LEAST SQUARES over every observation the fit holds
// (the person-vectors given the items, then the items given the
// person-vectors, three sweeps, warm-started from last night), with
// weighted-λ regularisation — λ scaled by each row's observation count,
// the Netflix-prize form — so an item with twenty answers stays shrunk
// while one with two thousand is free to fit, and item norms clamped at 1
// because |r| ≤ 2 and θ is unit-scale, so a longer vector is overfitting
// by construction. On the probe's app-shaped log it recovers the
// generating geometry at Pearson 0.95–0.99 (the shipped 0.03) and takes
// 57–71% of the achievable predictive gain.
//
// THE CORPUS is every option-shaped core item, not only the two-option
// ones (the owner's call, 2026-09-06 — docs/ALGORITHM-REFLECTION.md §3):
//
//   bin   two options            x = +1 for option 0, −1 for option 1
//   ord   ordinal, >2 options    x = the option index, standardised by the
//         (scale · rating · dial) item's own mean and sd — so a five-point
//                                agree scale and a ten-point rating carry
//                                the same weight per answer
//   opt   unordered, >2 options  one pseudo-item PER OPTION: x = +1 if
//         (choice · vote · …)    that option was picked, −1 if not, each
//                                centred by its own share
//   pick  a catalogue pick       one pseudo-item PER ENTITY enough people
//         (D434)                 picked — `pick-pk01~25` — x = +1 for a
//                                person who picked it, −1 for one who
//                                picked another entity on that question,
//                                nothing for one who never answered it.
//                                Compiled from the scanned people like the
//                                anchors, floored at the pool's basis and
//                                capped at the board's own size, so a
//                                favourite spread over a thousand species
//                                names its popular picks and says nothing
//                                about the rest — which is all it can
//                                honestly say (PATTERNS-PLAN.md §5)
//   anc   a profile anchor       one pseudo-item PER VALUE the crowd
//         (D433)                 carries — `anchor~gender~Woman` — x = +1
//                                for a person whose frozen anchors carry
//                                that value, −1 for one whose anchors
//                                carry the dim with another value, no
//                                observation for one who never filled the
//                                dim in. Compiled from the scanned PEOPLE
//                                rather than from the bank (the values are
//                                data), floored and capped per dim, and
//                                fitted exactly like a pick's rows — so a
//                                person's vector starts from their
//                                demographics before their first answer,
//                                and every lens that solves a vector reads
//                                them (PATTERNS-PLAN.md §4)
//
// The instrument items (`surface: test`, all five-point scales) are `ord`
// and join; D161's sample-bias argument is satisfied because every
// instrument item is served to everyone. What is drawn is a separate
// question: the Map draws `bin` items only until an ordinal or a
// multi-option node has a design (D352); `ord` and `opt` items feed the
// person-vector solves (the Oracle's, the People lens's) on day one.
//
// THE CROSSOVER is measured, not bet. The candidate publishes under
// `candidates.als` on the loadings doc, scored one step ahead on the same
// two-option observations the shipped fit scores itself on, against the
// same marginal-only baseline (D394). It replaces `q` only after
// PATTERNS_CROSSOVER_NIGHTS consecutive nights of better skill, and the
// rule is symmetric — whichever engine has lost the last fortnight is the
// candidate. pat-6 in MEASUREMENT-NOTES.md: engine choice is a
// measurement, run continuously and out of sample.
//
// Pure on purpose (the pure.ts contract): no firebase, no I/O, no
// randomness — the warm start is last night's vectors or the qid's hash
// seed, iteration order is sorted, and the same inputs reproduce the same
// model bit for bit.
import { PATTERNS_K, PATTERNS_MIN_BASIS, seedLoading, prequentialBits, type PatternsDayScore, type PatternsQuality } from "./patternsFit";
import { BREAKDOWN_DIMS, BREAKDOWN_MAX_BUCKETS, CANON_TOP_N, breakdownBucket, type BreakdownDim } from "./pure";

export type ItemKind = "bin" | "ord" | "opt" | "anc" | "pick";

/** One fitted item, compiled from the bank. */
export interface ItemSpec {
  /** The published row key: the qid for bin and ord items, `qid~opt` for
   * a one-hot pseudo-item (`~` is outside the qid alphabet, which is
   * [A-Za-z0-9_-]). */
  key: string;
  kind: ItemKind;
  qid: string;
  /** The option this pseudo-item stands for — opt items only. */
  opt?: number;
  /** The question's option count, for the client's own encoding. For an
   * anchor item: how many of the dim's values were kept as items. */
  nOptions: number;
  /** The breakdown dim and the value this item stands for — anc only. */
  dim?: string;
  bucket?: string;
  /** The catalogue entity this item stands for — pick only (D434). */
  entity?: string;
}

/** A person's catalogue picks as the compaction keeps them (D434): the
 * catalogue question's id → the canonical entity key the trigger
 * validated against the committed catalogue. */
export type PickMap = Record<string, string>;

/** What else is known about a person beside their answer map — the
 * anchors (D433) and the picks (D434) — for the folds that solve a
 * vector: the fit, the scorecard, the device's own read. */
export interface PersonKnown {
  an?: AnchorMap;
  p?: PickMap;
}

/** A pick item's row key: the question's id and the entity, `~`-joined
 * like a one-hot option's — the qid alphabet has no `~`, so neither can
 * collide with a bank id, and a catalogue question's entity keys are
 * digits, so the two never collide with each other either (an option's
 * suffix is an index into a question that HAS options; a catalogue
 * question has none). */
export const pickKey = (qid: string, entity: string): string => `${qid}~${entity}`;
/** People picking an entity before it becomes an item — the pool's own
 * basis floor, for the anchors' reason. */
export const PICK_ITEM_FLOOR = PATTERNS_MIN_BASIS;
/** Items per catalogue question — the board's own size (D14): what the
 * reveal names is what the fit may learn a vector for. */
export const PICK_ITEM_CAP = CANON_TOP_N;

/**
 * The pick items, compiled from the people the fit is about to read:
 * per catalogue question, every entity at least `floor` people picked,
 * the most-picked first (ties by key), at most `cap` of them. An entity
 * under the floor or past the cap is not an item; a person who picked it
 * still contributes −1 to the question's kept items.
 */
export function compilePickItems(
  people: Iterable<{ p?: PickMap }>,
  floor: number = PICK_ITEM_FLOOR,
  cap: number = PICK_ITEM_CAP,
): ItemSpec[] {
  const counts = new Map<string, Map<string, number>>();
  for (const person of people) {
    if (!person.p) continue;
    for (const [qid, entity] of Object.entries(person.p)) {
      if (typeof entity !== "string" || !entity) continue;
      const m = counts.get(qid) ?? new Map<string, number>();
      m.set(entity, (m.get(entity) ?? 0) + 1);
      counts.set(qid, m);
    }
  }
  const out: ItemSpec[] = [];
  for (const qid of [...counts.keys()].sort()) {
    const kept = [...(counts.get(qid) as Map<string, number>).entries()]
      .filter(([, n]) => n >= floor)
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
      .slice(0, cap);
    for (const [entity] of kept) {
      out.push({ key: pickKey(qid, entity), kind: "pick", qid, nOptions: kept.length, entity });
    }
  }
  return out;
}

/** The pick specs a published model already carries — the scorecard's
 * index before tonight's people re-compile them. */
export function pickSpecsOf(items: Record<string, ItemMeta> | undefined): ItemSpec[] {
  const out: ItemSpec[] = [];
  for (const [key, m] of Object.entries(items ?? {})) {
    if (m.kind !== "pick" || m.entity === undefined) continue;
    out.push({ key, kind: "pick", qid: m.qid, nOptions: m.nOptions, entity: m.entity });
  }
  return out;
}

/** The raw encoded value of a person's pick under a pick item: +1 picked
 * it, −1 picked another entity on that question. */
export function encodePick(item: { entity?: string }, entity: string): number {
  return entity === item.entity ? 1 : -1;
}

/** A person's frozen anchors as the compaction keeps them: dim → value,
 * every value already validated by `breakdownBucket`, so a key here is a
 * BREAKDOWN_DIMS member and a value is a label the cube would count. */
export type AnchorMap = Record<string, string>;

/** The pseudo-qid an anchor item answers into — `~` is outside the qid
 * alphabet, so it can never name a bank question, and the device's pool
 * join (which names rows by bank id) never draws it. */
export const ANCHOR_PREFIX = "anchor~";
export const anchorQid = (dim: string): string => `${ANCHOR_PREFIX}${dim}`;
export const anchorKey = (dim: string, bucket: string): string => `${anchorQid(dim)}~${bucket}`;
/** People carrying a value before it becomes an item — the pool's own
 * basis floor, for the same reason: a vector fitted on a handful is a
 * seed with a name. */
export const ANCHOR_ITEM_FLOOR = PATTERNS_MIN_BASIS;

/** The anchors an entry or a profile carries, kept to what the cube
 * would count — BREAKDOWN_DIMS keys, `breakdownBucket`-valid labels. */
export function validAnchors(raw: unknown): AnchorMap | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const src = raw as Record<string, unknown>;
  const out: AnchorMap = {};
  for (const dim of BREAKDOWN_DIMS) {
    const b = breakdownBucket(src[dim], dim);
    if (b !== null) out[dim] = b;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * The anchor items, compiled from the people the fit is about to read:
 * per dim, every value at least `floor` people carry, the biggest first
 * (ties by label, so the list is the same on every run), at most `cap` of
 * them — the cube's own cap, and the reason a free-text dim like city
 * cannot mint a thousand rows. A value under the floor or past the cap is
 * not an item; a person carrying it still contributes −1 to the dim's
 * kept items ("not any of these"), which is all the model can honestly
 * say about them.
 */
export function compileAnchorItems(
  people: Iterable<{ an?: AnchorMap }>,
  floor: number = ANCHOR_ITEM_FLOOR,
  cap: number = BREAKDOWN_MAX_BUCKETS,
): ItemSpec[] {
  const counts = new Map<BreakdownDim, Map<string, number>>();
  for (const p of people) {
    const an = validAnchors(p.an);
    if (!an) continue;
    for (const [dim, b] of Object.entries(an) as [BreakdownDim, string][]) {
      const m = counts.get(dim) ?? new Map<string, number>();
      m.set(b, (m.get(b) ?? 0) + 1);
      counts.set(dim, m);
    }
  }
  const out: ItemSpec[] = [];
  for (const dim of BREAKDOWN_DIMS) {
    const m = counts.get(dim);
    if (!m) continue;
    const kept = [...m.entries()]
      .filter(([, n]) => n >= floor)
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
      .slice(0, cap);
    for (const [bucket] of kept) {
      out.push({ key: anchorKey(dim, bucket), kind: "anc", qid: anchorQid(dim), nOptions: kept.length, dim, bucket });
    }
  }
  return out;
}

/** The anchor specs a published model already carries — what the
 * scorecard solves a person against before tonight's fit re-compiles
 * them from tonight's people. */
export function anchorSpecsOf(items: Record<string, ItemMeta> | undefined): ItemSpec[] {
  const out: ItemSpec[] = [];
  for (const [key, m] of Object.entries(items ?? {})) {
    if (m.kind !== "anc" || !m.dim || m.bucket === undefined) continue;
    out.push({ key, kind: "anc", qid: m.qid, nOptions: m.nOptions, dim: m.dim, bucket: m.bucket });
  }
  return out;
}

/** The raw encoded value of a person's anchors under an anchor item:
 * +1 carrying the value, −1 carrying the dim with another value. */
export function encodeAnchor(item: { bucket?: string }, value: string): number {
  return value === item.bucket ? 1 : -1;
}

/** The bank's ordinal forms: the option INDEX is a position on a scale,
 * so its distance from the mean means something. Everything else with
 * more than two options is a pick among unordered labels. `pulse` is
 * ordinal too but never core, so it never reaches this. */
export const ORDINAL_TYPES: ReadonlySet<string> = new Set(["scale", "rating", "dial"]);

/** The one shape the eligibility rule reads off a bank question. */
export interface BankQuestionLike {
  id: string;
  surface: string;
  type: string;
  options?: unknown;
  core?: boolean;
}

/** Widened eligibility (D395/§3): option-shaped, and core — the daily
 * bank, `core: true` feed questions, and the instrument items. Learn
 * cards are knowledge, not disposition, and stay out; pulse, call,
 * catalog, rank and the sealed duel surfaces never had an option share
 * to fold. */
export function itemEligible(q: BankQuestionLike): boolean {
  if (!Array.isArray(q.options) || q.options.length < 2) return false;
  if (q.surface === "daily" || q.surface === "test") return true;
  return q.surface === "feed" && q.core === true;
}

export function compileItems(bank: readonly BankQuestionLike[]): ItemSpec[] {
  const out: ItemSpec[] = [];
  for (const q of bank) {
    if (!itemEligible(q)) continue;
    const n = (q.options as unknown[]).length;
    if (n === 2) out.push({ key: q.id, kind: "bin", qid: q.id, nOptions: 2 });
    else if (ORDINAL_TYPES.has(q.type)) out.push({ key: q.id, kind: "ord", qid: q.id, nOptions: n });
    else for (let i = 0; i < n; i++) out.push({ key: `${q.id}~${i}`, kind: "opt", qid: q.id, opt: i, nOptions: n });
  }
  return out;
}

/** The raw encoded value of an answer under an item — before centring.
 * bin: ±1; ord: the index itself; opt: ±1 for picked/not. */
export function encodeFor(item: ItemSpec, optionIdx: number): number {
  if (item.kind === "bin") return optionIdx === 0 ? 1 : -1;
  if (item.kind === "ord") return optionIdx;
  return optionIdx === item.opt ? 1 : -1;
}

/** A published item row: the vector, its basis, and the sum of raw
 * encoded values (so `sum/n` is the mean the residual centres by, for
 * every kind — the client's `marginal` reads it unchanged for bin rows). */
export interface AlsRow {
  v: number[];
  n: number;
  sum: number;
  /** Ordinal items only: the sd the residual standardises by. */
  sd?: number;
}

/** What the client needs beside the row to encode its own answer. */
export interface ItemMeta {
  kind: ItemKind;
  qid: string;
  opt?: number;
  nOptions: number;
  /** anc only: the dim and the value, so a device can encode its own
   * anchors against the row (D433). */
  dim?: string;
  bucket?: string;
  /** pick only: the entity, so a device can encode its own pick against
   * the row (D434). */
  entity?: string;
}

export interface AlsModel {
  k: number;
  rows: Record<string, AlsRow>;
  items: Record<string, ItemMeta>;
}

export const emptyAls = (k: number = PATTERNS_K): AlsModel => ({ k, rows: {}, items: {} });

/** A person's current answers, as the state doc carries them: qid → option index. */
export type AnswerMap = Record<string, number>;

/** The ridge — λ scaled by the count of rows already folded in, or a flat
 * λ for the device-shaped solve. */
export const ALS_LAMBDA = 0.15;
export const ALS_SWEEPS = 3;
/** The device ridge the candidate is scored under; the sweep publishes
 * the best of these as `lambdaU` so the phone reads it rather than
 * assuming 0.5 (ALGORITHM-REFLECTION §2.3). 0.5 first, because it is the
 * shipped value and the comparison should include it. */
export const ALS_LAMBDAS_U: readonly number[] = [0.5, 1, 2, 4];
/** Below this an ordinal item has one answer, or everyone gave the same
 * one — no variance to standardise by, so the item carries nothing yet. */
export const ALS_MIN_SD = 1e-6;
/** Nights a candidate must out-skill the engine, consecutively, before it
 * becomes the engine. Fourteen: two weeks of the daily rotation, long
 * enough that a lucky week cannot swap the map. */
export const PATTERNS_CROSSOVER_NIGHTS = 14;

// ── linear algebra, K×K ──────────────────────────────────────────────

function solve(A: number[][], b: number[]): number[] {
  const k = b.length;
  const M = A.map((r) => [...r]);
  const v = [...b];
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (piv !== c) { [M[c], M[piv]] = [M[piv], M[c]]; [v[c], v[piv]] = [v[piv], v[c]]; }
    const d = M[c][c] || 1e-9;
    for (let r = c + 1; r < k; r++) {
      const f = M[r][c] / d;
      for (let j = c; j < k; j++) M[r][j] -= f * M[c][j];
      v[r] -= f * v[c];
    }
  }
  const x = new Array<number>(k).fill(0);
  for (let r = k - 1; r >= 0; r--) {
    let t = v[r];
    for (let j = r + 1; j < k; j++) t -= M[r][j] * x[j];
    x[r] = t / (M[r][r] || 1e-9);
  }
  return x;
}

/** The ridge solve the device runs (patternsMap.estimateTheta's shape):
 * θ = (Σ L Lᵀ + λI)⁻¹ Σ r L. */
export function ridgeTheta(obs: readonly { L: readonly number[]; r: number }[], k: number, lambda: number): number[] {
  const A: number[][] = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? lambda : 0)));
  const b = new Array<number>(k).fill(0);
  for (const o of obs) {
    for (let i = 0; i < k; i++) {
      const li = o.L[i] ?? 0;
      b[i] += o.r * li;
      for (let j = 0; j < k; j++) A[i][j] += li * (o.L[j] ?? 0);
    }
  }
  return solve(A, b);
}

/** Symmetric eigen-decomposition by cyclic Jacobi — K is 8, so the whole
 * thing is a few hundred rotations. Returns eigenvalues and the matrix
 * whose COLUMNS are the eigenvectors. */
export function symmetricEigen(S: readonly number[][]): { values: number[]; vectors: number[][] } {
  const k = S.length;
  const A = S.map((r) => [...r]);
  const V: number[][] = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < k; p++) for (let q = p + 1; q < k; q++) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < k; p++) {
      for (let q = p + 1; q < k; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let i = 0; i < k; i++) {
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = c * aip - s * aiq;
          A[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < k; i++) {
          const api = A[p][i], aqi = A[q][i];
          A[p][i] = c * api - s * aqi;
          A[q][i] = s * api + c * aqi;
        }
        for (let i = 0; i < k; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  return { values: A.map((r, i) => r[i]), vectors: V };
}

/**
 * The K×K orthogonal matrix that best carries `from` onto `to` over the
 * rows they share (orthogonal Procrustes, via the polar decomposition
 * R = M (MᵀM)^{-1/2}, M = Σ fromᵢᵀ toᵢ). Identity when the shared rows do
 * not pin every direction — a rotation fitted on too few rows is worse
 * than none.
 */
export function procrustes(from: Record<string, readonly number[]>, to: Record<string, readonly number[]>, k: number): number[][] {
  const I = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
  const M: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  let shared = 0;
  for (const [key, f] of Object.entries(from)) {
    const t = to[key];
    if (!t) continue;
    shared += 1;
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) M[i][j] += (f[i] ?? 0) * (t[j] ?? 0);
  }
  if (shared < k) return I;
  // MᵀM, then its inverse square root through the eigen-decomposition
  const MtM: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    let s = 0;
    for (let l = 0; l < k; l++) s += M[l][i] * M[l][j];
    MtM[i][j] = s;
  }
  const { values, vectors } = symmetricEigen(MtM);
  const scale = Math.max(...values.map(Math.abs), 0);
  // a direction the shared rows do not span cannot be aligned — refuse the
  // whole rotation rather than invent it
  if (!values.every((x) => x > 1e-9 * Math.max(scale, 1e-300))) return I;
  const inv: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    let s = 0;
    for (let l = 0; l < k; l++) s += vectors[i][l] * vectors[j][l] / Math.sqrt(values[l]);
    inv[i][j] = s;
  }
  const R: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    let s = 0;
    for (let l = 0; l < k; l++) s += M[i][l] * inv[l][j];
    R[i][j] = s;
  }
  return R;
}

/** Rotate every row of a model by R (row · R). */
export function rotateModel(model: AlsModel, R: number[][]): AlsModel {
  const rows: Record<string, AlsRow> = {};
  for (const [key, row] of Object.entries(model.rows)) {
    const v = new Array<number>(model.k).fill(0);
    for (let j = 0; j < model.k; j++) {
      let s = 0;
      for (let i = 0; i < model.k; i++) s += (row.v[i] ?? 0) * R[i][j];
      v[j] = s;
    }
    rows[key] = { ...row, v };
  }
  return { k: model.k, rows, items: { ...model.items } };
}

// ── observations ─────────────────────────────────────────────────────

/** The corpus, compiled and indexed once per run. */
export interface ItemIndex {
  specs: ItemSpec[];
  byKey: Map<string, ItemSpec>;
  /** Every item a question answers into — one for bin/ord, one per option for opt. */
  byQid: Map<string, ItemSpec[]>;
  /** Every anchor item a dim's value answers into (D433). */
  byDim: Map<string, ItemSpec[]>;
  /** Every pick item a catalogue question's pick answers into (D434). */
  byPick: Map<string, ItemSpec[]>;
}

export function indexItems(specs: readonly ItemSpec[]): ItemIndex {
  const byKey = new Map<string, ItemSpec>();
  const byQid = new Map<string, ItemSpec[]>();
  const byDim = new Map<string, ItemSpec[]>();
  const byPick = new Map<string, ItemSpec[]>();
  for (const s of specs) {
    byKey.set(s.key, s);
    if (s.kind === "anc") {
      const list = byDim.get(s.dim as string) ?? [];
      list.push(s);
      byDim.set(s.dim as string, list);
      continue;
    }
    if (s.kind === "pick") {
      const list = byPick.get(s.qid) ?? [];
      list.push(s);
      byPick.set(s.qid, list);
      continue;
    }
    const list = byQid.get(s.qid) ?? [];
    list.push(s);
    byQid.set(s.qid, list);
  }
  return { specs: [...specs], byKey, byQid, byDim, byPick };
}

/** A person's raw encoded values, item by item — their answers under the
 * question items, their anchors under the anchor items, their picks
 * under the pick items. The one walk the stats, the fit and the
 * observations all take. */
function encodedOf(index: ItemIndex, person: { a: AnswerMap } & PersonKnown, skipQid?: string): { key: string; x: number }[] {
  const out: { key: string; x: number }[] = [];
  for (const [qid, idx] of Object.entries(person.a)) {
    if (qid === skipQid || typeof idx !== "number") continue;
    const specs = index.byQid.get(qid);
    if (!specs) continue;
    for (const s of specs) out.push({ key: s.key, x: encodeFor(s, idx) });
  }
  if (person.an) {
    for (const [dim, value] of Object.entries(person.an)) {
      const specs = index.byDim.get(dim);
      if (!specs || typeof value !== "string") continue;
      for (const s of specs) out.push({ key: s.key, x: encodeAnchor(s, value) });
    }
  }
  if (person.p) {
    for (const [qid, entity] of Object.entries(person.p)) {
      if (qid === skipQid) continue;
      const specs = index.byPick.get(qid);
      if (!specs || typeof entity !== "string") continue;
      for (const s of specs) out.push({ key: s.key, x: encodePick(s, entity) });
    }
  }
  return out;
}

/** Per-item sufficient statistics over the people: the basis, and the
 * mean and sd of the raw encoded value — answers under the question
 * items, anchors under the anchor items (D433). */
export function itemStats(index: ItemIndex, people: Iterable<{ a: AnswerMap } & PersonKnown>): Record<string, { n: number; sum: number; sumSq: number }> {
  const out: Record<string, { n: number; sum: number; sumSq: number }> = {};
  for (const p of people) {
    for (const { key, x } of encodedOf(index, p)) {
      const t = (out[key] ??= { n: 0, sum: 0, sumSq: 0 });
      t.n += 1;
      t.sum += x;
      t.sumSq += x * x;
    }
  }
  return out;
}

const sdOf = (t: { n: number; sum: number; sumSq: number }): number => {
  const mean = t.sum / t.n;
  return Math.sqrt(Math.max(0, t.sumSq / t.n - mean * mean));
};

/** The centred residual for one answer under one item, given the item's
 * published row — the same arithmetic on the server and the phone. Null
 * when the item cannot carry it yet (an ordinal with no spread). */
export function residualFor(item: ItemMeta, row: { n: number; sum: number; sd?: number }, optionIdx: number): number | null {
  if (item.kind === "anc" || item.kind === "pick") return null; // a label, not an index — residualOf
  if (row.n <= 0) return null;
  const mean = row.sum / row.n;
  if (item.kind === "ord") {
    if (!row.sd || row.sd < ALS_MIN_SD) return null;
    return (optionIdx - mean) / row.sd;
  }
  const x = item.kind === "bin" ? (optionIdx === 0 ? 1 : -1) : optionIdx === item.opt ? 1 : -1;
  return x - mean;
}

/** The centred residual of a RAW encoded value under an item's row — the
 * form the anchor items need (their value is a label) and the one the
 * others reduce to: an ordinal standardises, everything else subtracts
 * the mean. */
export function residualOf(item: { kind: ItemKind }, row: { n: number; sum: number; sd?: number }, x: number): number | null {
  if (row.n <= 0) return null;
  const mean = row.sum / row.n;
  if (item.kind === "ord") {
    if (!row.sd || row.sd < ALS_MIN_SD) return null;
    return (x - mean) / row.sd;
  }
  return x - mean;
}

/** A person's observations under a model: every item their answers reach,
 * every anchor item their anchors reach (D433), every pick item their
 * picks reach (D434). */
export function observationsOf(model: AlsModel, person: { a: AnswerMap } & PersonKnown, index: ItemIndex, skipQid?: string): { L: readonly number[]; r: number }[] {
  const obs: { L: readonly number[]; r: number }[] = [];
  for (const { key, x } of encodedOf(index, person, skipQid)) {
    const row = model.rows[key];
    const item = model.items[key];
    if (!row || !item) continue;
    const r = residualOf(item, row, x);
    if (r === null) continue;
    obs.push({ L: row.v, r });
  }
  return obs;
}

// ── the fit ──────────────────────────────────────────────────────────

/**
 * Re-solve the model over every answer map. Warm-started from `prev`
 * where an item already has a row (its published vector), from the qid's
 * hash seed otherwise — so a re-run from the same maps and the same prior
 * is bit-identical. Item stats (n, sum, sd) are recomputed from the maps
 * every night: they are counts, and counts are recomputed rather than
 * carried.
 */
export function alsFit(
  prev: AlsModel | null,
  people: readonly ({ uid: string; a: AnswerMap } & PersonKnown)[],
  index: ItemIndex,
  k: number = PATTERNS_K,
  opts: { sweeps?: number; lambda?: number } = {},
): AlsModel {
  const sweeps = opts.sweeps ?? ALS_SWEEPS;
  const lam = opts.lambda ?? ALS_LAMBDA;
  const sorted = [...people].sort((x, y) => (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0));
  const stats = itemStats(index, sorted);
  const keys = Object.keys(stats).sort();
  const rows: Record<string, AlsRow> = {};
  const items: Record<string, ItemMeta> = {};
  for (const key of keys) {
    const s = index.byKey.get(key) as ItemSpec;
    const t = stats[key];
    const sd = s.kind === "ord" ? sdOf(t) : undefined;
    const warm = prev?.rows[key]?.v;
    rows[key] = {
      v: warm && warm.length === k ? [...warm] : seedLoading(key, k).map((x) => x * 4),
      n: t.n,
      sum: t.sum,
      ...(sd === undefined ? {} : { sd }),
    };
    items[key] = {
      kind: s.kind, qid: s.qid, nOptions: s.nOptions,
      ...(s.opt === undefined ? {} : { opt: s.opt }),
      ...(s.dim === undefined ? {} : { dim: s.dim, bucket: s.bucket as string }),
      ...(s.entity === undefined ? {} : { entity: s.entity }),
    };
  }
  const model: AlsModel = { k, rows, items };
  // each person's observations, resolved to row references once
  const perPerson = sorted.map((p) => {
    const obs: { key: string; r: number }[] = [];
    for (const { key, x } of encodedOf(index, p)) {
      const row = rows[key];
      if (!row) continue;
      const r = residualOf(items[key], row, x);
      if (r !== null) obs.push({ key, r });
    }
    return obs;
  });
  const byKey = new Map<string, { u: number; r: number }[]>();
  perPerson.forEach((obs, u) => { for (const o of obs) { const list = byKey.get(o.key) ?? []; list.push({ u, r: o.r }); byKey.set(o.key, list); } });
  const thetas: number[][] = sorted.map(() => new Array<number>(k).fill(0));
  for (let sw = 0; sw < sweeps; sw++) {
    for (let u = 0; u < sorted.length; u++) {
      const obs = perPerson[u];
      if (!obs.length) continue;
      thetas[u] = ridgeTheta(obs.map((o) => ({ L: rows[o.key].v, r: o.r })), k, lam * obs.length + 0.5);
    }
    for (const key of keys) {
      const list = byKey.get(key);
      if (!list?.length) continue;
      const v = ridgeTheta(list.map((o) => ({ L: thetas[o.u], r: o.r })), k, lam * list.length + 0.5);
      const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
      rows[key].v = norm > 1 ? v.map((x) => x / norm) : v;
    }
  }
  return model;
}

// ── the scorecard, one step ahead ────────────────────────────────────

/** One entry of a day in the online engine's own fold order (people by
 * uid, then questions by qid): a first answer, or a revision carrying the
 * value it replaces. */
export interface DayEntry {
  uid: string;
  qid: string;
  x: number;
  prev?: number;
}

/**
 * Score a day's two-option entries under a model as it stood BEFORE the
 * day — the same prequential currency the online fit publishes
 * (patternsFit.foldUserDay's scoring arm), so the two engines' skills
 * compare. Three things make the comparison exact rather than roughly
 * fair:
 *
 *   · the ENTRIES are the online engine's, in its order, revisions
 *     included — a revision is not scored (the person was scored the day
 *     they first answered) but it moves the marginal the way the online
 *     fold moves it, clamp and 0/0 guard and all;
 *   · the MARGINAL both engines guess from is one running number, seeded
 *     from `marginalStart` (the online engine's counts before the day)
 *     and stepped per entry — so `baseBits` is bit-identical across the
 *     two scorecards and skill has one denominator;
 *   · the PERSON'S VECTOR is re-solved from `history` — their answer map
 *     as it stood before the day, centred by the candidate's own row
 *     means — which is what the device does.
 *
 * A model with no row for an item guesses the marginal alone, as the
 * online fit does for a question it has never folded.
 */
export function alsScoreDay(
  model: AlsModel | null,
  index: ItemIndex,
  history: ReadonlyMap<string, AnswerMap>,
  entries: readonly DayEntry[],
  marginalStart: ReadonlyMap<string, { n: number; sum: number }>,
  lambdaU: number,
  known?: ReadonlyMap<string, PersonKnown>,
): PatternsDayScore {
  const score: PatternsDayScore = { n: 0, bits: 0, baseBits: 0, perQ: {} };
  const running = new Map<string, { n: number; sum: number }>();
  for (const [qid, m] of marginalStart) running.set(qid, { n: m.n, sum: m.sum });
  const thetaCache = new Map<string, number[]>();
  for (const e of entries) {
    const m = running.get(e.qid) ?? { n: 0, sum: 0 };
    running.set(e.qid, m);
    // the online fold's own revision rule: nothing to revise at n = 0
    const revision = e.prev !== undefined && m.n > 0;
    if (!revision) {
      const mPrev = m.n > 0 ? m.sum / m.n : 0;
      let dot = 0;
      const row = model?.rows[e.qid];
      if (model && row) {
        let th = thetaCache.get(e.uid);
        if (!th) {
          // the person's anchors are known before their answer is — the
          // profile precedes the vote — so they are evidence one step
          // ahead exactly as their earlier answers are (D433); their
          // picks from before the day the same (D434)
          th = ridgeTheta(observationsOf(model, { a: history.get(e.uid) ?? {}, ...(known?.get(e.uid) ?? {}) }, index), model.k, lambdaU);
          thetaCache.set(e.uid, th);
        }
        for (let i = 0; i < model.k; i++) dot += th[i] * (row.v[i] ?? 0);
      }
      const bits = prequentialBits(mPrev + dot, e.x);
      const base = prequentialBits(mPrev, e.x);
      score.n += 1;
      score.bits += bits;
      score.baseBits += base;
      const t = (score.perQ[e.qid] ??= { n: 0, bits: 0, baseBits: 0 });
      t.n += 1;
      t.bits += bits;
      t.baseBits += base;
    }
    if (revision) {
      m.sum += e.x - (e.prev as number);
      if (m.sum > m.n) m.sum = m.n;
      else if (m.sum < -m.n) m.sum = -m.n;
    } else {
      m.n += 1;
      m.sum += e.x;
    }
  }
  return score;
}

/** Sum two day tallies (a catch-up scores several owed days as one). */
export function mergeScores(a: PatternsDayScore, b: PatternsDayScore): PatternsDayScore {
  const perQ: PatternsDayScore["perQ"] = {};
  for (const src of [a.perQ, b.perQ]) {
    for (const [qid, t] of Object.entries(src)) {
      const m = (perQ[qid] ??= { n: 0, bits: 0, baseBits: 0 });
      m.n += t.n; m.bits += t.bits; m.baseBits += t.baseBits;
    }
  }
  return { n: a.n + b.n, bits: a.bits + b.bits, baseBits: a.baseBits + b.baseBits, perQ };
}

// ── the crossover ────────────────────────────────────────────────────

/**
 * Whether the candidate beat the engine tonight, on a basis worth
 * counting: both scored at least the scorecard's own floor of
 * observations, the candidate's skill is strictly higher, and the
 * candidate is itself better than the marginal. The last clause is what
 * keeps a candidate with nothing to say from winning by default: the
 * online engine's within-day steps can leave it a hair UNDER the marginal
 * on a fresh crowd, and a candidate that merely ties the coin must not
 * collect a streak off that. Neither deserves the rows on such a night;
 * the incumbent keeps them.
 */
export function candidateWon(engine: PatternsQuality | undefined, candidate: PatternsQuality | undefined, floor: number): boolean {
  if (!engine || !candidate) return false;
  if (engine.n < floor || candidate.n < floor) return false;
  return candidate.skill > 0 && candidate.skill > engine.skill;
}

/** The streak after tonight: one more on a win, back to zero otherwise. */
export function nextCrossoverStreak(prev: number, won: boolean): number {
  return won ? prev + 1 : 0;
}

// ── publication ──────────────────────────────────────────────────────

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

/** Rows at publication precision: 4 dp vectors, integer sums, sd at 4 dp. */
export function publishableAls(model: AlsModel): Record<string, AlsRow> {
  const out: Record<string, AlsRow> = {};
  for (const [key, row] of Object.entries(model.rows)) {
    out[key] = {
      v: row.v.map(round4),
      n: row.n,
      sum: row.sum,
      ...(row.sd === undefined ? {} : { sd: round4(row.sd) }),
    };
  }
  return out;
}

/** The two-option rows only — what the Map may draw, and what the tab's
 * mount gate counts (patternsFit.readyPool's argument). */
export function binRows(rows: Record<string, AlsRow>, items: Record<string, ItemMeta>): Record<string, { v: number[]; n: number; sum: number }> {
  const out: Record<string, { v: number[]; n: number; sum: number }> = {};
  for (const [key, row] of Object.entries(rows)) if (items[key]?.kind === "bin") out[key] = { v: row.v, n: row.n, sum: row.sum };
  return out;
}
