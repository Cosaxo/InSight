import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, SEC } from "../../../theme";
import {
  TODAY,
  daysAgo,
  streakFor,
} from "../../../data/insightDefaults";
// Styling helpers live in the data module so this file only exports
// components (React Refresh requirement).
import type { Habit } from "../../../types";
import { Card } from "../../shared/Card";
import { CalendarHeatmap } from "../../shared/CalendarHeatmap";
import { SLabel } from "../../shared/SLabel";
import { StatCards } from "../../shared/StatCards";
import { StatIco } from "../../icons/StatIcons";

interface HabitsPanelProps {
  habits: Habit[];
  onToggle: (id: string) => void;
  onAdd: (name: string) => void;
  onToast: (message: string, color: string, icon: string) => void;
}

export function HabitsPanel({
  habits,
  onToggle,
  onAdd,
  onToast,
}: HabitsPanelProps) {
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  function toggle(h: Habit) {
    setBouncingId(h.id);
    setTimeout(() => setBouncingId(null), 420);
    const wasDone = h.completions.includes(TODAY);
    onToggle(h.id);
    if (!wasDone) onToast(`${h.name} done!`, h.color, "✓");
  }

  function addHabit() {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
    setShowAdd(false);
  }

  const bestStreak = habits.length
    ? Math.max(...habits.map((h) => streakFor(h.completions)))
    : 0;
  const doneToday = habits.filter((h) => h.completions.includes(TODAY)).length;

  // Daily completion percentage over the heatmap window.
  const heatmapValues = useMemo(() => {
    if (!habits.length) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const h of habits) {
      for (const d of h.completions) {
        counts.set(d, (counts.get(d) || 0) + 1);
      }
    }
    const out = new Map<string, number>();
    for (const [date, count] of counts) {
      out.set(date, count / habits.length);
    }
    return out;
  }, [habits]);

  // Daily completion rate over the last 14 days.
  const trend = useMemo(() => {
    if (!habits.length) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = daysAgo(13 - i);
      const done = habits.filter((h) => h.completions.includes(d)).length;
      return {
        date: d,
        pct: Math.round((done / habits.length) * 100),
        done,
        label: new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
      };
    });
  }, [habits]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <StatCards
        cards={[
          {
            icon: <StatIco name="fire" col={C.coral} />,
            label: "On track",
            value: `${doneToday}/${habits.length}`,
            color: C.coral,
            bg: SEC.mood.bg,
          },
          {
            icon: <StatIco name="streak" col={C.amber} />,
            label: "Best streak",
            value: `${bestStreak} days`,
            color: C.amber,
            bg: SEC.city.bg,
          },
        ]}
      />

      {habits.length > 0 && (
        <Card sec="habits">
          <SLabel sec="habits">26-week consistency map</SLabel>
          <CalendarHeatmap
            values={heatmapValues}
            levels={[0.01, 0.34, 0.67, 1]}
            color={C.teal}
            formatValue={(v) =>
              `${Math.round(v * habits.length)}/${habits.length} done (${Math.round(v * 100)}%)`
            }
          />
        </Card>
      )}

      {trend.length > 0 && (
        <Card sec="habits">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <SLabel sec="habits">14-day completion</SLabel>
            <span style={{ fontSize: 11, color: C.muted }}>
              today{" "}
              <span style={{ color: C.teal, fontWeight: 700 }}>
                {trend[trend.length - 1].pct}%
              </span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart
              data={trend}
              margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: C.muted }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: C.divider }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tick={{ fontSize: 9, fill: C.muted }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: `${C.teal}10` }}
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${C.divider}`,
                  fontSize: 12,
                  padding: "4px 8px",
                }}
                formatter={(v) => `${v}%`}
              />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {trend.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.pct >= 75 ? C.teal : d.pct >= 40 ? C.amber : C.dim}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card sec="habits">
        <SLabel sec="habits">Today's habits</SLabel>
        {habits.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: C.muted,
              padding: "12px 0",
              fontSize: 13,
            }}
          >
            No habits yet — add one below
          </div>
        )}
        {habits.map((h, i) => {
          const done = h.completions.includes(TODAY);
          const streak = streakFor(h.completions);
          const bouncing = bouncingId === h.id;
          return (
            <div
              key={h.id}
              onClick={() => toggle(h)}
              aria-label={`${done ? "Uncheck" : "Complete"} ${h.name}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                cursor: "pointer",
                borderBottom:
                  i < habits.length - 1
                    ? `1px solid ${C.divider}`
                    : "none",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: done ? h.color : C.dim,
                  border: done ? "none" : `2px solid ${C.divider}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                  boxShadow: done ? `0 3px 12px ${h.color}50` : "none",
                  animation: bouncing
                    ? "habitBounce 0.42s cubic-bezier(.4,0,.2,1)"
                    : "none",
                }}
              >
                {done ? (
                  <StatIco name="checkAll" col="#fff" size={18} />
                ) : (
                  <span style={{ fontSize: 18 }}>{h.icon}</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: done ? C.navy : C.muted,
                  }}
                >
                  {h.name}
                </div>
                <div style={{ fontSize: 11, color: h.color }}>
                  {streak > 0 ? `${streak} day streak` : "Not started today"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {Array.from({ length: 7 }, (_, j) => daysAgo(6 - j)).map(
                  (d, j) => (
                    <div
                      key={j}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: h.completions.includes(d) ? h.color : C.dim,
                        boxShadow: h.completions.includes(d)
                          ? `0 1px 4px ${h.color}50`
                          : "none",
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {showAdd ? (
        <Card>
          <SLabel>New habit</SLabel>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Habit name..."
            style={{
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
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={addHabit}
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
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
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
          onClick={() => setShowAdd(true)}
          style={{
            padding: "12px",
            borderRadius: 14,
            border: `1.5px dashed ${C.divider}`,
            background: "transparent",
            color: C.muted,
            fontFamily: "inherit",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Add new habit
        </button>
      )}
    </div>
  );
}
