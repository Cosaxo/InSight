// Ported from design/spec-modules/compare-breakdown.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { RP_TESTS } from './result-rose.jsx';
import { Kicker } from './primitives.jsx';
import { IS_TEST_RESULTS } from './test-definitions.js';

// compare-breakdown.jsx — "you vs them" across every assessment, in the SAME
// visual language as the results profile (result-rose.jsx): per-trait hue
// families, petal-rose silhouettes, and pole rows. Colour says WHICH trait;
// WEIGHT says who — solid = you, the same hue washed pale = them.
//
// Difference is never drawn as a line. A neutral outline over warm petals read
// as a technical overlay, not as a second person. Instead the gap between you
// IS the picture, under ONE rule that holds in both directions: the petal is
// solid as far as you BOTH reach, then pale for the distance between you — so
// the pale zone always means "apart by this much", never "whose value is
// bigger" (that's what the pole rows underneath are for). A matched trait has
// nothing pale in it at all, so agreement looks like a clean, whole shape.
//
// Used by the geo Compare tab, the Groups compare and the People-tab circle
// compare.

const CB_INK = 'var(--ink-3)';

// same hue formulas as result-rose (file-local there)
const cbPetal = (h) => `oklch(0.64 0.115 ${h})`;
// pole dots read against white at 9–12px, so they sit a touch darker — but the
// hue is identical to the petal's, which is what ties the two views together.
const cbDot   = (h) => `oklch(0.58 0.125 ${h})`;
// "them" is the same colour, half-there. Never ink, never an outline.
const cbSoft  = (c, pct = 55) => `color-mix(in oklch, ${c}, transparent ${pct}%)`;

// CB_EXTRA_CFG held one entry — a local hue/pole family for Thinking, which
// was the one assessment RP_TESTS did not cover (its results page used a
// radar). D103 retired that test, so the fallback has nothing left to hold
// and every assessment compare draws now comes from RP_TESTS. Kept as a
// lookup rather than inlined: the next instrument that reads through a
// non-rose results page needs the same seam, and finding it gone is how it
// gets rebuilt wrong.
const cbCfg = (kind) => RP_TESTS[kind];

// Which assessments to show, in order. Dims (ids, labels, your values) come
// from IS_TEST_RESULTS so compare stays in sync with retakes.
const CB_ASSESS = [
  { kind: 'big5', title: 'Personality', sub: 'Big Five' },
  { kind: 'political', title: 'Politics', sub: 'six axes' },
  { kind: 'values', title: 'Values', sub: 'how you weigh things' },
  { kind: 'attachment', title: 'Social', sub: 'kind of friend' },
];

// ── alignment as a picture, not a percentage: your dot and theirs, drawn as
//    close together as you actually are — solid you, washed them, one hue. At
//    high alignment they land on the same spot and read as one dot in a halo. ──
function CBAlignGlyph({ align, accent }) {
  const W = 44, H = 22, r = 7, cy = H / 2, cx = W / 2;
  const off = ((100 - align) / 100) * 25;
  const nest = off < 8;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
      <title>{align}% aligned</title>
      {nest
        ? <circle cx={cx} cy={cy} r={r + 3.4} fill={cbSoft(accent, 68)} />
        : <circle cx={cx + off / 2} cy={cy} r={r} fill={cbSoft(accent, 55)} />}
      <circle cx={nest ? cx : cx - off / 2} cy={cy} r={r} fill={accent} />
    </svg>
  );
}

// alignment %: 100 minus the mean per-dimension gap, clamped to a sane band
function cbAlign(dims, themV) {
  const diffs = dims.map(d => Math.abs(d.value - (themV[d.id] ?? 50)));
  const mean = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  return Math.max(2, Math.min(99, Math.round(100 - mean)));
}

