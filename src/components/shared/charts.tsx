// ─── Hand-drawn radar / spider chart ───
interface RadarChartProps {
  values: number[];
  labels: string[];
  max?: number;
  size?: number;
  color?: string;
  compareValues?: number[];
  compareColor?: string;
}
export function RadarChart({
  values,
  labels,
  max = 100,
  size = 240,
  color = "var(--sienna)",
  compareValues,
  compareColor = "var(--ink)",
}: RadarChartProps) {
  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 28;
  const n = values.length;
  const pt = (i: number, v: number): [number, number] => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = (v / max) * r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  };
  const poly = (vs: number[]) =>
    vs.map((v, i) => pt(i, v).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((k, i) => (
        <polygon
          key={k}
          fill="none"
          stroke="var(--rule)"
          strokeWidth="0.5"
          opacity={i === 3 ? 0.9 : 0.5}
          points={Array.from({ length: n }, (_, j) =>
            pt(j, max * k).join(","),
          ).join(" ")}
        />
      ))}
      {Array.from({ length: n }).map((_, i) => {
        const [x, y] = pt(i, max);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--rule)"
            strokeWidth="0.4"
            strokeDasharray="1.2 1.6"
          />
        );
      })}
      {compareValues && (
        <polygon
          points={poly(compareValues)}
          fill={compareColor}
          fillOpacity="0.06"
          stroke={compareColor}
          strokeWidth="1"
          strokeDasharray="3 2"
        />
      )}
      <polygon
        points={poly(values)}
        fill={color}
        fillOpacity="0.14"
        stroke={color}
        strokeWidth="1.4"
      />
      {values.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r="2.4" fill={color} />;
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, max * 1.18);
        return (
          <text
            key={l}
            x={x}
            y={y + 3}
            textAnchor="middle"
            style={{
              font: "italic 10.5px Fraunces, serif",
              fill: "var(--ink-2)",
            }}
          >
            {l}
          </text>
        );
      })}
    </svg>
  );
}

interface SparklineProps {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
  dots?: boolean;
}
export function Sparkline({
  data,
  w = 120,
  h = 32,
  color = "var(--ink)",
  fill = false,
  dots = false,
}: SparklineProps) {
  if (!data?.length) return null;
  const min = Math.min(...data),
    max = Math.max(...data);
  const span = Math.max(max - min, 0.0001);
  const xs = (i: number) => (i / (data.length - 1)) * (w - 4) + 2;
  const ys = (v: number) => h - 2 - ((v - min) / span) * (h - 6);
  const d = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(v)}`)
    .join(" ");
  const fillD = `${d} L ${xs(data.length - 1)} ${h} L ${xs(0)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block" }}>
      {fill && <path d={fillD} fill={color} fillOpacity="0.10" />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dots &&
        data.map((v, i) => (
          <circle key={i} cx={xs(i)} cy={ys(v)} r="1.3" fill={color} />
        ))}
    </svg>
  );
}

