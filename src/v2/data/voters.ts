// Named who-voted — the cross-user read D98 exists to make possible.
//
// Every other module under data/ reads the viewer's own documents and the
// public aggregates. This one reads OTHER PEOPLE'S answers, which until
// D98 no rule permitted and no client attempted. It is the first of its
// kind here, so the shape it establishes matters more than usual:
//
//   1. ONE collection-group query per question, on demand. Not a listener.
//      A question's voter list is opened, not watched — the same posture
//      loadTakes takes, for the same reason (a scrolled-past card must
//      cost nothing).
//   2. Names come from a BATCHED profile read, deduped and session-cached.
//      Resolving uid → name one document at a time is the obvious version
//      and it is a read per voter per open.
//   3. Cohort chips come from the ANSWER, never from the profile. The
//      answer carries the anchors snapshot taken at vote time (D8), so a
//      voter who has since moved city still appears in the city they
//      answered from. Reading the live profile for that would silently
//      re-cohort history, which is the exact thing the snapshot exists to
//      prevent — and it would disagree with the aggregate, which folds
//      the snapshot.
//
// The surface filter is not optional and not a nicety. firestore.rules
// grants the collection-group read as a VALUE test on `surface`, so a
// query without a matching `where` is refused wholesale rather than
// filtered down (D65's lesson, re-proved for this query in
// rules.test.ts). It is also what keeps sealed duel answers out: they
// carry surface "group"/"duo" and are nobody's business until the reveal.

// The API arrives through lib/firebase's memoised dynamic import, not a
// static one (D110) — a static import here would put the 292 KB Firestore
// SDK back in the first-paint graph, because live.ts imports this module
// eagerly. The type import is erased and costs nothing.
import { getFirestoreApi } from "../../lib/firebase";
import type { Firestore } from "firebase/firestore";
// Pure arithmetic, no Firebase anywhere in it — safe to import statically
// without re-opening the first-paint hole the comment above closes.
import { CORE_TEST_KINDS, parseTestResults, type ParsedResults } from "./similarity";

// The surfaces a world answer can carry. Must match the array in
// firestore.rules' collection-group grant exactly — a value here the rule
// does not list makes the whole query fail closed, which is the safe
// direction but an invisible one.
export const WORLD_ANSWER_SURFACES = ["daily", "feed", "test", "learn", "pulse"] as const;

// Voters one fetch returns — the newest first, because the query already
// orders by answeredAt desc (D102).
//
// This bound is what keeps the who-voted sheet from being the app's only
// unbounded read. The daily question is globally shared (computeDeckIds
// takes no uid), so its crowd is roughly "everyone active that day":
// uncapped, one sheet open at 5,000 DAU is ~5,000 answer reads plus up to
// that many profile reads for names — ~10,000 billed reads and a
// multi-second list render for a single tap, growing linearly with DAU
// forever. Every sibling fan-out already carries its bound
// (CIRCLE_ANSWER_CAP, FOLLOW_CAP, KINDRED_QUESTIONS, AGG_ID_CAP); this
// was the one that shipped without.
//
// 200 is a screen-and-a-half of names beyond anyone's patience (~7,000 px
// of rows) and well above any launch-scale crowd, so at small sizes the
// sheet is exhaustive and says nothing about it; when the cap binds, the
// panel says "the latest 200" rather than presenting a truncation as the
// whole room (LiveVotersPanel). Kindred inherits the same bound per
// question: recency-biased, which is the honest bias for a likeness
// ranking drawn from live lists. If a fuller list is ever worth having,
// the answer is to PAGE from the cursor this ordering already provides —
// not to raise the number quietly (the D101 rule).
export const VOTER_FETCH_CAP = 200;

// Firestore's `in` operator caps at 30 values per query (it was 10 before
// 2023). Name resolution chunks on this.
export const UID_CHUNK = 30;

export interface Voter {
  uid: string;
  optionIdx: number;
  /** The cohort this answer was given from — frozen at vote time (D8). */
  anchors: Record<string, string>;
  /** Display name, or "" when the voter has not set one. */
  name: string;
  /** True for the viewer's own answer, so the UI can mark it. */
  isMe: boolean;
}

// ── pure helpers (unit-tested without Firebase) ─────────────────────

/** Split uids into `in`-sized chunks, preserving order and deduping. */
export function chunkUids(uids: readonly string[], size = UID_CHUNK): string[][] {
  const seen = new Set<string>();
  const flat: string[] = [];
  for (const u of uids) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    flat.push(u);
  }
  const out: string[][] = [];
  for (let i = 0; i < flat.length; i += size) out.push(flat.slice(i, i + size));
  return out;
}

