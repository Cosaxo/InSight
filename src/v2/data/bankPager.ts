// bankPager.ts — which cards a device actually fetches (D306 for learn,
// D307 for the feed tail; both build D302 phases 2–3).
//
// A paged surface left the whole-bank boot fetch: a device takes PAGES
// against the order rankBankV2 publishes nightly onto `v2_rank/{surface}`
// (D305). This module is the arithmetic of that — which qids are needed —
// behind injected I/O, so the paging rules are unit-testable the way the
// bank cache's are. Learn pages per followed field; the feed pages its
// TAIL per topic while core ships whole at boot (D161: the corpus's value
// is density, so it is never paged).
//
// THE SEEN-SET IS THE CACHE, and that is the design rather than a
// shortcut. A card the device was ever handed is in the bank cache
// (bankStore.ts), so "first N of the published order not in the cache"
// is exactly "next N this device has not met" — no profile, no upload,
// nothing the server learns (D303's phase 1 boundary: the fetch pattern
// is topic-coarse, and the ORDER is the crowd's). Cached cards are never
// re-fetched and never dropped: the learn map reads mastered cards out
// of the pool and the feed's archive keeps expired docs (the n_closed
// rule), so the cache must keep everything the device has history with —
// which it does by construction.
//
// TOP-UPS RUN PER BOOT, not per serve. A page is more than a session
// consumes (learn serves about one card in seven feed cards; the feed's
// page rides on top of the whole core), so in-session exhaustion falls
// back to what the device already holds until the next boot. That is a
// recorded limit (D306), not an oversight: the alternative is the UI
// signalling the data layer mid-session, a seam worth adding when a
// measured session actually outruns a page.

export interface PageOrderTopic {
  qids: string[];
  total: number;
}

export interface PageOrderDoc {
  topics: Record<string, PageOrderTopic>;
}

/** Fresh learn cards fetched per followed field per boot. FIELD_TARGET's
 * shape: a field's worth of runway, refilled every boot. */
export const LEARN_PAGE = 24;

/** Fresh tail questions fetched per feed topic per boot. Today's bank
 * holds about this many per topic in total, so the paged feed reproduces
 * the whole-bank feed exactly until the lanes outgrow it — which is the
 * point where paging starts paying. */
export const FEED_PAGE = 12;

/**
 * The qids to fetch, two obligations joined:
 *
 * 1. HISTORY the cache lost. A card this device has answered must be
 *    fetchable whatever else happens — the learn map reads mastered
 *    cards out of the pool, the Mirror files every answer — and a
 *    contentRev bump refetches only the boot surfaces, so paged docs
 *    fall out of the cache. Healed by id, order or no order, across
 *    all fields/topics.
 * 2. PAGES: for each named field/topic (null = every one the order
 *    carries — learn's D283 follow-everything default, and the feed's
 *    D96 always-on topics), the first `pageSize` of the published order
 *    the cache does not already hold.
 */
export function pageNeedList(
  order: PageOrderDoc | null,
  cachedIds: ReadonlySet<string>,
  fields: readonly string[] | null,
  historyIds: readonly string[],
  pageSize: number | ((field: string) => number),
): string[] {
  const need: string[] = [];
  const taken = new Set<string>();
  for (const qid of historyIds) {
    if (cachedIds.has(qid) || taken.has(qid)) continue;
    need.push(qid);
    taken.add(qid);
  }
  if (!order || !order.topics) return need;
  const names = fields ?? Object.keys(order.topics);
  const sizeOf = typeof pageSize === "function" ? pageSize : () => pageSize;
  for (const f of names) {
    const topic = order.topics[f];
    if (!topic || !Array.isArray(topic.qids)) continue;
    const size = sizeOf(f);
    let fresh = 0;
    for (const qid of topic.qids) {
      if (fresh >= size) break;
      if (cachedIds.has(qid) || taken.has(qid)) continue;
      need.push(qid);
      taken.add(qid);
      fresh += 1;
    }
  }
  return need;
}

/** How many answers a profile needs before it shapes anything, and how
 * many in a topic before that topic counts as YOURS. Below the first,
 * everyone gets the uniform feed — a profile of three answers "knowing"
 * you is the over-eager personalization this floor refuses. */
export const TASTE_MIN_TOTAL = 10;
export const TASTE_TOPIC_MIN = 3;

/**
 * D303 phase 1's whole effect on serving, in one function: per-topic
 * page sizes from the person's own profile. Topics they actually answer
 * get the full page; the rest get a smaller one — never zero, because
 * every topic stays on (D96: narrowing is a choice, not a default) and
 * a cold topic must keep enough fresh cards to be discoverable, which
 * is how a profile gets to change. Null profile, or one under the
 * floor, means the flat base for everyone — a new device's feed is
 * identical to the pre-profile feed.
 */
export function pageSizesByInterest(
  profile: { t?: Record<string, number>; n?: number } | null,
  base: number,
): number | ((topic: string) => number) {
  const total = profile?.n ?? 0;
  const t = profile?.t;
  if (!t || total < TASTE_MIN_TOTAL) return base;
  const cold = Math.max(4, Math.ceil(base / 3));
  return (topic) => ((t[topic] ?? 0) >= TASTE_TOPIC_MIN ? base : cold);
}

/** Per-field/topic bank totals off the order doc — the sheet's honest
 * "N questions" once the pool is a page rather than the bank. */
export function pageTotals(order: PageOrderDoc | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!order || !order.topics) return out;
  for (const [f, t] of Object.entries(order.topics)) {
    if (t && Array.isArray(t.qids)) out[f] = t.qids.length;
  }
  return out;
}

export interface PagerIO<Row> {
  /** The published order — one read of v2_rank/{surface}, null when the
   * fold has not run yet (a fresh project), which pages nothing. */
  order(): Promise<PageOrderDoc | null>;
  /** Question documents by id, however many round trips that takes. */
  fetchByIds(qids: string[]): Promise<Row[]>;
}

/**
 * One boot's top-up for one surface: read the order, compute the need,
 * fetch it. Returns the fetched rows and the order's per-field totals;
 * the caller (live.ts) owns appending to state and cache — this module
 * never touches either.
 */
export async function topUpPages<Row>(
  io: PagerIO<Row>,
  cachedIds: ReadonlySet<string>,
  fields: readonly string[] | null,
  historyIds: readonly string[],
  pageSize: number | ((field: string) => number),
): Promise<{ rows: Row[]; totals: Record<string, number> }> {
  const order = await io.order();
  const need = pageNeedList(order, cachedIds, fields, historyIds, pageSize);
  const rows = need.length ? await io.fetchByIds(need) : [];
  return { rows, totals: pageTotals(order) };
}

/** The followed learn fields as the device stores them
 * (learn-progress.js's `insight.learnFields.v1`), null when unset —
 * which is D283's default, every field. Read here rather than asked of
 * the engine because data/ must not import spec/ (the one-way rule). */
export function followedFields(): string[] | null {
  try {
    const raw = localStorage.getItem("insight.learnFields.v1");
    const parsed = raw == null ? null : (JSON.parse(raw) as unknown);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

/** The learn card ids this device has HISTORY with (learn-progress.js's
 * `insight.learn.v3` mastery map), in the bank's `learn-` spelling —
 * the heal-list pageNeedList's first obligation reads. The feed's
 * history comes from `state.votes` instead (already hydrated), so only
 * learn needs a localStorage read. */
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
