// Foresight CALL, tier A, in the feed (D194) — the v28 predict card's
// CALL half (design/standalone-v28/predict-cards.jsx), live.
//
// Four states, and the last one is why the feature was allowed to exist:
//
//   open    two options, and nothing about the target question's current
//           numbers. Showing them would turn a prediction into a lookup.
//   sealed  your pick, the crowd's split on the CALL (not on its target),
//           and the day it resolves.
//   graded  the outcome, your verdict, and THE BASIS — the counts the
//           resolver read, the test it ran, and whether this device
//           re-running that test over those counts reaches the same
//           answer. That last line is the one thing separating a resolved
//           call from the app asserting a fact (D127); it is drawn every
//           time rather than only when it disagrees.
//   void    nobody scored, and the reason, in the app's own words.
//
// PINNED AT THE FEED HEAD, one at a time, beside Crossroads — a call is
// not dealt into the stream, because its whole shape is "one open
// question you are carrying". `data/calls.ts` picks which one.
//
// NO CLOCK IN THIS VERSION, deliberately. The prototype's ten seconds are
// the game's pressure and they need the IntersectionObserver arming its
// own module describes ("starts when the card is actually in front of
// you, not when it mounts") — a real port, and a mechanic rather than
// data. Everything the card SAYS is true without it.
import React from "react";
import LIVE from "../data/live";
import {
  callPcts,
  cardsFrom,
  daysUntil,
  pickCall,
  recheck,
  stateOf,
  type CallCard,
} from "../data/calls";
import { describeRubric } from "../data/callRubric";

const HUE = "var(--c-foresight, oklch(0.52 0.14 282))";
const GOOD = "var(--c-likeness, oklch(0.55 0.13 150))";
const MISS = "var(--ochre, oklch(0.62 0.12 75))";

const quiet: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)",
};

const wash = (pct: number) => `color-mix(in oklab, ${HUE} ${pct}%, var(--surface-2))`;

