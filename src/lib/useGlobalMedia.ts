// useGlobalMedia — subscribes to the single `aggregates_media/world`
// doc written by the area aggregator Cloud Function. Holds the
// most-loved media per category across the whole discoverable
// userbase (favourites shared at "world" level).
//
// Returns null until the doc exists; `media` is an empty object when
// the aggregator ran but no category cleared the k-anon floor.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseEnabled, getDb } from "./firebase";
import type { ScopeMedia } from "../types";

export interface GlobalMedia {
  contributors: number;
  media: ScopeMedia;
}

export function useGlobalMedia(): {
  loading: boolean;
  data: GlobalMedia | null;
} {
  const [data, setData] = useState<GlobalMedia | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        const ref = doc(db, "aggregates_media", "world");
        unsub = onSnapshot(
          ref,
          (snap) => {
            if (snap.exists()) {
              const raw = snap.data() as {
                contributors?: number;
                media?: ScopeMedia;
              };
              setData({
                contributors: raw.contributors ?? 0,
                media: raw.media ?? {},
              });
            } else {
              setData(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error("[useGlobalMedia] subscribe failed:", err);
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[useGlobalMedia] db init failed:", err);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { loading, data };
}
