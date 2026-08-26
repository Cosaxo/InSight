// PickTiles — the catalogue's head as tappable tiles on the pick card
// (D308). The owner's reference sheet draws the browse row — patterned
// cards under the search field — and a search-only ask kept the whole
// catalogue invisible until you already knew what to type. The tiles are
// the popularity head the catalogue ships anyway, so browsing costs no
// read and invents no ranking.
//
// Entries with no inherent visual wear a GENERATED pattern — dots,
// stripes, rings, a diagonal split — deterministic from the entry's key,
// so a tile keeps its face across sessions and no two neighbours read as
// one. Domains with their own iconography use it instead: emoji draw the
// character itself, colours their own hue. Tapping a tile is exactly the
// search's pick — same key, same path.
import React from "react";

export interface PickTileEntry {
  id: number;
  name: string;
}

// The same integer hash the spec layer's demo folds use (wfHash's shape):
// cheap, stable, and spread enough that neighbouring QIDs land on
// different patterns.
function tileHash(n: number): number {
  let h = 9 ^ n;
  h = Math.imul(h ^ (h >>> 9), 387420489);
  return (h ^ (h >>> 9)) >>> 0;
}

const PATTERNS = 4;

function patternStyle(id: number, accent: string): React.CSSProperties {
  const h = tileHash(id);
  const strong = `color-mix(in oklch, ${accent} ${30 + (h % 3) * 8}%, var(--surface-2))`;
  const soft = `color-mix(in oklch, ${accent} ${10 + ((h >>> 3) % 3) * 4}%, var(--surface-2))`;
  switch (h % PATTERNS) {
    case 0: // dots
      return {
        background: `radial-gradient(circle at 3px 3px, ${strong} 2px, transparent 2.6px) 0 0 / 11px 11px, ${soft}`,
      };
    case 1: // stripes
      return {
        background: `repeating-linear-gradient(45deg, ${strong} 0 5px, ${soft} 5px 13px)`,
      };
    case 2: // diagonal split
      return {
        background: `linear-gradient(135deg, ${strong} 50%, ${soft} 50%)`,
      };
    default: // rings
      return {
        background: `repeating-radial-gradient(circle at 30% 35%, ${strong} 0 3px, ${soft} 3px 12px)`,
      };
  }
}

// An emoji row's name embeds its character ("🔥 fire") — the glyph IS the
// visual, so a generated pattern would be noise over an icon.
function emojiGlyph(name: string): string {
  return name.split(" ")[0] || "";
}

// A colour's key is 1 + its 24-bit hex (build-colors.mjs), so the tile
// can wear the colour itself.
function colorCss(id: number): string {
  return `#${(id - 1).toString(16).padStart(6, "0")}`;
}

export default function PickTiles({ domain, entries, accent, onPick }: {
  domain: string;
  entries: PickTileEntry[];
  accent: string;
  onPick: (id: number) => void;
}) {
  if (!entries.length) return null;
  return (
    // .h-scroll: the row owns its horizontal motion (swipe-back's OWNS_X),
    // or dragging through the tiles would slide the daily's mode axis.
    <div className="h-scroll" style={{ display: "flex", gap: 9, overflowX: "auto", padding: "2px 1px 6px", WebkitOverflowScrolling: "touch" }}>
      {entries.map((e) => {
        const face = domain === "colors"
          ? { background: colorCss(e.id) }
          : domain === "emoji"
            ? { background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" as const }
            : patternStyle(e.id, accent);
        return (
          <button
            key={e.id}
            onClick={() => onPick(e.id)}
            aria-label={e.name}
            style={{
              flex: "0 0 auto", width: 92, border: "none", background: "none",
              padding: 0, cursor: "pointer", WebkitAppearance: "none", textAlign: "left",
            }}
          >
            <span aria-hidden="true" data-tile-face={domain === "colors" ? "color" : domain === "emoji" ? "emoji" : "pattern"} style={{
              display: domain === "emoji" ? "flex" : "block",
              height: 74, borderRadius: 13,
              border: "1px solid color-mix(in oklch, var(--rule), transparent 25%)",
              fontSize: 34, alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              ...face,
            }}>{domain === "emoji" ? emojiGlyph(e.name) : ""}</span>
            <span style={{
              display: "block", marginTop: 5, fontFamily: "var(--sans)",
              fontWeight: 700, fontSize: 11.5, lineHeight: 1.25, color: "var(--ink-2)",
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
            }}>{domain === "emoji" ? e.name.slice(emojiGlyph(e.name).length).trim() || e.name : e.name}</span>
          </button>
        );
      })}
    </div>
  );
}
