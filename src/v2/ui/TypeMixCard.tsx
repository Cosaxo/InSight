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
import React from "react";
import LIVE from "../data/live";
import { myType, typeMixFor, TYPE_SMALL, TYPE_TEST, type TypeRow } from "../data/typeMix";
// @ts-expect-error TS7016 — untyped spec module (additive export, D141)
import { TypeMark } from "../spec/type-marks.jsx";
import { bucketLabel } from "./cohortLabels";

export default function TypeMixCard({ scope }: { scope: "city" | "country" | "world" }): React.ReactElement | null {
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

  // Nothing typed in the sample: say so once, quietly — an empty bar
  // stack would read as a broken card rather than a thin population.
  if (mix.typedN === 0) {
    return (
      <div>
        {header(`in ${place}`)}
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
