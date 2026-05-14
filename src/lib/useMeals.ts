// useMeals — logged meals (kcal + macros) used by BodyOverlay's
// "the table" view. Mirrors the useScrapbook / useImpressions
// pattern: localStorage when signed out, Firestore subscription at
// insight_users/{uid}/insight_meals/{id} when signed in,
// optimistic local writes.

import { useCallback, useEffect, useState } from "react";
import type { Meal } from "../types";
import {
  addMeal,
  deleteMeal,
  firebaseEnabled,
  subscribeMeals,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.meals.v1";

function readLocal(): Meal[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Meal[];
  } catch {
    return [];
  }
}

function writeLocal(items: Meal[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function isoDateToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useMeals(): {
  items: Meal[];
  add: (m: Omit<Meal, "id">) => Promise<Meal>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Meal[]>(() => readLocal());
  const [remote, setRemote] = useState<Meal[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeMeals(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (m: Omit<Meal, "id">): Promise<Meal> => {
      const next: Meal = { ...m, id: makeId() };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await addMeal(user.uid, next);
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
        await deleteMeal(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { items, add, remove };
}
