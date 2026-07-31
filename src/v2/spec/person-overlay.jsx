// Ported from design/spec-modules/person-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// Expanded Person profile — a detailed portrait of similarity
// Replaces the basic PersonOverlay registered in overlays.jsx

(function () {

// deterministic 0..1 from any string — their drifted test values must be stable
function poHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 8) % 100000) / 100000;
}

// ─── Deterministic derivation of a person's full profile from p ───
function derivePerson(p, me) {
  const seed = (key) => {
    const s = String(p.id) + ':' + key;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  // 0..1 from a seed
  const r = (key) => (seed(key) % 100000) / 100000;
  // pull toward you, strength based on match
  const pull = Math.max(0, Math.min(1, (p.match - 35) / 65));

  // mix the user's value with deterministic noise; the higher the match, the closer
  const mix = (myVal, key, slack = 90) => {
    const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.7);
    return Math.max(-100, Math.min(100, myVal + drift));
  };
  const mixBig5 = (myVal, key, slack = 55) => {
    const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.6);
    return Math.max(2, Math.min(100, myVal + drift));
  };

  const big5 = {
    O: mixBig5(me.personality.O, 'b5O'),
    C: mixBig5(me.personality.C, 'b5C'),
    E: mixBig5(me.personality.E, 'b5E'),
    A: mixBig5(me.personality.A, 'b5A'),
    N: mixBig5(me.personality.N, 'b5N'),
  };
  const political = {
    econ:    mix(me.political.econ,    'pe'),
    social:  mix(me.political.social,  'ps'),
    foreign: mix(me.political.foreign, 'pf'),
    env:     mix(me.political.env,     'pv'),
    tech:    mix(me.political.tech,    'pt'),
    auth:    mix(me.political.auth,    'pa'),
    estab:   mix(me.political.estab,   'pb'),
  };
  const morals = {
    future:   mix(me.morals.future,   'mf'),
    circle:   mix(me.morals.circle,   'mc'),
    hedonism: mix(me.morals.hedonism, 'mh'),
    meaning:  mix(me.morals.meaning,  'mm'),
    moral:    mix(me.morals.moral,    'mr'),
    beauty:   mix(me.morals.beauty,   'mb'),
  };

  // chronotype + rhythm
  const chronoOpts = ['early bird', 'night owl', 'biphasic'];
  const chronotype = chronoOpts[seed('chrono') % 3];
  const sleepAvg = (6.4 + r('sleep') * 2.2).toFixed(1) + 'h';

  // closest ideology in econ × social
  const ideos = window.IS_DATA.ideologies;
  const closest = ideos.map(io => {
    const dx = io.econ - political.econ, dy = io.social - political.social;
    return { ...io, d: Math.sqrt(dx*dx + dy*dy) };
  }).sort((a,b) => a.d - b.d);

  return { big5, political, morals, chronotype, sleepAvg, closest };
}

// ─── Per-dimension similarity scores (0..100) used in the affinity composer ───
function affinityBreakdown(me, prof, p) {
  // Big5: invert mean absolute distance (0..100 each axis)
  const b5keys = ['O','C','E','A','N'];
  const b5Diff = b5keys.reduce((s,k) => s + Math.abs(me.personality[k] - prof.big5[k]), 0) / b5keys.length;
  const personality = Math.max(0, 100 - b5Diff * 1.05);

  const polKeys = ['econ','auth','foreign','env','tech','estab'];
  const polDiff = polKeys.reduce((s,k) => s + Math.abs(me.political[k] - prof.political[k]), 0) / polKeys.length;
  const politics = Math.max(0, 100 - polDiff * 0.52);

  const mKeys = ['future','circle','hedonism','meaning','moral','beauty'];
  const moralDiff = mKeys.reduce((s,k) => s + Math.abs(me.morals[k] - prof.morals[k]), 0) / mKeys.length;
  const values = Math.max(0, 100 - moralDiff * 0.50);

  // interests overlap (by category id)
  const myCats = new Set(me.myInterests.map(i => i.c));
  const theirCats = new Set((p.interests || []).map(i => i.c));
  const inter = [...myCats].filter(c => theirCats.has(c)).length;
  const union = new Set([...myCats, ...theirCats]).size;
  const interests = union ? Math.round((inter / union) * 100) : 50;

  return { personality, politics, values, interests };
}

