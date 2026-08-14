// The daily pulse's store (D139) — the design's PULSE contract
// (design/standalone-v24/pulse-data.js), typed, in two honest modes:
//
//   · DEMO — the prototype room: seeded histories (one per honest case:
//     typical, gap, day-one, perfect), invented crowds, localStorage
//     answers. The design's furniture, verbatim.
//   · LIVE — your days from the hydrated vote mirror (zero extra reads),
//     the crowd from the PER-DAY aggregate docs the untouched trigger
//     publishes, one bounded query per open (session-cached, poll-not-
//     stream — D124/D129; the costs line is in docs/COSTS.md).
//
// The design's honesty rules are the contract, not decoration:
//   · a day nobody answered is ABSENT — never zero-filled, never bridged
//   · a day too thin to place keeps its count and is listed, not placed
//   · no smoothing, no rolling mean, no invented baseline anywhere
import LIVE from "./live";
import { getDb, getFirestoreApi } from "../../lib/firebase";

/** The one live pulse question. A roster becomes a parameter the day a
 * second pulse ships; until then a constant is honest about the design
 * ("the one fixed question in the app"). Must match content/
 * pulse-questions.json — the template doc is fetched, this is only the
 * key. */
export const PULSE_QID = "pulse-pace";

export const DAYS = 21; // three weeks — the window the reading covers
export const THIN = 20; // fewer answers than this: counted, never placed

export interface PulseStep { v: number; label: string }
export interface PulseDay {
  i: number; key: string; date: Date; label: string; today: boolean;
  weekStart: boolean; v: number | null;
}
export interface ScopeDay { i: number; mean: number | null; n: number; placed: boolean; thin: boolean }
export interface PulseScope { id: string; label: string; short: string; series: ScopeDay[] }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── demo furniture (the design's, verbatim) ─────────────────────────────
const DEMO_STEPS: PulseStep[] = [
  { v: 1, label: "Rough" }, { v: 2, label: "Off" }, { v: 3, label: "Fine" },
  { v: 4, label: "Good" }, { v: 5, label: "Great" },
];
const DEMO_Q = { kicker: "daily pulse", text: "How is today going?" };
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

// ── shared clock arithmetic ─────────────────────────────────────────────
// Day keys are UTC — the rules window, the vote's utcDayKey and the
// per-day agg ids are all UTC, so the reading has to bucket the same way
// or a late evening answers into "tomorrow's" row.
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

// ── state ───────────────────────────────────────────────────────────────
interface LiveTemplate { prompt: string; options: string[] }
interface DayAgg { counts: Record<string, number>; total: number; by?: Record<string, Record<string, Record<string, number>>> }

let template: LiveTemplate | null = null;
let dayAggs: Record<string, DayAgg | null> | null = null; // key → agg (null = fetched, absent)
let loading: Promise<void> | null = null;
let loadedForKey = ""; // today's key at load time — a day rollover invalidates
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => { try { f(); } catch { /* a broken listener must not stop the rest */ } });

const demoSaved = (): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
};

/** One bounded fetch per open: the template plus the window's per-day agg
 * docs, in a single documentId() in-query (21 ids ≤ the 30-clause cap).
 * An absent doc means nobody answered that day — stored as null so the
 * reading can say so rather than refetching. */
