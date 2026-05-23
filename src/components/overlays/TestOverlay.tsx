import { useEffect, useRef, useState } from "react";
import { Kicker } from "../shared/primitives";
import { RadarChart, Compass2D } from "../shared/charts";
import {
  computeAttachment,
  computeBig5,
  computeChronotype,
  computeMoneyScripts,
  computePolitical,
  computeValues,
  useProfile,
} from "../../lib/useProfile";

type TestKind =
  | "big5"
  | "political"
  | "values"
  | "money"
  | "chronotype"
  | "attachment";

interface TestDef {
  title: string;
  tag: string;
  accent: string;
  questions: string[];
}

const TESTS: Record<TestKind, TestDef> = {
  big5: {
    title: "Big Five",
    tag: "personality · 5 questions",
    accent: "var(--c-around)",
    questions: [
      "I find new ideas more interesting than familiar ones.",
      "I keep my appointments and rarely run late.",
      "I feel energized by spending time with strangers.",
      "I prefer to keep the peace, even at some cost.",
      "I worry about things I can't control.",
    ],
  },
  political: {
    title: "Political compass",
    tag: "compass · 12 questions · 6 axes",
    accent: "var(--c-world)",
    questions: [
      "Markets, left to themselves, distribute fairly.",
      "Inequality is the price of progress.",
      "Tradition deserves the benefit of the doubt.",
      "The state should keep out of private life.",
      "Some speech is harmful enough to restrict.",
      "A society is judged by how it treats the weakest.",
      "Climate action is worth real economic cost.",
      "My country should help others before its own poor.",
      "New technology, on balance, makes life better.",
      "Strong leaders matter more than strong institutions.",
      "Borders should be more open than they are now.",
      "Some forms of order require surveillance.",
    ],
  },
  values: {
    title: "Values & morals",
    tag: "where you sit · 8 questions",
    accent: "var(--c-people)",
    questions: [
      "Technology is solving more problems than it creates.",
      "Future generations will live better than ours.",
      "What I owe my family weighs more than what I owe strangers.",
      "Happiness is mostly a private matter.",
      "Suffering can give life meaning, not just pain.",
      "There are objective right answers in ethics.",
      "I should sacrifice comfort now for a stranger's future.",
      "Beauty matters as much as truth.",
    ],
  },
  // Klontz Money Scripts (short form). 2 questions per script:
  //   0,1 — Avoidance
  //   2,3 — Worship
  //   4,5 — Status
  //   6,7 — Vigilance
  money: {
    title: "Money scripts",
    tag: "how you relate to money · 8 questions",
    accent: "var(--ochre)",
    questions: [
      "Money causes more problems than it solves.",
      "Less money is more spiritual or fulfilling.",
      "More money would make me happier.",
      "It's hard to be poor and happy.",
      "How someone spends says a lot about who they are.",
      "Part of my self-worth is tied to what I own.",
      "I should save for a rainy day, even when it pinches.",
      "I'd rather not tell other people how much I have.",
    ],
  },
  // Chronotype short form. 0,1 morning-pushing; 2,3 evening-pushing.
  chronotype: {
    title: "Chronotype",
    tag: "morning or evening · 4 questions",
    accent: "var(--sage)",
    questions: [
      "I'd rather wake up early than stay up late.",
      "I do my best thinking in the morning.",
      "I feel most alert in the evening.",
      "Given total freedom, I'd sleep past 9 am.",
    ],
  },
  // ECR-R short form. 0..3 anxiety; 4..7 avoidance.
  attachment: {
    title: "Attachment style",
    tag: "how you bond · 8 questions",
    accent: "var(--sienna)",
    questions: [
      "I worry that the people I'm close to won't care as much as I care about them.",
      "I worry about being abandoned.",
      "My desire to be very close to someone sometimes scares them away.",
      "I often want to merge completely with the people I'm close to.",
      "I prefer not to depend on others, or have them depend on me.",
      "I don't feel comfortable opening up to people.",
      "I get nervous when anyone gets too emotionally close.",
      "I'd rather not show the people I'm close to how I feel underneath.",
    ],
  },
};

const BLURBS: Record<TestKind, string> = {
  big5: "Five strokes — Open, Conscientious, Extraverted, Agreeable, Sensitive.",
  political:
    "Six axes — economic, social, foreign, environment, technology, authority.",
  values:
    "Where you sit on optimism, duty, hedonism, the meaning of suffering.",
  money:
    "Four scripts — Avoidance, Worship, Status, Vigilance. Shapes the Money tab.",
  chronotype:
    "Morning or evening person. Shapes Body-tab timing hints.",
  attachment:
    "Anxiety / avoidance dimensions, four styles. Shapes People-tab relationship reads.",
};

