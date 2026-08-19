// The pulse store (D139, roster at D203) — the design's PULSE contract
// (design/standalone-v28/pulse-data.js), typed, in two honest modes:
//
//   · DEMO — the prototype room: seeded histories (one per honest case:
//     typical, gap, day-one, perfect), invented crowds, localStorage
//     answers. The design's furniture, verbatim.
//   · LIVE — your days from the hydrated vote mirror (zero extra reads),
//     the crowd from the PER-DAY aggregate docs the untouched trigger
//     publishes, session-cached, poll-not-stream (D124/D129; the costs
//     line is in docs/COSTS.md).
//
// FIVE PULSES, NOT ONE (D203). D139 shipped a constant and said why:
// "a roster becomes a parameter the day a second pulse ships". This is
// that day. Every reading below takes a pulse id; nothing is singular any
// more except the default the card opens on.
//
// EACH CARRIES ITS OWN CADENCE — daily · often (Mon/Wed/Fri) · weekly
// (Sunday) · off — set on the card itself, because "show up more often"
// is a rhythm rather than a settings screen. Cadence is DEVICE state and
// deliberately has no server representation: `dueOn` is a pure function
// of the cadence and the calendar, the reading is drawn on the device,
// and putting it on the server would buy cross-device sync at the price
// of a new field, a new rules arm, a new data-inventory row and a second
// store-forms conversation about how often someone wants to be asked how
// they slept. The rules do not fence it either — an "off" pulse is still
// writable, exactly as a paused one should be.
//
// The design's honesty rules are the contract, not decoration, and the
// roster adds the fourth:
//   · a day nobody answered is ABSENT — never zero-filled, never bridged
//   · a day too thin to place keeps its count and is listed, not placed
//   · a day the pulse was NOT SCHEDULED is absent too, and is not a miss:
//     a weekly pulse that ran every Sunday for three weeks has a streak
//     of 3, not "you skipped 18 days". The prototype gets this wrong —
//     its `streak` still walks calendar days — and getting it wrong is
//     precisely the lie these rules exist to prevent.
//   · no smoothing, no rolling mean, no invented baseline anywhere
import LIVE from "./live";
import { getDb, getFirestoreApi } from "../../lib/firebase";

/** The pulse the card opens on, and the only one that existed before
 * D203. Kept as a named export because it is also the id whose option set
 * D52 froze — the roster appends, it never rewrites this one. */
export const PULSE_QID = "pulse-pace";

export const DAYS = 21; // three weeks — the window the reading covers
export const THIN = 20; // fewer answers than this: counted, never placed

/** How often a pulse asks. `off` is paused rather than retired — the
 * history stays readable, the question simply stops being due. */
export type Cadence = "daily" | "often" | "weekly" | "off";
export const CADENCES: Cadence[] = ["daily", "often", "weekly", "off"];
/** What each cadence is called on the card. */
export const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "every day", often: "Mon · Wed · Fri", weekly: "Sundays", off: "paused",
};

