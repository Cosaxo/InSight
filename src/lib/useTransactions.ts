// useTransactions — your money in / money out log. Same pattern as
// the other typed item hooks (useMeals / useWorkouts / etc).
// localStorage when signed out, Firestore subscription at
// insight_users/{uid}/insight_transactions/{id} when signed in.

import { useCallback, useEffect, useState } from "react";
import type { Transaction } from "../types";
import {
  addTransaction,
  deleteTransaction,
  firebaseEnabled,
  subscribeTransactions,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.transactions.v1";

function readLocal(): Transaction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as Transaction[];
  } catch {
    return [];
  }
}

function writeLocal(items: Transaction[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useTransactions(): {
  items: Transaction[];
  add: (t: Omit<Transaction, "id">) => Promise<Transaction>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<Transaction[]>(() => readLocal());
  const [remote, setRemote] = useState<Transaction[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeTransactions(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (t: Omit<Transaction, "id">): Promise<Transaction> => {
      const next: Transaction = { ...t, id: makeId() };
      const updated = [next, ...items];
      setLocal(updated);
      writeLocal(updated);
      if (isSignedIn && user) {
        await addTransaction(user.uid, next);
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
        await deleteTransaction(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { items, add, remove };
}
