// FieldPicker — the app's own menu for a closed vocabulary (D275).
//
// WHAT IT REPLACES. Every profile field with a fixed list of answers —
// gender, education, work, relationship, height, and the three parts of a
// birthday — was a native `<select>`. On iOS that opens the system menu:
// a dark platform sheet in the platform's own type, over an app that is
// neither. Reported from a device, with a screenshot of the education
// list: "should have menus that fit the app". It is the same complaint
// D9 answered for the city field, one control over — a picker is part of
// the app or it is a seam in it.
//
// WHAT IT IS. The collapsed button CityPicker already draws, opening the
// bottom sheet every other list in this app opens — the `Sheet` primitive
// itself, not a copy of it. That is the whole of "fits the app" in one
// import: the same ground, radius, shadow, grab handle, entry and exit
// animations, reduced-motion handling and focus ring, plus the dialog
// semantics D24 gave every sheet (role, aria-modal, Escape, focus trap,
// focus restore), plus Android's back peeling it instead of quitting, plus
// sheet-drag.js's pull-to-dismiss, which works on any `.wf-sheet-grab` in
// the document and therefore on this one. None of that is re-implemented
// here, and none of it can drift from the rest.
//
// What it adds over a `<select>` is what a sheet can do and a native menu
// cannot: the field's name at the top, a row you can hit with a thumb
// (44px, the floor check:tap-targets holds every other control to), and
// the current answer marked rather than merely highlighted.
//
// THE CAPTION IS PART OF THE COMPONENT, and that is not tidiness. A
// `<button>` is a labelable element, so `<label htmlFor>Gender<button/>`
// hands the BUTTON the name "Gender" and the chosen value never reaches a
// screen reader — the exact defect the a11y ratchet found wrapped around
// CityPicker (check-a11y.mjs, 2026-08-03 pass), and the one every one of
// these seven fields was about to acquire the moment its `<select>` became
// a button. Rendering the caption here as a plain `<span>` and pointing
// `aria-labelledby` at it makes the pair impossible to get wrong at a call
// site: the name comes from the caption, the VALUE is the button's own
// text, and a combobox announces both.
//
// PORTALED TO <body>, and that is measured rather than preferred. The spec
// layer's sheets portal to `.app`, because `.wf-scrim` positions absolutely
// and a sheet left in a scrolling card lands at the bottom of the scroll.
// This one cannot use either resting place:
//
//   - In place is not enough even at `position: fixed`. The profile
//     overlay's page-swap wrapper (`.tab-swap`) carries a transform, and a
//     transformed ancestor becomes the containing block for fixed
//     descendants — so the menu opened from the Basics card measured itself
//     against a 2215px-tall scroll container and drew 480px above the top
//     of the screen. Seen in a browser, not reasoned about.
//   - `.app` is not enough either, because the account-setup screen is a
//     root of its own on <body> ABOVE `.app` (z-index 39), and a menu
//     portaled into the app would open underneath the screen that asked
//     for it.
//
// <body> is the one host both call sites share, and the palette lives on
// `:root` while `.wf-sheet`'s own rules are written host-independently, so
// nothing is lost by leaving `.app`.
import React from "react";
import ReactDOM from "react-dom";
// The app's own sheet, from the ported layer. Untyped JSX, so TS reports
// TS7016 at the specifier — the same one-line suppression
// LiveProfileSetup.tsx carries for profile-vitals.js, and for the same
// reason: the alternative is a second sheet that looks like this one until
// the day one of them changes.
// @ts-expect-error TS7016 — untyped spec module
import { Sheet } from "../spec/primitives.jsx";

const FP_LINE = "1px solid var(--rule)";
// The dismiss animation's length (.wf-scrim.is-closing, styles.css §sheets).
// The sheet stays mounted for it — unmounting on the tap would make the
// close instant and the open animated, which reads as a glitch.
const FP_CLOSE_MS = 240;

/** The "nothing chosen" row. Every field here is optional, so unsetting
 *  one has to be reachable — a `<select>` gave that for free through its
 *  empty option, and a list of answers has to say it. */
const FP_NONE = "No answer";

function FpChevron() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="var(--ink-3)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function FpCheck() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export type FieldPickerProps = {
  /** The field's name: the caption above the control, and the sheet's head. */
  title: string;
  /** The chosen option, or "" for none. */
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  /** What the closed control reads while nothing is chosen. */
  placeholder: string;
  /** The caption's own styling — the two call sites label fields differently. */
  captionStyle?: React.CSSProperties;
  /** The closed control's styling — it matches the fields around it. */
  style?: React.CSSProperties;
  /** Only for a caller that needs to name the control (a test, a label). */
  id?: string;
};

