// OptionMenu — the app's own menu, where a native <select> used to hand the
// list to the operating system.
//
// WHY. The owner, 2026-09-12, on build 33's profile: *"these default menus
// dont fit the app we should make our own."* A <select> draws its own field
// and gives the LIST away: iOS answers with a dark translucent sheet in the
// OS's type scale over a warm paper app, and ticks the `disabled`
// placeholder as though "Level…" were the education somebody chose. Nothing
// in styles.css reaches inside it — not the font, not the ground, not the
// radius — so the one screen where the app asks who you are is the one
// screen that looks like somebody else's.
//
// NOT A NEW VISUAL LANGUAGE, deliberately (D352 / VISUAL-REQUESTS.md — a new
// overlay family is a design request before it is a build). Every
// measurement here is CityPicker's shipped listbox one control over: the
// same panel on a --rule hairline, the same radius and lift, the same
// anchored placement under the field, the same role="listbox" /
// role="option" pair walked by aria-activedescendant. This is that popup
// applied to controls that already exist on rows that already exist, which
// is the "a control added to a surface that exists" half of the rule.
//
// THREE THINGS THAT LOOK LIKE TASTE AND ARE NOT:
//
//   1. The accessible name is the FIELD's name and never the value. A
//      combobox's value is announced from its own contents; folding the
//      value into the name instead would rename the control on every edit,
//      so "Education" could not be found twice running by a test, or by a
//      voice-control user saying it.
//   2. The placeholder is not a row unless the caller says so. The Basics
//      card's blank-anchors guard (profile-general.jsx) rests on the stated
//      fact that a field "offers no path back to it" — that guard is what
//      stops a mount race erasing an account's anchors — so `clearable`
//      defaults to false and the setup sheet opts in.
//   3. It portals to <body>, not to `.app`. The account-setup sheet mounts
//      into a root of its own appended to the body (profileSetup.tsx), so
//      `.app` is not an ancestor of every caller — and a menu positioned
//      inside a scrolling card is clipped by it. Fixed-position coordinates
//      off the trigger's own rect work from either root.
import React from "react";
import ReactDOM from "react-dom";
import { pushBackLayer } from "../data/backLayers";
// Its own sheet rather than styles.css: every caller is lazy, so these bytes
// stay off the render-blocking stylesheet (check:bundle's MAX_BLOCKING_CSS_KB
// — see the sheet's own header).
import "./optionMenu.css";

/** A row: a bare string where the value IS the label, or the pair. */
export type OptionItem = string | { value: string; label: string };

export type OptionMenuProps = {
  /** The field's own name — the control's accessible name. See (1) above. */
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly OptionItem[];
  /** Drawn in place of a value. Not an offered row unless `clearable`. */
  placeholder?: string;
  /** Whether the field can be put back to empty. See (2) above. */
  clearable?: boolean;
  id?: string;
  className?: string;
  /** The caller's field styling — this draws a button, not a box of its own. */
  style?: React.CSSProperties;
  /** false where the caller's CSS already draws one (`.pt-topic > span::after`). */
  chevron?: boolean;
};

type Row = { value: string; label: string };
type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const OM_MAXH = 320;
const OM_GAP = 6;
// Under this much room below the field, opening downward would put the last
// rows off the screen — the platform menu's own failure, restated. Above the
// field is only better when there is more of it.
const OM_FLIP_UNDER = 168;
// A menu is a list of words, not a column the width of a 0.9fr grid cell:
// the Day field is ~70px wide and "Prefer not to say" is not.
const OM_MINW = 190;

function place(btn: HTMLElement): Pos {
  const r = btn.getBoundingClientRect();
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const below = vh ? vh - r.bottom - OM_GAP * 2 : 0;
  const above = vh ? r.top - OM_GAP * 2 : 0;
  const flip = below < OM_FLIP_UNDER && above > below;
  const room = flip ? above : below;
  const width = Math.max(r.width, OM_MINW);
  // jsdom measures every box at zero, so `room` is 0 there and the clamp
  // below would collapse the list to nothing a test could read. A
  // measurement of zero is "not measured", never "no room".
  const maxHeight = room > 0 ? Math.max(132, Math.min(OM_MAXH, room)) : OM_MAXH;
  const left = vw ? Math.max(OM_GAP, Math.min(r.left, vw - width - OM_GAP)) : r.left;
  return flip
    ? { left, width, bottom: vh - r.top + OM_GAP, maxHeight }
    : { left, width, top: r.bottom + OM_GAP, maxHeight };
}

