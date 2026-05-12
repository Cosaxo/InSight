import { Av, Kicker } from "../shared/primitives";
import { RadarChart } from "../shared/charts";

interface MeForOverlay {
  initials: string;
  personality: { O: number; C: number; E: number; A: number; N: number };
}

export interface PersonForOverlay {
  init: string;
  hue: number;
  name: string;
  match: number;
  role?: string;
  rel?: string;
  dist?: string;
  note?: string;
  interests?: ({ t: string; c: string } | string)[];
  faves?: Record<string, string[]>;
}

interface PersonOverlayProps {
  p: PersonForOverlay;
  me: MeForOverlay;
  onClose: () => void;
}

export function PersonOverlay({ p, me, onClose }: PersonOverlayProps) {
  if (!p) return null;
  const dims = [
    { label: "Open", you: me.personality.O, them: 70 + (p.match - 60) / 4 },
    { label: "Cons.", you: me.personality.C, them: 55 + (p.match - 60) / 3 },
    { label: "Extra.", you: me.personality.E, them: 40 + (p.match - 60) / 5 },
    { label: "Agree.", you: me.personality.A, them: 65 + (p.match - 60) / 4 },
    {
      label: "Stable",
      you: 100 - me.personality.N,
      them: 60 + (p.match - 60) / 4,
    },
  ];
  const interests = p.interests ?? [];
  const interestLabels = interests.map((i) =>
    typeof i === "string" ? i : i.t,
  );

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">a portrait</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body">
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <Av init={p.init} hue={p.hue} size={84} />
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 24,
              marginTop: 10,
              letterSpacing: "-0.01em",
            }}
          >
            {p.name}
          </div>
          <div className="kicker" style={{ marginTop: 2 }}>
            {p.role || p.rel} · {p.dist || "in your orbit"}
          </div>
          {p.note && (
            <div
              className="margin-note"
              style={{ marginTop: 12, fontSize: 16, padding: "0 20px" }}
            >
              "{p.note}"
            </div>
          )}
        </div>

        <hr className="rule-dashed" />

        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>You vs them · five strokes</Kicker>
          <div style={{ marginTop: 8 }}>
            <RadarChart
              values={dims.map((d) => d.you)}
              compareValues={dims.map((d) => d.them)}
              labels={dims.map((d) => d.label)}
              color="var(--ink)"
              compareColor={`oklch(0.55 0.13 ${p.hue})`}
              size={260}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              color: "var(--ink-3)",
              letterSpacing: "0.08em",
              marginTop: 4,
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "var(--ink)",
                  borderRadius: 2,
                  marginRight: 5,
                }}
              />
              YOU
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: `oklch(0.55 0.13 ${p.hue})`,
                  borderRadius: 2,
                  marginRight: 5,
                }}
              />
              {p.init}
            </span>
          </div>
        </div>

        {interestLabels.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Kicker>Shared margins</Kicker>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {interestLabels.map((i) => (
                <span key={i} className="pill">
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

        {p.faves && (
          <div style={{ marginTop: 18 }}>
            <Kicker>Their shelf · what they love</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 10,
              }}
            >
              {[
                { key: "films", label: "Films", icon: "◐" },
                { key: "books", label: "Books", icon: "▢" },
                { key: "music", label: "Music", icon: "♪" },
              ].map(
                (c) =>
                  p.faves?.[c.key] &&
                  p.faves[c.key].length > 0 && (
                    <div
                      key={c.key}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--paper-2)",
                        border: "0.5px solid var(--rule)",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--ink-3)",
                          letterSpacing: "0.1em",
                          width: 48,
                        }}
                      >
                        {c.label.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: 13,
                          fontStyle: "italic",
                          flex: 1,
                        }}
                      >
                        {p.faves[c.key].join(" · ")}
                      </span>
                    </div>
                  ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
