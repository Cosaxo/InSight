// useHabits — user habit completions. Each habit doc holds an array of
// ISO YYYY-MM-DD strings recording the days it was completed.
//
// The IS_DATA seed exposes a `done`/`streak`/`week` shape for the
// HabitsTab "Today" card. We translate between the seed's per-habit
// name and a Habit doc keyed by a slug of the name (so toggling
// today's checkmark on "Tea" hits a stable doc id across reloads).

import { useEffect, useState } from "react";
import type { Habit } from "../types";
import {
  addHabit,
  deleteHabit,
  firebaseEnabled,
  subscribeHabits,
  updateHabit,
} from "./firebase";
import { useAuth } from "./useAuth";
import { isoDateToday } from "./useMoods";

const STORAGE = "insight.habits.v1";

function readLocal(): Habit[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Habit[];
  } catch {
    return [];
  }
}

function writeLocal(items: Habit[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function useHabits(): {
  habits: Habit[];
  isDoneToday: (name: string) => boolean;
  toggleToday: (name: string, color: string, icon?: string) => Promise<void>;
  add: (name: string, color: string, icon?: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Habit[]>(() => readLocal());
  const [remote, setRemote] = useState<Habit[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeHabits(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const habits = isSignedIn ? remote || local : local;

  const isDoneToday = (name: string): boolean => {
    const today = isoDateToday();
    const id = slugify(name);
    const h = habits.find((x) => x.id === id);
    return !!h?.completions?.includes(today);
  };

  const toggleToday = async (
    name: string,
    color: string,
    icon = "·",
  ): Promise<void> => {
    const today = isoDateToday();
    const id = slugify(name);
    const existing = habits.find((x) => x.id === id);
    const wasDone = !!existing?.completions?.includes(today);
    const completions = wasDone
      ? (existing!.completions || []).filter((d) => d !== today)
      : [...(existing?.completions || []), today];

    const next: Habit = {
      id,
      name,
      color,
      icon,
      completions,
    };

    // Update local immediately for snappy UI.
    const updatedLocal = [...habits.filter((x) => x.id !== id), next];
    setLocal(updatedLocal);
    writeLocal(updatedLocal);

    if (isSignedIn && user) {
      if (existing) {
        await updateHabit(user.uid, id, { completions });
      } else {
        await addHabit(user.uid, next);
      }
    }
  };

  const add = async (
    name: string,
    color: string,
    icon = "·",
  ): Promise<void> => {
    const id = slugify(name);
    if (habits.some((h) => h.id === id)) return;
    const next: Habit = { id, name, color, icon, completions: [] };
    const updated = [...habits, next];
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await addHabit(user.uid, next);
    }
  };

  const remove = async (name: string): Promise<void> => {
    const id = slugify(name);
    const updated = habits.filter((h) => h.id !== id);
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await deleteHabit(user.uid, id);
    }
  };

  return { habits, isDoneToday, toggleToday, add, remove };
}
