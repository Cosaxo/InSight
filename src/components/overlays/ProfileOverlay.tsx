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
import { IDEOLOGIES } from "../../data/politicsTaxonomy";
import { useAuth } from "../../lib/useAuth";
import { useMe } from "../../lib/useMe";
import { useProfile, type ProfileExt } from "../../lib/useProfile";
import type { MediaKey, MediaMap } from "../../types";
import { isoDateToday } from "../../lib/useMoods";
import { useWeighins } from "../../lib/useWeighins";
import {
  callDeleteAccount,
  firebaseEnabled,
  googleSignOut,
  reauthWithPassword,
} from "../../lib/firebase";
import {
  applyImport,
  downloadBackup,
  gatherExport,
  readBackupFile,
} from "../../lib/dataExport";
import { setTelemetryEnabled, telemetryEnabled } from "../../lib/sentry";
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

// PoliticsCard reads a `politicalIdentity` { name, tag } pair off
// `me`. We don't have a saved identity for the user — derive it by
// snapping to the closest ideology on the seed compass. The tag is
// left blank when we don't have copy for the synthesised identity;
// PoliticsCard renders it as ' "" ' which is harmless.
function deriveIdentity(political: Political): { name: string; tag: string } {
  let best: { name: string; d: number } | null = null;
  for (const io of IDEOLOGIES) {
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
// Currencies shown in the picker. Cosmetic order; the underlying
// store accepts any ISO code, the FinanceTab Intl formatter
// handles unknown codes gracefully.
const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "USD", label: "$ · USD" },
  { code: "EUR", label: "€ · EUR" },
  { code: "GBP", label: "£ · GBP" },
  { code: "NOK", label: "kr · NOK" },
  { code: "SEK", label: "kr · SEK" },
  { code: "DKK", label: "kr · DKK" },
  { code: "CHF", label: "CHF" },
  { code: "JPY", label: "¥ · JPY" },
  { code: "CAD", label: "CA$ · CAD" },
  { code: "AUD", label: "A$ · AUD" },
];

function VitalStatsEditor({
  birthYear,
  currency,
  onSave,
}: {
  birthYear?: number;
  currency?: string;
  onSave: (patch: { birthYear?: number; currency?: string }) => void;
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

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 10,
        }}
      >
        <span className="kicker">currency · for the finance tab</span>
        <select
          value={currency || "USD"}
          onChange={(e) => onSave({ currency: e.target.value })}
          style={{
            ...inputStyle,
            appearance: "auto",
            fontFamily: "var(--mono)",
          }}
        >
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

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

