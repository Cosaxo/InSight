// CityPicker — the profile's city field (D9).
//
// Replaces two free-text inputs ("Country", "City") with one search over a
// fixed catalogue of 10,929 real places. The value it produces is the
// canonical anchor key `"Oslo, NO"`, which is also the breakdown bucket
// key, so a cohort is one place spelled one way instead of one bucket per
// spelling.
//
// Two ways in, and the manual one is always available: search the list, or
// tap "Use my location" for a single coarse fix that src/v2/data/locate.ts
// resolves to a city ON THE DEVICE and then discards. This component never
// sees a coordinate — locateCity() hands back a catalogue key — so a
// location leak cannot originate here even by mistake.
//
// A located city is SUGGESTED, never applied. Silently rewriting a profile
// field from a sensor is the behaviour that makes a location prompt feel
// like a trick, and the cost of avoiding it is one tap.
//
// Born in this repo, so typed TSX like LivePrivacyPanel; the globalThis
// assignment at the bottom keeps the spec layer's render-time lookup
// working from profile-general.jsx unchanged.
import React from "react";
import PLACES, { placeLabel, type Place } from "../data/places";
import { locateCity, locateSupported, type LocateFail } from "../data/locate";

const CP_LINE = "1px solid var(--rule)";

// Why each failure needs its own sentence: "we couldn't find you" after the
// user deliberately declined reads as broken software, and "try again"
// after a hard refusal sends them in a loop. The manual picker is right
// there in every case, so none of these is a dead end.
const CP_FAIL: Record<LocateFail, string> = {
  denied: "No problem — search for your city instead.",
  unavailable: "Couldn't get a location fix. Search instead.",
  timeout: "That took too long — indoors it often does. Search instead.",
  unsupported: "This device can't share a location. Search instead.",
  "no-match": "Couldn't match that to a city. Search instead.",
};

export type CityPickerProps = {
  /** Current anchor value, e.g. "Oslo, NO". May be legacy free text. */
  value: string;
  onChange: (next: string) => void;
  inputStyle?: React.CSSProperties;
};

