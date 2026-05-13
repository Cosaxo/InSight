import { memo, useState } from "react";
import { Kicker } from "../shared/primitives";
import { useProfile } from "../../lib/useProfile";

// LifeOverlay's two physical knobs — weight (kg) and birth year —
// come from the saved profile (set in ProfileOverlay > Vital stats).
// When the user hasn't set them, the overlay falls back to these
// gentle defaults and shows an inline prompt instead of pretending
// the numbers are theirs.
//
// 70 kg ≈ adult median; birth year of (currentYear - 30) ≈ "an
// adult of unspecified age". The math still works, the framing just
// becomes "for a 30-year-old at 70 kg" rather than "for you".
const FALLBACK_WEIGHT_KG = 70;
const FALLBACK_BIRTH_YEAR = new Date().getFullYear() - 30;

// Derived getters — all life-shape numbers downstream collapse into
// these so a single source of truth (weight + age) drives everything
// from tissue kg to lived-weeks to heartbeats.
function deriveAge(birthYear: number | undefined): number {
  const by = birthYear ?? FALLBACK_BIRTH_YEAR;
  return Math.max(0, new Date().getFullYear() - by);
}
function deriveWeight(weightKg: number | undefined): number {
  return weightKg && weightKg > 0 ? weightKg : FALLBACK_WEIGHT_KG;
}

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

// Tissue percentages are biology-fixed (water/fat/protein/mineral/
// carb shares of body mass for a typical adult — they don't depend
// on weight). The displayed kilograms scale with the user's actual
// weight, so a 60 kg body shows different masses to an 80 kg body.
interface Tissue {
  k: string;
  pct: number;
  hue: number;
  label: string;
  blurb: string; // tail text that follows the computed kg
}
const TISSUES: Tissue[] = [
  { k: "water", pct: 58, hue: 220, label: "Water", blurb: "enough to fill a small bucket" },
  { k: "fat", pct: 22, hue: 60, label: "Fat", blurb: "the long-burning fuel" },
  { k: "protein", pct: 14, hue: 38, label: "Protein", blurb: "muscle, skin, enzymes" },
  { k: "mineral", pct: 5, hue: 280, label: "Bone & mineral", blurb: "206 bones, give or take" },
  { k: "carb", pct: 1, hue: 145, label: "Carbohydrate", blurb: "mostly glycogen on standby" },
];

function tissueSub(t: Tissue, weightKg: number): string {
  const kg = (weightKg * t.pct) / 100;
  // Match the typographic look of the previous strings: a thin space
  // and one decimal, with ≈ prefix.
  const formatted = kg.toFixed(1).padStart(4, " ").replace(" ", " ");
  return `≈ ${formatted} kg · ${t.blurb}`;
}

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

// Numbers card grid. The first four entries are computed from the
// user's age (days, heartbeats, breaths, moons); the rest stay
// literary-flavor and don't pretend to be measured — they'd each
// need their own real source to be honest. Future revival: pull
// `meals` from useMeals, `steps` from a step source, etc.
function buildInNumbers(age: number): {
  k: string;
  label: string;
  value: string;
  sub: string;
}[] {
  const daysLived = Math.round(age * 365.25);
  // Assume ~84-year expected lifespan in Norway; rough.
  const daysAhead = Math.max(0, Math.round(84 * 365.25) - daysLived);
  const heartbeatsBn =
    Math.round(((age * 365.25 * 24 * 60 * 70) / 1_000_000_000) * 100) / 100;
  const breathsMm = Math.round((age * 365.25 * 24 * 60 * 15) / 1_000_000);
  const moons = Math.round(age * 12.37);
  return [
    { k: "days", label: "DAYS LIVED", value: daysLived.toLocaleString(), sub: `≈ ${daysAhead.toLocaleString()} still ahead` },
    { k: "heart", label: "HEARTBEATS (BN)", value: heartbeatsBn.toString(), sub: "one every 0.85 s" },
    { k: "breath", label: "BREATHS (MM)", value: breathsMm.toLocaleString(), sub: "15 a minute, mostly forgotten" },
    { k: "moons", label: "FULL MOONS", value: moons.toLocaleString(), sub: "12.4 a year, give or take" },
    { k: "sleep", label: "YEARS ASLEEP", value: (age / 3).toFixed(1), sub: "one third of everything" },
    { k: "meals", label: "MEALS EATEN", value: `≈ ${Math.round(age * 365.25 * 2.5).toLocaleString()}`, sub: "≈ 2.5 a day" },
    { k: "orbits", label: "TRIPS AROUND ☉", value: age.toString(), sub: "≈ 940 MM km each" },
  ];
}

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

