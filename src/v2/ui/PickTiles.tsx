// PickTiles — the catalogue as tappable tiles on the pick card (D308, paged
// at D389). The owner's reference sheet draws the browse row — patterned
// cards under the search field — and a search-only ask kept the whole
// catalogue invisible until you already knew what to type. The tiles are
// the catalogue in its file's own order, so browsing costs no read and
// invents no ranking: the sitelink-ranked domains lead with their famous
// few, the alphabetical ones with A, the Pokédex with #1.
//
// PAGED, because the catalogues run to a thousand rows and a row of a
// thousand tiles is a thousand DOM nodes on every unanswered card in the
// feed. The first page draws at once; the rest arrives as you reach the
// end of the row — an IntersectionObserver on the last tile, rooted in the
// row so it fires on the row's own scroll and never on the page's — or on
// a tap of that tile, which is the same door for a keyboard and for an
// environment with no observer. The tile says how many are still to come.
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
  /** The key as a fact worth showing — "#25" on a Pokémon, "#79" on gold. */
  tag?: string;
}

// One page of the row. Eight is the head D308 shipped; a page is what the
// sentinel appends, so the row grows by the same step it opened with.
export const PICK_TILE_PAGE = 8;

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

const TILE_W = 92;
const FACE_H = 74;
const faceBase: React.CSSProperties = {
  height: FACE_H, borderRadius: 13,
  border: "1px solid color-mix(in oklch, var(--rule), transparent 25%)",
  overflow: "hidden",
};
const captionBase: React.CSSProperties = {
  display: "block", marginTop: 5, fontFamily: "var(--sans)",
  fontWeight: 700, fontSize: 11.5, lineHeight: 1.25, color: "var(--ink-2)",
  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
};
const tileBase: React.CSSProperties = {
  flex: "0 0 auto", width: TILE_W, border: "none", background: "none",
  padding: 0, cursor: "pointer", WebkitAppearance: "none", textAlign: "left",
};

export default function PickTiles({ domain, entries, accent, onPick, page = PICK_TILE_PAGE }: {
  domain: string;
  entries: PickTileEntry[];
  accent: string;
  onPick: (id: number) => void;
  /** Tiles per page — the test's knob; the app takes the default. */
  page?: number;
}) {
  const [shown, setShown] = React.useState(page);
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const moreRef = React.useRef<HTMLButtonElement | null>(null);
  const rest = Math.max(0, entries.length - shown);

  // The next page arrives when the "more" tile scrolls into the row.
  // Rooted in the ROW: the row is a horizontal scroller inside a vertical
  // one, and a viewport-rooted observer would fire for every card that
  // scrolled past on the page whether or not its row had been touched —
  // the whole catalogue, one page per frame, for a reader who never
  // looked. Re-armed per page (`rest` moves with every page) because the
  // tile it watches moves right each time.
  React.useEffect(() => {
    const el = moreRef.current;
    if (!el || rest <= 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setShown((s) => s + page);
    }, { root: rowRef.current, rootMargin: "0px 120px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [rest, page]);

  if (!entries.length) return null;
  return (
    // .h-scroll: the row owns its horizontal motion (swipe-back's OWNS_X),
    // or dragging through the tiles would slide the daily's mode axis.
    <div ref={rowRef} className="h-scroll" style={{ display: "flex", gap: 9, overflowX: "auto", padding: "2px 1px 6px", WebkitOverflowScrolling: "touch" }}>
      {entries.slice(0, shown).map((e) => {
        const face = domain === "colors"
          ? { background: colorCss(e.id) }
          : domain === "emoji"
            ? { background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" as const }
            : patternStyle(e.id, accent);
        const caption = domain === "emoji" ? e.name.slice(emojiGlyph(e.name).length).trim() || e.name : e.name;
        return (
          <button
            key={e.id}
            onClick={() => onPick(e.id)}
            aria-label={e.name}
            style={tileBase}
          >
            <span aria-hidden="true" data-tile-face={domain === "colors" ? "color" : domain === "emoji" ? "emoji" : "pattern"} style={{
              ...faceBase,
              display: domain === "emoji" ? "flex" : "block",
              fontSize: 34, alignItems: "center", justifyContent: "center",
              ...face,
            }}>{domain === "emoji" ? emojiGlyph(e.name) : ""}</span>
            <span style={captionBase}>
              {caption}
              {/* the key, where it is the order: "#25" is why Pikachu sits
                  where it does, and a dex row without it reads as arbitrary */}
              {e.tag ? <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>{" " + e.tag}</span> : null}
            </span>
          </button>
        );
      })}
      {rest > 0 && (
        // The sentinel and the door in one tile: the observer above fires
        // on it as it scrolls in, and a tap does the same — for a keyboard,
        // for a reduced-motion reader who scrolls by button, and for the
        // test environment, where no observer ever fires (setup-dom.ts).
        <button
          ref={moreRef}
          type="button"
          data-tile-more=""
          onClick={() => setShown((s) => s + page)}
          aria-label={`${rest} more`}
          style={tileBase}
        >
          <span aria-hidden="true" style={{
            ...faceBase, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            background: `color-mix(in oklch, ${accent} 7%, var(--surface-2))`,
            borderStyle: "dashed",
            fontFamily: "var(--sans)", color: "var(--ink-2)",
          }}>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>+{rest.toLocaleString()}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)" }}>more</span>
          </span>
          <span aria-hidden="true" style={{ ...captionBase, color: "var(--ink-3)", fontWeight: 600 }}>{" "}</span>
        </button>
      )}
    </div>
  );
}
