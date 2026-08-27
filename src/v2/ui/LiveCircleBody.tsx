// The Mirror's Circle stop, live (D101).
//
// This body replaces an empty state that read "Your circle is empty —
// one-to-one connections aren't built yet". That was honest and it was
// the right thing to ship while it was true; what made it stop being
// true is not new plumbing but D98. Once every answer is readable, a
// follow is a bookmark rather than a permission grant, so the whole
// request/accept apparatus a friend graph normally needs simply is not
// needed — see data/circle.ts.
//
// WHAT IT DRAWS. The people you follow, ranked by how alike your answers
// are, and under them the questions your circle is most divided on. Both
// are folds over answers already fetched; nothing here is invented, and
// a circle of nobody says so rather than showing a shape.
//
// WHY THE SPLIT EXCLUDES YOU. `circleSplit` folds only the members. The
// Map's `typicality` does the opposite — it counts you in your own age
// band — and the difference is the question each screen asks. "How
// typical was I" needs the cohort the aggregate folded, you included.
// "What do the people I follow think" does not, and folding yourself in
// would let a circle of one reflect your own answer back as consensus.
//
// AND IT HAS THE ROW NOW (D190). D188 measured every Mirror stop's tab row
// against the prototype and recorded what it did not touch: "Circle and
// Groups have no row at all in live mode… That is a missing feature, not a
// misplaced one." It is the feature. The stop's three readings — who is
// here, what they split on, you against them — were a single scroll; they
// are Answers · People · Compare now, drawn under a row that sits where
// every other stop's sits, INCLUDING when the circle is empty. An empty
// stop with no row reads as a screen that was never built, which is the
// same argument D160 made for drawing an empty field.
import React from "react";
import LIVE from "../data/live";
import { BUDGET_PAUSED_BODY, BUDGET_PAUSED_HEAD } from "../data/budgetMode";
// The rings-and-you drawing every other stop shows when it is empty (D172).
import EmptyField from "./EmptyField";
import MirrorLensTabs from "./MirrorLensTabs";
import { useLensRowScroll } from "./lensRowScroll";
import type { LensTab } from "./lensTabs";
import { circleSplit, rankMembers } from "../data/circle";
import { divisiveness, pctFor } from "../data/cohort";

// The stop's constellation (D152). This body shipped as a flat list of
// names and percentages — the same data with the shape taken out, and on
// this tab the shape IS the reading: a circle is the one population where
// "who is close to me" is the whole question. Lazy for the same reason the
// cohort stops load their field lazily: it is an SVG canvas, and the list
// underneath must not wait on it.
const PeopleField = React.lazy(() =>
  import("./LiveSimilarityField").then((m) => ({ default: m.PeopleField })),
);
// Compare, borrowed rather than rebuilt (D190, re-pointed at D193). It
// used to be `CompareLens`, a list of questions; it is the profile
// drawing now, and the borrowing survives the change because
// LiveCompareLens asks only for a way to count this population's answers
// and a noun. Lazy for the reason the field is — it is an SVG canvas per
// instrument, and opening Circle must not fetch it before the tab is
// tapped.
const CircleCompare = React.lazy(() => import("./LiveCompareLens"));

const CL_LINE = "1px solid var(--rule)";

/**
 * The stop's three, in the prototype's order.
 *
 * Answers · People · Compare is what `group-mirror.jsx` gives both set
 * stops, and D184's argument for ending on Compare ports unchanged: the
 * first two describe the population, and Compare is the one that puts you
 * against it.
 */
const CIRCLE_TABS: LensTab[] = [
  { id: "answers", label: "Answers" },
  { id: "people", label: "People" },
  { id: "compare", label: "Compare" },
];

/** A tab that has nothing to draw yet — one sentence, in the panel. */
function ClEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px" }}>
      {children}
    </div>
  );
}

function ClNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "30px 22px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--ink)", marginBottom: 7 }}>{title}</div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.55, maxWidth: 330, margin: "0 auto", textWrap: "pretty" }}>
        {children}
      </div>
    </div>
  );
}

