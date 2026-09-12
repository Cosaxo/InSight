// Friends, on D101's rows (VISION-2026-09-12 §2, D-2026-09-12a).
//
// THE MODEL. The people graph is one row per follow —
// `v2_users/{uid}/following/{target}` — written by its owner, world-
// readable, no request, no acceptance, no state machine (D101). The owner's
// 2026-09-12 design gives friends a HANDSHAKE — request · accept · ignore
// · dismiss · invited · unfriend — and every one of its states is the two
// rows read both ways:
//
//   none       neither row
//   invited    your row → them exists, theirs → you does not   (you asked)
//   requested  their row → you exists, yours → them does not   (they asked)
//   friends    both rows                                        (D101's "mutual", read)
//
// So an ACCEPT is the follow the tree already writes and UNFRIEND the
// delete it already allows: no new collection, no rules change, no new
// consent — D101's reasoning (a follow grants nothing, because answers are
// public) is untouched. What the design adds is that the other side
// learns: functions/src/v2social.ts's `onV2FollowCreated` sends one push
// on the row's create, which is the invitation's own delivery shape (D236).
//
// IGNORED AND DISMISSED ARE A DEVICE MIRROR. You cannot delete somebody
// else's row and should not want to — their follow is their bookmark — so
// "ignore this request" and "dismiss this suggestion" are the viewer's
// preference, kept in `insight.friendsHidden.v1` beside the mutes
// (data/mutes.ts, the same shape) and swept by the purge (D51,
// check:purge). A hidden uid is out of the requests and the suggestions;
// it is not out of `friendState`, which reads the rows and nothing else.
//
// SUGGESTIONS READ ONLY WHAT PUBLISHES. Three sources, none of them a new
// document: the people your friends follow (the graph is world-readable,
// one `fetchFollowing` per mutual friend, bounded and session-cached —
// *through Henrik*), the kindred pool the City stop already folds
// (`LIVE.kindredPeople()`, never forced here — *72% alike · Oslo*), and
// the Near room as the Near stop already lists it (*nearby now*). NEVER A
// DISTANCE: the design's *a few streets away* would draw the presence
// cell, which is one of the three denies that survived D98 (physical
// safety), and Near has been presence-only since D111. This is the one
// departure from the design and it is not an ask under D334 — the denies
// are outside it.
//
// NOT A MEMBER OF `LIVE`. The live surface is pinned (test/live-surface.ts)
// and live.ts is metered (check:file-size); this module composes the
// members the surface already has — `follows`, `setFollowing`,
// `loadNames`, `nameFor`, `kindredPeople`, `near.room`, `social.groups`,
// `social.leaveGroup` — and adds one read of its own through circle.ts.
// Nothing here is imported eagerly: the overlay that reads it is a
// React.lazy chunk, and the Firestore import below must stay off first
// paint (check:bundle).
import LIVE from "./live";
import { getDb } from "../../lib/firebase";
import { fetchFollowers, fetchFollowing, FOLLOW_CAP } from "./circle";

export type FriendState = "none" | "invited" | "requested" | "friends";

export interface Suggestion {
  uid: string;
  /** The mutual friend whose follows reached this person, or null. */
  via: string | null;
  /** Agreement with the viewer, 0–100, when the kindred fold has read them. */
  like: number | null;
  /** In the Near room right now — the fact Near already shows, never a distance. */
  near: boolean;
}

export interface FriendsView {
  requests: string[];
  invited: string[];
  friends: string[];
  suggested: Suggestion[];
  /** A read is in flight. The lists above are whatever is in hand. */
  loading: boolean;
  /** The followers read failed: requests and friends cannot be told from invited. */
  failed: boolean;
}

/** Mutual friends whose own follows are read for suggestions — bounded fan-out. */
export const FOF_FRIENDS_CAP = 12;
/** Suggestions offered before *Show more*. */
export const SUGGEST_FIRST = 4;

const HIDDEN_LS = "insight.friendsHidden.v1";

function loadHidden(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_LS) || "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

const state = {
  /** Who follows you, or null while unread or failed. */
  followers: null as string[] | null,
  loading: false,
  failed: false,
  /** friend uid → the uids they follow, for *through Henrik*. */
  fof: new Map<string, string[]>(),
  hidden: loadHidden(),
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => { try { f(); } catch { /* one listener throwing must not stop the rest */ } });

function saveHidden(): void {
  try { localStorage.setItem(HIDDEN_LS, JSON.stringify([...state.hidden])); } catch { /* best-effort */ }
  notify();
}

