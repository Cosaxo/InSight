/* eslint-disable */
// live-privacy.jsx — the account & privacy panel (Phase 5), shown at the
// top of the profile's General tab in live mode. Everything it says is
// enforced by rules/functions, not just promised: answers owner-only,
// k-floored world counts, next-day named reveals, callable-only groups.
import React from 'react';

const LP_LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';

function LpRow({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: LP_LINE }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{title}</div>
        {sub && <div style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function LivePrivacyPanel() {
  const [, tick] = React.useState(0);
  React.useEffect(() => window.LIVE ? window.LIVE.subscribe(() => tick((t) => t + 1)) : undefined, []);
  const [name, setName] = React.useState(() => {
    try { return localStorage.getItem('insight.displayName.v1') || ''; } catch (e) { return ''; }
  });
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [linked, setLinked] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const L = window.LIVE;
  if (!L || !L.enabled) return null;

  const saveName = async () => {
    const n = name.trim().slice(0, 60);
    if (!n) return;
    setBusy(true); setErr(null);
    try {
      await L.saveDisplayName(n);
      try { localStorage.setItem('insight.displayName.v1', n); } catch (e) {}
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } catch (e) { setErr(String((e && e.message) || e)); }
    setBusy(false);
  };
  const link = async () => {
    setBusy(true); setErr(null);
    try { await L.linkGoogle(); setLinked(true); } catch (e) { setErr(String((e && e.message) || e)); }
    setBusy(false);
  };
  const nuke = async () => {
    setBusy(true); setErr(null);
    try { await L.deleteAccount(); location.reload(); }
    catch (e) { setErr(String((e && e.message) || e)); setBusy(false); }
  };
  const btn = (label, onClick, danger) => (
    <button className="press" onClick={onClick} disabled={busy}
      style={{ border: LP_LINE, borderRadius: 999, cursor: 'pointer', padding: '8px 15px',
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, WebkitAppearance: 'none',
        background: danger ? 'oklch(0.55 0.19 25)' : 'var(--surface-2)',
        color: danger ? '#fff' : 'var(--ink)', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap' }}>{label}</button>
  );

  return (
    <div className="card" style={{ marginBottom: 14, padding: '14px 16px' }}>
      <div className="kicker" style={{ marginBottom: 4 }}>Account &amp; privacy</div>

      <LpRow title="Your name" sub="What group and 1v1 partners see in reveals.">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name"
            style={{ border: LP_LINE, borderRadius: 9, padding: '8px 11px', width: 120,
              fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              background: 'var(--surface-2)', outline: 'none' }} />
          {btn(saved ? 'Saved ✓' : 'Save', saveName)}
        </div>
      </LpRow>

      <LpRow title="Sign-in"
        sub={linked ? 'Linked — your history now survives any device.' : "You're on an anonymous session. Link Google so your history survives a lost phone — same account, nothing moves."}>
        {btn(linked ? 'Linked ✓' : 'Link Google', link)}
      </LpRow>

      <div style={{ padding: '11px 0', borderBottom: LP_LINE }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>What leaves your device</div>
        <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.65 }}>
          <li>Your answers are readable by you alone — enforced server-side.</li>
          <li>World stats show only combined counts, and only once ≥5 people answered.</li>
          <li>Group &amp; 1v1 answers stay sealed until the next day's reveal, then show with names — to members only.</li>
          <li>No location is collected. No contacts. No comments from strangers.</li>
        </ul>
      </div>

      <LpRow title="Delete everything"
        sub={confirmDel ? 'This wipes your profile, answers, and auth account. There is no undo.' : 'Your account, answers, and group memberships.'}>
        {confirmDel ? (
          <div style={{ display: 'flex', gap: 6 }}>
            {btn('Cancel', () => setConfirmDel(false))}
            {btn('Yes, delete', nuke, true)}
          </div>
        ) : btn('Delete…', () => setConfirmDel(true))}
      </LpRow>

      {err && <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.5 0.19 25)', marginTop: 8 }}>{err.replace(/^.*?: */, '')}</div>}
    </div>
  );
}

;globalThis.LivePrivacyPanel = typeof LivePrivacyPanel === 'undefined' ? globalThis.LivePrivacyPanel : LivePrivacyPanel;
