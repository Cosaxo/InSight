// LiveCompareLens — the Mirror's Compare tab, live (D193).
//
// WHAT IT REPLACES. Compare shipped at D99 as a list of questions: your
// own pick inside each stop's split, ranked least-typical first. Every
// number on it was real, which is why five gates and eleven tests were
// green over it for ninety-odd decisions — and it was the wrong reading
// twice over. docs/MIRROR.md has described this lens since D99 as "you
// against them across every assessment, in the results profile's own
// visual language", which is what the prototype draws
// (spec/compare-breakdown.jsx) and what the owner asked for again. And
// the list was the ANSWERS tab with a different sort: `LiveAnswerRows`
// already draws every question of the same population with your pick
// marked and "62% of Oslo are with you" under it, plus the filters and
// the expander the lens never had.
//
// So this is the drawing, from measured data. The picture is the
// prototype's, imported rather than re-ported — `CBAssess` and
// `CBAlignGlyph` take two profiles and a hue family and know nothing
// about where either came from, so the only thing that had to change to
// make them live is what feeds them.
//
// WHAT IS NOT THE PROTOTYPE'S, and each difference is a refusal:
//
//   · the population is measured, never authored. The prototype's
//     "them" is six hand-written constants (spec/compare-pop.js: "Tuned,
//     not random"). Here it is the same fold the constellation places
//     cities by — `axisScores` over published per-option cells — or the
//     mean of a set's own completed instruments. data/compare.ts holds
//     both and neither invents an axis nobody answered.
//   · every figure states what it was measured over. A card that cannot
//     say how many axes and how many answers are behind it is the
//     authored constant wearing a measurement's clothes (D157).
//   · an instrument only ONE of you has is absent, not drawn against a
//     neutral 50 — the middle-of-the-road population `axisScores`
//     refuses to manufacture.
//   · no "Thinking" card. D103 retired that instrument; the prototype
//     still carries it and its own local hue family for it.
import React from "react";
import LIVE from "../data/live";
import {
  compareRead,
  cohortAxisMap,
  myAxisMap,
  peopleAxisMap,
  type AxisMap,
  type CompareCard,
  type CompareRead,
} from "../data/compare";
import {
  CORE_TEST_KINDS,
  parseTestResults,
  testItemMeta,
  voteIndices,
  type TestDefs,
} from "../data/similarity";
// The instrument definitions — dims, labels and the scoring metadata the
// item join runs on. Same pinned cast as LiveSimilarityField's; the shape
// is held by content-parity.test.jsx.
// @ts-expect-error TS7016 — untyped spec module
import { IS_TESTS } from "../spec/test-definitions.js";
// The results profile's own hue family and pole pairs, per instrument —
// what makes this drawing the same object as the result card (D121's one
// hue per instrument). An ordinary import: result-rose.jsx converted off
// the bridge at D39 and RP_TESTS is a named export.
// @ts-expect-error TS7016 — untyped spec module
import { RP_TESTS } from "../spec/result-rose.jsx";
// The prototype's rose-and-poles pair, exported at D193 for exactly this.
// @ts-expect-error TS7016 — untyped spec module
import { CBAssess, CBAlignGlyph } from "../spec/compare-breakdown.jsx";

const DEFS = IS_TESTS as TestDefs;
const CFG = RP_TESTS as Record<string, { hues?: Record<string, number>; poles?: Record<string, string[]> }>;

/**
 * Which population this stop is, and how its side of the comparison is
 * measured. The two are not interchangeable and the card says which one
 * it drew — see data/compare.ts's header for why there are two.
 *
 * `cells` carries its own floors because a floor is a claim about
 * SAMPLING: a city is a sample of a city and a mean of four answers there
 * is four people's mood, while a circle is the exact set you chose and
 * its mean is that set's mean at any size.
 */
export type ComparePop =
  | {
    basis: "cells";
    /** This population's dense 5-option counts for a bank item, or null. */
    cellOf: (qid: string) => readonly number[] | null;
    minAnswers: number;
    minItems: number;
  }
  | {
    basis: "people";
    /** The members — their public completed instruments are the source. */
    uids: readonly string[];
  };

const LC_LINE = "0.5px solid var(--rule)";

function LcNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px" }}>
      {children}
    </div>
  );
}

function LcKicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
      {children}
    </div>
  );
}

