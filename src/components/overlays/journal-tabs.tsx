import { useState, type ReactNode } from "react";
import { IS_DATA } from "../../data/seedData";
import { VerdictCard } from "../shared/VerdictCard";
import { useMoods } from "../../lib/useMoods";
import { Kicker, Bar } from "../shared/primitives";
import {
  ClockDial,
  Donut,
  EatingWindow,
  HBars,
  LoadCurves,
  MicroBars,
  Scatter,
  Sparkline,
  StackedBars,
} from "../shared/charts";
import { useHabits } from "../../lib/useHabits";

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

interface FlagChipProps {
  kind: "good" | "warm" | "low" | "watch" | "neutral";
  children: ReactNode;
}
function FlagChip({ kind, children }: FlagChipProps) {
  const palette = {
    good: { bg: "oklch(0.93 0.05 145)", fg: "oklch(0.40 0.10 145)", mark: "↗" },
    warm: { bg: "oklch(0.93 0.06 38)", fg: "oklch(0.42 0.12 38)", mark: "◐" },
    low: { bg: "oklch(0.93 0.05 60)", fg: "oklch(0.40 0.12 60)", mark: "↘" },
    watch: { bg: "oklch(0.93 0.05 80)", fg: "oklch(0.40 0.10 80)", mark: "◑" },
    neutral: { bg: "var(--paper-2)", fg: "var(--ink-2)", mark: "·" },
  }[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        background: palette.bg,
        color: palette.fg,
        borderRadius: 4,
        fontFamily: "var(--mono)",
        fontSize: 9,
        letterSpacing: "0.08em",
      }}
    >
      <span>{palette.mark}</span>
      {children}
    </span>
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
    "You are a quiet journal companion. Look at the user's habits today and their recent moods. Write ONE short sentence (under 18 words) noticing a small pattern or contrast — no advice, no cheer, no questions. Observational, slightly literary.",
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
          kicker="WHAT WE NOTICED"
          cacheKey="habits"
          prompt={habitsPrompt}
        />
      )}
    </div>
  );
}

// ───────── FITNESS ─────────

