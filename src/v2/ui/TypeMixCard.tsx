// Types, out in the population — the v24 type-mix design ported typed
// (design/standalone-v24/type-mix.jsx, D140). Two pieces:
//   TypeChip     — a type at person-row size: its mark, its name,
//                  optionally its count. The one chip used for filtering
//                  AND for labelling a row.
//   TypeMixCard  — who is here by type, over a stated basis, with the
//                  people you can actually see under it.
// Live-only: the demo room keeps its own furniture. The basis is the
// session's cached voter sample (the D102 bound) and the card SAYS so —
// never a census, never a share below TYPE_SMALL, thin listed not ranked.
import React from "react";
import LIVE from "../data/live";
import {
  myType, typeLine, typeMixFor, TYPE_SMALL, TYPE_TEST, type TypedPerson, type TypeRow,
} from "../data/typeMix";
// Both additive named exports on bridge modules (their globals stay for
// the spec consumers; an import moves no ratchet count).
// @ts-expect-error TS7016 — untyped spec module (additive export, D140)
import { TypeMark } from "../spec/type-marks.jsx";
// @ts-expect-error TS7016 — untyped spec module (named exports since its conversion)
import { Av } from "../spec/primitives.jsx";
import { bucketLabel } from "./cohortLabels";

export function TypeChip({ name, count, on, quiet, you, size = 18, dense, onClick, title }: {
  name: string; count?: number | null; on?: boolean; quiet?: boolean; you?: boolean;
  size?: number; dense?: boolean; onClick?: () => void; title?: string;
}): React.ReactElement {
  const body = (
    <React.Fragment>
      <TypeMark testKey={TYPE_TEST} name={name} size={size} />
      <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 800 : 600, color: quiet ? "var(--ink-3)" : "var(--ink)", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{name}</span>
      {you ? <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 800, color: "var(--accent-ink)", whiteSpace: "nowrap" }}>· you</span> : null}
      {count != null ? <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 800, color: quiet ? "var(--ink-3)" : "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{count}</span> : null}
    </React.Fragment>
  );
  const box: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 7, flex: "none",
    height: dense ? 26 : 34, padding: dense ? "0 9px 0 5px" : "0 12px 0 7px", borderRadius: 999, boxSizing: "border-box",
    border: on ? "1.5px solid var(--ink)" : "1px solid " + (quiet ? "color-mix(in oklch, var(--rule), transparent 45%)" : "var(--rule)"),
    background: on ? "var(--surface-3)" : "var(--surface-2)",
    opacity: quiet ? 0.72 : 1,
  };
  if (!onClick) return <span style={box} title={title}>{body}</span>;
  return <button className="press" onClick={onClick} aria-pressed={!!on} title={title} style={{ ...box, cursor: "pointer", WebkitAppearance: "none" }}>{body}</button>;
}

const initOf = (name: string): string =>
  name.split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";
const hueOf = (uid: string): number => {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return h;
};

