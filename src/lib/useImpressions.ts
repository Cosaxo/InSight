// useImpressions — your private "of others" ledger. Each entry is
// a sketch of a person you've met, never shared with anyone. Stored
// at insight_users/{uid}/insight_impressions/{id} when signed in or
// in localStorage otherwise.
//
// The "of you" side of the ImpressionsOverlay (anonymous incoming
// impressions from others) is a separate feature and not backed by
// this hook — it would need a friend-feedback flow that doesn't
// exist yet, so that side renders an honest empty-state instead.

import { useCallback, useEffect, useState } from "react";
import type { Impression } from "../types";
import {
  addImpression,
  deleteImpression,
  firebaseEnabled,
  subscribeImpressions,
  updateImpression,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.impressions.v1";

function readLocal(): Impression[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Impression[];
  } catch {
    return [];
  }
}

function writeLocal(items: Impression[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useImpressions(): {
  items: Impression[];
  add: (i: Omit<Impression, "id" | "createdAt">) => Promise<Impression>;
  update: (id: string, patch: Partial<Impression>) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Impression[]>(() => readLocal());
  const [remote, setRemote] = useState<Impression[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeImpressions(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (i: Omit<Impression, "id" | "createdAt">): Promise<Impression> => {
      const next: Impression = {
        ...i,
        id: makeId(),
        createdAt: Date.now(),
      };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await addImpression(user.uid, next);
      }
      return next;
    },
    [items, isSignedIn, user],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Impression>): Promise<void> => {
      const updated = items.map((s) => (s.id === id ? { ...s, ...patch } : s));
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await updateImpression(user.uid, id, patch);
      }
    },
    [items, isSignedIn, user],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const updated = items.filter((s) => s.id !== id);
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await deleteImpression(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { items, add, update, remove };
}
