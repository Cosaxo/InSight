// LiveSimilarityField — the Mirror's constellation fields, live (D112).
//
// The prototype's most distinctive screens: you at the centre, a
// population arranged around you, distance = unlikeness. It shipped them
// as furniture — mirror-field-pops.jsx invents "Anders K. · 92%" and
// "Tromsø · 77" as constants — and the live app replaced the whole body
// with counts. This module draws the same grammar from real data:
//
//   City     the people of YOUR CITY, ranked primarily by how close
//            their completed test scores sit to yours (data/similarity's
//            rankKindred; answer agreement is the fallback basis, and
//            each row says which basis it stands on).
//   Country  your country's cities, each given a real score profile —
//            the fold over the published per-city cells of the bank's
//            test items — and placed by its distance from yours.
//   World    the same, per country.
//
// Three honesty rules, all inherited from D1 via D72's lesson:
//   1. No mist. The prototype scattered decorative dots behind the named
//      nodes — unnamed fake people. Density here is real nodes or nothing.
//   2. No invented headline. The prototype's "12.6k in Oslo" has no
//      honest single source (population ≠ answers), so the field leads
//      with people and places, and counts stay attached to what they
//      count. AMENDED at D135: the stop above this one now DOES carry a
//      figure, and the rule is what made it a different figure — it
//      counts people who have answered here, not people who live here,
//      and LiveCohortBody's `reach` is written out to say why that
//      number is people rather than answers. The refusal was of the
//      prototype's claim, never of a headline as such.
//   3. A place below MIN_PLACE_AXES shared axes is listed as thin, never
//      positioned — a position IS a claim.
//
// Everything is derived on read from LIVE's caches; loadSimilarity() is
// the one loader (bounded — see live.ts), fired on mount, exactly like
// the People lens's loadKindred.
import React from "react";
import LIVE from "../data/live";
import { BUDGET_PAUSED_BODY } from "../data/budgetMode";
import PLACES from "../data/places";
import {
  angleHash,
  CORE_TEST_KINDS,
  flattenAxes,
  scoreMatch,
  MIN_PLACE_AXES,
  parseTestResults,
  placeProfiles,
  rankKindred,
  testItemMeta,
  myFlatAxes,
  voteIndices,
  type ParsedResults,
  type PlaceProfile,
  type RankedPerson,
  type TestDefs,
} from "../data/similarity";
// A converted spec module (D39) — plain named export, no bridge read.
// The instrument definitions are the scoring metadata's only source:
// `invert` is not on the seeded docs, so the join runs on prompt text
// (see data/similarity.ts testItemMeta). The cast is pinned rather than
// hopeful: content-parity.test.jsx holds IS_TESTS to exactly this shape.
// @ts-expect-error TS7016 — untyped spec module (same pattern as
// personaResidue.test.ts, the one other typed importer of a spec file)
import { IS_TESTS } from "../spec/test-definitions.js";

const DEFS = IS_TESTS as TestDefs;
const SF_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

// ── shared field canvas ──────────────────────────────────────────────

/**
 * A node in the constellation.
 *
 * THE GEOMETRY IS SIMILARITY, NEVER POSITION — the one rule this whole
 * canvas rests on, and the reason it can draw strangers at all.
 *
 * `match` sets the radius: closer to the centre is more like you. There is
 * no coordinate here and there must never be one. It matters most at the
 * Near stop, where the temptation is exactly backwards: the app knows a
 * ~200 m presence cell, so placing nodes where people actually ARE would
 * look like an improvement and would turn an anonymous field into a map of
 * where named-able strangers are standing — the thing `v2_presence`'s
 * `allow read: if false` exists to prevent (D84/D98).
 *
 * The same reasoning bans per-node ATTRIBUTES on an anonymous field. A
 * trade and an age are not sensitive on their own — everything here
 * publishes under D98 — but they are a JOIN KEY: enough to find a named
 * public account, after which the node has told you where that person is.
 * A node that carries only a radius gives an attacker nothing to join on.
 * That is why Near passes `label: ""` and `kind="anon"`.
 */
interface FieldNode {
  id: string;
  /** Short label under the node — a first name or a place name. */
  label: string;
  /** Initials inside a person node; places draw a dot instead. */
  initials?: string;
  /** 0..100 likeness; sets the radius (closer = more like you). */
  match: number;
  /** Marks the viewer's own place (Country stop's home city). */
  home?: boolean;
  /** True when `match` comes from test scores; false = answer agreement. */
  scored: boolean;
}

/** Deterministic decorative hue — stable per id, claims nothing. */
function hueOf(id: string): number {
  return Math.round(angleHash(id + "#hue") * 360);
}

const TAU = Math.PI * 2;
/** The spacing the de-overlap pass wants between two adjacent nodes. */
const MIN_ANGLE_GAP = 0.42;

