// learnPager.ts — which learn cards a device actually fetches (D306,
// building D302 phases 2–3 for the first surface).
//
// Learn left the whole-bank boot fetch: a device is no longer handed
// every learn card, it takes PAGES against the order rankBankV2
// publishes nightly onto `v2_rank/learn` (D305). This module is the
// arithmetic of that — which qids are needed — behind injected I/O, so
// the paging rules are unit-testable the way the bank cache's are.
//
// THE SEEN-SET IS THE CACHE, and that is the design rather than a
// shortcut. A card the device was ever handed is in the bank cache
// (bankStore.ts), so "first N of the published order not in the cache"
// is exactly "next N this device has not met" — no profile, no upload,
// nothing the server learns (D303's phase 1 boundary: the fetch pattern
// is topic-coarse, and the ORDER is the crowd's). Cached cards are
// never re-fetched and never dropped: the engine's map reads mastered
// cards out of the pool, so the pool must keep everything the device
// has history with — which the cache does by construction.
//
// TOP-UP RUNS PER BOOT, not per serve. A page is LEARN_PAGE fresh cards
// per followed field — more than a session consumes at the feed's learn
// cadence (about one card in seven) — so in-session exhaustion falls
// back to the engine's own slow/warm fillers until the next boot. That
// is a recorded limit (D306), not an oversight: the alternative is the
// engine signalling the data layer mid-session, a seam worth adding
// when a measured session actually outruns a page.

export interface LearnOrderTopic {
  qids: string[];
  total: number;
}

export interface LearnOrderDoc {
  topics: Record<string, LearnOrderTopic>;
}

/** Fresh cards fetched per followed field per boot. FIELD_TARGET's
 * shape: a field's worth of runway, refilled every boot. */
export const LEARN_PAGE = 24;

/**
 * The qids to fetch, two obligations joined:
 *
 * 1. HISTORY the cache lost. A card this device has answered must be in
 *    the pool whatever else happens — the map reads mastered cards out
 *    of it — and a contentRev bump refetches only the boot surfaces, so
 *    paged learn docs fall out of the cache. Healed by id, order or no
 *    order, across all fields (the map shows unfollowed fields too).
 * 2. PAGES: for each followed field (null = every field the order
 *    carries, D283's follow-everything default), the first LEARN_PAGE of
 *    the published order the cache does not already hold.
 */
export function learnNeedList(
  order: LearnOrderDoc | null,
  cachedIds: ReadonlySet<string>,
  followed: readonly string[] | null,
  historyIds: readonly string[] = [],
): string[] {
  const need: string[] = [];
  const taken = new Set<string>();
  for (const qid of historyIds) {
    if (cachedIds.has(qid) || taken.has(qid)) continue;
    need.push(qid);
    taken.add(qid);
  }
  if (!order || !order.topics) return need;
  const fields = followed ?? Object.keys(order.topics);
  for (const f of fields) {
    const topic = order.topics[f];
    if (!topic || !Array.isArray(topic.qids)) continue;
    let fresh = 0;
    for (const qid of topic.qids) {
      if (fresh >= LEARN_PAGE) break;
      if (cachedIds.has(qid) || taken.has(qid)) continue;
      need.push(qid);
      taken.add(qid);
      fresh += 1;
    }
  }
  return need;
}

/** Per-field bank totals off the order doc — the topic sheet's honest
 * "N questions" once the pool is a page rather than the bank. Field ids
 * are the engine's (`cell`), qids are the bank's (`learn-cell1`); the
 * order doc keys by field already, so this is a projection. */
export function learnTotals(order: LearnOrderDoc | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!order || !order.topics) return out;
  for (const [f, t] of Object.entries(order.topics)) {
    if (t && Array.isArray(t.qids)) out[f] = t.qids.length;
  }
  return out;
}

export interface LearnPagerIO<Row> {
  /** The published order — one read of v2_rank/learn, null when the
   * fold has not run yet (a fresh project), which pages nothing. */
  order(): Promise<LearnOrderDoc | null>;
  /** Question documents by id, however many round trips that takes. */
  fetchByIds(qids: string[]): Promise<Row[]>;
}

/**
 * One boot's top-up: read the order, compute the need, fetch it.
 * Returns the fetched rows and the order's per-field totals; the caller
 * (live.ts) owns appending to state and cache — this module never
 * touches either.
 */
export async function topUpLearn<Row>(
  io: LearnPagerIO<Row>,
  cachedIds: ReadonlySet<string>,
  followed: readonly string[] | null,
  historyIds: readonly string[] = [],
): Promise<{ rows: Row[]; totals: Record<string, number> }> {
  const order = await io.order();
  const need = learnNeedList(order, cachedIds, followed, historyIds);
  const rows = need.length ? await io.fetchByIds(need) : [];
  return { rows, totals: learnTotals(order) };
}

/** The card ids this device has HISTORY with (learn-progress.js's
 * `insight.learn.v3` mastery map), in the bank's `learn-` spelling —
 * the heal-list learnNeedList's first obligation reads. Read here for
 * followedFields' reason: data/ must not import spec/. */
export function learnHistoryIds(): string[] {
  try {
    const raw = localStorage.getItem("insight.learn.v3");
    const parsed = raw == null ? null : (JSON.parse(raw) as { c?: Record<string, unknown> });
    const c = parsed && typeof parsed === "object" ? parsed.c : null;
    return c && typeof c === "object" ? Object.keys(c).map((id) => `learn-${id}`) : [];
  } catch {
    return [];
  }
}

/** The followed fields as the device stores them (learn-progress.js's
 * `insight.learnFields.v1`), null when unset — which is D283's default,
 * every field. Read here rather than asked of the engine because data/
 * must not import spec/ (the one-way rule). */
export function followedFields(): string[] | null {
  try {
    const raw = localStorage.getItem("insight.learnFields.v1");
    const parsed = raw == null ? null : (JSON.parse(raw) as unknown);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}
