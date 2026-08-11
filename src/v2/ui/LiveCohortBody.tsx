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
// neighbours before it can say anything, a city needs AGG_FLOOR (5 by
// design; 1 while D81's launch pause holds), and unlike the circle nothing
// about a city requires knowing where the phone is.
//
// WHAT THEY DELIBERATELY DO NOT SHOW. People. Not names, not avatars, not
// "someone near you also said". D5 keeps this module out of every other
// user's documents, and the aggregates carry only counts. A field of
// strangers would be sample data wearing a live badge, which is exactly
// what this replaces.
import React from "react";
import LIVE from "../data/live";
import PLACES from "../data/places";
import { setCityAnchor } from "../data/cityAnchor";
// The floor the copy below may claim — data/floor.ts is the client's pinned
// copy of AGG_MIN_N (floor.test.ts holds them equal), currently 1 under
// D81's launch pause. Every sentence here that mentions the floor branches
// on it, because a paused floor makes "never a group smaller than 5" a
// claim the server no longer enforces.
import { AGG_FLOOR } from "../data/floor";
// An ordinary import, not a globalThis lookup — same note as LiveDuelPanel's
// import of LiveTakesPanel: both are typed TSX here, and D39's ratchet only
// moves down.
import CityPicker from "./CityPicker";

const LN_LINE = "1px solid var(--rule)";

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

// ── the Right now card (D84) ─────────────────────────────────────────
//
// Near's radius half: how many opted-in phones are foreground within
// your ~1 km cell and its eight neighbors, right now. No city involved.
// Off by default; the enable tap is what carries the OS permission
// prompt (D9's rule). The count is the only thing the server returns —
// presence docs are unreadable — and the copy claims kilometres, not the
// 500 m the coarse permission cannot measure (D84 records the Precise
// flip as its own decision).
function NearNowCard() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const near = LIVE.near;
  if (!near.supported()) return null;

  const FAIL: Record<string, string> = {
    denied: "No problem — Near stays off until you allow location.",
    unavailable: "Couldn't get a location fix. Try again outside.",
    timeout: "That took too long — indoors it often does. Try again.",
    unsupported: "This device can't share a location.",
  };

  async function turnOn() {
    setBusy(true); setErr(null);
    const res = await near.enable();
    if (!res.ok) setErr(FAIL[res.reason || "unavailable"] || FAIL.unavailable);
    setBusy(false);
  }

  const on = near.on();
  const n = near.count();
  const line = !on
    ? null
    : near.tooFew()
      ? "A few people are around you right now."
      : n == null
        ? "Counting…"
        : n === 0
          ? "Just you right now — the count updates every few minutes."
          : `${n} ${n === 1 ? "person" : "people"} with InSight within a couple of kilometres right now.`;

  return (
    <div style={{ border: LN_LINE, borderRadius: 14, background: "var(--surface-2)", padding: "13px 14px", margin: "10px 0 4px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="kicker" style={{ marginBottom: 0, flex: 1 }}>Right now, around you</span>
        <button className="press" disabled={busy}
          onClick={() => { if (on) void near.disable(); else void turnOn(); }}
          style={{ border: on ? LN_LINE : "none", borderRadius: 999, padding: "6px 13px", cursor: busy ? "default" : "pointer",
            fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12, WebkitAppearance: "none", opacity: busy ? 0.6 : 1,
            background: on ? "transparent" : "var(--accent, var(--ink))", color: on ? "var(--ink-2)" : "var(--surface)" }}>
          {busy ? "…" : on ? "Turn off" : "Turn on"}
        </button>
      </div>
      {on ? (
        <div style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.45 }}>{line}</div>
      ) : (
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.5 }}>
          See how many people with InSight are around you — a count, never
          who. While it&rsquo;s on and the app is open, your phone shares only a
          kilometre-sized grid square, unreadable to other users; it&rsquo;s
          deleted the moment you turn this off.
        </div>
      )}
      {err && <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{err}</div>}
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
      <div style={{ padding: "0 16px" }}>
        {/* The radius half needs no city (D84) — it renders above the
            city ask, so Near is never a dead end again. */}
        {scope === "city" && <NearNowCard />}
        {/* Only city and country reach this branch (world early-outs above),
            so the other arm is the Country stop — name it. "This needs a
            city" shipped there and read as the placeholder it was. */}
        <LnNote title={scope === "city" ? "Near needs a city" : "Country needs a city"}>
          Set it right here — use your location or search the list. Either way
          only the city name is saved, never your coordinates, and you can
          change it any time in your profile.
        </LnNote>
        {/* The profile's own picker, in place: "go set it in your profile"
            with nothing tappable was a dead end. Location stays one tap away
            rather than automatic — D9 records that location is never
            requested until the button is tapped, and a located city is
            suggested, never applied. setCityAnchor writes the same two
            places a profile edit reaches, so the next profile open mirrors
            this city instead of blanking it. */}
        <div style={{ maxWidth: 330, margin: "0 auto", padding: "0 4px 26px" }}>
          <CityPicker value="" onChange={setCityAnchor} />
        </div>
      </div>
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
      {scope === "city" && <NearNowCard />}
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">
          {scope === "city" ? "Around you" : scope === "country" ? "Your country" : "Everyone"}
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>{heading}</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
          {/* The floor clause only while there IS a floor — printing
              "never a group smaller than 1" would be vacuously true and
              read as a typo; printing 5 while paused would be false. */}
          {scope === "world"
            ? `Everyone who answered today. Counts only — never who${AGG_FLOOR > 1 ? `, and never a group smaller than ${AGG_FLOOR}` : ""}.`
            : `Everyone who picked this ${scope}, on today's questions. Counts only — never who${AGG_FLOOR > 1 ? `, and never a group smaller than ${AGG_FLOOR}` : ""}.`}
        </div>
      </div>

      {rows.map((r) => <LnBar key={r.qid} row={r} accent={accent} />)}

      {!rows.length && (
        <LnNote title={`${scope === "world" ? "Today" : shortName} is still filling up`}>
          {AGG_FLOOR > 1 ? (
            <>A cohort appears once at least {AGG_FLOOR} people in it have answered.
            Until then the split is withheld rather than shown thin — the floor is
            enforced on the server, not here.</>
          ) : (
            // The paused floor (D81): counts publish from the first answer,
            // so an empty panel means zero, not withheld.
            <>No answers here yet — the first one starts the count.</>
          )}
        </LnNote>
      )}

      {!!rows.length && withheld > 0 && (
        <div style={{ padding: "13px 0 0", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
          {/* At world scope the withheld reason is the question's OWN total
              being under the floor, not a thin slice of it — "fewer than 5
              people in the world" would be a different and sillier claim.

              At floor 1 the whole absent≠zero doctrine inverts: any cell
              with one answer publishes, so an absent cell IS zero (publish
              lag aside) and the line says so instead of claiming a
              withholding the server no longer performs. */}
          {AGG_FLOOR > 1 ? (
            <>{withheld} more {withheld === 1 ? "question is" : "questions are"} withheld
            here — {scope === "world"
              ? <>{withheld === 1 ? "it has" : "they have"} fewer than {AGG_FLOOR} answers so far.</>
              : <>fewer than {AGG_FLOOR} people in {shortName} have answered {withheld === 1 ? "it" : "them"} yet.</>}</>
          ) : (
            <>{withheld} more {withheld === 1 ? "question has" : "questions have"} no
            answers {scope === "world" ? "yet" : <>from {shortName} yet</>}.</>
          )}
        </div>
      )}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (mirror-tab.jsx).
Object.assign(globalThis, { LiveCohortBody });

export default LiveCohortBody;