export function subscribeFriends(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** The state of one person, from the two rows. Unknown rows read as none. */
export function friendState(uid: string): FriendState {
  const me = LIVE.uid || "";
  if (!uid || uid === me) return "none";
  const iFollow = !!LIVE.follows()?.includes(uid);
  const theyFollow = !!state.followers?.includes(uid);
  if (iFollow && theyFollow) return "friends";
  if (iFollow) return "invited";
  if (theyFollow) return "requested";
  return "none";
}

export function isHidden(uid: string): boolean {
  return state.hidden.has(uid);
}

/**
 * The four lists, folded from the rows in hand. Cheap: a few set lookups
 * over lists capped at fifty and a hundred, so callers read it per render.
 */
export function friendsView(): FriendsView {
  const me = LIVE.uid || "";
  const following = LIVE.follows() || [];
  const followers = state.followers || [];
  const iSet = new Set(following);
  const tSet = new Set(followers);
  const friends = following.filter((u) => tSet.has(u));
  const invited = following.filter((u) => !tSet.has(u));
  const requests = followers.filter((u) => !iSet.has(u) && !state.hidden.has(u));
  // Suggestions, in the design's order: reached through a friend first,
  // then by agreement. Dedupe across the three sources; drop me, anyone
  // already on a list, and the hidden.
  const seen = new Set<string>([me, ...following, ...followers]);
  const out: Suggestion[] = [];
  const kindred = new Map<string, number>();
  for (const k of LIVE.kindredPeople()) kindred.set(k.uid, Math.round(k.like.pct));
  const nearSet = new Set((LIVE.near.room()?.people || []).map((p) => p.uid));
  const add = (uid: string, via: string | null, near: boolean) => {
    if (!uid || seen.has(uid) || state.hidden.has(uid)) return;
    seen.add(uid);
    out.push({ uid, via, like: kindred.has(uid) ? (kindred.get(uid) as number) : null, near });
  };
  for (const f of friends) for (const u of state.fof.get(f) || []) add(u, f, nearSet.has(u));
  for (const [uid] of kindred) add(uid, null, nearSet.has(uid));
  for (const uid of nearSet) add(uid, null, true);
  out.sort((a, b) => (b.via ? 1 : 0) - (a.via ? 1 : 0) || (b.like ?? -1) - (a.like ?? -1));
  return { requests, invited, friends, suggested: out, loading: state.loading, failed: state.failed };
}

/**
 * Read both directions and the suggestions' sources. One followers query,
 * one names batch, and up to FOF_FRIENDS_CAP follows reads for the people
 * your friends follow — behind the overlay's own open, never on a tab.
 * Idempotent while in flight; `force` re-reads after a write.
 */
export async function loadFriends(force = false): Promise<void> {
  const me = LIVE.uid || "";
  if (!LIVE.enabled || !me || state.loading) return;
  if (!force && state.followers) return;
  state.loading = true;
  state.failed = false;
  notify();
  try {
    const db = await getDb();
    await LIVE.loadFollows();
    state.followers = await fetchFollowers(db, me);
    const following = LIVE.follows() || [];
    const tSet = new Set(state.followers);
    const friends = following.filter((u) => tSet.has(u)).slice(0, FOF_FRIENDS_CAP);
    // Read each friend's follows once; a refetch after a write keeps what
    // it has and asks only for the friends it has not seen.
    await Promise.all(friends.filter((f) => !state.fof.has(f)).map(async (f) => {
      try {
        state.fof.set(f, (await fetchFollowing(db, f)).slice(0, FOLLOW_CAP));
      } catch {
        state.fof.set(f, []); // one refused read must not blank the list
      }
    }));
    const want = new Set<string>([...following, ...state.followers]);
    for (const [, us] of state.fof) for (const u of us) want.add(u);
    await LIVE.loadNames([...want].filter((u) => u !== me));
  } catch {
    // null, not []: "could not ask" is not "nobody follows you", and the
    // view says so through `failed` rather than drawing an empty list.
    state.followers = null;
    state.failed = true;
  } finally {
    state.loading = false;
    notify();
  }
}

/** Ask to compare answers: your row, and the server's push to them. Also the accept. */
export async function invite(uid: string): Promise<void> {
  await LIVE.setFollowing(uid, true);
  notify();
}

/** Take an invitation back, or leave a one-way follow behind. */
export async function cancel(uid: string): Promise<void> {
  await LIVE.setFollowing(uid, false);
  notify();
}

/** A request stops being shown — their row stands, as it should. */
export function ignore(uid: string): void {
  if (!uid || state.hidden.has(uid)) return;
  state.hidden.add(uid);
  saveHidden();
}

/** A suggestion stops being offered. */
export function dismiss(uid: string): void {
  ignore(uid);
}

/**
 * The 1v1 you have together, if any — the room of two whose members are
 * exactly you and them. Read from the groups already subscribed
 * (hydrateSocial's onSnapshot), no read of its own.
 */
export function duoWith(uid: string): string | null {
  const me = LIVE.uid || "";
  if (!me || !uid) return null;
  for (const g of LIVE.social.groups("duo") as Array<{ id: string; memberUids?: string[] }>) {
    const m = g.memberUids || [];
    if (m.length === 2 && m.includes(me) && m.includes(uid)) return g.id;
  }
  return null;
}

/**
 * Remove a friend: your row goes, and the 1v1 you had together ends —
 * which is what the remove sheet says will happen, so it happens. Their
 * row stays (it is theirs), and nobody is told: no push fires on a
 * delete, which is the *X isn't told* the sheet promises.
 */
export async function unfriend(uid: string): Promise<void> {
  const gid = duoWith(uid);
  if (gid) {
    try { await LIVE.social.leaveGroup(gid); } catch { /* the follow still goes; the room is theirs to leave next */ }
  }
  await LIVE.setFollowing(uid, false);
  notify();
}

/** Test seam: the module's own state, reset between cases. */
export function _resetFriendsForTest(): void {
  state.followers = null;
  state.loading = false;
  state.failed = false;
  state.fof = new Map();
  state.hidden = new Set();
}

// D51: every local store hears the purge. Drop without save() — saving
// would re-create the key the wipe just removed.
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => {
    state.hidden = new Set();
    state.followers = null;
    state.fof = new Map();
    state.failed = false;
    notify();
  });
}