/**
 * Group voters by the option they picked, as a dense array of the
 * question's option count.
 *
 * Dense rather than sparse on purpose: the UI draws one column per option
 * including the empty ones, and a missing key would render as a missing
 * column rather than an empty one — "nobody picked this" is a result.
 */
export function groupByOption(voters: readonly Voter[], optionCount: number): Voter[][] {
  const out: Voter[][] = Array.from({ length: Math.max(0, optionCount) }, () => []);
  for (const v of voters) {
    if (v.optionIdx >= 0 && v.optionIdx < out.length) out[v.optionIdx].push(v);
  }
  return out;
}

/**
 * The order voters are shown in: the viewer first, then named people, then
 * the unnamed.
 *
 * Putting yourself first is not vanity — it is the fastest way to check
 * that the list is telling the truth about you, which is the first thing
 * anyone does with a screen like this. Unnamed last because a run of
 * "Someone" at the top reads as a broken list.
 */
export function sortVoters(voters: readonly Voter[]): Voter[] {
  return [...voters].sort((a, b) => {
    if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
    const an = a.name ? 0 : 1;
    const bn = b.name ? 0 : 1;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid);
  });
}

/** The uid owning an answer document, from its path: v2_users/{uid}/answers/{qid}. */
export function uidFromAnswerPath(path: string): string | null {
  const parts = path.split("/");
  const i = parts.indexOf("v2_users");
  return i >= 0 && parts.length > i + 1 ? parts[i + 1] : null;
}

// ── the reads ───────────────────────────────────────────────────────

/**
 * Everyone who answered `qid`, with their frozen cohort and their name.
 *
 * `names` is an inout session cache owned by the caller (live.ts), so two
 * questions answered by overlapping crowds pay for each profile once.
 */
/**
 * How the people you FOLLOW answered `qid` — asked of them directly.
 *
 * WHY THIS EXISTS AND `fetchVoters` DOES NOT SERVE IT. The Friends cut
 * used to be a filter over `fetchVoters`: pull the newest
 * VOTER_FETCH_CAP answers from ANYONE, then keep the handful whose uid is
 * in your follow list. That is a sampling window standing in for a lookup,
 * and it fails in the direction that looks like an answer — at 500 users
 * the newest 200 answers contain most of the room, so your friends are in
 * there; at 50,000 they are whoever answered in the last few minutes, so a
 * friend who answered this morning has fallen out and the panel says
 * "None of the people you follow has answered this yet" about someone who
 * did. Wrong, silently, and more wrong the better the app does. Raising
 * the cap delays it; it cannot fix it, because the window is a proxy for
 * the wrong question.
 *
 * So this asks the right one. You follow at most FOLLOW_CAP accounts and
 * their answer documents live at a known path, so the cost is one small
 * query per follow — bounded by YOUR follow list rather than by the
 * population, exact at every size, and typically five reads against the
 * old ~400 (up to 200 answers plus up to 200 profiles).
 *
 * ONE QUERY PER FOLLOW, and the shape is not a free choice — both cheaper
 * shapes are refused by `firestore.rules`, measured against the emulator
 * rather than reasoned about:
 *
 *   - a direct `getDoc` per follow is PERMISSION_DENIED when that follow
 *     has NOT answered. The read rule tests `resource.data.surface`, and
 *     `resource` is null for a document that does not exist, so the
 *     common case — a friend who has not answered yet — is an error
 *     rather than an empty result.
 *   - one collection-group query with `documentId() in [paths]` fails the
 *     same way ("Null value error") the moment any path in the batch is
 *     missing, which is not knowable in advance.
 *
 * A LIST scoped to one user's subcollection has neither problem: a query
 * matches only documents that exist, so a non-answerer returns zero rows
 * and costs one read. It is also the shape `circle.ts` already ships, so
 * this is the established pattern here rather than a new one.
 *
 * `anchors` is deliberately not read into the result — the Friends rows
 * render a name and a chosen option, not cohort chips. The field stays on
 * the Voter shape so the two lists remain the same type.
 */
