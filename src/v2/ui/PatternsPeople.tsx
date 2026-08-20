// The People lens (D214) — the crowd as a shared map with no centre.
// Ported from the 2026-08-20 standalone's people-lens.jsx
// (design/standalone-2026-08-20/) with the engine swapped for real
// data (D167): the prototype's simulated crowd becomes the voter lists
// live.ts already caches for the who-voted sheet, Kindred and the pair
// card, and every position is data/peopleMap.ts's device-side solve over
// the published loadings. No new read shape anywhere: at most
// PEOPLE_QUESTIONS bounded voter queries per session, each shared with
// those surfaces through the same cache.
//
// What draws is the fold's output verbatim — this file owns pixels and
// states only. The honesty rules live in peopleMap.ts's header; the two
// visible here: a dot below the floor was never in `placed` (so nothing
// here can accidentally draw it), and a nameless account reads "Someone"
// rather than wearing an invented name.
//
// Populations since D216 — the standalone's chips, live: `pop` narrows
// WHO is placed (your country by the frozen city anchor's code, your
// circle by the capped follows list), never what is counted — shared and
// agree are the same figures in every view, and each population reframes
// its own picture. The circle's crowd floor is its own (see
// PEOPLE_MIN_CROWD_CIRCLE), and the one wording change is the tie
// clause: "% overall do", because the share is the fit's world marginal
// in every population.
import React from "react";
import LIVE from "../data/live";
import type { PoolItem } from "../data/patterns";
import {
  countryOf,
  foldPeople,
  peopleFetchSet,
  PEOPLE_H,
  PEOPLE_MIN_ANSWERED,
  PEOPLE_MIN_CROWD,
  PEOPLE_MIN_CROWD_CIRCLE,
  PEOPLE_W,
  type PeopleFoldOpts,
  type PeopleItem,
  type PeopleRow,
  type PlacedPerson,
} from "../data/peopleMap";

/** The populations (D216) — the standalone's own roster. `country` only
 * exists for a viewer whose frozen city anchor names one. */
export type PeoplePop = "world" | "country" | "circle";

const SANS = "var(--sans)";

const slim = (items: readonly PoolItem[]): PeopleItem[] =>
  items.map((p) => ({
    qid: p.q.id,
    L: p.L,
    n: p.n,
    marginal: p.marginal,
    mine: p.mine,
    optionLabels: p.q.options.map((o) => o.label),
  }));

/** live.ts's rows, narrowed to the fold's shape (they already match). */
const rowsOf = (qid: string): readonly PeopleRow[] | null => LIVE.voters(qid);

