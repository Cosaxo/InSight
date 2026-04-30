import { useState } from "react";
import type { ComponentType } from "react";
import { C, SEC } from "../../theme";
import type { SectionKey } from "../../theme";
import type {
  Habit,
  InsightTabId,
  Meal,
  MoodEntry,
  Transaction,
  Workout,
} from "../../types";
import { Toast } from "../shared/Toast";
import { IcoBack } from "../icons/UtilIcons";
import {
  IcoFinance,
  IcoFitness,
  IcoHabit,
  IcoMood,
  IcoNutrition,
} from "../icons/InsightTabIcons";
import { MoodPanel } from "./insights/MoodPanel";
import { HabitsPanel } from "./insights/HabitsPanel";
import { FitnessPanel } from "./insights/FitnessPanel";
import { NutritionPanel } from "./insights/NutritionPanel";
import { FinancePanel } from "./insights/FinancePanel";

interface InsightsPanelProps {
  onClose: () => void;
  moods: MoodEntry[];
  habits: Habit[];
  workouts: Workout[];
  meals: Meal[];
  transactions: Transaction[];
  onLogMood: (entry: MoodEntry) => void;
  onDeleteMood: (date: string) => void;
  onToggleHabit: (id: string) => void;
  onAddHabit: (name: string) => void;
  onLogWorkout: (w: Omit<Workout, "id">) => void;
  onLogMeal: (m: Omit<Meal, "id">) => void;
  onLogTransaction: (t: Omit<Transaction, "id">) => void;
}

interface InsightTab {
  id: InsightTabId;
  label: string;
  Ico: ComponentType<{ col: string }>;
  sec: SectionKey;
}

const TABS: InsightTab[] = [
  { id: "mood", label: "Mood", Ico: IcoMood, sec: "mood" },
  { id: "habits", label: "Habits", Ico: IcoHabit, sec: "habits" },
  { id: "fitness", label: "Fitness", Ico: IcoFitness, sec: "fitness" },
  { id: "nutrition", label: "Nutrition", Ico: IcoNutrition, sec: "nutrition" },
  { id: "finance", label: "Finance", Ico: IcoFinance, sec: "finance" },
];

interface ToastState {
  message: string;
  color: string;
  icon: string;
}

export function InsightsPanel({
  onClose,
  moods,
  habits,
  workouts,
  meals,
  transactions,
  onLogMood,
  onDeleteMood,
  onToggleHabit,
  onAddHabit,
  onLogWorkout,
  onLogMeal,
  onLogTransaction,
}: InsightsPanelProps) {
  const [tab, setTab] = useState<InsightTabId>("mood");
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, color: string, icon: string) {
    setToast({ message, color, icon });
    setTimeout(() => setToast(null), 1600);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {toast && (
        <Toast message={toast.message} color={toast.color} icon={toast.icon} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onClose}
          aria-label="Close insights"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: "pointer",
            display: "flex",
            flexShrink: 0,
          }}
        >
          <IcoBack col={C.teal} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
          Personal Insights
        </div>
      </div>

      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          background: C.dim,
          borderRadius: 16,
          padding: 4,
          border: `1px solid ${C.divider}`,
        }}
      >
        {TABS.map(({ id, label, Ico, sec }) => {
          const active = tab === id;
          const secColor = SEC[sec].accent;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "9px 2px",
                cursor: "pointer",
                borderRadius: 12,
                background: active ? "#fff" : "transparent",
                boxShadow: active ? `0 2px 10px ${secColor}28` : "none",
                fontFamily: "inherit",
                transition:
                  "background 0.2s cubic-bezier(.4,0,.2,1), box-shadow 0.2s",
                border: "none",
              }}
            >
              <Ico col={active ? secColor : C.muted} />
              <span
                style={{
                  fontSize: 10,
                  color: active ? secColor : C.muted,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "mood" && (
        <MoodPanel
          moods={moods}
          onLog={onLogMood}
          onDelete={onDeleteMood}
          onToast={showToast}
        />
      )}
      {tab === "habits" && (
        <HabitsPanel
          habits={habits}
          onToggle={onToggleHabit}
          onAdd={onAddHabit}
          onToast={showToast}
        />
      )}
      {tab === "fitness" && (
        <FitnessPanel
          workouts={workouts}
          onLog={onLogWorkout}
          onToast={showToast}
        />
      )}
      {tab === "nutrition" && (
        <NutritionPanel
          meals={meals}
          onLog={onLogMeal}
          onToast={showToast}
        />
      )}
      {tab === "finance" && (
        <FinancePanel
          transactions={transactions}
          onLog={onLogTransaction}
          onToast={showToast}
        />
      )}
    </div>
  );
}
