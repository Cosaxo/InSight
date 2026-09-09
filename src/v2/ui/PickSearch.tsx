// PickSearch — the `pick` card's search field (docs/CATALOG-QUESTIONS.md).
//
// The CityPicker interaction restyled to the feed: a collapsed button that
// opens into a combobox over the shipped catalogue, keyboard and outside-tap
// behaviour intact. What it hands back is the entry's numeric KEY — the
// caller stores the key, never the name. "Not listed" is pinned under the
// results as its own honest answer, not a free-text escape hatch: the
// moment it dominates a domain the catalogue is stale, and nobody gets to
// type.
//
// One component, every shipped catalogue — the table is `pickDomains.ts`
// (pokemon, films and artists first, D15; the rest as each domain was
// committed), shared with the browse row so the two doors on a card can
// never disagree about which catalogue a domain names.
//
// Born in this repo, so typed TSX like CityPicker; world-feed.jsx imports
// it (the globalThis publication it once carried went with D354's sweep).
import React from "react";
import { DOMAINS, type Row } from "./pickDomains";

const PS_LINE = "1px solid var(--rule)";

export type PickSearchProps = {
  /** Catalogue domain — a key of pickDomains' DOMAINS table. */
  domain: string;
  /** Topic hue — the card's T.color, so the field sits in its card. */
  accent: string;
  big?: boolean;
  onPick: (id: number) => void;
  onNotListed: () => void;
};

function PickSearch({ domain, accent, big, onPick, onNotListed }: PickSearchProps) {
  const spec = DOMAINS[domain] || DOMAINS.pokemon;
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<Row[] | null>(() => spec.peek());
  const [err, setErr] = React.useState<string | null>(null);
  const [hi, setHi] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  // Fetch on first open, never on mount — the feed renders many cards,
  // and most scrolls never open this one.
  React.useEffect(() => {
    if (!open || rows) return;
    let live = true;
    setErr(null);
    spec.load().then(
      (r) => { if (live) setRows(r); },
      (e) => { if (live) setErr(String((e instanceof Error && e.message) || e)); },
    );
    return () => { live = false; };
  }, [open, rows, spec]);

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
    () => (rows ? spec.search(q, 40) : []),
    [rows, q, spec],
  );
  React.useEffect(() => { setHi(0); }, [q]);

  const pick = (r: Row) => {
    setOpen(false);
    setQ("");
    onPick(r.id);
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
    } else if (e.key === "Escape" && open) {
      // See CityPicker: swallow Escape only while the list is open, so the
      // enclosing dialog still gets it once there is nothing here to close.
      e.stopPropagation();
      setOpen(false);
    }
  };

  const base: React.CSSProperties = {
    fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)",
    border: `1px solid color-mix(in oklch, ${accent} 45%, var(--rule))`,
    borderRadius: 12, outline: "none", WebkitAppearance: "none",
    appearance: "none", boxSizing: "border-box", width: "100%", minWidth: 0,
    fontSize: "var(--field-size)", padding: big ? "13px 14px" : "10px 12px",
  };

  if (!open) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: big ? 10 : 8 }}>
        <button type="button" className="press" onClick={() => setOpen(true)}
          aria-haspopup="listbox" aria-expanded={false} aria-label={spec.placeholder}
          style={{ ...base, cursor: "pointer", textAlign: "left", fontWeight: 600, color: "var(--ink-3)" }}>
          {spec.placeholder}
        </button>
        <span style={{ alignSelf: "center", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)" }}>
          {spec.hint}
        </span>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      {/* aria-activedescendant, or `hi` is a background colour and nothing
          more: a screen-reader user hears nothing as the highlight moves,
          and since `hi` starts at 0 and resets to 0 on every keystroke,
          Enter with no arrow presses commits results[0] — an entity whose
          name was never announced, permanent under D5. */}
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
        role="combobox" aria-expanded aria-controls="picksearch-list" aria-autocomplete="list"
        aria-activedescendant={results[hi] ? `picksearch-opt-${results[hi].id}` : undefined}
        aria-label={spec.placeholder} placeholder={spec.placeholder} style={base} />
      <div role="listbox" id="picksearch-list" style={{
        position: "absolute", zIndex: 40, left: 0, right: 0, top: "calc(100% + 4px)",
        maxHeight: 280, overflowY: "auto", background: "var(--surface)",
        border: PS_LINE, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
      }}>
        {err && (
          <div role="status" style={{ padding: "12px 13px", fontSize: 13, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>
            Couldn&apos;t load the catalogue. Close and try again.
          </div>
        )}
        {!err && !rows && (
          <div role="status" style={{ padding: "12px 13px", fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }}>Loading…</div>
        )}
        {!err && rows && !results.length && (
          <div role="status" style={{ padding: "12px 13px", fontSize: 13, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
            {spec.noMatch}
          </div>
        )}
        {!err && results.map((r, i) => (
          <button key={r.id} type="button" role="option" id={`picksearch-opt-${r.id}`}
            aria-selected={i === hi}
            onPointerEnter={() => setHi(i)}
            // preventDefault on pointerdown, ACT on click. The outside-tap
            // handler above runs on pointerdown and would close the list
            // before click fired — hence the first half. But acting there
            // too made these controls dead to the keyboard and to assistive
            // tech, which activate by dispatching a synthesized CLICK and
            // never a pointer event. Mouse and touch still emit both, in
            // this order, so the pointer path is unchanged.
            onPointerDown={(e) => { e.preventDefault(); }}
            onClick={() => pick(r)}
            style={{
              display: "block", width: "100%", textAlign: "left", cursor: "pointer",
              border: "none", borderBottom: PS_LINE, padding: "9px 13px",
              fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)",
              background: i === hi ? "var(--surface-2)" : "transparent",
            }}>
            {r.name}
            {r.tag && (
              <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>
                {"  ·  "}{r.tag}
              </span>
            )}
          </button>
        ))}
        {/* "Not listed" is the one control here with no keyboard-reachable
            equivalent, and this component's own copy sends users to it —
            "this is a curated top list… 'Not listed' below is a real
            answer". Same split as the options above. */}
        <button type="button"
          onPointerDown={(e) => { e.preventDefault(); }}
          onClick={() => { setOpen(false); setQ(""); onNotListed(); }}
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

export default PickSearch;
