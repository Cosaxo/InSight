// useTaxonomies — read a canonical taxonomy from the read-only
// `taxonomies/{key}` Firestore doc (seeded by the seedTaxonomies
// Cloud Function), falling back to the bundled constant when the
// doc is missing, Firebase is off, or the read fails.
//
// This makes taxonomies editable server-side without an app
// redeploy, while the bundled copy guarantees the app still works
// offline / before the first seed. `source` lets callers tell which
// one they're showing.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseEnabled, getDb } from "./firebase";

export function useTaxonomies<T>(
  key: string,
  fallback: T[],
): { items: T[]; source: "remote" | "fallback" } {
  const [items, setItems] = useState<T[]>(fallback);
  const [source, setSource] = useState<"remote" | "fallback">("fallback");

  useEffect(() => {
    if (!firebaseEnabled) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        const ref = doc(db, "taxonomies", key);
        unsub = onSnapshot(
          ref,
          (snap) => {
            const remote = snap.exists()
              ? (snap.data() as { items?: T[] }).items
              : undefined;
            if (Array.isArray(remote) && remote.length > 0) {
              setItems(remote);
              setSource("remote");
            } else {
              setItems(fallback);
              setSource("fallback");
            }
          },
          () => {
            setItems(fallback);
            setSource("fallback");
          },
        );
      } catch {
        if (!cancelled) {
          setItems(fallback);
          setSource("fallback");
        }
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
    // fallback is a stable module constant; key is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items, source };
}
