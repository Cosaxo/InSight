// useBodySnapshot — subscribe to today's wearable snapshot.
//
// Reads insight_users/{uid}/insight_body/{YYYY-MM-DD}. Writes come
// from either:
//   - The native wearable bridge (HealthKit / Health Connect),
//     which doesn't exist yet — that's the big TODO this scaffolds.
//   - The dev "mock data" toggle in BodyOverlay, which writes a
//     synthetic snapshot so the UI can be exercised without a
//     paired device.
//
// Signed-out / Firebase-disabled mode is supported via localStorage
// so the dev toggle works in the web preview too.

import { useEffect, useState } from "react";
import {
  firebaseEnabled,
  subscribeBodySnapshot,
  upsertBodySnapshot,
} from "./firebase";
import type { RemoteBodySnapshot } from "../types";
import { useAuth } from "./useAuth";
import { isoDateToday } from "./useMoods";

const LOCAL_KEY_PREFIX = "insight.body.";

function readLocal(date: string): RemoteBodySnapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_PREFIX + date);
    return raw ? (JSON.parse(raw) as RemoteBodySnapshot) : null;
  } catch {
    return null;
  }
}

function writeLocal(date: string, snap: RemoteBodySnapshot | null): void {
  try {
    if (snap == null) localStorage.removeItem(LOCAL_KEY_PREFIX + date);
    else localStorage.setItem(LOCAL_KEY_PREFIX + date, JSON.stringify(snap));
  } catch {
    // Quota / private mode — best effort.
  }
}

export function useBodySnapshot(date?: string): {
  snapshot: RemoteBodySnapshot | null;
  loading: boolean;
  save: (patch: Partial<RemoteBodySnapshot>) => Promise<void>;
  clear: () => Promise<void>;
} {
  const day = date ?? isoDateToday();
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [snapshot, setSnapshot] = useState<RemoteBodySnapshot | null>(() =>
    readLocal(day),
  );
  const [loading, setLoading] = useState(isSignedIn);

  useEffect(() => {
    if (!isSignedIn || !user) {
      // Local-only mode — no subscription, no loading state to
      // mark complete. The initial useState already loaded from
      // localStorage so there's nothing left to do.
      return;
    }
    const unsub = subscribeBodySnapshot(user.uid, day, (r) => {
      setSnapshot(r);
      writeLocal(day, r);
      setLoading(false);
    });
    return unsub;
  }, [isSignedIn, user, day]);

  const save = async (patch: Partial<RemoteBodySnapshot>) => {
    const next: RemoteBodySnapshot = { ...(snapshot ?? { date: day }), ...patch, date: day };
    setSnapshot(next);
    writeLocal(day, next);
    if (isSignedIn && user) {
      await upsertBodySnapshot(user.uid, day, next);
    }
  };

  const clear = async () => {
    setSnapshot(null);
    writeLocal(day, null);
    if (isSignedIn && user) {
      // Soft delete: write an empty snapshot. We don't have a
      // dedicated delete endpoint for body snapshots — the date
      // key acts as the lifecycle anchor.
      await upsertBodySnapshot(user.uid, day, { date: day });
    }
  };

  return { snapshot, loading, save, clear };
}

// Deterministic-ish mock generator for the dev toggle. Uses the
// date string as a seed so the same day always returns the same
// values — important so flipping the toggle on/off doesn't keep
// scrambling the numbers.
export function generateMockSnapshot(date: string): RemoteBodySnapshot {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rand = (lo: number, hi: number) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return lo + (h / 0xffffffff) * (hi - lo);
  };
  return {
    date,
    hrvMs: Math.round(rand(28, 78)),
    restingHrBpm: Math.round(rand(48, 72)),
    steps: Math.round(rand(2400, 14000)),
    vo2Max: Math.round(rand(34, 56) * 10) / 10,
    bodyBattery: Math.round(rand(35, 92)),
    sleepMinutes: Math.round(rand(330, 510)),
    sleepDeepMinutes: Math.round(rand(50, 130)),
    sleepRemMinutes: Math.round(rand(60, 140)),
    trainingLoad: Math.round(rand(20, 95)),
    stress: Math.round(rand(15, 65)),
    source: "mock",
  };
}
