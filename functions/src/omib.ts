// The logic test on the Open Matrices Item Bank — the pure layer (D471,
// docs/OMIB-PLAN.md). What a form is, how it is drawn from a seed, how a
// pick is scored, and how a score folds into norms. No Firestore, no
// callables: logic.ts is the decision layer that knows the floors and the
// documents, and it imports this; this imports nothing from it.
//
// THE SHAPE IN ONE LINE. A form is 25 of the bank's 218 usable items, drawn
// by seed so the server can regenerate it at submit (the D57 mechanism,
// unchanged), stratified by rule count so every taker meets the same KIND
// of test, and scored not as a count but as an ability θ with its own
// standard error (irt.ts) — which is what the bank's calibration is for.

import { OMIB_ITEMS, OMIB_KEY, OMIB_BANK_VERSION, type OmibItem } from "./omib-bank";
import { mulberry32, mixSeed } from "./logic-gen";
import { eap, information, normalCdf, type ItemParams } from "./irt";

export { OMIB_BANK_VERSION };
export type { OmibItem };

// ── the usable bank ───────────────────────────────────────────────────────
export const OMIB_FORM_ITEMS = 25;
// One item was published without parameters; one has a discrimination so
// low its answer says almost nothing about θ. Both are excluded from forms.
// The floor is a constant so a retune is a visible change to what the test
// draws from; the count it leaves is pinned in omib.test.ts.
export const OMIB_MIN_A = 0.5;
export const OMIB_USABLE = 218;

export function usableItems(): readonly OmibItem[] {
  return OMIB_ITEMS.filter((i) => i.a !== null && i.b !== null && i.a >= OMIB_MIN_A);
}

// ── the form ──────────────────────────────────────────────────────────────
// The bank's rules-per-item form a pyramid — 20 · 50 · 80 · 50 · 20 for one
// through five — and a form keeps that shape: 2 · 6 · 9 · 6 · 2. Each
// stratum is drawn without replacement from its own seeded stream (salted
// per stratum, the logic-gen band pattern), so an edit to one stratum's
// pool never reshuffles another's draws.
export const OMIB_STRATA: readonly { rules: number; slots: number }[] = [
  { rules: 1, slots: 2 },
  { rules: 2, slots: 6 },
  { rules: 3, slots: 9 },
  { rules: 4, slots: 6 },
  { rules: 5, slots: 2 },
];
const STRATUM_SALT = 0x0b1b00;

function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The 25 items a seed names, easy → hard by published difficulty so the
 * ramp the overlay's design assumes is a real one. Deterministic per seed.
 */
export function omibForm(seed: number): OmibItem[] {
  const pool = usableItems();
  const form: OmibItem[] = [];
  for (const s of OMIB_STRATA) {
    const rng = mulberry32(mixSeed(seed, STRATUM_SALT + s.rules));
    const inStratum = pool.filter((i) => i.rules === s.rules);
    form.push(...shuffle(rng, inStratum).slice(0, s.slots));
  }
  // b is non-null on every usable item; the `?? 0` is for the type only.
  return form.sort((x, y) => (x.b ?? 0) - (y.b ?? 0) || x.n - y.n);
}

/** What a client may see at start: the code alone. Its ninth cell is zeros by construction. */
export interface OmibClientItem {
  code: string;
}
export const omibClientItems = (seed: number): OmibClientItem[] => omibForm(seed).map((i) => ({ code: i.code }));

// ── picks and scoring ─────────────────────────────────────────────────────
export const OMIB_ELEMENTS = 20;
const CELL = /^[01]{20}$/;
export const EMPTY_CELL = "0".repeat(OMIB_ELEMENTS);

/** One constructed cell: twenty characters of 0 and 1. */
export const validOmibCell = (x: unknown): x is string => typeof x === "string" && CELL.test(x);

/** `count` cells — a whole stratified sheet, or an adaptive attempt's picks so far. */
export function validOmibCells(x: unknown, count: number): x is string[] {
  return Array.isArray(x) && x.length === count && x.every(validOmibCell);
}

/** One 20-bit cell per item — the taker's constructed answer, the whole form. */
export const validOmibPicks = (x: unknown): x is string[] => validOmibCells(x, OMIB_FORM_ITEMS);

export interface OmibScore {
  marks: boolean[];
  /** false where nothing was placed — a time-out or a skip, not a wrong answer */
  attempted: boolean[];
  score: number;
  theta: number;
  se: number;
  /** the bank's item numbers, in form order — the ledger's key */
  itemIds: number[];
  /** the published difficulty of each item, in form order — for the Answers
   *  lens to rank rows on; public parameters, disclosed only after scoring */
  diffs: number[];
}

/**
 * An item is right iff the constructed cell equals the published solution
 * bit for bit. No partial credit: the parameters were estimated on
 * dichotomous responses and mean nothing under another rule. Then θ.
 */
export function scoreOmibPicks(seed: number, picks: readonly string[]): OmibScore {
  const form = omibForm(seed);
  return scoreForm(form, form.map((it, i) => picks[i] === OMIB_KEY[it.n]), picks);
}

