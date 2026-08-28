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
import {
  LOGIC_DIM, TRAIT_GROUPS, myTraitBuckets, traitBucketLabel, traitBuckets, traitDimLabel,
} from "../data/traitDims";
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

// THE TYPE AND LOGIC SENTINELS ARE GONE (D330), and what replaced them is
// the point of that record.
//
// `TYPE_PICK = "__type"` and `LOGIC_PICK = "__logic"` were kept out of
// COHORT_DIMS on purpose, because they named a fold the CLIENT ran over
// the session's ≤200-voter cache while every other chip named a published
// cell — "a census against a bounded sample", and a key that could be
// mistaken for a dim is how the two would have ended up sharing a code
// path and then a caption.
//
// They are now published cells like the rest. The nightly sweep writes a
// cube keyed on each instrument's matched type, each instrument's axis
// bands and the logic band, shaped exactly like `agg.by`, so a trait dim
// IS a dim here: same `vocabMix`, same `LbCohortRows`, same
// `divergenceFor`, same everything. The sample's own arithmetic trap goes
// with it — a type's share can be subtracted from the published split
// again, because both are now counts of the same population.
//
// One thing the sample could do that the census cannot: draw on a
// question with no cube. That is deliberate. A tail question is outside
// the Mirror's corpus (SCALE-PLAN §1) and gets no instrument chips at
// all — the absence of data as the absence of the control, no flag and
// no empty state, which is the D265 gate posture.

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
function LbCohortRows({ dim, buckets, options, overall, myBucket, openBucket, onRow, renderDetail, kind, labelOf }: {
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
  /** What to call a bucket. Defaults to the anchor vocabularies'
   *  `bucketLabel`; a trait dim (D330) passes its own, because a band key
   *  is an index (`b0`) and an archetype key is already its name. */
  labelOf?: (dim: string, bucket: string) => string;
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
        const label = (labelOf ?? bucketLabel)(dim, b.bucket);
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
  // The trait cube (D330), fetched on OPEN rather than on a chip's tap —
  // whether the instrument chips exist at all is what this document
  // answers, so it has to be in hand before the row renders. One getDoc,
  // session-cached, against the up-to-200 profile reads the sampled cut
  // it replaces paid for a worse number. Above the early return with the
  // other hooks: order has to be identical on every render.
  React.useEffect(() => { if (qid) void LIVE.loadTraits(qid); }, [qid]);
  const friendsOpen = dim === FRIENDS;

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

  // ── the trait cube (D330) ──
  //
  // One published document per core question, body shaped exactly like
  // `by`, so from here down a trait dim is an ordinary dim. Fetched on
  // open rather than on the chip's tap, because whether the chips exist
  // AT ALL is what the document answers — and it is one getDoc against
  // the up-to-200 profile reads the sampled cut it replaces paid for a
  // worse number.
  const traitBy = LIVE.traitsFor(qid);
  // Only instruments the cube actually carries, and only on the option-bar
  // body: a dial's track draws a POSITION and has nothing honest to draw
  // over a trait scale, the same refusal `renderBody` already makes of the
  // published dims.
  const traitGroups = (!renderBody && traitBy)
    ? TRAIT_GROUPS.filter((g) => traitBy[g.typeDim] || g.axisDims.some((a) => traitBy[a.dim]))
    : [];
  const hasLogicCut = !renderBody && !!traitBy?.[LOGIC_DIM];
  const traitDims = new Set<string>();
  for (const g of traitGroups) {
    traitDims.add(g.typeDim);
    for (const a of g.axisDims) traitDims.add(a.dim);
  }
  if (hasLogicCut) traitDims.add(LOGIC_DIM);
  /** The trait dim currently open, or "". */
  const openTrait = !friendsOpen && traitDims.has(dim) ? dim : "";
  /** Which instrument's second chip row is showing. */
  const openGroup = openTrait ? traitGroups.find(
    (g) => g.typeDim === openTrait || g.axisDims.some((a) => a.dim === openTrait),
  ) ?? null : null;

  const openDim = friendsOpen
    ? ""
    : openTrait || (dims.includes(dim as (typeof COHORT_DIMS)[number]) ? dim : "");
  /** Cells come from the cube for a trait dim and from the aggregate for
   *  an anchor dim — one lookup, so nothing below has to know which. */
  const cellsBy: ByMap | undefined = openTrait ? (traitBy ?? undefined) : by;

  // The rows view (D304) reads the whole scale — canonical order, zeros
  // included — while the continuum chips keep observed cells only, in the
  // same canonical order. city/country have no vocabulary, so both fall
  // back to the observed mix.
  const rowsView = !!openDim && !renderBody;
  // A trait dim's vocabulary is its own closed list (every archetype, the
  // five bands, `untested`), which is why the rows view works on it
  // unchanged: the scale is knowable without asking what was observed.
  const vocab = openTrait ? traitBuckets(openTrait) : (openDim ? DIM_VOCAB[openDim] : undefined);
  const allBuckets = openDim
    ? (vocab ? vocabMix(cellsBy, openDim, n, vocab) : mixFor(cellsBy, openDim, n))
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
    ? (cellFor(cellsBy, openDim, openBucket, n) || [])
    : overall;
  const cohortN = counts.reduce((a, b) => a + b, 0);
  const pick: CohortPick = rowsView
        // The rows view is the DIM's reading, whichever row is expanded —
        // the expanded region names its own cohort. Its count is the
        // answers that carry this anchor, which can honestly run under
        // the card's total: an answer with no age set is in no band.
        ? {
          dim: openDim,
          bucket: openBucket,
          label: openTrait ? traitDimLabel(openTrait) : (DIM_LABEL[openDim] || openDim),
          n: dimN,
        }
        : {
          dim: openDim,
          bucket: openDim ? openBucket : "",
          label: openDim
            ? (openTrait ? traitBucketLabel(openTrait, openBucket) : bucketLabel(openDim, openBucket))
            : "Everyone",
          n: cohortN,
        };

  // The viewer's own bucket, so their cohort is findable in a long chip
  // row without reading every label. Off the store's live anchors rather
  // than off their answer — this marks who the READER is, while every
  // number on the screen comes from the frozen snapshots (D8).
  const myAnchors = LIVE.anchors();
  // …and the trait half of the same thing, computed on the device from
  // the viewer's CURRENT results. See myTraitBuckets: deliberately not
  // read out of the cube, because the cube is last night's and a person
  // who re-typed themselves this morning should find themselves in the
  // row they are in now.
  const myTraits = openTrait ? myTraitBuckets(LIVE.myTestResults()) : {};

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
        <LbChip on={!openDim && !friendsOpen} onTap={() => { setDim(""); setBucket(""); }}>Everyone</LbChip>
        {dims.map((d) => (
          <LbChip key={d} on={openDim === d} onTap={() => { setDim(d); setBucket(""); }}>
            {DIM_LABEL[d]}
          </LbChip>
        ))}
        {/* The instruments, after the anchor dims rather than sorted among
            them (D330). They are exact cells like everything to their left
            now — the ordering is no longer census-vs-sample, it is what a
            person entered about themselves against what the app worked out
            about them. Tapping one opens its own second row. */}
        {traitGroups.map((g) => (
          <LbChip
            key={g.kind}
            on={openGroup?.kind === g.kind}
            onTap={() => { setDim(g.typeDim); setBucket(""); }}
          >{g.label}</LbChip>
        ))}
        {hasLogicCut && (
          <LbChip on={openTrait === LOGIC_DIM} onTap={() => { setDim(LOGIC_DIM); setBucket(""); }}>Logic</LbChip>
        )}
      </div>

      {/* An instrument's own row: its overall Type, then one chip per axis.
          Type leads because it is the reading a person recognises — they
          have a type on their result card, they do not have an "Openness
          band" — and the axes behind it are the finer cut for a reader who
          wants one. */}
      {openGroup && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <LbChip
            on={openTrait === openGroup.typeDim}
            onTap={() => { setDim(openGroup.typeDim); setBucket(""); }}
          >Type</LbChip>
          {openGroup.axisDims.filter((a) => traitDims.has(a.dim)).map((a) => (
            <LbChip
              key={a.dim}
              on={openTrait === a.dim}
              onTap={() => { setDim(a.dim); setBucket(""); }}
            >{a.label}</LbChip>
          ))}
        </div>
      )}

      {friendsOpen && <LbFriends qid={qid} options={options} mine={mine} />}

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
          A trait dim heads it like any other now (D330) — there is no
          sampled empty state left to suppress it for. */}
      {!friendsOpen && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: LB_LINE, paddingBottom: 6 }}>
          <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }}>
            {pick.label}
          </span>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
            {pick.n.toLocaleString()} {pick.n === 1 ? "answer" : "answers"}
          </span>
        </div>
      )}

      {friendsOpen ? null : rowsView ? (
        <>
          <LbCohortRows
            dim={openDim}
            buckets={buckets}
            options={options}
            overall={overall}
            myBucket={openTrait ? (myTraits[openTrait] || "") : (myAnchors[openDim] || "")}
            labelOf={openTrait ? traitBucketLabel : undefined}
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
              const d = rating ? null : divergenceFor(cellsBy, openDim, b.bucket, overall, n);
              const basePct = pctFor(overall);
              const label = openTrait
                ? traitBucketLabel(openTrait, b.bucket)
                : bucketLabel(openDim, b.bucket);
              const bMean = rating ? meanScore(b.counts) : null;
              const oMean = rating ? meanScore(overall) : null;
              const meanGap = bMean && oMean ? bMean.mean - oMean.mean : 0;
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
                      bMean && oMean && Math.abs(meanGap) >= 0.1
                        ? <>
                          {label} average <strong style={{ color: "var(--ink-2)" }}>{bMean.mean.toFixed(1)}</strong>
                          {" "}— {Math.abs(meanGap).toFixed(1)} {meanGap > 0 ? "above" : "below"} everyone.
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

      {/* THE BASIS LINE IS GONE, and its absence is the change (D330).
          It existed to say that this one cut was a sample while every
          chip to its left was a census — "the latest voters the session
          happened to fetch, thinned to those carrying a result". The cut
          is now a census like the rest, computed over every answer, so
          there is nothing left to warn a reader about and a line saying
          so would be furniture. What it USED to promise in its last
          sentence — "types are read as they stand today, so this counts
          answers given before they were typed" — is still true and is now
          true of the published cell itself: the nightly sweep rebuilds
          every cube against tonight's results.

          One residual, priced in D330 rather than drawn: your own row is
          outlined from the type you have RIGHT NOW while the counts are
          last night's, so for up to a day after re-typing yourself the
          outline can sit on a row your own answer has not moved into. A
          device-side ±1 correction was the obvious fix and is rejected —
          it would put the sheet at odds with the published cell and with
          the sold report over the same number. */}

      {/* No roster under a cohort (D149). "Everyone", every anchor cut
          and every trait cut answer in percentages; the only cut that
          names people is Friends, because there "who" IS the question
          being asked. */}
    </div>
  );
}

export default LiveBreakdownPanel;
