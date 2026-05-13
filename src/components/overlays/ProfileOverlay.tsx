// ProfileOverlay — your portrait.
//
// What's honest here:
// • Identity chrome (name, initials, hue) comes from useMe (real auth).
// • Personality, politics, morals come from useProfile, populated by
//   the test overlay. Each section shows an empty-state with a
//   "take the test" CTA when the underlying data isn't there.
// • Likes, dislikes, heroes render only when the profile has values
//   for them — the schema supports them and they survive sign-out,
//   but no in-app editor writes them yet (a legacy ProfilePanel.tsx
//   does, but isn't mounted). Hidden when empty rather than seeded.
//
// What used to be here but isn't anymore: vital statistics, interests
// tag cloud, languages, life timeline, and badges all rendered seed
// data with no real source or schema field. They're removed; revival
// path is to add a real editor + schema field per section.

import { IS_DATA } from "../../data/seedData";
import { useMe } from "../../lib/useMe";
import { useProfile, type ProfileExt } from "../../lib/useProfile";
import type { Hero, Political } from "../../types";
import { Av, Kicker } from "../shared/primitives";
import { RadarChart } from "../shared/charts";
import {
  PoliticsCard,
  PoliticsCompass,
} from "./politics";

type TestKind = "big5" | "political" | "values";

interface ProfileOverlayProps {
  onClose: () => void;
  onOpenTest?: (kind: TestKind) => void;
}

const BIG5_KEYS = ["O", "C", "E", "A", "N"] as const;
type Big5Key = (typeof BIG5_KEYS)[number];
const BIG5_FULL: Record<Big5Key, string> = {
  O: "Openness",
  C: "Conscientiousness",
  E: "Extraversion",
  A: "Agreeableness",
  N: "Neuroticism",
};

const BIG5_LABELS: Record<
  string,
  { name: string; tag: string; glyph: string }
> = {
  Openness: {
    name: "The Seeker",
    tag: "open, curious, drawn to the new",
    glyph: "✶",
  },
  Conscientiousness: {
    name: "The Steady",
    tag: "ordered, deliberate, finishes what begins",
    glyph: "◆",
  },
  Extraversion: {
    name: "The Spark",
    tag: "energised by people, warm in company",
    glyph: "☀",
  },
  Agreeableness: {
    name: "The Kind",
    tag: "gentle, trusting, slow to judge",
    glyph: "✿",
  },
  Neuroticism: {
    name: "The Sensitive",
    tag: "feels deeply, weather close to the skin",
    glyph: "☾",
  },
};

const MORAL_ROWS: [string, string, [string, string]][] = [
  ["tech", "tech", ["doomer", "optimist"]],
  ["future", "future", ["pessimist", "optimist"]],
  ["duty", "duty", ["strangers", "family"]],
  ["hedonism", "hedonism", ["duty", "pleasure"]],
  ["meaning", "meaning", ["happiness", "suffering matters"]],
  ["moral", "ethics", ["relativist", "objectivist"]],
  ["altruism", "altruism", ["self", "stranger"]],
  ["beauty", "beauty", ["truth only", "beauty matters"]],
];

const MORAL_KEYS = MORAL_ROWS.map((r) => r[0]);

interface Ideology {
  id: string;
  name: string;
  econ: number;
  social: number;
}

// PoliticsCard reads a `politicalIdentity` { name, tag } pair off
// `me`. We don't have a saved identity for the user — derive it by
// snapping to the closest ideology on the seed compass. The tag is
// left blank when we don't have copy for the synthesised identity;
// PoliticsCard renders it as ' "" ' which is harmless.
function deriveIdentity(political: Political): { name: string; tag: string } {
  const ideologies = IS_DATA.ideologies as Ideology[];
  let best: { name: string; d: number } | null = null;
  for (const io of ideologies) {
    const dx = io.econ - political.econ;
    const dy = io.social - political.social;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!best || d < best.d) best = { name: io.name, d };
  }
  return { name: best?.name ?? "—", tag: "" };
}

interface MePoliticsAdapter {
  political: Record<string, number>;
  politicalIdentity: { name: string; tag: string };
  politicalSub: Record<string, Record<string, number | string>>;
  morals: Record<string, number>;
  moralLabel: string;
}

function buildMePolitics(profile: ProfileExt): MePoliticsAdapter | null {
  if (!profile.political) return null;
  // The 2-axis political result (econ/social) is always saved
  // alongside the 6-axis politicalAxes by the test overlay, so a
  // present `political` implies the rest. Defensive merge anyway.
  const merged: Record<string, number> = {
    ...(profile.politicalAxes ?? {}),
    econ: profile.political.econ,
    social: profile.political.social,
  };
  return {
    political: merged,
    politicalIdentity: deriveIdentity(profile.political),
    politicalSub: {},
    morals: profile.morals ?? {},
    moralLabel: "",
  };
}

interface EmptyStateProps {
  kind: TestKind;
  title: string;
  copy: string;
  onOpenTest?: (kind: TestKind) => void;
}

function TestEmptyState({ kind, title, copy, onOpenTest }: EmptyStateProps) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>{title}</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 8, fontSize: 13, fontStyle: "italic" }}
      >
        {copy}
      </div>
      {onOpenTest && (
        <button
          onClick={() => onOpenTest(kind)}
          style={{
            marginTop: 12,
            padding: "8px 14px",
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          → take the test
        </button>
      )}
    </div>
  );
}

