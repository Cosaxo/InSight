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
// `.mm-lensthumb` are already in styles.css under the underline
// `data-lens-style` (the v28 teardown settled the three variants, §10), so
// the live row inherits the demo row's look and every future change to it,
// exactly once.
//
// AND IT IS THE BOTTOM VARIANT, `.mm-lensrow` (D188). This file shipped
// with `.mm-lensrow-top` from D119, which is the class the prototype uses
// for the row it promotes to the TOP of a stop — so its hairline draws
// UNDER the labels and its buttons stand 46px rather than 44. Both live
// callers put the row at the bottom of the screen, where the prototype
// draws the plain class: the rule sits ABOVE the labels, closing the field
// off, and the labels are the last ink before the tab bar. On a stop that
// is otherwise identical to the prototype's, a rule on the wrong side of
// the row is the whole difference between a tab bar and a stray caption.
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
// R2/D253: the tap that opens a lens is exactly the cost gate D136 built
// — a body exists only while its tab is open — so it is also the honest
// count of "does anyone open People". A no-op until initLive arms it.
import { note, type SKey } from "../data/engagement";

const LENS_NOTE: Partial<Record<string, SKey>> = {
  people: "lensPeople", compare: "lensCompare", explore: "lensExplore", scores: "lensScores",
};

function MirrorLensTabs({ tabs, open, onOpen }: {
  tabs: LensTab[];
  open: string;
  onOpen: (id: string) => void;
}) {
  const idx = tabs.findIndex((t) => t.id === open);
  // The row never scrolls: every tab is `flex: 1` of an equal share, so a
  // label that does not fit is a label that wraps or clips rather than one
  // you can reach by swiping.
  //
  // The prototype's ladder stopped at six ("six stops have to fit a phone
  // without clipping") and this file inherited it as `>= 6`, which quietly
  // absorbed a SEVENTH when Foresight arrived (D126) — seven tabs drawn at
  // the size six were measured at, on the same fixed width. That was the
  // cramping the D135 report was about, and the `>= 6` is why it never
  // showed up as a change to anything.
  //
  // D136 took the row back to FIVE — Answers plus four lenses, the
  // constellation having moved above the row and Foresight off the Mirror
  // — so the rung that binds today is `=== 5 → 13`. The 6 and 7 rungs stay
  // rather than being deleted with the tabs that needed them: they cost
  // two comparisons, and the row's whole failure mode is a section being
  // added without anyone re-measuring the width it has to fit in. 10.5 at
  // seven remains measured, not guessed — at 320 CSS px each of seven tabs
  // gets ~45px inside the row's padding, "Foresight" needs ~52px at 11.5
  // semibold and clips, ~47px at 10.5, and the 3px padding below absorbs
  // the rest.
  const fs = tabs.length >= 7 ? 10.5 : tabs.length === 6 ? 11.5 : tabs.length === 5 ? 13 : 14.5;
  return (
    <div className="mm-lensrow" role="tablist" aria-label="Lenses"
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
          onClick={() => {
            const k = LENS_NOTE[t.id];
            if (k) note(k); // Answers is the landing tab, not a tap worth counting
            onOpen(t.id);
          }}>{t.label}</button>
      ))}
    </div>
  );
}

export default MirrorLensTabs;
