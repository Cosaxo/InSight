import { memo, useState } from "react";
import { Kicker } from "../shared/primitives";

const ANCESTRY = [
  { region: "Norwegian", pct: 58.4, hue: 220, sub: "West coast · Rogaland cluster" },
  { region: "Swedish", pct: 14.2, hue: 200, sub: "Värmland borderland" },
  { region: "Sámi", pct: 6.1, hue: 150, sub: "Northern Fennoscandia" },
  { region: "Finnish", pct: 4.3, hue: 170, sub: "Karelian fringe" },
  { region: "Danish", pct: 9.8, hue: 38, sub: "Jutland" },
  { region: "British & Irish", pct: 4.7, hue: 12, sub: "Orkney trace" },
  { region: "Broadly Northwestern", pct: 2.5, hue: 280, sub: "unresolved" },
];

const TRAITS = [
  { name: "Eye colour", pred: "green-grey", conf: 91, glyph: "◉" },
  { name: "Hair colour", pred: "dark blonde", conf: 87, glyph: "⌇" },
  { name: "Lactose tolerance", pred: "tolerant", conf: 99, glyph: "◐" },
  { name: "Caffeine metabolism", pred: "fast", conf: 84, glyph: "✦" },
  { name: "Bitter taste", pred: "sensitive", conf: 76, glyph: "✶" },
  { name: "Sleep chronotype", pred: "morning", conf: 71, glyph: "☾" },
  { name: "Endurance vs power", pred: "endurance lean", conf: 68, glyph: "↑" },
  { name: "Earwax", pred: "wet", conf: 99, glyph: "◯" },
];

const HEALTH = [
  { name: "Type 2 diabetes", risk: "avg", note: "0.94× population" },
  { name: "Coeliac disease", risk: "low", note: "no HLA-DQ2/DQ8" },
  { name: "Lactase persistence", risk: "carrier", note: "rs4988235 GG" },
  { name: "Macular degen.", risk: "avg", note: "1.02×" },
  { name: "Alzheimer (APOE)", risk: "low", note: "ε3/ε3" },
];

const HAPLO = {
  paternal: {
    code: "R-M269",
    age: "~6,500 ya",
    path: "R → R1 → R1b → R-M269",
    note: "Bell Beaker → North Sea",
  },
  maternal: {
    code: "H1a",
    age: "~12,500 ya",
    path: "H → H1 → H1a",
    note: "Iberian refuge → North",
  },
};

const CHROMO_SEGMENTS: [number, number, number][][] = [
  [[0, 55, 220], [55, 72, 200], [72, 85, 38], [85, 100, 150]],
  [[0, 40, 220], [40, 68, 38], [68, 92, 200], [92, 100, 150]],
  [[0, 62, 220], [62, 80, 170], [80, 100, 38]],
  [[0, 48, 220], [48, 64, 200], [64, 82, 12], [82, 100, 220]],
  [[0, 35, 220], [35, 55, 200], [55, 78, 150], [78, 100, 38]],
  [[0, 58, 220], [58, 76, 38], [76, 92, 200], [92, 100, 170]],
  [[0, 45, 220], [45, 72, 200], [72, 86, 150], [86, 100, 280]],
  [[0, 52, 220], [52, 72, 38], [72, 90, 12], [90, 100, 220]],
  [[0, 68, 220], [68, 84, 200], [84, 100, 170]],
  [[0, 42, 220], [42, 60, 150], [60, 80, 38], [80, 100, 220]],
  [[0, 55, 220], [55, 75, 200], [75, 90, 12], [90, 100, 220]],
  [[0, 48, 220], [48, 68, 38], [68, 86, 150], [86, 100, 200]],
  [[0, 60, 220], [60, 80, 200], [80, 100, 170]],
  [[0, 52, 220], [52, 72, 38], [72, 88, 200], [88, 100, 150]],
  [[0, 46, 220], [46, 68, 200], [68, 85, 12], [85, 100, 220]],
  [[0, 58, 220], [58, 75, 38], [75, 92, 150], [92, 100, 200]],
  [[0, 50, 220], [50, 72, 200], [72, 88, 38], [88, 100, 150]],
  [[0, 55, 220], [55, 78, 200], [78, 100, 170]],
  [[0, 42, 220], [42, 62, 38], [62, 82, 200], [82, 100, 12]],
  [[0, 60, 220], [60, 82, 150], [82, 100, 38]],
  [[0, 52, 220], [52, 75, 200], [75, 100, 38]],
  [[0, 45, 220], [45, 72, 38], [72, 100, 150]],
];

