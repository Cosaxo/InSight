// LiveCohortBody — the Mirror's geographic populations in live mode:
// City, Country and the globe (D111).
//
// One renderer for all three, because they are the same question at three
// radii and three renderers would eventually disagree about what an empty
// cell means. Near is NOT here any more: D111 un-folded D9's "Near is
// your city", so Near is the presence counter (ui/NearLiveBody.tsx) and
// the city cohort lives at its own City stop, where the prototype always
// put it.
//
// WHAT THE CITY STOP USED TO BE, twice over. In the prototype: a field of
// kindred strangers ("Anders K. · Torshov · 92%") drawn from constants in
// mirror-field-pops.jsx — never real. In live mode until D111: nothing —
// the stop was dropped from the ruler entirely. The v1 backend that was
// supposed to make the neighbours real bucketed users into ~5 km geohash
// cells behind a 20-person floor and never produced a single cell (D2).
//
// WHAT THESE ARE NOW. The same public aggregates everything else reads —
// exact counts, published from the first answer (D98) — plus the
// constellation the prototype promised, computed instead of invented
// (LiveSimilarityField, D112): people of your city by score likeness,
// cities and countries by their real average-score profiles.
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
// since D98 the only test there is (data/floor.ts and its constants are
// gone with the floor they mirrored).
import { hasPublishedCounts } from "../data/deck";
// The Answers lens's sort key (D100) — normalised so a four-way and a
// binary can be ranked against each other without the option count
// deciding it.
import { divisiveness } from "../data/cohort";
// The four lens BODIES (D99), loaded when a lens tab is first opened
// (D101, D119).
//
// Lazy rather than static for the bundle budget: the four lens bodies are
// ~7 KB of the entry chunk, which is more than the headroom MAX_CHUNK_KB
// deliberately leaves. Since D119 the deferral is also exact rather than
// merely likely — the tab row itself is static and instant, and this
// chunk is fetched only once someone taps People, Compare, Scores or
// Explore, which is the same moment its cost becomes worth paying.
const LiveMirrorLenses = React.lazy(() => import("./LiveMirrorLenses"));
// The constellation field (D112), lazy for the same bundle-budget reason
// — it is a whole SVG canvas plus the similarity folds, and the stop's
// counts must not wait on it. It is the Overview tab since D119, so it
// too now loads on a tap rather than on arrival.
const SimilaritySection = React.lazy(() => import("./LiveSimilarityField"));
// The tab row (D119) — static, because it IS the stop's navigation and a
// suspense gap where the tabs should be is a stop that looks broken.
import MirrorLensTabs from "./MirrorLensTabs";
import { LENS_LABEL, TAB_LABEL, type LensTab } from "./lensTabs";
import type { LensId, LensQuestion } from "./lensDefs";
import { byOf } from "../data/cohort";
// An ordinary import, not a globalThis lookup — same note as LiveDuelPanel's
// import of LiveTakesPanel: both are typed TSX here, and D39's ratchet only
// moves down.
import CityPicker from "./CityPicker";

const LN_LINE = "1px solid var(--rule)";

export type CohortScope = "city" | "country" | "world";

type Row = {
  qid: string; text: string; options: string[];
  cell: Record<string, number>; n: number;
  /** Dense per-option counts for this cohort — the cell, as an array. */
  counts: number[];
  /** The bank's subject path (D100); undefined for a pre-D100 seed. */
  branch?: string;
  /** The viewer's own pick, -1 when they have not answered. */
  mine: number;
};

