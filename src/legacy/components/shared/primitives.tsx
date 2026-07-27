import type { CSSProperties, ReactNode } from "react";

interface StarsProps {
  n: number;
  max?: number;
}
export function Stars({ n, max = 5 }: StarsProps) {
  return (
    <span className="stars">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={"star" + (i < n ? " on" : "")}>
          ✦
        </span>
      ))}
    </span>
  );
}

interface AvProps {
  init: string;
  hue?: number;
  size?: number;
  style?: CSSProperties;
}
export function Av({ init, hue = 38, size = 38, style }: AvProps) {
  const bg = `oklch(0.86 0.05 ${hue})`;
  const fg = `oklch(0.30 0.10 ${hue})`;
  return (
    <span
      className="av"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.36,
        ...style,
      }}
    >
      {init}
    </span>
  );
}

interface BarProps {
  value: number;
  max?: number;
  color?: string;
}
export function Bar({ value, max = 100, color = "var(--ink)" }: BarProps) {
  return (
    <div className="bar">
      <i
        style={{
          width: `${Math.min(100, (value / max) * 100)}%`,
          background: color,
        }}
      />
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="kicker">{children}</div>;
}

interface PillProps {
  active?: boolean;
  color?: string;
  children: ReactNode;
  onClick?: () => void;
}
export function Pill({
  active,
  color = "ink",
  children,
  onClick,
}: PillProps) {
  return (
    <button
      className={"pill " + color + (active ? " is-on" : "")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface CompassRoseProps {
  rings?: number;
  cardinals?: boolean;
}
export function CompassRose({ rings = 4, cardinals = true }: CompassRoseProps) {
  const cx = 160,
    cy = 160;
  const ticks = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2 - Math.PI / 2;
    const r1 = 152,
      r2 = i % 8 === 0 ? 138 : 146;
    return (
      <line
        key={i}
        className="rose-tick"
        x1={cx + Math.cos(a) * r1}
        y1={cy + Math.sin(a) * r1}
        x2={cx + Math.cos(a) * r2}
        y2={cy + Math.sin(a) * r2}
      />
    );
  });
  return (
    <svg
      viewBox="0 0 320 320"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {Array.from({ length: rings }).map((_, i) => (
        <circle
          key={i}
          className={"rose-line" + (i === rings - 1 ? " thick" : "")}
          cx={cx}
          cy={cy}
          r={40 + i * 36}
        />
      ))}
      <line className="rose-line" x1={cx} y1={cy - 152} x2={cx} y2={cy + 152} />
      <line className="rose-line" x1={cx - 152} y1={cy} x2={cx + 152} y2={cy} />
      <line
        className="rose-line"
        x1={cx - 108}
        y1={cy - 108}
        x2={cx + 108}
        y2={cy + 108}
      />
      <line
        className="rose-line"
        x1={cx - 108}
        y1={cy + 108}
        x2={cx + 108}
        y2={cy - 108}
      />
      {ticks}
      {cardinals && (
        <g
          style={{
            font: "italic 14px Fraunces, Georgia, serif",
            fill: "var(--ink-3)",
          }}
        >
          <text x={cx} y={20} textAnchor="middle">
            N
          </text>
          <text x={cx} y={310} textAnchor="middle">
            S
          </text>
          <text x={310} y={cy + 4} textAnchor="end">
            E
          </text>
          <text x={10} y={cy + 4}>
            W
          </text>
        </g>
      )}
    </svg>
  );
}

interface CardProps {
  children: ReactNode;
  deckle?: boolean;
  style?: CSSProperties;
  className?: string;
}
export function Card({ children, deckle, style, className }: CardProps) {
  const cls = (deckle ? "card-deckle" : "card") + (className ? " " + className : "");
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

interface SecHeadProps {
  title: ReactNode;
  num?: string;
}
export function SecHead({ title, num }: SecHeadProps) {
  return (
    <div className="sec-head">
      <h2>{title}</h2>
      {num && <span className="num">{num}</span>}
    </div>
  );
}

interface StampProps {
  children: ReactNode;
}
export function Stamp({ children }: StampProps) {
  return <span className="stamp">{children}</span>;
}

interface MarginNoteProps {
  children: ReactNode;
  style?: CSSProperties;
}
export function MarginNote({ children, style }: MarginNoteProps) {
  return (
    <div className="margin-note" style={style}>
      {children}
    </div>
  );
}
