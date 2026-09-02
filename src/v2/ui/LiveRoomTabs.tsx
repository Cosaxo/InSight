// The Near stop's three tab bodies (D177): Answers · People · Compare.
//
// Every other Mirror stop folds its tabs on the device, out of the
// published aggregates every client already holds. This one cannot. Near's
// cohort is a set of PHONES, `v2_presence` is unreadable to every client,
// and so the fold happens on the server (`nearbyRoomV2`) and this module
// renders what comes back. That is the whole architectural difference, and
// it is why the loading and failure states here are load-bearing rather
// than polish: there is no local copy to fall back on.
//
// LAZY, and it has to be. NearLiveBody is a static import in mirror-tab
// (it is the Near body), so anything it pulls eagerly lands in the entry
// chunk — where check:bundle leaves roughly a dozen kilobytes. The tab row
// itself is static and instant; this arrives on the tap that asks for it,
// which is the same cost gate D119 put on the cohort stops' lenses.
//
// WHAT IS DELIBERATELY NOT HERE: Explore and Scores. Explore cuts a
// population by an anchor and ranks where the slice parts company with
// everyone — it needs `by` breakdowns, and the room has none (the server
// returns option counts, not cohort cells). Scores wants the bank's
// ordinal questions across the whole archive; the room is folded over
// today's deck. Both would be a tab that draws an empty state forever,
// which is worse than a tab that is not there.
import React from "react";
import LIVE from "../data/live";
// The Answers list, in the prototype's row design — the same component the
// City, Country and World stops use. Reused rather than re-implemented so
// the room cannot drift from them: D170's "counts are this stop's cohort"
// repair and its n=1 sentence live in one place.
import LiveAnswerRows from "./LiveAnswerRows";
// The face, since D178 — the same component every other named surface
// draws, with initials as its permanent fallback.
import Avatar from "./Avatar";
// Compare, likewise — the profile drawing since D193, where it was a list
// of questions before. The room passes the PEOPLE in it and the word "this
// room": the server's fold returns today's deck, never the test bank, so a
// cell fold has nothing here to read and the members' own completed
// instruments — public since D98, and already cached beside the names this
// tab resolves — are the room's side.
//
// Static rather than lazy, unlike the other three hosts': this module is
// itself the lazy chunk NearLiveBody fetches on a tab tap, so the drawing
// rides a fetch that has already happened.
import LiveCompareLens from "./LiveCompareLens";
import { ROOM_WHOM, roomQuestions, roomRows } from "./roomShape";
import {
  CORE_TEST_KINDS, flattenAxes, parseTestResults, scoreMatch,
} from "../data/similarity";
// The type's own glyph, the same one the who-voted sheet and the People
// lens draw — a badge on a person and a row in a population are one object
// (D156).
//
// TYPE_TEST comes with it because TypeMark takes `testKey` + `name`, never a
// `type` prop: the name alone does not say WHICH system named it, and the
// component resolves the signature out of that system's archetype table.
// Shipped here as `type={p.type}` and drew nothing for four days — the mark
// is `return null` on an unresolvable signature, so the row degraded to a
// missing glyph rather than an error, and the @ts-expect-error below is what
// kept tsc from saying so. Pinned in LiveRoomTabs.test.tsx.
// @ts-expect-error TS7016 — untyped spec module (the LiveSimilarityField pattern)
import { TypeMark } from "../spec/type-marks.jsx";
import { TYPE_TEST } from "../data/typeMix";

const RT_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

function RtNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
      color: "var(--ink-3)", lineHeight: 1.55, padding: "22px 6px",
      textAlign: "center", maxWidth: 340, margin: "0 auto",
    }}>
      {children}
    </div>
  );
}

/**
 * The two-step report on a face.
 *
 * Confirm-then-send, because a flag is permanent and a mis-tap in a list
 * of faces is easy. The reported face STAYS on screen afterwards — the
 * takes control makes the same choice: hiding it would tell the reporter
 * their report was upheld before anyone had looked at it.
 */
function ReportFace({ uid }: { uid: string }) {
  const [armed, setArmed] = React.useState(false);
  const done = LIVE.flaggedAvatar(uid);
  const label = done ? "Reported" : armed ? "Confirm" : "Report";
  return (
    <button type="button" className="press" disabled={done}
      aria-label={done ? "Photo reported" : `Report this photo${armed ? " — confirm" : ""}`}
      // The store rolls a refused report back and reports it; a rejection
      // reaching this `void` would surface as an unhandled one (D354's
      // gate made a failed sign-in a second way for it to reject).
      onClick={() => { if (armed) void LIVE.flagAvatar(uid).catch(() => {}); else setArmed(true); }}
      style={{
        border: RT_LINE, borderRadius: 999, padding: "4px 9px", flexShrink: 0,
        background: "transparent", cursor: done ? "default" : "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11,
        color: armed && !done ? "var(--ink)" : "var(--ink-3)",
        WebkitAppearance: "none", opacity: done ? 0.6 : 1,
      }}>{label}</button>
  );
}

