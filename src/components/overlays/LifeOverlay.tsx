import { useState } from "react";
import { Kicker } from "../shared/primitives";

const WEIGHT_KG = 63;
const AGE = 34;
const DAYS_LIVED = Math.round(AGE * 365.25) + 12;
const HEARTBEATS =
  Math.round(((AGE * 365.25 * 24 * 60 * 70) / 1_000_000_000) * 100) / 100;
const BREATHS = Math.round((AGE * 365.25 * 24 * 60 * 15) / 1_000_000);

interface Element {
  sym: string;
  name: string;
  pct: number;
  hue: number;
  note: string;
}
const ELEMENTS: Element[] = [
  { sym: "O", name: "Oxygen", pct: 65.0, hue: 220, note: "mostly bound up as water" },
  { sym: "C", name: "Carbon", pct: 18.5, hue: 38, note: "the scaffolding of you" },
  { sym: "H", name: "Hydrogen", pct: 9.5, hue: 200, note: "the smallest, the loudest" },
  { sym: "N", name: "Nitrogen", pct: 3.2, hue: 150, note: "protein, DNA, the air" },
  { sym: "Ca", name: "Calcium", pct: 1.5, hue: 80, note: "bones, signal, salt" },
  { sym: "P", name: "Phosphorus", pct: 1.0, hue: 12, note: "bones, ATP, fire" },
  { sym: "K", name: "Potassium", pct: 0.4, hue: 280, note: "every heartbeat" },
  { sym: "S", name: "Sulphur", pct: 0.3, hue: 60, note: "in your hair, in your nails" },
  { sym: "·", name: "trace", pct: 0.6, hue: 0, note: "Fe, Zn, Cu, I, Mg, Na, Se…" },
];

interface Tissue {
  k: string;
  pct: number;
  hue: number;
  label: string;
  sub: string;
}
const TISSUES: Tissue[] = [
  { k: "water", pct: 58, hue: 220, label: "Water", sub: "≈ 36.5 kg · enough to fill a small bucket" },
  { k: "fat", pct: 22, hue: 60, label: "Fat", sub: "≈ 13.9 kg · the long-burning fuel" },
  { k: "protein", pct: 14, hue: 38, label: "Protein", sub: "≈  8.8 kg · muscle, skin, enzymes" },
  { k: "mineral", pct: 5, hue: 280, label: "Bone & mineral", sub: "≈  3.2 kg · 206 bones, give or take" },
  { k: "carb", pct: 1, hue: 145, label: "Carbohydrate", sub: "≈  0.6 kg · mostly glycogen on standby" },
];

const STARDUST = [
  { glyph: "✦", label: "cells", value: "≈ 37 trillion", note: "red blood cells outnumber the rest" },
  { glyph: "◐", label: "atoms", value: "≈ 7 × 10²⁷", note: "most forged in dying stars" },
  { glyph: "☾", label: "replacement", value: "every 7 yrs", note: "almost no atom from your childhood remains" },
  { glyph: "✶", label: "microbiome", value: "≈ 38 trillion", note: "roughly one bacterium per human cell" },
];

interface Generation {
  g: number;
  yr: number;
  count: number | string;
  label: string;
}
const GENERATIONS: Generation[] = [
  { g: 1, yr: 1966, count: 2, label: "parents" },
  { g: 2, yr: 1941, count: 4, label: "grandparents" },
  { g: 3, yr: 1916, count: 8, label: "great-grandparents" },
  { g: 4, yr: 1891, count: 16, label: "2× great-grandparents" },
  { g: 5, yr: 1866, count: 32, label: "3× great-grandparents" },
  { g: 6, yr: 1841, count: 64, label: "4× great-grandparents" },
  { g: 8, yr: 1791, count: 256, label: "6× great — Norway under Denmark" },
  { g: 10, yr: 1741, count: 1024, label: "8× great — first potato in the valley" },
  { g: 16, yr: 1591, count: 65536, label: "14× great — Tycho Brahe still alive" },
  { g: 20, yr: 1491, count: 1048576, label: "18× great — Columbus year" },
  { g: 30, yr: 1241, count: "1.07 billion", label: "28× great — more than Europe held" },
  { g: 40, yr: 991, count: "1.1 trillion", label: "38× great — pedigree collapse: most repeat" },
];