export interface PulseStep { v: number; label: string }
export interface PulseDay {
  i: number; key: string; date: Date; label: string; today: boolean;
  weekStart: boolean; v: number | null;
  /** False when the cadence did not ask on this day — absent, not missed. */
  scheduled: boolean;
}
export interface ScopeDay { i: number; mean: number | null; n: number; placed: boolean; thin: boolean }
export interface PulseScope { id: string; label: string; short: string; series: ScopeDay[] }
export interface PulseQ { id: string; kicker: string; text: string; steps: PulseStep[] }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── demo furniture (the design's, verbatim) ─────────────────────────────
const DEMO_STEPS: PulseStep[] = [
  { v: 1, label: "Crawling" }, { v: 2, label: "Dragging" }, { v: 3, label: "Steady" },
  { v: 4, label: "Brisk" }, { v: 5, label: "Flying" },
];
/** The demo roster mirrors the live bank so the two rooms have the same
 * shape — same ids, same order, same default cadences. */
const DEMO_ROSTER: { id: string; kicker: string; text: string; steps: string[]; cad: Cadence }[] = [
  { id: "pulse-pace", kicker: "daily pulse", text: "What pace was today?", cad: "daily",
    steps: ["Crawling", "Dragging", "Steady", "Brisk", "Flying"] },
  { id: "pulse-energy", kicker: "energy pulse", text: "How was your energy today?", cad: "weekly",
    steps: ["Drained", "Low", "OK", "Charged", "Wired"] },
  { id: "pulse-sleep", kicker: "sleep pulse", text: "How did you sleep?", cad: "weekly",
    steps: ["Badly", "Patchy", "OK", "Well", "Deeply"] },
  { id: "pulse-focus", kicker: "focus pulse", text: "How clear was your head?", cad: "off",
    steps: ["Scattered", "Foggy", "OK", "Sharp", "Locked in"] },
  { id: "pulse-social", kicker: "social pulse", text: "How connected did you feel?", cad: "off",
    steps: ["Alone", "Distant", "OK", "Close", "Held"] },
];
const HISTORY: Record<string, (number | null)[]> = {
  typical: [3, 4, 4, null, 3, 2, 3, 4, 4, 4, null, 3, 3, 4, 5, 4, null, 3, 4, 4, null],
  gap: [4, 3, 3, 4, 4, 3, 4, null, null, null, null, null, null, null, 3, 4, 4, 3, 4, 4, null],
  day1: Array(21).fill(null),
  perfect: [4, 4, 3, 4, 5, 4, 4, 3, 4, 4, 5, 5, 4, 4, 3, 4, 4, 5, 5, 4, null],
};
const DEMO_SCOPES = [
  { id: "city", short: "city",
    mean: [3.4, 3.5, null, 3.2, 3.3, 3.6, 3.1, 2.9, null, 3.4, 3.5, 3.3, 3.2, 3.6, 3.7, 3.0, 3.3, 3.4, 3.5, 3.6, 3.5],
    n: [64, 71, 0, 58, 83, 96, 41, 12, 0, 77, 88, 64, 59, 103, 96, 8, 74, 92, 118, 131, 43] },
  { id: "country", short: "country",
    mean: [3.3, 3.4, 3.3, 3.2, 3.3, 3.5, 3.2, 3.1, 3.2, 3.3, 3.4, 3.3, 3.2, 3.5, 3.6, 3.2, 3.3, 3.4, 3.4, 3.5, 3.4],
    n: [1240, 1310, 980, 1120, 1420, 1510, 1180, 1260, 1090, 1330, 1470, 1280, 1210, 1560, 1620, 1180, 1390, 1480, 1620, 1710, 610] },
  { id: "world", short: "world", label: "World",
    mean: [3.5, 3.5, 3.4, 3.4, 3.5, 3.6, 3.4, 3.4, 3.4, 3.5, 3.5, 3.5, 3.4, 3.6, 3.6, 3.4, 3.5, 3.5, 3.5, 3.6, 3.5],
    n: [58200, 61400, 49800, 57300, 64100, 71200, 55600, 59800, 52100, 63400, 69700, 60200, 57900, 72300, 74800, 58600, 66200, 70400, 73900, 78100, 24800] },
];
const DEMO_BINS: Record<string, number[]> = {
  city: [7, 12, 27, 35, 19], country: [8, 14, 28, 33, 17], world: [6, 13, 28, 34, 19],
};
const LS = "insight.pulse.v1";
const CAD_LS = "insight.pulseCadence.v1";

// ── shared clock arithmetic ─────────────────────────────────────────────
// Day keys are UTC — the rules window, the vote's utcDayKey and the
// per-day agg ids are all UTC, so the reading has to bucket the same way
// or a late evening answers into "tomorrow's" row. The cadence reads the
// same clock for the same reason: a pulse due "Sundays" has to be due on
// the Sunday its answer would be keyed to.
const pad = (n: number) => String(n).padStart(2, "0");
const utcKey = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dayAt = (i: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
  return d;
};
const dayLabel = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;

/**
 * Whether a cadence asks on a given day. Pure, explainable, and the whole
 * of the scheduling model — there is no queue, no server job and nothing
 * to drift out of sync, because every device computes the same answer
 * from the same calendar.
 */
export function dueOn(cad: Cadence, d: Date): boolean {
  if (cad === "off") return false;
  if (cad === "daily") return true;
  const w = d.getUTCDay(); // 0 = Sunday
  if (cad === "often") return w === 1 || w === 3 || w === 5;
  return w === 0; // weekly — Sunday
}

// ── state ───────────────────────────────────────────────────────────────
interface DayAgg { counts: Record<string, number>; total: number; by?: Record<string, Record<string, Record<string, number>>> }

/** Today's aggregate per pulse — the only thing the CARD needs. */
let todayAggs: Record<string, DayAgg | null> | null = null;
/** The 21-day window per pulse — fetched only when a reading is opened. */
const trendAggs: Record<string, Record<string, DayAgg | null>> = {};
let loadingToday: Promise<void> | null = null;
const loadingTrend: Record<string, Promise<void> | undefined> = {};
let loadedForKey = ""; // today's key at load time — a day rollover invalidates
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => { try { f(); } catch { /* a broken listener must not stop the rest */ } });

