import { IS_DATA } from "../../data/seedData";
import { Kicker } from "../shared/primitives";

interface InterestCat {
  id: string;
  label: string;
  hue: number;
  glyph: string;
}

interface BreakRowProps {
  cat: InterestCat;
  value: number;
  accent: string;
}

function BreakRow({ cat, value, accent }: BreakRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        marginBottom: 3,
      }}
    >
      <span
        style={{
          width: 14,
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: `oklch(0.45 0.13 ${cat.hue})`,
          textAlign: "center",
        }}
      >
        {cat.glyph}
      </span>
      <span
        style={{
          width: 56,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 11,
        }}
      >
        {cat.label}
      </span>
      <div
        style={{
          flex: 1,
          height: 5,
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          borderRadius: 2,
        }}
      >
        <div
          style={{ width: `${value}%`, height: "100%", background: accent }}
        />
      </div>
      <span
        style={{
          width: 22,
          textAlign: "right",
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--ink-3)",
        }}
      >
        {value}%
      </span>
    </div>
  );
}

interface GroupBreakdownProps {
  scope: "friends" | "city" | "world";
  accent: string;
}

const SCOPE_LABEL: Record<GroupBreakdownProps["scope"], string> = {
  friends: "your circle",
  city: "Oslo",
  world: "the world",
};

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
}

export function GroupBreakdown({ scope, accent }: GroupBreakdownProps) {
  const D = IS_DATA;
  const cats: InterestCat[] = D.interestCats;
  const reach = D.groupReach[scope];
  const popular = D.groupPopular[scope] || [];
  const label = SCOPE_LABEL[scope];

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <Kicker>Groups · what {label} joins</Kicker>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginTop: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            YOU
          </div>
          {cats.map((c) => (
            <BreakRow
              key={c.id}
              cat={c}
              value={D.groupReach.you[c.id]}
              accent={accent}
            />
          ))}
        </div>
        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            {label.toUpperCase()}
          </div>
          {cats.map((c) => (
            <BreakRow key={c.id} cat={c} value={reach[c.id]} accent={accent} />
          ))}
        </div>
      </div>
      {popular.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "0.5px dashed var(--rule)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            MOST-JOINED IN {label.toUpperCase()}
          </div>
          {popular.map(
            (p: { name: string; cat: string; n: number }, i: number) => {
              const c = cats.find((x) => x.id === p.cat);
              if (!c) return null;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 0",
                    borderBottom:
                      i < popular.length - 1
                        ? "0.5px solid var(--rule)"
                        : "none",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: `oklch(0.45 0.13 ${c.hue})`,
                        width: 14,
                      }}
                    >
                      {c.glyph}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      {p.name}
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: "var(--ink-3)",
                    }}
                  >
                    {fmt(p.n)}
                  </span>
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
