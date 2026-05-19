// useDailyReport — single source of truth for the user's daily reports.
//
// Schema: one doc per day at insight_users/{uid}/insight_daily/{YYYY-MM-DD}.
// The "today" report is the doc for today's ISO date. Past days are
// readable as their own docs.
//
// • Signed-out (or Firebase not configured): reads + writes localStorage
//   under `insight.dailyReport.v1` (today only) and
//   `insight.dailyReport.history.v1` (the per-day archive).
//   Photo blobs stay in `insight.dailyReport.photo.v1` (today) and
//   `insight.dailyReport.photo.{date}.v1` (per-day) — never synced.
// • Signed-in: subscribes to insight_users/{uid}/insight_daily/{date}
//   on Firestore. Writes go to Firestore via upsertDailyReport with
//   the current ISO date as doc id.
//
// On first mount post-upgrade, migrateLegacyDailyReport sweeps any
// surviving `today` doc (Phase 4 schema) into a real date doc keyed
// off its serverTimestamp. Idempotent.

import { useEffect, useState } from "react";
import type { RemoteDailyReport } from "../types";
import {
  downloadDailyPhoto,
  firebaseEnabled,
  migrateLegacyDailyReport,
  subscribeAllDailyReports,
  subscribeDailyReport,
  uploadDailyPhoto,
  upsertDailyReport,
} from "./firebase";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";

const STORAGE_TODAY = "insight.dailyReport.v1";
const STORAGE_HISTORY = "insight.dailyReport.history.v1";
const PHOTO_STORAGE_TODAY = "insight.dailyReport.photo.v1";

export interface DailyReportLocal extends RemoteDailyReport {
  photo?: string | null;
}

export function isoDateToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Storage key for a specific date's photo. Photos stay local-only
// (they never sync to Firestore) so they're scoped per-day on disk.
function photoStorageKey(date: string): string {
  return date === isoDateToday()
    ? PHOTO_STORAGE_TODAY
    : `insight.dailyReport.photo.${date}.v1`;
}

function readLocalToday(): DailyReportLocal | null {
  try {
    const raw = localStorage.getItem(STORAGE_TODAY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RemoteDailyReport;
    if (r.mood == null) return null;
    const photo = localStorage.getItem(PHOTO_STORAGE_TODAY);
    return photo ? { ...r, photo } : r;
  } catch {
    return null;
  }
}

function readLocalHistory(): RemoteDailyReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RemoteDailyReport[]) : [];
  } catch {
    return [];
  }
}

function writeLocalToday(report: DailyReportLocal): void {
  const { photo, ...rest } = report;
  localStorage.setItem(STORAGE_TODAY, JSON.stringify(rest));
  if (photo) localStorage.setItem(PHOTO_STORAGE_TODAY, photo);
  else localStorage.removeItem(PHOTO_STORAGE_TODAY);
}

function upsertLocalHistory(report: RemoteDailyReport): void {
  const list = readLocalHistory();
  const idx = list.findIndex((r) => r.date === report.date);
  if (idx >= 0) list[idx] = report;
  else list.unshift(report);
  // Cap to 365 entries to keep localStorage bounded.
  if (list.length > 365) list.length = 365;
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list));
}

// ── useDailyReport — today's report ─────────────────────────────

