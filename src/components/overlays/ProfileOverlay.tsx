// ProfileOverlay — your portrait.
//
// What's honest here:
// • Identity chrome (name, initials, hue) comes from useMe (real auth).
// • Personality, politics, morals come from useProfile, populated by
//   the test overlay. Each section shows an empty-state with a
//   "take the test" CTA when the underlying data isn't there.
// • Likes, dislikes, heroes have inline editors right here — add /
//   remove writes through `save()` on useProfile, persisting to
//   Firestore for signed-in users and localStorage otherwise.
// • Vital stats (weightKg, birthYear) edit through `save()` as well.
//   LifeOverlay reads them to scale the body-mass breakdown and the
//   years-lived counters; when missing it falls back to a "set your
//   weight and birth year" prompt instead of fake numbers.
//
// What used to be here but isn't anymore: interests tag cloud,
// languages, life timeline, and badges all rendered seed data with
// no real source or schema field. They're removed; revival path is
// to add a real editor + schema field per section.

import { useEffect, useState } from "react";
import { IS_DATA } from "../../data/seedData";
import { useMe } from "../../lib/useMe";
import { useProfile, type ProfileExt } from "../../lib/useProfile";
import { isoDateToday } from "../../lib/useMoods";
import { useWeighins } from "../../lib/useWeighins";
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

