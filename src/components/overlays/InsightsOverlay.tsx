import { useMemo, useState } from "react";
import { IS_DATA } from "../../data/seedData";
import { Kicker, Pill } from "../shared/primitives";
import { DotGrid, Histogram, Sparkline } from "../shared/charts";
import { useMoods } from "../../lib/useMoods";
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

export function InsightsOverlay({ onClose }: InsightsOverlayProps) {
  const I = IS_DATA.insights;
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const [tab, setTab] = useState<InsightsTabId>("mood");
  const { moods: userMoods } = useMoods();

  // Overlay the most recent user-logged moods onto the seed 30-day
  // window. Most recent at index N-1 (the right edge of the
  // sparkline) is today; we sort the user moods by date and overwrite
  // the trailing slots so the chart reflects real recent entries.
  const moodMonth: number[] = useMemo(() => {
    if (!userMoods.length) return I.moodMonth as number[];
    const seed = [...(I.moodMonth as number[])];
    const sorted = [...userMoods].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const recent = sorted.slice(-seed.length);
    const startIdx = seed.length - recent.length;
    recent.forEach((m, i) => {
      seed[startIdx + i] = m.score;
    });
    return seed;
  }, [I.moodMonth, userMoods]);

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>journal</em>
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
                  <em>
                    {(
                      moodMonth.reduce((s, v) => s + v, 0) /
                      moodMonth.length
                    ).toFixed(1)}
                  </em>
                </div>
                <div className="kicker">30-DAY AVG</div>
              </div>
              <div>
                <div className="fig-num">
                  <em>{Math.max(...moodMonth)}</em>
                </div>
                <div className="kicker">HIGH</div>
              </div>
              <div>
                <div className="fig-num">
                  <em>{Math.min(...moodMonth)}</em>
                </div>
                <div className="kicker">LOW</div>
              </div>
              <div>
                <div className="fig-num">
                  <em>
                    {Math.round(
                      (moodMonth.filter((v) => v >= 4).length /
                        moodMonth.length) *
                        100,
                    )}
                    %
                  </em>
                </div>
                <div className="kicker">BRIGHT DAYS</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <Kicker>Mood distribution · 30 days</Kicker>
              <div style={{ marginTop: 10 }}>
                <Histogram
                  counts={IS_DATA.moodDist}
                  labels={["blue", "dim", "steady", "bright", "radiant"]}
                  color="var(--accent)"
                />
              </div>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <Kicker>This week's weather</Kicker>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 12,
                  alignItems: "flex-end",
                  height: 100,
                }}
              >
                {I.moodWeek.map((v: number, i: number) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        height: v * 18,
                        background: `oklch(0.55 0.13 ${30 + v * 30})`,
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
              <div className="margin-note" style={{ marginTop: 14 }}>
                Thursday was your brightest. The fjord was glass.
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
                <span>APR 7</span>
                <span>MAY 7</span>
              </div>
            </div>

            <div className="card">
              <Kicker>The journal · last six months</Kicker>
              <div style={{ marginTop: 10 }}>
                <DotGrid
                  rows={7}
                  cols={26}
                  intensities={I.yearGrid}
                  color="var(--sienna)"
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
                  marginTop: 6,
                }}
              >
                <span>NOV</span>
                <span>JAN</span>
                <span>MAR</span>
                <span>MAY</span>
              </div>
            </div>
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
