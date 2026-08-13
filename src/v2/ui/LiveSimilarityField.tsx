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
//      count.
//   3. A place below MIN_PLACE_AXES shared axes is listed as thin, never
//      positioned — a position IS a claim.
//
// Everything is derived on read from LIVE's caches; loadSimilarity() is
// the one loader (bounded — see live.ts), fired on mount, exactly like
// the People lens's loadKindred.
import React from "react";
import LIVE from "../data/live";
import PLACES from "../data/places";
import {
  angleHash,
  CORE_TEST_KINDS,
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

/**
 * Angle + radius per node. Angle is a pure hash of the id (stable across
 * re-ranks); radius is the likeness. One deterministic de-overlap pass
 * nudges near-coincident angles apart so two 90% matches do not stack —
 * a layout fix, not data, which is why it must not depend on rank order.
 */
function layout(nodes: readonly FieldNode[]): Array<FieldNode & { x: number; y: number }> {
  const R_MIN = 44;
  const R_MAX = 138;
  const placed = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({ n, angle: angleHash(n.id) * Math.PI * 2 }))
    .sort((a, b) => a.angle - b.angle);
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].angle - placed[i - 1].angle < 0.42) {
      placed[i].angle = placed[i - 1].angle + 0.42;
    }
  }
  return placed.map(({ n, angle }) => {
    const clamped = Math.max(0, Math.min(100, n.match));
    const r = R_MIN + (1 - clamped / 100) * (R_MAX - R_MIN);
    return { ...n, x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
}

function SimilarityCanvas({ nodes, picked, onPick, kind }: {
  nodes: readonly FieldNode[];
  picked: string | null;
  onPick: (id: string) => void;
  kind: "people" | "places";
}) {
  const pts = layout(nodes);
  return (
    <svg viewBox="-170 -170 340 340" role="group" aria-label="Similarity field — closer to the centre is more like you"
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

function SfEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "8px 2px 12px", textAlign: "center", maxWidth: 340, margin: "0 auto" }}>
      {children}
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

function CityField({ myParsed }: { myParsed: ParsedResults | null }) {
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
    return (
      <div style={{ padding: "6px 0 2px" }}>
        <SfCaption>kindred strangers in {cityName}</SfCaption>
        <SfEmpty>
          {loading
            ? <>Working out who in {cityName} is most like you…</>
            : <>Nobody from {cityName} yet among the people on your questions —
              this fills in as more of the city answers.</>}
        </SfEmpty>
      </div>
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
      <SfCaption>
        kindred strangers in {cityName} · closer = more like you
        {scoredN < shown.length ? " · dashed = from answers, not scores" : ""}
      </SfCaption>
      {!myParsed && (
        <SfEmpty>
          Ranked by matching answers for now — finish a test and this ranks
          by scores.
        </SfEmpty>
      )}
      {pickedP && <PersonCard p={pickedP} myParsed={myParsed} />}
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
          ? <>Average scores sit <strong>{p.score.match}%</strong> aligned with yours,
            across {p.score.axes} shared axes.</>
          : <>The average scores here — not enough overlap with your own axes
            for a likeness yet (needs {MIN_PLACE_AXES}).</>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CORE_TEST_KINDS.filter((k) => p.byTest[k]?.length).map((kind) => (
          <div key={kind} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {DEFS[kind]?.title || kind} — their average, with your tick
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

  const positioned = profiles.filter((p) => p.score).slice(0, PLACE_FIELD_CAP);
  const thin = profiles.length - positioned.length;
  const loading = LIVE.similarityLoading();
  const pickedP = profiles.find((p) => p.key === picked) || null;
  const what = dim === "city" ? "city" : "country";

  if (!profiles.length) {
    return (
      <div style={{ padding: "6px 0 2px" }}>
        <SfCaption>{scope === "country" ? "your country's cities" : "the world's countries"}, by likeness</SfCaption>
        <SfEmpty>
          {loading
            ? <>Reading the score profiles…</>
            : <>No {what} has answered the score questions yet — profiles start
              with the first test answer.</>}
        </SfEmpty>
      </div>
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
          <SfCaption>closer = a {what} more like you · from average test scores</SfCaption>
        </>
      ) : (
        <>
          {/* Profiles exist but none shares MIN_PLACE_AXES with the viewer
              (usually: the viewer has no scores at all). The profiles are
              still the product — list them; a position without a "you"
              would be an invented likeness. */}
          <SfEmpty>
            {myFlat
              ? <>Score profiles exist here, but none shares enough axes with
                yours yet.</>
              : <>Answer a few score questions — or finish a test — and these
                {" "}{what === "city" ? "cities" : "countries"} take their
                places around you.</>}
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
          {thin} more {thin === 1 ? `${what} has` : `${what === "city" ? "cities" : "countries"} have`} answers
          but not enough shared axes for a place here yet.
        </SfEmpty>
      )}
      {pickedP && <PlaceCard p={pickedP} label={labelOf(pickedP.key)} myFlat={myFlat} />}
    </div>
  );
}

// ── the section host ─────────────────────────────────────────────────

function SimilaritySection({ scope }: { scope: "city" | "country" | "world" }) {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);
  // Default-on (D112): the field is the stop's identity, so it loads with
  // the stop — no tab to open first, nothing to opt into. The loader is
  // bounded and session-cached; see live.ts loadSimilarity.
  React.useEffect(() => { void LIVE.loadSimilarity(); }, []);
  if (!LIVE.enabled) return null;

  const myParsed = parseTestResults(LIVE.myTestResults(), CORE_TEST_KINDS);
  if (scope === "city") {
    return <CityField myParsed={myParsed} />;
  }
  // The viewer's own axes for the place fields: completed instruments
  // first, own answers to the bank's test items filling the gaps — real
  // data either way, and myFlatAxes labels neither as the other.
  // This conversion used to be written out here, and being the only copy
  // is what hid D131: result-card.jsx fed the fold a raw myVotes() and
  // scored nobody. Shared now, so there is one definition of what a vote
  // is worth to a scorer.
  const items = testItemMeta(LIVE.testFeedItems(), DEFS);
  const myFlat = myFlatAxes(myParsed, items, DEFS, voteIndices(LIVE.myVotes()));
  return <PlacesField scope={scope} myFlat={myFlat} />;
}

export default SimilaritySection;
