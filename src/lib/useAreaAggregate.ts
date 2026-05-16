// useAreaAggregate — subscribe to the population aggregate for the
// user's current geohash5 cell. Returns a single doc:
//   { count, mean: [5], stdev: [5], updatedAt }
// or null when no aggregate has been published for the user's cell
// (cell is below the k-anonymity floor, or the rollup hasn't run
// yet, or the user has no position).
//
// The doc itself is written by the rebuildAreaAggregates Cloud
// Function (functions/src/index.ts). Reading is open to any signed-
// in user via the Firestore rule on `aggregates_by_geohash5/{hash}`.

import { useEffect, useState } from "react";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { geohashForLocation } from "geofire-common";
import { firebaseEnabled } from "./firebase";
import type { GeoPosition } from "./useGeolocation";

export interface AreaAggregate {
  geohash5: string;
  count: number;
  mean: number[];   // Big Five [O, C, E, A, N]
  stdev: number[];
}

export function useAreaAggregate(position: GeoPosition | null): {
  data: AreaAggregate | null;
  loading: boolean;
} {
  const [data, setData] = useState<AreaAggregate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!firebaseEnabled || !position) return;
    const hash5 = geohashForLocation([
      position.latitude,
      position.longitude,
    ]).slice(0, 5);
    setLoading(true);
    const ref = doc(getFirestore(), "aggregates_by_geohash5", hash5);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setData(null);
          return;
        }
        const raw = snap.data() as {
          geohash5: string;
          count: number;
          mean: number[];
          stdev: number[];
        };
        setData({
          geohash5: raw.geohash5,
          count: raw.count,
          mean: raw.mean,
          stdev: raw.stdev,
        });
      },
      (err) => {
        console.error("[useAreaAggregate]", err);
        setLoading(false);
        setData(null);
      },
    );
    return unsub;
    // We deliberately key on lat/lng rather than `position` so a
    // new GeoPosition object with the same coordinates doesn't
    // re-trigger the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude]);

  // Reset `data` when the upstream geo / firebase state goes away.
  // Splitting this from the subscription effect keeps the linter
  // happy about set-state-in-effect.
  useEffect(() => {
    if (!firebaseEnabled || !position) setData(null);
  }, [position]);

  return { data, loading };
}