// Tiny "×" remove button that hangs off a chip / card. Filled with
// muted ink so it doesn't shout louder than the value it's removing.
function RemoveX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Remove ${label}`}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--ink-3)",
        cursor: "pointer",
        fontFamily: "var(--mono)",
        fontSize: 11,
        lineHeight: 1,
        padding: 0,
        marginLeft: 4,
      }}
    >
      ×
    </button>
  );
}

interface InlineAddProps {
  placeholder: string;
  onAdd: (value: string) => void;
}

// One-line add input that lives next to a chip cloud. Submits on
// Enter or on the "+" button click. Empty/whitespace input is a
// no-op (and clears) so users don't get blank chips.
function InlineAdd({ placeholder, onAdd }: InlineAddProps) {
  const [v, setV] = useState("");
  const submit = () => {
    const t = v.trim();
    if (!t) return;
    onAdd(t);
    setV("");
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        border: "0.5px dashed var(--rule)",
        borderRadius: 999,
        background: "var(--paper-2)",
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13,
          color: "var(--ink)",
          width: 110,
        }}
      />
      <button
        onClick={submit}
        aria-label="Add"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-2)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 12,
          padding: 0,
        }}
      >
        +
      </button>
    </span>
  );
}

// Vital-stats editor. Two fields, two paths:
//
//   - birth year: single value, saved on profile.birthYear. Commit
//     on blur so typing "1992" doesn't pre-save "1", "19", "199".
//
//   - weight: weigh-in history. The number you type creates an entry
//     in useWeighins (date defaults to today) — LifeOverlay reads the
//     latest. A small "history (n)" expander shows the recent log
//     with × delete. Legacy users with profile.weightKg set but no
//     logged weigh-ins still see their static value here; the first
//     new entry shadows it.
function VitalStatsEditor({
  birthYear,
  onSave,
}: {
  birthYear?: number;
  onSave: (patch: { birthYear?: number }) => void;
}) {
  const { profile } = useProfile();
  const {
    items: weighins,
    latest: latestWeighin,
    add: addWeighin,
    remove: removeWeighin,
  } = useWeighins();

  const [w, setW] = useState<string>("");
  const [y, setY] = useState<string>(
    birthYear !== undefined ? String(birthYear) : "",
  );
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (birthYear !== undefined && birthYear !== Number(y)) setY(String(birthYear));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthYear]);

  // Current displayed weight: latest weigh-in, falling back to the
  // legacy profile.weightKg one-shot field for users who set it
  // before the weigh-in schema existed.
  const currentKg = latestWeighin?.kg ?? profile.weightKg;

  const commitWeight = async () => {
    const trimmed = w.trim();
    if (trimmed === "") return;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0 || n > 400) return;
    await addWeighin({
      date: isoDateToday(),
      kg: Math.round(n * 10) / 10,
    });
    setW("");
  };

  const commitYear = () => {
    const trimmed = y.trim();
    if (trimmed === "") {
      if (birthYear !== undefined) onSave({ birthYear: undefined });
      return;
    }
    const n = Number(trimmed);
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(n) || n < 1900 || n > thisYear) return;
    if (n !== birthYear) onSave({ birthYear: n });
  };

  // History sorted newest first for the expander. Capped at 6 to
  // keep the editor compact; the full sparkline lives in DaysOverlay.
  const recent = [...weighins]
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : b.createdAt - a.createdAt;
    })
    .slice(0, 6);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 12px",
    background: "var(--paper-2)",
    border: "0.5px solid var(--rule)",
    borderRadius: 6,
    fontFamily: "var(--mono)",
    fontSize: 14,
    color: "var(--ink)",
  };

  return (
    <>
      <Kicker>Vital stats · private to you</Kicker>
      <div className="margin-note" style={{ fontSize: 12, marginTop: 4 }}>
        "Weight tracks over time; birth year is a one-shot. Both
        scale the body-map and the days-lived counters in the life
        overlay."
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 10,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="kicker">
            weight · kg{" "}
            {currentKg !== undefined && (
              <span style={{ color: "var(--ink-2)", marginLeft: 4 }}>
                · now {currentKg}
              </span>
            )}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            max="400"
            value={w}
            placeholder={currentKg !== undefined ? "log a new weigh-in" : "—"}
            onChange={(e) => setW(e.target.value)}
            onBlur={() => void commitWeight()}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="kicker">born · year</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1900"
            max={new Date().getFullYear()}
            value={y}
            placeholder="—"
            onChange={(e) => setY(e.target.value)}
            onBlur={commitYear}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={inputStyle}
          />
        </label>
      </div>

      {weighins.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-3)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              padding: "8px 0 0",
            }}
          >
            {historyOpen ? "↑ hide" : `↓ history (${weighins.length})`}
          </button>
          {historyOpen && (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {recent.map((wi) => (
                <div
                  key={wi.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-2)",
                    padding: "3px 0",
                    borderBottom: "0.5px dashed var(--rule)",
                  }}
                >
                  <span style={{ color: "var(--ink-3)", letterSpacing: "0.04em" }}>
                    {wi.date}
                  </span>
                  <span style={{ flex: 1 }}>{wi.kg} kg</span>
                  {wi.note && (
                    <span
                      style={{
                        fontStyle: "italic",
                        fontFamily: "var(--serif)",
                        color: "var(--ink-3)",
                      }}
                    >
                      {wi.note}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Remove the ${wi.kg} kg entry from ${wi.date}?`)) {
                        void removeWeighin(wi.id);
                      }
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--ink-3)",
                      cursor: "pointer",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      padding: 0,
                    }}
                    aria-label="Remove weigh-in"
                  >
                    ×
                  </button>
                </div>
              ))}
              {weighins.length > 6 && (
                <div
                  className="margin-note"
                  style={{ fontSize: 10, marginTop: 4 }}
                >
                  showing 6 most recent · {weighins.length - 6} more in your
                  archive
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

interface ChipListEditorProps {
  values: string[];
  italic?: boolean;
  placeholder: string;
  emptyCopy: string;
  onChange: (next: string[]) => void;
}

// Used by Likes + Dislikes. Renders an existing chip cloud with
// per-chip × removal, plus the inline "+" add input at the end of
// the row. De-dupes additions case-insensitively so users don't end
// up with two chips that say the same thing.
function ChipListEditor({
  values,
  italic,
  placeholder,
  emptyCopy,
  onChange,
}: ChipListEditorProps) {
  const add = (v: string) => {
    const exists = values.some(
      (existing) => existing.toLowerCase() === v.toLowerCase(),
    );
    if (exists) return;
    onChange([...values, v]);
  };
  const remove = (v: string) => {
    onChange(values.filter((x) => x !== v));
  };
  return (
    <div>
      {values.length === 0 && (
        <div
          className="margin-note"
          style={{ fontSize: 12, fontStyle: "italic", marginBottom: 6 }}
        >
          {emptyCopy}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {values.map((l) => (
          <span
            key={l}
            className="pill"
            style={
              italic
                ? { opacity: 0.75, fontStyle: "italic" }
                : undefined
            }
          >
            {l}
            <RemoveX onClick={() => remove(l)} label={l} />
          </span>
        ))}
        <InlineAdd placeholder={placeholder} onAdd={add} />
      </div>
    </div>
  );
}

interface HeroEditorProps {
  heroes: Hero[];
  onChange: (next: Hero[]) => void;
}

// Heroes is structurally heavier than likes/dislikes (three fields
// per entry), so the add affordance is a separate collapsed form
// underneath the list instead of an inline pill.
function HeroEditor({ heroes, onChange }: HeroEditorProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [reason, setReason] = useState("");

  const reset = () => {
    setName("");
    setRole("");
    setReason("");
    setAdding(false);
  };
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    const dup = heroes.some(
      (h) => h.name.toLowerCase() === n.toLowerCase(),
    );
    if (dup) {
      reset();
      return;
    }
    onChange([
      ...heroes,
      { name: n, role: role.trim(), reason: reason.trim() },
    ]);
    reset();
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "0.5px solid var(--rule)",
    borderRadius: 6,
    background: "var(--paper)",
    fontFamily: "var(--serif)",
    fontSize: 13,
    outline: "none",
  } as const;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: 8,
      }}
    >
      {heroes.length === 0 && (
        <div
          className="margin-note"
          style={{ fontSize: 12, fontStyle: "italic" }}
        >
          The people you read in the margins.
        </div>
      )}
      {heroes.map((h) => (
        <div
          key={h.name}
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            position: "relative",
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
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {h.role && <span className="margin-note">{h.role}</span>}
              <RemoveX
                onClick={() =>
                  onChange(heroes.filter((x) => x.name !== h.name))
                }
                label={h.name}
              />
            </span>
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
      {adding ? (
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            borderStyle: "dashed",
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoFocus
            style={inputStyle}
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="What they were (writer, scientist, …)"
            style={inputStyle}
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why they matter to you"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submit}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "0.5px solid var(--accent)",
                borderRadius: 999,
                background: "var(--accent)",
                color: "var(--paper)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Add
            </button>
            <button
              onClick={reset}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                background: "transparent",
                color: "var(--ink-2)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: "10px",
            border: "0.5px dashed var(--rule)",
            borderRadius: 8,
            background: "transparent",
            color: "var(--ink-3)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          + add a hero
        </button>
      )}
    </div>
  );
}

export function ProfileOverlay({ onClose, onOpenTest }: ProfileOverlayProps) {
  const realMe = useMe();
  const { profile, save } = useProfile();

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

        <VitalStatsEditor
          birthYear={profile.birthYear}
          onSave={(patch) => void save(patch)}
        />

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

        <hr className="rule-dashed" />
        <Kicker>Likes · gathered over the years</Kicker>
        <div style={{ marginTop: 8 }}>
          <ChipListEditor
            values={likes}
            placeholder="add a like"
            emptyCopy="What you keep coming back to."
            onChange={(next) => void save({ likes: next })}
          />
        </div>

        <hr className="rule-dashed" />
        <Kicker>Dislikes · honest about</Kicker>
        <div style={{ marginTop: 8 }}>
          <ChipListEditor
            values={dislikes}
            italic
            placeholder="add a dislike"
            emptyCopy="What grates on you, even if you'd never say it out loud."
            onChange={(next) => void save({ dislikes: next })}
          />
        </div>

        <hr className="rule-dashed" />
        <Kicker>Heroes · who you read in the margins</Kicker>
        <HeroEditor
          heroes={heroes}
          onChange={(next) => void save({ heroes: next })}
        />
      </div>
    </div>
  );
}
