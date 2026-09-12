// LivePickBreakdown — who picked what, on a catalogue board (D14's cards,
// D125's reading). The sheet LiveBreakdownPanel is for every question
// whose answer is an option, expressed for the one kind whose answer is an
// entity.
//
// WHAT THIS REPLACES, AND WHY IT WAS THE OLD MODEL.
//
// Every other live question in the app answers "who voted what" the way
// D125 settled it: you pick a cohort, and everything below becomes THAT
// COHORT'S reading of this one question — the same board in the same
// order, with their numbers, and a line naming where they part company
// with everyone. Under it, since D98, the one cut whose answer is people:
// your friends, by name, with what each of them said.
//
// A catalogue card had none of that. It had the D17 SEGMENT CHIPS: one
// flat row holding every published bucket of every dimension at once —
// "man", "190 cm or taller", "vocational or trade", "no", "asker, no",
// "partnered", "25-34" — each of which silently reordered the board, with
// no dimension named, no scale to read a bucket against, no way to tell
// which chip was an age and which a height, and no names anywhere. The
// raw storage keys went to the reader ("no" is a relationship bucket;
// "asker, no" is another dim's), and the caption under the board said
// things like "the crowd's board, as 2 no answers order it".
//
// That was the pre-D125 shape surviving on one card type, and it was
// reported as exactly that: the catalogue still has the old system for
// showing who voted what. So the chips go and this arrives — the same two
// levels (dim, then bucket), the same whole-scale rows (D304: a band
// nobody answered from is a zero, not an absence), the same friends cut,
// the same chrome (LbChip/LbNote are imported from the sheet this is the
// twin of, so the two cannot drift into two chip styles).
//
// WHAT IT COSTS. Nothing the card has not already paid: the cohorts are
// folds over `v2_question_aggs.by`, which is the same document the board
// itself is drawn from (pickCohort.ts). Only the Friends cut fetches, on
// the tap that asks for it, through the bounded voter query every other
// sheet uses.
import React from "react";
import LIVE from "../data/live";
import { BUDGET_PAUSED_BODY } from "../data/budgetMode";
import { VOTER_FETCH_CAP, type Voter } from "../data/voters";
import { bucketLabel } from "../data/cohortLabels";
import { COHORT_DIMS, DIM_LABEL, VOCAB_TAIL, byOf, type ByMap } from "../data/cohort";
import { DIM_VOCAB } from "./cohortVocab";
import { LbChip, LbNote } from "./LiveBreakdownPanel";
import {
  pickMix, pickRank, pickTilt, pickVocabMix,
  type PickCell, type PickRow,
} from "../data/pickCohort";

const LP_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

/** The Friends cut's key — not a published dim, so it cannot collide. */
const FRIENDS = "friends";

/** A name for an entity, and the fallback for one the catalogue has not
 *  loaded yet. The card owns the resolution (it holds the domain's store);
 *  this only ever draws what it is handed. */
export type NameOf = (entity: number) => string;

const nameFor = (nameOf: NameOf, entity: number): string => nameOf(entity) || "…";

/** What a voter row answered with — the catalogue key on a pick, and the
 *  option index on anything else (voters.ts). Spelled at its callers
 *  rather than exported from there: that module is in the first-paint
 *  graph and this one is not. */
const answerOf = (v: Voter): number => v.entity ?? v.optionIdx;

/**
 * One board, drawn the way the card draws its own: rank, name, count, a
 * fill against the biggest row, your pick marked.
 *
 * The same shape deliberately — switching cohorts should read as the
 * card's own board moving, not as a second visual language for the same
 * numbers (LbOptionRows' reason, one question type over).
 */
