// useWeighins — the user's weight history. Mirrors useMeals /
// useImpressions / useScrapbook / useDreams: localStorage when
// signed out, Firestore subscription at
// insight_users/{uid}/insight_weighins/{id} when signed in,
// optimistic local writes.
//
// Convenience selector `latest` returns the most recent entry by
// date (then by createdAt as tie-breaker) — LifeOverlay reads it
// to scale tissue mass, ProfileOverlay shows it under vital stats.
// When no weigh-ins exist, callers fall back to the static
// `profile.weightKg` field.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Weighin } from "../types";
import {
  addWeighin,
  deleteWeighin,
  firebaseEnabled,
  subscribeWeighins,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.weighins.v1";

function readLocal(): Weighin[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Weighin[];
  } catch {
    return [];
  }
}

function writeLocal(items: Weighin[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useWeighins(): {
  items: Weighin[];
  latest: Weighin | null;
  add: (w: Omit<Weighin, "id" | "createdAt">) => Promise<Weighin>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Weighin[]>(() => readLocal());
  const [remote, setRemote] = useState<Weighin[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeWeighins(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  // Latest = most recent date, tie-breaking on createdAt. Memoised
  // because the consumers (LifeOverlay header, ProfileOverlay
  // vital-stats) read it on every render.
  const latest = useMemo<Weighin | null>(() => {
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : b.createdAt - a.createdAt;
    });
    return sorted[0];
  }, [items]);

  const add = useCallback(
    async (w: Omit<Weighin, "id" | "createdAt">): Promise<Weighin> => {
      const next: Weighin = { ...w, id: makeId(), createdAt: Date.now() };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await addWeighin(user.uid, next);
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
        await deleteWeighin(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { items, latest, add, remove };
}
