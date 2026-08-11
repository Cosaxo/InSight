// LiveCohortBody — the Mirror's geographic populations in live mode (D9).
//
// Serves both Near (your city) and World (your country / everyone), because
// after D9 they are the same question at three radii and there is no reason
// for three renderers to disagree about what an empty cell means.
//
// WHAT NEAR USED TO BE. A field of six named neighbours ("Sigrid Bø, a few
// streets away, 88% match") drawn from sample-data.js, headed "2,847 within
// 5 km · Grünerløkka". None of it was ever real. The v1 backend that would
// have made it real bucketed users into ~5 km geohash cells behind a
// 20-person floor, and it never produced a single cell — the aggregator
// read a top-level `geohash` field while the writer wrote a nested one
// (D2). Nothing in v2 ever called it.
//
// WHAT THESE ARE NOW. The same public aggregates everything else here
// reads: exact counts, at the radius you picked, published from the first
// answer (D94 — no floor, no suppression, no withheld cells). Near is a
// redefinition rather than a repair, and it is the honest one: unlike the
// old 5 km circle, nothing about a city requires knowing where the phone
// is.
//
// WHAT THIS PANEL STILL DOES NOT SHOW, AND WHY THAT IS NOW A GAP. People.
// Not because it may not — D94 makes every answer and profile readable, so
// a named "who in Oslo picked Beach" is a legitimate surface and the one
// this panel most obviously wants. It is missing because the READ PATH does
// not exist yet: the client would need a collection-group query on answers
// plus batched name resolution, neither of which any module here does. This
// is unbuilt, not refused. Until it lands, counts are what there is — and
// an empty panel means zero, never "hidden".
import React from "react";
import LIVE from "../data/live";
import PLACES from "../data/places";
import { setCityAnchor } from "../data/cityAnchor";
// The on-device fix→city resolver (D9's containment: a coordinate enters
// locate.ts and does not leave it). Called here only under D92's condition —
// the Right-now counter is already ON, so the location grant exists and the
// city name is strictly less information than the grid square presence
// already shares.
import { locateCity } from "../data/locate";
// "Does this question have any answers yet?" — an existence test, and
// since D94 the only test there is (data/floor.ts and its constants are
// gone with the floor they mirrored).
import { hasPublishedCounts } from "../data/deck";
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

  const needsCity = scope !== "world" && !city;
  const nearOn = LIVE.near.on();
  // D92: when the Right-now counter is ON, the user has an explicit,
  // revocable location grant standing for a live feature — so Near stops
  // asking and derives the city from the same grant. The datum applied is
  // still only the catalogue key (locateCity's containment), which is
  // strictly LESS information than the ~1 km presence cell the counter
  // already shares. D9's suggest-never-apply rule stays for every other
  // path: with the counter off, the picker below is unchanged and its
  // located city remains a suggestion.
  const [finding, setFinding] = React.useState(false);
  // One attempt per on-transition: a failed fix must not re-fire on every
  // notify, and turning the counter off then on again is the retry.
  const derivedFor = React.useRef(false);
  React.useEffect(() => {
    if (!nearOn) { derivedFor.current = false; return; }
    if (!needsCity || derivedFor.current) return;
    derivedFor.current = true;
    let alive = true;
    setFinding(true);
    void locateCity().then((r) => {
      if (!alive) return;
      setFinding(false);
      // Applied, not suggested (D92). On any failure the ask below is
      // already the fallback, and the picker's own "Use my location"
      // carries the per-reason copy for a deliberate retry.
      if (r.ok) setCityAnchor(r.key);
    });
    return () => { alive = false; };
  }, [needsCity, nearOn]);

  // City and country slice the published breakdown by the viewer's own
  // bucket; the globe is the plain total. Nothing here reads another
  // user's document to find out which bucket that is (D5).
  if (needsCity) {
    return (
      <div style={{ padding: "0 16px" }}>
        {/* The radius half needs no city (D84) — it renders above the
            city ask, so Near is never a dead end again. */}
        {scope === "city" && <NearNowCard />}
        {/* Only city and country reach the ask below (world early-outs
            above), so the non-Near arm is the Country stop — name it.
            "This needs a city" shipped there and read as the placeholder
            it was. */}
        {finding ? (
          <LnNote title="Finding your city…">
            Location is already on for the count, so your city is being
            matched on this phone — only its name will be saved, never your
            coordinates. You can also pick it yourself below.
          </LnNote>
        ) : (
          <LnNote title={scope === "city" ? "Near needs a city" : "Country needs a city"}>
            Set it right here — use your location or search the list. Either
            way only the city name is saved, never your coordinates, and you
            can change it any time in your profile.
            {scope === "city" && !nearOn && LIVE.near.supported() && (
              <> Turning on the count above fills it in for you, from the
              same location grant.</>
            )}
          </LnNote>
        )}
        {/* The profile's own picker, in place: "go set it in your profile"
            with nothing tappable was a dead end. With the counter OFF,
            location stays one tap away rather than automatic — D9 records
            that a located city is suggested, never applied, and D92 narrows
            that to exactly the no-grant state. setCityAnchor writes the
            same two places a profile edit reaches, so the next profile open
            mirrors this city instead of blanking it. */}
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
  // Questions with no answers from this cohort yet. Since D94 nothing is
  // withheld, so an absent cell means exactly zero — the counter survives
  // only so an empty row is explained rather than silently missing.
  let empty = 0;
  for (const q of LIVE.deck()) {
    const agg = LIVE.aggFor(q.id);
    if (!agg) continue;
    let cell: Record<string, number> | undefined;
    let n = 0;
    if (scope === "world") {
      // The globe is the aggregate itself.
      if (!hasPublishedCounts(agg)) { empty++; continue; }
      cell = agg.counts;
      n = agg.total || 0;
    } else {
      const dim = agg.by?.[scope];
      cell = dim?.[scope === "city" ? city : country];
      if (dim && !cell) empty++;
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
          {scope === "world"
            ? "Everyone who answered today."
            : `Everyone who picked this ${scope}, on today's questions.`}
        </div>
      </div>

      {rows.map((r) => <LnBar key={r.qid} row={r} accent={accent} />)}

      {!rows.length && (
        <LnNote title={`${scope === "world" ? "Today" : shortName} is still filling up`}>
          No answers here yet — the first one starts the count.
        </LnNote>
      )}

      {!!rows.length && empty > 0 && (
        <div style={{ padding: "13px 0 0", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
          {/* An absent cell is zero, not a withholding — D94 removed the
              floor, so there is nothing left for this line to apologise
              for. It just says the row is empty. */}
          {empty} more {empty === 1 ? "question has" : "questions have"} no
          answers {scope === "world" ? "yet" : <>from {shortName} yet</>}.
        </div>
      )}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (mirror-tab.jsx).
Object.assign(globalThis, { LiveCohortBody });

export default LiveCohortBody;
