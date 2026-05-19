// useRelations — single source of truth for "what's my relation to
// everyone" data. Powers PersonOverlay's follow/befriend/unfriend/
// block buttons + PeopleTab's followers / pending-requests lists.
//
// Subscriptions:
//   - my followers (people who follow me)
//   - my following (people I follow)
//   - my friends (mutual = entries in my own circle subcollection)
//   - my incoming friend requests
//   - my blocks
//
// All five lists are kept in memory as Sets of uids for cheap
// "is X my friend?" lookups in render paths. Subscriptions are
// silently torn down on sign-out.

import { useEffect, useMemo, useState } from "react";
import {
  firebaseEnabled,
  subscribeBlocks,
  subscribeCircle,
  subscribeFollowers,
  subscribeFollowing,
  subscribeFriendRequests,
  type RelationDoc,
} from "./firebase";
import { useAuth } from "./useAuth";

export interface RelationGraph {
  /** People who follow me — they see what I share at "city" tier. */
  followers: RelationDoc[];
  /** People I follow — populates the "following" view. */
  following: RelationDoc[];
  /** Mutual friends (entries in my own /circle subcollection). */
  friends: RelationDoc[];
  /** Pending incoming friend requests. */
  incomingRequests: RelationDoc[];
  /** Users I've blocked. */
  blocks: RelationDoc[];
}

export interface MyRelations extends RelationGraph {
  loading: boolean;
  /** O(1) "is X a follower of mine" check. */
  isFollower: (uid: string) => boolean;
  /** O(1) "do I follow X" check. */
  follows: (uid: string) => boolean;
  /** O(1) "is X my friend" check. */
  isFriend: (uid: string) => boolean;
  /** O(1) "do I have a pending request from X". */
  hasIncomingRequest: (uid: string) => boolean;
  /** O(1) "have I blocked X". */
  isBlocked: (uid: string) => boolean;
  /** Net relation summary for PersonOverlay's status pill. */
  statusOf: (uid: string) => RelationStatus;
}

export type RelationStatus =
  | "none"
  | "following"
  | "followed-by"
  | "mutual-follow"
  | "request-out"
  | "request-in"
  | "friend"
  | "blocked";

export function useMyRelations(): MyRelations {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<RelationDoc[]>([]);
  const [following, setFollowing] = useState<RelationDoc[]>([]);
  const [friends, setFriends] = useState<RelationDoc[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<RelationDoc[]>([]);
  const [blocks, setBlocks] = useState<RelationDoc[]>([]);
  // Loading is true only when we have a user but haven't received
  // the first followers snapshot yet. The signed-out path stays
  // false from the initialiser.
  const [loading, setLoading] = useState<boolean>(
    () => firebaseEnabled && !!user,
  );

  useEffect(() => {
    if (!firebaseEnabled || !user) {
      // Signed-out / no-firebase: no subscriptions to set up.
      // Loading completes implicitly on the next paint; the
      // useState initialiser already starts everything empty.
      return;
    }
    // Five parallel subscriptions. Marking "loading" false on the
    // first followers callback is good enough — the others are
    // typically empty for new users and would block forever.
    let firstArrival = true;
    const markLoaded = () => {
      if (firstArrival) {
        firstArrival = false;
        setLoading(false);
      }
    };

    const unsubs = [
      subscribeFollowers(user.uid, (list) => {
        setFollowers(list);
        markLoaded();
      }),
      subscribeFollowing(user.uid, setFollowing),
      subscribeCircle(user.uid, setFriends),
      subscribeFriendRequests(user.uid, setIncomingRequests),
      subscribeBlocks(user.uid, setBlocks),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [user]);

  // Pre-compute Sets so render-path predicates are O(1).
  const sets = useMemo(() => {
    return {
      followers: new Set(followers.map((r) => r.uid)),
      following: new Set(following.map((r) => r.uid)),
      friends: new Set(friends.map((r) => r.uid)),
      incoming: new Set(incomingRequests.map((r) => r.uid)),
      blocks: new Set(blocks.map((r) => r.uid)),
    };
  }, [followers, following, friends, incomingRequests, blocks]);

  const isFollower = (uid: string) => sets.followers.has(uid);
  const follows = (uid: string) => sets.following.has(uid);
  const isFriend = (uid: string) => sets.friends.has(uid);
  const hasIncomingRequest = (uid: string) => sets.incoming.has(uid);
  const isBlocked = (uid: string) => sets.blocks.has(uid);

  const statusOf = (uid: string): RelationStatus => {
    if (isBlocked(uid)) return "blocked";
    if (isFriend(uid)) return "friend";
    if (hasIncomingRequest(uid)) return "request-in";
    // We don't subscribe to *outgoing* requests directly (the doc
    // lives in the recipient's namespace and we'd need a separate
    // per-target read). The caller can resolve "request-out" via a
    // dedicated check when needed; treat as "none" here.
    const f = follows(uid);
    const fb = isFollower(uid);
    if (f && fb) return "mutual-follow";
    if (f) return "following";
    if (fb) return "followed-by";
    return "none";
  };

  return {
    followers,
    following,
    friends,
    incomingRequests,
    blocks,
    loading,
    isFollower,
    follows,
    isFriend,
    hasIncomingRequest,
    isBlocked,
    statusOf,
  };
}
