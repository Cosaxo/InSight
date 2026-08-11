// LiveVotersPanel — named who-voted (D94).
//
// The surface the reversal was for. Until D94 the app could tell you that
// 62% of 25-34s picked Beach and could not tell you one of them was
// Henrik; the rules forbade reading another user's answer, so every named
// population screen in the prototype shipped dark or invented its people.
// This reads real answers by real accounts and names them.
//
// WHAT IT DELIBERATELY DOES NOT DO.
//
// It does not fetch on mount of the CARD — only on mount of the opened
// sheet. One collection-group query plus a batched profile read per
// question per session (data/voters.ts owns both), which is the same
// posture LiveTakesPanel takes and for the same reason: a feed of fifty
// cards must cost nothing until one is asked about.
//
// It does not read the voter's CURRENT profile for their cohort. The
// chips come off the answer's frozen anchors snapshot (D8), so someone
// who has since moved city still appears in the city they answered from —
// which is also the only way this panel can agree with the aggregate
// above it, since the aggregate folds the same snapshot.
//
// It does not invent a name. An account that has set none renders as
// "Someone", and that string is the absence of data rather than a
// pseudonym — the D1 line, which D94 did not touch.
import React from "react";
import LIVE from "../data/live";
import type { Voter } from "../data/voters";

const LV_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

// The anchor fields worth showing beside a name, in display order. A
// subset of BREAKDOWN_DIMS on purpose: `relationship` is the one anchor
// people are most likely to have filled in without expecting it on a
// screen next to their name, so it stays off until someone asks for it.
const LV_CHIPS: ReadonlyArray<readonly [string, string]> = [
  ["ageBand", "age"],
  ["gender", "gender"],
  ["city", "city"],
  ["education", "education"],
];

function LvChips({ anchors }: { anchors: Record<string, string> }) {
  const shown = LV_CHIPS.map(([k]) => anchors?.[k]).filter(Boolean);
  if (!shown.length) return null;
  return (
    <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)" }}>
      {shown.join(" · ")}
    </span>
  );
}

function LvRow({ voter }: { voter: Voter }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0" }}>
      <span style={{
        fontFamily: "var(--sans)", fontSize: 13.5,
        fontWeight: voter.isMe ? 800 : 650,
        color: voter.name ? "var(--ink)" : "var(--ink-3)",
      }}>
        {voter.isMe ? "You" : (voter.name || "Someone")}
      </span>
      <LvChips anchors={voter.anchors} />
    </div>
  );
}

function LiveVotersPanel({ qid, options }: { qid: string; options: string[] }) {
  // One fetch per question per session. The store holds the list and
  // de-dupes concurrent calls, so a re-render mid-flight costs nothing.
  React.useEffect(() => { void LIVE.loadVoters(qid); }, [qid]);
  // The store notifies on completion; without this the panel would render
  // its loading state and never leave it.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);

  if (!LIVE.enabled || !qid) return null;

  const cols = LIVE.votersByOption(qid, options.length);

  // Three states, three sentences. `null` is "we could not ask" — the
  // store deliberately leaves the key absent on a failed fetch rather
  // than caching an empty list, because a frozen "nobody answered" is
  // the same kind of lie the old withheld cells were.
  if (cols === null) {
    return (
      <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", padding: "6px 2px" }}>
        {LIVE.votersLoading(qid) ? "Loading who answered…" : "Could not load who answered."}
      </div>
    );
  }

  const total = cols.reduce((n, c) => n + c.length, 0);
  if (!total) {
    return (
      <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", padding: "6px 2px" }}>
        Nobody has answered this yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        Who answered · {total}
      </span>
      {cols.map((voters, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: LV_LINE, paddingBottom: 5 }}>
            <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }}>
              {options[i]}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
              {voters.length}
            </span>
          </div>
          {voters.map((v) => <LvRow key={v.uid} voter={v} />)}
          {/* An option nobody picked keeps its column and says so — a
              missing column reads as a missing option. */}
          {!voters.length && (
            <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", padding: "5px 0" }}>
              Nobody yet.
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (world-feed.jsx).
Object.assign(globalThis, { LiveVotersPanel });

export default LiveVotersPanel;