export function ProfileOverlay({ onClose, onOpenTest }: ProfileOverlayProps) {
  const realMe = useMe();
  const { profile } = useProfile();

  const big5Vec = profile.personality;
  const personalityReady =
    Array.isArray(big5Vec) && big5Vec.length === 5 &&
    big5Vec.every((n) => typeof n === "number");

  const dims = personalityReady
    ? BIG5_KEYS.map((k, i) => ({ label: BIG5_FULL[k], v: big5Vec![i] }))
    : [];
  const sorted = [...dims].sort((a, b) => b.v - a.v);
  const top = sorted[0];
  const meta = top ? BIG5_LABELS[top.label] : null;

  const mePolitics = buildMePolitics(profile);

  const moralsReady =
    !!profile.morals && MORAL_KEYS.every((k) => typeof profile.morals![k] === "number");

  const likes = profile.likes ?? [];
  const dislikes = profile.dislikes ?? [];
  const heroes = (profile.heroes ?? []) as Hero[];

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          your <em>portrait</em>
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body">
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <Av init={realMe.initials} hue={realMe.hue} size={88} />
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 26,
              marginTop: 12,
              letterSpacing: "-0.01em",
            }}
          >
            {realMe.name}
          </div>
        </div>
        <hr className="rule-dashed" />

        {personalityReady && meta && top ? (
          <>
            <div className="card" style={{ marginBottom: 14 }}>
              <Kicker>Personality summary · Big Five</Kicker>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 10,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    border: "1.5px solid var(--accent)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 32,
                    lineHeight: 1,
                  }}
                >
                  {meta.glyph}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 18,
                      fontStyle: "italic",
                    }}
                  >
                    {meta.name}
                  </div>
                  <div className="kicker" style={{ marginTop: 4 }}>
                    {top.label.toLowerCase()} dominant · {top.v}/100
                  </div>
                  <div
                    className="margin-note"
                    style={{ marginTop: 6, fontSize: 13 }}
                  >
                    "{meta.tag}"
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
                {dims.map((d) => (
                  <div key={d.label} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        height: 30,
                        background: "var(--paper-2)",
                        border: "0.5px solid var(--rule)",
                        borderRadius: 2,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${d.v}%`,
                          background:
                            d.label === top.label
                              ? "var(--accent)"
                              : "var(--ink-3)",
                          opacity: d.label === top.label ? 1 : 0.4,
                        }}
                      />
                    </div>
                    <div
                      className="kicker"
                      style={{ marginTop: 4, fontSize: 8 }}
                    >
                      {d.label[0]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <Kicker>The Big Five · radar</Kicker>
              <div style={{ marginTop: 8 }}>
                <RadarChart
                  values={dims.map((d) => d.v)}
                  labels={dims.map((d) => d.label.slice(0, 5))}
                  color="var(--accent)"
                  size={260}
                />
              </div>
            </div>
          </>
        ) : (
          <TestEmptyState
            kind="big5"
            title="Personality · Big Five"
            copy="Five questions, five strokes — open, conscientious, extraverted, agreeable, sensitive."
            onOpenTest={onOpenTest}
          />
        )}

        {mePolitics ? (
          <>
            <PoliticsCard me={mePolitics} />
            <PoliticsCompass me={mePolitics} />
          </>
        ) : (
          <TestEmptyState
            kind="political"
            title="Politics · your placement"
            copy="Twelve questions across six axes — economic, social, foreign, environment, technology, authority."
            onOpenTest={onOpenTest}
          />
        )}

        {moralsReady ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <Kicker>Values & morals</Kicker>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {MORAL_ROWS.map(([k, displayKey, [l, r]]) => {
                const v = (profile.morals![k] as number) ?? 0;
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
                      <span>{l}</span>
                      <span style={{ color: "var(--ink-2)" }}>
                        {displayKey}
                      </span>
                      <span>{r}</span>
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
          </div>
        ) : (
          <TestEmptyState
            kind="values"
            title="Values & morals"
            copy="Eight questions on optimism, duty, hedonism, the meaning of suffering."
            onOpenTest={onOpenTest}
          />
        )}

        {likes.length > 0 && (
          <>
            <hr className="rule-dashed" />
            <Kicker>Likes</Kicker>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {likes.map((l) => (
                <span key={l} className="pill">
                  {l}
                </span>
              ))}
            </div>
          </>
        )}

        {dislikes.length > 0 && (
          <>
            <hr className="rule-dashed" />
            <Kicker>Dislikes</Kicker>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {dislikes.map((l) => (
                <span
                  key={l}
                  className="pill"
                  style={{ opacity: 0.7, fontStyle: "italic" }}
                >
                  {l}
                </span>
              ))}
            </div>
          </>
        )}

        {heroes.length > 0 && (
          <>
            <hr className="rule-dashed" />
            <Kicker>Heroes</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              {heroes.map((h) => (
                <div
                  key={h.name}
                  className="card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ fontFamily: "var(--serif)", fontSize: 15 }}>
                      {h.name}
                    </span>
                    {h.role && (
                      <span className="margin-note">{h.role}</span>
                    )}
                  </div>
                  {h.reason && (
                    <div
                      className="margin-note"
                      style={{ fontSize: 12, fontStyle: "italic" }}
                    >
                      "{h.reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
