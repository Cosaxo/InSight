// useWorldAggregates — subscribes to the one-document
// \`aggregates_world/snapshot\` that the rebuildWorldAggregates Cloud
// Function writes nightly. One read per app session, served from
// Firestore's offline cache after the first fetch.
//
// The doc is null until the function has run at least once. The
// hook returns { loading, snapshot, error } so the UI can gracefully
// say "no aggregate yet" rather than rendering blank panels.

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { firebaseEnabled, getDb } from "./firebase";

export interface CountryBreakdown {
  userCount: number;
  personalityAvg: number[] | null;
  genderRatio: Record<string, number>;
  ageBuckets: Record<string, number>;
  topInterests: { name: string; count: number }[];
  topImpressions: { trait: string; count: number }[];
}

export interface WorldSnapshot {
  updatedAt?: { toMillis?: () => number };
  totalUsers: number;
  countriesRepresented: number;
  globalPersonalityAvg: number[] | null;
  globalTopInterests: { name: string; count: number }[];
  globalTopImpressions?: { trait: string; count: number }[];
  byCountry: Record<string, CountryBreakdown>;
}

export function useWorldAggregates(): {
  loading: boolean;
  snapshot: WorldSnapshot | null;
  error: string | null;
} {
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseEnabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) {
      // Loading initializer above is conditional on firebaseEnabled,
      // so we don't need to flip it here. The signed-out / no-firebase
      // path stays in its initial state.
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        const ref = doc(db, "aggregates_world", "snapshot");
        unsub = onSnapshot(
          ref,
          (snap) => {
            if (!snap.exists()) {
              setSnapshot(null);
            } else {
              setSnapshot(snap.data() as WorldSnapshot);
            }
            setLoading(false);
          },
          (err) => {
            console.error("[useWorldAggregates] subscribe failed:", err);
            setError(err.message);
            setLoading(false);
          },
        );
        // Warm the cache via getDoc — keeps the loading state quick
        // even when the snapshot listener takes a moment.
        void getDoc(ref).catch(() => null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { loading, snapshot, error };
}
