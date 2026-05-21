import { useMemo, useState, type ReactNode } from "react";
import { VerdictCard } from "../shared/VerdictCard";
import { useMoods } from "../../lib/useMoods";
import { Kicker } from "../shared/primitives";
import { Donut, HBars } from "../shared/charts";
import { useHabits } from "../../lib/useHabits";
import { useMeals, isoDateToday } from "../../lib/useMeals";
import { useWorkouts } from "../../lib/useWorkouts";
import { useTransactions } from "../../lib/useTransactions";
import { useProfile } from "../../lib/useProfile";
import { workoutStreak } from "../../lib/bodyEnergy";
import type {
  Meal,
  Transaction,
  TransactionType,
  Workout,
  WorkoutIntensity,
  WorkoutType,
} from "../../types";

// ───────── helpers ─────────

interface StatItem {
  v: ReactNode;
  l: string;
}
function StatRow({ items }: { items: StatItem[] }) {
  return (
    <div
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 10,
        marginBottom: 12,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            textAlign: "center",
            borderRight:
              i < items.length - 1 ? "0.5px solid var(--rule)" : "none",
          }}
        >
          <div className="fig-num" style={{ fontSize: 22 }}>
            <em>{it.v}</em>
          </div>
          <div className="kicker">{it.l}</div>
        </div>
      ))}
    </div>
  );
}

// ───────── HABITS ─────────

// Generate the last N ISO date strings (oldest first), ending today.
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

// Streak math from a completions array. `current` is the most recent
// unbroken run ending at today (or yesterday if today isn't done yet
// — keeps the streak alive during the current day). `best` is the
// longest run ever.
function streakInfo(completions: string[]): { current: number; best: number } {
  if (completions.length === 0) return { current: 0, best: 0 };
  const sorted = [...completions].sort();
  const set = new Set(sorted);
  // Walk backwards from today computing current.
  const today = new Date();
  let current = 0;
  // Allow today to be skipped — start from today if done, else yesterday.
  const startDate = new Date(today);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (!set.has(todayIso)) startDate.setDate(startDate.getDate() - 1);
  for (let d = new Date(startDate); ; d.setDate(d.getDate() - 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!set.has(iso)) break;
    current += 1;
  }
  // Longest run anywhere in the series: walk all dates between min
  // and max, counting consecutive hits.
  const dates = sorted.map((s) => new Date(s).getTime()).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  const dayMs = 24 * 60 * 60 * 1000;
  for (const t of dates) {
    if (prev !== null && t - prev <= dayMs * 1.5) run += 1;
    else run = 1;
    if (run > best) best = run;
    prev = t;
  }
  return { current, best };
}

// Rotate through a small palette so habits added one after another
// get visually distinct hues without the user having to choose.
const HABIT_HUES = [38, 145, 220, 25, 80, 305, 12, 250, 195, 60];
function hueForIndex(i: number): number {
  return HABIT_HUES[i % HABIT_HUES.length];
}
function hueFromColor(color: string, fallback: number): number {
  // Habit.color is stored as e.g. `oklch(0.55 0.12 145)` — pull the
  // last numeric token as the hue.
  const m = color.match(/(\d+(?:\.\d+)?)\s*\)$/);
  return m ? Number(m[1]) : fallback;
}

function AddHabitInline({
  onAdd,
}: {
  onAdd: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 6,
          padding: "8px 12px",
          border: "0.5px dashed var(--rule)",
          borderRadius: 8,
          background: "transparent",
          color: "var(--ink-3)",
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
          width: "100%",
        }}
      >
        + add a habit
      </button>
    );
  }
  const submit = () => {
    const t = name.trim();
    if (!t) {
      setOpen(false);
      return;
    }
    onAdd(t);
    setName("");
    setOpen(false);
  };
  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        gap: 6,
        padding: "6px 8px",
        border: "0.5px solid var(--rule)",
        borderRadius: 8,
        background: "var(--paper-2)",
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setName("");
            setOpen(false);
          }
        }}
        placeholder="habit name (e.g. cold dip, journal)"
        autoFocus
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13,
          color: "var(--ink)",
        }}
      />
      <button
        onClick={submit}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-2)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 11,
          padding: 0,
        }}
      >
        add
      </button>
    </div>
  );
}

