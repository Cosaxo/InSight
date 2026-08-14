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
// The Answers tab's list, in the prototype's row design (D120). An
// ordinary import, not lazy: this body IS the default tab, and it rides
// this module's own lazy chunk (D119) either way.
import LiveAnswerRows, { type AnswerRow } from "./LiveAnswerRows";
import { DEFAULT_STOP_TAB, LENS_LABEL, STOP_TABS, TAB_LABEL, lensesFor, type LensTab } from "./lensTabs";
import type { LensId, LensQuestion } from "./lensDefs";
import { byOf } from "../data/cohort";
// An ordinary import, not a globalThis lookup — same note as LiveDuelPanel's
// import of LiveTakesPanel: both are typed TSX here, and D39's ratchet only
// moves down.
import CityPicker from "./CityPicker";

export type CohortScope = "city" | "country" | "world";


// The Right now card (D84) lived here while Near was the city stop (D9);
// it moved to ui/NearLiveBody.tsx when D111 gave presence its own stop.

/**
 * Compact figure for the hero — 340, 9.4k, 1.2M.
 *
 * Deliberately NOT spec/sample-data.js's `fmtPop`, which is the same five
 * lines. That module is the demo persona's data; a live body importing it
 * for a number formatter is the coupling D1's discipline exists to
 * prevent, and the next person to grep "who reads sample-data" would find
 * a live file and have to work out that it was only arithmetic.
 */