// ── one rose, two people: solid as far as you both reach, pale for the gap.
//    Symmetric by design — a petal looks the same whether they scored above or
//    below you, because what it reports is DISTANCE. No outline anywhere; a
//    matched trait is simply a whole, solid petal. ──
function CBRoseGap({ dims, themV, hueOf, themLabel, hi }) {
  const S = 176, cx = S / 2, cy = S / 2, R = 78, r0 = 6;
  const n = dims.length, slice = 360 / n, gapD = n > 6 ? 10 : 13;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (aDeg, r) => [cx + Math.cos(rad(aDeg)) * r, cy + Math.sin(rad(aDeg)) * r];
  const rOf = (v) => r0 + (Math.max(0, Math.min(100, v)) / 100) * (R - r0);
  // ring segment of slice i, between two values
  const seg = (i, va, vb) => {
    const a0 = -90 + i * slice + gapD / 2;
    const a1 = -90 + (i + 1) * slice - gapD / 2;
    const rA = rOf(va), rB = rOf(vb);
    const [xa0, ya0] = pt(a0, rA), [xb0, yb0] = pt(a0, rB);
    const [xb1, yb1] = pt(a1, rB), [xa1, ya1] = pt(a1, rA);
    const f = (v) => v.toFixed(1);
    return `M ${f(xa0)} ${f(ya0)} L ${f(xb0)} ${f(yb0)} A ${f(rB)} ${f(rB)} 0 0 1 ${f(xb1)} ${f(yb1)} L ${f(xa1)} ${f(ya1)} A ${f(rA)} ${f(rA)} 0 0 0 ${f(xa0)} ${f(ya0)} Z`;
  };
  const fade = (i) => ({ opacity: hi == null || hi === i ? 1 : 0.2, transition: 'opacity .18s ease' });
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ width: 176, display: 'block' }} role="img"
        aria-label={`Where you and ${themLabel} agree, drawn solid; the distance between you, pale`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--rule)" strokeWidth="1"></circle>
        <circle cx={cx} cy={cy} r={R / 2} fill="none" stroke="var(--rule)" strokeWidth="1" opacity="0.5"></circle>
        {/* the gap between you — same treatment whichever of you sits higher */}
        {dims.map((d, i) => {
          const t = themV[d.id] ?? 50;
          const lo = Math.min(d.value, t), up = Math.max(d.value, t);
          return up - lo > 1
            ? <path key={'g' + d.id} d={seg(i, lo, up)} fill={cbPetal(hueOf(d.id, i))} fillOpacity="0.26" style={fade(i)}></path>
            : null;
        })}
        {/* the ground you share */}
        {dims.map((d, i) => <path key={'y' + d.id} d={seg(i, 0, Math.min(d.value, themV[d.id] ?? 50))} fill={cbPetal(hueOf(d.id, i))} style={fade(i)}></path>)}
        <circle cx={cx} cy={cy} r={3} fill="var(--surface-2)" stroke="var(--rule)" strokeWidth="1.2"></circle>
      </svg>
    </div>
  );
}

