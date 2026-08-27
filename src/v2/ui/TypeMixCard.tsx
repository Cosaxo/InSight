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
// D202 added the system switch: all four instruments, not just the Big
// Five, with the choice remembered per device. The honesty rules above
// apply PER INSTRUMENT rather than once — coverage differs by how far
// each person has got through the test feed, so `typedN`, the thin list
// and the counts-not-shares state are all recomputed on every switch.
// The reversal that made this legal is D202 itself; `data/typeMix.ts`
// carries the argument and what it cost.
import React from "react";
import LIVE from "../data/live";
import { BUDGET_PAUSED_HEAD } from "../data/budgetMode";
import { myTypeOn, typeMixFor, TYPE_SMALL, TYPE_SYSTEMS, TYPE_TEST, isTypeSystem, type TypeRow } from "../data/typeMix";
// @ts-expect-error TS7016 — untyped spec module (additive export, D141)
import { TypeMark } from "../spec/type-marks.jsx";
import { bucketLabel } from "./cohortLabels";

/** The chosen instrument, remembered across opens (D202). Device state, so
 * `purgeLocalTrace`'s `insight.` prefix sweep takes it for free — the
 * listener below is what `check:purge` asks for in exchange. */
const SYS_LS = "insight.typeMixSys.v1";
const readSys = (): string => {
  try {
    const v = localStorage.getItem(SYS_LS);
    return v && isTypeSystem(v) ? v : TYPE_TEST;
  } catch { return TYPE_TEST; }
};

/** Politics and Values name their types in up to 24 characters
 * ("Traditional Conservative"); the Big Five's longest is 17. One column
 * width for all four would either clip those two or leave the other two
 * padded, so the column follows the system. */
const nameWidth = (sys: string): number => (sys === "political" || sys === "values" ? 142 : 118);

export default function TypeMixCard({ scope }: { scope: "city" | "country" | "world" }): React.ReactElement | null {
  const [sys, setSysRaw] = React.useState<string>(readSys);
  React.useEffect(() => {
    const reset = () => setSysRaw(TYPE_TEST);
    window.addEventListener("insight:local-purge", reset);
    return () => window.removeEventListener("insight:local-purge", reset);
  }, []);
  const setSys = (k: string) => {
    setSysRaw(k);
    try { localStorage.setItem(SYS_LS, k); } catch { /* private mode — the choice still holds for this session */ }
  };
  const mix = typeMixFor(scope, sys);
  const mine = myTypeOn(sys);
  const a = LIVE.anchors() || {};
  const place = scope === "city" ? (a.city ? bucketLabel("city", a.city) : "your city")
    : scope === "country" ? (a.country ? bucketLabel("country", a.country) : "your country")
      : "the world";
  const sysLabel = TYPE_SYSTEMS.find((s) => s.kind === sys)?.label ?? "Personality";

  const header = (sub: string, title?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
      <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>Types here</span>
      <span title={title} style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>{sub}</span>
    </div>
  );

  // The switch is drawn even when the current system has nothing to show —
  // it is the way back out of an empty one, so hiding it would strand the
  // reader on the instrument they have least coverage of.
  const chips = (
    <div className="h-scroll" role="tablist" aria-label="Which type system"
      style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 2px 10px" }}>
      {TYPE_SYSTEMS.map((s) => {
        const on = s.kind === sys;
        return (
          <button key={s.kind} role="tab" aria-selected={on} onClick={() => setSys(s.kind)}
            style={{
              flexShrink: 0, border: "none", cursor: "pointer", WebkitAppearance: "none",
              padding: "5px 11px", borderRadius: 999,
              fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 800 : 650,
              letterSpacing: "-0.01em",
              color: on ? "var(--accent-ink)" : "var(--ink-3)",
              background: on ? "color-mix(in oklch, var(--accent), var(--surface) 86%)" : "var(--surface-3)",
            }}>{s.label}</button>
        );
      })}
    </div>
  );

  // Nothing typed in the sample: say so once, quietly — an empty bar
  // stack would read as a broken card rather than a thin population.
  if (mix.typedN === 0) {
    return (
      <div>
        {header(`in ${place}`)}
        {chips}
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
          {mix.sampleN === 0
            // The instruction is only offered while following it works —
            // under the breaker (D327) the sheet's fetch refuses, and an
            // instruction that does nothing is worse than saying so. The
            // HEAD alone, not the sentence: this card renders only inside
            // the People lens, where Kindred one card up already carries
            // the full why, and a clause restating the clause above it is
            // the deletion COPY.md names.
            ? (LIVE.budgetPaused ? BUDGET_PAUSED_HEAD : "Open a question's who-voted sheet and this fills in.")
            : mix.sampleN + " sampled here, none typed on this one yet."}
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
      {header(basisLabel, `of ${mix.sampleN} sampled voters in ${place}, ${mix.typedN} have a ${sysLabel} result`)}
      {chips}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((r) => {
          const you = r.name === mine;
          const pct = Math.round((r.n / mix.typedN) * 100);
          return (
            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <TypeMark testKey={sys} name={r.name} size={20} />
              <span style={{ width: nameWidth(sys), flexShrink: 0, fontFamily: "var(--sans)", fontSize: 13, fontWeight: you ? 800 : 650, letterSpacing: "-0.015em", color: you ? "var(--ink)" : "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
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