// PublicProfileEditor — the two free-text fields (bio + role) that
// can be exposed to nearby users via SharingOverlay's bio / role
// toggles. The fields are always editable here; the toggles
// decide whether they actually leave the device. Empty strings
// clear the value; cap is enforced on commit.
function PublicProfileEditor({
  bio,
  role,
  onSave,
}: {
  bio?: string;
  role?: string;
  onSave: (patch: { bio?: string; role?: string }) => void;
}) {
  // Track the last "incoming" prop values so an async profile
  // arrival (sign-in / import) can update our drafts without
  // stomping on a user mid-type. If the prop changes AND it
  // differs from the previous prop we saw, adopt the new value;
  // a user's typed change updates the draft but leaves the
  // previous-prop ref alone.
  const [bioDraft, setBioDraft] = useState(bio ?? "");
  const [roleDraft, setRoleDraft] = useState(role ?? "");
  const [lastBioProp, setLastBioProp] = useState(bio ?? "");
  const [lastRoleProp, setLastRoleProp] = useState(role ?? "");
  if ((bio ?? "") !== lastBioProp) {
    setLastBioProp(bio ?? "");
    setBioDraft(bio ?? "");
  }
  if ((role ?? "") !== lastRoleProp) {
    setLastRoleProp(role ?? "");
    setRoleDraft(role ?? "");
  }

  const commitBio = () => {
    const trimmed = bioDraft.trim().slice(0, 280);
    if (trimmed === (bio ?? "")) return;
    onSave({ bio: trimmed });
  };
  const commitRole = () => {
    const trimmed = roleDraft.trim().slice(0, 60);
    if (trimmed === (role ?? "")) return;
    onSave({ role: trimmed });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    background: "var(--paper-2)",
    border: "0.5px solid var(--rule)",
    borderRadius: 8,
    fontFamily: "var(--serif)",
    fontSize: 14,
    color: "var(--ink)",
  };

  return (
    <>
      <Kicker>public profile · for nearby people</Kicker>
      <div
        className="margin-note"
        style={{
          marginTop: 6,
          marginBottom: 12,
          fontSize: 12,
          fontStyle: "italic",
        }}
      >
        Always stays on this device until you flip the matching
        toggle in Sharing. Bio is capped at 280 characters; role at
        60.
      </div>

      <label style={{ display: "block", marginBottom: 12 }}>
        <span className="kicker">role · what you do</span>
        <input
          type="text"
          value={roleDraft}
          maxLength={60}
          onChange={(e) => setRoleDraft(e.target.value)}
          onBlur={commitRole}
          placeholder="ceramicist, marine biologist…"
          style={{ ...inputStyle, marginTop: 6 }}
        />
      </label>

      <label style={{ display: "block" }}>
        <span className="kicker">bio</span>
        <textarea
          value={bioDraft}
          maxLength={280}
          onChange={(e) => setBioDraft(e.target.value)}
          onBlur={commitBio}
          placeholder="A sentence or two for the people who find you."
          rows={3}
          style={{
            ...inputStyle,
            marginTop: 6,
            fontStyle: "italic",
            resize: "vertical",
          }}
        />
        <div
          style={{
            textAlign: "right",
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--ink-3)",
            marginTop: 4,
          }}
        >
          {bioDraft.length}/280
        </div>
      </label>
    </>
  );
}

// DemographicEditor — gender + country. Both opt-in via Sharing
// toggles; values stay local until the user enables the matching
// sharing tier. Country accepts an ISO 3166-1 alpha-2 code (two
// letters); the World tab uses this for the per-country
// breakdowns the Cloud Function aggregates daily.
type GenderOption = "man" | "woman" | "non-binary" | "prefer-not-to-say";

