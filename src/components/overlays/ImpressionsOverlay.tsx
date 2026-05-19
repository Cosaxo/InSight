// ImpressionsOverlay — your private ledger of people you've met.
//
// "of others" — your sketches of people. Backed by useImpressions
// (insight_users/{uid}/insight_impressions/{id} when signed in,
// localStorage otherwise). The AddImpressionFlow form persists for
// real now; each card gets a per-impression × delete.
//
// "of you" — anonymous traits people in your circle have left
// for you. Backed by useInboundImpressions (Firestore subscription
// on your own insight_inbound_impressions subcollection). Writers
// are people you've added as a relation with a linkedUid — the
// Firestore rule enforces that. Cross-user writes happen from
// PersonOverlay's "leave an impression" affordance.

import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Kicker } from "../shared/primitives";
import { useImpressions } from "../../lib/useImpressions";
import { useInboundImpressions } from "../../lib/useInboundImpressions";
import type { Impression } from "../../types";

// Palette for the round PersonStamp on each impression card. We
// rotate through these when adding so successive entries get
// visually distinct stamps without a colour picker UI.
const COLOR_PALETTE = ["sienna", "sage", "ochre", "indigo", "plum"] as const;

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
      {initials || "·"}
      {when && (
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
      )}
    </div>
  );
}

