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
// ruler, one sub-row under it (an ⓘ on every lens, plus the topic select
// on the map and the population chips on people since D216 — same height
// whichever lens is open, so switching never jumps), and the live gates.
// Ported from design/standalone-2026-08-20/patterns-tab.jsx; the
// 2026-08-24 build retired the shell's one-time lens explainer — each
// lens teaches its own marks — and renamed the wider two lenses so
// the ruler names what each is a map OF. Chrome rule carried with it,
// raised app-wide by the 2026-09-06 design: no type below 12px anywhere,
// in SVG or out.
//
// THE LEGENDS MOVED BEHIND ONE ⓘ (2026-09-06, VISION-2026-09-06 §2.4):
// `guide` is this shell's one flag, handed to whichever lens is open —
// the standing keys, hints and explainer sentences render only while it
// is on, and the numbers the sub-row used to carry moved into the
// instruments themselves (the Map's hub counts the pool; the Oracle's
// kicker counts the answered). Ephemeral on purpose: no device key, so
// check:purge's subject set does not grow.
//
// The trial ships LIVE DATA ONLY (the narrowing D166 §1 licenses): a
// build with no published loadings — the demo included — says so instead
// of inventing a crowd.
//
// SINCE D265 THIS FILE IS REACHED ONLY THROUGH A GATE. The tab is absent
// from the bar until the fit has published enough to draw and the viewer
// has answered enough to be drawn in it (`data/patternsReady.ts`), so the
// two states below are no longer what a first-time visitor lands on —
// they are what a viewer sees when the gate has opened and this session's
// fetch has not landed yet, or has landed on an emptier database than the
// gate was told about (an old build, a purge, a client bank that cannot
// name what the fit folded). They stay, unchanged and still honest: the
// gate is a floor on the CORPUS, and it was never able to promise that
// this device's own read succeeded.
import React from "react";
import LIVE from "../data/live";
import NAV from "../data/nav";
import PATTERNS, { ensureLive } from "../data/patterns";
import PatternsMap from "./PatternsMap";
import PatternsOracle from "./PatternsOracle";
import PatternsPeople, { type PeoplePop } from "./PatternsPeople";
import { countryOf } from "../data/peopleMap";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { WORLD_TOPICS } from "../spec/world-feed-data.js";
import "./patterns.css";

const SANS = "var(--sans)";

interface Topic { id: string; label: string; color: string }
const topicOf = (cat: string | null | undefined): Topic | undefined =>
  (WORLD_TOPICS as Topic[]).find((t) => t.id === cat);

// The one-time lens explainer that used to live here (and its
// `insight.patterns.used.v1` key) retired with the 2026-08-24 build:
// each lens teaches its own grammar in place, so a paragraph that
// pre-explained the picture was scaffolding twice over. The purge sweeps
// any stale key by prefix; nothing reads or writes it any more.

/** Re-render on store changes (votes landing, the loadings arriving). */
function usePatterns(): number {
  const [v, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => PATTERNS.subscribe(() => bump()), []);
  React.useEffect(() => {
    void ensureLive().catch(() => { /* the tab renders its waiting state; a re-entry retries */ });
  }, []);
  return v;
}

