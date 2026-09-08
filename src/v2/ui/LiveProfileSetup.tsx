// LiveProfileSetup — the general info, asked once, at the start (D151),
// and since D190 your NAME and HANDLE with it.
//
// WHY THE TWO IDENTITY FIELDS ARE HERE. They were asked by whatever screen
// happened to need them first, which meant the create-a-circle screen asked
// for a name — reported from a device: "you should not put in your name
// when making a 1v1, that should have been set up in the sign in". It is
// the same argument D151 makes about the anchors, one step earlier: a fact
// about WHO YOU ARE belongs to the account, so it is asked once, at the
// top, and every later screen reads it. A form field that re-asks something
// the account already knows is a screen that has not been told.
//
// The handle is asked here for a second reason of its own: it is claimed
// ONCE and never changed (D190), so the moment to offer it is before anyone
// has been handed it. `LivePrivacyPanel` still claims one for every account
// that predates this screen — what it no longer offers is a rename, and
// `claimHandleV2` refuses one.
//
// WHAT WAS WRONG. Every anchor an answer snapshots (D8) — age band, gender,
// city, country, education, profession, relationship, height — was
// collected in one place: the Basics card, four taps deep inside the
// profile overlay, behind a pencil icon. Nothing ever asked for it. So the
// common shape of a real account was: answer for a week, then discover the
// card, and find that the whole week's answers are stamped with `{}`.
//
// That is not a cosmetic gap. Answers are create-only (D5, amended by D86
// to an optionIdx-only edit), so an anchor missing at vote time is missing
// from that answer FOREVER — the aggregate folded it into no breakdown
// bucket and nothing re-folds it. A week of answers that belong to no
// cohort is a week the Mirror cannot draw.
//
// ── VISUAL REQUEST 10, and what the canvas changed ────────────────────
//
// The owner's build-33 report was two findings in one sentence: "the shert
// for filling in data is scaled wrong an looks bad… and some of them
// should ve requierd before skiping."
//
// The first was one missing property — `width: 100%` with 22px of padding
// a side and no `box-sizing`, in a stylesheet with no universal
// border-box reset, so the content box measured 446px inside a 402px
// window and every field ran 44px off the right edge. That is fixed below
// and commented where it is set.
//
// The second reversed this file's own stated reasoning, and the reversal
// is the owner's: it used to read "It does not block. Every field can be
// skipped and the whole screen can be dismissed, because D3 is
// anonymous-first and 'never a wall' — and because a required demographic
// form is how you teach people to lie to one."
//
// The first clause died at D414, which put the account wall up. The second
// still stands and is the actual design problem, because a required field
// does not produce truth, it produces a value. `design/setup-sheet-2026-09-08/`
// is the canvas that answers it, and its answer is STRUCTURE rather than
// marks — there is no asterisk anywhere on this screen:
//
//   · TWO GROUPS. "To start" holds the four the product cannot work
//     without; "If you like" holds the rest, with the heading itself
//     saying they can be added later. A reader can see what matters
//     without a legend.
//   · ONE SENTENCE saying what the four BUY, above the first of them:
//     your answers are counted with people of your age, gender and
//     country. That is the honest trade, and it is the only argument this
//     screen has for an honest answer.
//   · NO SKIP, and therefore no counter. "Some of them should be required
//     before skipping" is self-cancelling — a skip you must fill four
//     fields to reach is not a skip — so the button is Continue and it
//     waits, with one line under it saying what it is waiting for.
//     "Save 3 of 7" is gone with it.
//
// ONE PLACE THE CANVAS WAS OVERRULED, and it is the loop working. It
// asked for the birth YEAR alone. The year alone costs `calcAge` its
// month test — it decrements by one when the birthday has not come round
// yet this year, and cannot do that without the month — so the exact age
// D155 pairs with the band runs up to a year high. That arithmetic went
// to the owner rather than being taken here, and the ruling was *"yeah
// get full birth day"* (2026-09-08). So the date is back and the exact
// age is right, WITHOUT the three-column grid the canvas was right to
// kill: `type="date"` is one row, one tap, one native picker.
//
// EIGHT PICKERS, TEN KEYS. The screen maps its picker
// fields onto the 10 anchor keys `anchorsFrom` returns, and the difference
// is exactly what a counter on this screen used to get wrong: the birth
// year feeds two (D155's band and the exact age), the profession feeds two
// (the pick and D328's derived field), and the City row feeds `city` AND
// `country`, because a catalogue key carries its own code — which is why
// the Country row exists at all, for the people who answer one and not the
// other.
//
// TWO THINGS THE CANVAS DOES NOT DRAW, kept here deliberately, because
// both are omissions in the REQUEST rather than decisions by the owner —
// the request said "eleven controls" and enumerated none of them:
//
//   · THE POLITICAL CONSENT (D331). It is a consent requirement in law,
//     which CLAUDE.md puts outside D334's ask entirely: it is satisfied by
//     BUILDING the consent, never by deciding it away, and a canvas that
//     did not know about it cannot have decided anything. Kept verbatim,
//     including its two-equal-buttons rule.
//   · THE HEIGHT BAND (D140). An anchor with a real consumer; dropping it
//     from the only screen that asks would quietly retire it. It joins
//     "If you like" as a fifth row.
import React from "react";
import LIVE from "../data/live";
import { pushBackLayer } from "../data/backLayers";
import CityPicker from "./CityPicker";
import PLACES from "../data/places";
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
import { EDU_OPTS, GENDER_OPTS, HEIGHT_OPTS, JOB_OPTS, MONTHS, REL_OPTS, YEARS, anchorsFrom } from "../spec/profile-vitals.js";

