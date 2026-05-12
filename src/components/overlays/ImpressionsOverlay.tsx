import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { Kicker } from "../shared/primitives";

interface Impression {
  who: string;
  when: string;
  where: string;
  context: string;
  warmth: number;
  depth: number;
  energy: number;
  traits: string[];
  note: string;
  color: string;
}

interface AnonImpression {
  when: string;
  context: string;
  traits: string[];
}

const MY_IMPRESSIONS: Impression[] = [
  {
    who: "Sondre Lien",
    when: "apr 28 · 2026",
    where: "Tim Wendelboe, Grünerløkka",
    context: "first met · coffee",
    warmth: 78,
    depth: 64,
    energy: 52,
    traits: ["quietly funny", "careful listener", "restless hands"],
    note: "He let the silences sit. Asked the second question, then the third. I want to see him again.",
    color: "sienna",
  },
  {
    who: "Iben Marken",
    when: "apr 24 · 2026",
    where: "office, all-hands",
    context: "colleague",
    warmth: 44,
    depth: 70,
    energy: 88,
    traits: ["sharp", "impatient", "generous on credit"],
    note: "Brilliant in the room. Two beats faster than the conversation, but never unkind about it.",
    color: "ochre",
  },
  {
    who: "Magnus Holt",
    when: "apr 19 · 2026",
    where: "climbing gym",
    context: "mutual friend introduced",
    warmth: 62,
    depth: 38,
    energy: 74,
    traits: ["easy", "big laugh", "a little performative"],
    note: "Fun company for an evening. Not sure there is much underneath, but I liked him for it.",
    color: "sage",
  },
  {
    who: "Vilde Aas",
    when: "apr 11 · 2026",
    where: "Mathallen",
    context: "reintroduction · old colleague",
    warmth: 70,
    depth: 80,
    energy: 36,
    traits: ["watchful", "precise", "unexpectedly warm"],
    note: "Softer than I remembered. The way she asked about my mother.",
    color: "plum",
  },
  {
    who: "Erlend Nyland",
    when: "apr 03 · 2026",
    where: "dinner at K.'s",
    context: "new acquaintance",
    warmth: 30,
    depth: 50,
    energy: 22,
    traits: ["guarded", "well-read", "avoidant of warmth"],
    note: "Held a wine glass like a shield. I left wanting to know what he was protecting.",
    color: "indigo",
  },
];

const OF_YOU: AnonImpression[] = [
  { when: "apr 29 · 2026", context: "after a first coffee", traits: ["steady", "curious", "a little sad"] },
  { when: "apr 25 · 2026", context: "a colleague review", traits: ["rigorous", "unhurried", "occasionally remote"] },
  { when: "apr 14 · 2026", context: "friend-of-friend, party", traits: ["warm", "a little intimidating", "kind"] },
  { when: "apr 12 · 2026", context: "a friend, days later", traits: ["present", "observant", "undefended"] },
  { when: "mar 30 · 2026", context: "a group dinner", traits: ["composed", "serious", "dryly funny"] },
  { when: "mar 19 · 2026", context: "after a long walk", traits: ["gentle", "thoughtful"] },
  { when: "mar 04 · 2026", context: "a near-stranger", traits: ["intense", "kind eyes"] },
];

const HOW_YOU_LAND = [
  { trait: "curious", strength: 84 },
  { trait: "composed", strength: 78 },
  { trait: "warm", strength: 72 },
  { trait: "serious", strength: 64 },
  { trait: "dryly funny", strength: 56 },
  { trait: "intense", strength: 48 },
  { trait: "a little distant", strength: 38 },
  { trait: "undefended", strength: 30 },
];

function colorVar(c: string): string {
  const map: Record<string, string> = {
    sienna: "var(--sienna)",
    sage: "var(--sage)",
    ochre: "var(--ochre)",
    indigo: "var(--indigo)",
    plum: "oklch(0.52 0.14 305)",
  };
  return map[c] || "var(--ink)";
}

function TraitChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--serif)",
        fontStyle: "italic",
        fontSize: 12,
        lineHeight: 1.2,
        padding: "3px 9px",
        borderRadius: 999,
        border: "0.5px solid var(--rule)",
        background: "var(--paper-2)",
        color: "var(--ink-2)",
      }}
    >
      {children}
    </span>
  );
}

