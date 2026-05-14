// useTimeBlocks — logged time-tracking sessions (real events, not
// the daily template). Mirrors the standard typed-item hook
// pattern.

import { useCallback, useEffect, useState } from "react";
import type { TimeBlock } from "../types";
import {
  addTimeBlock,
  deleteTimeBlock,
  firebaseEnabled,
  subscribeTimeBlocks,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.time_blocks.v1";

function readLocal(): TimeBlock[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as TimeBlock[];
  } catch {
    return [];
  }
}

function writeLocal(items: TimeBlock[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useTimeBlocks(): {
  items: TimeBlock[];
  add: (t: Omit<TimeBlock, "id" | "createdAt">) => Promise<TimeBlock>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<TimeBlock[]>(() => readLocal());
  const [remote, setRemote] = useState<TimeBlock[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeTimeBlocks(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (t: Omit<TimeBlock, "id" | "createdAt">): Promise<TimeBlock> => {
      const next: TimeBlock = { ...t, id: makeId(), createdAt: Date.now() };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) await addTimeBlock(user.uid, next);
      return next;
    },
    [items, isSignedIn, user],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const updated = items.filter((x) => x.id !== id);
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) await deleteTimeBlock(user.uid, id);
    },
    [items, isSignedIn, user],
  );

  return { items, add, remove };
}
