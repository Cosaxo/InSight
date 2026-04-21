interface AvProps {
  init: string;
  color: string;
  size?: number;
}

export function Av({ init, color, size = 38 }: AvProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `${color}18`,
        border: `2.5px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.32),
        color,
        fontWeight: 800,
        boxShadow: `0 2px 10px ${color}35`,
        letterSpacing: "-0.5px",
      }}
    >
      {init}
    </div>
  );
}
