// useActiveCities — top-N cities by `currentlyActive` from Firestore,
// cached at module level so navigating away and back to the World tab
// doesn't re-spend Firestore reads.
//
// One indexed query, ~50 reads max per app session. Add the index
// (Firestore console will prompt the first time): Cities, currentlyActive desc.

import { useEffect, useState } from "react";
import {
  firebaseEnabled,
  loadActiveCities,
  type RemoteCity,
} from "./firebase";

// Module-level cache shared across all hook consumers in the session.
let cache: RemoteCity[] | null = null;
let inflight: Promise<RemoteCity[]> | null = null;

export function useActiveCities(limitN = 50): {
  cities: RemoteCity[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [cities, setCities] = useState<RemoteCity[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) {
      setLoading(false);
      return;
    }
    if (cache) {
      setCities(cache);
      setLoading(false);
      return;
    }
    if (!inflight) {
      inflight = loadActiveCities(limitN).then(
        (r) => {
          cache = r;
          return r;
        },
        (err) => {
          inflight = null;
          throw err;
        },
      );
    }
    let cancelled = false;
    inflight
      .then((r) => {
        if (cancelled) return;
        setCities(r);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limitN]);

  const refresh = async () => {
    if (!firebaseEnabled) return;
    cache = null;
    inflight = null;
    setLoading(true);
    setError(null);
    try {
      const r = await loadActiveCities(limitN);
      cache = r;
      setCities(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return { cities, loading, error, refresh };
}
