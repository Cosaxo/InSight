// BodyOverlay — "the body."
//
// Was: a Garmin-style wearable dashboard (body battery, readiness,
// HRV, stress, sleep stages, VO2 max + percentile, HR zones), plus
// a meals "the table" tab with an AI camera flow that simulated
// photo recognition. Every number, every chart, every "verdict"
// came from IS_DATA seed.
//
// Is now:
// • Wearable section: a single honest empty-state card. None of
//   those metrics can come from anything other than a Garmin /
//   Apple Health / Fitbit integration, and that integration isn't
//   built. Same call we made for population aggregates, 'of you'
//   impressions, and the politics sub-axes — show what's missing
//   instead of seed numbers.
// • Meals: real, wired to useMeals (insight_meals subcollection
//   when signed in, localStorage otherwise). Today's kcal + macro
//   split + 7-day bar chart all derive from logged meals. The
//   AI photo-camera flow is replaced by a plain text form: name +
//   kcal + macro grams.
//
// Revival path for the wearable section: build a real Apple Health /
// Health Connect (Android) bridge, write the daily snapshot to
// insight_users/{uid}/insight_body/{date}, and have this overlay
// subscribe to it. Until then, the empty-state is the right thing.

import { useMemo, useState } from "react";
import { Kicker } from "../shared/primitives";
import { Donut, HBars } from "../shared/charts";
import { useMeals, isoDateToday } from "../../lib/useMeals";
import { useWorkouts } from "../../lib/useWorkouts";
import { useProfile } from "../../lib/useProfile";
import { useLLM } from "../../lib/useLLM";
import {
  buildMealEstimatePrompt,
  parseMealEstimate,
} from "../../lib/mealEstimate";
import {
  estimateEnergy,
  macroEnergyPct,
  macroTargets,
} from "../../lib/bodyEnergy";
import type { Meal } from "../../types";

// Fallback for users who haven't filled in weight + birth year. The
// FDA/EU food-label baseline — generic, labelled "reference" in the
// UI so it doesn't pretend to be theirs.
const DEFAULT_KCAL_TARGET = 2000;

// Hue rotation for the per-meal stamp colour. We don't store hue on
// the Meal type (it's about food, not visual identity), so we
// derive one deterministically from the meal id.
function hueOf(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

// "2026-05-14" → "may 14". Display-only; the underlying date stays
// ISO for sorting.
function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return `${months[m - 1]} ${d}`;
}

function lastNDates(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return days;
}

interface BodyOverlayProps {
  onClose: () => void;
}