export function HabitsTab() {
  const { habits, isDoneToday, toggleToday, add, remove } = useHabits();
  const { moods: priorMoods } = useMoods();

  // Decorate each habit with its derived hue + computed stats. The
  // hue lives inside the stored color string; we extract it once.
  const decorated = habits.map((h, i) => {
    const hue = hueFromColor(h.color, hueForIndex(i));
    const completions = h.completions || [];
    const { current, best } = streakInfo(completions);
    return { ...h, hue, completions, current, best };
  });
  const todayCount = decorated.filter((h) => isDoneToday(h.name)).length;
  const totalDoneAll = decorated.reduce(
    (s, h) => s + h.completions.length,
    0,
  );
  const totalPossible = decorated.length * 30;
  const thirtyPct =
    totalPossible > 0
      ? Math.round(
          (decorated.reduce((s, h) => {
            const last30 = lastNDates(30);
            return s + last30.filter((d) => h.completions.includes(d)).length;
          }, 0) /
            totalPossible) *
            100,
        )
      : 0;
  const longestNow = decorated.reduce((m, h) => Math.max(m, h.current), 0);
  const longestEver = decorated.reduce((m, h) => Math.max(m, h.best), 0);

  // Verdict prompt — feed the LLM today's real completions and the
  // user's most recent mood scores so it can notice an honest
  // pattern rather than commenting on seed data.
  const habitsToday = decorated
    .map(
      (h) =>
        `${h.name}: ${isDoneToday(h.name) ? "done" : "skipped"} (${h.current}d streak)`,
    )
    .join("; ");
  const recentMoods = priorMoods
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map((m) => `${m.date}: ${m.score}/5`)
    .join(", ");
  const habitsPrompt = [
    "You write short, plain reflections about a user. Look at the user's habits today and their recent moods. Write ONE short sentence (under 18 words) noticing a small pattern or contrast — no advice, no cheer, no questions. Be plain and descriptive — no flourishes.",
    "",
    habitsToday ? `Today's habits: ${habitsToday}` : "No habits tracked yet.",
    recentMoods ? `Recent moods (most recent first): ${recentMoods}` : "",
    "",
    "Your one-sentence observation:",
  ]
    .filter(Boolean)
    .join("\n");

  // Used by both the per-habit week strip and the 30-day grid.
  const last7 = lastNDates(7);
  const last30 = lastNDates(30);
  void totalDoneAll;

  return (
    <div>
      <StatRow
        items={[
          {
            v: decorated.length > 0 ? `${todayCount}/${decorated.length}` : "—",
            l: "TODAY",
          },
          { v: decorated.length > 0 ? `${thirtyPct}%` : "—", l: "30-DAY · ALL" },
          {
            v: longestNow > 0 ? String(longestNow) : "—",
            l: "LONGEST · NOW",
          },
          {
            v: longestEver > 0 ? String(longestEver) : "—",
            l: "LONGEST · EVER",
          },
        ]}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Today</Kicker>
        {decorated.length === 0 ? (
          <div
            className="margin-note"
            style={{
              marginTop: 8,
              fontSize: 13,
              fontStyle: "italic",
            }}
          >
            No habits yet. Add the small things you want to keep — a walk, a
            page, a cold dip — and tap each one when you do it.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 10,
            }}
          >
            {decorated.map((h) => {
              const done = isDoneToday(h.name);
              const accent = `oklch(0.55 0.12 ${h.hue})`;
              return (
                <div
                  key={h.id}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <button
                    type="button"
                    onClick={() => void toggleToday(h.name, accent, h.icon)}
                    aria-pressed={done}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: `1.5px solid ${accent}`,
                      background: done ? accent : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--paper)",
                      fontFamily: "var(--serif)",
                      fontSize: 12,
                      flexShrink: 0,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {done ? "✓" : ""}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      {h.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        color: "var(--ink-3)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {h.current}d streak · best {h.best || "—"}d
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {last7.map((d, i) => {
                      const on = h.completions.includes(d);
                      return (
                        <span
                          key={i}
                          title={d}
                          style={{
                            width: 5,
                            height: 14,
                            borderRadius: 1,
                            background: on ? accent : "var(--rule)",
                            opacity: on ? 1 : 0.5,
                          }}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove “${h.name}”?`)) {
                        void remove(h.name);
                      }
                    }}
                    aria-label={`Remove ${h.name}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--ink-3)",
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      padding: "0 2px",
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <AddHabitInline
          onAdd={(name) =>
            void add(name, `oklch(0.55 0.12 ${hueForIndex(decorated.length)})`)
          }
        />
      </div>

      {decorated.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <Kicker>30-day grids</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 12,
            }}
          >
            {decorated.map((h) => {
              const done30 = last30.filter((d) =>
                h.completions.includes(d),
              ).length;
              const accent = `oklch(0.55 0.13 ${h.hue})`;
              return (
                <div key={h.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 12.5,
                        fontStyle: "italic",
                      }}
                    >
                      {h.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        color: "var(--ink-3)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {done30}/30 · {Math.round((done30 / 30) * 100)}%
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(30, 1fr)",
                      gap: 2,
                    }}
                  >
                    {last30.map((d, i) => {
                      const on = h.completions.includes(d);
                      return (
                        <div
                          key={i}
                          title={d}
                          style={{
                            aspectRatio: "1",
                            background: on ? accent : "var(--rule)",
                            opacity: on ? 0.85 : 0.35,
                            borderRadius: 1,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {decorated.length > 0 && (
        <VerdictCard
          kicker="REFLECTION"
          cacheKey="habits"
          prompt={habitsPrompt}
        />
      )}
    </div>
  );
}

// ───────── shared helpers for the activity / nutrition / finance tabs ─────────

// A clean "this month" header — current calendar month in the user's
// locale. Used by the finance summary line.
function monthLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

// "2026-05-14" → "may 14". Keeps the journal aesthetic consistent
// with BodyOverlay's meal log.
function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return `${months[m - 1]} ${d}`;
}

// Number formatter that won't crash on negatives or floats. Locale
// grouping looks nicer than raw `${n}` for values >= 1000.
function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

// Generic empty-state card used by each tab when there's nothing
// logged yet. Keeps the visual language consistent with the
// scrapbook / impressions empties.
function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="card" style={{ padding: 22, textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 36,
          fontStyle: "italic",
          color: "var(--ink-3)",
        }}
      >
        ◌
      </div>
      <div className="margin-note" style={{ marginTop: 10, fontSize: 13 }}>
        {copy}
      </div>
    </div>
  );
}

// "+ log" pill button. Same chunky black pill used in BodyOverlay
// to open the add-meal modal.
function LogButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px",
        background: "var(--ink)",
        color: "var(--paper)",
        border: "none",
        borderRadius: 14,
        fontFamily: "var(--serif)",
        fontSize: 15,
        marginBottom: 14,
        cursor: "pointer",
      }}
    >
      <span style={{ fontStyle: "italic" }}>{label}</span>
    </button>
  );
}

// Modal frame for the various "log a …" forms. Dark overlay with a
// paper card centred inside, mirroring AddMealFlow in BodyOverlay.
function FormModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="app-header"
        style={{
          background: "transparent",
          borderBottom: "0.5px solid rgba(255,255,255,0.15)",
        }}
      >
        <button
          className="avatar-btn"
          onClick={onClose}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          {title}
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div
          style={{
            background: "var(--paper)",
            borderRadius: 8,
            padding: 16,
            color: "var(--ink)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  background: "var(--paper-2)",
  border: "0.5px solid var(--rule)",
  borderRadius: 6,
  fontFamily: "var(--mono)",
  fontSize: 14,
  color: "var(--ink)",
};

const serifInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 15,
};

// Small "×" delete control reused by each list row.
function DeleteX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (confirm(`Remove ${label}?`)) onClick();
      }}
      aria-label={`Remove ${label}`}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--ink-3)",
        cursor: "pointer",
        fontFamily: "var(--mono)",
        fontSize: 14,
        padding: "0 4px",
      }}
    >
      ×
    </button>
  );
}

