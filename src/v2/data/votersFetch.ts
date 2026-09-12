// The cross-user READS (D98) — split out of data/voters.ts at D482.
//
// WHY IT IS ITS OWN MODULE. data/voters.ts is in the first-paint graph:
// live.ts and circle.ts both import it statically, and neither can stop
// (live.ts needs groupByOption/sortVoters from a SYNCHRONOUS getter,
// circle.ts needs chunkUids). So every byte in that file is a byte the
// app parses before it can paint — and all of THIS file's callers run
// long after: the who-voted sheet, the breakdown panels, kindred, the
// patterns pair card. live.ts reaches them through `await import()` at
// each call site, which is why check-bundle's MAX_EAGER_KB could come
// down with this change rather than up.
//
// The seam is the one voters.ts already drew between "pure helpers
// (unit-tested without Firebase)" and "the reads". Nothing here is
// re-implemented; the functions moved unchanged.
//
// The API arrives through lib/firebase's memoised dynamic import, not a
// static one (D110). The type import is erased and costs nothing.
import { getFirestoreApi } from "../../lib/firebase";
import type { Firestore } from "firebase/firestore";
// Pure arithmetic, no Firebase anywhere in it.
import { CORE_TEST_KINDS, parseLogicPct, parseTestResults, type ParsedResults } from "./similarity";
// The pure half this file was split from. Importing an EAGER module from a
// lazy one costs the eager graph nothing — the bytes are already there.
import {
  chunkUids, uidFromAnswerPath, VOTER_FETCH_CAP, VOTER_TAIL_CAP,
  citySampleId, worldSampleId, WORLD_ANSWER_SURFACES,
  type ProfileCaches, type Voter,
} from "./voters";


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
  // The live tail (runbook 2.4): only answers at or after `sinceMs`, at
  // most `cap` of them — the same query narrowed by a range on the field
  // it already orders by, so it is served by the same composite index.
  tail?: { sinceMs: number; cap: number },
): Promise<Voter[]> {
  const { collectionGroup, getDocs, limit: fsLimit, orderBy, query, where, Timestamp } = await getFirestoreApi();
  const snap = await getDocs(query(
    collectionGroup(db, "answers"),
    where("qid", "==", qid),
    where("surface", "in", [...WORLD_ANSWER_SURFACES]),
    // The surface clause above is not optional and this one does not
    // replace it: firestore.rules grants this read as a VALUE test on
    // `surface`, so a query missing that `where` is refused wholesale
    // (D65). An EXTRA equality only narrows what the rule already allows,
    // which rules.test.ts pins rather than assumes — and so does the
    // tail's range, pinned beside it.
    ...(city ? [where("anchors.city", "==", city)] : []),
    ...(tail ? [where("answeredAt", ">=", Timestamp.fromMillis(tail.sinceMs))] : []),
    orderBy("answeredAt", "desc"),
    fsLimit(tail ? tail.cap : VOTER_FETCH_CAP),
  ));

  const rows: Voter[] = [];
  for (const d of snap.docs) {
    const uid = uidFromAnswerPath(d.ref.path);
    if (!uid) continue;
    // A catalog answer carries `entity`, not `optionIdx`, and has no
    // option column to sit in — so it rides as the KEY with an
    // out-of-range index, never coerced into a column it does not have.
    // It used to be dropped here outright, which left the catalogue the
    // only surface in the app with no answer to "who picked what".
    //
    // One row shape and one push, and that is a first-paint decision
    // rather than a style one: this module is imported statically by
    // data/live.ts, so its bytes are paint bytes and check:bundle's eager
    // ceiling is measured against the wall.
    const optionIdx = d.get("optionIdx");
    const entity = d.get("entity");
    if (typeof optionIdx !== "number" && typeof entity !== "number") continue;
    const anchors = (d.get("anchors") || {}) as Record<string, string>;
    rows.push({
      uid,
      optionIdx: typeof optionIdx === "number" ? optionIdx : -1,
      entity: typeof entity === "number" ? entity : undefined,
      anchors,
      name: "",
      isMe: uid === myUid,
    });
  }
  return rows;
}

/**
 * The nightly voter SAMPLE for `qid` (D397) — the newest VOTER_FETCH_CAP
 * voters as the fit published them last night at `v2_patterns/sample-{qid}`:
 * one document read where `fetchVoterPicks` is up to two hundred. Same
 * rows in the same shape — uid, option index, the answer's frozen chips
 * (D8) — newest first, so every fold that only COUNTS (Kindred, the People
 * lens, the pair card) reads it in place of the live query. The who-voted
 * sheet, a live list of names on screen that must show the viewer's own
 * answer the moment it lands, keeps the live query.
 *
 * Null when no sample exists yet — a question the nightly run has not
 * touched since D397, or the tail — so the caller falls back to the live
 * query rather than reading absence as an empty crowd.
 *
 * AND NULL FOR AN EXISTING DOCUMENT WITH NO USABLE ROWS, which is the
 * same fact and used not to be the same answer. `[] ?? live` is `[]`, so
 * both callers took the empty array and reported a crowd of nobody:
 * `sayRows` (data/patterns.ts) cached it, and `loadVoterSample`
 * (live.ts) took the else branch, resolved no names and never set its
 * fallback flag. Reachable, not theoretical — `deleteAccount`'s scrub
 * (index.ts § 1a') field-deletes one uid's row and leaves the document
 * standing, so a sample whose only voter erases their account becomes
 * `rows: {}` on disk.
 *
 * WHAT THIS READER CANNOT TELL, and why the server had to (D442): a
 * sample only the ledger has fed holds the people who answered since
 * D397 and nobody before — real rows, indistinguishable here from a
 * complete list, so the floors downstream (`say()` and `tell()` want 12)
 * would report `thin` about the crowd when the true subject was the
 * deploy date. Since D442 the nightly seeds each sample once, the first
 * night it meets the question, from this module's own query
 * (`fetchVoterPicks`'s filter, order and cap — the server's copy of
 * WORLD_ANSWER_SURFACES is pinned equal to the one above), bounded at
 * 25 questions a night, and never creates a sample short: with no
 * document this reader returns null and the caller takes the live
 * query, which is complete.
 */
