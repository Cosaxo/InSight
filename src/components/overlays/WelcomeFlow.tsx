// WelcomeFlow — first-launch onboarding for new users.
//
// Runs once, gated on a local flag (`insight.onboarded.v1`) so it
// doesn't replay across sessions or sign-ins. Three short cards:
//
//   1. Welcome      — one-sentence framing + a "begin" CTA.
//   2. Basics       — birth year + weight, both optional. These two
//                     fields unlock the personalised TDEE estimate in
//                     BodyOverlay; skipping is fine, we keep the
//                     generic reference instead.
//   3. First stop   — pick what to do first. Each option calls the
//                     same `onComplete` with a hint, and AppShell
//                     opens that surface.
//
// Deliberately skippable at every step (✕ in the header) — pushy
// onboarding is worse than no onboarding. The skip path still sets
// the flag, so the user doesn't see this again.

import { useState } from "react";
import { useProfile } from "../../lib/useProfile";
import { useGeolocation } from "../../lib/useGeolocation";
import { markOnboarded, type WelcomeHint } from "../../lib/onboarding";
import { Kicker } from "../shared/primitives";

interface WelcomeFlowProps {
  onComplete: (hint: WelcomeHint) => void;
}

export function WelcomeFlow({ onComplete }: WelcomeFlowProps) {
  const { profile, save } = useProfile();
  const { request: requestLocation, denied } = useGeolocation();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [birthYear, setBirthYear] = useState<string>(
    profile.birthYear ? String(profile.birthYear) : "",
  );
  const [weight, setWeight] = useState<string>(
    profile.weightKg ? String(profile.weightKg) : "",
  );
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const finish = (hint: WelcomeHint) => {
    markOnboarded();
    onComplete(hint);
  };

  const saveBasics = async () => {
    const by = Number(birthYear.trim());
    const wt = Number(weight.trim());
    const patch: { birthYear?: number; weightKg?: number } = {};
    const thisYear = new Date().getFullYear();
    if (Number.isFinite(by) && by >= 1900 && by <= thisYear) patch.birthYear = Math.round(by);
    if (Number.isFinite(wt) && wt >= 20 && wt <= 400) patch.weightKg = Math.round(wt);
    if (Object.keys(patch).length === 0) {
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      await save(patch);
    } finally {
      setSaving(false);
      setStep(2);
    }
  };

  const askLocation = async () => {
    setLocating(true);
    try {
      await requestLocation();
    } finally {
      setLocating(false);
      finish("around");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    background: "var(--paper-2)",
    border: "0.5px solid var(--rule)",
    borderRadius: 8,
    fontFamily: "var(--mono)",
    fontSize: 15,
    color: "var(--ink)",
  };

  const optionStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "14px 16px",
    background: "var(--paper-2)",
    border: "0.5px solid var(--rule)",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "var(--serif)",
    fontSize: 15,
    color: "var(--ink)",
    fontStyle: "italic",
    marginBottom: 10,
  };

  return (
    <div
      className="overlay paper-grain"
      style={{ position: "absolute", inset: 0, zIndex: 60 }}
    >
      <div
        className="app-header"
        style={{ justifyContent: "space-between" }}
      >
        <div className="kicker">{step + 1} / 3</div>
        <button
          className="avatar-btn"
          aria-label="skip onboarding"
          onClick={() => finish(null)}
        >
          ✕
        </button>
      </div>

      <div className="app-body" style={{ padding: 22 }}>
        {step === 0 && (
          <>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 36,
                lineHeight: 1.1,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
              }}
            >
              hello.
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 17,
                lineHeight: 1.5,
                marginTop: 18,
                color: "var(--ink-2)",
              }}
            >
              InSight is a quiet place for noticing your own life — body,
              days, people, the shape of a year. Nothing leaves your
              device by default.
            </div>
            <div
              className="margin-note"
              style={{ marginTop: 16, fontSize: 12, fontStyle: "italic" }}
            >
              This takes about a minute. Skip anything you don't want
              to answer — you can fill it in later in Profile.
            </div>
            <button
              onClick={() => setStep(1)}
              style={{
                marginTop: 32,
                width: "100%",
                padding: "14px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              begin
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <Kicker>about you · optional</Kicker>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 22,
                lineHeight: 1.3,
                marginTop: 10,
                color: "var(--ink)",
              }}
            >
              Two numbers that personalise the energy estimates.
            </div>

            <label style={{ display: "block", marginTop: 20 }}>
              <span className="kicker">birth year</span>
              <input
                type="number"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="e.g. 1992"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 14 }}>
              <span className="kicker">weight · kg</span>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 72"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>

            <div
              className="margin-note"
              style={{ marginTop: 12, fontSize: 11, fontStyle: "italic" }}
            >
              Used locally to compute a TDEE estimate (kcal target) and
              the mass-by-tissue breakdown in Life. Both editable in
              Profile.
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button
                onClick={() => setStep(2)}
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
                skip
              </button>
              <button
                onClick={() => void saveBasics()}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: 999,
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 14,
                  cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "saving…" : "continue"}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Kicker>where to start</Kicker>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 22,
                lineHeight: 1.3,
                marginTop: 10,
                color: "var(--ink)",
              }}
            >
              Pick the first quiet thing.
            </div>

            <div style={{ marginTop: 22 }}>
              <button
                onClick={() => finish("daily")}
                style={optionStyle}
              >
                <div>write today's report</div>
                <div
                  className="margin-note"
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 12,
                    marginTop: 4,
                    fontStyle: "normal",
                  }}
                >
                  one sentence is enough. The calendar fills in over time.
                </div>
              </button>

              <button
                onClick={() => finish("test")}
                style={optionStyle}
              >
                <div>take the Big Five test</div>
                <div
                  className="margin-note"
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 12,
                    marginTop: 4,
                    fontStyle: "normal",
                  }}
                >
                  five questions. Used for the personality compass in
                  Profile and (later) for matching with nearby people.
                </div>
              </button>

              <button
                onClick={() => void askLocation()}
                disabled={locating}
                style={{ ...optionStyle, opacity: locating ? 0.6 : 1 }}
              >
                <div>
                  {locating ? "asking…" : "look around"}
                </div>
                <div
                  className="margin-note"
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 12,
                    marginTop: 4,
                    fontStyle: "normal",
                  }}
                >
                  {denied
                    ? "location previously denied. You can enable it in browser settings later."
                    : "asks for location so cities and people nearby can render."}
                </div>
              </button>
            </div>

            <button
              onClick={() => finish(null)}
              style={{
                marginTop: 14,
                background: "transparent",
                border: "none",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "var(--ink-3)",
                cursor: "pointer",
                width: "100%",
                textAlign: "center",
              }}
            >
              just drop me in →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