/**
 * People — who is standing here.
 *
 * THE ONE TAB THAT DISCLOSES SOMETHING NEW, and the reason it is allowed
 * is not that the fields are harmless (they are public since D98) but that
 * the pairing with "here" is bounded four ways, all enforced server-side:
 * the radius is a venue, visibility is mutual, it is opt-in on both sides
 * and off by default, and it expires on its own. §10's sentence for this
 * is the test to hold it to — "a room you are standing in, not a directory
 * of strangers" — and the radius is what keeps it the first.
 *
 * NOBODY IS RANKED. The similarity field above this row places people by
 * likeness because that is a reading; a list of people you can see, sorted
 * best-match-first, is a leaderboard of strangers in a bar. Order is the
 * server's sample order, which is arbitrary, and that is the point.
 */
function RoomPeople({ people }: { people: Array<{ uid: string; type?: string }> }) {
  React.useEffect(() => {
    void LIVE.loadNames(people.map((p) => p.uid));
  }, [people]);

  const myFlat = flattenAxes(parseTestResults(LIVE.myTestResults(), CORE_TEST_KINDS) || {});
  const anyScores = Object.keys(myFlat).length > 0;

  if (!people.length) {
    return <RtNote>Nobody else has Near on here right now. It fills as people arrive with it turned on — they see you the same way, or not at all.</RtNote>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {people.map((p) => {
        const name = LIVE.nameFor(p.uid);
        const theirs = LIVE.scoresFor(p.uid);
        // Null unless BOTH sides have taken enough of the same tests —
        // and rendered as nothing rather than as 0%, which would read as
        // "nothing in common" instead of "not measured" (D72's rule: a
        // consumer that forgets the check should fail, not fabricate).
        const m = anyScores && theirs
          ? scoreMatch(myFlat, flattenAxes(theirs), 3) : null;
        return (
          <div key={p.uid} style={{
            display: "flex", alignItems: "center", gap: 11,
            padding: "10px 2px", borderBottom: RT_LINE,
          }}>
            <Avatar uid={p.uid} name={name} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: "block", fontFamily: "var(--sans)", fontSize: 13.5,
                fontWeight: 700, color: "var(--ink)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {/* An account with no display name is still a person in
                    the room — "Someone" rather than an empty row. */}
                {name || "Someone"}
              </span>
              {p.type ? (
                <span style={{
                  display: "flex", alignItems: "center", gap: 5, marginTop: 2,
                  fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)",
                }}>
                  <TypeMark testKey={TYPE_TEST} name={p.type} size={13} />
                  {p.type}
                </span>
              ) : null}
            </span>
            {m ? (
              <span style={{
                fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 800,
                color: "var(--ink-2)", fontVariantNumeric: "tabular-nums",
              }}>{m.match}%</span>
            ) : null}
            {/* THE REPORT CONTROL, and it only exists where a face does
                (D178). The owner's call was a photo live from the moment
                it is set with the report loop behind it — which is only a
                loop if the people who can see the face can use it, and
                this tab is where a stranger sees one.

                Two-step like the takes control and for the same reason: a
                flag cannot be undone. No reason picker, because the flag
                document has no field for one and the run picks its own
                policy line. */}
            {LIVE.faceFor(p.uid) ? <ReportFace uid={p.uid} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The three bodies, behind one lazy chunk.
 *
 * The fold itself runs HERE rather than in the host, on mount, so it is
 * charged to the tap that opened a tab — the host's row is static and
 * costs nothing to look at.
 */
export default function LiveRoomTabs({ tab }: { tab: string }) {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);

  const deck = LIVE.deck();
  const qids = React.useMemo(() => deck.map((q) => q.id).join(","), [deck]);
  // …AND THE BEAT, not the deck alone. The room is per CELL, and the cell
  // changes underneath this component while it stays mounted — `loadRoom`'s
  // own docstring says "walking into the next cell re-folds", and with the
  // deck as the only dep nothing ever re-ran, so the tabs kept naming the
  // people from the block you left. The same dep is what makes the failure
  // note below true: a failed fold clears the cached cell, so the next
  // settled count really does retry it.
  //
  // Cheap on every other beat: `loadRoom` returns at once when the cell it
  // holds is the current one and the deck's questions are already folded —
  // no call, no notify. `updatedAt` is stamped on each settled beat, one
  // line before the cell it belongs to.
  const beat = LIVE.near.updatedAt();
  React.useEffect(() => {
    void LIVE.near.loadRoom(qids ? qids.split(",") : []);
  }, [qids, beat]);

  const room = LIVE.near.room();
  const loading = LIVE.near.roomLoading();

  // THREE STATES, KEPT APART, which is the same discipline LiveCircleBody
  // carries and for a sharper reason here: null means the fold has not
  // settled or it failed, and drawing "nobody is here" for a failed read
  // would tell somebody at a full party that they are alone.
  if (!room) {
    return <RtNote>{loading ? "Reading the room…" : "Couldn’t read the room — it retries on the next count."}</RtNote>;
  }

  const qs = roomQuestions(deck, room.qs, LIVE.myVotes());

  if (tab === "people") return <RoomPeople people={room.people} />;
  if (tab === "compare") {
    return (
      <LiveCompareLens
        pop={{ basis: "people", uids: room.people.map((p) => p.uid) }}
        whom={ROOM_WHOM}
        emptyThem={<>Nobody here has finished a test yet.</>}
      />
    );
  }
  return (
    <LiveAnswerRows
      rows={roomRows(qs)}
      whom={ROOM_WHOM}
      emptyNote={<>Nobody here has answered today yet.</>}
    />
  );
}
