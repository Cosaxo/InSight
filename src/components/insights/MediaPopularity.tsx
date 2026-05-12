import { useState } from "react";
import { IS_DATA } from "../../data/seedData";
import { Kicker, Pill } from "../shared/primitives";

interface MediaPopularityProps {
  scope: "around" | "city" | "world" | "circle";
  accent?: string;
}

type MediaCat = "films" | "books" | "music" | "people";

interface YourMediaItem {
  title: string;
  rating: number;
  artist?: string;
}

export function MediaPopularity({
  scope,
  accent = "var(--accent)",
}: MediaPopularityProps) {
  const M = IS_DATA.media;
  const top = M?.topByScope?.[scope];
  const overlap = M?.aggregates?.[scope];
  const yourFaves = M?.you;
  const [cat, setCat] = useState<MediaCat>("films");

  if (!top) return null;

  const cats: { key: MediaCat; label: string; icon: string }[] = [
    { key: "films", label: "Films", icon: "◐" },
    { key: "books", label: "Books", icon: "▢" },
    { key: "music", label: "Music", icon: "♪" },
    { key: "people", label: "People", icon: "✦" },
  ];

  const popularItems: string[] = top[cat] || [];
  const yourItems: YourMediaItem[] = yourFaves?.[cat] || [];

  const scopeBlurb =
    scope === "around"
      ? "near you"
      : scope === "city"
        ? "in Oslo"
        : scope === "world"
          ? "in the world"
          : "in your circle";
  const podiumBlurb =
    scope === "around"
      ? "in your 5km"
      : scope === "city"
        ? "in Oslo"
        : scope === "world"
          ? "globally"
          : "among friends";

  return (
    <div>
      <Kicker>The shelf — what's loved {scopeBlurb}</Kicker>

      <div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 12 }}>
        {cats.map((c) => (
          <Pill key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
            <span style={{ marginRight: 4 }}>{c.icon}</span>
            {c.label}
          </Pill>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="margin-note" style={{ marginBottom: 10 }}>
          most-loved {cat} {podiumBlurb}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {popularItems.map((title, i) => {
            const youHave = yourItems.find(
              (it) =>
                it.title === title ||
                (it.artist && title.includes(it.artist.split(" ")[0])),
            );
            const hue = [38, 145, 220][i] ?? 38;
            const isPerson = cat === "people";
            return (
              <div
                key={title}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 12px",
                  background:
                    i === 0 ? `oklch(0.96 0.03 ${hue})` : "var(--paper-2)",
                  border: `0.5px solid oklch(0.82 0.06 ${hue})`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 22,
                    color: `oklch(0.45 0.12 ${hue})`,
                    width: 24,
                    textAlign: "center",
                  }}
                >
                  {i + 1}
                </div>
                {isPerson ? (
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: `oklch(0.85 0.06 ${hue})`,
                      border: `0.75px solid oklch(0.55 0.12 ${hue})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 14,
                      color: `oklch(0.30 0.13 ${hue})`,
                    }}
                  >
                    {title
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 42,
                      flexShrink: 0,
                      background: `oklch(0.85 0.06 ${hue})`,
                      border: `0.5px solid oklch(0.55 0.12 ${hue})`,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 15,
                      color: `oklch(0.30 0.13 ${hue})`,
                    }}
                  >
                    {title[0]}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 14,
                      lineHeight: 1.2,
                    }}
                  >
                    {title}
                  </div>
                  {youHave ? (
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        color: accent,
                        letterSpacing: "0.06em",
                        marginTop: 2,
                      }}
                    >
                      {isPerson ? "YOU ADMIRE THEM" : "ON YOUR SHELF"} ·{" "}
                      {youHave.rating}★
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        color: "var(--ink-3)",
                        letterSpacing: "0.06em",
                        marginTop: 2,
                      }}
                    >
                      {isPerson ? "NEW TO YOU" : "NOT ON YOUR SHELF"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {yourItems.length > 0 && overlap && overlap[cat] && (
        <div className="card">
          <Kicker>How your faves are received</Kicker>
          <div className="margin-note" style={{ marginTop: 4, marginBottom: 12 }}>
            % of {overlap.label} who'd give it 4★+
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {yourItems.slice(0, 4).map((it) => {
              const pct = overlap[cat][it.title] || 0;
              return (
                <div key={it.title}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--serif)",
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontStyle: "italic" }}>{it.title}</span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--ink-3)",
                      }}
                    >
                      you {it.rating}★ · {pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: "var(--paper-2)",
                      border: "0.5px solid var(--rule)",
                      borderRadius: 3,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pct}%`,
                        background: accent,
                        opacity: 0.65,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