const demoSaved = (): Record<string, Record<string, number>> => {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
};

// ── the roster ──────────────────────────────────────────────────────────
/**
 * Every pulse this build can ask, in bank order.
 *
 * LIVE reads `LIVE.pulseQs()` — the hydrated bank, which means `active`
 * has already been applied upstream. Before D203 this module fetched its
 * own template with `getDoc` and read only `prompt`/`options`, so an
 * operator flipping a pulse off left a tappable card whose every write the
 * rules refused: the answer appeared, then silently vanished. Reading the
 * bank is what fixes that, and it also stops paying for a document
 * `hydrate()` had already cached — five times over, at roster size.
 */
export function roster(): PulseQ[] {
  if (LIVE.enabled) {
    return (LIVE.pulseQs() as { id: string; prompt: string; options: string[] }[])
      .filter((q) => q.options.length === 5)
      .map((q) => ({
        id: q.id,
        kicker: kickerFor(q.id),
        text: q.prompt,
        steps: q.options.map((label, i) => ({ v: i + 1, label })),
      }));
  }
  return DEMO_ROSTER.map((r) => ({
    id: r.id, kicker: r.kicker, text: r.text,
    steps: r.steps.map((label, i) => ({ v: i + 1, label })),
  }));
}

/** The eyebrow. Derived from the id so the bank does not have to carry a
 * field for it, and falls back to the neutral word for an id the roster
 * gains later. */
function kickerFor(pid: string): string {
  const known: Record<string, string> = {
    "pulse-pace": "daily pulse", "pulse-energy": "energy pulse",
    "pulse-sleep": "sleep pulse", "pulse-focus": "focus pulse",
    "pulse-social": "social pulse",
  };
  return known[pid] ?? "pulse";
}

const qOf = (pid: string): PulseQ | null => roster().find((q) => q.id === pid) ?? null;

// ── cadence ─────────────────────────────────────────────────────────────
const defaultCad = (pid: string): Cadence =>
  DEMO_ROSTER.find((r) => r.id === pid)?.cad ?? "daily";