// Stat row used at the top of each tab. Real numbers only.
interface StatItem {
  v: ReactNode;
  l: string;
}
function MiniStatRow({ items }: { items: StatItem[] }) {
  return (
    <div
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 10,
        marginBottom: 12,
      }}
    >
      {items.map((it, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <div
            className="fig-num"
            style={{ fontSize: 22, lineHeight: 1, marginBottom: 2 }}
          >
            <em>{it.v}</em>
          </div>
          <div className="kicker" style={{ fontSize: 8 }}>
            {it.l}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────── FITNESS ─────────
//
// Wired to useWorkouts. Real aggregates only — workouts logged this
// week, total minutes / kcal, types breakdown.
//
// What's not here: steps, HR zones, VO2 max, training load (CTL/ATL),
// pace trends, recovery scatter, PRs. All wearable-derived; the
// integration isn't built. The "wearable signals" empty-state at
// the top mirrors the call we made in BodyOverlay.


export function FitnessTab() {
  const { items, add, remove } = useWorkouts();
  const { profile } = useProfile();
  const [adding, setAdding] = useState(false);

  // Workouts in the last 7 ISO days, sorted newest first for the
  // list view. Date is stored as a plain string (free-form) but the
  // add form always writes today's ISO, so a lexicographic sort
  // works for everything created here.
  const todayIso = isoDateToday();
  const sevenAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const weekItems = items.filter(
    (w) => w.date >= sevenAgo && w.date <= todayIso,
  );
  const weekMinutes = weekItems.reduce((s, w) => s + w.duration, 0);
  const weekKcal = weekItems.reduce((s, w) => s + w.kcal, 0);
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  // Consecutive-day streak — the consecutive run of days, counted
  // back from today, that have at least one logged workout. Allows
  // a one-day grace for "today not logged yet but yesterday was."
  const streak = useMemo(() => workoutStreak(items), [items]);

  // 28-day heatmap. Each day is a cell — colour intensity by total
  // duration on that day. Empty days render as a thin border so the
  // grid stays legible. Days are ordered oldest → newest, left to
  // right, top to bottom in 7-day rows so the rightmost column is
  // always today.
  const heatmap = useMemo(() => {
    const cells: { date: string; minutes: number }[] = [];
    const cursor = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const minutes = items
        .filter((w) => w.date === iso)
        .reduce((s, w) => s + w.duration, 0);
      cells.push({ date: iso, minutes });
    }
    return cells;
  }, [items]);
  const heatmapMax = Math.max(30, ...heatmap.map((c) => c.minutes));
  // Daily active-minutes goal — WHO recommends 150 / week = ~22 / day,
  // we round to 30 as a nicer mental target.
  const ACTIVE_MIN_GOAL = 30;
  const todayActiveMin = weekItems
    .filter((w) => w.date === todayIso)
    .reduce((s, w) => s + w.duration, 0);

  // Types breakdown across all logged workouts. Useful for "you do
  // mostly X" without needing a real horizon picker.
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of items) counts[w.type] = (counts[w.type] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [items]);

  const fitnessPrompt =
    weekItems.length === 0
      ? null
      : [
          "You write short, plain reflections about a user. Look at the user's training this week. Write ONE short sentence (under 18 words) noticing a shape or pattern — no advice, no cheer. Be plain and descriptive — no flourishes.",
          "",
          `This week: ${weekItems.length} sessions, ${weekMinutes} minutes, ${weekKcal} kcal.`,
          `Sessions: ${weekItems
            .map((w) => `${w.type} ${w.duration}m ${w.intensity}`)
            .join("; ")}`,
          "",
          "Your one-sentence observation:",
        ].join("\n");

  return (
    <div>
      <div
        className="card"
        style={{
          marginBottom: 12,
          padding: 14,
          borderLeft: "3px solid var(--ink-3)",
        }}
      >
        <Kicker>wearable signals · not connected</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}
        >
          Steps, heart-rate zones, VO₂ max, and training-load curves
          show up here once a wearable is paired. Until then this
          tab tracks what you log by hand.
        </div>
      </div>

      <MiniStatRow
        items={[
          { v: weekItems.length, l: "WORKOUTS · 7D" },
          { v: fmt(weekMinutes), l: "MINUTES · 7D" },
          { v: fmt(weekKcal), l: "KCAL · 7D" },
          { v: streak, l: streak === 1 ? "DAY STREAK" : "DAY STREAK" },
        ]}
      />

      {/* Daily active-minutes progress against a 30-min reference.
          Card surfaces today's total + remaining; the WHO weekly
          guideline is 150 min so this is the per-day slice. */}
      <div
        className="card"
        style={{
          marginTop: 10,
          marginBottom: 10,
          padding: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Donut
          value={Math.min(100, Math.round((todayActiveMin / ACTIVE_MIN_GOAL) * 100))}
          color="var(--sage)"
          label="MIN"
          size={64}
        />
        <div style={{ flex: 1 }}>
          <Kicker>Active minutes · today</Kicker>
          <div className="fig-num" style={{ marginTop: 2 }}>
            <em>{todayActiveMin}</em>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--ink-3)",
                marginLeft: 6,
              }}
            >
              / {ACTIVE_MIN_GOAL} min
            </span>
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 4, fontSize: 11 }}
          >
            WHO baseline is 150 min/week — this is the per-day slice.
          </div>
          {profile.chronotype && (
            <div
              className="margin-note"
              style={{
                marginTop: 6,
                fontSize: 11,
                fontStyle: "italic",
                color: "var(--ink-2)",
              }}
            >
              {profile.chronotype.category === "lark"
                ? "You're a lark — train before 11 am for the best output."
                : profile.chronotype.category === "owl"
                  ? "You're an owl — late afternoon onward is your strongest window."
                  : "Intermediate chronotype — most windows work for you."}
            </div>
          )}
        </div>
      </div>

      {/* 28-day heatmap. Each cell's intensity scales with minutes
          logged. Rightmost cell is always today. */}
      <div
        className="card"
        style={{ marginBottom: 12, padding: 14 }}
      >
        <Kicker>Recent · last four weeks</Kicker>
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
          }}
        >
          {heatmap.map((c) => {
            const intensity = c.minutes / heatmapMax;
            const bg = c.minutes === 0
              ? "var(--paper-2)"
              : `oklch(${0.92 - intensity * 0.42} ${0.05 + intensity * 0.09} 145)`;
            return (
              <div
                key={c.date}
                title={`${c.date}: ${c.minutes} min`}
                style={{
                  aspectRatio: "1",
                  background: bg,
                  border: "0.5px solid var(--rule)",
                  borderRadius: 3,
                }}
              />
            );
          })}
        </div>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 10, color: "var(--ink-3)" }}
        >
          Darker = more minutes. Empty cells = rest days.
        </div>
      </div>

      {typeCounts.length > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: 14 }}>
          <Kicker>by type · all time</Kicker>
          <div style={{ marginTop: 8 }}>
            <HBars
              items={typeCounts.map(([k, v]) => ({
                label: k,
                value: v,
                color: "var(--sage)",
              }))}
            />
          </div>
        </div>
      )}

      <LogButton label="+ log a workout" onClick={() => setAdding(true)} />

      {sorted.length > 0 ? (
        <>
          <Kicker>your log · most recent first</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 10,
            }}
          >
            {sorted.map((w) => (
              <WorkoutRow
                key={w.id}
                w={w}
                onRemove={() => void remove(w.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState copy="Log your first session — type, minutes, intensity, kcal. The weekly stats fill in as you go." />
      )}

      {fitnessPrompt && (
        <div style={{ marginTop: 14 }}>
          <VerdictCard
            kicker="REFLECTION"
            cacheKey="fitness"
            prompt={fitnessPrompt}
          />
        </div>
      )}

      {adding && (
        <AddWorkoutFlow
          onClose={() => setAdding(false)}
          onSave={async (w) => {
            await add(w);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function WorkoutRow({ w, onRemove }: { w: Workout; onRemove: () => void }) {
  const intensityColor: Record<WorkoutIntensity, string> = {
    Low: "var(--sage)",
    Medium: "var(--ochre)",
    High: "var(--sienna)",
  };
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderLeft: `3px solid ${intensityColor[w.intensity]}`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: 6,
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13,
        }}
      >
        {w.type[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker">{displayDate(w.date)}</div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            marginTop: 1,
            lineHeight: 1.2,
          }}
        >
          {w.type}
          {w.notes ? (
            <span
              style={{
                fontStyle: "italic",
                color: "var(--ink-3)",
                fontSize: 12,
                marginLeft: 6,
              }}
            >
              · {w.notes}
            </span>
          ) : null}
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "var(--ink-3)",
            letterSpacing: "0.04em",
            marginTop: 2,
          }}
        >
          {w.duration} MIN · {w.intensity.toUpperCase()}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="fig-num" style={{ fontSize: 18 }}>
          <em>{w.kcal}</em>
        </div>
        <div className="kicker">KCAL</div>
      </div>
      <DeleteX onClick={onRemove} label={`the ${w.type.toLowerCase()}`} />
    </div>
  );
}

const WORKOUT_TYPES: WorkoutType[] = [
  "Run",
  "Walk",
  "Cycle",
  "Swim",
  "Strength",
  "HIIT",
  "Yoga",
  "Other",
];
const INTENSITIES: WorkoutIntensity[] = ["Low", "Medium", "High"];

function AddWorkoutFlow({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (w: Omit<Workout, "id">) => Promise<void>;
}) {
  const [type, setType] = useState<WorkoutType>("Run");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<WorkoutIntensity>("Medium");
  const [kcal, setKcal] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const dur = Number(duration);
  const k = Number(kcal);
  const canSave = Number.isFinite(dur) && dur > 0;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        date: isoDateToday(),
        type,
        duration: Math.round(dur),
        intensity,
        kcal: Number.isFinite(k) && k > 0 ? Math.round(k) : 0,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal title="log a workout" onClose={onClose}>
      <Kicker>type</Kicker>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 5,
          marginTop: 6,
        }}
      >
        {WORKOUT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 999,
              cursor: "pointer",
              background: type === t ? "var(--ink)" : "var(--paper-2)",
              color: type === t ? "var(--paper)" : "var(--ink-2)",
              border: "0.5px solid var(--rule)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="kicker">minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="1440"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 45"
            style={inputStyle}
          />
        </label>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="kicker">kcal · optional</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="5000"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="0"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ marginTop: 14 }}>
        <Kicker>intensity</Kicker>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {INTENSITIES.map((i) => (
            <button
              key={i}
              onClick={() => setIntensity(i)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                cursor: "pointer",
                background:
                  intensity === i ? "var(--ink)" : "var(--paper-2)",
                color: intensity === i ? "var(--paper)" : "var(--ink-2)",
                border: "0.5px solid var(--rule)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
              }}
            >
              {i.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Kicker>notes · optional</Kicker>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="how it felt"
          style={{ ...serifInputStyle, marginTop: 6 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: "12px",
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 999,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSave || saving}
          style={{
            flex: 1,
            padding: "12px",
            background: canSave ? "var(--ink)" : "var(--paper-3)",
            color: canSave ? "var(--paper)" : "var(--ink-3)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            cursor: canSave ? "pointer" : "default",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "saving…" : "save"}
        </button>
      </div>
    </FormModal>
  );
}

// ───────── NUTRITION ─────────
//
// Same useMeals source as BodyOverlay — your meals show in both
// places. This tab is the longer-horizon view: today's kcal + macro
// split, last 14 days bar chart, full log. Add-meal form lives in
// BodyOverlay; this tab links there.

const DEFAULT_KCAL_TARGET = 2000;

export function NutritionTab() {
  const { items, remove } = useMeals();
  const today = isoDateToday();
  const todayMeals = items.filter((m) => m.date === today);
  const todayKcal = todayMeals.reduce((s, m) => s + m.kcal, 0);
  const todayMacros = todayMeals.reduce(
    (acc, m) => ({
      carbs: acc.carbs + m.carbs,
      protein: acc.protein + m.protein,
      fat: acc.fat + m.fat,
    }),
    { carbs: 0, protein: 0, fat: 0 },
  );

  // 14-day window for the bar chart — gives a feel for week-on-week
  // patterns without going so far back that empty days dominate.
  const days14 = useMemo(() => {
    const out: string[] = [];
    const t = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(t);
      d.setDate(t.getDate() - i);
      out.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
    return out;
  }, []);
  const dayKcal = days14.map((d) =>
    items.filter((m) => m.date === d).reduce((s, m) => s + m.kcal, 0),
  );
  const dayMax = Math.max(DEFAULT_KCAL_TARGET, ...dayKcal);
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  const nutritionPrompt = useMemo(
    () =>
      sorted.length === 0
        ? null
        : [
            "You write short, plain reflections about a user. Look at the user's recent eating pattern. Write ONE short sentence (under 18 words) noticing a shape or pattern — no advice, no diet talk. Be plain and descriptive — no flourishes.",
            "",
            `Today: ${todayKcal} kcal across ${todayMeals.length} entries.`,
            `Today macros (g): carbs ${todayMacros.carbs}, protein ${todayMacros.protein}, fat ${todayMacros.fat}.`,
            `Last 14 days kcal: ${dayKcal.join(", ")}.`,
            "",
            "Your one-sentence observation:",
          ].join("\n"),
    [sorted.length, todayKcal, todayMeals.length, todayMacros, dayKcal],
  );

  return (
    <div>
      <MiniStatRow
        items={[
          { v: fmt(todayKcal), l: "KCAL · TODAY" },
          { v: todayMeals.length, l: "ENTRIES · TODAY" },
          {
            v: fmt(dayKcal.reduce((s, v) => s + v, 0) / 14),
            l: "AVG · 14D",
          },
          { v: items.length, l: "ALL TIME" },
        ]}
      />

      <div
        className="card"
        style={{
          marginBottom: 12,
          padding: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Donut
          value={Math.min(
            100,
            Math.round((todayKcal / DEFAULT_KCAL_TARGET) * 100),
          )}
          color="var(--ochre)"
          label="KCAL"
          size={72}
        />
        <div style={{ flex: 1 }}>
          <div className="fig-num">
            <em>{fmt(todayKcal)}</em>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                color: "var(--ink-3)",
                marginLeft: 6,
              }}
            >
              / {DEFAULT_KCAL_TARGET.toLocaleString()}
            </span>
          </div>
          <div className="kicker" style={{ marginTop: 2 }}>
            TODAY · {todayMeals.length}{" "}
            {todayMeals.length === 1 ? "ENTRY" : "ENTRIES"}
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 4, fontSize: 11 }}
          >
            2,000 kcal is a generic reference, not your target.
          </div>
        </div>
      </div>

      {(todayMacros.carbs > 0 ||
        todayMacros.protein > 0 ||
        todayMacros.fat > 0) && (
        <div className="card" style={{ marginBottom: 12, padding: 14 }}>
          <Kicker>Today · macros · grams</Kicker>
          <div style={{ marginTop: 10 }}>
            <HBars
              items={[
                {
                  label: "Carbs",
                  value: todayMacros.carbs,
                  color: "var(--ochre)",
                },
                {
                  label: "Protein",
                  value: todayMacros.protein,
                  color: "var(--sienna)",
                },
                { label: "Fat", value: todayMacros.fat, color: "var(--sage)" },
              ]}
            />
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: 14 }}>
          <Kicker>Calories · last 14 days</Kicker>
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 12,
              alignItems: "flex-end",
              height: 70,
            }}
          >
            {dayKcal.map((v, i) => {
              const isToday = i === 13;
              return (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    title={`${displayDate(days14[i])}: ${fmt(v)} kcal`}
                    style={{
                      height: Math.max(2, (v / dayMax) * 60),
                      background: isToday
                        ? "var(--ochre)"
                        : "var(--paper-2)",
                      border: isToday ? "none" : "0.5px solid var(--rule)",
                      borderRadius: 2,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          marginBottom: 14,
          padding: 12,
          textAlign: "center",
          background: "var(--paper-2)",
          borderStyle: "dashed",
        }}
      >
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--ink-2)",
          }}
        >
          Log meals from "the body" overlay — the floating + button.
        </div>
      </div>

      {sorted.length > 0 ? (
        <>
          <Kicker>your log · most recent first</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 10,
            }}
          >
            {sorted.slice(0, 20).map((m) => (
              <NutritionRow
                key={m.id}
                m={m}
                onRemove={() => void remove(m.id)}
              />
            ))}
          </div>
          {sorted.length > 20 && (
            <div
              className="margin-note"
              style={{
                marginTop: 10,
                fontSize: 11,
                textAlign: "center",
                color: "var(--ink-3)",
              }}
            >
              showing the 20 most recent — {sorted.length - 20} more in your archive
            </div>
          )}
        </>
      ) : (
        <EmptyState copy='"Your meal log will appear here. Open the body overlay to log your first."' />
      )}

      {nutritionPrompt && (
        <div style={{ marginTop: 14 }}>
          <VerdictCard
            kicker="REFLECTION"
            cacheKey="nutrition"
            prompt={nutritionPrompt}
          />
        </div>
      )}
    </div>
  );
}

