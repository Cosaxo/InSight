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
import React from "react";
import LIVE from "../data/live";
// The rings-and-you drawing every other stop shows when it is empty (D171).
import EmptyField from "./EmptyField";
import { circleSplit } from "../data/circle";
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

const CL_LINE = "1px solid var(--rule)";

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

  const members = LIVE.circle();
  const loading = LIVE.circleLoading();

  if (loading && !members) {
    return <ClNote title="Loading your circle…">Reading what the people you follow have answered.</ClNote>;
  }
  if (!members) {
    // null after a settled load means the read failed — not that the
    // circle is empty. Saying "empty" here would tell someone with
    // thirty follows that they have none.
    return (
      <ClNote title="Couldn&rsquo;t load your circle">
        Something went wrong reading it. It will try again next time you
        open this stop.
      </ClNote>
    );
  }
  if (!members.length) {
    // The FIELD, not a paragraph (D171). Every other stop draws its rings
    // when it has nobody to place; Circle answered with a card of prose,
    // and it is one of the two stops a new account meets first. The
    // sentence still says how the field fills — it just no longer stands
    // where the drawing goes.
    //
    // No caption: the stop's own kicker one line up already reads "Your
    // circle", and a chip repeating it is the duplication this pass is
    // removing everywhere else.
    return (
      <EmptyField>
        Follow someone from a question&rsquo;s who-voted sheet, or from the
        People lens on Near or World, and they appear here.
      </EmptyField>
    );
  }

  // The questions the circle is most split on. Ranked by divisiveness
  // rather than by size, because a circle is small by construction and
  // "what do we disagree about" is the only interesting question to ask
  // of a group this size — "what do we agree about" is mostly a list of
  // things everyone answers the same way everywhere.
  const qs = LIVE.aggregated();
  const rows = qs
    .map((q) => ({ q, split: circleSplit(members, q.id, q.options.length) }))
    .filter((r) => r.split.n >= 2)
    // divisiveness computed once per surviving row rather than inside the
    // comparator, where it would re-run O(n log n) times per render —
    // same reasoning (and measurement) as LiveCohortBody's sort.
    .map((r) => ({ ...r, d: divisiveness(r.split.counts) }))
    .sort((a, b) => b.d - a.d || b.split.n - a.split.n)
    .slice(0, 12);

  const myVotes = LIVE.myVotes();
  const mutuals = members.filter((m) => m.mutual).length;

  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px", overflowY: "auto" }}>
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">Your circle</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>
          {members.length} {members.length === 1 ? "person" : "people"}
        </div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
          {mutuals > 0
            ? <>Ranked by how alike your answers are. {mutuals} of them {mutuals === 1 ? "follows" : "follow"} you back.</>
            : <>Ranked by how alike your answers are. Following is one-way — nobody is told.</>}
        </div>
      </div>

      {/* You at the centre, the people you kept around you, distance =
          unlikeness — the grammar every other stop in the Mirror speaks,
          finally spoken here. Only where a likeness exists to place them
          by: a member you share no answered question with has no honest
          radius, so the field draws the ones it can place and the list
          below it carries everyone. */}
      <React.Suspense fallback={null}>
        <PeopleField
          people={members.filter((m) => m.like.shared > 0).map((m) => ({
            id: m.uid, label: m.name || "", match: m.like.pct,
          }))}
          caption="closer to you = more alike"
          emptyLine={<>Nobody here shares an answered question with you yet —
            they take their places as you both answer the same things.</>}
        />
      </React.Suspense>

      <div style={{ display: "flex", flexDirection: "column", paddingTop: 6 }}>
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
                ? `${m.like.same}/${m.like.shared} the same`
                : "nothing in common yet"}
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
        <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 9 }}>
          {/* Same sentence the People lens carries, for the same reason: a
              likeness number nobody can explain is one nobody should
              trust. */}
          Share of the questions you have both answered where you picked the
          same option.
        </span>
      </div>

      <div style={{ marginTop: 22, borderTop: CL_LINE, paddingTop: 14 }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 9 }}>
          Where your circle splits
        </div>
        {!rows.length ? (
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55 }}>
            {/* Two answers is the floor for a "split" to mean anything, and
                saying which floor it is beats a bare "no data". */}
            Nobody in your circle has answered the same question twice over
            yet. This fills in as they answer.
          </div>
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
    </div>
  );
}

export default LiveCircleBody;
