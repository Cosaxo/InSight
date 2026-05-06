import { C } from "../theme";
import { MY_INTS, P_TRAITS } from "../data/constants";
import type { CoreValues, InterestBar, Me, Person, Profile } from "../types";

export interface Quadrant {
  name: string;
  color: string;
}

export function cvQuadrant(cv: CoreValues | undefined | null): Quadrant {
  const change = cv?.change ?? 0;
  const indiv = cv?.indiv ?? 0;
  if (change >= 0 && indiv < 0) return { name: "Disruptor", color: C.teal };
  if (change >= 0 && indiv >= 0) return { name: "Progressive", color: C.green };
  if (change < 0 && indiv < 0) return { name: "Libertarian", color: C.purple };
  return { name: "Communitarian", color: C.amber };
}

export function calcSim(p: Person, me: Me): number {
  const pD = P_TRAITS.reduce(
    (s, _trait, i) => s + Math.abs(p.personality[i] - me.personality[i]),
    0,
  );
  const eD = Math.abs((p.political?.econ || 0) - me.political.econ) / 50;
  const sD = Math.abs((p.political?.social || 0) - me.political.social) / 50;
  return Math.round(
    (100 - pD / P_TRAITS.length) * 0.65 + 100 * (1 - (eD + sD) / 2) * 0.35,
  );
}

export function sharedInt(p: Person): string[] {
  return (p.interests || []).filter((i) => MY_INTS.includes(i));
}

export function fmtDate(s: string | undefined): string {
  return s
    ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "—";
}

interface AggregateMeta {
  name: string;
  subtitle?: string;
  color: string;
}

// Aggregate a list of people into a synthetic Profile. Personality / political /
// core values are arithmetic means; interests and values are frequency-ranked.
// Returns null if the list is empty (callers fall back to defaults).
export function aggregateProfile(
  people: Person[],
  meta: AggregateMeta,
): Profile | null {
  if (!people.length) return null;

  const personality = P_TRAITS.map((_, i) => {
    const sum = people.reduce((s, p) => s + (p.personality[i] ?? 0), 0);
    return Math.round(sum / people.length);
  });

  const political = {
    econ: Math.round(
      people.reduce((s, p) => s + (p.political?.econ ?? 0), 0) / people.length,
    ),
    social: Math.round(
      people.reduce((s, p) => s + (p.political?.social ?? 0), 0) /
        people.length,
    ),
  };

  const cv = {
    indiv: Math.round(
      people.reduce((s, p) => s + (p.cv?.indiv ?? 0), 0) / people.length,
    ),
    change: Math.round(
      people.reduce((s, p) => s + (p.cv?.change ?? 0), 0) / people.length,
    ),
  };

  const interestCounts = new Map<string, number>();
  for (const p of people) {
    for (const i of p.interests || []) {
      interestCounts.set(i, (interestCounts.get(i) || 0) + 1);
    }
  }
  const interests: InterestBar[] = Array.from(interestCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      pct: Math.round((count / people.length) * 100),
    }));

  const valueCounts = new Map<string, number>();
  for (const p of people) {
    for (const v of p.values || []) {
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    }
  }
  const values = Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label]) => label);

  return {
    name: meta.name,
    subtitle: meta.subtitle,
    color: meta.color,
    personality,
    political,
    cv,
    interests,
    values,
  };
}
