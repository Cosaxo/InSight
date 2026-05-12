import { useState } from "react";
import { Kicker } from "../shared/primitives";
import { useRelations } from "../../lib/useRelations";

const CATEGORIES: { key: string; label: string; hue: number; rel: string }[] = [
  { key: "family", label: "Family", hue: 12, rel: "family" },
  { key: "friends", label: "Friends", hue: 38, rel: "friend" },
  { key: "colleagues", label: "Colleagues", hue: 220, rel: "colleague" },
  { key: "neighbors", label: "Neighbors", hue: 145, rel: "neighbor" },
  { key: "acquaintances", label: "Acquaintances", hue: 250, rel: "acquaintance" },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AddPersonFlowProps {
  onClose: () => void;
  onSaved?: () => void;
}

export function AddPersonFlow({ onClose, onSaved }: AddPersonFlowProps) {
  const { add } = useRelations();
  const [name, setName] = useState("");
  const [catKey, setCatKey] = useState("friends");
  const [match, setMatch] = useState(70);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const cat =
    CATEGORIES.find((c) => c.key === catKey) ?? CATEGORIES[1];

  const canSave = name.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await add({
        name: name.trim(),
        init: initialsOf(name),
        hue: cat.hue,
        match,
        rel: cat.rel,
        category: cat.key,
        degrees: 1,
        since: String(new Date().getFullYear()),
      });
      setDone(true);
      setTimeout(() => {
        if (onSaved) onSaved();
        onClose();
      }, 700);
    } catch (err) {
      console.error("[AddPersonFlow] save failed:", err);
      setBusy(false);
    }
  };

  return (
    <div
      className="overlay paper-grain"
      style={{ zIndex: 40 }}
      onClick={onClose}
    >
      <div className="app-header" onClick={(e) => e.stopPropagation()}>
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          + <em>add a person</em>
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body" onClick={(e) => e.stopPropagation()}>
        <div className="margin-note" style={{ marginBottom: 14, fontSize: 13 }}>
          a name and a circle. you can fill the rest in later.
        </div>

        {/* Live preview */}
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `oklch(0.86 0.05 ${cat.hue})`,
              border: `0.5px solid oklch(0.55 0.12 ${cat.hue})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 18,
              color: `oklch(0.30 0.13 ${cat.hue})`,
              flexShrink: 0,
            }}
          >
            {initialsOf(name || "??")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 16,
                lineHeight: 1.2,
              }}
            >
              {name.trim() || "name them"}
            </div>
            <div className="kicker" style={{ marginTop: 2 }}>
              {cat.label.toUpperCase()} · MATCH {match}%
            </div>
          </div>
        </div>

        <Kicker>Their name</Kicker>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sigrid Bø"
          autoFocus
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginTop: 6,
            padding: "12px 14px",
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 8,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 16,
            color: "var(--ink)",
          }}
        />

        <div style={{ marginTop: 16 }}>
          <Kicker>Which circle</Kicker>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
            }}
          >
            {CATEGORIES.map((c) => {
              const on = c.key === catKey;
              return (
                <button
                  key={c.key}
                  onClick={() => setCatKey(c.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    background: on
                      ? `oklch(0.94 0.04 ${c.hue})`
                      : "var(--paper-2)",
                    color: on
                      ? `oklch(0.32 0.13 ${c.hue})`
                      : "var(--ink-2)",
                    border: `0.5px solid ${on ? `oklch(0.65 0.12 ${c.hue})` : "var(--rule)"}`,
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <Kicker>How close · 0–100</Kicker>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.06em",
              }}
            >
              {match}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={match}
            onChange={(e) => setMatch(+e.target.value)}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>

        <hr className="rule-dashed" />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: 12,
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
            onClick={save}
            disabled={!canSave}
            style={{
              flex: 2,
              padding: 12,
              background: done
                ? "var(--accent)"
                : canSave
                  ? "var(--ink)"
                  : "var(--paper-3)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 14,
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.6,
            }}
          >
            {done ? "saved." : busy ? "saving…" : "add to your circle"}
          </button>
        </div>
      </div>
    </div>
  );
}