/** The one scorer both selections end in: θ by EAP over whatever items were served, in the order served. */
function scoreForm(form: readonly OmibItem[], marks: boolean[], picks: readonly string[]): OmibScore {
  const attempted = picks.map((p) => p !== EMPTY_CELL);
  const params: ItemParams[] = form.map((it) => ({ a: it.a as number, b: it.b as number }));
  const { theta, se } = eap(params, marks.map((m) => (m ? 1 : 0)));
  return {
    marks, attempted, score: marks.filter(Boolean).length, theta, se,
    itemIds: form.map((it) => it.n), diffs: form.map((it) => it.b as number),
  };
}

// ── adaptive selection (docs/OMIB-PLAN.md §3.3, D474) ─────────────────────
// The accuracy ceiling: each next item is chosen to be most informative at
// the taker's CURRENT θ̂, so a strong taker is not spending items on puzzles
// they were always going to solve and a weak one is not spending them on
// puzzles they never could. Built DARK behind logic.ts's OMIB_SELECTION and
// flipped only when the §6 report says the calibration transferred — under
// adaptive administration every item is met near its taker's 50 % point, so
// per-item solve rates stop saying anything about b, and the report's own
// instrument (the stratified ledger) would be spoiled by flipping early.
//
// Deterministic in (seed, answers so far): the same seed and the same picks
// name the same items, so a stateless practice attempt can be replayed from
// the picks alone, exactly as a stratified form is replayed from the seed.
export type OmibSelection = "stratified" | "adaptive";

// Where θ̂ stands before any answer. The prior's centre is 0; the first pick
// starts half a unit under it because the calibration sample is selected
// upward (docs/OMIB-PLAN.md §4 expects this app's takers to read below its
// median) and because a first puzzle slightly on the easy side of a taker's
// level is the standard opening — it costs a fraction of an item's
// information and buys a start that is not a wall.
export const OMIB_START_THETA = -0.5;

// Randomesque exposure control (Kingsbury & Zara): the pick is a seeded draw
// among the K most informative eligible items rather than the single best,
// wide at the start — where every taker's θ̂ is the same prior, so a pure
// maximum would serve one item to everyone — and narrowing to a floor once
// the answers have separated the takers. K = max(5, 15 − 2·step).
export const OMIB_RANDOMESQUE_MAX = 15;
export const OMIB_RANDOMESQUE_MIN = 5;
export const randomesqueK = (step: number): number =>
  Math.max(OMIB_RANDOMESQUE_MIN, OMIB_RANDOMESQUE_MAX - 2 * step);
const NEXT_SALT = 0x0ada00;

/** One answered item of an adaptive form: which, and whether it was right. */
export interface OmibStep {
  n: number;
  right: boolean;
}

const USABLE_BY_N = new Map<number, OmibItem>(usableItems().map((i) => [i.n, i]));
const paramsOf = (it: OmibItem): ItemParams => ({ a: it.a as number, b: it.b as number });

/**
 * The next item of an adaptive form. Content-balanced to the same pyramid a
 * stratified form has (OMIB_STRATA's slots are quotas, so every taker still
 * meets the same KIND of test), never a repeat, and among what is left the
 * randomesque draw over Fisher information at θ̂.
 */
export function omibNextItem(seed: number, history: readonly OmibStep[]): OmibItem {
  if (history.length >= OMIB_FORM_ITEMS) throw new Error("omibNextItem: the form is complete");
  const answered = history.map((h) => {
    const it = USABLE_BY_N.get(h.n);
    if (!it) throw new Error(`omibNextItem: item ${h.n} is not in the usable bank`);
    return it;
  });
  const theta = history.length === 0
    ? OMIB_START_THETA
    : eap(answered.map(paramsOf), history.map((h) => (h.right ? 1 : 0))).theta;
  const quota = new Map<number, number>(OMIB_STRATA.map((s) => [s.rules, s.slots]));
  for (const it of answered) quota.set(it.rules, (quota.get(it.rules) ?? 0) - 1);
  const used = new Set(history.map((h) => h.n));
  const ranked = usableItems()
    .filter((i) => !used.has(i.n) && (quota.get(i.rules) ?? 0) > 0)
    .map((i) => ({ i, info: information([paramsOf(i)], theta) }))
    .sort((x, y) => y.info - x.info || x.i.n - y.i.n);
  const k = Math.min(randomesqueK(history.length), ranked.length);
  const rng = mulberry32(mixSeed(seed, NEXT_SALT + history.length));
  return ranked[Math.floor(rng() * k) % k].i;
}

export interface OmibReplay {
  /** the items served so far, in order — one per pick */
  items: OmibItem[];
  marks: boolean[];
  /** the item to serve next, or null once the form is complete */
  next: OmibItem | null;
}

/** An adaptive form, reconstructed from its seed and the picks made so far. */
export function replayAdaptive(seed: number, picks: readonly string[]): OmibReplay {
  if (picks.length > OMIB_FORM_ITEMS) throw new Error(`replayAdaptive: ${picks.length} picks on a ${OMIB_FORM_ITEMS}-item form`);
  const history: OmibStep[] = [];
  const items: OmibItem[] = [];
  const marks: boolean[] = [];
  for (const pick of picks) {
    const it = omibNextItem(seed, history);
    const right = pick === OMIB_KEY[it.n];
    items.push(it);
    marks.push(right);
    history.push({ n: it.n, right });
  }
  return { items, marks, next: picks.length < OMIB_FORM_ITEMS ? omibNextItem(seed, history) : null };
}