const norm = (o: OptionItem): Row => (typeof o === "string" ? { value: o, label: o } : o);

function OptionMenu({
  label, value, onChange, options,
  placeholder = "—", clearable = false,
  id, className, style, chevron = true,
}: OptionMenuProps): React.ReactElement {
  const rid = React.useId();
  const listId = `${rid}-list`;
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const typed = React.useRef({ s: "", at: 0 });
  // Which row the centring effect below should centre ON. A ref written
  // SYNCHRONOUSLY by openMenu, not a mirror of `hi` kept by an effect: a
  // mirror is written in a passive effect, which runs after the layout
  // effect, so on the open that matters it still held the PREVIOUS index.
  // Measured — the Day field opened on 12 centred on row 0, and only the
  // nudge below dragged it back into view, bottom-aligned.
  const openAt = React.useRef(0);
  // Whether the highlight is the KEYBOARD's. A menu opened by a tap must not
  // pre-select its first row: "Primary school" drawn on a grey ground with
  // nothing chosen reads as the answer, which is the same thing the platform
  // menu did with its ticked `disabled` placeholder. The pointer gets
  // `.om-row:hover` instead, and the tick alone says what is chosen.
  const [kb, setKb] = React.useState(false);

  const rows = React.useMemo<Row[]>(() => {
    const list = options.map(norm);
    return clearable ? [{ value: "", label: placeholder }, ...list] : list;
  }, [options, clearable, placeholder]);

  const current = rows.filter((o) => o.value !== "" && o.value === value)[0];
  const shown = current ? current.label : placeholder;

  const close = React.useCallback((refocus = true) => {
    setOpen(false);
    if (refocus && btnRef.current) btnRef.current.focus();
  }, []);
  // The listeners below register once per open and must not churn on every
  // render — the stack churn pushBackLayer's own docstring rules out.
  const closeRef = React.useRef(close);
  React.useEffect(() => { closeRef.current = close; });

  const openMenu = (fromKey = false) => {
    const btn = btnRef.current;
    if (!btn) return;
    setPos(place(btn));
    const i = rows.findIndex((o) => o.value === value);
    openAt.current = i >= 0 ? i : 0;
    setHi(openAt.current);
    setKb(fromKey);
    typed.current = { s: "", at: 0 };
    setOpen(true);
  };

  const pick = (v: string) => { onChange(v); close(); };

  // Focus the list itself and steer with aria-activedescendant (CityPicker's
  // pattern): one focus target, so a walk through a hundred years does not
  // move focus a hundred times. Centred on the CURRENT value, because a
  // hundred-row list opened at the top has hidden the answer it already has.
  React.useLayoutEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.focus();
    const opt = el.querySelector<HTMLElement>(`[data-om-i="${openAt.current}"]`);
    if (opt) el.scrollTop = Math.max(0, opt.offsetTop - el.clientHeight / 2 + opt.offsetHeight / 2);
  }, [open]);

  // …and the walk only nudges, so the list does not jump under the finger.
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    const opt = el ? el.querySelector<HTMLElement>(`[data-om-i="${hi}"]`) : null;
    if (!el || !opt) return;
    if (opt.offsetTop < el.scrollTop) el.scrollTop = opt.offsetTop;
    else if (opt.offsetTop + opt.offsetHeight > el.scrollTop + el.clientHeight) {
      el.scrollTop = opt.offsetTop + opt.offsetHeight - el.clientHeight;
    }
  }, [hi, open]);

  React.useEffect(() => {
    if (!open) return;
    // A menu anchored to a field that has moved is pointing at nothing. Its
    // OWN scrolling is not that — capture:true hears the list's wheel too.
    const shut = (e: Event) => {
      const t = e.target;
      if (t instanceof Node && listRef.current && listRef.current.contains(t)) return;
      closeRef.current(false);
    };
    window.addEventListener("resize", shut);
    window.addEventListener("scroll", shut, true);
    // Android back closes the menu, not the overlay underneath it.
    const off = pushBackLayer(() => closeRef.current(false));
    return () => {
      window.removeEventListener("resize", shut);
      window.removeEventListener("scroll", shut, true);
      off();
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const n = rows.length;
    if (!n) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setKb(true);
      setHi((h) => (h + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Home") { e.preventDefault(); setKb(true); setHi(0); }
    else if (e.key === "End") { e.preventDefault(); setKb(true); setHi(n - 1); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (rows[hi]) pick(rows[hi].value);
    } else if (e.key === "Escape") {
      // Swallowed: the enclosing overlay is a dialog whose own Escape closes
      // it (primitives.jsx useDialog), and one press must not do both — the
      // line CityPicker's list already holds.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close();
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Type-ahead, which a <select> gave for free and this owes back. The
      // Year field is a hundred rows: without it the only way to 1994 is a
      // hundred presses. Repeating one letter walks its matches; a second
      // letter inside 700ms narrows instead.
      const now = Date.now();
      const s = (now - typed.current.at < 700 ? typed.current.s : "") + e.key.toLowerCase();
      typed.current = { s, at: now };
      const from = s.length > 1 ? hi : hi + 1;
      for (let k = 0; k < n; k++) {
        const j = (from + k) % n;
        if (rows[j].label.toLowerCase().startsWith(s)) { setKb(true); setHi(j); break; }
      }
    }
  };

  const trigger = (
    <button
      ref={btnRef}
      id={id}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      // Unconditional, and not just because check:labels can only verify a
      // reference written as the same token the `id` is (`open ? listId :
      // undefined` is one opaque expression to it, so the pair could never
      // be checked and a one-sided rename would pass every gate). It is also
      // the right ARIA: aria-expanded="false" is what tells a reader there
      // is no popup right now, and this says which one it would be.
      aria-controls={listId}
      aria-label={label}
      className={className}
      onClick={() => (open ? close() : openMenu())}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openMenu(true); }
      }}
      style={{
        WebkitAppearance: "none", appearance: "none", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8, textAlign: "left",
        fontFamily: "var(--sans)",
        ...style,
      }}
    >
      {/* The value lives in the control's CONTENTS, which is where a
          combobox's value is read from — see (1) in the header. */}
      <span style={{
        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: current ? "inherit" : "var(--ink-3)",
      }}>{shown}</span>
      {chevron ? (
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ flex: "none", opacity: 0.55 }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      ) : null}
    </button>
  );

  const menu = open && pos ? (
    <div
      className="om-layer"
      // The backdrop dismisses but is NOT a control — the Sheet's line
      // (primitives.jsx): a real path out already exists on the keyboard and
      // on the trigger, and a button role here would announce a third.
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={-1}
        aria-label={label}
        aria-activedescendant={rows[hi] ? `${rid}-o${hi}` : undefined}
        onKeyDown={onListKey}
        className="om-menu"
        style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
      >
        {rows.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={i + ":" + o.value}
              type="button"
              role="option"
              id={`${rid}-o${i}`}
              data-om-i={i}
              aria-selected={on}
              className={"om-row" + (i === hi && kb ? " is-hi" : "") + (on ? " is-on" : "")}
              onPointerEnter={() => { setKb(false); setHi(i); }}
              onClick={() => pick(o.value)}
            >
              <span className="om-row-t">{o.label}</span>
              {on ? <span className="om-tick" aria-hidden="true">{"✓"}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <React.Fragment>
      {trigger}
      {menu && typeof document !== "undefined"
        ? ReactDOM.createPortal(menu, document.body)
        : menu}
    </React.Fragment>
  );
}

export default OptionMenu;