interface TestOverlayProps {
  onClose: () => void;
  onComplete?: () => void;
  kind?: TestKind | null;
}

export function TestOverlay({
  onClose,
  onComplete,
  kind: initialKind,
}: TestOverlayProps) {
  const { save } = useProfile();
  const [kind, setKind] = useState<TestKind | null>(initialKind || null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  // Ref instead of state so the "save once" guard doesn't trigger a
  // re-render or trip the set-state-in-effect lint rule.
  const savedRef = useRef(false);

  const pickKind = (k: TestKind) => {
    savedRef.current = false;
    setStep(0);
    setAnswers([]);
    setKind(k);
  };

  // When the test completes, compute scores and save them once.
  useEffect(() => {
    if (!kind || savedRef.current) return;
    const T = TESTS[kind];
    if (answers.length < T.questions.length) return;
    savedRef.current = true;
    if (kind === "big5") {
      const personality = computeBig5(answers);
      void save({ personality });
    } else if (kind === "political") {
      const { political, axes } = computePolitical(answers);
      void save({ political, politicalAxes: { ...axes } });
    } else if (kind === "values") {
      const { cv, morals } = computeValues(answers);
      void save({ cv, morals });
    } else if (kind === "money") {
      const moneyScripts = computeMoneyScripts(answers);
      void save({ moneyScripts });
    } else if (kind === "chronotype") {
      const chronotype = computeChronotype(answers);
      void save({ chronotype });
    } else if (kind === "attachment") {
      const attachment = computeAttachment(answers);
      void save({ attachment });
    }
  }, [kind, answers, save]);

  if (!kind) {
    return (
      <div className="overlay paper-grain">
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose}>
            ✕
          </button>
          <div className="h-title">
            <em>Test</em>
          </div>
          <div style={{ width: 36 }} />
        </div>
        <div className="app-body">
          <Kicker>Pick a portrait to redraw</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 14,
            }}
          >
            {(Object.entries(TESTS) as [TestKind, TestDef][]).map(
              ([k, t]) => (
                <div
                  key={k}
                  onClick={() => pickKind(k)}
                  className="card"
                  style={{
                    cursor: "pointer",
                    borderLeft: `3px solid ${t.accent}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 18,
                      fontStyle: "italic",
                    }}
                  >
                    {t.title}
                  </div>
                  <div
                    className="kicker"
                    style={{ marginTop: 4 }}
                  >
                    {t.tag}
                  </div>
                  <div
                    className="margin-note"
                    style={{ marginTop: 8, fontSize: 13 }}
                  >
                    {BLURBS[k]}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    );
  }

  const T = TESTS[kind];
  const qs = T.questions;
  const done = step >= qs.length;

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">{T.title}</div>
        <div className="h-meta">
          {Math.min(step + 1, qs.length)}/{qs.length}
        </div>
      </div>
      <div
        className="app-body"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {!done ? (
          <div style={{ marginTop: 40 }}>
            <div className="kicker">
              Question {String(step + 1).padStart(2, "0")}
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 26,
                fontStyle: "italic",
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
                marginTop: 16,
              }}
            >
              {qs[step]}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 32,
              }}
            >
              {[
                "Strongly disagree",
                "Disagree",
                "Neither",
                "Agree",
                "Strongly agree",
              ].map((label, i) => (
                <button
                  key={label}
                  onClick={() => {
                    setAnswers((a) => [...a, i]);
                    setStep(step + 1);
                  }}
                  style={{
                    padding: "14px 18px",
                    textAlign: "left",
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: "var(--serif)",
                    fontSize: 15,
                    color: "var(--ink)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: "var(--ink-3)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <TestResult
            kind={kind}
            answers={answers}
            onDone={onComplete ?? onClose}
          />
        )}
      </div>
    </div>
  );
}

// ─── TestResult — shows the actual computed scores ──────────────
function TestResult({
  kind,
  answers,
  onDone,
}: {
  kind: TestKind;
  answers: number[];
  onDone: () => void;
}) {
  return (
    <div style={{ padding: "16px 4px 24px" }}>
      <div style={{ textAlign: "center" }}>
        <div className="stamp" style={{ fontSize: 11, padding: "6px 12px" }}>
          complete
        </div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 26,
            marginTop: 18,
            fontStyle: "italic",
          }}
        >
          your portrait, redrawn.
        </div>
        <div className="margin-note" style={{ marginTop: 8, fontSize: 13 }}>
          saved to your profile.
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {kind === "big5" && <Big5Result answers={answers} />}
        {kind === "political" && <PoliticalResult answers={answers} />}
        {kind === "values" && <ValuesResult answers={answers} />}
        {kind === "money" && <MoneyScriptsResult answers={answers} />}
        {kind === "chronotype" && <ChronotypeResult answers={answers} />}
        {kind === "attachment" && <AttachmentResult answers={answers} />}
      </div>

      <button
        onClick={onDone}
        style={{
          marginTop: 28,
          padding: "12px 24px",
          background: "var(--ink)",
          color: "var(--paper)",
          border: "none",
          borderRadius: 999,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 15,
          cursor: "pointer",
          display: "block",
          margin: "28px auto 0",
        }}
      >
        close
      </button>
    </div>
  );
}

function Big5Result({ answers }: { answers: number[] }) {
  const v = computeBig5(answers);
  const labels = ["Open", "Cons.", "Extra.", "Agree.", "Sens."];
  return (
    <div className="card">
      <Kicker>Big Five · how you scored</Kicker>
      <div style={{ marginTop: 8 }}>
        <RadarChart values={v} labels={labels} color="var(--c-around)" size={240} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 6,
          marginTop: 8,
        }}
      >
        {v.map((n, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div className="fig-num" style={{ fontSize: 18 }}>
              <em>{n}</em>
            </div>
            <div className="kicker" style={{ fontSize: 8.5 }}>
              {labels[i].toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PoliticalResult({ answers }: { answers: number[] }) {
  const { political, axes } = computePolitical(answers);
  return (
    <div className="card">
      <Kicker>Politics · where you landed</Kicker>
      <div style={{ marginTop: 8 }}>
        <Compass2D
          x={political.econ}
          y={-political.social}
          label="you"
          xLabel={["← Left", "Right →"]}
          yLabel={["↑ Liberty", "↓ Authority"]}
          accent="var(--c-world)"
          size={240}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          marginTop: 12,
        }}
      >
        {(
          [
            ["econ", "econ"],
            ["social", "social"],
            ["foreign", "foreign"],
            ["env", "env"],
            ["tech", "tech"],
            ["auth", "auth"],
          ] as [keyof typeof axes, string][]
        ).map(([k, label]) => (
          <div key={k} style={{ textAlign: "center" }}>
            <div className="fig-num" style={{ fontSize: 16 }}>
              <em>
                {axes[k] >= 0 ? "+" : ""}
                {axes[k]}
              </em>
            </div>
            <div className="kicker" style={{ fontSize: 8.5 }}>
              {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValuesResult({ answers }: { answers: number[] }) {
  const { cv, morals } = computeValues(answers);
  const rows = Object.entries(morals);
  return (
    <div className="card">
      <Kicker>Values · where you sit</Kicker>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(([k, v]) => {
          const pct = (v + 100) / 2;
          return (
            <div key={k}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                <span>{k}</span>
                <span style={{ color: "var(--ink-2)" }}>
                  {v >= 0 ? "+" : ""}
                  {v}
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 999,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: -2,
                    width: 1,
                    height: 9,
                    background: "var(--rule)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: `calc(${pct}% - 4px)`,
                    top: -2.5,
                    width: 9,
                    height: 9,
                    background: "var(--c-people)",
                    borderRadius: "50%",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: "0.5px dashed var(--rule)",
          display: "flex",
          justifyContent: "space-around",
          textAlign: "center",
        }}
      >
        <div>
          <div className="fig-num" style={{ fontSize: 20 }}>
            <em>
              {cv.indiv >= 0 ? "+" : ""}
              {cv.indiv}
            </em>
          </div>
          <div className="kicker">COLLECTIVE ↔ INDIV</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 20 }}>
            <em>
              {cv.change >= 0 ? "+" : ""}
              {cv.change}
            </em>
          </div>
          <div className="kicker">STABILITY ↔ CHANGE</div>
        </div>
      </div>
    </div>
  );
}

// ─── Money Scripts result ────────────────────────────────────────

function MoneyScriptsResult({ answers }: { answers: number[] }) {
  const ms = computeMoneyScripts(answers);
  const rows: { key: keyof typeof ms; label: string; note: string }[] = [
    { key: "avoidance", label: "Avoidance", note: "money causes more trouble than it solves" },
    { key: "worship", label: "Worship", note: "more money = more happiness" },
    { key: "status", label: "Status", note: "what you own says who you are" },
    { key: "vigilance", label: "Vigilance", note: "save, save, save — and don't tell" },
  ];
  const dominant = rows.reduce((top, r) =>
    ms[r.key] > ms[top.key] ? r : top,
  );
  return (
    <div className="card">
      <Kicker>Money scripts · how you relate to it</Kicker>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 22,
          marginTop: 6,
        }}
      >
        Dominant: <em>{dominant.label}</em>
      </div>
      <div className="margin-note" style={{ marginTop: 4, fontSize: 12 }}>
        {dominant.note}
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.key}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-2)",
              }}
            >
              <span>{r.label}</span>
              <span style={{ color: "var(--ink-3)" }}>{ms[r.key]}/100</span>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                marginTop: 3,
              }}
            >
              <div
                style={{
                  width: `${ms[r.key]}%`,
                  height: "100%",
                  background: "var(--ochre)",
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chronotype result ────────────────────────────────────────────

function ChronotypeResult({ answers }: { answers: number[] }) {
  const c = computeChronotype(answers);
  const label =
    c.category === "lark"
      ? "Lark · morning person"
      : c.category === "owl"
        ? "Owl · evening person"
        : "Intermediate · neither end";
  return (
    <div className="card">
      <Kicker>Chronotype · when you're sharpest</Kicker>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 22,
          marginTop: 6,
        }}
      >
        {label}
      </div>
      <div className="margin-note" style={{ marginTop: 6, fontSize: 12 }}>
        Score: <em>{c.score}/100</em> · 0 = strong morning, 100 = strong evening.
      </div>
      <div
        style={{
          marginTop: 16,
          position: "relative",
          height: 28,
          background: "linear-gradient(90deg, oklch(0.92 0.04 60), oklch(0.55 0.10 250))",
          border: "0.5px solid var(--rule)",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `calc(${c.score}% - 6px)`,
            top: -2,
            width: 12,
            height: 32,
            background: "var(--ink)",
            borderRadius: 6,
            border: "1px solid var(--paper)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--ink-3)",
          marginTop: 6,
          letterSpacing: "0.08em",
        }}
      >
        <span>LARK · morning</span>
        <span>OWL · evening</span>
      </div>
    </div>
  );
}

// ─── Attachment result ───────────────────────────────────────────

function AttachmentResult({ answers }: { answers: number[] }) {
  const a = computeAttachment(answers);
  const styleLabels: Record<typeof a.style, { name: string; note: string }> = {
    secure: {
      name: "Secure",
      note: "comfortable depending on others, comfortable being depended on",
    },
    anxious: {
      name: "Anxious / preoccupied",
      note: "want closeness, worry about it being returned",
    },
    avoidant: {
      name: "Avoidant / dismissive",
      note: "value self-reliance, keep emotional distance",
    },
    disorganized: {
      name: "Disorganized / fearful-avoidant",
      note: "want closeness AND fear it — high in both dimensions",
    },
  };
  const info = styleLabels[a.style];
  return (
    <div className="card">
      <Kicker>Attachment · how you bond</Kicker>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 22,
          marginTop: 6,
        }}
      >
        {info.name}
      </div>
      <div className="margin-note" style={{ marginTop: 4, fontSize: 12 }}>
        {info.note}
      </div>
      <div style={{ marginTop: 14 }}>
        <Compass2D
          x={a.avoidance - 50}
          y={a.anxiety - 50}
          label="you"
          xLabel={["← low avoidance", "high avoidance →"]}
          yLabel={["↑ high anxiety", "↓ low anxiety"]}
          accent="var(--sienna)"
          size={240}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 12,
        }}
      >
        <div>
          <div className="kicker">ANXIETY</div>
          <div className="fig-num" style={{ fontSize: 22 }}>
            <em>{a.anxiety}</em>
            <span
              style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-3)", marginLeft: 4 }}
            >
              /100
            </span>
          </div>
        </div>
        <div>
          <div className="kicker">AVOIDANCE</div>
          <div className="fig-num" style={{ fontSize: 22 }}>
            <em>{a.avoidance}</em>
            <span
              style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-3)", marginLeft: 4 }}
            >
              /100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