const PS_LINE = "1px solid var(--rule)";
// The one red on the screen, and it belongs to exactly one thing: a handle
// somebody else already holds. Nothing is ever marked wrong for being
// empty — the button simply is not ready yet, which the hint says in
// words.
const PS_ERR = "oklch(0.5 0.19 25)";

const sans: React.CSSProperties = { fontFamily: "var(--sans)" };

/**
 * A group heading, and the whole of what replaced the asterisks.
 *
 * `aside` carries the promise that the optional group is not a last
 * chance ("Add or change later in your profile"). It is a CLAIM about
 * what the app will let you do rather than a caption on a shape you can
 * already see, which is the distinction docs/COPY.md §3 draws — so D182
 * does not shorten it away.
 */
function PsGroup({ title, aside }: { title: string; aside?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      gap: 10, padding: "0 2px", marginTop: 26, marginBottom: 8,
    }}>
      <span style={{ ...sans, fontSize: 13, fontWeight: 800, letterSpacing: "0.02em", color: "var(--ink)" }}>
        {title}
      </span>
      {aside && (
        <span style={{ ...sans, fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>{aside}</span>
      )}
    </div>
  );
}

/**
 * One picker row: the question on the left, the answer and a chevron on
 * the right, with the real `<select>` laid over the whole row at zero
 * opacity.
 *
 * WHY A ROW AND NOT THE STACKED `<select>` IT REPLACED. Eleven full-width
 * controls stacked down a phone read as a form to be endured; the same
 * eleven answers as two grouped cards of rows read as a list of
 * questions, which is what they are. That is the canvas's move and it is
 * the reason the screen no longer needs to explain itself in two
 * paragraphs at the top.
 *
 * WHY THE SELECT SURVIVES UNDERNEATH. It is still a native picker — on
 * iOS a wheel, on Android the platform sheet — so nothing here has to
 * reimplement keyboard support, VoiceOver, or the hardware back button
 * dismissing a list. The row is the drawing; the `<select>` is the
 * control, and it covers the row exactly so the hit box is the whole row
 * (54px, comfortably past `check:tap-targets`' 44).
 *
 * The value reads "Choose" in the muted ink until it is answered. Not a
 * dash: a dash is a shape, and "Choose" is the only word on the row that
 * says the row is tappable.
 */
