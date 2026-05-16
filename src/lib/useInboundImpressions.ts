// useInboundImpressions — subscribe to the user's own anonymous-
// trait inbox. The "of you" side of ImpressionsOverlay.
//
// Cross-user inserts happen on the sender's side via
// sendInboundImpression(); this hook only reads + lets the
// recipient delete entries from their inbox.
//
// localStorage fallback is intentionally not provided — these are
// inherently a cloud-only feature (someone else writes for you).
// Signed-out users see an empty list with an explanatory note in
// ImpressionsOverlay's "of you" tab.

import { useEffect, useState } from "react";
import type { InboundImpression } from "../types";
import {
  deleteInboundImpression,
  firebaseEnabled,
  subscribeInboundImpressions,
} from "./firebase";
import { useAuth } from "./useAuth";

export function useInboundImpressions(): {
  items: InboundImpression[];
  remove: (id: string) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [items, setItems] = useState<InboundImpression[]>([]);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeInboundImpressions(user.uid, (list) => {
      // Newest first.
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
      setItems(sorted);
    });
    return unsub;
  }, [isSignedIn, user]);

  // Signed-out users have an empty inbox by construction. We expose
  // the empty array directly rather than maintaining state for it.
  const visible = isSignedIn ? items : [];

  const remove = async (id: string): Promise<void> => {
    if (!isSignedIn || !user) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    await deleteInboundImpression(user.uid, id);
  };

  return { items: visible, remove };
}
