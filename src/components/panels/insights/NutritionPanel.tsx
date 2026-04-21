import { useState } from "react";
import { C } from "../../../theme";
import { TODAY } from "../../../data/insightDefaults";
import type { Meal } from "../../../types";
import { Card } from "../../shared/Card";
import { SLabel } from "../../shared/SLabel";
import { BarFill } from "../../shared/BarFill";
import { StatIco } from "../../icons/StatIcons";

interface NutritionPanelProps {
  meals: Meal[];
  onLog: (m: Omit<Meal, "id">) => void;
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

const KCAL_TARGET = 2000;
const PROTEIN_TARGET = 150;

export function NutritionPanel({ meals, onLog, onToast }: NutritionPanelProps) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");

  function submit() {
    if (!name) return;
    onLog({
      date: TODAY,
      name,
      kcal: Number(kcal) || 0,
      protein: Number(protein) || 0,
      carbs: 0,
      fat: 0,
    });
    onToast("Meal logged", C.red, "✓");
    setName("");
    setKcal("");
    setProtein("");
    setShow(false);
  }

  const todayMeals = meals.filter((m) => m.date === TODAY);
  const todayKcal = todayMeals.reduce((s, m) => s + m.kcal, 0);
  const todayProtein = todayMeals.reduce((s, m) => s + m.protein, 0);
  const kcalPct = Math.min((todayKcal / KCAL_TARGET) * 201, 201);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card sec="nutrition">
        <SLabel sec="nutrition">Today</SLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              position: "relative",
              width: 80,
              height: 80,
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 80 80"
              style={{ width: 80, height: 80, transform: "rotate(-90deg)" }}
            >
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={C.dim}
                strokeWidth="10"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={C.coral}
                strokeWidth="10"
                strokeDasharray={`${kcalPct} 201`}
                strokeLinecap="round"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: C.coral }}>
                {todayKcal}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>kcal</div>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {[
              {
                label: "Calories",
                val: `${todayKcal} / ${KCAL_TARGET} kcal`,
                pct: (todayKcal / KCAL_TARGET) * 100,
                color: C.coral,
              },
              {
                label: "Protein",
                val: `${todayProtein}g / ${PROTEIN_TARGET}g`,
                pct: (todayProtein / PROTEIN_TARGET) * 100,
                color: C.teal,
              },
            ].map((m) => (
              <div key={m.label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: C.muted }}>{m.label}</span>
                  <span style={{ color: m.color, fontWeight: 600 }}>
                    {m.val}
                  </span>
                </div>
                <BarFill
                  value={Math.min(100, m.pct)}
                  color={m.color}
                  height={5}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {show ? (
        <Card>
          <SLabel>Log meal</SLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name..."
            style={inputStyle}
          />
          <input
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="Calories (kcal)"
            type="number"
            style={inputStyle}
          />
          <input
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="Protein (g)"
            type="number"
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
                background: C.coral,
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
            background: C.coral,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Log meal
        </button>
      )}

      <Card sec="nutrition">
        <SLabel sec="nutrition">Today's meals</SLabel>
        {todayMeals.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: C.muted,
              padding: "16px 0",
              fontSize: 13,
            }}
          >
            No meals logged today
          </div>
        ) : (
          todayMeals.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
                borderBottom:
                  i < todayMeals.length - 1
                    ? `1px solid ${C.divider}`
                    : "none",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "#fff1f2",
                  border: `1px solid ${C.red}25`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <StatIco name="apple" col={C.red} size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>
                  {m.name}
                </div>
                {m.protein > 0 && (
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {m.protein}g protein
                  </div>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.coral }}>
                {m.kcal} kcal
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