function DemographicEditor({
  gender,
  country,
  onSave,
}: {
  gender?: GenderOption;
  country?: string;
  onSave: (patch: { gender?: GenderOption; country?: string }) => void;
}) {
  const [countryDraft, setCountryDraft] = useState(country ?? "");
  const [lastCountryProp, setLastCountryProp] = useState(country ?? "");
  if ((country ?? "") !== lastCountryProp) {
    setLastCountryProp(country ?? "");
    setCountryDraft(country ?? "");
  }

  const commitCountry = () => {
    const trimmed = countryDraft.trim().toUpperCase().slice(0, 2);
    if (trimmed === (country ?? "")) return;
    onSave({ country: trimmed });
  };

  const genderOptions: Array<{ id: GenderOption; label: string }> = [
    { id: "man", label: "man" },
    { id: "woman", label: "woman" },
    { id: "non-binary", label: "non-binary" },
    { id: "prefer-not-to-say", label: "prefer not to say" },
  ];

  return (
    <>
      <Kicker>demographic · optional</Kicker>
      <div
        className="margin-note"
        style={{
          marginTop: 6,
          marginBottom: 12,
          fontSize: 12,
          fontStyle: "italic",
        }}
      >
        Used in the World tab's per-country breakdowns and the
        Interests tab demographics card. Stays on this device until
        the matching toggle in Sharing is on.
      </div>

      <div style={{ marginBottom: 14 }}>
        <span className="kicker">gender</span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 6,
          }}
        >
          {genderOptions.map((g) => {
            const on = gender === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSave({ gender: on ? undefined : g.id })}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  background: on ? "var(--ink)" : "var(--paper-2)",
                  color: on ? "var(--paper)" : "var(--ink-2)",
                  border: on ? "none" : "0.5px solid var(--rule)",
                  cursor: "pointer",
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <label style={{ display: "block" }}>
        <span className="kicker">country · ISO code (e.g. NO, US, GB)</span>
        <input
          type="text"
          value={countryDraft}
          maxLength={2}
          onChange={(e) =>
            setCountryDraft(e.target.value.toUpperCase().slice(0, 2))
          }
          onBlur={commitCountry}
          placeholder="NO"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            marginTop: 6,
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 8,
            fontFamily: "var(--mono)",
            fontSize: 16,
            letterSpacing: "0.2em",
            textAlign: "center",
            color: "var(--ink)",
          }}
        />
      </label>
    </>
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
          <em>Profile</em>
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
          currency={profile.currency}
          onSave={(patch) => void save(patch)}
        />

        <hr className="rule-dashed" />

        <PublicProfileEditor
          bio={profile.bio}
          role={profile.role}
          onSave={(patch) => void save(patch)}
        />

        <hr className="rule-dashed" />

        <DemographicEditor
          gender={profile.gender}
          country={profile.country}
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

        <hr className="rule-dashed" />
        <Kicker>Media · what you love</Kicker>
        <div
          className="margin-note"
          style={{ fontSize: 11, marginTop: 4, color: "var(--ink-3)" }}
        >
          Your favourites. Shared per your "media favourites" sharing
          setting; they power the popularity shelves in Around / City /
          World.
        </div>
        {(
          [
            { key: "music", label: "Music" },
            { key: "film", label: "Films" },
            { key: "books", label: "Books" },
            { key: "podcasts", label: "Podcasts" },
          ] as { key: MediaKey; label: string }[]
        ).map(({ key, label }) => (
          <div key={key} style={{ marginTop: 10 }}>
            <Kicker>{label}</Kicker>
            <div style={{ marginTop: 6 }}>
              <ChipListEditor
                values={profile.media?.[key] ?? []}
                placeholder={`add ${label.toLowerCase()}`}
                emptyCopy={`Your favourite ${label.toLowerCase()}.`}
                onChange={(next) => {
                  const cur: MediaMap = {
                    music: [],
                    film: [],
                    books: [],
                    podcasts: [],
                    ...(profile.media ?? {}),
                  };
                  void save({ media: { ...cur, [key]: next } });
                }}
              />
            </div>
          </div>
        ))}

        <hr className="rule-dashed" />
        <BackupSection />

        <hr className="rule-dashed" />
        <TelemetrySection />

        <hr className="rule-dashed" />
        <AccountSection />

        <hr className="rule-dashed" />
        <DangerZone />
      </div>
    </div>
  );
}

// ─── AccountSection — standalone sign-out (delete lives in DangerZone) ─
//
// Sign-out was previously only reachable through the delete-account
// path inside DangerZone. Surface it as a plain action — far more
// common, far less destructive.

function AccountSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!firebaseEnabled || !user) return null;

  const handleSignOut = async () => {
    if (busy) return;
    if (!confirm("Sign out? Your data stays on this device.")) return;
    setBusy(true);
    try {
      await googleSignOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Kicker>account · this device</Kicker>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13,
          lineHeight: 1.4,
          color: "var(--ink-2)",
        }}
      >
        Signed in as <span style={{ fontStyle: "normal" }}>{user.email ?? user.uid}</span>.
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={busy}
        style={{
          marginTop: 10,
          padding: "10px 14px",
          background: "transparent",
          color: "var(--ink-1)",
          border: "0.5px solid var(--ink-2)",
          borderRadius: 999,
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "signing out…" : "sign out"}
      </button>
    </>
  );
}

// ─── TelemetrySection — opt-in toggle for Sentry crash + error reports ─
//
// Sentry is configured (VITE_SENTRY_DSN) but inert until the user
// opts in. The flag lives in localStorage so it survives sign-outs
// but never leaves the device. Flipping it on calls sentryInit()
// which then attaches the global handlers; flipping it off clears
// the user id but can't fully tear down the SDK at runtime — that
// takes effect on the next launch.

