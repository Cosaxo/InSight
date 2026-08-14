// The topic preferences panel (D128) — what the app thinks you want,
// where you say it rather than where it guesses.
//
// This is tier 1 of docs/ATTENTION.md and the whole of what ships: every
// weight here got its value because someone tapped it. Nothing on this
// screen was inferred from a scroll, a dwell or a skip, and the copy says
// so — because the difference between "you told us" and "we worked it
// out" is the difference between a preference and a profile, and only one
// of those is refused by docs/MONITORING.md.
//
// It reads as a settings panel, and it is deliberately boring. The
// interesting version — a learned model, shown back to you — is tier 2,
// and it needs a decision this does not.
import React from "react";
import {
  INTEREST_LABEL, MORE, MUTED, NEUTRAL,
  hasStated, interestIn, resetInterests, setInterest, subscribeInterests,
  type Interest,
} from "../data/interests";

const IP_LINE = "1px solid var(--rule)";

/**
 * The topics a preference can be stated about.
 *
 * A local copy of the feed's topic list rather than a read of
 * `window.WORLD_TOPICS`, for two reasons: this panel is typed TSX and the
 * D39 ratchet only moves down, and a preference for a topic the pool no
 * longer carries is harmless (it simply never matches) while a panel that
 * crashed because a global had not loaded would not be.
 */
const TOPICS: Array<{ id: string; label: string }> = [
  { id: "sport", label: "Sport" },
  { id: "food", label: "Food" },
  { id: "movies", label: "Movies & TV" },
  { id: "music", label: "Music" },
  { id: "tech", label: "Tech" },
  { id: "culture", label: "Culture" },
  { id: "dilemma", label: "Dilemmas" },
  { id: "event", label: "What's happening" },
  { id: "people", label: "People" },
  { id: "bigq", label: "Big questions" },
];

const STATES: Interest[] = [MUTED, NEUTRAL, MORE];

function Row({ id, label, onPick }: { id: string; label: string; onPick: () => void }) {
  const w = interestIn(id);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: IP_LINE }}>
      <span style={{ flex: 1, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{label}</span>
      <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 4 }}>
        {STATES.map((s) => {
          const on = w === s;
          return (
            <button key={s} role="radio" aria-checked={on}
              onClick={() => { setInterest(id, s); onPick(); }}
              style={{
                border: IP_LINE, borderRadius: 999, padding: "4px 11px", cursor: "pointer",
                fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11.5, WebkitAppearance: "none",
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--surface)" : "var(--ink-3)",
              }}>{INTEREST_LABEL[String(s)]}</button>
          );
        })}
      </div>
    </div>
  );
}

function LiveInterestsPanel() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => subscribeInterests(bump), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="kicker" style={{ marginBottom: 0 }}>What you want more of</div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5, marginBottom: 6 }}>
        {/* The two sentences this panel exists to be able to say. */}
        These change the <strong>feed</strong> only — the question of the day
        is the same one for everybody, and the Mirror shows you every
        population whether you like them or not.
        {" "}Nothing here is guessed from what you scroll past; it says what
        you tapped.
      </div>

      {TOPICS.map((t) => <Row key={t.id} id={t.id} label={t.label} onPick={bump} />)}

      {hasStated() && (
        <button onClick={() => resetInterests()} style={{
          alignSelf: "flex-start", marginTop: 12, border: IP_LINE, borderRadius: 999,
          padding: "6px 14px", cursor: "pointer", fontFamily: "var(--sans)",
          fontWeight: 700, fontSize: 12, background: "transparent", color: "var(--ink-2)",
          WebkitAppearance: "none",
        }}>Reset all to normal</button>
      )}
    </div>
  );
}

export default LiveInterestsPanel;
