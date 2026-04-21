import type { ReactNode } from "react";
import { C, SEC } from "../../theme";
import type { SectionKey } from "../../theme";

interface SLabelProps {
  children: ReactNode;
  sec?: SectionKey;
}

export function SLabel({ children, sec }: SLabelProps) {
  const color = sec ? SEC[sec].accent : C.muted;
  return (
    <div
      style={{
        fontSize: 11,
        color,
        letterSpacing: "0.8px",
        fontWeight: 700,
        marginBottom: 10,
        textTransform: "uppercase",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {sec && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </div>
  );
}
