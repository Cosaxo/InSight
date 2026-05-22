// usePersonImpressions — read the impressions written for a given
// person, when they've opted into sharing them at a tier the
// viewer's relation reaches. Aggregates by trait + counts.
//
// Returns null when the viewer doesn't have access (because the
// target has shareImpressionsAbout = "nobody", or the rule denies
// the read). The Firestore rule layer does the actual gating; we
// just surface whatever comes back.

import { useEffect, useState } from "react";
import { firebaseEnabled, getDb } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

export interface ImpressionAggregate {
  trait: string;
  count: number;
}

interface UseResult {
  loading: boolean;
  aggregates: ImpressionAggregate[] | null;
}

export function usePersonImpressions(targetUid: string | null | undefined): UseResult {
  const [aggregates, setAggregates] = useState<ImpressionAggregate[] | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseEnabled && !!targetUid);

  useEffect(() => {
    if (!firebaseEnabled || !targetUid) {
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        const col = collection(
          db,
          "insight_users",
          targetUid,
          "insight_inbound_impressions",
        );
        unsub = onSnapshot(
          col,
          (snap) => {
            // Aggregate traits across all visible impressions. If the
            // viewer doesn't have read access the subscription
            // returns an empty snap silently (rule denies); the
            // null vs [] distinction lets the UI render "shared but
            // none yet" vs "not shared at all."
            const counts: Record<string, number> = {};
            snap.forEach((d) => {
              const data = d.data() as { traits?: unknown };
              if (!Array.isArray(data.traits)) return;
              for (const raw of data.traits) {
                if (typeof raw !== "string") continue;
                const key = raw.trim().toLowerCase();
                if (!key) continue;
                counts[key] = (counts[key] || 0) + 1;
              }
            });
            const list = Object.entries(counts)
              .map(([trait, count]) => ({ trait, count }))
              .sort((a, b) => b.count - a.count);
            setAggregates(list);
            setLoading(false);
          },
          () => {
            // Rule denied or another error; treat as "not shared"
            // — UI renders nothing.
            setAggregates(null);
            setLoading(false);
          },
        );
      } catch {
        setAggregates(null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [targetUid]);

  return { loading, aggregates };
}
