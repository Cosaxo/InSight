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
//
// D275 changed three things about the SCREEN and none about the ask. The
// seven menus are the app's own now (ui/FieldPicker.tsx) rather than the
// platform's; the two buttons sit in a bar the form scrolls under, so the
// count is answering back while you fill it in rather than a thing you
// scroll ten fields to find; and a handle claim that fails for any reason
// other than "taken" no longer holds the screen shut. That last one is the
// bug the other two were reported alongside — see `finish` below.
import React from "react";
import LIVE from "../data/live";
import CityPicker from "./CityPicker";
import FieldPicker from "./FieldPicker";
import { mergeProfileVitals } from "../data/cityAnchor";
import { CITY_OK_LEAF } from "../data/cityConfirm";
import { reportError } from "../../lib/sentry";
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

// One vocabulary for the field captions, in both shapes it is needed in: a
// `<label>` around the two typed fields, and a bare `<span>` for the
// pickers — which own their own caption, because a <label> wrapped around
// a <button> takes the accessible name off the value (FieldPicker's
// header, and the a11y pass that found it around CityPicker).
const caption: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)",
};
const label: React.CSSProperties = {
  ...caption, display: "flex", flexDirection: "column", gap: 5,
};
const control: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)",
  background: "var(--surface)", border: PS_LINE, borderRadius: 11,
  // 12px rather than 10, and it is the 44px floor rather than taste: two
  // lines of padding around one line of 15px type is exactly 44, which
  // every control on this screen then shares — the typed fields, the city
  // button and the seven pickers — without any of them declaring a height.
  // A `minHeight` here would have reached the two `<input>`s as well, and
  // the only way to centre text inside one of those is `display: flex` on
  // a replaced element, which is not a thing to put on the first screen of
  // the app on the strength of one browser.
  padding: "12px 11px", WebkitAppearance: "none", appearance: "none",
  boxSizing: "border-box", width: "100%", minWidth: 0, letterSpacing: "normal",
  textTransform: "none",
};
// The caption under a field: the handle's rule, the birthday's bands, an
// error. `hint` is the quiet one and `alarm` the one that is wrong.
const hint: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500,
  color: "var(--ink-3)", lineHeight: 1.5,
};
const alarm: React.CSSProperties = { ...hint, fontWeight: 600, color: "oklch(0.5 0.19 25)" };
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
 * The pickers keep 15: the gate scopes to text fields, and tapping one
 * opens a sheet rather than a keyboard.
 */
const textField: React.CSSProperties = { ...control, fontSize: "var(--field-size)" };

/** One of the seven closed vocabularies, as the app's own menu. */
function PsPick({ id, title, value, onChange, options, placeholder }: {
  id: string; title: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string;
}) {
  return (
    <FieldPicker id={id} title={title} value={value} onChange={onChange}
      options={options} placeholder={placeholder}
      captionStyle={caption} style={control} />
  );
}