// ── pole rows, two people: solid dot = you, the same hue washed = them; the
//    pale band spans the GAP between you — long band = far apart. When you land
//    on the same value it becomes one dot in a halo. Touching a row lights its
//    petal in the rose above. ──
function CBPoleRows({ dims, poles, hueOf, themV, hi, setHi }) {
  const pos = (v) => 5 + (Math.max(0, Math.min(100, v)) / 100) * 90;
  const over = (i) => (setHi ? { onPointerEnter: () => setHi(i), onPointerLeave: () => setHi(null), onPointerUp: (e) => { if (e.pointerType !== 'mouse') setHi(null); } } : null);
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 1, background: 'var(--rule)', transform: 'translateX(-50%)' }}></div>
      {dims.map((d, i) => {
        const pp = (poles || {})[d.id] || ['low', 'high'];
        const hue = hueOf(d.id, i);
        const col = cbDot(hue);
        const right = d.value >= 50;
        const youP = pos(d.value);
        const themP = themV[d.id] != null ? pos(themV[d.id]) : null;
        // two dots this size overlap below ~7 units of track, which reads as
        // one smudge — so at that distance they become one dot in a halo
        const nest = themP != null && Math.abs(youP - themP) < 7;
        const lo = themP != null ? Math.min(youP, themP) : youP;
        const hi2 = themP != null ? Math.max(youP, themP) : youP;
        // the pole you lean to is named in the trait's own colour — bold on one
        // side and not the other read as random emphasis
        const poleStyle = (isLean) => ({
          fontFamily: 'var(--sans)', fontSize: 11.5, letterSpacing: '0.01em', whiteSpace: 'nowrap',
          fontWeight: isLean ? 650 : 500, color: isLean ? col : 'var(--ink-3)',
        });
        return (
          <div key={d.id} {...over(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default', touchAction: 'manipulation', opacity: hi == null || hi === i ? 1 : 0.42, transition: 'opacity .18s ease' }}>
            <span style={{ ...poleStyle(!right), width: 66, flexShrink: 0, textAlign: 'right' }}>{pp[0]}</span>
            <div style={{ position: 'relative', flex: 1, height: 18 }}>
              {!nest && (
                <span style={{
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 5, borderRadius: 999,
                  left: `${lo}%`, width: `${Math.max(0.6, hi2 - lo)}%`,
                  background: cbSoft(col, 66),
                }}></span>
              )}
              {themP != null && !nest && (
                <span style={{ position: 'absolute', top: '50%', left: `${themP}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: cbSoft(col, 52) }}></span>
              )}
              <span style={{ position: 'absolute', top: '50%', left: `${youP}%`, transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: col, border: '2px solid var(--surface-2)', boxShadow: nest ? `0 0 0 5px ${cbSoft(col, 70)}` : '0 1px 4px -1px rgba(20,20,40,0.3)' }}></span>
            </div>
            <span style={{ ...poleStyle(right), width: 66, flexShrink: 0, textAlign: 'left' }}>{pp[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

// rose + poles as one linked unit — touching a pole row lights its petal
function CBAssess({ dims, themV, hueOf, poles, themLabel }) {
  const [hi, setHi] = React.useState(null);
  return (
    <>
      <CBRoseGap dims={dims} themV={themV} hueOf={hueOf} themLabel={themLabel} hi={hi} />
      <div style={{ marginTop: 13, paddingTop: 13, borderTop: '0.5px solid var(--rule)' }}>
        <CBPoleRows dims={dims} poles={poles} hueOf={hueOf} themV={themV} hi={hi} setHi={setHi} />
      </div>
    </>
  );
}

function CompareBreakdown({ scope, accent = 'var(--accent)', label, n, pop: popProp }) {
  const pop = popProp || (window.IS_COMPARE_POP || {})[scope];
  if (!pop) return null;
  const who = label || pop.label;

  const cards = [];
  const aligns = [];
  CB_ASSESS.forEach(a => {
    const R = IS_TEST_RESULTS[a.kind];
    const cfg = cbCfg(a.kind);
    const themV = pop[a.kind];
    if (!R || !R.dims || !R.dims.length || !cfg || !themV) return;
    const hueOf = (id, i) => (cfg.hues && cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
    const align = cbAlign(R.dims, themV);
    aligns.push(align);
    cards.push(
      <div className="card" style={{ marginBottom: 14 }} key={a.kind}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div>
            <Kicker>{a.title}</Kicker>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: CB_INK, marginTop: 2 }}>{a.sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: accent }}>{align}<span style={{ fontSize: 11 }}>%</span></span>
            <CBAlignGlyph align={align} accent={accent} />
          </div>
        </div>
        <CBAssess dims={R.dims} themV={themV} hueOf={hueOf} poles={cfg.poles} themLabel={who} />
      </div>
    );
  });

  if (!cards.length) return null;
  const overall = Math.round(aligns.reduce((s, v) => s + v, 0) / aligns.length);

  return (
    <div className="fade-in" style={{ paddingTop: 14 }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>You ↔ {who}</Kicker>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
          <span className="fig-num" style={{ fontSize: 46, lineHeight: 1, color: accent }}><em>{overall}</em><em style={{ fontSize: 24 }}>%</em></span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--ink-2)' }}>aligned overall</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: CB_INK, letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
          <span><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 99, background: accent, verticalAlign: 'middle', marginRight: 6 }} />you</span>
          <span><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 99, background: cbSoft(accent, 52), verticalAlign: 'middle', marginRight: 6 }} />{who}</span>
        </div>
      </div>
      {cards}
    </div>
  );
}

// ── carousel variant: same visual language, one assessment per swipe-slide.
// Used on person profiles where vertical space is precious. `aligns` lets the
// caller pin each card's % to the numbers it shows elsewhere; `extra` appends
// custom slides ({kind,title,sub,align,body}).
function CompareCarousel({ pop, accent = 'var(--accent)', label, aligns = {}, extra = [] }) {
  const [idx, setIdx] = React.useState(0);
  const railRef = React.useRef(null);
  if (!pop) return null;
  const who = label || pop.label || 'them';
  const slides = [];
  CB_ASSESS.forEach(a => {
    const R = IS_TEST_RESULTS[a.kind];
    const cfg = cbCfg(a.kind);
    const themV = pop[a.kind];
    if (!R || !R.dims || !R.dims.length || !cfg || !themV) return;
    const hueOf = (id, i) => (cfg.hues && cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
    slides.push({
      kind: a.kind, title: a.title, sub: a.sub,
      align: aligns[a.kind] != null ? aligns[a.kind] : cbAlign(R.dims, themV),
      body: (
        <CBAssess dims={R.dims} themV={themV} hueOf={hueOf} poles={cfg.poles} themLabel={who} />
      ),
    });
  });
  extra.forEach(s => slides.push(s));
  if (!slides.length) return null;

  const step = (el) => (el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width + 10 : el.clientWidth);
  const onScroll = (e) => {
    const el = e.currentTarget;
    setIdx(Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / step(el)))));
  };
  const goTo = (i) => { const el = railRef.current; if (el) el.scrollTo({ left: i * step(el), behavior: 'smooth' }); };
  const legendTxt = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: CB_INK, letterSpacing: '0.09em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 };

  return (
    <div>
      <div className="cb-rail" ref={railRef} onScroll={onScroll}>
        {slides.map(s => (
          <div className="card" key={s.kind}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div>
                <Kicker>{s.title}</Kicker>
                {s.sub ? <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: CB_INK, marginTop: 2 }}>{s.sub}</div> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: accent }}>{s.align}</span>
                <CBAlignGlyph align={s.align} accent={accent} />
              </div>
            </div>
            {s.body}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 10 }}>
        {slides.map((s, i) => (
          <button key={s.kind} onClick={() => goTo(i)} aria-label={s.title} style={{
            width: 7, height: 7, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
            background: i === idx ? accent : 'var(--rule)', transition: 'background .15s',
          }}></button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 9 }}>
        <span style={legendTxt}><span style={{ width: 11, height: 11, borderRadius: 99, background: accent }}></span>you</span>
        <span style={legendTxt}><span style={{ width: 11, height: 11, borderRadius: 99, background: cbSoft(accent, 52) }}></span>{who}</span>
      </div>
    </div>
  );
}

Object.assign(window, { CompareBreakdown, CompareCarousel });

;globalThis.CBAlignGlyph = typeof CBAlignGlyph === 'undefined' ? globalThis.CBAlignGlyph : CBAlignGlyph;
;globalThis.cbAlign = typeof cbAlign === 'undefined' ? globalThis.cbAlign : cbAlign;
;globalThis.CBRoseOverlay = typeof CBRoseOverlay === 'undefined' ? globalThis.CBRoseOverlay : CBRoseOverlay;
;globalThis.CBPoleRows = typeof CBPoleRows === 'undefined' ? globalThis.CBPoleRows : CBPoleRows;
;globalThis.CompareBreakdown = typeof CompareBreakdown === 'undefined' ? globalThis.CompareBreakdown : CompareBreakdown;
;globalThis.CompareCarousel = typeof CompareCarousel === 'undefined' ? globalThis.CompareCarousel : CompareCarousel;
;globalThis.CB_INK = typeof CB_INK === 'undefined' ? globalThis.CB_INK : CB_INK;
;globalThis.cbPetal = typeof cbPetal === 'undefined' ? globalThis.cbPetal : cbPetal;
;globalThis.cbDot = typeof cbDot === 'undefined' ? globalThis.cbDot : cbDot;
;globalThis.CB_EXTRA_CFG = typeof CB_EXTRA_CFG === 'undefined' ? globalThis.CB_EXTRA_CFG : CB_EXTRA_CFG;
;globalThis.cbCfg = typeof cbCfg === 'undefined' ? globalThis.cbCfg : cbCfg;
;globalThis.CB_ASSESS = typeof CB_ASSESS === 'undefined' ? globalThis.CB_ASSESS : CB_ASSESS;