export async function fetchFriendVoters(
  db: Firestore,
  qid: string,
  followUids: readonly string[],
  myUid: string | null,
  names: Record<string, string>,
  scores?: Record<string, ParsedResults | null>,
): Promise<Voter[]> {
  if (!qid || !followUids.length) return [];
  const { collection: fsCollection, getDocs, query, where } = await getFirestoreApi();
  // Bounded by FOLLOW_CAP, which is what makes firing them together safe:
  // loadKindred runs its twelve sequentially because most are cache hits
  // after the first, and there is no such overlap here — every query is a
  // different account, so there is nothing for a second pass to reuse.
  const snaps = await Promise.all(followUids.map((uid) => getDocs(query(
    fsCollection(db, "v2_users", uid, "answers"),
    // The surface filter is the duel seal and is NOT optional: the rule
    // grants this list as a VALUE test on `surface`, so a query without a
    // matching `where` is refused wholesale rather than filtered down
    // (D65). Same array, same reason, as fetchVoters below.
    where("surface", "in", [...WORLD_ANSWER_SURFACES]),
    where("qid", "==", qid),
  ))));

  const rows: Voter[] = [];
  followUids.forEach((uid, i) => {
    // At most one: an answer doc is keyed by qid within a user, so this
    // query returns zero rows or one. Written as a loop rather than
    // `docs[0]` so a duplicate — which would mean the id convention had
    // changed — shows up as two rows instead of being silently dropped.
    for (const d of snaps[i].docs) {
      const optionIdx = d.get("optionIdx");
      // Catalog answers carry `entity`, not `optionIdx`, and have no
      // option column to sit in — skipped for the same reason
      // fetchVoters skips them.
      if (typeof optionIdx !== "number") continue;
      rows.push({
        uid,
        optionIdx,
        anchors: {},
        name: "",
        isMe: uid === myUid,
      });
    }
  });

  await resolveNames(db, rows.map((r) => r.uid), names, scores);
  for (const r of rows) r.name = names[r.uid] || "";
  return rows;
}

export async function fetchVoters(
  db: Firestore,
  qid: string,
  myUid: string | null,
  names: Record<string, string>,
  scores?: Record<string, ParsedResults | null>,
): Promise<Voter[]> {
  const { collectionGroup, getDocs, limit: fsLimit, orderBy, query, where } = await getFirestoreApi();
  const snap = await getDocs(query(
    collectionGroup(db, "answers"),
    where("qid", "==", qid),
    where("surface", "in", [...WORLD_ANSWER_SURFACES]),
    orderBy("answeredAt", "desc"),
    fsLimit(VOTER_FETCH_CAP),
  ));

  const rows: Voter[] = [];
  for (const d of snap.docs) {
    const uid = uidFromAnswerPath(d.ref.path);
    if (!uid) continue;
    const optionIdx = d.get("optionIdx");
    // A catalog answer carries `entity`, not `optionIdx`, and has no
    // option column to sit in. Skipped rather than coerced — a catalog
    // board is a different surface with a different renderer.
    if (typeof optionIdx !== "number") continue;
    const anchors = (d.get("anchors") || {}) as Record<string, string>;
    rows.push({ uid, optionIdx, anchors, name: "", isMe: uid === myUid });
  }

  await resolveNames(db, rows.map((r) => r.uid), names, scores);
  for (const r of rows) r.name = names[r.uid] || "";
  return rows;
}

/**
 * Fill `names` for any uid it does not already hold. Mutates the cache.
 *
 * A uid whose profile read returns nothing is cached as "" rather than
 * left absent, so a nameless account is not re-fetched on every open.
 *
 * When a `scores` cache is passed (D112), the SAME read also fills uid →
 * parsed test scores. The web SDK has no field mask, so the whole profile
 * document — testResults included — was already on the wire every time
 * this resolved a name; extracting scores here is the read the app
 * already paid for, not a second one. `null` is cached for a profile with
 * nothing usable, mirroring the "" convention, so absence is never
 * re-fetched per open.
 */
export async function resolveNames(
  db: Firestore,
  uids: readonly string[],
  names: Record<string, string>,
  scores?: Record<string, ParsedResults | null>,
): Promise<void> {
  const missing = uids.filter((u) => !(u in names) || (scores ? !(u in scores) : false));
  if (!missing.length) return;
  const {
    collection: fsCollection, documentId, getDocs, query, where,
  } = await getFirestoreApi();
  for (const batch of chunkUids(missing)) {
    const snap = await getDocs(query(
      fsCollection(db, "v2_users"),
      where(documentId(), "in", batch),
    ));
    for (const d of snap.docs) {
      const n = d.get("displayName");
      names[d.id] = typeof n === "string" ? n.trim().slice(0, 60) : "";
      if (scores) scores[d.id] = parseTestResults(d.get("testResults"), CORE_TEST_KINDS);
    }
    // Anything the query did not return does not exist — cache the
    // absence so the next open does not re-ask for it.
    for (const u of batch) {
      if (!(u in names)) names[u] = "";
      if (scores && !(u in scores)) scores[u] = null;
    }
  }
}
