// The two Firestore reads behind handles and invitations (D122).
//
// WHY THEY ARE NOT IN ./handles AND ./invites, where they read more
// naturally: those two are imported by LiveDuelPanel and
// LivePrivacyPanel, which are EAGER (they self-register on globalThis for
// the spec layer's render-time lookups). A `firebase/firestore` import
// reachable from an eager module puts the whole SDK on the first-paint
// path — check:bundle measured 1270 KB against a 955 KB ceiling, which is
// exactly the tree as it stood before D110.
//
// So the split is by WHAT MAY BE IMPORTED EAGERLY, not by subject: the
// validation and the wording are pure and live with their features, and
// the two reads live here, where only live.ts reaches them and only
// through a dynamic import inside an already-async method. Same shape
// data/circle.ts has, for the same measured reason.

import {
  collectionGroup, doc, getDoc, getDocs, limit as fsLimit, orderBy, query, where,
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
