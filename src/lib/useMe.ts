// useMe — minimal "who am I" derived from Firebase auth (+ profile).
// Returns the few fields that get rendered in chrome: a display name,
// initials, a stable accent hue, and a photo URL when available.
//
// Falls back to a generic "you" when signed-out, so chrome never
// shows the seed cast's identity ("AS"/"Alma Søvik" no longer leaks
// into a real user's avatar or daily-report header).

import { useMemo } from "react";
import { useAuth } from "./useAuth";

// Seed initials we want to make sure NEVER leak through. Treat them
// as if they were unset — useful when older builds wrote them to
// localStorage as a profile patch.
const SEED_INITIALS = new Set(["AS"]);

export interface Me {
  name: string;
  initials: string;
  hue: number;
  photoURL: string | null;
  isAuthed: boolean;
}

export function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "??";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable hue from a string (uid or email) — deterministic colouring
// without storing a preference. Same string → same hue across
// sessions and devices.
function hueOf(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function useMe(): Me {
  const { user } = useAuth();

  return useMemo<Me>(() => {
    if (!user) {
      return {
        name: "you",
        initials: "··",
        hue: 38,
        photoURL: null,
        isAuthed: false,
      };
    }
    // Prefer displayName, then email local-part, then a fragment of
    // uid. Anonymous / passwordless logins frequently have neither
    // name nor email, so handle that gracefully.
    const fromEmail = user.email?.split("@")[0] ?? "";
    const name =
      user.displayName?.trim() ||
      (fromEmail ? fromEmail : `user-${user.uid.slice(0, 4)}`);

    const computedInitials = initialsOf(name);
    const initials = SEED_INITIALS.has(computedInitials)
      ? // Defensive: if the real user's initials happen to clash with a
        // seed initial we've leaked elsewhere, salt with uid to make
        // them visibly different.
        (name[0].toUpperCase() + user.uid[0].toUpperCase())
      : computedInitials;

    return {
      name,
      initials,
      hue: hueOf(user.uid),
      photoURL: user.photoURL ?? null,
      isAuthed: true,
    };
  }, [user]);
}