/**
 * Angle + radius per node. Angle is a pure hash of the id (stable across
 * re-ranks); radius is the likeness. One deterministic de-overlap pass
 * nudges near-coincident angles apart so two 90% matches do not stack —
 * a layout fix, not data, which is why it must not depend on rank order.
 *
 * THE PASS IS CIRCULAR, and it was not. It only ever pushed FORWARD, with
 * no notion that the ring closes, so a crowded field ran the tail straight
 * past a full turn and back onto the head — the exact stacking it exists
 * to prevent, and worst on the nodes that had been spaced correctly. It
 * failed at all three caps the app actually uses, and the failure is
 * data-dependent (it turns on where the hash happens to drop the ids),
 * which is why it could sit here looking right. Measured, on the World
 * stop's own country codes, as the closest pair anywhere on the ring:
 *
 *   cap 12 (City)   0.2212 rad → 0.5236     wanted 0.42
 *   cap 14 (Near)   0.0366 rad → 0.4488     wanted 0.42
 *   cap 24 (places) 0.0168 rad → 0.2618     wanted 0.262 (an even share)
 *
 * Two things fix it. The step is the smaller of the design gap and an even
 * share, because a ring of 24 has 0.262 rad per node to give and asking
 * for 0.42 is asking for more circle than exists. And the wrap is then
 * CHECKED: if the run no longer clears the first node a turn later, the
 * nodes spread evenly instead. That trade is deliberate and it is the
 * honest one — on a crowded ring the hash keeps the ORDER, which is all
 * the forward pass was leaving intact anyway, and an even ring cannot
 * stack at any N.
 */
function layout(nodes: readonly FieldNode[]): Array<FieldNode & { x: number; y: number }> {
  const R_MIN = 44;
  const R_MAX = 138;
  const placed = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ n, angle: angleHash(n.id) * TAU }))
    .sort((a, b) => a.angle - b.angle);
  const gap = Math.min(MIN_ANGLE_GAP, TAU / (placed.length || 1));
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].angle - placed[i - 1].angle < gap) {
      placed[i].angle = placed[i - 1].angle + gap;
    }
  }
  const start = placed.length ? placed[0].angle : 0;
  if (placed.length > 1 && start + TAU - placed[placed.length - 1].angle < gap) {
    placed.forEach((p, i) => { p.angle = start + (i * TAU) / placed.length; });
  }
  return placed.map(({ n, angle }) => {
    const clamped = Math.max(0, Math.min(100, n.match));
    const r = R_MIN + (1 - clamped / 100) * (R_MAX - R_MIN);
    return { ...n, x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
}

/**
 * The anonymous person glyph — a body and a head, no initials.
 *
 * The Near stop's whole node vocabulary (D150). Everywhere else in the
 * Mirror a person node carries initials and a first name, because
 * everywhere else you can go and read what that person answered. Near
 * cannot name anyone: the presence cell is one of D98's three surviving
 * denies, and the constellation there is the shape of a crowd rather than
 * a set of people you could pick one out of.
 */
function AnonGlyph({ r }: { r: number }) {
  return (
    <>
      <circle r={r * 0.34} cy={-r * 0.3} fill="#fff" />
      <path d={`M${-r * 0.52} ${r * 0.62} a ${r * 0.52} ${r * 0.5} 0 0 1 ${r * 1.04} 0 z`} fill="#fff" />
    </>
  );
}

function SimilarityCanvas({ nodes, picked, onPick, kind }: {
  nodes: readonly FieldNode[];
  picked: string | null;
  onPick: (id: string) => void;
  /**
   * `anon` is people with the names taken off, and it is not interactive:
   * no role, no tab stop, no pick. A field you can tap a person out of is
   * a directory, which is the one thing Near must not become.
   */
  kind: "people" | "places" | "anon";
}) {
  const pts = layout(nodes);
  const anon = kind === "anon";
  // AN EMPTY RING NAMES NOTHING (D244). With no nodes this group's label
  // promised "closer to the centre is more like you" over a canvas with
  // nobody on it — a comparison announced to a screen reader and then not
  // made. Every empty arm goes through here (`SfEmptyField` hands it
  // `nodes={[]}`), so that was the FIRST thing a new account heard from
  // this tab, on every stop.
  //
  // `EmptyField` — the forty-line copy of this drawing that Circle and
  // Groups use — already resolved it the other way: `aria-hidden` on the
  // svg, the real sentence in the caption underneath. Two drawings of one
  // picture cannot disagree about that, and the copy was right: the rings
  // and the "you" disc are the scale a radius will be read on, not a
  // reading. There is nothing here to announce until somebody is placed.
  const empty = !pts.length;
  return (
    <svg viewBox="-170 -170 340 340"
      role={empty ? undefined : "group"}
      aria-label={empty ? undefined : "Similarity field — closer to the centre is more like you"}
      aria-hidden={empty ? "true" : undefined}
      style={{ width: "100%", maxHeight: 350, display: "block", touchAction: "pan-y" }}>
      {/* guide rings — the scale the radius reads on */}
      {[64, 101, 138].map((r, i) => (
        <circle key={r} cx={0} cy={0} r={r} fill="none"
          stroke="color-mix(in oklch, var(--rule), transparent 30%)"
          strokeWidth={1} strokeDasharray={i === 2 ? "3 5" : undefined} />
      ))}
      <circle cx={0} cy={0} r={30} fill="color-mix(in oklch, var(--accent) 14%, var(--surface-2))" />
      <circle cx={0} cy={0} r={23} fill="var(--ink)" />
      <text x={0} y={0} dy="0.36em" textAnchor="middle"
        style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 800, fill: "var(--surface)" }}>you</text>
      {pts.map((p) => {
        const hue = hueOf(p.id);
        const on = picked === p.id;
        const fill = p.home
          ? "var(--accent)"
          : `oklch(0.56 0.09 ${hue})`;
        if (anon) {
          return (
            <g key={p.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} aria-hidden="true">
              <circle r={13} fill={fill} stroke="var(--surface)" strokeWidth={2}
                strokeDasharray={p.scored ? undefined : "3 2.5"} />
              <AnonGlyph r={13} />
            </g>
          );
        }
        return (
          <g key={p.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
            role="button" tabIndex={0} aria-pressed={on}
            aria-label={`${p.label || "Someone"} · ${p.match}% like you`}
            style={{ cursor: "pointer", outline: "none" }}
            onClick={() => onPick(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.id); } }}>
            {kind === "people" ? (
              <>
                <circle r={15.5} fill={fill}
                  stroke={on ? "var(--ink)" : "var(--surface)"} strokeWidth={2}
                  strokeDasharray={p.scored ? undefined : "3 2.5"} />
                <text y={0} dy="0.36em" textAnchor="middle"
                  style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 800, fill: "#fff" }}>
                  {p.initials || "?"}
                </text>
                <text y={26} textAnchor="middle"
                  style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, fill: on ? "var(--ink)" : "var(--ink-2)" }}>
                  {p.label || "Someone"}
                </text>
              </>
            ) : (
              <>
                {p.home && <circle r={13} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.7} />}
                <circle r={8} fill={fill} stroke={on ? "var(--ink)" : "var(--surface)"} strokeWidth={2}
                  strokeDasharray={p.scored ? undefined : "2.5 2"} />
                <text y={21} textAnchor="middle"
                  style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, fill: on ? "var(--ink)" : "var(--ink-2)" }}>
                  {p.label}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SfCaption({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "2px 0 4px" }}>
      <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", border: SF_LINE, borderRadius: 999, padding: "4px 12px" }}>
        {children}
      </span>
    </div>
  );
}

