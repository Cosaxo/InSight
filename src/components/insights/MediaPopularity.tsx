// MediaPopularity — "what's loved in {scope}" shelf. Your own
// favourites come from profile.media; the per-scope "most-loved"
// podium comes from the media aggregator (passed in as scopePopular).
// When a scope has no aggregate for the active category yet, that
// half shows an honest empty state instead of fabricated rankings.

import { useState } from "react";
import { useProfile } from "../../lib/useProfile";
import { Kicker, Pill } from "../shared/primitives";
import type { MediaKey, ScopeMedia } from "../../types";

const CATS: { key: MediaKey; label: string; icon: string }[] = [
  { key: "music", label: "Music", icon: "♪" },
  { key: "film", label: "Films", icon: "◐" },
  { key: "books", label: "Books", icon: "▢" },
  { key: "podcasts", label: "Podcasts", icon: "✦" },
];

interface MediaPopularityProps {
  label: string;
  accent?: string;
  // Top items per category across the scope, from the aggregator.
  // null/absent → the popularity half shows an honest empty state.
  scopePopular?: ScopeMedia | null;
}

export function MediaPopularity({
  label,
  accent = "var(--accent)",
  scopePopular,
}: MediaPopularityProps) {
  const { profile } = useProfile();
  const media = profile.media ?? null;
  const [cat, setCat] = useState<MediaKey>("music");
  const active = CATS.find((c) => c.key === cat)!;
  const yourItems = media?.[cat] ?? [];
  const popular = scopePopular?.[cat] ?? [];
  const maxCount = popular[0]?.count ?? 1;

  return (
    <div>
      <Kicker>The shelf — what's loved in {label}</Kicker>

      <div style={{ display: "flex", gap: 6, margin: "8px 0 12px", flexWrap: "wrap" }}>
        {CATS.map((c) => (
          <Pill key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
            <span style={{ marginRight: 4 }}>{c.icon}</span>
            {c.label}
          </Pill>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <Kicker>Most-loved {active.label.toLowerCase()} · {label}</Kicker>
        {popular.length === 0 ? (
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
          >
            Popularity across {label} appears here once enough people
            share their {active.label.toLowerCase()}.
          </div>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {popular.map((item, i) => (
              <div
                key={item.name}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span
                  className="fig-num"
                  style={{ fontSize: 16, width: 22, textAlign: "right", flexShrink: 0 }}
                >
                  <em>{i + 1}</em>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 14,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </div>
                  <div className="bar" style={{ marginTop: 3 }}>
                    <i style={{ width: `${(item.count / maxCount) * 100}%`, background: accent }} />
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                    flexShrink: 0,
                  }}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ borderLeft: `3px solid ${accent}` }}>
        <Kicker>Your {active.label.toLowerCase()}</Kicker>
        {yourItems.length === 0 ? (
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
          >
            Add your favourite {active.label.toLowerCase()} in your
            profile to see them here.
          </div>
        ) : (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
          >
            {yourItems.map((it, i) => (
              <span key={i} className="pill">
                {it}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
