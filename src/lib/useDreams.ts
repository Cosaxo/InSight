// useDreams — dream journal entries. Same pattern as useMeals /
// useImpressions / useScrapbook: localStorage when signed out,
// Firestore subscription at insight_users/{uid}/insight_dreams/{id}
// when signed in, optimistic local writes.

import { useCallback, useEffect, useState } from "react";
import type { Dream } from "../types";
import {
  addDream,
  deleteDream,
  firebaseEnabled,
  subscribeDreams,
  updateDream,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.dreams.v1";

function readLocal(): Dream[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Dream[];
  } catch {
    return [];
  }
}

function writeLocal(items: Dream[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useDreams(): {
  items: Dream[];
  add: (d: Omit<Dream, "id" | "createdAt">) => Promise<Dream>;
  update: (id: string, patch: Partial<Dream>) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Dream[]>(() => readLocal());
  const [remote, setRemote] = useState<Dream[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeDreams(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (d: Omit<Dream, "id" | "createdAt">): Promise<Dream> => {
      const next: Dream = { ...d, id: makeId(), createdAt: Date.now() };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await addDream(user.uid, next);
      }
      return next;
    },
    [items, isSignedIn, user],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Dream>): Promise<void> => {
      const updated = items.map((d) => (d.id === id ? { ...d, ...patch } : d));
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await updateDream(user.uid, id, patch);
      }
    },
    [items, isSignedIn, user],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const updated = items.filter((d) => d.id !== id);
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await deleteDream(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { items, add, update, remove };
}
