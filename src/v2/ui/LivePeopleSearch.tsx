// LivePeopleSearch — the people half of the search overlay, in a live
// build (D231).
//
// That section has rendered EMPTY since the port. `search-overlay.jsx`
// returns `[]` for people whenever `samplePeople === false`, guarding D1:
// every persona behind it is invented, down to the subtitles ("sister ·
// since birth · 86% match"), and a real user reading an invented sister
// into their own search is exactly the fabrication that store predates.
//
// The guard was right. Its CONSEQUENCE was that a live build had no way
// to find a person at all — D122 built the registry that answers this and
// then reached it from exactly one place, `LdAddByHandle`, inside a
// circle you had already made. So the app could add someone to a room and
// could not look anybody up.
//
// EXACT HANDLE LOOKUP, NEVER A PREFIX QUERY. `v2_handles/{handle}` is
// keyed on the DOCUMENT ID precisely so the registry answers "is @olaf
// someone" and never "who is everyone" (D122). Searching by prefix would
// need a query surface over that collection, which is a different
// exposure and would be a different decision — not a detail of this one.
// So this finds the friend whose handle you know, which is the way people
// hand out an address.
import React from "react";
import LIVE from "../data/live";
import { atHandle, normalizeHandle } from "../data/handles";
// Shared with search-overlay.jsx, which needs the same answer to decide
// whether to print "nothing found" — see peopleSearch.ts.
import { circleMatches } from "./peopleSearch";
import Avatar from "./Avatar";

// The registry is a billed read per lookup, and a handle becomes valid
// several characters before it is finished — "olafsen" is five valid
// handles on the way to one. So the field settles first.
const LOOKUP_DEBOUNCE_MS = 300;

const PS_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

function PsFollow({ uid }: { uid: string }) {
  const following = LIVE.isFollowing(uid);
  return (
    <button onClick={() => void LIVE.setFollowing(uid, !following)} aria-pressed={following}
      style={{ border: PS_LINE, borderRadius: 999, padding: "4px 11px", cursor: "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11, WebkitAppearance: "none",
        background: following ? "var(--ink)" : "transparent",
        color: following ? "var(--surface)" : "var(--ink-2)" }}>
      {following ? "Following" : "Follow"}
    </button>
  );
}

function PsRow({ uid, name, handle }: { uid: string; name: string; handle?: string }) {
  const me = uid === (LIVE.uid || "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
      background: "var(--surface)", border: PS_LINE, borderRadius: 13 }}>
      <Avatar uid={uid} name={name} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700,
          letterSpacing: "-0.015em", color: "var(--ink)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name || "Someone"}
        </div>
        {handle && (
          <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 11.5, fontWeight: 600,
            color: "var(--ink-3)" }}>{atHandle(handle)}</div>
        )}
      </div>
      {/* Following yourself is not a state the store will enter
          (setFollowing refuses uid === me), so the button would be a
          control that does nothing. Say which person this is instead. */}
      {me
        ? <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>you</span>
        : <PsFollow uid={uid} />}
    </div>
  );
}

function PsNote({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
      color: "var(--ink-3)", lineHeight: 1.5, padding: "2px 2px 0" }}>{children}</div>
  );
}

export default function LivePeopleSearch({ query }: { query: string }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const [found, setFound] = React.useState<string | null>(null);
  const [miss, setMiss] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const canonical = normalizeHandle(query);
  const matches = circleMatches(query);

  React.useEffect(() => {
    setFound(null);
    setMiss(null);
    if (!canonical) return undefined;
    let live = true;
    const t = setTimeout(() => {
      setBusy(true);
      void (async () => {
        try {
          const uid = await LIVE.social.whoIs(canonical);
          if (!live) return;
          if (!uid) { setMiss(canonical); return; }
          setFound(uid);
          // The registry stores a uid and nothing else, so the name is a
          // second read — batched into the shared profile cache, which
          // every other person surface already reads from.
          await LIVE.loadNames([uid]);
        } catch {
          // Offline, or the registry refused. The follows above still
          // answer, and a thrown search box is worse than a quiet one.
        } finally {
          if (live) setBusy(false);
        }
      })();
    }, LOOKUP_DEBOUNCE_MS);
    return () => { live = false; clearTimeout(t); };
  }, [canonical]);

  // A handle that resolves to somebody already on the list above is one
  // person, not two rows.
  const extra = found && !matches.some((m) => m.uid === found) ? found : null;

  if (!matches.length && !extra && !miss && !busy) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {/* The section owns its own heading, because it is the only thing
          that knows whether it has a row — a "People" label with nothing
          under it is what the caller would otherwise print. "Following"
          rather than the demo's "Friends" when there is no query: this
          list is the follow graph, and calling it friendship would be a
          claim about people the app cannot make. */}
      <div className="search-group">{query.trim() ? "People" : "Following"}</div>
      {extra && <PsRow uid={extra} name={LIVE.nameFor(extra)} handle={canonical || undefined} />}
      {matches.map((m) => <PsRow key={m.uid} uid={m.uid} name={m.name} />)}
      {busy && !extra && <PsNote>Looking up {atHandle(canonical || "")}…</PsNote>}
      {/* Deliberately does not distinguish "unclaimed" from "malformed" —
          to somebody looking a person up those are one answer. Same
          sentence LdAddByHandle and the picker give, for the same reason. */}
      {miss && <PsNote>No account is {atHandle(miss)}.</PsNote>}
    </div>
  );
}
