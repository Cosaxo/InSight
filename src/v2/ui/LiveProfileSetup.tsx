// LiveProfileSetup — the general info, asked once, at the start (D151).
//
// WHAT WAS WRONG. Every anchor an answer snapshots (D8) — age band,
// gender, city, country, education, profession, relationship, height —
// was collected in one place: the Basics card, four taps deep inside the
// profile overlay, behind a pencil icon. Nothing ever asked for it. So the
// common shape of a real account was: answer for a week, then discover the
// card, and find that the whole week's answers are stamped with `{}`.
//
// That is not a cosmetic gap. Answers are create-only (D5, amended by D86
// to an optionIdx-only edit), so an anchor missing at vote time is missing
// from that answer FOREVER — the aggregate folded it into no breakdown
// cell, and no later profile edit can move it. Every cohort screen in the
// Mirror reads those cells. A user who fills the card out in week two has
// a first week that contributes to nothing but the total.
//
// So the questions are asked at the top, once, where the cost of answering
// them is a minute and the cost of not answering them is nothing yet.
//
// FOUR THINGS IT DELIBERATELY DOES NOT DO.
//
//   1. It does not block. Every field can be skipped and the whole screen
//      can be dismissed, because D3 is anonymous-first and "never a wall"
//      — and because a required demographic form is how you teach people
//      to lie to one. What it costs to skip is stated plainly instead.
//   2. It does not ask twice. Dismissed or completed, profileSetup.tsx
//      records that it was asked — local and permanent; the Basics card
//      remains the place to change any of it later, and this screen says
//      so before the buttons.
//   3. It collects no free text and no exact anything. Every control is a
//      closed vocabulary held equal to the server's buckets by
//      check:anchors, the city is the catalogue picker (D9), and the
//      birthday never leaves the device — only its band is written
//      (profile-vitals.js anchorsFrom).
//   4. It has no vocabulary of its own. Every list, and the map from these
//      fields onto the eight anchor keys, is imported from
//      spec/profile-vitals.js, which is the file check:anchors reads. A
//      second copy here would pass every gate and quietly stop a level
//      counting.
import React from "react";
import LIVE from "../data/live";
import CityPicker from "./CityPicker";
import { mergeProfileVitals } from "../data/cityAnchor";
// The Basics card's own vocabulary and its anchor mapping. Its own module
// since D151, NOT an export from profile-general.jsx: spec-index imports
// that panel eagerly, so importing it from here made rollup extract the
// whole thing into a chunk first paint still preloads (check:bundle, 1 KB
// over). Untyped spec module, so the LiveSimilarityField suppression —
// one line, because TS reports TS7016 at the specifier.
// @ts-expect-error TS7016 — untyped spec module
import { AGE_BANDS, DAYS, EDU_OPTS, GENDER_OPTS, HEIGHT_OPTS, JOB_OPTS, MONTHS, REL_OPTS, YEARS, anchorsFrom } from "../spec/profile-vitals.js";

const PS_LINE = "1px solid var(--rule)";

const label: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)",
  display: "flex", flexDirection: "column", gap: 5,
};
const control: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)",
  background: "var(--surface)", border: PS_LINE, borderRadius: 11,
  padding: "10px 11px", WebkitAppearance: "none", appearance: "none",
  boxSizing: "border-box", width: "100%", minWidth: 0, letterSpacing: "normal",
  textTransform: "none",
};