function PsRow({ id, title, note, value, onChange, options, last }: {
  id: string; title: string; note?: string; value: string;
  onChange: (v: string) => void; options: string[]; last?: boolean;
}) {
  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column", justifyContent: "center",
      gap: 2, boxSizing: "border-box", minHeight: 54, padding: note ? "10px 16px" : "0 16px",
      borderBottom: last ? "none" : PS_LINE,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 22 }}>
        <label htmlFor={id} style={{ ...sans, fontSize: 15.5, fontWeight: 600, color: "var(--ink)" }}>{title}</label>
        <span style={{
          ...sans, display: "flex", alignItems: "center", gap: 8, fontSize: 15.5, fontWeight: 500,
          color: value ? "var(--ink)" : "var(--ink-3)",
        }}>
          <span>{value || "Choose"}</span>
          <span aria-hidden="true" style={{ color: "var(--ink-3)" }}>›</span>
        </span>
      </div>
      {note && (
        <span style={{ ...sans, fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: "var(--ink-3)" }}>
          {note}
        </span>
      )}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: 0, border: "none", background: "transparent",
          WebkitAppearance: "none", appearance: "none", font: "inherit",
        }}>
        <option value="">Choose</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/**
 * The birthday, as ONE row and one native picker.
 *
 * The canvas asked for a year alone, and the year alone costs `calcAge`
 * its month test: it decrements by one when the birthday has not come
 * round yet this year, and it cannot do that without the month, so the
 * exact age D155 pairs with the band runs up to a year high. The owner
 * ruled on that trade with the arithmetic in front of them — *"yeah get
 * full birth day"* — so the date is back and the exact age is right
 * again.
 *
 * What does NOT come back is the three-column day/month/year grid the
 * canvas was right to kill: it was the single most form-like thing on a
 * screen whose whole problem was reading as a form. `type="date"` is one
 * control, one row, one tap, and the picker it opens is the platform's
 * own — a wheel on iOS, a calendar on Android — which is strictly better
 * than three wheels for the same fact.
 *
 * It is a TEXT field as far as `check:touch-zoom` is concerned (only
 * range, checkbox, radio and colour are exempt), so it takes
 * `--field-size` like the two typed fields do — which is what it would
 * want anyway.
 *
 * `min`/`max` come from `YEARS` rather than from a literal, so the
 * bounds and the old select can never disagree: 13 is the floor the list
 * has always encoded, and this is the only place it is now expressed.
 */
