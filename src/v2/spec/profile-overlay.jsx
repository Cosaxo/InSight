// Ported from design/spec-modules/profile-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { Av, useDialog } from './primitives.jsx';
import { ownProgress, ResultProfileCard } from './result-card.jsx';
import { RP_TESTS } from './result-rose.jsx';
// CONVERTED off the shared-global bridge (D39, "convert on touch"): the
// Roles subtab below needs to know whether the build is live, and reading
// it through `window.LIVE` would have taken this file's cross-module count
// UP — which check:globals rule 4 refuses. Converting the three sites that
// were already here takes it DOWN instead, which is the trade the ratchet
// exists to force.
import LIVE from '../data/live.ts';

// The Roles tab (D204), behind a lazy boundary. THIS FILE IS EAGER — it is
// imported by spec-index.js at line ~123 — and check:bundle's MAX_EAGER_KB
// had ~8 KB of headroom when Roles shipped, so a static import here would
// have put two roses, the archetype matcher and the panel itself on first
// paint for a subtab most opens never reach.
const RolesPanelLazy = React.lazy(() => import('../ui/LiveRolesPanel.tsx'));

// InSight — ProfileOverlay (your own profile) + the Politics cards.
// The test flow lives in test-overlay.jsx; question banks in test-defs.js.

