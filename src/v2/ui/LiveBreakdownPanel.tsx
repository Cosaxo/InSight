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
// roster underneath keeps its own single fetch-on-open (LiveVotersPanel),
// unchanged and still bounded.
import React from "react";
import LIVE from "../data/live";
import LiveVotersPanel from "./LiveVotersPanel";
import { bucketLabel } from "./cohortLabels";
import {
  COHORT_DIMS, DIM_LABEL, cellFor, divergence, mixFor, pctFor, byOf,
  type ByMap,
} from "../data/cohort";

const LB_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

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
function LbOptionRows({ options, counts, mine }: {
  options: string[]; counts: number[]; mine: number;
}) {
  const pct = pctFor(counts);
  const top = counts.reduce((t, v, i) => (v > counts[t] ? i : t), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((label, i) => (
        <div key={i} style={{
          position: "relative", overflow: "hidden", borderRadius: 11,
          border: i === mine ? "1.5px solid color-mix(in oklch, var(--accent, var(--ink)) 55%, var(--rule))" : LB_LINE,
          background: "var(--surface)",
        }}>
          <span aria-hidden="true" style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct[i]}%`,
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
            }}>{pct[i]}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveBreakdownPanel({ qid, options, mine = -1, renderBody }: {
  qid: string;
  options: string[];
  /** The viewer's own option index, or -1. */
  mine?: number;
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

  if (!LIVE.enabled || !qid) return null;

  const n = options.length;
  const agg = LIVE.aggFor(qid);
  const by: ByMap | undefined = byOf(agg);
  const overall = Array.from({ length: n }, (_, i) => (agg?.counts || {})[String(i)] || 0);
  const overallN = overall.reduce((a, b) => a + b, 0);

  // Only dims the server actually published for this question. A chip for
  // a dim with no cells would open onto an empty row and read as a bug
  // rather than as "nobody who answered filled that in".
  const dims = COHORT_DIMS.filter((d) => by?.[d] && Object.keys(by[d]).length);
  const openDim = dims.includes(dim as (typeof COHORT_DIMS)[number]) ? dim : "";

  const buckets = openDim ? mixFor(by, openDim, n) : [];
  const openBucket = buckets.some((b) => b.bucket === bucket)
    ? bucket
    : (buckets[0]?.bucket || "");

  const counts = openDim && openBucket
    ? (cellFor(by, openDim, openBucket, n) || [])
    : overall;
  const cohortN = counts.reduce((a, b) => a + b, 0);
  const pick: CohortPick = {
    dim: openDim,
    bucket: openDim ? openBucket : "",
    label: openDim ? bucketLabel(openDim, openBucket) : "Everyone",
    n: cohortN,
  };

  // Where this cohort parts company with everyone. Read from the same fold
  // the Mirror's Explore lens uses, so the two surfaces cannot disagree
  // about which option a group is unusual on.
  const diff = openDim && openBucket
    ? divergence(by, openDim, overall, n).find((d) => d.bucket === openBucket)
    : undefined;
  const overallPct = pctFor(overall);

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
  if (!overallN) {
    return <LiveVotersPanel qid={qid} options={options} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {/* WHO, then WHAT — the same two-level order the Mirror's stops use.
          The dim row picks an axis, the bucket row picks a place on it,
          and everything below is drawn for that place. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <LbChip on={!openDim} onTap={() => { setDim(""); setBucket(""); }}>Everyone</LbChip>
        {dims.map((d) => (
          <LbChip key={d} on={openDim === d} onTap={() => { setDim(d); setBucket(""); }}>
            {DIM_LABEL[d]}
          </LbChip>
        ))}
      </div>

      {!!openDim && (
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
          tapping a chip two scrolls ago has to be able to see whose. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: LB_LINE, paddingBottom: 6 }}>
        <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }}>
          {pick.label}
        </span>
        <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
          {pick.n.toLocaleString()} {pick.n === 1 ? "answer" : "answers"}
        </span>
      </div>

      {!cohortN ? (
        // Since D98 an absent cell means exactly zero, never withheld —
        // so this is a fact about the cohort and is worth saying plainly.
        <LbNote>Nobody in {pick.label} has answered this yet.</LbNote>
      ) : (
        renderBody
          ? renderBody(counts, pick, overall)
          : <LbOptionRows options={options} counts={counts} mine={mine} />
      )}

      {/* One line, and only when there is something to say. "Same as
          everyone" is a real finding on a cohort screen — it is the
          answer to the question the chips just asked — so it is stated
          rather than left as an absence the reader has to interpret.
          A custom body carries its own comparison; see renderBody. */}
      {!renderBody && !!openDim && !!cohortN && (
        <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5, textWrap: "pretty" }}>
          {diff && diff.gap > 0
            ? <>
              {pick.label} are <strong style={{ color: "var(--ink-2)" }}>{diff.gap} points</strong>
              {" "}{diff.pct[diff.optionIdx] > (overallPct[diff.optionIdx] || 0) ? "more" : "less"} likely
              to say {options[diff.optionIdx]} than everyone.
            </>
            : <>{pick.label} answered this exactly like everyone else.</>}
        </div>
      )}

      {/* The names, scoped to the cohort above them. This is still the
          surface D98 exists for; it is no longer the whole sheet. */}
      <LiveVotersPanel
        qid={qid}
        options={options}
        dim={pick.dim}
        bucket={pick.bucket}
        cohortLabel={pick.label}
      />
    </div>
  );
}

// Render-time lookup bridge for the spec layer (world-feed.jsx imports it
// directly; this is here for parity with its sibling panels).
Object.assign(globalThis, { LiveBreakdownPanel });

export default LiveBreakdownPanel;
