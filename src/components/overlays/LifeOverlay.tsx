import { memo, useState } from "react";
import { Kicker } from "../shared/primitives";
import { useProfile } from "../../lib/useProfile";
import { useMoods } from "../../lib/useMoods";
import { useRelations } from "../../lib/useRelations";
import { useWeighins } from "../../lib/useWeighins";
import { TheLedgerSection } from "./life-ledger";
import { DayTemplateSection } from "./life-day";
import { AgeFactsSection } from "./life-age-facts";
import { LifeRiversSection } from "./life-rivers";

// LifeOverlay's two physical knobs — weight (kg) and birth year —
// come from the saved profile (set in ProfileOverlay > Vital stats).
// Weight has two paths: a real weigh-in history (useWeighins) takes
// precedence, falling back to the static profile.weightKg one-shot
// field when no weigh-ins are logged. When neither is set, the
// overlay falls back to these gentle defaults and shows an inline
// prompt instead of pretending
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

// ── rhythms data ─────────────────────────────────────────────────

// Category → ring assignment for the people constellation. We map
// AddPersonFlow's five category keys onto four visual rings — family
// goes innermost (named), friends next (named), colleagues +
// neighbors out further (dots), acquaintances on the orbit (dots).
// Hues come from the AddPersonFlow palette so the visualisation
// matches the chips users tap when categorising.
interface ConstellationPerson {
  ring: number;
  angle: number;
  label?: string;
  hue: number;
}
const CATEGORY_RING: Record<string, { ring: number; hue: number; showLabel: boolean }> = {
  family: { ring: 1, hue: 12, showLabel: true },
  friends: { ring: 2, hue: 38, showLabel: true },
  colleagues: { ring: 3, hue: 220, showLabel: false },
  neighbors: { ring: 3, hue: 145, showLabel: false },
  acquaintances: { ring: 4, hue: 250, showLabel: false },
};
const RING_LABELS = [
  { ring: 1, label: "family" },
  { ring: 2, label: "friends" },
  { ring: 3, label: "everyday" },
  { ring: 4, label: "orbit" },
];

// ── rhythms components ───────────────────────────────────────────