function ProfileOverlay({ onClose, me, lensBoxed }) {
  const L = window.LIVE || {};
  const dims = [
    { label: 'Openness', v: me.personality.O },
    { label: 'Conscientiousness', v: me.personality.C },
    { label: 'Extraversion', v: me.personality.E },
    { label: 'Agreeableness', v: me.personality.A },
    { label: 'Sensitivity', v: me.personality.N },
  ];
  const SUBTABS = [
    { id: 'general',    label: 'General' },
    { id: 'big5',       label: 'Big 5' },
    { id: 'politics',   label: 'Politics' },
    { id: 'values',     label: 'Values' },
    { id: 'attachment', label: 'Social' },
    // Roles (D204) — the role you play in a 1v1 and in a group, folded
    // from the duel record. LIVE ONLY, and that is not a stub: it reads
    // reveal documents, and the demo room has none. A tab that could only
    // ever draw its own refusal is worse than no tab, and D167's rule is
    // that a surface ships with real data or does not ship.
    ...(L.enabled ? [{ id: 'roles', label: 'Roles' }] : []),
    // the minor instruments. Last on purpose: the four core tests are the
    // profile, lenses are the footnotes that explain it.
    { id: 'lenses',     label: 'Lenses' },
  ];
  // remember the last-visited subtab, so returning from a tracker lands back on it
  const validSub = (id) => SUBTABS.some(s => s.id === id) ? id : 'general';
  const [sub, setSubRaw] = React.useState(validSub(window.__profileSub));
  const setSub = (id) => { window.__profileSub = id; setSubRaw(id); };
  // keep the active chip fully visible in the scrollable subnav
  React.useEffect(() => {
    const btn = document.querySelector('.profile-subnav .subnav-btn.is-on');
    if (btn && btn.parentElement) {
      const sc = btn.parentElement;
      sc.scrollTo({ left: btn.offsetLeft - (sc.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [sub]);

  const top = [...dims].sort((a, b) => b.v - a.v)[0];

  const labels = {
    Openness: { name: 'The Seeker', tag: 'open, curious, drawn to the new', glyph: '✶' },
    Conscientiousness: { name: 'The Steady', tag: 'ordered, deliberate, finishes what begins', glyph: '◆' },
    Extraversion: { name: 'The Spark', tag: 'energised by people, warm in company', glyph: '☀' },
    Agreeableness: { name: 'The Kind', tag: 'gentle, trusting, slow to judge', glyph: '✿' },
    Sensitivity: { name: 'The Sensitive', tag: 'feels deeply, weather close to the skin', glyph: '☾' },
  };
  const meta = labels[top.label];

  // ── one tab per test — the unified "results profile" card ──
  //
  // WHAT USED TO BE HERE: a "Take this test →" button, shown whenever the
  // test had no stored result. D121 removed it along with the sit-down
  // flow behind it — the instruments fill from the feed and only from the
  // feed — and a tab whose whole content was a button to a screen that no
  // longer exists is worse than the empty one it was covering for.
  //
  // What stands in its place is the same page one step earlier: the
  // instrument's own progress, its axes, and which of them are still too
  // thin to read. Not a nudge — a reading of where the profile has got to,
  // which is the only honest thing to show before there is a type.
  const TestProgress = ({ k }) => {
    const p = ownProgress(k);
    if (!p || p.ready) return null;
    const hue = (RP_TESTS[k] || {}).banner || 'var(--accent)';
    const pct = Math.round((p.answered / Math.max(1, p.total)) * 100);
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: 3, background: `color-mix(in oklch, ${hue} 14%, var(--surface-3))` }}>
          <div style={{ height: '100%', width: `${pct}%`, background: hue }}></div>
        </div>
        <div style={{ padding: '15px 18px 17px' }}>
          <div className="kicker" style={{ color: hue }}>{(RP_TESTS[k] || {}).kicker || 'Filling in'}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'var(--ink)', marginTop: 4, letterSpacing: '-0.01em' }}>
            {p.answered} of {p.total} answered
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 7 }}>
            {/* Says where the answers come from, because there is no longer
                anywhere else they could. */}
            Marked cards in the feed fill this in. There is no sitting down
            for it — answer them when they come.
          </div>
          {/* The axes, and which are still a coin flip. An axis with one
              answer behind it lands on an extreme more often than not, so
              the card refuses a TYPE until every one of them has two —
              and naming them is what makes the refusal legible instead of
              looking like a stall. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            {p.dims.map((d) => (
              <div key={d.dim} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 96, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.round((d.n / Math.max(1, d.items)) * 100)}%`, background: hue, opacity: 0.75 }}></span>
                </span>
                <span style={{ width: 40, textAlign: 'right', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{d.n}/{d.items}</span>
              </div>
            ))}
          </div>
          {!!p.thin.length && (
            <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 12 }}>
              Still thin: {p.thin.join(', ')}. Your type appears once every
              side of this has at least two answers behind it.
            </div>
          )}
        </div>
      </div>
    );
  };

  // CONVERTED off the shared-global bridge (D39, "convert on touch"):
  // adding the fifth panel below would have taken this file's cross-module
  // global count UP, which check:globals rule 4 refuses. ResultProfileCard
  // is a named export of result-card.jsx, which spec-index.js imports
  // eagerly and BEFORE this file, so the import is sound.
  //
  // Every fallback the five panels used to carry is gone with it, and that
  // is the conversion rather than a tidy-up: each one guarded LOAD ORDER
  // ("has result-card.jsx evaluated yet?"), and an imported binding cannot
  // be unset. The AttachmentPanel chain even said so — "unreachable today
  // … written defensively anyway, because load order in this layer is
  // exactly what changes" — and a static import is what stops it changing.
  // No data guard was removed: none of them guarded data. The card still
  // returns null on its own for a test with no result or no RP_TESTS entry.
  const Big5Panel = () => (
    <ResultProfileCard testKey="big5" archetype={meta.name} tagline={meta.tag} />
  );

  const PoliticsPanel = () => (
    <ResultProfileCard testKey="political" archetype={me.politicalIdentity.name} tagline={me.politicalIdentity.tag} />
  );

  const ValuesPanel = () => (
    <ResultProfileCard testKey="values" archetype={me.moralLabel} tagline="beauty and meaning pull hardest" />
  );

  const AttachmentPanel = () => (
    <ResultProfileCard testKey="attachment" archetype="The Constant" tagline="steady and affectionate — the friend who stays" />
  );

  const dlg = useDialog(onClose, 'Your profile');
  return (
    <div className="overlay surface-tint" {...dlg} style={{ '--accent': 'var(--c-people)' }}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">Your <em>profile</em></div>
        <div style={{ width: 32, flexShrink: 0 }} />
      </div>
      <div className="app-body" style={{ paddingTop: 0 }}>
        {/* compact identity row — the content is the star, not the header.
            Tightened 2026-08-12 with the double-inset fix above it: this
            row sat under ~146px of doubled status-bar padding, so its own
            52px avatar and 16px lead were the second half of a profile
            that opened on a third of a screen saying "You". */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          {(() => {
            const live = L.enabled;
            const nm = live ? (L.displayName || 'You') : me.name;
            const init = live
              ? ((nm.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()) || '·')
              : me.initials;
            const sub = live ? 'anonymous session — link Google below to keep it' : (me.location + ' · ' + me.country);
            return (
              <>
                <Av init={init} hue={38} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{nm}</div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
                </div>
              </>
            );
          })()}
        </div>

        {/* sticky sub-tab nav — frosted so content scrolls beneath it */}
        <div className="profile-subnav">
          <div className="subnav subnav--scroll" style={{ maxWidth: '100%' }}>
            {SUBTABS.map(s => (
              <button key={s.id} onClick={() => setSub(s.id)} className={"subnav-btn" + (s.id === sub ? ' is-on' : '')}>{s.label}</button>
            ))}
          </div>
        </div>

        <div key={sub} className="tab-swap" style={{ marginTop: 4 }}>
          {sub === 'general' && L.enabled && window.LivePrivacyPanel && <window.LivePrivacyPanel />}
          {sub === 'general' && <window.GeneralPanel onGo={setSub} />}
          {sub === 'big5' && <><Big5Panel /><TestProgress k="big5" /></>}
          {sub === 'politics' && <><PoliticsPanel /><TestProgress k="political" /></>}
          {sub === 'values' && <><ValuesPanel /><TestProgress k="values" /></>}
          {sub === 'attachment' && <><AttachmentPanel /><TestProgress k="attachment" /></>}
          {sub === 'roles' && (
            <React.Suspense fallback={null}><RolesPanelLazy /></React.Suspense>
          )}
          {sub === 'lenses' && window.LensesPanel && <window.LensesPanel boxed={lensBoxed} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProfileOverlay });

;globalThis.ProfileOverlay = typeof ProfileOverlay === 'undefined' ? globalThis.ProfileOverlay : ProfileOverlay;
