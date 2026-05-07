import { C } from "../../theme";

// GitHub-style contributions calendar.
//
// Each square is one day. Color intensity is bucketed into 5 levels
// (0 = no data, 1..4 = ascending) using the four thresholds in `levels`.
// The rightmost column ends on the week containing today.

interface CalendarHeatmapProps {
  // ISO YYYY-MM-DD → numeric value for that day (anything missing or 0
  // is treated as "empty").
  values: Map<string, number>;
  // Four ascending thresholds. A value `v` lands in:
  //   level 0  (empty)  if v <= 0
  //   level 1           if v >= levels[0]
  //   level 2           if v >= levels[1]
  //   level 3           if v >= levels[2]
  //   level 4           if v >= levels[3]
  levels: [number, number, number, number];
  // Fully-saturated color; lower levels are rendered at reduced opacity.
  color: string;
  // How many weeks back to render. Default: ~6 months.
  weeks?: number;
  // Tooltip value formatter.
  formatValue?: (v: number) => string;
}

const LEVEL_OPACITY = [0, 0.18, 0.42, 0.7, 1];
const DAY_LABELS = ["M", "", "W", "", "F", "", ""];

// Monday-aligned day index: Mon=0 ... Sun=6.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarHeatmap({
  values,
  levels,
  color,
  weeks = 26,
  formatValue = (v) => String(v),
}: CalendarHeatmapProps) {
  const cellSize = 12;
  const cellGap = 2;
  const monthLabelH = 14;
  const dayLabelW = 14;
  const stride = cellSize + cellGap;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the Monday of the leftmost column so the rightmost column is the
  // week containing today.
  const startMon = new Date(today);
  startMon.setDate(today.getDate() - mondayIndex(today) - (weeks - 1) * 7);

  const cells: {
    date: string;
    col: number;
    row: number;
    level: number;
    raw: number;
  }[] = [];

  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(startMon);
    d.setDate(startMon.getDate() + i);
    if (d > today) continue;
    const iso = isoDate(d);
    const v = values.get(iso) ?? 0;
    let level = 0;
    if (v > 0) {
      if (v >= levels[3]) level = 4;
      else if (v >= levels[2]) level = 3;
      else if (v >= levels[1]) level = 2;
      else if (v >= levels[0]) level = 1;
    }
    cells.push({
      date: iso,
      col: Math.floor(i / 7),
      row: i % 7,
      level,
      raw: v,
    });
  }

  // First column where each month starts (skipping repeats).
  const monthLabels: { col: number; label: string }[] = [];
  let prevMonth = -1;
  for (let col = 0; col < weeks; col++) {
    const d = new Date(startMon);
    d.setDate(startMon.getDate() + col * 7);
    if (d.getMonth() !== prevMonth) {
      monthLabels.push({
        col,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
      });
      prevMonth = d.getMonth();
    }
  }

  const width = dayLabelW + weeks * stride - cellGap + 2;
  const gridH = monthLabelH + 7 * stride - cellGap + 2;
  const legendH = 16;
  const height = gridH + legendH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`Activity over the last ${weeks} weeks`}
      style={{ display: "block", overflow: "visible" }}
    >
      {monthLabels.map((m, i) => (
        <text
          key={i}
          x={dayLabelW + m.col * stride}
          y={10}
          fontSize="8"
          fill={C.muted}
          fontFamily="sans-serif"
        >
          {m.label}
        </text>
      ))}
      {DAY_LABELS.map((l, row) =>
        l ? (
          <text
            key={row}
            x={0}
            y={monthLabelH + row * stride + cellSize - 2}
            fontSize="8"
            fill={C.muted}
            fontFamily="sans-serif"
          >
            {l}
          </text>
        ) : null,
      )}
      {cells.map((c) => (
        <rect
          key={c.date}
          x={dayLabelW + c.col * stride}
          y={monthLabelH + c.row * stride}
          width={cellSize}
          height={cellSize}
          rx={2}
          ry={2}
          fill={c.level === 0 ? C.dim : color}
          fillOpacity={LEVEL_OPACITY[c.level]}
          stroke={c.date === isoDate(today) ? C.navy : "none"}
          strokeWidth={c.date === isoDate(today) ? 1 : 0}
        >
          <title>
            {new Date(c.date).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {c.raw > 0 ? ` — ${formatValue(c.raw)}` : " — no data"}
          </title>
        </rect>
      ))}
      {/* Legend */}
      <g transform={`translate(${width - 5 * stride - 24} ${gridH + 2})`}>
        <text x={-4} y={9} fontSize="8" fill={C.muted} fontFamily="sans-serif" textAnchor="end">
          less
        </text>
        {LEVEL_OPACITY.map((op, i) => (
          <rect
            key={i}
            x={i * stride}
            y={1}
            width={cellSize}
            height={cellSize}
            rx={2}
            ry={2}
            fill={i === 0 ? C.dim : color}
            fillOpacity={op}
          />
        ))}
        <text
          x={5 * stride + 2}
          y={9}
          fontSize="8"
          fill={C.muted}
          fontFamily="sans-serif"
        >
          more
        </text>
      </g>
    </svg>
  );
}
