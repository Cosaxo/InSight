// Ported from design/InSight_standalone_15.html (learn-bits.jsx, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import { LEARN_SOCIAL } from './learn-social.js';

// learn-bits.jsx — the two small pieces the feed's knowledge cards share.
// The streak is a count, so it is drawn, not written; friends who have met a
// card are shown the way the feed already shows friends on an opinion split.
export function LMStreak({ k, of, col }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} aria-label={k + ' of ' + of}>
      {Array.from({ length: of }).map((_, i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < k ? (col || 'var(--ink)') : 'transparent', boxShadow: i < k ? 'none' : 'inset 0 0 0 1.5px color-mix(in oklch, var(--ink-3) 55%, transparent)' }}></span>
      ))}
    </div>
  );
}

function lmAv(bg, fg, size) {
  return { width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: size * 0.4, background: bg, color: fg, boxSizing: 'border-box' };
}

// who of your friends has met this card — filled if they got it, outlined if not
export function LMFriends({ card, col }) {
  const S = LEARN_SOCIAL;
  if (!card) return null;
  const list = S.onCard(card);
  if (!list.length) return null;
  const got = list.filter((f) => f.ok).length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {list.slice(0, 6).map((f, i) => (
          <span key={f.id} title={f.name + (f.ok ? ' — got it' : ' — missed it')} style={{ marginLeft: i ? -6 : 0, zIndex: 6 - i, ...lmAv(f.ok ? col : 'var(--surface)', f.ok ? '#fff' : 'var(--ink-3)', 22), border: f.ok ? '1.5px solid var(--surface)' : '1.5px solid var(--rule)' }}>{f.init}</span>
        ))}
      </div>
      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' }}>{got + ' of ' + list.length + ' friends got this'}</span>
    </div>
  );
}

// lmAv alone stays on the bridge: world-feed.jsx calls it bare, a
// cross-module call the scanner cannot see (D353 left it for that reason).
Object.assign(window, { lmAv });

;globalThis.lmAv = typeof lmAv === 'undefined' ? globalThis.lmAv : lmAv;
