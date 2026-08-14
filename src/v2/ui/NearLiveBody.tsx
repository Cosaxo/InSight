// NearLiveBody — the Mirror's Near stop in live mode: the Right-now
// radius counter (D84), and since D145 the constellation around it.
//
// Near used to be "your city" (D9): this counter sitting above the city
// cohort's answer rows. D111 un-folded that. City is its own stop again —
// the cohort, its constellation, its lenses — because the two stops
// answer different questions: City is "everyone who picked this place",
// keyed to a profile anchor; Near is "who is around me right now", keyed
// to a phone's presence. One stop per cohort, in both directions.
//
// WHAT THIS FILE USED TO SAY, AND WHY IT WAS HALF RIGHT (D145).
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

// ── the Right now card (D84) ─────────────────────────────────────────
//
// Moved verbatim from LiveCohortBody when D111 split the stops — Near owns
// it now. How many opted-in phones are foreground within your ~1 km cell
// and its eight neighbors, right now. Off by default; the enable tap is
// what carries the OS permission prompt (D9's rule). The count is the only
// thing the server returns — presence docs are unreadable — and the copy
// claims kilometres, not the 500 m the coarse permission cannot measure
// (D84 records the Precise flip as its own decision).
function NearNowCard() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const [busy, setBusy] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const near = LIVE.near;
  if (!near.supported()) return null;

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

  const on = near.on();
  const n = near.count();
  // Only read while on: stopPresence() clears both, so off means these would
  // be last session's.
  const stall = on ? near.lastError() : null;
  const at = on ? near.updatedAt() : 0;
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
        : n === 0
          ? "Just you right now — the count updates every few minutes."
          : `${n} ${n === 1 ? "person" : "people"} with InSight within a couple of kilometres right now.`;
  // A count on screen with a failed beat behind it is stale, not wrong —
  // and the difference is entirely in whether the card says when.
  const staleNote = !stall
    ? null
    : (STALL[stall] || STALL.unavailable) + (n != null && at ? ` Showing the count from ${ago(Date.now() - at)}.` : "");

  return (
    <div style={{ border: NB_LINE, borderRadius: 14, background: "var(--surface-2)", padding: "13px 14px", margin: "10px 0 4px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="kicker" style={{ marginBottom: 0, flex: 1 }}>Right now, around you</span>
        <button className="press" disabled={busy}
          onClick={() => { if (on) void near.disable(); else void turnOn(); }}
          style={{ border: on ? NB_LINE : "none", borderRadius: 999, padding: "6px 13px", cursor: busy ? "default" : "pointer",
            fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12, WebkitAppearance: "none", opacity: busy ? 0.6 : 1,
            background: on ? "transparent" : "var(--accent, var(--ink))", color: on ? "var(--ink-2)" : "var(--surface)" }}>
          {busy ? "…" : on ? "Turn off" : "Turn on"}
        </button>
      </div>
      {on ? (
        <div style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.45 }}>{line}</div>
      ) : (
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.5 }}>
          See how many people with InSight are around you — a count, never
          who. While it&rsquo;s on and the app is open, your phone shares only a
          kilometre-sized grid square, unreadable to other users; it&rsquo;s
          deleted the moment you turn this off.
        </div>
      )}
      {/* The beat's own failure, and the way out of it. Before this the card
          read LIVE.near.lastError() nowhere at all, so every failure after
          the opt-in — a revoked permission, an indoor fix that timed out,
          a callable that threw — rendered as "Counting…" until the app was
          restarted. role=status so the sentence is announced when it
          replaces a count that was there a moment ago. */}
      {on && !near.tooFew() && (staleNote || n == null) && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 9 }}>
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
      {err && <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{err}</div>}
    </div>
  );
}

// The stop's headline, the prototype's shape: kicker, one big figure, one
// line of unit under it (D145).
//
// The figure is the presence count and the unit says so, in the same
// breath as the place — "within a couple of kilometres · Grünerløkka" is
// two facts about one number rather than a caption spanning the count and
// the field below it. With the counter off there is no figure to print, so
// the line invites rather than pretending to a zero.
function NearHeader() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const near = LIVE.near;
  const on = near.on();
  const n = on ? near.count() : null;
  const city = LIVE.myCity;
  // The city NAME, never the "Oslo, NO" key — this is a sentence, not a
  // bucket. Parsed through the catalogue like every other place label.
  const place = city ? PLACES.parse(city) : null;
  const where = place ? place.name : city;

  return (
    <div style={{ padding: "10px 0 2px" }}>
      <div className="kicker">Around you</div>
      {on && n != null ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 1 }}>
            <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 34, letterSpacing: "-0.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {n.toLocaleString()}
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.4 }}>
              within a couple of kilometres{where ? ` · ${where}` : ""}
            </span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>
            People with InSight open near you right now — a count, never who.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>
            Right now
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
            How many people with InSight are near you at this moment — a live
            count, not a place.
          </div>
        </>
      )}
    </div>
  );
}

function NearLiveBody() {
  const supported = LIVE.near.supported();
  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px" }}>
      <NearHeader />
      {/* The field is the stop, and the counter is the control above it.
          In that order because the constellation is what Near is FOR — a
          card with a toggle on it is the permission, not the reading. */}
      <React.Suspense fallback={null}>
        <NearField />
      </React.Suspense>
      <NearNowCard />
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px 0" }}>
        {supported
          ? <>Want their names, their answers and the rest of the city?
            That&rsquo;s the <strong style={{ color: "var(--ink-2)" }}>City</strong> stop,
            one to the right — here nobody is named.</>
          : <>This device can&rsquo;t share a location, so there is no count to
            show here. Your city&rsquo;s answers and the people most like you
            there live at the <strong style={{ color: "var(--ink-2)" }}>City</strong> stop.</>}
      </div>
    </div>
  );
}

export default NearLiveBody;
