// Your own instrument scores, folded from your own feed answers (D121).
//
// THE GAP THIS CLOSES. The four core instruments have shipped as passive
// since D50: their items are ordinary feed cards (`surface: "test"`), and
// answering the feed fills them in the background. That was true of the
// PROGRESS RING and of nothing else — the only thing that ever wrote a
// `testResults` entry was the sit-down flow, so a live account that
// answered forty test cards still opened its profile on an empty tab with
// a "Take this test →" button on it. The fold that would have scored those
// answers has existed since D112, one directory over, used only to place a
// dot in the similarity field (`similarity.myAxisScores`).
//
// So this module is mostly a THRESHOLD. The arithmetic is imported; what
// is decided here is when a partial fold has earned the right to be called
// a result, because the card it feeds draws an archetype, a rarity
// percentile and a "textbook fit" badge, and every one of those is a
// confident claim that two answers can produce and should not.
//
// Pure — no window, no Firebase, no spec imports. The instrument
// definitions arrive as a parameter, the way similarity.ts takes them.
import { myAxisScores, testItemMeta, type AxisScore, type TestBankItem, type TestDef, type TestDefs } from "./similarity";

/**
 * Answers an axis needs before it counts as measured.
 *
 * ONE is a coin flip wearing a number: a single 5-point answer maps to one
 * of {0, 25, 50, 75, 100} and lands the axis on an extreme more often than
 * not. Two is the smallest number that can disagree with itself, and the
 * instruments carry roughly four items per axis, so it asks for about half
 * — a floor, not a target. The bar keeps filling either way; this only
 * decides when the card may draw a TYPE.
 */
export const MIN_AXIS_ITEMS = 2;

export interface PassiveTest {
  kind: string;
  /** Every axis with at least one answer behind it, in the def's order. */
  dims: AxisScore[];
  /** Items of this instrument the viewer has answered. */
  answered: number;
  /** Items the bank carries for it — the denominator of the progress bar. */
  total: number;
  /**
   * True when every axis of the instrument is above MIN_AXIS_ITEMS.
   *
   * Every axis, not the average: a Big Five with thirty answers on four
   * axes and none on the fifth is not 80% of a result, it is a result
   * about a different instrument.
   */
  ready: boolean;
  /** Axis labels still under the floor — what the profile asks for next. */
  thin: string[];
}

/**
 * Fold one instrument from the viewer's own answers.
 *
 * `items` is the bank's test surface (LIVE.testFeedItems()); the join to
 * scoring metadata is by prompt and lives in similarity.testItemMeta, so a
 * bank item the instrument does not define simply does not count.
 */
export function passiveTest(
  kind: string,
  def: TestDef | undefined,
  bank: readonly TestBankItem[],
  defs: TestDefs,
  votes: Readonly<Record<string, number>>,
): PassiveTest | null {
  if (!def) return null;
  const meta = testItemMeta(bank, defs).filter((m) => m.test === kind);
  if (!meta.length) return null;
  const dims = myAxisScores(kind, def, meta, votes);
  const answered = meta.filter((m) => {
    const v = votes[m.qid];
    return Number.isInteger(v) && v >= 0 && v <= 4;
  }).length;
  // Every axis the DEFINITION names, not every axis with answers — an axis
  // nobody has touched is the thinnest one there is, and leaving it out of
  // this list is how it would go unnoticed.
  const byDim = new Map(dims.map((d) => [d.dim, d]));
  const thin: string[] = [];
  for (const d of def.dims || []) {
    const got = byDim.get(d.id);
    if (!got || got.n < MIN_AXIS_ITEMS) thin.push(d.label || d.id);
  }
  return {
    kind,
    dims,
    answered,
    total: meta.length,
    ready: thin.length === 0 && dims.length > 0,
    thin,
  };
}

/** Every instrument in `defs`, folded. Keys with no bank items are absent. */
export function passiveProfile(
  defs: TestDefs,
  bank: readonly TestBankItem[],
  votes: Readonly<Record<string, number>>,
): Record<string, PassiveTest> {
  const out: Record<string, PassiveTest> = {};
  for (const kind of Object.keys(defs)) {
    const t = passiveTest(kind, defs[kind], bank, defs, votes);
    if (t) out[kind] = t;
  }
  return out;
}

/**
 * A ready fold, in the shape the spec layer's `testResults` entries use —
 * or null when it is not ready.
 *
 * `passive: true` and `answered`/`total` ride along so a surface can say
 * where the number came from. Nothing downstream is required to read them,
 * and the important half is that nothing downstream has to CHANGE: the
 * dims array is the same shape the sit-down flow wrote, so the rose, the
 * archetype match and the compare cuts all work unmodified.
 *
 * `taken` is deliberately not a date. The sit-down flow wrote "just now"
 * and the field means "when you sat down for it", which a fold over
 * answers given across weeks does not have. Saying which answers it came
 * from is the true version of the same line.
 */
export interface PassiveResult {
  title: string;
  taken: string;
  dims: Array<{ id: string; label: string; value: number }>;
  passive: true;
  answered: number;
  total: number;
}

export function passiveResult(t: PassiveTest | null, title: string): PassiveResult | null {
  if (!t || !t.ready) return null;
  return {
    title,
    taken: `from ${t.answered} of your answers`,
    dims: t.dims.map((d) => ({ id: d.dim, label: d.label, value: d.value })),
    passive: true,
    answered: t.answered,
    total: t.total,
  };
}
