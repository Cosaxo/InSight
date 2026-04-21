import { C } from "../theme";
import { MY_INTS, P_TRAITS } from "../data/constants";
import type { CoreValues, Me, Person } from "../types";

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
