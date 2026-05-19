// useFriendDailies — for each relation with a linkedUid, subscribe to
// that user's daily report. Reads that fail the rules check (the
// friend hasn't granted us access) come back as null and we silently
// drop them. The hook returns only successfully-resolved daily
// reports, keyed by linkedUid.
//
// Cost: N subscriptions for N relations with linkedUid set. Each is
// a single-doc subscription. The Firestore rule does one exists()
// check per read, costing 1 extra read on top of the data read.
// Typical circle size (<30) keeps this well under free-tier limits.

import { useEffect, useState } from "react";
import { firebaseEnabled, subscribeFriendDailyReport } from "./firebase";
import { useAuth } from "./useAuth";
import { isoDateToday } from "./useDailyReport";
import type { RemoteDailyReport } from "../types";
import type { UserPerson } from "./useRelations";

export interface FriendDaily {
  friend: UserPerson;
  report: RemoteDailyReport;
}

export function useFriendDailies(relations: UserPerson[]): {
  dailies: FriendDaily[];
} {
  const { user } = useAuth();
  const [reports, setReports] = useState<Record<string, RemoteDailyReport>>({});

  // Subscribe per linked relation. Dependencies key off the uid list so
  // we don't tear down everything on every relations array reference.
  const linkedUids = relations
    .map((r) => r.linkedUid)
    .filter((u): u is string => !!u && u !== user?.uid);
  const key = linkedUids.sort().join(",");

  useEffect(() => {
    if (!firebaseEnabled || !user || linkedUids.length === 0) {
      setReports({});
      return;
    }
    const unsubs: Array<() => void> = [];
    const today = isoDateToday();
    for (const fuid of linkedUids) {
      const unsub = subscribeFriendDailyReport(fuid, today, (r) => {
        setReports((prev) => {
          if (!r) {
            // Permission-denied or no doc — drop any stale entry.
            if (!(fuid in prev)) return prev;
            const { [fuid]: _, ...rest } = prev;
            void _;
            return rest;
          }
          return { ...prev, [fuid]: r };
        });
      });
      unsubs.push(unsub);
    }
    return () => {
      for (const u of unsubs) u();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user]);

  const dailies: FriendDaily[] = linkedUids
    .map((fuid) => {
      const r = reports[fuid];
      const friend = relations.find((rel) => rel.linkedUid === fuid);
      return r && friend ? { friend, report: r } : null;
    })
    .filter((x): x is FriendDaily => x !== null);

  return { dailies };
}
