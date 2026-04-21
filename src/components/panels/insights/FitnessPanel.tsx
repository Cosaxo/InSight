import { useState } from "react";
import { C, SEC } from "../../../theme";
import {
  INTENSITY_KCAL,
  TODAY,
  WORKOUT_TYPES,
  daysAgo,
} from "../../../data/insightDefaults";
import { fmtDate } from "../../../utils/helpers";
import type {
  Workout,
  WorkoutIntensity,
  WorkoutType,
} from "../../../types";
import { Card } from "../../shared/Card";
import { SLabel } from "../../shared/SLabel";
import { StatCards } from "../../shared/StatCards";
import { StatIco } from "../../icons/StatIcons";
import type { StatIconName } from "../../icons/StatIcons";

interface FitnessPanelProps {
  workouts: Workout[];
  onLog: (w: Omit<Workout, "id">) => void;
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
  marginBottom: 8,
} as const;

const TYPE_ICON: Record<WorkoutType, StatIconName> = {
  Run: "run",
  Walk: "run",
  Cycle: "trend",
  Swim: "target",
  Strength: "fire",
  HIIT: "fire",
  Yoga: "compass",
  Other: "star",
};

export function FitnessPanel({ workouts, onLog, onToast }: FitnessPanelProps) {
  const [show, setShow] = useState(false);
  const [type, setType] = useState<WorkoutType>("Run");
  const [duration, setDuration] = useState("30");
  const [intensity, setIntensity] = useState<WorkoutIntensity>("Medium");
  const [notes, setNotes] = useState("");

  function submit() {
    if (!duration) return;
    onLog({
      date: TODAY,
      type,
      duration: Number(duration),
      intensity,
      kcal: INTENSITY_KCAL[intensity],
      notes,
    });
    onToast(`${type} logged`, C.cyan, "✓");
    setNotes("");
    setShow(false);
  }

  const weekWorkouts = workouts.filter((w) => w.date >= daysAgo(7));
  const weekCount = weekWorkouts.length;
  const avgKcal =
    weekCount > 0
      ? Math.round(weekWorkouts.reduce((s, w) => s + w.kcal, 0) / weekCount)
      : 0;
  const totalTime = weekWorkouts.reduce((s, w) => s + w.duration, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <StatCards
        cards={[
          {
            icon: <StatIco name="run" col={C.cyan} />,
            label: "This week",
            value: `${weekCount} sessions`,
            color: C.cyan,
            bg: SEC.fitness.bg,
          },
          {
            icon: <StatIco name="fire" col={C.coral} />,
            label: "Avg kcal",
            value: `${avgKcal} kcal`,
            color: C.coral,
            bg: SEC.mood.bg,
          },
          {
            icon: <StatIco name="clock" col={C.purple} />,
            label: "Total time",
            value: `${totalTime} min`,
            color: C.purple,
            bg: SEC.personality.bg,
          },
        ]}
      />

      {show ? (
        <Card>
          <SLabel>Log workout</SLabel>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkoutType)}
            style={inputStyle}
          >
            {WORKOUT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Duration (minutes)"
            type="number"
            style={inputStyle}
          />
          <select
            value={intensity}
            onChange={(e) =>
              setIntensity(e.target.value as WorkoutIntensity)
            }
            style={inputStyle}
          >
            {(["Low", "Medium", "High"] as WorkoutIntensity[]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submit}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 12,
                border: "none",
                background: C.teal,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Log
            </button>
            <button
              onClick={() => setShow(false)}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 12,
                border: `1px solid ${C.divider}`,
                background: "transparent",
                color: C.muted,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShow(true)}
          style={{
            padding: "13px",
            borderRadius: 14,
            border: "none",
            background: C.teal,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Log workout
        </button>
      )}

      <Card sec="fitness">
        <SLabel sec="fitness">Recent workouts</SLabel>
        {workouts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: C.muted,
              padding: "12px 0",
              fontSize: 13,
            }}
          >
            No workouts logged yet
          </div>
        ) : (
          workouts.slice(0, 5).map((w, i, arr) => (
            <div
              key={w.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom:
                  i < arr.length - 1 ? `1px solid ${C.divider}` : "none",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: SEC.fitness.bg,
                  border: `1.5px solid ${C.cyan}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <StatIco
                  name={TYPE_ICON[w.type] ?? "star"}
                  col={C.cyan}
                  size={18}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: C.navy }}
                >
                  {w.type}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {fmtDate(w.date)} · {w.intensity}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{ fontSize: 14, fontWeight: 700, color: C.teal }}
                >
                  {w.duration} min
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {w.kcal} kcal
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