// ── rhythms data ─────────────────────────────────────────────────

interface DayBlock {
  from: number;
  to: number;
  k: string;
  hue: number;
  label: string;
}
const TYPICAL_DAY: DayBlock[] = [
  { from: 0, to: 6.5, k: "sleep", hue: 220, label: "sleep" },
  { from: 6.5, to: 7.25, k: "rituals", hue: 38, label: "coffee · journal" },
  { from: 7.25, to: 9, k: "movement", hue: 12, label: "run · swim" },
  { from: 9, to: 12.5, k: "deep", hue: 38, label: "deep work" },
  { from: 12.5, to: 13.5, k: "meal", hue: 60, label: "lunch · light" },
  { from: 13.5, to: 16.5, k: "making", hue: 250, label: "making · email" },
  { from: 16.5, to: 17.5, k: "reading", hue: 145, label: "reading" },
  { from: 17.5, to: 19.5, k: "people", hue: 305, label: "people · dinner" },
  { from: 19.5, to: 21.5, k: "home", hue: 60, label: "kitchen · home" },
  { from: 21.5, to: 22.5, k: "reading", hue: 145, label: "reading" },
  { from: 22.5, to: 24, k: "sleep", hue: 220, label: "sleep" },
];

// 12 months × 31 days mood/energy intensity (0-10, -1 = empty)
const YEAR_MOOD: number[][] = (() => {
  const seasonality = [3, 3, 4, 5, 6, 7, 8, 8, 7, 5, 4, 3];
  const rng = (m: number, d: number) =>
    Math.abs(Math.sin(m * 17.3 + d * 0.91 + (m + 1) * d * 0.13));
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return seasonality.map((s, m) =>
    Array.from({ length: 31 }, (_, d) => {
      if (d >= days[m]) return -1;
      const noise = rng(m, d) * 4 - 2;
      return Math.max(0, Math.min(10, Math.round(s + noise)));
    }),
  );
})();

interface LifeRiver {
  k: string;
  hue: number;
  values: number[];
}
const LIFE_RIVERS: LifeRiver[] = [
  { k: "running", hue: 12, values: [0.2,0.3,0.5,0.7,0.6,0.5,0.4,0.5,0.6,0.7,0.8,0.9,0.7,0.6,0.7,0.8,0.9] },
  { k: "reading", hue: 145, values: [0.6,0.7,0.7,0.8,0.7,0.6,0.5,0.6,0.7,0.8,0.8,0.7,0.8,0.9,0.9,0.9,0.95] },
  { k: "making", hue: 250, values: [0.4,0.6,0.7,0.5,0.4,0.6,0.8,0.7,0.6,0.8,0.7,0.6,0.5,0.6,0.7,0.8,0.7] },
  { k: "music", hue: 280, values: [0.8,0.85,0.9,0.8,0.7,0.6,0.5,0.6,0.7,0.6,0.5,0.4,0.5,0.6,0.6,0.7,0.8] },
  { k: "cold water", hue: 220, values: [0.0,0.0,0.0,0.0,0.1,0.2,0.3,0.5,0.7,0.8,0.9,0.95,0.9,0.85,0.9,0.95,1.0] },
];

interface ConstellationPerson {
  ring: number;
  angle: number;
  label?: string;
  hue: number;
}
const PEOPLE_CONSTELLATION: ConstellationPerson[] = [
  { ring: 1, angle: 20, label: "mother", hue: 12 },
  { ring: 1, angle: 90, label: "Sigrid", hue: 305 },
  { ring: 1, angle: 165, label: "Erik", hue: 220 },
  { ring: 1, angle: 245, label: "Ada", hue: 60 },
  { ring: 1, angle: 320, label: "Iben", hue: 145 },
  { ring: 2, angle: 8, hue: 38 }, { ring: 2, angle: 38, hue: 145 },
  { ring: 2, angle: 72, hue: 220 }, { ring: 2, angle: 108, hue: 60 },
  { ring: 2, angle: 130, hue: 305 }, { ring: 2, angle: 160, hue: 38 },
  { ring: 2, angle: 190, hue: 250 }, { ring: 2, angle: 222, hue: 145 },
  { ring: 2, angle: 260, hue: 220 }, { ring: 2, angle: 290, hue: 60 },
  { ring: 2, angle: 318, hue: 305 }, { ring: 2, angle: 348, hue: 38 },
  ...Array.from({ length: 22 }, (_, i): ConstellationPerson => ({
    ring: 3,
    angle: i * (360 / 22) + 8,
    hue: [38, 60, 145, 220, 250, 305][i % 6],
  })),
  ...Array.from({ length: 32 }, (_, i): ConstellationPerson => ({
    ring: 4,
    angle: i * (360 / 32) + 4,
    hue: [38, 60, 145, 220, 250, 305][(i * 3) % 6],
  })),
];

