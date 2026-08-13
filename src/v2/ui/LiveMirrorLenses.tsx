// The Mirror's lens row, live (D99).
//
// The prototype's Mirror is two levels: WHO (the ruler) and WHAT (a row of
// lenses under it). Live mode has shipped the ruler and no lenses since the
// port, and until D98 the reason was real — four of the five needed data
// the privacy model forbade reading.
//
// It no longer forbids anything, so this is the row coming back. Four
// lenses, each built on a source that exists today:
//
//   People   the cohort's demographic mix (a fold over `agg.by`) and
//            Kindred, the people whose answers most match yours
//            (data/cohort.ts `agreement`, over the cached voter lists).
//   Compare  you against this population, question by question, with the
//            questions you diverge on most surfaced first.
//   Scores   the mean of every ordinal question this population answered,
//            with your own score ticked onto their bar (D100).
//   Explore  pick a trait slice and see what it believes, led by where it
//            differs from everyone — `divergence`.
//
// SCORES WAS REFUSED HERE UNTIL D100, and the note said the bank shipped
// no `rate` questions so the lens would be an empty frame. That was true
// about the PROTOTYPE'S Scores — a place scorecard, "rate Oslo's
// nightlife" — and it read as true about the lens, which was wrong: the
// bank ships five 1-10 `rating` items and sixteen 5-point `scale` ones,
// and an ordinal question is an ordinal question whether its subject is a
// city or your own outlook. The lens filters on TYPE, so place-rating
// questions join it the day someone writes them, with no code change.
//
//   Answers  is NOT in this file, and since D119 that is a division of
//            labour rather than an absence: it is the host's own body
//            (LiveCohortBody) and a peer tab in the row above, not the
//            page these four hang under. D100 gave it the branch filter,
//            the sort and the expand-a-row it was missing.
//
// Every reading here is drawn from documents already fetched for another
// purpose — the deck's aggregates and the who-voted voter lists — with the
// single exception of Kindred, which pays for voter lists the user has not
// opened. That one is behind its own tab and fetches on first view.
import React from "react";
import LIVE from "../data/live";
import {
  COHORT_DIMS, DIM_LABEL, divergence, meanScore, mixFor, pctFor, sliceSplit,
  type Score,
} from "../data/cohort";
// D124: these two lenses printed the raw bucket KEY, so a country row read
// "NO" and a city row "Oslo, NO". One resolver, shared with the feed's
// breakdown sheet, so the same cohort is named the same everywhere.
import { bucketLabel } from "./cohortLabels";
// The row's own types and labels live next door: eslint's react-refresh
// rule wants a component file to export only components, and it is right
// that a constant shared with the host does not belong in one.
import { ORDINAL_TYPES, type LensId, type LensQuestion } from "./lensDefs";

const LL_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";


