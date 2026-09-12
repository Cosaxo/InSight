// A pulse, compact, beside the blind daily — the v24 design
// (design/standalone-v24/pulse-card.jsx) ported typed, at roster size
// since D203. Same contract as the daily question: you answer before you
// see anyone else; the five inputs BECOME the chart on reveal. One hue
// throughout (--pulse).
// "Your line →" opens the Trends reading in place — the chart is a lazy
// chunk (check:bundle: the card is first-screen, the reading is not), and
// its 21-day window is fetched on that tap rather than on every open.
import React from "react";
import PULSE from "../data/pulse";

const PulseTrendsLazy = React.lazy(() => import("./PulseTrends"));

export default function PulseCard({ pid }: { pid?: string } = {}): React.ReactElement | null {
  const [, bump] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  // Set when a pin is refused for being the fourth. Local to the card and
  // cleared by the next tap: it is a sentence about THIS tap, and a
  // refusal that outlived its tap would sit under a button that works.
  const [pinFull, setPinFull] = React.useState(false);
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
  const isPinned = PULSE.pinned(id);
  const maxBin = Math.max(1, ...bins);
  // Rectangular mixing on purpose: an oklch mix from indigo (282°) into
  // the warm near-neutral surfaces takes the short way round the wheel
  // and lands in the salmon/rose arc. oklab holds the hue.
  const wash = (pct: number) => `color-mix(in oklab, ${HUE} ${pct}%, var(--surface-2))`;

  // ── the streak: the last fourteen ASKS as they were, not a trophy.
  // Filled = answered, faint = missed, ring = today still open. Tap → the
  // reading. Asks rather than days since D203: a weekly pulse's strip is
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
              // ZERO IS THREE DIFFERENT FACTS, and only one of them is a
              // statement about the crowd. `todayN` answers 0 for "nobody
              // answered", "the read is in flight" and "the read was
              // refused" alike — and the effect above swallows the
              // rejection, so a refused read left this saying "the first
              // answer today" over a hundred real answers, permanently,
              // with nothing in the session retrying. D1: where a live
              // surface has not looked, the data is ABSENT, not zero.
              : PULSE.todayState() === "ready"
              ? "the first answer today"
              : PULSE.todayState() === "failed"
              ? "today's crowd didn't load"
              : "counting\u2026"}
          </span>
        </div>
        <button className="press" onClick={() => { const next = !open; setOpen(next); if (next) void PULSE.ensureTrend(id).catch(() => { /* the reading draws your own line regardless */ }); }} aria-expanded={open}
          style={{ border: "none", background: "none", padding: "4px 0", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: HUE, whiteSpace: "nowrap", WebkitAppearance: "none" }}>
          {open ? "close ↑" : "your line →"}
        </button>
      </div>
    </div>
  );

  // ── the pin: "I am tracking this one."
  //
  // What stood here was D203's rhythm picker — a disclosure over four
  // cadence chips, because a pulse that stacked above the feed needed a
  // way to ask less often. Every pulse asks every day now and they ride
  // the feed, so the question the control answers has changed from HOW
  // OFTEN to WHERE: a pinned pulse is held near the head of the feed, an
  // unpinned one takes whatever place the mix gives it.
  //
  // ONE BUTTON, NOT A DISCLOSURE OVER CHIPS. The state is binary and the
  // word for it is the word on the button, so the fold the four chips
  // needed buys nothing — `visual > word > sentence` (D182), and the old
  // control spent a tap before it said anything.
  //
  // The refusal is the one sentence here, and it is a claim rather than a
  // caption: a cap the card does not name is a button that silently does
  // nothing. It renders only after a refused tap, which is the only
  // moment it is true of anything the reader just did.
  const pin = (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <button className="press" aria-pressed={isPinned}
        onClick={() => { setPinFull(!PULSE.setPinned(id, !isPinned)); }}
        aria-label={isPinned ? "Tracking this pulse — it stays near the top of the feed. Stop tracking it." : "Track this pulse — it moves near the top of the feed."}
        style={{
          alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6,
          border: "none", cursor: "pointer", WebkitAppearance: "none",
          padding: "5px 11px", borderRadius: 999,
          fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: isPinned ? 800 : 650,
          color: isPinned ? "var(--accent-ink)" : "var(--ink-3)",
          background: isPinned ? wash(16) : "var(--surface-3)",
        }}>
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M6 7.6V11"></path>
          <path d="M3.1 1h5.8l-.7 3.1 1.5 1.6v.9H2.3v-.9l1.5-1.6z"></path>
        </svg>
        {isPinned ? "tracking" : "track"}
      </button>
      {pinFull && (
        <span role="status" style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
          You’re tracking {PULSE.PIN_MAX} already — untrack one to swap.
        </span>
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
      {pin}
      {open && (
        <div style={{ borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", paddingTop: 12 }}>
          <React.Suspense fallback={null}>
            <PulseTrendsLazy compact pid={id} mapLink />
          </React.Suspense>
        </div>
      )}
    </div>
  );
}