// ── rhythms components ───────────────────────────────────────────

const DayClock = memo(function DayClock() {
  const cx = 110, cy = 110, rOuter = 100, rInner = 60;
  const polar = (h: number, r: number): [number, number] => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arcPath = (from: number, to: number) => {
    const [x1, y1] = polar(from, rOuter);
    const [x2, y2] = polar(to, rOuter);
    const [x3, y3] = polar(to, rInner);
    const [x4, y4] = polar(from, rInner);
    const large = to - from > 12 ? 1 : 0;
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
  };

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <svg viewBox="0 0 220 220" width="160" height="160" style={{ flexShrink: 0 }}>
        {Array.from({ length: 24 }, (_, h) => {
          const [x1, y1] = polar(h, rOuter + 4);
          const [x2, y2] = polar(h, rOuter + (h % 6 === 0 ? 12 : 8));
          return (
            <line
              key={h}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--ink-3)"
              strokeWidth={h % 6 === 0 ? 1 : 0.5}
            />
          );
        })}
        {TYPICAL_DAY.map((seg, i) => (
          <path
            key={i}
            d={arcPath(seg.from, seg.to)}
            fill={`oklch(0.62 0.11 ${seg.hue})`}
            opacity={0.88}
          />
        ))}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = polar(h, rOuter + 22);
          return (
            <text
              key={h}
              x={x} y={y + 3}
              textAnchor="middle"
              fontFamily="var(--mono)" fontSize="9"
              fill="var(--ink-3)" letterSpacing="0.06em"
            >
              {String(h).padStart(2, "0")}
            </text>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="15" fill="var(--ink)">
          a day
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--ink-3)" letterSpacing="0.08em">
          TYPICAL · APR '26
        </text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {TYPICAL_DAY.filter((s) => s.k !== "sleep" || s.from === 0).map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8, height: 8, borderRadius: 2,
                background: `oklch(0.62 0.11 ${s.hue})`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                width: 44,
                fontFamily: "var(--mono)", fontSize: 8.5,
                color: "var(--ink-3)", letterSpacing: "0.06em",
              }}
            >
              {String(Math.floor(s.from)).padStart(2, "0")}:
              {String(Math.round((s.from % 1) * 60)).padStart(2, "0")}
            </span>
            <span
              style={{
                fontFamily: "var(--serif)", fontStyle: "italic",
                fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.2,
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

const YearMoodCalendar = memo(function YearMoodCalendar() {
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const cell = 8, gap = 2;
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {YEAR_MOOD.map((row, m) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 24,
                fontFamily: "var(--mono)", fontSize: 8.5,
                color: "var(--ink-3)", letterSpacing: "0.06em",
              }}
            >
              {months[m]}
            </span>
            <div style={{ display: "flex", gap }}>
              {row.map((v, d) => (
                <span
                  key={d}
                  style={{
                    width: cell, height: cell, borderRadius: 1.5,
                    background: v < 0
                      ? "transparent"
                      : v === 0
                        ? "var(--paper-3)"
                        : `oklch(${0.94 - v * 0.05} ${0.02 + v * 0.01} ${60 - v * 15})`,
                    border: v < 0
                      ? "none"
                      : "0.5px solid color-mix(in oklch, var(--ink) 6%, transparent)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
        <span
          style={{
            fontFamily: "var(--mono)", fontSize: 8.5,
            color: "var(--ink-3)", letterSpacing: "0.08em",
          }}
        >
          DIM
        </span>
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <span
            key={v}
            style={{
              width: cell, height: cell, borderRadius: 1.5,
              background: v === 0
                ? "var(--paper-3)"
                : `oklch(${0.94 - v * 0.05} ${0.02 + v * 0.01} ${60 - v * 15})`,
              border: "0.5px solid color-mix(in oklch, var(--ink) 6%, transparent)",
            }}
          />
        ))}
        <span
          style={{
            fontFamily: "var(--mono)", fontSize: 8.5,
            color: "var(--ink-3)", letterSpacing: "0.08em",
          }}
        >
          BRIGHT
        </span>
      </div>
    </div>
  );
});

const LifeInWeeks = memo(function LifeInWeeks({ age }: { age: number }) {
  const totalWeeks = 84 * 52;
  const livedWeeks = Math.round(age * 52.18);
  const cols = 52, rows = 84;
  const cell = 4.4, gap = 1;
  const w = cols * (cell + gap), h = rows * (cell + gap);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: 320 }}>
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const i = r * cols + c;
            const isCurrent = i === livedWeeks;
            const isLived = i < livedWeeks;
            const decade = Math.floor(r / 10);
            return (
              <rect
                key={i}
                x={c * (cell + gap)} y={r * (cell + gap)}
                width={cell} height={cell} rx={0.6}
                fill={
                  isCurrent
                    ? "var(--accent)"
                    : isLived
                      ? `oklch(0.${55 - decade * 4} 0.05 ${38 + decade * 18})`
                      : "var(--paper-3)"
                }
                stroke={isCurrent ? "var(--accent)" : "none"}
              />
            );
          }),
        )}
      </svg>
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          width: "100%", marginTop: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)", fontSize: 8.5,
            color: "var(--ink-3)", letterSpacing: "0.08em",
          }}
        >
          {livedWeeks.toLocaleString()} LIVED
        </span>
        <span
          style={{
            fontFamily: "var(--serif)", fontStyle: "italic",
            fontSize: 12, color: "var(--accent)",
          }}
        >
          this week
        </span>
        <span
          style={{
            fontFamily: "var(--mono)", fontSize: 8.5,
            color: "var(--ink-3)", letterSpacing: "0.08em",
          }}
        >
          {(totalWeeks - livedWeeks).toLocaleString()} AHEAD
        </span>
      </div>
    </div>
  );
});