function TelemetrySection() {
  const [enabled, setEnabled] = useState(() => telemetryEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setTelemetryEnabled(next);
  };

  return (
    <>
      <Kicker>telemetry · opt-in only</Kicker>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13,
          lineHeight: 1.4,
          color: "var(--ink-2)",
        }}
      >
        Crash and error reports help us find bugs we can't see. Off by
        default — when on, only stack traces and an anonymous user id
        leave the device (never your data).
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          aria-label="telemetry"
          style={{
            width: 44,
            height: 24,
            borderRadius: 999,
            background: enabled ? "var(--ink-1)" : "var(--paper-2)",
            border: "0.5px solid var(--ink-2)",
            position: "relative",
            cursor: "pointer",
            padding: 0,
            transition: "background 0.15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: enabled ? 22 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: enabled ? "var(--paper)" : "var(--ink-2)",
              transition: "left 0.15s",
            }}
          />
        </button>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-2)",
          }}
        >
          {enabled ? "on" : "off"}
        </span>
      </div>
      {enabled && (
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 11, fontStyle: "italic" }}
        >
          Turning off later stops new reports on the next app launch.
        </div>
      )}
    </>
  );
}

// ─── BackupSection — JSON export / import of locally-cached data ─
//
// Sits above the danger zone because, well, the safest thing to do
// before a destructive action is take a backup. Export dumps every
// `insight.*` localStorage key into a JSON file the user downloads.
// Import takes that file back and replaces local state, then forces
// a reload so the hooks re-init cleanly.