export function FitnessTab() {
  const I = IS_DATA.insights;
  const F = IS_DATA.fitnessDeep;
  const stepsPct = Math.round((I.fitness.steps / I.fitness.target) * 100);

  return (
    <div>
      <StatRow
        items={[
          { v: I.fitness.steps.toLocaleString(), l: "STEPS" },
          { v: I.fitness.runs, l: "RUNS · WK" },
          { v: I.fitness.swims, l: "SWIMS · WK" },
          { v: F.vo2Trend[F.vo2Trend.length - 1], l: "VO₂ MAX" },
        ]}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>This week</Kicker>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 12,
          }}
        >
          <Donut value={stepsPct} color="var(--sage)" label="STEPS" size={84} />
          <div style={{ flex: 1 }}>
            <div className="fig-num">
              <em>{I.fitness.steps.toLocaleString()}</em>
            </div>
            <div className="kicker">of {I.fitness.target.toLocaleString()}</div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--ink-2)",
                marginTop: 6,
              }}
            >
              23.1 km run · 2.4 km swum · 2 strength
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Heart-rate zones · last 7 days</Kicker>
        <div
          style={{
            display: "flex",
            height: 18,
            borderRadius: 2,
            overflow: "hidden",
            marginTop: 10,
            border: "0.5px solid var(--rule)",
          }}
        >
          {F.zoneDist.map(
            (
              z: { z: string; label: string; pct: number; color: string },
              i: number,
            ) => (
              <div
                key={i}
                style={{
                  flex: z.pct,
                  background: z.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 8,
                  color: "var(--paper)",
                  letterSpacing: "0.06em",
                }}
              >
                {z.pct >= 8 ? z.z : ""}
              </div>
            ),
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 6,
            marginTop: 8,
            fontFamily: "var(--mono)",
            fontSize: 8.5,
            color: "var(--ink-3)",
            letterSpacing: "0.05em",
            textAlign: "center",
          }}
        >
          {F.zoneDist.map(
            (
              z: { z: string; label: string; pct: number; color: string },
              i: number,
            ) => (
              <div key={i}>
                <div style={{ color: z.color, fontWeight: 600 }}>{z.z}</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 10,
                    color: "var(--ink-2)",
                  }}
                >
                  {z.label}
                </div>
                <div>{z.pct}%</div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Training load · 28 days</Kicker>
        <div style={{ marginTop: 8 }}>
          <LoadCurves
            ctl={F.ctl}
            atl={F.atl}
            load={F.load28}
            w={320}
            h={120}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            marginTop: 4,
            fontFamily: "var(--mono)",
            fontSize: 8.5,
            color: "var(--ink-3)",
            letterSpacing: "0.06em",
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 1.6,
                background: "var(--sage)",
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            FITNESS · CTL
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 1.6,
                background: "var(--sienna)",
                marginRight: 4,
                verticalAlign: "middle",
                borderTop: "1.4px dashed var(--sienna)",
              }}
            />
            FATIGUE · ATL
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 8,
                background: "var(--ink-3)",
                opacity: 0.4,
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            DAILY
          </span>
        </div>
        <div className="margin-note" style={{ marginTop: 8 }}>
          {F.loadVerdict?.body}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Run pace · last 14 runs (sec/km, lower = faster)</Kicker>
        <div style={{ marginTop: 8 }}>
          <Sparkline
            data={F.paceTrend.map((p: number) => -p)}
            w={320}
            h={56}
            color="var(--sage)"
            fill
            dots
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            letterSpacing: "0.06em",
            marginTop: 4,
          }}
        >
          <span>5:40 / km</span>
          <span style={{ color: "oklch(0.45 0.12 145)" }}>
            ↘ getting faster
          </span>
          <span>5:02 / km</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>VO₂ max · 8 weeks</Kicker>
        <div style={{ marginTop: 8 }}>
          <Sparkline
            data={F.vo2Trend}
            w={320}
            h={48}
            color="var(--indigo)"
            fill
            dots
          />
        </div>
        <div className="margin-note" style={{ marginTop: 6 }}>
          From 44.5 to 48 — top quartile for your age. The long Saturday runs
          are doing their work.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Distance · 8 weeks</Kicker>
        <div style={{ marginTop: 12 }}>
          <StackedBars
            rows={F.weekly.labels.map((lab: string, i: number) => ({
              label: lab,
              vals: {
                run: F.weekly.runDist[i] as number,
                swim: (F.weekly.swimDist[i] as number) * 4,
              },
            }))}
            segments={[
              { key: "run", color: "var(--sage)", label: "Run" },
              { key: "swim", color: "var(--indigo)", label: "Swim ×4" },
            ]}
            h={110}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Where the minutes go</Kicker>
        <div
          style={{
            display: "flex",
            height: 14,
            borderRadius: 2,
            overflow: "hidden",
            marginTop: 10,
            border: "0.5px solid var(--rule)",
          }}
        >
          {F.sportShare.map(
            (s: { sport: string; pct: number; hue: number }, i: number) => (
              <div
                key={i}
                style={{
                  flex: s.pct,
                  background: `oklch(0.62 0.13 ${s.hue})`,
                }}
              />
            ),
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          {F.sportShare.map(
            (s: { sport: string; pct: number; hue: number }, i: number) => (
              <div
                key={i}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.06em",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: `oklch(0.62 0.13 ${s.hue})`,
                    marginRight: 4,
                  }}
                />
                {s.sport.toUpperCase()} · {s.pct}%
              </div>
            ),
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Recovery · load vs next-day HRV</Kicker>
        <div style={{ marginTop: 8 }}>
          <Scatter
            points={F.recoveryScatter.map(
              (p: { load: number; hrv: number; d: string }) => ({
                x: p.load,
                y: p.hrv,
                label: p.d,
              }),
            )}
            xLabel={["easy", "hard"]}
            yLabel={["HRV down", "HRV up"]}
            xMax={100}
            yMin={-12}
            yMax={12}
            accent="var(--sage)"
          />
        </div>
        <div className="margin-note" style={{ marginTop: 4 }}>
          Hard sessions cost you the next morning. Easy ones return it twice.
        </div>
      </div>

      <div className="card">
        <Kicker>Personal bests</Kicker>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
            gap: 8,
            marginTop: 10,
          }}
        >
          {F.prs.map(
            (
              pr: { name: string; val: string; date: string; trend: number },
              i: number,
            ) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 4,
                }}
              >
                <div className="kicker">{pr.name.toUpperCase()}</div>
                <div
                  className="fig-num"
                  style={{ fontSize: 18, marginTop: 2 }}
                >
                  <em>{pr.val}</em>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 8.5,
                      color: "var(--ink-3)",
                    }}
                  >
                    {pr.date}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      color:
                        pr.trend < 0
                          ? "oklch(0.45 0.12 145)"
                          : "var(--sienna)",
                    }}
                  >
                    {pr.trend < 0 ? "↘" : "↗"} {pr.trend > 0 ? "+" : ""}
                    {pr.trend}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// ───────── NUTRITION ─────────