const savedCads = (): Record<string, Cadence> => {
  try {
    const v = JSON.parse(localStorage.getItem(CAD_LS) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
};

export function cadence(pid: string): Cadence {
  const c = savedCads()[pid];
  return c && CADENCES.includes(c) ? c : defaultCad(pid);
}

export function setCadence(pid: string, cad: Cadence): void {
  if (!CADENCES.includes(cad)) return;
  const all = savedCads();
  all[pid] = cad;
  try { localStorage.setItem(CAD_LS, JSON.stringify(all)); } catch { /* private mode — holds for the session */ }
  notify();
}

/**
 * The pulses due today, in roster order.
 *
 * A pulse you have ALREADY answered today stays in the list — it is due,
 * and the card draws its reveal. Dropping it would make today's card
 * vanish under your own tap, which reads as a bug rather than as progress.
 */
export function dueToday(): string[] {
  const d = dayAt(DAYS - 1);
  return roster().filter((q) => dueOn(cadence(q.id), d)).map((q) => q.id);
}

// ── reads ───────────────────────────────────────────────────────────────
/**
 * Today's aggregate for every pulse in the roster — ONE query, at most as
 * many ids as there are pulses.
 *
 * This is the read the card needs, and splitting it out is what keeps the
 * roster affordable. Before D203 a single `ensureLive()` fetched the whole
 * 21-day window on every open even though the card only ever draws today;
 * multiplying THAT by five would have been 105 ids, over the 30-clause
 * `documentId() in` cap, so four-plus queries per open for data nothing on
 * the first screen reads. The window is now `ensureTrend`, paid on the tap
 * that opens a reading — so five pulses cost FEWER reads per open than one
 * pulse did.
 */
export function ensureToday(force = false): Promise<void> {
  if (!LIVE.enabled) return Promise.resolve();
  const today = utcKey(dayAt(DAYS - 1));
  if (todayAggs && loadedForKey === today && !force) return Promise.resolve();
  if (loadingToday) return loadingToday;
  loadingToday = (async () => {
    try {
      const ids = roster().map((q) => `${q.id}_${today}`);
      if (!ids.length) { todayAggs = {}; loadedForKey = today; return; }
      const got = await fetchAggs(ids);
      const next: Record<string, DayAgg | null> = {};
      for (const q of roster()) next[q.id] = got.get(`${q.id}_${today}`) ?? null;
      todayAggs = next;
      loadedForKey = today;
      notify();
    } finally {
      loadingToday = null;
    }
  })();
  return loadingToday;
}

/**
 * One pulse's 21-day window, for the reading. Paid on the tap that opens
 * it and cached for the session — 21 ids is inside the 30-clause cap, so
 * it stays a single query.
 */
export function ensureTrend(pid: string): Promise<void> {
  if (!LIVE.enabled) return Promise.resolve();
  if (trendAggs[pid]) return Promise.resolve();
  const inflight = loadingTrend[pid];
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const keys = Array.from({ length: DAYS }, (_, i) => `${pid}_${utcKey(dayAt(i))}`);
      const got = await fetchAggs(keys);
      const next: Record<string, DayAgg | null> = {};
      for (let i = 0; i < DAYS; i++) {
        const k = utcKey(dayAt(i));
        next[k] = got.get(`${pid}_${k}`) ?? null;
      }
      trendAggs[pid] = next;
      notify();
    } finally {
      loadingTrend[pid] = undefined;
    }
  })();
  loadingTrend[pid] = p;
  return p;
}

/** An absent doc means nobody answered that day — stored as null so the
 * reading can say so rather than refetching. */
async function fetchAggs(ids: string[]): Promise<Map<string, DayAgg>> {
  const db = await getDb();
  const { collection, documentId, getDocs, query, where } = await getFirestoreApi();
  const snap = await getDocs(
    query(collection(db, "v2_question_aggs"), where(documentId(), "in", ids)),
  );
  return new Map(snap.docs.map((d) => [d.id, d.data() as DayAgg]));
}

/** Back-compat: the card's old single entry point. Today only. */
export const ensureLive = ensureToday;

// ── the readings ────────────────────────────────────────────────────────
function stepsOf(pid: string): PulseStep[] {
  return qOf(pid)?.steps ?? DEMO_STEPS;
}

function aggFor(pid: string, key: string): DayAgg | null {
  const t = trendAggs[pid];
  if (t && key in t) return t[key];
  if (key === utcKey(dayAt(DAYS - 1))) return todayAggs?.[pid] ?? null;
  return null;
}

function days(pid: string): PulseDay[] {
  const cad = cadence(pid);
  const mineDemo = demoSaved()[pid] || {};
  const mineLive = LIVE.enabled ? LIVE.pulseVotes(pid) : {};
  const hist = LIVE.enabled
    ? Array(DAYS).fill(null)
    : HISTORY[(window as { IS_PULSE_HISTORY?: string }).IS_PULSE_HISTORY ?? "typical"] ?? HISTORY.typical;
  return hist.map((v: number | null, i: number) => {
    const d = dayAt(i);
    const k = utcKey(d);
    const scheduled = dueOn(cad, d);
    // A day the pulse never asked on carries no answer, even in the demo
    // room's seeded history — otherwise a weekly pulse would draw a
    // Tuesday it was never offered on.
    const mine = !scheduled ? null : LIVE.enabled
      ? (k in mineLive ? mineLive[k] + 1 : null) // optionIdx 0..4 → step 1..5
      : (mineDemo[k] != null ? mineDemo[k] : v);
    return {
      i, key: k, date: d, label: dayLabel(d), today: i === DAYS - 1,
      weekStart: i % 7 === 0, v: mine, scheduled,
    };
  });
}

