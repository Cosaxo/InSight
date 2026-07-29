// LivePrivacyPanel — the account & privacy panel (Phase 5), shown at
// the top of the profile's General tab in live mode. Everything it
// says is enforced by rules/functions, not just promised: answers
// owner-only, k-floored world counts, next-day named reveals,
// callable-only groups.
//
// Born in this repo (not ported from the design prototype), so it
// lives here as typed TSX. A globalThis assignment at the bottom
// keeps the spec layer's render-time lookup working unchanged.
import React from "react";
import LIVE from "../data/live";
import { setTelemetryEnabled, telemetryEnabled } from "../../lib/sentry";

const LP_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";
// The hosted origin for the legal pages (firebase.json → hosting). A
// constant rather than an inline string so the day a real domain replaces
// the free .web.app one, there is exactly one place to change — and so it
// is greppable from the deploy config that publishes them.
const LP_SITE = "https://prvfire33.web.app";

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
  const [linked, setLinked] = React.useState(false);
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
    try { await LIVE.linkGoogle(); setLinked(true); } catch (e) { setErr(String((e instanceof Error && e.message) || e)); }
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
          ? "On — anonymous crash and error reports (uid only, never content) help fix bugs. Fully off on next launch if disabled."
          : "Off — nothing is reported. Turn on to send anonymous crash reports (uid only, never your answers)."}>
        {btn(telemetry ? "On ✓" : "Off", toggleTelemetry)}
      </LpRow>

      <div style={{ padding: "11px 0", borderBottom: LP_LINE }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>What leaves your device</div>
        <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", lineHeight: 1.65 }}>
          <li>Your answers are readable by you alone — enforced server-side.</li>
          <li>World stats show only combined counts, and only once ≥5 people answered.</li>
          <li>Group &amp; 1v1 answers stay sealed until the next day&apos;s reveal, then show with names — to members only.</li>
          {/* "No location" used to be unqualified. Since the Basics card
              started collecting a city and country, that reading was
              misleading even though no device location API is touched —
              so the claim now says which is which. */}
          <li>No device location, ever — no GPS, no IP lookup. City and country are only what you type in your profile, and only if you fill them in.</li>
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
