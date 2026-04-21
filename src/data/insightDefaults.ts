import { C } from "../theme";
import type { Habit, Meal, MoodEntry, Transaction, Workout } from "../types";

export const TODAY = new Date().toISOString().split("T")[0];

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export const MOOD_EMOJI = ["", "😢", "😕", "😐", "🙂", "😄"];
export const MOOD_COLOR = ["", C.red, C.coral, C.amber, C.green, C.teal];
export const MOOD_LABEL = ["", "Rough", "Low", "Okay", "Good", "Great"];

export const EXPENSE_CATS = [
  "Food",
  "Transport",
  "Health",
  "Shopping",
  "Entertainment",
  "Other",
];

export const INCOME_CATS = ["Salary", "Freelance", "Other"];

export const WORKOUT_TYPES = [
  "Run",
  "Walk",
  "Cycle",
  "Swim",
  "Strength",
  "HIIT",
  "Yoga",
  "Other",
] as const;

export const INTENSITY_KCAL = { Low: 200, Medium: 350, High: 500 } as const;

// These seed the app so new users see realistic data immediately.
// Once anything is logged, the real values replace them via localStorage.
export const DEFAULT_HABITS: Habit[] = [
  { id: "h1", name: "Meditate", icon: "◉", color: C.purple, completions: [] },
  {
    id: "h2",
    name: "Exercise",
    icon: "◈",
    color: C.teal,
    completions: [daysAgo(0), daysAgo(1), daysAgo(3)],
  },
  {
    id: "h3",
    name: "Read",
    icon: "◆",
    color: C.amber,
    completions: [daysAgo(0), daysAgo(2)],
  },
  {
    id: "h4",
    name: "Cold shower",
    icon: "★",
    color: C.cyan,
    completions: [daysAgo(0), daysAgo(1)],
  },
  {
    id: "h5",
    name: "No alcohol",
    icon: "✦",
    color: C.green,
    completions: [
      daysAgo(0),
      daysAgo(1),
      daysAgo(2),
      daysAgo(3),
      daysAgo(4),
      daysAgo(5),
    ],
  },
];

export const DEFAULT_WORKOUTS: Workout[] = [
  {
    id: "w1",
    date: daysAgo(0),
    type: "Run",
    duration: 35,
    intensity: "Medium",
    kcal: 310,
    notes: "Morning run",
  },
  {
    id: "w2",
    date: daysAgo(2),
    type: "Strength",
    duration: 50,
    intensity: "High",
    kcal: 420,
    notes: "Chest & back",
  },
  {
    id: "w3",
    date: daysAgo(4),
    type: "Cycle",
    duration: 60,
    intensity: "Medium",
    kcal: 480,
    notes: "City loop",
  },
];

export const DEFAULT_MEALS: Meal[] = [
  { id: "m1", date: TODAY, name: "Oatmeal", kcal: 320, protein: 12, carbs: 55, fat: 6 },
  {
    id: "m2",
    date: TODAY,
    name: "Chicken salad",
    kcal: 450,
    protein: 38,
    carbs: 22,
    fat: 14,
  },
  {
    id: "m3",
    date: daysAgo(1),
    name: "Pasta",
    kcal: 680,
    protein: 28,
    carbs: 90,
    fat: 12,
  },
];

export const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: "t1", date: TODAY, type: "expense", category: "Food", amount: 120, note: "Groceries" },
  {
    id: "t2",
    date: TODAY,
    type: "expense",
    category: "Transport",
    amount: 45,
    note: "Monthly pass",
  },
  {
    id: "t3",
    date: daysAgo(1),
    type: "income",
    category: "Salary",
    amount: 4800,
    note: "March salary",
  },
  {
    id: "t4",
    date: daysAgo(2),
    type: "expense",
    category: "Food",
    amount: 280,
    note: "Restaurant",
  },
  {
    id: "t5",
    date: daysAgo(3),
    type: "expense",
    category: "Health",
    amount: 150,
    note: "Gym month",
  },
  {
    id: "t6",
    date: daysAgo(5),
    type: "expense",
    category: "Shopping",
    amount: 340,
    note: "Clothing",
  },
  {
    id: "t7",
    date: daysAgo(6),
    type: "income",
    category: "Freelance",
    amount: 1200,
    note: "Project",
  },
];

export const DEFAULT_MOODS: MoodEntry[] = [
  { date: daysAgo(0), score: 4, note: "Productive day, good energy" },
  { date: daysAgo(1), score: 3, note: "Tired from late night" },
  { date: daysAgo(2), score: 5, note: "Amazing workout and sunshine" },
  { date: daysAgo(3), score: 4, note: "Good meetings, flow state" },
  { date: daysAgo(4), score: 2, note: "Stressed about deadline" },
  { date: daysAgo(5), score: 4, note: "Relaxed weekend" },
  { date: daysAgo(6), score: 5, note: "Hiking day" },
];

const HABIT_ICONS = ["★", "◆", "◈", "◉", "✦"];
const HABIT_COLS = [C.purple, C.teal, C.coral, C.green, C.amber];

export function nextHabitStyle(count: number): { icon: string; color: string } {
  const idx = count % HABIT_ICONS.length;
  return { icon: HABIT_ICONS[idx], color: HABIT_COLS[idx] };
}

export function streakFor(completions: string[]): number {
  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = d.toISOString().split("T")[0];
    if (!completions.includes(ds)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