const LifeRivers = memo(function LifeRivers() {
  const W = 320, H = 140, pad = 8;
  const N = LIFE_RIVERS[0].values.length;
  const stepX = (W - pad * 2) / (N - 1);
  const stacks: { k: string; hue: number; top: number; bot: number }[][] = [];
  for (let i = 0; i < N; i++) {
    let y = H - pad;
    const col: { k: string; hue: number; top: number; bot: number }[] = [];
    LIFE_RIVERS.forEach((r) => {
      const segH = r.values[i] * 22;
      col.push({ k: r.k, hue: r.hue, top: y - segH, bot: y });
      y -= segH;
    });
    stacks.push(col);
  }
  const paths = LIFE_RIVERS.map((r, li) => {
    const tops = stacks
      .map((c, i) => `${pad + i * stepX},${c[li].top}`)
      .join(" L ");
    const bots = stacks
      .map((c, i) => `${pad + i * stepX},${c[li].bot}`)
      .reverse()
      .join(" L ");
    return { hue: r.hue, k: r.k, d: `M ${tops} L ${bots} Z` };
  });
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {paths.map((p) => (
          <path
            key={p.k}
            d={p.d}
            fill={`oklch(0.62 0.11 ${p.hue})`}
            opacity={0.82}
          />
        ))}
        {Array.from({ length: 5 }, (_, i) => {
          const age = 18 + i * 4;
          const x = pad + i * 4 * stepX;
          return (
            <text
              key={age}
              x={x} y={H - 1}
              textAnchor="middle"
              fontFamily="var(--mono)" fontSize="8"
              fill="var(--ink-3)" letterSpacing="0.06em"
            >
              {age}
            </text>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {LIFE_RIVERS.map((r) => (
          <span
            key={r.k}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                width: 10, height: 10, borderRadius: 2,
                background: `oklch(0.62 0.11 ${r.hue})`,
              }}
            />
            <span
              style={{
                fontFamily: "var(--serif)", fontStyle: "italic",
                fontSize: 11.5, color: "var(--ink-2)",
              }}
            >
              {r.k}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
});

const PeopleConstellation = memo(function PeopleConstellation() {
  const cx = 160, cy = 160, S = 320;
  const rings = [38, 70, 105, 142];
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      width="100%"
      style={{ display: "block", maxWidth: 320, margin: "0 auto" }}
    >
      {rings.map((r, i) => (
        <circle
          key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke="var(--rule)" strokeWidth={0.5}
          strokeDasharray={i === 0 ? "none" : "1.5 2.5"}
        />
      ))}
      <circle cx={cx} cy={cy} r={9} fill="var(--ink)" />
      <text
        x={cx} y={cy + 3} textAnchor="middle"
        fontFamily="var(--serif)" fontStyle="italic" fontSize="10"
        fill="var(--paper)"
      >
        you
      </text>
      {PEOPLE_CONSTELLATION.map((p, i) => {
        const r = rings[p.ring - 1];
        const a = ((p.angle - 90) * Math.PI) / 180;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        const size =
          p.ring === 1 ? 7 : p.ring === 2 ? 5 : p.ring === 3 ? 3.6 : 2.6;
        return (
          <g key={i}>
            <line
              x1={cx} y1={cy} x2={x} y2={y}
              stroke={`oklch(0.55 0.10 ${p.hue})`}
              strokeWidth={p.ring === 1 ? 0.8 : 0.3}
              opacity={0.4}
            />
            <circle
              cx={x} cy={y} r={size}
              fill={`oklch(0.55 0.12 ${p.hue})`}
              stroke="var(--paper)" strokeWidth={0.6}
            />
            {p.label && (
              <text
                x={x + (Math.cos(a) >= 0 ? size + 3 : -size - 3)}
                y={y + 3}
                textAnchor={Math.cos(a) >= 0 ? "start" : "end"}
                fontFamily="var(--serif)" fontStyle="italic" fontSize="10"
                fill="var(--ink)"
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
      {[
        { r: rings[0], label: "inner" },
        { r: rings[1], label: "close" },
        { r: rings[2], label: "friends" },
        { r: rings[3], label: "orbit" },
      ].map((rr, i) => (
        <text
          key={i} x={cx} y={cy - rr.r - 2}
          textAnchor="middle"
          fontFamily="var(--mono)" fontSize="7.5"
          fill="var(--ink-3)" letterSpacing="0.1em"
        >
          {rr.label.toUpperCase()}
        </text>
      ))}
    </svg>
  );
});

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

function TissueBar({ weightKg }: { weightKg: number }) {
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
                {tissueSub(t, weightKg)}
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
  const { profile } = useProfile();
  // Real values when set; otherwise fall back to the demo defaults
  // and surface a "set in portrait" hint in the header so the user
  // knows the numbers aren't theirs yet.
  const hasWeight = typeof profile.weightKg === "number" && profile.weightKg > 0;
  const hasBirthYear = typeof profile.birthYear === "number";
  const weightKg = deriveWeight(profile.weightKg);
  const age = deriveAge(profile.birthYear);
  const inNumbers = buildInNumbers(age);

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          a <em>life</em>
        </div>
        <div
          className="h-meta"
          title={
            !hasWeight || !hasBirthYear
              ? "Set your weight and birth year in your portrait to make these numbers yours."
              : undefined
          }
        >
          {hasWeight ? `${weightKg} kg` : "— kg"}
          <br />
          {hasBirthYear ? `age ${age}` : "age —"}
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
              <TissueBar weightKg={weightKg} />
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
            <Kicker>a day · in the round</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <DayClock />
              <div className="margin-note" style={{ marginTop: 12, fontSize: 12 }}>
                "Sleep takes a third. Deep work and people, the next two
                slices. Everything else fits in the cracks."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>the year · in mood &amp; light</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <YearMoodCalendar />
              <div className="margin-note" style={{ marginTop: 12, fontSize: 12 }}>
                "The shape of seasonal depression, drawn small. Brightest
                mid-summer; thinnest in February."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>life · in weeks</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <LifeInWeeks age={age} />
              <div className="margin-note" style={{ marginTop: 12, fontSize: 12 }}>
                "Each square is a week. The ones already lived are warm; the
                rest are empty. You are roughly two-fifths of the way
                through."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>five rivers · what keeps running through</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <LifeRivers />
              <div className="margin-note" style={{ marginTop: 10, fontSize: 12 }}>
                "Reading has been steady. Music dipped through your twenties.
                Cold water arrived late and never left."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>people · the constellation</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <PeopleConstellation />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  marginTop: 12,
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

            <hr className="rule-dashed" />
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
              {inNumbers.map((n) => (
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
                    width: `${Math.min(100, (age / 84) * 100)}%`,
                    background: "var(--accent)",
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(100, (age / 84) * 100)}%`,
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
                  {age}
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
                "{Math.round((age / 84) * 1000) / 10}% of the way through.
                Roughly {Math.max(0, 84 - age)} years of expectancy remaining —
                about {Math.max(0, Math.round((84 - age) * 365.25)).toLocaleString()} more days."
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