function LlBar({ pct, labels, mark }: { pct: number[]; labels: string[]; mark?: number }) {
  return (
    <span style={{ display: "flex", height: 22, borderRadius: 7, overflow: "hidden", background: "var(--surface-2)" }}>
      {pct.map((p, i) => (
        <span key={i} title={`${labels[i]} · ${p}%`} style={{
          width: `${p}%`,
          background: i === mark ? "var(--accent)" : `color-mix(in oklch, var(--accent) ${38 - i * 9}%, var(--surface-2))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--sans)", fontWeight: 800, fontSize: 10.5,
          color: i === mark ? "#fff" : "var(--ink-2)", overflow: "hidden", whiteSpace: "nowrap",
        }}>{p >= 14 ? `${p}%` : ""}</span>
      ))}
    </span>
  );
}

// One tap, no pending state, no notification to the other side — the
// whole point of D101's design is that a follow grants no access D98 had
// not already granted, so there is nothing to request.
function FollowButton({ uid }: { uid: string }) {
  const following = LIVE.isFollowing(uid);
  return (
    <button
      onClick={() => void LIVE.setFollowing(uid, !following)}
      aria-pressed={following}
      style={{
        border: LL_LINE, borderRadius: 999, padding: "3px 10px", cursor: "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11, WebkitAppearance: "none",
        background: following ? "var(--ink)" : "transparent",
        color: following ? "var(--surface)" : "var(--ink-2)",
      }}
    >{following ? "Following" : "Follow"}</button>
  );
}

function LlEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px" }}>
      {children}
    </div>
  );
}

// ── People ──────────────────────────────────────────────────────────
//
// Two halves that answer the same question at different resolutions: who
// is in this population (the mix) and which of them are like you
// (Kindred).

function PeopleLens({ qs }: { qs: LensQuestion[] }) {
  const [dim, setDim] = React.useState<string>("ageBand");
  React.useEffect(() => { void LIVE.loadKindred(); }, []);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);

  // The mix is summed across every question in view rather than read off
  // one, because a single question's mix is a fact about that question's
  // audience. Summing is still not a population census — someone who
  // answered ten questions counts ten times — and the copy says so
  // instead of implying a headcount.
  const tally: Record<string, number> = {};
  for (const q of qs) {
    for (const b of mixFor(q.by, dim, q.options.length)) {
      tally[b.bucket] = (tally[b.bucket] || 0) + b.n;
    }
  }
  const rows = Object.keys(tally).map((b) => ({ b, n: tally[b] })).sort((x, y) => y.n - x.n);
  const total = rows.reduce((a, r) => a + r.n, 0);

  const kin = LIVE.kindred();
  const loading = LIVE.kindredLoading();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {COHORT_DIMS.map((d) => (
            <button key={d} onClick={() => setDim(d)} style={{
              border: LL_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
              fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12,
              background: dim === d ? "var(--ink)" : "var(--surface)",
              color: dim === d ? "var(--surface)" : "var(--ink)", WebkitAppearance: "none",
            }}>{DIM_LABEL[d]}</button>
          ))}
        </div>
        {!rows.length ? (
          <LlEmpty>Nobody here has filled in their {DIM_LABEL[dim].toLowerCase()} yet.</LlEmpty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {rows.map((r) => (
              <div key={r.b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 110, flexShrink: 0, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bucketLabel(dim, r.b)}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.round((r.n / (total || 1)) * 100)}%`, background: "var(--accent)" }}></span>
                </span>
                <span style={{ width: 34, textAlign: "right", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{r.n}</span>
              </div>
            ))}
            {/* Said plainly rather than left to be misread: this counts
                ANSWERS, so someone who answered ten questions is in it
                ten times. Calling it a population would be the kind of
                small lie this app is built not to tell. */}
            <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 3 }}>
              Answers, not people — each question someone answered counts once.
            </span>
          </div>
        )}
      </div>

      <div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>
          Most like you
        </div>
        {loading && !kin.length ? (
          <LlEmpty>Working out who answers like you…</LlEmpty>
        ) : !kin.length ? (
          <LlEmpty>
            Nobody has answered enough of the same questions yet. This fills in
            as you answer more.
          </LlEmpty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {kin.slice(0, 12).map((p) => (
              <div key={p.uid} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderTop: LL_LINE }}>
                <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, color: p.name ? "var(--ink)" : "var(--ink-3)" }}>
                  {p.name || "Someone"}
                </span>
                <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)" }}>
                  {p.like.same}/{p.like.shared} the same
                </span>
                <span style={{ width: 42, textAlign: "right", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
                  {p.like.pct}%
                </span>
                {/* Kindred finds the strangers worth keeping; following
                    is how you keep one (D101). The second of exactly two
                    places a follow can start — the other is a question's
                    who-voted sheet — and both are places where a uid has
                    already become a person with a reading attached. */}
                <FollowButton uid={p.uid} />
              </div>
            ))}
            {/* The metric, in one sentence, on the screen that uses it —
                a likeness number nobody can explain is a number nobody
                should trust. */}
            <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 8 }}>
              Share of the questions you have both answered where you picked the
              same option, across your last {LIVE.kindredDepth()}.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compare ─────────────────────────────────────────────────────────

