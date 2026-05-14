// useMoods — user-logged mood entries (1..5 per day). Driven by the
// DailyReport mood slider (0..100, mapped via dailyMoodToScore).
// Persisted under insight.moods.v1 in localStorage and to Firestore
// at insight_users/{uid}/insight_moods/{YYYY-MM-DD} when signed in.

import { useEffect, useState } from "react";
import type { MoodEntry } from "../types";
import { firebaseEnabled, subscribeMoods, upsertMood } from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.moods.v1";

function readLocal(): MoodEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as MoodEntry[];
  } catch {
    return [];
  }
}

function writeLocal(items: MoodEntry[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

export function isoDateToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Map DailyReport's 0..100 slider to MoodEntry's 1..5 scale.
export function dailyMoodToScore(mood: number): number {
  const score = Math.round(mood / 20);
  return Math.max(1, Math.min(5, score));
}

export function useMoods(): {
  moods: MoodEntry[];
  upsert: (entry: MoodEntry) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<MoodEntry[]>(() => readLocal());
  const [remote, setRemote] = useState<MoodEntry[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeMoods(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const moods = isSignedIn ? remote || local : local;

  const upsert = async (entry: MoodEntry) => {
    const updated = [...moods.filter((m) => m.date !== entry.date), entry];
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await upsertMood(user.uid, entry);
    }
  };

  return { moods, upsert };
}