function Empty({ head, line, cta }: { head: string; line: string; cta?: React.ReactNode }): React.ReactElement {
  return (
    <div className="card" style={{ minHeight: 330, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px 36px", gap: 8, boxSizing: "border-box" }}>
      <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{head}</div>
      <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5, textWrap: "pretty", maxWidth: 250 }}>{line}</div>
      {cta ?? null}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  fontFamily: SANS, fontSize: 10.5, fontWeight: 750, letterSpacing: "0.06em", textTransform: "uppercase",
  padding: "3px 9px", borderRadius: 999,
  background: "color-mix(in oklab, var(--accent) 10%, var(--surface-2))",
  color: "var(--accent-ink, var(--accent))",
};

export default function PatternsPeople({ items, version, pop = "world", onUse, onOracle }: {
  items: PoolItem[];
  version: number;
  pop?: PeoplePop;
  onUse: () => void;
  onOracle: () => void;
}): React.ReactElement {
  const [sel, setSel] = React.useState<string | null>(null);
  React.useEffect(() => { setSel(null); }, [pop]);

  const people = React.useMemo(() => slim(items), [items]);
  const fetchSet = React.useMemo(() => peopleFetchSet(people), [people]);

  // The circle's membership list — one capped, session-cached fetch
  // (loadFollows' own guards make re-kicks free). Needed in every
  // population: members wear the "your circle" chip wherever they stand.
  React.useEffect(() => { void LIVE.loadFollows(); }, []);
  const circleSet = React.useMemo(
    () => new Set(LIVE.follows() ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the follows cache's identity
    [version],
  );
  const myCo = countryOf(LIVE.anchors().city);
  const foldOpts = React.useMemo<PeopleFoldOpts>(() => ({
    circle: circleSet,
    keep: pop === "circle"
      ? (uid) => circleSet.has(uid)
      : pop === "country" && myCo
        ? (_uid, anchors) => countryOf(anchors.city) === myCo
        : undefined,
  }), [pop, circleSet, myCo]);

  // One pass of bounded loads, sequential like Kindred's (a dozen
  // collection-group queries fired at once is the shape that gets a
  // client rate-limited); loadVoters' own cache and in-flight guards make
  // re-runs free, and each landing list notifies the store, which bumps
  // `version` and refolds below.
  React.useEffect(() => {
    let on = true;
    void (async () => {
      for (const qid of fetchSet) {
        if (!on) return;
        await LIVE.loadVoters(qid);
      }
    })();
    return () => { on = false; };
  }, [fetchSet]);

  // Refolds when the subscription version moves — the fold is a pure
  // function of exactly the state that bumps it (the MapLens idiom).
  const field = React.useMemo(
    () => foldPeople(people, fetchSet, rowsOf, foldOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the caches' identity (see above)
    [version, people, fetchSet, foldOpts],
  );

  if (field.answered < PEOPLE_MIN_ANSWERED) {
    return (
      <Empty head="Not placed yet" line="Answer a few more questions and the map can place you." cta={
        <button onClick={onOracle}
          style={{ marginTop: 10, border: "none", cursor: "pointer", WebkitAppearance: "none", background: "var(--ink)", color: "var(--surface-2)", fontFamily: SANS, fontSize: 13.5, fontWeight: 800, padding: "11px 20px", borderRadius: 999 }}>
          Ask the Oracle
        </button>
      } />
    );
  }

  // The crowd floor guards an anonymous crowd; your own circle draws from
  // the first placeable friend (PEOPLE_MIN_CROWD_CIRCLE's comment).
  const minCrowd = pop === "circle" ? PEOPLE_MIN_CROWD_CIRCLE : PEOPLE_MIN_CROWD;
  if (field.placed.length < minCrowd) {
    // Loading and thin render differently on purpose: "could not say yet"
    // is not "there is nobody" (the absent-vs-empty rule, loadVoters' own).
    if (fetchSet.some((qid) => LIVE.votersLoading(qid)) || (pop === "circle" && LIVE.followsLoading())) {
      return (
        <div className="card" style={{ minHeight: 330, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>
          Reading the crowd…
        </div>
      );
    }
    return pop === "circle"
      ? <Empty head="Crowd too thin" line="Nobody from your circle is placed here yet — you appear to each other as you both answer." />
      : <Empty head="Crowd too thin" line="Too few people share your questions yet. The map fills as the crowd answers." />;
  }

  const { placed, me } = field;
  const selP = sel == null ? null : placed.find((p) => p.uid === sel) ?? null;
  const pick = (p: PlacedPerson) => {
    setSel((s) => (s === p.uid ? null : p.uid));
    onUse();
  };
  const meLeft = me.x > PEOPLE_W - 46; // keep the "you" word inside the frame

  return (
    <>
      <div className="card" style={{ padding: "8px 6px 0" }}>
        <svg style={{ display: "block", width: "100%", touchAction: "manipulation" }} viewBox={`0 0 ${PEOPLE_W} ${PEOPLE_H}`} role="img"
          aria-label="People who share your questions, placed by their answers" onClick={() => { if (sel != null) setSel(null); }}>
          {placed.map((p) => {
            const on = p.uid === sel;
            const dim = selP != null && !on;
            return (
              <g key={p.uid} onClick={(e) => { e.stopPropagation(); pick(p); }}
                role="button" tabIndex={0}
                aria-label={`${p.name || "Someone"} · agrees on ${p.agree} of ${p.shared} shared answers`}
                style={{ cursor: "pointer", outline: "none", opacity: dim ? 0.22 : on ? 1 : p.op, transition: "opacity .25s ease" }}>
                <circle cx={p.x} cy={p.y} r={Math.max(p.r + 8, 15)} fill="transparent"></circle>
                <circle cx={p.x} cy={p.y} r={p.r + 2} fill="var(--surface-2)"></circle>
                <circle cx={p.x} cy={p.y} r={p.r} fill={`oklch(0.56 0.09 ${p.hue})`}></circle>
                {on && <circle cx={p.x} cy={p.y} r={p.r + 5} fill="none" stroke="var(--accent)" strokeWidth="1.8"></circle>}
              </g>
            );
          })}
          {placed.map((p) => (p.lab && (selP == null || p.uid === sel) ? (
            <text key={`l${p.uid}`} x={p.lab.x} y={p.lab.y} textAnchor="middle" fontFamily={SANS} fontSize="11" fontWeight="650"
              fill={p.uid === sel ? "var(--ink)" : "var(--ink-2)"}
              style={{ paintOrder: "stroke", stroke: "var(--surface-2)", strokeWidth: 3, pointerEvents: "none" }}>{p.name}</text>
          ) : null))}
          <g style={{ opacity: selP ? 0.22 : 1, transition: "opacity .25s ease" }}>
            <circle cx={me.x} cy={me.y} r={me.r + 2} fill="var(--surface-2)"></circle>
            <circle cx={me.x} cy={me.y} r={me.r} fill="var(--ink)"></circle>
            <circle cx={me.x} cy={me.y} r={me.r + 5} fill="none" stroke="var(--accent)" strokeWidth="1.4"></circle>
            <text x={meLeft ? me.x - me.r - 9 : me.x + me.r + 9} y={me.y + 3.5} textAnchor={meLeft ? "end" : "start"}
              fontFamily={SANS} fontSize="10" fontWeight="800" fill="var(--ink)"
              style={{ paintOrder: "stroke", stroke: "var(--surface-2)", strokeWidth: 3 }}>you</text>
          </g>
        </svg>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "6px 6px 9px", fontFamily: SANS, fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "oklch(0.56 0.09 250)", flexShrink: 0 }}></span><span>placed</span>
          <span style={{ color: "var(--rule)" }}>·</span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "oklch(0.56 0.09 40)", opacity: 0.5, flexShrink: 0 }}></span><span>= fewer shared answers</span>
          <span style={{ color: "var(--rule)" }}>·</span>
          <span style={{ width: 9, height: 9, borderRadius: "50%", border: "1.4px solid var(--accent)", boxSizing: "border-box", flexShrink: 0 }}></span><span>you</span>
        </div>
      </div>

      {selP ? (
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: SANS, fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{selP.name || "Someone"}</span>
            {selP.chips.map((c, k) => <span key={k} style={chipStyle}>{c}</span>)}
          </div>
          <div style={{ marginTop: 11, fontFamily: SANS, fontSize: 13.5, fontWeight: 650 }}>
            Agrees with you on <b style={{ fontWeight: 800 }}>{selP.agree} of {selP.shared}</b> shared answers here
          </div>
          <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
            <i style={{ display: "block", width: `${Math.round((selP.agree / selP.shared) * 100)}%`, height: "100%", borderRadius: 99, background: "color-mix(in oklab, var(--accent) 34%, var(--surface-2))", transition: "width .3s ease" }}></i>
          </div>
          {selP.tie ? (
            <div style={{ marginTop: 11, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
              {/* "overall", not "here" (D216): the share is the fit's own
                  world marginal, and stays that in every population — a
                  per-population share would be a new small-sample claim */}
              You both said <b style={{ fontWeight: 700, color: "var(--ink)" }}>{selP.tie.label}</b>{" "}
              <span style={{ color: "var(--ink-3)" }}>· {Math.round(selP.tie.share * 100)}% overall do</span>
            </div>
          ) : (
            <div style={{ marginTop: 11, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
              You split on everything you share.
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: SANS, fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{placed.length}</span>
            <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.4, textWrap: "pretty" }}>
              people placed around you, from the <b style={{ color: "var(--ink)", fontWeight: 700 }}>{field.answered} questions</b> you’ve answered here. Tap anyone.
            </span>
          </div>
          {/* The stated sample: newest-first, capped lists (VOTER_FETCH_CAP) — the who-voted sheet's own honest bias. */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
            Drawn from each question’s latest answers.
          </div>
        </div>
      )}
    </>
  );
}
