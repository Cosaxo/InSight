import { useProfile } from "../../lib/useProfile";
import { Av, Kicker } from "../shared/primitives";
import { RadarChart } from "../shared/charts";

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
  onClose: () => void;
}

// Big Five vector order matches computeBig5 in useProfile.ts:
// [O, C, E, A, N]. We pull from profile.personality directly so the
// comparison reflects the user's actual Big Five test result (rather
// than the seed cast's). The "them" side is still synthesised from
// the person's match score — there's no per-person personality
// vector in the schema, and a real signal would need them to share
// their Big Five with you. The radar is hidden until you've taken
// the Big Five test yourself; an empty-state explains the gating.
export function PersonOverlay({ p, onClose }: PersonOverlayProps) {
  const { profile } = useProfile();
  if (!p) return null;
  const big5 = profile.personality;
  const personalityReady =
    Array.isArray(big5) &&
    big5.length === 5 &&
    big5.every((n) => typeof n === "number");
  const dims = personalityReady
    ? [
        { label: "Open", you: big5![0], them: 70 + (p.match - 60) / 4 },
        { label: "Cons.", you: big5![1], them: 55 + (p.match - 60) / 3 },
        { label: "Extra.", you: big5![2], them: 40 + (p.match - 60) / 5 },
        { label: "Agree.", you: big5![3], them: 65 + (p.match - 60) / 4 },
        {
          label: "Stable",
          you: 100 - big5![4],
          them: 60 + (p.match - 60) / 4,
        },
      ]
    : [];
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

        {personalityReady ? (
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
            <div
              className="margin-note"
              style={{ marginTop: 8, fontSize: 11, fontStyle: "italic" }}
            >
              Their side is estimated from match score — a real
              comparison needs them to share their Big Five with you.
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 14 }}>
            <Kicker>You vs them · five strokes</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 8, fontSize: 13, fontStyle: "italic" }}
            >
              Take the Big Five test (from "your portrait") to see how
              your strokes line up against {p.name.split(" ")[0]}'s.
            </div>
          </div>
        )}

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