function CityPicker({ value, onChange, inputStyle }: CityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [places, setPlaces] = React.useState<Place[] | null>(() => PLACES.peek());
  const [err, setErr] = React.useState<string | null>(null);
  const [hi, setHi] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  // The located suggestion is offered, never applied. Silently rewriting a
  // profile field from a sensor is the behaviour that makes people distrust
  // a location prompt, and the fix is one tap of confirmation.
  const [locating, setLocating] = React.useState(false);
  const [suggest, setSuggest] = React.useState<{ place: Place; km: number } | null>(null);
  const [locErr, setLocErr] = React.useState<string | null>(null);

  // Fetch on first open, never on mount: the catalogue is ~139 KB and most
  // sessions never edit the profile at all.
  React.useEffect(() => {
    if (!open || places) return;
    let live = true;
    setErr(null);
    PLACES.load().then(
      (p) => { if (live) setPlaces(p); },
      (e) => { if (live) setErr(String((e instanceof Error && e.message) || e)); },
    );
    return () => { live = false; };
  }, [open, places]);

  // Close on an outside tap. Without this the list stays open behind the
  // rest of the form on touch, where there is no blur to rely on.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // The blank-state hint (D90): the clock's country, once per catalogue.
  // "" — no zone, or a zone city the catalogue does not know — keeps the
  // world's population order.
  const hint = React.useMemo(() => (places ? PLACES.regionHint(places) : ""), [places]);
  const results = React.useMemo(
    () => (places ? PLACES.search(places, q, 40, hint) : []),
    [places, q, hint],
  );
  React.useEffect(() => { setHi(0); }, [q]);

  const parsed = value ? PLACES.parse(value) : null;
  // A value that does not parse is a profile written before the picker
  // existed. Show it, flag it, and let them re-pick — silently blanking
  // someone's city because the format changed is not an upgrade.
  const legacy = !!value && !parsed;
  const shown = parsed ? placeLabel(parsed) : value;

  const pick = (p: Place) => {
    onChange(PLACES.key(p));
    setOpen(false);
    setQ("");
    setSuggest(null);
    setLocErr(null);
  };

  const locate = async () => {
    setLocating(true);
    setLocErr(null);
    setSuggest(null);
    const r = await locateCity();
    setLocating(false);
    if (!r.ok) {
      setLocErr(CP_FAIL[r.reason]);
      return;
    }
    // locateCity returns a catalogue KEY, never a coordinate — the fix is
    // resolved and discarded inside data/locate.ts. Parsing the key back is
    // enough to render a label, and it is all this component can see.
    const p = PLACES.parse(r.key);
    if (!p) {
      setLocErr(CP_FAIL["no-match"]);
      return;
    }
    setSuggest({ place: p, km: r.km });
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
      // Only swallow it when there is a dropdown to close. The enclosing
      // overlay is a dialog whose own Escape closes it (primitives.jsx
      // useDialog), and one press should not do both — but with the list
      // already shut, Escape belongs to the overlay.
      e.stopPropagation();
      setOpen(false);
    }
  };

  const base: React.CSSProperties = {
    fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--surface)",
    border: CP_LINE, borderRadius: 10, outline: "none", WebkitAppearance: "none",
    appearance: "none", boxSizing: "border-box", width: "100%", minWidth: 0,
    padding: "8px 11px", ...inputStyle,
    // AFTER the spread on purpose: a caller passing a smaller size would
    // hand iOS a reason to zoom the whole app on focus (styles.css
    // § --field-size). Everything else here stays overridable.
    fontSize: "var(--field-size)",
  };

  if (!open) {
    return (
      // aria-label rather than relying on the button's own text, and it stays
      // even though the wrapper that forced it is gone. A <button> is a
      // labelable element, so the <label>City …</label> that used to wrap
      // this in profile-general.jsx won the accessible-name computation and
      // the chosen city never reached a screen reader — found by a locator
      // that could not see it either. That call site is a plain <span>
      // caption now, so the hijack cannot recur; the aria-label is kept
      // because it is the better name regardless, carrying the "City:"
      // context the button's own text ("Oslo, Norway") does not.
      <button type="button" className="press" onClick={() => setOpen(true)}
        aria-haspopup="listbox" aria-expanded={false}
        aria-label={value ? `City: ${shown}. Change` : "Choose your city"}
        style={{ ...base, cursor: "pointer", textAlign: "left", fontWeight: 500,
          color: value ? "var(--ink)" : "var(--ink-3)" }}>
        {shown || "Choose your city…"}
        {legacy && (
          <span style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 600 }}> · tap to re-pick</span>
        )}
      </button>
    );
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      {/* aria-activedescendant: without it `hi` is a background colour, so a
          screen-reader user hears nothing as the highlight moves and Enter
          commits a city whose name was never announced. */}
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
        role="combobox" aria-expanded aria-controls="citypicker-list" aria-autocomplete="list"
        aria-activedescendant={results[hi] ? `citypicker-opt-${results[hi].country}-${results[hi].name}` : undefined}
        aria-label="Search cities" placeholder="Search cities…" style={base} />
      <div role="listbox" id="citypicker-list" style={{
        position: "absolute", zIndex: 40, left: 0, right: 0, top: "calc(100% + 4px)",
        maxHeight: 260, overflowY: "auto", background: "var(--surface)",
        border: CP_LINE, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
      }}>
        {/* Offered only while the query is empty: once someone is typing a
            city name they have answered the question themselves, and a
            location row above their results is just in the way. */}
        {locateSupported() && !q && (
          <div style={{ borderBottom: CP_LINE, padding: "9px 13px" }}>
            {suggest ? (
              <button type="button"
                onPointerDown={(e) => { e.preventDefault(); }}
                onClick={() => pick(suggest.place)}
                style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                  border: "none", background: "transparent", padding: 0,
                  fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                {placeLabel(suggest.place)}
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 2 }}>
                  Nearest city{suggest.km >= 1 ? ` · about ${Math.round(suggest.km)} km away` : ""} — tap to use it
                </span>
              </button>
            ) : (
              <button type="button"
                onPointerDown={(e) => { e.preventDefault(); }}
                onClick={() => { void locate(); }}
                disabled={locating}
                style={{ display: "block", width: "100%", textAlign: "left",
                  cursor: locating ? "default" : "pointer", border: "none", background: "transparent",
                  padding: 0, opacity: locating ? 0.55 : 1,
                  fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                {locating ? "Finding your nearest city…" : "Use my location"}
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 2 }}>
                  {locErr || "Matched to a city on this phone. Your coordinates are never sent or saved."}
                </span>
              </button>
            )}
          </div>
        )}
        {err && (
          <div role="status" style={{ padding: "12px 13px", fontSize: 13, fontWeight: 600, color: "oklch(0.5 0.19 25)" }}>
            Couldn&apos;t load the city list. Close and try again.
          </div>
        )}
        {!err && !places && (
          <div role="status" style={{ padding: "12px 13px", fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }}>Loading…</div>
        )}
        {!err && places && !results.length && (
          <div role="status" style={{ padding: "12px 13px", fontSize: 13, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
            No match. The list holds cities above ~50,000 people plus every
            capital — pick the nearest one.
          </div>
        )}
        {!err && results.map((p, i) => (
          <button key={`${p.country}/${p.name}`} type="button" role="option"
            id={`citypicker-opt-${p.country}-${p.name}`} aria-selected={i === hi}
            onPointerEnter={() => setHi(i)}
            // preventDefault on pointerdown, ACT on click. The outside-tap
            // handler above runs on pointerdown and would close the list
            // before click fired — hence the first half. Acting there too
            // made these dead to the keyboard and to assistive tech, which
            // activate by dispatching a synthesized CLICK and never a
            // pointer event. Mouse and touch emit both, in this order.
            onPointerDown={(e) => { e.preventDefault(); }}
            onClick={() => pick(p)}
            style={{
              display: "block", width: "100%", textAlign: "left", cursor: "pointer",
              border: "none", borderBottom: CP_LINE, padding: "9px 13px",
              fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)",
              background: i === hi ? "var(--surface-2)" : "transparent",
            }}>
            {p.name}
            <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>
              {"  ·  "}{PLACES.countryName(p.country)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Render-time lookup bridge for the spec layer (profile-general.jsx).
Object.assign(globalThis, { CityPicker });

export default CityPicker;