// ─── Affinity, broken into bars (replaces the donut) ───
function AffinityBreakdown({ parts }) {
  const dims = [
    { k: 'personality', label: 'Personality', col: 'oklch(0.55 0.13 38)' },
    { k: 'politics',    label: 'Politics',    col: 'oklch(0.50 0.12 220)' },
    { k: 'values',      label: 'Values',      col: 'oklch(0.52 0.14 305)' },
    { k: 'interests',   label: 'Interests',   col: 'oklch(0.55 0.10 145)' },
  ].map(d => ({ ...d, v: Math.round(parts[d.k]) })).sort((a, b) => b.v - a.v);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dims.map(d => (
        <div key={d.k}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{d.label}</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: d.col }}>{d.v}</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${d.v}%`, height: '100%', background: d.col, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonOverlay({ p: rawP, onClose, me }) {
  const dlg = useDialog(onClose, rawP && rawP.name ? `${rawP.name} profile` : 'Person profile');
  // Hooks first, unconditionally, ABOVE the `!rawP` guard below. None of
  // them read rawP, so hoisting is behaviour-neutral — but leaving them
  // under an early return made hook order depend on a prop. That is
  // currently unreachable (app-shell.jsx renders this behind `person &&`),
  // which is exactly what makes it a trap: the day anyone mounts this
  // unconditionally, React blows up on a mismatched hook order far from
  // the edit that caused it.
  const [, fBump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => (window.FRIENDS ? window.FRIENDS.subscribe(fBump) : undefined), []);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  if (!rawP) return null;
  // Normalize interests — some sources (IS_DATA.people) store them as
  // category-id strings; person-overlay expects [{t, c}] objects.
  const cats = window.IS_DATA?.interestCats || [];
  const normInterests = (rawP.interests || []).map(i => {
    if (typeof i === 'string') {
      const cat = cats.find(c => c.id === i);
      return { t: cat ? cat.label.toLowerCase() : i, c: i };
    }
    return i;
  });
  const p = { ...rawP, interests: normInterests };
  const prof = derivePerson(p, me);
  const parts = affinityBreakdown(me, prof, p);
  const themColor = `oklch(0.55 0.13 ${p.hue})`;

  const overall = Math.round(p.match);
  const fStatus = !p.anon && p.id && window.FRIENDS ? window.FRIENDS.status(p.id) : 'none';
  const isFriend = fStatus === 'friends';
  const onFriendBtn = () => {
    if (!window.FRIENDS || !p.id) return;
    if (fStatus === 'none') window.FRIENDS.invite(p.id);
    else if (fStatus === 'invited') window.FRIENDS.cancel(p.id);
    else setConfirmRemove(true);
  };

  return (
    <div className="overlay surface-tint" {...dlg}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>←</button>
        <div className="h-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: p.anon ? 'capitalize' : 'none' }}>{anonName(p)}</div>
        <div className="h-meta" style={{ flexShrink: 0 }}>{p.dist || (p.anon ? 'nearby' : 'in your orbit')}</div>
      </div>
      <div className="app-body">

        {/* ─── Hero — avatar wrapped in an affinity ring gauge ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 12 }}>
          <div style={{ position: 'relative', width: 152, height: 152, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', background: `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${themColor} 26%, transparent), transparent 74%)`, filter: 'blur(6px)' }} />
            <svg viewBox="0 0 152 152" width="152" height="152" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="76" cy="76" r="68" fill="none" stroke={`color-mix(in oklch, ${themColor} 16%, transparent)`} strokeWidth="5" />
              <circle cx="76" cy="76" r="68" fill="none" stroke={themColor} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(overall / 100) * 2 * Math.PI * 68} ${2 * Math.PI * 68}`} />
            </svg>
            {p.anon ? <AnonAv hue={p.hue} size={112} /> : <Av init={p.init} hue={p.hue} size={112} />}
            <div style={{
              position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              background: themColor, color: 'white',
              padding: '4px 13px', borderRadius: 999, whiteSpace: 'nowrap',
              boxShadow: `0 6px 16px -6px color-mix(in oklch, ${themColor} 55%, transparent)`, border: '2.5px solid var(--surface)',
            }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{overall}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.8 }}>AFFINITY</span>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 28, fontWeight: 800, marginTop: 18, letterSpacing: '-0.03em', lineHeight: 1.1, textTransform: p.anon ? 'capitalize' : 'none' }}>{anonName(p)}</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 6, textTransform: 'uppercase' }}>
            {p.anon
              ? `${p.role || 'nearby'} · ${p.dist || 'nearby'}`
              : <>{p.role || p.rel} · {p.age ? `aged ${p.age} · ` : ''}{p.dist || 'in your orbit'}</>}
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            {!p.anon && p.id && window.FRIENDS && (confirmRemove ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Remove from your circle?</span>
                <button className="press" onClick={() => { window.FRIENDS.unfriend(p.id); setConfirmRemove(false); }} style={{ padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, background: 'var(--ochre)', color: '#fff' }}>Remove</button>
                <button className="press" onClick={() => setConfirmRemove(false)} style={{ padding: '7px 14px', borderRadius: 999, border: '0.5px solid var(--rule)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--ink)' }}>Keep</button>
              </div>
            ) : (
              <button className="press" onClick={onFriendBtn} style={{
                padding: '9px 24px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.01em',
                background: fStatus === 'none' ? themColor : 'var(--surface-2)',
                color: fStatus === 'none' ? 'white' : 'var(--ink)',
                border: `0.5px solid ${fStatus === 'none' ? themColor : 'var(--rule)'}`,
                boxShadow: fStatus === 'none' ? `0 6px 14px -6px color-mix(in oklch, ${themColor} 50%, transparent)` : 'none',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}>{isFriend ? 'Friends ✓' : fStatus === 'invited' ? 'Invited · waiting' : 'Add friend'}</button>
            ))}
            {fStatus === 'invited' && !confirmRemove && <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>they{'\u2019'}ll see it soon · tap to cancel</span>}
          </div>
        </div>

        <hr className="rule-dashed" />

        {/* ─── Affinity composer — one compare card per category, swipeable ─── */}
        {(() => {
          if (!window.CompareCarousel) {
            return (
              <div className="card" style={{ marginBottom: 14 }}>
                <Kicker>What makes the number</Kicker>
                <div style={{ marginTop: 12 }}><AffinityBreakdown parts={parts} /></div>
              </div>
            );
          }
          const rnd = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
          const to01 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v + 100) / 2)]));
          const who = p.anon ? 'them' : (p.name ? p.name.split(' ')[0] : p.init);
          // the remaining assessments (Social, Thinking) have no counterpart in
          // derivePerson — derive them the same way: their dims drift off yours,
          // deterministically per person, pulled closer the higher the match
          const drifted = (kind) => {
            const R = (window.IS_TEST_RESULTS || {})[kind];
            if (!R || !R.dims || !R.dims.length) return null;
            const pull = Math.max(0, Math.min(1, ((p.match || 60) - 35) / 65));
            const out = {};
            R.dims.forEach((d) => {
              const r = poHash(String(p.id || p.init || p.name || 'x') + '|' + kind + '|' + d.id);
              const drift = (r - 0.5) * 2 * 46 * (1 - pull * 0.6);
              out[d.id] = Math.max(3, Math.min(100, Math.round(d.value + drift)));
            });
            return out;
          };
          const themPop = { big5: rnd(prof.big5), political: to01(prof.political), values: to01(prof.morals) };
          const social = drifted('attachment');
          const thinking = drifted('cognitive');
          if (social) themPop.attachment = social;
          if (thinking) themPop.cognitive = thinking;
          const myInts = me.myInterests || [];
          const myCatSet = new Set(myInts.map(i => i.c));
          const theirCatSet = new Set(p.interests.map(i => i.c));
          const allCats = (window.IS_DATA && window.IS_DATA.interestCats) || [];
          // Their interests are declared as CATEGORIES; yours as specific things
          // inside them. So the compare is a category ladder: one row per
          // category either of you keeps, your depth in it as count dots, their
          // stake as a filled mark. Rows where both marks land are the overlap.
          const rows = allCats
            .filter(c => myCatSet.has(c.id) || theirCatSet.has(c.id))
            .map(c => ({
              c, mine: myInts.filter(i => i.c === c.id), them: theirCatSet.has(c.id),
            }))
            .sort((a, b) => {
              const rk = (r) => (r.them && r.mine.length ? 0 : r.mine.length ? 1 : 2);
              return rk(a) - rk(b);
            });
          const bothN = rows.filter(r => r.them && r.mine.length).length;
          // one mark per side, per row: filled = keeps it, hollow = doesn't. Two
          // columns, so a shared row reads as a pair without counting anything.
          const mark = (on, col, tip) => (
            <span title={tip || undefined} style={{
              width: 9, height: 9, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
              background: on ? col : 'transparent',
              border: on ? 'none' : '1.5px solid color-mix(in oklch, var(--ink-3) 34%, transparent)',
            }}></span>
          );
          const interestsSlide = {
            kind: 'interests', title: 'Interests', sub: 'shared ground',
            align: Math.round(parts.interests),
            body: (
              <div style={{ marginTop: 13 }}>
                {/* the overlap, as length: how much of the ladder you both keep */}
                <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
                  <span style={{ width: (rows.length ? (bothN / rows.length) * 100 : 0) + '%', background: themColor }}></span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
                  {rows.map(({ c, mine, them }) => {
                    const both = them && mine.length > 0;
                    return (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', margin: '0 -10px',
                        borderRadius: 8,
                        background: both ? `color-mix(in oklch, ${themColor} 9%, transparent)` : 'transparent',
                      }}>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: both ? 700 : 500, color: both ? 'var(--ink)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
                          {mark(mine.length > 0, 'var(--ink)', mine.map((i) => i.t).join(', '))}
                          {mark(them, themColor, who)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 11, paddingTop: 9, borderTop: '0.5px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{mark(true, 'var(--ink)')}you</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{mark(true, themColor)}{who}</span>
                </div>
              </div>
            ),
          };
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 9 }}><Kicker>What makes the number</Kicker></div>
              <window.CompareCarousel
                pop={themPop}
                accent={themColor} label={who}
                aligns={{ big5: Math.round(parts.personality), political: Math.round(parts.politics), values: Math.round(parts.values) }}
                extra={[interestsSlide]}
              />
            </div>
          );
        })()}

        {/* ─── Their map — read-only mind map, full-bleed so it reads as a view, not a pasted box ─── */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <Kicker>Their map</Kicker>
            {!isFriend && <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>Friends see the full map</span>}
          </div>
          <div style={{
            height: 470, margin: '0 -18px', overflow: 'hidden', position: 'relative',
            borderTop: '0.5px solid var(--rule)', borderBottom: '0.5px solid var(--rule)',
            background: `radial-gradient(120% 70% at 50% 0%, color-mix(in oklch, ${themColor} 7%, transparent), transparent 70%), var(--surface)`,
          }}>
            {window.PersonMindMap ? (
              <window.PersonMindMap
                p={p}
                following={isFriend}
                centerName={p.anon ? 'Them' : (p.name ? p.name.split(' ')[0] : p.init)}
              />
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}

// The one PersonOverlay — registered globally for the app shell.
window.PersonOverlay = PersonOverlay;

})();

