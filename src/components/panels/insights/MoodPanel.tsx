import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C } from "../../../theme";
import {
  MOOD_COLOR,
  MOOD_EMOJI,
  MOOD_LABEL,
  TODAY,
  daysAgo,
} from "../../../data/insightDefaults";
import { fmtDate } from "../../../utils/helpers";
import type { MoodEntry } from "../../../types";
import { Card } from "../../shared/Card";
import { SLabel } from "../../shared/SLabel";

interface MoodPanelProps {
  moods: MoodEntry[];
  onLog: (entry: MoodEntry) => void;
  onDelete: (date: string) => void;
  onToast: (message: string, color: string, icon: string) => void;
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: `1px solid ${C.divider}`,
  background: C.dim,
  color: C.text,
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
  marginBottom: 10,
} as const;

export function MoodPanel({ moods, onLog, onDelete, onToast }: MoodPanelProps) {
  const [score, setScore] = useState(0);
  const [note, setNote] = useState("");
  const todayMood = moods.find((m) => m.date === TODAY);

  // 30-day trend, with a 7-day rolling mean to smooth gaps.
  const trend = useMemo(() => {
    const byDate = new Map(moods.map((m) => [m.date, m.score]));
    const days = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));
    return days.map((date, i) => {
      const score = byDate.get(date);
      const window: number[] = [];
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        const s = byDate.get(days[j]);
        if (typeof s === "number") window.push(s);
      }
      const avg =
        window.length > 0
          ? window.reduce((a, b) => a + b, 0) / window.length
          : null;
      return {
        date,
        score: typeof score === "number" ? score : null,
        avg,
        label: new Date(date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
      };
    });
  }, [moods]);

  const logged30d = trend.filter((d) => d.score !== null).length;
  const avg30d =
    logged30d > 0
      ? (
          trend
            .filter((d) => d.score !== null)
            .reduce((s, d) => s + (d.score || 0), 0) / logged30d
        ).toFixed(1)
      : "—";

  function submit() {
    if (!score) return;
    onLog({ date: TODAY, score, note });
    onToast(
      `${MOOD_LABEL[score]} mood logged`,
      MOOD_COLOR[score],
      MOOD_EMOJI[score],
    );
    setScore(0);
    setNote("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card sec="mood">
        <SLabel sec="mood">Last 7 days</SLabel>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = daysAgo(6 - i);
            const mood = moods.find((m) => m.date === d);
            const isToday = d === TODAY;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 20, lineHeight: 1 }}>
                  {mood ? MOOD_EMOJI[mood.score] : "–"}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 8,
                    background: mood
                      ? `${MOOD_COLOR[mood.score]}20`
                      : C.dim,
                    border: isToday
                      ? `2.5px solid ${C.teal}`
                      : "1px solid transparent",
                    display: "flex",
                    alignItems: "flex-end",
                    overflow: "hidden",
                  }}
                >
                  {mood && (
                    <div
                      style={{
                        width: "100%",
                        height: `${mood.score * 20}%`,
                        background: `linear-gradient(180deg, ${MOOD_COLOR[mood.score]}cc, ${MOOD_COLOR[mood.score]})`,
                        borderRadius: 6,
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: isToday ? C.teal : C.muted,
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  {isToday
                    ? "Today"
                    : new Date(d)
                        .toLocaleDateString("en-GB", { weekday: "short" })
                        .slice(0, 2)}
                </div>
              </div>
            );
          })}
        </div>
        {todayMood && (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: `${MOOD_COLOR[todayMood.score]}18`,
              border: `1.5px solid ${MOOD_COLOR[todayMood.score]}40`,
              fontSize: 13,
              color: C.text,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                color: MOOD_COLOR[todayMood.score],
              }}
            >
              {MOOD_EMOJI[todayMood.score]} {MOOD_LABEL[todayMood.score]}
            </span>
            {todayMood.note && (
              <span style={{ color: C.muted }}> — {todayMood.note}</span>
            )}
          </div>
        )}
      </Card>

      {logged30d > 1 && (
        <Card sec="mood">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <SLabel sec="mood">30-day trend</SLabel>
            <span style={{ fontSize: 11, color: C.muted }}>
              avg <span style={{ color: C.coral, fontWeight: 700 }}>{avg30d}</span> · {logged30d} logged
            </span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart
              data={trend}
              margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
            >
              <defs>
                <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.coral} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.coral} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: C.muted }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: C.divider }}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 3, 5]}
                tick={{ fontSize: 9, fill: C.muted }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ stroke: C.divider }}
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${C.divider}`,
                  fontSize: 12,
                  padding: "4px 8px",
                }}
                formatter={(v) => (typeof v === "number" ? v.toFixed(1) : "—")}
              />
              <Area
                type="monotone"
                dataKey="avg"
                stroke={C.coral}
                strokeWidth={2}
                fill="url(#moodGrad)"
                connectNulls
                isAnimationActive={false}
                name="7-day avg"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card sec="mood">
        <SLabel sec="mood">
          {todayMood ? "Update today's mood" : "Log today's mood"}
        </SLabel>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setScore(s)}
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                cursor: "pointer",
                background: score === s ? MOOD_COLOR[s] : C.dim,
                border:
                  score === s ? "none" : "2px solid transparent",
                fontSize: 26,
                transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
                boxShadow:
                  score === s ? `0 4px 16px ${MOOD_COLOR[s]}50` : "none",
                transform: score === s ? "scale(1.15)" : "scale(1)",
              }}
            >
              {MOOD_EMOJI[s]}
            </button>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's on your mind? (optional)"
          style={inputStyle}
        />
        <button
          onClick={submit}
          disabled={!score}
          style={{
            padding: "11px",
            borderRadius: 12,
            border: "none",
            background: score ? MOOD_COLOR[score] : C.muted,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13,
            cursor: score ? "pointer" : "default",
            fontWeight: 600,
            width: "100%",
          }}
        >
          {score ? `Log ${MOOD_LABEL[score]} ${MOOD_EMOJI[score]}` : "Select a mood"}
        </button>
      </Card>

      <Card sec="mood">
        <SLabel sec="mood">Recent notes</SLabel>
        {moods.filter((m) => m.note).length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: C.muted,
              padding: "12px 0",
              fontSize: 13,
            }}
          >
            No notes yet
          </div>
        ) : (
          moods
            .filter((m) => m.note)
            .slice(0, 5)
            .map((m, i, arr) => (
              <div
                key={m.date}
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: i < arr.length - 1 ? 8 : 0,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>
                  {MOOD_EMOJI[m.score]}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: MOOD_COLOR[m.score],
                      fontWeight: 600,
                    }}
                  >
                    {MOOD_LABEL[m.score]} — {fmtDate(m.date)}
                  </div>
                  <div style={{ fontSize: 13, color: C.text }}>{m.note}</div>
                </div>
                <button
                  onClick={() => onDelete(m.date)}
                  aria-label="Delete mood entry"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: C.muted,
                    fontSize: 16,
                    padding: "0 4px",
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))
        )}
      </Card>
    </div>
  );
}