function PsDateRow({ id, title, note, value, onChange, last }: {
  id: string; title: string; note?: string; value: string;
  onChange: (iso: string) => void; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
      boxSizing: "border-box", minHeight: 54, padding: note ? "10px 16px" : "0 16px",
      borderBottom: last ? "none" : PS_LINE,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 22 }}>
        <label htmlFor={id} style={{ ...sans, fontSize: 15.5, fontWeight: 600, color: "var(--ink)", flex: "none" }}>
          {title}
        </label>
        {/* Visible rather than overlaid at zero opacity, which is what the
            `<select>` rows do. A hidden `<select>` still opens on a tap
            anywhere over it; a hidden date field does not — its picker
            hangs off a calendar button the row would have made
            invisible, and a control you cannot open on a desktop browser
            is not a control. */}
        <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)}
          min={`${YEARS[YEARS.length - 1]}-01-01`} max={`${YEARS[0]}-12-31`}
          style={{
            ...sans, fontSize: "var(--field-size)", fontWeight: 500,
            color: value ? "var(--ink)" : "var(--ink-3)", background: "transparent",
            border: "none", outline: "none", padding: 0, margin: 0, textAlign: "right",
            minWidth: 0, WebkitAppearance: "none", appearance: "none",
          }} />
      </div>
      {note && (
        <span style={{ ...sans, fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: "var(--ink-3)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

/** The rounded card the rows sit in — the canvas's second surface. */
const cardStyle: React.CSSProperties = {
  borderRadius: 14, background: "var(--surface)", display: "flex", flexDirection: "column",
};

/**
 * The two fields you can TYPE in (D190).
 *
 * The size is not taste: a text field under 16px makes iOS zoom the whole
 * app on focus, and the shell is `position: fixed`, so nothing zooms it
 * back — the user is left on a scaled-up screen they cannot undo.
 * `--field-size` is the token styles.css owns for exactly this, and
 * `check:touch-zoom` is the gate that catches a field which forgets it
 * (it caught these two).
 *
 * The picker rows above are exempt and stay at 15.5: the gate scopes to
 * text fields, because a picker's focus opens a native wheel rather than
 * a keyboard.
 */
const textField: React.CSSProperties = {
  ...sans, fontSize: "var(--field-size)", fontWeight: 500, color: "var(--ink)",
  background: "var(--surface)", border: `1.5px solid var(--rule)`, borderRadius: 14,
  boxSizing: "border-box", width: "100%", minWidth: 0, height: 50, padding: "0 16px",
  WebkitAppearance: "none", appearance: "none", outline: "none",
};

interface Vitals { [k: string]: string }

function LiveProfileSetup({ onDone }: { onDone: () => void }) {
  const [v, setV] = React.useState<Vitals>({});

  // ANDROID'S BACK BUTTON, which `useDialog` does not cover. D24 gave this
  // overlay Escape and a focus trap — the keyboard path — and
  // `backLayers.ts` is the Android one, deliberately a separate mechanism
  // because Escape is a DOM event a focused dialog receives and the back
  // button is not.
  //
  // Without this, Back on D151's account questions falls through the
  // shell's handler (app-shell.jsx peels person → city → overlay → tab,
  // and this screen is none of them — it lives on its own root outside
  // `<App/>`), the handler returns false, and `back.ts` calls
  // `App.exitApp()`. That is verbatim the failure backLayers.ts was
  // written to stop, one screen earlier: the questions are still on screen
  // and the app quits under them.
  //
  // WHAT BACK DOES NOW THAT THERE IS NO SKIP. It still dismisses — the
  // platform's own gesture is not something this screen may take away, and
  // an app that traps the back button is one the store rejects. What
  // changed is that dismissing is no longer an offer the screen MAKES.
  // `profileSetup.tsx` writes the seen-flag on both ways out, so a
  // dismissal is remembered exactly as a Continue is; what it does not do
  // is put a second, easier button beside the one that asks.
  const doneRef = React.useRef(onDone);
  React.useEffect(() => { doneRef.current = onDone; });
  React.useEffect(() => pushBackLayer(() => doneRef.current()), []);
  const [busy, setBusy] = React.useState(false);
  // Identity (D190). Seeded from whatever the account already holds, so a
  // returning account is shown its own name rather than an empty box.
  const [name, setName] = React.useState(() => LIVE.displayName || "");
  const [handle, setHandle] = React.useState("");
  const [hErr, setHErr] = React.useState<string | null>(null);
  // Reactive, exactly like the front door's: the banner appears because a
  // write actually failed on the network, never because `navigator.onLine`
  // said so. The two screens then say the same sentence, which is the
  // point — see the offline artboard's note in the design README.
  const [offline, setOffline] = React.useState(false);
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  // THE DATE, both ways. The three vitals stay exactly as the Basics card
  // writes them — `born` a year string, `bornM` a month NAME out of
  // MONTHS, `bornD` a day string — because that card and this screen
  // share one vocabulary and `anchorsFrom` folds only that shape. What
  // this pair adds is the ISO string `<input type="date">` speaks, and
  // nothing else in the tree has to know about it.
  //
  // The three move TOGETHER, in one setter: a date control cannot produce
  // a half-answered date, and clearing it has to clear all three or
  // `calcAge` would read a stale month against a blank year.
  const bornISO = v.born && v.bornM && v.bornD
    ? `${v.born}-${String(MONTHS.indexOf(v.bornM) + 1).padStart(2, "0")}-${String(v.bornD).padStart(2, "0")}`
    : "";
  const setBorn = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    setV((s) => ({
      ...s,
      born: m ? m[1] : "",
      bornM: m ? MONTHS[Number(m[2]) - 1] : "",
      bornD: m ? String(Number(m[3])) : "",
    }));
  };

  // THE COUNTRY LIST, derived from the cities catalogue rather than
  // shipped (places.ts `countryList` has the reason: the server validates
  // the bucket as two uppercase letters, and the only alpha-2 codes in
  // this app come from that catalogue).
  //
  // `peek()` first, so a session that already loaded it — the city picker,
  // the Mirror's Near stop — pays nothing. Otherwise this is the same
  // ~139 KB asset the City row would fetch on its first open, pulled one
  // screen earlier because Country is now one of the four that has to be
  // answerable immediately. On a native build it is a local file inside
  // the app package, not a network read at all.
  //
  // There is NO loading state, which is the canvas's own rule for this
  // screen: until it lands the row simply reads "Choose" with nothing
  // behind it, which is what it reads before you tap it anyway.
  const [countries, setCountries] = React.useState(() => {
    const p = PLACES.peek();
    return p ? PLACES.countryList(p) : [];
  });
  React.useEffect(() => {
    if (countries.length) return;
    let live = true;
    PLACES.load().then(
      (p) => { if (live) setCountries(PLACES.countryList(p)); },
      () => { /* the row stays unanswerable; the City row reports its own */ },
    );
    return () => { live = false; };
  }, [countries.length]);
  // The row shows and stores the NAME; the anchor is the code. Two maps
  // rather than one, because the select's value has to round-trip through
  // a string and the code is what `anchorsFrom` wants.
  const countryName = React.useMemo(() => {
    const byCode: Record<string, string> = {};
    for (const c of countries) byCode[c.code] = c.name;
    return byCode;
  }, [countries]);
  const countryCode = React.useMemo(() => {
    const byName: Record<string, string> = {};
    for (const c of countries) byName[c.name] = c.code;
    return byName;
  }, [countries]);

  // What the anchors WOULD be, so the screen can read them back without
  // restating the mapping. Recomputed per render rather than tracked: it
  // is a pure fold over the controls.
  const anchors: Record<string, string> = anchorsFrom(v);

  const typedHandle = normalizeHandle(handle);
  const trimmedName = name.trim();
  // Something worth writing at all — used only to skip a no-op write, not
  // to gate the button any more. "Changed", not "present", for the name:
  // the field is seeded from the account, so a returning reader who
  // touches nothing has nothing to save.
  const newName = trimmedName !== (LIVE.displayName || "").trim() && !!trimmedName;
  const filled = Object.values(v).some(Boolean);

  // ── THE FOUR ─────────────────────────────────────────────────────────
  //
  // Chosen from what the product cannot work without rather than from what
  // is nice to have: the Mirror's City and Country stops need a place, its
  // breakdowns need a band, and every reveal needs a name (D190). COUNTRY
  // rather than city, because a country is cheap to answer honestly and a
  // city is where people start being vague — which is the whole of the
  // "a required field produces a value, not a truth" problem, answered by
  // choosing fields people have no reason to lie about.
  //
  // Read off `anchors.country` rather than off the control, so a country
  // that arrived via a CITY pick counts: `anchorsFrom` prefers the city's
  // code, and someone who picked Bergen has answered this question.
  const ready = !!trimmedName && !!v.born && !!v.gender && !!anchors.country;

  // What this screen has already written. A refused handle keeps the
  // screen up (below), so Continue is a button that can be pressed twice —
  // and without this the second press would re-write the anchors and the
  // name it saved on the first.
  //
  // KEYED ON THE CONTENT, both halves. The anchors half used to be a
  // boolean latched on the first save, and the name half already keyed on
  // the name — so the two disagreed about what "already written" meant. A
  // refused handle keeps this screen up precisely so the person can fix
  // something, and anything they fix on the way back is an EDIT: picking a
  // birth year after the first press, correcting a gender they mis-tapped.
  // The latch swallowed all of it, silently, and the screen then closed as
  // though it had saved.
  //
  // Keyed on `v` rather than on `anchors`, because `mergeProfileVitals(v)`
  // merges the raw controls while `saveAnchors` merges a lossy fold over
  // them — two vitals can produce one anchor set, and the raw pair is what
  // actually changed. Both writes merge and are idempotent, so a retry
  // with nothing edited still costs nothing.
  const written = React.useRef({ anchors: "", name: "" });

  // D331 — the political consent, asked here for D151's own reason: an
  // answer cannot be re-filed, and a coordinate published before anyone
  // agreed to it cannot be un-published from the copies people took.
  //
  // RECORDED ON THE TAP, not on Continue. A consent is its own act rather
  // than a field on a form: someone who taps "Not these" and then leaves
  // has decided, and losing that to a dismissed screen would re-ask them
  // tomorrow — which is how a refusal quietly becomes a nag. null is "not
  // answered yet", and the default while it is null is OFF.
  const [pol, setPol] = React.useState<boolean | null>(
    // Three states, and the middle one used to be missing. Consented is
    // true; ANSWERED-but-not-consented is a decline, and it must come back
    // as `false` so the screen shows the button they actually pressed;
    // only an unanswered ask is null. Seeding from consent alone made a
    // decline indistinguishable from never having been asked — the exact
    // re-ask the comment above calls a nag.
    () => (LIVE.politicalConsented() ? true : LIVE.politicalAnswered() ? false : null),
  );
  const answerPolitical = (on: boolean) => {
    setPol(on);
    void LIVE.setPoliticalConsent(on).catch(() => { /* next boot re-reads the truth */ });
  };

  /**
   * `dropHandle` is *Skip the handle for now*, and it is a parameter
   * rather than a `setHandle("")` before the call because a state setter
   * does not reach the closure this function already holds — the press
   * would clear the field on screen and then claim the taken handle again
   * from the render that scheduled it. The one thing on this screen that
   * can fail twice for the same reason is the one thing that must not.
   */
  async function finish(dropHandle = false) {
    if (busy) return;
    setBusy(true);
    setOffline(false);
    const vKey = JSON.stringify(v);
    if (filled && written.current.anchors !== vKey) {
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
      written.current.anchors = vKey;
    }
    // Best-effort, like the anchors: a name that fails to write is worth
    // less than the screen staying up over it, and the account panel is
    // where it can be set again.
    const n = trimmedName.slice(0, 60);
    if (newName && written.current.name !== n) {
      written.current.name = n;
      try { await LIVE.saveDisplayName(n); }
      catch { /* offline — the account panel keeps the field */ }
    }
    // The handle is NOT best-effort, and it is the one thing on this
    // screen that can fail for a reason the user must see: somebody else
    // holds it. Claimed last so a failure costs nothing already saved, and
    // the screen stays up with the field to correct.
    //
    // AND IT IS THE ONLY THING HERE THAT NEEDS THE NETWORK. The anchors
    // and the name go through Firestore's own offline queue; a claim
    // cannot, because uniqueness is decided by the server. So an offline
    // failure here is reported as offline — the front door's sentence,
    // word for word — rather than as "that handle is taken", which would
    // be a claim about somebody else's account made from a dropped
    // connection.
    const claim = dropHandle ? "" : typedHandle;
    if (claim) {
      try {
        await LIVE.social.claimHandle(claim);
      } catch (e) {
        const raw = String((e instanceof Error && e.message) || e);
        if (/network|unavailable|deadline|offline/i.test(raw)) {
          setOffline(true);
        } else {
          setHErr(/already-exists|taken/i.test(raw)
            ? `${atHandle(claim)} is taken. Everything else is saved.`
            : raw.replace(/^.*?: */, ""));
        }
        setBusy(false);
        return;
      }
    }
    // The "you were asked" flag is the caller's to write, on both ways
    // out — see profileSetup.tsx. Kept out of here so this file exports a
    // component and nothing else, which is what react-refresh needs to
    // hot-reload it.
    onDone();
  }

  // Three labels, one button. "Try again" when the last attempt died on
  // the network, "Save handle" when the only thing left is the handle
  // somebody else holds, "Continue" otherwise.
  const primary = offline ? "Try again" : hErr ? "Save handle" : "Continue";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 39, background: "var(--surface-2)",
      color: "var(--ink)", overflowY: "auto",
      paddingTop: "calc(env(safe-area-inset-top) + 22px)",
      paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)",
    }}>
      {/* boxSizing, and it is the whole of build 33's "scaled wrong" bug.
          There is NO universal `* { box-sizing: border-box }` in
          styles.css — it is set per rule — so `width: 100%` here meant
          100% of the viewport PLUS 44px of padding, and every field ran
          44px off the right edge on every phone narrower than 464. The
          screenshot that reported it shows the sentence about the handle
          cut mid-word.
          Measured, not assumed: at 402pt (iPhone 16 Pro) maxWidth never
          binds, so the content box was 446px inside a 402px window. */}
      <div style={{
        width: "100%", maxWidth: 420, margin: "0 auto", padding: "0 22px",
        boxSizing: "border-box",
      }}>
        {offline && (
          <div role="alert" style={{
            ...sans, display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box",
            padding: "12px 14px", marginBottom: 18, borderRadius: 14, border: PS_LINE,
            background: "var(--surface)", fontSize: 13.5, fontWeight: 600, lineHeight: 1.4,
            color: "var(--ink-2)",
          }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-3)", flex: "none" }} />
            <span>You&rsquo;re offline. Check your connection, then try again.</span>
          </div>
        )}

        {/* The serif, because this is the app's own voice asking rather
            than a form label. The front door sets the same pair one screen
            earlier and the two are read as one arrival. */}
        <h1 style={{
          fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, lineHeight: 1.2,
          letterSpacing: "-0.01em", margin: 0,
        }}>
          A few things about you
        </h1>
        {/* THE TRADE, in one sentence, and it replaced two paragraphs.
            "Personalise your experience" would be a lie: none of this
            changes what you are shown. It changes which crowds your answer
            can be counted in, which is the entire Mirror — so the sentence
            names the three anchors the cohorts are cut by and then says
            what that costs to give. It is a claim (docs/COPY.md §3), not a
            caption on a shape, so D182 does not shorten it away. */}
        <p style={{
          ...sans, fontSize: 14.5, fontWeight: 500, lineHeight: 1.45, color: "var(--ink-2)",
          margin: "8px 0 0", textWrap: "pretty",
        }}>
          Your answers are counted with people of your age, gender and country.
          That takes four things.
        </p>

        <PsGroup title="To start" />
        <input aria-label="Display name" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name" maxLength={60} style={textField} />
        <div style={{ ...cardStyle, marginTop: 8 }}>
          {/* THE WHOLE DATE, in one row — see PsDateRow for why it is a
              date field rather than the canvas's year, and why it is not
              the three selects that used to be here.

              The note is D155's claim, and it is a CLAIM rather than a
              caption (docs/COPY.md §3): a birthday field on a first-run
              screen is the one people are right to be suspicious of, and
              both halves of what happens to it have to be said. Two
              things are saved — the age and its band — and the date is
              not one of them.

              It said "Saved as an age group, not a date" on the canvas,
              which was true of the year-only version and became a
              half-truth the moment the exact age came back with the
              date. The sentence moved with the data, which is the edit
              D155 itself had to make to this file's previous wording. */}
          <PsDateRow id="ps-born" title="Date of birth" value={bornISO}
            onChange={setBorn}
            note="Your age and its band are saved. The date stays on this phone." />
          <PsRow id="ps-gender" title="Gender" value={v.gender || ""}
            onChange={(x) => set("gender", x)} options={GENDER_OPTS} />
          {/* Country is now ASKED as well as derived. It used to exist only
              as a fold over the city (D9) — which meant the one anchor the
              Mirror's Country stop is built on could not be answered
              without naming the town you live in. The row stores the
              display name and `anchorsFrom` turns the code back out of it;
              picking a city below overwrites this row, because a catalogue
              key carries its own country and the more specific answer
              wins. */}
          <PsRow id="ps-country" title="Country"
            value={countryName[v.country || ""] || ""}
            onChange={(x) => set("country", countryCode[x] || "")}
            options={countries.map((c) => c.name)} last />
        </div>

        <PsGroup title="If you like" aside="Add or change later in your profile" />
        <div style={cardStyle}>
          {/* The catalogue picker (D9), not a text field: free text mints a
              bucket per spelling and the country breakdown published
              nothing at all while it did. This is the one row that opens a
              search rather than a wheel, so it keeps its own control
              inside the row's frame. */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, boxSizing: "border-box", minHeight: 54, padding: "8px 16px",
            borderBottom: PS_LINE,
          }}>
            <span style={{ ...sans, fontSize: 15.5, fontWeight: 600, flex: "none" }}>City</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* The confirmation travels with the city (D205): a key the
                  device's fix agreed with, "" for a manual pick. Set as one
                  pair, because a city written without clearing the previous
                  city's confirmation is exactly the staleness storing a key
                  rather than a flag is meant to rule out.

                  The country moves with it, so the row above never
                  contradicts the row below — `anchorsFrom` would have
                  preferred the city's code anyway, and a screen that shows
                  Norway while the aggregate counts Sweden is the kind of
                  quiet disagreement nobody finds. */}
              <CityPicker value={v.city || ""}
                inputStyle={{
                  ...sans, fontSize: "var(--field-size)", fontWeight: 500, color: "var(--ink)",
                  background: "transparent", border: "none", outline: "none", textAlign: "right",
                  width: "100%", minWidth: 0, boxSizing: "border-box", padding: 0,
                  WebkitAppearance: "none", appearance: "none",
                }}
                onChange={(x, ok) => {
                  set("city", x);
                  set(CITY_OK_LEAF, ok ? x : "");
                  const code = PLACES.countryOf(x);
                  if (code) set("country", code);
                }} />
            </div>
          </div>
          <PsRow id="ps-education" title="Education" value={v.education || ""}
            onChange={(x) => set("education", x)} options={EDU_OPTS} />
          {/* Profession is deliberately NOT a breakdown dim as typed (D8) —
              as free text every spelling would mint a bucket forever — but
              it is an anchor, D328 buckets on the field derived from it,
              and the Map's centre ring reads it. */}
          <PsRow id="ps-job" title="Work" value={v.job || ""}
            onChange={(x) => set("job", x)} options={JOB_OPTS} />
          <PsRow id="ps-relationship" title="Relationship" value={v.relationship || ""}
            onChange={(x) => set("relationship", x)} options={REL_OPTS} />
          {/* A band select, never a centimetre field (D140) — coarse by
              construction, the same posture locate.ts takes. Not on the
              canvas, kept because the request never listed it: see the
              header. */}
          <PsRow id="ps-heightBand" title="Height" value={v.heightBand || ""}
            onChange={(x) => set("heightBand", x)} options={HEIGHT_OPTS} last />
        </div>

        {/* The handle sits with the optional group and outside its card,
            because it is the one field here that cannot be changed later —
            the group heading's promise does not cover it, so it says so
            itself. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span aria-hidden="true" style={{
              ...sans, position: "absolute", left: 16, fontSize: "var(--field-size)",
              fontWeight: 500, color: "var(--ink-3)",
            }}>@</span>
            <input aria-label="Handle" aria-invalid={!!hErr} value={handle}
              onChange={(e) => { setHandle(e.target.value); setHErr(null); }}
              placeholder="handle" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ ...textField, padding: "0 16px 0 34px", borderColor: hErr ? PS_ERR : "var(--rule)" }} />
          </div>
          {/* A claim, not a caption: "claimed once" is a thing the app will
              hold you to, and docs/COPY.md §3 keeps those at full strength
              however short the rest gets. The error replaces it and says
              the second half out loud — everything else is already
              written, which is what makes staying on this screen a
              correction rather than a re-do. */}
          <span role={hErr ? "status" : undefined} style={{
            ...sans, padding: "0 4px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.4,
            color: hErr ? PS_ERR : "var(--ink-3)",
          }}>
            {hErr || handleProblem(handle) || "A handle is claimed once and can’t be changed."}
          </span>
        </div>

        {/* NOT ONE OF THE FIELDS, and deliberately outside both groups. The
            anchors are facts about you that the aggregate slices by; this
            is permission for the app to derive and publish something it
            computes, so filing it as a demographic would be filing a
            consent as a fact.

            TWO BUTTONS OF EQUAL WEIGHT — same size, same border, neither in
            the accent colour and neither the page's filled primary. A
            coloured yes beside a grey no is a nudge, and a nudged consent
            is not freely given, which would cost the app the very thing the
            ask exists to obtain. This is the one control on this screen
            that must not look persuasive — and the reason it is not one of
            the four required is the same: a consent you cannot decline is
            not a consent. */}
        <div style={{ marginTop: 26, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
          <div style={{ ...sans, fontWeight: 800, fontSize: 14.5, color: "var(--ink)" }}>
            The politics questions
          </div>
          <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>
            Political opinion is special-category data, so it is a separate
            choice. Say yes and your answers to those cards build a
            six-axis compass on your profile, which anyone signed in can
            read — like every other answer here. Say no and no political
            profile is built. You can change it later in your account.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {([[false, "Not these"], [true, "Yes, build it"]] as const).map(([on, label]) => (
              <button key={label} className="press" onClick={() => answerPolitical(on)} disabled={busy}
                style={{
                  ...sans, flex: 1, borderRadius: 999, padding: "11px 0", cursor: "pointer",
                  fontWeight: 800, fontSize: 13.5, WebkitAppearance: "none",
                  border: `1.5px solid ${pol === on ? "var(--ink)" : "var(--line)"}`,
                  background: pol === on ? "var(--surface-2)" : "transparent",
                  color: pol === on ? "var(--ink)" : "var(--ink-2)",
                }}>{label}</button>
            ))}
          </div>
        </div>

        {/* ONE BUTTON. There is no "Skip for now" under it any more, and no
            count in it: what used to read "Save 3 of 7" was a progress bar
            for a form, and this screen is a question. Disabled is drawn as
            opacity rather than as a grey fill, so the button people are
            filling the four fields FOR stays visibly the same object. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <button className="press" onClick={() => void finish()} disabled={busy || !ready}
            aria-busy={busy} style={{
              ...sans, border: "none", borderRadius: 14, minHeight: 50, padding: "0 16px",
              cursor: ready && !busy ? "pointer" : "default", fontWeight: 800, fontSize: 15.5,
              letterSpacing: "-0.01em", WebkitAppearance: "none",
              background: "var(--ink)", color: "var(--surface)",
              opacity: !ready ? 0.45 : busy ? 0.75 : 1,
            }}>
            {primary}
          </button>
          {/* WHY IT IS NOT READY, in one line, instead of four asterisks
              and a legend. Nothing on the screen is marked wrong for being
              empty — the only red here is a handle somebody else holds. */}
          {!ready && (
            <p style={{
              ...sans, margin: 0, textAlign: "center", fontSize: 12.5, fontWeight: 600,
              lineHeight: 1.4, color: "var(--ink-3)",
            }}>
              Fill in the four above to continue.
            </p>
          )}
          {/* The only skip left on this screen, and it skips ONE FIELD
              rather than the sheet: a handle that is taken is the one
              failure a person cannot fix by trying harder, and everything
              else is already saved by the time they read it. */}
          {hErr && (
            <button className="press" onClick={() => { setHandle(""); setHErr(null); void finish(true); }}
              disabled={busy} style={{
                ...sans, alignSelf: "center", minHeight: 44, padding: "0 14px", border: "none",
                background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
                color: "var(--ink-2)", WebkitAppearance: "none",
              }}>
              Skip the handle for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveProfileSetup;
