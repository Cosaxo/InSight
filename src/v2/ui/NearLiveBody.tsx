// NearLiveBody — the Mirror's Near stop in live mode: the Right-now
// radius counter (D84), and since D150 the constellation around it.
//
// Near used to be "your city" (D9): this counter sitting above the city
// cohort's answer rows. D111 un-folded that. City is its own stop again —
// the cohort, its constellation, its lenses — because the two stops
// answer different questions: City is "everyone who picked this place",
// keyed to a profile anchor; Near is "who is around me right now", keyed
// to a phone's presence. One stop per cohort, in both directions.
//
// WHAT THIS FILE USED TO SAY, AND WHY IT WAS HALF RIGHT (D150).
//
// It said Near would never be more than a count: the presence cell is one
// of the three denies D98 deliberately kept (physical safety — it records
// where a phone is STANDING, not what its owner answered), so a count is
// all the server returns. Every word of that is still true, and it was
// still the wrong conclusion, because it answered a question about the
// presence cell with a decision about the whole screen. Near asks "who is
// around me". The app knows something true about that and was already
// drawing it one stop over — the people of your city, ranked by how close
// their scores sit to yours — and the refusal was of a claim nobody had
// to make.
//
// So the stop is a field again, the way it always was in the prototype:
// the count at the top, a crowd around you, distance = unlikeness. The
// one difference from every other field in the Mirror is that NOBODY IS
// NAMED and no node can be opened. That is not decoration; it is the
// deny, drawn. And the two numbers stay attached to what they count — the
// figure is phones near you right now, the ring is people in your city —
// because one caption covering both is how a screen starts claiming it
// knows who is standing next to you.
import React from "react";
import LIVE from "../data/live";
import PLACES from "../data/places";

// Lazy, like LiveCohortBody's own field: mirror-tab imports THIS module
// eagerly (it is the Near body), and a static import would drag the
// similarity fold and its instrument definitions into the entry chunk for
// a stop most sessions never open.
const NearField = React.lazy(() =>
  import("./LiveSimilarityField").then((m) => ({ default: m.NearField })),
);

const NB_LINE = "1px solid var(--rule)";

// Why the count is missing or old AFTER the switch is already on.
//
// Deliberately a SECOND map beside FAIL below, not a reuse of it: FAIL
// answers "the opt-in didn't take" and is read at the moment of the tap;
// this answers "it's on and there is still no number", which is a state
// the card had no words for at all. Every beat that failed set
// LIVE.near.lastError() and nothing ever read it, so the card said
// "Counting…" forever — which is exactly how it was reported from a
// device: Near never connects.
//
// Same vocabulary as locate.ts's LocateFail, plus "unavailable" for a beat
// that got its fix and then failed at the write or the callable.
const STALL: Record<string, string> = {
  denied: "Location is switched off for InSight now, so the count has stopped.",
  unavailable: "Couldn’t reach the count just now.",
  timeout: "That location fix took too long — indoors it often does.",
  unsupported: "This device can’t share a location.",
};

// How old, in the roughest terms that are still true. A count four minutes
// old is the normal case (the beat interval), not a fault — so this only
// appears next to a beat that FAILED, where the age is the thing the reader
// actually needs.
function ago(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "moments ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h === 1 ? "an hour ago" : `${h} hours ago`;
}

// ── the switch, top right (D160) ─────────────────────────────────────
//
// Near's on/off used to be a "Turn on" BUTTON inside a bordered card that
// also carried the count, the disclosure, the stall note and the retry —
// five things in one box, of which exactly one was a control. The box was
// the loudest object on a stop whose subject is the constellation under
// it, and it read as a feature to be configured rather than a stop to be
// looked at.
//
// It is a switch in the header's right corner now, and everything else
// stays: the count was already the header's figure, the disclosure became a
// line under it, and the stall note kept its retry. Nothing about what is
// shared changed — the disclosure in NearPresence below is word for word
// the one the card carried, which is the point.
function NearSwitch({ on, busy, onToggle }: {
  on: boolean; busy: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={busy}
      aria-label="Share a rough location to count people near you"
      className="press" onClick={onToggle}
      style={{
        width: 46, height: 27, flexShrink: 0, padding: 2, borderRadius: 999,
        border: on ? "none" : NB_LINE, cursor: busy ? "default" : "pointer",
        background: on ? "var(--accent, var(--ink))" : "var(--surface-3)",
        opacity: busy ? 0.6 : 1, WebkitAppearance: "none",
        display: "flex", alignItems: "center",
        transition: "background .18s ease",
      }}>
      <span aria-hidden="true" style={{
        width: 21, height: 21, borderRadius: "50%", background: "var(--surface)",
        boxShadow: "0 1px 3px -1px rgba(20,20,40,0.35)",
        transform: on ? "translateX(19px)" : "translateX(0)",
        transition: "transform .18s var(--ease-spring, ease)",
      }} />
    </button>
  );
}

