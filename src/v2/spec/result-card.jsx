// Ported from design/spec-modules/result-card.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import LIVE from '../data/live';
import { ExplainBtn, ExplainSheet, EX_GLYPH } from './explain-sheet.jsx';
import { RP_TESTS, RoseMini, TestRose } from './result-rose.jsx';
import { IS_DATA } from './sample-data.js';
import { Av } from './primitives.jsx';
import { IS_TESTS, IS_TEST_RESULTS } from './test-definitions.js';
import { IS_FRIEND_TYPES, IS_STANDOUT, IS_matchArchetype, IS_nearWhy, IS_profileRarity, IS_typeRuleParts } from './archetype-data.js';
import { PASSIVE } from './passive-progress.js';
// What the POPULATION looks like, measured (D157). This card used to read
// IS_TEST_AVG directly — five authored constants per instrument, drawn as
// the "most people" ring on every axis and stated as a percentile of
// "members". The seam returns the measured fold in a live build, the
// authored baseline in the demo, and an EMPTY map rather than a fallback
// when the live population is still too thin to average. Every consumer
// below therefore has to survive an absent baseline, which is the point.
import { axisRank, rarityAmong, testNorm } from '../data/testNorms.ts';
// The passive fold (D121). Live mode has no sit-down flow, so a test with
// no stored result is scored from the viewer's own feed answers — once
// every axis has enough behind it to be worth a type.
import { passiveResult, passiveTest } from '../data/passiveProfile.ts';
// LIVE.myVotes() is string-valued ({ qid: "2" }) and the fold wants option
// INDICES — see data/similarity.ts voteIndices for what passing the raw map
// did (D132: every instrument stuck at "0 of N answered", forever).
import { voteIndices } from '../data/similarity.ts';

// This test's own reading of the viewer, or null. Stored results always
// win: a sit-down result from before D121 is a finished instrument and the
// fold is an estimate of the same thing from fewer answers.
export function ownResult(testKey) {
  const stored = IS_TEST_RESULTS[testKey];
  if (stored) return stored;
  if (!LIVE.enabled) return null;
  const def = IS_TESTS[testKey];
  return passiveResult(passiveTest(testKey, def, LIVE.testFeedItems(), IS_TESTS, voteIndices(LIVE.myVotes())), def ? def.title : testKey);
}

// …and how far off it is when it is null. Separate from ownResult because
// a surface that has nothing to draw still has something true to SAY, and
// the two callers want different halves.
export function ownProgress(testKey) {
  if (!LIVE.enabled) return null;
  return passiveTest(testKey, IS_TESTS[testKey], LIVE.testFeedItems(), IS_TESTS, voteIndices(LIVE.myVotes()));
}

// result-card.jsx — test profile cards: each test keeps the shared banner
// language but owns its NATIVE geometry:
//   big5 → petal rose · politics → 2D compass plane · values → tension spine
//   social → orbit field (closer to centre = more you)
// Banner: rarity as a lit 100-dot field + the two types you nearly were.
// Second section: "where you differ" — only the dims where you deviate most.

(function(){ if(document.getElementById('rpv2-style')) return; const s=document.createElement('style'); s.id='rpv2-style';
s.textContent=`@keyframes rpv2In{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
.rpv2-pop{animation:rpv2In .55s cubic-bezier(.2,.85,.3,1.08) backwards}
@keyframes rpv2Fade{from{opacity:0}to{opacity:1}}
.rpv2-fade{animation:rpv2Fade .5s ease backwards}
@keyframes rpv2Bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.rpv2-bar{animation:rpv2Bar .6s cubic-bezier(.25,.8,.3,1) backwards}`;
document.head.appendChild(s); })();

const rpv2Deep = (h) => `oklch(0.46 0.13 ${h})`;
const rpv2Dot  = (h) => `oklch(0.55 0.13 ${h})`;