export function BodyOverlay({ onClose }: BodyOverlayProps) {
  const [adding, setAdding] = useState(false);
  const { items, add, remove } = useMeals();
  const { items: workouts } = useWorkouts();
  const { profile } = useProfile();

  const today = isoDateToday();
  const todayMeals = items.filter((m) => m.date === today);
  const todayKcal = todayMeals.reduce((s, m) => s + m.kcal, 0);
  const todayMacros = todayMeals.reduce(
    (acc, m) => ({
      carbs: acc.carbs + m.carbs,
      protein: acc.protein + m.protein,
      fat: acc.fat + m.fat,
    }),
    { carbs: 0, protein: 0, fat: 0 },
  );

  // Personalised energy target. Uses Mifflin-St Jeor RMR + activity
  // factor derived from the last 14 days of workouts. Falls back to
  // the FDA/EU 2000 kcal reference when profile fields are missing.
  const energy = useMemo(() => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const cutoff = `${twoWeeksAgo.getFullYear()}-${String(twoWeeksAgo.getMonth() + 1).padStart(2, "0")}-${String(twoWeeksAgo.getDate()).padStart(2, "0")}`;
    return estimateEnergy({
      weightKg: profile.weightKg,
      birthYear: profile.birthYear,
      recentWorkouts: workouts.filter((w) => w.date >= cutoff),
    });
  }, [profile.weightKg, profile.birthYear, workouts]);
  const kcalTarget = energy.personalised ? energy.tdee : DEFAULT_KCAL_TARGET;

  // Today's kcal burned from workouts — used for the net-balance card.
  const todayWorkouts = workouts.filter((w) => w.date === today);
  const todayBurned = todayWorkouts.reduce((s, w) => s + w.kcal, 0);
  const netToday = todayKcal - todayBurned;

  // Macro targets derived from kcal target + weight (protein floor).
  const macroT = useMemo(
    () => macroTargets(kcalTarget, profile.weightKg),
    [kcalTarget, profile.weightKg],
  );
  const macroPct = macroEnergyPct(todayMacros);

  // 7-day kcal totals, chronological. Days with no meals show 0.
  const weekDays = useMemo(() => lastNDates(7), []);
  const weekKcal = weekDays.map((d) =>
    items.filter((m) => m.date === d).reduce((s, m) => s + m.kcal, 0),
  );
  const weekMax = Math.max(kcalTarget, ...weekKcal);

  // Sort logged meals: most recent date first, then by insertion
  // order (relying on the array order from useMeals which puts new
  // additions at the front).
  const sortedMeals = [...items].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">
          the <em>body</em>
        </div>
        <div className="h-meta">
          {todayKcal}
          <br />
          kcal today
        </div>
      </div>
      <div className="app-body">
        {/* Wearable section: honest empty-state. Body battery, HRV,
            sleep stages, VO2 max, HR zones, stress — none of those
            are wired to a real source. Show what's missing instead
            of inventing it. */}
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 16,
            borderLeft: "3px solid var(--ink-3)",
          }}
        >
          <Kicker>wearable signals · not connected</Kicker>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 15,
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            No watch is paired yet.
          </div>
          <div
            className="margin-note"
            style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}
          >
            "Body battery, HRV, sleep stages, VO₂ max, and HR zones
            land here once a wearable (Apple Health, Garmin, Fitbit,
            Health Connect) is connected. The integration isn't
            built yet — until then this stays empty rather than
            filling itself with sample numbers."
          </div>
        </div>

        <div
          className="card"
          style={{
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 14,
          }}
        >
          <Donut
            value={Math.min(
              100,
              Math.round((todayKcal / kcalTarget) * 100),
            )}
            color="var(--ochre)"
            label="KCAL"
            size={84}
          />
          <div style={{ flex: 1 }}>
            <div className="fig-num">
              <em>{todayKcal}</em>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                  color: "var(--ink-3)",
                  marginLeft: 6,
                }}
              >
                / {kcalTarget.toLocaleString()}
              </span>
            </div>
            <div className="kicker" style={{ marginTop: 2 }}>
              TODAY · {todayMeals.length}{" "}
              {todayMeals.length === 1 ? "ENTRY" : "ENTRIES"}
            </div>
            <div className="margin-note" style={{ marginTop: 6, fontSize: 12 }}>
              {energy.personalised
                ? `TDEE estimate · RMR ${energy.rmr.toLocaleString()} × ${energy.activity} activity. Set your own target in Profile if you want a different one.`
                : "Generic reference. Fill in your weight + birth year in Profile for a personalised TDEE estimate."}
            </div>
          </div>
        </div>

        {/* Net kcal balance — meals in minus workouts out. Only shown
            once the user has logged either for the day, to avoid an
            empty "0 net" card. */}
        {(todayKcal > 0 || todayBurned > 0) && (
          <div
            className="card"
            style={{
              marginBottom: 14,
              padding: 14,
              display: "flex",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1 }}>
              <Kicker>Net today · in − out</Kicker>
              <div
                className="fig-num"
                style={{ marginTop: 4, color: netToday > kcalTarget ? "var(--sienna)" : "var(--ink)" }}
              >
                <em>{netToday >= 0 ? "+" : ""}{netToday.toLocaleString()}</em>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--ink-3)",
                    marginLeft: 6,
                  }}
                >
                  kcal
                </span>
              </div>
              <div
                className="margin-note"
                style={{ marginTop: 4, fontSize: 11 }}
              >
                {todayKcal.toLocaleString()} eaten · {todayBurned.toLocaleString()} burned{" "}
                {todayBurned > 0 && `(${todayWorkouts.length} session${todayWorkouts.length === 1 ? "" : "s"})`}
              </div>
            </div>
          </div>
        )}

        {(todayMacros.carbs > 0 ||
          todayMacros.protein > 0 ||
          todayMacros.fat > 0) && (
          <div className="card" style={{ marginBottom: 14, padding: 14 }}>
            <Kicker>Today · macros · grams · target</Kicker>
            <div style={{ marginTop: 10 }}>
              <HBars
                items={[
                  {
                    label: `Protein ${todayMacros.protein}/${macroT.protein}g · ${macroPct.protein}%`,
                    value: todayMacros.protein,
                    color: "var(--sienna)",
                  },
                  {
                    label: `Carbs ${todayMacros.carbs}/${macroT.carbs}g · ${macroPct.carbs}%`,
                    value: todayMacros.carbs,
                    color: "var(--ochre)",
                  },
                  {
                    label: `Fat ${todayMacros.fat}/${macroT.fat}g · ${macroPct.fat}%`,
                    value: todayMacros.fat,
                    color: "var(--sage)",
                  },
                ]}
              />
            </div>
            <div
              className="margin-note"
              style={{ marginTop: 10, fontSize: 11, fontStyle: "italic" }}
            >
              Targets: 25% protein (min {profile.weightKg ? "1.6 g/kg" : "100g"})
              / 45% carbs / 30% fat split. Adjust by logging more or
              less — these are guides, not rules.
            </div>
          </div>
        )}

        <button
          onClick={() => setAdding(true)}
          style={{
            width: "100%",
            padding: "14px",
            background: "var(--ink)",
            color: "var(--paper)",
            border: "none",
            borderRadius: 14,
            fontFamily: "var(--serif)",
            fontSize: 15,
            letterSpacing: "-0.005em",
            marginBottom: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <span style={{ fontStyle: "italic" }}>+ log a meal</span>
        </button>

        {sortedMeals.length > 0 ? (
          <>
            <Kicker>your log · most recent first</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 10,
              }}
            >
              {sortedMeals.map((m) => (
                <MealRow key={m.id} m={m} onRemove={() => void remove(m.id)} />
              ))}
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: 22, textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 36,
                fontStyle: "italic",
                color: "var(--ink-3)",
              }}
            >
              ◌
            </div>
            <div
              className="margin-note"
              style={{ marginTop: 10, fontSize: 13 }}
            >
              "Log your first meal — name, calories, and rough macros.
              The today donut and the seven-day bar chart fill in as
              you go."
            </div>
          </div>
        )}

        {sortedMeals.length > 0 && (
          <div className="card" style={{ marginTop: 14, padding: 14 }}>
            <Kicker>Calories · seven days</Kicker>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 12,
                alignItems: "flex-end",
                height: 80,
              }}
            >
              {weekKcal.map((v, i) => {
                const isToday = i === 6;
                const label = weekDays[i].slice(-2);
                return (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      title={`${displayDate(weekDays[i])}: ${v} kcal`}
                      style={{
                        height: Math.max(2, (v / weekMax) * 70),
                        background: isToday ? "var(--ochre)" : "var(--paper-2)",
                        border: isToday ? "none" : "0.5px solid var(--rule)",
                        borderRadius: 2,
                        marginBottom: 4,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        color: isToday ? "var(--ink)" : "var(--ink-3)",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {adding && (
        <AddMealFlow
          onClose={() => setAdding(false)}
          onSave={async (meal) => {
            await add(meal);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function MealRow({ m, onRemove }: { m: Meal; onRemove: () => void }) {
  const hue = hueOf(m.id);
  const initial = (m.name.trim()[0] || "·").toUpperCase();
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderLeft: `3px solid oklch(0.55 0.12 ${hue})`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: 6,
          background: `oklch(0.85 0.06 ${hue})`,
          border: `0.5px solid oklch(0.55 0.12 ${hue})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 18,
          color: `oklch(0.30 0.13 ${hue})`,
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker">{displayDate(m.date)}</div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            marginTop: 1,
            lineHeight: 1.2,
          }}
        >
          {m.name || "untitled meal"}
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: "var(--ink-3)",
            letterSpacing: "0.04em",
            marginTop: 2,
          }}
        >
          C {m.carbs}g · P {m.protein}g · F {m.fat}g
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="fig-num" style={{ fontSize: 18 }}>
          <em>{m.kcal}</em>
        </div>
        <div className="kicker">KCAL</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Remove "${m.name || "this meal"}"?`)) onRemove();
        }}
        aria-label="Remove meal"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          fontFamily: "var(--mono)",
          fontSize: 14,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}

interface AddMealFlowProps {
  onClose: () => void;
  onSave: (m: Omit<Meal, "id">) => Promise<void>;
}

function AddMealFlow({ onClose, onSave }: AddMealFlowProps) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const {
    available: llmAvailable,
    ready: llmReady,
    downloading: llmDownloading,
    downloadPct: llmDownloadPct,
    ensure: ensureLLM,
    generate: llmGenerate,
  } = useLLM();

  const parseNum = (s: string): number => {
    const n = Number(s.trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };

  const canSave = name.trim().length > 0 && parseNum(kcal) > 0;
  const canEstimate = name.trim().length >= 3 && !estimating && !llmDownloading;

  // Ask Gemma for a kcal/macro estimate from the meal description.
  // Only fills fields the user hasn't already typed into — manual
  // edits always win.
  const runEstimate = async () => {
    if (!canEstimate) return;
    setEstimateError(null);
    setEstimating(true);
    try {
      if (!llmReady) await ensureLLM();
      const prompt = buildMealEstimatePrompt(name);
      const raw = await llmGenerate(prompt);
      const est = parseMealEstimate(raw);
      if (est.kcal == null && est.carbs == null && est.protein == null && est.fat == null) {
        setEstimateError("Couldn't read the estimate. Try a more specific description.");
        return;
      }
      if (est.kcal != null && kcal.trim() === "") setKcal(String(est.kcal));
      if (est.carbs != null && carbs.trim() === "") setCarbs(String(est.carbs));
      if (est.protein != null && protein.trim() === "") setProtein(String(est.protein));
      if (est.fat != null && fat.trim() === "") setFat(String(est.fat));
    } catch (err) {
      console.error("[AddMealFlow] estimate failed:", err);
      setEstimateError("Estimate failed. The numbers are still yours to type.");
    } finally {
      setEstimating(false);
    }
  };

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        date: isoDateToday(),
        name: name.trim(),
        kcal: parseNum(kcal),
        carbs: parseNum(carbs),
        protein: parseNum(protein),
        fat: parseNum(fat),
      });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    background: "var(--paper-2)",
    border: "0.5px solid var(--rule)",
    borderRadius: 6,
    fontFamily: "var(--mono)",
    fontSize: 14,
    color: "var(--ink)",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="app-header"
        style={{
          background: "transparent",
          borderBottom: "0.5px solid rgba(255,255,255,0.15)",
        }}
      >
        <button
          className="avatar-btn"
          onClick={onClose}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          log a meal
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div
          style={{
            background: "var(--paper)",
            borderRadius: 8,
            padding: 16,
            color: "var(--ink)",
          }}
        >
          <Kicker>what did you eat?</Kicker>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. cod, brown rice, fennel salad"
            style={{
              ...inputStyle,
              marginTop: 6,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 15,
            }}
          />

          {/* AI estimate affordance — only shown in-app where the
              on-device Gemma actually runs. Fills empty number
              fields; never overwrites manual edits. */}
          {llmAvailable && (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => void runEstimate()}
                disabled={!canEstimate}
                style={{
                  padding: "8px 12px",
                  background: canEstimate ? "var(--paper-2)" : "var(--paper-3)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 999,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: canEstimate ? "var(--ink)" : "var(--ink-3)",
                  cursor: canEstimate ? "pointer" : "default",
                }}
              >
                {estimating
                  ? "ESTIMATING…"
                  : llmDownloading
                    ? `DOWNLOADING AI · ${llmDownloadPct}%`
                    : llmReady
                      ? "✨ ESTIMATE WITH AI"
                      : "✨ ESTIMATE · DOWNLOADS ~2 GB"}
              </button>
              {estimateError && (
                <div
                  className="margin-note"
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "oklch(0.55 0.16 12)",
                  }}
                >
                  {estimateError}
                </div>
              )}
              {!estimateError && (
                <div
                  className="margin-note"
                  style={{ marginTop: 6, fontSize: 11, fontStyle: "italic" }}
                >
                  Runs entirely on this device. Fills empty fields only —
                  your edits stay.
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <Kicker>calories</Kicker>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="9999"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="kcal"
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <Kicker>macros · grams · optional</Kicker>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                marginTop: 6,
              }}
            >
              <label
                style={{ display: "flex", flexDirection: "column", gap: 3 }}
              >
                <span className="kicker">carbs</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="999"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder="0"
                  style={inputStyle}
                />
              </label>
              <label
                style={{ display: "flex", flexDirection: "column", gap: 3 }}
              >
                <span className="kicker">protein</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="999"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="0"
                  style={inputStyle}
                />
              </label>
              <label
                style={{ display: "flex", flexDirection: "column", gap: 3 }}
              >
                <span className="kicker">fat</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="999"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  placeholder="0"
                  style={inputStyle}
                />
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSave || saving}
              style={{
                flex: 1,
                padding: "12px",
                background: canSave ? "var(--ink)" : "var(--paper-3)",
                color: canSave ? "var(--paper)" : "var(--ink-3)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: canSave ? "pointer" : "default",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
