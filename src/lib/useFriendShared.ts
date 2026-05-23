// useFriendShared — read a single shareable subcollection from
// another user's subtree (insight_users/{friendUid}/{collection}).
//
// Access is enforced server-side by firestore.rules: a mutual friend
// can read the collection only when the owner's per-category share
// level (SharingOverlay) is circle / city / world. When the owner
// hasn't shared it, the subscription errors with permission-denied —
// surfaced here as `denied` so the UI can say "not shared with you"
// rather than "empty."

import { useEffect, useState } from "react";
import {
  collection as coll,
  limit as fbLimit,
  onSnapshot,
  query,
} from "firebase/firestore";
import { firebaseEnabled, getDb } from "./firebase";

export function useFriendShared<T = Record<string, unknown>>(
  friendUid: string | null | undefined,
  collectionName: string,
  max = 30,
): { items: T[]; loading: boolean; denied: boolean } {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(
    firebaseEnabled && !!friendUid,
  );
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!firebaseEnabled || !friendUid) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        const ref = query(
          coll(db, "insight_users", friendUid, collectionName),
          fbLimit(max),
        );
        unsub = onSnapshot(
          ref,
          (snap) => {
            setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
            setLoading(false);
            setDenied(false);
          },
          (err) => {
            // permission-denied is the expected "not shared" signal.
            setDenied(
              (err as { code?: string }).code === "permission-denied",
            );
            setItems([]);
            setLoading(false);
          },
        );
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [friendUid, collectionName, max]);

  // Derive the empty state for the no-friend / no-firebase case
  // rather than writing it synchronously inside the effect.
  const visibleItems = firebaseEnabled && friendUid ? items : [];
  return { items: visibleItems, loading, denied };
}
