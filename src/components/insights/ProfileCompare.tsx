import { IS_DATA } from "../../data/seedData";
import { Kicker } from "../shared/primitives";
import {
  BellCurve,
  CompareCompass,
  DivergeBars,
  LayeredHistogram,
} from "../shared/charts";

interface ProfileCompareProps {
  scope: "around" | "city" | "world" | "circle";
  accent?: string;
}

interface Big5 {
  O: number;
  C: number;
  E: number;
  A: number;
  N: number;
}

const BIG5_LABELS: Record<keyof Big5, string> = {
  O: "Openness",
  C: "Conscient.",
  E: "Extraversion",
  A: "Agreeable.",
  N: "Neuroticism",
};

function big5Type(b5: Big5): string {
  const traits: {
    k: keyof Big5;
    high: string;
    low: string;
  }[] = [
    { k: "O", high: "The Curious", low: "The Steady" },
    { k: "C", high: "The Disciplined", low: "The Spontaneous" },
    { k: "E", high: "The Outgoing", low: "The Reflective" },
    { k: "A", high: "The Warm", low: "The Direct" },
    { k: "N", high: "The Sensitive", low: "The Composed" },
  ];
  const sorted = traits
    .map((t) => ({ ...t, dev: Math.abs(b5[t.k] - 50) }))
    .sort((a, b) => b.dev - a.dev);
  const top = sorted[0];
  return b5[top.k] >= 50 ? top.high : top.low;
}

export function ProfileCompare({
  scope,
  accent = "var(--accent)",
}: ProfileCompareProps) {
  const A = IS_DATA.aggregates;
  const you = A?.you;
  const them = A?.[scope];
  if (!them || !you) return null;

  const moodLabels = ["1", "2", "3", "4", "5"];
  const big5Rows = (["O", "C", "E", "N", "A"] as (keyof Big5)[]).map((k) => ({
    label: BIG5_LABELS[k],
    you: you.big5[k] as number,
    avg: them.big5[k] as number,
  }));

  return (
    <div>
      <Kicker>Comparing — you ↔ {them.label}</Kicker>
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 8,
          marginBottom: 14,
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--ink-3)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        <span>n = {(them.n as number).toLocaleString()}</span>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Mood · 30-day distribution</Kicker>
        <div style={{ marginTop: 12 }}>
          <LayeredHistogram
            a={you.mood as number[]}
            b={them.mood as number[]}
            labels={moodLabels}
            colorA={accent}
            colorB="var(--ink-3)"
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 14,
            paddingTop: 12,
            borderTop: "0.5px solid var(--rule)",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 8.5,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              YOU · AVG
            </div>
            <div className="fig-num" style={{ fontSize: 22 }}>
              <em>{(you.moodAvg as number).toFixed(1)}</em>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 8.5,
                color: "var(--ink-3)",
                letterSpacing: "0.1em",
              }}
            >
              {(them.label as string).toUpperCase()} · AVG
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 22,
                color: "var(--ink-2)",
              }}
            >
              {(them.moodAvg as number).toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Big Five · personality vs avg</Kicker>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 6,
            marginBottom: 10,
          }}
        >
          <div className="margin-note">
            {them.label}: <em>{big5Type(them.big5)}</em>
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: accent,
              letterSpacing: "0.1em",
            }}
          >
            YOU · {big5Type(you.big5).toUpperCase()}
          </div>
        </div>
        <DivergeBars rows={big5Rows} color={accent} altColor="var(--ink-3)" />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Political · econ × social</Kicker>
        <div style={{ marginTop: 8 }}>
          <CompareCompass
            you={{
              x: you.political.econ * 1.5,
              y: -you.political.social * 1.5,
            }}
            them={{
              x: them.political.econ * 1.5,
              y: -them.political.social * 1.5,
            }}
            themLabel={them.label}
            accent={accent}
            size={250}
            xLabel={["← Left", "Right →"]}
            yLabel={["↑ Liberty", "↓ Authority"]}
          />
        </div>
      </div>

      <div className="card">
        <Kicker>Where you fall — within {them.label}</Kicker>
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
              marginBottom: 4,
            }}
          >
            ECONOMIC AXIS
          </div>
          <BellCurve
            value={you.political.econ}
            mean={them.political.econ}
            stdev={28}
            color={accent}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              letterSpacing: "0.1em",
              marginBottom: 4,
            }}
          >
            SOCIAL AXIS
          </div>
          <BellCurve
            value={you.political.social}
            mean={them.political.social}
            stdev={26}
            color={accent}
          />
        </div>
      </div>
    </div>
  );
}
