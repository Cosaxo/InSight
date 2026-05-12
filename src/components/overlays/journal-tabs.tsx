import type { ReactNode } from "react";
import { IS_DATA } from "../../data/seedData";
import { Kicker, Bar } from "../shared/primitives";
import {
  ClockDial,
  Donut,
  DowStripes,
  DivergeRow,
  EatingWindow,
  HBars,
  LoadCurves,
  MicroBars,
  Scatter,
  Sparkline,
  StackedBars,
} from "../shared/charts";

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

export function HabitsTab() {
  const I = IS_DATA.insights;
  const H = IS_DATA.habitsDeep;
  const totalDone = I.habits.filter((h: { done: boolean }) => h.done).length;
  const habitNames = Object.keys(H.thirtyDay);
  const allDays = habitNames.flatMap((n) => H.thirtyDay[n] as number[]);
  const overall = Math.round(
    (allDays.filter((v) => v).length / allDays.length) * 100,
  );

  return (
    <div>
      <StatRow
        items={[
          { v: `${totalDone}/${I.habits.length}`, l: "TODAY" },
          { v: `${overall}%`, l: "30-DAY · ALL" },
          { v: "21", l: "LONGEST · NOW" },
          { v: "84", l: "LONGEST · EVER" },
        ]}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Today</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 10,
          }}
        >
          {I.habits.map(
            (h: {
              name: string;
              hue: number;
              done: boolean;
              streak: number;
              week: number[];
            }) => (
              <div
                key={h.name}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: `1.5px solid oklch(0.55 0.12 ${h.hue})`,
                    background: h.done
                      ? `oklch(0.55 0.12 ${h.hue})`
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--paper)",
                    fontFamily: "var(--serif)",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {h.done ? "✓" : ""}
                </div>
                <div style={{ flex: 1 }}>
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
                    {h.streak}d streak · best{" "}
                    {H.longestStreaks[h.name]?.best || "—"}d
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  {h.week.map((d, i) => (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: 14,
                        borderRadius: 1,
                        background: d
                          ? `oklch(0.55 0.12 ${h.hue})`
                          : "var(--rule)",
                        opacity: d ? 1 : 0.5,
                      }}
                    />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

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
          {habitNames.map((n) => {
            const arr: number[] = H.thirtyDay[n];
            const done = arr.filter((v) => v).length;
            const habit = I.habits.find((h: { name: string }) => h.name === n);
            const hue = habit?.hue || 38;
            return (
              <div key={n}>
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
                    {n}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      color: "var(--ink-3)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {done}/30 · {Math.round((done / 30) * 100)}%
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(30, 1fr)",
                    gap: 2,
                  }}
                >
                  {arr.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        aspectRatio: "1",
                        background: d
                          ? `oklch(0.55 0.13 ${hue})`
                          : "var(--rule)",
                        opacity: d ? 0.85 : 0.35,
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Best & worst days · % completion</Kicker>
        <div style={{ marginTop: 12 }}>
          <DowStripes
            rows={habitNames.map((n) => ({
              label: n,
              vals: H.byDow[n] as number[],
            }))}
            color="var(--sienna)"
          />
        </div>
        <div className="margin-note" style={{ marginTop: 8 }}>
          Saturdays carry most of your week. Mondays the least.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Time of day · when each habit happens</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 12,
          }}
        >
          {habitNames.map((n) => {
            const habit = I.habits.find(
              (h: { name: string }) => h.name === n,
            );
            const hue = habit?.hue || 38;
            const arr: number[] = H.timeOfDay[n];
            const max = Math.max(...arr);
            return (
              <div key={n}>
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
                      fontSize: 12,
                      fontStyle: "italic",
                    }}
                  >
                    {n}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 8.5,
                      color: "var(--ink-3)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    peak {String(arr.indexOf(max)).padStart(2, "0")}:00
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 1,
                    height: 28,
                    background: "var(--paper-2)",
                    padding: "0 4px",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 2,
                  }}
                >
                  {arr.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${v * 100}%`,
                        background: `oklch(0.55 0.13 ${hue})`,
                        opacity: 0.4 + v * 0.6,
                        borderRadius: "1px 1px 0 0",
                        minHeight: 1,
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--mono)",
                    fontSize: 7.5,
                    color: "var(--ink-3)",
                    letterSpacing: "0.06em",
                    marginTop: 1,
                  }}
                >
                  <span>00</span>
                  <span>06</span>
                  <span>12</span>
                  <span>18</span>
                  <span>24</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>How habits move with your day</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 12,
          }}
        >
          {H.correl.map(
            (
              c: {
                habit: string;
                hue: number;
                mood: number;
                sleep: number;
                energy: number;
              },
              i: number,
            ) => (
              <div key={i}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: `oklch(0.55 0.13 ${c.hue})`,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 13,
                      fontStyle: "italic",
                    }}
                  >
                    {c.habit}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <DivergeRow
                    value={c.mood}
                    label="mood"
                    color="var(--sage)"
                    negColor="var(--sienna)"
                  />
                  <DivergeRow
                    value={c.sleep}
                    label="sleep"
                    color="var(--indigo)"
                    negColor="var(--sienna)"
                  />
                  <DivergeRow
                    value={c.energy}
                    label="energy"
                    color="var(--ochre)"
                    negColor="var(--sienna)"
                  />
                </div>
              </div>
            ),
          )}
        </div>
        <div className="margin-note" style={{ marginTop: 8 }}>
          +100 = strongly together · 0 = unrelated · −100 = inversely.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Weekly completion · 12 weeks</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 12,
          }}
        >
          {habitNames.map((n) => {
            const habit = I.habits.find(
              (h: { name: string }) => h.name === n,
            );
            const hue = habit?.hue || 38;
            const trend = H.trend12w[n] as number[];
            return (
              <div key={n}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 12,
                      fontStyle: "italic",
                    }}
                  >
                    {n}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      color: "var(--ink-3)",
                    }}
                  >
                    {trend[trend.length - 1]}%
                  </span>
                </div>
                <Sparkline
                  data={trend}
                  w={320}
                  h={26}
                  color={`oklch(0.55 0.13 ${hue})`}
                  fill
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <Kicker>What we noticed</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 10,
          }}
        >
          {H.insights.map(
            (
              it: { icon: string; title: string; body: string },
              i: number,
            ) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 10,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 18,
                    color: "var(--sienna)",
                  }}
                >
                  {it.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {it.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 12,
                      color: "var(--ink-2)",
                      fontStyle: "italic",
                      marginTop: 2,
                      lineHeight: 1.5,
                    }}
                  >
                    {it.body}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
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

      <div className="card" style={{ borderLeft: "3px solid var(--ochre)" }}>
        <Kicker>The week, in one breath</Kicker>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            fontStyle: "italic",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          "{N.verdict}"
        </div>
      </div>
    </div>
  );
}

// ───────── FINANCE ─────────

export function FinanceTab() {
  const F = IS_DATA.financeAI;
  const I = IS_DATA.insights;

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

      <div
        className="card"
        style={{ marginBottom: 12, borderLeft: "3px solid var(--sienna)" }}
      >
        <Kicker>The verdict · in one sentence</Kicker>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 16,
            fontStyle: "italic",
            marginTop: 8,
            lineHeight: 1.5,
            color: "var(--ink)",
          }}
        >
          "{F.verdict}"
        </div>
      </div>

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
