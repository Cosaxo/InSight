import type { CSSProperties } from "react";

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

interface CompareCompassProps {
  you: { x: number; y: number };
  them: { x: number; y: number };
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
  const s = size,
    pad = 22;
  const toXY = (p: { x: number; y: number }): [number, number] => [
    pad + ((p.x + 100) / 200) * (s - pad * 2),
    pad + ((100 - p.y) / 200) * (s - pad * 2),
  ];
  const [yx, yy] = toXY(you);
  const [tx, ty] = toXY(them);
  return (
    <svg viewBox={`0 0 ${s} ${s + 4}`} width="100%" style={{ display: "block" }}>
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
      <line
        x1={yx}
        y1={yy}
        x2={tx}
        y2={ty}
        stroke={accent}
        strokeWidth="0.7"
        strokeDasharray="3 2"
        opacity="0.6"
      />
      <circle cx={tx} cy={ty} r="6" fill="var(--ink-3)" fillOpacity="0.18" />
      <circle cx={tx} cy={ty} r="3" fill="var(--ink-3)" />
      <text
        x={tx + 6}
        y={ty - 4}
        style={{ font: "italic 10px Fraunces, serif", fill: "var(--ink-3)" }}
      >
        {themLabel}
      </text>
      <circle cx={yx} cy={yy} r="9" fill={accent} fillOpacity="0.18" />
      <circle cx={yx} cy={yy} r="4" fill={accent} />
      <text
        x={yx + 6}
        y={yy - 6}
        style={{ font: "italic 11px Fraunces, serif", fill: "var(--ink)" }}
      >
        you
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr 36px",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 12,
          color: "var(--ink-2)",
        }}
      >
        {label}
      </span>
      <div
        style={{
          position: "relative",
          height: 10,
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--ink-2)",
          }}
        />
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
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--ink-3)",
          letterSpacing: "0.06em",
          textAlign: "right",
        }}
      >
        {pos ? "+" : ""}
        {value}
      </span>
    </div>
  );
}

interface DivergeBarsRow {
  label: string;
  you: number;
  avg: number;
  max?: number;
}
export function DivergeBars({
  rows,
  color = "var(--accent)",
  altColor = "var(--ink-3)",
}: {
  rows: DivergeBarsRow[];
  color?: string;
  altColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => {
        const max = r.max || 100;
        const youPct = (r.you / max) * 100;
        const avgPct = (r.avg / max) * 100;
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

interface MBTIGridProps {
  dist: Record<string, number>;
  accent?: string;
  highlight?: string;
}
export function MBTIGrid({
  dist,
  accent = "var(--accent)",
  highlight,
}: MBTIGridProps) {
  const types = [
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
  ];
  const total = Object.values(dist).reduce((s, v) => s + v, 0);
  const max = Math.max(...types.map((t) => dist[t] || 0));
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
      }}
    >
      {types.map((t) => {
        const v = dist[t] || 0;
        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
        const intensity = max > 0 ? v / max : 0;
        const isYou = t === highlight;
        const tileStyle: CSSProperties = {
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
        };
        return (
          <div key={t} style={tileStyle}>
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

interface LayeredHistogramProps {
  a: number[];
  b: number[];
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
  const max = Math.max(...a, ...b);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {a.map((va, i) => {
        const vb = b[i];
        const ha = (va / max) * (height - 26);
        const hb = (vb / max) * (height - 26);
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
  const N = 60;
  const samples = Array.from({ length: N }, (_, i) => {
    const x = lo + (i / (N - 1)) * (hi - lo);
    const z = (x - mean) / stdev;
    return Math.exp(-0.5 * z * z);
  });
  const peak = Math.max(...samples);
  const xs = (i: number) => (i / (N - 1)) * w;
  const ys = (v: number) => h - 4 - (v / peak) * (h - 12);
  const d = samples
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(v)}`)
    .join(" ");
  const fillD = `${d} L ${w} ${h} L 0 ${h} Z`;
  const valX = ((value - lo) / (hi - lo)) * w;
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} width="100%" style={{ display: "block" }}>
      <path d={fillD} fill={color} fillOpacity="0.10" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" />
      <line
        x1={((mean - lo) / (hi - lo)) * w}
        y1={6}
        x2={((mean - lo) / (hi - lo)) * w}
        y2={h}
        stroke="var(--ink-3)"
        strokeWidth="0.6"
        strokeDasharray="2 2"
      />
      <text
        x={((mean - lo) / (hi - lo)) * w + 3}
        y={12}
        style={{
          font: "8px JetBrains Mono, monospace",
          letterSpacing: "0.1em",
          fill: "var(--ink-3)",
        }}
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
