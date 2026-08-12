// The Mirror's lens row as real tabs, for the live bodies (D119).
//
// Ported from the spec layer's `MirrorLensRow` (spec/mirror-field.jsx, nav
// v2) rather than imported from it, for two reasons that both matter:
// mirror-field.jsx carries the whole demo field — canvas, node layout,
// mirror-field-pops' invented people — so importing it would pull all of
// that into the live chunk for twenty lines of markup; and the live
// bodies are typed TSX, where D39's ratchet says new code belongs.
//
// The CSS is NOT duplicated. `.mm-lensrow` / `.mm-lensbtn` /
// `.mm-lensthumb` are already in styles.css with their three
// `data-lens-style` variants (segmented · underline · chips, chosen by the
// tweak on `.app`), so the live row inherits the demo row's look and every
// future change to it, exactly once.
//
// WHAT CHANGED WHEN THIS ARRIVED. The live cohort stops used to draw their
// answer rows inline with a COLLAPSED lens strip underneath, so "Answers"
// was the page and everything else was a drawer under it. The prototype
// makes Answers a peer tab of the rest, which is the layout this row
// exists for. The cost gate the collapsed strip was carrying survives
// unchanged and for free: a tab body mounts only while its tab is open, so
// People still pays for voter lists only when someone asks for People.
import React from "react";
// Shape and labels next door, so this file exports only its component —
// see lensTabs.ts for why that split is load-bearing and not cosmetic.
import type { LensTab } from "./lensTabs";

function MirrorLensTabs({ tabs, open, onOpen }: {
  tabs: LensTab[];
  open: string;
  onOpen: (id: string) => void;
}) {
  const idx = tabs.findIndex((t) => t.id === open);
  // Six stops have to fit a phone without clipping, and the row never
  // scrolls — the prototype's numbers, kept because the widths they were
  // measured against are the same CSS.
  const fs = tabs.length >= 6 ? 11.5 : tabs.length === 5 ? 13 : 14.5;
  return (
    <div className="mm-lensrow mm-lensrow-top" role="tablist" aria-label="Lenses"
      style={{ "--n": tabs.length } as React.CSSProperties}>
      {/* The sliding indicator. `is-off` rather than unmounted so it fades
          instead of jumping when nothing is selected — a state this row
          cannot reach today (one tab is always open) but the shared CSS
          still defines. */}
      <span className={"mm-lensthumb" + (idx < 0 ? " is-off" : "")} aria-hidden="true"
        style={{ transform: `translateX(${Math.max(0, idx) * 100}%)` }}></span>
      {tabs.map((t) => (
        <button key={t.id} data-lens={t.id} role="tab" aria-selected={open === t.id}
          className={"mm-lensbtn" + (open === t.id ? " is-on" : "")}
          style={{ fontSize: fs, padding: "10px 3px" }}
          onClick={() => onOpen(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export default MirrorLensTabs;