function MiniBars({ data }: { data: { label: string; v: number }[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        columnGap: 8,
        rowGap: 4,
        alignItems: "center",
      }}
    >
      {data.map((d) => (
        <Fragment key={d.label}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.08em",
              color: "var(--ink-3)",
              textTransform: "uppercase",
            }}
          >
            {d.label}
          </div>
          <div
            style={{
              height: 4,
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${d.v}%`,
                height: "100%",
                background: "var(--ink)",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              minWidth: 22,
              textAlign: "right",
            }}
          >
            {d.v}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function PersonStamp({
  who,
  when,
  color,
}: {
  who: string;
  when: string;
  color: string;
}) {
  const c = colorVar(color);
  const initials = who
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: 56,
        height: 56,
        flexShrink: 0,
        borderRadius: "50%",
        background: `color-mix(in oklch, ${c} 14%, var(--paper))`,
        border: `0.5px solid ${c}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--serif)",
        fontStyle: "italic",
        fontSize: 18,
        color: c,
        position: "relative",
      }}
    >
      {initials}
      <span
        style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          fontFamily: "var(--mono)",
          fontSize: 8,
          letterSpacing: "0.06em",
          color: "var(--ink-3)",
          background: "var(--paper)",
          padding: "1px 4px",
          border: "0.5px solid var(--rule)",
          borderRadius: 3,
          whiteSpace: "nowrap",
        }}
      >
        {when.split(" ").slice(0, 2).join(" ")}
      </span>
    </div>
  );
}

function ImpressionCard({ entry }: { entry: Impression }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <PersonStamp who={entry.who} when={entry.when} color={entry.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {entry.who}
            </div>
            <div className="kicker" style={{ fontSize: 8 }}>
              you · sketched
            </div>
          </div>
          <div className="kicker" style={{ marginTop: 2 }}>
            {entry.context} · {entry.where}
          </div>
          <div style={{ marginTop: 10 }}>
            <MiniBars
              data={[
                { label: "warmth", v: entry.warmth },
                { label: "depth", v: entry.depth },
                { label: "energy", v: entry.energy },
              ]}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: 10,
            }}
          >
            {entry.traits.map((t, i) => (
              <TraitChip key={i}>{t}</TraitChip>
            ))}
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}
          >
            "{entry.note}"
          </div>
        </div>
      </div>
    </div>
  );
}

