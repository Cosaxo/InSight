// The Mirror's lens row, live (D99).
//
// The prototype's Mirror is two levels: WHO (the ruler) and WHAT (a row of
// lenses under it). Live mode has shipped the ruler and no lenses since the
// port, and until D98 the reason was real — four of the five needed data
// the privacy model forbade reading.
//
// It no longer forbids anything, so this is the row coming back. Four
// lenses, each built on a source that exists today:
//
//   People   the cohort's demographic mix (a fold over `agg.by`) and
//            Kindred, the people whose answers most match yours
//            (data/cohort.ts `agreement`, over the cached voter lists).
//   Compare  you against this population as whole profiles — the
//            prototype's rose-and-poles drawing over measured axes
//            (ui/LiveCompareLens.tsx, D193). It shipped as a list of
//            questions and that was the Answers tab re-sorted; the
//            section comment on CohortCompare has the account.
//   Scores   the place scorecard: what this population gives the place it
//            is standing in, facet by facet, with your own score ticked
//            onto their bar (D100, corrected at D187).
//   Explore  pick a trait slice and see what it believes, led by where it
//            differs from everyone — `divergence`.
//
// SCORES WAS REFUSED HERE UNTIL D100, and the note said the bank shipped
// no `rate` questions so the lens would be an empty frame. D100 answered
// that the lens could filter on question TYPE instead — an ordinal
// question is an ordinal question whether its subject is a city or your
// own outlook — and shipped it over the bank's `rating` and `scale`
// items. The refusal was right and the answer was not: what a scorecard
// of a place needs is not a number, it is a number ABOUT THE PLACE, and
// filtering on type gave the City stop a card led by "Breakfast is the
// best meal of the day". D187 wrote the questions the refusal was
// waiting for and gave them a subject the lens can read (`rates`); the
// section comment on ScoresLens has the full account.
//
//   Answers  is NOT in this file, and since D119 that is a division of
//            labour rather than an absence: it is the host's own body
//            (LiveCohortBody) and a peer tab in the row above, not the
//            page these four hang under. D100 gave it the branch filter,
//            the sort and the expand-a-row it was missing.
//
// Every reading here is drawn from documents already fetched for another
// purpose — the deck's aggregates and the who-voted voter lists — with the
// single exception of Kindred, which pays for voter lists the user has not
// opened. That one is behind its own tab and fetches on first view.
import React from "react";
import LIVE from "../data/live";
import { cityIsConfirmed } from "../data/cityConfirm";
import {
  COHORT_DIMS, DIM_LABEL, divergenceFor, meanScore, mixFor, pctFor,
  type Score,
} from "../data/cohort";
// D125: these two lenses printed the raw bucket KEY, so a country row read
// "NO" and a city row "Oslo, NO". One resolver, shared with the feed's
// breakdown sheet, so the same cohort is named the same everywhere.
import { bucketLabel } from "./cohortLabels";
import TypeMixCard from "./TypeMixCard";
// The People lens draws people rather than listing them (D152): the
// prototype's match ring, a per-person hue, and the place name behind a
// city key.
import PLACES from "../data/places";
import { angleHash } from "../data/similarity";
import { TYPE_TEST, typeOfPerson, type TypedPerson } from "../data/typeMix";
// @ts-expect-error TS7016 — untyped spec module (the LiveSimilarityField pattern)
import { MatchRing } from "../spec/primitives.jsx";
// The type's own glyph, the same one TypeMixCard draws its rows with — so a
// badge on a person and a row in the population are one object (D156).
// @ts-expect-error TS7016 — untyped spec module
import { TypeMark } from "../spec/type-marks.jsx";
// The row's own types and labels live next door: eslint's react-refresh
// rule wants a component file to export only components, and it is right
// that a constant shared with the host does not belong in one.
import Avatar from "./Avatar";
// The Compare tab's whole body (D193). A static import rather than a lazy
// one: this module IS the lazy lens chunk, so the drawing rides the same
// fetch the row already pays for when a lens is opened.
import LiveCompareLens from "./LiveCompareLens";
// The meaning floors an axis must clear before a PLACE's mean is drawn as
// that place's centre. Shared with the result cards' "most people" ring
// rather than re-picked here — one number, one reason (D157).
import { NORM_MIN_ANSWERS, NORM_MIN_ITEMS } from "../data/testNorms";
import { ORDINAL_TYPES, type LensId, type LensQuestion } from "./lensDefs";
// D136 removed the Foresight lens from this row, so the import of
// ./LiveForesightLens went with it. The component and data/foresight.ts
// are deliberately still in the tree, still tested — see lensDefs' note on
// the LensId union for why, and what re-adding costs.

