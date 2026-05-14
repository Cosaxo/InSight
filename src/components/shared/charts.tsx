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
