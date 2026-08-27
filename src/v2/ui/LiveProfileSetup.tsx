// LiveProfileSetup — the general info, asked once, at the start (D151),
// and since D190 your NAME and HANDLE with it.
//
// WHY THE TWO IDENTITY FIELDS MOVED HERE. They were asked by whatever
// screen happened to need them first, which meant the create-a-circle
// screen asked for a name — reported from a device: "you should not put in
// your name when making a 1v1, that should have been set up in the sign
// in". It is the same argument D151 makes about the anchors, one step
// earlier: a fact about WHO YOU ARE belongs to the account, so it is asked
// once, at the top, and every later screen reads it. A form field that
// re-asks something the account already knows is a screen that has not
// been told.
//
// The handle is asked here for a second reason of its own: it is claimed
// ONCE and never changed (D190), so the moment to offer it is before
// anyone has been handed it. `LivePrivacyPanel` still claims one for every
// account that predates this screen — what it no longer offers is a
// rename, and `claimHandleV2` refuses one.
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
//      remains the place to change any of it later EXCEPT the handle, and
//      this screen says so before the buttons.
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
import { CITY_OK_LEAF } from "../data/cityConfirm";
// The handle's fold and its problem sentences — the same pair the account
// panel uses, so a handle this screen accepts is one that panel would.
import { atHandle, handleProblem, normalizeHandle } from "../data/handles";
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
/**
 * The same control, for the two fields you can TYPE in (D190).
 *
 * The one difference is the size, and it is not taste: a text field under
 * 16px makes iOS zoom the whole app on focus, and the shell is
 * `position: fixed`, so nothing zooms it back — the user is left on a
 * scaled-up screen they cannot undo. `--field-size` is the token
 * styles.css owns for exactly this, and `check:touch-zoom` is the gate
 * that catches a field which forgets it (it caught these two).
 *
 * The selects above keep 15: the gate scopes to text fields, because a
 * picker's focus opens a native wheel rather than a keyboard.
 */
