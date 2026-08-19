// Types, out in the population — the v25 type-mix design (owner's
// direction + design/standalone-v25/type-mix.jsx, amending D141's v24
// port): the share of each type in a population, over a stated basis.
// A READING, not a directory: no people, only proportions, sitting
// BELOW Kindred on the People lens.
//
// Length is the share; the mark carries which type. One neutral bar
// throughout — a bar per type in its own hue would turn thirteen
// readings into soup — with your own row in the accent. The honesty
// rules stand: the basis is the session's cached voter sample (D102)
// and the card says so; under TYPE_SMALL typed people it shows COUNTS
// and says shares would lie; thin types are listed, never ranked;
// absent types are named as missing.
//
// The v28 §8 SYSTEM SWITCH sits on top: four instruments, remembered per
// device under insight.typemix.sys. The measured mix stays Big Five only —
// the recorded Art. 9 scope (docs/data-inventory.md, pinned in
// data/typeMix.test.ts) computes no population reading from the politics,
// values or attachment results, and a live build fabricates nothing
// (D167/D72) — so the other three positions state the type-index sheet's
// refusal rather than a mix that was never measured. Widening that is a
// decision, not a switch position.
import React from "react";
import LIVE from "../data/live";
import { myType, typeMixFor, TYPE_SMALL, TYPE_TEST, type TypeRow } from "../data/typeMix";
// @ts-expect-error TS7016 — untyped spec module (additive export, D141)
import { TypeMark } from "../spec/type-marks.jsx";
import { bucketLabel } from "./cohortLabels";

// The four instruments the switch offers (v28 §8), in the order the
// profile lists their tests. Keys are archetype-data.js's own. A module
// constant rather than a shared global: this card is the roster's only
// consumer, and a window.* copy would raise check:globals rule 4's count.
const TMX_SYS = [
  { key: "big5", label: "Personality" },
  { key: "political", label: "Politics" },
  { key: "values", label: "Values" },
  { key: "attachment", label: "Social" },
] as const;
type SysKey = (typeof TMX_SYS)[number]["key"];
// The remembered lens — swept with every other insight.* key by
// purgeLocalTrace; the mounted card drops its copy too (check:purge).
const TMX_LS = "insight.typemix.sys";
// A stale or foreign stored value falls back to the default test rather
// than selecting an instrument the archetype module does not define.
const okSys = (v: string | null): SysKey =>
  TMX_SYS.some((s) => s.key === v) ? (v as SysKey) : TYPE_TEST;