function CompareLens({ qs, shortName }: { qs: LensQuestion[]; shortName: string }) {
  const answered = qs.filter((q) => q.mine >= 0 && q.counts.some((c) => c > 0));
  if (!answered.length) {
    return <LlEmpty>Answer a few of today&apos;s questions and this fills in.</LlEmpty>;
  }
  // Ranked by how far you sit from the crowd on your own pick — the
  // interesting rows are the ones where you are unusual, not the ones
  // where everyone agrees with you.
  const rows = answered.map((q) => {
    const pct = pctFor(q.counts);
    return { q, pct, mineShare: pct[q.mine] || 0 };
  }).sort((a, b) => a.mineShare - b.mineShare);

  const withMost = rows.filter((r) => r.mineShare >= 50).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        You went with the majority in <strong>{withMost}</strong> of {rows.length},
        against {shortName}. Least typical first.
      </div>
      {rows.map(({ q, pct, mineShare }) => (
        <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--ink)", lineHeight: 1.35 }}>{q.text}</span>
          <LlBar pct={pct} labels={q.options} mark={q.mine} />
          <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
            You said <strong style={{ color: "var(--ink-2)" }}>{q.options[q.mine]}</strong> · {mineShare}% here agreed
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Explore ─────────────────────────────────────────────────────────

function ExploreLens({ qs }: { qs: LensQuestion[] }) {
  const [dim, setDim] = React.useState<string>("ageBand");
  const [bucket, setBucket] = React.useState<string>("");

  // Buckets available across the questions in view, biggest first.
  const tally: Record<string, number> = {};
  for (const q of qs) {
    for (const b of mixFor(q.by, dim, q.options.length)) tally[b.bucket] = (tally[b.bucket] || 0) + b.n;
  }
  const buckets = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
  const picked = buckets.includes(bucket) ? bucket : buckets[0] || "";
  // The name for the sentences below. `picked` stays the KEY — it is what
  // indexes the fold — and only the copy is resolved (D124).
  const pickedName = picked ? bucketLabel(dim, picked) : "";

  // The rows this slice disagrees with everyone about, most first.
  const rows = picked
    ? qs.map((q) => {
      const split = sliceSplit(q.by, dim, picked, q.options.length);
      if (!split) return null;
      const d = divergence(q.by, dim, q.counts, q.options.length)
        .find((x) => x.bucket === picked);
      return { q, split, overall: pctFor(q.counts), gap: d ? d.gap : 0, on: d ? d.optionIdx : 0 };
    }).filter(Boolean).sort((a, b) => b!.gap - a!.gap)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {COHORT_DIMS.map((d) => (
          <button key={d} onClick={() => { setDim(d); setBucket(""); }} style={{
            border: LL_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
            fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12,
            background: dim === d ? "var(--ink)" : "var(--surface)",
            color: dim === d ? "var(--surface)" : "var(--ink)", WebkitAppearance: "none",
          }}>{DIM_LABEL[d]}</button>
        ))}
      </div>
      {!buckets.length ? (
        <LlEmpty>No answers carry a {DIM_LABEL[dim].toLowerCase()} yet.</LlEmpty>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {buckets.map((b) => (
              <button key={b} onClick={() => setBucket(b)} style={{
                border: LL_LINE, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12,
                background: picked === b ? "var(--accent)" : "var(--surface)",
                color: picked === b ? "#fff" : "var(--ink-2)", WebkitAppearance: "none",
              }}>{bucketLabel(dim, b)} · {tally[b]}</button>
            ))}
          </div>
          {!rows.length ? (
            <LlEmpty>Nobody in {pickedName} has answered these yet.</LlEmpty>
          ) : rows.map((r) => (
            <div key={r!.q.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--ink)", lineHeight: 1.35 }}>{r!.q.text}</span>
              <LlBar pct={r!.split} labels={r!.q.options} mark={r!.q.mine >= 0 ? r!.q.mine : undefined} />
              <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
                {r!.gap > 0
                  ? <>{pickedName} are <strong style={{ color: "var(--ink-2)" }}>{r!.gap} points</strong> {r!.split[r!.on] > r!.overall[r!.on] ? "more" : "less"} likely to say {r!.q.options[r!.on]}</>
                  : <>Same as everyone.</>}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Scores ──────────────────────────────────────────────────────────
//
// The scorecard: every ordinal question this population has answered,
// ranked by what they gave it, with your own score beside theirs.
//
// The prototype's Scores is a place scorecard — rate Oslo's nightlife,
// its transit, its cost — fed by `rate` questions that the live bank does
// not carry. This is the same lens over the questions the bank DOES
// carry: the five 1-10 `rating` items and the sixteen 5-point `scale`
// ones. It is a narrower claim than "how good is this city" and a true
// one, and when place-rating questions are written they will appear here
// with no code change, because the lens filters on the type rather than
// on a hardcoded list of categories.

function ScoresLens({ qs, shortName }: { qs: LensQuestion[]; shortName: string }) {
  const scored = qs
    .filter((q) => ORDINAL_TYPES.has(q.type || ""))
    .map((q) => ({ q, score: meanScore(q.counts), mine: q.mine >= 0 ? q.mine + 1 : null }))
    .filter((r): r is { q: LensQuestion; score: Score; mine: number | null } => !!r.score)
    .sort((a, b) => b.score.mean / b.score.max - a.score.mean / a.score.max);

  if (!scored.length) {
    // Two different emptinesses, and collapsing them would hide which one
    // this is. Neither is "withheld" — that category is gone (D98).
    const anyOrdinal = qs.some((q) => ORDINAL_TYPES.has(q.type || ""));
    return (
      <LlEmpty>
        {anyOrdinal
          ? <>Nobody here has answered a rated question yet.</>
          : <>Nothing rated yet. Scores fills in from the questions that ask
            for a number rather than a side — answer one and it appears here.</>}
      </LlEmpty>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        How {shortName} rated {scored.length === 1 ? "it" : "them"}, best first.
      </div>
      {scored.map(({ q, score, mine }) => {
        const frac = score.mean / score.max;
        return (
          <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ flex: 1, fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--ink)", lineHeight: 1.35 }}>{q.text}</span>
              {/* The scale's top ships with the number, always. "6.2"
                  means opposite things out of 10 and out of 5, and this
                  list mixes both. */}
              <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                {score.mean}
              </span>
              <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 11.5, color: "var(--ink-3)" }}>/ {score.max}</span>
            </div>
            <span style={{ display: "block", height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden", position: "relative" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round(frac * 100)}%`, background: "var(--accent)" }}></span>
              {mine != null && (
                // Your own score as a tick on their bar rather than a
                // second bar: the comparison IS the reading, and two bars
                // make it a lookup.
                <span aria-hidden="true" style={{
                  position: "absolute", top: -2, bottom: -2, width: 2.5, borderRadius: 2,
                  left: `calc(${Math.round((mine / score.max) * 100)}% - 1.25px)`,
                  background: "var(--ink)",
                }}></span>
              )}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
              {mine == null
                ? <>{score.n.toLocaleString()} {score.n === 1 ? "answer" : "answers"} · you have not rated this</>
                : <>You gave it <strong style={{ color: "var(--ink-2)" }}>{mine}</strong>
                  {mine === score.mean ? <> — exactly the average</>
                    : <> · {Math.abs(Math.round((mine - score.mean) * 10) / 10)} {mine > score.mean ? "above" : "below"} them</>}
                  {" "}· {score.n.toLocaleString()} {score.n === 1 ? "answer" : "answers"}</>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── the body ────────────────────────────────────────────────────────
//
// CONTROLLED SINCE D119. This module used to own the row as well: four
// text buttons with their own open/closed state, sitting BELOW the answer
// rows, collapsed by default. The row is now the stop's tab bar
// (ui/MirrorLensTabs), Answers is a peer tab rather than the page these
// lenses hang off, and the selection lives with the host — so this
// renders one lens and nothing else.
//
// The cost gate that comment carried is unchanged and is now structural
// rather than a default: a lens body exists only while its tab is the
// open one, so People still pays for voter lists exactly when someone
// asks for People and never because something scrolled into view.

function LiveMirrorLenses({ lens, qs, shortName }: {
  lens: LensId;
  qs: LensQuestion[];
  shortName: string;
}) {
  if (!LIVE.enabled) return null;
  return (
    <div style={{ paddingTop: 14 }}>
      {lens === "people" && <PeopleLens qs={qs} />}
      {lens === "compare" && <CompareLens qs={qs} shortName={shortName} />}
      {lens === "scores" && <ScoresLens qs={qs} shortName={shortName} />}
      {lens === "explore" && <ExploreLens qs={qs} />}
    </div>
  );
}

export default LiveMirrorLenses;
