// LiveNearBody — Mirror › Near, in live mode (D9).
//
// WHAT NEAR USED TO BE. A field of six named neighbours ("Sigrid Bø, a few
// streets away, 88% match") drawn from sample-data.js, headed "2,847 within
// 5 km · Grünerløkka". None of it was ever real. The v1 backend that would
// have made it real bucketed users into ~5 km geohash cells behind a
// 20-person floor, and it never produced a single cell — the aggregator
// read a top-level `geohash` field while the writer wrote a nested one
// (D2). Nothing in v2 ever called it.
//
// WHAT NEAR IS NOW. Your city, from the same k-floored public aggregates
// everything else here reads. That is a redefinition, not a repair, and it
// is the honest one: a 5 km circle needs 20 neighbours before it can say
// anything at all, whereas a city needs 5 people — and unlike the circle,
// nothing about it requires knowing where the phone is.
//
// WHAT IT DELIBERATELY DOES NOT SHOW. People. Not names, not avatars, not
// "someone near you also said". D5 keeps this module out of every other
// user's documents, and the only thing the aggregates carry is counts. A
// field of strangers would be sample data wearing a live badge, which is
// exactly what this replaces.
import React from "react";
import LIVE from "../data/live";
import PLACES from "../data/places";

const LN_LINE = "1px solid var(--rule)";
// Must match AGG_MIN_N in functions/src/v2.ts. Shown to the user, so a
// drift here is a lie about the floor rather than a cosmetic bug.
const LN_FLOOR = 5;

type Row = { qid: string; text: string; options: string[]; cell: Record<string, number>; n: number };

function LnBar({ row }: { row: Row }) {
  const pct = row.options.map((_, i) => Math.round(((row.cell[String(i)] || 0) / row.n) * 100));
  // Rounding drift lands on the largest share so the bar is exactly full.
  const drift = 100 - pct.reduce((a, b) => a + b, 0);
  if (drift) pct[pct.indexOf(Math.max(...pct))] += drift;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "13px 0", borderBottom: LN_LINE }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.35, color: "var(--ink)" }}>{row.text}</div>
      <div style={{ display: "flex", height: 30, border: LN_LINE, borderRadius: 9, overflow: "hidden", background: "var(--surface)" }}>
        {pct.map((p, i) => (
          <span key={i} style={{
            width: `${p}%`, display: "flex", alignItems: "center", justifyContent: "center",
            background: `color-mix(in oklch, var(--c-around) ${Math.max(70 - i * 22, 12)}%, var(--surface-3))`,
            color: i < 2 ? "#fff" : "var(--ink)", fontSize: 10.5, fontWeight: 800, overflow: "hidden",
          }}>{p >= 14 ? `${p}%` : ""}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
        {row.options.map((o, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--ink-2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block",
              background: `color-mix(in oklch, var(--c-around) ${Math.max(70 - i * 22, 12)}%, var(--surface-3))` }} />
            {o}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)" }}>
          {row.n} {row.n === 1 ? "answer" : "answers"}
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

function LiveNearBody() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);

  const city = LIVE.myCity;
  const place = city ? PLACES.parse(city) : null;

  if (!city) {
    return (
      <LnNote title="Near needs a city">
        Pick your city in your profile and this becomes the daily, answered by
        everyone else who picked it. No location permission, no GPS — just the
        city you choose from a list.
      </LnNote>
    );
  }

  const rows: Row[] = [];
  // How many of today's questions the viewer has answered but whose city
  // cell is still withheld. Told to them plainly: an absent cell means
  // BELOW THE FLOOR, not zero, and a silent gap reads as "nobody answered".
  let withheld = 0;
  for (const q of LIVE.deck()) {
    const byCity = LIVE.aggFor(q.id)?.by?.city;
    const cell = byCity?.[city];
    if (!cell) {
      if (byCity) withheld++;
      continue;
    }
    const n = Object.values(cell).reduce((a, b) => a + b, 0);
    rows.push({ qid: q.id, text: q.text, options: q.options.map((o) => o.label), cell, n });
  }

  const label = place ? PLACES.label(place) : city;

  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px" }}>
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">Around you</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>{label}</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
          Everyone who picked this city, on today&apos;s questions. Counts only —
          never who, and never a group smaller than {LN_FLOOR}.
        </div>
      </div>

      {rows.map((r) => <LnBar key={r.qid} row={r} />)}

      {!rows.length && (
        <LnNote title={`${place ? place.name : city} is still filling up`}>
          A cohort appears once at least {LN_FLOOR} people in it have answered.
          Until then your city&apos;s split is withheld rather than shown thin —
          the floor is enforced on the server, not here.
        </LnNote>
      )}

      {!!rows.length && withheld > 0 && (
        <div style={{ padding: "13px 0 0", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
          {withheld} more {withheld === 1 ? "question is" : "questions are"} withheld
          here — fewer than {LN_FLOOR} people in {place ? place.name : city} have
          answered {withheld === 1 ? "it" : "them"} yet.
        </div>
      )}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (mirror-tab.jsx).
Object.assign(globalThis, { LiveNearBody });

export default LiveNearBody;
