// useDiscoverableLocation — owner-side write half of the nearby-people
// system. Opt-in by default off; once turned on, the user's current
// (fuzzed) location is upserted to `insight_discoverable/{uid}` so other
// signed-in users can find them via the geohash query.
//
// Fuzzing: round lat/lng to 3 decimal places (~110 m grid). Enough for
// "someone is nearby" without leaking the user's exact whereabouts.
//
// Lifecycle:
//   - The toggle preference lives in localStorage (`insight.discoverable.v1`)
//   - When { signed in, opted in, have position } all hold, we upsert.
//   - When opted out, we delete the doc.
//   - We don't re-upsert on every position change — only when the
//     fuzzed coordinates actually moved.

import { useCallback, useEffect, useState } from "react";
import { geohashForLocation } from "geofire-common";
import {
  deleteDiscoverable,
  firebaseEnabled,
  upsertDiscoverable,
} from "./firebase";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import type { GeoPosition } from "./useGeolocation";

const PREF_KEY = "insight.discoverable.v1";

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "true";
  } catch {
    return false;
  }
}

function writePref(v: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, v ? "true" : "false");
  } catch {
    // Quota / private-mode — preference doesn't persist, fine.
  }
}

// Round to 3 decimals — ~110 m at equator, less at latitude.
function fuzz(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function useDiscoverableLocation(position: GeoPosition | null): {
  enabled: boolean;
  setEnabled: (v: boolean) => Promise<void>;
  lastSyncedAt: number | null;
  error: string | null;
} {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [enabled, setEnabledState] = useState<boolean>(() => readPref());
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastFuzzed, setLastFuzzed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only share personality if the user has actually taken the Big
  // Five test (5-element vector). This is what the read-side uses
  // to compute match% — sharing nothing keeps match as "—".
  const personality =
    Array.isArray(profile.personality) && profile.personality.length === 5
      ? profile.personality
      : undefined;
  // Stable key so the upsert re-runs when the vector changes,
  // without firing on unrelated profile updates.
  const personalityKey = personality ? personality.join(",") : "none";

  // Side effect: when (signed in + opted in + have position), upsert.
  useEffect(() => {
    if (!firebaseEnabled || !user || !enabled || !position) return;
    const lat = fuzz(position.latitude);
    const lng = fuzz(position.longitude);
    const key = `${lat},${lng}|${personalityKey}`;
    if (key === lastFuzzed) return; // unchanged inputs, skip
    void (async () => {
      try {
        await upsertDiscoverable(user.uid, {
          latitude: lat,
          longitude: lng,
          geohash: geohashForLocation([lat, lng]),
          personality,
        });
        setLastFuzzed(key);
        setLastSyncedAt(Date.now());
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    })();
  }, [user, enabled, position, lastFuzzed, personality, personalityKey]);

  const setEnabled = useCallback(
    async (v: boolean) => {
      writePref(v);
      setEnabledState(v);
      if (!firebaseEnabled || !user) return;
      if (!v) {
        // Turning off — kill the doc immediately so the user disappears
        // from other people's nearby queries.
        try {
          await deleteDiscoverable(user.uid);
          setLastFuzzed(null);
          setLastSyncedAt(null);
          setError(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      }
      // When turning on without a position yet, the effect above will
      // upsert as soon as the caller resolves geolocation.
    },
    [user],
  );

  return { enabled, setEnabled, lastSyncedAt, error };
}
