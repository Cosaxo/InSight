// useHealthSync — thin React wrapper around the insight-health
// Capacitor plugin.
//
// Lifecycle for the BodyOverlay wearable card:
//   1. enabled = false (default) → render the "not connected" copy.
//   2. User taps "Connect" → connect() runs requestPermissions(),
//      which calls into HealthKit (iOS sheet) / Health Connect
//      (Android permission Activity) and persists the
//      `insight.health.enabled.v1` flag.
//   3. enabled = true → BodyOverlay calls sync() on mount, which
//      pulls today's snapshot and writes it via useBodySnapshot.save.
//
// Foreground-on-open. No background sync — see the architecture
// discussion: a journal app reads "yesterday's sleep" once a day,
// so the BGTaskScheduler / WorkManager dance isn't worth its battery
// cost or its code surface.

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { InsightHealth } from "insight-health";
import type { RemoteBodySnapshot } from "../types";

const ENABLED_KEY = "insight.health.enabled.v1";

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeEnabled(v: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, v ? "true" : "false");
  } catch {
    /* private mode — best-effort */
  }
}

interface UseHealthSync {
  /** Whether the bridge runs in this environment at all. */
  available: boolean;
  /** Reason string when available = false (e.g. "web platform"). */
  unavailableReason: string | null;
  /** Whether the user has connected the bridge. */
  enabled: boolean;
  /** True while a sync is in flight. */
  syncing: boolean;
  /** Last error from connect / sync, if any. */
  error: string | null;
  /** Show the system permission sheet; on success sets enabled=true. */
  connect: () => Promise<void>;
  /** Disable + clear the local flag. Doesn't revoke OS permissions. */
  disconnect: () => void;
  /** Read today's snapshot. Returns the values for upsert. */
  sync: () => Promise<Partial<RemoteBodySnapshot> | null>;
}

export function useHealthSync(): UseHealthSync {
  const native = Capacitor.isNativePlatform();
  const [available, setAvailable] = useState<boolean>(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean>(() => readEnabled());
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Probe availability once. On Android this round-trips into
  // Health Connect to detect whether the OEM has the app installed;
  // on iOS it just checks HKHealthStore.isHealthDataAvailable().
  useEffect(() => {
    if (!native) {
      setAvailable(false);
      setUnavailableReason("web platform");
      return;
    }
    void (async () => {
      try {
        const { available: ok, reason } = await InsightHealth.isAvailable();
        setAvailable(ok);
        setUnavailableReason(reason ?? null);
      } catch (err) {
        setAvailable(false);
        setUnavailableReason(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [native]);

  const connect = useCallback(async () => {
    setError(null);
    if (!available) {
      setError(unavailableReason ?? "Health bridge unavailable.");
      return;
    }
    try {
      const { granted } = await InsightHealth.requestPermissions();
      if (!granted) {
        setError("Permission was not granted. Try again from the system Health settings.");
        return;
      }
      writeEnabled(true);
      setEnabled(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, [available, unavailableReason]);

  const disconnect = useCallback(() => {
    writeEnabled(false);
    setEnabled(false);
    setError(null);
  }, []);

  const sync = useCallback(async () => {
    if (!available || !enabled) return null;
    setSyncing(true);
    setError(null);
    try {
      const { snapshot } = await InsightHealth.syncToday();
      // Tag the source so the BodyOverlay's WearableCard can tell
      // a real reading apart from the dev "🧪 mock data" path.
      const platform = Capacitor.getPlatform();
      const source: RemoteBodySnapshot["source"] =
        platform === "ios" ? "healthkit" : "health-connect";
      return { ...snapshot, source };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [available, enabled]);

  return {
    available,
    unavailableReason,
    enabled,
    syncing,
    error,
    connect,
    disconnect,
    sync,
  };
}
