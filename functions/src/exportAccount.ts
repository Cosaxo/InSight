// exportAccount.ts — the read-only twin of deleteAccount (D443).
//
// WHY THIS EXISTS. `web/terms.html` has promised since it was written that
// before a termination we would "give you a chance to download your data
// first", and until 2026-09-09 there was no download anywhere in the tree —
// the one moment the sentence is about was the one moment it could not be
// honoured. The owner chose to build the export rather than soften the
// sentence (OWNER-LIST, 2026-09-09), and this is the smallest honest shape:
// the erasure callable already walks the whole graph of documents that are
// about one account, phase by phase, so the export walks EXACTLY that graph
// and reads instead of deleting. It also answers GDPR Art. 20 (portability),
// which the app had no answer to before.
//
// THE CONTRACT WITH deleteAccount, and the test that holds it. Every wipe
// phase in `index.ts` pushes a label onto `failed` when it throws; `TWIN`
// below names the export section that answers each label, and
// `exportAccount.test.ts` reads `index.ts` and refuses a label with no twin.
// So a new erasure phase without an export section is a red test rather
// than a silent gap — the failure this file is most likely to grow, since
// the two walks are written in different files by different hands.
//
// FOUR THINGS ARE NOT IN THE FILE, and each is one of the things the rules
// keep closed for a non-privacy reason — the set CLAUDE.md keeps outside the
// D334 ask, plus the credential:
//   · the logic attempt's `seed` (the unscored answer key, anti-cheat): the
//     items are generated from it by code that is public, so an export that
//     carried it would be a way to start an attempt, read the key and submit;
//   · who reported you (flag authorship, anti-retaliation): flags cast ON
//     this account are counted, never listed;
//   · the presence CELL (physical safety): refused to every reader, the
//     owner included, and this file is built to travel — the export says a
//     square is held and until when, and never which;
//   · the push token (a credential, `allow read: if false` even to the
//     owner): the subcollection is skipped and named in `omitted`.
// Other people's records that merely point at this account — their follows
// of it, their v1 relations to it — are counted rather than copied: a
// follower's follow is the follower's record, and a file that leaves the app
// should not carry other people's uids beside things they did not write to
// this account. Everything this account WROTE is in full.
//
// THE BYTE BOUND. A callable answers in one HTTPS response, and the smallest
// ceiling any generation of that transport has documented is 10 MB (the
// first-generation request/response limit; Cloud Run's is larger). 8 MiB
// leaves room for the `{ result: … }` envelope the SDK wraps a payload in
// and for the phone that has to hold the whole string in memory to write a
// file or a share sheet from it. Measured section by section while the walk
// runs, so an account past the bound stops reading rather than building a
// response it will then refuse — and the refusal names the bound and the way
// round it (ask by email, the deletion page's own route) instead of failing
// as `internal` with nothing in it to read.
//
// Admin SDK, so rules are bypassed; the caller is the owner by construction
// (`request.auth.uid` is the only uid ever walked) and App Check is demanded
// like every other user-facing callable (`check:appcheck`).