/**
 * The way out of an empty field (D135).
 *
 * Overview is what a cohort stop OPENS on now, so its empty arms are no
 * longer a drawer someone chose to look in — they are the first thing the
 * stop says. An empty state that only explains itself is a dead end when
 * it is also the landing screen, and the constellation is the slowest
 * thing here to fill: it needs completed test scores, while the answer
 * rows publish from the first answer (D98). So every empty arm offers the
 * tab that has something today.
 */
function SfEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "8px 2px 12px", textAlign: "center", maxWidth: 340, margin: "0 auto" }}>
      {children}
    </div>
  );
}

/**
 * An empty field is still a field (D160).
 *
 * Every arm below used to REPLACE the drawing with a paragraph when it had
 * nobody to place, so a new account's Mirror was a sentence where the
 * constellation goes, on every stop, until strangers turned up. That reads
 * as a screen that has not been built rather than one that has nothing in
 * it yet — and it hides the grammar the whole tab is written in, from
 * exactly the reader who has not learned it.
 *
 * So the canvas draws first and always: the rings, and you at the centre.
 * That is not decoration and it is not fabricated — "you, and nobody
 * placed around you yet" is the true picture, node for node, and the rings
 * are the scale the radius will be read on when someone does arrive. The
 * prototype does the same thing (`MFSparse` sits UNDER `MFCanvas`, never
 * instead of it).
 *
 * `anon` on purpose for every empty arm regardless of what the filled one
 * draws: an empty field has nothing to tap, and a `people` canvas with no
 * people would hand out roles and tab stops to nothing.
 */
function SfEmptyField({ caption, children }: {
  caption?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "6px 0 2px" }}>
      <SimilarityCanvas kind="anon" nodes={[]} picked={null} onPick={() => {}} />
      {caption ? <SfCaption>{caption}</SfCaption> : null}
      <SfEmpty>{children}</SfEmpty>
    </div>
  );
}