function ImpressionCard({
  entry,
  onRemove,
}: {
  entry: Impression;
  onRemove?: (id: string) => void;
}) {
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
              {entry.who || <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>someone</span>}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div className="kicker" style={{ fontSize: 8 }}>
                you · sketched
              </div>
              {onRemove && (
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Remove the impression of ${entry.who || "this person"}?`,
                      )
                    ) {
                      onRemove(entry.id);
                    }
                  }}
                  aria-label="Remove impression"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-3)",
                    cursor: "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    padding: "0 2px",
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {(entry.context || entry.where) && (
            <div className="kicker" style={{ marginTop: 2 }}>
              {[entry.context, entry.where].filter(Boolean).join(" · ")}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <MiniBars
              data={[
                { label: "warmth", v: entry.warmth },
                { label: "depth", v: entry.depth },
                { label: "energy", v: entry.energy },
              ]}
            />
          </div>
          {entry.traits.length > 0 && (
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
          )}
          {entry.note && (
            <div
              className="margin-note"
              style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}
            >
              "{entry.note}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function todayLabel(): string {
  return new Date()
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

interface AddImpressionFlowProps {
  onClose: () => void;
  onSave: (i: Omit<Impression, "id" | "createdAt">) => Promise<void>;
  nextColor: string;
}

function AddImpressionFlow({ onClose, onSave, nextColor }: AddImpressionFlowProps) {
  const [step, setStep] = useState<"form" | "saved">("form");
  const [who, setWho] = useState("");
  const [context, setContext] = useState("");
  const [where, setWhere] = useState("");
  const [warmth, setWarmth] = useState(60);
  const [depth, setDepth] = useState(50);
  const [energy, setEnergy] = useState(50);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // A starter palette — users can pick from these, but the underlying
  // trait list is free-form (any string they pin lands in the chip
  // cloud on the saved card). Future: free-text "add custom trait"
  // input.
  const palette = [
    "quietly funny",
    "careful listener",
    "sharp",
    "impatient",
    "easy",
    "guarded",
    "curious",
    "warm",
    "restless",
    "precise",
    "performative",
    "kind",
  ];
  const togglePick = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        who: who.trim(),
        when: todayLabel(),
        where: where.trim() || undefined,
        context: context.trim() || undefined,
        warmth,
        depth,
        energy,
        traits: picked,
        note: note.trim() || undefined,
        color: nextColor,
      });
      setStep("saved");
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
          onClick={onClose}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          sketch an impression
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        {step === "form" && (
          <div
            style={{
              background: "var(--paper)",
              borderRadius: 8,
              padding: 16,
              color: "var(--ink)",
            }}
          >
            <Kicker>who did you meet?</Kicker>
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="a name, or leave blank"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 6,
                padding: "10px 12px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 6,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 15,
                color: "var(--ink)",
              }}
            />

            <div style={{ marginTop: 12 }}>
              <Kicker>context · where</Kicker>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="first met, colleague…"
                  style={{
                    flex: 1,
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 6,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--ink)",
                  }}
                />
                <input
                  value={where}
                  onChange={(e) => setWhere(e.target.value)}
                  placeholder="where"
                  style={{
                    flex: 1,
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 6,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <Kicker>how did they feel?</Kicker>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {[
                  { k: "warmth", v: warmth, set: setWarmth, lo: "cool", hi: "warm" },
                  { k: "depth", v: depth, set: setDepth, lo: "light", hi: "deep" },
                  { k: "energy", v: energy, set: setEnergy, lo: "still", hi: "electric" },
                ].map((s) => (
                  <div key={s.k}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        color: "var(--ink-3)",
                      }}
                    >
                      <span>{s.lo}</span>
                      <span>{s.k}</span>
                      <span>{s.hi}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={s.v}
                      onChange={(e) => s.set(+e.target.value)}
                      style={{
                        width: "100%",
                        accentColor: "var(--accent)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <Kicker>a few words</Kicker>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 5,
                  marginTop: 8,
                }}
              >
                {palette.map((t) => (
                  <button
                    key={t}
                    onClick={() => togglePick(t)}
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 12,
                      padding: "4px 9px",
                      borderRadius: 999,
                      cursor: "pointer",
                      background: picked.includes(t)
                        ? "var(--ink)"
                        : "var(--paper-2)",
                      color: picked.includes(t) ? "var(--paper)" : "var(--ink-2)",
                      border: "0.5px solid var(--rule)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <Kicker>the note · longhand · private to you</Kicker>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="what stayed with you?"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: 6,
                  padding: "10px 12px",
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 6,
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "var(--ink)",
                  resize: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button
                onClick={onClose}
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
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "pinning…" : "pin it"}
              </button>
            </div>
          </div>
        )}

        {step === "saved" && (
          <div
            style={{
              background: "var(--paper)",
              borderRadius: 8,
              padding: 22,
              color: "var(--ink)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 28,
              }}
            >
              pinned.
            </div>
            <div className="margin-note" style={{ marginTop: 10 }}>
              An impression of {who || "someone"} is now in your ledger.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 18,
                padding: "10px 22px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ImpressionsOverlayProps {
  onClose: () => void;
}

export function ImpressionsOverlay({ onClose }: ImpressionsOverlayProps) {
  const [side, setSide] = useState<"others" | "you">("others");
  const [adding, setAdding] = useState(false);
  const { items, add, remove } = useImpressions();

  // Sort newest first for the list view and the seasonal averages.
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  const recent = sorted.slice(0, 10);
  const avg = (key: "warmth" | "depth" | "energy") =>
    recent.length === 0
      ? 0
      : Math.round(recent.reduce((s, e) => s + e[key], 0) / recent.length);

  // Rotate the stamp palette so successive sketches get visually
  // distinct colours without asking the user to pick one.
  const nextColor = COLOR_PALETTE[items.length % COLOR_PALETTE.length];

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
          {items.length}
          <br />
          {items.length === 1 ? "sketch" : "sketches"}
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
                {items.length === 0
                  ? "no sketches yet"
                  : `${items.length} ${items.length === 1 ? "sketch" : "sketches"}`}
              </div>
              <div className="margin-note" style={{ marginTop: 6, fontSize: 12 }}>
                "A small archive of first looks. You will read these in five
                years and remember."
              </div>
              {recent.length > 0 && (
                <>
                  <hr className="rule-dashed" style={{ margin: "12px 0" }} />
                  <Kicker>average reading · recent</Kicker>
                  <div style={{ marginTop: 8 }}>
                    <MiniBars
                      data={[
                        { label: "warmth", v: avg("warmth") },
                        { label: "depth", v: avg("depth") },
                        { label: "energy", v: avg("energy") },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setAdding(true)}
              style={{
                width: "100%",
                padding: "14px",
                background:
                  "color-mix(in oklch, var(--accent) 8%, var(--paper))",
                border: "0.5px dashed var(--accent)",
                borderRadius: 6,
                marginBottom: 14,
                cursor: "pointer",
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 15,
                color: "var(--accent)",
              }}
            >
              ◉  sketch a new impression
            </button>

            {sorted.length > 0 ? (
              <>
                <Kicker>sketches · most recent first</Kicker>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {sorted.map((e) => (
                    <ImpressionCard
                      key={e.id}
                      entry={e}
                      onRemove={(id) => void remove(id)}
                    />
                  ))}
                </div>

                <hr className="rule-dashed" />
                <div
                  className="margin-note"
                  style={{ fontSize: 12, textAlign: "center" }}
                >
                  "These are yours alone. The people you write about will never
                  see them."
                </div>
              </>
            ) : (
              <div
                className="card"
                style={{ padding: 22, textAlign: "center" }}
              >
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
                  className="margin-note"
                  style={{ marginTop: 10, fontSize: 13 }}
                >
                  "Sketch your first impression of someone. You'll read it
                  back later and remember the shape of meeting them."
                </div>
              </div>
            )}
          </>
        )}

        {side === "you" && <InboundImpressionsView />}
      </div>

      {adding && side === "others" && (
        <AddImpressionFlow
          onClose={() => setAdding(false)}
          nextColor={nextColor}
          onSave={async (i) => {
            await add(i);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

// ─── InboundImpressionsView — the "of you" side ────────────────
//
// Renders the user's anonymous-trait inbox. Each row shows the
// traits + optional context, the date, and a × to delete. The
// "how you tend to land" header aggregates trait frequencies
// across all received entries.

function InboundImpressionsView() {
  const { items, remove } = useInboundImpressions();

  // Tally trait frequencies across the whole inbox so the header
  // shows "the words that come back most." Top 8.
  const tally = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of items) {
      for (const t of i.traits) {
        const k = t.trim().toLowerCase();
        if (!k) continue;
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [items]);
  const maxCount = tally.length ? tally[0][1] : 0;

  if (items.length === 0) {
    return (
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
          nothing here yet.
        </div>
        <div
          className="margin-note"
          style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}
        >
          "Anonymous traits from people in your circle land here.
          Only people you've added as a relation can leave one —
          and only ever traits, never longhand."
        </div>
      </div>
    );
  }

  return (
    <>
      {tally.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: 16 }}>
          <Kicker>how you tend to land · {items.length} {items.length === 1 ? "voice" : "voices"}</Kicker>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginTop: 10,
            }}
          >
            {tally.map(([trait, count]) => (
              <span
                key={trait}
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: `color-mix(in oklch, var(--accent) ${Math.round((count / maxCount) * 16)}%, var(--paper-2))`,
                  border: "0.5px solid var(--rule)",
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 13,
                  color: "var(--ink-2)",
                }}
              >
                {trait}
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontStyle: "normal",
                    fontSize: 8,
                    color: "var(--ink-3)",
                  }}
                >
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <Kicker>each entry · anonymous · traits only</Kicker>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 10,
        }}
      >
        {items.map((entry) => (
          <InboundImpressionCard
            key={entry.id}
            entry={entry}
            onRemove={() => void remove(entry.id)}
          />
        ))}
      </div>

      <hr className="rule-dashed" />
      <div
        className="margin-note"
        style={{ fontSize: 12, textAlign: "center" }}
      >
        "No names, no quotes. Just the shape of how you've been read."
      </div>
    </>
  );
}

function InboundImpressionCard({
  entry,
  onRemove,
}: {
  entry: { id: string; traits: string[]; context?: string; createdAt: number };
  onRemove: () => void;
}) {
  const when = new Date(entry.createdAt)
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
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
            {entry.context || "anonymous"}
          </div>
          <div className="kicker">{when}</div>
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
            <span
              key={i}
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
              {t}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={() => {
          if (confirm("Remove this impression?")) onRemove();
        }}
        aria-label="Remove inbound impression"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 12,
          padding: "0 2px",
        }}
      >
        ×
      </button>
    </div>
  );
}
