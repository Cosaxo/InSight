// The Firestore reads behind handles, invitations and the people
// directory (D122, D239).
//
// WHY THEY ARE NOT IN ./handles AND ./invites, where they read more
// naturally: those two are imported by LiveDuelPanel and
// LivePrivacyPanel, which sat on the first-paint path when this split was
// made (both are off it now — a React.lazy since D156, the overlays chunk
// since D341 — but ./handles' own header has why the split outlives
// them). A `firebase/firestore` import reachable from an eager module
// puts the whole SDK on the first-paint path — check:bundle measured
// 1270 KB against a 955 KB ceiling, which is exactly the tree as it
// stood before D110.
//
// So the split is by WHAT MAY BE IMPORTED EAGERLY, not by subject: the
// validation and the wording are pure and live with their features, and
// the two reads live here, where only live.ts reaches them and only
// through a dynamic import inside an already-async method. Same shape
// data/circle.ts has, for the same measured reason.

import {
  collection, collectionGroup, doc, getDoc, getDocs, limit as fsLimit, orderBy, query, where,
  type Firestore,
} from "firebase/firestore";
import { normalizeHandle } from "./handles";
import { INVITE_CAP, type Invite } from "./invites";

/**
 * Which uid holds this handle, or null.
 *
 * A direct document read, not a query: the registry is keyed by the
 * canonical handle, so `v2_handles/olaf` either exists or does not. That
 * is also why the rules can grant a read without granting a listing —
 * there is no query surface here that enumerates handles.
 *
 * Null covers both "not a valid handle" and "nobody has it". To a caller
 * looking someone up they are the same answer, and distinguishing them
 * would leak the shape of the registry to a search box.
 */
export async function uidForHandle(db: Firestore, raw: string): Promise<string | null> {
  const handle = normalizeHandle(raw);
  if (!handle) return null;
  const snap = await getDoc(doc(db, "v2_handles", handle));
  if (!snap.exists()) return null;
  const uid = snap.get("uid");
  return typeof uid === "string" && uid ? uid : null;
}

/**
 * Every open invitation for `me`, newest first.
 *
 * One collection-group query on `invites` where `to == me` — the same
 * shape the follow graph uses for its mutual flag (circle.ts
 * fetchFollowersOf), and for the same reason: a collection-group query
 * cannot filter on a document id, so the invitee's uid is denormalised
 * onto the document as `to`.
 *
 * Refuses nothing and filters nothing: an invitation the viewer does not
 * want is declined, not hidden, because a silently-dropped invite is
 * indistinguishable from one that never arrived.
 */
export async function fetchInvites(db: Firestore, me: string): Promise<Invite[]> {
  const snap = await getDocs(query(
    collectionGroup(db, "invites"),
    where("to", "==", me),
    orderBy("at", "desc"),
    fsLimit(INVITE_CAP),
  ));
  const out: Invite[] = [];
  for (const d of snap.docs) {
    // v2_groups/{gid}/invites/{uid} — the parent of the parent is the group.
    const gid = d.ref.parent.parent?.id;
    if (!gid) continue;
    const ts = d.get("at") as { toMillis?: () => number } | null | undefined;
    out.push({
      gid,
      groupName: String(d.get("groupName") || ""),
      mode: String(d.get("mode") || "group"),
      from: String(d.get("from") || ""),
      fromName: String(d.get("fromName") || ""),
      at: typeof ts?.toMillis === "function" ? ts.toMillis() : 0,
    });
  }
  return out;
}

/**
 * How many directory rows one search will draw.
 *
 * Not a product limit — it is the bound on a query whose cost grows with
 * how short a prefix somebody types. "a" matches most of the population;
 * this is what stops that being most of the population's worth of reads.
 */
export const PEOPLE_SEARCH_CAP = 8;

/** One row of the people directory (D239) — a name, and a handle if claimed. */
export interface DirectoryPerson {
  uid: string;
  name: string;
  handle: string;
}

/**
 * People whose display name starts with what was typed.
 *
 * A PREFIX RANGE, which is the only text matching Firestore has: the
 * lower bound is the key itself and the upper bound is that key with
 * U+F8FF appended — written as an ESCAPE rather than the literal
 * character, which is invisible in an editor and survives a careless
 * copy only by luck. So `["ada", "ada\uf8ff")` spans every name
 * beginning "ada" and nothing that does not. There is no substring search
 * and no fuzzy match to be had here — "lovelace" will not find "Ada
 * Lovelace", and a directory that pretended otherwise would be worse
 * than one whose limit is legible.
 *
 * Matching happens on `nameKey`, the lowercase copy that firestore.rules
 * forces to equal `name` — so the search is case-insensitive without a
 * second query, and what you searched by is what the row displays.
 *
 * `nameKey` is a single field, so Firestore indexes it automatically and
 * this needs no entry in firestore.indexes.json.
 */
export async function searchPeopleByName(
  db: Firestore,
  raw: string,
  cap: number = PEOPLE_SEARCH_CAP,
): Promise<DirectoryPerson[]> {
  const key = raw.trim().toLowerCase();
  // An empty prefix spans the WHOLE directory. Refused here rather than
  // bounded by `cap`, because "the first eight people who ever signed
  // up" is not a search result — it is a listing, which is the one thing
  // D122 kept this app from having.
  if (!key) return [];
  const snap = await getDocs(query(
    collection(db, "v2_people"),
    where("nameKey", ">=", key),
    where("nameKey", "<", key + "\uf8ff"),
    orderBy("nameKey"),
    fsLimit(cap),
  ));
  const out: DirectoryPerson[] = [];
  snap.forEach((d) => {
    const name = String(d.get("name") || "").trim();
    // A row with no name cannot be drawn and cannot have matched
    // anything a person typed — skip rather than render "Someone",
    // which would read as an account rather than as a broken row.
    if (name) out.push({ uid: d.id, name, handle: String(d.get("handle") || "") });
  });
  return out;
}

/**
 * Write this account's directory row.
 *
 * The client owns the name half (the handle half is `claimHandleV2`'s,
 * and is immutable here — see firestore.rules). `nameKey` is written
 * beside it and the rules check the two agree, so this cannot publish a
 * name it is not also found by.
 */
export async function writeDirectoryRow(
  db: Firestore,
  uid: string,
  name: string,
): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const { doc: fsDoc, setDoc } = await import("firebase/firestore");
  await setDoc(fsDoc(db, "v2_people", uid), {
    name: clean,
    nameKey: clean.toLowerCase(),
  }, { merge: true });
}