// People sits on the far right — read left to right the ruler widens:
// the oracle is one question about you, the question map is the whole
// pool, the people map is the whole crowd (the 2026-08-24 labels: the
// two wider stops name what each is a map OF).
const LENSES = [
  { id: "oracle", label: "Oracle" },
  { id: "map", label: "Question map" },
  { id: "people", label: "People map" },
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
              {/* one size, always (2026-09-02): a label that grows on
                  selection reflows the row it sits in, and the tick above
                  it already says which stop is open */}
              <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", whiteSpace: "nowrap", fontFamily: SANS, fontSize: 13.5, fontWeight: on ? 700 : 500, letterSpacing: "-0.01em", color: on ? "var(--ink)" : "var(--ink-3)", transition: "color .2s" }}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PatternsTab(): React.ReactElement {
  const version = usePatterns();
  // the incoming lens slides from the side you moved toward on the ruler
  // (2026-08-26) — the axis is a place, not a list, so a swap has a
  // direction. The direction rides IN the lens state (one object, one
  // set) rather than in a ref: the class reads it during render, and a
  // render-read ref is exactly what react-hooks/refs refuses. First
  // mount keeps the plain fade: nothing was moved from.
  const [lensSt, setLensSt] = React.useState<{ id: Lens; dir: "" | "l" | "r" }>({ id: "map", dir: "" });
  const lens = lensSt.id;
  // useCallback, not a plain closure: the swipe axis below holds this in
  // an effect, and a new identity every render would tear its listeners
  // down and re-add them on every render rather than on every lens change.
  const setLens = React.useCallback((id: Lens): void => setLensSt((cur) => {
    if (id === cur.id) return cur;
    const a = LENSES.findIndex((s) => s.id === cur.id);
    const b = LENSES.findIndex((s) => s.id === id);
    return { id, dir: b > a ? "r" : "l" };
  }), []);
  const [topic, setTopic] = React.useState("all");
  const [ppop, setPpop] = React.useState<PeoplePop>("world");
  // the explainer lives behind one ⓘ (2026-09-06) — it used to be a
  // title, a facts line, a progress track and a standing legend above and
  // below every lens. Per-tab and ephemeral: closing the tab forgets it.
  // (The facts line's ties count went with it — the idle card under the
  // Map still counts the links, beside the pool they hold across.)
  const [guide, setGuide] = React.useState(false);

  // The lens body drags on the SAME horizontal axis as the daily's modes
  // and the mirror's stops (2026-09-02): the ruler is a place, so the
  // finger can walk it. Past the far end the axis continues into the
  // daily — `NAV.goNav` is D166's one licensed joint, used from the other
  // side, and it ANSWERS whether it navigated, so a refusal springs back
  // instead of leaving the stack where the finger left it. The near end
  // has nowhere to go and always springs.
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const stackRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // A drag that starts inside a scroller or a control belongs to it —
    // but the lenses are TAP-ONLY (2026-09-06), so a horizontal drag on
    // their discs rides the axis. `svg` left this list with that change:
    // the Oracle's `.or-lens` exception generalised to all three, because
    // none of the fields scrolls or pans on its own.
    const SKIP = "canvas, .h-scroll, [data-nopan], input, textarea, select";
    const skips = (t: EventTarget | null): boolean => {
      const el2 = t instanceof Element ? t : null;
      return !!el2?.closest(SKIP);
    };
    const spring = () => {
      const b = stackRef.current;
      if (!b) return;
      b.style.transition = "transform .25s cubic-bezier(0.2,0.9,0.2,1), opacity .25s ease";
      b.style.transform = "translateX(0)";
      b.style.opacity = "1";
    };
    const commit = (dir: 1 | -1) => {
      const i = LENSES.findIndex((x) => x.id === lens);
      const ni = i + dir;
      if (ni < 0) { spring(); return; }
      if (ni >= LENSES.length) {
        // the axis runs off its far end into the daily; if the shell
        // refuses (it is not mounted, or the key is unknown) nothing moved
        if (!NAV.goNav("track:world")) spring();
        return;
      }
      const b = stackRef.current;
      if (b) {
        b.style.transition = "transform .16s ease, opacity .16s ease";
        b.style.transform = `translateX(${dir > 0 ? -34 : 34}px)`;
        b.style.opacity = "0";
      }
      setLens(LENSES[ni].id);
    };
    let sx = 0, sy = 0, dx = 0;
    let horiz: boolean | null = null;
    let dragging = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || skips(e.target)) { dragging = false; return; }
      sx = t.clientX; sy = t.clientY; dx = 0; horiz = null; dragging = true;
      const b = stackRef.current;
      if (b) b.style.transition = "none";
    };
    const onMove = (e: TouchEvent) => {
      if (!dragging) return;
      const t = e.touches[0];
      if (!t) return;
      const mx = t.clientX - sx, my = t.clientY - sy;
      if (horiz === null && (Math.abs(mx) > 9 || Math.abs(my) > 9)) horiz = Math.abs(mx) > Math.abs(my) * 1.4;
      if (!horiz) return;
      e.preventDefault();
      dx = mx;
      const b = stackRef.current;
      if (b) b.style.transform = `translateX(${dx * 0.42}px)`;
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      if (horiz && Math.abs(dx) > 56) commit(dx < 0 ? 1 : -1); else spring();
    };
    let wheelLock = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) + 4) return;
      if (skips(e.target)) return;
      e.preventDefault();
      if (wheelLock || Math.abs(e.deltaX) < 24) return;
      wheelLock = true;
      commit(e.deltaX > 0 ? 1 : -1);
      setTimeout(() => { wheelLock = false; }, 620);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
    // Re-registered per lens rather than reading a ref written during
    // render: five listeners is nothing, and a render-written ref is what
    // react-hooks/refs refuses (the same refusal D310 recorded for the
    // slide's direction).
  }, [lens, setLens]);

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
    // The honest empty state: the trial ships live data only (D166 §1) —
    // no loadings published means nothing to draw, said out loud rather
    // than a fabricated crowd. The demo can no longer reach it, because
    // the gate that mounts this tab is shut on a build with no fit behind
    // it (D265); the branch stays because the sentence it protects is the
    // rule, not the surface it happens to render on.
    //
    // check:public-copy does not scan this file, so the demo line below is
    // held by the smoke-live case that asserts it CANNOT appear on a live
    // build, not by a gate.
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
  const chips = [{ id: "all", label: "All topics" }, ...cats.map((c) => ({ id: c, label: topicOf(c)?.label || c }))];
  // The population roster (D216) — the standalone's own: Circle · your
  // country's code · World. Circle always offers (the D190 posture: a row
  // draws even when the stop is empty — the lens says the honest state);
  // country only exists for a viewer whose frozen city anchor names one.
  const myCo = countryOf(LIVE.anchors().city);
  const pops: { id: PeoplePop; label: string }[] = [
    { id: "circle", label: "Circle" },
    ...(myCo ? [{ id: "country" as const, label: myCo }] : []),
    { id: "world", label: "World" },
  ];
  const pop: PeoplePop = pops.some((p) => p.id === ppop) ? ppop : "world";

  return (
    <div ref={wrapRef} className={"pt-wrap" + (lens === "oracle" ? " pt-oracle" : "")} style={{ padding: "6px 16px 18px" }}>
      <Ruler lens={lens} onLens={setLens} />
      <div className="pt-sub">
        {/* every lens's row leads with the one ⓘ (2026-09-06) — the
            legends, keys and explainer sentences render in the open lens
            while it is on. The facts line and the oracle's progress track
            retired into the instruments (the hub and the kicker say the
            numbers); the topic filter stays one control, not a scroller
            of chips, on the lens whose body takes the horizontal drag. */}
        <div className="pt-meta">
          <button type="button" className={"pt-info" + (guide ? " is-on" : "")}
            aria-expanded={guide} aria-label="Legend"
            onClick={() => setGuide((g) => !g)}>i</button>
          {lens === "map" ? (
            <label className={"pt-topic" + (topic !== "all" ? " is-on" : "")}>
              <span>{(chips.find((c) => c.id === topic) ?? chips[0]).label}</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
                {chips.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          ) : lens === "people" ? (
            <div className="pt-pops h-scroll" role="tablist" aria-label="Population">
              {pops.map((p) => (
                <button key={p.id} role="tab" aria-selected={pop === p.id}
                  className={"pt-pop" + (pop === p.id ? " is-on" : "")} onClick={() => setPpop(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div key={lens} ref={stackRef} className={(lensSt.dir ? "pt-slide-" + lensSt.dir : "fade-in") + " pt-stack"}>
        {lens === "map" && <PatternsMap items={items} version={version} topic={topic} guide={guide} />}
        {lens === "oracle" && <PatternsOracle items={items} version={version} guide={guide} />}
        {lens === "people" && (
          <PatternsPeople items={items} version={version} pop={pop} guide={guide} onOracle={() => setLens("oracle")} />
        )}
      </div>
    </div>
  );
}
