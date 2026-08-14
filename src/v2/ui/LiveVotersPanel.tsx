// LiveVotersPanel — named who-voted (D98).
//
// The surface the reversal was for. Until D98 the app could tell you that
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
// pseudonym — the D1 line, which D98 did not touch.
import React from "react";
import LIVE from "../data/live";
import { VOTER_FETCH_CAP, type Voter } from "../data/voters";

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

function LvChips({ anchors, skip = "" }: { anchors: Record<string, string>; skip?: string }) {
  // `skip` drops the dim the whole list is already scoped to (D125):
  // repeating "25-34" on every row of a list headed "in 25-34" spends the
  // line on the one fact the rows have in common, and what is worth
  // reading there is how else they differ.
  const shown = LV_CHIPS.filter(([k]) => k !== skip).map(([k]) => anchors?.[k]).filter(Boolean);
  if (!shown.length) return null;
  return (
    <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)" }}>
      {shown.join(" · ")}
    </span>
  );
}

function LvRow({ voter, skipChip = "" }: { voter: Voter; skipChip?: string }) {
  // The follow control (D101). This sheet is where a stranger first
  // becomes a person on screen, so it is where following belongs — and
  // the Circle stop's empty state points here by name.
  //
  // A follow is a bookmark, not a request: it takes effect immediately,
  // the followed account is not told, and it grants nothing D98 had not
  // already granted. That is why this is a one-tap toggle and not an
  // "add friend" with a pending state.
  const following = LIVE.isFollowing(voter.uid);
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0" }}>
      <span style={{
        fontFamily: "var(--sans)", fontSize: 13.5,
        fontWeight: voter.isMe ? 800 : 650,
        color: voter.name ? "var(--ink)" : "var(--ink-3)",
      }}>
        {voter.isMe ? "You" : (voter.name || "Someone")}
      </span>
      <LvChips anchors={voter.anchors} skip={skipChip} />
      {!voter.isMe && (
        <button
          onClick={() => void LIVE.setFollowing(voter.uid, !following)}
          aria-pressed={following}
          style={{
            marginLeft: "auto", border: LV_LINE, borderRadius: 999, padding: "3px 10px",
            cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11,
            WebkitAppearance: "none",
            background: following ? "var(--ink)" : "transparent",
            color: following ? "var(--surface)" : "var(--ink-2)",
          }}
        >{following ? "Following" : "Follow"}</button>
      )}
    </div>
  );
}

function LiveVotersPanel({ qid, options, dim = "", bucket = "", cohortLabel = "", uids }: {
  qid: string;
  options: string[];
  /**
   * Scope the list to one cohort (D125) — the breakdown above this panel
   * owns the choice, and the two must show the same people or the sheet
   * makes two claims about one population.
   *
   * Filtered on the ANSWER's frozen anchors, which is the same snapshot
   * the aggregate folded (D8). Reading the voter's current profile here
   * would silently re-cohort history and put a different set of names
   * under a number that did not move.
   */
  dim?: string;
  bucket?: string;
  /** The cohort's display name, for the copy. Keys are not sentences. */
  cohortLabel?: string;
  /**
   * Scope to an explicit set of uids instead of an anchor cell — the type
   * cut's way in (data/typeSplit.ts).
   *
   * A type is NOT an anchor: it is matched from the voter's current,
   * live profile scores rather than read off the answer's frozen
   * snapshot, so `dim`/`bucket` cannot express it and the caller has to
   * hand over the membership it computed. That difference is exactly why
   * the cut is retroactive where an anchor cut is not, and it is the
   * reason this prop exists rather than a `dim: "type"` pretending to be
   * one more column of the same table.
   *
   * Takes precedence over dim/bucket when both are given; the caller
   * sets one or the other, never both.
   */
  uids?: ReadonlySet<string>;
}) {
  // One fetch per question per session. The store holds the list and
  // de-dupes concurrent calls, so a re-render mid-flight costs nothing.
  // Scoping is applied to the list already in hand — switching cohorts
  // costs no reads.
  React.useEffect(() => { void LIVE.loadVoters(qid); }, [qid]);
  // The store notifies on completion; without this the panel would render
  // its loading state and never leave it.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);

  if (!LIVE.enabled || !qid) return null;

  const all = LIVE.votersByOption(qid, options.length);
  const byUid = !!uids;
  const scoped = byUid || !!(dim && bucket);
  const whom = cohortLabel || bucket;
  const cols = all && byUid
    ? all.map((col) => col.filter((v) => uids.has(v.uid)))
    : all && dim && bucket
      ? all.map((col) => col.filter((v) => v.anchors?.[dim] === bucket))
      : all;

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
        {scoped
          ? <>Nobody in {whom} is in the answers loaded here.</>
          : <>Nobody has answered this yet.</>}
      </div>
    );
  }

  // The fetch is bounded at VOTER_FETCH_CAP, newest first (D102). A full
  // page means there are (almost certainly) more, and the sheet must say
  // so — a truncated list presented as the whole room is the same small
  // lie the withheld cells used to tell, pointed the other way. The
  // aggregate's total names the room's real size when the store holds it;
  // rows.length === snap size here because a question's answers are all
  // option-shaped or all catalog-shaped, never mixed.
  //
  // Measured against the UNFILTERED page: the cap is a property of the
  // fetch, not of the cohort. A scope that happens to leave 12 names is
  // not a short list — it is 12 of the newest 200 — and the copy below
  // says which.
  const fetched = (all || []).reduce((n, c) => n + c.length, 0);
  const capped = fetched >= VOTER_FETCH_CAP;
  const roomN = capped ? LIVE.aggFor(qid)?.total : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        Who answered · {capped ? `the latest ${total}` : total}{scoped ? ` in ${whom}` : ""}
      </span>
      {capped && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: -8 }}>
          {typeof roomN === "number" && roomN > total
            ? `${roomN.toLocaleString()} have answered — these are the newest ${total}.`
            : `Showing the newest ${total} answers.`}
        </span>
      )}
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
          {voters.map((v) => <LvRow key={v.uid} voter={v} skipChip={scoped ? dim : ""} />)}
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

export default LiveVotersPanel;
