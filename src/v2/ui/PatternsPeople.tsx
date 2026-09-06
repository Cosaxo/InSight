// The People lens (D214, redrawn 2026-09-02) — the crowd as a shared
// field with no centre, in the round dusk instrument the two maps also
// draw into (patterns.css, the .ln-* block). Ported from the 2026-09-02
// standalone's people-lens.jsx with the engine swapped for real
// data (D167): the prototype's simulated crowd becomes the voter lists
// live.ts already caches for the who-voted sheet, Kindred and the pair
// card, and every position is data/peopleMap.ts's device-side solve over
// the published loadings. No new read shape anywhere: at most
// PEOPLE_QUESTIONS bounded voter queries per session, each shared with
// those surfaces through the same cache.
//
// What draws is the fold's output verbatim — this file owns pixels and
// states only. The honesty rules live in peopleMap.ts's header; the two
// visible here: a dot below the floor was never in `placed` (so nothing
// here can accidentally draw it), and a nameless account reads "Someone"
// rather than wearing an invented name.
//
// COLOUR SAYS ONE THING (2026-09-02): whether this person mostly agrees
// with you, is split, or mostly disagrees — three steps over `agree` and
// `shared`, the same two counts the card states in words. It replaced a
// decorative per-uid hue that claimed nothing, which on a field where
// colour now means something would read as a second claim. Size stays the
// basis in two steps, and the legend says both in words.
//
// PAPER, AND NAMES ON TAP (2026-09-06, VISION-2026-09-06 §2.3): the field
// is ink on paper now (the shell sets .lens-paper — patterns.css), no name
// is standing type on it — the tapped person alone is named beside their
// dot — and two faint rings frame the disc so an empty-looking crowd still
// reads as a field. The standing legend and the floor sentence moved
// behind the tab's one ⓘ (the `guide` prop): a basis sentence may move
// one tap away, it may not be deleted (D146). The "Most like you" rail
// became three ROWS, each carrying the same counts plus the answer you
// share — `alike`'s ranking unchanged, likeness, never layout distance.
//
// Populations since D216 — the standalone's chips, live: `pop` narrows
// WHO is placed (your country by the frozen city anchor's code, your
// circle by the capped follows list), never what is counted — shared and
// agree are the same figures in every view, and each population reframes
// its own picture. The circle's crowd floor is its own (see
// PEOPLE_MIN_CROWD_CIRCLE), and the one wording change is the tie
// clause: "% overall do", because the share is the fit's world marginal
// in every population.
import React from "react";
import LIVE from "../data/live";
import { BUDGET_PAUSED_BODY, BUDGET_PAUSED_HEAD } from "../data/budgetMode";
import type { PoolItem } from "../data/patterns";
import {
  countryOf,
  foldPeople,
  peopleFetchSet,
  PEOPLE_C,
  PEOPLE_H,
  PEOPLE_MIN_ANSWERED,
  PEOPLE_MIN_CROWD,
  PEOPLE_MIN_CROWD_CIRCLE,
  PEOPLE_RMAX,
  PEOPLE_W,
  type PeopleFoldOpts,
  type PeopleItem,
  type PeopleRow,
  type PlacedPerson,
} from "../data/peopleMap";

/** The populations (D216) — the standalone's own roster. `country` only
 * exists for a viewer whose frozen city anchor names one. */
export type PeoplePop = "world" | "country" | "circle";

const SANS = "var(--sans)";

/** The three agreement colours, inked for the paper field the shell now
 * sets everywhere (.lens-paper, 2026-09-06). The dusk-lifted trio went
 * with the dusk ground — one palette, because there is one ground; git
 * history holds the other. Split is a warm grey rather than a fourth
 * blue, so only agreement carries the field's hue. */
const AGREE_COL = {
  yes: "oklch(0.50 0.11 282)",
  mid: "oklch(0.74 0.012 80)",
  no: "oklch(0.58 0.11 35)",
} as const;
/** Mostly agrees · split · mostly disagrees, counted over what you share. */
const stepOf = (p: { agree: number; shared: number }): keyof typeof AGREE_COL => {
  const a = p.agree / Math.max(1, p.shared);
  return a > 0.6 ? "yes" : a < 0.4 ? "no" : "mid";
};

const slim = (items: readonly PoolItem[]): PeopleItem[] =>
  items.map((p) => ({
    qid: p.q.id,
    L: p.L,
    n: p.n,
    marginal: p.marginal,
    mine: p.mine,
    optionLabels: p.q.options.map((o) => o.label),
  }));

/** live.ts's rows, narrowed to the fold's shape (they already match). */
const rowsOf = (qid: string): readonly PeopleRow[] | null => LIVE.voters(qid);

