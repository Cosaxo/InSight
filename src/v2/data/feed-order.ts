// Feed ordering for the world feed's default ("hot") mode — D37.
//
// The base order is the topic round-robin the feed has always had; this
// module adds three stable partitions on top, in priority order:
//
//   1. UNANSWERED-AND-FRESH — the newest additions to the bank you have
//      not answered. The farm ships questions weekly (D33/D34); without
//      this they land at the bottom of a round-robin nobody scrolls to.
//   2. UNANSWERED-AND-CIRCLE-ADJACENT — topics your circles actually
//      duelled on, derived ONLY from revealed duels (the one activity
//      surface circle members already share by design — D5 keeps every
//      other answer owner-only, and this module reads nothing else; the
//      floored participation signal is recorded as deferred in D37).
//   3. the rest, unanswered before answered.
//
// Partitions are STABLE with respect to the incoming order — within a
// tier, the round-robin mix survives — and the caller snapshots its
// inputs once per sitting: re-ordering under the user's thumb as they
// answer is worse than any ranking win (the knowQs precedent).
import duelContent from "../../../content/duel-questions.json";

// qid → feed-topic map for the duel banks. The `cat` tags are authored
// metadata in content/duel-questions.json (never emitted to the server —
// the bank's `topic` field carries the us/pick/classic kind and must keep
// doing so for duelQFor). Bundled here: 44 entries, and the map must work
// before any network.
const DUEL_CAT: Record<string, string> = {};
for (const q of duelContent.group as Array<{ id: string; cat?: string }>) {
  if (q.cat) DUEL_CAT[`group-${q.id}`] = q.cat;
}
(duelContent.oneVsOne as Array<{ id: string; cat?: string }>).forEach((q) => {
  if (q.cat) DUEL_CAT[`duo-${q.id}`] = q.cat;
});
export { DUEL_CAT };

// How many of the bank's newest cards count as "fresh". Small on purpose:
// freshness is a doorway, not a takeover — one farm batch's worth.
export const RECENT_N = 8;

export interface OrderableCard {
  id: string;
  cat?: string;
}

// Topics your circles engaged, from revealed duels only. Callers pass
// whatever reveal docs are already in memory (revealHistory loads lazily
// elsewhere); an empty list simply means no boost — never a fetch.
export function affinityFrom(
  reveals: Array<Record<string, unknown>>,
): Set<string> {
  const cats = new Set<string>();
  for (const r of reveals) {
    const qid = typeof r.qid === "string" ? r.qid : null;
    const cat = qid ? DUEL_CAT[qid] : null;
    if (cat) cats.add(cat);
  }
  return cats;
}

export function orderFeed<T extends OrderableCard>(
  mixed: T[],
  opts: {
    answered: Set<string>;
    recentIds: Set<string>;
    affinity: Set<string>;
  },
): T[] {
  const fresh: T[] = [];
  const adjacent: T[] = [];
  const rest: T[] = [];
  const done: T[] = [];
  for (const q of mixed) {
    if (opts.answered.has(q.id)) done.push(q);
    else if (opts.recentIds.has(q.id)) fresh.push(q);
    else if (q.cat && opts.affinity.has(q.cat)) adjacent.push(q);
    else rest.push(q);
  }
  return [...fresh, ...adjacent, ...rest, ...done];
}

// Published for the spec layer (world-feed.jsx reads window.FEED_ORDER at
// assembly time — src/v2/README.md convention; the scanner discovers this
// definition). Guarded for the plain-node test environment.
declare global {
  interface Window {
    FEED_ORDER: {
      orderFeed: typeof orderFeed;
      affinityFrom: typeof affinityFrom;
      RECENT_N: number;
    };
  }
}
if (typeof window !== "undefined") {
  window.FEED_ORDER = { orderFeed, affinityFrom, RECENT_N };
}
