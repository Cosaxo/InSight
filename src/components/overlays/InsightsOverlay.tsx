import { useMemo, useState } from "react";
import { Kicker, Pill } from "../shared/primitives";
import { DotGrid, Histogram, Sparkline } from "../shared/charts";
import { useMoods, isoDateToday } from "../../lib/useMoods";
import {
  FinanceTab,
  FitnessTab,
  HabitsTab,
  NutritionTab,
} from "./journal-tabs";

type InsightsTabId = "mood" | "habits" | "fitness" | "nutrition" | "finance";

interface InsightsOverlayProps {
  onClose: () => void;
}

// ISO date offset days before today.
function isoDaysBefore(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Day-of-week abbreviation, 0=Sun..6=Sat → mon-first label.
function dowMonFirst(iso: string): number {
  const d = new Date(iso);
  return (d.getDay() + 6) % 7;
}

export function InsightsOverlay({ onClose }: InsightsOverlayProps) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const [tab, setTab] = useState<InsightsTabId>("mood");
  const { moods: userMoods } = useMoods();

  // 30-day mood window, real entries only. Each slot is the score
  // logged for that date or -1 if no entry. Stats compute from the
  // logged entries only — averages, max, min ignore the gaps.
  const moodWindow = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const m of userMoods) byDate.set(m.date, m.score);
    const today = isoDateToday();
    return Array.from({ length: 30 }, (_, i) => {
      const iso = i === 29 ? today : isoDaysBefore(29 - i);
      const score = byDate.get(iso);
      return { iso, score: score ?? -1 };
    });
  }, [userMoods]);
  const logged = moodWindow.filter((w) => w.score > 0).map((w) => w.score);

  // 7-day mood-by-DoW summary. We average all entries falling on the
  // same weekday within the last 7 actual days, so each bar reflects
  // real recent days, not a static seed weekday template.
  const weekBars = useMemo(() => {
    const buckets: { sum: number; n: number }[] = Array.from(
      { length: 7 },
      () => ({ sum: 0, n: 0 }),
    );
    moodWindow.slice(-7).forEach((w) => {
      if (w.score <= 0) return;
      const idx = dowMonFirst(w.iso);
      buckets[idx].sum += w.score;
      buckets[idx].n += 1;
    });
    return buckets.map((b) => (b.n ? b.sum / b.n : 0));
  }, [moodWindow]);

  // 26-week × 7-day grid for the "six months" dot grid. We compute
  // it from real moods so unlogged days draw at zero intensity. Each
  // cell value is the score / 5 normalized to 0..1.
  const yearGrid = useMemo(() => {
    const cellsToShow = 26 * 7;
    const byDate = new Map<string, number>();
    for (const m of userMoods) byDate.set(m.date, m.score);
    const intensities: number[] = [];
    // Oldest cell on the left; today on the right.
    for (let i = cellsToShow - 1; i >= 0; i--) {
      const iso = isoDaysBefore(i);
      const s = byDate.get(iso);
      intensities.push(s ? s / 5 : 0);
    }
    // The DotGrid renders by rows (7) × cols (26); intensities must
    // be in row-major order. Our array is day-major (cell N is N
    // days back). Transpose into row-major where row=dow(0..6),
    // col=week index.
    const grid: number[] = new Array(cellsToShow).fill(0);
    intensities.forEach((v, day) => {
      const iso = isoDaysBefore(cellsToShow - 1 - day);
      const row = dowMonFirst(iso);
      const col = Math.floor(day / 7);
      grid[row * 26 + col] = v;
    });
    return grid;
  }, [userMoods]);

  // 5-bucket histogram: count of entries at each score 1..5 across
  // the 30-day window. Real entries only.
  const moodDist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const w of moodWindow) {
      if (w.score >= 1 && w.score <= 5) counts[w.score - 1] += 1;
    }
    return counts;
  }, [moodWindow]);

  const avg = logged.length
    ? (logged.reduce((s, v) => s + v, 0) / logged.length).toFixed(1)
    : "—";
  const high = logged.length ? Math.max(...logged) : "—";
  const low = logged.length ? Math.min(...logged) : "—";
  const brightPct = logged.length
    ? Math.round((logged.filter((v) => v >= 4).length / logged.length) * 100)
    : 0;
  const moodMonth = moodWindow.map((w) => (w.score > 0 ? w.score : 0));

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          <em>Journal</em>
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body">
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {(["mood", "habits", "fitness", "nutrition", "finance"] as const).map(
            (k) => (
              <Pill key={k} active={tab === k} onClick={() => setTab(k)}>
                {k}
              </Pill>
            ),
          )}
        </div>

        {tab === "mood" && (
          <div>
            {logged.length === 0 ? (
              <div
                className="card"
                style={{ padding: 22, textAlign: "center" }}
              >
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
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 16,
                    marginTop: 8,
                  }}
                >
                  no moods logged yet.
                </div>
                <div
                  className="margin-note"
                  style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}
                >
                  "Tap '◉ daily report' on the floating + menu. The
                  charts and the 30-day curve fill in as you log."
                </div>
              </div>
            ) : (
              <>
                <div
                  className="card"
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    justifyContent: "space-around",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div className="fig-num">
                      <em>{avg}</em>
                    </div>
                    <div className="kicker">30-DAY AVG</div>
                  </div>
                  <div>
                    <div className="fig-num">
                      <em>{high}</em>
                    </div>
                    <div className="kicker">HIGH</div>
                  </div>
                  <div>
                    <div className="fig-num">
                      <em>{low}</em>
                    </div>
                    <div className="kicker">LOW</div>
                  </div>
                  <div>
                    <div className="fig-num">
                      <em>{brightPct}%</em>
                    </div>
                    <div className="kicker">BRIGHT DAYS</div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 12 }}>
                  <Kicker>Mood distribution · 30 days</Kicker>
                  <div style={{ marginTop: 10 }}>
                    <Histogram
                      counts={moodDist}
                      labels={["blue", "dim", "steady", "bright", "radiant"]}
                      color="var(--accent)"
                    />
                  </div>
                  <div
                    className="margin-note"
                    style={{ marginTop: 8, fontSize: 11 }}
                  >
                    {logged.length} of last 30 days logged.
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 12 }}>
                  <Kicker>This week · by day-of-week</Kicker>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 12,
                      alignItems: "flex-end",
                      height: 100,
                    }}
                  >
                    {weekBars.map((v: number, i: number) => (
                      <div key={i} style={{ flex: 1, textAlign: "center" }}>
                        <div
                          title={v ? `avg ${v.toFixed(1)}/5` : "no entry"}
                          style={{
                            height: v ? v * 18 : 2,
                            background: v
                              ? `oklch(0.55 0.13 ${30 + v * 30})`
                              : "var(--rule)",
                            opacity: v ? 1 : 0.5,
                            borderRadius: 2,
                            marginBottom: 4,
                          }}
                        />
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 9,
                            color: "var(--ink-3)",
                          }}
                        >
                          {days[i]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 12 }}>
                  <Kicker>30-day curve</Kicker>
                  <div style={{ marginTop: 8 }}>
                    <Sparkline
                      data={moodMonth}
                      w={320}
                      h={70}
                      color="var(--sienna)"
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
                      letterSpacing: "0.08em",
                      marginTop: 4,
                    }}
                  >
                    <span>{moodWindow[0].iso.slice(5).replace("-", "/")}</span>
                    <span>{moodWindow[moodWindow.length - 1].iso.slice(5).replace("-", "/")}</span>
                  </div>
                </div>

                <div className="card">
                  <Kicker>The journal · last six months</Kicker>
                  <div style={{ marginTop: 10 }}>
                    <DotGrid
                      rows={7}
                      cols={26}
                      intensities={yearGrid}
                      color="var(--sienna)"
                    />
                  </div>
                  <div
                    className="margin-note"
                    style={{ marginTop: 8, fontSize: 11 }}
                  >
                    each dot is one day · brighter = higher mood
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "habits" && <HabitsTab />}
        {tab === "fitness" && <FitnessTab />}
        {tab === "nutrition" && <NutritionTab />}
        {tab === "finance" && <FinanceTab />}
      </div>
    </div>
  );
}
