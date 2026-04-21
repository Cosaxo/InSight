import { useState } from "react";
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