// ── rarity, about YOU: a 100-person dot field, yours lit. The speckle IS the
// sentence — the numeral is a whisper. Seeded shuffle so the scatter is stable.
const rpv2Order = (() => { const idx = Array.from({ length: 100 }, (_, i) => i); let s = 48271; for (let i = 99; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; } return idx; })();
function RarityField({ pct, label, color, title }) {
  const lit = new Set(rpv2Order.slice(0, Math.max(1, Math.min(100, Math.round(pct)))));
  return (
    <div className="rpv2-fade" style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, animationDelay: 'var(--rv-2)' }} title={title}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(25, 3px)', gap: 2 }}>
        {Array.from({ length: 100 }, (_, i) => (
          <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: lit.has(i) ? color : `color-mix(in oklch, ${color} 16%, var(--surface-3))` }}></span>
        ))}
      </div>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: color, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

// ── signature emblem — the type rendered as its own shape, tone-on-tone in the
// test hue. Defining dims read darker; same-type friends orbit the rim.
function SigEmblem({ testKey, sig, color, people, typeName }) {
  const mark = typeName && window.TypeMark ? window.TypeMark : null;
  const cfg = RP_TESTS[testKey];
  const ids = cfg ? Object.keys(cfg.hues).filter(id => sig && sig[id] != null) : [];
  if (!cfg || !ids.length) return null;
  const size = 170, C = size / 2, R = C - 3, r0 = 6, n = ids.length, slice = 360 / n, gapD = n > 6 ? 10 : 14;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (a, r) => [C + Math.cos(rad(a)) * r, C + Math.sin(rad(a)) * r];
  const gid = 'rpv2-emb-' + testKey;
  const ppl = (people || []).slice(0, 4);
  return (
    <div style={{ position: 'absolute', right: -28, top: '50%', transform: 'translateY(-50%)', width: size, height: size, pointerEvents: 'none' }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <defs><radialGradient id={gid}><stop offset="0%" stopColor={color} stopOpacity="0.15"></stop><stop offset="100%" stopColor={color} stopOpacity="0"></stop></radialGradient></defs>
        <circle cx={C} cy={C} r={R} fill={`url(#${gid})`}></circle>
        {mark ? null : ids.map((id, i) => {
          const raw = sig[id];
          const v = Math.max(16, cfg.bipolar ? Math.min(100, Math.abs(raw - 50) * 2) : raw);
          const a0 = -90 + i * slice + gapD / 2, a1 = -90 + (i + 1) * slice - gapD / 2;
          const r = r0 + (v / 100) * (R - 14 - r0);
          const [xa, ya] = pt(a0, r0), [xb, yb] = pt(a0, r), [xc, yc] = pt(a1, r), [xd, yd] = pt(a1, r0);
          const op = 0.15 + (Math.abs(raw - 50) / 50) * 0.22;
          return <path key={id} className="rpv2-pop" style={{ transformOrigin: `${C}px ${C}px`, animationDelay: `calc(var(--rv-row) * ${i})` }} d={`M ${xa.toFixed(1)} ${ya.toFixed(1)} L ${xb.toFixed(1)} ${yb.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xc.toFixed(1)} ${yc.toFixed(1)} L ${xd.toFixed(1)} ${yd.toFixed(1)} A ${r0} ${r0} 0 0 0 ${xa.toFixed(1)} ${ya.toFixed(1)} Z`} fill={color} opacity={op}></path>;
        })}
      </svg>
      {mark ? <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'inline-flex' }}><span className="rpv2-pop" style={{ display: 'inline-flex', animationDelay: '80ms' }}>{React.createElement(mark, { testKey, name: typeName, size: 82 })}</span></span> : null}
      {/* The `window.Av &&` guard this used to carry is gone with D39: Av is
          an import now, so it cannot be undefined at render. The guard was
          never about `ppl` — an empty list maps to nothing on its own. */}
      {ppl.map((p, i) => {
        const [x, y] = pt(132 + i * 33, R - 5);
        return <span key={p.id} className="rpv2-pop" style={{ position: 'absolute', left: x - 10, top: y - 10, borderRadius: '50%', boxShadow: '0 0 0 2px var(--surface-2)', display: 'inline-flex', animationDelay: `${300 + i * 70}ms` }}><Av init={p.init} hue={p.hue} size={20} /></span>;
      })}
    </div>
  );
}