export async function fetchVoterSample(
  db: Firestore,
  qid: string,
  myUid: string | null = null,
  caches?: ProfileCaches,
  city?: string,
): Promise<Voter[] | null> {
  return (await fetchSampleDoc(db, qid, myUid, caches, city))?.rows ?? null;
}

/** What a sample read returns to a caller that also wants to know how far
 * it reaches: the newest ledger day among its rows, which is where the
 * who-voted sheet's live tail starts (runbook 2.4). */
export interface SampleRead {
  rows: Voter[];
  /** The newest `d` among the rows — "" only for a document with no day
   *  on any row, which the server never writes. */
  newestDay: string;
}

/** The core-kinds scores off a sample row, re-read defensively even
 * though the server wrote them: the shape is `parseTestResults`'s output
 * and this keeps it so whatever a document holds. */
function sampleScores(raw: unknown): ParsedResults | null {
  if (!raw || typeof raw !== "object") return null;
  const out: ParsedResults = {};
  for (const kind of CORE_TEST_KINDS) {
    const axes = (raw as Record<string, unknown>)[kind];
    if (!axes || typeof axes !== "object") continue;
    const clean: Record<string, number> = {};
    for (const [id, v] of Object.entries(axes as Record<string, unknown>).slice(0, 12)) {
      const n = Number(v);
      if (id && Number.isFinite(n)) clean[id] = Math.max(0, Math.min(100, Math.round(n)));
    }
    if (Object.keys(clean).length) out[kind] = clean;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The nightly sample as a document — the world sample, or a city's
 * (runbook 2.5) when `city` is given — with the rows' stamps folded into
 * the caller's caches (runbook 2.3): a row that carries `n` fills the
 * name, scores and logic percentile for its person WHERE THE CACHE HAS
 * NOTHING, so a value this session already read live keeps precedence and
 * `resolveNames` afterwards reads only the people no row could name. A
 * row without `n` was written before the stamp existed and fills nothing.
 *
 * Null when no document exists, and null for a document with no usable
 * rows — see `fetchVoterSample`'s docstring for why the two are one.
 */
export async function fetchSampleDoc(
  db: Firestore,
  qid: string,
  myUid: string | null = null,
  caches?: ProfileCaches,
  city?: string,
): Promise<SampleRead | null> {
  const { doc, getDoc } = await getFirestoreApi();
  const snap = await getDoc(doc(db, "v2_patterns", city ? citySampleId(qid, city) : worldSampleId(qid)));
  if (!snap.exists()) return null;
  const rows = (snap.get("rows") as Record<string, {
    o?: unknown; a?: unknown; d?: unknown; n?: unknown; s?: unknown; l?: unknown;
  }> | undefined) ?? {};
  const out: { v: Voter; d: string }[] = [];
  let newestDay = "";
  for (const [uid, r] of Object.entries(rows)) {
    if (!uid || typeof r?.o !== "number") continue;
    const d = typeof r.d === "string" ? r.d : "";
    if (d > newestDay) newestDay = d;
    if (caches && typeof r.n === "string") {
      if (!(uid in caches.names)) caches.names[uid] = r.n.trim().slice(0, 60);
      if (caches.scores && !(uid in caches.scores)) caches.scores[uid] = sampleScores(r.s);
      if (caches.logic && !(uid in caches.logic)) {
        caches.logic[uid] = typeof r.l === "number" && Number.isFinite(r.l) ? Math.max(0, Math.min(100, Math.round(r.l))) : null;
      }
    }
    out.push({
      v: {
        uid,
        optionIdx: r.o,
        anchors: (r.a && typeof r.a === "object" ? r.a : {}) as Record<string, string>,
        name: caches?.names[uid] ?? "",
        isMe: uid === myUid,
      },
      d,
    });
  }
  // newest first, then uid — the server's own total order
  out.sort((a, b) => (a.d !== b.d ? (a.d < b.d ? 1 : -1) : a.v.uid < b.v.uid ? -1 : a.v.uid > b.v.uid ? 1 : 0));
  // Empty reads as absent, per the docstring's own promise. Both callers
  // key their fallback on null, and neither has any other way to tell a
  // sample that holds nobody from one that was never written.
  return out.length ? { rows: out.map((x) => x.v), newestDay } : null;
}

/**
 * The answers newer than a sample reaches (runbook 2.4): everything
 * ledgered after `newestDay` — the day after it, from midnight UTC, since
 * a sample merged through a day holds that whole day — newest first, at
 * most VOTER_TAIL_CAP. An answer written in the last second of a day and
 * ledgered in the first of the next sits in neither until the next merge;
 * that window is the trigger's latency, and it is seconds.
 */
export async function fetchVoterTail(
  db: Firestore,
  qid: string,
  myUid: string | null,
  newestDay: string,
): Promise<Voter[]> {
  const sinceMs = newestDay ? Date.parse(`${newestDay}T00:00:00Z`) + 86_400_000 : 0;
  return fetchVoterPicks(db, qid, myUid, undefined, { sinceMs: Number.isFinite(sinceMs) ? sinceMs : 0, cap: VOTER_TAIL_CAP });
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