const textField: React.CSSProperties = { ...control, fontSize: "var(--field-size)" };

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
  // Identity (D190). Seeded from whatever the account already holds, so a
  // returning account is shown its own name rather than an empty box.
  const [name, setName] = React.useState(() => LIVE.displayName || "");
  const [handle, setHandle] = React.useState("");
  const [hErr, setHErr] = React.useState<string | null>(null);
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  // What the anchors WOULD be, so the screen can count them without
  // restating the mapping. Recomputed per render rather than tracked:
  // it is a pure fold over eight <select>s.
  const anchors: Record<string, string> = anchorsFrom(v);
  // The DERIVED keys do not count. `country` comes from the city,
  // `age`/`ageBand` both come from the birthday, and `jobField` (D317)
  // comes from the profession pick — counting them would tell the reader
  // they have filled in fields they were never shown. Ten anchor keys,
  // seven questions: the birthday is three controls feeding two of them,
  // and two more keys are folds of a single answer.
  //
  // A DERIVED key is not an exception to this list, it is the rule for
  // every fold `anchorsFrom` performs — so a new one belongs here in the
  // same change that adds it. The counter is what tells on you: D317 read
  // "Save 1 of 8" over seven questions until this line moved.
  const DERIVED = ["country", "age", "jobField"];
  const asked = Object.entries(anchors).filter(([k]) => !DERIVED.includes(k));
  const filled = asked.filter(([, val]) => !!val).length;

  // Something NEW worth saving — an anchor, a changed name, or a claimable
  // handle. Three sources, one gate, because the button is one button.
  //
  // "Changed", not "present": the name field is seeded from the account, so
  // a returning reader who touches nothing would otherwise be offered a
  // Save that writes nothing and closes the screen — a button that lies
  // about what it does.
  const typedHandle = normalizeHandle(handle);
  const newName = name.trim() !== (LIVE.displayName || "").trim() && !!name.trim();
  const canSave = filled > 0 || newName || !!typedHandle;

  // What this screen has already written. A refused handle keeps the
  // screen up (below), so Save is a button that can be pressed twice —
  // and without this the second press would re-write the anchors and the
  // name it saved on the first.
  const written = React.useRef({ anchors: false, name: "" });

  async function finish(save: boolean) {
    if (busy) return;
    setBusy(true);
    if (save && filled && !written.current.anchors) {
      // Both halves, exactly as setCityAnchor does it and for the same
      // reason: GeneralPanel mirrors anchorsFrom(vitals) into saveAnchors
      // on EVERY mount, so anchors saved only server-side would survive
      // until the profile overlay next opened and then be replaced by the
      // blob's empty vitals.
      //
      // FIRST, and synchronously: the two awaits below are the identity
      // half, and an anchor save that waited behind a network round trip
      // would be lost to a screen dismissed mid-flight.
      mergeProfileVitals(v);
      LIVE.saveAnchors(anchors);
      written.current.anchors = true;
    }
    if (save) {
      // Best-effort, like the anchors: a name that fails to write is worth
      // less than the screen staying up over it, and the account panel is
      // where it can be set again.
      const n = name.trim().slice(0, 60);
      if (newName && written.current.name !== n) {
        written.current.name = n;
        try { await LIVE.saveDisplayName(n); }
        catch { /* offline — the account panel keeps the field */ }
      }
      // The handle is NOT best-effort, and it is the one thing on this
      // screen that can fail for a reason the user must see: somebody else
      // holds it. Claimed last so a failure costs nothing already saved,
      // and the screen stays up with the field to correct.
      if (typedHandle) {
        try {
          await LIVE.social.claimHandle(typedHandle);
        } catch (e) {
          const raw = String((e instanceof Error && e.message) || e);
          setHErr(/already-exists|taken/i.test(raw)
            ? `${atHandle(typedHandle)} is taken.`
            : raw.replace(/^.*?: */, ""));
          setBusy(false);
          return;
        }
      }
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

        {/* ── who you are, before what you are (D190) ──────────────────
            Two fields, at the top, because every other screen reads them
            and none of them should ask again. The name is what a reveal
            calls you; the handle is how someone adds you to a circle. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "16px 0 0" }}>
          <PsField id="ps-name" title="Your name">
            <input id="ps-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="What friends see" maxLength={60} style={textField} />
          </PsField>
          <PsField id="ps-handle" title="Your handle">
            <input id="ps-handle" value={handle}
              onChange={(e) => { setHandle(e.target.value); setHErr(null); }}
              placeholder="@yourname" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ ...textField, fontFamily: "var(--mono, monospace)" }} />
          </PsField>
          {/* A claim, not a caption: "picked once" is a thing the app will
              hold you to, and docs/COPY.md §3 keeps those at full strength
              however short the rest gets. */}
          <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: hErr ? "oklch(0.5 0.19 25)" : "var(--ink-3)", marginTop: -8, lineHeight: 1.5 }} role={hErr ? "status" : undefined}>
            {hErr || handleProblem(handle) || "A handle is picked once and can’t be changed."}
          </span>
        </div>

        {/* The pitch is the mechanism, because the mechanism is the reason.
            "Personalise your experience" would be a lie: none of this
            changes what you are shown. It changes which crowds your answer
            can be counted in, which is the entire Mirror. */}
        <p style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, lineHeight: 1.55,
          color: "var(--ink-2)", margin: "22px 0 4px", textWrap: "pretty" }}>
          Every answer carries a copy of these, so it can be counted with your
          city, your age, your field. Answers can&rsquo;t be re-filed later.
        </p>
        <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, lineHeight: 1.5,
          color: "var(--ink-3)", margin: "0 0 20px", textWrap: "pretty" }}>
          All optional, and editable later in your profile — except the handle.
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
            Your age and its band are saved ({AGE_BANDS.map((b: [number, number, string]) => b[2]).join(" · ")}).
            The date stays on this phone.
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
            {/* The confirmation travels with the city (D205): a key the
                device's fix agreed with, "" for a manual pick. Set as one
                pair, because a city written without clearing the previous
                city's confirmation is exactly the staleness storing a key
                rather than a flag is meant to rule out. */}
            <CityPicker value={v.city || ""} inputStyle={control}
              onChange={(x, ok) => { set("city", x); set(CITY_OK_LEAF, ok ? x : ""); }} />
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
          <button className="press" onClick={() => void finish(true)} disabled={busy || !canSave} style={{
            border: "none", borderRadius: 999, padding: "13px 0", cursor: canSave ? "pointer" : "default",
            fontFamily: "var(--sans)", fontWeight: 800, fontSize: 14.5, WebkitAppearance: "none",
            background: canSave ? "var(--ink)" : "var(--surface-3)",
            color: canSave ? "var(--surface)" : "var(--ink-3)",
          }}>
            {/* The count is the ANCHORS' — they are the seven this screen
                is measured in. A name with no anchors behind it is still a
                save, and "Save 0 of 7" would be a lie about a button that
                works. */}
            {filled ? `Save ${filled} of ${asked.length}` : canSave ? "Save" : "Answer one to continue"}
          </button>
          <button className="press" onClick={() => void finish(false)} disabled={busy} style={{
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
