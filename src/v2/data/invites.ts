// Circle invitations, client side (D122).
//
// The inbox is one collection-group query on `invites` where `to == me` —
// the same shape the follow graph uses for its mutual flag
// (circle.ts fetchFollowersOf), and for the same reason: a
// collection-group query cannot filter on a document id, so the invitee's
// uid is denormalised onto the document as `to`.
//
// Everything a row draws — the circle's name, the inviter's name, the
// mode — is ON the invite. That is not denormalisation for speed: the
// group document is member-gated (it carries the invite code, which is a
// capability), and an invitee is by definition not a member yet, so
// reading the circle to describe the invitation is exactly the read the
// rules refuse.

// PURE, for the same structural reason data/handles.ts is: LiveDuelPanel
// is eager and draws these rows, so a `firebase/firestore` import here
// would put the SDK on the first-paint path. The query lives in
// ./socialFetch (D122).

/**
 * Most invitations one inbox will read.
 *
 * Anyone may invite anyone (D122), so this is not a product limit — it is
 * the bound on a list a stranger can lengthen. The server's per-hour
 * budget caps the rate; this caps what one screen will ever draw.
 */
export const INVITE_CAP = 50;

export interface Invite {
  /** The circle. */
  gid: string;
  /** Its name, as of when the invitation was sent. */
  groupName: string;
  /** "group" or "duo" — a 1v1 invitation reads differently. */
  mode: string;
  /** Who sent it. */
  from: string;
  /** Their display name, or "" if they had not set one. */
  fromName: string;
  /** When, in millis — 0 for a write not yet acked by the server. */
  at: number;
}

/**
 * The sentence an invitation row leads with.
 *
 * Pure, so the wording is testable without a DOM — and it is worth
 * testing, because an unnamed inviter is the common case on a young
 * account and "" invited you to "" is the shape that ships.
 */
export function inviteLine(inv: Invite): string {
  const who = inv.fromName.trim() || "Someone";
  const what = inv.groupName.trim();
  if (inv.mode === "duo") {
    return what ? `${who} wants to play ${what} with you` : `${who} wants to play 1v1 with you`;
  }
  return what ? `${who} invited you to ${what}` : `${who} invited you to a circle`;
}
