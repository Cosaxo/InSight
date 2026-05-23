// ProfileCompare — a "you ↔ {scope}" block. Ported from the
// prototype, but wired to real data only: your Big Five + your 30-day
// mood come from useProfile / useMoods; the per-scope average is
// passed in by the parent tab (computed from whatever real aggregate
// that scope has — area cell, world snapshot, or circle). Sections
// render honest empty states when the data they need doesn't exist
// yet, so nothing here is fabricated.
//
// Scope-level mood + political aggregates don't exist yet, so the
// mood card shows only your own distribution and the political
// comparison is omitted until those aggregates land.

import { useMemo } from "react";
import { useProfile } from "../../lib/useProfile";
import { useMoods } from "../../lib/useMoods";
import { Kicker } from "../shared/primitives";
import { DivergeBars, LayeredHistogram } from "../shared/charts";

// Big Five vector order across the app: [O, C, E, A, N].
const BIG5_LABELS = [
  "Openness",
  "Conscient.",
  "Extraversion",
  "Agreeable.",
  "Neuroticism",
];

// Per-scope average + sample size, or null when the scope has no
// honest aggregate yet.
export interface ScopeAggregate {
  n: number;
  big5: number[]; // length 5, [O, C, E, A, N]
}

interface ProfileCompareProps {
  label: string;
  scopeAggregate: ScopeAggregate | null;
  accent?: string;
}

function big5Type(b5: number[]): string {
  const traits = [
    { i: 0, high: "The Curious", low: "The Steady" },
    { i: 1, high: "The Disciplined", low: "The Spontaneous" },
    { i: 2, high: "The Outgoing", low: "The Reflective" },
    { i: 3, high: "The Warm", low: "The Direct" },
    { i: 4, high: "The Sensitive", low: "The Composed" },
  ];
  const top = [...traits].sort(
    (a, b) => Math.abs(b5[b.i] - 50) - Math.abs(b5[a.i] - 50),
  )[0];
  return b5[top.i] >= 50 ? top.high : top.low;
}

export function ProfileCompare({
  label,
  scopeAggregate,
  accent = "var(--accent)",
}: ProfileCompareProps) {
  const { profile } = useProfile();
  const { moods } = useMoods();

  const youBig5 =
    Array.isArray(profile.personality) && profile.personality.length === 5
      ? profile.personality
      : null;

  const { dist, avg, count } = useMemo(() => {
    // Most recent 30 logged days (moods are one-per-date), newest
    // first — avoids a wall-clock window so render stays pure.
    const recent = [...moods]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 30);
    const d = [0, 0, 0, 0, 0];
    for (const m of recent) {
      const s = Math.max(1, Math.min(5, Math.round(m.score)));
      d[s - 1] += 1;
    }
    const total = recent.length;
    const a = total ? recent.reduce((s, m) => s + m.score, 0) / total : 0;
    return { dist: d, avg: a, count: total };
  }, [moods]);

  return (
    <div>
      <Kicker>Comparing — you ↔ {label}</Kicker>
      {scopeAggregate && (
        <div
          style={{
            marginTop: 6,
            marginBottom: 12,
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "var(--ink-2)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          n = {scopeAggregate.n.toLocaleString()}
        </div>
      )}

      <div className="card" style={{ marginTop: 8, marginBottom: 14 }}>
        <Kicker>Your mood · 30-day distribution</Kicker>
        {count === 0 ? (
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
          >
            Log a few daily moods to see your distribution here.
          </div>
        ) : (
          <>
            <div style={{ marginTop: 12 }}>
              <LayeredHistogram
                a={dist}
                labels={["1", "2", "3", "4", "5"]}
                colorA={accent}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 12,
                paddingTop: 10,
                borderTop: "0.5px solid var(--rule)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 8.5,
                  color: "var(--ink-3)",
                  letterSpacing: "0.1em",
                }}
              >
                YOUR AVG
              </span>
              <span className="fig-num" style={{ fontSize: 22 }}>
                <em>{avg.toFixed(1)}</em>
              </span>
            </div>
            <div
              className="margin-note"
              style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}
            >
              Community mood comparison appears once {label} has a
              shared-mood aggregate.
            </div>
          </>
        )}
      </div>

      <div className="card">
        <Kicker>Big Five · you vs {label}</Kicker>
        {!youBig5 ? (
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
          >
            Take the Big Five test to compare your personality.
          </div>
        ) : !scopeAggregate ? (
          <div
            className="margin-note"
            style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
          >
            Not enough people in {label} yet for a personality average.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              <span className="margin-note">
                {label}: <em>{big5Type(scopeAggregate.big5)}</em>
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: accent,
                  letterSpacing: "0.1em",
                }}
              >
                YOU · {big5Type(youBig5).toUpperCase()}
              </span>
            </div>
            <DivergeBars
              rows={BIG5_LABELS.map((lab, i) => ({
                label: lab,
                you: youBig5[i],
                avg: scopeAggregate.big5[i],
              }))}
              color={accent}
            />
          </>
        )}
      </div>
    </div>
  );
}
