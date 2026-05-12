import { useState } from "react";
import { Kicker } from "../shared/primitives";

type TestKind = "big5" | "political" | "values";

interface TestDef {
  title: string;
  tag: string;
  accent: string;
  questions: string[];
}

const TESTS: Record<TestKind, TestDef> = {
  big5: {
    title: "the Big Five",
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
    title: "the politics",
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
    title: "values & morals",
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
};

const BLURBS: Record<TestKind, string> = {
  big5: '"Five strokes — Open, Conscientious, Extraverted, Agreeable, Sensitive."',
  political:
    '"Six axes — economic, social, foreign, environment, technology, authority."',
  values:
    '"Where you sit on optimism, duty, hedonism, the meaning of suffering."',
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
  const [kind, setKind] = useState<TestKind | null>(initialKind || null);
  const [step, setStep] = useState(0);
  const [, setAnswers] = useState<number[]>([]);

  if (!kind) {
    return (
      <div className="overlay paper-grain">
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose}>
            ✕
          </button>
          <div className="h-title">
            a <em>quiet</em> test
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
                  onClick={() => setKind(k)}
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
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div className="stamp" style={{ fontSize: 11, padding: "6px 12px" }}>
              complete
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 28,
                marginTop: 20,
                fontStyle: "italic",
              }}
            >
              Thank you.
            </div>
            <div className="margin-note" style={{ marginTop: 12, fontSize: 16 }}>
              Your portrait has been redrawn —
            </div>
            <button
              onClick={onComplete ?? onClose}
              style={{
                marginTop: 32,
                padding: "12px 24px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              read it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
