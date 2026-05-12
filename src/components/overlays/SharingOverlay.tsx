import { useState } from "react";
import { Kicker } from "../shared/primitives";

interface ShareItem {
  id: string;
  label: string;
  sub: string;
  glyph: string;
  def: ShareLevel;
}

type ShareLevel = "nobody" | "circle" | "city" | "world";

const SHARE_DATA: ShareItem[] = [
  { id: "mood", label: "mood & weather", sub: "how you feel each day", glyph: "☾", def: "circle" },
  { id: "location", label: "location · area", sub: "neighborhood, never address", glyph: "⌖", def: "circle" },
  { id: "location_p", label: "location · precise", sub: "gps to the meter", glyph: "◉", def: "nobody" },
  { id: "big5", label: "personality (Big Five)", sub: "O · C · E · A · N", glyph: "✺", def: "circle" },
  { id: "political", label: "political compass", sub: "six axes", glyph: "✦", def: "nobody" },
  { id: "morals", label: "values & morals", sub: "where you sit, ethics-wise", glyph: "◇", def: "circle" },
  { id: "health", label: "health · vitals", sub: "sleep, heart rate, body battery", glyph: "◐", def: "nobody" },
  { id: "health_w", label: "workouts", sub: "runs, swims, sessions", glyph: "↑", def: "circle" },
  { id: "meals", label: "meals", sub: "photo log, nutrition", glyph: "✦", def: "circle" },
  { id: "media", label: "media · favorites", sub: "films, books, music", glyph: "❀", def: "world" },
  { id: "interests", label: "interests", sub: "tags from your profile", glyph: "✶", def: "world" },
  { id: "dna_anc", label: "DNA · ancestry", sub: "regions only", glyph: "⌇", def: "nobody" },
  { id: "dna_health", label: "DNA · health markers", sub: "risk flags", glyph: "⌇", def: "nobody" },
  { id: "scrap", label: "scrapbook · finds", sub: "plants, birds, etc", glyph: "❀", def: "circle" },
  { id: "dreams", label: "dream journal", sub: "private by default", glyph: "☾", def: "nobody" },
  { id: "time", label: "time use", sub: "how minutes spend", glyph: "◐", def: "nobody" },
  { id: "daily", label: "daily report", sub: "one-line summary, sent to circle", glyph: "✎", def: "circle" },
];

interface Level {
  id: ShareLevel;
  label: string;
  glyph: string;
  hue: number;
}

const LEVELS: Level[] = [
  { id: "nobody", label: "nobody", glyph: "✕", hue: 12 },
  { id: "circle", label: "circle", glyph: "◌", hue: 38 },
  { id: "city", label: "city", glyph: "◐", hue: 145 },
  { id: "world", label: "world", glyph: "◯", hue: 220 },
];

function ShareRow({
  item,
  value,
  onChange,
}: {
  item: ShareItem;
  value: ShareLevel;
  onChange: (v: ShareLevel) => void;
}) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--serif)",
            color: "var(--accent)",
            fontSize: 16,
          }}
        >
          {item.glyph}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 14 }}>{item.label}</div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--ink-3)",
              marginTop: 1,
            }}
          >
            {item.sub}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 10,
          padding: 3,
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          borderRadius: 999,
        }}
      >
        {LEVELS.map((L) => {
          const active = value === L.id;
          return (
            <button
              key={L.id}
              onClick={() => onChange(L.id)}
              style={{
                flex: 1,
                padding: "6px 4px",
                cursor: "pointer",
                background: active
                  ? `oklch(0.55 0.13 ${L.hue})`
                  : "transparent",
                color: active ? "white" : "var(--ink-3)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {L.glyph} {L.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SharingOverlayProps {
  onClose: () => void;
}

export function SharingOverlay({ onClose }: SharingOverlayProps) {
  const [vals, setVals] = useState<Record<string, ShareLevel>>(() => {
    const o: Record<string, ShareLevel> = {};
    SHARE_DATA.forEach((d) => (o[d.id] = d.def));
    return o;
  });

  const tally = LEVELS.map((L) => ({
    ...L,
    n: SHARE_DATA.filter((d) => vals[d.id] === L.id).length,
  }));

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          what you <em>share</em>
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body">
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <Kicker>Your perimeter</Kicker>
          <div
            className="margin-note"
            style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}
          >
            "Each circle widens what you let out into the world. <em>Nobody</em>{" "}
            means kept entirely to yourself."
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {tally.map((t) => (
              <div
                key={t.id}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "8px 4px",
                  background: `oklch(0.96 0.04 ${t.hue})`,
                  border: `0.5px solid oklch(0.78 0.08 ${t.hue})`,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 22,
                    fontStyle: "italic",
                    color: `oklch(0.40 0.13 ${t.hue})`,
                  }}
                >
                  {t.n}
                </div>
                <div
                  className="kicker"
                  style={{ marginTop: 2, fontSize: 8 }}
                >
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Kicker>Each thing, separately</Kicker>
        <div style={{ marginTop: 10 }}>
          {SHARE_DATA.map((item) => (
            <ShareRow
              key={item.id}
              item={item}
              value={vals[item.id]}
              onChange={(v) => setVals({ ...vals, [item.id]: v })}
            />
          ))}
        </div>

        <hr className="rule-dashed" />
        <Kicker>Anonymized in aggregate</Kicker>
        <div className="margin-note" style={{ marginTop: 8, fontSize: 12 }}>
          City and world averages always include your numbers — but stripped of
          your name. There is no way to opt out and still see them; it would be
          one-way mirror.
        </div>
      </div>
    </div>
  );
}
