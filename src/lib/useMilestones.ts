// useMilestones — life-timeline events. Mirrors the standard
// typed-item hook pattern: localStorage when signed out, Firestore
// subscription at insight_users/{uid}/insight_milestones/{id} when
// signed in, optimistic local writes.

import { useCallback, useEffect, useState } from "react";
import type { Milestone } from "../types";
import {
  addMilestone,
  deleteMilestone,
  firebaseEnabled,
  subscribeMilestones,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.milestones.v1";

function readLocal(): Milestone[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Milestone[];
  } catch {
    return [];
  }
}

function writeLocal(items: Milestone[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useMilestones(): {
  items: Milestone[];
  add: (m: Omit<Milestone, "id" | "createdAt">) => Promise<Milestone>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Milestone[]>(() => readLocal());
  const [remote, setRemote] = useState<Milestone[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeMilestones(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (m: Omit<Milestone, "id" | "createdAt">): Promise<Milestone> => {
      const next: Milestone = { ...m, id: makeId(), createdAt: Date.now() };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) await addMilestone(user.uid, next);
      return next;
    },
    [items, isSignedIn, user],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const updated = items.filter((x) => x.id !== id);
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) await deleteMilestone(user.uid, id);
    },
    [items, isSignedIn, user],
  );

  return { items, add, remove };
}
