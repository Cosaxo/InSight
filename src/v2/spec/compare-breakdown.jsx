// ported from design/spec-modules/compare-breakdown.jsx — do not hand-edit load order assumptions
import React from 'react';

// compare-breakdown.jsx — "you vs them" across every assessment, in the SAME
// visual language as the results profile (result-rose.jsx): per-trait hue
// families, petal-rose silhouettes, and pole rows. Colour says WHICH trait;
// mark style says WHO — solid/filled = you, hollow/outlined = them.
// Their silhouette is OVERLAID on yours: matched petals melt together,
// mismatched ones split apart — the gap is the read.
// Used by the geo Compare tab, the Groups compare and the People-tab circle
// compare.

const CB_INK = 'var(--ink-3)';

// same hue formulas as result-rose (file-local there)
const cbPetal = (h) => `oklch(0.64 0.115 ${h})`;
const cbDot   = (h) => `oklch(0.55 0.13 ${h})`;

// Thinking isn't in RP_TESTS (its results page uses a radar) — a local
// hue/pole family keeps compare unified across all five assessments.
const CB_EXTRA_CFG = {
  cognitive: {
    hues: { analyst: 245, systems: 210, empath: 285, maker: 190 },
    poles: {
      analyst: ['intuitive', 'analytical'],
      systems: ['zoomed-in', 'systems'],
      empath:  ['detached', 'empathic'],
      maker:   ['abstract', 'hands-on'],
    },
  },
};
const cbCfg = (kind) => (window.RP_TESTS || {})[kind] || CB_EXTRA_CFG[kind];

// Which assessments to show, in order. Dims (ids, labels, your values) come
// from IS_TEST_RESULTS so compare stays in sync with retakes.
const CB_ASSESS = [
  { kind: 'big5', title: 'Personality', sub: 'Big Five' },
  { kind: 'political', title: 'Politics', sub: 'six axes' },
  { kind: 'values', title: 'Values', sub: 'how you weigh things' },
  { kind: 'attachment', title: 'Social', sub: 'kind of friend' },
  { kind: 'cognitive', title: 'Thinking', sub: 'cognitive style' },
];

// ── alignment as a picture, not a percentage: your dot and theirs, drawn as
//    close together as you actually are. Concentric = perfectly aligned. ──
function CBAlignGlyph({ align, accent }) {
  const W = 46, H = 22, r = 7.5, cy = H / 2, cx = W / 2;
  const off = ((100 - align) / 100) * 26; // px apart at 0% aligned
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
      <title>{align}% aligned</title>
      <circle cx={cx + off / 2} cy={cy} r={r} fill="var(--surface)" stroke={CB_INK} strokeWidth="1.3" />
      <circle cx={cx - off / 2} cy={cy} r={r} fill={accent} fillOpacity="0.85" />
    </svg>
  );
}

// alignment %: 100 minus the mean per-dimension gap, clamped to a sane band
function cbAlign(dims, themV) {
  const diffs = dims.map(d => Math.abs(d.value - (themV[d.id] ?? 50)));
  const mean = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  return Math.max(2, Math.min(99, Math.round(100 - mean)));
}

// ── overlaid roses: your filled silhouette, their outline drawn on top —
//    matched petals disappear into each other; mismatched ones split apart ──
function CBRoseOverlay({ dims, themV, hueOf, themLabel }) {
  const S = 176, cx = S / 2, cy = S / 2, R = 78, r0 = 6;
  const n = dims.length, slice = 360 / n, gapD = n > 6 ? 10 : 13;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (aDeg, r) => [cx + Math.cos(rad(aDeg)) * r, cy + Math.sin(rad(aDeg)) * r];
  const petal = (i, v) => {
    const a0 = -90 + i * slice + gapD / 2;
    const a1 = -90 + (i + 1) * slice - gapD / 2;
    const r = r0 + (Math.max(0, Math.min(100, v)) / 100) * (R - r0);
    const [x0i, y0i] = pt(a0, r0), [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r), [x1i, y1i] = pt(a1, r0);
    return `M ${x0i.toFixed(1)} ${y0i.toFixed(1)} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x1i.toFixed(1)} ${y1i.toFixed(1)} A ${r0} ${r0} 0 0 0 ${x0i.toFixed(1)} ${y0i.toFixed(1)} Z`;
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
      <svg viewBox={`0 0 ${S} ${S}`} style={{ width: 176, display: 'block' }} role="img"
        aria-label={`Your trait silhouette with ${themLabel} outlined on top`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--rule)" strokeWidth="1"></circle>
        <circle cx={cx} cy={cy} r={R / 2} fill="none" stroke="var(--rule)" strokeWidth="1" opacity="0.5"></circle>
        {dims.map((d, i) => <path key={'y' + d.id} d={petal(i, d.value)} fill={cbPetal(hueOf(d.id, i))}></path>)}
        {dims.map((d, i) => <path key={'tc' + d.id} d={petal(i, themV[d.id] ?? 50)} fill={cbPetal(hueOf(d.id, i))} fillOpacity="0.14" stroke="var(--surface)" strokeWidth="3.4" strokeLinejoin="round"></path>)}
        {dims.map((d, i) => <path key={'t' + d.id} d={petal(i, themV[d.id] ?? 50)} fill="none" stroke="var(--ink)" strokeOpacity="0.8" strokeWidth="1.5" strokeLinejoin="round"></path>)}

        <circle cx={cx} cy={cy} r={3} fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="1.2"></circle>
      </svg>
    </div>
  );
}

