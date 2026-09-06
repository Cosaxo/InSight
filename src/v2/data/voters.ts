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
import { CORE_TEST_KINDS, parseLogicPct, parseTestResults, type ParsedResults } from "./similarity";

// The surfaces a world answer can carry. Must match the array in
// firestore.rules' collection-group grant exactly — a value here the rule
// does not list makes the whole query fail closed, which is the safe
// direction but an invisible one.
export const WORLD_ANSWER_SURFACES = ["daily", "feed", "test", "learn", "pulse", "call"] as const;

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
 * Who answered `qid` and what they picked — the ONE query, before any
 * profile is read.
 *
 * Split out of `fetchVoters` because the name resolution beneath it is a
 * second, larger read: up to VOTER_FETCH_CAP profile documents, chunked 30
 * at a time. That is the `×2` the D98-surfaces column in docs/COSTS.md
 * carries, and a caller that only wants the picks was paying it for a
 * `names` map nothing ever read (data/patterns.ts's pair card).
 *
 * Same query, same caps, same catalog skip — factored, not re-issued, so
 * the two paths cannot drift apart on which answers count as votes.
 *
 * `city` NARROWS THE QUERY rather than the result (D278). The unscoped
 * form returns the newest VOTER_FETCH_CAP answers from anywhere, and the
 * City constellation then filters them to one city on the device
 * (`rankKindred`'s `city` option). At any real population that discards
 * nearly everything it just paid for: with a city holding 2% of active
 * users, ~4 of every 200 rows survive, and because the cap binds BEFORE
 * the filter the number of reachable city-mates saturates around 50 no
 * matter how large the city grows. The ring draws 12, so it fills either
 * way — the failure has no symptom, which is what makes it worth a second
 * query rather than a bigger cap. Same cap, same rows read, ~50× the
 * usable rows: modelled at 100k users with a 2% city, reachable city-mates
 * 51 → 1,387 and the chance the single closest person is a candidate at
 * all 23% → 90%.
 *
 * THE ANCHOR, NOT THE PROFILE. `anchors.city` is the snapshot the answer
 * froze at vote time (D8) — the same field the aggregate folds and the
 * same one `kindredPeople` reads back — so this query and the ranking
 * agree about who counts as living where. Filtering on the live profile
 * would re-cohort history and disagree with both.
 */
export async function fetchVoterPicks(
  db: Firestore,
  qid: string,
  myUid: string | null = null,
  city?: string,
): Promise<Voter[]> {
  const { collectionGroup, getDocs, limit: fsLimit, orderBy, query, where } = await getFirestoreApi();
  const snap = await getDocs(query(
    collectionGroup(db, "answers"),
    where("qid", "==", qid),
    where("surface", "in", [...WORLD_ANSWER_SURFACES]),
    // The surface clause above is not optional and this one does not
    // replace it: firestore.rules grants this read as a VALUE test on
    // `surface`, so a query missing that `where` is refused wholesale
    // (D65). An EXTRA equality only narrows what the rule already allows,
    // which rules.test.ts pins rather than assumes.
    ...(city ? [where("anchors.city", "==", city)] : []),
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
  return rows;
}

/**
 * The nightly voter SAMPLE for `qid` (D385) — the newest VOTER_FETCH_CAP
 * voters as the fit published them last night at `v2_patterns/sample-{qid}`:
 * one document read where `fetchVoterPicks` is up to two hundred. Same
 * rows in the same shape — uid, option index, the answer's frozen chips
 * (D8) — newest first, so every fold that only COUNTS (Kindred, the People
 * lens, the pair card) reads it in place of the live query. The who-voted
 * sheet, a live list of names on screen that must show the viewer's own
 * answer the moment it lands, keeps the live query.
 *
 * Null when no sample exists yet — a question the nightly run has not
 * touched since D385, or the tail — so the caller falls back to the live
 * query rather than reading absence as an empty crowd.
 */
export async function fetchVoterSample(
  db: Firestore,
  qid: string,
  myUid: string | null = null,
): Promise<Voter[] | null> {
  const { doc, getDoc } = await getFirestoreApi();
  const snap = await getDoc(doc(db, "v2_patterns", `sample-${qid}`));
  if (!snap.exists()) return null;
  const rows = (snap.get("rows") as Record<string, { o?: unknown; a?: unknown; d?: unknown }> | undefined) ?? {};
  const out: { v: Voter; d: string }[] = [];
  for (const [uid, r] of Object.entries(rows)) {
    if (!uid || typeof r?.o !== "number") continue;
    out.push({
      v: {
        uid,
        optionIdx: r.o,
        anchors: (r.a && typeof r.a === "object" ? r.a : {}) as Record<string, string>,
        name: "",
        isMe: uid === myUid,
      },
      d: typeof r.d === "string" ? r.d : "",
    });
  }
  // newest first, then uid — the server's own total order
  out.sort((a, b) => (a.d !== b.d ? (a.d < b.d ? 1 : -1) : a.v.uid < b.v.uid ? -1 : a.v.uid > b.v.uid ? 1 : 0));
  return out.map((x) => x.v);
}

/**
 * Everyone who answered `qid`, with their frozen cohort and their name.
 *
 * `names` is an inout session cache owned by the caller (live.ts), so two
 * questions answered by overlapping crowds pay for each profile once.
 */
export async function fetchVoters(
  db: Firestore,
  qid: string,
  myUid: string | null,
  names: Record<string, string>,
  scores?: Record<string, ParsedResults | null>,
  logic?: Record<string, number | null>,
  city?: string,
): Promise<Voter[]> {
  const rows = await fetchVoterPicks(db, qid, myUid, city);
  await resolveNames(db, rows.map((r) => r.uid), names, scores, undefined, logic);
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
  faces?: Record<string, string>,
  logic?: Record<string, number | null>,
): Promise<void> {
  // TWO MISSING SETS, not one union, and the difference is a read per
  // person on five surfaces.
  //
  // Names and scores PERSIST across sessions (`insight.profileCache.v1`,
  // D129); faces deliberately do not (D178 — a token cached past a remove
  // verdict is a removed face still rendering). One union therefore put
  // every uid whose name and score were already in hand back into the
  // v2_users query, purely because its face was not — which is every uid,
  // on every surface that asks for faces, on every open. D129's persisted
  // cache was doing nothing there.
  //
  // It does not touch the -41% that decision reports: that is earned on the
  // `fetchVoters` path, which passes no `faces`, and where the union and
  // the split are the same set.
  // The logic percentile (D227) is a third rider on the same document —
  // parsed here for the same D112 reason scores are: the profile was on
  // the wire regardless. Its own missing-check because a cache written
  // before D227 holds names and scores but no logic entries, and skipping
  // the read for those uids would show a whole sheet as "untested"; one
  // refetch round fills them and the cache self-heals.
  const needProfile = uids.filter((u) => !(u in names)
    || (scores ? !(u in scores) : false)
    || (logic ? !(u in logic) : false));
  const needFace = faces ? uids.filter((u) => !(u in faces)) : [];
  if (!needProfile.length && !needFace.length) return;
  const {
    collection: fsCollection, documentId, getDocs, query, where,
  } = await getFirestoreApi();
  // Chunked separately and walked in step: the round-trip count is the
  // LONGER of the two lists, not their sum, so a surface wanting both still
  // pays what it paid before. Sequential over rounds rather than firing
  // every chunk at once — the same restraint loadKindred states, for the
  // same reason (a burst at a boot-adjacent moment is what gets a client
  // rate-limited).
  const profileChunks = chunkUids(needProfile);
  const faceChunks = chunkUids(needFace);
  const rounds = Math.max(profileChunks.length, faceChunks.length);
  for (let round = 0; round < rounds; round++) {
    const profileBatch = profileChunks[round];
    const faceBatch = faceChunks[round];
    // TWO QUERIES PER CHUNK SINCE D178, not one, and the second is the
    // price of the photo living in its own collection.
    //
    // It lives there because a remove verdict has to write somewhere, and
    // a field on `v2_users` would mean the moderator callable holds a
    // write on the document carrying display names, anchors and test
    // results. One extra batched query per THIRTY people is the smaller
    // cost — and it is batched by the same chunking, so it never becomes
    // a read per face.
    //
    // Parallel rather than sequential: they are independent, and a room
    // of two dozen is one round trip either way only if they overlap.
    const [snap, avSnap] = await Promise.all([
      profileBatch
        ? getDocs(query(fsCollection(db, "v2_users"), where(documentId(), "in", profileBatch)))
        : Promise.resolve(null),
      faces && faceBatch
        ? getDocs(query(fsCollection(db, "v2_avatars"), where(documentId(), "in", faceBatch)))
        : Promise.resolve(null),
    ]);
    if (snap) {
      for (const d of snap.docs) {
        const n = d.get("displayName");
        names[d.id] = typeof n === "string" ? n.trim().slice(0, 60) : "";
        if (scores) scores[d.id] = parseTestResults(d.get("testResults"), CORE_TEST_KINDS);
        if (logic) logic[d.id] = parseLogicPct(d.get("testResults"));
      }
    }
    if (faces && avSnap) {
      for (const d of avSnap.docs) {
        const token = d.get("token");
        // A HIDDEN FACE RESOLVES TO NOTHING, and this is where that is
        // enforced for every surface at once. The document stays readable
        // — the appeal path needs it, and rules cannot filter a field —
        // so the one place that turns a document into a picture is the
        // one place that has to check. Initials, exactly as if no photo
        // had ever been set.
        faces[d.id] = d.get("hidden") === true || typeof token !== "string" ? "" : token;
      }
    }
    // Anything the query did not return does not exist — cache the
    // absence so the next open does not re-ask for it. Per SET now, since
    // the two batches no longer hold the same uids: marking a face absent
    // because the PROFILE query covered that uid would cache "no photo" for
    // someone nobody asked about yet.
    for (const u of profileBatch || []) {
      if (!(u in names)) names[u] = "";
      if (scores && !(u in scores)) scores[u] = null;
      if (logic && !(u in logic)) logic[u] = null;
    }
    if (faces) {
      for (const u of faceBatch || []) {
        if (!(u in faces)) faces[u] = "";
      }
    }
  }
}
