// useCircleInterestDistribution — counts how often each interest
// appears across the people you can see (friends + followers +
// following). Used by PeopleTab to render "your circle is mostly
// into music; very few into tech" style breakdowns.
//
// Reuses fetchPublicProfiles (the same cross-user read path the
// Interests-tab demographics card uses). One round-trip on mount
// per relation set, cached at the hook level.

import { useEffect, useMemo, useState } from "react";
import { firebaseEnabled, fetchPublicProfiles } from "./firebase";
import { useAuth } from "./useAuth";
import { useMyRelations } from "./useMyRelations";

export interface CircleInterestDistribution {
  /** Total people we counted across (with k-anonymity floor of 3). */
  totalPeople: number;
  /** True when totalPeople < 3 — UI should show empty-state copy. */
  insufficient: boolean;
  loading: boolean;
  /** Sorted descending by count. */
  topInterests: { name: string; count: number; fraction: number }[];
}

const K_ANONYMITY_FLOOR = 3;

export function useCircleInterestDistribution(): CircleInterestDistribution {
  const { user } = useAuth();
  const rel = useMyRelations();
  const [snapshots, setSnapshots] = useState<
    Array<{ uid: string; interestNames?: string[] }>
  >([]);
  const [loading, setLoading] = useState<boolean>(false);

  const relevantUids = useMemo(() => {
    const set = new Set<string>();
    for (const r of rel.friends) set.add(r.uid);
    for (const r of rel.followers) set.add(r.uid);
    for (const r of rel.following) set.add(r.uid);
    if (user) set.delete(user.uid);
    return [...set];
  }, [rel.friends, rel.followers, rel.following, user]);

  const uidsKey = relevantUids.join(",");

  useEffect(() => {
    if (!firebaseEnabled || !user || relevantUids.length === 0) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const list = await fetchPublicProfiles(relevantUids);
        if (cancelled) return;
        setSnapshots(list);
      } catch (err) {
        console.error("[useCircleInterestDistribution] fetch failed:", err);
        if (!cancelled) setSnapshots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, uidsKey]);

  return useMemo<CircleInterestDistribution>(() => {
    if (loading) {
      return {
        totalPeople: 0,
        insufficient: true,
        loading: true,
        topInterests: [],
      };
    }
    const withInterests = snapshots.filter(
      (s) => Array.isArray(s.interestNames) && s.interestNames.length > 0,
    );
    const totalPeople = withInterests.length;
    if (totalPeople < K_ANONYMITY_FLOOR) {
      return {
        totalPeople,
        insufficient: true,
        loading: false,
        topInterests: [],
      };
    }
    // Case-fold the names so "Pottery" and "pottery" count together.
    // We render the most-common original casing for display.
    const counts: Record<string, { name: string; count: number }> = {};
    for (const s of withInterests) {
      const seen = new Set<string>();
      for (const raw of s.interestNames!) {
        const key = raw.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (!counts[key]) counts[key] = { name: raw, count: 0 };
        counts[key].count += 1;
      }
    }
    const topInterests = Object.values(counts)
      .map((c) => ({
        name: c.name,
        count: c.count,
        fraction: c.count / totalPeople,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    return {
      totalPeople,
      insufficient: false,
      loading: false,
      topInterests,
    };
  }, [snapshots, loading]);
}