;globalThis.derivePerson = typeof derivePerson === 'undefined' ? globalThis.derivePerson : derivePerson;
;globalThis.affinityBreakdown = typeof affinityBreakdown === 'undefined' ? globalThis.affinityBreakdown : affinityBreakdown;
;globalThis.AffinityDial = typeof AffinityDial === 'undefined' ? globalThis.AffinityDial : AffinityDial;
;globalThis.DualCompass = typeof DualCompass === 'undefined' ? globalThis.DualCompass : DualCompass;
;globalThis.TraitBridges = typeof TraitBridges === 'undefined' ? globalThis.TraitBridges : TraitBridges;
;globalThis.InterestVenn = typeof InterestVenn === 'undefined' ? globalThis.InterestVenn : InterestVenn;
;globalThis.alignmentNotes = typeof alignmentNotes === 'undefined' ? globalThis.alignmentNotes : alignmentNotes;
;globalThis.pRng = typeof pRng === 'undefined' ? globalThis.pRng : pRng;
;globalThis.AffinityBreakdown = typeof AffinityBreakdown === 'undefined' ? globalThis.AffinityBreakdown : AffinityBreakdown;
;globalThis.GeneticKinship = typeof GeneticKinship === 'undefined' ? globalThis.GeneticKinship : GeneticKinship;
;globalThis.FollowerShares = typeof FollowerShares === 'undefined' ? globalThis.FollowerShares : FollowerShares;
;globalThis.PersonOverlay = typeof PersonOverlay === 'undefined' ? globalThis.PersonOverlay : PersonOverlay;
