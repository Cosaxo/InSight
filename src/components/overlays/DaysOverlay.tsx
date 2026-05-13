import { useState } from "react";
import { IS_DATA } from "../../data/seedData";
import { useMoods } from "../../lib/useMoods";
import type { MoodEntry } from "../../types";
import { Kicker, Pill } from "../shared/primitives";
import { Donut, Sparkline } from "../shared/charts";

interface Portrait {
  date: string;
  weight: number;
  mood: number;
  hue: number;
  weather: string;
  note: string;
}

interface Dream {
  id: string | number;
  date: string;
  title: string;
  text: string;
  tags: string[];
  hue: number;
  mood: string;
  lucidity: number;
  vividness: number;
}

interface TimeBlock {
  label: string;
  glyph: string;
  mins: number;
  hue: number;
}

function weatherLabel(w: string): string {
  const map: Record<string, string> = {
    sun: "CLEAR",
    rain: "RAIN",
    cloud: "OVERCAST",
    snow: "SNOW",
  };
  return map[w] || w.toUpperCase();
}

function PortraitFrame({
  p,
  h = 100,
  small = false,
}: {
  p: { hue: number; date?: string };
  h?: number;
  small?: boolean;
}) {
  const id = `grain-${p.hue}-${h}`;
  return (
    <div
      style={{
        width: small ? 78 : "100%",
        height: h,
        background: `linear-gradient(160deg, oklch(0.86 0.06 ${p.hue}) 0%, oklch(0.72 0.09 ${p.hue}) 100%)`,
        position: "relative",
        overflow: "hidden",
        border: small ? `0.5px solid oklch(0.55 0.10 ${p.hue})` : "none",
        borderRadius: small ? 6 : 0,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <radialGradient id={id} cx="40%" cy="35%" r="55%">
            <stop
              offset="0%"
              stopColor={`oklch(0.95 0.04 ${p.hue})`}
              stopOpacity="0.5"
            />
            <stop
              offset="100%"
              stopColor={`oklch(0.55 0.13 ${p.hue})`}
              stopOpacity="0.2"
            />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id})`} />
        <g fill={`oklch(0.40 0.13 ${p.hue})`} opacity="0.85">
          <ellipse cx="50" cy="42" rx="14" ry="16" />
          <path d="M 22 100 Q 28 70 50 66 Q 72 70 78 100 Z" />
        </g>
      </svg>
      {!small && p.date && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "oklch(0.95 0.04 60)",
            letterSpacing: "0.12em",
            background: "rgba(0,0,0,0.25)",
            padding: "3px 8px",
            borderRadius: 99,
          }}
        >
          {p.date.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// Build a vector of MoodEntry-or-null for the last 12 days, oldest
// first. Days without a logged mood show as a faint placeholder cell
// instead of a fake number — matches the convention used elsewhere
// after the seed-data cleanup.
function lastTwelveMoods(moods: MoodEntry[]): (MoodEntry | null)[] {
  const byDate = new Map(moods.map((m) => [m.date, m]));
  const today = new Date();
  const out: (MoodEntry | null)[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push(byDate.get(iso) ?? null);
  }
  return out;
}

function PortraitView({
  D,
  onOpen,
  onCapture,
}: {
  D: typeof IS_DATA;
  onOpen: (p: Portrait) => void;
  onCapture: () => void;
}) {
  const { moods: userMoods } = useMoods();
  const moodWindow = lastTwelveMoods(userMoods);
  const today: Portrait = D.portraits[0];
  const weights: number[] = D.portraits
    .slice()
    .reverse()
    .map((p: Portrait) => p.weight);

  return (
    <>
      <div
        className="card"
        style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}
      >
        <PortraitFrame p={today} h={280} />
        <div style={{ padding: 16 }}>
          <div className="kicker">
            TODAY · {weatherLabel(today.weather)}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 22,
              fontStyle: "italic",
              marginTop: 4,
              lineHeight: 1.3,
            }}
          >
            "{today.note}"
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
            <div>
              <div className="kicker">WEIGHT</div>
              <div className="fig-num" style={{ fontSize: 22 }}>
                <em>{today.weight}</em>
                <span
                  style={{
                    fontSize: 11,
                    marginLeft: 3,
                    color: "var(--ink-3)",
                  }}
                >
                  kg
                </span>
              </div>
            </div>
            <div>
              <div className="kicker">MOOD</div>
              <div className="fig-num" style={{ fontSize: 22 }}>
                <em>{today.mood}</em>
                <span
                  style={{
                    fontSize: 11,
                    marginLeft: 3,
                    color: "var(--ink-3)",
                  }}
                >
                  /5
                </span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={onCapture}
              style={{
                padding: "8px 14px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 99,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + today's frame
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>The strip · last twelve days</Kicker>
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "12px 0 4px",
          }}
        >
          {D.portraits.map((p: Portrait, i: number) => (
            <div
              key={i}
              onClick={() => onOpen(p)}
              style={{
                flex: "0 0 auto",
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <PortraitFrame p={p} h={100} small />
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 8.5,
                  color: "var(--ink-3)",
                  letterSpacing: "0.06em",
                  marginTop: 4,
                }}
              >
                {p.date.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Weight · twelve days</Kicker>
        <div style={{ marginTop: 8 }}>
          <Sparkline
            data={weights}
            w={320}
            h={60}
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
            letterSpacing: "0.06em",
            marginTop: 4,
          }}
        >
          <span>{Math.min(...weights).toFixed(1)} kg</span>
          <span>
            median{" "}
            {(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)}{" "}
            kg
          </span>
          <span>{Math.max(...weights).toFixed(1)} kg</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Mood · twelve days</Kicker>
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "flex-end",
            height: 80,
            marginTop: 12,
          }}
        >
          {moodWindow.map((m, i) => {
            // Mood scores are 1..5; the bar maxes at 70px (5 × 14).
            // Logged days draw a coloured bar; un-logged days draw a
            // very faint baseline so the strip never lies about a
            // value we don't have.
            const h = m ? m.score * 14 : 4;
            const isToday = i === moodWindow.length - 1;
            return (
              <div
                key={i}
                style={{ flex: 1, textAlign: "center" }}
                title={
                  m
                    ? `${m.date} · ${m.score}/5${m.note ? ` — ${m.note}` : ""}`
                    : "no entry"
                }
              >
                <div
                  style={{
                    height: h,
                    background: m
                      ? m.score >= 4
                        ? "oklch(0.65 0.10 145)"
                        : m.score >= 3
                          ? "oklch(0.70 0.06 80)"
                          : "oklch(0.65 0.10 25)"
                      : "var(--rule)",
                    opacity: m ? 0.85 : 0.5,
                    borderRadius: 2,
                    outline:
                      isToday && m
                        ? "1px solid var(--ink)"
                        : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
        {userMoods.length === 0 && (
          <div
            className="margin-note"
            style={{ marginTop: 10, fontSize: 12, fontStyle: "italic" }}
          >
            Log a daily report to start the strip.
          </div>
        )}
      </div>
    </>
  );
}

function DreamsView({
  D,
  onOpen,
}: {
  D: typeof IS_DATA;
  onOpen: (d: Dream) => void;
}) {
  const dreams: Dream[] = D.dreams;
  const remembered = dreams.filter(
    (d) => d.lucidity > 0 || d.vividness > 0,
  ).length;
  const lucid = dreams.filter((d) => d.lucidity >= 3).length;
  const themeEntries = Object.entries(D.dreamThemes as Record<string, number>).sort(
    (a, b) => b[1] - a[1],
  );
  const maxTheme = Math.max(...Object.values(D.dreamThemes as Record<string, number>));

  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          textAlign: "center",
        }}
      >
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{remembered}</em>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>/7</span>
          </div>
          <div className="kicker">REMEMBERED</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{lucid}</em>
          </div>
          <div className="kicker">LUCID</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>3.6</em>
          </div>
          <div className="kicker">AVG VIVIDNESS</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Recurring · the threads of the week</Kicker>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {themeEntries.map(([k, v]) => (
            <div
              key={k}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span
                style={{
                  width: 90,
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 13,
                }}
              >
                {k}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(v / maxTheme) * 100}%`,
                    background: "oklch(0.55 0.10 250)",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  width: 22,
                  textAlign: "right",
                }}
              >
                {v}×
              </span>
            </div>
          ))}
        </div>
      </div>

      <Kicker>Seven nights</Kicker>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 10,
        }}
      >
        {dreams.map((d) => (
          <div
            key={d.id}
            onClick={() => d.title !== "—" && onOpen(d)}
            className="card"
            style={{
              borderLeft: `3px solid oklch(0.55 0.10 ${d.hue})`,
              opacity: d.title === "—" ? 0.5 : 1,
              cursor: d.title === "—" ? "default" : "pointer",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "baseline", gap: 10 }}
            >
              <span
                className="kicker"
                style={{ minWidth: 60 }}
              >
                {d.date.toUpperCase()}
              </span>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 16,
                  flex: 1,
                }}
              >
                {d.title}
              </span>
              {d.lucidity >= 3 && (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 8.5,
                    letterSpacing: "0.1em",
                    color: "oklch(0.45 0.13 250)",
                    padding: "2px 6px",
                    border: "0.5px solid oklch(0.55 0.12 250)",
                    borderRadius: 99,
                  }}
                >
                  LUCID
                </span>
              )}
            </div>
            {d.title !== "—" && (
              <>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 13,
                    color: "var(--ink-2)",
                    marginTop: 6,
                    lineHeight: 1.4,
                  }}
                >
                  {d.text.length > 110 ? d.text.slice(0, 110) + "…" : d.text}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {d.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        letterSpacing: "0.06em",
                        padding: "2px 6px",
                        background: "var(--paper-2)",
                        color: "var(--ink-3)",
                        border: "0.5px solid var(--rule)",
                        borderRadius: 99,
                      }}
                    >
                      · {t}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function TimeView({ D }: { D: typeof IS_DATA }) {
  const today: TimeBlock[] = D.time.today;
  const total = today.reduce((a, b) => a + b.mins, 0);
  const sorted = [...today].sort((a, b) => b.mins - a.mins);
  const maxMins = sorted[0].mins;

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Today · ranked</Kicker>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {sorted.map((b) => (
            <div
              key={b.label}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span
                style={{
                  width: 18,
                  textAlign: "center",
                  fontFamily: "var(--serif)",
                  fontSize: 14,
                  color: `oklch(0.45 0.13 ${b.hue})`,
                }}
              >
                {b.glyph}
              </span>
              <span
                style={{
                  width: 110,
                  fontFamily: "var(--serif)",
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                {b.label}
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
                    width: `${(b.mins / maxMins) * 100}%`,
                    background: `oklch(0.62 0.10 ${b.hue})`,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  width: 60,
                  textAlign: "right",
                }}
              >
                {Math.floor(b.mins / 60)}h {b.mins % 60}m
              </span>
            </div>
          ))}
        </div>
        <div className="margin-note" style={{ marginTop: 14, fontSize: 12 }}>
          the day was {Math.round(total / 60)} hours long, like every other day,
          but the shape of it was yours.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>This week · intention vs. life</Kicker>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[
            {
              k: "deep",
              label: "Deep work",
              actual: D.time.weekHours.deep,
              target: D.time.intentions.deep,
              hue: 38,
              invert: false,
            },
            {
              k: "reading",
              label: "Reading",
              actual: D.time.weekHours.reading,
              target: D.time.intentions.reading,
              hue: 145,
              invert: false,
            },
            {
              k: "movement",
              label: "Movement",
              actual: D.time.weekHours.movement,
              target: D.time.intentions.movement,
              hue: 12,
              invert: false,
            },
            {
              k: "phone",
              label: "Phone",
              actual: D.time.weekHours.phone,
              target: D.time.intentions.phone,
              hue: 305,
              invert: true,
            },
          ].map((it) => {
            const max = Math.max(it.actual, it.target) * 1.1;
            const hit = it.invert
              ? it.actual <= it.target
              : it.actual >= it.target;
            return (
              <div key={it.k}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--serif)",
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontStyle: "italic" }}>{it.label}</span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: hit
                        ? "oklch(0.45 0.13 145)"
                        : "oklch(0.55 0.13 25)",
                    }}
                  >
                    {it.actual}h · target {it.target}h
                    {it.invert ? " (max)" : ""}
                  </span>
                </div>
                <div
                  style={{
                    position: "relative",
                    height: 10,
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 3,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${(it.actual / max) * 100}%`,
                      background: `oklch(0.65 0.10 ${it.hue})`,
                      opacity: 0.85,
                      borderRadius: 2,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: `${(it.target / max) * 100}%`,
                      top: -3,
                      bottom: -3,
                      width: 1.5,
                      background: "var(--ink)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function StatBlock({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className="fig-num" style={{ fontSize: 20, marginTop: 2 }}>
        <em>{v}</em>
      </div>
    </div>
  );
}

function FragmentTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ borderLeft: "2px solid var(--rule)", paddingLeft: 10 }}>
      <div className="fig-num" style={{ fontSize: 24 }}>
        <em>{value}</em>
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 12,
          color: "var(--ink-2)",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function WeekGrid({
  total,
  lived,
  expectancy,
}: {
  total: number;
  lived: number;
  expectancy: number;
}) {
  const cols = 52;
  const rows = expectancy;
  const W = 320,
    gap = 1;
  const cell = (W - (cols + 1) * gap) / cols;
  const H = rows * cell + (rows + 1) * gap;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((__, c) => {
          const idx = r * cols + c;
          const lit = idx < lived;
          const isCurrent = idx === lived - 1;
          const x = gap + c * (cell + gap);
          const y = gap + r * (cell + gap);
          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width={cell}
              height={cell}
              rx="0.5"
              fill={
                isCurrent
                  ? "oklch(0.55 0.16 25)"
                  : lit
                    ? "oklch(0.42 0.04 60)"
                    : "var(--paper-2)"
              }
              stroke={lit ? "none" : "var(--rule)"}
              strokeWidth="0.3"
              opacity={lit ? 0.9 : 1}
            />
          );
        }),
      )}
      {[10, 20, 30, 40, 50, 60, 70, 80]
        .filter((d) => d < expectancy)
        .map((d) => (
          <text
            key={d}
            x={W - 4}
            y={gap + d * (cell + gap) + 4}
            textAnchor="end"
            fontFamily="var(--mono)"
            fontSize="6.5"
            letterSpacing="0.08em"
            fill="var(--ink-3)"
            opacity="0.6"
          >
            {d}
          </text>
        ))}
      <text x={4} y={H - 4} fontFamily="var(--mono)" fontSize="7" fill="var(--ink-3)">
        {total} weeks total
      </text>
    </svg>
  );
}

function LifeView({ D }: { D: typeof IS_DATA }) {
  const L = D.life;
  const born = new Date(L.bornISO);
  const now = new Date();
  const ageMs = now.getTime() - born.getTime();
  const yearMs = 365.25 * 24 * 60 * 60 * 1000;
  const ageY = ageMs / yearMs;
  const lived = ageY / L.expectancy;
  const left = 1 - lived;

  const totalWeeks = Math.round(L.expectancy * 52);
  const livedWeeks = Math.round(ageY * 52);
  const leftWeeks = totalWeeks - livedWeeks;

  const totalWakingY = L.expectancy * (L.waking / 24);
  const livedWakingY = ageY * (L.waking / 24);

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Where you stand</Kicker>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            marginTop: 8,
          }}
        >
          <div className="fig-num" style={{ fontSize: 56 }}>
            <em>{ageY.toFixed(1)}</em>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 16,
                fontStyle: "italic",
              }}
            >
              years in
            </div>
            <div className="kicker" style={{ marginTop: 2 }}>
              OF AN ASSUMED {L.expectancy} ·{" "}
              {(L.expectancy - ageY).toFixed(1)} TO GO
            </div>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            height: 16,
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 3,
            marginTop: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${lived * 100}%`,
              background:
                "linear-gradient(90deg, oklch(0.55 0.13 25), oklch(0.62 0.12 38))",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${lived * 100}%`,
              width: 2,
              background: "var(--ink)",
            }}
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
          <span>{(lived * 100).toFixed(1)}% LIVED</span>
          <span>{(left * 100).toFixed(1)}% AHEAD</span>
        </div>
        <div className="margin-note" style={{ marginTop: 12, fontSize: 13 }}>
          "{L.label}" — this is a guess, of course. nobody knows for sure.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>The grid · weeks of a life</Kicker>
        <div className="margin-note" style={{ marginTop: 6, marginBottom: 12, fontSize: 12 }}>
          {totalWeeks.toLocaleString()} small dots, one per week.{" "}
          {livedWeeks.toLocaleString()} are filled in.
        </div>
        <WeekGrid
          total={totalWeeks}
          lived={livedWeeks}
          expectancy={L.expectancy}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            letterSpacing: "0.08em",
            marginTop: 10,
          }}
        >
          <span>· {livedWeeks.toLocaleString()} LIVED</span>
          <span>{leftWeeks.toLocaleString()} REMAINING ·</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Waking hours · what you actually get</Kicker>
        <div className="margin-note" style={{ marginTop: 6, marginBottom: 12, fontSize: 12 }}>
          subtract sleep, and the budget shrinks. you have spent about{" "}
          <strong style={{ color: "var(--ink)", fontStyle: "italic" }}>
            {Math.round(livedWakingY).toLocaleString()}
          </strong>{" "}
          waking years.
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <Donut
            value={Math.round((livedWakingY / totalWakingY) * 100)}
            color="var(--sienna)"
            label="LIVED"
            size={86}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <StatBlock k="WAKING / DAY" v={`${L.waking}h`} />
            <StatBlock
              k="EXPECTED WAKING"
              v={`${Math.round(totalWakingY)} years`}
            />
            <StatBlock
              k="REMAINING"
              v={`~${Math.round(totalWakingY - livedWakingY).toLocaleString()} years`}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>If the average holds</Kicker>
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <FragmentTile
            label="summers ahead"
            value={Math.round(L.expectancy - ageY)}
          />
          <FragmentTile
            label="full moons"
            value={Math.round((L.expectancy - ageY) * 12.4)}
          />
          <FragmentTile label="weekends" value={Math.round(leftWeeks)} />
          <FragmentTile
            label="cups of coffee"
            value={Math.round((L.expectancy - ageY) * 365 * 2).toLocaleString()}
          />
          <FragmentTile label="books, at 1/wk" value={Math.round(leftWeeks)} />
          <FragmentTile
            label="conversations with mum"
            value={Math.round((L.expectancy - ageY) * 50)}
          />
        </div>
      </div>
    </>
  );
}

interface DaysOverlayProps {
  onClose: () => void;
}

export function DaysOverlay({ onClose }: DaysOverlayProps) {
  const D = IS_DATA;
  const [tab, setTab] = useState<"portrait" | "dreams" | "time" | "life">(
    "portrait",
  );
  const [openPortrait, setOpenPortrait] = useState<Portrait | null>(null);
  const [openDream, setOpenDream] = useState<Dream | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          the <em>days</em>
        </div>
        <div className="h-meta">
          {D.portraits.length}
          <br />
          logged
        </div>
      </div>
      <div className="app-body">
        <div className="margin-note" style={{ marginBottom: 12, fontSize: 13 }}>
          a private ledger — what the day looked like, what it felt like, what
          it took.
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <Pill
            active={tab === "portrait"}
            onClick={() => setTab("portrait")}
          >
            portrait
          </Pill>
          <Pill active={tab === "dreams"} onClick={() => setTab("dreams")}>
            dreams
          </Pill>
          <Pill active={tab === "time"} onClick={() => setTab("time")}>
            time
          </Pill>
          <Pill active={tab === "life"} onClick={() => setTab("life")}>
            life
          </Pill>
        </div>

        {tab === "portrait" && (
          <PortraitView
            D={D}
            onOpen={setOpenPortrait}
            onCapture={() => setShowCapture(true)}
          />
        )}
        {tab === "dreams" && <DreamsView D={D} onOpen={setOpenDream} />}
        {tab === "time" && <TimeView D={D} />}
        {tab === "life" && <LifeView D={D} />}
      </div>

      {openPortrait && (
        <PortraitDetail
          p={openPortrait}
          onClose={() => setOpenPortrait(null)}
        />
      )}
      {openDream && (
        <DreamDetail d={openDream} onClose={() => setOpenDream(null)} />
      )}
      {showCapture && <CaptureFlow onClose={() => setShowCapture(false)} />}
    </div>
  );
}

// ─── PortraitDetail — full-screen sub-overlay ────────────────────
function PortraitDetail({
  p,
  onClose,
}: {
  p: Portrait;
  onClose: () => void;
}) {
  return (
    <div className="overlay paper-grain" style={{ zIndex: 25 }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>frame</em>
        </div>
        <div className="h-meta">{p.date}</div>
      </div>
      <div className="app-body">
        <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
          <PortraitFrame p={p} h={360} />
        </div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontStyle: "italic",
            lineHeight: 1.35,
          }}
        >
          "{p.note}"
        </div>
        <hr className="rule-dashed" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
          }}
        >
          <StatBlock k="WEIGHT" v={`${p.weight}kg`} />
          <StatBlock k="MOOD" v={`${p.mood}/5`} />
          <StatBlock k="WEATHER" v={weatherLabel(p.weather)} />
        </div>
      </div>
    </div>
  );
}

// ─── DreamDetail — full-screen sub-overlay ───────────────────────
function DreamDetail({ d, onClose }: { d: Dream; onClose: () => void }) {
  return (
    <div className="overlay paper-grain" style={{ zIndex: 25 }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>dream</em>
        </div>
        <div className="h-meta">{d.date}</div>
      </div>
      <div className="app-body">
        <div
          style={{
            padding: 18,
            borderRadius: 12,
            background: `linear-gradient(160deg, oklch(0.93 0.03 ${d.hue}) 0%, oklch(0.85 0.06 ${d.hue}) 100%)`,
            marginBottom: 14,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              letterSpacing: "0.12em",
              color: `oklch(0.30 0.13 ${d.hue})`,
              opacity: 0.7,
            }}
          >
            {d.mood.toUpperCase()} · VIVID {d.vividness}/5
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 28,
              lineHeight: 1.2,
              marginTop: 8,
              color: `oklch(0.20 0.13 ${d.hue})`,
            }}
          >
            {d.title}
          </div>
        </div>

        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          {d.text}
        </div>

        <hr className="rule-dashed" />

        <Kicker>The shape of it</Kicker>
        <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="kicker">LUCIDITY</div>
            <div className="fig-num" style={{ fontSize: 22 }}>
              <em>{d.lucidity}</em>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>/5</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="kicker">VIVIDNESS</div>
            <div className="fig-num" style={{ fontSize: 22 }}>
              <em>{d.vividness}</em>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>/5</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="kicker">MOOD</div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 18,
                marginTop: 2,
              }}
            >
              {d.mood}
            </div>
          </div>
        </div>

        <Kicker>Tags</Kicker>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          {d.tags.map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 13,
                padding: "4px 10px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 99,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CaptureFlow — today's frame · camera → details ──────────────
function CaptureFlow({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<"camera" | "details">("camera");
  const [weight, setWeight] = useState("74.2");
  const [mood, setMood] = useState(4);
  const [note, setNote] = useState("");

  return (
    <div className="overlay paper-grain" style={{ zIndex: 30 }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          today's <em>frame</em>
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body">
        {stage === "camera" && (
          <>
            <div
              style={{
                aspectRatio: "3 / 4",
                background: "oklch(0.18 0.01 60)",
                borderRadius: 14,
                position: "relative",
                overflow: "hidden",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 30,
                  border: "1px dashed rgba(255,240,220,0.3)",
                  borderRadius: 200,
                }}
              />
              <svg viewBox="0 0 100 100" width="65%" height="65%">
                <ellipse
                  cx="50"
                  cy="42"
                  rx="14"
                  ry="16"
                  fill="oklch(0.55 0.05 60)"
                  opacity="0.5"
                />
                <path
                  d="M 25 100 Q 30 70 50 66 Q 70 70 75 100 Z"
                  fill="oklch(0.55 0.05 60)"
                  opacity="0.5"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: 16,
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "oklch(0.85 0.04 60)",
                  letterSpacing: "0.1em",
                }}
              >
                ● ALIGN FACE WITH OVAL
              </div>
            </div>
            <button
              onClick={() => setStage("details")}
              style={{
                padding: "14px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 14,
                width: "100%",
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 16,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "oklch(0.65 0.18 25)",
                  boxShadow:
                    "0 0 0 3px var(--paper), 0 0 0 4px oklch(0.65 0.18 25)",
                }}
              />
              capture
            </button>
          </>
        )}

        {stage === "details" && (
          <>
            <div
              style={{
                aspectRatio: "3 / 4",
                maxHeight: 200,
                marginBottom: 16,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <PortraitFrame
                p={{ hue: 38, date: "just now" }}
                h={200}
              />
            </div>

            <Kicker>Weight</Kicker>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "baseline",
                marginTop: 8,
                marginBottom: 16,
              }}
            >
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontFamily: "var(--serif)",
                  fontSize: 22,
                  fontStyle: "italic",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 8,
                  background: "var(--paper-2)",
                  textAlign: "right",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                KG
              </span>
            </div>

            <Kicker>How was it · 1–5</Kicker>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 8,
                marginBottom: 16,
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setMood(n)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    background: mood === n ? "var(--ink)" : "var(--paper-2)",
                    color: mood === n ? "var(--paper)" : "var(--ink-2)",
                    border:
                      "0.5px solid " +
                      (mood === n ? "var(--ink)" : "var(--rule)"),
                    borderRadius: 8,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <Kicker>One sentence about today</Kicker>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="quiet morning. The fjord light is back."
              style={{
                width: "100%",
                minHeight: 80,
                padding: 12,
                marginTop: 8,
                fontFamily: "var(--serif)",
                fontSize: 15,
                fontStyle: "italic",
                border: "0.5px solid var(--rule)",
                borderRadius: 8,
                background: "var(--paper-2)",
                resize: "none",
                lineHeight: 1.4,
              }}
            />

            <button
              onClick={onClose}
              style={{
                marginTop: 16,
                padding: "14px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 14,
                width: "100%",
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              save the frame
            </button>
          </>
        )}
      </div>
    </div>
  );
}
