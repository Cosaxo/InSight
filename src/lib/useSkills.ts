// useSkills — user-tracked skills/practices for the Groups tab.
// localStorage when signed-out, Firestore subscription
// (insight_users/{uid}/insight_skills) when signed-in. Same dual-mode
// pattern as useRelations / useMoods.

import { useEffect, useState } from "react";
import {
  addSkill,
  deleteSkill,
  firebaseEnabled,
  subscribeSkills,
  updateSkill,
  type RemoteSkill,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.skills.v1";

export type UserSkill = RemoteSkill;

function readLocal(): UserSkill[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as UserSkill[];
  } catch {
    return [];
  }
}

function writeLocal(items: UserSkill[]): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(items));
  } catch {
    // quota / private mode — sync still works when signed in
  }
}

export function useSkills(): {
  skills: UserSkill[];
  add: (s: Omit<UserSkill, "id">) => Promise<void>;
  update: (id: string, patch: Partial<UserSkill>) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<UserSkill[]>(() => readLocal());
  const [remote, setRemote] = useState<UserSkill[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeSkills(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const skills = isSignedIn ? remote || local : local;

  const add = async (input: Omit<UserSkill, "id">) => {
    const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next: UserSkill = { ...input, id };
    const updated = [...skills, next];
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await addSkill(user.uid, next);
    }
  };

  const update = async (id: string, patch: Partial<UserSkill>) => {
    const updated = skills.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await updateSkill(user.uid, id, patch);
    }
  };

  const remove = async (id: string) => {
    const updated = skills.filter((s) => s.id !== id);
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await deleteSkill(user.uid, id);
    }
  };

  return { skills, add, update, remove };
}