// YearMoodCalendar — a 12x31 grid showing one cell per day, coloured
// by the day's logged mood score. Empty cells (no entry, or future
// days) render transparent. Filled cells use a warmth ramp where a
// higher score → brighter, warmer hue, lower → cooler.
//
// We always show the CURRENT calendar year so the grid is stable
// across sessions; calling code passes the real `moods` array from
// useMoods.
const YearMoodCalendar = memo(function YearMoodCalendar({
  moods,
}: {
  moods: { date: string; score: number }[];
}) {
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const cell = 8, gap = 2;
  // Build a {date: score} lookup so the grid render is O(12*31).
  // MoodEntry.score is 1..5; we scale to a 2..10 brightness ramp to
  // reuse the original palette stops. Days with no entry → -1
  // (transparent cell, matching the legacy "empty" treatment).
  const year = new Date().getFullYear();
  const byDate = new Map<string, number>();
  for (const m of moods) byDate.set(m.date, m.score);
  const daysInMonth = (mo: number) =>
    new Date(year, mo + 1, 0).getDate();
  const cellFor = (mo: number, d: number): number => {
    if (d >= daysInMonth(mo)) return -1;
    const iso = `${year}-${String(mo + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
    const score = byDate.get(iso);
    if (score === undefined) return -1;
    return Math.max(0, Math.min(10, score * 2));
  };
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {months.map((label, m) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 24,
                fontFamily: "var(--mono)", fontSize: 8.5,
                color: "var(--ink-3)", letterSpacing: "0.06em",
              }}
            >
              {label}
            </span>
            <div style={{ display: "flex", gap }}>
              {Array.from({ length: 31 }, (_, d) => {
                const v = cellFor(m, d);
                return (
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
                );
              })}
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

// PeopleConstellation — your relations as a 4-ring orbital diagram.
// Each person from useRelations is placed on a ring based on their
// category (family→ring 1, friends→ring 2, colleagues + neighbors→
// ring 3, acquaintances→ring 4). Inner-ring people get name labels;
// outer rings stay anonymous dots so we don't crowd the SVG.
//
// When the user has no relations yet, we render the rings + the
// central "you" pip with a short caption — same empty-state pattern
// as the rest of the app.
const PeopleConstellation = memo(function PeopleConstellation({
  people,
}: {
  people: { id: string; name: string; category: string }[];
}) {
  const cx = 160, cy = 160, S = 320;
  const rings = [38, 70, 105, 142];

  // Group people by their assigned ring. Distribute them evenly
  // around the circle so each ring fills its arc cleanly. The order
  // within each ring is deterministic (stable id sort) so positions
  // don't jump on re-render.
  const sorted = [...people].sort((a, b) => a.id.localeCompare(b.id));
  const byRing: ConstellationPerson[][] = [[], [], [], []];
  for (const p of sorted) {
    const meta = CATEGORY_RING[p.category];
    if (!meta) continue;
    byRing[meta.ring - 1].push({
      ring: meta.ring,
      angle: 0, // filled in below
      hue: meta.hue,
      label: meta.showLabel ? p.name.split(/\s+/)[0] : undefined,
    });
  }
  byRing.forEach((ringPeople, idx) => {
    const stagger = idx % 2 === 0 ? 0 : 180 / Math.max(ringPeople.length, 1);
    ringPeople.forEach((p, i) => {
      p.angle = (i * 360) / Math.max(ringPeople.length, 1) + stagger;
    });
  });
  const placed = byRing.flat();

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
      {placed.map((p, i) => {
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
      {RING_LABELS.map((rr, i) => (
        <text
          key={i} x={cx} y={cy - rings[rr.ring - 1] - 2}
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
  const { moods } = useMoods();
  const { people } = useRelations();
  const { latest: latestWeighin } = useWeighins();
  // Weight precedence: latest weigh-in > static profile.weightKg >
  // demo fallback. Birth year is single-source — there's no
  // "history of when you were born", just a year.
  const liveWeightKg =
    latestWeighin?.kg ??
    (typeof profile.weightKg === "number" && profile.weightKg > 0
      ? profile.weightKg
      : undefined);
  const hasWeight = liveWeightKg !== undefined;
  const hasBirthYear = typeof profile.birthYear === "number";
  const weightKg = deriveWeight(liveWeightKg);
  const age = deriveAge(profile.birthYear);
  const inNumbers = buildInNumbers(age);

  // Counts per visual ring of the people constellation. These drive
  // both the SVG (each ring fills with its members) and the four
  // count cards beneath. Mirrors the CATEGORY_RING map above so the
  // SVG and the cards never diverge.
  const ringCounts = [0, 0, 0, 0];
  for (const p of people) {
    const meta = CATEGORY_RING[p.category];
    if (meta) ringCounts[meta.ring - 1] += 1;
  }

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          <em>Life</em>
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
            <DayTemplateSection />

            <hr className="rule-dashed" />
            <Kicker>the year · in mood</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <YearMoodCalendar moods={moods} />
              <div
                className="margin-note"
                style={{ marginTop: 12, fontSize: 12 }}
              >
                {moods.length === 0
                  ? "\"One cell per day of this year. They fill in as you log your daily mood — the journal's mood tab is the easiest place to start.\""
                  : `"One cell per day. Brighter ones are higher mood scores. ${moods.length} ${moods.length === 1 ? "day" : "days"} logged so far this year."`}
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>life · in weeks</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <LifeInWeeks age={age} />
              <div
                className="margin-note"
                style={{ marginTop: 12, fontSize: 12 }}
              >
                "Each square is a week. The ones already lived are warm; the
                rest are empty."
              </div>
            </div>

            <hr className="rule-dashed" />
            <Kicker>people · the constellation</Kicker>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <PeopleConstellation people={people} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {RING_LABELS.map((r, i) => (
                  <div key={r.label} style={{ textAlign: "center" }}>
                    <div className="fig-num" style={{ fontSize: 22 }}>
                      <em>{ringCounts[i]}</em>
                    </div>
                    <div className="kicker" style={{ marginTop: 2 }}>
                      {r.label}
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="margin-note"
                style={{ marginTop: 10, fontSize: 12 }}
              >
                {people.length === 0
                  ? "\"Your relations appear here as orbits around you. Add a person from the + menu — family fills the inner ring, friends the next.\""
                  : `"${people.length} ${people.length === 1 ? "person" : "people"} in your circle. Dunbar says you can hold about 150 close before they fade."`}
              </div>
            </div>

            <hr className="rule-dashed" />
            <LifeRiversSection />
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
            <AgeFactsSection age={age} />

            <hr className="rule-dashed" />
            <TheLedgerSection />
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
