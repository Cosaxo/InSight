// Foresight — the Mirror's fifth lens (D125).
//
// v19's one new feature, and the last item on the nineteen-point list.
// The prototype ships two card types; this is READ, the half whose truth
// exists (data/foresight.ts explains what CALL is waiting on).
//
// THE GAME. A question the crowd has already settled, one demographic
// slice of it, and ten seconds: which option did that slice pick most?
// Answer and it scores instantly against the published cell — the same
// cell the Explore lens draws and the same numbers the who-voted sheet
// lists by name, so a read can never disagree with the screen behind it.
//
// WHY IT IS A LENS AND NOT A FEED CARD. The prototype puts these in the
// world feed, and that is a defensible home. This one is on the Mirror
// because the lens row is already the place where a population gets
// read, and because a read is scoped to a POPULATION: on Near you are
// reading slices of your city, on World slices of everyone, and the
// ruler above already says which. In the feed that scope would have to
// be stated on every card. The feed placement stays open as a follow-on;
// nothing here would have to change for it, since the engine takes
// questions and returns reads.
//
// THE CLOCK IS PART OF THE GAME, so two details are deliberate: it does
// not start until the card is actually on screen (a scrolled-past card
// must not burn its own clock — the prototype uses an
// IntersectionObserver for this; here the card only mounts when the lens
// is open, which is the same guarantee more cheaply), and running out
// scores as a MISS rather than a skip. A card you can let expire for
// free makes waiting the best play whenever you are unsure.
import React from "react";
import LIVE from "../data/live";
import { COHORT_DIMS, DIM_LABEL } from "../data/cohort";
import {
  byDim, readsFrom, recordOf, unplayed,
  type ForesightSource, type Read,
} from "../data/foresight";

const FL_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

/** Seconds on the clock. */
export const CLOCK_S = 10;

function FlEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px" }}>
      {children}
    </div>
  );
}

function Clock({ left }: { left: number }) {
  const frac = Math.max(0, left) / CLOCK_S;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--surface-2)", overflow: "hidden" }}>
        <span style={{
          display: "block", height: "100%", width: `${frac * 100}%`,
          background: left <= 3 ? "var(--c-today, var(--ink))" : "var(--accent)",
          transition: "width 1s linear",
        }}></span>
      </span>
      {/* A numeral only in the last three seconds. A permanent countdown
          makes the whole card about the clock. */}
      <span style={{ width: 14, textAlign: "right", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--ink-3)" }}>
        {left <= 3 && left > 0 ? left : ""}
      </span>
    </span>
  );
}

function ReadCard({ read, onDone }: { read: Read; onDone: (guess: number) => void }) {
  const [left, setLeft] = React.useState(CLOCK_S);
  const done = React.useRef(false);

  // One interval per card. `read.id` in the deps resets it when the deck
  // advances, which is what makes the next card start at ten rather than
  // inheriting the last one's remainder.
  React.useEffect(() => {
    setLeft(CLOCK_S);
    done.current = false;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          if (!done.current) { done.current = true; onDone(-1); }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // onDone is stable for the life of a card (the parent keys on read.id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read.id]);

  const pick = (i: number) => {
    if (done.current) return;
    done.current = true;
    onDone(i);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, border: FL_LINE, borderRadius: 14, padding: "13px 14px", background: "var(--surface)" }}>
      <Clock left={left} />
      <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)" }}>
        {DIM_LABEL[read.dim] || read.dim} · <strong style={{ color: "var(--ink-2)" }}>{read.bucket}</strong> · {read.n} answers
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 16, lineHeight: 1.35, color: "var(--ink)" }}>{read.text}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {read.options.map((o, i) => (
          <button key={i} onClick={() => pick(i)} style={{
            border: FL_LINE, borderRadius: 10, padding: "9px 12px", textAlign: "left", cursor: "pointer",
            fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, color: "var(--ink)",
            background: "var(--surface-2)", WebkitAppearance: "none",
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Verdict({ read, guess, onNext, hasNext }: {
  read: Read; guess: number; onNext: () => void; hasNext: boolean;
}) {
  const hit = guess >= 0 && guess === read.answerIdx;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, border: FL_LINE, borderRadius: 14, padding: "13px 14px", background: "var(--surface)" }}>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>
        {hit ? "Read it." : guess < 0 ? "Out of time." : "Missed."}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.35, color: "var(--ink)" }}>{read.text}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {read.options.map((o, i) => {
          const isAnswer = i === read.answerIdx;
          const isGuess = i === guess;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--sans)", fontSize: 12.5 }}>
              <span style={{ flex: 1, fontWeight: isAnswer ? 800 : 600, color: isAnswer ? "var(--ink)" : "var(--ink-3)" }}>
                {o}
                {isAnswer && <span style={{ fontWeight: 700, color: "var(--ink-3)" }}> · {read.bucket} picked this</span>}
                {isGuess && !isAnswer && <span style={{ fontWeight: 700, color: "var(--ink-3)" }}> · you said this</span>}
              </span>
              <span style={{ width: 38, textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: isAnswer ? "var(--ink)" : "var(--ink-3)" }}>
                {read.slicePct[i]}%
              </span>
            </div>
          );
        })}
      </div>
      {/* What the crowd did, so a miss teaches something: most misses are
          people answering with the overall split instead of the slice's. */}
      <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5 }}>
        {read.surprise
          ? <>Everyone else said <strong style={{ color: "var(--ink-2)" }}>{read.options[topOf(read.overallPct)]}</strong> — this slice went the other way.</>
          : <>Everyone else said the same thing.</>}
      </div>
      {hasNext ? (
        <button onClick={onNext} style={{
          border: "none", borderRadius: 999, padding: "8px 15px", cursor: "pointer", alignSelf: "flex-start",
          fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5,
          background: "var(--accent, var(--ink))", color: "var(--surface)", WebkitAppearance: "none",
        }}>Next read</button>
      ) : (
        <FlEmpty>That is every slice big enough to read right now. More arrive as people answer.</FlEmpty>
      )}
    </div>
  );
}

