// The Patterns tab (v28 §2, ON TRIAL per D166 §1) — two lenses over the
// loading vectors the nightly fit publishes (functions/src/patterns.ts):
//
//   Oracle — the app guesses your next answer, SEALED before the options
//            are tappable, then graded in surprisal bits when your real
//            vote lands. The vote goes through LIVE.vote — the ordinary
//            answer path — so the Oracle is a lens on the app, not a
//            separate quiz.
//   Map    — every question in the pool as a place; distance IS how much
//            two answers predict each other. Position, colour, size, fill
//            and line each carry exactly one fact, no legend prose.
//
// Ported from design/standalone-v28/patterns-tab.jsx + question-map.jsx
// with the 560-person synthetic engine removed: the trial ships LIVE DATA
// ONLY (the narrowing D166 §1 licenses), so a build with no published
// loadings — the demo included — says so instead of inventing a crowd.
//
// One deliberate narrowing from the prototype: the pair card fetches the
// exact 2×2 for the STRONGEST link only, not all three — each say() costs
// two bounded voter queries, and the plan's own phrasing is singular
// ("the one exact 2×2 table you fetch for the pair actually on screen").
// The other links still draw; widening is a one-line change if the trial
// earns it.
import React from "react";
import LIVE from "../data/live";
import PATTERNS, { ensureLive, type OracleRecord, type PairSay, type PoolItem } from "../data/patterns";
import { edgesOf, mapGeometry, nearOf, planeOf, type MapNode } from "../data/patternsMap";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { WORLD_TOPICS } from "../spec/world-feed-data.js";

const W = 344, H = 330;
const SANS = "var(--sans)";

interface Topic { id: string; label: string; color: string }
// `cat` is nullable on the view model; a question without a topic wears
// the tab accent rather than a fabricated hue.
const topicOf = (cat: string | null | undefined): Topic | undefined =>
  (WORLD_TOPICS as Topic[]).find((t) => t.id === cat);
const hueOf = (cat: string | null | undefined): string => {
  const t = topicOf(cat);
  return t ? (WPAL.c(t.color) as string) : "var(--accent)";
};
const inkOf = (cat: string | null | undefined): string => {
  const t = topicOf(cat);
  return t ? (WPAL.ink(t.color) as string) : "var(--accent)";
};
const short = (s: string, n: number): string =>
  s.length > n ? s.slice(0, n - 1).trimEnd().replace(/[.,;:!?…]$/, "") + "…" : s;

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
  oracle: "It studies your past answers, then guesses your next one — sealed before you tap. A tall bar is a time you surprised it.",
};

const LENSES = [
  { id: "oracle", label: "Oracle" },
  { id: "map", label: "Map" },
] as const;
type Lens = (typeof LENSES)[number]["id"];

// The same ruler the daily and the mirror wear — one axis, stops on a
// scale. Map sits on the right because that is the edge the daily is on.
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

const catChip = (cat: string | null | undefined): React.ReactElement | null => {
  const t = topicOf(cat);
  if (!t) return null;
  return (
    <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, background: WPAL.wash(hueOf(cat), 16) as string, color: inkOf(cat) }}>
      {t.label}
    </span>
  );
};

// ── the Map lens ────────────────────────────────────────────────────────