/**
 * The third state, as a chip rather than a third position on the switch
 * (D173).
 *
 * The control has three meanings — off, visible for a while, visible with
 * no deadline — and a three-position slider in a header corner is a lot of
 * furniture for a choice most people make once. So the switch keeps
 * on/off, which is what a switch is for, and the chip beside it carries
 * the one remaining question: does this end by itself?
 *
 * Turning it on lands on the TIMED state, because the default is the real
 * decision — the other two are for people who mean them, and forgetting is
 * the failure mode worth designing against.
 *
 * The remaining time is coarse ("1h", "20m"), like every other reading on
 * this stop. The beat is four minutes, so a live countdown would be stale
 * between ticks and precise-looking anyway.
 */
function nbLeft(ms: number): string {
  if (ms <= 0) return "0m";
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.round(m / 60)}h` : `${Math.max(5, Math.round(m / 5) * 5)}m`;
}

function NearModeChip({ mode, left, onPick }: {
  mode: "session" | "always";
  /**
   * Milliseconds until the session ends, or null before the parent has
   * sampled a clock. Passed in rather than derived from a deadline here:
   * calling Date.now() during render is impure, and the parent already
   * re-renders on every beat, which is the rate this label needs.
   */
  left: number | null;
  onPick: (m: "session" | "always") => void;
}) {
  const timed = mode === "session";
  return (
    <button type="button" className="press"
      aria-label={timed
        ? (left == null
          ? "Visible for a limited time — tap to stay visible with no deadline"
          : `Visible for ${nbLeft(left)} more — tap to stay visible with no deadline`)
        : "Visible with no deadline — tap to set a two-hour limit"}
      onClick={() => onPick(timed ? "always" : "session")}
      style={{
        flexShrink: 0, border: NB_LINE, borderRadius: 999, padding: "4px 11px",
        background: "var(--surface-2)", color: "var(--ink-2)", cursor: "pointer",
        fontFamily: "var(--sans)", fontWeight: 700, fontSize: 11.5, WebkitAppearance: "none",
      }}>
      {timed ? (left == null ? "timed" : nbLeft(left)) : "always"}
    </button>
  );
}

// ── the Right now card (D84) ─────────────────────────────────────────
//
// Moved verbatim from LiveCohortBody when D111 split the stops — Near owns
// it now. How many opted-in phones have an unexpired position within your
// ~200 m cell and its eight neighbors. Off by default; the enable tap is
// what carries the OS permission prompt (D9's rule). Presence docs are
// unreadable, so what the server returns is a count and (D175) a coarse
// mix of archetype names — never a row per person.
//
// The copy said "a couple of kilometres" from D84 until D174, and that was
// honest for as long as it was true: the app requested COARSE location, a
// kilometre-wide fix cannot measure a 500 m radius, and D84 refused to
// print a number the sensor could not support. D174 asked the owner for
// the Precise permission instead of quietly narrowing the wording, so the
// grid went 0.01° → 0.002° and the unit followed it down to "a few hundred
// metres". Both halves had to move together; a finer grid under the old
// copy would have been the same lie pointed the other way.
//
// D160 dissolved the card. What survives is this component's STATE — the
// enable/disable call, its failure vocabulary, the stall detection and the
// retry — rendered as rows under the header instead of inside a box, with
// the switch itself hoisted into the header. The privacy copy is unchanged
// and unconditional: it is what you are agreeing to, and a control small
// enough to flick past is a reason to keep the sentence, not to drop it.
/** "Hosts and Explorers", "Hosts, Explorers and Planners" — never a list
 * with a share beside each name. */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function NearPresence() {
  const [, tick] = React.useState(0);
  // `now` IS STATE, and it has to be: the session chip counts down from a
  // deadline, and reading the clock during render is impure — the React
  // Compiler bails out of any component that does it (react-hooks/purity),
  // which silently costs the memoisation on the whole card. Sampled here
  // instead, on the same notify that already re-renders this component, so
  // there is no second timer: the beat is four minutes and the label is
  // coarse to five, which is why one sample per beat is the right rate
  // rather than a compromise.
  //
  // 0 until the first effect runs, and the chip prints its MODE rather
  // than arithmetic on an unsampled clock — a frame of "timed" beats a
  // frame of "479000h".
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    setNow(Date.now());
    return LIVE.subscribe(() => { tick((t) => t + 1); setNow(Date.now()); });
  }, []);
  const [busy, setBusy] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const near = LIVE.near;
  const supported = near.supported();

  const FAIL: Record<string, string> = {
    denied: "No problem — Near stays off until you allow location.",
    unavailable: "Couldn't get a location fix. Try again outside.",
    timeout: "That took too long — indoors it often does. Try again.",
    unsupported: "This device can't share a location.",
  };

  async function turnOn() {
    setBusy(true); setErr(null);
    const res = await near.enable();
    if (!res.ok) setErr(FAIL[res.reason || "unavailable"] || FAIL.unavailable);
    setBusy(false);
  }

  // One more beat, now. The loop's own interval is four minutes — the right
  // cadence for a working count, and much too long to be the only way out of
  // a failed one.
  async function retry() {
    setRetrying(true);
    try { await near.refresh(); } finally { setRetrying(false); }
  }

  const on = supported && near.on();
  const n = on ? near.count() : null;
  // Only read while on: stopPresence() clears both, so off means these would
  // be last session's.
  const stall = on ? near.lastError() : null;
  const mix = on ? near.mix() : null;
  const at = on ? near.updatedAt() : 0;
  const city = LIVE.myCity;
  // The city NAME, never the "Oslo, NO" key — this is a sentence, not a
  // bucket. Parsed through the catalogue like every other place label.
  const place = city ? PLACES.parse(city) : null;
  const where = place ? place.name : city;

  const line = !on
    ? null
    : near.tooFew()
      ? "A few people are around you right now."
      : n == null
        // Still the honest word while a beat is genuinely in flight. What
        // changed is that it is no longer the ONLY word: a failed beat now
        // says so underneath instead of leaving this sentence standing for
        // the rest of the session.
        ? (stall ? "No count yet." : "Counting…")
        : null;
  // A count on screen with a failed beat behind it is stale, not wrong —
  // and the difference is entirely in whether the card says when.
  const staleNote = !stall
    ? null
    : (STALL[stall] || STALL.unavailable) + (n != null && at ? ` Showing the count from ${ago(Date.now() - at)}.` : "");

  return (
    <div style={{ padding: "10px 0 2px" }}>
      {/* The kicker and the switch on one line — the switch is the corner
          control D160 asked for, and putting it beside the stop's own name
          is what makes it read as "Near: on" rather than as a feature card
          bolted above the constellation. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="kicker" style={{ marginBottom: 0, flex: 1 }}>Around you</div>
        {supported && on && near.mode() !== "off" && (
          <NearModeChip mode={near.mode() as "session" | "always"}
            left={now ? Math.max(0, near.until() - now) : null}
            onPick={(m) => { void near.enable(m); }} />
        )}
        {supported && (
          <NearSwitch on={on} busy={busy}
            onToggle={() => { if (on) void near.disable(); else void turnOn(); }} />
        )}
      </div>

      {/* The figure, when there is one. The prototype's shape: kicker, one
          big number, one line of unit under it — and the unit says WHAT the
          number counts in the same breath as the place, because "within a
          few hundred metres · Grünerløkka" is two facts about one number
          rather than a caption spanning the count and the field below it.
          With the counter off there is no figure to print, so the stop
          keeps its name and invites rather than pretending to a zero.

          THE UNIT IS THE 3x3, NOT THE CELL, and it moved at D174: the grid
          went 0.01° to 0.002°, so the nine cells span ~600 m rather than
          ~3.3 km and "a couple of kilometres" became an overstatement the
          same commit that made the fix precise. A count whose stated reach
          is five times its real one is the same failure as a fabricated
          number, arriving as a unit instead of a value. */}
      {on && n != null && !near.tooFew() ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 1 }}>
            <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 34, letterSpacing: "-0.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {n.toLocaleString()}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.4 }}>
              within a few hundred metres{where ? ` · ${where}` : ""}
            </span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>
            {n === 0
              ? "Just you right now — the count updates every few minutes."
              : "People with InSight open near you right now — a count, never who."}
          </div>
          {/* THE ROOM (D175) — the one sentence this stop was rebuilt for.
              Names in order and a basis; no shares, because a percentage
              moves visibly when one person walks in and that is the whole
              differencing attack. `mix.n` rather than the count above it:
              plenty of people nearby have never taken the test, and a
              reading must not borrow a population it did not measure.

              And "60+" when the server's sample hit its cap, because past
              it `n` is a floor on the typed crowd rather than its size.
              D102 made the same repair to the who-voted sheet ("the latest
              200 of N"): a truncation is fine, a truncation printed as the
              whole room is not. */}
          {mix && (
            <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginTop: 7, lineHeight: 1.5 }}>
              Mostly <strong style={{ color: "var(--ink)" }}>{listNames(mix.top)}</strong>
              {" "}· {mix.n}{mix.capped ? "+" : ""}{" "}
              {mix.n === 1 && !mix.capped ? "person" : "people"} here have taken the test
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>
            Right now
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
            {/* "a count, never who" survives the card verbatim, and that is
                deliberate: it is the PROMISE, and the off state is the only
                moment it can be read before the decision it describes. */}
            {line || (supported
              ? "How many people with InSight are near you at this moment — a count, never who, and never a place."
              : "This device can’t share a location, so there is no count to show here.")}
          </div>
        </>
      )}

      {/* THE DISCLOSURE, and it is not shortened because the control got
          smaller (D9: the enable tap is what carries the OS prompt, and
          this is the sentence that tap is agreeing to). Shown while OFF —
          before the decision, which is the only moment it can inform one. */}
      {supported && !on && (
        <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: NB_LINE }}>
          While it&rsquo;s on, your phone shares a ~200-metre grid square,
          unreadable to other users. It keeps counting for up to three hours
          after you close the app, and turning this off deletes it at once.
        </div>
      )}

      {/* The beat's own failure, and the way out of it. Before D150 the card
          read LIVE.near.lastError() nowhere at all, so every failure after
          the opt-in — a revoked permission, an indoor fix that timed out,
          a callable that threw — rendered as "Counting…" until the app was
          restarted. role=status so the sentence is announced when it
          replaces a count that was there a moment ago. */}
      {on && !near.tooFew() && (staleNote || n == null) && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8 }}>
          <span style={{ flex: 1, fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
            {staleNote || "This can take a moment on the first fix."}
          </span>
          <button className="press" disabled={retrying} onClick={() => void retry()}
            style={{ border: NB_LINE, borderRadius: 999, padding: "5px 12px", flexShrink: 0,
              cursor: retrying ? "default" : "pointer", fontFamily: "var(--sans)", fontWeight: 700,
              fontSize: 11.5, WebkitAppearance: "none", opacity: retrying ? 0.6 : 1,
              background: "transparent", color: "var(--ink-2)" }}>
            {retrying ? "Trying…" : "Try again"}
          </button>
        </div>
      )}
      {err && <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function NearLiveBody() {
  const supported = LIVE.near.supported();
  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px" }}>
      {/* One block, not a header and a card (D160): the stop's name, its
          switch in the corner, its figure, and whatever the beat has to say
          — then the field, which is what Near is FOR. */}
      <NearPresence />
      <React.Suspense fallback={null}>
        <NearField />
      </React.Suspense>
      {/* The pointer to City, down from three lines to one (D171).
          The long version explained what City is — which City's own header
          does, one stop to the right, and the ruler above already shows it
          is there. What this owes the reader is the one fact Near's field
          does not carry on its face: nobody here is named. */}
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px 0", textAlign: "center" }}>
        {supported
          ? <>Nobody here is named — that&rsquo;s <strong style={{ color: "var(--ink-2)" }}>City</strong>, one to the right.</>
          : <>No location on this device — your city is at <strong style={{ color: "var(--ink-2)" }}>City</strong>, one to the right.</>}
      </div>
    </div>
  );
}

export default NearLiveBody;
