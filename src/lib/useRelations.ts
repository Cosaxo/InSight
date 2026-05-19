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
  grantCircleAccess,
  revokeCircleAccess,
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
  // When this relation is linked to an actual InSight user, store
  // their uid. Used for the friend feed: presence of linkedUid means
  // "this person exists in our database; I've granted them daily-
  // report access; I might be able to see theirs if they reciprocate."
  linkedUid?: string;
  // Optional Big Five vector [O, C, E, A, N] — 0..100 per axis. Set
  // by the user from PersonOverlay's "rate" editor. Undefined when
  // the user hasn't rated them yet; CirclePortrait in AroundTab uses
  // these to average the circle vs the user's own.
  personality?: number[];
  // Optional 6-axis politics: econ / social / foreign / env / tech /
  // auth, each -100..+100. Same provenance as `personality` — set
  // via PersonOverlay's politics rating editor.
  politicalAxes?: Record<string, number>;
  // Optional 8-axis morals: tech / future / duty / hedonism /
  // meaning / moral / altruism / beauty, each -100..+100.
  morals?: Record<string, number>;
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
// Exported for App.tsx's first-sign-in migration, which reads
// UserPerson[] from localStorage and needs to push Person[] up to
// Firestore (matches the legacy schema the migration expects).
export function userPersonToPerson(p: UserPerson): Person {
  return toPerson(p);
}

function toPerson(p: UserPerson): Person {
  // Derive the 2-axis political from the stored 6-axis when present —
  // keeps the legacy Person schema fields populated with something
  // meaningful rather than the [0,0] placeholder.
  const econ = p.politicalAxes?.econ ?? 0;
  const social = p.politicalAxes?.social ?? 0;
  return {
    id: p.id,
    name: p.name,
    init: p.init,
    color: `oklch(0.55 0.12 ${p.hue})`,
    personality: p.personality ?? [50, 50, 50, 50, 50],
    political: { econ, social },
    cv: { indiv: 0, change: 0 },
    interests: [],
    category: undefined,
    match: p.match,
    // Extra fields below are stored alongside the schema and read back
    // verbatim. Cast to keep the legacy Person type happy.
    ...({
      hue: p.hue,
      rel: p.rel,
      customCategory: p.category,
      degrees: p.degrees,
      since: p.since,
      linkedUid: p.linkedUid,
      hasPersonality: p.personality !== undefined,
      politicalAxes: p.politicalAxes,
      morals: p.morals,
      hasPolitical: p.politicalAxes !== undefined,
      hasMorals: p.morals !== undefined,
    } as Partial<Person>),
  };
}

interface RemotePersonLike extends Person {
  hue?: number;
  rel?: string;
  customCategory?: string;
  degrees?: number;
  since?: string;
  linkedUid?: string;
  // Whether p.personality is a real user rating vs the [50,50,50,50,50]
  // placeholder we write when there's no rating. Lets fromPerson
  // distinguish set-but-neutral from never-rated.
  hasPersonality?: boolean;
  // Same idea for politics + morals.
  hasPolitical?: boolean;
  hasMorals?: boolean;
  politicalAxes?: Record<string, number>;
  morals?: Record<string, number>;
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
    linkedUid: p.linkedUid,
    personality:
      p.hasPersonality && Array.isArray(p.personality) && p.personality.length === 5
        ? p.personality
        : undefined,
    politicalAxes:
      p.hasPolitical && p.politicalAxes ? p.politicalAxes : undefined,
    morals: p.hasMorals && p.morals ? p.morals : undefined,
  };
}

export function useRelations(): {
  people: UserPerson[];
  add: (p: Omit<UserPerson, "id">) => Promise<void>;
  update: (id: string, patch: Partial<UserPerson>) => Promise<void>;
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
      // Adding someone with a linked uid auto-grants them daily-
      // report read access — symmetric reciprocity is up to them.
      if (next.linkedUid) {
        try {
          await grantCircleAccess(user.uid, next.linkedUid);
        } catch (err) {
          console.error("[useRelations] grant circle failed:", err);
        }
      }
    }
  };

  const update = async (id: string, patch: Partial<UserPerson>) => {
    const current = people.find((p) => p.id === id);
    if (!current) return;
    const next: UserPerson = { ...current, ...patch, id };
    const updated = people.map((p) => (p.id === id ? next : p));
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      // Re-write the whole Person doc through addRelation; setDoc
      // overwrites by id on the Firestore side. This avoids a
      // separate updateRelation op for now.
      await addRelation(user.uid, toPerson(next));
    }
  };

  const remove = async (id: string) => {
    const victim = people.find((p) => p.id === id);
    const updated = people.filter((p) => p.id !== id);
    setLocal(updated);
    writeLocal(updated);
    if (isSignedIn && user) {
      await deleteRelation(user.uid, id);
      // Revoke the grant we made when adding — they can no longer
      // read our daily report.
      if (victim?.linkedUid) {
        try {
          await revokeCircleAccess(user.uid, victim.linkedUid);
        } catch (err) {
          console.error("[useRelations] revoke circle failed:", err);
        }
      }
    }
  };

  return { people, add, update, remove };
}
