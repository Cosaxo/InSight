// A pulse card — the v28 design (design/standalone-v28/pulse-card.jsx)
// ported typed, one card per roster entry. Same contract as the daily
// question: you answer before you see anyone else; the five inputs BECOME
// the chart on reveal. One hue throughout — the first pulse keeps the
// house --pulse token, the others carry their v28 hue through the palette
// gate's contrast-safe twin. "Your line →" opens the Trends reading in
// place — the chart is a lazy chunk (check:bundle).
//
// The card is a feed question like any other: it takes its turn in the
// world feed (feed-interleave's pulse slot), never a block pinned above
// it, and there is no tray of the ones you are not being asked — a
// dormant pulse is simply not asked. Cadence lives on each card.
import React from "react";
import PULSE, { ROSTER, type Cadence } from "../data/pulse";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";

const PulseTrendsLazy = React.lazy(() => import("./PulseTrends"));

export default function PulseCard({ qid = ROSTER[0].qid }: { qid?: string }): React.ReactElement | null {
  const [, bump] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    void PULSE.ensureLive(qid).catch(() => { /* the ask renders without a crowd */ });
    return PULSE.subscribe(() => bump((x) => x + 1));
  }, [bump, qid]);

  // Live before the template arrives: render nothing rather than a blank
  // question — the effect above fills it within the open's one fetch.
  if (!PULSE.ready(qid)) return null;

  const hue = ROSTER.find((p) => p.qid === qid)?.hue ?? null;
  const HUE = hue == null ? "var(--pulse)" : (WPAL.ink(`oklch(0.52 0.14 ${hue})`) as string);
  const steps = PULSE.steps(qid);
  const qq = PULSE.q(qid);
  const mine = PULSE.mineToday(qid);
  const st = PULSE.streak(qid);
  const nToday = PULSE.todayN("world", qid);
  const bins = PULSE.bins("world", qid);
  const maxBin = Math.max(1, ...bins);
  const cad = PULSE.cadence(qid);
  // Rectangular mixing on purpose: an oklch mix from indigo (282°) into
  // the warm near-neutral surfaces takes the short way round the wheel
  // and lands in the salmon/rose arc. oklab holds the hue.
  const wash = (pct: number) => `color-mix(in oklab, ${HUE} ${pct}%, var(--surface-2))`;

  // ── the streak: fourteen days as they were, not a trophy. Filled =
  // answered, faint = missed (an unscheduled day draws nothing brighter —
  // it was never asked), ring = today still open. Tap → the reading.
  const strip = (
    <button className="press" onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-label={"Your last 14 days" + (st.run ? " — " + st.run + " in a row" : "") + ". Open your trend."}
      style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "none", padding: "4px 0", cursor: "pointer", WebkitAppearance: "none" }}>
      {st.run >= 3 && <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em", color: HUE }}>{st.run}</span>}
      <span aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 2.5 }}>
        {st.ticks.map((d) => (
          <span key={d.key} style={{
            width: 3, height: d.today ? 13 : 11, borderRadius: 2,
            background: d.v != null ? HUE : "color-mix(in oklch, var(--ink) 12%, var(--surface-2))",
            boxShadow: d.today && d.v == null ? "inset 0 0 0 1px " + wash(55) : "none",
          }}></span>
        ))}
      </span>
    </button>
  );

  // ── the scale's key, read once: only the two ends are named
  const ends = (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
      <span>{steps[0].label.toLowerCase()}</span><span>{steps[steps.length - 1].label.toLowerCase()}</span>
    </div>
  );

  const ask = (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((s, i) => (
          <button key={s.v} className="press" onClick={() => PULSE.answer(s.v, qid)} aria-label={s.label}
            style={{ flex: 1, height: "var(--field-size)", border: "1px solid color-mix(in oklab, " + HUE + " 24%, var(--rule))", borderRadius: 13, background: wash(7), display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitAppearance: "none", padding: 0 }}>
            <span aria-hidden="true" style={{ width: 9 + i * 4, height: 9 + i * 4, borderRadius: "50%", background: HUE }}></span>
          </button>
        ))}
      </div>
      {ends}
    </div>
  );

  const reveal = mine == null ? null : (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, animation: "popIn .35s cubic-bezier(0.2,0.8,0.2,1)" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        {steps.map((s, i) => {
          const on = s.v === mine;
          return (
            <div key={s.v} title={s.label + " · " + bins[i] + "%"}
              style={{ flex: 1, height: "var(--field-size)", borderRadius: 13, border: on ? "1.5px solid " + HUE : "1px solid transparent", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
              <span style={{ width: "100%", height: 10 + 42 * (bins[i] / maxBin), borderRadius: on ? 11 : 9, background: on ? HUE : wash(22), transition: "height .5s cubic-bezier(0.2,0.8,0.2,1)" }}></span>
            </div>
          );
        })}
      </div>
      {ends}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 14, letterSpacing: "-0.02em" }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: HUE }}></span>
            you · {PULSE.word(mine, qid)}
          </span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
            {nToday > 0
              ? bins[mine - 1] + "% of " + PULSE.fmtN(nToday) + (nToday === 1 ? " answer today" : " answers today")
              : "the first answer today"}
          </span>
        </div>
        <button className="press" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          style={{ border: "none", background: "none", padding: "4px 0", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: HUE, whiteSpace: "nowrap", WebkitAppearance: "none" }}>
          {open ? "close ↑" : "your line →"}
        </button>
      </div>
    </div>
  );

  // ── the cadence, on the card and always visible — it is the answer to
  // "ask me this more often", and turning a pulse up is how the roster
  // gets used. Setting `off` removes the card from the feed on the next
  // render: a dormant pulse is simply not asked, so the control has to
  // live here rather than on a settings screen the dormant card could
  // never be reached from.
  const cadRow = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 40%)", paddingTop: 10 }}>
      <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 650, color: "var(--ink-3)", flexShrink: 0 }}>ask me</span>
      <div role="tablist" aria-label="How often to ask this pulse" style={{ display: "flex", gap: 5, flex: 1 }}>
        {PULSE.CADENCES.map((c: Cadence) => {
          const on = c === cad;
          return (
            <button key={c} role="tab" aria-selected={on} className="press" onClick={() => PULSE.setCadence(qid, c)}
              style={{
                flex: 1, height: 28, borderRadius: 999, cursor: "pointer", WebkitAppearance: "none", padding: 0,
                fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: on ? 800 : 600,
                color: on ? "#fff" : "var(--ink-2)",
                background: on ? HUE : wash(7),
                border: on ? "1px solid transparent" : "1px solid " + wash(20),
              }}>{c}</button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="card" data-screen-label={qq.kicker} style={{ display: "flex", flexDirection: "column", gap: 11, padding: "13px 14px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: HUE }}></span>
          <span className="kicker" style={{ marginBottom: 0 }}>{qq.kicker}</span>
        </span>
        {strip}
      </div>
      <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 21, lineHeight: 1.12, letterSpacing: "-0.03em", textWrap: "balance" }}>{qq.text}</div>
      {mine == null ? ask : reveal}
      {open && (
        <div style={{ borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", paddingTop: 12 }}>
          <React.Suspense fallback={null}>
            <PulseTrendsLazy compact qid={qid} />
          </React.Suspense>
        </div>
      )}
      {cadRow}
    </div>
  );
}
