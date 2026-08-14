// THE READING (D138): your pulse line held against your city, country or
// the world, three weeks at a time — the v24 design ported typed
// (design/standalone-v24/pulse-trends.jsx). House rules, visible in the
// drawing itself:
//   · no smoothing, no interpolation — a missing day breaks the line
//   · absent ≠ zero: a day with no answers has no mark, and the panel says so
//   · a day too thin to place is listed with its reason, never positioned
//   · every reading carries its n
//   · two instruments only: you (the hue) and them (neutral)
import React from "react";
import PULSE from "../data/pulse";

export default function PulseTrends({ compact }: { compact?: boolean }): React.ReactElement | null {
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    void PULSE.ensureLive().catch(() => { /* the panel lists the absence honestly */ });
    return PULSE.subscribe(() => bump((x) => x + 1));
  }, [bump]);
  const [scopeId, setScopeId] = React.useState("city");
  const [sel, setSel] = React.useState(PULSE.DAYS - 1);
  const [w, setW] = React.useState(342);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  // Measured once on mount: the chart's box is a fixed-width column, so
  // the one real variance is the device, not a resize mid-read.
  React.useEffect(() => { const el = boxRef.current; if (el && el.clientWidth) setW(el.clientWidth); }, []);

  const HUE = "var(--pulse)";
  const N = PULSE.DAYS;
  const steps = PULSE.STEPS;
  const days = PULSE.days();
  const sc = PULSE.scope(scopeId);
  const ser = sc.series;

  const answered = days.filter((d) => d.v != null);
  const comparable = days.filter((d) => d.v != null && ser[d.i].placed);
  let above = 0, below = 0, level = 0;
  comparable.forEach((d) => {
    const diff = (d.v as number) - (ser[d.i].mean as number);
    if (Math.abs(diff) < 0.05) level++; else if (diff > 0) above++; else below++;
  });

  // your gaps — runs of three or more days with nothing, drawn as voids,
  // never dips. With fewer than two answers there is no line yet, so
  // nothing can break: day one stays a clean frame, not one grey box.
  const gaps: { a: number; b: number }[] = [];
  if (answered.length >= 2) for (let i = 0; i < N; i++) {
    if (days[i].v != null) continue;
    let j = i; while (j + 1 < N && days[j + 1].v == null) j++;
    if (j - i + 1 >= 3) gaps.push({ a: i, b: j });
    i = j;
  }
  const skipped = days.filter((d) => d.v == null && !d.today).length;
  const zeroDays = ser.filter((s) => s.n === 0);
  const thinDays = ser.filter((s) => s.thin);
  const placedN = ser.filter((s) => s.placed);
  const totalN = placedN.reduce((a, s) => a + s.n, 0);
  const maxN = Math.max(1, ...ser.map((s) => s.n));

  // ── geometry ──
  const PADL = 4, PADR = 50, H = 176;
  const yTop = 12, yBot = 138, base = H - 2;
  const col = (w - PADL - PADR) / N;
  const x = (i: number) => PADL + col * (i + 0.5);
  const y = (v: number) => yBot - ((v - 1) / 4) * (yBot - yTop);
  const barW = Math.max(3, Math.min(col - 6, 5));

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left) / r.width * w - PADL) / col);
    if (i >= 0 && i < N && i !== sel) setSel(i);
  };

  const mySegs: number[][] = [], theirSegs: number[][] = [];
  for (let i = 0; i < N - 1; i++) {
    if (days[i].v != null && days[i + 1].v != null) mySegs.push([x(i), y(days[i].v as number), x(i + 1), y(days[i + 1].v as number)]);
    if (ser[i].placed && ser[i + 1].placed) theirSegs.push([x(i), y(ser[i].mean as number), x(i + 1), y(ser[i + 1].mean as number)]);
  }

  const d = days[sel], s = ser[sel];
  const grey = "var(--ink-3)";

  const scopeRow = (
    <div style={{ display: "flex", gap: 6 }}>
      {PULSE.SCOPES.map((id) => {
        const on = id === scopeId;
        const label = PULSE.scope(id).label;
        return (
          <button key={id} className="press" onClick={() => setScopeId(id)} aria-pressed={on}
            style={{ flex: 1, minWidth: 0, height: 34, borderRadius: 999, cursor: "pointer", WebkitAppearance: "none", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", border: "1px solid " + (on ? "var(--ink)" : "var(--rule)"), background: on ? "var(--ink)" : "var(--surface-2)", color: on ? "var(--surface)" : "var(--ink-2)" }}>
            {label}
          </button>
        );
      })}
    </div>
  );

  // ── the reading, or the honest reason there isn't one yet ──
  const headline = answered.length === 0 ? (
    <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 19, lineHeight: 1.2, letterSpacing: "-0.03em" }}>Your line starts when you answer today.</span>
  ) : comparable.length < 3 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 19, letterSpacing: "-0.03em" }}>
        {answered.length === 1 ? "One day in — not a trend yet." : answered.length + " days in — not a trend yet."}
      </span>
      <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
        Answer again tomorrow and the first segment gets drawn.
      </span>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 31, letterSpacing: "-0.045em", color: HUE }}>{above}</span>
        <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14.5, color: "var(--ink-2)" }}>above</span>
        <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 31, letterSpacing: "-0.045em", color: "var(--ink-2)", marginLeft: 4 }}>{below}</span>
        <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14.5, color: "var(--ink-2)" }}>below</span>
        {level > 0 && <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: "var(--ink-3)" }}>· {level} level</span>}
      </span>
      <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
        of {comparable.length} days you and {sc.label} both counted
      </span>
    </div>
  );

  // ── the day under the finger — the one place numbers are read ──
  const readout = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 20 }}>
      <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{d.today ? "Today" : d.label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: d.v != null ? HUE : "transparent", boxShadow: d.v != null ? "none" : "inset 0 0 0 1px color-mix(in oklab, " + HUE + " 50%, var(--surface-2))" }}></span>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: d.v != null ? "var(--ink)" : "var(--ink-3)" }}>{d.v != null ? PULSE.word(d.v) : "you skipped"}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          <span aria-hidden="true" style={{ width: 10, height: 2, borderRadius: 1, background: grey, opacity: 0.55 }}></span>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 12.5, color: "var(--ink-3)" }}>
            {s.n === 0 ? "no answers" : s.placed ? (s.mean as number).toFixed(1) + " · n " + PULSE.fmtN(s.n) : "n " + s.n + " · too few"}
          </span>
        </span>
      </span>
    </div>
  );

  const axisTop = steps[steps.length - 1].label.toUpperCase();
  const axisBot = steps[0].label.toUpperCase();
  const chart = (
    <div ref={boxRef} style={{ position: "relative" }}>
      <svg width="100%" height={H} viewBox={"0 0 " + w + " " + H} style={{ display: "block", touchAction: "pan-y" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pick(e.clientX, e.currentTarget); }}
        onPointerMove={(e) => { if (e.buttons) pick(e.clientX, e.currentTarget); }}>
        {gaps.map((g) => (
          <g key={"g" + g.a}>
            <rect x={x(g.a) - col / 2} y={yTop - 6} width={col * (g.b - g.a + 1)} height={yBot - yTop + 14} fill="var(--surface-3)"></rect>
            {col * (g.b - g.a + 1) > 74 && (
              <text x={x(g.a) + (col * (g.b - g.a + 1)) / 2 - col / 2} y={(yTop + yBot) / 2 + 4} textAnchor="middle"
                style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", fill: "var(--ink-3)" }}>
                {days[g.a].label.toUpperCase()} – {days[g.b].label.toUpperCase()}
              </text>
            )}
          </g>
        ))}
        {[1, 3, 5].map((v) => (
          <line key={v} x1={PADL} x2={w - PADR} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth="1" opacity={v === 3 ? 0.5 : 1}></line>
        ))}
        <line x1={x(sel)} x2={x(sel)} y1={yTop - 6} y2={base} stroke="var(--ink)" strokeWidth="1" opacity="0.2"></line>
        {theirSegs.map((p, i) => <line key={"t" + i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke={grey} strokeWidth="1.25" opacity="0.55" strokeLinecap="round"></line>)}
        {ser.map((sd) => sd.placed && <circle key={"td" + sd.i} cx={x(sd.i)} cy={y(sd.mean as number)} r="1.7" fill={grey} opacity="0.65"></circle>)}
        {mySegs.map((p, i) => <line key={"m" + i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke={HUE} strokeWidth="2" strokeLinecap="round"></line>)}
        {days.map((dd) => dd.v != null && (
          <circle key={"md" + dd.i} cx={x(dd.i)} cy={y(dd.v)} r={dd.i === sel ? 5 : answered.length === 1 ? 5.5 : 3.6} fill={HUE} stroke="var(--surface-2)" strokeWidth={dd.i === sel ? 2 : 1.2}></circle>
        ))}
        {/* the crowd's count per day: filled = placed, outlined = counted
            but too thin, empty slot = nobody answered */}
        {ser.map((sd) => {
          if (sd.n === 0) return null;
          const hgt = sd.placed ? 2 + 14 * Math.sqrt(sd.n / maxN) : 7;
          return <rect key={"n" + sd.i} x={x(sd.i) - barW / 2} y={base - hgt} width={barW} height={hgt} rx="1.5"
            fill={sd.placed ? grey : "none"} fillOpacity={sd.placed ? 0.34 : 0} stroke={sd.placed ? "none" : grey} strokeOpacity="0.45" strokeWidth="1"></rect>;
        })}
        <text x={w - 1} y={y(5) + 4} textAnchor="end" style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", fill: "var(--ink-3)" }}>{axisTop}</text>
        <text x={w - 1} y={y(1) + 4} textAnchor="end" style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", fill: "var(--ink-3)" }}>{axisBot}</text>
        <text x={w - 1} y={base + 1} textAnchor="end" style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", fill: "var(--ink-3)" }}>N</text>
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", paddingLeft: PADL, paddingRight: PADR, marginTop: 3 }}>
        {[0, 7, 14].map((i) => <span key={i} className="kicker" style={{ marginBottom: 0 }}>{days[i].label}</span>)}
      </div>
    </div>
  );

  const gapRows = gaps.filter((g) => col * (g.b - g.a + 1) <= 74).map((g) => days[g.a].label + " – " + days[g.b].label);
  const missing = [
    answered.length < 2 && {
      key: "you",
      mark: <span style={{ width: 8, height: 8, borderRadius: "50%", boxShadow: "inset 0 0 0 1px " + HUE }}></span>,
      text: answered.length === 1 ? "your side is 1 day of " + N + " — a line needs at least two" : "your side is empty — the pulse is one tap a day",
    },
    answered.length >= 2 && skipped > 0 && {
      key: "skip",
      mark: <span style={{ display: "flex", alignItems: "center", gap: 2.5 }}><span style={{ width: 5, height: 2, borderRadius: 1, background: HUE }}></span><span style={{ width: 5, height: 2, borderRadius: 1, background: HUE }}></span></span>,
      text: "you didn’t answer on " + skipped + (skipped === 1 ? " day" : " days") + " — the line breaks there" + (gapRows.length ? " (" + gapRows.join(", ") + ")" : ""),
    },
    zeroDays.length > 0 && {
      key: "zero",
      mark: <span style={{ width: 9, height: 9, borderBottom: "1px solid " + grey, opacity: 0.55 }}></span>,
      text: zeroDays.length + (zeroDays.length === 1 ? " day" : " days") + " with no answers in " + sc.label + " — nothing to compare, not a zero",
    },
    thinDays.length > 0 && {
      key: "thin",
      mark: <span style={{ width: 6, height: 9, border: "1px solid " + grey, borderRadius: 1.5, opacity: 0.6 }}></span>,
      text: thinDays.length + (thinDays.length === 1 ? " day" : " days") + " held back — under " + PULSE.THIN + " answers (" + thinDays.map((t) => days[t.i].label).join(", ") + ")",
    },
  ].filter(Boolean) as { key: string; mark: React.ReactElement; text: string }[];

  const panel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", paddingTop: 12 }}>
      <span className="kicker" style={{ marginBottom: 0 }}>what’s missing</span>
      {missing.map((m) => (
        <div key={m.key} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 10, marginTop: 5, display: "flex", justifyContent: "center" }}>{m.mark}</span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>{m.text}</span>
        </div>
      ))}
      {!missing.length && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>Nothing — every day in this window has both sides.</span>
      )}
      <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", paddingTop: 1 }}>
        {sc.label}: {PULSE.fmtN(totalN)} answers placed across {placedN.length} of {N} days · you: {answered.length}
      </span>
    </div>
  );

  return (
    <div data-screen-label="Pulse trends" style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 14, padding: compact ? 0 : "4px 0 8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!compact && (
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: HUE }}></span>
            <span className="kicker" style={{ marginBottom: 0 }}>{PULSE.Q.kicker} · 3 weeks</span>
          </span>
        )}
        <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em", color: "var(--ink-2)" }}>{PULSE.Q.text}</span>
        {headline}
      </div>
      {scopeRow}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {readout}
        {chart}
      </div>
      {panel}
    </div>
  );
}