export default function TypeMixCard({ scope }: { scope: "city" | "country" | "world" }): React.ReactElement | null {
  // v28 §8: the system switch. A device preference, but still a trace of
  // an account's behaviour, so the purge drops it like everything else.
  const [sys, setSys] = React.useState<SysKey>(() => {
    try { return okSys(localStorage.getItem(TMX_LS)); } catch { return TYPE_TEST; }
  });
  React.useEffect(() => {
    // check:purge: purgeLocalTrace has already removed the key; this drops
    // the mounted copy so the next tap cannot write the previous account's
    // choice back under the new uid. No setItem here — that would
    // re-create the purged key.
    const drop = () => setSys(TYPE_TEST);
    window.addEventListener("insight:local-purge", drop);
    return () => window.removeEventListener("insight:local-purge", drop);
  }, []);
  const pick = (k: SysKey) => {
    setSys(k);
    try { localStorage.setItem(TMX_LS, k); } catch { /* storage denied — the choice holds for this mount */ }
  };

  const mix = typeMixFor(scope);
  const mine = myType();
  const a = LIVE.anchors() || {};
  const place = scope === "city" ? (a.city ? bucketLabel("city", a.city) : "your city")
    : scope === "country" ? (a.country ? bucketLabel("country", a.country) : "your country")
      : "the world";

  const header = (sub: string, title?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
      <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>Types here</span>
      <span title={title} style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>{sub}</span>
    </div>
  );

  // The switch row: four pills, the open one outlined in ink — the
  // prototype's tablist chrome, on the app's existing press/h-scroll
  // classes. Rendered on every branch below, because a control that
  // disappears with the data would strand a reader on an empty position.
  const switchRow = (
    <div className="h-scroll" role="tablist" aria-label="Which type system"
      style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 2px 10px" }}>
      {TMX_SYS.map((s) => {
        const on = s.key === sys;
        return (
          <button key={s.key} role="tab" aria-selected={on} onClick={() => pick(s.key)} className="press"
            style={{
              flexShrink: 0, height: 30, padding: "0 13px", borderRadius: 999, boxSizing: "border-box", cursor: "pointer", WebkitAppearance: "none",
              fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 800 : 600, letterSpacing: "-0.01em",
              color: on ? "var(--ink)" : "var(--ink-3)",
              border: on ? "1.5px solid var(--ink)" : "1px solid color-mix(in oklch, var(--rule), transparent 30%)",
              background: on ? "var(--surface-3)" : "var(--surface-2)",
            }}>{s.label}</button>
        );
      })}
    </div>
  );

  // The Art. 9 line, which the switch does not move: no population reading
  // is computed from the politics, values or attachment results
  // (data/typeMix.ts's header; pinned in data/typeMix.test.ts). The
  // prototype derives demo shares here; a live build must neither
  // fabricate them (D167) nor measure them, so the other three positions
  // state the refusal in the type-index sheet's own words
  // (spec/type-marks.jsx).
  if (sys !== TYPE_TEST) {
    return (
      <div>
        {header(`in ${place}`)}
        {switchRow}
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
          Shares are only counted for the Big Five.
        </span>
      </div>
    );
  }

  // Nothing typed in the sample: say so once, quietly — an empty bar
  // stack would read as a broken card rather than a thin population.
  if (mix.typedN === 0) {
    return (
      <div>
        {header(`in ${place}`)}
        {switchRow}
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
          {mix.sampleN === 0
            ? "Open a question's who-voted sheet and this fills in."
            : mix.sampleN + " sampled here, none typed yet."}
        </span>
      </div>
    );
  }

  const small = mix.typedN < TYPE_SMALL;
  const rows: TypeRow[] = small
    ? mix.ranked.concat(mix.thin).sort((a2, b) => b.n - a2.n)
    : mix.ranked;
  const top = Math.max(1, ...rows.map((r) => r.n));
  // The basis, as a count and a place rather than a clause. It still says
  // the two things that keep the card honest — how many were measured, and
  // where — and the "sampled voters with a Big Five result" qualifier moves
  // to a title, where a reader who wants the definition can find it and the
  // other twelve rows are not paying for it.
  const basisLabel = `${mix.typedN} typed in ${place}`;

  return (
    <div>
      {header(basisLabel, `of ${mix.sampleN} sampled voters in ${place}, ${mix.typedN} have a Big Five result`)}
      {switchRow}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((r) => {
          const you = r.name === mine;
          const pct = Math.round((r.n / mix.typedN) * 100);
          return (
            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <TypeMark testKey={TYPE_TEST} name={r.name} size={20} />
              <span style={{ width: 118, flexShrink: 0, fontFamily: "var(--sans)", fontSize: 13, fontWeight: you ? 800 : 650, letterSpacing: "-0.015em", color: you ? "var(--ink)" : "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
              <span style={{ flex: 1, minWidth: 0, height: 7 }}>
                <span style={{ display: "block", height: 7, width: Math.max(3, (r.n / top) * 100) + "%", borderRadius: 999, background: you ? "var(--accent)" : "color-mix(in oklch, var(--ink-3) 46%, var(--surface-3))" }}></span>
              </span>
              <span style={{ flexShrink: 0, width: small ? 22 : 34, textAlign: "right", fontFamily: "var(--sans)", fontSize: 13, fontWeight: 800, color: you ? "var(--accent-ink)" : "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{small ? r.n : pct + "%"}</span>
            </div>
          );
        })}

        <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 25%)", paddingTop: 10 }}>
          {small && (
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
              counts, not shares
            </span>
          )}
          {!small && mix.thin.length > 0 && (
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
              unranked: {mix.thin.map((r) => r.name + " (" + r.n + ")").join(", ")}
            </span>
          )}
          {mix.absent.length > 0 && (
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
              none here: {mix.absent.map((r) => r.name).join(", ")}
            </span>
          )}
          {/* "your own type is marked in the accent" stood here and was a
              legend for a colour the reader is looking at — the one row in
              the accent, bold, with the accent figure beside it. The most
              literal case of a sentence doing a visual's job, so it goes;
              `mine` still drives the mark itself. */}
        </div>
      </div>
    </div>
  );
}