export function ensureLive(force = false): Promise<void> {
  if (!LIVE.enabled) return Promise.resolve();
  const today = utcKey(dayAt(DAYS - 1));
  if (dayAggs && loadedForKey === today && !force) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const db = await getDb();
      const { collection, doc, documentId, getDoc, getDocs, query, where } = await getFirestoreApi();
      if (!template) {
        const t = await getDoc(doc(db, "v2_questions", PULSE_QID));
        if (t.exists()) {
          template = {
            prompt: String(t.get("prompt") ?? ""),
            options: (t.get("options") as string[] | undefined) ?? [],
          };
        }
      }
      const keys = Array.from({ length: DAYS }, (_, i) => `${PULSE_QID}_${utcKey(dayAt(i))}`);
      const snap = await getDocs(
        query(collection(db, "v2_question_aggs"), where(documentId(), "in", keys)),
      );
      const got = new Map(snap.docs.map((d) => [d.id, d.data() as DayAgg]));
      const next: Record<string, DayAgg | null> = {};
      for (let i = 0; i < DAYS; i++) {
        next[utcKey(dayAt(i))] = got.get(`${PULSE_QID}_${utcKey(dayAt(i))}`) ?? null;
      }
      dayAggs = next;
      loadedForKey = today;
      notify();
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// ── the store (the design's PULSE API, live-aware) ──────────────────────
function stepsNow(): PulseStep[] {
  if (LIVE.enabled && template && template.options.length === 5) {
    return template.options.map((label, i) => ({ v: i + 1, label }));
  }
  return DEMO_STEPS;
}

function qNow(): { kicker: string; text: string } {
  if (LIVE.enabled) return { kicker: "daily pulse", text: template?.prompt ?? "" };
  return DEMO_Q;
}

function days(): PulseDay[] {
  const mineDemo = demoSaved();
  const mineLive = LIVE.enabled ? LIVE.pulseVotes(PULSE_QID) : {};
  const hist = LIVE.enabled
    ? Array(DAYS).fill(null)
    : HISTORY[(window as { IS_PULSE_HISTORY?: string }).IS_PULSE_HISTORY ?? "typical"] ?? HISTORY.typical;
  return hist.map((v: number | null, i: number) => {
    const d = dayAt(i);
    const k = utcKey(d);
    const mine = LIVE.enabled
      ? (k in mineLive ? mineLive[k] + 1 : null) // optionIdx 0..4 → step 1..5
      : (mineDemo[k] != null ? mineDemo[k] : v);
    return {
      i, key: k, date: d, label: dayLabel(d), today: i === DAYS - 1,
      weekStart: i % 7 === 0, v: mine,
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

function scope(id: string): PulseScope {
  if (LIVE.enabled) {
    const a = LIVE.anchors() || {};
    const label = id === "city" ? (a.city || "Your city") : id === "country" ? (a.country || "Your country") : "World";
    const series: ScopeDay[] = Array.from({ length: DAYS }, (_, i) => {
      const agg = dayAggs?.[utcKey(dayAt(i))] ?? null;
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
  const series: ScopeDay[] = s.mean.map((m, i) => {
    const n = s.n[i] || 0;
    return { i, mean: n > 0 ? m : null, n, placed: n >= THIN && m != null, thin: n > 0 && n < THIN };
  });
  return { id: s.id, label, short: s.short, series };
}

function streak(): { run: number; live: boolean; ticks: PulseDay[] } {
  const d = days();
  const live = d[DAYS - 1].v != null;
  let run = 0;
  for (let i = DAYS - 1 - (live ? 0 : 1); i >= 0; i--) { if (d[i].v == null) break; run++; }
  return { run, live, ticks: d.slice(DAYS - 14) };
}

const fmtN = (n: number): string =>
  n >= 1000000 ? (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M"
    : n >= 10000 ? Math.round(n / 1000) + "k"
      : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
        : String(n);

export const PULSE = {
  DAYS, THIN,
  get STEPS() { return stepsNow(); },
  SCOPES: ["city", "country", "world"],
  get Q() { return qNow(); },
  /** Live: the template exists and today's card can render. Demo: always. */
  ready(): boolean { return !LIVE.enabled || template != null; },
  days, scope, streak, fmtN,
  word(v: number): string { return stepsNow().find((s) => s.v === v)?.label ?? ""; },
  /** Today's crowd split as percentages — live from today's per-day agg
   * (empty until anyone answers: an honest zero, never invented), demo
   * from the design's bins. */
  bins(id: string): number[] {
    if (!LIVE.enabled) return DEMO_BINS[id] ?? DEMO_BINS.world;
    const agg = dayAggs?.[utcKey(dayAt(DAYS - 1))];
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
  todayN(id: string): number {
    if (!LIVE.enabled) {
      const s = DEMO_SCOPES.find((x) => x.id === id) ?? DEMO_SCOPES[2];
      return s.n[DAYS - 1];
    }
    const agg = dayAggs?.[utcKey(dayAt(DAYS - 1))];
    if (!agg) return 0;
    return cutOf(agg, id).n;
  },
  mineToday(): number | null { return days()[DAYS - 1].v; },
  /** Answer today. Live: the day-keyed write through the rules (create-
   * only — the store mirrors immediately, LIVE rolls back on refusal).
   * Demo: localStorage, the design's room. */
  answer(v: number): void {
    if (LIVE.enabled) {
      void LIVE.votePulse(PULSE_QID, v - 1);
      // The crowd for today moves with your own answer on the next poll;
      // refresh so the reveal's bins include you promptly.
      void ensureLive(true).catch(() => { /* the card renders your side regardless */ });
    } else {
      const m = demoSaved();
      m[utcKey(dayAt(DAYS - 1))] = v;
      try { localStorage.setItem(LS, JSON.stringify(m)); } catch { /* best-effort, in-memory state stays right */ }
    }
    notify();
  },
  ensureLive,
  subscribe(f: () => void): () => void {
    subs.add(f);
    const un = LIVE.enabled ? LIVE.subscribe?.(f) : undefined;
    return () => { subs.delete(f); if (un) un(); };
  },
};

// The purge (D51): the demo answers are device state; the live caches are
// account state. Both go.
window.addEventListener("insight:local-purge", () => {
  dayAggs = null;
  loadedForKey = "";
  notify();
});

export default PULSE;
