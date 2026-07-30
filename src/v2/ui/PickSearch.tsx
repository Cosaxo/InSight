// PickSearch — the `pick` card's search field (docs/CATALOG-QUESTIONS.md).
//
// The CityPicker interaction restyled to the feed: a collapsed button that
// opens into a combobox over the shipped catalogue, keyboard and outside-tap
// behaviour intact. What it hands back is a Species — the caller stores the
// dex number, never the name. "Not listed" is pinned under the results as
// its own honest answer, not a free-text escape hatch: the moment it
// dominates a domain the catalogue is stale, and nobody gets to type.
//
// Born in this repo, so typed TSX like CityPicker; the globalThis
// assignment at the bottom keeps the spec layer's render-time lookup
// working from world-feed.jsx.
import React from "react";
import POKEDEX, { type Species } from "../data/pokedex";

const PS_LINE = "1px solid var(--rule)";

export type PickSearchProps = {
  /** Topic hue — the card's T.color, so the field sits in its card. */
  accent: string;
  big?: boolean;
  onPick: (s: Species) => void;
  onNotListed: () => void;
};

function PickSearch({ accent, big, onPick, onNotListed }: PickSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [species, setSpecies] = React.useState<Species[] | null>(() => POKEDEX.peek());
  const [err, setErr] = React.useState<string | null>(null);
  const [hi, setHi] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  // Fetch on first open, never on mount — the catalogue is ~13 KB but the
  // feed renders many cards, and most scrolls never open this one.
  React.useEffect(() => {
    if (!open || species) return;
    let live = true;
    setErr(null);
    POKEDEX.load().then(
      (s) => { if (live) setSpecies(s); },
      (e) => { if (live) setErr(String((e instanceof Error && e.message) || e)); },
    );
    return () => { live = false; };
  }, [open, species]);

  // Close on an outside tap — same reasoning as CityPicker: on touch there
  // is no blur to rely on.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const results = React.useMemo(
    () => (species ? POKEDEX.search(species, q, 40) : []),
    [species, q],
  );
  React.useEffect(() => { setHi(0); }, [q]);

  const pick = (s: Species) => {
    setOpen(false);
    setQ("");
    onPick(s);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => {
        const n = results.length;
        if (!n) return 0;
        return (h + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[hi]) pick(results[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const base: React.CSSProperties = {
    fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)",
    border: `1px solid color-mix(in oklch, ${accent} 45%, var(--rule))`,
    borderRadius: 12, outline: "none", WebkitAppearance: "none",
    appearance: "none", boxSizing: "border-box", width: "100%", minWidth: 0,
    fontSize: big ? 16 : 15, padding: big ? "13px 14px" : "10px 12px",
  };

  if (!open) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: big ? 10 : 8 }}>
        <button type="button" className="press" onClick={() => setOpen(true)}
          aria-haspopup="listbox" aria-expanded={false} aria-label="Search the Pokédex"
          style={{ ...base, cursor: "pointer", textAlign: "left", fontWeight: 600, color: "var(--ink-3)" }}>
          Search the Pokédex…
        </button>
        <span style={{ alignSelf: "center", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)" }}>
          one pick from 1,025 — the crowd's canon reveals after
        </span>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
        role="combobox" aria-expanded aria-controls="picksearch-list" aria-autocomplete="list"
        aria-label="Search the Pokédex" placeholder="Search the Pokédex…" style={base} />
      <div role="listbox" id="picksearch-list" style={{
        position: "absolute", zIndex: 40, left: 0, right: 0, top: "calc(100% + 4px)",
        maxHeight: 280, overflowY: "auto", background: "var(--surface)",
        border: PS_LINE, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
      }}>
        {err && (
          <div style={{ padding: "12px 13px", fontSize: 13, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>
            Couldn&apos;t load the catalogue. Close and try again.
          </div>
        )}
        {!err && !species && (
          <div style={{ padding: "12px 13px", fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }}>Loading…</div>
        )}
        {!err && species && !results.length && (
          <div style={{ padding: "12px 13px", fontSize: 13, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
            No match in the Pokédex — every species is in here, so check the
            spelling, or answer &quot;not listed&quot; below.
          </div>
        )}
        {!err && results.map((s, i) => (
          <button key={s.dex} type="button" role="option" aria-selected={i === hi}
            onPointerEnter={() => setHi(i)}
            // pointerdown, not click — the outside-tap handler above runs on
            // pointerdown and would close the list before click fired.
            onPointerDown={(e) => { e.preventDefault(); pick(s); }}
            style={{
              display: "block", width: "100%", textAlign: "left", cursor: "pointer",
              border: "none", borderBottom: PS_LINE, padding: "9px 13px",
              fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)",
              background: i === hi ? "var(--surface-2)" : "transparent",
            }}>
            {s.name}
            <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>
              {"  ·  "}#{s.dex}
            </span>
          </button>
        ))}
        <button type="button"
          onPointerDown={(e) => { e.preventDefault(); setOpen(false); setQ(""); onNotListed(); }}
          style={{
            display: "block", width: "100%", textAlign: "left", cursor: "pointer",
            border: "none", padding: "10px 13px", position: "sticky", bottom: 0,
            fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 700, color: "var(--ink-2)",
            background: "var(--surface-2)",
          }}>
          Not listed
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 2 }}>
            counts as its own answer — never free text
          </span>
        </button>
      </div>
    </div>
  );
}

// Render-time lookup bridge for the spec layer (world-feed.jsx).
Object.assign(globalThis, { PickSearch });

export default PickSearch;
