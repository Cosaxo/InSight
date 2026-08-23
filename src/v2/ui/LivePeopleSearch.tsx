// The people section of the search overlay, in a live build (D231, D233).
//
// It rendered EMPTY for the whole life of live mode — `samplePeople ===
// false` returns `[]` in search-overlay.jsx, guarding D1: every persona
// behind it is invented, down to the subtitles ("sister · since birth ·
// 86% match"), and a real user reading an invented sister into their own
// search is exactly the fabrication that store predates.
//
// The guard was right; its consequence was that a live build could add
// somebody to a circle and could not look anybody up. D231 opened this
// on the handle registry, which answers an exact address and nothing
// else. D233 added the name half, and moved the query itself into
// `usePeopleFinder` so this section, the create picker and add-to-a-
// circle cannot answer "who is this" three different ways.
import React from "react";
import LIVE from "../data/live";
import { circleMatches, usePeopleFinder } from "./peopleSearch";
import PersonRow from "./PersonRow";

function PsFollow({ uid }: { uid: string }) {
  const following = LIVE.isFollowing(uid);
  return (
    <button onClick={() => void LIVE.setFollowing(uid, !following)} aria-pressed={following}
      style={{ border: "1px solid color-mix(in oklch, var(--rule), transparent 25%)",
        borderRadius: 999, padding: "4px 11px", cursor: "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11, WebkitAppearance: "none",
        background: following ? "var(--ink)" : "transparent",
        color: following ? "var(--surface)" : "var(--ink-2)" }}>
      {following ? "Following" : "Follow"}
    </button>
  );
}

/**
 * @param onActive fires when this section gains or loses something to
 * draw. The overlay owns the "nothing found" line for the WHOLE search,
 * and its own people list is always empty in a live build — so without
 * this it would print "Nothing for ada" directly above Ada. A callback
 * rather than a synchronous predicate because the answer arrives from a
 * query, and a guess made before it returns is wrong half the time.
 */
export default function LivePeopleSearch({ query, onActive }: {
  query: string;
  onActive?: (active: boolean) => void;
}) {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const { rows, busy } = usePeopleFinder(query);

  // NO QUERY: the people already in your circle, free — they are in
  // memory or they are not, and nothing here pays `LIVE.loadCircle()` to
  // put them there. That is one read per follow, and a search box you
  // have only just opened is not where to spend it.
  const idle = !query.trim();
  const follows = circleMatches("");
  const active = idle ? follows.length > 0 : (rows.length > 0 || busy);

  // Reported through a ref so an inline arrow from the caller cannot
  // turn "tell me when this changes" into "tell me on every render".
  const was = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (was.current === active) return;
    was.current = active;
    if (onActive) onActive(active);
  }, [active, onActive]);

  if (!active) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {/* The section owns its heading, because it is the only thing that
          knows whether it has a row. "Following" rather than the demo's
          "Friends": this list is the follow graph, and calling it
          friendship would be a claim about people the app cannot make. */}
      <div className="search-group">{idle ? "Following" : "People"}</div>
      {idle
        ? follows.map((m) => (
          <PersonRow key={m.uid} uid={m.uid} name={m.name}>
            <PsFollow uid={m.uid} />
          </PersonRow>
        ))
        : rows.map((r) => (
          <PersonRow key={r.uid} uid={r.uid} name={r.name} handle={r.handle || undefined}>
            {/* Following yourself is not a state the store will enter
                (setFollowing refuses uid === me), so the button would be
                a control that does nothing. Say which person this is. */}
            {r.uid === (LIVE.uid || "")
              ? <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>you</span>
              : <PsFollow uid={r.uid} />}
          </PersonRow>
        ))}
      {busy && !rows.length && (
        <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
          color: "var(--ink-3)", padding: "2px 2px 0" }}>Looking…</div>
      )}
    </div>
  );
}