function MapLens({ items, version, onUse }: { items: PoolItem[]; version: number; onUse: () => void }): React.ReactElement {
  const [sel, setSel] = React.useState<number | null>(null);
  // Geometry recomputes only when the pool changes (a vote landing, the
  // loadings arriving) — the springs are ~200 iterations over every edge,
  // not a per-render cost. Keyed on the subscription version: the pool is
  // a pure fold over exactly the state that bumps it.
  const geo = React.useMemo(() => {
    const nodes: MapNode[] = items.map((p) => ({ id: p.q.id, L: p.L, n: p.n }));
    const { U, hub } = mapGeometry(nodes);
    const edges = edgesOf(U, 3);
    const pts = planeOf(nodes, edges);
    return { U, hub, edges, pts };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the pool's identity (see above)
  }, [version]);

  // The strongest link's exact 2×2, fetched for the selected pair only.
  const [say, setSay] = React.useState<{ qid: string; s: PairSay | null; other: PoolItem } | null>(null);
  const selId = sel != null && items[sel] ? items[sel].q.id : null;
  React.useEffect(() => {
    if (selId == null || sel == null) { setSay(null); return; }
    const top = nearOf(geo.U, sel, 1)[0];
    const other = top ? items[top.j] : undefined;
    if (!other) { setSay(null); return; }
    let on = true;
    setSay(null);
    void PATTERNS.say(selId, other.q.id)
      .then((s) => { if (on) setSay({ qid: selId, s, other }); })
      .catch(() => { if (on) setSay({ qid: selId, s: null, other }); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geo/items follow `version`; selId names the selection
  }, [selId]);

  if (!items.length || !geo.pts.length) {
    return (
      <div className="card" style={{ padding: "22px 18px", textAlign: "center", fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        The fit has published, but none of its questions are on this device yet.
      </div>
    );
  }

  const nb = sel == null ? null : nearOf(geo.U, sel, 3);
  const shown = sel == null || !nb ? geo.edges : nb.map((x) => ({ i: sel, j: x.j, r: x.r }));
  const nearSet = nb ? new Set(nb.map((x) => x.j)) : null;
  const rOf = (i: number) => 3.1 + geo.hub[i] * 3.9;
  const hue = (i: number) => hueOf(items[i].q.cat);
  const pick = (i: number) => { setSel((s) => (s === i ? null : i)); onUse(); };
  const q = sel != null ? items[sel] : null;

  return (
    <>
      <div className="card" style={{ padding: "10px 8px 6px" }}>
        <svg style={{ width: "100%", height: "auto", display: "block" }} viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Every question, placed by how much its answer predicts the others">
          <g>
            {shown.map((l, k) => {
              const a = geo.pts[l.i], b = geo.pts[l.j];
              const lit = sel != null;
              return (
                <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={lit ? hue(sel as number) : "var(--ink-3)"}
                  strokeWidth={lit ? 1.1 + Math.abs(l.r) * 3.4 : 0.5 + Math.abs(l.r) * 1.6}
                  strokeDasharray={l.r < 0 ? "2.5 3" : undefined}
                  strokeLinecap="round"
                  opacity={lit ? 0.72 : l.r < 0 ? 0.2 : 0.28}></line>
              );
            })}
          </g>
          <g>
            {geo.pts.map((p) => {
              const i = p.i;
              const answered = items[i].mine != null;
              const dim = sel != null && i !== sel && !(nearSet && nearSet.has(i));
              const r = rOf(i);
              return (
                <g key={p.id} onClick={() => pick(i)} style={{ cursor: "pointer" }}>
                  <circle cx={p.x} cy={p.y} r={Math.max(11, r + 6)} fill="transparent"></circle>
                  {i === sel && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={hue(i)} strokeWidth="1.4" opacity="0.55"></circle>}
                  <circle cx={p.x} cy={p.y} r={r}
                    fill={answered ? hue(i) : "var(--surface)"}
                    stroke={hue(i)} strokeWidth={answered ? 0 : 1.5}
                    opacity={dim ? 0.22 : 1}></circle>
                </g>
              );
            })}
          </g>
        </svg>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", padding: "6px 0 4px", fontFamily: SANS, fontSize: 11, fontWeight: 650, color: "var(--ink-3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-3)" }}></i>answered</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--ink-3)", boxSizing: "border-box" }}></i>open</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 14, height: 0, borderTop: "2px solid var(--ink-3)" }}></i>together</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 14, height: 0, borderTop: "2px dotted var(--ink-3)" }}></i>opposite</span>
        </div>
      </div>

      {q ? (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {catChip(q.q.cat)}
            {q.mine != null && (
              <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>
                you said {q.q.options[q.mine === 1 ? 0 : 1]?.label}
              </span>
            )}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 17, lineHeight: 1.2, letterSpacing: "-0.02em", textWrap: "balance" }}>{q.q.text}</div>
          {q.mine == null && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {q.q.options.map((op) => (
                <button key={op.id} className="press" onClick={() => LIVE.vote(q.q.id, op.id)}
                  style={{ textAlign: "left", padding: "10px 13px", borderRadius: 12, border: "1px solid var(--rule)", background: "var(--surface-2)", cursor: "pointer", WebkitAppearance: "none", fontFamily: SANS, fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>
                  {op.label}
                </button>
              ))}
            </div>
          )}
          {say && say.qid === q.q.id && say.s && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
                Pick <b>{say.s.pick}</b> here — and <b>{say.s.pct}%</b> pick <b>{say.s.then}</b> on “{say.other.q.text}”
              </span>
              <span style={{ position: "relative", display: "block", height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${say.s.pct}%`, background: WPAL.wash(hue(sel as number), 44) as string, borderRadius: 999 }}></i>
                <em style={{ position: "absolute", left: `${say.s.base}%`, top: 0, bottom: 0, width: 2, background: "var(--ink-3)" }} title={`usually ${say.s.base}%`}></em>
              </span>
              {/* The stated basis — the D146 rule: a bounded sample says its size. */}
              <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
                of the {say.s.both} people in both samples
              </span>
            </div>
          )}
          {say && say.qid === q.q.id && !say.s && (
            <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
              Its strongest link is “{short(say.other.q.text, 60)}” — too few people have answered both to say more.
            </span>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: "14px 15px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: SANS }}>
            <b style={{ fontSize: 22, letterSpacing: "-0.03em" }}>{geo.edges.length}</b>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
              links hold across the {items.length} questions in the pool. Tap any place to read its own.
            </span>
          </div>
          {/* the answer §2 says this lens owes a tail answer: it is not in the shared corpus */}
          <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
            Core questions only — a feed answer outside the shared corpus isn’t placed here.
          </span>
        </div>
      )}
    </>
  );
}

// ── the Oracle lens ─────────────────────────────────────────────────────

function OracleLens({ items, onUse }: { items: PoolItem[]; onUse: () => void }): React.ReactElement {
  // The question on screen. Held explicitly so the reveal stays up after
  // the vote lands (nextAsk would already have moved on), and advanced
  // only by the "Next question" button.
  const [cur, setCur] = React.useState<string | null>(null);
  const item = cur ? items.find((p) => p.q.id === cur) ?? null : null;
  React.useEffect(() => {
    // fills `cur` once the pool can offer one; the id-change guard is what
    // keeps it from looping when nextAsk keeps answering the same thing
    if (!item) {
      const nxt = PATTERNS.nextAsk();
      if (nxt && nxt.q.id !== cur) setCur(nxt.q.id);
    }
  }, [item, cur]);

  // SEAL BEFORE THE OPTIONS RENDER (v28 §2, pinned in patterns.test.ts):
  // the options are gated on `rec`, and `rec` only exists once the guess
  // is persisted — so there is no frame where an answer could land ahead
  // of the seal.
  const [rec, setRec] = React.useState<OracleRecord | null>(null);
  React.useEffect(() => {
    setRec(cur ? PATTERNS.seal(cur) : null);
  }, [cur]);

  // Grade once the real answer lands through the ordinary vote path.
  const mine = item ? item.mine : null;
  React.useEffect(() => {
    if (cur && mine != null && rec && rec.bits == null) setRec(PATTERNS.grade(cur));
  }, [cur, mine, rec]);

  const m = PATTERNS.meter();
  const graded = rec != null && rec.bits != null && rec.mine != null;
  const hit = graded && rec.pred === rec.mine;
  const conf = rec ? (rec.pred === 0 ? rec.p0 : 1 - rec.p0) : 0;

  const next = () => {
    setRec(null);
    const nxt = PATTERNS.nextAsk();
    setCur(nxt ? nxt.q.id : null);
  };

  const meterStrip = (
    <div className="card" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: "12px 15px" }}>
      <div style={{ fontFamily: SANS }}>
        <b style={{ fontSize: 24, letterSpacing: "-0.03em" }}>{m.called}</b>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", marginLeft: 6 }}>of {m.records.length} called</span>
      </div>
      <div aria-label="Your last answers — height is how much you surprised it"
        style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 58 }}>
        {m.records.slice(-18).map((r, i) => (
          <i key={i} title={`${r.bits} bits`} style={{
            width: 5, borderRadius: 2,
            height: 6 + (Math.min(2, r.bits as number) / 2) * 52,
            background: r.pred === r.mine ? "color-mix(in oklch, var(--ink) 22%, var(--surface-2))" : "var(--accent)",
          }}></i>
        ))}
      </div>
    </div>
  );

  if (!item) {
    const anyOpen = items.some((p) => p.mine == null);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {m.records.length > 0 && meterStrip}
        <div className="card" style={{ padding: "22px 18px", textAlign: "center", fontFamily: SANS, lineHeight: 1.5 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {anyOpen ? "Nothing to guess yet" : "Nothing left to guess"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginTop: 6 }}>
            {anyOpen
              ? "The open questions here don’t have enough answers behind them for an honest guess. The nightly fit widens as the crowd does."
              : "You’ve answered every question on the map. New ones join as the crowd answers them."}
          </div>
        </div>
      </div>
    );
  }

  const evidence = graded && rec.ev
    ? rec.ev
      .map((id) => items.find((p) => p.q.id === id))
      .filter((p): p is PoolItem => !!p && p.mine != null)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {m.records.length > 0 && meterStrip}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {catChip(item.q.cat)}
          {!graded && rec && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-3)" }}>
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 3px color-mix(in oklch, var(--accent), var(--surface) 78%)" }}></i>
              guess sealed
            </span>
          )}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 19, lineHeight: 1.16, letterSpacing: "-0.025em", textWrap: "balance" }}>{item.q.text}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {item.q.options.map((op, i) => graded ? (
            <div key={op.id} style={{
              position: "relative", padding: "10px 13px", borderRadius: 12, fontFamily: SANS, fontSize: 14, fontWeight: 650,
              border: i === rec.mine ? "1.5px solid var(--accent)" : "1px solid var(--rule)",
              background: i === rec.mine ? "color-mix(in oklch, var(--accent), var(--surface) 90%)" : "var(--surface-2)",
            }}>
              {op.label}
              {i === rec.mine && <span style={{ position: "absolute", top: -8, left: 10, fontFamily: SANS, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>you</span>}
              {i === rec.pred && <span style={{ position: "absolute", top: -8, right: 10, fontFamily: SANS, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", background: "var(--ink)", color: "var(--surface)", padding: "2px 8px", borderRadius: 999 }}>oracle</span>}
            </div>
          ) : (
            // untappable until the seal exists — rec gates the whole row
            rec && (
              <button key={op.id} className="press" onClick={() => { LIVE.vote(item.q.id, op.id); onUse(); }}
                style={{ textAlign: "left", padding: "11px 13px", borderRadius: 12, border: "1px solid var(--rule)", background: "var(--surface-2)", cursor: "pointer", WebkitAppearance: "none", fontFamily: SANS, fontSize: 14.5, fontWeight: 650, color: "var(--ink)" }}>
                {op.label}
              </button>
            )
          ))}
        </div>
        {graded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", paddingTop: 11 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ position: "relative", display: "block", height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(conf * 100)}%`, background: "color-mix(in oklch, var(--accent), var(--surface) 55%)", borderRadius: 999 }}></i>
              </span>
              <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
                <b>{Math.round(conf * 100)}%</b> sure you’d say {item.q.options[rec.pred]?.label}
              </span>
            </div>
            {evidence.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 650, color: "var(--ink-3)" }}>
                  {hit ? "what gave you away" : "it leaned on"}
                </span>
                {evidence.map((p) => (
                  <span key={p.q.id} style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: WPAL.wash(hueOf(p.q.cat), 14) as string, color: inkOf(p.q.cat) }}>
                    {short(p.q.options[p.mine === 1 ? 0 : 1]?.label ?? "", 20)}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: SANS }}>
              <b style={{ fontSize: 15, letterSpacing: "-0.02em", color: hit ? "var(--ink)" : "var(--accent)" }}>
                {hit ? "Called it." : "You surprised it."}
              </b>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
                {hit ? "predictable, this once" : `+${(rec.bits as number).toFixed(2)} bits of you`}
              </span>
            </div>
            <button className="press" onClick={next}
              style={{ alignSelf: "flex-start", border: "none", borderRadius: 999, padding: "9px 20px", cursor: "pointer", WebkitAppearance: "none", background: "var(--ink)", color: "var(--surface)", fontFamily: SANS, fontWeight: 800, fontSize: 13.5 }}>
              Next question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── the tab ─────────────────────────────────────────────────────────────

export default function PatternsTab(): React.ReactElement {
  const version = usePatterns();
  const [lens, setLens] = React.useState<Lens>("map");
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 16px 18px" }}>
      <Ruler lens={lens} onLens={setLens} />
      {!used && (
        <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5, padding: "0 2px" }}>
          {NOTES[lens]}
        </div>
      )}
      {lens === "map"
        ? <MapLens items={items} version={version} onUse={markUsed} />
        : <OracleLens items={items} onUse={markUsed} />}
    </div>
  );
}