/** The two fields you TYPE in — a real <label> for a real <input>. */
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
  // The claim did not happen and the reason was not this handle (D275).
  // Kept apart from `hErr` because the two need different ways out: a
  // taken handle is answered by typing another one, and this is answered
  // by trying again or going on without one.
  const [hFailed, setHFailed] = React.useState(false);
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  // What the anchors WOULD be, so the screen can count them without
  // restating the mapping. Recomputed per render rather than tracked:
  // it is a pure fold over the seven pickers.
  const anchors: Record<string, string> = anchorsFrom(v);
  // The DERIVED keys do not count. `country` comes from the city and
  // `age`/`ageBand` both come from the birthday — counting them would tell
  // the reader they have filled in fields they were never shown. Nine
  // anchor keys, seven questions, and the birthday is three controls
  // feeding two of them.
  const DERIVED = ["country", "age"];
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

  /**
   * Close the screen, having written what there is to write.
   *
   * `dropHandle` is the way out of the one failure that used to trap
   * people here (D275). A claim that comes back "taken" is a fact about
   * the handle and the field is the answer to it. A claim that comes back
   * `unauthenticated` — which is what a callable says when App Check
   * cannot attest the build, and what a device reported — is a fact about
   * the CALL, and no amount of retyping fixes it. The old code printed
   * that word under the field and returned, so Save failed the same way
   * forever with the anchors and the name already saved behind it: a
   * finished screen that would not close.
   *
   * So the failure now says what it is and the buttons offer both
   * answers: try the claim again, or go on without one. A handle is
   * optional and the account panel still claims one (D190 removed the
   * RENAME, not the claim), which is what makes going on honest rather
   * than a loss.
   */
  async function finish(save: boolean, dropHandle = false) {
    if (busy) return;
    setBusy(true);
    try {
      await write(save, dropHandle);
    } catch (e) {
      // Nothing in `write` is expected to throw — the two network calls
      // are caught where they are made. Caught anyway, because the caller
      // is an onClick with no handler of its own, so anything that got out
      // would become an unhandled rejection and the screen would sit there
      // having done nothing and said nothing.
      reportError(e, { where: "profileSetup" });
    } finally {
      // Always, and that is the point: every early return in here used to
      // clear this by hand, so a throw from anywhere left both buttons
      // disabled with no way to press anything. `onDone` unmounts a tick
      // later (profileSetup.tsx), so the clear on the way out is invisible.
      setBusy(false);
    }
  }

  async function write(save: boolean, dropHandle: boolean) {
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
      if (typedHandle && !dropHandle) {
        try {
          await LIVE.social.claimHandle(typedHandle);
        } catch (e) {
          const raw = String((e instanceof Error && e.message) || e);
          if (/already-exists|taken/i.test(raw)) {
            setHErr(`${atHandle(typedHandle)} is taken.`);
            return;
          }
          // Everything else. The raw text used to be printed here, which
          // is how a screen came to say "Unauthenticated" at somebody
          // — a word from firebase-functions' App Check branch, about a
          // request, in the place a person was looking for their name.
          setHErr(`Couldn’t claim ${atHandle(typedHandle)} just now.`);
          setHFailed(true);
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

  // The one sentence under the handle field, in the four states it has.
  // `hErr` is the only one that is red, and the only one worth announcing.
  const handleLine = hErr || handleProblem(handle)
    || "A handle is picked once and can’t be changed.";

  return (
    // A column, not a scroller: the form scrolls and the buttons do not
    // (D275). What that fixes is a screen ten fields tall whose Save was
    // at the bottom of it — so the count that says how far you have got
    // was the one thing you had to scroll past everything to see, and the
    // way out of a screen you did not want was below the fold.
    <div style={{
      position: "fixed", inset: 0, zIndex: 39, background: "var(--surface-2)",
      color: "var(--ink)", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        paddingTop: "calc(env(safe-area-inset-top) + 22px)", paddingBottom: 18,
      }}>
        {/* `boxSizing`, and it is the whole of what was wrong with this
            screen's LOOK (D275). There is no `* { box-sizing: border-box }`
            in this app — `.app` sets it on itself and every panel declares
            it per control — and this screen is the one that renders OUTSIDE
            `.app`, in a root of its own on <body>. So `width: 100%` meant
            the viewport PLUS 44px of side padding: every field ran off the
            right edge, the sentences were cut mid-word, and the two device
            screenshots that reported it were not cropped. */}
        <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", padding: "0 22px", boxSizing: "border-box" }}>
          <div style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}>
            A few things about you
          </div>

          {/* The pitch is the mechanism, because the mechanism is the reason.
              "Personalise your experience" would be a lie: none of this
              changes what you are shown. It changes which crowds your answer
              can be counted in, which is the entire Mirror.

              It sits under the TITLE now rather than between the identity
              fields and the anchors, where it read as a note about the two
              fields above it and was the reason a first-run screen opened
              on a paragraph in its own middle. */}
          <p style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, lineHeight: 1.55,
            color: "var(--ink-2)", margin: "10px 0 0", textWrap: "pretty" }}>
            Every answer carries a copy of these, so it can be counted with your
            city, your age, your field. Answers can&rsquo;t be re-filed later.
          </p>
          {/* The qualifier the handle's own line used to carry a second copy
              of ("— except the handle"), dropped where it was the second
              copy: docs/COPY.md §3 licenses that only because the field's
              own caption states the exception four rows above. */}
          <p style={{ ...hint, margin: "6px 0 0" }}>
            All optional, and editable later in your profile.
          </p>

          {/* ── who you are, before what you are (D190) ──────────────────
              Two fields, at the top, because every other screen reads them
              and none of them should ask again. The name is what a reveal
              calls you; the handle is how someone adds you to a circle. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "20px 0 0" }}>
            <PsField id="ps-name" title="Your name">
              <input id="ps-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="What friends see" maxLength={60} style={textField} />
            </PsField>
            <PsField id="ps-handle" title="Your handle">
              <input id="ps-handle" value={handle}
                onChange={(e) => { setHandle(e.target.value); setHErr(null); setHFailed(false); }}
                placeholder="@yourname" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ ...textField, fontFamily: "var(--mono, monospace)" }} />
            </PsField>
            {/* A claim, not a caption: "picked once" is a thing the app will
                hold you to, and docs/COPY.md §3 keeps those at full strength
                however short the rest gets. */}
            <span style={{ ...(hErr ? alarm : hint), marginTop: -8 }} role={hErr ? "status" : undefined}>
              {handleLine}
              {/* What to do about it, on the line that says what went wrong
                  — because the buttons below now offer both answers and a
                  failure with no next step is what the old screen was. */}
              {hFailed && " Try again, or go on and pick one later in your profile."}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
            {/* The birthday, whose BAND is the only part that is written.
                Asked as three fields rather than a date input because that
                is what the Basics card asks, and one vocabulary means one
                set of values reaching the server. */}
            <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.5fr 1.1fr", gap: 8 }}>
              <PsPick id="ps-bornD" title="Day" value={v.bornD || ""} onChange={(x) => set("bornD", x)} options={DAYS} placeholder="—" />
              <PsPick id="ps-bornM" title="Month" value={v.bornM || ""} onChange={(x) => set("bornM", x)} options={MONTHS} placeholder="—" />
              <PsPick id="ps-born" title="Year" value={v.born || ""} onChange={(x) => set("born", x)} options={YEARS} placeholder="—" />
            </div>
            {/* Said out loud, because a birthday field on a first-run screen
                is the one people are right to be suspicious of.

                D155 made this sentence narrower and it had to be rewritten
                rather than left standing: the snapshot now carries the exact
                age too, so "only the band is saved" became false the moment
                anchorsFrom started returning one. The claim that survives is
                the one that was always the point — the DATE stays here. */}
            <span style={{ ...hint, marginTop: -8 }}>
              Your age and its band are saved ({AGE_BANDS.map((b: [number, number, string]) => b[2]).join(" · ")}).
              The date stays on this phone.
            </span>

            <PsPick id="ps-gender" title="Gender" value={v.gender || ""} onChange={(x) => set("gender", x)} options={GENDER_OPTS} placeholder="—" />

            {/* The catalogue picker (D9), not a text field: free text mints a
                bucket per spelling and the country breakdown published
                nothing at all while it did. Country is derived from the
                chosen city, never asked.

                A <span> caption rather than a <label>, for the reason
                FieldPicker's header gives: CityPicker collapses to a
                <button>, and a label wrapped round one takes the accessible
                name off the chosen city. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <span style={caption}>City</span>
              {/* The confirmation travels with the city (D205): a key the
                  device's fix agreed with, "" for a manual pick. Set as one
                  pair, because a city written without clearing the previous
                  city's confirmation is exactly the staleness storing a key
                  rather than a flag is meant to rule out. */}
              <CityPicker value={v.city || ""} inputStyle={control}
                onChange={(x, ok) => { set("city", x); set(CITY_OK_LEAF, ok ? x : ""); }} />
            </div>

            <PsPick id="ps-education" title="Education" value={v.education || ""} onChange={(x) => set("education", x)} options={EDU_OPTS} placeholder="Level…" />
            {/* Profession is deliberately NOT a breakdown dim (D8) — as free
                text every spelling would mint a bucket forever — but it is
                an anchor, and the Map's centre ring reads it. */}
            <PsPick id="ps-job" title="Work" value={v.job || ""} onChange={(x) => set("job", x)} options={JOB_OPTS} placeholder="Field…" />
            <PsPick id="ps-relationship" title="Relationship" value={v.relationship || ""} onChange={(x) => set("relationship", x)} options={REL_OPTS} placeholder="—" />
            {/* A band, never a centimetre field (D140) — coarse by
                construction, the same posture locate.ts takes. */}
            <PsPick id="ps-heightBand" title="Height" value={v.heightBand || ""} onChange={(x) => set("heightBand", x)} options={HEIGHT_OPTS} placeholder="—" />
          </div>
        </div>
      </div>

      {/* The bar the form scrolls under. Its own ground and a hairline, so
          a field passing behind it does not read as a field cut in half. */}
      <div style={{
        flexShrink: 0, borderTop: PS_LINE, background: "var(--surface-2)",
        padding: "12px 22px calc(env(safe-area-inset-bottom) + 12px)",
      }}>
        <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 6 }}>
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
            {hFailed ? "Try again"
              : filled ? `Save ${filled} of ${asked.length}`
              : canSave ? "Save" : "Answer one to continue"}
          </button>
          {/* The second way out, and which one it is depends on what is
              wrong. Ordinarily it abandons the screen; after a claim that
              could not be made, it is how you leave WITH everything else
              saved — the thing the screen would not let anyone do. */}
          <button className="press"
            onClick={() => void (hFailed ? finish(true, true) : finish(false))}
            disabled={busy} style={{
              border: "none", background: "none", padding: "10px 0", cursor: "pointer",
              fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, color: "var(--ink-3)",
              WebkitAppearance: "none", minHeight: 44,
            }}>
            {hFailed ? "Continue without a handle" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiveProfileSetup;
