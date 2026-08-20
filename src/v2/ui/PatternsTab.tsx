// The Patterns tab (v28 §2, ON TRIAL per D166 §1) — three lenses over the
// loading vectors the nightly fit publishes (functions/src/patterns.ts):
//
//   Oracle — the app guesses your next answer, SEALED before the tiles
//            will take a tap, then graded when your real vote lands. The
//            vote goes through LIVE.vote — the ordinary answer path — so
//            the Oracle is a lens on the app, not a separate quiz.
//            PatternsOracle.tsx (the 2026-08-20 instrument, D215).
//   Map    — every question in the pool as a place; distance IS how much
//            two answers predict each other. PatternsMap.tsx (the
//            2026-08-20 field, D215).
//   People — the crowd itself in the same space (D214): real voters
//            placed by their answers, you among them, exact agreement
//            stated with its basis. PatternsPeople.tsx / data/peopleMap.ts.
//
// This file is the SHELL the standalone's patterns-tab.jsx draws: the
// ruler, one sub-row under it (topic chips on the map, run progress on
// the oracle — same height whichever lens is open, so switching never
// jumps), the one-time lens explainer, and the live gates. Ported from
// design/standalone-2026-08-20/patterns-tab.jsx with the population chips
// left out (the People lens is world-wide until per-population views get
// their own decision — D215 §4). Chrome rule carried with it: no type
// below 10.5px anywhere, in SVG or out.
//
// The trial ships LIVE DATA ONLY (the narrowing D166 §1 licenses): a
// build with no published loadings — the demo included — says so instead
// of inventing a crowd.
import React from "react";
import LIVE from "../data/live";
import PATTERNS, { ensureLive } from "../data/patterns";
import PatternsMap from "./PatternsMap";
import PatternsOracle from "./PatternsOracle";
import PatternsPeople from "./PatternsPeople";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { WORLD_TOPICS } from "../spec/world-feed-data.js";
import "./patterns.css";

const SANS = "var(--sans)";

interface Topic { id: string; label: string; color: string }
const topicOf = (cat: string | null | undefined): Topic | undefined =>
  (WORLD_TOPICS as Topic[]).find((t) => t.id === cat);

// The lens explainer retires the first time the lens is used (the
// prototype's rule — scaffolding, not chrome). The flags are account state
// like any insight.* key: purgeLocalTrace sweeps the key, and this drops
// the in-memory copy WITHOUT writing it back (check:purge).
const SEEN = "insight.patterns.used.v1";
let seenCache: Record<string, 1> | null = null;
const readSeen = (): Record<string, 1> => {
  if (!seenCache) {
    try { seenCache = (JSON.parse(localStorage.getItem(SEEN) || "{}") || {}) as Record<string, 1>; }
    catch { seenCache = {}; }
  }
  return seenCache;
};
window.addEventListener("insight:local-purge", () => { seenCache = null; });

function useUsed(lens: string): [boolean, () => void] {
  const [used, setUsed] = React.useState<boolean>(() => !!readSeen()[lens]);
  React.useEffect(() => { setUsed(!!readSeen()[lens]); }, [lens]);
  const mark = React.useCallback(() => {
    setUsed(true);
    const o = readSeen();
    if (!o[lens]) {
      o[lens] = 1;
      try { localStorage.setItem(SEEN, JSON.stringify(o)); } catch { /* best-effort — in-memory is right */ }
    }
  }, [lens]);
  return [used, mark];
}

/** Re-render on store changes (votes landing, the loadings arriving). */
function usePatterns(): number {
  const [v, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => PATTERNS.subscribe(() => bump()), []);
  React.useEffect(() => {
    void ensureLive().catch(() => { /* the tab renders its waiting state; a re-entry retries */ });
  }, []);
  return v;
}

const NOTES: Record<string, string> = {
  map: "Every question placed by how much its answer predicts the others — close together means tightly tied. A solid line joins answers that travel together, a dotted one where a pick predicts the opposite. Tap any place.",
  oracle: "It reads your past answers — feed votes included — and seals a guess before you tap. The taller fill is the side it called; a mark up on the ledger is a time you broke it.",
  people: "Real people who share your questions, placed by their answers — close together means alike. You sit wherever your answers put you, not at the centre. Fainter = fewer shared answers. Tap anyone.",
};

// People sits on the far right — read left to right the ruler widens:
// one question about you, the whole pool, the whole crowd (the
// 2026-08-20 standalone's own order).
const LENSES = [
  { id: "oracle", label: "Oracle" },
  { id: "map", label: "Map" },
  { id: "people", label: "People" },
] as const;
type Lens = (typeof LENSES)[number]["id"];