import { FieldPath, Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";
import type { Query, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { ENFORCE_APP_CHECK, FUNCTIONS_REGION, LIGHT_UNBOUNDED } from "./ops";
import { db as firestore } from "./db";
import { isStamped, playedIn } from "./pure";
import { citySampleId, WORLD_SAMPLE_PAGE } from "./patternsSamples";
import { fanoutBudgetId } from "./profileFanout";
import { logWriter, type LogRow } from "./log";

/** The format tag on every export, bumped when the shape changes. */
export const EXPORT_FORMAT = "insight-export/1";

/** The bound, and the reasoning is in the header. */
export const EXPORT_MAX_BYTES = 8 * 1024 * 1024;

/** How the refusal reads on the device — plain, with the number in it. */
export const EXPORT_TOO_LARGE =
  `Your data is over ${EXPORT_MAX_BYTES / (1024 * 1024)} MB, more than one download can carry. `
  + "Ask for it by email instead — the address is on the deletion page.";

/** One page of a subtree walk. 400, deleteQueryDocs' page, for the same headroom. */
const PAGE = 400;

/**
 * deleteAccount's wipe phases, by the label each pushes onto `failed`, and
 * the export section that reads what that phase erases. The test holds
 * this against `index.ts`, so the only way to add a phase there is to say
 * here what the export does about it — a name, or a stated reason it has
 * nothing to read.
 */
export const TWIN: Record<string, string> = {
  ownSubtree: "legacy",
  aggEvents: "answerLedger",
  patternSamples: "voterSamples",
  // 1a‴ — the world map's published positions (D462). Its own label since
  // 2026-09-12: folded under `patternSamples`, it was a document family
  // with an erasure arm, no export section, and nothing able to notice.
  worldMapPositions: "worldMap",
  v2Subtree: "profile",
  logicAttempt: "logicAttempt",
  takesFlags: "takes",
  avatarObject: "photo",
  v2Groups: "groups",
  v2Reveals: "reveals",
  discoverable: "discoverable",
  othersInbound: "impressionsSent",
  othersFollows: "followers",
  handle: "handle",
  pendingJoins: "pendingJoins",
  peopleRow: "directory",
  invitesTo: "invitesReceived",
  invitesFrom: "invitesSent",
  othersRelations: "relationsToYou",
  ratelimits: "rateLimits",
  suggestions: "suggestions",
  purchases: "purchases",
  paidBookings: "paidBookings",
  // 1a″ — the answer log in BigQuery (D447 phase A), the ledger's mirror
  // that outlives the ledger's TTL; read through the erasure's own writer.
  log: "answerLog",
  // The closing sweep re-deletes the subtree phase 1b already took, in
  // case a nightly fold committed inside the erasure's own run time. It
  // reads nothing the `profile` section did not, so it twins the same one.
  v2SubtreeSweep: "profile",
};

/**
 * THE RATE-LIMIT LEDGERS THIS ACCOUNT OWNS, `[section key, document path]` —
 * read by the export below AND by the erasure in `index.ts`, which is the
 * point of it being here rather than written twice.
 *
 * It was written twice, and drifted: the erasure took six documents and the
 * export disclosed five. The profile fan-out's hourly budget
 * (`profileFanout.ts`) was deleted on erasure and named nowhere in the
 * bundle, so the export said "everything" and handed over less — the exact
 * failure this file's header describes, one level below where `TWIN` can
 * see it. `TWIN` maps a wipe PHASE to a bundle section, and both halves of
 * this pair were present; the gap was inside the phase.
 *
 * Rules make every one of these opaque to clients, but they carry recipient
 * uids and activity timestamps, so erasure covers them (index.ts §4b) and
 * so does the right of access.
 */
export const rateLimitLedgers = (uid: string): [string, string][] => [
  ["insight", `insight_ratelimits/${uid}`],
  ["join", `v2_ratelimits/join_${uid}`],
  // D122's invitation budget, keyed the same way. Added with the callable
  // rather than after someone noticed the ledger surviving an erasure.
  ["invite", `v2_ratelimits/invite_${uid}`],
  // The suggestion budget (suggestions.ts), same pattern and same reasoning:
  // added with the callable, not after an audit.
  ["suggest", `v2_ratelimits/suggest_${uid}`],
  // The paid-booking budget (paid.ts, D313), same pattern again.
  ["paidbook", `v2_ratelimits/paidbook_${uid}`],
  // The profile fan-out's hourly budget and its heal marker
  // (profileFanout.ts). Its id comes from the module that writes it, so
  // the two spellings cannot part company.
  ["fanout", `v2_ratelimits/${fanoutBudgetId(uid)}`],
];

type Plain = null | boolean | number | string | Plain[] | { [k: string]: Plain };

/**
 * A Firestore value as JSON a person can read: timestamps as ISO strings,
 * references as paths, geopoints as two numbers, bytes as base64. The SDK
 * would otherwise serialise a Timestamp as `{_seconds, _nanoseconds}`,
 * which is true and useless to the reader the file is for.
 */
export function toPlain(v: unknown): Plain {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (v instanceof DocumentReference) return v.path;
  if (v instanceof GeoPoint) return { latitude: v.latitude, longitude: v.longitude };
  if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
  if (Array.isArray(v)) return v.map(toPlain);
  if (typeof v === "object") {
    // A Timestamp-shaped object that is not the class — a fake, or a value
    // that crossed a module boundary — still reads as a date.
    const o = v as Record<string, unknown>;
    if (typeof o.toDate === "function") {
      const d = (o.toDate as () => unknown)();
      if (d instanceof Date) return d.toISOString();
    }
    const out: { [k: string]: Plain } = {};
    for (const [k, val] of Object.entries(o)) {
      if (typeof val === "function") continue;
      out[k] = toPlain(val);
    }
    return out;
  }
  return null;
}

/** A document as one export row: its id, then its fields. */
function row(snap: DocumentSnapshot): { [k: string]: Plain } {
  return { id: snap.id, ...(toPlain(snap.data() ?? {}) as { [k: string]: Plain }) };
}

/** Every document of a query, paged by id so a large subcollection is never one read. */
async function walk(q: Query): Promise<QueryDocumentSnapshot[]> {
  const out: QueryDocumentSnapshot[] = [];
  let cursor: QueryDocumentSnapshot | null = null;
  for (;;) {
    let page = q.orderBy(FieldPath.documentId()).limit(PAGE);
    if (cursor) page = page.startAfter(cursor);
    const snap = await page.get();
    out.push(...snap.docs);
    if (snap.size < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return out;
}

/**
 * The running total, checked after every section. `add` returns the value
 * so a section reads as one expression, and throws the plain refusal the
 * moment the bound is crossed — before the next section is read.
 */
class Meter {
  bytes = 0;
  add<T>(value: T): T {
    this.bytes += Buffer.byteLength(JSON.stringify(value) ?? "null");
    if (this.bytes > EXPORT_MAX_BYTES) {
      throw new HttpsError("resource-exhausted", EXPORT_TOO_LARGE);
    }
    return value;
  }
}

/** The whole subtree under one document: its fields, and every subcollection's rows. */
async function subtree(
  ref: FirebaseFirestore.DocumentReference,
  skip: Set<string>,
): Promise<{ doc: Plain; collections: { [k: string]: { [k: string]: Plain }[] } }> {
  const snap = await ref.get();
  const collections: { [k: string]: { [k: string]: Plain }[] } = {};
  for (const sub of await ref.listCollections()) {
    if (skip.has(sub.id)) continue;
    collections[sub.id] = (await walk(sub)).map(row);
  }
  return { doc: snap.exists ? toPlain(snap.data()) : null, collections };
}

/**
 * The uids, inside a reveal's `votes`, whose pick named this account —
 * the field pickUidScrub in index.ts deletes. Counted, not listed: the
 * voters are other members, and the count is the fact about this account.
 */
function pickedCount(votes: unknown, uid: string): number {
  if (!votes || typeof votes !== "object") return 0;
  let n = 0;
  for (const [voter, v] of Object.entries(votes as Record<string, unknown>)) {
    if (voter === uid) continue;
    if (v && typeof v === "object" && (v as { pickUid?: unknown }).pickUid === uid) n += 1;
  }
  return n;
}

/** What one reveal says about this account, or null when it names them nowhere. */
function revealRow(r: DocumentSnapshot, uid: string): { [k: string]: Plain } | null {
  const votes = r.get("votes") as Record<string, unknown> | undefined;
  const names = r.get("names") as Record<string, unknown> | undefined;
  const members = r.get("members");
  const vote = votes?.[uid];
  const name = names?.[uid];
  const listed = Array.isArray(members) && members.includes(uid);
  const picked = pickedCount(votes, uid);
  if (vote === undefined && name === undefined && !listed && !picked) return null;
  return {
    gid: r.ref.parent.parent?.id ?? null,
    id: r.id,
    day: toPlain(r.get("day") ?? r.id),
    qid: toPlain(r.get("qid")),
    vote: toPlain(vote),
    name: toPlain(name),
    picked,
  };
}

/**
 * Everything the app holds about one account, in deleteAccount's order.
 * Exported for the unit test, which runs it against a fake database; the
 * callable below is the thin wrapper that checks who is asking.
 */
export async function buildExport(uid: string): Promise<{ [k: string]: Plain }> {
  const db = firestore();
  const m = new Meter();
  const omitted: { what: string; why: string }[] = [];
  const out: { [k: string]: Plain } = {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    uid,
  };

  // The sign-in itself — deleteAccount's last phase, and the one record
  // that carries an address. First here because it is the smallest, and
  // because an export that failed to name whose it is would be a puzzle.
  {
    const u = await getAuth().getUser(uid);
    out.account = m.add({
      uid: u.uid,
      email: u.email ?? null,
      emailVerified: !!u.emailVerified,
      displayName: u.displayName ?? null,
      providers: u.providerData.map((p) => ({
        providerId: p.providerId,
        email: p.email ?? null,
        displayName: p.displayName ?? null,
      })),
      createdAt: u.metadata.creationTime ?? null,
      lastSignInAt: u.metadata.lastSignInTime ?? null,
    });
  }

  // 1. The journal-era subtree (insight_users/{uid}/*). Empty for any
  //    account made since D4; erasure still reaches it, so this does too.
  {
    const legacy = await subtree(db.collection("insight_users").doc(uid), new Set());
    const any = legacy.doc !== null || Object.values(legacy.collections).some((c) => c.length);
    out.legacy = m.add(any ? { profile: legacy.doc, collections: legacy.collections } : null);
  }

  // 1a. The agg-events ledger: "this account answered this question at this
  //     time", the attribution D28 keeps for 90 days. Duplicates facts the
  //     answers already hold, and is erased with them — so it is read too.
  out.answerLedger = m.add(
    (await walk(db.collection("v2_agg_events").where("uid", "==", uid))).map(row),
  );

  // 1a′. The voter samples (D397): this account's row in each, keyed by
  //      the question. Every sample is checked, the way the scrub checks
  //      every sample, because the answer map and the samples are written
  //      by different commits of the same nightly run.
  //
  //      BY ID RANGE, never `listDocuments`, for the reason the erasure's
  //      own arm spells out and this one was written without: the per-city
  //      samples share this collection as `city-{qid}~{city}`, one per
  //      (question, city) pair the nightly has seen — the product of two
  //      catalogues, ~10,900 places wide, growing by up to
  //      CITY_SAMPLE_PAIRS_PER_NIGHT a night. A listing walks all of them
  //      to reach the few hundred world samples, which is exactly the
  //      shape DATA-EFFICIENCY-RUNBOOK §2.5 says the `city-` prefix exists
  //      to keep this callable away from. `sample-` ≤ id < `sample.` is
  //      the world family exactly ('.' follows '-' in ASCII).
  {
    //      AND PAGED (WORLD_SAMPLE_PAGE), which the id range alone did not
    //      make it: the range keeps this callable away from the ~10,900
    //      city documents, but the world family itself was still read
    //      entire — 233 MiB retained at the 2026-09-11 corpus, in the 256
    //      MiB this function runs on, and growing with the corpus. What
    //      is kept is one row per document, so a page can go as soon as
    //      it has been read.
    let world = db.collection("v2_patterns")
      .where(FieldPath.documentId(), ">=", "sample-")
      .where(FieldPath.documentId(), "<", "sample.")
      .orderBy(FieldPath.documentId())
      .limit(WORLD_SAMPLE_PAGE);
    const rows: { [k: string]: Plain } = {};
    for (;;) {
      const page = await world.get();
      if (page.empty) break;
      for (const snap of page.docs) {
        if (!snap.exists) continue;
        const all = (snap.get("rows") as Record<string, unknown> | undefined) ?? {};
        if (uid in all) rows[snap.id.slice("sample-".length)] = toPlain(all[uid]);
      }
      if (page.size < WORLD_SAMPLE_PAGE) break;
      world = world.startAfter(page.docs[page.size - 1]);
    }
    out.voterSamples = m.add(rows);
  }

  // 1a‴. The world map's published positions (D462): one row per
  //      population this account was placed in — the world's document and
  //      its country's — each holding two coordinates and the answer count
  //      that earned them. WORLD-READABLE, under a display name, which is
  //      why the omission mattered: this is the most public thing the app
  //      computes about a person and the file that promises "everything
  //      the account holds" did not carry it.
  //
  //      Same ID range as the erasure's own arm, and for the same reason
  //      it gives: a person whose country chip has moved still has a row
  //      under the old one until the next rebuild, so the current chip is
  //      not a safe key to read by.
  {
    const world = await db.collection("v2_patterns")
      .where(FieldPath.documentId(), ">=", "people-")
      .where(FieldPath.documentId(), "<", "people.")
      .get();
    const rows: { [k: string]: Plain } = {};
    for (const snap of world.docs) {
      if (!snap.exists) continue;
      const all = (snap.get("rows") as Record<string, unknown> | undefined) ?? {};
      if (uid in all) rows[snap.id.slice("people-".length)] = toPlain(all[uid]);
    }
    out.worldMap = m.add(rows);
  }

  // 1a″. The answer log (D447 phase A): the ledger's mirror in BigQuery —
  //      one row per counted answer and one per edit, the rows the
  //      erasure's statement removes — read through the erasure's own
  //      writer, so an export and an erasure agree on where the rows are.
  //      Null where there is no BigQuery (the emulator, the suites) or the
  //      table is not there yet (the owner's click), and said so in
  //      `omitted`: the answers and the ledger sections hold the same
  //      facts, and an export must not fail on its mirror.
  {
    let rows: LogRow[] | null = null;
    let why: string | null = null;
    try {
      rows = await logWriter().rowsFor(uid);
      if (rows === null) why = "no BigQuery here — the answer log is off, or its table is not created yet; the collections.answers and answerLedger sections hold the same facts";
    } catch (err) {
      why = `the answer log could not be read (${err instanceof Error ? err.message : String(err)}); the collections.answers and answerLedger sections hold the same facts`;
    }
    out.answerLog = m.add(rows === null ? null : rows.map((r) => ({ ...r })));
    if (why) omitted.push({ what: "answerLog", why });
  }

  // 1b. The v2 subtree: the profile, and every subcollection under it —
  //     answers, the fit's state, the interest profile, the engagement
  //     rollups, foresight, follows, calls, whatever the tree grows next.
  //     Read by listing rather than by a name list, for the reason the
  //     erasure uses recursiveDelete: a new subcollection is covered on
  //     the day it ships. One is skipped, and named below.
  {
    const skip = new Set(["push"]);
    const own = await subtree(db.collection("v2_users").doc(uid), skip);
    out.profile = m.add(own.doc);
    out.collections = m.add(own.collections);
    // 1a′, the per-city half (DATA-EFFICIENCY-RUNBOOK 2.5): the
    // `city-{qid}~{city}` family is reached through the account's own
    // answers — the frozen city on each — exactly as the erasure reaches
    // it (index.ts, 1a′), because listing the family at scale is the
    // product of two catalogues. The answers were just read above.
    {
      const answers = own.collections.answers ?? [];
      const ids = [...new Set(answers.flatMap((a) => {
        const qid = typeof a.qid === "string" ? a.qid : "";
        const anchors = a.anchors && typeof a.anchors === "object" && !Array.isArray(a.anchors) ? (a.anchors as { [k: string]: Plain }) : null;
        const city = anchors && typeof anchors.city === "string" ? anchors.city : "";
        return qid && city ? [citySampleId(qid, city)] : [];
      }))];
      const cityRows: { [k: string]: Plain } = {};
      for (let i = 0; i < ids.length; i += 300) {
        for (const snap of await db.getAll(...ids.slice(i, i + 300).map((id) => db.collection("v2_patterns").doc(id)))) {
          if (!snap.exists) continue;
          const all = (snap.get("rows") as Record<string, unknown> | undefined) ?? {};
          if (uid in all) cityRows[snap.id.slice("city-".length)] = toPlain(all[uid]);
        }
      }
      out.voterSamplesByCity = m.add(cityRows);
    }
    omitted.push({
      what: "collections.push",
      why: "the notification token is a credential for this phone, not data about you; "
        + "firestore.rules lets nobody read it, the owner included",
    });
  }

  // 1b1. The verified-logic attempt (D57), minus the seed.
  {
    const snap = await db.collection("v2_logic_attempts").doc(uid).get();
    if (snap.exists) {
      const data = { ...(snap.data() ?? {}) } as Record<string, unknown>;
      delete data.seed;
      out.logicAttempt = m.add(toPlain(data));
      omitted.push({
        what: "logicAttempt.seed",
        why: "the seed is the answer key of the verified logic test; the items are "
          + "generated from it, so a copy would be a way to read the answers",
      });
    } else {
      out.logicAttempt = null;
    }
  }

  // 1b2. Takes and flags, the face's document and the presence cell —
  //      the four the erasure takes in one phase.
  {
    const takes = await walk(db.collection("v2_takes").where("authorUid", "==", uid));
    out.takes = m.add(takes.map(row));
    // Flags this account cast are its own record. Flags cast ON it — on a
    // take of its, or on its face — are counted: the reporter's uid is the
    // one thing the flag collection refuses to show anyone (anti-retaliation).
    const cast = (await walk(db.collection("v2_flags").where("uid", "==", uid))).map(row);
    let onTakes = 0;
    const ids = takes.map((t) => t.id);
    for (let i = 0; i < ids.length; i += 10) {
      const page = await db.collection("v2_flags")
        .where("takeId", "in", ids.slice(i, i + 10)).get();
      onTakes += page.docs.filter((f) => f.get("uid") !== uid).length;
    }
    const onPhoto = (await db.collection("v2_flags").where("target", "==", uid).get()).size;
    out.flags = m.add({ cast, receivedOnTakes: onTakes, receivedOnPhoto: onPhoto });
    omitted.push({
      what: "flags.received*",
      why: "reports on your takes and your photo are counted, never listed — who "
        + "reported you is withheld from everyone, so nobody can be reported back",
    });
    const face = await db.collection("v2_avatars").doc(uid).get();
    out.avatar = m.add(face.exists ? toPlain(face.data()) : null);
    // The presence square (D84) is the one datum the rules refuse to every
    // client, the owner included, and this file is built to travel — a
    // share sheet, a mailbox, a clipboard — so the CELL stays out of it.
    // What the file says is that a square is held, and since and until
    // when: the erasure's phase is twinned, the location is not copied.
    // Its room caches are rosters of other people and are not read.
    const pres = await db.collection("v2_presence").doc(uid).get();
    out.presence = m.add(pres.exists
      ? { held: true, at: toPlain(pres.get("at")), until: toPlain(pres.get("until")) }
      : null);
    omitted.push({
      what: "presence.cell",
      why: "the square your phone last stood in is refused to every reader, you included, "
        + "and a file that leaves the app is not the place for a location; the export says "
        + "that a square is held and until when",
    });
  }

  // The photo's bytes (D178) — the one thing the erasure removes from
  // Storage, so the one thing this reads from it. Base64, because the file
  // is JSON; the uploader shrinks a face to AVATAR_PX before it lands, so
  // this is tens of kilobytes and not a megabyte.
  {
    const file = getStorage().bucket().file(`avatars/${uid}`);
    const [exists] = await file.exists();
    if (exists) {
      const [bytes] = await file.download();
      const [meta] = await file.getMetadata();
      out.photo = m.add({
        contentType: (meta as { contentType?: string }).contentType ?? null,
        bytes: bytes.length,
        base64: bytes.toString("base64"),
      });
    } else {
      out.photo = null;
    }
  }

  // 1c. The circles this account is in: what the group document says about
  //     THIS member — the erasure's arrayRemove and field deletes, read.
  //     The other members are a count.
  const memberGids = new Set<string>();
  const revealRows = new Map<string, { [k: string]: Plain }>();
  {
    const groups = await db.collection("v2_groups")
      .where("memberUids", "array-contains", uid).get();
    const rows: { [k: string]: Plain }[] = [];
    for (const g of groups.docs) {
      memberGids.add(g.id);
      const played = g.get("played");
      const pushAt = g.get("pushAt") as Record<string, unknown> | undefined;
      const members = (g.get("memberUids") as string[] | undefined) ?? [];
      rows.push({
        gid: g.id,
        name: toPlain(g.get("name")),
        mode: toPlain(g.get("mode")),
        owner: g.get("ownerUid") === uid,
        joinedAt: toPlain((g.get("memberJoinedAt") as Record<string, unknown> | undefined)?.[uid]),
        memberName: toPlain((g.get("memberNames") as Record<string, unknown> | undefined)?.[uid]),
        // The role ledger's row for THIS member (D445) — what the room has
        // made them, kept by the reveal pipeline and dropped by the same
        // phase-1c update that drops the name. The other members' rows
        // stay on the document and out of this file.
        ledger: toPlain((g.get("ledger") as Record<string, unknown> | undefined)?.[uid]),
        members: members.length,
        // The rounds this account has sealed and not yet seen revealed
        // (`played`, ROUNDS-PLAN §2.1), and the turn stamp if one stands.
        sealedRounds: played && typeof played === "object"
          ? Object.keys(played as Record<string, unknown>).filter((k) => playedIn(played, k).includes(uid))
          : [],
        turnStamp: isStamped(pushAt, uid) ? toPlain(pushAt?.[uid]) : null,
      });
      // …and every reveal of this circle that carries this account's vote
      // or name — the walk 1c makes, for the reveals a `members` query
      // cannot see (D5's legacy set).
      for (const r of await walk(g.ref.collection("reveals"))) {
        const rr = revealRow(r, uid);
        if (rr) revealRows.set(r.ref.path, rr);
      }
    }
    out.groups = m.add(rows);
    // …and the circles this account CREATED and later left — `ownerUid`
    // still names it there (D45), which is the field the erasure deletes.
    const owned = await db.collection("v2_groups").where("ownerUid", "==", uid).get();
    out.ownedGroups = m.add(
      owned.docs
        .filter((g) => !memberGids.has(g.id))
        .map((g) => ({ gid: g.id, name: toPlain(g.get("name")), mode: toPlain(g.get("mode")) })),
    );
  }

  // 1c-bis. The reveals of circles this account has LEFT, which still list
  //         it in `members` — and the ones that name it only through
  //         somebody else's pick (`pickedUids`). The two collection-group
  //         queries the erasure walks, read.
  {
    const listed = await db.collectionGroup("reveals").where("members", "array-contains", uid).get();
    for (const r of listed.docs) {
      if (revealRows.has(r.ref.path)) continue;
      const rr = revealRow(r, uid);
      if (rr) revealRows.set(r.ref.path, rr);
    }
    const picked = await db.collectionGroup("reveals").where("pickedUids", "array-contains", uid).get();
    for (const r of picked.docs) {
      if (revealRows.has(r.ref.path)) continue;
      const rr = revealRow(r, uid);
      if (rr) revealRows.set(r.ref.path, rr);
    }
    out.reveals = m.add([...revealRows.values()]);
  }

  // 2. The retired v1 discoverable document, if it still exists.
  {
    const snap = await db.collection("insight_discoverable").doc(uid).get();
    out.discoverable = m.add(snap.exists ? toPlain(snap.data()) : null);
  }

  // 3. Impressions this account SENT into other people's v1 subtrees —
  //    words it wrote about someone, so they are its record.
  out.impressionsSent = m.add(
    (await db.collectionGroup("insight_inbound_impressions").where("senderUid", "==", uid).get())
      .docs.map((d) => ({ to: d.ref.parent.parent?.id ?? null, ...row(d) })),
  );

  // 3b. Other people's follows of this account (D101): counted. The
  //     account's own follows are in `collections.following` above.
  out.followers = m.add((await db.collectionGroup("following").where("to", "==", uid).get()).size);
  omitted.push({
    what: "followers",
    why: "who follows you is counted, not named — a follow is the follower's record",
  });

  // 3b. The handle (D122): keyed by the name, found by the uid.
  {
    const handles = await db.collection("v2_handles").where("uid", "==", uid).get();
    out.handle = m.add(handles.empty ? null : handles.docs[0].id);
  }

  // 3c-bis. Circles this account asked to join and was never let into
  //         (D240) — by name, which is the leak the erasure closes.
  out.pendingJoins = m.add(
    (await db.collection("v2_groups").where("pending", "array-contains", uid).get())
      .docs.map((g) => ({
        gid: g.id,
        name: toPlain(g.get("name")),
        asName: toPlain((g.get("pendingNames") as Record<string, unknown> | undefined)?.[uid]),
      })),
  );

  // 3d. The people directory row (D239).
  {
    const snap = await db.doc(`v2_people/${uid}`).get();
    out.directory = m.add(snap.exists ? toPlain(snap.data()) : null);
  }

  // 3c. Invitations, both directions (D122): the inbox, and the ones this
  //     account sent under its own name into other people's circles.
  const invite = (d: DocumentSnapshot) => ({ gid: d.ref.parent.parent?.id ?? null, ...row(d) });
  out.invitesReceived = m.add(
    (await db.collectionGroup("invites").where("to", "==", uid).get()).docs.map(invite),
  );
  out.invitesSent = m.add(
    (await db.collectionGroup("invites").where("from", "==", uid).get()).docs.map(invite),
  );

  // 4. Other people's v1 relations naming this account: counted.
  out.relationsToYou = m.add(
    (await db.collectionGroup("relations").where("linkedUid", "==", uid).get()).size,
  );

  // 4b. The rate-limit ledgers — timestamps of this account's own acts.
  {
    const rateLimits: { [k: string]: Plain } = {};
    for (const [key, path] of rateLimitLedgers(uid)) {
      const snap = await db.doc(path).get();
      rateLimits[key] = snap.exists ? toPlain(snap.data()) : null;
    }
    out.rateLimits = m.add(rateLimits);
  }

  // 4d. Question suggestions (free text under the uid).
  out.suggestions = m.add(
    (await walk(db.collection("v2_suggestions").where("uid", "==", uid))).map(row),
  );

  // 4e. Purchases, the ads the rows point at, and the byline on each
  //     bought question — the three the erasure takes from one pointer.
  //     The question itself is content and survives, so only its `sponsor`
  //     block (the buyer's name and audience) is the account's.
  {
    const bought = await walk(db.collection("v2_purchases").where("uid", "==", uid));
    const ads: { [k: string]: Plain }[] = [];
    const sponsoredQuestions: { [k: string]: Plain }[] = [];
    for (const d of bought) {
      const adId = String(d.get("adId") ?? "");
      if (adId) {
        const ad = await db.collection("v2_ads").doc(adId).get();
        if (ad.exists) ads.push(row(ad));
      }
      const qid = String(d.get("qid") ?? "");
      if (qid) {
        const q = await db.collection("v2_questions").doc(qid).get();
        if (q.exists) sponsoredQuestions.push({ qid, sponsor: toPlain(q.get("sponsor")) });
      }
    }
    out.purchases = m.add({ rows: bought.map(row), ads, sponsoredQuestions });
  }

  // 4f. Paid-question bookings (paid.ts, D313).
  out.paidBookings = m.add(
    (await walk(db.collection("v2_paid_bookings").where("uid", "==", uid))).map(row),
  );

  out.omitted = m.add(omitted);
  out.bytes = m.bytes;
  return out;
}

export const exportAccountV2 = onCall(
  // Unbounded per-account reads, the way deleteAccount's writes are — the
  // long deadline is for the account with years of reveals, and 256 MiB is
  // plenty for an 8 MiB answer.
  { ...LIGHT_UNBOUNDED, region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "must be signed in");
    }
    const uid = request.auth.uid;
    logger.info(`[exportAccountV2] starting for uid=${uid}`);
    const bundle = await buildExport(uid);
    logger.info(`[exportAccountV2] done for uid=${uid}`, { bytes: bundle.bytes });
    return { ok: true, ...bundle };
  },
);
