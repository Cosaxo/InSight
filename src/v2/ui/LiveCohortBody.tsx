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
import { hasPublishedCounts, type AggDoc } from "../data/deck";
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
// The row's own scroll-into-view, shared with the three other stops that
// have a row (D190).
import { useLensRowScroll } from "./lensRowScroll";
// The Answers tab's list, in the prototype's row design (D120). An
// ordinary import, not lazy: this body IS the default tab, and it rides
// this module's own lazy chunk (D119) either way.
import LiveAnswerRows, { type AnswerRow } from "./LiveAnswerRows";
import { LENS_LABEL, STOP_TABS, TAB_LABEL, lensesFor, type LensTab } from "./lensTabs";
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
  // CLOSED, not Answers (D155). D135 opened the stop on Answers because a
  // closed row under an empty field read as a blank stop — true of the
  // layout it was written for, and the prototype's own answer is different
  // and better: the row is pinned to the BOTTOM of the screen, so a stop
  // with nothing open is a header, a field and a tab bar sitting where a
  // tab bar belongs. Nothing looks broken because nothing is missing.
  const [tab, setTab] = React.useState<string>("");
  // The row, so opening a tab brings it to the top of the scroller the way
  // the prototype does (spec/mirror-field.jsx MirrorLenses).
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  // D155 CLAIMED THIS SHIPPED AND IT DID NOT. The ref was declared, the ref
  // was attached, and nothing ever read it — so the row pinned to the
  // bottom correctly and then just sat there when you tapped it, leaving
  // the panel you asked for below the fold. Nothing could catch that: a
  // dangling ref is valid TypeScript, valid eslint and invisible to
  // check:globals, and the tab-open tests assert the panel MOUNTS, which it
  // did. Reported from a device, which is the only place it was visible.
  //
  // The effect is ONE effect now (D190, ui/lensRowScroll.ts): this file and
  // NearLiveBody each carried their own, and Circle and Groups getting rows
  // would have made it four copies of something that has already been wrong
  // once.
  //
  // Keyed on `tab` rather than the derived `openTab` because this has to be
  // a hook and `openTab` is computed past the `needsCity` early return.
  // They agree in practice: setTab is only ever called with an id from
  // `tabs`, and mirror-tab keys this body per scope, so a tab cannot
  // survive into a scope that lacks it.
  useLensRowScroll(tab, rowRef);

  const city = LIVE.myCity;
  const place = city ? PLACES.parse(city) : null;
  const country = place ? place.country : "";

  const needsCity = scope !== "world" && !city;
  const nearOn = LIVE.near.on();
  // D92: when the Right-now counter is ON, the user has an explicit,
  // revocable location grant standing for a live feature — so Near stops
  // asking and derives the city from the same grant. The datum applied is
  // still only the catalogue key (locateCity's containment), which is
  // strictly LESS information than the ~200 m presence cell the counter
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
            Matched on this phone — only its name is saved, never your
            coordinates.
          </LnNote>
        ) : (
          /* The claim that keeps this ask honest is "only the name, never
             your coordinates", and it survives at full strength. What went
             was the scaffolding around it: "use your location or search the
             list" describes the picker sitting directly underneath, and
             "change it any time in your profile" is true of every anchor
             and belongs where anchors are edited. */
          <LnNote title={scope === "city" ? "City needs your city" : "Country needs a city"}>
            Only the city name is saved, never your coordinates.
            {scope === "city" && !nearOn && LIVE.near.supported() && (
              <> The Near count fills it in for you.</>
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

  const shortName =
    scope === "city" ? (place ? place.name : city)
      : scope === "country" ? PLACES.countryName(country)
        : "the world";
  // THE STOP'S COLOUR IS THE STOP'S, AND THIS FILE NO LONGER PICKS ONE
  // (D188).
  //
  // It used to re-declare `--accent` per zoom — city sienna, country sage,
  // world indigo — reasoning that all three zooms share one pop, so without
  // it "the axis would stop shading from near to far". The shading was
  // real; the hues were borrowed. `--c-around` is the DAILY tab's accent
  // and `--c-city` is Near's, so City wore the daily's ink and Country wore
  // the stop one to its left, while the header wordmark, the ruler tick and
  // the tab bar — which read `--accent` from `.app`, set by mirror-tab per
  // POP — all stayed indigo. One screen, two answers to "what colour is
  // this stop", and the lens row's underline was on the losing side of it.
  //
  // The prototype draws all three zooms in `--c-world` (measured: the row
  // thumb resolves to oklch(0.52 0.14 235) at City, Country and World
  // alike), which is exactly what dropping this leaves behind, since
  // mirror-tab already sets it for pop 'world'. The near-to-far shading
  // survives where it always lived — You, Circle, Groups and Near each own
  // a hue on the ruler above.

  // Every question this device holds an aggregate for, not just the
  // seven-day pager (D100). The pager was the wrong source for a panel
  // whose job is "how did this place answer": it made the Answers lens a
  // week's worth of rows, which is too few to be worth filtering and far
  // too few for Scores to find a rating question in.
  // CORE ONLY (D161). This panel makes a claim about a PLACE — "this is
  // how Oslo answered" — and that is only true of a question everyone in
  // Oslo could have been asked. A tail question is ordered by the interest
  // model (D163), so its split describes the people it was shown to; the
  // arithmetic would stay correct while the sentence stopped being.
  //
  // Through `isCore`, not `q.core`, because the flag is feed-only and
  // every other surface is core by construction — testing the field here
  // would empty the panel instead of filtering it.
  //
  // A no-op today against a CURRENT bank: the tail is empty and every feed
  // question in `content/` declares `core: true`, so this removes nothing.
  // It is here so that the day tail content first appears it is already
  // excluded, rather than diluting these readings until someone notices.
  //
  // ⚠ DEPLOY ORDER. It is only a no-op against a bank that has been
  // RESEEDED since D161. The production bank was seeded before `core`
  // existed, and those feed documents carry no flag — which `isCore` reads
  // as tail, correctly and unhelpfully, dropping all 82 of them out of this
  // panel. So this ships AFTER a reseed, never before. The failure is at
  // least loud (the place panels go visibly thin, rather than quietly
  // wrong), which is the direction D161 chose the polarity for — but loud
  // is not the same as harmless. Same class as D100's branch/sub fields,
  // whose note says readers must tolerate a stale bank; the difference is
  // that tolerating this one would mean defaulting absent to core, which
  // is the silent failure D161 exists to prevent.
  const archive = LIVE.aggregated().filter((q) => q.coreCorpus);
  const myVotes = LIVE.myVotes();

  /**
   * The counts for THIS STOP, from one aggregate — the globe on World,
   * the city/country cell everywhere else.
   *
   * Shared by both walks below on purpose (D170). The rows resolved the
   * cohort cell and the lens questions took `agg.counts`, so Answers
   * described Oslo while Compare and Scores described the world under
   * Oslo's name. Two walks over the same archive is two chances to
   * disagree about which crowd the stop is; this is the one answer both
   * of them read.
   */
  const cellFor = (agg: AggDoc | null | undefined): Record<string, number> | undefined => {
    if (!agg) return undefined;
    if (scope === "world") return hasPublishedCounts(agg) ? agg.counts : undefined;
    return agg.by?.[scope]?.[scope === "city" ? city : country];
  };

  const rows: AnswerRow[] = [];
  // Questions with no answers from this cohort yet. Since D98 nothing is
  // withheld, so an absent cell means exactly zero — the counter survives
  // only so an empty row is explained rather than silently missing.
  let empty = 0;
  for (const q of archive) {
    const agg = LIVE.aggFor(q.id);
    if (!agg) continue;
    const cell = cellFor(agg);
    let n = 0;
    if (scope === "world") {
      // The globe is the aggregate itself.
      if (!cell) { empty++; continue; }
      n = agg.total || 0;
    } else {
      const dim = agg.by?.[scope];
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
      // D327: the row wears the stamp when this answer went in anonymously.
      // In every count above, in no voter list — the flag is how the
      // viewer's own row SAYS that, not a gate on anything.
      anon: mine != null && LIVE.isAnonAnswer(q.id),
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
    const opts = q.options || [];
    // `counts` is THIS STOP (D170) — the same cell the rows above take, so
    // a lens can no longer name a population and read another. `all` is
    // the globe, which only Explore wants: its buckets are cuts of
    // everyone and its sentence ends "same as everyone".
    const cell = cellFor(agg);
    const mine = myVotes[q.id];
    return {
      id: q.id,
      text: q.text,
      options: opts.map((o) => o.label),
      counts: opts.map((_, i) => (cell || {})[String(i)] || 0),
      all: opts.map((_, i) => ((agg?.counts || {})[String(i)] as number) || 0),
      by: byOf(agg),
      mine: mine == null ? -1 : Number(mine),
      type: q.type,
      branch: q.branch,
      // The scorecard's two fields (D187): which place the question rates,
      // and the noun it is drawn under. Passed through rather than
      // resolved here — Scores is the only lens that reads either, and the
      // scope it compares `rates` against is its own prop.
      tag: q.tag,
      rates: q.rates,
    };
  }).filter((q) => q.options.length > 0);

  // ── the stop's tabs (D119, reshaped at D136) ──
  //
  // Answers, then the lenses this scope has. The constellation moved out of
  // the row at D136 to sit above it, and Foresight left the Mirror
  // entirely.
  //
  // ASSEMBLED PER SCOPE SINCE D152, which reverses the note this comment
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
  const openTab = tabs.some((t) => t.id === tab) ? tab : "";

  return (
    <div className="fade-in" style={{
      // NO BOTTOM PADDING, and that is the whole of what pins the row
      // (D188). `marginTop: auto` below put the row at the bottom of THIS
      // box; 26px of padding under it then held it 26px off the bottom of
      // the screen, on top of the 24px `.app-body` already reserves — so
      // the tab bar floated 50px clear of the app's own, which is the
      // "slightly up" the prototype never has. The prototype's stage
      // (`.mf-stage`) carries no padding at all and lets `.app-body`'s
      // padding-bottom be the only gap; measured there at 20px, and this
      // now matches it to whatever `.app-body` says.
      //
      // An OPEN tab's body still ends against that same 24px, which is the
      // prototype's arrangement too (row and panel share one
      // `marginTop: auto` wrapper in MirrorLenses).
      padding: "4px 16px 0",
      // A filling column, so `marginTop: auto` on the row below has
      // somewhere to push against. Without this the row sits under the
      // last thing drawn and floats mid-screen on an empty stop, which is
      // exactly what it looked like.
      flex: "1 0 auto", display: "flex", flexDirection: "column",
    } as React.CSSProperties}>
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
        {/* THE PLACE NAME AND THE EXPLANATION ARE GONE (D172).
            The prototype's header is three things — kicker, figure, unit
            — and that is the whole of it (`MFHeader`: "Your city · 12.6k ·
            in Oslo"). This stop had grown two more blocks under them: the
            place name again in 25px serif, and a sentence explaining what
            a city cohort is.

            Both were repeats. The unit above already ends "in Oslo", so
            the serif line said the same word twice the size; and "everyone
            who picked this city, on every question they have answered" is
            what the kicker plus that unit already say, in a sentence the
            reader has to get through to reach the field the stop exists
            for. The `heading` they shared went with them; `shortName` is
            the one the readings still need, and it is the one the unit
            already prints. */}
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
          <SimilaritySection scope={scope} />
        </React.Suspense>
      </div>

      {/* Under the field: the row is this stop's navigation, and the ruler
          above it is the app's. Two levels of nav in that order is what the
          prototype's nav v2 is — WHO, then WHAT.

          `marginTop: auto` is the prototype's own line (MirrorLenses) and
          it is what keeps the row at the BOTTOM of the screen when the
          stop has little to show. A tab bar floating halfway up a mostly
          empty screen is the thing it fixes.

          Tapping the open tab closes it, so the row can return to the
          state it starts in. */}
      <div ref={rowRef} style={{ marginTop: "auto", paddingTop: 16 }}>
        <MirrorLensTabs tabs={tabs} open={openTab}
          onOpen={(id) => setTab(openTab === id ? "" : id)} />
      </div>

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

      {!!openTab && openTab !== "answers" && (
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