// The three orderings the Answers lens offers.
//
// "Newest" is in the prototype's list and is deliberately NOT here. The
// archive spans any day the deck rotation has reached, and nothing the
// client holds dates an answer: the aggregate carries no timestamp, and a
// question's bank position is where it entered the bank, not when it was
// asked. Offering a "Newest" that silently means "highest seq" would be a
// label that is wrong about roughly six days in seven.
const SORTS = [
  { id: "answers", label: "Most answers" },
  { id: "divisive", label: "Most divisive" },
  { id: "agreed", label: "Most agreed" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

function LnBar({ row, accent, open, onToggle }: {
  row: Row; accent: string; open: boolean; onToggle: () => void;
}) {
  const pct = row.options.map((_, i) => Math.round(((row.cell[String(i)] || 0) / row.n) * 100));
  // Rounding drift lands on the largest share so the bar is exactly full.
  const drift = 100 - pct.reduce((a, b) => a + b, 0);
  if (drift) pct[pct.indexOf(Math.max(...pct))] += drift;
  const shade = (i: number) => `color-mix(in oklch, ${accent} ${Math.max(70 - i * 22, 12)}%, var(--surface-3))`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "13px 0", borderBottom: LN_LINE }}>
      {/* The whole row is the control. A separate chevron would put a
          28px target next to a full-width one that does the same thing. */}
      <button onClick={onToggle} aria-expanded={open} style={{
        border: "none", background: "none", padding: 0, margin: 0, textAlign: "left",
        cursor: "pointer", WebkitAppearance: "none", display: "flex", alignItems: "baseline", gap: 8,
      }}>
        <span style={{ flex: 1, fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.35, color: "var(--ink)" }}>{row.text}</span>
        <span aria-hidden="true" style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 800, color: "var(--ink-3)" }}>
          {open ? "–" : "+"}
        </span>
      </button>
      <div style={{ display: "flex", height: 30, border: LN_LINE, borderRadius: 9, overflow: "hidden", background: "var(--surface)" }}>
        {pct.map((p, i) => (
          <span key={i} style={{
            width: `${p}%`, display: "flex", alignItems: "center", justifyContent: "center",
            background: shade(i), color: i < 2 ? "#fff" : "var(--ink)",
            fontSize: 10.5, fontWeight: 800, overflow: "hidden",
          }}>{p >= 14 ? `${p}%` : ""}</span>
        ))}
      </div>
      {open ? (
        // Expanded: one line per option, so a share too thin to label on
        // the bar still has a number. Your own pick is named rather than
        // only tinted — a colour difference is not a reading.
        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 2 }}>
          {row.options.map((o, i) => {
            const c = row.cell[String(i)] || 0;
            const isMine = i === row.mine;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: shade(i) }} />
                <span style={{ flex: 1, fontWeight: isMine ? 800 : 600, color: isMine ? "var(--ink)" : "var(--ink-2)" }}>
                  {o}{isMine && <span style={{ fontWeight: 700, color: "var(--ink-3)" }}> · your answer</span>}
                </span>
                <span style={{ fontWeight: 600, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                  {c.toLocaleString()}
                </span>
                <span style={{ width: 36, textAlign: "right", fontWeight: 800, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                  {pct[i]}%
                </span>
              </div>
            );
          })}
          <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginTop: 2 }}>
            {row.n.toLocaleString()} {row.n === 1 ? "answer" : "answers"}
            {row.mine < 0 && " · you have not answered this one"}
          </span>
        </div>
      ) : (
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
      )}
    </div>
  );
}

