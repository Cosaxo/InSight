import { useState } from "react";
import { C } from "../../theme";
import { BIG5_Q, POL_Q, CV_Q } from "../../data/tests";
import type { TestResult, TestType } from "../../types";
import { Card } from "../shared/Card";
import { IcoBack } from "../icons/UtilIcons";

interface TestFlowProps {
  type: TestType;
  onComplete: (result: TestResult) => void;
  onCancel: () => void;
}

const LABELS = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

const TITLES: Record<TestType, string> = {
  personality: "Big Five test",
  political: "Political compass test",
  values: "Core Values test",
};

const ACCENT: Record<TestType, string> = {
  personality: C.teal,
  political: C.purple,
  values: C.coral,
};

export function TestFlow({ type, onComplete, onCancel }: TestFlowProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const Qs =
    type === "personality" ? BIG5_Q : type === "political" ? POL_Q : CV_Q;
  const q = Qs[step];
  const pct = Math.round((step / Qs.length) * 100);
  const accentColor = ACCENT[type];

  function finalize(next: Record<number, number>) {
    if (type === "personality") {
      const t = [0, 0, 0, 0, 0];
      BIG5_Q.forEach((q2, i) => {
        const a = next[i] || 3;
        t[q2.t] += q2.dir === 1 ? (a - 1) * 12.5 : (5 - a) * 12.5;
      });
      onComplete({ personality: t.map(Math.round) });
    } else if (type === "political") {
      let e = 0,
        s = 0;
      POL_Q.forEach((q2, i) => {
        const a = next[i] || 3;
        const sc = (a - 3) * q2.dir * 10;
        if (q2.axis === "econ") e += sc;
        else s += sc;
      });
      onComplete({ political: { econ: Math.round(e / 2), social: Math.round(s / 2) } });
    } else {
      let indiv = 0,
        change = 0;
      CV_Q.forEach((q2, i) => {
        const a = next[i] || 3;
        const sc = (a - 3) * q2.dir * 10;
        if (q2.axis === "indiv") indiv += sc;
        else change += sc;
      });
      onComplete({ cv: { indiv: Math.round(indiv / 2), change: Math.round(change / 2) } });
    }
  }

  function answer(val: number) {
    const next = { ...answers, [step]: val };
    setAnswers(next);
    if (step < Qs.length - 1) {
      setStep(step + 1);
      return;
    }
    finalize(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onCancel}
          aria-label="Cancel test"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: "pointer",
            display: "flex",
          }}
        >
          <IcoBack col={C.teal} />
        </button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.navy }}>
            {TITLES[type]}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Question {step + 1} of {Qs.length}
          </div>
        </div>
      </div>
      <div
        style={{
          height: 5,
          background: C.dim,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: accentColor,
            borderRadius: 3,
            transition: "width 0.3s",
          }}
        />
      </div>
      <Card>
        <div
          style={{
            fontSize: 16,
            color: C.text,
            lineHeight: 1.55,
            minHeight: 60,
          }}
        >
          "{q.text}"
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((val) => (
          <button
            key={val}
            onClick={() => answer(val)}
            style={{
              background:
                answers[step] === val ? `${accentColor}10` : C.card,
              border: `1.5px solid ${answers[step] === val ? accentColor : C.divider}`,
              color: C.text,
              padding: "13px 16px",
              borderRadius: 14,
              fontFamily: "inherit",
              fontSize: 14,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: C.shadow,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                flexShrink: 0,
                background: answers[step] === val ? accentColor : C.dim,
                color: answers[step] === val ? "#fff" : C.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {val}
            </span>
            {LABELS[val - 1]}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button
          onClick={() => setStep(step - 1)}
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            fontFamily: "inherit",
            fontSize: 13,
            cursor: "pointer",
            padding: 4,
          }}
        >
          Back
        </button>
      )}
    </div>
  );
}
