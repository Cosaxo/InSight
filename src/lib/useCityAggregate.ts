// useCityAggregate — subscribes to the community-rating aggregate
// doc for a given city. Doc id is a slug of the city's name,
// matching what rebuildCityAggregates writes nightly.
//
// Returns the aggregate or null when no doc exists (city not yet
// rated, or below the k-anonymity floor).

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseEnabled, getDb } from "./firebase";

export interface CityAggregate {
  cityKey: string;
  displayName: string;
  updatedAt?: { toMillis?: () => number };
  totalRaters: number;
  byDimension: Record<string, { avg: number; count: number }>;
  topImpressions?: { trait: string; count: number }[];
}

export function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function useCityAggregate(cityName: string | null | undefined): {
  loading: boolean;
  aggregate: CityAggregate | null;
} {
  const [aggregate, setAggregate] = useState<CityAggregate | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseEnabled && !!cityName);

  useEffect(() => {
    if (!firebaseEnabled || !cityName) {
      return;
    }
    const slug = slugifyCity(cityName);
    if (!slug) {
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        const ref = doc(db, "aggregates_city", slug);
        unsub = onSnapshot(
          ref,
          (snap) => {
            setAggregate(snap.exists() ? (snap.data() as CityAggregate) : null);
            setLoading(false);
          },
          (err) => {
            console.error("[useCityAggregate] subscribe failed:", err);
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[useCityAggregate] db init failed:", err);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [cityName]);

  return { loading, aggregate };
}