function NutritionRow({ m, onRemove }: { m: Meal; onRemove: () => void }) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderLeft: "3px solid var(--ochre)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker">{displayDate(m.date)}</div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            marginTop: 1,
            lineHeight: 1.2,
          }}
        >
          {m.name || "untitled meal"}
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "var(--ink-3)",
            letterSpacing: "0.04em",
            marginTop: 2,
          }}
        >
          C {m.carbs}g · P {m.protein}g · F {m.fat}g
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="fig-num" style={{ fontSize: 18 }}>
          <em>{m.kcal}</em>
        </div>
        <div className="kicker">KCAL</div>
      </div>
      <DeleteX onClick={onRemove} label={`"${m.name || "this meal"}"`} />
    </div>
  );
}

// ───────── FINANCE ─────────
//
// Real, wired to useTransactions. Logged income / expense entries
// with categories and notes. Aggregates: this-month income, expense,
// net, category breakdown, recent list.
//
// What's not here: bank balance, monthly trend chart from
// pre-history, AI-detected "anomalies", "burn-rate vs runway"
// projections. All of those need a bank-API integration (or actual
// historic data the user hasn't logged) — neither exists. The note
// at the top explains why the finance tab only knows what the user
// has manually logged.

// ISO 4217 → display symbol. We use the locale-aware Intl formatter
// for amounts, but the dropdown labels + the standalone "amount · X"
// chrome still want the bare symbol — this map covers the common
// ones we ship in the picker.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  NOK: "kr",
  SEK: "kr",
  DKK: "kr",
  CHF: "CHF",
  CAD: "CA$",
  AUD: "A$",
};