interface ComparePoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}
interface Compass2DProps {
  x: number;
  y: number;
  label?: string;
  xLabel?: [string, string];
  yLabel?: [string, string];
  comparePoints?: ComparePoint[];
  size?: number;
  accent?: string;
}
export function Compass2D({
  x,
  y,
  label = "you",
  xLabel = ["Tradition", "Change"],
  yLabel = ["Individual", "Collective"],
  comparePoints = [],
  size = 220,
  accent = "var(--sienna)",
}: Compass2DProps) {
  const s = size,
    pad = 22;
  const px = pad + ((x + 100) / 200) * (s - pad * 2);
  const py = pad + ((100 - y) / 200) * (s - pad * 2);
  return (
    <svg
      viewBox={`0 0 ${s} ${s}`}
      width="100%"
      style={{ display: "block", maxWidth: s }}
    >
      <rect
        x={pad}
        y={pad}
        width={(s - 2 * pad) / 2}
        height={(s - 2 * pad) / 2}
        fill="var(--sienna)"
        opacity="0.04"
      />
      <rect
        x={s / 2}
        y={s / 2}
        width={(s - 2 * pad) / 2}
        height={(s - 2 * pad) / 2}
        fill="var(--sage)"
        opacity="0.06"
      />
      <rect
        x={pad}
        y={pad}
        width={s - 2 * pad}
        height={s - 2 * pad}
        fill="none"
        stroke="var(--rule)"
        strokeWidth="0.5"
      />
      <line
        x1={s / 2}
        y1={pad}
        x2={s / 2}
        y2={s - pad}
        stroke="var(--rule)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      <line
        x1={pad}
        y1={s / 2}
        x2={s - pad}
        y2={s / 2}
        stroke="var(--rule)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      {comparePoints.map((p, i) => {
        const cx = pad + ((p.x + 100) / 200) * (s - pad * 2);
        const cy = pad + ((100 - p.y) / 200) * (s - pad * 2);
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r="3.2"
              fill={p.color || "var(--ink-3)"}
              opacity="0.7"
            />
            {p.label && (
              <text
                x={cx + 5}
                y={cy + 3}
                style={{
                  font: "italic 9px Fraunces, serif",
                  fill: "var(--ink-3)",
                }}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
      <circle cx={px} cy={py} r="9" fill={accent} fillOpacity="0.18" />
      <circle cx={px} cy={py} r="4" fill={accent} />
      <text
        x={px + 8}
        y={py - 6}
        style={{ font: "italic 11px Fraunces, serif", fill: "var(--ink)" }}
      >
        {label}
      </text>
      <text
        x={pad - 2}
        y={s / 2 - 4}
        style={{
          font: "9px JetBrains Mono, monospace",
          letterSpacing: "0.1em",
          fill: "var(--ink-3)",
        }}
      >
        {xLabel[0]}
      </text>
      <text
        x={s - pad + 2}
        y={s / 2 - 4}
        textAnchor="end"
        style={{
          font: "9px JetBrains Mono, monospace",
          letterSpacing: "0.1em",
          fill: "var(--ink-3)",
        }}
      >
        {xLabel[1]}
      </text>
      <text
        x={s / 2 + 4}
        y={pad + 8}
        style={{
          font: "9px JetBrains Mono, monospace",
          letterSpacing: "0.1em",
          fill: "var(--ink-3)",
        }}
      >
        {yLabel[0]}
      </text>
      <text
        x={s / 2 + 4}
        y={s - pad - 2}
        style={{
          font: "9px JetBrains Mono, monospace",
          letterSpacing: "0.1em",
          fill: "var(--ink-3)",
        }}
      >
        {yLabel[1]}
      </text>
    </svg>
  );
}
interface DonutProps {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
}
export function Donut({
  value,
  max = 100,
  size = 80,
  color = "var(--sienna)",
  label,
}: DonutProps) {
  const C = 2 * Math.PI * 28;
  const dash = (value / max) * C;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size}>
      <circle cx="40" cy="40" r="28" fill="none" stroke="var(--rule)" strokeWidth="6" />
      <circle
        cx="40"
        cy="40"
        r="28"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        transform="rotate(-90 40 40)"
      />
      <text
        x="40"
        y="42"
        textAnchor="middle"
        style={{ font: "500 16px Fraunces, serif", fill: "var(--ink)" }}
      >
        {value}
      </text>
      {label && (
        <text
          x="40"
          y="55"
          textAnchor="middle"
          style={{
            font: "8px JetBrains Mono, monospace",
            letterSpacing: "0.12em",
            fill: "var(--ink-3)",
          }}
        >
          {label}
        </text>
      )}
    </svg>
  );
}