// The same ruler the daily and the mirror wear — one axis, stops on a scale.
function Ruler({ lens, onLens }: { lens: Lens; onLens: (l: Lens) => void }): React.ReactElement {
  const idx = Math.max(0, LENSES.findIndex((s) => s.id === lens));
  return (
    <div style={{ margin: "-6px 0 -2px" }}>
      <div style={{ position: "relative", display: "flex", height: 50 }} role="tablist" aria-label="How wide this lens looks">
        <div style={{ position: "absolute", left: 6, right: 6, bottom: 21, height: 1, background: "color-mix(in oklch, var(--rule), transparent 30%)" }}></div>
        {LENSES.map((s, i) => {
          const on = i === idx;
          const tick = 11 - (i / (LENSES.length - 1)) * 5.5;
          return (
            <button key={s.id} role="tab" aria-selected={on} aria-label={s.label}
              onClick={() => { if (s.id !== lens) onLens(s.id); }}
              style={{ flex: 1, minWidth: 0, position: "relative", height: 50, border: "none", background: "none", cursor: "pointer", WebkitAppearance: "none", padding: 0 }}>
              <span style={{ position: "absolute", left: "50%", bottom: 21, transform: "translateX(-50%)", width: on ? 3 : 1.5, height: on ? 14 : tick, borderRadius: 99, background: on ? "var(--accent)" : "color-mix(in oklch, var(--ink-3), transparent 45%)", transition: "height .28s cubic-bezier(0.2,0.8,0.2,1), background .3s, width .2s" }}></span>
              <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", whiteSpace: "nowrap", fontFamily: SANS, fontSize: on ? 15 : 13.5, fontWeight: on ? 800 : 600, letterSpacing: "-0.02em", color: on ? "var(--ink)" : "var(--ink-3)", transition: "color .2s, font-size .2s" }}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PatternsTab(): React.ReactElement {
  const version = usePatterns();
  const [lens, setLens] = React.useState<Lens>("map");
  const [topic, setTopic] = React.useState("all");
  const [used, markUsed] = useUsed(lens);

  if (!PATTERNS.ready()) {
    // Live, and the loadings doc has not answered yet (or the read failed
    // — a re-entry retries). Quiet rather than a spinner: this resolves in
    // one fetch or not at all this session.
    return (
      <div style={{ padding: "18px 16px" }}>
        <div className="card" style={{ padding: "22px 18px", textAlign: "center", fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>
          Reading the pattern fit…
        </div>
      </div>
    );
  }

  if (!PATTERNS.hasLoadings()) {
    // The honest empty state, and the demo's ONLY state: the trial ships
    // live data only (D166 §1) — no loadings published means nothing to
    // draw, said out loud rather than a fabricated crowd.
    return (
      <div style={{ padding: "18px 16px" }}>
        <div className="card" style={{ padding: "26px 18px", textAlign: "center", fontFamily: SANS, lineHeight: 1.5 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>No patterns yet</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginTop: 7 }}>
            {LIVE.enabled
              ? "Patterns draws from everyone’s real answers, folded nightly. The first fit hasn’t published yet — answer today’s questions and come back."
              : "Patterns draws only from real answers, so the demo has nothing to show here."}
          </div>
        </div>
      </div>
    );
  }

  const items = PATTERNS.pool();
  // only topics that actually have questions in the pool
  const cats = [...new Set(items.map((p) => p.q.cat).filter((c): c is string => !!c))];
  const chips = [{ id: "all", label: "All" }, ...cats.map((c) => ({ id: c, label: topicOf(c)?.label || c }))];
  const answered = items.filter((p) => p.mine != null).length;

  return (
    <div className={"pt-wrap" + (lens === "oracle" ? " pt-oracle" : "")} style={{ padding: "6px 16px 18px" }}>
      <Ruler lens={lens} onLens={setLens} />
      <div className="pt-sub">
        {lens === "map" ? (
          <div className="pt-pops h-scroll" role="tablist" aria-label="Topic">
            {chips.map((p) => (
              <button key={p.id} role="tab" aria-selected={topic === p.id}
                className={"pt-pop" + (topic === p.id ? " is-on" : "")} onClick={() => setTopic(p.id)}>
                {p.id !== "all" && <i className="pt-dot" style={{ background: WPAL.c(topicOf(p.id)?.color) as string }}></i>}
                {p.label}
              </button>
            ))}
          </div>
        ) : lens === "oracle" ? (
          <div className="pt-prog">
            <span className="pt-progtrack"><i style={{ width: `${items.length ? Math.round((answered / items.length) * 100) : 0}%` }}></i></span>
            <span className="pt-prognum">{answered}<em>/{items.length}</em></span>
          </div>
        ) : (
          // the People lens has no sub-controls yet (populations are D215
          // §4's unported remainder) — the row still holds its height so
          // switching lenses never jumps
          <span></span>
        )}
      </div>
      <div key={lens} className="fade-in pt-stack">
        {!used && <div className="pt-note">{NOTES[lens]}</div>}
        {lens === "map" && <PatternsMap items={items} version={version} topic={topic} onUse={markUsed} />}
        {lens === "oracle" && <PatternsOracle items={items} version={version} onUse={markUsed} />}
        {lens === "people" && (
          <PatternsPeople items={items} version={version} onUse={markUsed} onOracle={() => setLens("oracle")} />
        )}
      </div>
    </div>
  );
}
