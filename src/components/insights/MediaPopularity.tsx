// MediaPopularity — "what's loved in {scope}" shelf. Ported from the
// prototype, wired to real data only. Your own favourites come from
// profile.media (real). The per-scope "most-loved" podium has no
// backend yet — there's no Cloud Function tallying media across the
// userbase — so that half renders an honest empty state instead of
// fabricated rankings. When the aggregator lands, the scope side
// drops in without touching the rest.

import { useState } from "react";
import { useProfile } from "../../lib/useProfile";
import { Kicker, Pill } from "../shared/primitives";
import type { MediaKey } from "../../types";

const CATS: { key: MediaKey; label: string; icon: string }[] = [
  { key: "music", label: "Music", icon: "♪" },
  { key: "film", label: "Films", icon: "◐" },
  { key: "books", label: "Books", icon: "▢" },
  { key: "podcasts", label: "Podcasts", icon: "✦" },
];

interface MediaPopularityProps {
  label: string;
  accent?: string;
}

export function MediaPopularity({
  label,
  accent = "var(--accent)",
}: MediaPopularityProps) {
  const { profile } = useProfile();
  const media = profile.media ?? null;
  const [cat, setCat] = useState<MediaKey>("music");
  const active = CATS.find((c) => c.key === cat)!;
  const yourItems = media?.[cat] ?? [];

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
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
        >
          Popularity across {label} appears here once enough people
          share their media — the aggregator isn't live yet.
        </div>
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