const meanOf = (agg: DayAgg): number | null => {
  let n = 0, sum = 0;
  for (const [idx, c] of Object.entries(agg.counts || {})) {
    n += c;
    sum += (Number(idx) + 1) * c;
  }
  return n > 0 ? sum / n : null;
};

const cutOf = (agg: DayAgg, scopeId: string): { n: number; mean: number | null } => {
  if (scopeId === "world") {
    const m = meanOf(agg);
    return { n: agg.total || 0, mean: m };
  }
  const a = LIVE.anchors() || {};
  const bucket = scopeId === "city" ? a.city : a.country;
  const cell = bucket ? agg.by?.[scopeId]?.[bucket] : undefined;
  if (!cell) return { n: 0, mean: null };
  let n = 0, sum = 0;
  for (const [idx, c] of Object.entries(cell)) { n += c; sum += (Number(idx) + 1) * c; }
  return { n, mean: n > 0 ? sum / n : null };
};

function scope(pid: string, id: string): PulseScope {
  if (LIVE.enabled) {
    const a = LIVE.anchors() || {};
    const label = id === "city" ? (a.city || "Your city") : id === "country" ? (a.country || "Your country") : "World";
    const cad = cadence(pid);
    const series: ScopeDay[] = Array.from({ length: DAYS }, (_, i) => {
      const d = dayAt(i);
      // An unscheduled day is absent for the crowd too. Everyone's cadence
      // is their own, so the cell may well hold answers — but placing them
      // on a day THIS reading does not draw would put a point on a line
      // the reader has no row for.
      if (!dueOn(cad, d)) return { i, n: 0, mean: null, placed: false, thin: false };
      const agg = aggFor(pid, utcKey(d));
      const cut = agg ? cutOf(agg, id) : { n: 0, mean: null };
      return {
        i, n: cut.n,
        mean: cut.n > 0 ? cut.mean : null,
        placed: cut.n >= THIN && cut.mean != null,
        thin: cut.n > 0 && cut.n < THIN,
      };
    });
    return { id, label, short: id, series };
  }
  const s = DEMO_SCOPES.find((x) => x.id === id) ?? DEMO_SCOPES[0];
  const me = (window as { IS_DATA?: { me?: { location?: string; country?: string } } }).IS_DATA?.me ?? {};
  const label = s.label || (s.id === "city" ? (me.location || "Your city") : s.id === "country" ? (me.country || "Your country") : "World");
  const cad = cadence(pid);
  const series: ScopeDay[] = s.mean.map((m, i) => {
    if (!dueOn(cad, dayAt(i))) return { i, mean: null, n: 0, placed: false, thin: false };
    const n = s.n[i] || 0;
    return { i, mean: n > 0 ? m : null, n, placed: n >= THIN && m != null, thin: n > 0 && n < THIN };
  });
  return { id: s.id, label, short: s.short, series };
}

/**
 * The run, counted in ASKS rather than in calendar days.
 *
 * This is the whole of the fourth honesty rule. A weekly pulse answered
 * three Sundays running has a streak of 3; walking the calendar the way
 * the prototype still does would call it 1 and report eighteen misses,
 * which is a statement about a question that was never put. `ticks` is
 * likewise the last 14 SCHEDULED days, so the strip draws asks rather
 * than a fortnight of blanks with three marks in it.
 */
function streak(pid: string): { run: number; live: boolean; ticks: PulseDay[] } {
  const d = days(pid);
  const asked = d.filter((x) => x.scheduled);
  if (!asked.length) return { run: 0, live: false, ticks: [] };
  const last = asked[asked.length - 1];
  const live = last.today && last.v != null;
  let run = 0;
  // Start at the most recent ask, skipping today when it is still open —
  // an unanswered today is not yet a broken run.
  for (let i = asked.length - 1 - (last.today && last.v == null ? 1 : 0); i >= 0; i--) {
    if (asked[i].v == null) break;
    run++;
  }
  return { run, live, ticks: asked.slice(-14) };
}

