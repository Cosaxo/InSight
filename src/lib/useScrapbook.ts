// useScrapbook — your field-journal specimens. Each entry is a real
// thing you've noticed and want to remember (plants, birds, fungi,
// landmarks, etc), persisted at insight_users/{uid}/insight_scrapbook/
// {id} when signed in or in localStorage otherwise.
//
// No fake "AI identifies your photo" step — capture is just a small
// form. If you later wire iNaturalist or similar, drop the call into
// `add()` to enrich latin + conf before saving.

import { useCallback, useEffect, useState } from "react";
import type { Specimen } from "../types";
import {
  addSpecimen,
  deleteSpecimen,
  firebaseEnabled,
  subscribeScrapbook,
  updateSpecimen,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.scrapbook.v1";

function readLocal(): Specimen[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Specimen[];
  } catch {
    return [];
  }
}

function writeLocal(items: Specimen[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  // Short random id is fine — Firestore enforces per-user uniqueness
  // via the doc path and collisions in 36^10 are negligible for a
  // personal scrapbook.
  return Math.random().toString(36).slice(2, 12);
}

export function useScrapbook(): {
  items: Specimen[];
  add: (s: Omit<Specimen, "id" | "createdAt">) => Promise<Specimen>;
  update: (id: string, patch: Partial<Specimen>) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Specimen[]>(() => readLocal());
  const [remote, setRemote] = useState<Specimen[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeScrapbook(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (s: Omit<Specimen, "id" | "createdAt">): Promise<Specimen> => {
      const next: Specimen = {
        ...s,
        id: makeId(),
        createdAt: Date.now(),
      };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await addSpecimen(user.uid, next);
      }
      return next;
    },
    [items, isSignedIn, user],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Specimen>): Promise<void> => {
      const updated = items.map((s) => (s.id === id ? { ...s, ...patch } : s));
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await updateSpecimen(user.uid, id, patch);
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
        await deleteSpecimen(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { items, add, update, remove };
}