const IN_NUMBERS = [
  { k: "days", label: "DAYS LIVED", value: DAYS_LIVED.toLocaleString(), sub: "≈ 5,322 still ahead" },
  { k: "heart", label: "HEARTBEATS (BN)", value: HEARTBEATS.toString(), sub: "one every 0.85 s" },
  { k: "breath", label: "BREATHS (MM)", value: BREATHS.toLocaleString(), sub: "15 a minute, mostly forgotten" },
  { k: "moons", label: "FULL MOONS", value: Math.round(AGE * 12.37).toLocaleString(), sub: "4 missed to cloud cover" },
  { k: "sleep", label: "YEARS ASLEEP", value: "11.1", sub: "one third of everything" },
  { k: "meals", label: "MEALS EATEN", value: "≈ 31,200", sub: "about a tonne of bread" },
  { k: "steps", label: "STEPS WALKED", value: "78 MM", sub: "1.7× around the Earth" },
  { k: "orbits", label: "TRIPS AROUND ☉", value: "34", sub: "32 billion km of orbit" },
  { k: "kissed", label: "PEOPLE KISSED", value: "17", sub: "and four you remember" },
  { k: "books", label: "BOOKS FINISHED", value: "342", sub: "11 you re-read on purpose" },
  { k: "words", label: "WORDS WRITTEN", value: "1.4 MM", sub: "most in the journal" },
  { k: "tears", label: "LITRES OF TEARS", value: "≈ 14", sub: "a small bucket" },
];

const AGE_FACTS = [
  {
    kicker: "a fibonacci year",
    body:
      "34 sits in the Fibonacci sequence between 21 and 55 — the next will land at 55.",
    glyph: "✦",
  },
  {
    kicker: "biologically",
    body:
      "Your prefrontal cortex finished wiring around 28; your skeletal mass is at its lifetime peak now and will quietly thin from here.",
    glyph: "◐",
  },
  {
    kicker: "statistically",
    body:
      "You are older than ~57% of people alive on Earth right now, and have an expected ~50 years still to live in Norway.",
    glyph: "☾",
  },
  {
    kicker: "historically",
    body:
      "Marie Curie was 36 when she got her first Nobel. Vermeer painted Girl with a Pearl Earring at 34. Anton Chekhov hadn't yet written The Seagull.",
    glyph: "✶",
  },
  {
    kicker: "in your line",
    body:
      "Your mother had you at 27, your grandmother had her at 22, her mother at 19 — you are the latest first-born in four generations.",
    glyph: "↑",
  },
];

const LIFETIME_TOTALS = [
  { n: "41", l: "COUNTRIES", s: "last: Japan" },
  { n: "127", l: "CITIES", s: "this year alone, 9" },
  { n: "342", l: "BOOKS", s: "11 re-read on purpose" },
  { n: "6 400", l: "KM RUN", s: "roughly Oslo→Cairo" },
  { n: "14", l: "HOMES", s: "three you still miss" },
  { n: "71", l: "PEOPLE", s: "kept in mind" },
  { n: "2 318", l: "NIGHTS OUT", s: "half logged, half guessed" },
  { n: "4", l: "LANGUAGES", s: "two well, two badly" },
  { n: "9", l: "JOBS", s: "one you would take again" },
];

function ElementGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
      }}
    >
      {ELEMENTS.map((e) => (
        <div
          key={e.sym}
          style={{
            padding: 10,
            background: `oklch(0.94 0.04 ${e.hue})`,
            border: `0.5px solid oklch(0.78 0.08 ${e.hue})`,
            borderRadius: 6,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 22,
              color: `oklch(0.30 0.13 ${e.hue})`,
              lineHeight: 1,
            }}
          >
            {e.sym}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 8.5,
              letterSpacing: "0.08em",
              color: "var(--ink-3)",
              marginTop: 4,
            }}
          >
            {e.name.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 13,
              fontStyle: "italic",
              marginTop: 2,
            }}
          >
            {e.pct}%
          </div>
        </div>
      ))}
    </div>
  );
}