/** The whole adaptive form scored — the same shape and the same θ arithmetic as a stratified one. */
export function scoreOmibAdaptive(seed: number, picks: readonly string[]): OmibScore {
  if (picks.length !== OMIB_FORM_ITEMS) throw new Error(`scoreOmibAdaptive: ${picks.length} picks`);
  const { items, marks } = replayAdaptive(seed, picks);
  return scoreForm(items, marks, picks);
}

/** One scorer for the decision layer to call, by the attempt's own selection. */
export const scoreOmib = (mode: OmibSelection, seed: number, picks: readonly string[]): OmibScore =>
  mode === "adaptive" ? scoreOmibAdaptive(seed, picks) : scoreOmibPicks(seed, picks);

// ── norms ─────────────────────────────────────────────────────────────────
// A histogram of θ̂ in 0.25 bins from −5 to +5 — forty buckets, the D60
// machinery counting a different thing. Everything else about it (private
// doc, public mirror, first attempts only, the effort floor, the n ≥ 100
// floor before a rank is measured) is logic.ts's and unchanged.
export type Norms = Record<string, number | string>;
export const THETA_BINS = 40;
export const THETA_BIN_WIDTH = 0.25;
export const THETA_BIN_MIN = -5;

export const thetaBin = (theta: number): number =>
  Math.max(0, Math.min(THETA_BINS - 1, Math.floor((theta - THETA_BIN_MIN) / THETA_BIN_WIDTH)));

const num = (d: Norms | null | undefined, k: string): number => {
  const v = d?.[k];
  return typeof v === "number" ? v : 0;
};

export function foldThetaNorms(prev: Norms | null, theta: number): Norms {
  const next: Norms = { ...(prev || {}) };
  next.n = num(next, "n") + 1;
  const key = `t${thetaBin(theta)}`;
  next[key] = num(next, key) + 1;
  return next;
}

/**
 * The difficulty ledger, per ITEM rather than per family (D62, one bank
 * over): how often each item was seen, solved, and left blank. Counts only —
 * no uid, no anchors, no timings. First verified attempts only, same gate as
 * the histogram; and what docs/OMIB-PLAN.md §6 reads to say whether the
 * calibration transferred.
 */
export function foldItemStats(prev: Norms | null, itemIds: readonly number[], marks: readonly boolean[], attempted: readonly boolean[]): Norms {
  const next: Norms = { ...(prev || {}) };
  next.n = num(next, "n") + 1;
  itemIds.forEach((id, i) => {
    next[`i_${id}_seen`] = num(next, `i_${id}_seen`) + 1;
    if (marks[i]) next[`i_${id}_solved`] = num(next, `i_${id}_solved`) + 1;
    if (!attempted[i]) next[`i_${id}_blank`] = num(next, `i_${id}_blank`) + 1;
  });
  return next;
}

/**
 * The measured rank: the share of counted players below θ̂. Mid-rank on the
 * taker's own bin — half of it counts as below — because θ is continuous and
 * a strict-below over 0.25-wide bins would understate every reading by up to
 * one bin's mass. (The count histogram's strict rule was right for integers;
 * this is the same claim, "share this beats", for a real number.) Null
 * below `minN`, exactly as measuredPctile is.
 */
export function measuredPctileTheta(norms: Norms | null, theta: number, minN: number): { pctile: number; n: number } | null {
  const n = num(norms, "n");
  if (n < minN) return null;
  const own = thetaBin(theta);
  let below = 0;
  for (let b = 0; b < own; b++) below += num(norms, `t${b}`);
  const share = (below + 0.5 * num(norms, `t${own}`)) / n;
  return { pctile: clampPct(Math.round(100 * share)), n };
}

/**
 * The model below the floor: Φ(θ̂), the share of the CALIBRATION sample
 * below the taker. A real population — 2,572 medical-school applicants —
 * which is why the sentence that prints it must say so (docs/OMIB-PLAN.md
 * §4): a typical taker reads below that sample's median, and that is not a
 * fact about the taker.
 */
export const modelPctileTheta = (theta: number): number => clampPct(Math.round(100 * normalCdf(theta)));

const clampPct = (p: number): number => Math.max(1, Math.min(99, p));

// ── the era ───────────────────────────────────────────────────────────────
// D61's rule one bank over: a histogram from another era ranks nothing and
// folds nothing. A generator-era document has no `bank`, so it is never
// this era, and the first OMIB submit starts the count fresh.
export const OMIB_ERA = { bank: "omib", items: OMIB_FORM_ITEMS, gv: OMIB_BANK_VERSION } as const;

export const isOmibEra = (doc: Norms | null | undefined): boolean =>
  doc != null && doc.bank === OMIB_ERA.bank && doc.items === OMIB_ERA.items && doc.gv === OMIB_ERA.gv;
