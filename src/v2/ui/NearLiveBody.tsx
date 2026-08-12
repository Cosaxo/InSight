// NearLiveBody — the Mirror's Near stop in live mode: the Right-now
// radius counter (D84), and nothing else (D111).
//
// Near used to be "your city" (D9): this counter sitting above the city
// cohort's answer rows. D111 un-folded that. City is its own stop again —
// the cohort, its constellation, its lenses — because the two stops
// answer different questions: City is "everyone who picked this place",
// keyed to a profile anchor; Near is "who is around me right now", keyed
// to a phone's presence. One stop per cohort, in both directions.
//
// What Near will NOT become is a list. The presence cell is one of the
// three denies D98 deliberately kept (physical safety — it records where
// a phone is STANDING, not what its owner answered), so a count is the
// only thing the server returns and the only thing this stop will ever
// draw. That is not the privacy reflex D98 retired: kindred strangers,
// scores and answers all live one stop over, named and default-on.
import React from "react";
import LIVE from "../data/live";

const NB_LINE = "1px solid var(--rule)";

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

  const on = near.on();
  const n = near.count();
  const line = !on
    ? null
    : near.tooFew()
      ? "A few people are around you right now."
      : n == null
        ? "Counting…"
        : n === 0
          ? "Just you right now — the count updates every few minutes."
          : `${n} ${n === 1 ? "person" : "people"} with InSight within a couple of kilometres right now.`;

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
      {err && <div role="status" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{err}</div>}
    </div>
  );
}

function NearLiveBody() {
  const supported = LIVE.near.supported();
  return (
    <div className="fade-in" style={{ padding: "4px 16px 26px" }}>
      <div style={{ padding: "10px 0 4px" }}>
        <div className="kicker">Around you</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 25, letterSpacing: "-0.01em", color: "var(--ink)", marginTop: 2 }}>
          Right now
        </div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
          How many people with InSight are near you at this moment — a live
          count, not a place.
        </div>
      </div>
      <NearNowCard />
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px 0" }}>
        {supported
          ? <>Looking for your city&rsquo;s answers and the people most like you
            there? That&rsquo;s the <strong style={{ color: "var(--ink-2)" }}>City</strong> stop,
            one to the right.</>
          : <>This device can&rsquo;t share a location, so there is no count to
            show here. Your city&rsquo;s answers and the people most like you
            there live at the <strong style={{ color: "var(--ink-2)" }}>City</strong> stop.</>}
      </div>
    </div>
  );
}

export default NearLiveBody;
