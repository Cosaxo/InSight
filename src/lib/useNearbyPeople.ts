// useNearbyPeople — read half of the discoverable-users system.
//
// Runs a geohash-bounded Firestore query on the `insight_discoverable`
// collection, sorts by haversine distance, returns the top 20. When
// Firebase is disabled, no position has been granted, or the result
// set is empty (early days, nobody in your area is discoverable yet),
// falls back to seed data so the Around tab is never blank.

import { useCallback, useEffect, useState } from "react";
import {
  findNearbyDiscoverable,
  firebaseEnabled,
} from "./firebase";
import { useAuth } from "./useAuth";
import { useProfile, big5Match } from "./useProfile";
import { IS_DATA } from "../data/seedData";
import type { NearbyPerson } from "../components/tabs/AroundTab";

interface SeedNearby {
  id: string;
  name: string;
  init: string;
  age: number;
  dist: string;
  match: number;
  hue: number;
  role: string;
  interests: { t: string; c: string }[];
  values: string;
  note: string;
}

const SEED_NEARBY = IS_DATA.nearby as SeedNearby[];

function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}

// When we have a real discoverable user but no profile chrome yet,
// synthesize stable display chrome from their uid so each user has a
// consistent colour + initial across renders.
function chromeFor(uid: string, displayName?: string): {
  init: string;
  name: string;
  hue: number;
} {
  const name = (displayName || "").trim();
  const init = name
    ? name
        .split(/\s+/)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2)
    : uid.slice(0, 2).toUpperCase();
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { init, name: name || `User ${uid.slice(0, 4)}`, hue: h % 360 };
}

export function useNearbyPeople(
  position: { latitude: number; longitude: number } | null,
  maxRadiusKm = 10,
): {
  people: NearbyPerson[];
  loading: boolean;
  error: string | null;
  source: "firestore" | "seed";
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [people, setPeople] = useState<NearbyPerson[]>(SEED_NEARBY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"firestore" | "seed">("seed");

  // The viewer's Big Five vector — used as one half of the cosine
  // similarity. When missing, every discovered user gets match=null
  // and PersonRow renders "—".
  const ownPersonality =
    Array.isArray(profile.personality) && profile.personality.length === 5
      ? profile.personality
      : undefined;
  const ownKey = ownPersonality ? ownPersonality.join(",") : "none";

  const fetchOnce = useCallback(async () => {
    if (!firebaseEnabled || !position) {
      setPeople(SEED_NEARBY);
      setSource("seed");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const remote = await findNearbyDiscoverable(
        position,
        maxRadiusKm,
        user?.uid,
      );
      if (remote.length === 0) {
        setPeople(SEED_NEARBY);
        setSource("seed");
        return;
      }
      // Map RemoteDiscoverable → NearbyPerson. bio + role + age
      // are now optional public-profile fields the user opts into
      // via SharingOverlay; missing fields render as empty. Match%
      // is computed via big5Match (null when either side hasn't
      // taken the test, rendered as "—").
      const mapped: NearbyPerson[] = remote.map((r) => {
        const chrome = chromeFor(r.uid, r.displayName);
        return {
          id: r.uid,
          name: chrome.name,
          init: chrome.init,
          age: r.age ?? 0,
          dist: formatDistance(r.distanceKm),
          match: big5Match(ownPersonality, r.personality),
          hue: chrome.hue,
          role: r.role ?? "",
          interests: [],
          values: "",
          note: r.bio ?? "",
        };
      });
      // Sort by match desc when known, distance asc as tiebreaker.
      mapped.sort((a, b) => {
        const am = a.match ?? -1;
        const bm = b.match ?? -1;
        if (am !== bm) return bm - am;
        return 0;
      });
      setPeople(mapped);
      setSource("firestore");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPeople(SEED_NEARBY);
      setSource("seed");
    } finally {
      setLoading(false);
    }
    // ownPersonality is captured by value; we depend on ownKey for
    // the change signal so the closure sees the latest vector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, maxRadiusKm, user, ownKey]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { people, loading, error, source, refresh: fetchOnce };
}
