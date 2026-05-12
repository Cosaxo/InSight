import { IS_DATA } from "../../data/seedData";
import { Kicker } from "../shared/primitives";
import { Compass2D, RadarChart } from "../shared/charts";

interface MePolitics {
  political: Record<string, number>;
  politicalIdentity: { name: string; tag: string };
  politicalSub: Record<string, Record<string, number | string>>;
  morals: Record<string, number>;
  moralLabel: string;
}

interface Ideology {
  id: string;
  name: string;
  econ: number;
  social: number;
}

interface PoliticalAxis {
  id: string;
  label: string;
  avgCircle: number;
}

interface IdeologyMark {
  name: string;
  econ: number;
  social: number;
}

const SUB_LABELS: Record<string, [string, string, string][]> = {
  econ: [
    ["tax", "low", "high"],
    ["redistribution", "less", "more"],
    ["market", "planned", "free"],
  ],
  social: [
    ["speech", "restrict", "permit"],
    ["gender", "traditional", "progressive"],
    ["drugs", "restrict", "permit"],
  ],
  foreign: [
    ["trade", "protectionist", "open"],
    ["defence", "pacifist", "hawkish"],
    ["migration", "closed", "open"],
  ],
  env: [
    ["climate", "unconcerned", "urgent"],
    ["biodiv.", "unconcerned", "urgent"],
    ["urbanism", "rural", "urban"],
  ],
  tech: [
    ["AI", "precaution", "accelerate"],
    ["biotech", "precaution", "accelerate"],
    ["surveil.", "oppose", "accept"],
  ],
  auth: [
    ["hierarchy", "flat", "tall"],
    ["tradition", "critical", "respect"],
    ["deference", "question", "obey"],
  ],
};

export function PoliticsCard({ me }: { me: MePolitics }) {
  const D = IS_DATA;
  const id = me.politicalIdentity;
  const ideologies: Ideology[] = D.ideologies;
  const ranked = ideologies
    .map((io) => {
      const dx = io.econ - me.political.econ;
      const dy = io.social - me.political.social;
      return { ...io, d: Math.sqrt(dx * dx + dy * dy) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  return (
    <div className="card" style={{ marginBottom: 14, position: "relative" }}>
      <div className="tape" />
      <Kicker>The politics · your placement</Kicker>
      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 10,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            flexShrink: 0,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 32% 32%, var(--paper-2), var(--paper))",
            border: "1.5px solid var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <svg
            viewBox="0 0 78 78"
            width="78"
            height="78"
            style={{ position: "absolute", inset: 0 }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
              return (
                <line
                  key={i}
                  x1={39}
                  y1={39}
                  x2={39 + Math.cos(a) * 30}
                  y2={39 + Math.sin(a) * 30}
                  stroke="var(--rule)"
                  strokeWidth="0.4"
                  strokeDasharray="1.2 1.6"
                />
              );
            })}
            <circle
              cx={39 + (me.political.econ / 100) * 22}
              cy={39 - (me.political.social / 100) * 22}
              r="3.6"
              fill="var(--accent)"
            />
          </svg>
          <span
            style={{
              position: "absolute",
              bottom: -6,
              fontFamily: "var(--mono)",
              fontSize: 7,
              color: "var(--accent)",
              letterSpacing: "0.16em",
              background: "var(--paper-2)",
              padding: "0 4px",
            }}
          >
            YOU
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kicker">CLOSEST IDEOLOGY</div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 22,
              lineHeight: 1.1,
              fontStyle: "italic",
              marginTop: 2,
            }}
          >
            {id.name}
          </div>
          <div
            className="margin-note"
            style={{ fontSize: 12, marginTop: 4 }}
          >
            "{id.tag}"
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "0.5px dashed var(--rule)",
        }}
      >
        <div className="kicker" style={{ marginBottom: 6 }}>
          NEIGHBOURING IDEOLOGIES
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ranked.map((r, i) => (
            <span
              key={r.id}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                padding: "5px 10px",
                background: i === 0 ? "oklch(0.93 0.05 250)" : "var(--paper-2)",
                color: i === 0 ? "oklch(0.32 0.13 250)" : "var(--ink-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
              }}
            >
              {r.name.toUpperCase()}{" "}
              <span style={{ opacity: 0.6, marginLeft: 4 }}>
                {Math.round(r.d)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PoliticsCompass({ me }: { me: MePolitics }) {
  const D = IS_DATA;
  const axes: PoliticalAxis[] = D.politicalAxes;
  const youVals = axes.map((a) => (me.political[a.id] + 100) / 2);
  const circleVals = axes.map((a) => (a.avgCircle + 100) / 2);
  const ideologies: Ideology[] = D.ideologies;
  const ideologyMarks: IdeologyMark[] = D.ideologyMarks;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>Politics · six axes, two views</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 4, marginBottom: 8, fontSize: 12 }}
      >
        the rose is all six. the square is the classic two — with thinkers for
        orientation.
      </div>

      <div style={{ marginTop: 6 }}>
        <RadarChart
          values={youVals}
          compareValues={circleVals}
          compareColor="var(--ink-3)"
          labels={axes.map((a) => a.label)}
          color="var(--accent)"
          size={260}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--ink-3)",
          letterSpacing: "0.08em",
          marginTop: 4,
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 2,
              background: "var(--accent)",
              verticalAlign: "middle",
              marginRight: 5,
            }}
          />
          YOU
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 2,
              background: "var(--ink-3)",
              verticalAlign: "middle",
              marginRight: 5,
            }}
          />
          YOUR CIRCLE · AVG
        </span>
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "0.5px dashed var(--rule)",
        }}
      >
        <div className="kicker" style={{ marginBottom: 6 }}>
          ECON × SOCIAL · WITH LANDMARKS
        </div>
        <Compass2D
          x={me.political.econ * 1.5}
          y={me.political.social * -1.5}
          label="you"
          xLabel={["Left", "Right"]}
          yLabel={["Liberty", "Authority"]}
          size={260}
          accent="var(--accent)"
          comparePoints={[
            ...ideologies.map((io) => ({
              x: io.econ * 1.5,
              y: -io.social * 1.5,
              label: io.name,
              color: "oklch(0.55 0.10 250)",
            })),
            ...ideologyMarks.map((m) => ({
              x: m.econ * 1.5,
              y: -m.social * 1.5,
              label: m.name,
              color: "oklch(0.50 0.04 60)",
            })),
          ]}
        />
      </div>
    </div>
  );
}