const fmtN = (n: number): string =>
  n >= 1000000 ? (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M"
    : n >= 10000 ? Math.round(n / 1000) + "k"
      : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
        : String(n);

export const PULSE = {
  DAYS, THIN, CADENCES, CADENCE_LABEL,
  SCOPES: ["city", "country", "world"],
  roster, dueToday, cadence, setCadence, dueOn,
  /** The default pulse — what a card with no id asks. */
  first(): string { return roster()[0]?.id ?? PULSE_QID; },
  q(pid: string): PulseQ | null { return qOf(pid); },
  steps(pid: string): PulseStep[] { return stepsOf(pid); },
  /** Live: the bank arrived and a card can render. Demo: always. */
  ready(): boolean { return !LIVE.enabled || roster().length > 0; },
  days, scope, streak, fmtN,
  word(pid: string, v: number): string { return stepsOf(pid).find((s) => s.v === v)?.label ?? ""; },
  /** Today's crowd split as percentages — live from today's per-day agg
   * (empty until anyone answers: an honest zero, never invented), demo
   * from the design's bins. */
  bins(pid: string, id: string): number[] {
    if (!LIVE.enabled) return DEMO_BINS[id] ?? DEMO_BINS.world;
    const agg = aggFor(pid, utcKey(dayAt(DAYS - 1)));
    if (!agg) return [0, 0, 0, 0, 0];
    if (id === "world") {
      const total = agg.total || 0;
      return Array.from({ length: 5 }, (_, i) =>
        total > 0 ? Math.round(100 * (agg.counts?.[String(i)] ?? 0) / total) : 0);
    }
    const cut = LIVE.anchors() || {};
    const bucket = id === "city" ? cut.city : cut.country;
    const cell = bucket ? agg.by?.[id]?.[bucket] : undefined;
    const n = cell ? Object.values(cell).reduce((a, b) => a + b, 0) : 0;
    return Array.from({ length: 5 }, (_, i) =>
      n > 0 && cell ? Math.round(100 * (cell[String(i)] ?? 0) / n) : 0);
  },
  todayN(pid: string, id: string): number {
    if (!LIVE.enabled) {
      const s = DEMO_SCOPES.find((x) => x.id === id) ?? DEMO_SCOPES[2];
      return s.n[DAYS - 1];
    }
    const agg = aggFor(pid, utcKey(dayAt(DAYS - 1)));
    if (!agg) return 0;
    return cutOf(agg, id).n;
  },
  mineToday(pid: string): number | null {
    const d = days(pid);
    return d[DAYS - 1].v;
  },
  /** Answer today. Live: the day-keyed write through the rules (create-
   * only — the store mirrors immediately, LIVE rolls back on refusal).
   * Demo: localStorage, the design's room. */
  answer(pid: string, v: number): void {
    if (LIVE.enabled) {
      void LIVE.votePulse(pid, v - 1);
      // The crowd for today moves with your own answer on the next poll;
      // refresh so the reveal's bins include you promptly. Today only —
      // the window behind it cannot have changed.
      void ensureToday(true).catch(() => { /* the card renders your side regardless */ });
    } else {
      const all = demoSaved();
      const mine = all[pid] || (all[pid] = {});
      mine[utcKey(dayAt(DAYS - 1))] = v;
      try { localStorage.setItem(LS, JSON.stringify(all)); } catch { /* best-effort, in-memory state stays right */ }
    }
    notify();
  },
  ensureToday, ensureTrend, ensureLive,
  subscribe(f: () => void): () => void {
    subs.add(f);
    const un = LIVE.enabled ? LIVE.subscribe?.(f) : undefined;
    return () => { subs.delete(f); if (un) un(); };
  },
};

// The purge (D51): the demo answers and the cadence are device state; the
// live caches are account state. All of it goes — the cadence included,
// because "ask me about my sleep every day" is a statement about the
// person, not about the device.
window.addEventListener("insight:local-purge", () => {
  todayAggs = null;
  for (const k of Object.keys(trendAggs)) delete trendAggs[k];
  loadedForKey = "";
  notify();
});

export default PULSE;
