// The pulse store (D139, roster at D203) — the design's PULSE contract
// (design/standalone-v28/pulse-data.js), typed, in two honest modes:
//
//   · DEMO — the prototype room: one seeded history, invented crowds,
//     localStorage answers. The design's furniture, verbatim.
//
//     The prototype carried four seeded histories — typical, gap, day-one,
//     perfect — and a `window.IS_PULSE_HISTORY` knob on the tweak panel to
//     pick between them (design/standalone-v28/pulse-data.js). The port
//     took the READ and not the knob, and v28 §5 then dismantled the tweak
//     laboratory into shipped defaults, so the name was never written on
//     any build: three of the four arrays were unreachable and the read was
//     a cast, which is the one shape check:globals could not see (D280).
//     The honesty rules below are what those cases existed to exercise, and
//     pulse.test.ts exercises them directly instead of through a seed.
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
// The one conversion from a stored bucket key to a name (D125). It moved
// into `data/` for this call site: it wraps `data/places` and sat in
// `ui/`, so the pulse could not reach it without inverting the layering.
import { bucketLabel } from "./cohortLabels";
import { getDb, getFirestoreApi } from "../../lib/firebase";
// The demo room's "me" — an ESM import because sample-data.js came off the
// global bridge and publishes nothing to `window`. This read was
// `window.IS_DATA?.me`, a cast, and a cast is exactly what check:globals
// could not see (D280): the name resolved to undefined on every demo build
// and the city and country scopes silently drew "Your city" / "Your
// country" instead of the room's own place.
// @ts-expect-error TS7016 — untyped spec module (the live.ts / testNorms.ts
// pattern). Only two optional string fields are read, and they are typed
// at the use site rather than assumed here.
import { IS_DATA } from "../spec/sample-data.js";

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
export interface ScopeDay {
  i: number;
  mean: number | null;
  n: number;
  placed: boolean;
  thin: boolean;
  /**
   * Whether THIS reading asked on that day.
   *
   * An unscheduled day is returned as `n: 0` — see the note in `scope()`
   * on why the crowd's answers are not placed on a day the reader has no
   * row for — and without this flag the panel could not tell those from
   * days the crowd really was silent. It reported both as "days with no
   * answers in <place>", which is a claim about people, made about days
   * nobody was asked. The reader's own half of that was fixed at D203;
   * this is the crowd's half.
   */
  scheduled: boolean;
}
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
/** The demo room's seeded history. `null` is a day nobody answered — absent,
 * never zero-filled, which is the first honesty rule this file enforces. */