export function NutritionTab() {
  const I = IS_DATA.insights;
  const N = IS_DATA.nutritionDeep;
  const todayPct = Math.round((I.nutrition.kcal / I.nutrition.target) * 100);
  const waterPct = Math.round(
    (I.nutrition.water / I.nutrition.target_water) * 100,
  );

  const nutritionPrompt = [
    "You are a quiet journal companion. Look at the user's recent eating pattern. Write ONE short sentence (under 18 words) noticing a shape or pattern — no advice, no cheer, no diet talk. Observational, slightly literary.",
    "",
    `Today: ${I.nutrition.kcal} kcal of ${I.nutrition.target} target; ${I.nutrition.water} of ${I.nutrition.target_water} water glasses.`,
    `Week macros (g per day, carbs/protein/fat): ${N.weekMacros
      .map(
        (d: { d: string; carbs: number; protein: number; fat: number }) =>
          `${d.d} ${d.carbs}/${d.protein}/${d.fat}`,
      )
      .join("; ")}`,
    `Eating windows: ${N.eatingWindow
      .map((r: { d: string; start: number; end: number }) => `${r.d} ${r.start}:00–${r.end}:00`)
      .join("; ")}`,
    `Flags: ${N.flags
      .map((f: { label: string; kind: string }) => `${f.label} (${f.kind})`)
      .join("; ")}`,
    "",
    "Your one-sentence observation:",
  ].join("\n");

  return (
    <div>
      <StatRow
        items={[
          { v: I.nutrition.kcal, l: "KCAL TODAY" },
          {
            v: `${I.nutrition.water}/${I.nutrition.target_water}`,
            l: "WATER · GLASSES",
          },
          { v: "11.5h", l: "EATING WINDOW" },
          { v: "4", l: "MEALS" },
        ]}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Today's table</Kicker>
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 12,
            alignItems: "center",
            justifyContent: "space-around",
          }}
        >
          <Donut value={todayPct} color="var(--ochre)" label="KCAL" size={72} />
          <Donut
            value={waterPct}
            color="var(--indigo)"
            label="WATER"
            size={72}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {[
              { k: "Carbs", v: 48, c: "var(--ochre)" },
              { k: "Protein", v: 28, c: "var(--sienna)" },
              { k: "Fat", v: 24, c: "var(--sage)" },
            ].map((m) => (
              <div key={m.k}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: "var(--ink-3)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 11,
                      color: "var(--ink-2)",
                    }}
                  >
                    {m.k}
                  </span>
                  <span>{m.v}%</span>
                </div>
                <div className="bar" style={{ marginTop: 2 }}>
                  <i style={{ width: `${m.v * 2}%`, background: m.c }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Meal clock · today</Kicker>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ClockDial
            markers={N.mealClock}
            waterByHour={N.waterByHour}
            size={220}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            letterSpacing: "0.06em",
            marginTop: 6,
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "var(--ochre)",
                marginRight: 4,
              }}
            />
            MEALS
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "var(--indigo)",
                marginRight: 4,
              }}
            />
            WATER
          </span>
        </div>
        <div className="margin-note" style={{ marginTop: 6 }}>
          11.5 hour eating window — your body has 12.5 hours to file the day
          away.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Macros · this week (g)</Kicker>
        <div style={{ marginTop: 12 }}>
          <StackedBars
            rows={N.weekMacros.map(
              (d: {
                d: string;
                carbs: number;
                protein: number;
                fat: number;
              }) => ({
                label: d.d,
                vals: { carbs: d.carbs, protein: d.protein, fat: d.fat },
              }),
            )}
            segments={[
              { key: "carbs", color: "var(--ochre)", label: "Carbs" },
              { key: "protein", color: "var(--sienna)", label: "Protein" },
              { key: "fat", color: "var(--sage)", label: "Fat" },
            ]}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            marginTop: 4,
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            letterSpacing: "0.08em",
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: "var(--ochre)",
                marginRight: 5,
              }}
            />
            CARBS
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: "var(--sienna)",
                marginRight: 5,
              }}
            />
            PROTEIN
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: "var(--sage)",
                marginRight: 5,
              }}
            />
            FAT
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Micronutrients · vs target</Kicker>
        <div style={{ marginTop: 10 }}>
          <MicroBars items={N.micronutrients} />
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 8.5,
            color: "var(--ink-3)",
            letterSpacing: "0.08em",
            marginTop: 8,
            textAlign: "right",
          }}
        >
          MIDLINE = 100% RDA · MAX SHOWN = 200%
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Food groups · weekly servings</Kicker>
        <div style={{ marginTop: 10 }}>
          <HBars
            items={N.foodGroups.map(
              (g: { group: string; pct: number; hue: number }) => ({
                label: g.group,
                value: g.pct,
                color: `oklch(0.62 0.13 ${g.hue})`,
              }),
            )}
            max={100}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Eating window · last 14 days</Kicker>
        <div style={{ marginTop: 10 }}>
          <EatingWindow rows={N.eatingWindow} />
        </div>
        <div className="margin-note" style={{ marginTop: 8 }}>
          Friday and Saturday creep past 22:00. The fasting window collapses by
          ~3 hours on weekends.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Streaks · gentle ones</Kicker>
        <div
          style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}
        >
          {N.streaks.map(
            (s: { d: number; label: string }, i: number) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: 92,
                  padding: 10,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 4,
                  textAlign: "center",
                }}
              >
                <div className="fig-num" style={{ fontSize: 22 }}>
                  <em>{s.d}</em>
                </div>
                <div className="kicker">DAYS</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 11,
                    fontStyle: "italic",
                    color: "var(--ink-2)",
                    marginTop: 4,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Flags · what to watch</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 10,
          }}
        >
          {N.flags.map(
            (
              f: {
                kind: FlagChipProps["kind"];
                label: string;
                note: string;
              },
              i: number,
            ) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <FlagChip kind={f.kind}>{f.kind.toUpperCase()}</FlagChip>
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 12.5,
                      fontWeight: 500,
                    }}
                  >
                    {f.label}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 11.5,
                    fontStyle: "italic",
                    color: "var(--ink-2)",
                    lineHeight: 1.5,
                  }}
                >
                  {f.note}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <VerdictCard
        kicker="THE WEEK, IN ONE BREATH"
        cacheKey="nutrition"
        prompt={nutritionPrompt}
      />
    </div>
  );
}