function PsSelect({ id, value, onChange, options, placeholder }: {
  id: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={control}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function PsField({ id, title, children }: {
  id: string; title: string; children: React.ReactNode;
}) {
  return <label style={label} htmlFor={id}>{title}{children}</label>;
}

interface Vitals { [k: string]: string }

function LiveProfileSetup({ onDone }: { onDone: () => void }) {
  const [v, setV] = React.useState<Vitals>({});
  const [busy, setBusy] = React.useState(false);
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  // What the anchors WOULD be, so the screen can count them without
  // restating the mapping. Recomputed per render rather than tracked:
  // it is a pure fold over eight <select>s.
  const anchors: Record<string, string> = anchorsFrom(v);
  // The DERIVED keys do not count. `country` comes from the city and
  // `age`/`ageBand` both come from the birthday — counting them would tell
  // the reader they have filled in fields they were never shown. Nine
  // anchor keys, seven questions, and the birthday is three controls
  // feeding two of them.
  const DERIVED = ["country", "age"];
  const asked = Object.entries(anchors).filter(([k]) => !DERIVED.includes(k));
  const filled = asked.filter(([, val]) => !!val).length;

  function finish(save: boolean) {
    if (busy) return;
    setBusy(true);
    if (save && filled) {
      // Both halves, exactly as setCityAnchor does it and for the same
      // reason: GeneralPanel mirrors anchorsFrom(vitals) into saveAnchors
      // on EVERY mount, so anchors saved only server-side would survive
      // until the profile overlay next opened and then be replaced by the
      // blob's empty vitals.
      mergeProfileVitals(v);
      LIVE.saveAnchors(anchors);
    }
    // The "you were asked" flag is the caller's to write, on both ways
    // out — see profileSetup.tsx. Kept out of here so this file exports a
    // component and nothing else, which is what react-refresh needs to
    // hot-reload it.
    onDone();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 39, background: "var(--surface-2)",
      color: "var(--ink)", overflowY: "auto",
      paddingTop: "calc(env(safe-area-inset-top) + 22px)",
      paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)",
    }}>
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", padding: "0 22px" }}>
        <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}>
          A few things about you
        </div>
        {/* The pitch is the mechanism, because the mechanism is the reason.
            "Personalise your experience" would be a lie: none of this
            changes what you are shown. It changes which crowds your answer
            can be counted in, which is the entire Mirror. */}
        <p style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, lineHeight: 1.55,
          color: "var(--ink-2)", margin: "9px 0 4px", textWrap: "pretty" }}>
          Every answer you give carries a copy of these, so the app can show
          you how your city answered, or your age, or people who studied what
          you studied. Answers can&rsquo;t be re-filed later — so it is worth a
          minute now.
        </p>
        <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, lineHeight: 1.5,
          color: "var(--ink-3)", margin: "0 0 20px", textWrap: "pretty" }}>
          Skip anything you&rsquo;d rather not say — every one of these is
          optional, and you can change them any time in your profile.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* The birthday, whose BAND is the only part that is written.
              Asked as three selects rather than a date field because that
              is what the Basics card asks, and one vocabulary means one
              set of values reaching the server. */}
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.5fr 1.1fr", gap: 8 }}>
            <PsField id="ps-bornD" title="Day">
              <PsSelect id="ps-bornD" value={v.bornD || ""} onChange={(x) => set("bornD", x)} options={DAYS} placeholder="—" />
            </PsField>
            <PsField id="ps-bornM" title="Month">
              <PsSelect id="ps-bornM" value={v.bornM || ""} onChange={(x) => set("bornM", x)} options={MONTHS} placeholder="—" />
            </PsField>
            <PsField id="ps-born" title="Year">
              <PsSelect id="ps-born" value={v.born || ""} onChange={(x) => set("born", x)} options={YEARS} placeholder="—" />
            </PsField>
          </div>
          {/* Said out loud, because a birthday field on a first-run screen
              is the one people are right to be suspicious of.

              D155 made this sentence narrower and it had to be rewritten
              rather than left standing: the snapshot now carries the exact
              age too, so "only the band is saved" became false the moment
              anchorsFrom started returning one. The claim that survives is
              the one that was always the point — the DATE stays here. */}
          <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", marginTop: -8, lineHeight: 1.5 }}>
            Your age and its band ({AGE_BANDS.map((b: [number, number, string]) => b[2]).join(" · ")}) are
            saved — the date itself stays on this phone.
          </span>

          <PsField id="ps-gender" title="Gender">
            <PsSelect id="ps-gender" value={v.gender || ""} onChange={(x) => set("gender", x)} options={GENDER_OPTS} placeholder="—" />
          </PsField>

          {/* The catalogue picker (D9), not a text field: free text mints a
              bucket per spelling and the country breakdown published
              nothing at all while it did. Country is derived from the
              chosen city, never asked. */}
          <div style={label}>
            City
            <CityPicker value={v.city || ""} onChange={(x) => set("city", x)} inputStyle={control} />
          </div>

          <PsField id="ps-education" title="Education">
            <PsSelect id="ps-education" value={v.education || ""} onChange={(x) => set("education", x)} options={EDU_OPTS} placeholder="Level…" />
          </PsField>
          {/* Profession is deliberately NOT a breakdown dim (D8) — as free
              text every spelling would mint a bucket forever — but it is
              an anchor, and the Map's centre ring reads it. */}
          <PsField id="ps-job" title="Work">
            <PsSelect id="ps-job" value={v.job || ""} onChange={(x) => set("job", x)} options={JOB_OPTS} placeholder="Field…" />
          </PsField>
          <PsField id="ps-relationship" title="Relationship">
            <PsSelect id="ps-relationship" value={v.relationship || ""} onChange={(x) => set("relationship", x)} options={REL_OPTS} placeholder="—" />
          </PsField>
          {/* A band select, never a centimetre field (D140) — coarse by
              construction, the same posture locate.ts takes. */}
          <PsField id="ps-heightBand" title="Height">
            <PsSelect id="ps-heightBand" value={v.heightBand || ""} onChange={(x) => set("heightBand", x)} options={HEIGHT_OPTS} placeholder="—" />
          </PsField>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
          <button className="press" onClick={() => finish(true)} disabled={busy || !filled} style={{
            border: "none", borderRadius: 999, padding: "13px 0", cursor: filled ? "pointer" : "default",
            fontFamily: "var(--sans)", fontWeight: 800, fontSize: 14.5, WebkitAppearance: "none",
            background: filled ? "var(--ink)" : "var(--surface-3)",
            color: filled ? "var(--surface)" : "var(--ink-3)",
          }}>
            {filled ? `Save ${filled} of ${asked.length}` : "Answer one to continue"}
          </button>
          <button className="press" onClick={() => finish(false)} disabled={busy} style={{
            border: "none", background: "none", padding: "6px 0", cursor: "pointer",
            fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: "var(--ink-3)",
            WebkitAppearance: "none",
          }}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiveProfileSetup;