interface HBarItem {
  label: string;
  value: number;
  color?: string;
}
export function HBars({
  items,
  max = 100,
  color = "var(--ink)",
}: {
  items: HBarItem[];
  max?: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              color: "var(--ink-3)",
              letterSpacing: "0.06em",
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
                color: "var(--ink-2)",
                letterSpacing: 0,
                textTransform: "none",
              }}
            >
              {it.label}
            </span>
            <span>{it.value}</span>
          </div>
          <div className="bar">
            <i
              style={{
                width: `${(it.value / max) * 100}%`,
                background: it.color || color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
interface DotGridProps {
  rows?: number;
  cols?: number;
  intensities?: number[];
  color?: string;
}
export function DotGrid({
  rows = 7,
  cols = 26,
  intensities,
  color = "var(--sienna)",
}: DotGridProps) {
  return (
    <svg
      viewBox={`0 0 ${cols * 8} ${rows * 8}`}
      width="100%"
      style={{ display: "block" }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => {
        const r = Math.floor(i / cols),
          c = i % cols;
        const v = intensities ? intensities[i] || 0 : 0;
        return (
          <rect
            key={i}
            x={c * 8 + 0.5}
            y={r * 8 + 0.5}
            width="6"
            height="6"
            rx="1"
            fill={v > 0.05 ? color : "var(--rule)"}
            fillOpacity={v > 0.05 ? 0.15 + v * 0.85 : 0.4}
          />
        );
      })}
    </svg>
  );
}

interface HistogramProps {
  counts: number[];
  labels: string[];
  color?: string;
  max?: number;
}
export function Histogram({
  counts,
  labels,
  color = "var(--accent)",
  max,
}: HistogramProps) {
  const M = max || Math.max(...counts);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
      {counts.map((c, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            height: "100%",
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              marginBottom: 2,
            }}
          >
            {c}
          </div>
          <div
            style={{
              height: `${(c / M) * 70}px`,
              background: color,
              opacity: 0.25 + (i / counts.length) * 0.6,
              borderRadius: "2px 2px 0 0",
            }}
          />
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 11,
              color: "var(--ink-2)",
              marginTop: 4,
            }}
          >
            {labels[i]}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DotDensity — a unit-chart strip. Fills the first
// round(value/max * dots) ticks; the rest stay muted. Filled ticks
// fade slightly left-to-right so the strip reads hand-inked. ───
interface DotDensityProps {
  value: number;
  max?: number;
  color?: string;
  dots?: number;
}
export function DotDensity({
  value,
  max = 100,
  color = "var(--ink)",
  dots = 30,
}: DotDensityProps) {
  const filled = Math.round((value / max) * dots);
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 8,
            borderRadius: 1,
            background: i < filled ? color : "var(--rule)",
            opacity: i < filled ? 1 - i * 0.012 : 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ─── LayeredHistogram — two distributions on the same axis: A
// filled (front), B dashed outline (back). B is optional, so it
// degrades to a single-series histogram when no comparison series
// exists yet (e.g. no scope-level mood aggregate). ───
interface LayeredHistogramProps {
  a: number[];
  b?: number[] | null;
  labels: string[];
  colorA?: string;
  colorB?: string;
  height?: number;
}
export function LayeredHistogram({
  a,
  b,
  labels,
  colorA = "var(--accent)",
  colorB = "var(--ink-3)",
  height = 110,
}: LayeredHistogramProps) {
  const max = Math.max(...a, ...(b ?? [0]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {a.map((va, i) => {
        const ha = max > 0 ? (va / max) * (height - 26) : 0;
        const hb = b && max > 0 ? (b[i] / max) * (height - 26) : 0;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                position: "relative",
                height: height - 22,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              {b && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: "15%",
                    right: "15%",
                    height: hb,
                    border: `1px dashed ${colorB}`,
                    borderBottom: "none",
                    opacity: 0.7,
                  }}
                />
              )}
              <div
                style={{
                  width: "60%",
                  height: ha,
                  background: colorA,
                  opacity: 0.55 + (i / a.length) * 0.4,
                  borderRadius: "2px 2px 0 0",
                }}
              />
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 11,
                color: "var(--ink-2)",
                marginTop: 6,
              }}
            >
              {labels[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DivergeBars — "you vs avg" rows. Each row shows the scope
// average as a faint track + tick, and your value as a bold tick. ───
interface DivergeRow {
  label: string;
  you: number;
  avg: number;
  max?: number;
}
interface DivergeBarsProps {
  rows: DivergeRow[];
  color?: string;
  altColor?: string;
}
export function DivergeBars({
  rows,
  color = "var(--accent)",
  altColor = "var(--ink-3)",
}: DivergeBarsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => {
        const max = r.max || 100;
        const youPct = Math.max(0, Math.min(100, (r.you / max) * 100));
        const avgPct = Math.max(0, Math.min(100, (r.avg / max) * 100));
        return (
          <div key={r.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 13,
                }}
              >
                {r.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9.5,
                  color: "var(--ink-3)",
                  letterSpacing: "0.06em",
                }}
              >
                you {Math.round(r.you)} · avg {Math.round(r.avg)}
              </span>
            </div>
            <div
              style={{
                position: "relative",
                height: 14,
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${avgPct}%`,
                  background: altColor,
                  opacity: 0.18,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${avgPct}%`,
                  top: -2,
                  bottom: -2,
                  width: 1.5,
                  background: altColor,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${avgPct}%`,
                  top: -8,
                  fontFamily: "var(--mono)",
                  fontSize: 7,
                  color: altColor,
                  letterSpacing: "0.1em",
                  transform: "translateX(-50%)",
                }}
              >
                AVG
              </div>
              <div
                style={{
                  position: "absolute",
                  left: `${youPct}%`,
                  top: -3,
                  bottom: -3,
                  width: 2.5,
                  background: color,
                  borderRadius: 1,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${youPct}%`,
                  bottom: -10,
                  fontFamily: "var(--mono)",
                  fontSize: 7,
                  color: color,
                  letterSpacing: "0.1em",
                  transform: "translateX(-50%)",
                  fontWeight: 600,
                }}
              >
                YOU
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ridgeline — stacked smooth filled curves (e.g. mood over weeks) ───
interface RidgelineProps {
  rows: number[][]; // each row: values 0..1
  w?: number;
  h?: number;
  color?: string;
}
export function Ridgeline({
  rows,
  w = 320,
  h = 120,
  color = "var(--sienna)",
}: RidgelineProps) {
  const rowH = h / Math.max(1, rows.length);
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} width="100%" style={{ display: "block" }}>
      {rows.map((vals, ri) => {
        const baseY = (ri + 1) * rowH;
        const pts = vals.map(
          (v, i) =>
            [(i / Math.max(1, vals.length - 1)) * w, baseY - v * (rowH * 1.6)] as [
              number,
              number,
            ],
        );
        const d =
          pts.reduce(
            (acc, [x, y], i) =>
              acc + (i === 0 ? `M ${x} ${baseY} L ${x} ${y}` : ` L ${x} ${y}`),
            "",
          ) + ` L ${w} ${baseY} Z`;
        return (
          <g key={ri}>
            <path d={d} fill="var(--paper-2)" stroke="none" />
            <path
              d={d}
              fill={color}
              fillOpacity={0.12 + ri * 0.04}
              stroke={color}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── NetworkGraph — nodes + edges, "you" anchored at centre ───
export interface NetworkNode {
  id: string;
  label: string;
  hue?: number;
  weight?: number; // 0..1 — closer to 1 sits nearer the centre
}
interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: [string, string][];
  size?: number;
  accent?: string;
}
export function NetworkGraph({
  nodes,
  edges,
  size = 320,
  accent = "var(--accent)",
}: NetworkGraphProps) {
  const cx = size / 2;
  const cy = size / 2;
  const others = nodes.filter((n) => n.id !== "you");
  const placed: Record<string, [number, number]> = { you: [cx, cy] };
  others.forEach((n, i) => {
    const a = (i / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
    const r = 60 + (1 - (n.weight ?? 0.5)) * 70;
    placed[n.id] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block" }}>
      {edges.map(([a, b], i) => {
        if (!placed[a] || !placed[b]) return null;
        return (
          <line
            key={i}
            x1={placed[a][0]}
            y1={placed[a][1]}
            x2={placed[b][0]}
            y2={placed[b][1]}
            stroke="var(--rule)"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.7"
          />
        );
      })}
      {nodes.map((n) => {
        const pos = placed[n.id];
        if (!pos) return null;
        const [x, y] = pos;
        const isYou = n.id === "you";
        const r = isYou ? 14 : 9;
        const fill = isYou ? accent : `oklch(0.55 0.12 ${n.hue ?? 38})`;
        return (
          <g key={n.id}>
            <circle cx={x} cy={y} r={r + 4} fill={fill} fillOpacity="0.14" />
            <circle cx={x} cy={y} r={r} fill={fill} />
            <text
              x={x}
              y={y + 3}
              textAnchor="middle"
              style={{
                font: `italic ${isYou ? 11 : 9}px Fraunces, serif`,
                fill: "var(--paper)",
              }}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── MBTIGrid — 4×4 type grid, cells tinted + sized by share ───
interface MBTIGridProps {
  dist: Record<string, number>;
  accent?: string;
  highlight?: string;
}
export function MBTIGrid({ dist, accent = "var(--accent)", highlight }: MBTIGridProps) {
  const types = [
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
  ];
  const total = Object.values(dist).reduce((s, v) => s + v, 0);
  const max = Math.max(0, ...types.map((t) => dist[t] || 0));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
      {types.map((t) => {
        const v = dist[t] || 0;
        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
        const intensity = max > 0 ? v / max : 0;
        const isYou = t === highlight;
        return (
          <div
            key={t}
            style={{
              position: "relative",
              aspectRatio: "1",
              background: isYou ? accent : "var(--paper-2)",
              border: isYou ? `1.5px solid ${accent}` : "0.5px solid var(--rule)",
              borderRadius: 4,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 6,
            }}
          >
            {!isYou && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: accent,
                  opacity: 0.05 + intensity * 0.45,
                }}
              />
            )}
            <div
              style={{
                position: "relative",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                color: isYou ? "var(--paper)" : "var(--ink)",
                fontWeight: 600,
              }}
            >
              {t}
            </div>
            <div
              style={{
                position: "relative",
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 13,
                color: isYou ? "var(--paper)" : "var(--ink-2)",
              }}
            >
              {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── BellCurve — normal curve with your value marked vs the mean ───
interface BellCurveProps {
  value: number;
  mean?: number;
  stdev?: number;
  range?: [number, number];
  color?: string;
  w?: number;
  h?: number;
  label?: string;
}
export function BellCurve({
  value,
  mean = 0,
  stdev = 30,
  range = [-100, 100],
  color = "var(--accent)",
  w = 280,
  h = 80,
  label,
}: BellCurveProps) {
  const [lo, hi] = range;
  const sd = stdev || 1;
  const N = 60;
  const samples = Array.from({ length: N }, (_, i) => {
    const x = lo + (i / (N - 1)) * (hi - lo);
    const z = (x - mean) / sd;
    return Math.exp(-0.5 * z * z);
  });
  const peak = Math.max(...samples) || 1;
  const xs = (i: number) => (i / (N - 1)) * w;
  const ys = (v: number) => h - 4 - (v / peak) * (h - 12);
  const d = samples.map((v, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(v)}`).join(" ");
  const fillD = `${d} L ${w} ${h} L 0 ${h} Z`;
  const valX = ((value - lo) / (hi - lo)) * w;
  const meanX = ((mean - lo) / (hi - lo)) * w;
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} width="100%" style={{ display: "block" }}>
      <path d={fillD} fill={color} fillOpacity="0.10" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" />
      <line x1={meanX} y1={6} x2={meanX} y2={h} stroke="var(--ink-3)" strokeWidth="0.6" strokeDasharray="2 2" />
      <text
        x={meanX + 3}
        y={12}
        style={{ font: "8px JetBrains Mono, monospace", letterSpacing: "0.1em", fill: "var(--ink-3)" }}
      >
        AVG
      </text>
      <line x1={valX} y1={2} x2={valX} y2={h} stroke={color} strokeWidth="2" />
      <circle cx={valX} cy={2} r="3" fill={color} />
      <text
        x={valX}
        y={h + 12}
        textAnchor="middle"
        style={{ font: "italic 10px Fraunces, serif", fill: color }}
      >
        {label || "you"}
      </text>
    </svg>
  );
}

// ─── CompareCompass — two points on a 2-axis grid (you vs a group) ───
interface CompassPoint {
  x: number; // -100..100
  y: number; // -100..100
}
interface CompareCompassProps {
  you: CompassPoint;
  them: CompassPoint;
  themLabel?: string;
  size?: number;
  accent?: string;
  xLabel?: [string, string];
  yLabel?: [string, string];
}
export function CompareCompass({
  you,
  them,
  themLabel = "avg",
  size = 240,
  accent = "var(--accent)",
  xLabel = ["Left", "Right"],
  yLabel = ["Liberty", "Authority"],
}: CompareCompassProps) {
  const s = size;
  const pad = 22;
  const toXY = (p: CompassPoint): [number, number] => [
    pad + ((p.x + 100) / 200) * (s - pad * 2),
    pad + ((100 - p.y) / 200) * (s - pad * 2),
  ];
  const [yx, yy] = toXY(you);
  const [tx, ty] = toXY(them);
  return (
    <svg viewBox={`0 0 ${s} ${s + 4}`} width="100%" style={{ display: "block" }}>
      <rect x={pad} y={pad} width={s - 2 * pad} height={s - 2 * pad} fill="none" stroke="var(--rule)" strokeWidth="0.5" />
      <line x1={s / 2} y1={pad} x2={s / 2} y2={s - pad} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={pad} y1={s / 2} x2={s - pad} y2={s / 2} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={yx} y1={yy} x2={tx} y2={ty} stroke={accent} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.6" />
      <circle cx={tx} cy={ty} r="6" fill="var(--ink-3)" fillOpacity="0.18" />
      <circle cx={tx} cy={ty} r="3" fill="var(--ink-3)" />
      <text x={tx + 6} y={ty - 4} style={{ font: "italic 10px Fraunces, serif", fill: "var(--ink-3)" }}>{themLabel}</text>
      <circle cx={yx} cy={yy} r="9" fill={accent} fillOpacity="0.18" />
      <circle cx={yx} cy={yy} r="4" fill={accent} />
      <text x={yx + 6} y={yy - 6} style={{ font: "italic 11px Fraunces, serif", fill: "var(--ink)" }}>you</text>
      <text x={pad - 2} y={s / 2 - 4} style={{ font: "9px JetBrains Mono, monospace", letterSpacing: "0.1em", fill: "var(--ink-3)" }}>{xLabel[0]}</text>
      <text x={s - pad + 2} y={s / 2 - 4} textAnchor="end" style={{ font: "9px JetBrains Mono, monospace", letterSpacing: "0.1em", fill: "var(--ink-3)" }}>{xLabel[1]}</text>
      <text x={s / 2 + 4} y={pad + 8} style={{ font: "9px JetBrains Mono, monospace", letterSpacing: "0.1em", fill: "var(--ink-3)" }}>{yLabel[0]}</text>
      <text x={s / 2 + 4} y={s - pad - 2} style={{ font: "9px JetBrains Mono, monospace", letterSpacing: "0.1em", fill: "var(--ink-3)" }}>{yLabel[1]}</text>
    </svg>
  );
}

// ─── StackedBars — stacked segment bars (e.g. macros across the week) ───
interface StackedSegment {
  key: string;
  color: string;
  label?: string;
}
interface StackedRow {
  label: string;
  vals: Record<string, number>;
}
interface StackedBarsProps {
  rows: StackedRow[];
  segments: StackedSegment[];
  w?: number;
  h?: number;
  gap?: number;
  max?: number;
}
export function StackedBars({
  rows,
  segments,
  w = 320,
  h = 140,
  gap = 4,
  max,
}: StackedBarsProps) {
  const totals = rows.map((r) =>
    segments.reduce((s, seg) => s + (r.vals[seg.key] || 0), 0),
  );
  const M = max || Math.max(1, ...totals);
  const colW = (w - gap * Math.max(1, rows.length - 1)) / Math.max(1, rows.length);
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} width="100%" style={{ display: "block" }}>
      {rows.map((r, i) => {
        let y = h - 14;
        const x = i * (colW + gap);
        const tot = totals[i];
        return (
          <g key={i}>
            {segments.map((seg, j) => {
              const v = r.vals[seg.key] || 0;
              const sh = (v / M) * (h - 22);
              y -= sh;
              return (
                <rect
                  key={j}
                  x={x}
                  y={y}
                  width={colW}
                  height={sh}
                  fill={seg.color}
                  fillOpacity={0.55 + j * 0.12}
                />
              );
            })}
            <text
              x={x + colW / 2}
              y={h - 14 - (tot / M) * (h - 22) - 3}
              textAnchor="middle"
              style={{ font: "8px JetBrains Mono, monospace", fill: "var(--ink-3)", letterSpacing: "0.06em" }}
            >
              {tot}
            </text>
            <text
              x={x + colW / 2}
              y={h + 6}
              textAnchor="middle"
              style={{ font: "italic 10.5px Fraunces, serif", fill: "var(--ink-2)" }}
            >
              {r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── ClockDial — 24-hour dial with markers + water spokes ───
export interface ClockMarker {
  hour: number; // 0..24
  kcal: number;
  label?: string;
  hue?: number;
}
export interface WaterTick {
  h: number; // hour 0..24
  ml: number;
}
interface ClockDialProps {
  markers?: ClockMarker[];
  waterByHour?: WaterTick[];
  size?: number;
  accent?: string;
}
export function ClockDial({
  markers = [],
  waterByHour = [],
  size = 220,
  accent = "var(--sienna)",
}: ClockDialProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const hourPt = (hh: number, rad = r): [number, number] => {
    const a = (hh / 24) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  };
  const [sx, sy] = hourPt(6, r - 2);
  const [ex, ey] = hourPt(22, r - 2);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--rule)" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r={r * 0.66} fill="none" stroke="var(--rule)" strokeWidth="0.4" strokeDasharray="2 3" />
      {Array.from({ length: 24 }).map((_, i) => {
        const [x1, y1] = hourPt(i, r - 4);
        const [x2, y2] = hourPt(i, r);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--rule)" strokeWidth={i % 6 === 0 ? 1 : 0.5} />;
      })}
      {[0, 6, 12, 18].map((hh) => {
        const [x, y] = hourPt(hh, r + 10);
        return (
          <text key={hh} x={x} y={y + 3} textAnchor="middle" style={{ font: "8px JetBrains Mono, monospace", fill: "var(--ink-3)", letterSpacing: "0.08em" }}>
            {hh === 0 ? "24" : String(hh).padStart(2, "0")}
          </text>
        );
      })}
      <path d={`M ${sx} ${sy} A ${r - 2} ${r - 2} 0 1 1 ${ex} ${ey}`} fill="none" stroke="var(--ochre)" strokeWidth="1.2" strokeOpacity="0.32" />
      {waterByHour.map((wt, i) => {
        if (!wt.ml) return null;
        const len = Math.min(wt.ml / 250, 1) * (r * 0.32);
        const [x1, y1] = hourPt(wt.h, r * 0.66);
        const [x2, y2] = hourPt(wt.h, r * 0.66 - len);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--indigo)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />;
      })}
      {markers.map((m, i) => {
        const [x, y] = hourPt(m.hour, r * 0.85);
        const dotR = 6 + Math.min(m.kcal / 200, 8);
        const fill = m.hue != null ? `oklch(0.62 0.13 ${m.hue})` : accent;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={dotR + 3} fill={fill} fillOpacity="0.16" />
            <circle cx={x} cy={y} r={dotR} fill={fill} />
            <text x={x} y={y + 3} textAnchor="middle" style={{ font: "8px JetBrains Mono, monospace", fill: "var(--paper)", letterSpacing: "0.05em" }}>{m.kcal}</text>
          </g>
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ font: "italic 11px Fraunces, serif", fill: "var(--ink-2)" }}>today</text>
      <text x={cx} y={cy + 8} textAnchor="middle" style={{ font: "8px JetBrains Mono, monospace", fill: "var(--ink-3)", letterSpacing: "0.1em" }}>24-HOUR</text>
    </svg>
  );
}

// ─── MicroBars — tiny inline bar rows with a target tick at 100% ───
export interface MicroBarItem {
  k: string;
  pct: number;
  hue: number;
  over?: boolean;
}
export function MicroBars({ items }: { items: MicroBarItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => {
        const overPct = (Math.min(it.pct, 200) / 200) * 100;
        const targetPct = 50;
        const color = `oklch(0.60 0.13 ${it.hue})`;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "78px 1fr 38px", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 11.5, color: "var(--ink-2)" }}>{it.k}</span>
            <div style={{ position: "relative", height: 10, background: "var(--paper-2)", border: "0.5px solid var(--rule)", borderRadius: 2 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${overPct}%`, background: color, opacity: 0.55, borderRadius: 2 }} />
              <div style={{ position: "absolute", left: `${targetPct}%`, top: -2, bottom: -2, width: 1.2, background: "var(--ink-2)" }} />
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: it.pct < 70 ? "oklch(0.55 0.16 12)" : "var(--ink-3)", letterSpacing: "0.06em", textAlign: "right" }}>
              {it.pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── DowStripes — day-of-week heatmap (7 cells per row) ───
interface DowRow {
  label: string;
  vals: number[]; // length 7, % 0..100
}
export function DowStripes({ rows, color = "var(--sienna)" }: { rows: DowRow[]; color?: string }) {
  const dows = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "110px repeat(7, 1fr)", gap: 4, fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.1em", alignItems: "center" }}>
        <span></span>
        {dows.map((d, i) => <span key={i} style={{ textAlign: "center" }}>{d}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "110px repeat(7, 1fr)", gap: 4, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 12, color: "var(--ink-2)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{r.label}</span>
          {r.vals.map((v, j) => (
            <div key={j} style={{ height: 22, borderRadius: 2, background: color, opacity: 0.1 + (v / 100) * 0.75, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 8, color: v > 60 ? "var(--paper)" : "var(--ink-3)", letterSpacing: "0.05em" }}>{v}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Scatter — generic scatter plot with a zero baseline ───
export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
}
interface ScatterProps {
  points: ScatterPoint[];
  xLabel?: [string, string];
  yLabel?: [string, string];
  w?: number;
  h?: number;
  accent?: string;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}
export function Scatter({
  points,
  xLabel = ["low", "high"],
  yLabel = ["below", "above"],
  w = 320,
  h = 160,
  accent = "var(--accent)",
  xMax = 100,
  yMin = -10,
  yMax = 10,
}: ScatterProps) {
  const pad = 22;
  const xs = (v: number) => pad + (v / xMax) * (w - pad * 2);
  const ys = (v: number) => h - pad - ((v - yMin) / (yMax - yMin)) * (h - pad * 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      <rect x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} fill="none" stroke="var(--rule)" strokeWidth="0.5" />
      <line x1={pad} y1={ys(0)} x2={w - pad} y2={ys(0)} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="2 2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xs(p.x)} cy={ys(p.y)} r="4.5" fill={accent} fillOpacity="0.7" />
          {p.label && (
            <text x={xs(p.x) + 6} y={ys(p.y) + 3} style={{ font: "italic 9px Fraunces, serif", fill: "var(--ink-3)" }}>{p.label}</text>
          )}
        </g>
      ))}
      <text x={pad} y={h - 4} style={{ font: "8px JetBrains Mono, monospace", fill: "var(--ink-3)", letterSpacing: "0.1em" }}>{xLabel[0]}</text>
      <text x={w - pad} y={h - 4} textAnchor="end" style={{ font: "8px JetBrains Mono, monospace", fill: "var(--ink-3)", letterSpacing: "0.1em" }}>{xLabel[1]}</text>
      <text x={pad - 4} y={pad - 4} style={{ font: "8px JetBrains Mono, monospace", fill: "var(--ink-3)", letterSpacing: "0.1em" }}>{yLabel[1]}</text>
      <text x={pad - 4} y={h - pad + 10} style={{ font: "8px JetBrains Mono, monospace", fill: "var(--ink-3)", letterSpacing: "0.1em" }}>{yLabel[0]}</text>
    </svg>
  );
}

// ─── DivergeRow — a single diverging bar around a centre baseline ───
interface DivergeRowProps {
  value: number;
  max?: number;
  color?: string;
  negColor?: string;
  label: string;
}
export function DivergeRow({
  value,
  max = 100,
  color = "var(--sage)",
  negColor = "var(--sienna)",
  label,
}: DivergeRowProps) {
  const v = Math.max(-max, Math.min(max, value));
  const pos = v >= 0;
  const pct = (Math.abs(v) / max) * 50;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 36px", gap: 8, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 12, color: "var(--ink-2)" }}>{label}</span>
      <div style={{ position: "relative", height: 10, background: "var(--paper-2)", border: "0.5px solid var(--rule)", borderRadius: 2 }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--ink-2)" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: pos ? "50%" : `${50 - pct}%`,
            width: `${pct}%`,
            background: pos ? color : negColor,
            opacity: 0.6,
            borderRadius: 1,
          }}
        />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em", textAlign: "right" }}>{pos ? "+" : ""}{value}</span>
    </div>
  );
}
