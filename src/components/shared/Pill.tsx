import type { ReactNode } from "react";
import { C } from "../../theme";

interface PillProps {
  children: ReactNode;
  active?: boolean;
  color?: string;
  onClick?: () => void;
}

export function Pill({ children, active, color = C.teal, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 18px",
        borderRadius: 20,
        cursor: "pointer",
        fontFamily: "inherit",
        border: active ? "none" : `1.5px solid ${C.divider}`,
        background: active ? color : C.card,
        color: active ? "#fff" : C.muted,
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        flexShrink: 0,
        boxShadow: active ? `0 3px 12px ${color}40` : C.shadow,
        transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
        letterSpacing: active ? "0.1px" : "0",
      }}
    >
      {children}
    </button>
  );
}
