import { useState } from "react";
import { useProfile } from "../../lib/useProfile";
import { useRelations } from "../../lib/useRelations";
import { Av, Kicker } from "../shared/primitives";
import { RadarChart } from "../shared/charts";

export interface PersonForOverlay {
  // When this person is one of the user's relations, `id` is the
  // useRelations doc id. PersonOverlay uses its presence to decide
  // whether the Big Five rating editor can save back to the relation.
  id?: string;
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
  // Optional real Big Five rating (set by the user in the inline
  // rating editor below). When present we drive the radar from this
  // instead of the old synthesised-from-match-score values.
  personality?: number[];
}

const BIG5_LABELS = ["Open", "Cons.", "Extra.", "Agree.", "Stable"];

interface PersonOverlayProps {
  p: PersonForOverlay;
  onClose: () => void;
}

// Big Five vector order matches computeBig5 in useProfile.ts:
// [O, C, E, A, N]. The "you" side comes from profile.personality —
// the test result the user has taken on themselves.
//
// The "them" side has two paths:
//   1. p.personality is set (the user has rated this person via the
//      inline editor below) → render real numbers.
//   2. p.personality is undefined → hide the comparison; show the
//      rating editor instead so the user can fill it in.
// The synthesised "estimate from match score" path is gone — it
// was the only place left in PersonOverlay asserting numbers it
// didn't have.
export function PersonOverlay({ p, onClose }: PersonOverlayProps) {
  const { profile } = useProfile();
  const { update } = useRelations();
  const [editing, setEditing] = useState(false);
  if (!p) return null;
  const big5 = profile.personality;
  const personalityReady =
    Array.isArray(big5) &&
    big5.length === 5 &&
    big5.every((n) => typeof n === "number");
  const themReady =
    Array.isArray(p.personality) &&
    p.personality.length === 5 &&
    p.personality.every((n) => typeof n === "number");
  const dims =
    personalityReady && themReady
      ? BIG5_LABELS.map((label, i) => ({
          label,
          // The N axis (index 4) is "Neuroticism". We flip both sides
          // to "Stable" so the dial reads "more = better-feeling"
          // consistently across all five axes.
          you: i === 4 ? 100 - big5![i] : big5![i],
          them: i === 4 ? 100 - p.personality![i] : p.personality![i],
        }))
      : [];
  const interests = p.interests ?? [];
  const interestLabels = interests.map((i) =>
    typeof i === "string" ? i : i.t,
  );

  const isRelation = !!p.id;
  const saveRating = async (vec: number[]) => {
    if (!p.id) return;
    await update(p.id, { personality: vec });
  };

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

        {!personalityReady ? (
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
        ) : themReady ? (
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
            {isRelation && (
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: "var(--ink-3)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ✎ ADJUST
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 14 }}>
            <Kicker>You vs them · five strokes</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
            >
              {isRelation
                ? `Rate ${p.name.split(" ")[0]}'s Big Five to compare against your own. Your read — adjustable any time.`
                : `${p.name.split(" ")[0]} isn't one of your relations yet. Add them and you can rate their Big Five.`}
            </div>
            {isRelation && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  marginTop: 10,
                  padding: "8px 14px",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: 99,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                }}
              >
                + RATE BIG FIVE
              </button>
            )}
          </div>
        )}

        {editing && isRelation && (
          <Big5RatingEditor
            name={p.name}
            current={p.personality}
            onCancel={() => setEditing(false)}
            onSave={async (vec) => {
              await saveRating(vec);
              setEditing(false);
            }}
          />
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

// ─── Big5RatingEditor — modal sheet for rating a relation ──────
//
// Five sliders 0..100, one per Big Five axis. Each slider starts at
// the current rating if one exists, otherwise 50 (neutral). Saves
// the full vector back via the parent's onSave; cancel discards.

const BIG5_FULL = [
  { key: "O", name: "Openness", lo: "conventional", hi: "curious" },
  { key: "C", name: "Conscientiousness", lo: "flexible", hi: "ordered" },
  { key: "E", name: "Extraversion", lo: "reserved", hi: "outgoing" },
  { key: "A", name: "Agreeableness", lo: "challenging", hi: "warm" },
  { key: "N", name: "Neuroticism", lo: "stable", hi: "sensitive" },
];

function Big5RatingEditor({
  name,
  current,
  onCancel,
  onSave,
}: {
  name: string;
  current?: number[];
  onCancel: () => void;
  onSave: (vec: number[]) => Promise<void> | void;
}) {
  const init = current && current.length === 5 ? current : [50, 50, 50, 50, 50];
  const [vec, setVec] = useState<number[]>(init);
  const [saving, setSaving] = useState(false);

  const set = (idx: number, v: number) => {
    setVec((prev) => prev.map((x, i) => (i === idx ? v : x)));
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(vec);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="app-header"
        style={{
          background: "transparent",
          borderBottom: "0.5px solid rgba(255,255,255,0.15)",
        }}
      >
        <button
          className="avatar-btn"
          onClick={onCancel}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          rate · {name}
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div
          style={{
            background: "var(--paper)",
            borderRadius: 8,
            padding: 16,
            color: "var(--ink)",
          }}
        >
          <Kicker>your read — adjustable any time</Kicker>
          <div className="margin-note" style={{ marginTop: 4, fontSize: 12 }}>
            "Five strokes. Where you'd place them on each axis — your
            sense of who they are. Stays private to you."
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 14,
            }}
          >
            {BIG5_FULL.map((axis, i) => (
              <div key={axis.key}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    color: "var(--ink-3)",
                  }}
                >
                  <span>{axis.lo.toUpperCase()}</span>
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 13,
                      color: "var(--ink-2)",
                    }}
                  >
                    {axis.name}
                  </span>
                  <span>{axis.hi.toUpperCase()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={vec[i]}
                  onChange={(e) => set(i, +e.target.value)}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9.5,
                    color: "var(--ink-3)",
                    textAlign: "center",
                    marginTop: -2,
                  }}
                >
                  {vec[i]}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
