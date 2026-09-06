// "What moves together" (v28 §13) — the cross-test threads
// (data/traitLinks.ts) drawn on shared rails. Each pair is laid so the
// usual pattern lands its two dots together; the stretch between them is
// how far you defy it. The headline is the strongest break — the rule you
// break being the most individual thing the data can say.
//
// Lives on the profile's General panel (the v28 patch's spot), reading
// only the viewer's OWN results: live, the same server+device merge every
// result surface reads (LIVE.myTestResults, parsed by similarity's own
// parser); demo, the design's IS_TEST_RESULTS. Fewer than four resolvable
// pairs renders NOTHING — with one instrument taken the web has no
// cross-test thread to draw, and a card of one row would be a claim
// dressed as a picture.
//
// THE USUAL PATTERN IS MEASURED IN A LIVE BUILD (D393). The direction each
// rail is laid on came from an authored table in both builds until then,
// and the card called it "the usual pattern" — a finding about people this
// app had never counted. Live, the direction now comes from a correlation
// over the session's cached voter sample (the same people testNorms.ts
// counts percentiles over), a pair draws only where that sample can state
// one, and the key says what it was counted over. On a young install that
// is fewer than four pairs, so the card is absent rather than invented —
// the D265 shape one card over: it arrives when the data can carry it.
import React from "react";
import LIVE from "../data/live";
import { traitBasis, traitRows, type TraitDimRef } from "../data/traitLinks";
import { CORE_TEST_KINDS, parseTestResults } from "../data/similarity";
// @ts-expect-error TS7016 — untyped spec module (named exports, converted)
import { IS_TEST_RESULTS, TEST_HUE } from "../spec/test-definitions.js";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";

const SANS = "var(--sans)";

interface DemoDim { id: string; label: string; value: number }
const DEFS = IS_TEST_RESULTS as Record<string, { dims: DemoDim[] }>;

/** live/demo dimension source — the definitions carry the labels in both
 * modes, the VALUES differ by build (the trap the injected fold avoids). */
function dimOfFor(): (test: string, dim: string) => TraitDimRef | null {
  const mine = LIVE.enabled ? parseTestResults(LIVE.myTestResults(), CORE_TEST_KINDS) : null;
  return (test, dim) => {
    const def = DEFS[test]?.dims?.find((d) => d.id === dim);
    if (!def) return null;
    const v = LIVE.enabled ? mine?.[test]?.[dim] : def.value;
    if (v == null) return null;
    const color = WPAL.c((TEST_HUE as Record<string, string>)[test] ?? "var(--accent)") as string;
    return { v, label: def.label, color };
  };
}

export default function TraitWebCard(): React.ReactElement | null {
  const [, bump] = React.useState(0);
  // a result finishing while the profile is open lands through the store —
  // and so does the sample the usual pattern is measured over
  React.useEffect(() => (LIVE.enabled ? LIVE.subscribe(() => bump((x) => x + 1)) : undefined), []);
  // THE CROWD HALF OF THIS CARD HAS TO FETCH ITS OWN CROWD — the result
  // card's rule (2026-08-31): `kindredPeople` fills when a surface that
  // reads it asks, and a profile opened before the Mirror's city field or
  // People lens has run would otherwise measure over nobody, forever, and
  // look exactly like a population with no pattern in it. Free on repeat —
  // loadKindred is session-cached — and skipped on the demo build, where
  // the authored table is the content.
  React.useEffect(() => { if (LIVE.enabled) void LIVE.loadKindred(); }, []);

  const basis = LIVE.enabled ? traitBasis(LIVE.kindredPeople().map((p) => p.results)) : null;
  const rows = traitRows(dimOfFor(), basis).slice(0, 8);
  if (rows.length < 4) return null;
  const brk = rows.find((r) => r.state === "break") || null;
  // The smallest basis on the card — the number the key may claim for
  // every thread at once. 0 in the demo, where nothing was measured.
  const minN = rows.reduce((m, r) => (r.measured ? Math.min(m, r.n) : m), Infinity);
  const measured = Number.isFinite(minN);

  return (
    <div className="card" style={{ marginBottom: 16, padding: "15px 18px 16px", fontFamily: SANS }}>
      <div className="kicker" style={{ marginBottom: 9 }}>What moves together</div>
      {brk ? (
        <div>
          <div style={{ fontSize: 18.5, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, textWrap: "balance", textTransform: "capitalize" }}>{brk.breakLine}</div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.4, textWrap: "pretty" }}>{brk.rule} — yours split apart.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 18.5, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>Every usual thread holds in you</div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.4 }}>Your traits pull the way they typically pull together.</div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 15 }}>
        {rows.map((r) => {
          const broke = r.state === "break";
          const lo = Math.min(r.pa, r.pb), hi = Math.max(r.pa, r.pb);
          const lab: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 11 }} title={`${r.a.label} × ${r.b.label} — ${r.rule}${broke ? " · yours split" : " · holds in you"}${r.measured ? ` · measured over ${r.n} people` : ""}`}>
              <span style={{ width: 96, flexShrink: 0 }}>
                <span style={{ ...lab, display: "block", color: broke ? "var(--ink)" : "var(--ink-2)", fontWeight: broke ? 700 : 600 }}>{r.a.label}</span>
                <span style={{ ...lab, display: "block", color: "var(--ink-3)" }}>{"× "}{r.b.label}</span>
              </span>
              <div style={{ position: "relative", flex: 1, height: 15 }}>
                <span style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, marginTop: -0.5, background: "color-mix(in oklch, var(--rule), transparent 30%)" }}></span>
                {hi - lo > 2 && <span style={{ position: "absolute", top: "50%", marginTop: broke ? -1.5 : -1, height: broke ? 3 : 2, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, background: broke ? "var(--ochre)" : `color-mix(in oklch, ${r.a.color} 50%, ${r.b.color})`, opacity: broke ? 1 : 0.55 }}></span>}
                <span style={{ position: "absolute", top: "50%", left: `${r.pa}%`, transform: "translate(-50%,-50%)", width: 11, height: 11, borderRadius: "50%", background: r.a.color, border: "2px solid var(--surface-2)", boxShadow: "0 1px 3px -1px rgba(20,20,40,0.35)" }}></span>
                <span style={{ position: "absolute", top: "50%", left: `${r.pb}%`, transform: "translate(-50%,-50%)", width: 11, height: 11, borderRadius: "50%", background: r.b.color, border: "2px solid var(--surface-2)", boxShadow: "0 1px 3px -1px rgba(20,20,40,0.35)" }}></span>
              </div>
            </div>
          );
        })}
      </div>
      {/* a key for a novel encoding, not a caption restating a shape —
          the distinction COPY.md §3 draws. The second sentence is the
          basis (§3's honesty qualifier): a live build says what the usual
          pattern was counted over, the demo has nothing counted to name. */}
      <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 13, paddingTop: 11, borderTop: "0.5px solid var(--rule)", textWrap: "pretty" }}>
        Each pair sits so the usual pattern lands its dots together — a stretched amber thread is a rule you break.
        {measured ? ` Each usual pattern is measured over the people this session has scores for — at least ${minN} behind every thread.` : ""}
      </div>
    </div>
  );
}
