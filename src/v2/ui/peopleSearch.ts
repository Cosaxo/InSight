// What the live people section of search has to draw, without drawing it
// (D231).
//
// Its own module for two reasons that happen to agree. The lint rule is
// the loud one — a file that exports a component may export only
// components, or fast refresh stops working. The real one is that BOTH
// sides need this answer and they must not compute it differently:
// `LivePeopleSearch` decides whether to render, and `search-overlay.jsx`
// decides whether to print "nothing found" — and in a live build the
// overlay's own people list is ALWAYS empty, so without asking here it
// would print "nothing for @ada" directly above Ada.
import LIVE from "../data/live";
import { normalizeHandle } from "../data/handles";

/**
 * The follows ALREADY IN MEMORY that match, filtered locally.
 *
 * Deliberately never calls `LIVE.loadCircle()`: that is the per-member
 * answer fan-out — one read per follow — and a search field is not where
 * to spend it. When the Mirror's Circle stop has paid for it the list is
 * here for free; when it has not, the registry lookup is still the whole
 * feature.
 */
export function circleMatches(query: string): Array<{ uid: string; name: string }> {
  const q = query.trim().toLowerCase();
  const mine = LIVE.circle() || [];
  return q ? mine.filter((m) => (m.name || "").toLowerCase().includes(q)) : mine;
}

/**
 * Will the live people section draw anything for this query?
 *
 * A valid handle counts even before the lookup returns, because the
 * section says something either way: the row, "Looking up @ada…", or
 * "No account is @ada."
 */
export function livePeopleActive(query: string): boolean {
  return !!normalizeHandle(query) || circleMatches(query).length > 0;
}
