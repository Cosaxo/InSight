// useWorkouts — logged training sessions. Mirrors useMeals /
// useImpressions / useScrapbook: localStorage when signed out,
// Firestore subscription at insight_users/{uid}/insight_workouts/{id}
// when signed in, optimistic local writes.

import { useCallback, useEffect, useState } from "react";
import type { Workout } from "../types";
import {
  addWorkout,
  deleteWorkout,
  firebaseEnabled,
  subscribeWorkouts,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.workouts.v1";

function readLocal(): Workout[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Workout[];
  } catch {
    return [];
  }
}

function writeLocal(items: Workout[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useWorkouts(): {
  items: Workout[];
  add: (w: Omit<Workout, "id">) => Promise<Workout>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Workout[]>(() => readLocal());
  const [remote, setRemote] = useState<Workout[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeWorkouts(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (w: Omit<Workout, "id">): Promise<Workout> => {
      const next: Workout = { ...w, id: makeId() };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await addWorkout(user.uid, next);
      }
      return next;
    },
    [items, isSignedIn, user],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const updated = items.filter((x) => x.id !== id);
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await deleteWorkout(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { items, add, remove };
}