// The filter + sort strip above the rows. Only rendered when there is
// something to filter: one branch and four rows does not need a chip row
// telling you so.
function LnChips({ value, options, onPick }: {
  value: string; options: Array<{ id: string; label: string }>; onPick: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onPick(o.id)} aria-pressed={value === o.id} style={{
          border: LN_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
          fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12, WebkitAppearance: "none",
          background: value === o.id ? "var(--ink)" : "var(--surface)",
          color: value === o.id ? "var(--surface)" : "var(--ink-2)",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

// The Right now card (D84) lived here while Near was the city stop (D9);
// it moved to ui/NearLiveBody.tsx when D111 gave presence its own stop.

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
  // Answers-lens controls (D100). One row open at a time: two expanded
  // distributions push the second off the screen anyway.
  const [branch, setBranch] = React.useState("");
  const [sort, setSort] = React.useState<SortId>("answers");
  const [openQid, setOpenQid] = React.useState<string | null>(null);
  // Which tab of the stop is showing (D119). Per-stop rather than lifted:
  // the three scopes mount as separate elements (mirror-tab keys the body
  // on the zoom), so each stop keeps its own place and switching scope
  // lands on Answers, which is the one tab every scope always has.
  const [tab, setTab] = React.useState<string>("answers");

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
        {/* Only city and country reach the ask below (world early-outs
            above) — name the stop that is asking. "This needs a city"
            shipped once and read as the placeholder it was. */}
        {finding ? (
          <LnNote title="Finding your city…">
            Location is already on for the count, so your city is being
            matched on this phone — only its name will be saved, never your
            coordinates. You can also pick it yourself below.
          </LnNote>
        ) : (
          <LnNote title={scope === "city" ? "City needs your city" : "Country needs a city"}>
            Set it right here — use your location or search the list. Either
            way only the city name is saved, never your coordinates, and you
            can change it any time in your profile.
            {scope === "city" && !nearOn && LIVE.near.supported() && (
              <> Turning on the count at the Near stop fills it in for you,
              from the same location grant.</>
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

  // Every question this device holds an aggregate for, not just the
  // seven-day pager (D100). The pager was the wrong source for a panel
  // whose job is "how did this place answer": it made the Answers lens a
  // week's worth of rows, which is too few to be worth filtering and far
  // too few for Scores to find a rating question in.
  const archive = LIVE.aggregated();
  const myVotes = LIVE.myVotes();

  const rows: Row[] = [];
  // Questions with no answers from this cohort yet. Since D98 nothing is
  // withheld, so an absent cell means exactly zero — the counter survives
  // only so an empty row is explained rather than silently missing.
  let empty = 0;
  for (const q of archive) {
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
    const options = q.options.map((o) => o.label);
    const mine = myVotes[q.id];
    rows.push({
      qid: q.id, text: q.text, options, cell, n,
      counts: options.map((_, i) => cell[String(i)] || 0),
      branch: q.branch,
      mine: mine == null ? -1 : Number(mine),
    });
  }

  // The same archive, shaped for the lenses. Assembled once here rather
  // than four times inside them: all four walk every question, and the
  // questions plus their aggregates are already in hand.
  //
  // `mine` reads the store's own vote map, so Compare can mark your pick
  // without a second source that could disagree with the card you voted on.
  const lensQs: LensQuestion[] = archive.map((q) => {
    const agg = LIVE.aggFor(q.id);
    const counts = (q.options || []).map((_, i) => ((agg?.counts || {})[String(i)] as number) || 0);
    const mine = myVotes[q.id];
    return {
      id: q.id,
      text: q.text,
      options: (q.options || []).map((o) => o.label),
      counts,
      by: byOf(agg),
      mine: mine == null ? -1 : Number(mine),
      type: q.type,
      branch: q.branch,
    };
  }).filter((q) => q.options.length > 0);

  // ── the Answers lens's own controls (D100) ──
  //
  // Branch chips come from the rows in view rather than from the bank, so
  // a subject with nothing to show here never offers itself as a filter
  // that leads to an empty list.
  const branchN: Record<string, number> = {};
  for (const r of rows) if (r.branch) branchN[r.branch] = (branchN[r.branch] || 0) + 1;
  const branches = Object.keys(branchN).sort((a, b) => branchN[b] - branchN[a] || a.localeCompare(b));
  const pickedBranch = branches.includes(branch) ? branch : "";
  // divisiveness once per row, not once per comparison. Inside the
  // comparator it re-runs O(n log n) times per render; measured against
  // today's bank that is the difference between ~360 µs and ~100 µs for
  // the sort, and over half of this whole panel's per-notify recompute —
  // a gap that only widens, because the archive grows with the bank
  // (D97) and this panel re-renders on every store notify.
  const dOf = new Map(rows.map((r) => [r.qid, divisiveness(r.counts)]));
  const shown = rows
    .filter((r) => !pickedBranch || r.branch === pickedBranch)
    .sort((a, b) => (
      sort === "answers" ? b.n - a.n
        : sort === "divisive" ? dOf.get(b.qid)! - dOf.get(a.qid)!
          // Most agreed: least divisive first, but a question with a
          // single answer is 0 on this scale and would head the list
          // saying nothing. Ties break toward the bigger room.
          : dOf.get(a.qid)! - dOf.get(b.qid)! || b.n - a.n
    ));

  // ── the stop's tabs (D119) ──
  //
  // Answers, then the constellation, then the four lenses — the prototype's
  // nav v2 row (spec/mirror-field.jsx), with Answers leading for the reason
  // recorded on TAB_LABEL. Every tab here can draw something for every
  // cohort scope, so the row is fixed rather than assembled per scope: a
  // tab that opens onto "nothing yet" is a true reading of this population
  // and disappearing tabs would make the row's shape a second, quieter
  // claim about the data.
  const tabs: LensTab[] = [
    { id: "answers", label: TAB_LABEL.answers },
    { id: "overview", label: TAB_LABEL.overview },
    ...(Object.keys(LENS_LABEL) as LensId[]).map((id) => ({ id, label: LENS_LABEL[id] })),
  ];
  const openTab = tabs.some((t) => t.id === tab) ? tab : "answers";

  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px" }}>
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">
          {scope === "city" ? "Your city" : scope === "country" ? "Your country" : "Everyone"}
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>{heading}</div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
          {/* Was "on today's questions" when this read the seven-day
              pager. It reads the archive now (D100), so the old line
              would have under-claimed by however long the user has
              been answering. */}
          {scope === "world"
            ? "Everyone who has answered, on every question with answers."
            : `Everyone who picked this ${scope}, on every question they have answered.`}
        </div>
      </div>

      {/* Above the bodies, under the heading: the row is this stop's
          navigation, and the ruler above it is the app's. Two levels of
          nav in that order is what the prototype's nav v2 is — WHO, then
          WHAT. */}
      <MirrorLensTabs tabs={tabs} open={openTab} onOpen={setTab} />

      {openTab === "answers" && (
        <div className="fade-in" role="tabpanel" aria-label={TAB_LABEL.answers}>
          {/* Filter and sort only appear once they would do something. Two
              rows and one subject do not need a control strip explaining
              that there is nothing to narrow. */}
          {rows.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "10px 0 4px" }}>
              {branches.length > 1 && (
                <LnChips
                  value={pickedBranch}
                  onPick={(id) => { setBranch(id); setOpenQid(null); }}
                  options={[{ id: "", label: `All ${rows.length}` },
                    ...branches.map((b) => ({ id: b, label: `${b} ${branchN[b]}` }))]}
                />
              )}
              <LnChips
                value={sort}
                onPick={(id) => setSort(id as SortId)}
                options={SORTS.map((s) => ({ id: s.id, label: s.label }))}
              />
            </div>
          )}

          {shown.map((r) => (
            <LnBar key={r.qid} row={r} accent={accent}
              open={openQid === r.qid}
              onToggle={() => setOpenQid(openQid === r.qid ? null : r.qid)} />
          ))}

          {!rows.length && (
            <LnNote title={`${scope === "world" ? "Today" : shortName} is still filling up`}>
              No answers here yet — the first one starts the count.
            </LnNote>
          )}

          {/* A branch chip can only be picked when it has rows, so this is
              unreachable today — it exists because the filter and the row
              list are computed separately and a future source that drops
              rows after the chips are built should say so rather than
              render a blank stretch. */}
          {!!rows.length && !shown.length && (
            <LnNote title={`Nothing under ${pickedBranch}`}>
              No answers in that subject here yet.
            </LnNote>
          )}

          {!!rows.length && empty > 0 && (
            <div style={{ padding: "13px 0 0", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
              {/* An absent cell is zero, not a withholding — D98 removed the
                  floor, so there is nothing left for this line to apologise
                  for. It just says the row is empty. */}
              {empty} more {empty === 1 ? "question has" : "questions have"} no
              answers {scope === "world" ? "yet" : <>from {shortName} yet</>}.
            </div>
          )}
        </div>
      )}

      {/* The constellation (D112): people of your city by score likeness,
          cities/countries by their real average-score profiles. Its own
          tab since D119 — it used to lead the stop, which is right when it
          has something to draw and is the whole screen when it does not. */}
      {openTab === "overview" && (
        <div className="fade-in" role="tabpanel" aria-label={TAB_LABEL.overview}>
          <React.Suspense fallback={null}>
            <SimilaritySection scope={scope} />
          </React.Suspense>
        </div>
      )}

      {openTab !== "answers" && openTab !== "overview" && (
        <div className="fade-in" role="tabpanel" aria-label={LENS_LABEL[openTab as LensId]}>
          <React.Suspense fallback={null}>
            <LiveMirrorLenses lens={openTab as LensId} qs={lensQs} shortName={shortName} />
          </React.Suspense>
        </div>
      )}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (mirror-tab.jsx).
Object.assign(globalThis, { LiveCohortBody });

export default LiveCohortBody;
