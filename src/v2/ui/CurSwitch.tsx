// CurSwitch — € · kr · $: the one currency preference, as a control
// (data/pricing.ts holds the store; this is its only UI).
//
// Its own module rather than a corner of AskedByYouOverlay because two
// LAZY surfaces render it — the buyer's room (React.lazy in app-shell)
// and the ask-a-question door (the loadOverlays group) — and an import
// between those chunks would weld them together: whichever loaded first
// would drag the other's whole module along for one 30-line control.
// Here both chunks share this file and nothing else.
import React from "react";
import { cur, currencies, setCur, subscribeCur } from "../data/pricing";

// Local, not exported: a hook beside a component export trips
// react-refresh/only-export-components, and the consumers each carry
// their own three-line subscribe anyway (the store is the shared part).
const useCur = (): void => {
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => subscribeCur(bump), []);
};

/** € · kr · $ — one preference, persisted, read everywhere a price prints. */
export function CurSwitch(): React.ReactElement | null {
  useCur();
  const list = currencies();
  if (list.length < 2) return null;
  return (
    <span style={{ display: "inline-flex", gap: 2, border: "0.5px solid var(--rule)", borderRadius: 999, padding: 2, background: "var(--surface-2)", flexShrink: 0 }}>
      {list.map((c) => {
        const on = cur() === c;
        return (
          <button key={c} className="press" onClick={() => setCur(c)} aria-pressed={on} aria-label={`Prices in ${c}`}
            style={{ border: "none", cursor: "pointer", WebkitAppearance: "none", borderRadius: 999, padding: "3px 9px", fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 800, background: on ? "var(--ink)" : "transparent", color: on ? "var(--surface)" : "var(--ink-3)", transition: "background .16s, color .16s" }}>
            {c === "EUR" ? "€" : c === "NOK" ? "kr" : c === "USD" ? "$" : c}
          </button>
        );
      })}
    </span>
  );
}
