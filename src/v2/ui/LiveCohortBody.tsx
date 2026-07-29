// LiveCohortBody — the Mirror's geographic populations in live mode (D9).
//
// Serves both Near (your city) and World (your country / everyone), because
// after D9 they are the same question at three radii and there is no reason
// for three renderers to disagree about what a withheld cell means.
//
// WHAT NEAR USED TO BE. A field of six named neighbours ("Sigrid Bø, a few
// streets away, 88% match") drawn from sample-data.js, headed "2,847 within
// 5 km · Grünerløkka". None of it was ever real. The v1 backend that would
// have made it real bucketed users into ~5 km geohash cells behind a
// 20-person floor, and it never produced a single cell — the aggregator
// read a top-level `geohash` field while the writer wrote a nested one
// (D2). Nothing in v2 ever called it.
//
// WHAT THESE ARE NOW. The same k-floored public aggregates everything else
// here reads: counts, at the radius you picked. Near is a redefinition
// rather than a repair, and it is the honest one — a 5 km circle needs 20
// neighbours before it can say anything, a city needs 5, and unlike the
// circle nothing about a city requires knowing where the phone is.
//
// WHAT THEY DELIBERATELY DO NOT SHOW. People. Not names, not avatars, not
// "someone near you also said". D5 keeps this module out of every other
// user's documents, and the aggregates carry only counts. A field of
// strangers would be sample data wearing a live badge, which is exactly
// what this replaces.
import React from "react";
import LIVE from "../data/live";
import PLACES from "../data/places";

const LN_LINE = "1px solid var(--rule)";
// Must match AGG_MIN_N in functions/src/v2.ts. Shown to the user, so drift
// here is a lie about the floor rather than a cosmetic bug.
const LN_FLOOR = 5;

export type CohortScope = "city" | "country" | "world";

type Row = { qid: string; text: string; options: string[]; cell: Record<string, number>; n: number };

function LnBar({ row, accent }: { row: Row; accent: string }) {
  const pct = row.options.map((_, i) => Math.round(((row.cell[String(i)] || 0) / row.n) * 100));
  // Rounding drift lands on the largest share so the bar is exactly full.
  const drift = 100 - pct.reduce((a, b) => a + b, 0);
  if (drift) pct[pct.indexOf(Math.max(...pct))] += drift;
  const shade = (i: number) => `color-mix(in oklch, ${accent} ${Math.max(70 - i * 22, 12)}%, var(--surface-3))`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "13px 0", borderBottom: LN_LINE }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.35, color: "var(--ink)" }}>{row.text}</div>
      <div style={{ display: "flex", height: 30, border: LN_LINE, borderRadius: 9, overflow: "hidden", background: "var(--surface)" }}>
        {pct.map((p, i) => (
          <span key={i} style={{
            width: `${p}%`, display: "flex", alignItems: "center", justifyContent: "center",
            background: shade(i), color: i < 2 ? "#fff" : "var(--ink)",
            fontSize: 10.5, fontWeight: 800, overflow: "hidden",
          }}>{p >= 14 ? `${p}%` : ""}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
        {row.options.map((o, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--ink-2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", background: shade(i) }} />
            {o}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)" }}>
          {row.n.toLocaleString()} {row.n === 1 ? "answer" : "answers"}
        </span>
      </div>
    </div>
  );
}

function LnNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "26px 4px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--ink)", marginBottom: 7 }}>{title}</div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.55, maxWidth: 330, margin: "0 auto", textWrap: "pretty" }}>
        {children}
      </div>
    </div>
  );
}

function LiveCohortBody({ scope = "city" }: { scope?: CohortScope }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);

  const city = LIVE.myCity;
  const place = city ? PLACES.parse(city) : null;
  const country = place ? place.country : "";

  // City and country slice the published breakdown by the viewer's own
  // bucket; the globe is the plain total. Nothing here reads another
  // user's document to find out which bucket that is (D5).
  if (scope !== "world" && !city) {
    return (
      <LnNote title={scope === "city" ? "Near needs a city" : "This needs a city"}>
        Set your city in your profile and this becomes the daily, answered by
        everyone else in it. Use your location or pick from a list — either
        way only the city name is saved, never your coordinates.
      </LnNote>
    );
  }

  const heading =
    scope === "city" ? (place ? PLACES.label(place) : city)
      : scope === "country" ? PLACES.countryName(country)
        : "The world";
  const shortName =
    scope === "city" ? (place ? place.name : city)
      : scope === "country" ? PLACES.countryName(country)
        : "the world";
  const accent =
    scope === "city" ? "var(--c-around)" : scope === "country" ? "var(--c-city)" : "var(--c-world)";

  const rows: Row[] = [];
  // Questions the viewer can see at all but whose cohort cell is withheld.
  // Named plainly: an absent cell means BELOW THE FLOOR, not zero, and a
  // silent gap reads as "nobody answered".
  let withheld = 0;
  for (const q of LIVE.deck()) {
    const agg = LIVE.aggFor(q.id);
    if (!agg) continue;
    let cell: Record<string, number> | undefined;
    let n = 0;
    if (scope === "world") {
      // The globe is the aggregate itself. `tooSmall` is the server's own
      // floor flag for the overall count and is authoritative — an agg can
      // carry stale counts while still being below it.
      if (agg.tooSmall !== false) { withheld++; continue; }
      cell = agg.counts;
      n = agg.total || 0;
    } else {
      const dim = agg.by?.[scope];
      cell = dim?.[scope === "city" ? city : country];
      if (dim && !cell) withheld++;
      if (cell) n = Object.values(cell).reduce((a, b) => a + b, 0);
    }
    if (!cell || !n) continue;
    rows.push({ qid: q.id, text: q.text, options: q.options.map((o) => o.label), cell, n });
  }

  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px" }}>
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">
          {scope === "city" ? "Around you" : scope === "country" ? "Your country" : "Everyone"}
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>{heading}</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
          {scope === "world"
            ? `Everyone who answered today. Counts only — never who, and never a group smaller than ${LN_FLOOR}.`
            : `Everyone who picked this ${scope}, on today's questions. Counts only — never who, and never a group smaller than ${LN_FLOOR}.`}
        </div>
      </div>

      {rows.map((r) => <LnBar key={r.qid} row={r} accent={accent} />)}

      {!rows.length && (
        <LnNote title={`${scope === "world" ? "Today" : shortName} is still filling up`}>
          A cohort appears once at least {LN_FLOOR} people in it have answered.
          Until then the split is withheld rather than shown thin — the floor is
          enforced on the server, not here.
        </LnNote>
      )}

      {!!rows.length && withheld > 0 && (
        <div style={{ padding: "13px 0 0", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
          {/* At world scope the withheld reason is the question's OWN total
              being under the floor, not a thin slice of it — "fewer than 5
              people in the world" would be a different and sillier claim. */}
          {withheld} more {withheld === 1 ? "question is" : "questions are"} withheld
          here — {scope === "world"
            ? <>{withheld === 1 ? "it has" : "they have"} fewer than {LN_FLOOR} answers so far.</>
            : <>fewer than {LN_FLOOR} people in {shortName} have answered {withheld === 1 ? "it" : "them"} yet.</>}
        </div>
      )}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (mirror-tab.jsx).
Object.assign(globalThis, { LiveCohortBody });

export default LiveCohortBody;
