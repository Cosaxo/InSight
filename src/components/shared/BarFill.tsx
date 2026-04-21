import { C } from "../../theme";

interface BarFillProps {
  value: number;
  color: string;
  height?: number;
}

export function BarFill({ value, color, height = 5 }: BarFillProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      style={{
        height,
        background: C.dim,
        borderRadius: height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: height,
          background: `linear-gradient(90deg, ${color}aa, ${color})`,
          transition: "width 0.4s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </div>
  );
}