// ── pole rows, two people: solid dot = you, hollow ring = them; the tinted
//    band spans the GAP between you — long band = far apart, none = aligned ──
function CBPoleRows({ dims, poles, hueOf, themV }) {
  const pos = (v) => 5 + (Math.max(0, Math.min(100, v)) / 100) * 90;
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
        const lo = themP != null ? Math.min(youP, themP) : youP;
        const hi = themP != null ? Math.max(youP, themP) : youP;
        const poleStyle = (isLean) => ({
          fontFamily: 'var(--sans)', fontSize: 11.5, letterSpacing: '0.01em', whiteSpace: 'nowrap',
          fontWeight: isLean ? 700 : 500, color: isLean ? 'var(--ink)' : 'var(--ink-3)',
        });
        return (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...poleStyle(!right), width: 66, flexShrink: 0, textAlign: 'right' }}>{pp[0]}</span>
            <div style={{ position: 'relative', flex: 1, height: 14 }}>
              <span style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 3, borderRadius: 999,
                left: `${lo}%`, width: `${Math.max(0.6, hi - lo)}%`,
                background: `color-mix(in oklch, ${col}, transparent 70%)`,
              }}></span>
              {themP != null && (
                <span style={{ position: 'absolute', top: '50%', left: `${themP}%`, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--surface)', border: `1.5px solid ${col}` }}></span>
              )}
              <span style={{ position: 'absolute', top: '50%', left: `${youP}%`, transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: col, border: '2px solid var(--surface-2)', boxShadow: '0 1px 4px -1px rgba(20,20,40,0.3)' }}></span>
            </div>
            <span style={{ ...poleStyle(right), width: 66, flexShrink: 0, textAlign: 'left' }}>{pp[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

function CompareBreakdown({ scope, accent = 'var(--accent)', label, n, pop: popProp }) {
  const pop = popProp || (window.IS_COMPARE_POP || {})[scope];
  if (!pop) return null;
  const who = label || pop.label;

  const cards = [];
  const aligns = [];
  CB_ASSESS.forEach(a => {
    const R = (window.IS_TEST_RESULTS || {})[a.kind];
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
          <CBAlignGlyph align={align} accent={accent} />
        </div>
        <CBRoseOverlay dims={R.dims} themV={themV} hueOf={hueOf} themLabel={who} />
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
          <CBPoleRows dims={R.dims} poles={cfg.poles} hueOf={hueOf} themV={themV} />
        </div>
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
          <span className="fig-num" style={{ fontSize: 46, lineHeight: 1, color: accent }}><em>{overall}</em></span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--ink-2)' }}>% aligned overall</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: CB_INK, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
          <span><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 99, background: accent, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)', verticalAlign: 'middle', marginRight: 6 }} />you</span>
          <span><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 99, background: 'var(--surface)', border: '1.5px solid var(--ink-3)', verticalAlign: 'middle', marginRight: 6 }} />{who}</span>
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
    const R = (window.IS_TEST_RESULTS || {})[a.kind];
    const cfg = cbCfg(a.kind);
    const themV = pop[a.kind];
    if (!R || !R.dims || !R.dims.length || !cfg || !themV) return;
    const hueOf = (id, i) => (cfg.hues && cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
    slides.push({
      kind: a.kind, title: a.title, sub: a.sub,
      align: aligns[a.kind] != null ? aligns[a.kind] : cbAlign(R.dims, themV),
      body: (
        <>
          <CBRoseOverlay dims={R.dims} themV={themV} hueOf={hueOf} themLabel={who} />
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
            <CBPoleRows dims={R.dims} poles={cfg.poles} hueOf={hueOf} themV={themV} />
          </div>
        </>
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
  const legendTxt = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: CB_INK, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 };

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
        <span style={legendTxt}><span style={{ width: 11, height: 11, borderRadius: 99, background: accent, border: '1.5px solid var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)' }}></span>you</span>
        <span style={legendTxt}><span style={{ width: 11, height: 11, borderRadius: 99, background: 'var(--surface)', border: '1.5px solid var(--ink-3)' }}></span>{who}</span>
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
