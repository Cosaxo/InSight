// LiveBreakdownPanel — the who-voted sheet, the right way round (D125).
//
// WHAT THIS REPLACES, AND WHY IT WAS BACKWARDS.
//
// The sheet used to answer a question nobody asked. It laid the CROWD out
// as rows — one stacked bar per cohort, six cohorts deep — and under that
// it listed every voter with their age, gender, city and education beside
// their name. Both halves read the same way: here are the people, here is
// what each of them is. What a reader actually wants from a result is the
// opposite direction — *what does the answer look like from where someone
// else is standing* — and neither half would tell them, because the split
// was never redrawn for anyone; it was only ever annotated with who was in
// it.
//
// So the axis flips. You pick a cohort, and everything below it becomes
// that cohort's reading of this one question: the same options in the same
// order the card showed them, with that cohort's numbers, and one line
// naming where they part company with everyone. The roster stays — D98
// exists so a stranger can become a person — but it is now the tail of an
// answer rather than the answer, and it is scoped to the cohort above it,
// so "41% here said Wellington" and the names under it are the same forty
// one people.
//
// "Everyone" is the default and is a real cohort, not an off switch: it is
// the plain published split, which is what the card already showed. That
// makes the first frame identical to today's and every other frame a
// comparison against it.
//
// WHAT IT DOES NOT DO. It reads only documents the app already has —
// `v2_question_aggs/{qid}`, fetched for the card itself — so switching
// cohorts is arithmetic on data in hand and costs no reads at all. The
// Friends cut underneath keeps its own single fetch-on-open, bounded.
//
// TWO CHANGES AT D149, AND THEY ARE ONE CHANGE.
//
// The sheet had a roster of NAMES under every cohort — "Everyone" and, at
// D146, "Type" included — with each person's age, gender, city and
// education printed beside them. Read from the top that is a directory of
// strangers annotated with their demographics, which is not what anyone
// opened a result to see, and on the Everyone cut it is a directory of
// everybody who has ever answered. So the names move to where a name is
// the point: your FRIENDS, the one cut where "who" is the question.
// Everywhere else the sheet answers with percentages, which is what a
// cohort reading is — and a type cut is a cohort reading like any other,
// so it lost its roster with the rest rather than keeping one by being
// newer.
//
// This does not retire D98's cross-user read — it is what the Friends cut
// and D146's type fold are both built on, and the Mirror's People,
// Compare and constellation surfaces still name people. It retires the
// roster as the answer to "how did everyone vote".
//
// THE ROWS CAME BACK AT D304, ON TOP OF D125 RATHER THAN INSTEAD OF IT.
// A dim now lands on its whole scale at once — every canonical bucket in
// vocabulary order, zeros drawn, the published split as the header bar —
// because the cohort-first sheet at a young population showed two chips
// in popularity order and nothing else: the reader could not see the
// scale their cohort sits on, and cohorts nobody had answered from were
// indistinguishable from cohorts that do not exist. The D125 reading
// survives one tap in: a row expands into exactly the cohort body this
// file has drawn since D125 — option rows, then the divergence line —
// scoped to that row. Continuum forms (renderBody) keep the chip flow:
// a dial's track has nothing honest to draw over a scale of zeros.
import React from "react";
import LIVE from "../data/live";
import { VOTER_FETCH_CAP } from "../data/voters";
import { bucketLabel } from "./cohortLabels";
import {
  COHORT_DIMS, DIM_LABEL, cellFor, divergenceFor, meanScore, mixFor, pctFor, byOf, vocabMix,
  type ByMap, type Bucket,
} from "../data/cohort";
import { DIM_VOCAB } from "./cohortVocab";
import RatingRidge from "./RatingRidge";
import { typeDivergence, typeSplitFor, type TypeSplitRow } from "../data/typeSplit";
import { logicDivergence, logicSplitFor, type LogicSplitRow } from "../data/logicSplit";
import { parseLogicPct } from "../data/similarity";
import { myType } from "../data/typeMix";
// The app's one option-colour function, so a friend's side chip wears the
// same hue the takes list gives that side.
// @ts-expect-error TS7016 — untyped spec module (the LiveSimilarityField pattern)
import { WPAL } from "../spec/world-palette.js";

const LB_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

function sideFill(i: number, n: number): string {
  return WPAL.opt("var(--accent)", i, n, true) as string;
}

/** The Friends cut's key — not a published dim, so it cannot collide. */
const FRIENDS = "friends";

// The type cut's sentinel, kept out of COHORT_DIMS on purpose.
//
// Every other value `dim` can take names a published breakdown cell —
// exact, folded server-side from the frozen anchors snapshot. This one
// names a fold the CLIENT runs over the session's voter cache, and the
// two are different kinds of number (a census against a bounded sample).
// A key that could be mistaken for a dim is how they would end up sharing
// a code path and then a caption.
const TYPE_PICK = "__type";