/** The call's own split — how everyone else called it. */
function Split({ card, pcts, mark }: { card: CallCard; pcts: number[]; mark: number | null }): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {card.options.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{
            flex: 1, height: 22, borderRadius: 7, background: "var(--surface-2)",
            overflow: "hidden", display: "flex", alignItems: "stretch",
          }}>
            <span style={{
              width: pcts[i] + "%",
              background: i === mark ? HUE : wash(26),
              transition: "width .5s cubic-bezier(0.2,0.8,0.2,1)",
            }}></span>
          </span>
          <span style={{ ...quiet, minWidth: 34, textAlign: "right", color: i === mark ? "var(--ink)" : "var(--ink-3)" }}>
            {pcts[i]}%
          </span>
          <span style={{
            fontFamily: "var(--sans)", fontSize: 13,
            fontWeight: i === mark ? 800 : 600,
            minWidth: 0, flexShrink: 0, maxWidth: "42%",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function LiveCallCard(): React.ReactElement | null {
  const [, bump] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  // Read once per mount rather than per render. The countdown is a
  // sentence, not a clock, and the compiler is right to refuse a wall-time
  // read in a render body — a card that re-renders on someone else's vote
  // must not silently re-date itself.
  const [nowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    // One bounded fetch per session, on the tap that asks (D124/D129).
    void LIVE.loadCallOutcomes?.();
    return LIVE.subscribe?.(() => bump((x) => x + 1));
  }, []);

  if (!LIVE.enabled || !LIVE.callQs) return null;
  const cards = cardsFrom(LIVE.callQs(), LIVE.myVotes(), LIVE.callOutcomes());
  const card = pickCall(cards);
  // Nothing to draw yet: the grades have not been read, so an "open" call
  // might already be graded. The effect above is what ends this state.
  if (!card) return null;
  const state = stateOf(card);
  if (state === "unread") return null;

  const pcts = callPcts(card.counts);
  const days = daysUntil(card.resolvesAt, nowMs);
  const agrees = recheck(card);

  const head = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: HUE }}></span>
        <span className="kicker" style={{ marginBottom: 0 }}>call</span>
      </span>
      <span style={quiet}>
        {state === "open" || state === "sealed"
          ? (days > 0 ? `resolves in ${days} day${days === 1 ? "" : "s"}` : "resolving")
          : "resolved"}
      </span>
    </div>
  );

  const ask = (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {card.options.map((label, i) => (
        <button key={label} className="press" onClick={() => LIVE.vote(card.id, String(i))}
          style={{
            width: "100%", minHeight: "var(--field-size)", padding: "11px 14px", textAlign: "left",
            border: "1px solid color-mix(in oklab, " + HUE + " 24%, var(--rule))",
            borderRadius: 13, background: wash(7), cursor: "pointer", WebkitAppearance: "none",
            fontFamily: "var(--sans)", fontWeight: 700, fontSize: 15, color: "var(--ink)",
          }}>{label}</button>
      ))}
    </div>
  );

  const sealed = card.mine == null ? null : (
    <div style={{
      border: "1.5px solid " + wash(55), borderRadius: 13, background: wash(12),
      padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15, flex: 1 }}>{card.options[card.mine]}</span>
      <span style={{ ...quiet, fontWeight: 700 }}>sealed</span>
    </div>
  );

  const verdict = (state === "right" || state === "wrong") && card.mine != null ? (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15,
      color: state === "right" ? GOOD : MISS,
    }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }}></span>
      {state === "right" ? "You called it" : `You said ${card.options[card.mine]}`}
    </div>
  ) : null;

  // The basis, always — the counts the grade was made from and the test
  // that was run over them. Behind one tap because it is arithmetic rather
  // than a headline, and never behind a claim of correctness: the summary
  // line above it says whether this device reproduces the grade, which is
  // the part a reader should not have to go looking for.
  const inputs = card.outcome?.inputs;
  const basis = (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <button className="press" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{
          border: "none", background: "none", padding: "2px 0", cursor: "pointer",
          alignSelf: "flex-start", WebkitAppearance: "none",
          fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: HUE,
        }}>
        {open ? "hide the working ↑" : "how this was graded →"}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", paddingTop: 9 }}>
          <span style={quiet}>Graded when {describeRubric(card.rubric)}.</span>
          {inputs ? (
            <span style={quiet}>
              It read {inputs.total} answer{inputs.total === 1 ? "" : "s"} on {inputs.qid}
              {inputs.cells
                ? ` — ${Object.entries(inputs.cells).map(([b, c]) => `${b} ${Object.values(c).reduce((x, y) => x + y, 0)}`).join(", ")}`
                : ` — ${Object.entries(inputs.counts).map(([i, c]) => `${card.rubric.qid === inputs.qid ? "option " + i : i} ${c}`).join(", ")}`}
              .
            </span>
          ) : (
            <span style={quiet}>No inputs were published with this outcome.</span>
          )}
          <span style={{ ...quiet, color: agrees === false ? MISS : "var(--ink-3)" }}>
            {agrees === true
              ? "This device re-ran that test on those numbers and got the same answer."
              : agrees === false
                ? "This device re-ran that test on those numbers and got a DIFFERENT answer. Trust the numbers, not the verdict."
                : "Nothing to re-run here."}
          </span>
          {card.outcome?.resolvedBy && card.outcome.resolvedBy !== "auto" && (
            <span style={quiet}>Resolved by hand.</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="card" data-screen-label="Foresight call" style={{ display: "flex", flexDirection: "column", gap: 11, padding: "13px 14px 14px" }}>
      {head}
      <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 19, lineHeight: 1.14, letterSpacing: "-0.03em", textWrap: "balance" }}>
        {card.prompt}
      </div>

      {state === "open" && ask}

      {state === "sealed" && (
        <>
          {sealed}
          {pcts
            ? <Split card={card} pcts={pcts} mark={card.mine} />
            : <span style={quiet}>Nobody else has called this yet.</span>}
        </>
      )}

      {(state === "right" || state === "wrong" || state === "missed") && card.outcome && (
        <>
          {pcts
            ? <Split card={card} pcts={pcts} mark={card.outcome.outcomeIdx} />
            : <span style={quiet}>Nobody called this one.</span>}
          <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5 }}>
            It landed · {card.options[card.outcome.outcomeIdx] ?? "—"}
          </span>
          {verdict}
          {basis}
        </>
      )}

      {state === "void" && (
        <>
          <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 15, color: MISS }}>Void — nobody is scored</div>
          <span style={quiet}>{card.outcome?.note || "This call could not be graded."}</span>
          {basis}
        </>
      )}
    </div>
  );
}