function Empty({ head, line, cta }: { head: string; line: string; cta?: React.ReactNode }): React.ReactElement {
  return (
    <div className="card" style={{ minHeight: 330, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px 36px", gap: 8, boxSizing: "border-box" }}>
      <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{head}</div>
      <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5, textWrap: "pretty", maxWidth: 250 }}>{line}</div>
      {cta ?? null}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  fontFamily: SANS, fontSize: 10.5, fontWeight: 750, letterSpacing: "0.06em", textTransform: "uppercase",
  padding: "3px 9px", borderRadius: 999,
  background: "color-mix(in oklab, var(--accent) 10%, var(--surface-2))",
  color: "var(--accent-ink, var(--accent))",
};

export default function PatternsPeople({ items, version, pop = "world", onOracle, guide = false }: {
  items: PoolItem[];
  version: number;
  pop?: PeoplePop;
  onOracle: () => void;
  /** The tab's one ⓘ — the legend and the floor sentence render only
   * while it is open (VISION-2026-09-06 §2.4). */
  guide?: boolean;
}): React.ReactElement {
  const [sel, setSel] = React.useState<string | null>(null);
  React.useEffect(() => { setSel(null); }, [pop]);

  const people = React.useMemo(() => slim(items), [items]);
  const fetchSet = React.useMemo(() => peopleFetchSet(people), [people]);

  // The circle's membership list — one capped, session-cached fetch
  // (loadFollows' own guards make re-kicks free). Needed in every
  // population: members wear the "your circle" chip wherever they stand.
  React.useEffect(() => { void LIVE.loadFollows(); }, []);
  const circleSet = React.useMemo(
    () => new Set(LIVE.follows() ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the follows cache's identity
    [version],
  );
  const myCo = countryOf(LIVE.anchors().city);
  const foldOpts = React.useMemo<PeopleFoldOpts>(() => ({
    circle: circleSet,
    keep: pop === "circle"
      ? (uid) => circleSet.has(uid)
      : pop === "country" && myCo
        ? (_uid, anchors) => countryOf(anchors.city) === myCo
        : undefined,
  }), [pop, circleSet, myCo]);

  // One pass of bounded loads, sequential like Kindred's (a dozen
  // collection-group queries fired at once is the shape that gets a
  // client rate-limited); loadVoters' own cache and in-flight guards make
  // re-runs free, and each landing list notifies the store, which bumps
  // `version` and refolds below.
  React.useEffect(() => {
    let on = true;
    void (async () => {
      for (const qid of fetchSet) {
        if (!on) return;
        await LIVE.loadVoters(qid);
      }
    })();
    return () => { on = false; };
  }, [fetchSet]);

  // Refolds when the subscription version moves — the fold is a pure
  // function of exactly the state that bumps it (the MapLens idiom).
  const field = React.useMemo(
    () => foldPeople(people, fetchSet, rowsOf, foldOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the caches' identity (see above)
    [version, people, fetchSet, foldOpts],
  );

  if (field.answered < PEOPLE_MIN_ANSWERED) {
    return (
      <Empty head="Not placed yet" line="Answer a few more questions and the map can place you." cta={
        <button onClick={onOracle}
          style={{ marginTop: 10, border: "none", cursor: "pointer", WebkitAppearance: "none", background: "var(--ink)", color: "var(--surface-2)", fontFamily: SANS, fontSize: 13.5, fontWeight: 800, padding: "11px 20px", borderRadius: 999 }}>
          Ask the Oracle
        </button>
      } />
    );
  }

  // The crowd floor guards an anonymous crowd; your own circle draws from
  // the first placeable friend (PEOPLE_MIN_CROWD_CIRCLE's comment).
  const minCrowd = pop === "circle" ? PEOPLE_MIN_CROWD_CIRCLE : PEOPLE_MIN_CROWD;
  if (field.placed.length < minCrowd) {
    // Paused before thin (D332): the voter lists this lens folds were
    // refused, so "crowd too thin" would describe a crowd nothing read.
    if (LIVE.budgetPaused) {
      return <Empty head={BUDGET_PAUSED_HEAD} line={BUDGET_PAUSED_BODY} />;
    }
    // Loading and thin render differently on purpose: "could not say yet"
    // is not "there is nobody" (the absent-vs-empty rule, loadVoters' own).
    if (fetchSet.some((qid) => LIVE.votersLoading(qid)) || (pop === "circle" && LIVE.followsLoading())) {
      return (
        <div className="card" style={{ minHeight: 330, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>
          Reading the crowd…
        </div>
      );
    }
    // COULD NOT ASK IS NOT NOBODY, and on this population it is a
    // different sentence. `loadFollows` leaves its cache null when the
    // fetch fails, deliberately — "could not ask must not render as you
    // follow nobody" is its own comment, and the breakdown panel honours
    // it. Here the null was collapsed to an empty set two hundred lines
    // up, the keep filter then rejected everyone, and the lens stated
    // that nobody from your circle is placed here: a confident claim
    // about a list it never read.
    if (pop === "circle" && LIVE.follows() === null) {
      return (
        <Empty
          head="Could not read your circle"
          line="Your follow list did not load, so this cannot say who is here. Try again in a moment."
        />
      );
    }
    return pop === "circle"
      ? <Empty head="Crowd too thin" line="Nobody from your circle is placed here yet — you appear to each other as you both answer." />
      : <Empty head="Crowd too thin" line="Too few people share your questions yet. The map fills as the crowd answers." />;
  }

  const { placed, me, alike } = field;
  const selP = sel == null ? null : placed.find((p) => p.uid === sel) ?? null;
  const pick = (p: PlacedPerson) => {
    setSel((s) => (s === p.uid ? null : p.uid));
  };
  const meLeft = me.x > PEOPLE_W - 46; // keep the "you" word inside the frame

  return (
    <>
      <div className="ln-card">
        {/* the card's title and one-sentence explainer retired into the
            guide legend below (2026-09-06) — boxless, the field on the
            page. "The closer two dots, the more alike their answers" is
            still not a sentence this projection can carry (a position is
            two components of an eight-dimensional solve), so the legend
            says what a dot IS and the rows carry likeness itself. */}
        <div className="ln-field">
          <svg className="ln-svg" viewBox={`0 0 ${PEOPLE_W} ${PEOPLE_H}`} role="img"
            aria-label="People who share your questions, placed by their answers; colour says whether they mostly agree with you"
            onClick={() => { if (sel != null) setSel(null); }}>
            {/* two faint rings frame the disc (2026-09-06) — structure,
                not data: they claim nothing, and a thin crowd still
                reads as a field rather than three dots in a void */}
            <circle cx={PEOPLE_C} cy={PEOPLE_C} r={PEOPLE_RMAX / 3} fill="none" stroke="var(--ln-ink)" strokeOpacity="0.09" strokeWidth="1"></circle>
            <circle cx={PEOPLE_C} cy={PEOPLE_C} r={(PEOPLE_RMAX * 2) / 3} fill="none" stroke="var(--ln-ink)" strokeOpacity="0.09" strokeWidth="1"></circle>
            {placed.map((p) => {
              const on = p.uid === sel;
              const dim = selP != null && !on;
              return (
                <g key={p.uid} onClick={(e) => { e.stopPropagation(); pick(p); }}
                  role="button" tabIndex={0}
                  aria-label={`${p.name || "Someone"} · agrees on ${p.agree} of ${p.shared} shared answers`}
                  style={{ cursor: "pointer", outline: "none", opacity: dim ? 0.22 : 1, transition: "opacity .25s ease" }}>
                  <circle cx={p.x} cy={p.y} r={Math.max(p.r + 8, 15)} fill="transparent"></circle>
                  <circle cx={p.x} cy={p.y} r={p.r} fill={AGREE_COL[stepOf(p)]}></circle>
                  {on && <circle cx={p.x} cy={p.y} r={p.r + 5} fill="none" stroke="var(--ln-beacon)" strokeWidth="1.8"></circle>}
                </g>
              );
            })}
            {/* the one standing name is the tapped person's, beside their
                dot, anchored away from the hub side (2026-09-06 — every
                other name is in the rows below or one tap away) */}
            {selP && (
              <text x={selP.x > PEOPLE_C ? selP.x - selP.r - 6 : selP.x + selP.r + 6} y={selP.y + 3.5}
                textAnchor={selP.x > PEOPLE_C ? "end" : "start"}
                fill="var(--ln-ink)" stroke="var(--ln-halo)" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke"
                style={{ fontSize: 12, fontWeight: 700, pointerEvents: "none" }}>{selP.name || "Someone"}</text>
            )}
            <g style={{ opacity: selP ? 0.35 : 1, transition: "opacity .25s ease" }}>
              <circle cx={me.x} cy={me.y} r="11" fill="none" stroke="var(--ln-beacon)" strokeWidth="1.6"></circle>
              <circle cx={me.x} cy={me.y} r="6" fill="var(--ln-me)"></circle>
              <text x={meLeft ? me.x - 14 : me.x + 14} y={me.y + 3.5} textAnchor={meLeft ? "end" : "start"}
                fill="var(--ln-ink)" stroke="var(--ln-halo)" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke"
                style={{ fontSize: 12, fontWeight: 800 }}>you</text>
            </g>
          </svg>
        </div>
        {/* the legend, on demand (the tab's ⓘ): what a dot is, the three
            colours, the size rule — and the floor sentence, which is a
            claim and so may move one tap away but never be deleted
            (D146). `basis`/`minShared`, not the prototype's own-answers
            count: the crowd is placed from the fetched lists, and naming
            your number over their placement is the overstatement the
            foot card was corrected for. */}
        {guide && (
          <div className="ln-key fade-in" aria-label="How to read the map">
            <span>each dot is a person who answered some of the same questions as you, placed by how they answered</span>
            <span><i className="k-dot" style={{ background: AGREE_COL.yes }}></i>mostly agrees with you</span>
            <span><i className="k-dot" style={{ background: AGREE_COL.mid }}></i>split</span>
            <span><i className="k-dot" style={{ background: AGREE_COL.no }}></i>mostly disagrees</span>
            <span>bigger dot = more answers in common</span>
            <span>tap anyone to see what you share</span>
            <span>{placed.length} people · everyone who answered at least {field.minShared} of the {field.basis} questions read here · drawn from the crowd’s latest answers</span>
          </div>
        )}
        {/* the rows carry the counts each claim rests on — never an
            unnamed account dressed with an initial (D167: `alike` filters
            to named people), and ranked on likeness, never on where the
            dots landed (the fold's own comment says why) */}
        {alike.length > 0 && (
          <div className="ln-list" role="list" aria-label="The people most like you">
            <span className="pt-kick" style={{ color: "var(--accent-ink)", padding: "2px 0" }}>Most like you</span>
            {/* the listitem role goes on the WRAPPER, never on the button —
                an interactive element assigned a non-interactive role is a
                real reading bug (the prototype's markup did exactly that) */}
            {alike.map((p) => (
              <span key={p.uid} role="listitem" style={{ display: "contents" }}>
                <button className={"ln-row" + (sel === p.uid ? " is-on" : "")}
                  onClick={() => pick(p)}>
                  <span className="ln-row-av" style={{ background: AGREE_COL[stepOf(p)] }}>{p.name.slice(0, 1)}</span>
                  <span className="ln-row-body">
                    <span className="ln-row-top">
                      <span className="ln-row-name">{p.name}</span>
                      <span className="ln-row-sub">agrees {p.agree} of {p.shared}</span>
                    </span>
                    <span className="ln-row-q">{p.tie ? <>Both said {p.tie.label}</> : <>You split on everything you share</>}</span>
                  </span>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {selP ? (
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* the identity dot (2026-08-26): the card wears the dot's own
                colour, so the reader can find on the field the person the
                card is about — and since 2026-09-02 that colour is the
                agreement step, which is what the sentence under it counts */}
            <i style={{ width: 11, height: 11, borderRadius: "50%", background: AGREE_COL[stepOf(selP)], border: "1px solid var(--rule)", flex: "none" }}></i>
            <span style={{ fontFamily: SANS, fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{selP.name || "Someone"}</span>
            {selP.chips.map((c, k) => <span key={k} style={chipStyle}>{c}</span>)}
          </div>
          <div style={{ marginTop: 11, fontFamily: SANS, fontSize: 13.5, fontWeight: 650 }}>
            Agrees with you on <b style={{ fontWeight: 800 }}>{selP.agree} of {selP.shared}</b> answers you both gave
          </div>
          <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
            <i style={{ display: "block", width: `${Math.round((selP.agree / selP.shared) * 100)}%`, height: "100%", borderRadius: 99, background: "color-mix(in oklab, var(--accent) 55%, var(--surface-2))", transition: "width .3s ease" }}></i>
          </div>
          {/* the position's basis (2026-08-26). The prototype's line is
              "that count alone places them · closer only ever means more
              agreement" — true of its agreement layout, not of this one:
              live positions come from the same ridge solve as yours
              (peopleMap.ts), over their answers and nothing else. Say
              that, and no more. */}
          <div style={{ marginTop: 7, fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textWrap: "pretty" }}>
            Their answers alone place them — closer means answering more alike.
          </div>
          {selP.tie ? (
            <div style={{ marginTop: 11, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
              {/* "overall", not "here" (D216): the share is the fit's own
                  world marginal, and stays that in every population — a
                  per-population share would be a new small-sample claim */}
              You both said <b style={{ fontWeight: 700, color: "var(--ink)" }}>{selP.tie.label}</b>{" "}
              <span style={{ color: "var(--ink-3)" }}>· {Math.round(selP.tie.share * 100)}% overall do</span>
            </div>
          ) : (
            <div style={{ marginTop: 11, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
              You split on everything you share.
            </div>
          )}
        </div>
      ) : null}
      {/* the idle foot card retired into the guide legend (2026-09-06):
          its two claims — the crowd's basis and the floor — moved there
          word for word, still stated over `basis`, never over the
          viewer's own answered count */}
    </>
  );
}
