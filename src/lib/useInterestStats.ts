// useInterestStats — compute demographics over "people you can see"
// (your circle + followers/following) that share a given filter set
// of interests.
//
// The Interests tab uses this to render:
//   - count of matching people
//   - personality (Big Five) average per trait
//   - gender ratio
//   - age distribution buckets
//
// Data sources:
//   - useMyRelations() for the follower/friend uid sets
//   - findNearbyDiscoverable for the public-profile data (interests,
//     gender, age, country, personality) of those uids. We deliberately
//     don't fan out a getDoc per friend — instead we read the
//     discoverable doc which is the public projection of the same
//     fields and already shaped for cross-user reads.
//
// k-anonymity floor: when fewer than 3 people match, return an
// "insufficient" flag so the UI can render an honest "not enough
// data yet" copy instead of a misleading 100%-of-1-person chart.

import { useEffect, useMemo, useState } from "react";
import { firebaseEnabled } from "./firebase";
import { useAuth } from "./useAuth";
import { useMyRelations } from "./useMyRelations";

const K_ANONYMITY_FLOOR = 3;

interface PublicProfileSnapshot {
  uid: string;
  interestNames?: string[];
  personality?: number[];
  gender?: string;
  age?: number;
  country?: string;
}

export interface InterestStats {
  loading: boolean;
  /** Number of people in your circle/followers who share any of the filtered interests. */
  count: number;
  /** True when count < k-anonymity floor; UI should render an empty state. */
  insufficient: boolean;
  /** Big Five trait averages, 0-100 per OCEAN axis. null when no personality data. */
  personality: number[] | null;
  /** Map gender → fraction (0..1). Sums to 1. */
  genderRatio: Record<string, number>;
  /** Map age-bucket label → fraction (0..1). Buckets: <20, 20-29, 30-39, 40-49, 50+. */
  ageBuckets: Record<string, number>;
  /** Map ISO country code → fraction (0..1). Sums to 1. */
  countryRatio: Record<string, number>;
}

const AGE_BUCKETS = [
  { label: "<20", lo: 0, hi: 19 },
  { label: "20-29", lo: 20, hi: 29 },
  { label: "30-39", lo: 30, hi: 39 },
  { label: "40-49", lo: 40, hi: 49 },
  { label: "50+", lo: 50, hi: 130 },
];

function bucketAge(age: number): string {
  for (const b of AGE_BUCKETS) {
    if (age >= b.lo && age <= b.hi) return b.label;
  }
  return "?";
}

function emptyStats(loading: boolean): InterestStats {
  return {
    loading,
    count: 0,
    insufficient: true,
    personality: null,
    genderRatio: {},
    ageBuckets: {},
    countryRatio: {},
  };
}

export function useInterestStats(selectedInterestNames: string[]): InterestStats {
  const { user } = useAuth();
  const rel = useMyRelations();
  const [snapshots, setSnapshots] = useState<PublicProfileSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Build the uid set we care about: my friends + my followers +
  // the people I follow. Dedupe so a mutual follower-and-friend
  // counts once. Excludes myself.
  const relevantUids = useMemo(() => {
    const set = new Set<string>();
    for (const r of rel.friends) set.add(r.uid);
    for (const r of rel.followers) set.add(r.uid);
    for (const r of rel.following) set.add(r.uid);
    if (user) set.delete(user.uid);
    return [...set];
  }, [rel.friends, rel.followers, rel.following, user]);

  // Stable string key so the effect's dep array can stay simple
  // without the lint complaining about the join expression inline.
  const uidsKey = relevantUids.join(",");

  // Fetch each relevant uid's discoverable doc — the discoverable
  // collection is readable to any signed-in user (the public
  // projection of profile data), so this is the cheap path. We
  // use getDoc rather than a query because we know the exact ids.
  useEffect(() => {
    if (!firebaseEnabled || !user || relevantUids.length === 0) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { fetchPublicProfiles } = await import("./firebase");
        const list = await fetchPublicProfiles(relevantUids);
        if (cancelled) return;
        setSnapshots(list);
      } catch (err) {
        console.error("[useInterestStats] fetch failed:", err);
        if (!cancelled) setSnapshots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // relevantUids itself is recomputed via useMemo above; we only
    // need to re-fetch when its content key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, uidsKey]);

  const selectedKey = selectedInterestNames.join(",");
  return useMemo(() => {
    if (loading) return emptyStats(true);
    const lowered = selectedInterestNames.map((n) => n.toLowerCase());
    const filterEmpty = lowered.length === 0;
    // Match users whose interest list shares any selected name.
    // Empty filter = include everyone we have.
    const matching = snapshots.filter((s) => {
      if (filterEmpty) return true;
      if (!s.interestNames || s.interestNames.length === 0) return false;
      const theirs = s.interestNames.map((n) => n.toLowerCase());
      return lowered.some((q) => theirs.includes(q));
    });

    const count = matching.length;
    if (count < K_ANONYMITY_FLOOR) {
      return { ...emptyStats(false), count };
    }

    // Personality average. Only count snapshots that actually have a
    // 5-element vector.
    const withPersonality = matching.filter(
      (s) => Array.isArray(s.personality) && s.personality.length === 5,
    );
    let personality: number[] | null = null;
    if (withPersonality.length >= K_ANONYMITY_FLOOR) {
      const sums = [0, 0, 0, 0, 0];
      for (const s of withPersonality) {
        for (let i = 0; i < 5; i++) sums[i] += s.personality![i];
      }
      personality = sums.map((v) => Math.round(v / withPersonality.length));
    }

    const tally = <T extends string>(getter: (s: PublicProfileSnapshot) => T | undefined) => {
      const counts: Record<string, number> = {};
      let total = 0;
      for (const s of matching) {
        const v = getter(s);
        if (!v) continue;
        counts[v] = (counts[v] || 0) + 1;
        total += 1;
      }
      const out: Record<string, number> = {};
      if (total === 0) return out;
      for (const [k, n] of Object.entries(counts)) out[k] = n / total;
      return out;
    };

    const genderRatio = tally((s) => s.gender);
    const countryRatio = tally((s) => s.country);
    const ageBuckets = tally((s) =>
      typeof s.age === "number" ? bucketAge(s.age) : undefined,
    );

    return {
      loading: false,
      count,
      insufficient: false,
      personality,
      genderRatio,
      ageBuckets,
      countryRatio,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, selectedKey, loading]);
}