// The Logic cut's sentinel (D227) — the type cut's twin: a client fold
// over the session's bounded voter sample, kept out of COHORT_DIMS for
// the same census-vs-sample reason. The fold and its bands live in
// data/logicSplit.ts; this file only picks and draws.
const LOGIC_PICK = "__logic";

/** The cohort a body is being drawn for. `dim` empty means everyone. */
export interface CohortPick {
  dim: string;
  bucket: string;
  /** Display name for the cohort — "Everyone", "25-34", "Oslo". */
  label: string;
  /** Answers behind it. */
  n: number;
}

function LbChip({ on, onTap, children }: {
  on: boolean; onTap: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onTap}
      aria-pressed={on}
      style={{
        border: LB_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, WebkitAppearance: "none",
        background: on ? "var(--ink)" : "var(--surface)",
        color: on ? "var(--surface)" : "var(--ink-2)",
        whiteSpace: "nowrap",
      }}
    >{children}</button>
  );
}

function LbNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "6px 2px" }}>
      {children}
    </div>
  );
}

// The default body: the question's own options, in the question's own
// order, carrying this cohort's numbers.
//
// Deliberately the SAME shape the card's result uses — label left, fill
// behind it, share right, your pick marked. A sheet that redrew the result
// in a second visual language would make the comparison a translation
// exercise; this way switching cohorts reads as the card's own bars moving.
function LbOptionRows({ options, counts, mine, mode = "pct" }: {
  options: string[]; counts: number[]; mine: number;
  /**
   * `count` draws the same rows with raw counts and a fill scaled to the
   * biggest column rather than to 100.
   *
   * For the type cut under its floor (data/typeSplit.ts). A percentage
   * off nine people is a number that moves eleven points when one person
   * changes their mind, and a fill drawn as a share of 100 makes the same
   * claim visually even if the label says "3" — so both move together or
   * the row still lies. What is left is a magnitude comparison, which is
   * what a small cohort can honestly support.
   */
  mode?: "pct" | "count";
}) {
  const pct = pctFor(counts);
  const top = counts.reduce((t, v, i) => (v > counts[t] ? i : t), 0);
  const peak = Math.max(1, ...counts);
  const fill = (i: number) => (mode === "pct" ? pct[i] : Math.round((counts[i] / peak) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((label, i) => (
        <div key={i} style={{
          position: "relative", overflow: "hidden", borderRadius: 11,
          border: i === mine ? "1.5px solid color-mix(in oklch, var(--accent, var(--ink)) 55%, var(--rule))" : LB_LINE,
          background: "var(--surface)",
        }}>
          <span aria-hidden="true" style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill(i)}%`,
            background: "color-mix(in oklch, var(--accent, var(--ink)) 16%, var(--surface))",
          }}></span>
          <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 8, padding: "9px 12px" }}>
            <span style={{
              flex: 1, minWidth: 0, fontFamily: "var(--sans)",
              fontWeight: i === top ? 800 : 650, fontSize: 13.5, color: "var(--ink)",
            }}>{label}</span>
            {i === mine && (
              <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                · you
              </span>
            )}
            {/* Every option carries its number, not just the winner: the
                point of the cohort switch is watching the whole shape
                change, and a single headline share hides that. */}
            <span style={{
              fontFamily: "var(--sans)", fontWeight: i === top ? 800 : 650, fontSize: 12.5,
              color: i === top ? "var(--ink)" : "var(--ink-3)", fontVariantNumeric: "tabular-nums",
            }}>{mode === "pct" ? `${pct[i]}%` : counts[i]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── a rating's body: the average and the spread (D305) ───────────────
//
// A ten-step rating drawn as LbOptionRows is ten rows of noise — the
// reading of an ordinal scale is a POSITION plus a spread, which is one
// figure. Same ridge the Map's card draws for the same number, and the
// same mean `meanScore` gives the Scores lens, so no two surfaces can
// disagree about what a cohort averages.
function LbRatingBody({ counts, mine }: { counts: number[]; mine: number }) {
  const s = meanScore(counts);
  if (!s) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, fontFamily: "var(--sans)" }}>
        <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {s.mean.toFixed(1)}
        </span>
        <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ink-3)" }}>/ {s.max} average</span>
        {mine >= 0 && (
          <span style={{ marginLeft: "auto", fontWeight: 600, fontSize: 12, color: "var(--ink-2)" }}>
            you said {mine + 1}
          </span>
        )}
      </div>
      <RatingRidge counts={counts} mine={mine} />
    </div>
  );
}

// ── the all-rows overview (D304) ─────────────────────────────────────
//
// A dim opens onto its whole scale at once: the published split as an
// "Everyone" header bar, then one stacked bar per canonical bucket, in
// vocabulary order, zeros included. This is the shape D125 replaced — and
// D304 brings it back as the dim's LANDING rather than instead of the
// cohort reading: tapping a row expands that cohort's own option rows and
// divergence line in place, so "what does the answer look like from where
// they stand" stays one tap away while the scale reads whole.
//
// A zero bucket is drawn greyed, with its 0, as a fact (D98: absent is
// zero, never withheld) — except the opt-outs, which vocabMix keeps only
// once somebody has picked them. The thin vertical seam on each row marks
// where EVERYONE landed on the first option, so a row's lean reads
// against the crowd without a glance back up.
function LbCohortRows({ dim, buckets, options, overall, myBucket, openBucket, onRow, renderDetail, kind }: {
  dim: string;
  buckets: Bucket[];
  options: string[];
  overall: number[];
  /** The viewer's own bucket key in this dim, or "". */
  myBucket: string;
  /** The expanded row's bucket key, or "". */
  openBucket: string;
  onRow: (bucket: string) => void;
  renderDetail: (b: Bucket) => React.ReactNode;
  /** The question's bank type — a rating's rows read as averages (D305). */
  kind?: string;
}) {
  const overallPct = pctFor(overall);
  // A rating's row is a POSITION, not a split: ten stacked segments per
  // row are stripes about nothing, so each bar fills to the cohort's
  // AVERAGE and prints it, and the seam marks everyone's (D305).
  const rating = kind === "rating";
  const overallMean = rating ? meanScore(overall) : null;
  const seamPct = rating
    ? (overallMean ? (overallMean.mean / overallMean.max) * 100 : 0)
    : (overallPct[0] || 0);
  const many = buckets.length > 6;
  const barH = many ? 20 : 26;
  const radius = many ? 5 : 7;
  const GRID: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "92px 1fr", gap: 10, alignItems: "center",
  };
  const rowLabel = (label: string, you: boolean, empty: boolean) => (
    <span style={{
      fontFamily: "var(--sans)", fontWeight: 800, fontSize: many ? 11.5 : 12,
      minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      color: empty ? "var(--ink-3)" : you ? "var(--ink)" : "var(--ink-2)",
    }}>{label}</span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: many ? 6 : 8 }}>
      <div style={{ ...GRID, alignItems: "end" }}>
        <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11.5, color: "var(--ink-3)" }}>Everyone</span>
        {rating ? (
          <span style={{ position: "relative", display: "block", height: 30, borderRadius: 8, overflow: "hidden", border: LB_LINE, background: "var(--surface)" }}>
            <span aria-hidden="true" style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: `${seamPct}%`,
              background: "color-mix(in oklch, var(--accent, var(--ink)) 30%, var(--surface))",
            }}></span>
            <span style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 9px",
              fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 800, color: "var(--ink)",
              fontVariantNumeric: "tabular-nums",
            }}>{overallMean ? `${overallMean.mean.toFixed(1)} / ${overallMean.max}` : ""}</span>
          </span>
        ) : (
          <span style={{ display: "flex", height: 30, borderRadius: 8, overflow: "hidden" }}>
            {overallPct.map((p, oi) => (
              <span key={oi} style={{
                width: `${p}%`, boxSizing: "border-box", background: sideFill(oi, options.length),
                display: "flex", alignItems: "center",
                justifyContent: oi === overallPct.length - 1 ? "flex-end" : "flex-start",
                padding: "0 9px", color: "#fff", fontFamily: "var(--sans)",
                fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden",
              }}>{p >= 24 ? options[oi] : ""}</span>
            ))}
          </span>
        )}
      </div>
      {buckets.map((b) => {
        const label = bucketLabel(dim, b.bucket);
        const you = b.bucket === myBucket;
        // The 0 is printed rather than the row dropped: an exact zero is
        // the fact D98 bought, and a scale with silent gaps is the
        // "unorderly" sheet this view replaces. Not a button — there is
        // no cohort reading to open.
        if (!b.n) {
          return (
            <div key={b.bucket} style={GRID}>
              {rowLabel(label, false, true)}
              <span style={{
                height: barH, borderRadius: radius, border: LB_LINE,
                background: "var(--surface)", opacity: 0.6, display: "flex",
                alignItems: "center", padding: "0 9px",
                fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700,
                color: "var(--ink-3)", fontVariantNumeric: "tabular-nums",
              }}>0</span>
            </div>
          );
        }
        const open = openBucket === b.bucket;
        const pct = pctFor(b.counts);
        const rowMean = rating ? meanScore(b.counts) : null;
        return (
          <React.Fragment key={b.bucket}>
            <button
              onClick={() => onRow(open ? "" : b.bucket)}
              aria-expanded={open}
              aria-label={`${label} · ${b.n}${you ? " · you" : ""}`}
              style={{
                ...GRID, width: "100%", padding: 0, border: "none", background: "none",
                cursor: "pointer", WebkitAppearance: "none", textAlign: "left",
              }}
            >
              {rowLabel(label, you, false)}
              <span style={{
                position: "relative", display: "flex", height: barH, borderRadius: radius,
                overflow: "visible", boxShadow: you ? "0 0 0 1.5px var(--ink)" : "none",
              }}>
                {rating ? (
                  <span style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", border: LB_LINE, background: "var(--surface)" }}>
                    <span aria-hidden="true" style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${rowMean ? (rowMean.mean / rowMean.max) * 100 : 0}%`,
                      background: "color-mix(in oklch, var(--accent, var(--ink)) 30%, var(--surface))",
                    }}></span>
                    <span style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 8px",
                      fontFamily: "var(--sans)", fontSize: many ? 10.5 : 11, fontWeight: 800,
                      color: "var(--ink)", fontVariantNumeric: "tabular-nums",
                    }}>{rowMean ? rowMean.mean.toFixed(1) : ""}</span>
                  </span>
                ) : (
                  <span style={{ position: "absolute", inset: 0, display: "flex", borderRadius: radius, overflow: "hidden" }}>
                    {pct.map((p, oi) => (
                      <span key={oi} style={{ width: `${p}%`, background: sideFill(oi, options.length) }}></span>
                    ))}
                  </span>
                )}
                <span aria-hidden="true" style={{
                  position: "absolute", top: -3, bottom: -3, left: `${seamPct}%`,
                  width: 1.5, borderRadius: 1, background: "var(--ink)", opacity: 0.55,
                }}></span>
              </span>
            </button>
            {open && (
              <div role="region" aria-label={`${label} split`} style={{
                margin: "0 0 4px", padding: "8px 0 8px 12px",
                borderLeft: "2px solid var(--rule)",
                display: "flex", flexDirection: "column", gap: 9,
              }}>
                {renderDetail(b)}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── the Friends cut ──────────────────────────────────────────────────
//
// The one cut that answers with people. Both halves are reads the app
// already makes: the follow list is one query (LIVE.loadFollows — the SET,
// not the Circle stop's per-member fold) and the sides come off the voter
// list D146's type fold loads anyway. So a friend's answer costs nothing
// beyond the membership test.
//
// Friends who have NOT answered are not listed. A row saying nothing is
// not a reading, and the headline counts only the ones who did — "4 of 6"
// means four of the six who answered, which is the only version of that
// sentence this data can support.
function LbFriends({ qid, options, mine }: {
  qid: string; options: string[]; mine: number;
}) {
  React.useEffect(() => { void LIVE.loadFollows(); }, []);
  React.useEffect(() => { void LIVE.loadVoters(qid); }, [qid]);

  const follows = LIVE.follows();
  const voters = LIVE.voters(qid);
  const loading = LIVE.followsLoading() || LIVE.votersLoading(qid);

  if (!follows || !voters) {
    return (
      <LbNote>
        {loading
          ? "Loading how your friends answered…"
          : "Could not load how your friends answered."}
      </LbNote>
    );
  }
  if (!follows.length) {
    return (
      <LbNote>
        Follow someone from the Mirror and their answers show up here.
      </LbNote>
    );
  }

  const set = new Set(follows);
  const rows = voters
    .filter((v) => set.has(v.uid) && v.optionIdx >= 0 && v.optionIdx < options.length)
    // Your side first, so "who agrees with me" is the top of the list
    // rather than something to scan for; then by option, then by name so
    // the order is stable between opens.
    .sort((a, b) => {
      if (mine >= 0) {
        const am = a.optionIdx === mine ? 0 : 1;
        const bm = b.optionIdx === mine ? 0 : 1;
        if (am !== bm) return am - bm;
      }
      return a.optionIdx - b.optionIdx
        || (a.name || "￿").localeCompare(b.name || "￿")
        || a.uid.localeCompare(b.uid);
    });

  if (!rows.length) {
    return <LbNote>None of the people you follow has answered this yet.</LbNote>;
  }

  const same = mine >= 0 ? rows.filter((v) => v.optionIdx === mine).length : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: "var(--ink)", color: "var(--surface)", borderRadius: 14,
        padding: "13px 15px", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15,
      }}>
        {mine >= 0
          ? `${same} of ${rows.length} ${rows.length === 1 ? "friend is" : "friends are"} on your side`
          : `How your ${rows.length === 1 ? "friend" : "friends"} answered`}
      </div>
      {rows.map((v) => {
        const fill = sideFill(v.optionIdx, options.length);
        return (
          <div key={v.uid} style={{
            background: "var(--surface-2)", border: LB_LINE, borderRadius: 14,
            padding: "9px 11px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span aria-hidden="true" style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: fill,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, color: "#fff",
            }}>{(v.name || "?").trim().slice(0, 1).toUpperCase() || "?"}</span>
            {/* "Someone" is the absence of a name, not a pseudonym (D1) —
                the same word the rest of the app uses for an account that
                has set none. */}
            <span style={{
              flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 14,
              color: v.name ? "var(--ink)" : "var(--ink-3)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{v.name || "Someone"}</span>
            <span style={{
              background: fill, color: "#fff", fontFamily: "var(--sans)", fontSize: 11,
              fontWeight: 800, padding: "4px 10px", borderRadius: 999, flexShrink: 0,
              maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{options[v.optionIdx]}</span>
          </div>
        );
      })}
      {/* The bound is the voter fetch's, and it is worth saying once: a
          friend who answered outside the newest page is missing from this
          list, not from the question. */}
      {voters.length >= VOTER_FETCH_CAP && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)" }}>
          Read from the newest {VOTER_FETCH_CAP} answers — an older answer
          from a friend may not be here yet.
        </span>
      )}
    </div>
  );
}

function LiveBreakdownPanel({ qid, options, mine = -1, renderBody, kind }: {
  qid: string;
  options: string[];
  /** The viewer's own option index, or -1. */
  mine?: number;
  /**
   * The question's bank type. A `rating` collapses every option-rows body
   * to the average and the spread (D305) — ten rows about a ten-step
   * scale answer none of the questions a reader brings to it.
   */
  kind?: string;
  /**
   * A body for question forms whose result is not a list of options — the
   * dial's track and the field's plane (D114). Given this cohort's dense
   * per-option counts (exactly what those two already fold) and everyone's
   * alongside, because a continuum reads as a POSITION and a position only
   * means something against another one.
   *
   * Such a body also owns its own comparison sentence — "25-34 land 5 yrs
   * lower than everyone" is the true reading of a range, where the
   * generic divergence line below would report the same fact as a
   * points-gap on one arbitrary bucket of twelve.
   */
  renderBody?: (counts: number[], pick: CohortPick, overall: number[]) => React.ReactNode;
}) {
  const [dim, setDim] = React.useState("");
  const [bucket, setBucket] = React.useState("");
  // The store notifies when an aggregate lands; without this the sheet
  // would keep whatever split it was opened with.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);
  const typeOpen = dim === TYPE_PICK;
  const logicOpen = dim === LOGIC_PICK;
  const friendsOpen = dim === FRIENDS;
  // The type and logic cuts fold the roster's cache — but their empty
  // states render INSTEAD of the roster, so on a question whose voters
  // have not been fetched the cut would wait forever on a component that
  // is not mounted. Asked for here as well; the store de-dupes, so the
  // common case (roster already mounted, fetch already in flight) costs
  // nothing.
  React.useEffect(() => {
    if ((typeOpen || logicOpen) && qid) void LIVE.loadVoters(qid);
  }, [typeOpen, logicOpen, qid]);

  if (!LIVE.enabled || !qid) return null;

  const rating = kind === "rating";
  const n = options.length;
  const agg = LIVE.aggFor(qid);
  const by: ByMap | undefined = byOf(agg);
  const overall = Array.from({ length: n }, (_, i) => (agg?.counts || {})[String(i)] || 0);
  const overallN = overall.reduce((a, b) => a + b, 0);

  // Dims the server published cells for. For a continuum body (renderBody)
  // these stay the only chips offered — a dial's track draws a POSITION,
  // and it has nothing honest to draw over a scale of zeros.
  const publishedDims = COHORT_DIMS.filter((d) => by?.[d] && Object.keys(by[d]).length);
  // For the option-bar body, closed-vocabulary dims are ALWAYS offered
  // (D304): their body is the whole scale, and a dim nobody has shared
  // renders as that scale at zero with a line saying so — since D98 that
  // is a fact, not a gap. Open vocabularies (city, country) still need a
  // published cell: there is no canonical list of every city to draw at
  // zero.
  const dims = renderBody
    ? publishedDims
    : COHORT_DIMS.filter((d) => DIM_VOCAB[d] || publishedDims.includes(d));
  const openDim = (typeOpen || friendsOpen || logicOpen)
    ? ""
    : (dims.includes(dim as (typeof COHORT_DIMS)[number]) ? dim : "");

  // The type cut, folded from the session's own voter cache rather than
  // read from a published cell — so it is the one cut here that can be
  // null while a fetch is in flight, and the one that reads everyone's
  // CURRENT type against answers they gave at any time (data/typeSplit.ts).
  // The roster below owns the fetch; this is arithmetic on its cache.
  const scored = typeOpen || logicOpen ? LIVE.voterScores(qid) : null;
  const split = typeOpen && scored ? typeSplitFor(scored, n, myType()) : null;
  // Ranked first, then the thin ones — `typeSplitFor` has already refused
  // to rank the latter, and concatenating keeps that order on the chips.
  const typeRows: TypeSplitRow[] = split ? [...split.ranked, ...split.thin] : [];
  const openType = typeRows.some((r) => r.type === bucket)
    ? bucket
    : (typeRows[0]?.type || "");
  const typeRow = typeRows.find((r) => r.type === openType) || null;

  // The Logic cut (D227) — the same sample, banded by verified percentile
  // instead of typed. Scale order rather than popularity order, because a
  // score scale re-sorted by n stops reading as a scale.
  const lsplit = logicOpen && scored
    ? logicSplitFor(scored, n, parseLogicPct(LIVE.myTestResults()))
    : null;
  const logicRows: LogicSplitRow[] = lsplit ? [...lsplit.ranked, ...lsplit.thin] : [];
  const openBand = logicRows.some((r) => r.band === bucket)
    ? bucket
    : (logicRows[0]?.band || "");
  const logicRow = logicRows.find((r) => r.band === openBand) || null;

  // The rows view (D304) reads the whole scale — canonical order, zeros
  // included — while the continuum chips keep observed cells only, in the
  // same canonical order. city/country have no vocabulary, so both fall
  // back to the observed mix.
  const rowsView = !!openDim && !renderBody;
  const vocab = openDim ? DIM_VOCAB[openDim] : undefined;
  const allBuckets = openDim
    ? (vocab ? vocabMix(by, openDim, n, vocab) : mixFor(by, openDim, n))
    : [];
  const buckets = renderBody ? allBuckets.filter((b) => b.n > 0) : allBuckets;
  const dimN = buckets.reduce((a, b) => a + b.n, 0);
  // On the rows view nothing is pre-expanded: the scale itself is the
  // landing, and a row with no answers cannot open — there is no reading
  // inside it.
  const openBucket = rowsView
    ? (buckets.some((b) => b.bucket === bucket && b.n > 0) ? bucket : "")
    : (buckets.some((b) => b.bucket === bucket) ? bucket : (buckets[0]?.bucket || ""));

  const counts = openDim && openBucket
    ? (cellFor(by, openDim, openBucket, n) || [])
    : overall;
  const cohortN = counts.reduce((a, b) => a + b, 0);
  const pick: CohortPick = typeOpen
    ? { dim: TYPE_PICK, bucket: openType, label: openType || "Types", n: typeRow?.n ?? 0 }
    : logicOpen
      ? { dim: LOGIC_PICK, bucket: openBand, label: logicRow?.label || "Logic", n: logicRow?.n ?? 0 }
      : rowsView
        // The rows view is the DIM's reading, whichever row is expanded —
        // the expanded region names its own cohort. Its count is the
        // answers that carry this anchor, which can honestly run under
        // the card's total: an answer with no age set is in no band.
        ? { dim: openDim, bucket: openBucket, label: DIM_LABEL[openDim] || openDim, n: dimN }
        : {
          dim: openDim,
          bucket: openDim ? openBucket : "",
          label: openDim ? bucketLabel(openDim, openBucket) : "Everyone",
          n: cohortN,
        };

  // The viewer's own bucket, so their cohort is findable in a long chip
  // row without reading every label. Off the store's live anchors rather
  // than off their answer — this marks who the READER is, while every
  // number on the screen comes from the frozen snapshots (D8).
  const myAnchors = LIVE.anchors();

  // Nothing to slice: no cohort chip, no split, no header claiming a count
  // of zero. The roster alone, because it is the only part of this sheet
  // that can tell the three empty states apart — nobody answered, the
  // fetch is in flight, the fetch failed — and a note here would either
  // repeat the first one or contradict the other two.
  // Nothing to slice yet. The Friends cut still stands — a question you
  // are first to answer can still have friends on it a moment later, and
  // the chip row is how you find that out — but there is no split to draw,
  // and a header claiming a count of zero is worse than saying so.
  if (!overallN) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <LbChip on={!friendsOpen} onTap={() => setDim("")}>Everyone</LbChip>
          <LbChip on={friendsOpen} onTap={() => setDim(FRIENDS)}>Friends</LbChip>
        </div>
        {friendsOpen
          ? <LbFriends qid={qid} options={options} mine={mine} />
          : <LbNote>Nobody has answered this yet.</LbNote>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {/* WHO, then WHAT — the same two-level order the Mirror's stops use.
          The dim row picks an axis, the bucket row picks a place on it,
          and everything below is drawn for that place. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {/* Friends leads (D149), where the prototype has always put it: of
            every cut on this sheet it is the only one whose answer is
            people rather than a percentage, and it is the one a reader
            wants first. */}
        <LbChip on={friendsOpen} onTap={() => { setDim(FRIENDS); setBucket(""); }}>Friends</LbChip>
        <LbChip on={!openDim && !typeOpen && !logicOpen && !friendsOpen} onTap={() => { setDim(""); setBucket(""); }}>Everyone</LbChip>
        {dims.map((d) => (
          <LbChip key={d} on={openDim === d} onTap={() => { setDim(d); setBucket(""); }}>
            {DIM_LABEL[d]}
          </LbChip>
        ))}
        {/* Last, and after the published dims rather than sorted among
            them: the chips to their left open exact cells, these two open
            a sample. The order is the only cue available before the tap;
            the basis line under the bars is the one after it. */}
        <LbChip on={typeOpen} onTap={() => { setDim(TYPE_PICK); setBucket(""); }}>Type</LbChip>
        <LbChip on={logicOpen} onTap={() => { setDim(LOGIC_PICK); setBucket(""); }}>Logic</LbChip>
      </div>

      {friendsOpen && <LbFriends qid={qid} options={options} mine={mine} />}

      {typeOpen && (
        split === null
          // The cohort cuts are arithmetic on a document the card already
          // holds; this one waits on the roster's fetch. Distinguished
          // from "nobody is typed" because they are different facts and
          // the second one is permanent.
          ? <LbNote>Reading who answered…</LbNote>
          : !typeRows.length
            ? (
              <LbNote>
                None of the {split.sampleN.toLocaleString()} answers here carries a Big Five yet —
                it fills in as people answer test cards.
              </LbNote>
            )
            : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {typeRows.map((r) => (
                  <LbChip key={r.type} on={openType === r.type} onTap={() => setBucket(r.type)}>
                    {r.type} · {r.n}{split.mine === r.type ? " · you" : ""}
                  </LbChip>
                ))}
              </div>
            )
      )}

      {logicOpen && (
        lsplit === null
          ? <LbNote>Reading who answered…</LbNote>
          : !logicRows.length
            ? (
              <LbNote>
                None of the {lsplit.sampleN.toLocaleString()} answers here carries a verified
                logic score yet — it fills in as people take the logic test.
              </LbNote>
            )
            : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {logicRows.map((r) => (
                  <LbChip key={r.band} on={openBand === r.band} onTap={() => setBucket(r.band)}>
                    {r.label} · {r.n}{lsplit.mine === r.band ? " · you" : ""}
                  </LbChip>
                ))}
              </div>
            )
      )}

      {!!openDim && renderBody && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {buckets.map((b) => {
            const isMine = myAnchors[openDim] === b.bucket;
            return (
              <LbChip key={b.bucket} on={openBucket === b.bucket} onTap={() => setBucket(b.bucket)}>
                {bucketLabel(openDim, b.bucket)} · {b.n}{isMine ? " · you" : ""}
              </LbChip>
            );
          })}
        </div>
      )}

      {/* Named above the body rather than left implicit. Every number
          under this line is one cohort's, and a reader who arrived by
          tapping a chip two scrolls ago has to be able to see whose.
          Suppressed while the type cut has nothing to head — its two
          empty states say more than "Types · 0 answers" would. */}
      {!friendsOpen && (!typeOpen || !!typeRow) && (!logicOpen || !!logicRow) && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: LB_LINE, paddingBottom: 6 }}>
          <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }}>
            {pick.label}
          </span>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
            {pick.n.toLocaleString()} {pick.n === 1 ? "answer" : "answers"}
          </span>
        </div>
      )}

      {friendsOpen ? null : typeOpen ? (
        !typeRow ? null : !typeRow.n ? (
          <LbNote>Nobody of this type has answered this yet.</LbNote>
        ) : (
          // Shares only once the typed sample can carry them; counts and a
          // plain sentence below it otherwise. A custom renderBody is NOT
          // offered the type cut: the dial and the field fold a continuum
          // out of exact published cells, and handing them a bounded
          // sample would put a sampled position on a track that reads as
          // the population's.
          rating
            ? <LbRatingBody counts={typeRow.counts} mine={mine} />
            : <LbOptionRows
              options={options}
              counts={typeRow.counts}
              mine={mine}
              mode={split && split.enough ? "pct" : "count"}
            />
        )
      ) : logicOpen ? (
        !logicRow ? null : !logicRow.n ? (
          <LbNote>Nobody in this band has answered this yet.</LbNote>
        ) : (
          // The type cut's shares rule, unchanged: percentages only once
          // the scored sample can carry them, counts and the basis line
          // otherwise. No renderBody here for the type cut's own reason —
          // a sampled position must not draw on a track that reads as the
          // population's.
          rating
            ? <LbRatingBody counts={logicRow.counts} mine={mine} />
            : <LbOptionRows
              options={options}
              counts={logicRow.counts}
              mine={mine}
              mode={lsplit && lsplit.enough ? "pct" : "count"}
            />
        )
      ) : rowsView ? (
        <>
          <LbCohortRows
            dim={openDim}
            buckets={buckets}
            options={options}
            overall={overall}
            myBucket={myAnchors[openDim] || ""}
            openBucket={openBucket}
            onRow={setBucket}
            kind={kind}
            renderDetail={(b) => {
              // Where this cohort parts company with everyone — the same
              // fold the Mirror's Explore lens reads, so the two surfaces
              // cannot disagree about which option a group is unusual on.
              // A rating compares MEANS instead (D305): "more likely to
              // say 7" is a true sentence about a histogram bucket and a
              // useless one about a scale.
              const d = rating ? null : divergenceFor(by, openDim, b.bucket, overall, n);
              const basePct = pctFor(overall);
              const label = bucketLabel(openDim, b.bucket);
              const bMean = rating ? meanScore(b.counts) : null;
              const oMean = rating ? meanScore(overall) : null;
              const meanGap = bMean && oMean ? bMean.mean - oMean.mean : 0;
              // DECIDE ON THE NUMBER THIS PRINTS, not on the one behind
              // it. The sentence below draws the gap to one decimal and
              // used to gate on the raw float at `>= 0.1`, so a gap of
              // 0.06 — which draws as "0.1" — fell into the other arm and
              // said "land right where everyone lands". Half of every gap
              // that rounds to a tenth said it, and the reader has no way
              // to tell those apart from the ones that print 0.1 and are
              // called a difference.
              const gapShown = Math.abs(meanGap).toFixed(1);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>
                      {label}
                    </span>
                    <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                      {b.n.toLocaleString()} {b.n === 1 ? "answer" : "answers"}
                    </span>
                  </div>
                  {rating
                    ? <LbRatingBody counts={b.counts} mine={mine} />
                    : <LbOptionRows options={options} counts={b.counts} mine={mine} />}
                  {/* "Same as everyone" is a real finding on a cohort
                      screen — stated rather than left as an absence the
                      reader has to interpret. */}
                  <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5, textWrap: "pretty" }}>
                    {rating ? (
                      bMean && oMean && gapShown !== "0.0"
                        ? <>
                          {label} average <strong style={{ color: "var(--ink-2)" }}>{bMean.mean.toFixed(1)}</strong>
                          {" "}— {gapShown} {meanGap > 0 ? "above" : "below"} everyone.
                        </>
                        : <>{label} land right where everyone lands.</>
                    ) : d && d.gap > 0
                      ? <>
                        {label} are <strong style={{ color: "var(--ink-2)" }}>{d.gap} points</strong>
                        {" "}{d.pct[d.optionIdx] > (basePct[d.optionIdx] || 0) ? "more" : "less"} likely
                        to say {options[d.optionIdx]} than everyone.
                      </>
                      : <>{label} answered this exactly like everyone else.</>}
                  </div>
                </>
              );
            }}
          />
          {!dimN && (
            <LbNote>
              Nobody who answered has shared their {(DIM_LABEL[openDim] || openDim).toLowerCase()} yet.
            </LbNote>
          )}
        </>
      ) : !cohortN ? (
        // Since D98 an absent cell means exactly zero, never withheld —
        // so this is a fact about the cohort and is worth saying plainly.
        <LbNote>Nobody in {pick.label} has answered this yet.</LbNote>
      ) : (
        renderBody
          ? renderBody(counts, pick, overall)
          : rating
            ? <LbRatingBody counts={counts} mine={mine} />
            : <LbOptionRows options={options} counts={counts} mine={mine} />
      )}

      {/* THE BASIS, stated every time the type cut is open.
          Every other cut on this sheet is a census — every answer, exact
          — and this one is the latest voters the session happened to
          fetch, thinned to those carrying a result. Saying so once under
          the bars is what keeps a reader from carrying the exactness of
          the chip to its left across to this one. */}
      {!friendsOpen && typeOpen && !!split && !!typeRows.length && (
        <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5, textWrap: "pretty" }}>
          {(() => {
            const d = typeRow && split.enough ? typeDivergence(typeRow, split.overall) : null;
            return (
              <>
                {d && (
                  <>
                    {typeRow!.type} are <strong style={{ color: "var(--ink-2)" }}>{d.gap} points</strong>
                    {" "}{d.higher ? "more" : "less"} likely to say {options[d.optionIdx]} than
                    the typed people here.{" "}
                  </>
                )}
                Of the {split.sampleN.toLocaleString()} answers this session has read,
                {" "}{split.typedN.toLocaleString()} carry a Big Five.
                {!split.enough && " Too few for shares, so these are counts."}
                {" "}Types are read as they stand today, so this counts answers given
                before they were typed.
              </>
            );
          })()}
        </div>
      )}

      {/* The Logic cut's basis, on the type cut's template: a sample, not
          the census, and the bands named for what they are — quarters of
          the verified test's percentile. The untested are the gap between
          the two numbers, never a fifth band. */}
      {!friendsOpen && logicOpen && !!lsplit && !!logicRows.length && (
        <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5, textWrap: "pretty" }}>
          {(() => {
            const d = logicRow && lsplit.enough ? logicDivergence(logicRow, lsplit.overall) : null;
            return (
              <>
                {d && (
                  <>
                    The {logicRow!.label.toLowerCase()} are <strong style={{ color: "var(--ink-2)" }}>{d.gap} points</strong>
                    {" "}{d.higher ? "more" : "less"} likely to say {options[d.optionIdx]} than
                    the scored people here.{" "}
                  </>
                )}
                Of the {lsplit.sampleN.toLocaleString()} answers this session has read,
                {" "}{lsplit.scoredN.toLocaleString()} carry a verified logic score —
                the bands are quarters of its percentile.
                {!lsplit.enough && " Too few for shares, so these are counts."}
              </>
            );
          })()}
        </div>
      )}

      {/* No roster under a cohort (D149). "Everyone", every demographic
          cut, D146's type cut and D227's logic cut all answer in
          percentages; the only cut that names people is Friends, because
          there "who" IS the question being asked. */}
    </div>
  );
}

export default LiveBreakdownPanel;