function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

function formatCurrency(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    // Unknown ISO code or environment without Intl currency support.
    return `${currencySymbol(code)}${fmt(amount)}`;
  }
}

const EXPENSE_CATEGORIES = [
  "groceries",
  "rent",
  "transport",
  "eating out",
  "entertainment",
  "health",
  "shopping",
  "bills",
  "travel",
  "other",
];
const INCOME_CATEGORIES = ["salary", "freelance", "gift", "other"];

export function FinanceTab() {
  const { items, add, remove } = useTransactions();
  const { profile } = useProfile();
  const currency = profile.currency || "USD";
  const symbol = currencySymbol(currency);
  const [adding, setAdding] = useState(false);

  // Filter to current calendar month. Transactions store a free-form
  // date but the add form writes ISO, so YYYY-MM prefix matching is
  // safe for anything entered here.
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthItems = items.filter((t) => t.date.startsWith(monthPrefix));
  const totalIn = monthItems
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = monthItems
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const net = totalIn - totalOut;

  // Expense-only category breakdown — that's what people usually
  // want to look at. Income breakdown could come later if useful.
  const byCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of monthItems) {
      if (t.type !== "expense") continue;
      counts[t.category] = (counts[t.category] || 0) + t.amount;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [monthItems]);

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  const financePrompt = useMemo(
    () =>
      monthItems.length === 0
        ? null
        : [
            "You write short, plain reflections about a user. Look at the user's recent spending. Write ONE short sentence (under 18 words) noticing a shape or pattern — no advice, no money talk. Be plain and descriptive — no flourishes.",
            "",
            `${monthLabel()}: ${formatCurrency(totalIn, currency)} in, ${formatCurrency(totalOut, currency)} out, net ${net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(net), currency)}.`,
            `By category: ${byCategory.map(([c, v]) => `${c} ${formatCurrency(v, currency)}`).join("; ")}`,
            "",
            "Your one-sentence observation:",
          ].join("\n"),
    [monthItems.length, totalIn, totalOut, net, byCategory, currency],
  );

  return (
    <div>
      <div
        className="card"
        style={{
          marginBottom: 12,
          padding: 14,
          borderLeft: "3px solid var(--ink-3)",
        }}
      >
        <Kicker>bank connection · not configured</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}
        >
          Balance, automatic categorisation, and full transaction
          history land here once a bank link (Plaid, Tink, GoCardless)
          is connected. Until then this tab only knows what you log
          by hand.
        </div>
      </div>

      {profile.moneyScripts && <MoneyScriptHint scripts={profile.moneyScripts} />}

      <MiniStatRow
        items={[
          { v: formatCurrency(totalIn, currency), l: "IN · MONTH" },
          { v: formatCurrency(totalOut, currency), l: "OUT · MONTH" },
          {
            v: `${net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(net), currency)}`,
            l: "NET",
          },
          { v: monthItems.length, l: "ENTRIES · MO" },
        ]}
      />

      {byCategory.length > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: 14 }}>
          <Kicker>{monthLabel()} · spend by category</Kicker>
          <div style={{ marginTop: 10 }}>
            <HBars
              items={byCategory.map(([c, v]) => ({
                label: c,
                value: v,
                color: "var(--sienna)",
              }))}
            />
          </div>
        </div>
      )}

      <LogButton label="+ log a transaction" onClick={() => setAdding(true)} />

      {sorted.length > 0 ? (
        <>
          <Kicker>your log · most recent first</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 10,
            }}
          >
            {sorted.slice(0, 30).map((t) => (
              <TransactionRow
                key={t.id}
                t={t}
                currency={currency}
                onRemove={() => void remove(t.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState copy='"Log income or an expense — amount, category, an optional note. The monthly totals fill in as you go."' />
      )}

      {financePrompt && (
        <div style={{ marginTop: 14 }}>
          <VerdictCard
            kicker="REFLECTION"
            cacheKey="finance"
            prompt={financePrompt}
          />
        </div>
      )}

      {adding && (
        <AddTransactionFlow
          symbol={symbol}
          onClose={() => setAdding(false)}
          onSave={async (t) => {
            await add(t);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

// MoneyScriptHint — small framing card that adapts the existing
// FinanceTab to the user's dominant money script. Surfaces a
// one-line behavioural read above the per-month spending stats so
// the user sees their own pattern in context.
function MoneyScriptHint({
  scripts,
}: {
  scripts: {
    avoidance: number;
    worship: number;
    status: number;
    vigilance: number;
  };
}) {
  const ranked = (
    [
      ["avoidance", scripts.avoidance],
      ["worship", scripts.worship],
      ["status", scripts.status],
      ["vigilance", scripts.vigilance],
    ] as [string, number][]
  ).sort((a, b) => b[1] - a[1]);
  const dominant = ranked[0]!;
  const blurbs: Record<string, string> = {
    avoidance:
      "Avoidance dominant — you sidestep money decisions. Logging by hand counts as facing them.",
    worship:
      "Worship dominant — more money = more happiness in your script. Watch for upward drift.",
    status:
      "Status dominant — spending reflects who you want to be. Useful, but expensive.",
    vigilance:
      "Vigilance dominant — careful saver, slow to splurge. Don't forget to spend on what matters.",
  };
  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        padding: 12,
        borderLeft: "3px solid var(--ochre)",
      }}
    >
      <Kicker>money script · {dominant[0]}</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 6, fontSize: 12, fontStyle: "italic" }}
      >
        {blurbs[dominant[0]!]}
      </div>
    </div>
  );
}

function TransactionRow({
  t,
  currency,
  onRemove,
}: {
  t: Transaction;
  currency: string;
  onRemove: () => void;
}) {
  const isIncome = t.type === "income";
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderLeft: `3px solid ${isIncome ? "var(--sage)" : "var(--sienna)"}`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 6,
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 16,
          color: isIncome ? "var(--sage)" : "var(--sienna)",
        }}
      >
        {isIncome ? "↑" : "↓"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker">{displayDate(t.date)}</div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            marginTop: 1,
            lineHeight: 1.2,
          }}
        >
          {t.category}
          {t.note ? (
            <span
              style={{
                fontStyle: "italic",
                color: "var(--ink-3)",
                fontSize: 12,
                marginLeft: 6,
              }}
            >
              · {t.note}
            </span>
          ) : null}
        </div>
      </div>
      <div
        style={{
          textAlign: "right",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 16,
          color: isIncome ? "var(--sage)" : "var(--ink)",
        }}
      >
        {isIncome ? "+" : "−"}
        {formatCurrency(t.amount, currency)}
      </div>
      <DeleteX
        onClick={onRemove}
        label={`the ${t.category} ${t.type}`}
      />
    </div>
  );
}