const LL_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";


function LlBar({ pct, labels, mark }: { pct: number[]; labels: string[]; mark?: number }) {
  return (
    <span style={{ display: "flex", height: 22, borderRadius: 7, overflow: "hidden", background: "var(--surface-2)" }}>
      {pct.map((p, i) => (
        <span key={i} title={`${labels[i]} · ${p}%`} style={{
          width: `${p}%`,
          background: i === mark ? "var(--accent)" : `color-mix(in oklch, var(--accent) ${38 - i * 9}%, var(--surface-2))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--sans)", fontWeight: 800, fontSize: 10.5,
          color: i === mark ? "#fff" : "var(--ink-2)", overflow: "hidden", whiteSpace: "nowrap",
        }}>{p >= 14 ? `${p}%` : ""}</span>
      ))}
    </span>
  );
}

// One tap, no pending state, no notification to the other side — the
// whole point of D101's design is that a follow grants no access D98 had
// not already granted, so there is nothing to request.
function FollowButton({ uid }: { uid: string }) {
  const following = LIVE.isFollowing(uid);
  return (
    <button
      onClick={() => void LIVE.setFollowing(uid, !following)}
      aria-pressed={following}
      style={{
        border: LL_LINE, borderRadius: 999, padding: "3px 10px", cursor: "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11, WebkitAppearance: "none",
        background: following ? "var(--ink)" : "transparent",
        color: following ? "var(--surface)" : "var(--ink-2)",
      }}
    >{following ? "Following" : "Follow"}</button>
  );
}

function LlEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px" }}>
      {children}
    </div>
  );
}

// ── People ──────────────────────────────────────────────────────────
//
// THE PROTOTYPE'S SHAPE, RESTORED (D152). This lens shipped as a chip row
// over horizontal bars, then a flat list of names with a percentage each.
// Every number on it was real and the screen said almost nothing: a bar
// chart of age bands is a fact about a form people filled in, and a name
// beside "68%" is a score without a person attached to it.
//
// The prototype answers "who is here" in two registers and this now does
// the same:
//
//   1. WHO'S HERE — one card: the population's size, then its age
//      distribution as a histogram with YOUR band marked, then its gender
//      split as one bar. A shape you read in a glance rather than a table
//      you parse.
//   2. KINDRED — the strangers most aligned with you, as CARDS: a match
//      ring whose fullness is the likeness, who they are on the headline
//      ("Ceramicist · 25-34"), their type as a badge, and the rest of
//      their anchors as chips.
//
// WHAT IS NOT HERE, and each absence is a refusal rather than a gap:
//
//   - The prototype's third band ("TIME ON INSIGHT · new / regulars /
//     veterans"). Nothing publishes a join date, and a made-up tenure
//     split is exactly the furniture D1 exists to keep off a live screen.
//   - Its shared-interest chips ("pottery · fermentation · Murakami").
//     Stated interests are LOCAL and the viewer's own (data/interests.ts,
//     D128) — the Mirror is named in that module as a surface that may not
//     read them, and another person's are not readable at all. The chips
//     here are their frozen ANSWER anchors, which are public (D98) and are
//     the same source the cohort above them is folded from.
//   - An exact median age. The anchor is a BAND, so the median is a band,
//     and the card says the band rather than inventing the year inside it.

/** Age bands in reading order, so the histogram is a scale and not a rank. */
const AGE_ORDER = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function PlKicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
      {children}
    </div>
  );
}

/**
 * The population's own portrait — size, age shape, gender split.
 *
 * Every figure is a fold over `agg.by`, which is already in hand for the
 * stop. Counted in ANSWERS, and the card says so once at the foot rather
 * than qualifying every number: someone who answered ten questions is in
 * these bars ten times, and calling that a headcount would be the small
 * lie this app is built not to tell.
 */
function WhosHere({ qs, shortName }: { qs: LensQuestion[]; shortName: string }) {
  const tallyOf = (dim: string): Record<string, number> => {
    const t: Record<string, number> = {};
    for (const q of qs) {
      for (const b of mixFor(q.by, dim, q.options.length)) t[b.bucket] = (t[b.bucket] || 0) + b.n;
    }
    return t;
  };
  const age = tallyOf("ageBand");
  const gender = tallyOf("gender");
  const mine = LIVE.anchors() || {};

  const ageRows = AGE_ORDER.filter((b) => age[b]).map((b) => ({ b, n: age[b] }));
  // Any band the server published that this list does not name — a vocab
  // that moved, or a band added server-side first. Appended rather than
  // dropped: a bar missing from a histogram is a silent claim that nobody
  // is there.
  for (const b of Object.keys(age)) if (!AGE_ORDER.includes(b)) ageRows.push({ b, n: age[b] });
  const ageTotal = ageRows.reduce((a, r) => a + r.n, 0);
  const ageMax = ageRows.reduce((m, r) => Math.max(m, r.n), 0);
  // The MEDIAN BAND — the band the middle answer falls in. Not an age:
  // the anchor is a band, so this is as fine as the data honestly goes.
  //
  // A plain loop rather than a `find` over a mutated accumulator: the
  // React Compiler refuses a closure that reassigns after render, and it
  // is right to — the same expression run twice would give a different
  // answer.
  const median = (() => {
    let seen = 0;
    for (const r of ageRows) {
      seen += r.n;
      if (seen >= ageTotal / 2) return r.b;
    }
    return "";
  })();

  const genderRows = Object.keys(gender).map((b) => ({ b, n: gender[b] })).sort((x, y) => y.n - x.n);
  const genderTotal = genderRows.reduce((a, r) => a + r.n, 0);

  if (!ageTotal && !genderTotal) {
    return <LlEmpty>No ages or genders here yet.</LlEmpty>;
  }

  return (
    <div className="card" style={{ padding: "14px 15px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 15.5, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--ink)" }}>
          Who&rsquo;s here
        </div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", marginTop: 2 }}>
          in {shortName}
        </div>
      </div>

      {/* Two figures side by side, the prototype's hero row. The second is
          a band rather than a number, and reads as one. */}
      <div style={{ display: "flex", gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            {ageTotal.toLocaleString()}
          </div>
          <PlKicker>answers with an age</PlKicker>
        </div>
        {median && (
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--sans)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {median}
            </div>
            <PlKicker>median band</PlKicker>
          </div>
        )}
      </div>

      {!!ageTotal && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <PlKicker>Age</PlKicker>
            <span style={{ flex: 1 }} />
            {mine.ageBand && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--sans)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }}></span>
                you
              </span>
            )}
          </div>
          {/* A histogram, not a ranked bar list. The order is the scale's,
              so the SHAPE of the crowd is the thing you see — and your own
              band is filled rather than annotated, which is how you find
              yourself in it without reading a single label. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 74 }}>
            {ageRows.map((r) => {
              const isMine = mine.ageBand === r.b;
              return (
                <div key={r.b} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
                  <span title={`${r.b} · ${r.n}`} style={{
                    width: "100%", borderRadius: 5,
                    height: Math.max(3, Math.round((r.n / (ageMax || 1)) * 56)),
                    background: isMine ? "var(--accent)" : "color-mix(in oklch, var(--accent) 22%, var(--surface-2))",
                  }}></span>
                  <span style={{
                    fontFamily: "var(--sans)", fontSize: 9.5, fontWeight: isMine ? 800 : 600,
                    color: isMine ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
                  }}>{r.b}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!!genderTotal && (
        <div>
          <PlKicker>Gender</PlKicker>
          <div style={{ display: "flex", height: 26, borderRadius: 7, overflow: "hidden", marginTop: 8 }}>
            {genderRows.map((r, i) => {
              const pct = Math.round((r.n / genderTotal) * 100);
              return (
                <span key={r.b} title={`${r.b} · ${pct}%`} style={{
                  width: `${pct}%`, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `color-mix(in oklch, var(--accent) ${64 - i * 20}%, var(--surface-2))`,
                  fontFamily: "var(--sans)", fontWeight: 800, fontSize: 11,
                  color: i === 0 ? "#fff" : "var(--ink-2)", overflow: "hidden", whiteSpace: "nowrap",
                }}>{pct >= 12 ? `${pct}%` : ""}</span>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 7 }}>
            {genderRows.map((r, i) => (
              <span key={r.b} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>
                <span aria-hidden="true" style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: `color-mix(in oklch, var(--accent) ${64 - i * 20}%, var(--surface-2))`,
                }}></span>
                {bucketLabel("gender", r.b).toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* "Answers, not people" stood here and is gone (D183). It is not a
          claim the card stopped making — it is one the KICKER makes, on
          the figure itself: "answers with an age" is the unit printed on
          the number it qualifies, which is the only place a unit belongs.
          The footnote was that unit said a second time, further from the
          number, in smaller type. */}
    </div>
  );
}

/**
 * One kindred stranger, as the prototype draws them.
 *
 * The headline is who they are rather than what they are called, because
 * that is the interesting half: "Ceramicist · 25-34" tells you something
 * a name does not. The name follows it when there is one — D98 makes it
 * public, and hiding it here would be a privacy gesture with no privacy
 * in it.
 */
function KindredCard({ p }: { p: TypedPerson & { anchors?: Record<string, string> } }) {
  const a = p.anchors || {};
  const pct = p.like.pct;
  // A stable hue per person, so a card keeps its colour between renders
  // and two people are told apart at a glance. Decorative and claims
  // nothing — the same device LiveSimilarityField's field uses.
  const hue = Math.round(angleHash(p.uid + "#hue") * 360);
  // The exact age where the profile has published one, the band where it
  // has not (D155). The sample reads "Ceramicist, 29" and this read
  // "Ceramicist · 25-34" — a cell rather than a person, which is the
  // opposite of what a Kindred card is for. Answers written before the age
  // anchor existed carry only the band, and they keep it rather than
  // losing the line: a coarser true fact beats none.
  const title = [a.profession, a.age || a.ageBand].filter(Boolean).join(" · ");
  // The chips are the anchors NOT already spent on the headline. City
  // included: at the World stop it is the most interesting thing about
  // someone, and at City it is what they have in common with you.
  const chips = [a.city && (PLACES.parse(a.city)?.name || a.city), a.education, a.relationship]
    .filter(Boolean) as string[];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 12px",
      background: "var(--surface)", border: LL_LINE, borderRadius: 14,
    }}>
      <MatchRing pct={pct} color={`oklch(0.52 0.13 ${hue})`} size={50} title={`${pct}% alike`}>
        {/* THE FACE, WHERE THE GENERIC BODY GLYPH WAS (D178). A photo is a
            profile field, so it draws anywhere a person is already named,
            and this card names one. Avatar falls back to initials and,
            failing those, to the same anonymous shape this used to be —
            most accounts will never set a picture, and that has to look
            deliberate rather than empty. */}
        <Avatar uid={p.uid} name={p.name} size={36} />
      </MatchRing>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.015em", color: "var(--ink)" }}>
            {title || p.name || "Someone"}
          </span>
          {/* The type, as a badge carrying the type's own MARK — the
              prototype's TypeChip, which is what a person is labelled with
              wherever one is listed. It wore a hue dot until D156's sweep:
              that dot came from `angleHash(uid)`, so it was decorative,
              and it sat in the one place on the card where a reader would
              take it for a reading. The mark is the reading — the same
              glyph the TypeMix card draws each type with, so the badge on
              a person and the row in the population are the same object.

              Only where the person has finished the instrument;
              typeOfPerson returns null otherwise and no badge is drawn,
              rather than a guess. */}
          {p.type && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
              border: LL_LINE, borderRadius: 999, padding: "2px 9px 2px 4px",
              fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-2)",
              background: "var(--surface-2)", whiteSpace: "nowrap",
            }}>
              <TypeMark testKey={TYPE_TEST} name={p.type} size={16} />
              {p.type}
            </span>
          )}
        </div>
        {/* The name is the second line when the headline is who-they-are,
            and the headline itself when they have set no profession. */}
        {title && p.name && (
          <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", marginTop: 1 }}>
            {p.name}
          </div>
        )}
        {!!chips.length && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            {chips.map((c) => (
              <span key={c} style={{
                fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500,
                color: `oklch(0.38 0.10 ${hue})`, padding: "2px 9px", borderRadius: 99,
                background: `oklch(0.95 0.025 ${hue})`, border: `0.5px solid oklch(0.86 0.045 ${hue})`,
              }}>{c}</span>
            ))}
          </div>
        )}
        {/* A ratio, read as one. "5 of 6 the same" is a sentence fragment
            the eye has to assemble; "5/6 alike" is the same fact as a
            glyph, next to a ring that already draws it. */}
        <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
          {p.like.same}/{p.like.shared} alike
        </div>
      </div>
      <FollowButton uid={p.uid} />
    </div>
  );
}

function PeopleLens({ qs, scope, shortName }: {
  qs: LensQuestion[]; scope: "city" | "country" | "world"; shortName: string;
}) {
  React.useEffect(() => { void LIVE.loadKindred(); }, []);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);

  // The ranked people. `kindredPeople` carries the frozen anchors and the
  // parsed scores from the SAME cached voter rows the ranking is computed
  // over, so the card costs no read the list has not already paid for.
  const ranked = LIVE.kindredPeople()
    .filter((p) => p.like.shared >= 2)
    .sort((a, b) => b.like.pct - a.like.pct
      || b.like.shared - a.like.shared
      || a.uid.localeCompare(b.uid));
  // Typed AFTER the cut, not before. `typeOfPerson` runs the archetype
  // matcher — ~13 types scored over the person's axes, with its own
  // allocations — and the list it was mapped over is the whole cached
  // sample: KINDRED_QUESTIONS × VOTER_FETCH_CAP is up to ~2,400 distinct
  // people, against the twelve cards below. Nothing between the map and
  // the slice read `type`, and `.map` cannot change a length, so the two
  // empty branches keep reading the uncut list and say the same thing.
  const shown = ranked.slice(0, 12).map((p) => ({ ...p, type: typeOfPerson(p) }));
  const loading = LIVE.kindredLoading();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <WhosHere qs={qs} shortName={shortName} />

      <div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 15.5, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--ink)" }}>
          Kindred
        </div>
        {/* The second clause said what the ring already shows. A legend for
            a shape the reader is looking at is words spent on the visual's
            job. */}
        <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", marginTop: 2, marginBottom: 10, lineHeight: 1.5 }}>
          who answers most like you
        </div>
        {loading && !ranked.length ? (
          <LlEmpty>Matching…</LlEmpty>
        ) : !ranked.length ? (
          <LlEmpty>Fills in as you answer more.</LlEmpty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((p) => <KindredCard key={p.uid} p={p} />)}
            {/* The metric, in one sentence, on the screen that uses it —
                a likeness number nobody can explain is a number nobody
                should trust. */}
            <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.5 }}>
              same picks &divide; shared &middot; last {LIVE.kindredDepth()}
            </span>
          </div>
        )}
      </div>

      {/* Types here (D141, v25 shape — owner's direction): the share of
          each type in this population, BELOW Kindred. A reading, not a
          directory — no people, only proportions, over the same cached
          voter sample Kindred reads. */}
      <TypeMixCard scope={scope} />
    </div>
  );
}

// ── Compare ─────────────────────────────────────────────────────────

/**
 * Compare — you against this place, profile against profile (D193).
 *
 * WHAT STOOD HERE UNTIL D193: `pctFor` on your own option, question by
 * question, ranked least-typical first. A correct reading of real counts,
 * and the wrong one twice over — it is what docs/MIRROR.md has described
 * this lens as NOT being since D99 ("you against them across every
 * assessment, in the results profile's own visual language"), and it was
 * the Answers tab with a different sort, since `LiveAnswerRows` draws the
 * same population's every question with your pick marked and "62% of Oslo
 * are with you" underneath. ui/LiveCompareLens.tsx is the drawing; this
 * is only the part that knows which cells a place is.
 *
 * The cells are the stop's own — D170's rule, unchanged by the change of
 * reading: the City stop folds the city's cell, Country its country's,
 * World the globe. The FLOORS are testNorms', because a place is a sample
 * of a place: below them an axis is a handful of people's mood drawn as a
 * population's centre, which is the failure D157 removed from the result
 * cards and must not be reintroduced one tab over.
 */
function CohortCompare({ scope, shortName }: {
  scope: "city" | "country" | "world"; shortName: string;
}) {
  // NO LOADER HERE, deliberately. The test-item aggregates this fold
  // reads are the constellation's, and the constellation is the permanent
  // head of all three of these stops (D136) — it asks for them on arrival
  // and never unmounts, so they are in flight before this tab can be
  // tapped. Asking again would not be free either: `loadSimilarity`
  // early-returns on the agg sweep but still awaits `loadKindred`, which
  // is the People lens's own cost gate — so a courtesy call here would
  // charge Compare for voter lists nobody asked for
  // (LiveCohortBody.test.tsx pins that the row costs nothing to navigate).
  const city = LIVE.myCity;
  const country = city ? (PLACES.parse(city)?.country || "") : "";
  const key = scope === "city" ? city : country;
  const cellOf = React.useCallback((qid: string): number[] | null => {
    const agg = LIVE.aggFor(qid);
    if (!agg) return null;
    const raw = scope === "world" ? agg.counts : agg.by?.[scope]?.[key];
    if (!raw) return null;
    // Dense to the 5-point scale the instruments are written on — the
    // same shape testNorms builds for the globe.
    return Array.from({ length: 5 }, (_, i) => Number(raw[String(i)]) || 0);
  }, [scope, key]);

  return (
    <LiveCompareLens
      pop={{ basis: "cells", cellOf, minAnswers: NORM_MIN_ANSWERS, minItems: NORM_MIN_ITEMS }}
      whom={shortName}
      emptyThem={<>Nobody in {shortName} has answered a test card yet.</>}
    />
  );
}

// ── Explore ─────────────────────────────────────────────────────────

function ExploreLens({ qs }: { qs: LensQuestion[] }) {
  const [dim, setDim] = React.useState<string>("ageBand");
  const [bucket, setBucket] = React.useState<string>("");

  // Buckets available across the questions in view, biggest first.
  const tally: Record<string, number> = {};
  for (const q of qs) {
    for (const b of mixFor(q.by, dim, q.options.length)) tally[b.bucket] = (tally[b.bucket] || 0) + b.n;
  }
  const buckets = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
  const picked = buckets.includes(bucket) ? bucket : buckets[0] || "";
  // The name for the sentences below. `picked` stays the KEY — it is what
  // indexes the fold — and only the copy is resolved (D125).
  const pickedName = picked ? bucketLabel(dim, picked) : "";

  // The rows this slice disagrees with everyone about, most first.
  //
  // `all`, not `counts` (D170): Explore's slices are cuts of everyone and
  // its sentence ends "same as everyone", so the globe is the right
  // baseline on every stop. Compare and Scores read `counts`, which is the
  // stop's own cohort.
  //
  // ONE bucket, not all of them. This asked `divergence` for every bucket
  // of the dim and `.find`-ed the picked one out — per question, over the
  // whole archive, on every render — and `sliceSplit` re-read the same
  // cell a second time to get the split it had already computed.
  // `divergenceFor` is that expression with the discarded work removed;
  // it goes null on exactly the condition `sliceSplit` did, and its `pct`
  // is the split.
  const rows = picked
    ? qs.map((q) => {
      const d = divergenceFor(q.by, dim, picked, q.all, q.options.length);
      if (!d) return null;
      return { q, split: d.pct, overall: pctFor(q.all), gap: d.gap, on: d.optionIdx };
    }).filter(Boolean).sort((a, b) => b!.gap - a!.gap)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {COHORT_DIMS.map((d) => (
          <button key={d} onClick={() => { setDim(d); setBucket(""); }} style={{
            border: LL_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
            fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12,
            background: dim === d ? "var(--ink)" : "var(--surface)",
            color: dim === d ? "var(--surface)" : "var(--ink)", WebkitAppearance: "none",
          }}>{DIM_LABEL[d]}</button>
        ))}
      </div>
      {!buckets.length ? (
        <LlEmpty>No answers carry a {DIM_LABEL[dim].toLowerCase()} yet.</LlEmpty>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {buckets.map((b) => (
              <button key={b} onClick={() => setBucket(b)} style={{
                border: LL_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12,
                background: picked === b ? "var(--accent)" : "var(--surface)",
                color: picked === b ? "#fff" : "var(--ink-2)", WebkitAppearance: "none",
              }}>{bucketLabel(dim, b)} · {tally[b]}</button>
            ))}
          </div>
          {!rows.length ? (
            <LlEmpty>Nothing from {pickedName} yet.</LlEmpty>
          ) : rows.map((r) => (
            <div key={r!.q.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--ink)", lineHeight: 1.35 }}>{r!.q.text}</span>
              <LlBar pct={r!.split} labels={r!.q.options} mark={r!.q.mine >= 0 ? r!.q.mine : undefined} />
              <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
                {/* The subject is the chip the reader just tapped, lit in
                    the accent directly above — repeating it on every row
                    spends a noun per row to say what the selection says. */}
                {r!.gap > 0
                  ? <><strong style={{ color: "var(--ink-2)" }}>{r!.gap} pts</strong> {r!.split[r!.on] > r!.overall[r!.on] ? "more" : "less"} likely to say {r!.q.options[r!.on]}</>
                  : <>Same as everyone.</>}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Scores ──────────────────────────────────────────────────────────
//
// The place scorecard: what this population gives the place it is
// standing in, facet by facet, best first, with your own score beside
// theirs.
//
// IT DREW THE WRONG QUESTIONS UNTIL D187, and the failure is worth
// keeping because every gate in the tree was green while it shipped.
// D100 read the prototype's Scores as "average the ordinal questions"
// and built exactly that — which is a true average of a real crowd, and
// says nothing whatever about the place the card is named after. On a
// device the City stop's scorecard led with "Breakfast is the best meal
// of the day · 3.4 / 5", under the heading "How Oslo rated them".
//
// The subject of a question is not derivable from its counts, its type
// or its branch: "How safe do you feel walking home at night?" and
// "It's okay to do nothing sometimes" are both ordinal, both answered by
// the same people, and only one of them is about Oslo. So the question
// declares it — `rates: "city" | "country" | "world"` — and this lens
// draws only what names the stop it is standing on. City reads its city
// cell, Country its country cell, World the globe (the cell is the
// host's, D170), and a question that rates no place is not on this card
// at all. Its average is not lost: the Answers tab leads every ordinal
// row with the same number (`headlineFor`, D120).
//
// The type filter stays under the subject filter rather than being
// replaced by it. `rates` says what a question is about; ORDINAL_TYPES
// says whether averaging it means anything, and a place question written
// as a `choice` would otherwise render a confident mean of nothing.

function ScoresLens({ qs, shortName, scope }: {
  qs: LensQuestion[];
  shortName: string;
  scope: "city" | "country" | "world";
}) {
  // Whether this reader's own scores reach the city cell (D205). Only the
  // CITY scope is gated — a country is coarse enough that the timezone
  // hint D90 already lands it, and gating it would be a second decision
  // dressed as a consequence of this one.
  const unconfirmed = scope === "city" && LIVE.enabled && !cityIsConfirmed((LIVE.anchors() || {}).city);
  const rates = qs.filter((q) => q.rates === scope);
  const scored = rates
    .filter((q) => ORDINAL_TYPES.has(q.type || ""))
    .map((q) => ({ q, score: meanScore(q.counts), mine: q.mine >= 0 ? q.mine + 1 : null }))
    .filter((r): r is { q: LensQuestion; score: Score; mine: number | null } => !!r.score)
    .sort((a, b) => b.score.mean / b.score.max - a.score.mean / a.score.max);

  if (!scored.length) {
    // Two different emptinesses, and collapsing them would hide which one
    // this is. Neither is "withheld" — that category is gone (D98).
    //
    // The first is now also the shape a pre-D187 bank takes: the questions
    // exist in `content/` and the seeded docs carry no `rates` until an
    // operator reseeds, so the card is empty rather than wrong. That is
    // the direction to be wrong in — the whole point of the change.
    return (
      <LlEmpty>
        {rates.length
          ? <>Nobody here has scored {shortName} yet.</>
          : <>Nothing scored yet — questions that rate {shortName} land here.</>}
      </LlEmpty>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        {/* The one thing the ruler, the tab and the rows do not already
            say: the crowd and the subject are the same people. Everything
            else on this line would be a caption for a shape the reader is
            looking at (docs/COPY.md). */}
        How {shortName} rates itself · best first
      </div>
      {unconfirmed && (
        // The one sentence this card owes a reader whose scores are not in
        // it (D205). It is a CLAIM and a remedy, not a caption for a shape
        // — docs/COPY.md §3 — so it earns the sentence the rule would
        // otherwise refuse. Only on City, and only when the phone has
        // never agreed: for everyone else the number simply includes them
        // and there is nothing to explain.
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45, textWrap: "pretty" }}>
          Confirm your city in your profile to have your scores count for {shortName}.
        </div>
      )}
      {scored.map(({ q, score, mine }) => {
        const frac = score.mean / score.max;
        return (
          <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              {/* The bank's own short label, the prompt only when a doc
                  carries none (D187). Eight nouns down a shared baseline
                  is a shape; eight questions is a list you read one at a
                  time, and the sort that makes the shape readable is
                  wasted on it. */}
              <span style={{ flex: 1, fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--ink)", lineHeight: 1.35 }}>{q.tag || q.text}</span>
              {/* The scale's top ships with the number, always. "6.2"
                  means opposite things out of 10 and out of 5, and this
                  list mixes both. */}
              <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                {score.mean}
              </span>
              <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 11.5, color: "var(--ink-3)" }}>/ {score.max}</span>
            </div>
            <span style={{ display: "block", height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden", position: "relative" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round(frac * 100)}%`, background: "var(--accent)" }}></span>
              {mine != null && (
                // Your own score as a tick on their bar rather than a
                // second bar: the comparison IS the reading, and two bars
                // make it a lookup.
                <span aria-hidden="true" style={{
                  position: "absolute", top: -2, bottom: -2, width: 2.5, borderRadius: 2,
                  left: `calc(${Math.round((mine / score.max) * 100)}% - 1.25px)`,
                  background: "var(--ink)",
                }}></span>
              )}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
              {mine == null
                ? <>{score.n.toLocaleString()} {score.n === 1 ? "answer" : "answers"} · you have not rated it</>
                /* One answer is not an average, and when you are the one
                   who gave it "exactly the average" is you compared with
                   yourself — which is what the release printed, under the
                   then-heading "How Oslo rated it" (D170). Said as a count
                   instead: true whoever the answer belongs to, which
                   matters because a vote carries the city it was cast
                   from (D8) and this stop shows the city you are in now. */
                : score.n === 1
                  ? <>You gave it <strong style={{ color: "var(--ink-2)" }}>{mine}</strong> · the only answer here so far</>
                  : <>You gave it <strong style={{ color: "var(--ink-2)" }}>{mine}</strong>
                    {mine === score.mean ? <> — exactly the average</>
                      : <> · {Math.abs(Math.round((mine - score.mean) * 10) / 10)} {mine > score.mean ? "above" : "below"} them</>}
                    {" "}· {score.n.toLocaleString()} answers</>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── the body ────────────────────────────────────────────────────────
//
// CONTROLLED SINCE D119. This module used to own the row as well: four
// text buttons with their own open/closed state, sitting BELOW the answer
// rows, collapsed by default. The row is now the stop's tab bar
// (ui/MirrorLensTabs), Answers is a peer tab rather than the page these
// lenses hang off, and the selection lives with the host — so this
// renders one lens and nothing else.
//
// The cost gate that comment carried is unchanged and is now structural
// rather than a default: a lens body exists only while its tab is the
// open one, so People still pays for voter lists exactly when someone
// asks for People and never because something scrolled into view.

function LiveMirrorLenses({ lens, qs, shortName, scope = "city" }: {
  lens: LensId;
  qs: LensQuestion[];
  shortName: string;
  scope?: "city" | "country" | "world";
}) {
  if (!LIVE.enabled) return null;
  return (
    <div style={{ paddingTop: 14 }}>
      {lens === "people" && <PeopleLens qs={qs} scope={scope} shortName={shortName} />}
      {lens === "compare" && <CohortCompare scope={scope} shortName={shortName} />}
      {lens === "scores" && <ScoresLens qs={qs} shortName={shortName} scope={scope} />}
      {lens === "explore" && <ExploreLens qs={qs} />}
    </div>
  );
}

export default LiveMirrorLenses;
