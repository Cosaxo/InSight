// The empty constellation — the rings, and you at the centre (D171).
//
// D160 established that an empty field is still a field: every arm of
// LiveSimilarityField used to REPLACE the drawing with a paragraph when it
// had nobody to place, which reads as a screen that was never built rather
// than one that is empty, and hides the grammar the whole tab is written
// in from exactly the reader who has not learned it.
//
// D171 finishes that thought at the two stops D160 could not reach. Circle
// and Groups answered an empty account with a card of prose — "You follow
// nobody yet", "No groups yet" — while City, Country, World and Near all
// drew the field. Same stop row, two different ideas of what empty looks
// like, and the two wordiest ones were the stops a new account sees first.
//
// WHY THIS IS ITS OWN MODULE rather than an export from
// LiveSimilarityField, which already draws exactly this. That file is the
// whole similarity engine — the folds, the layout, the place profiles —
// and it is LAZY for that reason. `LiveGroupsMirrorBody` is a STATIC
// import in mirror-tab.jsx, so importing the field from it would drag the
// engine into the first-paint graph, and `MAX_EAGER_KB` has roughly a
// dozen kilobytes left (check:bundle). Forty lines duplicated beats a
// chunk moved: this has no data behind it at all.
//
// NOTHING HERE IS FABRICATED, which is the rule the drawing has to keep to
// be allowed on a live screen. "You, and nobody placed around you yet" is
// the true picture node for node; the rings are the scale a radius will be
// read on once someone arrives. No mist, no placeholder people — the
// prototype does the same (`MFSparse` sits UNDER `MFCanvas`, never instead
// of it).
import React from "react";

/**
 * The rings and you, with a caption underneath.
 *
 * `aria-hidden` on the drawing and the real sentence in the caption: there
 * is nothing to tap and nothing to read out here, so a screen reader
 * should get the words, not a group role wrapping an empty field.
 */
export default function EmptyField({ caption, children }: {
  /** Short label directly under the rings — the field's own name. */
  caption?: React.ReactNode;
  /** The sentence saying what will fill it. */
  children?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "6px 0 2px" }}>
      <svg viewBox="-170 -170 340 340" aria-hidden="true"
        style={{ width: "100%", maxHeight: 350, display: "block" }}>
        {[64, 101, 138].map((r, i) => (
          <circle key={r} cx={0} cy={0} r={r} fill="none"
            stroke="color-mix(in oklch, var(--rule), transparent 30%)"
            strokeWidth={1} strokeDasharray={i === 2 ? "3 5" : undefined} />
        ))}
        <circle cx={0} cy={0} r={30} fill="color-mix(in oklch, var(--accent) 14%, var(--surface-2))" />
        <circle cx={0} cy={0} r={23} fill="var(--ink)" />
        <text x={0} y={0} dy="0.36em" textAnchor="middle"
          style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 800, fill: "var(--surface)" }}>you</text>
      </svg>
      {caption ? (
        <div style={{ textAlign: "center", padding: "8px 0 0" }}>
          <span style={{ display: "inline-block", border: "1px solid color-mix(in oklch, var(--rule), transparent 25%)", borderRadius: 999, padding: "5px 13px", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, color: "var(--ink-2)" }}>
            {caption}
          </span>
        </div>
      ) : null}
      {children ? (
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "8px 2px 12px", textAlign: "center", maxWidth: 340, margin: "0 auto" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
