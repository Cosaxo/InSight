import { IS_DATA } from "../../data/seedData";
import { useMe } from "../../lib/useMe";
import { Av, Kicker } from "../shared/primitives";
import { RadarChart } from "../shared/charts";
import {
  PoliticsCard,
  PoliticsCompass,
  PoliticsSubIssues,
} from "./politics";

interface ProfileOverlayProps {
  onClose: () => void;
}

interface InterestCat {
  id: string;
  hue: number;
  glyph: string;
}

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

export function ProfileOverlay({ onClose }: ProfileOverlayProps) {
  // `seedMe` still backs the rich profile sections (personality,
  // morals, stats, heroes, …) — these depend on test results / profile
  // editing that hasn't been wired through to real storage yet. The
  // identity chrome at the top uses real auth data via `useMe` so a
  // signed-in user never sees the seed cast's initials or naseedMe.
  const seedMe = IS_DATA.me;
  const realMe = useMe();
  const dims = [
    { label: "Openness", v: seedMe.personality.O },
    { label: "Conscientiousness", v: seedMe.personality.C },
    { label: "Extraversion", v: seedMe.personality.E },
    { label: "Agreeableness", v: seedMe.personality.A },
    { label: "Neuroticism", v: seedMe.personality.N },
  ];
  const sorted = [...dims].sort((a, b) => b.v - a.v);
  const top = sorted[0];
  const meta = BIG5_LABELS[top.label];

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
          {!realMe.isAuthed && (
            <div className="kicker" style={{ marginTop: 4 }}>
              {seedMe.location} · {seedMe.country}
            </div>
          )}
        </div>
        <hr className="rule-dashed" />

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
              <div
                className="kicker"
                style={{ marginTop: 4 }}
              >
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
                <div className="kicker" style={{ marginTop: 4, fontSize: 8 }}>
                  {d.label[0]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>The Big Five · last test ten days ago</Kicker>
          <div style={{ marginTop: 8 }}>
            <RadarChart
              values={dims.map((d) => d.v)}
              labels={dims.map((d) => d.label.slice(0, 5))}
              color="var(--accent)"
              size={260}
            />
          </div>
        </div>

        <PoliticsCard me={seedMe} />
        <PoliticsCompass me={seedMe} />
        <PoliticsSubIssues me={seedMe} />

        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Values & morals · {seedMe.moralLabel}</Kicker>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {MORAL_ROWS.map(([k, displayKey, [l, r]]) => {
              const v = (seedMe.morals[k] as number) ?? 0;
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
                    <span style={{ color: "var(--ink-2)" }}>{displayKey}</span>
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

        <hr className="rule-dashed" />
        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Vital statistics</Kicker>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 10,
            }}
          >
            {(
              [
                ["born", `${seedMe.stats.birthYear} · age ${seedMe.stats.age}`],
                ["height", seedMe.stats.height],
                ["weight", seedMe.stats.weight],
                ["eye colour", seedMe.stats.eyeColor],
                ["handed", seedMe.stats.handed],
                ["sleep", seedMe.stats.sleep],
                ["chronotype", seedMe.stats.chronotype],
                ["sign", seedMe.stats.sign],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <div className="kicker">{k}</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 15,
                    marginTop: 2,
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Interests · what you spend your minutes on</Kicker>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginTop: 10,
            }}
          >
            {seedMe.myInterests.map(
              (it: { t: string; c: string }, i: number) => {
                const cat: InterestCat | undefined = IS_DATA.interestCats.find(
                  (c: InterestCat) => c.id === it.c,
                );
                const hue = cat?.hue ?? 50;
                return (
                  <span
                    key={i}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: `0.5px solid oklch(0.78 0.08 ${hue})`,
                      background: `oklch(0.96 0.03 ${hue})`,
                      color: `oklch(0.32 0.13 ${hue})`,
                    }}
                  >
                    <span style={{ marginRight: 4 }}>{cat?.glyph}</span>
                    {it.t}
                  </span>
                );
              },
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Languages</Kicker>
          {seedMe.languages.map(
            (l: { name: string; level: string; pct: number }) => (
              <div
                key={l.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    width: 78,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                  }}
                >
                  {l.name}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{
                      width: `${l.pct}%`,
                      height: "100%",
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <span
                  style={{
                    width: 90,
                    textAlign: "right",
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: "var(--ink-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {l.level}
                </span>
              </div>
            ),
          )}
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Timeline · the long line</Kicker>
          <div
            style={{
              position: "relative",
              marginTop: 14,
              paddingLeft: 14,
              borderLeft: "0.5px dashed var(--rule)",
            }}
          >
            {seedMe.timeline.map(
              (e: { year: number; t: string }, i: number) => (
                <div
                  key={i}
                  style={{ position: "relative", paddingBottom: 12 }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: -18,
                      top: 4,
                      width: 7,
                      height: 7,
                      background: "var(--accent)",
                      borderRadius: "50%",
                    }}
                  />
                  <div className="kicker">{e.year}</div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 14,
                      color: "var(--ink-2)",
                    }}
                  >
                    {e.t}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Badges</Kicker>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
            }}
          >
            {seedMe.badges.map((b: string) => (
              <span key={b} className="stamp">
                {b}
              </span>
            ))}
          </div>
        </div>

        <hr className="rule-dashed" />
        <Kicker>Likes · gathered over the years</Kicker>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
        >
          {seedMe.likes.map((l: string) => (
            <span key={l} className="pill">
              {l}
            </span>
          ))}
        </div>

        <hr className="rule-dashed" />
        <Kicker>Dislikes · honest about</Kicker>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
        >
          {seedMe.dislikes.map((l: string) => (
            <span
              key={l}
              className="pill"
              style={{ opacity: 0.7, fontStyle: "italic" }}
            >
              {l}
            </span>
          ))}
        </div>
        <hr className="rule-dashed" />
        <Kicker>Heroes · who you read in the margins</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          {seedMe.heroes.map((h: { name: string; trait: string }) => (
            <div
              key={h.name}
              className="card"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span style={{ fontFamily: "var(--serif)", fontSize: 15 }}>
                {h.name}
              </span>
              <span className="margin-note">{h.trait}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
