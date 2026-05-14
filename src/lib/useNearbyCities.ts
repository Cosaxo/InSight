// useNearbyCities — wraps the Firestore geohash query for cities,
// merges results with our editorial seed data so callers don't have
// to special-case "city in seed" vs "city not in seed."
//
// Firestore "Cities" collection has only Name + location. Our seed
// has match %, 8 category scores, mood tag, blurb. When a Firestore
// city matches a seed name (case-insensitive), we merge the seed
// fields in. Cities not in seed render as a minimal card.
//
// One-shot fetch (not a subscription) — city positions don't change.
// Re-run by calling the returned `refresh` from a "Use my location"
// affordance.

import { useCallback, useEffect, useState } from "react";
import {
  findNearbyCities,
  firebaseEnabled,
  type RemoteCity,
} from "./firebase";
import { IS_DATA } from "../data/seedData";

export interface NearbyCity {
  uid: string; // Firestore doc id when from Firebase, name slug when from seed
  name: string;
  country?: string;
  region?: string;
  pop?: string;
  match?: number;
  hue?: number;
  mood?: string;
  scores?: Record<string, number>;
  blurb?: string;
  latitude?: number;
  longitude?: number;
  distanceKm: number;
  fromSeed: boolean; // true if no Firestore doc backed this
}

// The seed data uses `any`, so pin a precise shape at this one boundary.
interface SeedCity {
  name: string;
  country?: string;
  region?: string;
  pop?: string;
  match?: number;
  hue?: number;
  mood?: string;
  scores?: Record<string, number>;
  blurb?: string;
}

const SEED_CITIES = IS_DATA.cities as SeedCity[];

function seedByName(name: string): SeedCity | undefined {
  const k = name.trim().toLowerCase();
  return SEED_CITIES.find((c) => c.name.toLowerCase() === k);
}

function mergeWithSeed(city: RemoteCity): NearbyCity {
  const seed = seedByName(city.name);
  return {
    uid: city.uid,
    name: city.name,
    country: seed?.country,
    region: seed?.region,
    pop: seed?.pop,
    match: seed?.match,
    hue: seed?.hue,
    mood: seed?.mood,
    scores: seed?.scores as Record<string, number> | undefined,
    blurb: seed?.blurb,
    latitude: city.latitude,
    longitude: city.longitude,
    distanceKm: city.distanceKm,
    fromSeed: !seed,
  };
}

export function useNearbyCities(
  position: { latitude: number; longitude: number } | null,
  radiusKm = 500,
): {
  cities: NearbyCity[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [cities, setCities] = useState<NearbyCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!position) return;
    if (!firebaseEnabled) {
      // Local-only mode: there's no city catalog, so we can't pick
      // by distance. Return seed cities in their declared order
      // (callers will know fromSeed=true and can show a hint).
      setCities(
        SEED_CITIES.map((c) => ({
          uid: c.name,
          name: c.name,
          country: c.country,
          region: c.region,
          pop: c.pop,
          match: c.match,
          hue: c.hue,
          mood: c.mood,
          scores: c.scores,
          blurb: c.blurb,
          distanceKm: 0,
          fromSeed: true,
        })),
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const remote = await findNearbyCities(position, radiusKm);
      setCities(remote.map(mergeWithSeed));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [position, radiusKm]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { cities, loading, error, refresh: fetchOnce };
}