/** One instrument: the alignment figure, then the rose and its pole rows. */
function LcCard({ card, whom }: { card: CompareCard; whom: string }) {
  const cfg = CFG[card.kind] || {};
  const hueOf = (id: string, i: number) =>
    (cfg.hues && cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
  return (
    <div className="card" style={{ padding: "14px 15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <LcKicker>{card.title}</LcKicker>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            {card.align}<span style={{ fontSize: 11 }}>%</span>
          </span>
          <CBAlignGlyph align={card.align} accent="var(--accent)" />
        </div>
      </div>
      {/* The prototype's own pair, unchanged: your petal solid to your
          score, their value pinned on each slice as a washed dot, and the
          pole rows underneath sharing a highlight with it. */}
      <CBAssess dims={card.dims} themV={card.theirs} hueOf={hueOf} poles={cfg.poles} themLabel={whom} />
    </div>
  );
}

function LiveCompareLens({ pop, whom, emptyThem }: {
  pop: ComparePop;
  /** The population, as a noun the header can put beside "You ↔". */
  whom: string;
  /** What to say when THEY have no profile yet — only the host knows why. */
  emptyThem: React.ReactNode;
}) {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);
  // The `people` basis reads their public results out of the shared
  // profile cache, which `loadNames` fills (names, scores and faces come
  // off the same document). Keyed on the uid LIST rather than the array —
  // the hosts rebuild that array on every notify, and an effect keyed on
  // it would re-ask for scores it already holds. A no-op for the `cells`
  // basis, which reads counts the stop already has.
  const uidKey = pop.basis === "people" ? pop.uids.join(",") : "";
  React.useEffect(() => {
    if (uidKey) void LIVE.loadNames(uidKey.split(","));
  }, [uidKey]);
  // After the hooks: an early return above them would change the hook
  // order between renders (react-hooks/rules-of-hooks).
  if (!LIVE.enabled) return null;

  const items = testItemMeta(LIVE.testFeedItems(), DEFS);
  // Yours: a completed instrument where you have one, your own feed
  // answers to that instrument's items where you have not — so this fills
  // in from ordinary answering rather than waiting on a sit-down test.
  const mine = myAxisMap(
    parseTestResults(LIVE.myTestResults(), CORE_TEST_KINDS),
    items, DEFS, voteIndices(LIVE.myVotes()),
  );

  let theirs: AxisMap;
  let theirN: Record<string, Record<string, number>> | undefined;
  // What THEIR side stands on, said out loud — the rule this module
  // inherits from testNorms (D157): a figure that cannot say what it was
  // measured over is an authored constant in a measurement's clothes. The
  // two bases count different things, so they say different things.
  let basis: (read: CompareRead) => React.ReactNode;
  if (pop.basis === "cells") {
    const fold = cohortAxisMap(DEFS, items, pop.cellOf, pop.minAnswers, pop.minItems);
    theirs = fold.axes;
    theirN = fold.n;
    // `r.answers`, not the fold's total: the fold may have measured
    // instruments this comparison never drew, and resting five axes on a
    // count of eleven would overstate them.
    basis = (r) => <>{r.answers.toLocaleString()} test {r.answers === 1 ? "answer" : "answers"}</>;
  } else {
    const fold = peopleAxisMap(DEFS, pop.uids.map((u) => LIVE.scoresFor(u)));
    theirs = fold.axes;
    // People rather than answers, and counted over the whole roster so
    // the denominator is the population the tab names.
    //
    // `peopleIn(the drawn kinds)`, not `fold.people` (D229) — the same
    // refusal the `cells` branch makes eight lines up. The fold measures
    // every instrument the roster has finished, and a set whose only card
    // is Big Five would otherwise print the three people who between them
    // also finished Politics. The numerator now counts the people the
    // cards on screen actually rest on; the denominator stays the roster,
    // so somebody missing is stated rather than dropped from both.
    basis = (r) => <>{fold.peopleIn(r.cards.map((c) => c.kind))} of {pop.uids.length} have taken one</>;
  }

  const read = compareRead(DEFS, CORE_TEST_KINDS, mine, theirs, theirN);

  if (!read.cards.length) {
    // Three emptinesses, kept apart. Collapsing them would tell someone
    // who has taken every test that they have taken none.
    const mineN = Object.keys(mine).length;
    const themN = Object.keys(theirs).length;
    return (
      <LcNote>
        {!mineN
          ? <>Fills in as you answer the test cards in your feed.</>
          : !themN
            ? emptyThem
            : <>No instrument you have both answered enough of yet.</>}
      </LcNote>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card" style={{ padding: "14px 15px" }}>
        <LcKicker>You &harr; {whom}</LcKicker>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 40, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            {read.overall}<span style={{ fontSize: 21 }}>%</span>
          </span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 600, color: "var(--ink-2)" }}>aligned</span>
        </div>
        {/* The basis, because a likeness nobody can explain is a likeness
            nobody should trust — the same line the People lens prints
            under Kindred. Axes first: that is what the percentage is a
            mean OVER, and the answer count is what those axes stand on. */}
        <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>
          mean gap across {read.axes} {read.axes === 1 ? "axis" : "axes"} &middot; {basis(read)}
        </div>
        {/* Solid is you and washed is them, on every rose and every pole
            row below. An encoding the reader cannot infer, which is what a
            legend is for (docs/COPY.md §3). */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 11, borderTop: LC_LINE }}>
          {[["you", "var(--accent)"], [whom, "color-mix(in oklch, var(--accent), transparent 52%)"]].map(([label, fill]) => (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--ink-3)", minWidth: 0 }}>
              <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: 99, background: fill, flexShrink: 0 }}></span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            </span>
          ))}
        </div>
      </div>
      {read.cards.map((c) => <LcCard key={c.kind} card={c} whom={whom} />)}
    </div>
  );
}

export default LiveCompareLens;