export default function TypeMixCard({ scope }: { scope: "city" | "country" | "world" }): React.ReactElement | null {
  const [sel, setSel] = React.useState<string | null>(null);
  const mix = typeMixFor(scope);
  const mine = myType();
  const LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

  // Nothing typed in the sample: say so once, quietly — an empty chip row
  // would read as a broken card rather than a thin population.
  if (mix.typedN === 0) {
    return (
      <div className="card" style={{ marginTop: 14, padding: "13px 14px" }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--ink-3)" }}>types here</span>
        <div style={{ marginTop: 7, fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
          {mix.sampleN === 0
            ? "No sampled voters here yet — open a question's who-voted sheet and this fills in."
            : mix.sampleN + " sampled voters here, none with a Big Five result to read yet."}
        </div>
      </div>
    );
  }

  const small = mix.typedN < TYPE_SMALL;
  // chip order: yours first — that IS the "same type as you" shortcut —
  // then the ranked ones, then too-thin-to-rank, then nobody-carries-it
  const ranked: TypeRow[] = small ? mix.ranked.concat(mix.thin).sort((a, b) => b.n - a.n) : mix.ranked;
  const seen = new Set<string>();
  const chips: (TypeRow & { quiet?: boolean })[] = [];
  const push = (r: TypeRow | undefined, quiet: boolean) => {
    if (!r || seen.has(r.name)) return;
    seen.add(r.name);
    chips.push({ ...r, quiet });
  };
  if (mine) push(ranked.concat(mix.thin, mix.absent).find((r) => r.name === mine), false);
  ranked.forEach((r) => push(r, false));
  if (!small) mix.thin.forEach((r) => push(r, true));
  mix.absent.forEach((r) => push(r, true));

  const shown = sel ? mix.people.filter((p) => p.type === sel) : mix.people;
  const selN = sel ? chips.find((c) => c.name === sel)?.n ?? 0 : 0;
  const a = LIVE.anchors() || {};
  const place = scope === "city" ? (a.city || "your city")
    : scope === "country" ? (a.country ? bucketLabel("country", a.country) : "your country")
      : "the world";
  const basisLabel = `of the ${mix.typedN} sampled voters in ${place} with a Big Five result` +
    (mix.sampleN > mix.typedN ? ` (${mix.sampleN} sampled)` : "");

  const row = (p: TypedPerson) => (
    <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", background: "var(--surface)", border: LINE, borderRadius: 14 }}>
      <Av init={initOf(p.name)} hue={hueOf(p.uid)} size={36} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {(p.city ? bucketLabel("city", p.city) : "") || "answered here"}
        </span>
      </div>
      {p.type ? <span style={{ flexShrink: 0 }}><TypeChip name={p.type} size={17} dense you={p.type === mine} /></span> : null}
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12, padding: "13px 14px 14px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--ink-3)" }}>types here</span>
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>{basisLabel}</span>
      </div>
      <div className="h-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, margin: "0 -2px" }}>
        <button className="press" onClick={() => setSel(null)} aria-pressed={!sel}
          style={{ flex: "none", height: 34, padding: "0 14px", borderRadius: 999, boxSizing: "border-box", cursor: "pointer", WebkitAppearance: "none", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: sel ? 600 : 800, whiteSpace: "nowrap", border: !sel ? "1.5px solid var(--ink)" : "1px solid var(--rule)", background: !sel ? "var(--surface-3)" : "var(--surface-2)", color: "var(--ink)" }}>
          Everyone
        </button>
        {chips.map((c) => (
          <TypeChip key={c.name} name={c.name} count={c.n} you={c.name === mine} quiet={c.quiet && c.name !== mine}
            on={sel === c.name} onClick={c.n === 0 ? undefined : () => setSel(sel === c.name ? null : c.name)}
            title={c.n === 0 ? "nobody in this sample" : c.n + " of " + mix.typedN} />
        ))}
      </div>

      {small && (
        <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
          {mix.typedN} people is too few for a share — these are counts, not percentages.
        </span>
      )}
      {!small && (mix.thin.length > 0 || mix.absent.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {mix.thin.length > 0 && (
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
              too few to rank: {mix.thin.map((r) => r.name + " (" + r.n + ")").join(", ")}
            </span>
          )}
          {mix.absent.length > 0 && (
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.45 }}>
              nobody in this sample: {mix.absent.map((r) => r.name).join(", ")}
            </span>
          )}
        </div>
      )}

      <div style={{ borderTop: LINE, paddingTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
        {sel ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {selN} of {mix.typedN} here{sel === mine ? " — your type" : ""}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.4 }}>{typeLine(sel)}</span>
          </div>
        ) : null}
        {shown.length > 0 ? shown.map(row) : (
          <span style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
            Nobody in this sample carries it — so there is nobody to show.
          </span>
        )}
      </div>
    </div>
  );
}