export function useDailyReport(): {
  report: DailyReportLocal | null;
  loading: boolean;
  save: (r: DailyReportLocal) => Promise<void>;
} {
  const { user } = useAuth();
  const { profile } = useProfile();
  const isSignedIn = firebaseEnabled && !!user;
  const cloudPhotos = !!profile.cloudPhotos;
  const [remote, setRemote] = useState<RemoteDailyReport | null>(null);
  const [local, setLocal] = useState<DailyReportLocal | null>(() =>
    readLocalToday(),
  );
  const [emittedForUid, setEmittedForUid] = useState<string | null>(null);
  const loading = isSignedIn && !!user && emittedForUid !== user.uid;

  useEffect(() => {
    if (!isSignedIn || !user) return;
    // Run the legacy "today" doc migration once per session. Cheap
    // (one read) and idempotent — bails out instantly when the
    // legacy doc doesn't exist.
    void migrateLegacyDailyReport(user.uid).catch((err) =>
      console.error("[useDailyReport] legacy migration failed:", err),
    );
    const today = isoDateToday();
    const unsub = subscribeDailyReport(user.uid, today, (r) => {
      setRemote(r);
      setEmittedForUid(user.uid);
      if (r) {
        localStorage.setItem(STORAGE_TODAY, JSON.stringify(r));
        upsertLocalHistory(r);
        // If the doc carries a Storage path and we don't already
        // have a local copy of the photo cached, pull it down.
        // This is what makes cloud-photos sync visible on a second
        // device.
        if (r.photoPath && !localStorage.getItem(PHOTO_STORAGE_TODAY)) {
          void downloadDailyPhoto(user.uid, today).then((dataUrl) => {
            if (dataUrl) {
              localStorage.setItem(PHOTO_STORAGE_TODAY, dataUrl);
              // Bump local state so the new photo renders.
              setLocal((prev) =>
                prev ? { ...prev, photo: dataUrl } : prev,
              );
            }
          });
        }
      } else {
        localStorage.removeItem(STORAGE_TODAY);
      }
    });
    return unsub;
  }, [isSignedIn, user]);

  const report: DailyReportLocal | null = isSignedIn
    ? remote
      ? { ...remote, photo: localStorage.getItem(PHOTO_STORAGE_TODAY) }
      : null
    : local;

  const save = async (r: DailyReportLocal) => {
    const today = isoDateToday();
    const withDate = { ...r, date: today };
    writeLocalToday(withDate);
    upsertLocalHistory({
      ...withDate,
      photo: undefined,
    } as RemoteDailyReport);
    setLocal(withDate);
    if (isSignedIn && user) {
      const { photo, ...rest } = withDate;
      // Cloud photos opt-in: when on and the report carries a
      // photo blob, upload to Storage first and persist the path
      // alongside the doc. When off, only hasPhoto / photoId
      // travel — the privacy contract for un-opted users is
      // unchanged.
      let photoPath: string | undefined = rest.photoPath;
      if (cloudPhotos && photo && photo.startsWith("data:")) {
        try {
          photoPath = await uploadDailyPhoto(user.uid, today, photo);
        } catch (err) {
          // Don't block the save on a Storage failure — the photo
          // is already in localStorage and we'll retry on next
          // edit. Surface to console for diagnostics.
          console.warn("[useDailyReport] photo upload failed:", err);
        }
      }
      await upsertDailyReport(user.uid, today, {
        ...rest,
        ...(photoPath ? { photoPath } : {}),
      });
    }
  };

  return { report, loading, save };
}

// ── useAllDailyReports — the archive (newest first) ─────────────
//
// Used by DaysOverlay's portrait tab to render the gallery of past
// frames. Returns the full set sorted newest-first. Reads from
// Firestore when signed in, localStorage otherwise.
//
// Signed-in: Firestore subscription drives a state slot and also
// mirrors to localStorage. Signed-out: we listen for the browser's
// "storage" event so a save() in another component / tab triggers
// a re-read here. (The hook itself doesn't drive saves — those go
// through useDailyReport — so we rely on cross-component signalling
// to know when localStorage has changed.)
export function useAllDailyReports(): {
  reports: RemoteDailyReport[];
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [remote, setRemote] = useState<RemoteDailyReport[] | null>(null);
  const [localTick, setLocalTick] = useState(0);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeAllDailyReports(user.uid, (items) => {
      setRemote(items);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(items));
    });
    return unsub;
  }, [isSignedIn, user]);

  // Re-read localStorage on a storage event (same-origin tab) or
  // on a manual bump via the focus event (covers the same-tab case
  // where useDailyReport.save() just wrote and we want the gallery
  // to refresh without re-mounting).
  useEffect(() => {
    if (isSignedIn) return;
    const bump = () => setLocalTick((n) => n + 1);
    window.addEventListener("storage", bump);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("focus", bump);
    };
  }, [isSignedIn]);

  // Read fresh on every render when signed out — cheap, and the
  // localTick dep above guarantees React re-renders after storage
  // changes.
  const local = isSignedIn ? [] : readLocalHistory();
  void localTick;

  const reports = isSignedIn ? remote || [] : local;

  return { reports };
}

// Read a specific past day's report (read-only viewer). Synchronous
// from localStorage when signed-out; the hook variant for signed-in
// is just useAllDailyReports + .find().
export function readDailyReportFor(date: string): RemoteDailyReport | null {
  return readLocalHistory().find((r) => r.date === date) ?? null;
}

// Read the photo blob for a specific date from localStorage. Photos
// never sync, so they only exist on the device that captured them.
export function readDailyReportPhoto(date: string): string | null {
  return localStorage.getItem(photoStorageKey(date));
}

// Convenience for non-React callers (the People tab originally read
// this synchronously from localStorage). When signed in, the latest
// remote report is mirrored to localStorage via the hook above on
// subscribe.
export function readLegacyDailyReport(): DailyReportLocal | null {
  return readLocalToday();
}