function AddTransactionFlow({
  symbol,
  onClose,
  onSave,
}: {
  symbol: string;
  onClose: () => void;
  onSave: (t: Omit<Transaction, "id">) => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const amt = Number(amount);
  const canSave = Number.isFinite(amt) && amt > 0 && category.trim().length > 0;
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const switchType = (next: TransactionType) => {
    setType(next);
    // Reset category to a valid one for the new type.
    setCategory(
      next === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    );
  };

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        date: isoDateToday(),
        type,
        amount: Math.round(amt * 100) / 100,
        category: category.trim(),
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal title="log a transaction" onClose={onClose}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          borderRadius: 999,
          padding: 3,
        }}
      >
        {(["expense", "income"] as TransactionType[]).map((k) => (
          <button
            key={k}
            onClick={() => switchType(k)}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: type === k ? "var(--paper)" : "transparent",
              boxShadow: type === k ? "var(--shadow-card)" : "none",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 14,
              color: "var(--ink)",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <Kicker>amount · {symbol}</Kicker>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          style={{ ...inputStyle, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Kicker>category</Kicker>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginTop: 6,
          }}
        >
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                cursor: "pointer",
                background: category === c ? "var(--ink)" : "var(--paper-2)",
                color: category === c ? "var(--paper)" : "var(--ink-2)",
                border: "0.5px solid var(--rule)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Kicker>note · optional</Kicker>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="what was it for?"
          style={{ ...serifInputStyle, marginTop: 6 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: "12px",
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 999,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSave || saving}
          style={{
            flex: 1,
            padding: "12px",
            background: canSave ? "var(--ink)" : "var(--paper-3)",
            color: canSave ? "var(--paper)" : "var(--ink-3)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            cursor: canSave ? "pointer" : "default",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "saving…" : "save"}
        </button>
      </div>
    </FormModal>
  );
}
