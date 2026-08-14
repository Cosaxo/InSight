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
// TWO CHANGES AT D148, AND THEY ARE ONE CHANGE.
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
import React from "react";
import LIVE from "../data/live";
import { VOTER_FETCH_CAP } from "../data/voters";
import { bucketLabel } from "./cohortLabels";
import {
  COHORT_DIMS, DIM_LABEL, cellFor, divergence, mixFor, pctFor, byOf,
  type ByMap,
} from "../data/cohort";
import { typeDivergence, typeSplitFor, type TypeSplitRow } from "../data/typeSplit";
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
        You have not followed anyone yet. Follow someone from the Mirror&rsquo;s
        People lens or its city constellation, and their answers show up here.
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
  const typeOpen = dim === TYPE_PICK;
  const friendsOpen = dim === FRIENDS;
  // The type cut folds the roster's cache — but both of its empty states
  // render INSTEAD of the roster, so on a question whose voters have not
  // been fetched the cut would wait forever on a component that is not
  // mounted. Asked for here as well; the store de-dupes, so the common
  // case (roster already mounted, fetch already in flight) costs nothing.
  React.useEffect(() => {
    if (typeOpen && qid) void LIVE.loadVoters(qid);
  }, [typeOpen, qid]);

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
  const openDim = (typeOpen || friendsOpen)
    ? ""
    : (dims.includes(dim as (typeof COHORT_DIMS)[number]) ? dim : "");

  // The type cut, folded from the session's own voter cache rather than
  // read from a published cell — so it is the one cut here that can be
  // null while a fetch is in flight, and the one that reads everyone's
  // CURRENT type against answers they gave at any time (data/typeSplit.ts).
  // The roster below owns the fetch; this is arithmetic on its cache.
  const scored = typeOpen ? LIVE.voterScores(qid) : null;
  const split = scored ? typeSplitFor(scored, n, myType()) : null;
  // Ranked first, then the thin ones — `typeSplitFor` has already refused
  // to rank the latter, and concatenating keeps that order on the chips.
  const typeRows: TypeSplitRow[] = split ? [...split.ranked, ...split.thin] : [];
  const openType = typeRows.some((r) => r.type === bucket)
    ? bucket
    : (typeRows[0]?.type || "");
  const typeRow = typeRows.find((r) => r.type === openType) || null;

  const buckets = openDim ? mixFor(by, openDim, n) : [];
  const openBucket = buckets.some((b) => b.bucket === bucket)
    ? bucket
    : (buckets[0]?.bucket || "");

  const counts = openDim && openBucket
    ? (cellFor(by, openDim, openBucket, n) || [])
    : overall;
  const cohortN = counts.reduce((a, b) => a + b, 0);
  const pick: CohortPick = typeOpen
    ? { dim: TYPE_PICK, bucket: openType, label: openType || "Types", n: typeRow?.n ?? 0 }
    : {
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
        {/* Friends leads (D148), where the prototype has always put it: of
            every cut on this sheet it is the only one whose answer is
            people rather than a percentage, and it is the one a reader
            wants first. */}
        <LbChip on={friendsOpen} onTap={() => { setDim(FRIENDS); setBucket(""); }}>Friends</LbChip>
        <LbChip on={!openDim && !typeOpen && !friendsOpen} onTap={() => { setDim(""); setBucket(""); }}>Everyone</LbChip>
        {dims.map((d) => (
          <LbChip key={d} on={openDim === d} onTap={() => { setDim(d); setBucket(""); }}>
            {DIM_LABEL[d]}
          </LbChip>
        ))}
        {/* Last, and after the published dims rather than sorted among
            them: the chips to its left open exact cells, this one opens a
            sample. The order is the only cue available before the tap;
            the basis line under the bars is the one after it. */}
        <LbChip on={typeOpen} onTap={() => { setDim(TYPE_PICK); setBucket(""); }}>Type</LbChip>
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
                Nobody among the {split.sampleN.toLocaleString()} answers here has a readable Big Five yet.
                Types are folded from test cards in the feed, so this fills in as people answer them.
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
          tapping a chip two scrolls ago has to be able to see whose.
          Suppressed while the type cut has nothing to head — its two
          empty states say more than "Types · 0 answers" would. */}
      {!friendsOpen && (!typeOpen || !!typeRow) && (
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
          <LbOptionRows
            options={options}
            counts={typeRow.counts}
            mine={mine}
            mode={split && split.enough ? "pct" : "count"}
          />
        )
      ) : !cohortN ? (
        // Since D98 an absent cell means exactly zero, never withheld —
        // so this is a fact about the cohort and is worth saying plainly.
        <LbNote>Nobody in {pick.label} has answered this yet.</LbNote>
      ) : (
        renderBody
          ? renderBody(counts, pick, overall)
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
                {" "}Types are folded from each person's own test answers as they stand today,
                so this counts answers given before they were typed.
              </>
            );
          })()}
        </div>
      )}

      {/* One line, and only when there is something to say. "Same as
          everyone" is a real finding on a cohort screen — it is the
          answer to the question the chips just asked — so it is stated
          rather than left as an absence the reader has to interpret.
          A custom body carries its own comparison; see renderBody. */}
      {!friendsOpen && !renderBody && !!openDim && !!cohortN && (
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

      {/* No roster under a cohort (D148). "Everyone", every demographic
          cut and D146's type cut all answer in percentages; the only cut
          that names people is Friends, because there "who" IS the question
          being asked. */}
    </div>
  );
}

export default LiveBreakdownPanel;
