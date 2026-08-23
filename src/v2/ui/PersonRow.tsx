// One person, drawn one way, everywhere the app offers you somebody
// (D239).
//
// Three surfaces list people you might add: the create picker, add-to-a-
// circle, and the search overlay's people section. They take different
// ACTIONS — add, invite, follow — and they were drawing the same subject
// three different ways, which is how a name ends up bold in one list and
// grey in another for no reason a reader could name.
//
// So the row is shared and the action is a slot. `onClick` makes the
// whole row the control, which is what a list of choices wants: a person
// is a target the size of a row, not the size of the word beside them.
import React from "react";
import { atHandle } from "../data/handles";
import Avatar from "./Avatar";

const PR_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

export default function PersonRow({ uid, name, handle, onClick, disabled, children }: {
  uid: string;
  name: string;
  /** Their handle, when one is known. Absent is ordinary — not everybody claims one. */
  handle?: string;
  /** Makes the whole row the control. Omit for a row that only carries `children`. */
  onClick?: () => void;
  disabled?: boolean;
  /** The action, when the row itself is not it. */
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <Avatar uid={uid} name={name} size={34} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700,
          letterSpacing: "-0.015em", color: "var(--ink)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name || "Someone"}
        </span>
        {handle && (
          <span style={{ fontFamily: "var(--mono, monospace)", fontSize: 11.5, fontWeight: 600,
            color: "var(--ink-3)" }}>{atHandle(handle)}</span>
        )}
      </span>
      {children}
    </>
  );
  const box: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
    background: "var(--surface)", border: PR_LINE, borderRadius: 13,
    width: "100%", boxSizing: "border-box",
  };
  if (!onClick) return <div style={box}>{inner}</div>;
  return (
    <button className="press" onClick={onClick} disabled={disabled}
      style={{ ...box, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
        WebkitAppearance: "none", font: "inherit" }}>
      {inner}
    </button>
  );
}