// One axis row: their value as a bar, yours as a tick on it — the same
// visual sentence the Scores lens speaks, so a comparison reads the same
// everywhere in the Mirror.
function SfAxisRow({ label, value, mine, n }: { label: string; value: number; mine: number | null; n?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 104, flexShrink: 0, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden", position: "relative" }}>
        <span style={{ display: "block", height: "100%", width: `${value}%`, background: "color-mix(in oklch, var(--accent) 55%, var(--surface-2))" }}></span>
        {mine != null && (
          <span aria-hidden="true" style={{ position: "absolute", top: -2, bottom: -2, width: 2.5, borderRadius: 2, left: `calc(${mine}% - 1.25px)`, background: "var(--ink)" }}></span>
        )}
      </span>
      <span style={{ width: 30, textAlign: "right", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {n != null && (
        <span style={{ width: 44, textAlign: "right", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 10.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{n} ans</span>
      )}
    </div>
  );
}

// Same one-tap follow as the People lens (D101): no request, no pending
// state, because D98 already granted everything a follow could. This is
// the third of the follow entry points, under the same rule as the other
// two — a uid that has become a person with a reading attached (D112).
function SfFollowButton({ uid }: { uid: string }) {
  const following = LIVE.isFollowing(uid);
  return (
    <button onClick={() => void LIVE.setFollowing(uid, !following)} aria-pressed={following}
      style={{ border: SF_LINE, borderRadius: 999, padding: "3px 10px", cursor: "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11, WebkitAppearance: "none",
        background: following ? "var(--ink)" : "transparent",
        color: following ? "var(--surface)" : "var(--ink-2)" }}>
      {following ? "Following" : "Follow"}
    </button>
  );
}

// ── City: kindred strangers, positioned ─────────────────────────────

const CITY_FIELD_CAP = 12;

function PersonCard({ p, myParsed }: { p: RankedPerson; myParsed: ParsedResults | null }) {
  return (
    <div className="card" style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 14.5, color: p.name ? "var(--ink)" : "var(--ink-3)" }}>
          {p.name || "Someone"}
        </span>
        <SfFollowButton uid={p.uid} />
      </div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        {p.score
          ? <>Scores <strong>{p.score.match}%</strong> aligned with yours — average gap
            across the {p.score.axes} axes of the {p.score.tests === 1 ? "test" : `${p.score.tests} tests`} you have both taken.</>
          : <>Picked the same answer as you on <strong>{p.like.same} of {p.like.shared}</strong> shared
            questions{myParsed ? " — no completed test in common yet" : ""}.</>}
      </div>
      {p.score && p.results && myParsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CORE_TEST_KINDS.filter((k) => p.results?.[k] && myParsed[k]).map((kind) => (
            <div key={kind} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                {DEFS[kind]?.title || kind} — them, with your tick
              </span>
              {(DEFS[kind]?.dims || [])
                .filter((d) => p.results![kind][d.id] != null && myParsed[kind][d.id] != null)
                .map((d) => (
                  <SfAxisRow key={d.id} label={d.label}
                    value={p.results![kind][d.id]} mine={myParsed[kind][d.id]} />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CityField({ myParsed }: {
  myParsed: ParsedResults | null;
}) {
  const [picked, setPicked] = React.useState<string | null>(null);
  const city = LIVE.myCity;
  const place = city ? PLACES.parse(city) : null;
  const cityName = place ? place.name : city;
  // minShared 2 matches kindred()'s default: one shared question is a
  // coin flip, not an overlap.
  const people = rankKindred(LIVE.kindredPeople(), myParsed, { city, minShared: 2 });
  const loading = LIVE.similarityLoading() || LIVE.kindredLoading();
  const shown = people.slice(0, CITY_FIELD_CAP);
  const scoredN = shown.filter((p) => p.score).length;
  const pickedP = shown.find((p) => p.uid === picked) || null;

  if (!shown.length) {
    // Paused before empty (D332): with the breaker on, the kindred pool
    // was never fetched, and "Nobody from {city} yet" would be a claim
    // about a crowd nothing looked at.
    return (
      <SfEmptyField caption={<>{cityName}</>}>
        {loading
          ? <>Matching…</>
          : LIVE.budgetPaused
            ? <>{BUDGET_PAUSED_BODY}</>
            : <>Nobody from {cityName} yet — fills in as the city answers.</>}
      </SfEmptyField>
    );
  }

  return (
    <div style={{ padding: "6px 0 2px" }}>
      <SimilarityCanvas kind="people" picked={picked} nodes={shown.map((p) => ({
        id: p.uid,
        label: (p.name || "").split(" ")[0] || "Someone",
        initials: (p.name || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?",
        match: p.score ? p.score.match : p.like.pct,
        scored: !!p.score,
      }))} onPick={(id) => setPicked(picked === id ? null : id)} />
      {/* A caption is a legend, not a description: the place, the radius's
          meaning, and what a dashed ring encodes. "kindred strangers" was
          the section's own heading said twice. */}
      <SfCaption>
        {cityName} · closer = more like you
        {scoredN < shown.length ? " · dashed = answers only" : ""}
      </SfCaption>
      {/* Said rather than dropped, the same rule PlacesField already
          follows below: a cap that silently eats rows reads as "that is
          all of them". These are real people the ranking placed further
          out, not people it could not read. */}
      {people.length > shown.length && (
        <SfEmpty>
          {people.length - shown.length} more from {cityName} ranked below these.
        </SfEmpty>
      )}
      {!myParsed && (
        <SfEmpty>Finish a test to rank by scores.</SfEmpty>
      )}
      {pickedP && <PersonCard p={pickedP} myParsed={myParsed} />}
    </div>
  );
}

// ── the field, for a population that arrives already ranked ─────────
//
// Circle and Groups (D152). Both stops HAD the grammar the whole Mirror
// is built on — you at the centre, them around you, distance = unlikeness
// — drawn for them in the prototype, and both shipped live as a flat list
// of names with a percentage each. The list is not wrong; it is the same
// data with the shape taken out, and the shape is the reading.
//
// They do not go through `rankKindred` because their populations are not
// strangers to rank: a circle is the set you chose and a group is its
// membership, each with a likeness already computed by the module that
// owns it (data/circle.ts, data/groupPortrait.ts). So this takes nodes
// and draws them, and the caller owns what a node means.
export interface FieldPerson {
  id: string;
  /** Shown under the node — a first name, or "" for someone unnamed. */
  label: string;
  /** 0..100; sets the radius, closer = more like you. */
  match: number;
}

export function PeopleField({ people, caption, onPick, picked, emptyLine }: {
  people: readonly FieldPerson[];
  caption: React.ReactNode;
  onPick?: (id: string) => void;
  picked?: string | null;
  /** What to say under an empty ring. The caller knows which population
   *  this is and why it might be empty; the field only knows it is. */
  emptyLine?: React.ReactNode;
}) {
  // Was `return null` — the Circle and Groups stops drew NOTHING at all
  // with an empty roster, which is the same fault as the paragraph arms
  // above and quieter: the stop simply had a hole in it. The caller's own
  // empty copy still follows underneath.
  if (!people.length) return <SfEmptyField caption={caption}>{emptyLine}</SfEmptyField>;
  return (
    <div style={{ padding: "2px 0 0" }}>
      <SimilarityCanvas
        kind="people"
        picked={picked ?? null}
        onPick={(id) => onPick?.(id)}
        nodes={people.map((p) => ({
          id: p.id,
          label: (p.label || "").split(" ")[0] || "Someone",
          initials: (p.label || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?",
          match: p.match,
          // Dashed means "ranked from answers, not scores" everywhere in
          // the Mirror, and both of these populations ARE ranked from
          // answers — so the ring is solid and the caption says the basis
          // once, rather than every node wearing a caveat.
          scored: true,
        }))}
      />
      <SfCaption>{caption}</SfCaption>
    </div>
  );
}

// ── Near: the same field with the names taken off (D150) ────────────
//
// WHY NEAR HAD NO FIELD, AND WHY THAT WAS THE WRONG ANSWER.
//
// The prototype's Near stop is a constellation: a count at the top, a
// crowd of anonymous figures around you, distance = unlikeness. Live mode
// replaced the whole thing with the presence counter and a sentence
// pointing at City, on the reasoning that presence is one of D98's three
// denies — the server returns a count and nothing else, so there is
// nothing to draw people from.
//
// That reasoning is right about the presence cell and wrong about the
// screen. The stop is not only "which phones are within a kilometre"; it
// is "who is around me", and the app knows something true about that
// which it was already drawing one stop over: the people of your city,
// ranked by how close their scores sit to yours. The refusal was of a
// claim nobody had to make.
//
// So the field is real data, drawn under a caption that says what it is,
// and NOTHING here is named. Two numbers, each attached to what it counts
// (the D112 honesty rule): the figure at the top is phones near you right
// now, the ring below it is people in your city. Neither claims to be the
// other, and no node can be tapped open — Near draws the shape of a
// crowd, never a directory of it.

const NEAR_FIELD_CAP = 14;

export function NearField() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);
  // THE ROOM, NOT THE CITY (D181). This field drew the people of your CITY
  // from D150 until now, ranked by likeness and drawn anonymously — a
  // deliberate choice made when Near had a count and nothing else true to
  // show, and the right one at the time.
  //
  // D177 removed the premise. Near has its own population now: the people
  // actually standing here, which the People tab lists two inches below
  // this. Drawing the city's crowd above that list made one stop describe
  // two different sets of people and name the wrong one — "Nobody from Oslo
  // yet" on a stop called Near — which is D170's finding exactly, one stop
  // over.
  //
  // The roster is asked for with NO qids, which is the cheap half of the
  // room call: the server returns the sampled people and folds no answers,
  // so arriving at Near costs a presence sample rather than a document per
  // person per question. The tabs ask again with the deck when one is
  // opened, and the per-cell cache means the roster is already there.
  //
  // KEYED ON THE BEAT, for the reason the tabs' own effect gives: the room
  // is per cell, `loadRoom` is the only writer of it, and nothing in the
  // store re-folds when the cell changes. Mounted once with an empty dep
  // list, this field drew the roster of the block you walked out of under a
  // headcount that moved with every beat — and it is the surface that
  // matters more, because the tab bodies below only exist once a tab is
  // tapped, while this is what the stop opens on. Free on a beat that did
  // not move: the store returns at once when the cell it holds is the
  // current one, and with no qids the question test is vacuous.
  const beat = LIVE.near.updatedAt();
  React.useEffect(() => { void LIVE.near.loadRoom([]); }, [beat]);
  // NO loadSimilarity HERE. It was correct until D181, when this field
  // drew the city's crowd and read `kindredPeople()`; that rewrite
  // replaced the body with the presence roster and deleted the comment
  // justifying the loader, but left the loader. Nothing this component
  // renders reads what it fetches — the scores under each glyph come from
  // `loadNames(roster)` below, through the shared profile cache.
  //
  // What it cost: ~110 test aggregates in four batched queries, plus
  // loadKindred's twelve collection-group reads of up to 200 answers each
  // and their name resolution — a few thousand billed reads — charged to
  // a viewer who opened Near and may never open City or World. The stops
  // that DO read it ask on arrival and the fold is session-cached, so
  // nothing is lost by not pre-warming here: loadSimilarity's own comment
  // names the moment it is spent for, and Near is not in that list.

  const on = LIVE.near.on();
  const room = LIVE.near.room();
  const roster = React.useMemo(() => (room ? room.people : []), [room]);
  // Keyed on the uid LIST rather than the array, which `near.room()` hands
  // back fresh on every notify — an effect keyed on the array itself would
  // re-fire on every beat and re-ask for names it already holds.
  const rosterKey = roster.map((p) => p.uid).join(",");
  // READING IS NOT "NOBODY HAS", the same rule the Compare lens states at
  // length and for the same reason: `scoresFor` answers null for "fetched,
  // has none" and "never fetched" alike, and this fetch runs after first
  // paint. Until it lands, every roster member filters out of `placeable`,
  // the field falls into the empty arm, and its last branch announces
  // "Nobody here has taken the test — N in the room" about people whose
  // profiles are still on the wire. `roomLoading()` does not cover this:
  // it is the ROSTER's flag, and the roster has already arrived.
  const [reading, setReading] = React.useState(false);
  React.useEffect(() => {
    if (!rosterKey) { setReading(false); void LIVE.loadNames([]); return; }
    let live = true;
    setReading(true);
    void LIVE.loadNames(rosterKey.split(",")).finally(() => { if (live) setReading(false); });
    return () => { live = false; };
  }, [rosterKey]);
  // AFTER the hooks, never before: an early return above them changes the
  // hook order between renders (react-hooks/rules-of-hooks), and this
  // component has four.
  if (!LIVE.enabled) return null;

  const myFlat = flattenAxes(parseTestResults(LIVE.myTestResults(), CORE_TEST_KINDS) || {});
  // Placed by test-score likeness, the same metric the City and World
  // fields use — and the one the owner asked for in as many words: the map
  // is not about position, it is about how alike people are.
  //
  // Somebody who has not taken the test cannot be placed by it, so they are
  // NOT drawn rather than parked at a default radius: a node at an invented
  // distance is a claim about a person, and the caption below says how many
  // are missing instead.
  const placeable = Object.keys(myFlat).length
    ? roster
      .map((p) => {
        const theirs = LIVE.scoresFor(p.uid);
        return { uid: p.uid, m: theirs ? scoreMatch(myFlat, flattenAxes(theirs), 3) : null };
      })
      .filter((p): p is { uid: string; m: NonNullable<ReturnType<typeof scoreMatch>> } => !!p.m)
      // RAW, not the drawn number. This is the one place `raw` exists for
      // — "deciding which people the field draws at all", in its own
      // docstring — and Near was the site D277 §2 missed: `similarity.ts`
      // converted both of its rankers and this one kept sorting on `match`.
      //
      // Two things follow from ranking on the printed figure. It carries
      // the width bias `raw` folds AXIS_PRIOR in to remove, so a stranger
      // matched on three axes can outrank one matched on twenty. And it is
      // rounded onto ~20 integers, so a large tied block is resolved by
      // whatever order the roster arrived in. The server hands back more
      // people than the field draws (ROOM_PEOPLE_CAP against
      // NEAR_FIELD_CAP), so the slice below is a real choice and both
      // failures decide who is dropped.
      .sort((a, b) => b.m.raw - a.m.raw || b.m.axes - a.m.axes || a.uid.localeCompare(b.uid))
    : [];
  // THE TWO REASONS SOMEBODY IS NOT DRAWN, kept apart, because the caption
  // used to give one of them for both. Everyone here whose scores this
  // device can read is `placeable`; the field draws the closest
  // NEAR_FIELD_CAP of them. So a room of twenty people who have ALL taken
  // the test drew fourteen and told the reader the other six had not —
  // about six people standing next to them. The sort comment above already
  // says the slice is "a real choice"; the caption contradicted it.
  const placed = placeable.slice(0, NEAR_FIELD_CAP);
  const untested = roster.length - placeable.length;
  const capped = placeable.length > placed.length;

  if (!on) {
    return (
      <SfEmptyField>
        Turn it on and people draw in here — by likeness, never by position.
      </SfEmptyField>
    );
  }
  if (!placed.length) {
    return (
      <SfEmptyField>
        {/* FOUR STATES, and the last two are the split this arm was missing.
            With no scores of your own there is nothing to measure anybody
            against, so nobody is placeable however many people here have
            finished a test — and the room got the blame: "Nobody here has
            taken the test", said to a room where everybody had, in the
            state every account is in before its first instrument.
            The sibling below (PlacesField) already splits these two.

            The room's own two states stay in front of it: a room still
            being read says so, and an EMPTY room is about the room whatever
            the reader has taken (D160's ring case and the loading/empty
            separation both rest on that order). Telling someone to finish a
            test is only useful once there is somebody here to be drawn
            against. */}
        {LIVE.near.roomLoading()
          ? <>Matching…</>
          : !roster.length
            ? <>Nobody else has Near on right now.</>
            : !Object.keys(myFlat).length
              ? <>Finish a test and the room draws in around you.</>
              : reading
                ? <>Matching…</>
                : <>Nobody here has taken the test — {roster.length} in the room,
                  {" "}<strong>People</strong> lists them.</>}
      </SfEmptyField>
    );
  }

  return (
    <div style={{ padding: "2px 0" }}>
      <SimilarityCanvas kind="anon" picked={null} onPick={() => {}} nodes={placed.map((p) => ({
        id: p.uid,
        // Deliberately empty. `anon` draws neither, and an id that carried
        // a name would be one refactor away from rendering it.
        label: "",
        match: p.m.match,
        scored: true,
      }))} />
      {/* What the ring counts, so it is not read as the presence figure
          above it (the D112 honesty rule), and the basis it is placed on.

          THE NAMELESSNESS IS BACK HERE (D188), where it was until D183 and
          where a legend belongs. D183 dropped it because the stop's closing
          line said the same thing plus where the names are; D188 deleted
          that line, because it sat under the tab row and the prototype has
          nothing there. Deleting a limit is not one of the moves available
          (docs/COPY.md §3) — so it comes back to the visual it qualifies,
          keeping the half that made D183 prefer the other copy: which
          surface DOES name people. An anonymous node is exactly the kind of
          encoding a reader cannot infer, which is what a legend is for. */}
      <SfCaption>
        {placed.length} of {roster.length} here · closer = more alike
      </SfCaption>
      <SfEmpty>
        Nobody is named here; <strong>People</strong> names them. Placed by
        test scores{capped ? ` — the closest ${placed.length} of ${placeable.length} who have` : ""}
        {untested > 0 ? `${capped ? "; the rest" : " — the rest"} have not taken it` : ""}.
      </SfEmpty>
    </div>
  );
}

// ── Country / World: places, profiled and positioned ────────────────

const PLACE_FIELD_CAP = 24;

function PlaceCard({ p, label, myFlat }: {
  p: PlaceProfile; label: string; myFlat: Record<string, number> | null;
}) {
  return (
    <div className="card" style={{ marginTop: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 14.5, color: "var(--ink)" }}>{label}</span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
          {p.n.toLocaleString()} test answers
        </span>
      </div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        {p.score
          ? <><strong>{p.score.match}%</strong> aligned with your scores, across {p.score.axes} axes.</>
          : <>Too few shared axes for a likeness yet (needs {MIN_PLACE_AXES}).</>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CORE_TEST_KINDS.filter((k) => p.byTest[k]?.length).map((kind) => (
          <div key={kind} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {DEFS[kind]?.title || kind} · their average
            </span>
            {p.byTest[kind].map((a) => (
              <SfAxisRow key={a.dim} label={a.label} value={a.value}
                mine={myFlat ? myFlat[`${kind}:${a.dim}`] ?? null : null} n={a.n} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlacesField({ scope, myFlat }: {
  scope: "country" | "world";
  myFlat: Record<string, number> | null;
}) {
  const [picked, setPicked] = React.useState<string | null>(null);
  const myCity = LIVE.myCity;
  const myCountry = myCity ? (PLACES.parse(myCity)?.country || "") : "";
  const dim = scope === "country" ? "city" as const : "country" as const;
  const items = testItemMeta(LIVE.testFeedItems(), DEFS);
  const profiles = placeProfiles(
    items, DEFS, (qid) => LIVE.aggFor(qid), dim, myFlat,
    scope === "country" ? (key) => key.endsWith(`, ${myCountry}`) : undefined,
  );
  const labelOf = (key: string) =>
    dim === "city" ? (PLACES.parse(key)?.name || key) : PLACES.countryName(key);
  const homeOf = (key: string) => (dim === "city" ? key === myCity : key === myCountry);

  // THREE groups, not two. `positioned` used to be subtracted straight
  // from `profiles`, which folded the cap's overflow into the count the
  // sentence below calls "too few shared axes" — false about every place
  // in it, since a place only reaches `scored` by clearing
  // MIN_PLACE_AXES. profiles sorts scored-first by descending match, so
  // the overflow is the LEAST alike rather than an arbitrary 24.
  const scored = profiles.filter((p) => p.score);
  const positioned = scored.slice(0, PLACE_FIELD_CAP);
  const thin = profiles.length - scored.length;
  const capped = scored.length - positioned.length;
  const loading = LIVE.similarityLoading();
  const pickedP = profiles.find((p) => p.key === picked) || null;
  const what = dim === "city" ? "city" : "country";
  const plural = (n: number) =>
    (n === 1 ? what : what === "city" ? "cities" : "countries");

  if (!profiles.length) {
    return (
      <SfEmptyField
        caption={<>{scope === "country" ? "your country's cities" : "the world's countries"}, by likeness</>}>
        {loading
          ? <>Reading profiles…</>
          : <>No {what} has answered a score question yet.</>}
      </SfEmptyField>
    );
  }

  return (
    <div style={{ padding: "6px 0 2px" }}>
      {positioned.length ? (
        <>
          <SimilarityCanvas kind="places" picked={picked} nodes={positioned.map((p) => ({
            id: p.key,
            label: labelOf(p.key),
            match: p.score!.match,
            home: homeOf(p.key),
            scored: true,
          }))} onPick={(id) => setPicked(picked === id ? null : id)} />
          <SfCaption>closer = more like you · from average test scores</SfCaption>
        </>
      ) : (
        <>
          {/* Profiles exist but none shares MIN_PLACE_AXES with the viewer
              (usually: the viewer has no scores at all). The profiles are
              still the product — list them; a position without a "you"
              would be an invented likeness. */}
          <SfEmpty>
            {myFlat
              ? <>None of these shares enough axes with yours yet.</>
              : <>Finish a test and these take their places around you.</>}
          </SfEmpty>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", padding: "2px 0 6px" }}>
            {profiles.slice(0, PLACE_FIELD_CAP).map((p) => (
              <button key={p.key} onClick={() => setPicked(picked === p.key ? null : p.key)}
                aria-pressed={picked === p.key}
                style={{ border: SF_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                  fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, WebkitAppearance: "none",
                  background: picked === p.key ? "var(--ink)" : "var(--surface)",
                  color: picked === p.key ? "var(--surface)" : "var(--ink-2)" }}>
                {labelOf(p.key)}
              </button>
            ))}
          </div>
        </>
      )}
      {thin > 0 && positioned.length > 0 && (
        <SfEmpty>
          {thin} more {plural(thin)} answered, too few shared axes to place.
        </SfEmpty>
      )}
      {/* Said rather than dropped: a cap that silently eats rows reads as
          "that is all of them". These CAN be placed — they are simply the
          least alike of the ones that can. */}
      {capped > 0 && (
        <SfEmpty>
          {capped} more {plural(capped)} placed further out than this field draws.
        </SfEmpty>
      )}
      {pickedP && <PlaceCard p={pickedP} label={labelOf(pickedP.key)} myFlat={myFlat} />}
    </div>
  );
}

// ── the section host ─────────────────────────────────────────────────

function SimilaritySection({ scope }: {
  scope: "city" | "country" | "world";
  /** Sends the reader to the Answers tab from an empty field (D135). */
}) {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);
  // Default-on (D112): the field is the stop's identity, so it loads with
  // the stop — no tab to open first, nothing to opt into. The loader is
  // bounded and session-cached; see live.ts loadSimilarity.
  React.useEffect(() => { void LIVE.loadSimilarity(); }, []);
  // The person card this field opens carries a follow button, and the
  // stop that loads the circle is a different one — so the set that
  // answers "already following?" is asked for here. One query,
  // session-cached.
  React.useEffect(() => { void LIVE.loadFollows(); }, []);
  // The city half of the pool, for the one stop that filters by city
  // (D278). Scoped to this effect rather than folded into loadSimilarity
  // because Country and World never filter on it — they read place
  // aggregates, not voter rows — so paying a second fan-out there would
  // buy nothing. Session-cached and keyed on the anchor; a viewer with no
  // city returns immediately.
  React.useEffect(() => {
    if (scope !== "city") return;
    // Both halves of the pool, and both only here. `loadSimilarity` used
    // to await the general fan-out for every scope, so Country and World
    // paid a few thousand reads for rows they never draw.
    void LIVE.loadKindred();
    void LIVE.loadCityKindred();
  }, [scope]);
  if (!LIVE.enabled) return null;

  const myParsed = parseTestResults(LIVE.myTestResults(), CORE_TEST_KINDS);
  if (scope === "city") {
    return <CityField myParsed={myParsed} />;
  }
  // The viewer's own axes for the place fields: completed instruments
  // first, own answers to the bank's test items filling the gaps — real
  // data either way, and myFlatAxes labels neither as the other.
  // This conversion used to be written out here, and being the only copy
  // is what hid D132: result-card.jsx fed the fold a raw myVotes() and
  // scored nobody. Shared now, so there is one definition of what a vote
  // is worth to a scorer.
  const items = testItemMeta(LIVE.testFeedItems(), DEFS);
  const myFlat = myFlatAxes(myParsed, items, DEFS, voteIndices(LIVE.myVotes()));
  return <PlacesField scope={scope} myFlat={myFlat} />;
}

export default SimilaritySection;