function PickBoard({ rows, mine, nameOf }: {
  rows: readonly PickRow[]; mine: number; nameOf: NameOf;
}) {
  const peak = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r, i) => {
        const isMine = r.entity === mine;
        return (
          <div key={r.entity} style={{
            position: "relative", overflow: "hidden", borderRadius: 11,
            border: isMine ? "1.5px solid color-mix(in oklch, var(--accent, var(--ink)) 55%, var(--rule))" : LP_LINE,
            background: "var(--surface)",
          }}>
            <span aria-hidden="true" style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${Math.round((r.count / peak) * 100)}%`,
              background: "color-mix(in oklch, var(--accent, var(--ink)) 16%, var(--surface))",
            }}></span>
            <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 8, padding: "9px 12px" }}>
              <span style={{
                width: 16, flexShrink: 0, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 11.5,
                color: "var(--ink-3)", fontVariantNumeric: "tabular-nums",
              }}>{i + 1}</span>
              <span style={{
                flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontWeight: i === 0 ? 800 : 650,
                fontSize: 13.5, color: "var(--ink)", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{nameFor(nameOf, r.entity)}</span>
              {isMine && (
                <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                  · you
                </span>
              )}
              {/* Counts, never shares. A cohort of five reading "20%" moves
                  twenty points when one person changes their mind, and on a
                  board of a thousand entities the share of any one of them
                  is noise dressed as precision. */}
              <span style={{
                fontFamily: "var(--sans)", fontWeight: i === 0 ? 800 : 650, fontSize: 12.5,
                color: i === 0 ? "var(--ink)" : "var(--ink-3)", fontVariantNumeric: "tabular-nums",
              }}>{r.count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The line under a cohort's board: what they put first, and where everyone
 * puts it.
 *
 * The catalogue's own divergence (pickCohort.ts's header has why a
 * per-entity points gap is not one). Silent when the cohort leads with
 * everyone's leader — "Women also say Ditto" is the room again, not a
 * reading of it.
 */
function PickTiltLine({ cell, overall, nameOf, label }: {
  cell: PickCell; overall: readonly PickRow[]; nameOf: NameOf; label: string;
}) {
  const tilt = pickTilt(cell, overall);
  const lead = cell.rows[0];
  return (
    <LbNote>
      {tilt
        ? <>{label} put <strong style={{ color: "var(--ink-2)" }}>{nameFor(nameOf, tilt.entity)}</strong> first
          {tilt.rank ? <> — #{tilt.rank} for everyone.</> : <>, and nobody else has it on the board.</>}</>
        : lead
          ? <>{label} lead with <strong style={{ color: "var(--ink-2)" }}>{nameFor(nameOf, lead.entity)}</strong>, the same as everyone.</>
          : <>Nobody has picked from here yet.</>}
    </LbNote>
  );
}

/**
 * The one cut that answers with people (D98).
 *
 * LbFriends' twin, and the reason this file exists at all: catalogue
 * answers were dropped from the voter list until 2026-09-11, so this cut
 * could not be drawn for a pick question however the sheet was arranged.
 */
function PickFriends({ qid, mine, nameOf }: { qid: string; mine: number; nameOf: NameOf }) {
  React.useEffect(() => { void LIVE.loadFollows(); }, []);
  React.useEffect(() => { void LIVE.loadVoters(qid); }, [qid]);

  const follows = LIVE.follows();
  const voters = LIVE.voters(qid);
  const loading = LIVE.followsLoading() || LIVE.votersLoading(qid);

  if (!follows || !voters) {
    // Paused before failed (D332): with the breaker on the fetch was
    // refused rather than attempted, and "could not load" would blame the
    // network for a choice.
    return (
      <LbNote>
        {loading
          ? "Loading what your friends picked…"
          : LIVE.budgetPaused
            ? BUDGET_PAUSED_BODY
            : "Could not load what your friends picked."}
      </LbNote>
    );
  }
  if (!follows.length) {
    return <LbNote>Follow someone from the Mirror and their picks show up here.</LbNote>;
  }

  const set = new Set(follows);
  const rows = voters
    .filter((v) => set.has(v.uid) && typeof v.entity === "number")
    // Your own pick first, so "who agrees with me" is the top of the list
    // rather than something to scan for; then by entity, then by name, so
    // the order is stable between opens.
    .sort((a, b) => {
      if (mine >= 0) {
        const am = answerOf(a) === mine ? 0 : 1;
        const bm = answerOf(b) === mine ? 0 : 1;
        if (am !== bm) return am - bm;
      }
      return answerOf(a) - answerOf(b)
        || (a.name || "￿").localeCompare(b.name || "￿")
        || a.uid.localeCompare(b.uid);
    });

  if (!rows.length) {
    // "In what this session read", not "at all" — `voters` is the newest
    // VOTER_FETCH_CAP answers, and a census claim over a truncated sample
    // is the one thing these cuts are careful not to make.
    return (
      <LbNote>
        None of the people you follow is in the {voters.length.toLocaleString()}
        {" "}answers this session has read.
      </LbNote>
    );
  }

  const same = mine >= 0 ? rows.filter((v) => answerOf(v) === mine).length : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: "var(--ink)", color: "var(--surface)", borderRadius: 14,
        padding: "13px 15px", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15,
      }}>
        {mine >= 0
          ? `${same} of ${rows.length} ${rows.length === 1 ? "friend" : "friends"} picked yours`
          : `What your ${rows.length === 1 ? "friend" : "friends"} picked`}
      </div>
      <LbNote>Of the {voters.length.toLocaleString()} answers this session has read.</LbNote>
      {rows.map((v) => (
        <div key={v.uid} style={{
          background: "var(--surface-2)", border: LP_LINE, borderRadius: 14,
          padding: "9px 11px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span aria-hidden="true" style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "color-mix(in oklch, var(--accent, var(--ink)) 55%, var(--surface))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, color: "#fff",
          }}>{(v.name || "?").trim().slice(0, 1).toUpperCase() || "?"}</span>
          {/* "Someone" is the absence of a name, not a pseudonym (D1). */}
          <span style={{
            flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 14,
            color: v.name ? "var(--ink)" : "var(--ink-3)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{v.name || "Someone"}</span>
          <span style={{
            background: "color-mix(in oklch, var(--accent, var(--ink)) 14%, var(--surface))",
            border: LP_LINE, color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 11,
            fontWeight: 800, padding: "4px 10px", borderRadius: 999, flexShrink: 0,
            maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{nameFor(nameOf, answerOf(v))}</span>
        </div>
      ))}
      {voters.length >= VOTER_FETCH_CAP && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)" }}>
          Read from the newest {VOTER_FETCH_CAP} answers — an older pick
          from a friend may not be here yet.
        </span>
      )}
    </div>
  );
}

function LivePickBreakdown({ qid, mine = -1, nameOf, openAt }: {
  qid: string;
  /** The viewer's own catalogue key, or -1. */
  mine?: number;
  nameOf: NameOf;
  /** The cut the card's own finding opened this at (dim + bucket). */
  openAt?: { dim: string; bucket: string } | null;
}) {
  const [dim, setDim] = React.useState(openAt?.dim || "");
  const [bucket, setBucket] = React.useState(openAt?.bucket || "");
  // The store notifies when an aggregate lands; without this the sheet
  // would keep whatever board it was opened with.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);

  if (!LIVE.enabled || !qid) return null;

  const friendsOpen = dim === FRIENDS;
  const agg = LIVE.aggFor(qid);
  const by: ByMap | undefined = byOf(agg);
  // The card's own board, unfolded pick included — so the sheet and the
  // card behind it can never disagree about who is winning.
  const canon = LIVE.pickCanon(qid);
  const overall: PickRow[] = canon.top;

  // Closed vocabularies are always offered (D304): their rows are the
  // whole scale, and a band nobody has answered from is a zero rather than
  // a gap. Open ones (city, country) need a published cell — there is no
  // canonical list of every city to draw at zero.
  const publishedDims = COHORT_DIMS.filter((d) => by?.[d] && Object.keys(by[d]).length);
  const dims = COHORT_DIMS.filter((d) => DIM_VOCAB[d] || publishedDims.includes(d));
  const openDim = friendsOpen ? "" : (dims.includes(dim as (typeof COHORT_DIMS)[number]) ? dim : "");

  const vocab = openDim ? DIM_VOCAB[openDim] : undefined;
  const cells: PickCell[] = openDim
    ? (vocab ? pickVocabMix(by, openDim, vocab, VOCAB_TAIL) : pickMix(by, openDim))
    : [];
  // Nothing is pre-expanded on a dim's rows: the scale itself is the
  // landing, and a cohort with no answers cannot open — there is no
  // reading inside it. A cut arrived at through the card's finding is the
  // exception, and it is the whole point of that door.
  const openBucket = cells.some((c) => c.bucket === bucket && c.n > 0) ? bucket : "";
  const openCell = cells.find((c) => c.bucket === openBucket) || null;

  // The viewer's own bucket, so their cohort is findable in a long row
  // without reading every label. Off the store's live anchors rather than
  // off their answer — this marks who the READER is, while every number on
  // screen comes from the frozen snapshots (D8).
  const myAnchors = LIVE.anchors();

  if (!canon.total) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <LbChip on={!friendsOpen} onTap={() => setDim("")}>Everyone</LbChip>
          <LbChip on={friendsOpen} onTap={() => setDim(FRIENDS)}>Friends</LbChip>
        </div>
        {friendsOpen
          ? <PickFriends qid={qid} mine={mine} nameOf={nameOf} />
          : <LbNote>{mine >= 0 ? "Just you so far." : "Nobody has picked yet."}</LbNote>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {/* WHO, then WHAT — the same two-level order the Mirror's stops and
          the option sheet both use. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <LbChip on={friendsOpen} onTap={() => { setDim(FRIENDS); setBucket(""); }}>Friends</LbChip>
        <LbChip on={!openDim && !friendsOpen} onTap={() => { setDim(""); setBucket(""); }}>Everyone</LbChip>
        {dims.map((d) => (
          <LbChip key={d} on={openDim === d} onTap={() => { setDim(d); setBucket(""); }}>
            {DIM_LABEL[d] || d}
          </LbChip>
        ))}
      </div>

      {friendsOpen && <PickFriends qid={qid} mine={mine} nameOf={nameOf} />}

      {!friendsOpen && !openDim && (
        <>
          <div style={{
            background: "var(--ink)", color: "var(--surface)", borderRadius: 14,
            padding: "13px 15px", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15,
          }}>
            {canon.total.toLocaleString()} {canon.total === 1 ? "pick" : "picks"}
            {mine >= 0 ? <> · yours is #{pickRank(overall, mine) || "—"}</> : null}
          </div>
          <PickBoard rows={overall} mine={mine} nameOf={nameOf} />
        </>
      )}

      {/* The dim's whole scale, one row per cohort, each opening into that
          cohort's own board. The leader's name rides the closed row, so the
          column reads as "where taste divides" before anything is tapped —
          which is the reading the segment chips could not give at all. */}
      {!friendsOpen && !!openDim && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {cells.map((c) => {
            const isOpen = c.bucket === openBucket;
            const label = bucketLabel(openDim, c.bucket);
            const lead = c.rows[0];
            const you = myAnchors[openDim] === c.bucket;
            return (
              <div key={c.bucket} style={{ border: LP_LINE, borderRadius: 11, background: "var(--surface)", overflow: "hidden" }}>
                <button
                  onClick={() => setBucket(isOpen ? "" : c.bucket)}
                  aria-expanded={isOpen}
                  disabled={!c.n}
                  style={{
                    width: "100%", border: "none", background: "none", padding: "9px 12px",
                    display: "flex", alignItems: "baseline", gap: 8, textAlign: "left",
                    cursor: c.n ? "pointer" : "default", WebkitAppearance: "none",
                  }}
                >
                  <span style={{
                    fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13,
                    color: c.n ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap",
                  }}>{label}{you ? " · you" : ""}</span>
                  <span style={{
                    flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontWeight: 650, fontSize: 13,
                    color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{lead ? nameFor(nameOf, lead.entity) : ""}</span>
                  {/* A zero is a fact, not a gap (D98) — so an empty band
                      says nought rather than going missing. */}
                  <span style={{
                    fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12,
                    color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0,
                  }}>{c.n}</span>
                </button>
                {isOpen && openCell && (
                  <div style={{ padding: "0 12px 11px", display: "flex", flexDirection: "column", gap: 9 }}>
                    <PickBoard rows={openCell.rows} mine={mine} nameOf={nameOf} />
                    <PickTiltLine cell={openCell} overall={overall} nameOf={nameOf} label={label} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LivePickBreakdown;
export { PickBoard, PickFriends };