export function PoliticsSubIssues({ me }: { me: MePolitics }) {
  const D = IS_DATA;
  const sub = me.politicalSub;
  const axes: PoliticalAxis[] = D.politicalAxes;
  const norm = (k: number | string | undefined): number => {
    const v = typeof k === "number" ? k : 0;
    return (v + 100) / 2;
  };
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>Below the surface · 18 micro-positions</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 4, marginBottom: 12, fontSize: 12 }}
      >
        each axis breaks into three sub-questions — where you actually sit.
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {axes.map((ax) => {
          const cells = SUB_LABELS[ax.id] || [];
          return (
            <div key={ax.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 14,
                    color: "var(--ink)",
                  }}
                >
                  {ax.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: "var(--ink-3)",
                    letterSpacing: "0.08em",
                    maxWidth: "60%",
                    textAlign: "right",
                  }}
                >
                  {sub[ax.id]?.label as string}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  paddingLeft: 8,
                  borderLeft: "1px solid var(--rule)",
                }}
              >
                {cells.map(([fieldKey, lLab, rLab]) => {
                  const raw = (sub[ax.id]?.[fieldKey] as number) ?? 0;
                  const pct = norm(raw);
                  return (
                    <div key={fieldKey}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontFamily: "var(--mono)",
                          fontSize: 8.5,
                          color: "var(--ink-3)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 2,
                        }}
                      >
                        <span>{lLab}</span>
                        <span style={{ color: "var(--ink-2)" }}>
                          {fieldKey}
                        </span>
                        <span>{rLab}</span>
                      </div>
                      <div
                        style={{
                          height: 4,
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
                            height: 8,
                            background: "var(--rule)",
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            left: `calc(${pct}% - 3px)`,
                            top: -2,
                            width: 7,
                            height: 7,
                            background: "var(--accent)",
                            borderRadius: "50%",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