function topOf(pct: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < pct.length; i++) if (pct[i] > pct[best]) best = i;
  return best;
}

function LiveForesightLens({ qs }: { qs: ForesightSource[] }) {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe(bump), []);
  React.useEffect(() => { void LIVE.loadForesight(); }, []);
  const [pending, setPending] = React.useState<{ id: string; guess: number } | null>(null);
  const [skip, setSkip] = React.useState(0);

  const log = LIVE.foresightLog();
  const loading = LIVE.foresightLoading();

  if (loading && !log) return <FlEmpty>Loading your record…</FlEmpty>;
  if (!log) {
    return <FlEmpty>Couldn&rsquo;t load your record. It will try again next time you open this.</FlEmpty>;
  }

  const all = readsFrom(qs, COHORT_DIMS);
  const left = unplayed(all, log);
  const rows = Object.values(log);
  const rec = recordOf(rows);
  const dims = byDim(rows);

  // `skip` advances past cards answered this session without waiting for
  // the log to reload; the pending verdict is held so the reveal stays on
  // screen until "Next read".
  const current = left[skip] || null;

  const onDone = (guess: number) => {
    if (!current) return;
    setPending({ id: current.id, guess });
    void LIVE.scoreForesight(
      current.id, current.qid, current.dim, current.bucket,
      guess, current.answerIdx, current.n,
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        {rec.played
          ? <>You have read <strong>{rec.hits}</strong> of {rec.played} right
            {rec.streak > 1 && <> · {rec.streak} in a row</>}
            {rec.best > rec.streak && <> · best {rec.best}</>}</>
          : <>Ten seconds a card: which option did that slice of the population pick most?</>}
      </div>

      {!all.length ? (
        // Named precisely rather than "no data": the reads are filtered
        // for FAIRNESS, and saying so is the difference between "nothing
        // here" and "not enough answers yet to ask a fair question".
        <FlEmpty>
          No slice has enough answers yet to make a fair read. A slice needs
          a clear favourite before guessing it is a game rather than a coin
          toss.
        </FlEmpty>
      ) : pending && current && pending.id === current.id ? (
        <Verdict
          read={current} guess={pending.guess}
          hasNext={!!left[skip + 1]}
          onNext={() => { setPending(null); setSkip((s) => s + 1); }}
        />
      ) : current ? (
        <ReadCard key={current.id} read={current} onDone={onDone} />
      ) : (
        <FlEmpty>
          You have read every slice big enough to ask about. More arrive as
          people answer.
        </FlEmpty>
      )}

      {dims.length > 1 && (
        <div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>
            Which cuts you read well
          </div>
          {dims.map((d) => (
            <div key={d.dim} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0", borderTop: FL_LINE }}>
              <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12.5 }}>{DIM_LABEL[d.dim] || d.dim}</span>
              <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)" }}>{d.hits}/{d.played}</span>
              <span style={{ width: 38, textAlign: "right", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{d.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveForesightLens;
