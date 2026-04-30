import { C } from "../../theme";
import type { ContextBarItem } from "../../types";

interface ContextBarProps {
  items: ContextBarItem[];
}

export function ContextBar({ items }: ContextBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        overflowX: "auto",
        scrollbarWidth: "none",
        padding: "2px 0 4px",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            background: C.card,
            borderRadius: 14,
            padding: "10px 12px",
            minWidth: 110,
            flexShrink: 0,
            boxShadow: C.shadow,
            border: `1px solid ${C.divider}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                lineHeight: 0,
                flexShrink: 0,
                color: item.color || C.muted,
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.2px",
                whiteSpace: "nowrap",
                color: C.muted,
              }}
            >
              {item.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: item.color || C.navy,
              lineHeight: 1,
            }}
          >
            {item.value}
          </div>
          {item.sub && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              {item.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