function AncestryBar({
  pct,
  hue,
  label,
  sub,
  value,
}: {
  pct: number;
  hue: number;
  label: string;
  sub?: string;
  value: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div>
          <span style={{ fontFamily: "var(--serif)", fontSize: 14 }}>
            {label}
          </span>
          {sub && (
            <span
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 11,
                color: "var(--ink-3)",
                marginLeft: 6,
              }}
            >
              {sub}
            </span>
          )}
        </div>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: `oklch(0.40 0.13 ${hue})`,
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          borderRadius: 999,
          marginTop: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `oklch(0.55 0.13 ${hue})`,
          }}
        />
      </div>
    </div>
  );
}

const ChromosomePaint = memo(function ChromosomePaint() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {CHROMO_SEGMENTS.map((segs, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{
              width: 18,
              fontFamily: "var(--mono)",
              fontSize: 8,
              color: "var(--ink-3)",
              letterSpacing: "0.05em",
              textAlign: "right",
            }}
          >
            {i + 1}
          </span>
          <div
            style={{
              flex: 1,
              height: 8,
              display: "flex",
              border: "0.5px solid var(--rule)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {segs.map(([a, b, hue], j) => (
              <div
                key={j}
                style={{
                  width: `${b - a}%`,
                  background: `oklch(0.62 0.10 ${hue})`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

type DnaStage = "intro" | "uploading" | "analyzing" | "done";
type DnaTab = "ancestry" | "chromo" | "traits" | "health" | "haplo";

interface DnaOverlayProps {
  onClose: () => void;
}

export function DnaOverlay({ onClose }: DnaOverlayProps) {
  const [stage, setStage] = useState<DnaStage>("intro");
  const [tab, setTab] = useState<DnaTab>("ancestry");

  const startUpload = () => {
    setStage("uploading");
    setTimeout(() => setStage("analyzing"), 900);
    setTimeout(() => setStage("done"), 2400);
  };

  if (stage === "intro") {
    return (
      <div className="overlay paper-grain">
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose}>
            ✕
          </button>
          <div className="h-title">
            your <em>DNA</em>
          </div>
          <div style={{ width: 36 }} />
        </div>
        <div className="app-body">
          <Kicker>Upload your raw data</Kicker>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 22,
              fontStyle: "italic",
              marginTop: 10,
              lineHeight: 1.35,
            }}
          >
            "Drop your raw file from 23andMe, AncestryDNA, MyHeritage, or a VCF
            —"
          </div>
          <div className="margin-note" style={{ marginTop: 12 }}>
            We never keep it. Analysis happens locally; the file is forgotten
            when you close this view.
          </div>

          <div
            onClick={startUpload}
            style={{
              marginTop: 24,
              padding: 28,
              textAlign: "center",
              cursor: "pointer",
              border: "1px dashed var(--rule)",
              borderRadius: 8,
              background: "var(--paper-2)",
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                color: "var(--accent)",
              }}
            >
              ↑
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 16,
                marginTop: 8,
              }}
            >
              drop a file or tap to choose
            </div>
            <div className="kicker" style={{ marginTop: 8 }}>
              .txt · .csv · .vcf · .gz · up to 200 MB
            </div>
          </div>

          <hr className="rule-dashed" />
          <Kicker>What you'll see</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 10,
            }}
          >
            {(
              [
                ["ancestry", "7 regional bands · subpopulation hints"],
                ["chromosomes", "painted by ancestral segment"],
                ["traits", "eye colour, caffeine, sleep, taste, more"],
                ["health", "risk markers · carrier status"],
                ["haplogroups", "paternal & maternal lines"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div
                key={k}
                style={{ display: "flex", gap: 12, alignItems: "center" }}
              >
                <span
                  className="kicker"
                  style={{ width: 92, textAlign: "left" }}
                >
                  {k}
                </span>
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 13,
                    color: "var(--ink-2)",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === "uploading" || stage === "analyzing") {
    return (
      <div className="overlay paper-grain">
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose}>
            ✕
          </button>
          <div className="h-title">analyzing</div>
          <div style={{ width: 36 }} />
        </div>
        <div
          className="app-body"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 56,
              color: "var(--accent)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              opacity: 0.8,
            }}
          >
            ⌇⌇
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 22,
              marginTop: 16,
            }}
          >
            {stage === "uploading"
              ? "reading your file…"
              : "walking your genome…"}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--ink-3)",
              marginTop: 14,
            }}
          >
            {stage === "uploading"
              ? "· · ·"
              : "aligning · imputing · phasing"}
          </div>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          your <em>DNA</em>
        </div>
        <div className="h-meta">
          v1
          <br />
          may '26
        </div>
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: "0.5px solid var(--rule)",
          padding: "6px 16px",
          gap: 4,
          overflowX: "auto",
        }}
      >
        {(
          [
            ["ancestry", "ancestry"],
            ["chromo", "chromosomes"],
            ["traits", "traits"],
            ["health", "health"],
            ["haplo", "haplogroups"],
          ] as [DnaTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              letterSpacing: "0.06em",
              fontFamily: "var(--mono)",
              textTransform: "uppercase",
              background: tab === k ? "var(--ink)" : "transparent",
              color: tab === k ? "var(--paper)" : "var(--ink-3)",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="app-body">
        {tab === "ancestry" && (
          <>
            <Kicker>Ancestry · seven regions</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  height: 18,
                  border: "0.5px solid var(--rule)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                {ANCESTRY.map((a, i) => (
                  <div
                    key={i}
                    title={`${a.region} ${a.pct}%`}
                    style={{
                      width: `${a.pct}%`,
                      background: `oklch(0.55 0.13 ${a.hue})`,
                    }}
                  />
                ))}
              </div>
              {ANCESTRY.map((a) => (
                <AncestryBar
                  key={a.region}
                  pct={a.pct}
                  hue={a.hue}
                  label={a.region}
                  sub={a.sub}
                  value={`${a.pct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div
              className="margin-note"
              style={{ fontSize: 13, marginTop: 8 }}
            >
              "Most of you traces to a tight cluster on the Rogaland coast —
              fishermen and farmers with a Karelian thread."
            </div>
          </>
        )}

        {tab === "chromo" && (
          <>
            <Kicker>Chromosomes · painted by segment</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <ChromosomePaint />
              <hr className="rule-dashed" />
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
              >
                {ANCESTRY.map((a) => (
                  <div
                    key={a.region}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        background: `oklch(0.62 0.10 ${a.hue})`,
                        borderRadius: 2,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        letterSpacing: "0.06em",
                        color: "var(--ink-3)",
                      }}
                    >
                      {a.region}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "traits" && (
          <>
            <Kicker>Traits · what your code suggests</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 10,
              }}
            >
              {TRAITS.map((t) => (
                <div
                  key={t.name}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--paper-2)",
                      border: "0.5px solid var(--rule)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--serif)",
                      color: "var(--accent)",
                      fontSize: 16,
                    }}
                  >
                    {t.glyph}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontFamily: "var(--serif)", fontSize: 14 }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--serif)",
                        fontStyle: "italic",
                        fontSize: 13,
                        color: "var(--ink-2)",
                      }}
                    >
                      {t.pred}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="kicker">CONF</div>
                    <div
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 14,
                        color: "var(--accent)",
                      }}
                    >
                      {t.conf}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "health" && (
          <>
            <Kicker>Health markers · informational only</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 10,
              }}
            >
              {HEALTH.map((h) => {
                const hue =
                  h.risk === "low"
                    ? 145
                    : h.risk === "avg"
                      ? 38
                      : h.risk === "carrier"
                        ? 280
                        : 12;
                return (
                  <div
                    key={h.name}
                    className="card"
                    style={{
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: 14,
                        }}
                      >
                        {h.name}
                      </div>
                      <div className="kicker" style={{ marginTop: 2 }}>
                        {h.note}
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "4px 10px",
                        border: `0.5px solid oklch(0.78 0.08 ${hue})`,
                        color: `oklch(0.40 0.13 ${hue})`,
                        background: `oklch(0.96 0.03 ${hue})`,
                        borderRadius: 999,
                      }}
                    >
                      {h.risk}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              className="margin-note"
              style={{ fontSize: 12, marginTop: 12 }}
            >
              "Not medical advice — talk to a doctor about anything that
              matters."
            </div>
          </>
        )}

        {tab === "haplo" && (
          <>
            {(
              [
                ["paternal", HAPLO.paternal, 220],
                ["maternal", HAPLO.maternal, 12],
              ] as [
                string,
                { code: string; age: string; path: string; note: string },
                number,
              ][]
            ).map(([k, h, hue]) => (
              <div
                key={k}
                className="card"
                style={{ marginBottom: 12, padding: 14 }}
              >
                <Kicker>{k} line</Kicker>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 28,
                    fontStyle: "italic",
                    marginTop: 6,
                    color: `oklch(0.40 0.13 ${hue})`,
                  }}
                >
                  {h.code}
                </div>
                <div className="kicker" style={{ marginTop: 4 }}>
                  origin · {h.age}
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--ink-2)",
                    marginTop: 10,
                  }}
                >
                  {h.path}
                </div>
                <div
                  className="margin-note"
                  style={{ fontSize: 12, marginTop: 6 }}
                >
                  "{h.note}"
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
