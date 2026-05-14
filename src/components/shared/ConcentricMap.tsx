import { memo, useMemo } from "react";

export interface ConcentricPerson {
  id: string;
  name: string;
  init: string;
  hue: number;
  match: number;
  category?: string;
  favorite?: boolean;
}

interface ConcentricMapProps {
  people: ConcentricPerson[];
  onPerson: (p: ConcentricPerson) => void;
}

interface PlacedPerson extends ConcentricPerson {
  ringIdx: number;
  x: number;
  y: number;
}

export const ConcentricMap = memo(function ConcentricMap({
  people,
  onPerson,
}: ConcentricMapProps) {
  const W = 360,
    H = 380;
  const cx = W / 2,
    cy = H / 2;
  const rings = [
    { r: 56, label: "inner", min: 80 },
    { r: 110, label: "close", min: 65 },
    { r: 165, label: "around", min: 0 },
  ];

  const placed: PlacedPerson[] = useMemo(() => {
    return people.map((p, i) => {
      let ringIdx = 2;
      if (p.match >= 80) ringIdx = 0;
      else if (p.match >= 65) ringIdx = 1;
      const ring = rings[ringIdx];
      const hash = p.id
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0);
      const angle = ((hash * 47 + i * 31) % 360) * (Math.PI / 180);
      const x = cx + Math.cos(angle) * ring.r;
      const y = cy + Math.sin(angle) * ring.r;
      return { ...p, ringIdx, x, y };
    });
    // `rings`, `cx`, `cy` are all locals derived from W/H which never
    // change after mount — re-memoising on them would be wasted work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  const edges = useMemo(() => {
    const out: [PlacedPerson, PlacedPerson][] = [];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (
          placed[i].category &&
          placed[i].category === placed[j].category
        ) {
          out.push([placed[i], placed[j]]);
        }
      }
    }
    return out;
  }, [placed]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        background: "var(--paper-2)",
        padding: "8px 0 16px",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, display: "block" }}
      >
        <defs>
          <radialGradient id="cmap-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.97 0.02 80)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="oklch(0.93 0.02 80)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#cmap-vignette)" />

        {rings.map((ring, i) => (
          <g key={ring.label}>
            <circle
              cx={cx}
              cy={cy}
              r={ring.r}
              fill="none"
              stroke="var(--rule)"
              strokeWidth="0.5"
              strokeDasharray={i === 0 ? "none" : "2 4"}
            />
            <text
              x={cx}
              y={cy - ring.r - 6}
              textAnchor="middle"
              fontFamily="var(--mono)"
              fontSize="8.5"
              letterSpacing="0.12em"
              fill="var(--ink-3)"
            >
              · {ring.label.toUpperCase()} ·
            </text>
          </g>
        ))}

        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={`oklch(0.65 0.08 ${a.hue})`}
            strokeWidth="0.6"
            strokeDasharray="1.5 3"
            opacity="0.55"
          />
        ))}

        <g>
          <circle cx={cx} cy={cy} r="22" fill="var(--ink)" />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontFamily="var(--serif)"
            fontSize="13"
            fontStyle="italic"
            fill="var(--paper)"
          >
            you
          </text>
        </g>

        {placed.map((p) => {
          const r = p.ringIdx === 0 ? 22 : p.ringIdx === 1 ? 19 : 17;
          return (
            <g
              key={p.id}
              style={{ cursor: "pointer" }}
              onClick={() => onPerson(p)}
            >
              {p.favorite && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r + 3}
                  fill="none"
                  stroke={`oklch(0.55 0.14 ${p.hue})`}
                  strokeWidth="0.75"
                  strokeDasharray="1.5 2"
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={`oklch(0.86 0.05 ${p.hue})`}
                stroke={`oklch(0.55 0.13 ${p.hue})`}
                strokeWidth="0.75"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontFamily="var(--serif)"
                fontStyle="italic"
                fontSize="11"
                fill={`oklch(0.30 0.13 ${p.hue})`}
              >
                {p.init}
              </text>
              {p.favorite && (
                <text
                  x={p.x + r * 0.7}
                  y={p.y - r * 0.55}
                  fontFamily="var(--serif)"
                  fontSize="9"
                  fill="oklch(0.55 0.16 38)"
                >
                  ★
                </text>
              )}
              <text
                x={p.x}
                y={p.y + r + 11}
                textAnchor="middle"
                fontFamily="var(--serif)"
                fontSize="9.5"
                fill="var(--ink-2)"
              >
                {p.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--mono)",
          fontSize: 8.5,
          color: "var(--ink-3)",
          letterSpacing: "0.08em",
        }}
      >
        <span>· dashed lines = same circle</span>
        <span>★ = inner ring</span>
      </div>
    </div>
  );
});