const HISTORY: (number | null)[] = [3, 4, 4, null, 3, 2, 3, 4, 4, 4, null, 3, 3, 4, 5, 4, null, 3, 4, 4, null];
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
// Set when the one read for today throws. `loadedForKey` stays unset on a
// throw, which is right — nothing was read — but it makes "failed"
// indistinguishable from "never asked", and a reader that treats either as
// "nobody has answered" states an absence it did not measure. Same
// distinction `trendReady` keeps for the trend half, and the same one
// live.ts keeps for the test aggregates.
let todayFailed = false;
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
  // THE EMPTY-ROSTER DECISION IS MADE OUT HERE, SYNCHRONOUSLY, and that
  // placement is the whole fix (D243).
  //
  // `roster()` reads `LIVE.pulseQs()`, which is empty until the bank
  // hydrates — an empty roster is the bank not having arrived, not a day
  // with no pulses. This used to be the first branch INSIDE the async
  // IIFE below, and there is no `await` before it, so the entire body ran
  // synchronously: `finally { loadingToday = null }` executed BEFORE the
  // `loadingToday = (...)()` assignment, which then overwrote the null
  // with an already-SETTLED promise. From that moment `if (loadingToday)
  // return loadingToday` answered every later call instantly and the
  // crowd was never fetched again, for the life of the module. The purge
  // listener resets `todayAggs` and `loadedForKey`, not this, so nothing
  // recovered it either.
  //
  // Kept out of the promise, the in-flight slot is only ever taken by a
  // call that really does fetch — and that one always suspends at
  // `await fetchAggs`, so its `finally` cannot run early. Nothing is
  // cached here: `loadedForKey` stays unset, so the call that arrives
  // once the bank has landed does the work.
  const ids = roster().map((q) => `${q.id}_${today}`);
  if (!ids.length) return Promise.resolve();
  todayFailed = false; // a retry clears the previous failure before it starts
  loadingToday = (async () => {
    try {
      const got = await fetchAggs(ids);
      const next: Record<string, DayAgg | null> = {};
      for (const q of roster()) next[q.id] = got.get(`${q.id}_${today}`) ?? null;
      todayAggs = next;
      loadedForKey = today;
      notify();
    } catch (e) {
      todayFailed = true;
      notify();
      throw e;
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

/**
 * What you answered on one day, as a step (1..5) — the read with NO
 * schedule gate on it.
 *
 * Its own function so `days()` and `mineToday()` cannot disagree about
 * what an answer is while disagreeing (correctly) about whether the
 * schedule matters. The maps come in as parameters because `days()` has
 * already paid for them once for the whole window; `demoSaved()` parses
 * localStorage, and calling it per day would be twenty-one parses.
 */
function mineOn(
  k: string,
  mineLive: Record<string, number>,
  mineDemo: Record<string, number>,
  seeded: number | null,
): number | null {
  // optionIdx 0..4 → step 1..5
  if (LIVE.enabled) return k in mineLive ? mineLive[k] + 1 : null;
  return mineDemo[k] != null ? mineDemo[k] : seeded;
}

function days(pid: string): PulseDay[] {
  const cad = cadence(pid);
  const mineDemo = demoSaved()[pid] || {};
  const mineLive = LIVE.enabled ? LIVE.pulseVotes(pid) : {};
  const hist = LIVE.enabled
    ? Array(DAYS).fill(null)
    : HISTORY;
  return hist.map((v: number | null, i: number) => {
    const d = dayAt(i);
    const k = utcKey(d);
    const scheduled = dueOn(cad, d);
    // A day the pulse never asked on carries no answer, even in the demo
    // room's seeded history — otherwise a weekly pulse would draw a
    // Tuesday it was never offered on. The SCHEDULE gate is this fold's,
    // not the read's: `mineOn` below is what you actually answered, and
    // `mineToday` wants that without this gate (D244).
    const mine = !scheduled ? null : mineOn(k, mineLive, mineDemo, v);
    return {
      i, key: k, date: d, label: dayLabel(d), today: i === DAYS - 1,
      weekStart: i % 7 === 0, v: mine, scheduled,
    };
  });
}

/**
 * A count map's crowd and mean, with one unfolded answer of your own
 * optionally joined in. Option indices are 0-based in storage and the
 * scale is 1..5, hence the `+ 1`.
 *
 * `mineIdx` is `pendingIdx`'s answer: -1 for a day that is not today and
 * for a viewer whose anchor puts them outside this cut.
 */
const meanOfCounts = (
  counts: Record<string, number> | undefined,
  mineIdx: number,
): { n: number; mean: number | null } => {
  let n = mineIdx >= 0 ? 1 : 0;
  let sum = mineIdx >= 0 ? mineIdx + 1 : 0;
  for (const [idx, c] of Object.entries(counts || {})) {
    n += c;
    sum += (Number(idx) + 1) * c;
  }
  return { n, mean: n > 0 ? sum / n : null };
};

/**
 * Your own unfolded answer's option index for one scope, or -1.
 *
 * ONE READER FOR BOTH HALVES, because they are two halves of one sentence:
 * `bins` states the share and `todayN` states the crowd it is a share OF.
 * They were joining the pending answer on different conditions —
 * `todayN` whenever one existed, `bins` only where the published cell
 * already did — so the first person in a city to answer today read
 * "0% of 1 answer today" under their own step. The same wrong number the
 * join was added to remove, one cohort narrower.
 *
 * A scoped cut counts you only when you are IN it: the bucket is your own
 * anchor, so no anchor is no membership rather than an empty one. World
 * always counts you.
 */
const pendingIdx = (pid: string, scopeId: string): number => {
  const pend = LIVE.pulsePending(pid);
  if (typeof pend !== "number" || pend < 0) return -1;
  if (scopeId === "world") return pend;
  const a = LIVE.anchors() || {};
  return (scopeId === "city" ? a.city : a.country) ? pend : -1;
};

/**
 * One scope's cut of one day — THE ONLY PLACE THE PENDING JOIN HAPPENS.
 *
 * D365 fixed this join in `bins` and `todayN` and did not reach here, so
 * the card printed "of 6 answers today" beside a trend whose last point
 * read no answers, and on a first-in-city day the point was absent while
 * the crowd beside it was one. That is the same defect a third time, in
 * the same file, because the join was a line at each call site instead of
 * a parameter on the one function they share. It is a parameter now: the
 * caller says WHICH day it is asking about, and this decides the rest.
 *
 * Not gated on the cell existing, for the reason `bins` records: being
 * the first in your city today is exactly the case where the published
 * cell is absent and you are still in it. `pendingIdx` decides
 * membership; the cell only supplies whoever came before you.
 */
const cutOf = (agg: DayAgg, scopeId: string, mineIdx = -1): { n: number; mean: number | null } => {
  if (scopeId === "world") {
    // `n` stays the published total plus you — the world crowd is stated
    // from `total`, not recounted from the bins.
    return {
      n: (agg.total || 0) + (mineIdx >= 0 ? 1 : 0),
      mean: meanOfCounts(agg.counts, mineIdx).mean,
    };
  }
  const a = LIVE.anchors() || {};
  const bucket = scopeId === "city" ? a.city : a.country;
  return meanOfCounts(bucket ? agg.by?.[scopeId]?.[bucket] : undefined, mineIdx);
};

function scope(pid: string, id: string): PulseScope {
  if (LIVE.enabled) {
    const a = LIVE.anchors() || {};
    // THE READER'S NAME FOR THE PLACE, not the storage key. `anchors()`
    // hands back what the cell is keyed by — "NO" for a country, "Oslo,
    // NO" for a city — and this printed it: on the scope button, and
    // inside three sentences ("of 12 days you and Oslo, NO both counted",
    // "3 days with no answers in NO"). That is D125's failure verbatim,
    // on a surface that shipped after the resolver written to stop it.
    const label = id === "city"
      ? (a.city ? bucketLabel("city", a.city) : "Your city")
      : id === "country"
        ? (a.country ? bucketLabel("country", a.country) : "Your country")
        : "World";
    const cad = cadence(pid);
    // Once, not once per day: it reads the store and the answer is the
    // same for all 21. Only TODAY can carry an unfolded answer.
    const mineIdx = pendingIdx(pid, id);
    const series: ScopeDay[] = Array.from({ length: DAYS }, (_, i) => {
      const d = dayAt(i);
      // An unscheduled day is absent for the crowd too. Everyone's cadence
      // is their own, so the cell may well hold answers — but placing them
      // on a day THIS reading does not draw would put a point on a line
      // the reader has no row for.
      if (!dueOn(cad, d)) return { i, n: 0, mean: null, placed: false, thin: false, scheduled: false };
      const agg = aggFor(pid, utcKey(d));
      // No document at all stays zero on the trend as it does on the card
      // (`todayN`): an absent reading is what the "first answer today" arm
      // is about, and a lone point drawn from your own vote would be a
      // claim about a crowd nobody has read.
      const cut = agg ? cutOf(agg, id, i === DAYS - 1 ? mineIdx : -1) : { n: 0, mean: null };
      return {
        i, n: cut.n,
        mean: cut.n > 0 ? cut.mean : null,
        placed: cut.n >= THIN && cut.mean != null,
        thin: cut.n > 0 && cut.n < THIN,
        scheduled: true,
      };
    });
    return { id, label, short: id, series };
  }
  const s = DEMO_SCOPES.find((x) => x.id === id) ?? DEMO_SCOPES[0];
  const me: { location?: string; country?: string } = IS_DATA.me ?? {};
  const label = s.label || (s.id === "city" ? (me.location || "Your city") : s.id === "country" ? (me.country || "Your country") : "World");
  const cad = cadence(pid);
  const series: ScopeDay[] = s.mean.map((m, i) => {
    if (!dueOn(cad, dayAt(i))) return { i, mean: null, n: 0, placed: false, thin: false, scheduled: false };
    const n = s.n[i] || 0;
    return { i, mean: n > 0 ? m : null, n, placed: n >= THIN && m != null, thin: n > 0 && n < THIN, scheduled: true };
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
  /** The 21-day window has LANDED — which `aggFor` cannot say, because it
   * answers null for "fetched, nobody answered" and "never fetched" alike
   * and the reading folds both into a confident zero. Demo has no window
   * to land: `scope()` serves DEMO_SCOPES and `ensureTrend` returns at its
   * first line, so the reading is complete the moment it renders. */
  trendReady(pid: string): boolean { return !LIVE.enabled || !!trendAggs[pid]; },
  /**
   * Has today's crowd been read? 'loading' | 'ready' | 'failed'.
   *
   * `todayN` answers 0 for three different facts — nobody answered, the
   * read is in flight, the read was refused — and the card turned all
   * three into "the first answer today". That sentence is a claim about
   * the crowd, so it may only be drawn on 'ready'. Demo is always ready:
   * its numbers are authored and there is nothing to fetch.
   */
  todayState(): "loading" | "ready" | "failed" {
    if (!LIVE.enabled) return "ready";
    if (todayAggs && loadedForKey === utcKey(dayAt(DAYS - 1))) return "ready";
    return todayFailed ? "failed" : "loading";
  },
  days, scope, streak, fmtN,
  word(pid: string, v: number): string { return stepsOf(pid).find((s) => s.v === v)?.label ?? ""; },
  /** Today's crowd split as percentages — live from today's per-day agg
   * (empty until anyone answers: an honest zero, never invented), demo
   * from the design's bins. */
  bins(pid: string, id: string): number[] {
    if (!LIVE.enabled) return DEMO_BINS[id] ?? DEMO_BINS.world;
    const agg = aggFor(pid, utcKey(dayAt(DAYS - 1)));
    if (!agg) return [0, 0, 0, 0, 0];
    // YOUR OWN UNFOLDED ANSWER JOINS AT READ TIME, the store's convention
    // (`pickCanon`, live.ts): once the trigger folds it the published
    // document already counts it, so only a PENDING answer adds. Without
    // this the reveal drew its crowd off a document written before you
    // answered — so "you · Brisk" sat above "0% of 4 answers today", the
    // percentage of the very step it was naming, with your bar at the
    // minimum height. `PULSE.answer` forces a refetch and reliably loses
    // the race with the fold; `ensureToday` then short-circuits on
    // `loadedForKey`, so that pre-vote crowd was frozen for the session.
    const mineIdx = pendingIdx(pid, id);
    if (id === "world") {
      const total = (agg.total || 0) + (mineIdx >= 0 ? 1 : 0);
      return Array.from({ length: 5 }, (_, i) =>
        total > 0 ? Math.round(100 * ((agg.counts?.[String(i)] ?? 0) + (i === mineIdx ? 1 : 0)) / total) : 0);
    }
    const cut = LIVE.anchors() || {};
    const bucket = id === "city" ? cut.city : cut.country;
    const cell = bucket ? agg.by?.[id]?.[bucket] : undefined;
    // The scoped cut is your own cohort, so a pending answer of yours
    // belongs in it too — same join, same reason as the world cut above.
    // WITH NO PUBLISHED CELL AS WELL: being the first in your city today
    // is the case where the cell is absent and you are still in it, and
    // gating the join on `cell` there drew five zeros beside a crowd of
    // one. `pendingIdx` is what decides membership; the cell only supplies
    // whoever came before you.
    const base = cell ? Object.values(cell).reduce((a, b) => a + b, 0) : 0;
    const n = base + (mineIdx >= 0 ? 1 : 0);
    return Array.from({ length: 5 }, (_, i) =>
      n > 0 ? Math.round(100 * ((cell?.[String(i)] ?? 0) + (i === mineIdx ? 1 : 0)) / n) : 0);
  },
  todayN(pid: string, id: string): number {
    if (!LIVE.enabled) {
      const s = DEMO_SCOPES.find((x) => x.id === id) ?? DEMO_SCOPES[2];
      return s.n[DAYS - 1];
    }
    // The denominator the card prints beside the share above, so it joins
    // the same way — a crowd stated as "of 4" while the share was worked
    // out over five would be the same wrong number twice.
    const mineIdx = pendingIdx(pid, id);
    const agg = aggFor(pid, utcKey(dayAt(DAYS - 1)));
    // No document at all is still zero, not one: the card's "first answer
    // today" arm is about an absent reading, and a pending answer with
    // nothing published yet is exactly that — you ARE the first.
    if (!agg) return 0;
    return cutOf(agg, id, mineIdx).n;
  },
  mineToday(pid: string): number | null {
    // NOT `days(pid)[DAYS - 1].v` (D244). That fold nulls every day the
    // cadence did not ask on, which is right for the trend line — a weekly
    // pulse must not draw a Tuesday it never offered — and wrong here.
    //
    // Whether you answered TODAY is a fact about what you did, not a
    // scheduling question. Read through the gate, changing a pulse's
    // rhythm after answering took your own answer off the card and put the
    // blind ask back over it, while the vote sat on the server: pausing
    // hid it outright, and switching to a rhythm that does not include
    // today did the same. Setting the cadence back made it reappear, so
    // nothing was ever lost except the card's word for what you had done.
    const k = utcKey(dayAt(DAYS - 1));
    const hist = LIVE.enabled
      ? null
      : HISTORY;
    return mineOn(
      k,
      LIVE.enabled ? LIVE.pulseVotes(pid) : {},
      LIVE.enabled ? {} : (demoSaved()[pid] || {}),
      hist ? hist[DAYS - 1] ?? null : null,
    );
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
  todayFailed = false;
  notify();
});

export default PULSE;
