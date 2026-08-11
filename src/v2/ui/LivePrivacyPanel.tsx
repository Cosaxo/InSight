// LivePrivacyPanel — the account & data panel (Phase 5), shown at the
// top of the profile's General tab in live mode.
//
// Its job did not change at D98, but every sentence in it did. This
// panel exists so that what the app SAYS about who can see what matches
// what firestore.rules actually does. That used to mean explaining a
// set of protections; it now means stating plainly that answers are
// public and attributable, which is a thing a user must be told clearly
// rather than left to discover. A panel that still promised owner-only
// answers would be the exact UI-says-it, server-doesn't failure this
// product defines itself against — just pointed the other way.
//
// Born in this repo (not ported from the design prototype), so it
// lives here as typed TSX. A globalThis assignment at the bottom
// keeps the spec layer's render-time lookup working unchanged.
import React from "react";
import LIVE from "../data/live";
// The hosted origin for the legal pages. Lives in data/links.ts now so
// invites and legal links share one constant — a domain change stays a
// single edit (D3).
import { SITE_ORIGIN as LP_SITE } from "../data/links";
import { setTelemetryEnabled, telemetryEnabled } from "../../lib/sentry";

const LP_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

function LpRow({ title, sub, children }: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: LP_LINE }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{title}</div>
        {sub && <div style={{ fontWeight: 500, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function LivePrivacyPanel() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const [name, setName] = React.useState(() => {
    try { return localStorage.getItem("insight.displayName.v1") || ""; } catch { return ""; }
  });
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  // Derived from auth via the store, not local state seeded to false: the
  // panel is remounted on every subtab change (profile-overlay.jsx keys on
  // it), so a Google-linked user was told they were anonymous and offered a
  // link that then failed with auth/provider-already-linked.
  const [linkedNow, setLinkedNow] = React.useState(false);
  const linked = LIVE.linked || linkedNow;
  const [telemetry, setTelemetry] = React.useState(telemetryEnabled);
  const [err, setErr] = React.useState<string | null>(null);
  if (!LIVE.enabled) return null;

  const saveName = async () => {
    const n = name.trim().slice(0, 60);
    if (!n) return;
    setBusy(true); setErr(null);
    try {
      await LIVE.saveDisplayName(n);
      try { localStorage.setItem("insight.displayName.v1", n); } catch { /* best-effort */ }
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } catch (e) { setErr(String((e instanceof Error && e.message) || e)); }
    setBusy(false);
  };
  const link = async () => {
    setBusy(true); setErr(null);
    try { await LIVE.linkGoogle(); setLinkedNow(true); } catch (e) { setErr(String((e instanceof Error && e.message) || e)); }
    setBusy(false);
  };
  const nuke = async () => {
    setBusy(true); setErr(null);
    try { await LIVE.deleteAccount(); location.reload(); }
    catch (e) { setErr(String((e instanceof Error && e.message) || e)); setBusy(false); }
  };
  const toggleTelemetry = () => {
    const next = !telemetry;
    setTelemetryEnabled(next);
    setTelemetry(next);
  };
  const btn = (label: string, onClick: () => void, danger?: boolean) => (
    <button className="press" onClick={onClick} disabled={busy}
      style={{ border: LP_LINE, borderRadius: 999, cursor: "pointer", padding: "8px 15px",
        fontFamily: "var(--sans)", fontWeight: 800, fontSize: 12.5, WebkitAppearance: "none",
        background: danger ? "oklch(0.55 0.19 25)" : "var(--surface-2)",
        color: danger ? "#fff" : "var(--ink)", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}>{label}</button>
  );

  return (
    <div className="card" style={{ marginBottom: 14, padding: "14px 16px" }}>
      <div className="kicker" style={{ marginBottom: 4 }}>Account &amp; privacy</div>

      <LpRow title="Your name" sub="What group and 1v1 partners see in reveals.">
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name"
            style={{ border: LP_LINE, borderRadius: 9, padding: "8px 11px", width: 120,
              fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)",
              background: "var(--surface-2)", outline: "none" }} />
          {btn(saved ? "Saved ✓" : "Save", saveName)}
        </div>
      </LpRow>

      <LpRow title="Sign-in"
        sub={linked
          ? "Linked — your history now survives any device."
          // Since D6 turned Android system backup off (it would have copied
          // the local cache to Google Drive), linking is now the ONLY way an
          // anonymous session survives a phone swap. Say so plainly rather
          // than letting someone find out by losing everything.
          : "You're on an anonymous session — it lives only on this phone. Link Google so your history survives a lost or replaced device; same account, nothing moves."}>
        {btn(linked ? "Linked ✓" : "Link Google", link)}
      </LpRow>

      <LpRow title="Crash reports"
        sub={telemetry
          ? "On (default) — anonymous crash and error reports (uid only, never your answers) help fix bugs. Turn off any time."
          : "Off — this app sends no reports. Turn on to send anonymous crash reports (uid only, never your answers)."}>
        {btn(telemetry ? "On ✓" : "Off", toggleTelemetry)}
      </LpRow>

      <div style={{ padding: "11px 0", borderBottom: LP_LINE }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>What leaves your device</div>
        <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.65 }}>
          {/* The first bullet, and deliberately the bluntest sentence in
              the app. D98 made answers public; a user learning that from
              a stranger quoting their vote back at them would be the
              worst possible way to find out. */}
          <li><strong>Your answers are public.</strong> Anyone using InSight can see what you
          answered, under your display name, along with the age band, gender, city, country,
          education and relationship status you have filled in. That is what the app is for —
          it is how you see who answers like you — but it means nothing you answer here is
          private. Answer accordingly.</li>
          <li>That includes the political, personal and sensitive questions. There is no
          category of question that is held back, and no group size too small to show: counts
          are exact from the very first answer, so in a small cohort a count of 1 is visibly
          one person&apos;s answer.</li>
          <li>Your display name is shown with your answers. Leave it blank to appear
          as &ldquo;Someone&rdquo; — that hides the name, not the answers.</li>
          <li>Group &amp; 1v1 answers stay sealed until the next day&apos;s reveal — that is the
          game, not a privacy promise. Once revealed they read like every other answer.</li>
          {/* This line has been rewritten twice, and the second time the
              GUARANTEE changed rather than the wording. "No device
              location, ever" was true until D9 added the optional
              "Use my location" button. What survives is the part that
              actually matters and is still enforced by construction: the
              fix is resolved to a city in src/v2/data/locate.ts and the
              coordinate is discarded there — it is never returned to a
              caller, stored, or transmitted. Claiming "no location" now
              would be false, so it does not. */}
          <li>Location is optional and off until you ask for it. If you tap &ldquo;use my location&rdquo;, your phone works out the nearest city <em>on the device</em> and sends only that name — never your coordinates, which are never stored or transmitted. You can skip it and pick your city from a list instead, and your country follows from the city either way.</li>
          {/* D84. The presence cell is the second location-shaped thing the
              app can hold, and this bullet is its disclosure: what is shared
              (a ~1 km grid square, computed on the device, the coordinate
              discarded), who can read it (no user — the server answers only
              with a count), when (foreground, opted in), and the way out
              (off deletes the doc; deleting the account does too). If the
              mechanics change, this sentence changes in the same commit. */}
          <li>&ldquo;Right now, around you&rdquo; (the Near counter) is optional and off by default. While it&rsquo;s on and the app is open, your phone shares a kilometre-sized grid square — worked out on the device, your coordinates discarded — so the server can answer <em>how many</em> people are around you. No other user can ever read your square; a count is all that comes back. It goes stale within minutes when you close the app, and turning it off (or deleting your account) deletes it immediately.</li>
          <li>No IP-based location lookup, no background or continuous location, no location history.</li>
          <li>No contacts. No comments from strangers. No ads, no tracking, no third-party analytics.</li>
        </ul>
        {/* Until now these pages shipped inside the bundle and were linked
            from nowhere — reachable only by knowing the filename. Both
            stores also require the policy to be reachable on the open web,
            so it is served from Firebase Hosting and linked here rather
            than opened from the bundle: one canonical copy, and the link
            keeps working when someone pastes it outside the app. */}
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600 }}>
          <a href={`${LP_SITE}/privacy.html`} target="_blank" rel="noreferrer noopener"
            style={{ color: "var(--accent)", textDecoration: "none" }}>Privacy policy</a>
          <span style={{ color: "var(--ink-3)", padding: "0 7px" }}>·</span>
          <a href={`${LP_SITE}/terms.html`} target="_blank" rel="noreferrer noopener"
            style={{ color: "var(--accent)", textDecoration: "none" }}>Terms</a>
        </div>
      </div>

      <LpRow title="Delete everything"
        sub={confirmDel ? "This wipes your profile, answers, and auth account. There is no undo." : "Your account, answers, and group memberships."}>
        {confirmDel ? (
          <div style={{ display: "flex", gap: 6 }}>
            {btn("Cancel", () => setConfirmDel(false))}
            {btn("Yes, delete", nuke, true)}
          </div>
        ) : btn("Delete…", () => setConfirmDel(true))}
      </LpRow>

      {err && <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.5 0.19 25)", marginTop: 8 }}>{err.replace(/^.*?: */, "")}</div>}
    </div>
  );
}

// Render-time lookup bridge for the spec layer (profile-overlay.jsx).
Object.assign(globalThis, { LivePrivacyPanel });

export default LivePrivacyPanel;
