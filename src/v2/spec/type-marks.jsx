// Ported from design/InSight_standalone_15.html (type-marks.jsx). THIS file is
// the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import ReactDOM from 'react-dom';

// type-marks.jsx — a concrete visual identity for every named type.
// Each type gets a badge: one simple geometric motif (chosen for what the type
// IS — Lookout → eye, Planner → grid, Slow Burn → ember) in its own muted hue
// drawn from the owning test's hue family. All code-drawn, deterministic.
const tmC = (h) => `oklch(0.52 0.115 ${h})`;
const tmD = (h) => `oklch(0.40 0.12 ${h})`;
const TM_MOTIFS = {
  burst: (c, d) => <g stroke={d} strokeWidth="2.2" strokeLinecap="round">{[0,45,90,135,180,225,270,315].map(a => { const r = a * Math.PI / 180; return <line key={a} x1={12 + Math.cos(r) * 4.5} y1={12 + Math.sin(r) * 4.5} x2={12 + Math.cos(r) * 10} y2={12 + Math.sin(r) * 10}></line>; })}</g>,
  grid: (c, d) => <g fill={d}>{[4,10,16].map(x => [4,10,16].map(y => <rect key={x + '-' + y} x={x} y={y} width="4" height="4" rx="1" opacity={y === 10 || x === 10 ? 1 : 0.55}></rect>))}</g>,
  balance: (c, d) => <g stroke={d} strokeWidth="2" strokeLinecap="round" fill={d}><line x1="4" y1="8" x2="20" y2="8"></line><line x1="5.5" y1="8" x2="6" y2="12.5"></line><line x1="18.5" y1="8" x2="18" y2="12.5"></line><circle cx="6" cy="15" r="2.8" stroke="none"></circle><circle cx="18" cy="15" r="2.8" stroke="none"></circle><circle cx="12" cy="8" r="1.6" stroke="none"></circle></g>,
  pillar: (c, d) => <g fill={d}><rect x="4" y="4.5" width="16" height="2.2" rx="1.1"></rect>{[5.5,10.6,15.7].map(x => <rect key={x} x={x} y="8.5" width="2.8" height="11" rx="1.2" opacity="0.8"></rect>)}</g>,
  bolt: (c, d) => <polygon points="13,2 6,14 11,14 9,22 18,9.5 13,9.5 16,2" fill={d}></polygon>,
  dotring: (c, d) => <g fill={d}><circle cx="12" cy="12" r="2.6"></circle>{[0,60,120,180,240,300].map(a => { const r = (a - 90) * Math.PI / 180; return <circle key={a} cx={12 + Math.cos(r) * 7.5} cy={12 + Math.sin(r) * 7.5} r="1.9" opacity="0.75"></circle>; })}</g>,
  eye: (c, d) => <g><path d="M2.5 12 Q12 4.5 21.5 12 Q12 19.5 2.5 12 Z" fill="none" stroke={d} strokeWidth="2"></path><circle cx="12" cy="12" r="3.2" fill={d}></circle></g>,
  wave: (c, d) => <g fill="none" stroke={d} strokeWidth="2.2" strokeLinecap="round"><path d="M3 9.5 Q7.5 4.5 12 9.5 T21 9.5"></path><path d="M3 15.5 Q7.5 10.5 12 15.5 T21 15.5" opacity="0.55"></path></g>,
  book: (c, d) => <g stroke={d} strokeWidth="2" strokeLinecap="round" fill="none"><path d="M12 6 C9.5 4.2 6 4.2 3.5 5.6 V18 C6 16.6 9.5 16.6 12 18.4"></path><path d="M12 6 C14.5 4.2 18 4.2 20.5 5.6 V18 C18 16.6 14.5 16.6 12 18.4"></path><line x1="12" y1="6" x2="12" y2="18.4" opacity="0.5"></line></g>,
  point: (c, d) => <g fill={d}><rect x="10.4" y="3.5" width="3.2" height="11" rx="1.6"></rect><circle cx="12" cy="19" r="2.3"></circle></g>,
  moon: (c, d) => <path d="M15.5 3 A9.3 9.3 0 1 0 15.5 21 A7.2 7.2 0 1 1 15.5 3 Z" fill={d}></path>,
  ripple: (c, d) => <g fill="none" stroke={d}><circle cx="12" cy="12" r="2.4" fill={d} stroke="none"></circle><circle cx="12" cy="12" r="6.5" strokeWidth="2" opacity="0.65"></circle><circle cx="12" cy="12" r="10" strokeWidth="1.8" opacity="0.3"></circle></g>,
  ember: (c, d) => <g><circle cx="12" cy="12" r="4.6" fill={d}></circle><circle cx="12" cy="12" r="7.6" fill="none" stroke={d} strokeWidth="1.8" opacity="0.45"></circle><circle cx="12" cy="12" r="10.4" fill="none" stroke={d} strokeWidth="1.6" opacity="0.18"></circle></g>,
  link: (c, d) => <g fill="none" stroke={d} strokeWidth="2.2"><circle cx="8.4" cy="12" r="5"></circle><circle cx="15.6" cy="12" r="5" opacity="0.7"></circle></g>,
  leaf: (c, d) => <g><path d="M12 3 C18.5 7 19 15.5 12 21 C5 15.5 5.5 7 12 3 Z" fill={d} opacity="0.85"></path><line x1="12" y1="8" x2="12" y2="21" stroke="var(--surface-2)" strokeWidth="1.6"></line></g>,
  net: (c, d) => <g fill={d}>{[5,12,19].map(x => [5,12,19].map(y => <circle key={x + '-' + y} cx={x} cy={y} r="1.8" opacity={x === 12 && y === 12 ? 1 : 0.65}></circle>))}</g>,
  target: (c, d) => <g fill="none" stroke={d}><circle cx="12" cy="12" r="9" strokeWidth="1.8" opacity="0.5"></circle><circle cx="12" cy="12" r="5.2" strokeWidth="2"></circle><circle cx="12" cy="12" r="1.8" fill={d} stroke="none"></circle></g>,
  chevup: (c, d) => <g fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5,13 12,6 19,13"></polyline><polyline points="5,19.5 12,12.5 19,19.5" opacity="0.5"></polyline></g>,
  ring: (c, d) => <circle cx="12" cy="12" r="7.8" fill="none" stroke={d} strokeWidth="2.8"></circle>,
  flowright: (c, d) => <g fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4.5,6 10.5,12 4.5,18" opacity="0.45"></polyline><polyline points="11,6 17,12 11,18"></polyline></g>,
  flag: (c, d) => <g><line x1="7" y1="3.5" x2="7" y2="20.5" stroke={d} strokeWidth="2.2" strokeLinecap="round"></line><polygon points="8.2,4.5 18.5,7.8 8.2,11" fill={d}></polygon></g>,
  sunrise: (c, d) => <g stroke={d} strokeWidth="2" strokeLinecap="round"><path d="M6.5 15.5 A5.5 5.5 0 0 1 17.5 15.5 Z" fill={d} stroke="none"></path><line x1="3" y1="15.5" x2="21" y2="15.5"></line><line x1="12" y1="4" x2="12" y2="7"></line><line x1="5" y1="7" x2="7" y2="9"></line><line x1="19" y1="7" x2="17" y2="9"></line></g>,
  star: (c, d) => <polygon points="12,3 14.2,8.9 20.6,9.2 15.6,13.2 17.3,19.3 12,15.8 6.7,19.3 8.4,13.2 3.4,9.2 9.8,8.9" fill={d}></polygon>,
  staro: (c, d) => <polygon points="12,3.5 14.1,9.1 20,9.4 15.4,13.1 17,18.8 12,15.5 7,18.8 8.6,13.1 4,9.4 9.9,9.1" fill="none" stroke={d} strokeWidth="1.8" strokeLinejoin="round"></polygon>,
  roof: (c, d) => <g><polyline points="4,12.5 12,4.5 20,12.5" fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></polyline><circle cx="12" cy="16.5" r="2.7" fill={d}></circle></g>,
  crosshair: (c, d) => <g stroke={d} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="7" fill="none"></circle><line x1="12" y1="2.5" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="21.5"></line><line x1="2.5" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="21.5" y2="12"></line><circle cx="12" cy="12" r="1.5" fill={d} stroke="none"></circle></g>,
  steps: (c, d) => <g fill={d}><rect x="4" y="14" width="4.6" height="6" rx="1" opacity="0.5"></rect><rect x="9.7" y="9.5" width="4.6" height="10.5" rx="1" opacity="0.75"></rect><rect x="15.4" y="5" width="4.6" height="15" rx="1"></rect></g>,
  trail: (c, d) => <g fill={d}><circle cx="6" cy="18" r="2.7"></circle><circle cx="11" cy="13" r="2.2" opacity="0.8"></circle><circle cx="15.5" cy="8.5" r="1.8" opacity="0.6"></circle><circle cx="19" cy="5" r="1.4" opacity="0.4"></circle></g>,
  sun: (c, d) => <g stroke={d} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" fill={d} stroke="none"></circle>{[0,45,90,135,180,225,270,315].map(a => { const r = a * Math.PI / 180; return <line key={a} x1={12 + Math.cos(r) * 7} y1={12 + Math.sin(r) * 7} x2={12 + Math.cos(r) * 9.8} y2={12 + Math.sin(r) * 9.8}></line>; })}</g>,
  orbit: (c, d) => <g><circle cx="12" cy="12" r="8" fill="none" stroke={d} strokeWidth="2"></circle><circle cx="17.7" cy="6.3" r="2.5" fill={d}></circle><circle cx="12" cy="12" r="1.8" fill={d} opacity="0.6"></circle></g>,
  block: (c, d) => <rect x="5.5" y="5.5" width="13" height="13" rx="3.2" fill={d}></rect>,
  keyhole: (c, d) => <g fill={d}><circle cx="12" cy="9" r="4.4"></circle><polygon points="10.4,12 13.6,12 15.2,19.5 8.8,19.5"></polygon></g>,
  smile: (c, d) => <g fill={d}><circle cx="8.3" cy="8.5" r="1.8"></circle><circle cx="15.7" cy="8.5" r="1.8"></circle><path d="M5.5 13 A6.8 6.8 0 0 0 18.5 13" fill="none" stroke={d} strokeWidth="2.3" strokeLinecap="round"></path></g>,
  bubbles: (c, d) => <g stroke={d} fill="none"><circle cx="8.5" cy="14.5" r="4.6" strokeWidth="2"></circle><circle cx="16" cy="8" r="3" strokeWidth="1.8" opacity="0.7"></circle><circle cx="17.5" cy="16.5" r="1.7" fill={d} stroke="none" opacity="0.6"></circle></g>,
};
// [motif, hue] per type — hues stay inside each test's existing colour family.
const TM_ART = {
  big5: { 'The Enthusiast': ['burst', 50], 'The Planner': ['grid', 75], 'The Diplomat': ['balance', 25], 'The Dependable': ['pillar', 70], 'The Live Wire': ['bolt', 95], 'The Host': ['dotring', 40], 'The Lookout': ['eye', 80], 'The Drifter': ['wave', 55], 'The Reader': ['book', 20], 'The Plain Speaker': ['point', 65], 'The Quiet One': ['moon', 30], 'The Sensitive': ['ripple', 5], 'The Hothead': ['ember', 15] },
  political: { 'Solidarity Left': ['link', 320], 'Green Left': ['leaf', 165], 'Social Democrat': ['net', 250], 'Liberal Centrist': ['target', 230], 'Techno-Optimist': ['chevup', 215], 'Libertarian': ['ring', 200], 'Market Liberal': ['flowright', 240], 'Communitarian': ['dotring', 185], 'Traditional Conservative': ['pillar', 270], 'National Populist': ['flag', 290] },
  values: { 'The Tempered Optimist': ['sunrise', 28], 'The Romantic': ['star', 340], 'The Provider': ['roof', 310], 'The Rationalist': ['crosshair', 282], 'The Builder': ['steps', 20], 'The Utilitarian': ['balance', 260], 'The Worried Idealist': ['staro', 300], 'The Traditionalist': ['pillar', 330], 'The Hedonist': ['sun', 6], 'The Wanderer': ['trail', 350] },
  attachment: { 'The Constant': ['orbit', 150], 'The Loyalist': ['link', 165], 'The Cheerleader': ['burst', 95], 'The Fixture': ['block', 185], 'The Confidant': ['keyhole', 200], 'The Open Book': ['book', 130], 'The Comic Relief': ['smile', 110], 'The Floater': ['bubbles', 175], 'The Chill One': ['ripple', 205], 'The Overinvested': ['target', 85], 'The Slow Burn': ['ember', 60], 'The Small Circle': ['dotring', 140] },
};
function tmArt(testKey, name) {
  const a = (TM_ART[testKey] || {})[name];
  if (a) return a;
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const keys = Object.keys(TM_MOTIFS);
  return [keys[h % keys.length], h];
}
// The badge. plate=true draws the tinted app-icon square behind the motif.
function TypeMark({ testKey, name, size = 20, plate = true, style, title }) {
  const [m, h] = tmArt(testKey, name);
  const draw = TM_MOTIFS[m];
  if (!draw) return null;
  const inner = plate ? Math.round(size * 0.72) : size;
  return (
    <span title={title} aria-hidden={title ? undefined : true} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: size, height: size, borderRadius: '28%', background: plate ? `color-mix(in oklch, ${tmC(h)} 15%, var(--surface-2))` : 'none', border: plate ? `0.5px solid color-mix(in oklch, ${tmC(h)} 32%, var(--rule))` : 'none', boxSizing: 'border-box', ...style }}>
      <svg width={inner} height={inner} viewBox="0 0 24 24" style={{ display: 'block' }}>{draw(tmC(h), tmD(h))}</svg>
    </span>
  );
}
// ── the type index: every type in a test — badge, one-liner, how common ──
function TypeIndexSheet({ testKey, onClose }) {
  const [closing, setClosing] = React.useState(false);
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 230); };
  const sys = (window.IS_ARCHETYPES || {})[testKey];
  const cfg = (window.RP_TESTS || {})[testKey];
  const host = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  if (!sys || !host) return null;
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  const arch = R && R.dims && window.IS_matchArchetype ? window.IS_matchArchetype(testKey, R.dims) : null;
  const yours = arch ? arch.list[arch.idx].name : null;
  const list = sys.list.slice().sort((a, b) => (b.share || 0) - (a.share || 0));
  const maxShare = list[0].share || 1;
  const banner = cfg ? cfg.banner : 'var(--accent)';
  return ReactDOM.createPortal(
    <Sheet onClose={close} closing={closing} label={`The ${list.length} types`}>
        <div style={{ padding: '10px 18px 4px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flex: 1 }}>The {list.length} types</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>bar = how common</span>
          <button onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, alignSelf: 'center', WebkitAppearance: 'none' }}>{'\u2715'}</button>
        </div>
        <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column' }}>
          {list.map((a, i) => {
            const you = a.name === yours;
            return (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px', borderTop: i === 0 ? 'none' : '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', background: you ? `linear-gradient(90deg, color-mix(in oklch, ${banner} 9%, transparent), transparent 70%)` : 'none', borderRadius: you ? 10 : 0 }}>
                <TypeMark testKey={testKey} name={a.name} size={38}></TypeMark>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontFamily: 'var(--sans)', fontWeight: 750, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{a.name}</span>
                    {you ? <span style={{ fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', padding: '1.5px 7px', borderRadius: 999, background: banner, color: 'var(--surface)' }}>YOU</span> : null}
                  </div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.35, marginTop: 2, textWrap: 'pretty' }}>{a.line}</div>
                </div>
                <div style={{ flexShrink: 0, width: 58, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }} title={a.share + '% of people land here'}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{a.share}%</span>
                  <span style={{ width: '100%', height: 4, borderRadius: 999, background: 'color-mix(in oklch, var(--ink-3) 16%, transparent)' }}><span style={{ display: 'block', width: Math.max(6, (a.share / maxShare) * 100) + '%', height: '100%', borderRadius: 999, background: you ? banner : `color-mix(in oklch, ${banner} 55%, var(--ink-3))` }}></span></span>
                </div>
              </div>
            );
          })}
        </div>
    </Sheet>, host);
}
Object.assign(window, { TypeMark, TypeIndexSheet, IS_TYPE_ART: TM_ART });

;globalThis.tmC = typeof tmC === 'undefined' ? globalThis.tmC : tmC;
;globalThis.tmD = typeof tmD === 'undefined' ? globalThis.tmD : tmD;
;globalThis.TM_MOTIFS = typeof TM_MOTIFS === 'undefined' ? globalThis.TM_MOTIFS : TM_MOTIFS;
;globalThis.TM_ART = typeof TM_ART === 'undefined' ? globalThis.TM_ART : TM_ART;
;globalThis.tmArt = typeof tmArt === 'undefined' ? globalThis.tmArt : tmArt;
;globalThis.TypeMark = typeof TypeMark === 'undefined' ? globalThis.TypeMark : TypeMark;
;globalThis.TypeIndexSheet = typeof TypeIndexSheet === 'undefined' ? globalThis.TypeIndexSheet : TypeIndexSheet;
