// useDailyReport — single source of truth for the user's "today" daily report.
//
// • Signed-out (or Firebase not configured): reads + writes localStorage
//   under `insight.dailyReport.v1`. Photo blobs stay in
//   `insight.dailyReport.photo.v1`.
// • Signed-in: subscribes to insight_users/{uid}/insight_daily/today on
//   Firestore. Writes go to Firestore via upsertDailyReport. The local
//   photo is kept in localStorage either way (uploads aren't synced).
//
// On first sign-in, any existing local report is migrated up via the
// existing migrateFromLocal path (extended in Phase 4 to include
// `dailyReport`). Once the doc exists remotely, localStorage is no
// longer authoritative.

import { useEffect, useState } from "react";
import type { RemoteDailyReport } from "../types";
import {
  firebaseEnabled,
  subscribeDailyReport,
  upsertDailyReport,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.dailyReport.v1";
const PHOTO_STORAGE = "insight.dailyReport.photo.v1";

export interface DailyReportLocal extends RemoteDailyReport {
  photo?: string | null;
}

function readLocal(): DailyReportLocal | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return null;
    const r = JSON.parse(raw) as RemoteDailyReport;
    if (r.mood == null) return null;
    const photo = localStorage.getItem(PHOTO_STORAGE);
    return photo ? { ...r, photo } : r;
  } catch {
    return null;
  }
}

function writeLocal(report: DailyReportLocal): void {
  const { photo, ...rest } = report;
  localStorage.setItem(STORAGE, JSON.stringify(rest));
  if (photo) localStorage.setItem(PHOTO_STORAGE, photo);
  else localStorage.removeItem(PHOTO_STORAGE);
}

export function useDailyReport(): {
  report: DailyReportLocal | null;
  loading: boolean;
  save: (r: DailyReportLocal) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [remote, setRemote] = useState<RemoteDailyReport | null>(null);
  const [local, setLocal] = useState<DailyReportLocal | null>(() => readLocal());
  // Track which uid we've heard back from. While signed in, if this
  // doesn't match the current uid, the first Firestore snapshot for
  // this user hasn't arrived yet — i.e. we're loading. The flag is
  // set in the subscription callback so all state writes stay in
  // event handlers, not in effect bodies.
  const [emittedForUid, setEmittedForUid] = useState<string | null>(null);
  const loading = isSignedIn && !!user && emittedForUid !== user.uid;

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeDailyReport(user.uid, (r) => {
      setRemote(r);
      setEmittedForUid(user.uid);
      if (r) {
        localStorage.setItem(STORAGE, JSON.stringify(r));
      } else {
        localStorage.removeItem(STORAGE);
      }
    });
    return unsub;
  }, [isSignedIn, user]);

  const report: DailyReportLocal | null = isSignedIn
    ? remote
      ? { ...remote, photo: localStorage.getItem(PHOTO_STORAGE) }
      : null
    : local;

  const save = async (r: DailyReportLocal) => {
    writeLocal(r);
    setLocal(r);
    if (isSignedIn && user) {
      const { photo, ...rest } = r;
      void photo; // photo blob stays local; only the photoId/hasPhoto travels
      await upsertDailyReport(user.uid, rest);
    }
  };

  return { report, loading, save };
}

// Convenience for non-React callers (the People tab originally read this
// synchronously from localStorage). When signed in, the latest remote
// report is mirrored to localStorage via the hook above on subscribe.
export function readLegacyDailyReport(): DailyReportLocal | null {
  return readLocal();
}