function FieldPicker({
  title, value, onChange, options, placeholder, captionStyle, style, id,
}: FieldPickerProps) {
  const auto = React.useId();
  const capId = `${auto}cap`;
  const listId = `${auto}list`;
  const btnId = id || `${auto}btn`;
  const [open, setOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  // The dismiss timer, and the guard against a second one. A REF for the
  // guard rather than `closing`: the second tap can arrive in the same tick
  // as the first, before any re-render has published the new state.
  const shutting = React.useRef(false);
  const timer = React.useRef(0);

  const close = () => {
    if (shutting.current) return;
    shutting.current = true;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      shutting.current = false;
      setClosing(false);
      setOpen(false);
    }, FP_CLOSE_MS);
  };
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const rows = React.useMemo(() => [FP_NONE, ...options], [options]);
  // Read per render rather than once at module scope: this file is imported
  // by an eager spec module, and a module-scope `document` read is the
  // shape that breaks the moment anything imports it outside a browser.
  const sheetHost = typeof document === "undefined" ? null : document.body;

  // Focus the chosen row on open, and bring it into view — the year list is
  // eighty entries long, and a menu that opens at the top of it makes the
  // user scroll to what they already answered.
  //
  // AFTER `Sheet`, which is what makes this the second focus rather than a
  // fight: useDialog focuses the first thing in the sheet (the ✕) from a
  // child's effect, and a child's effects run before its parent's. That
  // ordering is load-bearing, not incidental.
  //
  // Programmatic rather than an `autoFocus` prop, too: the prop is what
  // jsx-a11y counts, and this sheet is opened by the reader's own tap.
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const opts = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    const idx = Math.max(0, rows.indexOf(value || FP_NONE));
    const target = opts[idx] || opts[0];
    if (!target) return;
    target.focus({ preventScroll: true });
    // jsdom has no layout and no scrollIntoView.
    target.scrollIntoView?.({ block: "center" });
  }, [open, rows, value]);

  // Focus back onto the field this opened from, once the sheet is gone.
  //
  // `useDialog` already restores focus to whatever was active when it
  // mounted, and on this control that is not enough: Safari and iOS do not
  // focus a <button> when it is clicked, so the "opener" it captured is
  // <body> — and a keyboard or VoiceOver user who answered one field would
  // be dropped at the top of the form for the next one. An effect rather
  // than a line in the close timer, because it has to run AFTER the
  // unmount and after that restore.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    btnRef.current?.focus({ preventScroll: true });
  }, [open]);

  const pick = (next: string) => {
    onChange(next === FP_NONE ? "" : next);
    close();
  };

  // The arrows, ON THE ROWS. Not on the dialog, whose keyboard contract
  // (Escape, the tab trap, focus restore) belongs to `useDialog` and is
  // spread on by `Sheet`; and not on the listbox either. Both of those are
  // findings the a11y ratchet counts and both are right: a listener on a
  // non-interactive role, and an interactive role that cannot take focus.
  // A row is a <button> — interactive, focusable, and the only thing
  // focused when an arrow key means anything.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const node = listRef.current;
    if (!node) return;
    const opts = [...node.querySelectorAll<HTMLElement>('[role="option"]')];
    if (!opts.length) return;
    const at = opts.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { e.preventDefault(); opts[(i + opts.length) % opts.length].focus(); };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at < 0 ? opts.length - 1 : at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(opts.length - 1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span id={capId} style={captionStyle}>{title}</span>
      <button ref={btnRef} id={btnId} type="button" className="press"
        onClick={() => setOpen(true)}
        // combobox rather than a bare button: the name is the field
        // ("Gender"), the button's own text is the VALUE, and the role is
        // what makes a screen reader read the second as an answer to the
        // first instead of as a second label.
        role="combobox" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={listId} aria-labelledby={capId}
        style={{
          fontFamily: "var(--sans)", fontSize: 15, fontWeight: 600,
          background: "var(--surface)", border: FP_LINE, borderRadius: 11,
          padding: "10px 11px", WebkitAppearance: "none", appearance: "none",
          boxSizing: "border-box", width: "100%", minWidth: 0, minHeight: 44,
          letterSpacing: "normal", textTransform: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8, textAlign: "left",
          ...style,
          // After the spread: a caller styles the FIELD, not the state, and
          // a placeholder that inherited the answered colour would read as
          // an answer.
          color: value ? "var(--ink)" : "var(--ink-3)",
        }}>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder}
        </span>
        <FpChevron />
      </button>

      {open && sheetHost && ReactDOM.createPortal(
        // The host `.wf-scrim` measures itself against — fixed, and above
        // both frames the app puts on <body>: `.native-shell` (z auto) and
        // the account-setup screen (z 39).
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <Sheet onClose={close} closing={closing} label={title}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 16px 8px" }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em", color: "var(--ink)" }}>
                {title}
              </span>
              <button className="tap44" type="button" onClick={close} aria-label="Close"
                style={{ border: "none", background: "var(--surface-2)", width: 26, height: 26,
                  borderRadius: "50%", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  color: "var(--ink-2)", flexShrink: 0 }}>
                ✕
              </button>
            </div>
            <div ref={listRef} id={listId} className="wf-sheet-body" role="listbox"
              aria-label={title}
              // The setup screen is its own root on <body>, outside the
              // `.native-shell` the stylesheet hangs the sheet's home-
              // indicator clearance on — so the scrolling half carries it
              // here, where it is padding under the last row rather than a
              // gap under the sheet.
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
              {rows.map((o) => {
                const on = o === FP_NONE ? !value : o === value;
                const none = o === FP_NONE;
                return (
                  <button key={o} type="button" role="option" aria-selected={on}
                    onClick={() => pick(o)} onKeyDown={onKeyDown}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      minHeight: 44, padding: "10px 6px", cursor: "pointer",
                      border: "none", borderBottom: "0.5px solid var(--rule)",
                      background: "transparent", textAlign: "left",
                      fontFamily: "var(--sans)", fontSize: 15.5,
                      fontWeight: on ? 750 : 550,
                      color: none && !on ? "var(--ink-3)" : "var(--ink)",
                    }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{o}</span>
                    {on && <FpCheck />}
                  </button>
                );
              })}
            </div>
          </Sheet>
        </div>,
        sheetHost,
      )}
    </div>
  );
}

// NO `Object.assign(globalThis, …)`, deliberately, and it is worth saying
// why when the picker beside it has one: the spec layer's other call site
// imports this file (profile-general.jsx), so a publication here would be
// a name nothing reads — the exact residue check:globals rule 5 was added
// to sweep (D137). CityPicker's line stays because its call site still
// looks the name up at render time.
export default FieldPicker;