function LiveCircleBody() {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(tick), []);
  // On mount, not on render: the stop is the cost gate, the same way the
  // People lens is for Kindred. loadCircle guards its own re-entry.
  React.useEffect(() => { void LIVE.loadCircle(); }, []);
  // Closed, like every other stop (D155): a stop with nothing open is a
  // header, a field and a tab bar sitting where a tab bar belongs.
  const [tab, setTab] = React.useState("");
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  useLensRowScroll(tab, rowRef);

  const members = LIVE.circle();
  const loading = LIVE.circleLoading();

  if (loading && !members) {
    return <ClNote title="Loading your circle…">Reading their answers.</ClNote>;
  }
  // Paused before failed (D327): with the breaker on, loadCircle refused
  // rather than tried, and "couldn't load / it retries" would promise a
  // retry that will keep refusing.
  if (!members && LIVE.budgetPaused) {
    return <ClNote title={BUDGET_PAUSED_HEAD}>{BUDGET_PAUSED_BODY}</ClNote>;
  }
  if (!members) {
    // null after a settled load means the read failed — not that the
    // circle is empty. Saying "empty" here would tell someone with
    // thirty follows that they have none.
    //
    // NO ROW ON THIS ARM, and none on the loading one either: a tab bar
    // over a failed read offers three readings of nothing, and the stop
    // does not yet know whether it has a circle to read.
    return (
      <ClNote title="Couldn&rsquo;t load your circle">
        It retries next time you open this stop.
      </ClNote>
    );
  }

  // The questions the circle is most split on. Ranked by divisiveness
  // rather than by size, because a circle is small by construction and
  // "what do we disagree about" is the only interesting question to ask
  // of a group this size — "what do we agree about" is mostly a list of
  // things everyone answers the same way everywhere.
  const qs = LIVE.aggregated();
  const splits = qs.map((q) => ({ q, split: circleSplit(members, q.id, q.options.length) }));
  const rows = splits
    .filter((r) => r.split.n >= 2)
    // divisiveness computed once per surviving row rather than inside the
    // comparator, where it would re-run O(n log n) times per render —
    // same reasoning (and measurement) as LiveCohortBody's sort.
    .map((r) => ({ ...r, d: divisiveness(r.split.counts) }))
    .sort((a, b) => b.d - a.d || b.split.n - a.split.n)
    .slice(0, 12);

  const myVotes = LIVE.myVotes();
  const mutuals = members.filter((m) => m.mutual).length;

  // The "so what" line under the field (2026-08-24): the picture's two
  // extremes, said once. Names only — the ranking is the pct the People
  // tab lists per member with its shared-answer basis, so the sentence
  // prints no number and makes no claim the rows beneath don't carry.
  // Quiet unless it can actually say something: two placeable members,
  // both with names (a "Someone mirrors you closest" line reads as a
  // bug, and inventing names is the D214 refusal).
  //
  // `rankMembers`, not a pct sort. This sorted on the printed percentage,
  // which is the one thing D277 §2 established it cannot do: a member who
  // matched 1 of 1 outranks one who matched 45 of 50, so the sentence
  // named the thin match "mirrors you closest" while the People tab
  // directly beneath — which draws `LIVE.circle()` in rankMembers order
  // under the header "By likeness" — listed the other one first. The two
  // halves of one screen disagreed. Every sibling ranker converted at
  // D277; this was the site that did not.
  //
  // And quiet when the extremes are not actually apart. `uid` differing
  // is not the same test as the NUMBERS differing, and in a circle where
  // everyone sits at the same likeness the old guard still crowned one
  // named person and told another they mirror you least, on identical
  // figures. groupPortrait's sibling sentence carries the same guard.
  const placed = rankMembers(members.filter((m) => m.like.shared > 0 && m.name));
  const soWhat = placed.length >= 2
    && placed[0].uid !== placed[placed.length - 1].uid
    && placed[0].like.rate !== placed[placed.length - 1].like.rate
    ? { top: placed[0], low: placed[placed.length - 1] }
    : null;

  /**
   * The circle's side of Compare (D193): the members' own answers to the
   * bank's test items, folded into per-option counts.
   *
   * The SAME arithmetic every other population's profile runs on — a
   * circle differs from a city only in where the counts come from, which
   * is exactly the property `axisScores` was written for (D112: "one
   * arithmetic, any cohort"). `circleSplit` is already the fold this stop
   * uses for its Answers tab, and it already excludes you, which is what
   * keeps a circle of one from reflecting your own answers back as
   * agreement with yourself.
   *
   * Five options because the instruments are written on a 5-point
   * agreement scale and `testItemMeta` drops anything else; a qid the
   * circle has not answered folds to n=0 and the lens reads it as absent.
   *
   * The answer floor is 2 rather than testNorms' 30, and the difference
   * is the claim: a city is a SAMPLE of a city, so a mean of four answers
   * there is four people's mood drawn as a population's centre. A circle
   * is the exact set you chose — its mean is that set's mean at any size,
   * including one, and the header directly above says what that size is.
   *
   * The floor that actually binds here is the ITEM one, and it binds on
   * every population for a reason that is not about sample size: an axis
   * is several questions agreeing, so one item's mean is that item's mean
   * whoever answered it.
   */
  const comparePop = {
    basis: "cells" as const,
    cellOf: (qid: string) => {
      const s = circleSplit(members, qid, 5);
      return s.n ? s.counts : null;
    },
    minAnswers: 2,
    minItems: 2,
  };

  return (
    <div className="fade-in" style={{
      // The cohort stops' frame, for the cohort stops' reason (D188): a
      // filling column with NO bottom padding, so `marginTop: auto` on the
      // row puts it against the bottom of the content box and `.app-body`'s
      // own padding is the entire gap to the app's tab bar. This body ended
      // in 26px, which is exactly the float D188 measured and removed from
      // the others.
      padding: "4px 16px 0",
      flex: "1 0 auto", display: "flex", flexDirection: "column",
    } as React.CSSProperties}>
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">Your circle</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>
          {/* An empty circle keeps its header rather than being replaced by
              one — the stop has a name and a size, and "nobody yet" is a
              true size. */}
          {members.length
            ? <>{members.length} {members.length === 1 ? "person" : "people"}</>
            : <>Nobody yet</>}
        </div>
        {!!members.length && (
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
            {mutuals > 0
              ? <>By likeness · {mutuals} {mutuals === 1 ? "follows" : "follow"} you back</>
              : <>By likeness · following is one-way, nobody is told</>}
          </div>
        )}
      </div>

      {/* You at the centre, the people you kept around you, distance =
          unlikeness — the grammar every other stop in the Mirror speaks,
          finally spoken here. Only where a likeness exists to place them
          by: a member you share no answered question with has no honest
          radius, so the field draws the ones it can place and the list
          below it carries everyone.

          With nobody to place it is the rings and you, drawn by EmptyField
          rather than by the lazy engine (D172) — same picture, and no
          chunk fetched for a stop that has nothing to fold. */}
      {members.length ? (
        <>
          <React.Suspense fallback={null}>
            <PeopleField
              people={members.filter((m) => m.like.shared > 0).map((m) => ({
                id: m.uid, label: m.name || "", match: m.like.pct,
              }))}
              caption="closer to you = more alike"
              emptyLine={<>They take their places as you answer the same things.</>}
            />
          </React.Suspense>
          {soWhat && (
            <div style={{ padding: "7px 26px 0", textAlign: "center" }}>
              <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5, textWrap: "balance" }}>
                <b style={{ fontWeight: 800, color: "var(--ink)" }}>{soWhat.top.name}</b> mirrors you closest; <b style={{ fontWeight: 800, color: "var(--ink)" }}>{soWhat.low.name}</b> least — by the answers you share.
              </span>
            </div>
          )}
        </>
      ) : (
        // No caption: the header one line up already reads "Your circle",
        // and a chip repeating it is the duplication D172 removed.
        <EmptyField>
          Follow someone from a who-voted sheet and they appear here.
        </EmptyField>
      )}

      {/* The row, where every other stop's row is (D190). Tapping the open
          tab closes it, so the stop can return to the state it starts in. */}
      <div ref={rowRef} style={{ marginTop: "auto", paddingTop: 16 }}>
        <MirrorLensTabs tabs={CIRCLE_TABS} open={tab}
          onOpen={(id) => setTab(id === tab ? "" : id)} />
      </div>

      {tab === "people" && (
        <div className="fade-in" role="tabpanel" aria-label="People" style={{ paddingTop: 14 }}>
          {!members.length ? (
            <ClEmpty>Nobody yet — a follow is one tap from any who-voted sheet.</ClEmpty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {members.map((m) => (
                <div key={m.uid} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "9px 0", borderTop: CL_LINE }}>
                  <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, color: m.name ? "var(--ink)" : "var(--ink-3)" }}>
                    {m.name || "Someone"}
                    {m.mutual && (
                      <span style={{ marginLeft: 7, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 10.5, color: "var(--ink-3)" }}>
                        · follows you
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)" }}>
                    {m.like.shared
                      ? `${m.like.same}/${m.like.shared} alike`
                      : "nothing shared yet"}
                  </span>
                  {!!m.like.shared && (
                    <span style={{ width: 42, textAlign: "right", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
                      {m.like.pct}%
                    </span>
                  )}
                  <button onClick={() => void LIVE.setFollowing(m.uid, false)} style={{
                    border: CL_LINE, borderRadius: 999, padding: "3px 10px", cursor: "pointer",
                    fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11,
                    background: "transparent", color: "var(--ink-3)", WebkitAppearance: "none",
                  }}>Unfollow</button>
                </div>
              ))}
              {/* The definition stood here as a sentence and is now the rows
                  themselves: every one prints "5/6 alike" beside its own
                  percentage, which is the arithmetic rather than a description
                  of it. */}
            </div>
          )}
        </div>
      )}

      {tab === "answers" && (
        <div className="fade-in" role="tabpanel" aria-label="Answers" style={{ paddingTop: 14 }}>
          {/* The heading is the TAB now — "Where your circle splits" said
              in a kicker what the open tab already says, which is the
              caption docs/COPY.md keeps deleting. What survives is the
              sort, which is the reading: most divided first. */}
          {!rows.length ? (
            <ClEmpty>
              {/* Two answers is the floor for a "split" to mean anything, and
                  saying which floor it is beats a bare "no data". */}
              {members.length
                ? <>Fills in once two of them answer the same question.</>
                : <>Fills in once two people you follow answer the same question.</>}
            </ClEmpty>
          ) : rows.map(({ q, split }) => {
            const pct = pctFor(split.counts);
            const mine = myVotes[q.id];
            const mineIdx = mine == null ? -1 : Number(mine);
            return (
              <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 13 }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--ink)", lineHeight: 1.35 }}>{q.text}</span>
                <span style={{ display: "flex", height: 22, borderRadius: 7, overflow: "hidden", background: "var(--surface-2)" }}>
                  {pct.map((p, i) => (
                    <span key={i} title={`${q.options[i]?.label ?? ""} · ${p}%`} style={{
                      width: `${p}%`,
                      background: i === mineIdx ? "var(--accent)" : `color-mix(in oklch, var(--accent) ${38 - i * 9}%, var(--surface-2))`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--sans)", fontWeight: 800, fontSize: 10.5,
                      color: i === mineIdx ? "#fff" : "var(--ink-2)", overflow: "hidden", whiteSpace: "nowrap",
                    }}>{p >= 16 ? `${p}%` : ""}</span>
                  ))}
                </span>
                <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
                  {/* "of your circle" and never "of people": the denominator
                      is the members who answered THIS question, not the
                      circle's size, and conflating them would overstate a
                      consensus every time someone had not answered. */}
                  {split.n} of your circle answered
                  {mineIdx >= 0
                    ? <> · you said <strong style={{ color: "var(--ink-2)" }}>{q.options[mineIdx]?.label}</strong></>
                    : <> · you have not</>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "compare" && (
        <div className="fade-in" role="tabpanel" aria-label="Compare" style={{ paddingTop: 14 }}>
          <React.Suspense fallback={null}>
            {/* "your circle", the same noun the rows above use — the lens
                prints it in "You ↔ your circle". */}
            <CircleCompare pop={comparePop} whom="your circle"
              emptyThem={<>Fills in as the people you follow answer test cards.</>} />
          </React.Suspense>
        </div>
      )}
    </div>
  );
}

export default LiveCircleBody;
