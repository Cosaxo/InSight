// useLedger — the five "life-history" hooks for the ledger section:
// useBooks, useVisits, useHomes, useLanguages, useJobs.
//
// They all share the same shape (subscribe / add / remove) and the
// same localStorage-then-Firestore pattern as the other typed-item
// hooks (useMeals / useImpressions / useWeighins / etc.), so we
// generate them with one small factory rather than five separate
// files of near-identical boilerplate.
//
// Each exported hook returns `{ items, add, remove }` over its
// respective collection.

import { useCallback, useEffect, useState } from "react";
import type {
  Achievement,
  Book,
  Home,
  Job,
  Language,
  Skill,
  Visit,
} from "../types";
import {
  addAchievement,
  addBook,
  addHome,
  addJob,
  addLanguage,
  addProfileSkill,
  addVisit,
  deleteAchievement,
  deleteBook,
  deleteHome,
  deleteJob,
  deleteLanguage,
  deleteProfileSkill,
  deleteVisit,
  firebaseEnabled,
  subscribeAchievements,
  subscribeBooks,
  subscribeHomes,
  subscribeJobs,
  subscribeLanguages,
  subscribeProfileSkills,
  subscribeVisits,
} from "./firebase";
import { useAuth } from "./useAuth";

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

// Each ledger entity stores `id` + `createdAt` plus its own fields.
// The factory below knows nothing of the per-entity shape — it just
// passes opaque objects through.
interface LedgerItem {
  id: string;
  createdAt: number;
}

interface LedgerOps<T extends LedgerItem> {
  storageKey: string;
  subscribe: (uid: string, cb: (items: T[]) => void) => () => void;
  add: (uid: string, item: T) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
}

function useLedgerCollection<T extends LedgerItem>(
  ops: LedgerOps<T>,
): {
  items: T[];
  add: (item: Omit<T, "id" | "createdAt">) => Promise<T>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<T[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(ops.storageKey) || "[]") as T[];
    } catch {
      return [];
    }
  });
  const [remote, setRemote] = useState<T[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = ops.subscribe(user.uid, (items) => {
      setRemote(items);
      localStorage.setItem(ops.storageKey, JSON.stringify(items));
    });
    return unsub;
    // ops is created at module scope and is stable; user/isSignedIn are
    // the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote || local : local;

  const add = useCallback(
    async (item: Omit<T, "id" | "createdAt">): Promise<T> => {
      const next = { ...item, id: makeId(), createdAt: Date.now() } as T;
      const updated = [next, ...items];
      setLocal(updated);
      localStorage.setItem(ops.storageKey, JSON.stringify(updated));
      if (isSignedIn && user) {
        await ops.add(user.uid, next);
      }
      return next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, isSignedIn, user],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const updated = items.filter((x) => x.id !== id);
      setLocal(updated);
      localStorage.setItem(ops.storageKey, JSON.stringify(updated));
      if (isSignedIn && user) {
        await ops.remove(user.uid, id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, isSignedIn, user],
  );

  return { items, add, remove };
}

const BOOK_OPS: LedgerOps<Book> = {
  storageKey: "insight.books.v1",
  subscribe: subscribeBooks,
  add: addBook,
  remove: deleteBook,
};
export function useBooks() {
  return useLedgerCollection<Book>(BOOK_OPS);
}

const VISIT_OPS: LedgerOps<Visit> = {
  storageKey: "insight.visits.v1",
  subscribe: subscribeVisits,
  add: addVisit,
  remove: deleteVisit,
};
export function useVisits() {
  return useLedgerCollection<Visit>(VISIT_OPS);
}

const HOME_OPS: LedgerOps<Home> = {
  storageKey: "insight.homes.v1",
  subscribe: subscribeHomes,
  add: addHome,
  remove: deleteHome,
};
export function useHomes() {
  return useLedgerCollection<Home>(HOME_OPS);
}

const LANGUAGE_OPS: LedgerOps<Language> = {
  storageKey: "insight.languages.v1",
  subscribe: subscribeLanguages,
  add: addLanguage,
  remove: deleteLanguage,
};
export function useLanguages() {
  return useLedgerCollection<Language>(LANGUAGE_OPS);
}

const JOB_OPS: LedgerOps<Job> = {
  storageKey: "insight.jobs.v1",
  subscribe: subscribeJobs,
  add: addJob,
  remove: deleteJob,
};
export function useJobs() {
  return useLedgerCollection<Job>(JOB_OPS);
}

const PROFILE_SKILL_OPS: LedgerOps<Skill> = {
  storageKey: "insight.profile_skills.v1",
  subscribe: subscribeProfileSkills,
  add: addProfileSkill,
  remove: deleteProfileSkill,
};
export function useProfileSkills() {
  return useLedgerCollection<Skill>(PROFILE_SKILL_OPS);
}

const ACHIEVEMENT_OPS: LedgerOps<Achievement> = {
  storageKey: "insight.achievements.v1",
  subscribe: subscribeAchievements,
  add: addAchievement,
  remove: deleteAchievement,
};
export function useAchievements() {
  return useLedgerCollection<Achievement>(ACHIEVEMENT_OPS);
}
