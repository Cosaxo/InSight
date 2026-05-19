// useInterests — read/write the user's interest list.
//
// An interest is just `{ id, name, cat }` — no level, no hours, no
// milestones. The Interests tab uses these to:
//   - filter the demographics card (who else shares these interests)
//   - bucket community-voted items (best media, best people,
//     best literature, best tips for each interest)
//
// Signed-in: Firestore subscription to
// insight_users/{uid}/insight_interests/{id}.
// Signed-out: localStorage under insight.interests.v1.
//
// On first sign-in or first mount after this upgrade lands, we
// migrate legacy `insight_skills` docs (skills had levels + hours,
// which we drop) into interests so the user doesn't lose what they
// already typed.

import { useCallback, useEffect, useState } from "react";
import {
  addInterest,
  deleteInterest,
  firebaseEnabled,
  subscribeInterests,
  type RemoteInterest,
} from "./firebase";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";

const STORAGE = "insight.interests.v1";
const MIGRATED_KEY = "insight.interests.skillMigration.v1";

function readLocal(): RemoteInterest[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]") as RemoteInterest[];
  } catch {
    return [];
  }
}

function writeLocal(items: RemoteInterest[]): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(items));
  } catch {
    // Quota errors etc. — best effort.
  }
}

function newId(): string {
  return Math.random().toString(36).slice(2, 12);
}

// One-time conversion of legacy localStorage skills → interests.
// Skills had richer fields (level, hours, milestones, lastPracticed);
// we keep just name + cat. Cat keys map directly since both lists
// shared the eight-category taxonomy.
function migrateSkillsIfNeeded(): RemoteInterest[] {
  try {
    if (localStorage.getItem(MIGRATED_KEY) === "true") return [];
    const raw = localStorage.getItem("insight.skills.v1");
    if (!raw) {
      localStorage.setItem(MIGRATED_KEY, "true");
      return [];
    }
    const skills = JSON.parse(raw) as Array<{ name?: string; cat?: string }>;
    const interests: RemoteInterest[] = [];
    for (const s of skills) {
      if (typeof s.name !== "string" || !s.name.trim()) continue;
      interests.push({
        id: newId(),
        name: s.name.trim().slice(0, 60),
        cat: typeof s.cat === "string" ? s.cat : "mind",
      });
    }
    localStorage.setItem(MIGRATED_KEY, "true");
    return interests;
  } catch {
    return [];
  }
}

export function useInterests(): {
  interests: RemoteInterest[];
  add: (input: { name: string; cat: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const { profile, save: saveProfile } = useProfile();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<RemoteInterest[]>(() => {
    const existing = readLocal();
    if (existing.length > 0) return existing;
    const migrated = migrateSkillsIfNeeded();
    if (migrated.length > 0) writeLocal(migrated);
    return migrated;
  });
  const [remote, setRemote] = useState<RemoteInterest[] | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeInterests(user.uid, (items) => {
      setRemote(items);
      writeLocal(items);
    });
    return unsub;
  }, [isSignedIn, user]);

  const items = isSignedIn ? remote ?? local : local;

  // Keep the denormalised interest-name list on profile in sync.
  // The discoverable doc uses this to expose "what they're into"
  // to nearby users without a cross-collection join. We only write
  // when the list actually differs to avoid noisy profile updates.
  useEffect(() => {
    const next = items.map((i) => i.name);
    const current = profile.interestNames || [];
    if (
      next.length !== current.length ||
      next.some((n, i) => current[i] !== n)
    ) {
      void saveProfile({ interestNames: next });
    }
    // saveProfile is stable enough; not depending on it avoids
    // re-running on every render the parent triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const add = useCallback(
    async (input: { name: string; cat: string }) => {
      const trimmed = input.name.trim().slice(0, 60);
      if (!trimmed) return;
      const next: RemoteInterest = {
        id: newId(),
        name: trimmed,
        cat: input.cat,
      };
      const list = [...items, next];
      writeLocal(list);
      setLocal(list);
      if (isSignedIn && user) {
        await addInterest(user.uid, next);
      }
    },
    [items, isSignedIn, user],
  );

  const remove = useCallback(
    async (id: string) => {
      const list = items.filter((i) => i.id !== id);
      writeLocal(list);
      setLocal(list);
      if (isSignedIn && user) {
        await deleteInterest(user.uid, id);
      }
    },
    [items, isSignedIn, user],
  );

  return { interests: items, add, remove };
}
