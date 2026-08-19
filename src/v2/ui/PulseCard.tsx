// A pulse, compact, beside the blind daily — the v24 design
// (design/standalone-v24/pulse-card.jsx) ported typed, at roster size
// since D200. Same contract as the daily question: you answer before you
// see anyone else; the five inputs BECOME the chart on reveal. One hue
// throughout (--pulse).
// "Your line →" opens the Trends reading in place — the chart is a lazy
// chunk (check:bundle: the card is first-screen, the reading is not), and
// its 21-day window is fetched on that tap rather than on every open.
import React from "react";
import PULSE, { CADENCES, CADENCE_LABEL, type Cadence } from "../data/pulse";

const PulseTrendsLazy = React.lazy(() => import("./PulseTrends"));

export default function PulseCard({ pid }: { pid?: string } = {}): React.ReactElement | null {
  const [, bump] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [cadOpen, setCadOpen] = React.useState(false);
  React.useEffect(() => {
    void PULSE.ensureToday().catch(() => { /* the ask renders without a crowd */ });
    return PULSE.subscribe(() => bump((x) => x + 1));
  }, [bump]);

  // Live before the bank arrives: render nothing rather than a blank
  // question — the effect above fills it within the open's one fetch.
  if (!PULSE.ready()) return null;
  const id = pid || PULSE.first();
  const q = PULSE.q(id);
  if (!q) return null;

  const HUE = "var(--pulse)";
  const steps = PULSE.steps(id);
  const mine = PULSE.mineToday(id);
  const st = PULSE.streak(id);
  const nToday = PULSE.todayN(id, "world");
  const bins = PULSE.bins(id, "world");
  const cad = PULSE.cadence(id);
  const maxBin = Math.max(1, ...bins);
  // Rectangular mixing on purpose: an oklch mix from indigo (282°) into
  // the warm near-neutral surfaces takes the short way round the wheel
  // and lands in the salmon/rose arc. oklab holds the hue.
  const wash = (pct: number) => `color-mix(in oklab, ${HUE} ${pct}%, var(--surface-2))`;

  // ── the streak: the last fourteen ASKS as they were, not a trophy.
  // Filled = answered, faint = missed, ring = today still open. Tap → the
  // reading. Asks rather than days since D200: a weekly pulse's strip is
  // fourteen Sundays, not a fortnight with two marks in it.
  const strip = (
    <button className="press" onClick={() => { const next = !open; setOpen(next); if (next) void PULSE.ensureTrend(id).catch(() => { /* the reading draws your own line regardless */ }); }}
      aria-expanded={open}
      aria-label={"Your last 14 asks" + (st.run ? " — " + st.run + " in a row" : "") + ". Open your trend."}
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
          <button key={s.v} className="press" onClick={() => PULSE.answer(id, s.v)} aria-label={s.label}
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
            you · {PULSE.word(id, mine)}
          </span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
            {nToday > 0
              ? bins[mine - 1] + "% of " + PULSE.fmtN(nToday) + (nToday === 1 ? " answer today" : " answers today")
              : "the first answer today"}
          </span>
        </div>
        <button className="press" onClick={() => { const next = !open; setOpen(next); if (next) void PULSE.ensureTrend(id).catch(() => { /* the reading draws your own line regardless */ }); }} aria-expanded={open}
          style={{ border: "none", background: "none", padding: "4px 0", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: HUE, whiteSpace: "nowrap", WebkitAppearance: "none" }}>
          {open ? "close ↑" : "your line →"}
        </button>
      </div>
    </div>
  );

  // ── the rhythm (D200): how often this pulse asks, set where it asks.
  // "Show up more often" is a cadence rather than a settings screen, so
  // the control lives on the card and says only its current state until
  // it is tapped — four chips standing open on every pulse would be more
  // chrome than question.
  const rhythm = (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <button className="press" onClick={() => setCadOpen((o) => !o)} aria-expanded={cadOpen}
        aria-label={"How often this pulse asks — " + CADENCE_LABEL[cad] + ". Change it."}
        style={{ alignSelf: "flex-start", border: "none", background: "none", padding: "2px 0", cursor: "pointer", WebkitAppearance: "none", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 650, color: "var(--ink-3)" }}>
        {CADENCE_LABEL[cad]} {cadOpen ? "↑" : "↓"}
      </button>
      {cadOpen && (
        <div role="radiogroup" aria-label="How often this pulse asks" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CADENCES.map((c) => {
            const on = c === cad;
            return (
              <button key={c} role="radio" aria-checked={on}
                onClick={() => { PULSE.setCadence(id, c as Cadence); setCadOpen(false); }}
                style={{
                  border: "none", cursor: "pointer", WebkitAppearance: "none",
                  padding: "5px 11px", borderRadius: 999,
                  fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 800 : 650,
                  color: on ? "var(--accent-ink)" : "var(--ink-3)",
                  background: on ? wash(16) : "var(--surface-3)",
                }}>{CADENCE_LABEL[c]}</button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="card" data-screen-label="Daily pulse" style={{ display: "flex", flexDirection: "column", gap: 11, padding: "13px 14px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: HUE }}></span>
          <span className="kicker" style={{ marginBottom: 0 }}>{q.kicker}</span>
        </span>
        {strip}
      </div>
      <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 21, lineHeight: 1.12, letterSpacing: "-0.03em", textWrap: "balance" }}>{q.text}</div>
      {mine == null ? ask : reveal}
      {rhythm}
      {open && (
        <div style={{ borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", paddingTop: 12 }}>
          <React.Suspense fallback={null}>
            <PulseTrendsLazy compact pid={id} />
          </React.Suspense>
        </div>
      )}
    </div>
  );
}
