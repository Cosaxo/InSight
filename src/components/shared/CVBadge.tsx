import type { CoreValues } from "../../types";
import { cvQuadrant } from "../../utils/helpers";

interface CVBadgeProps {
  cv: CoreValues | undefined | null;
}

export function CVBadge({ cv }: CVBadgeProps) {
  const q = cvQuadrant(cv);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 20,
        background: q.color,
        boxShadow: `0 2px 8px ${q.color}40`,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
        {q.name}
      </span>
    </div>
  );
}
