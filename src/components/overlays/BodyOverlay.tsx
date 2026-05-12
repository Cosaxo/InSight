import { useState } from "react";
import { IS_DATA } from "../../data/seedData";
import { Kicker, Pill } from "../shared/primitives";
import { Donut, HBars, Sparkline } from "../shared/charts";

interface Meal {
  id: string;
  time: string;
  name: string;
  kcal: number;
  hue: number;
  confidence: number;
  macros: { carbs: number; protein: number; fat: number; fiber: number };
  breakdown: { item: string; kcal: number; hue: number }[];
  micro: { k: string; pct: number }[];
  verdict?: string;
}

interface BodyOverlayProps {
  onClose: () => void;
}

export function BodyOverlay({ onClose }: BodyOverlayProps) {
  const D = IS_DATA;
  const B = D.body;
  const M = D.meals;
  const [tab, setTab] = useState<"watch" | "table">("watch");
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [share, setShare] = useState<boolean>(B.shareWithCompare);

  const today = B.today;
  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const sleep = today.sleep;
  const stageColors: Record<string, string> = {
    deep: "oklch(0.42 0.10 250)",
    rem: "oklch(0.62 0.12 38)",
    light: "oklch(0.78 0.06 220)",
    awake: "oklch(0.85 0.04 30)",
  };

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          the <em>body</em>
        </div>
        <div className="h-meta">
          {today.readiness}
          <br />
          ready
        </div>
      </div>
      <div className="app-body">
        <div
          className="card"
          style={{
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="1.2"
              strokeLinecap="round"
            >
              <rect x="6" y="5" width="12" height="14" rx="2" />
              <path d="M9 5V3h6v2M9 19v2h6v-2" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 10.5v1.5l1 0.6" strokeWidth="1" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 15 }}>
              {B.watch.brand}{" "}
              <span style={{ fontStyle: "italic", color: "var(--ink-2)" }}>
                {B.watch.model}
              </span>
            </div>
            <div className="kicker" style={{ marginTop: 2 }}>
              SYNCED · {B.watch.lastSync.toUpperCase()} · BATTERY{" "}
              {B.watch.battery}%
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "oklch(0.45 0.13 145)",
              padding: "3px 8px",
              border: "0.5px solid oklch(0.55 0.10 145)",
              borderRadius: 99,
              background: "oklch(0.95 0.05 145)",
            }}
          >
            · LIVE
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <Pill active={tab === "watch"} onClick={() => setTab("watch")}>
            watch
          </Pill>
          <Pill active={tab === "table"} onClick={() => setTab("table")}>
            the table
          </Pill>
        </div>

        {tab === "watch" && (
          <>
            <div
              className="card"
              style={{
                marginBottom: 14,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div>
                <div className="kicker">BODY BATTERY</div>
                <div className="fig-num" style={{ fontSize: 36, marginTop: 2 }}>
                  <em>{today.bodyBattery}</em>
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 16,
                      color: "var(--ink-3)",
                      marginLeft: 4,
                    }}
                  >
                    /100
                  </span>
                </div>
                <div
                  className="margin-note"
                  style={{ fontSize: 12, marginTop: 4 }}
                >
                  full enough for the long run.
                </div>
              </div>
              <div>
                <div className="kicker">READINESS</div>
                <div className="fig-num" style={{ fontSize: 36, marginTop: 2 }}>
                  <em>{today.readiness}</em>
                </div>
                <div
                  className="margin-note"
                  style={{ fontSize: 12, marginTop: 4 }}
                >
                  the watch says yes.
                </div>
              </div>
              <div>
                <div className="kicker">HRV (ms)</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 28,
                    fontStyle: "italic",
                    marginTop: 2,
                  }}
                >
                  {today.hrv}{" "}
                  <span
                    style={{
                      fontSize: 13,
                      color: "oklch(0.45 0.13 145)",
                    }}
                  >
                    ↑{today.hrv - today.hrvBaseline}
                  </span>
                </div>
                <div
                  className="margin-note"
                  style={{ fontSize: 12, marginTop: 4 }}
                >
                  above your baseline.
                </div>
              </div>
              <div>
                <div className="kicker">STRESS</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 28,
                    fontStyle: "italic",
                    marginTop: 2,
                  }}
                >
                  {today.stress}
                </div>
                <div
                  className="margin-note"
                  style={{ fontSize: 12, marginTop: 4 }}
                >
                  quiet morning, mostly.
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <Kicker>
                Last night · {sleep.hours}h · score {sleep.score}
              </Kicker>
              <div
                style={{
                  marginTop: 12,
                  height: 22,
                  display: "flex",
                  borderRadius: 4,
                  overflow: "hidden",
                  border: "0.5px solid var(--rule)",
                }}
              >
                {(
                  [
                    { k: "deep", v: sleep.deep },
                    { k: "rem", v: sleep.rem },
                    { k: "light", v: sleep.light },
                    { k: "awake", v: sleep.awake },
                  ] as { k: string; v: number }[]
                ).map((s) => (
                  <div
                    key={s.k}
                    style={{ flex: s.v, background: stageColors[s.k] }}
                    title={`${s.k}: ${s.v}h`}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.06em",
                }}
              >
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      background: stageColors.deep,
                      marginRight: 4,
                      verticalAlign: "middle",
                    }}
                  />
                  DEEP {sleep.deep}h
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      background: stageColors.rem,
                      marginRight: 4,
                      verticalAlign: "middle",
                    }}
                  />
                  REM {sleep.rem}h
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      background: stageColors.light,
                      marginRight: 4,
                      verticalAlign: "middle",
                    }}
                  />
                  LIGHT {sleep.light}h
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      background: stageColors.awake,
                      marginRight: 4,
                      verticalAlign: "middle",
                    }}
                  />
                  AWAKE {sleep.awake}h
                </span>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <Kicker>HRV · seven days</Kicker>
              <div style={{ marginTop: 8 }}>
                <Sparkline
                  data={B.week.hrv}
                  w={320}
                  h={70}
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
                  letterSpacing: "0.08em",
                  marginTop: 4,
                }}
              >
                {weekDays.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <Kicker>Heart-rate zones · this week</Kicker>
              <div style={{ marginTop: 12 }}>
                {[
                  { k: "z1", label: "Z1 · warm-up", v: B.hrZones.z1, color: "oklch(0.78 0.06 220)" },
                  { k: "z2", label: "Z2 · easy", v: B.hrZones.z2, color: "oklch(0.65 0.10 145)" },
                  { k: "z3", label: "Z3 · aerobic", v: B.hrZones.z3, color: "oklch(0.62 0.12 80)" },
                  { k: "z4", label: "Z4 · threshold", v: B.hrZones.z4, color: "oklch(0.60 0.14 38)" },
                  { k: "z5", label: "Z5 · max", v: B.hrZones.z5, color: "oklch(0.55 0.16 12)" },
                ].map((z) => (
                  <div
                    key={z.k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 100,
                        fontFamily: "var(--serif)",
                        fontStyle: "italic",
                        fontSize: 12,
                      }}
                    >
                      {z.label}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        background: "var(--paper-2)",
                        border: "0.5px solid var(--rule)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${z.v * 2}%`,
                          background: z.color,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: 32,
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--ink-3)",
                      }}
                    >
                      {z.v}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <Kicker>Workouts · this week</Kicker>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {B.workouts.map(
                  (
                    w: {
                      date: string;
                      type: string;
                      dur: string;
                      dist?: string;
                      hrAvg: number;
                      load: number;
                      hue: number;
                    },
                    i: number,
                  ) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "var(--paper-2)",
                        borderLeft: `3px solid oklch(0.55 0.13 ${w.hue})`,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          color: "var(--ink-3)",
                          letterSpacing: "0.1em",
                          width: 30,
                        }}
                      >
                        {w.date.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "var(--serif)",
                            fontSize: 14,
                            fontStyle: "italic",
                          }}
                        >
                          {w.type}
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
                          {w.dur}
                          {w.dist ? ` · ${w.dist}` : ""} · ❤ {w.hrAvg}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="fig-num" style={{ fontSize: 18 }}>
                          <em>{w.load}</em>
                        </div>
                        <div className="kicker">LOAD</div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div
              className="card"
              style={{
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Donut
                value={today.vo2Pct}
                color="var(--sienna)"
                label="VO₂"
                size={72}
              />
              <div style={{ flex: 1 }}>
                <div className="fig-num">
                  <em>{today.vo2}</em>
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 14,
                      color: "var(--ink-3)",
                      marginLeft: 6,
                    }}
                  >
                    ml/kg/min
                  </span>
                </div>
                <div className="kicker" style={{ marginTop: 2 }}>
                  TOP {100 - today.vo2Pct}% · YOUR AGE
                </div>
                <div className="margin-note" style={{ marginTop: 6, fontSize: 12 }}>
                  Borrowed lungs. The fjord pays back.
                </div>
              </div>
            </div>

            <div
              className="card"
              style={{ marginBottom: 14, background: "var(--paper-2)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 14,
                      fontStyle: "italic",
                    }}
                  >
                    Share with comparisons
                  </div>
                  <div
                    className="margin-note"
                    style={{ fontSize: 12, marginTop: 2 }}
                  >
                    let your sleep, HRV, and meals appear in city / world
                    charts
                  </div>
                </div>
                <button
                  onClick={() => setShare(!share)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 14,
                    border: "none",
                    background: share
                      ? "oklch(0.55 0.13 145)"
                      : "var(--rule)",
                    position: "relative",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: share ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--paper)",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    }}
                  />
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "table" && (
          <>
            <div
              className="card"
              style={{
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Donut
                value={Math.round((M.todayKcal / M.target) * 100)}
                color="var(--ochre)"
                label="KCAL"
                size={84}
              />
              <div style={{ flex: 1 }}>
                <div className="fig-num">
                  <em>{M.todayKcal}</em>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 14,
                      color: "var(--ink-3)",
                      marginLeft: 6,
                    }}
                  >
                    / {M.target}
                  </span>
                </div>
                <div className="kicker" style={{ marginTop: 2 }}>
                  TODAY · {M.log.length} ENTRIES
                </div>
                <div className="margin-note" style={{ marginTop: 6, fontSize: 12 }}>
                  {M.target - M.todayKcal} kcal remain — about a small bowl of
                  soup.
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <Kicker>Today's macro distribution</Kicker>
              <div style={{ marginTop: 10 }}>
                <HBars
                  items={[
                    { label: "Carbs", value: M.weekDist.carbs, color: "var(--ochre)" },
                    { label: "Protein", value: M.weekDist.protein, color: "var(--sienna)" },
                    { label: "Fat", value: M.weekDist.fat, color: "var(--sage)" },
                  ]}
                />
              </div>
            </div>

            <Kicker>Today's log</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 10,
              }}
            >
              {M.log.map((m: Meal) => (
                <div
                  key={m.id}
                  onClick={() => setOpenMeal(m)}
                  className="card"
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderLeft: `3px solid oklch(0.55 0.12 ${m.hue})`,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      flexShrink: 0,
                      borderRadius: 6,
                      background: `oklch(0.85 0.06 ${m.hue})`,
                      border: `0.5px solid oklch(0.55 0.12 ${m.hue})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 18,
                      color: `oklch(0.30 0.13 ${m.hue})`,
                    }}
                  >
                    {m.name.split(" ")[0][0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kicker">{m.time}</div>
                    <div
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 14,
                        marginTop: 1,
                        lineHeight: 1.2,
                      }}
                    >
                      {m.name}
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
                      C {m.macros.carbs}g · P {m.macros.protein}g · F{" "}
                      {m.macros.fat}g
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="fig-num" style={{ fontSize: 18 }}>
                      <em>{m.kcal}</em>
                    </div>
                    <div className="kicker">KCAL</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <Kicker>Calories · seven days</Kicker>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 12,
                  alignItems: "flex-end",
                  height: 80,
                }}
              >
                {M.weekKcal.map((v: number, i: number) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        height: (v / 2500) * 70,
                        background: i === 6 ? "var(--ochre)" : "var(--paper-2)",
                        border: i === 6 ? "none" : "0.5px solid var(--rule)",
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
                      {weekDays[i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {openMeal && (
        <MealDetail m={openMeal} onClose={() => setOpenMeal(null)} />
      )}
    </div>
  );
}

function MealDetail({ m, onClose }: { m: Meal; onClose: () => void }) {
  return (
    <div className="overlay paper-grain" style={{ zIndex: 25 }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>plate</em>
        </div>
        <div className="h-meta">
          {m.time}
          <br />
          {m.kcal}
        </div>
      </div>
      <div className="app-body">
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            background: `oklch(0.85 0.06 ${m.hue})`,
            borderRadius: 12,
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            border: `0.5px solid oklch(0.55 0.12 ${m.hue})`,
          }}
        >
          <span
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 80,
              color: `oklch(0.45 0.14 ${m.hue})`,
              opacity: 0.6,
            }}
          >
            {m.name.split(" ")[0][0]}
          </span>
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--paper)",
              letterSpacing: "0.08em",
              background: "rgba(0,0,0,0.4)",
              padding: "3px 8px",
              borderRadius: 99,
            }}
          >
            AI · {Math.round(m.confidence * 100)}% CONFIDENT
          </div>
        </div>

        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 22,
            letterSpacing: "-0.01em",
          }}
        >
          {m.name}
        </div>
        {m.verdict && (
          <div className="margin-note" style={{ fontSize: 14, marginTop: 4 }}>
            "{m.verdict}"
          </div>
        )}

        <hr className="rule-dashed" />

        <Kicker>What the AI saw</Kicker>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {m.breakdown.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: "var(--paper-2)",
                borderLeft: `2px solid oklch(0.55 0.12 ${b.hue})`,
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 13,
                  fontStyle: "italic",
                  flex: 1,
                }}
              >
                {b.item}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                }}
              >
                {b.kcal} kcal
              </span>
            </div>
          ))}
        </div>

        <hr className="rule-dashed" />
        <Kicker>Macros · grams + percent of meal</Kicker>
        <div style={{ marginTop: 12 }}>
          {(
            [
              { k: "carbs", label: "Carbs", g: m.macros.carbs, color: "var(--ochre)" },
              { k: "protein", label: "Protein", g: m.macros.protein, color: "var(--sienna)" },
              { k: "fat", label: "Fat", g: m.macros.fat, color: "var(--sage)" },
              { k: "fiber", label: "Fiber", g: m.macros.fiber, color: "var(--indigo)" },
            ] as { k: string; label: string; g: number; color: string }[]
          ).map((macro) => {
            const totalG = m.macros.carbs + m.macros.protein + m.macros.fat;
            const pct = Math.round((macro.g / totalG) * 100);
            return (
              <div key={macro.k} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--serif)",
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontStyle: "italic" }}>{macro.label}</span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: "var(--ink-3)",
                    }}
                  >
                    {macro.g}g
                    {macro.k !== "fiber" ? ` · ${pct}%` : ""}
                  </span>
                </div>
                <div
                  style={{
                    height: 7,
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${
                        macro.k === "fiber"
                          ? Math.min(macro.g * 4, 100)
                          : pct
                      }%`,
                      background: macro.color,
                      opacity: 0.75,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <hr className="rule-dashed" />
        <Kicker>Micronutrients · % daily target</Kicker>
        <div style={{ marginTop: 12 }}>
          {m.micro.map((n) => (
            <div key={n.k} style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--serif)",
                  fontSize: 13,
                  marginBottom: 3,
                }}
              >
                <span style={{ fontStyle: "italic" }}>{n.k}</span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color:
                      n.pct >= 100 ? "oklch(0.45 0.13 145)" : "var(--ink-3)",
                  }}
                >
                  {n.pct}%{n.pct >= 100 ? " · met" : ""}
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 2,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(n.pct, 100)}%`,
                    background:
                      n.pct >= 100
                        ? "oklch(0.55 0.12 145)"
                        : `oklch(0.55 0.12 ${m.hue})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