function TissueBar() {
  return (
    <>
      <div
        style={{
          display: "flex",
          height: 22,
          borderRadius: 4,
          overflow: "hidden",
          border: "0.5px solid var(--rule)",
        }}
      >
        {TISSUES.map((t) => (
          <div
            key={t.k}
            title={`${t.label}: ${t.pct}%`}
            style={{
              flex: t.pct,
              background: `oklch(0.62 0.10 ${t.hue})`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 14,
        }}
      >
        {TISSUES.map((t) => (
          <div
            key={t.k}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: `oklch(0.62 0.10 ${t.hue})`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 14 }}>
                  {t.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                  }}
                >
                  {t.pct}%
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 12,
                  color: "var(--ink-3)",
                }}
              >
                {t.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function GenerationTree() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      {GENERATIONS.map((g, i) => {
        const dotSize = Math.min(
          12,
          Math.max(2, Math.log10(Number(g.count) || 1) * 1.5 + 2),
        );
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              className="kicker"
              style={{ width: 38, textAlign: "right" }}
            >
              G{g.g}
            </span>
            <span
              style={{
                width: dotSize,
                height: dotSize,
                background: "var(--accent)",
                borderRadius: "50%",
                opacity: 0.5 + Math.min(0.5, i * 0.04),
              }}
            />
            <span
              style={{
                width: 40,
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--ink-3)",
              }}
            >
              {g.yr}
            </span>
            <span
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
                color: "var(--ink-2)",
                flex: 1,
              }}
            >
              {g.label}
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-3)",
              }}
            >
              {typeof g.count === "number"
                ? g.count.toLocaleString()
                : g.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface LifeOverlayProps {
  onClose: () => void;
  onOpenDna?: () => void;
}

export function LifeOverlay({ onClose, onOpenDna }: LifeOverlayProps) {
  const [tab, setTab] = useState<"matter" | "rhythms" | "lineage" | "age">(
    "matter",
  );

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>life</em>
        </div>
        <div className="h-meta">
          {WEIGHT_KG} kg
          <br />
          age {AGE}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: "0.5px solid var(--rule)",
          padding: "6px 16px",
          gap: 4,
        }}
      >
        {(
          [
            ["matter", "matter"],
            ["rhythms", "rhythms"],
            ["lineage", "lineage"],
            ["age", "this age"],
          ] as ["matter" | "rhythms" | "lineage" | "age", string][]
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
        {tab === "matter" && (
          <>
            <Kicker>by element · share of your mass</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <ElementGrid />
              <div className="margin-note" style={{ marginTop: 14, fontSize: 13 }}>
                "You are mostly water and stars — oxygen, carbon, hydrogen.
                Six elements account for 99% of you."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>by tissue · what the kilograms are doing</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <TissueBar />
            </div>

            <hr className="rule-dashed" />
            <Kicker>borrowed stardust · the numbers</Kicker>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 10,
              }}
            >
              {STARDUST.map((s) => (
                <div key={s.label} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 18,
                        color: "var(--accent)",
                      }}
                    >
                      {s.glyph}
                    </span>
                    <span className="kicker">{s.label.toUpperCase()}</span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 18,
                      fontStyle: "italic",
                      marginTop: 4,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 11.5,
                      color: "var(--ink-3)",
                      marginTop: 2,
                      lineHeight: 1.3,
                    }}
                  >
                    {s.note}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "rhythms" && (
          <>
            <Kicker>the ledger · totals you've gathered</Kicker>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginTop: 10,
              }}
            >
              {LIFETIME_TOTALS.map((t) => (
                <div key={t.l} className="card" style={{ padding: 10 }}>
                  <div className="fig-num" style={{ fontSize: 22, lineHeight: 1 }}>
                    <em>{t.n}</em>
                  </div>
                  <div className="kicker" style={{ marginTop: 2 }}>
                    {t.l}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 10.5,
                      color: "var(--ink-3)",
                      marginTop: 3,
                      lineHeight: 1.3,
                    }}
                  >
                    {t.s}
                  </div>
                </div>
              ))}
            </div>

            <hr className="rule-dashed" />
            <Kicker>people · the constellation</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {[
                  { n: 5, l: "inner" },
                  { n: 12, l: "close" },
                  { n: 22, l: "friends" },
                  { n: 32, l: "orbit" },
                ].map((c) => (
                  <div key={c.l} style={{ textAlign: "center" }}>
                    <div className="fig-num" style={{ fontSize: 22 }}>
                      <em>{c.n}</em>
                    </div>
                    <div className="kicker" style={{ marginTop: 2 }}>
                      {c.l}
                    </div>
                  </div>
                ))}
              </div>
              <div className="margin-note" style={{ marginTop: 10, fontSize: 12 }}>
                "71 people you keep alive in your head. Dunbar says you can
                hold about 150 before they fade."
              </div>
            </div>
          </>
        )}

        {tab === "lineage" && (
          <>
            <Kicker>the doubling · generations behind you</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <GenerationTree />
              <div className="margin-note" style={{ marginTop: 12, fontSize: 13 }}>
                "Each step back doubles the people. By the year 991 the maths
                gives more ancestors than humans alive — the tree collapses,
                and the same names appear again and again."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>the rest of the chain · further back</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <div
                style={{
                  padding: 10,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 6,
                }}
              >
                <div className="kicker">UNBROKEN LINE TO FIRST H. SAPIENS</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 26,
                    fontStyle: "italic",
                    marginTop: 4,
                    color: "var(--accent)",
                  }}
                >
                  ≈ 12,000 generations
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--ink-2)",
                    marginTop: 4,
                  }}
                >
                  every one of them lived long enough to have a child. <br />
                  not a single break.
                </div>
              </div>
            </div>

            <hr className="rule-dashed" />
            <div className="card" style={{ padding: 14 }}>
              <Kicker>before that · the longer story</Kicker>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontFamily: "var(--serif)",
                  fontSize: 13,
                }}
              >
                {[
                  ["last common ancestor with chimps", "~7 Mya"],
                  ["last common ancestor with all mammals", "~220 Mya"],
                  ["fish ancestor crawls to land", "~375 Mya"],
                  ["first single-celled life", "~3.8 Bya"],
                ].map(([label, age]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontStyle: "italic" }}>{label}</span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--ink-3)",
                      }}
                    >
                      {age}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "age" && (
          <>
            <Kicker>thirty-four · in numbers</Kicker>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 10,
              }}
            >
              {IN_NUMBERS.map((n) => (
                <div key={n.k} className="card" style={{ padding: 12 }}>
                  <div className="kicker">{n.label}</div>
                  <div
                    className="fig-num"
                    style={{ fontSize: 26, marginTop: 4, lineHeight: 1 }}
                  >
                    <em>{n.value}</em>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 11,
                      color: "var(--ink-3)",
                      marginTop: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {n.sub}
                  </div>
                </div>
              ))}
            </div>
            <div className="margin-note" style={{ marginTop: 10, fontSize: 12 }}>
              "Half is rough estimate, half is logged. The shape of a life
              starts to show up only once you count it."
            </div>

            <hr className="rule-dashed" />
            <Kicker>where 34 sits · an average Norwegian life</Kicker>
            <div className="card" style={{ marginTop: 10, padding: "18px 14px 14px" }}>
              <div style={{ position: "relative", height: 32 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 14,
                    height: 4,
                    background: "var(--paper-3)",
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 14,
                    height: 4,
                    width: `${(AGE / 84) * 100}%`,
                    background: "var(--accent)",
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${(AGE / 84) * 100}%`,
                    top: 6,
                    transform: "translateX(-50%)",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--paper)",
                    border: "1.5px solid var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: "var(--accent)",
                  }}
                >
                  34
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.06em",
                  marginTop: 4,
                }}
              >
                <span>birth</span>
                <span>18</span>
                <span>30</span>
                <span>50</span>
                <span>65</span>
                <span>84</span>
              </div>
              <div className="margin-note" style={{ marginTop: 12, fontSize: 13 }}>
                "40.5% of the way through. Roughly 50 years of expectancy
                remaining — about 18,300 more days."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>what's particular about this age</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 10,
              }}
            >
              {AGE_FACTS.map((f) => (
                <div
                  key={f.kicker}
                  className="card"
                  style={{ padding: 12, display: "flex", gap: 12 }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "var(--paper)",
                      border: "0.5px solid var(--rule)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontFamily: "var(--serif)",
                      color: "var(--accent)",
                      fontSize: 15,
                    }}
                  >
                    {f.glyph}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kicker">{f.kicker}</div>
                    <div
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 13.5,
                        marginTop: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      {f.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <hr className="rule-dashed" />
        <div
          onClick={() => {
            if (onOpenDna) onOpenDna();
          }}
          className="card"
          style={{
            marginTop: 6,
            padding: "14px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderLeft: "3px solid var(--accent)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 22,
              color: "var(--accent)",
            }}
          >
            ⌇
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 15,
                fontStyle: "italic",
              }}
            >
              analyse your DNA
            </div>
            <div className="kicker" style={{ marginTop: 2 }}>
              ANCESTRY · TRAITS · HEALTH MARKERS · HAPLOGROUPS
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 22,
              color: "var(--ink-3)",
            }}
          >
            →
          </span>
        </div>
      </div>
    </div>
  );
}
