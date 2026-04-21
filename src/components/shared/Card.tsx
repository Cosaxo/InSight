import type { CSSProperties, ReactNode } from "react";
import { C, SEC } from "../../theme";
import type { SectionKey } from "../../theme";

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  sec?: SectionKey;
}

export function Card({ children, style = {}, sec }: CardProps) {
  const s = sec ? SEC[sec] : null;
  return (
    <div
      style={{
        background: C.card,
        borderRadius: 18,
        padding: "14px 16px",
        boxShadow: C.shadow,
        border: `1px solid ${C.divider}`,
        borderLeft: s ? `4px solid ${s.accent}` : `1px solid ${C.divider}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