// ───────── FINANCE ─────────

export function FinanceTab() {
  const F = IS_DATA.financeAI;
  const I = IS_DATA.insights;

  const financePrompt = [
    "You are a quiet journal companion. Look at the user's recent spending. Write ONE short sentence (under 18 words) noticing a shape or pattern — no advice, no judgement, no money talk. Observational, slightly literary.",
    "",
    `This month: ${I.finance.currency}${I.finance.spent} of ${I.finance.budget} budget; net +${F.net}.`,
    `By category: ${F.byCategory
      .map(
        (c: { cat: string; amt: number; trend: number }) =>
          `${c.cat} €${c.amt}${c.trend ? ` (${c.trend > 0 ? "+" : ""}${c.trend}%)` : ""}`,
      )
      .join("; ")}`,
    F.anomalies.length
      ? `Anomalies: ${F.anomalies
          .map(
            (a: { merchant: string; amt: number; note: string }) =>
              `${a.merchant} €${a.amt} — ${a.note}`,
          )
          .join("; ")}`
      : "",
    "",
    "Your one-sentence observation:",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Ledger · this month</Kicker>
        <div className="fig-num" style={{ marginTop: 8 }}>
          {I.finance.currency}
          <em>{I.finance.spent}</em>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 14,
              color: "var(--ink-3)",
              marginLeft: 8,
            }}
          >
            / {I.finance.budget}
          </span>
        </div>
        <Bar
          value={I.finance.spent}
          max={I.finance.budget}
          color="var(--sienna)"
        />
        <div className="margin-note" style={{ marginTop: 14 }}>
          Top: {I.finance.topCat} €
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Daily spend · two weeks</Kicker>
        <div style={{ marginTop: 8 }}>
          <Sparkline
            data={I.sparkSpend}
            w={320}
            h={60}
            color="var(--sienna)"
            fill
            dots
          />
        </div>
      </div>

      <VerdictCard
        kicker="THE VERDICT · IN ONE SENTENCE"
        cacheKey="finance"
        prompt={financePrompt}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Statement summary</Kicker>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginTop: 12,
          }}
        >
          <div>
            <div className="kicker">IN</div>
            <div
              className="fig-num"
              style={{ fontSize: 19, color: "oklch(0.45 0.10 145)" }}
            >
              <em>€{F.totalIn.toLocaleString()}</em>
            </div>
          </div>
          <div>
            <div className="kicker">OUT</div>
            <div
              className="fig-num"
              style={{ fontSize: 19, color: "var(--sienna)" }}
            >
              <em>€{F.totalOut.toLocaleString()}</em>
            </div>
          </div>
          <div>
            <div className="kicker">NET</div>
            <div className="fig-num" style={{ fontSize: 19 }}>
              <em>+€{F.net.toLocaleString()}</em>
            </div>
          </div>
        </div>
        <div className="kicker" style={{ marginTop: 8 }}>
          {F.bank.toUpperCase()} · {F.period.toUpperCase()} · {F.txCount} TX
        </div>
      </div>

      <div className="card">
        <Kicker>By category</Kicker>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {F.byCategory.map(
            (
              c: {
                cat: string;
                amt: number;
                pct: number;
                trend: number;
                glyph: string;
                color: string;
              },
              i: number,
            ) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "14px 1fr 56px 36px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    color: c.color,
                    fontSize: 14,
                    textAlign: "center",
                  }}
                >
                  {c.glyph}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 12.5,
                      fontStyle: "italic",
                    }}
                  >
                    {c.cat}
                  </div>
                  <div className="bar" style={{ marginTop: 3 }}>
                    <i
                      style={{
                        width: `${c.pct * 2}%`,
                        background: c.color,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    textAlign: "right",
                  }}
                >
                  €{c.amt}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.05em",
                    textAlign: "right",
                    color:
                      c.trend > 5
                        ? "oklch(0.50 0.16 38)"
                        : c.trend < -3
                          ? "oklch(0.45 0.12 145)"
                          : "var(--ink-3)",
                  }}
                >
                  {c.trend > 0 ? "+" : ""}
                  {c.trend === 0 ? "·" : c.trend + "%"}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