function fmtReach(n: number): string {
  if (n >= 1e6) { const v = n / 1e6; return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}M`; }
  if (n >= 1000) { const v = n / 1000; return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}k`; }
  return String(n);
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
  // The Answers tab's own controls (branch chips, sort, which row is open)
  // moved into LiveAnswerRows at D120 — they belong to the list, and the
  // host had them only because the list used to be inline.
  //
  // Which tab of the stop is showing (D119). Per-stop rather than lifted:
  // the three scopes mount as separate elements (mirror-tab keys the body
  // on the zoom), so each stop keeps its own place and switching scope
  // lands on Answers, which is the one tab every scope always has.
  const [tab, setTab] = React.useState<string>(DEFAULT_STOP_TAB);

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
  // The stop's own colour. mirror-tab sets --accent per POP, and all three
  // geographic zooms share one pop — so without this City, Country and
  // World would draw in the same ink and the axis would stop shading from
  // near to far. Set on the root rather than threaded as a prop: the rows,
  // the stack, the chips and the lens bodies all read var(--accent), and
  // one declaration reaches every one of them.
  const accent =
    scope === "city" ? "var(--c-around)" : scope === "country" ? "var(--c-city)" : "var(--c-world)";

  // Every question this device holds an aggregate for, not just the
  // seven-day pager (D100). The pager was the wrong source for a panel
  // whose job is "how did this place answer": it made the Answers lens a
  // week's worth of rows, which is too few to be worth filtering and far
  // too few for Scores to find a rating question in.
  const archive = LIVE.aggregated();
  const myVotes = LIVE.myVotes();

  const rows: AnswerRow[] = [];
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
      qid: q.id, text: q.text, options, n,
      counts: options.map((_, i) => cell[String(i)] || 0),
      branch: q.branch,
      // D120's headline and histogram read differently for `rating` and
      // `scale`; the row used to drop the type because a stacked bar does
      // not care what kind of question it is.
      type: q.type,
      mine: mine == null ? -1 : Number(mine),
    });
  }

  /**
   * The hero figure: how many people this mirror reflects.
   *
   * THE PROTOTYPE'S NUMBER DOES NOT EXIST HERE, and that is the whole
   * problem this solves rather than copies. "12.6k in Oslo" is a
   * RESIDENTS count — a population, which the app has never had and
   * cannot get — and LiveSimilarityField's honesty rule 2 refused it for
   * exactly that reason: population is not answers.
   *
   * What D98 does make available is this: counts are exact and publish
   * from the first answer, and one person answers a question at most once
   * (create-only, D5/D86 — an edit MOVES a vote between options, it never
   * adds one). So the largest single-question count from this cohort is a
   * number of DISTINCT PEOPLE, not of answers. Summing across questions
   * would not be — it would count the same person once per question they
   * answered, which is the mistake this is written out to avoid.
   *
   * It is a floor, not a total: someone who answered only a question this
   * device holds no aggregate for is not in it. A floor is the right
   * direction to be wrong in for a figure this size, and the unit beside
   * it says "have answered" rather than "live here", so the sentence is
   * true as written.
   */
  const reach = rows.reduce((m, r) => Math.max(m, r.n), 0);

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

  // ── the stop's tabs (D119, reshaped at D136) ──
  //
  // Answers, then the lenses this scope has. The constellation moved out of
  // the row at D136 to sit above it, and Foresight left the Mirror
  // entirely.
  //
  // ASSEMBLED PER SCOPE SINCE D147, which reverses the note this comment
  // used to carry. It said a fixed row was right because "a tab that opens
  // onto nothing yet is a true reading of this population" — true, and
  // about a different thing. Explore is not empty at City; it is
  // MISPLACED there. Its reading is "how does this slice differ from
  // everyone", and at City the baseline it compares against is the city,
  // so the sentence it draws is not the one it is written to say
  // (lensTabs.ts lensesFor). Data being thin is a reason to keep a tab;
  // a reading not applying is a reason not to offer one.
  const tabs: LensTab[] = [
    ...STOP_TABS.map((id) => ({ id, label: TAB_LABEL[id] })),
    ...lensesFor(scope).map((id) => ({ id, label: LENS_LABEL[id] })),
  ];
  const openTab = tabs.some((t) => t.id === tab) ? tab : DEFAULT_STOP_TAB;

  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px", "--accent": accent } as React.CSSProperties}>
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">
          {scope === "city" ? "Your city" : scope === "country" ? "Your country" : "Everyone"}
        </div>
        {/* The prototype's MFHeader shape restored (D135): kicker, then a
            FIGURE, then what it counts. The stop used to lead with the
            place name alone, which says where the mirror is pointed and
            nothing about how big it is — and "how many people am I being
            measured against" is the first thing a population screen owes
            its reader.

            The figure is `reach` below, and its unit is written out rather
            than implied because the honest number is not the one the
            prototype showed. See the note there. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 29, letterSpacing: "-0.01em", color: "var(--ink)", lineHeight: 1 }}>
            {reach ? fmtReach(reach) : "—"}
          </span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", minWidth: 0 }}>
            {reach
              ? <>{reach === 1 ? "person has" : "people have"} answered {scope === "world" ? "somewhere" : <>in {shortName}</>}</>
              : <>nobody has answered {scope === "world" ? "yet" : <>in {shortName} yet</>}</>}
          </span>
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 6 }}>{heading}</div>
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

      {/* The constellation (D112), and the head of the stop rather than a
          tab in it (D136): people of your city by score likeness,
          cities/countries by their real average-score profiles. It draws
          ABOVE the row and stays drawn whatever the row is showing —
          "you at the centre, them arranged around you" is what the stop
          IS, and the prototype puts it here too (MFHeader → field → row).
          Its empty arms still route: SfGoAnswers opens the Answers tab,
          and the host owns the tab state, so the field cannot do it. */}
      <div role="region" aria-label={TAB_LABEL.overview}>
        <React.Suspense fallback={null}>
          <SimilaritySection scope={scope} onGoAnswers={() => setTab("answers")} />
        </React.Suspense>
      </div>

      {/* Under the field: the row is this stop's navigation, and the ruler
          above it is the app's. Two levels of nav in that order is what the
          prototype's nav v2 is — WHO, then WHAT. */}
      <MirrorLensTabs tabs={tabs} open={openTab} onOpen={setTab} />

      {openTab === "answers" && (
        <div className="fade-in" role="tabpanel" aria-label={TAB_LABEL.answers}>
          <LiveAnswerRows
            rows={rows}
            whom={shortName}
            emptyNote={
              <LnNote title={`${scope === "world" ? "Today" : shortName} is still filling up`}>
                No answers here yet — the first one starts the count.
              </LnNote>
            }
          />
          {!!rows.length && empty > 0 && (
            <div style={{ padding: "2px 0 0", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>
              {/* An absent cell is zero, not a withholding — D98 removed the
                  floor, so there is nothing left for this line to apologise
                  for. It just says the row is empty. Stated by the HOST
                  rather than the list, because only the host knows the
                  scope and "from the world yet" is not a sentence. */}
              {empty} more {empty === 1 ? "question has" : "questions have"} no
              answers {scope === "world" ? "yet" : <>from {shortName} yet</>}.
            </div>
          )}
        </div>
      )}

      {openTab !== "answers" && (
        <div className="fade-in" role="tabpanel" aria-label={LENS_LABEL[openTab as LensId]}>
          <React.Suspense fallback={null}>
            <LiveMirrorLenses lens={openTab as LensId} qs={lensQs} shortName={shortName} scope={scope} />
          </React.Suspense>
        </div>
      )}
    </div>
  );
}

export default LiveCohortBody;
