// useInterestVotes — read + write side of the community voting
// surface for a single interest. Returns the four item-type lists
// (media / figures / literature / tips) plus the user's vote set
// and primitives for upvote / unvote / suggest / delete.
//
// Each interest is bucketed by a slug (slugifyInterest) so users
// who typed slightly different casings still land in the same
// list. The top 20 items per type are streamed via a Firestore
// subscription ordered by voteCount.

import { useCallback, useEffect, useState } from "react";
import {
  addInterestItem,
  checkUserVotes,
  deleteInterestItem,
  firebaseEnabled,
  removeInterestVote,
  slugifyInterest,
  subscribeInterestItems,
  upvoteInterestItem,
  type InterestItem,
  type InterestItemType,
} from "./firebase";
import { useAuth } from "./useAuth";

export const INTEREST_ITEM_TYPES: { id: InterestItemType; label: string }[] = [
  { id: "media", label: "Media" },
  { id: "figure", label: "Public figures" },
  { id: "literature", label: "Literature" },
  { id: "tip", label: "Tips" },
];

export interface InterestVoteData {
  /** Available regardless of auth — empty when Firebase is off. */
  byType: Record<InterestItemType, InterestItem[]>;
  /** Item ids the current user has upvoted. */
  votedIds: Set<string>;
  /** True while the first round of subscriptions are pending. */
  loading: boolean;
  upvote: (itemId: string) => Promise<void>;
  unvote: (itemId: string) => Promise<void>;
  suggest: (
    type: InterestItemType,
    name: string,
    description?: string,
  ) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
}

export function useInterestVotes(interestName: string): InterestVoteData {
  const { user } = useAuth();
  const slug = slugifyInterest(interestName);
  const [byType, setByType] = useState<Record<InterestItemType, InterestItem[]>>({
    media: [],
    figure: [],
    literature: [],
    tip: [],
  });
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);

  // One subscription per type. Each fires independently; we mark
  // loading=false on the first arrival of any of them so the UI
  // can show partial state if media lands before tips.
  useEffect(() => {
    if (!firebaseEnabled || !slug) {
      setByType({ media: [], figure: [], literature: [], tip: [] });
      setLoading(false);
      return;
    }
    const unsubs: Array<() => void> = [];
    let firstArrival = true;
    for (const { id: type } of INTEREST_ITEM_TYPES) {
      unsubs.push(
        subscribeInterestItems(slug, type, (items) => {
          setByType((prev) => ({ ...prev, [type]: items }));
          if (firstArrival) {
            firstArrival = false;
            setLoading(false);
          }
        }),
      );
    }
    return () => {
      for (const u of unsubs) u();
    };
  }, [slug]);

  // Whenever the visible item ids change AND we have a user, check
  // which of them the current user has voted on. Debounced via
  // useEffect re-running on the joined id key.
  const allIds = [
    ...byType.media,
    ...byType.figure,
    ...byType.literature,
    ...byType.tip,
  ].map((i) => i.id);
  const idsKey = allIds.join(",");
  useEffect(() => {
    if (!firebaseEnabled || !user || allIds.length === 0) {
      setVotedIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const set = await checkUserVotes(allIds, user.uid);
        if (!cancelled) setVotedIds(set);
      } catch (err) {
        console.error("[useInterestVotes] checkUserVotes failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // allIds is recomputed each render; using its joined key is the
    // intentional behaviour and standard pattern for stable deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, idsKey]);

  const upvote = useCallback(
    async (itemId: string) => {
      if (!firebaseEnabled || !user) return;
      // Optimistic — flip the local set immediately, revert on
      // failure. The Firestore subscription will overwrite the
      // count when the +1 lands.
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
      try {
        await upvoteInterestItem(itemId, user.uid);
      } catch (err) {
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        throw err;
      }
    },
    [user],
  );

  const unvote = useCallback(
    async (itemId: string) => {
      if (!firebaseEnabled || !user) return;
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      try {
        await removeInterestVote(itemId, user.uid);
      } catch (err) {
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.add(itemId);
          return next;
        });
        throw err;
      }
    },
    [user],
  );

  const suggest = useCallback(
    async (
      type: InterestItemType,
      name: string,
      description?: string,
    ) => {
      if (!firebaseEnabled || !user) return;
      const trimmed = name.trim();
      if (!trimmed || !slug) return;
      await addInterestItem(user.uid, slug, type, trimmed, description);
    },
    [user, slug],
  );

  const remove = useCallback(async (itemId: string) => {
    if (!firebaseEnabled) return;
    await deleteInterestItem(itemId);
  }, []);

  return { byType, votedIds, loading, upvote, unvote, suggest, remove };
}
