// Finding a person: the one query every surface that adds somebody runs
// (D237, D239).
//
// TWO WAYS IN, merged here so the three callers cannot drift. A HANDLE
// is an exact address — one document read against a registry keyed on
// the id (D122). A NAME is a prefix over the people directory (D239) —
// a bounded query, case-insensitive because `nameKey` is the lowercase
// copy the rules force to equal the name.
//
// Prefix, not substring: Firestore has no substring or fuzzy matching,
// so "lovelace" does not find "Ada Lovelace". A directory that
// pretended otherwise would be worse than one whose limit is legible.
//
// Its own module for two reasons that happen to agree. The lint rule is
// the loud one — a file that exports a component may export only
// components, or fast refresh stops working. The real one is that BOTH
// sides need this answer and they must not compute it differently:
// `LivePeopleSearch` decides whether to render, and `search-overlay.jsx`
// decides whether to print "nothing found" — and in a live build the
// overlay's own people list is ALWAYS empty, so without asking here it
// would print "nothing for @ada" directly above Ada.
import React from "react";
import LIVE from "../data/live";
import { normalizeHandle } from "../data/handles";
import type { DirectoryPerson } from "../data/socialFetch";

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

// The registry and the directory are both billed reads, and a handle is
// valid several characters before it is finished — "olafsen" is five
// valid handles on the way to one. So the field settles first.
export const FIND_DEBOUNCE_MS = 300;

export interface FindResult {
  /** Matches, exact-handle hit first when there is one. */
  rows: DirectoryPerson[];
  /** A lookup is in flight for a settled query. */
  busy: boolean;
  /** The query came back empty. Carries what was searched, for the wording. */
  empty: string | null;
  /**
   * The lookup FAILED — offline, or a refused read. Distinct from `empty`
   * because "we could not ask" and "nobody" are different facts and only
   * one of them is about the person being searched for
   * (`data/budgetMode.ts`'s rule, stated there and broken here).
   */
  failed: boolean;
}

/**
 * Find people by handle or by name.
 *
 * ONE HOOK FOR THREE SURFACES — the create picker, add-to-a-circle, and
 * the search overlay's people section. They render different rows and
 * different actions; what they must not do is answer "who is this" three
 * different ways, which is how one of them quietly stops finding people
 * the other two can see.
 *
 * `exclude` drops uids a caller cannot offer — the people already picked,
 * the members a circle already has, and you. Applied here rather than at
 * each call site so a filtered-out row cannot be counted as a match and
 * leave the caller drawing an empty list under "1 result".
 */
export function usePeopleFinder(query: string, exclude: readonly string[] = []): FindResult {
  const [rows, setRows] = React.useState<DirectoryPerson[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [empty, setEmpty] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const canonical = normalizeHandle(query);
  // ASCII-ONLY, matching `foldName` in data/socialFetch and the fold in
  // `LIVE.social.searchPeople` this key is handed to. It ends up as a
  // prefix over `nameKey`, which firestore.rules pins to `name.lower()` —
  // and the rules engine's `.lower()` touches A-Z and nothing else, so a
  // full-Unicode `toLowerCase()` here lowers "Ó" to "ó" and the prefix
  // stops matching the stored key. This is the THIRD hop that had to
  // agree; socialFetch's own docstring calls this module "what every
  // surface that finds people actually uses", which is why it is the one
  // that decides whether the other two are reachable at all.
  // The two `toLowerCase()` calls above, in the local circle filter,
  // stay: they compare a name against a name, both in JS, and never meet
  // a rules-computed key.
  const key = query.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
  // A string, so the effect re-runs when the SET changes rather than on
  // every render — an array literal from a caller is a new identity each
  // time and would restart the debounce forever.
  const skip = [...exclude].sort().join(",");

  React.useEffect(() => {
    setRows([]);
    setEmpty(null);
    setFailed(false);
    // Lowered HERE and only here. This is the one exit that starts no
    // replacement lookup, so it is the one path where nothing else will
    // ever lower the flag: the cleanup below sets `live = false` for the
    // run being superseded, which is exactly what stops its `finally`
    // from firing. Clearing a field mid-lookup therefore left "Looking…"
    // under an empty box for the life of the panel.
    //
    // Not lowered for a supersede by a NON-empty query, deliberately:
    // that run's own finally lowers it, and clearing it here would blink
    // the spinner off and back on once per keystroke.
    if (!key) { setBusy(false); return undefined; }
    let live = true;
    const drop = new Set(skip ? skip.split(",") : []);
    const t = setTimeout(() => {
      setBusy(true);
      void (async () => {
        try {
          // Both at once. The handle read is skipped entirely when what
          // was typed cannot be one, so a name search costs one query.
          const [byName, handleUid] = await Promise.all([
            LIVE.social.searchPeople(key),
            canonical ? LIVE.social.whoIs(canonical) : Promise.resolve(null),
          ]);
          if (!live) return;
          const out = byName.filter((r) => !drop.has(r.uid));
          // The exact hit leads, and joins the list only if the name
          // search did not already carry it — one person, one row.
          if (handleUid && !drop.has(handleUid) && !out.some((r) => r.uid === handleUid)) {
            // The registry stores a uid and nothing else, so the name is
            // a second read, batched into the shared profile cache every
            // other person surface reads from.
            // CAUGHT SEPARATELY, and this is the whole reason: the name
            // matches are already in `out` at this point. When this read
            // threw, the outer catch discarded every one of them and the
            // panel said "Nobody found" over five real people held in
            // memory. The row is still worth showing without its name —
            // `nameFor` falls back — so a failure here costs a name, not
            // a search.
            await LIVE.loadNames([handleUid]).catch(() => {});
            if (!live) return;
            out.unshift({ uid: handleUid, name: LIVE.nameFor(handleUid), handle: canonical || "" });
          }
          setRows(out);
          if (!out.length) setEmpty(query.trim());
        } catch {
          // Offline, or a refused read — NOT an empty directory. This set
          // `empty`, so the panel drew "Nobody found for 'ada'": a claim
          // about who exists, made when the only thing that happened was
          // that we could not ask.
          if (live) setFailed(true);
        } finally {
          if (live) setBusy(false);
        }
      })();
    }, FIND_DEBOUNCE_MS);
    return () => { live = false; clearTimeout(t); };
  }, [key, canonical, skip, query]);

  return { rows, busy, empty, failed };
}
