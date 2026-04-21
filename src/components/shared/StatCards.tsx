import { C } from "../../theme";
import type { StatCard } from "../../types";

interface StatCardsProps {
  cards: StatCard[];
}

export function StatCards({ cards }: StatCardsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        scrollbarWidth: "none",
        padding: "2px 0 6px",
      }}
    >
      {cards.map((c, i) => {
        const col = c.color || C.teal;
        return (
          <div
            key={i}
            style={{
              background: c.bg || `${col}10`,
              borderRadius: 14,
              padding: "11px 13px",
              minWidth: 100,
              flexShrink: 0,
              boxShadow: C.shadow,
              border: `1px solid ${col}20`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span style={{ color: col, lineHeight: 1 }}>{c.icon}</span>
              <span
                style={{
                  fontSize: 10,
                  color: c.color || C.muted,
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                  textTransform: "uppercase",
                }}
              >
                {c.label}
              </span>
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: col,
                lineHeight: 1,
              }}
            >
              {c.value}
            </div>
            {c.sub && (
              <div style={{ fontSize: 10, color: `${col}99`, marginTop: 3 }}>
                {c.sub}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