function AnonImpressionCard({ entry }: { entry: AnonImpression }) {
  return (
    <div
      className="card"
      style={{
        padding: 12,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: "50%",
          background: "var(--paper-2)",
          border: "0.5px dashed var(--rule)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 22,
          color: "var(--ink-3)",
        }}
      >
        ◌
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--ink-2)",
            }}
          >
            {entry.context}
          </div>
          <div className="kicker">{entry.when}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 8,
          }}
        >
          {entry.traits.map((t, i) => (
            <TraitChip key={i}>{t}</TraitChip>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ImpressionsOverlayProps {
  onClose: () => void;
}

export function ImpressionsOverlay({ onClose }: ImpressionsOverlayProps) {
  const [side, setSide] = useState<"others" | "you">("others");
  const [acceptIncoming, setAcceptIncoming] = useState(true);

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          the <em>impressions</em>
        </div>
        <div className="h-meta">
          {MY_IMPRESSIONS.length + (acceptIncoming ? OF_YOU.length : 0)}
          <br />
          recorded
        </div>
      </div>

      <div className="app-body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 999,
            padding: 3,
            marginBottom: 14,
          }}
        >
          {(
            [
              { id: "others", label: "of others", sub: "you on them" },
              { id: "you", label: "of you", sub: "them on you" },
            ] as { id: "others" | "you"; label: string; sub: string }[]
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setSide(o.id)}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: side === o.id ? "var(--paper)" : "transparent",
                boxShadow: side === o.id ? "var(--shadow-card)" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                {o.label}
              </span>
              <span className="kicker">{o.sub}</span>
            </button>
          ))}
        </div>

        {side === "others" && (
          <>
            <div className="card" style={{ marginBottom: 14, padding: 16 }}>
              <Kicker>your ledger · private to you</Kicker>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 26,
                  fontStyle: "italic",
                  marginTop: 4,
                  letterSpacing: "-0.01em",
                }}
              >
                {MY_IMPRESSIONS.length} sketches
              </div>
              <div className="margin-note" style={{ marginTop: 6, fontSize: 12 }}>
                "A small archive of first looks. You will read these in five
                years and remember."
              </div>
              <hr className="rule-dashed" style={{ margin: "12px 0" }} />
              <Kicker>average reading · this season</Kicker>
              <div style={{ marginTop: 8 }}>
                <MiniBars
                  data={[
                    {
                      label: "warmth",
                      v: Math.round(
                        MY_IMPRESSIONS.reduce((s, e) => s + e.warmth, 0) /
                          MY_IMPRESSIONS.length,
                      ),
                    },
                    {
                      label: "depth",
                      v: Math.round(
                        MY_IMPRESSIONS.reduce((s, e) => s + e.depth, 0) /
                          MY_IMPRESSIONS.length,
                      ),
                    },
                    {
                      label: "energy",
                      v: Math.round(
                        MY_IMPRESSIONS.reduce((s, e) => s + e.energy, 0) /
                          MY_IMPRESSIONS.length,
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            <Kicker>sketches · most recent first</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 10,
              }}
            >
              {MY_IMPRESSIONS.map((e, i) => (
                <ImpressionCard key={i} entry={e} />
              ))}
            </div>

            <hr className="rule-dashed" />
            <div
              className="margin-note"
              style={{ fontSize: 12, textAlign: "center" }}
            >
              "These are yours alone. The people you write about will never see
              them."
            </div>
          </>
        )}

        {side === "you" && (
          <>
            <div
              className="card"
              style={{
                marginBottom: 14,
                padding: 14,
                borderLeft: `3px solid ${acceptIncoming ? "var(--accent)" : "var(--ink-3)"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <Kicker>privacy</Kicker>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 16,
                      marginTop: 4,
                      lineHeight: 1.35,
                    }}
                  >
                    People you've met can leave you an impression.
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 12,
                      color: "var(--ink-3)",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    Anonymous. Traits only — no longhand. Three a month, max,
                    per person.
                  </div>
                </div>
                <button
                  onClick={() => setAcceptIncoming((v) => !v)}
                  aria-pressed={acceptIncoming}
                  style={{
                    width: 46,
                    height: 26,
                    borderRadius: 999,
                    cursor: "pointer",
                    background: acceptIncoming
                      ? "var(--accent)"
                      : "var(--paper-3)",
                    border: "0.5px solid var(--rule)",
                    position: "relative",
                    flexShrink: 0,
                    transition: "background 0.18s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: acceptIncoming ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--paper)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
                      transition: "left 0.18s",
                    }}
                  />
                </button>
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span className="kicker">
                  STATUS · {acceptIncoming ? "OPEN" : "CLOSED"}
                </span>
                {!acceptIncoming && (
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 12,
                      color: "var(--ink-3)",
                    }}
                  >
                    new entries are turned away.
                  </span>
                )}
              </div>
            </div>

            {!acceptIncoming ? (
              <>
                <div className="card" style={{ padding: 22, textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 36,
                      fontStyle: "italic",
                      color: "var(--ink-3)",
                    }}
                  >
                    ◌
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 17,
                      marginTop: 8,
                    }}
                  >
                    you've closed the door on this.
                  </div>
                  <div className="margin-note" style={{ marginTop: 8, fontSize: 12 }}>
                    "Past impressions are kept, hidden, until you open it
                    again. People who try to leave one will be told you're not
                    accepting."
                  </div>
                </div>
                <hr className="rule-dashed" />
                <div className="kicker" style={{ textAlign: "center" }}>
                  {OF_YOU.length} HIDDEN IN THE BOX
                </div>
              </>
            ) : (
              <>
                <div className="card" style={{ marginBottom: 14, padding: 16 }}>
                  <Kicker>how you tend to land · seven recent voices</Kicker>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 22,
                      fontStyle: "italic",
                      marginTop: 4,
                      lineHeight: 1.25,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    curious, <span style={{ color: "var(--accent)" }}>composed</span>,
                    warm — sometimes a little distant.
                  </div>
                  <hr className="rule-dashed" style={{ margin: "12px 0" }} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {HOW_YOU_LAND.map((h) => (
                      <span
                        key={h.trait}
                        style={{
                          display: "inline-flex",
                          alignItems: "baseline",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: `color-mix(in oklch, var(--accent) ${Math.round(h.strength / 8)}%, var(--paper-2))`,
                          border: "0.5px solid var(--rule)",
                          fontFamily: "var(--serif)",
                          fontStyle: "italic",
                          fontSize: 13,
                          color: h.strength > 50 ? "var(--ink)" : "var(--ink-2)",
                        }}
                      >
                        {h.trait}
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontStyle: "normal",
                            fontSize: 8,
                            color: "var(--ink-3)",
                          }}
                        >
                          {h.strength}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                <Kicker>each entry · anonymous · traits only</Kicker>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {OF_YOU.map((e, i) => (
                    <AnonImpressionCard key={i} entry={e} />
                  ))}
                </div>

                <hr className="rule-dashed" />
                <div
                  className="margin-note"
                  style={{ fontSize: 12, textAlign: "center" }}
                >
                  "No names, no quotes. Just the shape of how you've been
                  read."
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