function BackupSection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    setMessage(null);
    setError(null);
    try {
      const blob = gatherExport();
      const count = Object.keys(blob.entries).length;
      downloadBackup(blob);
      setMessage(`Saved ${count} entries.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleImport = async (file: File) => {
    setMessage(null);
    setError(null);
    if (!confirm(
      "Importing will replace your local data with the contents of this backup. Continue?",
    )) return;
    setBusy(true);
    try {
      const blob = await readBackupFile(file);
      const written = applyImport(blob);
      setMessage(`Restored ${written} entries. Reloading…`);
      // Give the user a moment to see the message before the reload
      // wipes the page.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <>
      <Kicker>backup · your data, your file</Kicker>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 13,
          lineHeight: 1.4,
          color: "var(--ink-2)",
        }}
      >
        Download a JSON snapshot of everything cached on this device, or
        restore one taken earlier. Cross-user data and the on-device
        LLM model file aren't included.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          style={{
            padding: "10px 14px",
            background: "var(--ink-1)",
            color: "var(--paper)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: busy ? "default" : "pointer",
            flex: 1,
            minWidth: 140,
          }}
        >
          export backup
        </button>
        <label
          style={{
            padding: "10px 14px",
            background: "transparent",
            color: "var(--ink-1)",
            border: "0.5px dashed var(--ink-2)",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: busy ? "default" : "pointer",
            flex: 1,
            minWidth: 140,
            textAlign: "center",
          }}
        >
          import backup
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              // Reset input so the same file can be picked again.
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
      </div>
      {message && (
        <div
          className="margin-note"
          style={{ marginTop: 8, color: "var(--ink-2)" }}
        >
          {message}
        </div>
      )}
      {error && (
        <div
          className="margin-note"
          style={{ marginTop: 8, color: "oklch(0.55 0.16 12)" }}
        >
          {error}
        </div>
      )}
    </>
  );
}

// ─── DangerZone — account deletion at the bottom of the portrait ─
//
// Apple App Store Guideline 5.1.1(v) and Google's User Data policy
// both require an in-app account deletion path for any app that
// supports account creation. This is that path.
//
// Flow:
//   1. Tap "Delete my account" → expands a danger-zone card with
//      what gets wiped + a typed-email confirmation gate.
//   2. Type the exact email to enable the red button.
//   3. For password sign-in users, prompt for password and call
//      reauthenticateWithCredential (Firebase requires recent
//      auth for destructive ops). For OAuth users (Apple / Google),
//      we ask them to sign out + back in within 5 minutes then
//      retry — full per-provider re-auth is a follow-up.
//   4. Call the deleteAccount Cloud Function. On success, sign out
//      (their auth account is gone; signOut clears local state).

function DangerZone() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!firebaseEnabled || !user) {
    // Signed-out users have no account to delete — drop the
    // section entirely rather than show a no-op.
    return null;
  }

  const email = user.email ?? "";
  const isPasswordUser =
    user.providerData.some((p) => p.providerId === "password");
  const canConfirm = email.length > 0 && typed.trim().toLowerCase() === email.toLowerCase();
  const canSubmit =
    canConfirm && !busy && (!isPasswordUser || password.length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Re-auth. Firebase rejects deleteUser unless the user's
      //    sign-in is recent (< 5 min); the easiest path is to
      //    re-auth right before the Cloud Function call.
      if (isPasswordUser) {
        await reauthWithPassword(password);
      }
      // For OAuth users (Apple / Google / etc.) we currently rely
      // on the Cloud Function path being able to do its work via
      // admin SDK + the function bailing if Firebase considers
      // the auth stale. If it bails, the catch below surfaces a
      // clear instruction.

      // 2. Wipe data + auth account via the Cloud Function.
      await callDeleteAccount();

      // 3. Sign out locally. By the time we get here, the auth
      //    account is gone server-side; this clears the client.
      await googleSignOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface the most common cases as friendly copy.
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("That password didn't match. Try again.");
      } else if (msg.includes("requires-recent-login")) {
        setError(
          "For security, sign out and sign back in, then try delete again within 5 minutes.",
        );
      } else {
        setError(msg);
      }
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <>
        <Kicker>danger zone</Kicker>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "transparent",
            color: "oklch(0.55 0.16 12)",
            border: "0.5px dashed oklch(0.55 0.16 12)",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            width: "100%",
          }}
        >
          delete my account
        </button>
      </>
    );
  }

  return (
    <>
      <Kicker>danger zone</Kicker>
      <div
        className="card"
        style={{
          marginTop: 10,
          padding: 14,
          borderLeft: "3px solid oklch(0.55 0.16 12)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 16,
            lineHeight: 1.3,
            marginBottom: 8,
          }}
        >
          Delete your account.
        </div>
        <div
          className="margin-note"
          style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}
        >
          "Wipes your entire journal — daily reports, moods, habits,
          impressions, scrapbook, weigh-ins, the ledger, your circle.
          Removes inbound impressions you've left for others. The
          Firebase Auth account itself is deleted last. Anonymous
          contributions to area aggregates can't be pulled back out
          individually; the next aggregator run rebuilds without you.
          Cannot be undone."
        </div>

        <div style={{ marginTop: 14 }}>
          <div
            className="kicker"
            style={{ fontSize: 9, marginBottom: 4 }}
          >
            type your email to confirm
          </div>
          <input
            type="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={email}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 12px",
              background: "var(--paper-2)",
              border: `0.5px solid ${canConfirm ? "oklch(0.55 0.16 12)" : "var(--rule)"}`,
              borderRadius: 6,
              fontFamily: "var(--mono)",
              fontSize: 13,
              color: "var(--ink)",
            }}
          />
        </div>

        {isPasswordUser && (
          <div style={{ marginTop: 10 }}>
            <div
              className="kicker"
              style={{ fontSize: 9, marginBottom: 4 }}
            >
              re-enter your password
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 6,
                fontFamily: "var(--mono)",
                fontSize: 13,
                color: "var(--ink)",
              }}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              background: "color-mix(in oklch, oklch(0.55 0.16 12) 8%, var(--paper))",
              border: "0.5px solid oklch(0.55 0.16 12)",
              borderRadius: 6,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 12,
              color: "oklch(0.55 0.16 12)",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setTyped("");
              setPassword("");
              setError(null);
            }}
            disabled={busy}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 14,
              cursor: busy ? "default" : "pointer",
              color: "var(--ink-2)",
            }}
          >
            cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            style={{
              flex: 1,
              padding: "10px",
              background: canSubmit ? "oklch(0.55 0.16 12)" : "var(--paper-3)",
              color: canSubmit ? "var(--paper)" : "var(--ink-3)",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 14,
              cursor: canSubmit ? "pointer" : "default",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "deleting…" : "delete my account"}
          </button>
        </div>
      </div>
    </>
  );
}
