// useRelations — user-added people for the People tab. Stored under
// insight.relations.v1 (localStorage) and insight_users/{uid}/relations
// (Firestore) when signed in. The Firestore wire uses the legacy
// `Person` shape with extra circle-tab fields appended; we hide the
// shape difference here.

import { useEffect, useState } from "react";
import type { Person } from "../types";
import {
  addRelation,
  deleteRelation,
  firebaseEnabled,
  subscribeRelations,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.relations.v1";

export interface UserPerson {
  id: string;
  name: string;
  init: string;
  hue: number;
  match: number;
  rel: string;
  category: string;
  degrees: number;
  since: string;
}

function readLocal(): UserPerson[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as UserPerson[];
  } catch {
    return [];
  }
}

function writeLocal(items: UserPerson[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(items));
}

// Convert UserPerson → Person for the legacy Firestore schema. The
// legacy Person fields the schema requires get default values; the
// circle-tab fields ride along on the same doc.
function toPerson(p: UserPerson): Person {
  return {
    id: p.id,
    name: p.name,
    init: p.init,
    color: `oklch(0.55 0.12 ${p.hue})`,
    personality: [50, 50, 50, 50, 50],
    political: { econ: 0, social: 0 },
    cv: { indiv: 0, change: 0 },
    interests: [],
    category: undefined,
    match: p.match,
    // Extra fields below are stored alongside the schema and read back
    // verbatim. Cast to keep the legacy Person type happy.
    ...({ hue: p.hue, rel: p.rel, customCategory: p.category, degrees: p.degrees, since: p.since } as Partial<Person>),
  };
}

interface RemotePersonLike extends Person {
  hue?: number;
  rel?: string;
  customCategory?: string;
  degrees?: number;
  since?: string;
}

function fromPerson(p: RemotePersonLike): UserPerson {
  // Try to recover hue from a stored field, else parse from color
  // string, else fall back to a neutral.
  const hue =
    typeof p.hue === "number"
      ? p.hue
      : (() => {
          const m = /oklch\([^,]+\s+[^,]+\s+([\d.]+)\)/i.exec(p.color);
          return m ? Math.round(parseFloat(m[1])) : 38;
        })();
  return {
    id: p.id,
    name: p.name,
    init: p.init,
    hue,
    match: p.match ?? 50,
    rel: p.rel ?? "in your orbit",
    category: p.customCategory ?? p.category ?? "acquaintances",
    degrees: p.degrees ?? 1,
    since: p.since ?? String(new Date().getFullYear()),
  };
}

export function useRelations(): {
  people: UserPerson[];
  add: (p: Omit<UserPerson, "id">) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<UserPerson[]>(() => readLocal());
  const [remote, setRemote] = useState<UserPerson[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeRelations(user.uid, (items) => {
      const mapped = (items as RemotePersonLike[]).map(fromPerson);
      setRemote(mapped);
      writeLocal(mapped);
    });
    return unsub;
  }, [isSignedIn, user]);

  const people = isSignedIn ? remote || local : local;

  const add = async (input: Omit<UserPerson, "id">) => {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next: UserPerson = { ...input, id };
    const updated = [...people, next];
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await addRelation(user.uid, toPerson(next));
    }
  };

  const remove = async (id: string) => {
    const updated = people.filter((p) => p.id !== id);
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await deleteRelation(user.uid, id);
    }
  };

  return { people, add, remove };
}