// ── generic bipolar rows: centre spine, pull toward your pole, avg ring ──
function TensionSpine({ dims, poles, hues, avg, lead }) {
  const pos = (v) => 5 + (Math.max(0, Math.min(100, v)) / 100) * 90;
  const leadId = lead ? [...dims].sort((m, n) => Math.abs(n.value - 50) - Math.abs(m.value - 50))[0].id : null;
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 1, background: 'var(--rule)', transform: 'translateX(-50%)' }}></div>
      {dims.map((d, i) => {
        const pp = (poles && poles[d.id]) || ['low', 'high'];
        const hue = hues && hues[d.id] != null ? hues[d.id] : (30 + i * 47) % 360;
        const col = rpv2Dot(hue);
        const right = d.value >= 50, youP = pos(d.value);
        const isLead = d.id === leadId;
        const lo = Math.min(50, youP), hi = Math.max(50, youP);
        const t = avg && avg[d.id] != null ? pos(avg[d.id]) : null;
        const poleStyle = (isLean) => ({ fontFamily: 'var(--sans)', fontSize: isLead ? 12.5 : 11.5, whiteSpace: 'nowrap', fontWeight: isLean ? 700 : 500, color: isLean ? rpv2Deep(hue) : 'var(--ink-3)' });
        return (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...poleStyle(!right), width: 68, flexShrink: 0, textAlign: 'right' }}>{pp[0]}</span>
            <div style={{ position: 'relative', flex: 1, height: 15 }}>
              <span className="rpv2-bar" style={{ position: 'absolute', top: '50%', marginTop: isLead ? -2.5 : -1.5, height: isLead ? 5 : 3, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, transformOrigin: right ? 'left' : 'right', animationDelay: `calc(var(--rv-row) * ${i})`, background: `linear-gradient(${right ? '90deg' : '270deg'}, color-mix(in oklch, ${col}, transparent 80%), ${col})` }}></span>
              {t != null && <span style={{ position: 'absolute', top: '50%', left: `${t}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)', opacity: 0.6 }}></span>}
              <span className="rpv2-pop" style={{ position: 'absolute', top: '50%', left: `${youP}%`, transform: 'translate(-50%,-50%)', width: isLead ? 15 : 12, height: isLead ? 15 : 12, borderRadius: '50%', background: col, border: '2px solid var(--surface-2)', boxShadow: '0 1px 4px -1px rgba(20,20,40,0.3)', animationDelay: `${i * 60 + 150}ms` }}></span>
            </div>
            <span style={{ ...poleStyle(right), width: 68, flexShrink: 0, textAlign: 'left' }}>{pp[1]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── where you stand — every dim with your score, and the stretch between the
// average person and you drawn as a length. Biggest differences sort to the top.
//
// The percentile under the top row has two sources and they are not
// interchangeable (D157). LIVE: `axisRank` COUNTS the sampled people below
// you and the line names how many it counted. DEMO: the logistic below,
// which assumes σ≈15 dim points across people and applies it to your
// distance from an authored constant. That was the only source, on both
// builds, and it printed "members" — a claim about this app's population
// from two stacked assumptions. It stays for the demo build alone, where
// the population it describes is itself invented.
function rpv2Pctl(diff) {
  const p = 1 / (1 + Math.exp(-1.702 * (diff / 15)));
  const n = Math.max(1, Math.min(9, Math.round((diff > 0 ? p : 1 - p) * 10)));
  return `${diff > 0 ? 'higher' : 'lower'} than ${n} in 10`;
}
// The one line under the top row. Measured where it can be, absent where
// it cannot, and it never says "members" any more: a percentile counted
// over a bounded sample has to name the sample, or it is claiming the
// whole population from forty people.
function PctlLine({ testKey, d, diff, src }) {
  const line = { fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: -3, marginBottom: 7 };
  if (src === 'authored') {
    return Math.abs(diff) >= 6
      ? <div style={line}>{rpv2Pctl(diff)} members</div>
      : null;
  }
  const rank = axisRank(testKey, d.id, d.value);
  if (!rank) return null;
  return (
    <div style={line} title={`counted over the ${rank.people} people this session has scores for`}>
      {rank.above ? 'higher' : 'lower'} than {rank.outOfTen} in 10 of the {rank.people} people counted here
    </div>
  );
}

function DifferRows({ testKey, R, cfg }) {
  const norm = testNorm(testKey);
  const avg = norm.avg;
  const ph = IS_STANDOUT[testKey] || {};
  // No early return on a missing baseline any more: your own scores are
  // yours and render whatever the crowd looks like. What an absent
  // baseline removes is the COMPARISON — the hollow ring, the stretch bar
  // and the percentile — and the card says so once, below.
  const rows = R.dims.map((d, i) => ({ d, i, diff: avg[d.id] != null ? d.value - avg[d.id] : 0 }))
    .sort((m, n) => Math.abs(n.diff) - Math.abs(m.diff));
  const pos = (v) => 4 + (Math.max(0, Math.min(100, v)) / 100) * 92;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
      {rows.map(({ d, i, diff }, k) => {
        const hue = cfg.hues[d.id] != null ? cfg.hues[d.id] : (30 + i * 47) % 360;
        const col = rpv2Dot(hue), deep = rpv2Deep(hue);
        // null, not a number, when this axis has no measured baseline —
        // `pos(undefined)` is NaN, which CSS drops silently and would have
        // left the ring stacked at the left edge of every row.
        const a = avg[d.id] != null ? pos(avg[d.id]) : null;
        const y = pos(d.value);
        const lo = a == null ? 0 : Math.min(a, y), hi = a == null ? 0 : Math.max(a, y);
        const stand = Math.abs(diff) >= 6 && ph[d.id];
        const title = stand ? ph[d.id][diff > 0 ? 1 : 0] : d.label;
        const pp = cfg.poles && cfg.poles[d.id];
        const right = d.value >= 50;
        const f0 = cfg.bipolar ? pos(50) : pos(0);
        const fl = Math.min(f0, y), fw = Math.max(f0, y) - Math.min(f0, y);
        const poleStyle = (isLean) => ({ fontFamily: 'var(--sans)', fontSize: 10.5, whiteSpace: 'nowrap', fontWeight: isLean ? 700 : 500, color: isLean ? deep : 'var(--ink-3)', width: 62, flexShrink: 0 });
        return (
          <div key={d.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{title.charAt(0).toUpperCase() + title.slice(1)}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800, color: deep, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }} title={a == null ? 'no crowd average for this axis yet' : diff === 0 ? 'right at the average' : `${Math.abs(Math.round(diff))} points ${diff > 0 ? 'above' : 'below'} most people`}>{Math.round(d.value)}</span>
            </div>
            {k === 0 ? <PctlLine testKey={testKey} d={d} diff={diff} src={norm.src} /> : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pp ? <span style={{ ...poleStyle(!right), textAlign: 'right' }}>{pp[0]}</span> : null}
              <div style={{ position: 'relative', flex: 1, height: 18 }}>
                <span style={{ position: 'absolute', top: 5, bottom: 5, left: 0, right: 0, borderRadius: 999, background: `color-mix(in oklch, ${col} 10%, var(--surface-3))` }}></span>
                <span style={{ position: 'absolute', top: 5, bottom: 5, borderRadius: 999, left: `${fl}%`, width: `${fw}%`, background: `color-mix(in oklch, ${col}, transparent 42%)` }}></span>
                {a != null && hi - lo > 1.5 ? <span style={{ position: 'absolute', top: 7, bottom: 7, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, background: deep }}></span> : null}
                {cfg.bipolar ? <span style={{ position: 'absolute', top: 3, bottom: 3, left: '50%', width: 1.5, marginLeft: -0.75, borderRadius: 1, background: 'var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)' }}></span> : null}
                {a != null ? <span style={{ position: 'absolute', top: '50%', left: `${a}%`, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--ink-3)', boxShadow: '0 0 0 1.5px var(--surface)' }}></span> : null}
                <span style={{ position: 'absolute', top: '50%', left: `${y}%`, transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', background: col, border: '2.5px solid var(--surface)', boxShadow: `0 1px 5px -1px color-mix(in oklch, ${col}, transparent 40%)` }}></span>
              </div>
              {pp ? <span style={{ ...poleStyle(right), textAlign: 'left' }}>{pp[1]}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── the v2 card: banner (identity + rarity + near-misses) → native chart → differ ──
// Exported by name (D39, "convert on touch"): the test overlay shows the
// same card, and imports it rather than waiting on a global.
export function ResultProfileCard({ testKey, archetype, tagline }) {
  const [typesOpen, setTypesOpen] = React.useState(false);
  const [explain, setExplain] = React.useState(false);
  const R = ownResult(testKey);
  const cfg = RP_TESTS[testKey];
  if (!R || !cfg || !R.dims || !R.dims.length) return null;
  const arch = IS_matchArchetype(testKey, R.dims);
  const you = arch ? arch.idx : -1;
  const fits = arch ? arch.fits : null;
  // The dot field's number, measured where it can be (D157).
  //
  // `IS_profileRarity` is exp(−0.916·z^2.33) over your RMS distance from
  // the AUTHORED baseline, divided by an assumed 15-point scatter — a
  // curve its own comment calls "fitted", to nothing this app measured.
  // `rarityAmong` counts how many of the sampled people sit at least as
  // far out as you, and returns null rather than a number when there are
  // too few of them to count over: the field then does not draw, which is
  // the whole difference between this and what shipped.
  const rar = (() => {
    const measured = rarityAmong(testKey, R.dims);
    if (measured) {
      const common = measured.pct >= 20;
      return {
        pct: measured.pct,
        label: common ? measured.pct + ' IN 100' : '1 IN ' + Math.round(100 / measured.pct),
        note: `${measured.pct} in 100 of the ${measured.people} people this session has scores for sit as far from average as you`,
      };
    }
    if (LIVE.enabled) return null;
    const guess = IS_profileRarity(testKey, R.dims);
    return guess ? { ...guess, note: `${guess.label.toLowerCase()} sit as far from average as you` } : null;
  })();
  const ruleParts = arch ? IS_typeRuleParts(testKey, R.dims, arch.list[you]) : [];
  const near = arch ? arch.list.map((a, i) => ({ a, i, d: fits[i], rms: arch.rmsOf[i] })).filter(x => x.i !== you).sort((m, n) => m.d - n.d).slice(0, 2)
    .map((x, k) => ({ ...x, why: IS_nearWhy(testKey, R.dims, x.a), border: k === 0 && (x.rms - arch.rms) < 5 })) : [];
  // fit strength, in dim points of separation from the runner-up
  const fit = arch ? (arch.gap < 5 ? 'close' : arch.gap >= 12 && arch.rms < 12 ? 'textbook' : 'clear') : 'clear';
  const streak = fit === 'close' ? near[0].a.name.replace(/^The /, '') : null;
  // People of yours who landed on the same type — EMPTY IN LIVE MODE (D72).
  //
  // `IS_DATA.people` is the prototype's invented circle and
  // `IS_FRIEND_TYPES` assigns each of them a type per test; both are demo
  // content, and data/live.ts replaces WORLD_FEED_QS, TEST_FEED_QS and
  // WORLD_FEED_COMMENTS but has never touched IS_DATA. So a live account
  // that finished a test — which the passive tests do from ordinary feed
  // answers, with no sit-down flow — got up to four invented people drawn on
  // its own result as though they were contacts. D1's words are "no seeded
  // fake users, ever", and this was the one surface still doing it.
  //
  // Not a load-order guard: IS_DATA is an import and cannot be unset. The
  // empty list needs no branch downstream — SigEmblem already maps over it,
  // and an empty list maps to nothing.
  const sameType = (() => {
    if (!arch || LIVE.enabled) return [];
    const map = IS_FRIEND_TYPES[testKey] || {};
    const ppl = IS_DATA.people || [];
    return ppl.filter(p => map[p.id] === arch.list[you].name);
  })();
  const typeLine = arch ? arch.list[you].line : null;
  const sigDims = (a) => R.dims.map(d => ({ id: d.id, label: d.id, value: a.sig[d.id] != null ? a.sig[d.id] : 50 }));
  // Passive coverage: how much of this test the feed has mapped so far.
  //
  // In live mode the fold's own numbers, not PASSIVE's. PASSIVE counts a
  // device-local `seen` map against the LOCAL instrument's length, so on a
  // second device it reads zero for a profile that is complete, and it
  // counts nothing the bank served that the definition no longer defines.
  // R.answered / R.total come from the same join that produced the dims,
  // so the bar and the chart above it are one reading. (PASSIVE stays the
  // source in demo mode, where its seeded stagger IS the content.)
  const pct = R.passive ? Math.round((R.answered / Math.max(1, R.total)) * 100) : PASSIVE.pct(testKey);
  const nLeft = R.passive
    ? Math.max(0, R.total - R.answered)
    : Math.max(0, PASSIVE.needed(testKey) - PASSIVE.done(testKey));
  // Whether the crowd half of this card has anything behind it. Not a
  // gate on the SECTION any more (your own scores are yours) — a gate on
  // the legend and the comparison marks inside it.
  const norm = testNorm(testKey);
  const hasAvg = Object.keys(norm.avg).length > 0;
  const hero = TestRose ? <TestRose testKey={testKey} dims={R.dims} animate={true} /> : null;
  const otherAxes = null;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
      <div title={pct < 100 ? `${nLeft} more answers to fully map this` : 'fully mapped'} style={{ height: 3, background: `color-mix(in oklch, ${cfg.banner} 14%, var(--surface-3))` }}>
        <div className="rpv2-bar" style={{ height: '100%', width: `${pct}%`, background: cfg.banner, transformOrigin: 'left' }}></div>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(115deg, color-mix(in oklch, ${cfg.banner} 17%, var(--surface)) 0%, color-mix(in oklch, ${cfg.banner} 6%, var(--surface)) 78%)`, borderBottom: `0.5px solid color-mix(in oklch, ${cfg.banner} 28%, var(--rule))`, padding: '15px 18px 16px' }}>
        <SigEmblem testKey={testKey} sig={arch ? arch.list[you].sig : R.dims.reduce((o, d) => (o[d.id] = d.value, o), {})} color={cfg.banner} people={sameType} typeName={arch ? arch.list[you].name : null} />
        <div style={{ position: 'relative', zIndex: 1, paddingRight: 96 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span className="kicker" style={{ color: cfg.banner, marginBottom: 0 }}>{cfg.kicker}</span>
              <ExplainBtn onClick={() => setExplain(true)} label="What this measures" />
            </span>
            {pct >= 100 && fit === 'textbook' ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: cfg.banner, whiteSpace: 'nowrap' }}>textbook fit</span> : null}
          </div>
          {ruleParts.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
              {ruleParts.map((p, i) => {
                const h = cfg.hues[p.id] != null ? cfg.hues[p.id] : 40;
                const w = p.band === 'strong' ? 9 : 7, hh = p.band === 'strong' ? 8 : 6;
                return (
                  <React.Fragment key={p.id}>
                    {i ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>+</span> : null}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.005em', color: rpv2Deep(h) }}>
                      {p.band === 'even'
                        ? <svg width="9" height="8" viewBox="0 0 9 8" style={{ flexShrink: 0 }} role="img" aria-label="average"><rect x="0" y="3" width="9" height="2" fill={rpv2Dot(h)}></rect></svg>
                        : <svg width={w} height={hh} viewBox={`0 0 ${w} ${hh}`} style={{ flexShrink: 0, transform: p.high ? 'none' : 'rotate(180deg)' }} role="img" aria-label={p.high ? 'above average' : 'below average'}><path d={`M${w / 2} 0 L${w} ${hh} L0 ${hh} Z`} fill={rpv2Dot(h)}></path></svg>}
                      {p.text}
                    </span>
                  </React.Fragment>
                );
              })}
              <span aria-hidden="true" style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', opacity: 0.7 }}>{'→'}</span>
            </div>
          ) : null}
          <div style={{ fontFamily: 'var(--sans)', fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, textTransform: 'capitalize', color: `color-mix(in oklch, ${cfg.banner} 78%, var(--ink))`, marginTop: ruleParts.length ? 3 : 9 }}>{arch ? arch.list[you].name : archetype}</div>
          {streak ? <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: `color-mix(in oklch, ${cfg.banner} 72%, var(--ink))`, marginTop: 4, lineHeight: 1.35 }}>with a {streak} streak</div> : null}
          {(typeLine || tagline) ? <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4, textWrap: 'pretty' }}>{typeLine || tagline}</div> : null}
          {rar ? <div style={{ marginTop: 14 }}><RarityField pct={rar.pct} label={rar.label.toLowerCase()} color={cfg.banner} title={rar.note + (sameType.length ? ` — also this type: ${sameType.map(p => p.name.split(' ')[0]).join(', ')}` : '')} /></div> : null}
        </div>
      </div>
      <div style={{ padding: '10px 16px 16px' }}>
        {hero}
        {hero ? <div style={{ textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{cfg.bipolar ? 'petal length = how far from the middle you sit' : 'petal length = how strongly the trait shows'}</div> : null}
        {arch ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            {near.map(({ a, why, border }) => (
              <span key={a.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 5px', borderRadius: 999, background: border ? `color-mix(in oklch, ${cfg.banner} 8%, var(--surface))` : 'var(--surface)', border: `0.5px solid ${border ? `color-mix(in oklch, ${cfg.banner} 45%, var(--rule))` : 'var(--rule)'}`, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                {window.TypeMark ? <window.TypeMark testKey={testKey} name={a.name} size={20} /> : (RoseMini ? <RoseMini testKey={testKey} dims={sigDims(a)} size={18} /> : null)}{a.name}
                {why ? <span style={{ fontWeight: 500, color: 'var(--ink-3)' }}>if {why}</span> : null}
              </span>
            ))}
            {window.TypeIndexSheet ? <button className="press" onClick={() => setTypesOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 999, background: 'none', border: '0.5px solid var(--rule)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>All {arch.list.length} types <span aria-hidden="true">{'\u203A'}</span></button> : null}
          </div>
        ) : null}
        {typesOpen && window.TypeIndexSheet ? <window.TypeIndexSheet testKey={testKey} onClose={() => setTypesOpen(false)} /> : null}
        {otherAxes ? (
          <div style={{ marginTop: 6, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
            <TensionSpine dims={otherAxes} poles={cfg.poles} hues={cfg.hues} avg={norm.avg} />
          </div>
        ) : null}
        <div style={{ marginTop: testKey === 'values' ? 6 : 4, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Where you stand</div>
          <DifferRows testKey={testKey} R={R} cfg={cfg} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 15, paddingTop: 12, borderTop: '0.5px solid var(--rule)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: cfg.banner, border: '2px solid var(--surface-2)', boxShadow: '0 0 0 0.5px var(--rule)' }}></span>you
            </span>
            {/* The legend names a mark. With no measured baseline there is
                no mark on any row, so naming it would be furniture
                describing something that is not drawn — the line says what
                is missing instead. */}
            {hasAvg ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)' }}></span>most people
              </span>
            ) : (
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>
                no crowd average yet
              </span>
            )}
          </div>
        </div>
      </div>
      {explain ? (
        <ExplainSheet title={R.title} kicker="test" dimKey={testKey}
          dims={R.dims.map((d) => ({ ...d, poles: cfg.poles ? cfg.poles[d.id] : null }))}
          keyRows={[
            [EX_GLYPH.you(cfg.banner), 'The solid dot is you.'],
            // Only while the ring exists (D157). A key that explains a mark
            // the card is not drawing is the same fault as the mark itself,
            // one sheet deeper: it tells the reader a comparison is on
            // screen when none is.
            ...(hasAvg ? [[EX_GLYPH.most(), 'The hollow ring is where most people sit.']] : []),
            [EX_GLYPH.petal(cfg.banner), cfg.bipolar ? 'Petal length is how far from the middle you sit.' : 'Petal length is how strongly the trait shows.'],
          ]}
          onClose={() => setExplain(false)} />
      ) : null}
    </div>
  );
}

Object.assign(window, { ResultProfileCard });

;globalThis.DifferRows = typeof DifferRows === 'undefined' ? globalThis.DifferRows : DifferRows;
;globalThis.ResultProfileCard = typeof ResultProfileCard === 'undefined' ? globalThis.ResultProfileCard : ResultProfileCard;
