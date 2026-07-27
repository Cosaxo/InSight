// Expanded Person profile — a detailed portrait of similarity
// Replaces the basic PersonOverlay registered in overlays.jsx

(function () {

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

// ─── Affinity dial — big match number in a circle with 5 contributing arc petals ───
function AffinityDial({ score, parts, hue }) {
  const dims = [
    { k: 'personality', label: 'PERSONALITY', col: 'oklch(0.55 0.13 38)' },
    { k: 'politics',    label: 'POLITICS',    col: 'oklch(0.50 0.12 220)' },
    { k: 'values',      label: 'VALUES',      col: 'oklch(0.52 0.14 305)' },
    { k: 'interests',   label: 'INTERESTS',   col: 'oklch(0.55 0.10 145)' },
  ];
  const total = dims.reduce((s,d) => s + parts[d.k], 0);
  const cx = 110, cy = 110, R = 92, ringW = 14;
  let start = -Math.PI / 2;
  const arcs = dims.map(d => {
    const sweep = (parts[d.k] / total) * Math.PI * 2;
    const a0 = start, a1 = start + sweep;
    start = a1;
    const large = sweep > Math.PI ? 1 : 0;
    const x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R;
    const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
    const xi0 = cx + Math.cos(a0) * (R - ringW), yi0 = cy + Math.sin(a0) * (R - ringW);
    const xi1 = cx + Math.cos(a1) * (R - ringW), yi1 = cy + Math.sin(a1) * (R - ringW);
    const path = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${R - ringW} ${R - ringW} 0 ${large} 0 ${xi0} ${yi0} Z`;
    return { ...d, path, mid: (a0 + a1) / 2, share: Math.round((parts[d.k] / total) * 100), val: Math.round(parts[d.k]) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
        <svg viewBox="0 0 220 220" width="220" height="220">
          {/* faint scale ticks */}
          {Array.from({ length: 40 }).map((_, i) => {
            const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
            const r1 = R + 2, r2 = R + (i % 5 === 0 ? 7 : 4);
            return <line key={i}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="var(--rule)" strokeWidth={i % 5 === 0 ? 0.6 : 0.3} />;
          })}
          {/* petals */}
          {arcs.map((a, i) => (
            <g key={i}>
              <path d={a.path} fill={a.col} opacity="0.85" />
            </g>
          ))}
          {/* inner ring */}
          <circle cx={cx} cy={cy} r={R - ringW - 1} fill="var(--surface)" stroke="var(--rule)" strokeWidth="0.5" />
          <circle cx={cx} cy={cy} r={R - ringW - 8} fill="none" stroke="var(--rule)" strokeWidth="0.4" strokeDasharray="1.5 2.5" />
          {/* big match number */}
          <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="56" fill="var(--ink)" letterSpacing="-0.02em">{score}</text>
          <text x={cx} y={cy + 22} textAnchor="middle" fontFamily="var(--mono)" fontSize="10.5" fill="var(--ink-3)" letterSpacing="0.18em">AFFINITY · /100</text>
          {/* arc labels */}
          {arcs.map((a, i) => {
            const r = R + 14;
            const x = cx + Math.cos(a.mid) * r, y = cy + Math.sin(a.mid) * r;
            const anchor = Math.cos(a.mid) > 0.2 ? 'start' : Math.cos(a.mid) < -0.2 ? 'end' : 'middle';
            return null; // labels live in side legend for clarity
          })}
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.14em', marginBottom: 8 }}>BROKEN DOWN BY ·</div>
        {arcs.map(a => (
          <div key={a.k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, background: a.col, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.1em', width: 78, flexShrink: 0 }}>{a.label}</span>
            <div style={{ flex: 1, height: 4, background: 'var(--surface-3)', border: '0.5px solid var(--rule)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${a.val}%`, height: '100%', background: a.col }} />
            </div>
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13, color: 'var(--ink)', width: 26, textAlign: 'right' }}>{a.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dual political compass — you + them on the same plane, with thread + landmarks ───
function DualCompass({ me, prof, hue }) {
  const D = window.IS_DATA;
  const size = 320, pad = 28;
  const toX = (econ) => pad + ((econ + 100) / 200) * (size - pad * 2);
  const toY = (social) => pad + ((100 - social) / 200) * (size - pad * 2); // social: -100 liberty -> top? we'll do +social=authority at bottom
  // we'll use the convention from PoliticsCompass: y = -social, so positive social = down
  const Y = (social) => pad + ((social + 100) / 200) * (size - pad * 2);

  const youX = toX(me.political.econ),    youY = Y(-me.political.social);
  const themX = toX(prof.political.econ), themY = Y(-prof.political.social);
  const dist = Math.sqrt(Math.pow(me.political.econ - prof.political.econ, 2) + Math.pow(me.political.social - prof.political.social, 2));
  const themColor = `oklch(0.55 0.14 ${hue})`;

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ maxWidth: size, display: 'block', margin: '0 auto' }}>
        {/* outer frame */}
        <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} fill="var(--surface-3)" opacity="0.4" stroke="var(--ink-2)" strokeWidth="0.5" />
        {/* fine grid */}
        {[-50, 50].map(v => (
          <g key={v}>
            <line x1={toX(v)} y1={pad} x2={toX(v)} y2={size - pad} stroke="var(--rule)" strokeWidth="0.3" strokeDasharray="1.5 2" />
            <line x1={pad} y1={Y(v)} x2={size - pad} y2={Y(v)} stroke="var(--rule)" strokeWidth="0.3" strokeDasharray="1.5 2" />
          </g>
        ))}
        {/* midlines */}
        <line x1={toX(0)} y1={pad} x2={toX(0)} y2={size - pad} stroke="var(--ink-2)" strokeWidth="0.5" />
        <line x1={pad} y1={Y(0)} x2={size - pad} y2={Y(0)} stroke="var(--ink-2)" strokeWidth="0.5" />

        {/* ideology landmarks */}
        {D.ideologies.map(io => (
          <g key={io.id} opacity="0.6">
            <circle cx={toX(io.econ)} cy={Y(-io.social)} r="2.2" fill="oklch(0.50 0.06 250)" />
            <text x={toX(io.econ) + 4.5} y={Y(-io.social) + 3.5}
              fontFamily="var(--serif)" fontStyle="italic" fontSize="12" fill="oklch(0.45 0.08 250)">
              {io.name}
            </text>
          </g>
        ))}
        {/* thinker marks */}
        {D.ideologyMarks.slice(0, 4).map(m => (
          <g key={m.name} opacity="0.5">
            <text x={toX(m.econ)} y={Y(-m.social)} textAnchor="middle"
              fontFamily="var(--mono)" fontSize="10.5" fill="var(--ink-3)" letterSpacing="0.04em">· {m.name} ·</text>
          </g>
        ))}

        {/* thread between you and them */}
        <line x1={youX} y1={youY} x2={themX} y2={themY}
          stroke="var(--ink-2)" strokeWidth="0.7" strokeDasharray="2 2.4" />
        {/* distance label */}
        <text
          x={(youX + themX) / 2 + 6}
          y={(youY + themY) / 2 - 4}
          fontFamily="var(--mono)" fontSize="12" fill="var(--ink-2)" letterSpacing="0.1em">
          Δ {Math.round(dist)}
        </text>

        {/* your dot */}
        <g>
          <circle cx={youX} cy={youY} r="7" fill="var(--ink)" />
          <circle cx={youX} cy={youY} r="13" fill="none" stroke="var(--ink)" strokeWidth="0.5" strokeDasharray="2 2" />
          <text x={youX} y={youY - 16} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="13" fill="var(--ink)">you</text>
        </g>
        {/* their dot */}
        <g>
          <circle cx={themX} cy={themY} r="7" fill={themColor} />
          <circle cx={themX} cy={themY} r="13" fill="none" stroke={themColor} strokeWidth="0.5" strokeDasharray="2 2" />
          <text x={themX} y={themY + 22} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="13" fill={themColor}>them</text>
        </g>

        {/* axis labels */}
        <text x={pad - 4} y={Y(0) - 4} fontFamily="var(--mono)" fontSize="11.5" fill="var(--ink-3)" letterSpacing="0.1em">← LEFT</text>
        <text x={size - pad + 4} y={Y(0) - 4} textAnchor="end" fontFamily="var(--mono)" fontSize="11.5" fill="var(--ink-3)" letterSpacing="0.1em">RIGHT →</text>
        <text x={toX(0) + 4} y={pad - 6} fontFamily="var(--mono)" fontSize="11.5" fill="var(--ink-3)" letterSpacing="0.1em">↑ LIBERTY</text>
        <text x={toX(0) + 4} y={size - pad + 12} fontFamily="var(--mono)" fontSize="11.5" fill="var(--ink-3)" letterSpacing="0.1em">↓ AUTHORITY</text>
      </svg>
    </div>
  );
}

// ─── Trait bridges — paired sliders for values/morals (you · them) ───
function TraitBridges({ rows, hue }) {
  const themColor = `oklch(0.55 0.13 ${hue})`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      {rows.map(r => {
        const youPct = (r.you + 100) / 2;
        const themPct = (r.them + 100) / 2;
        const delta = Math.abs(Math.round(r.you - r.them));
        const left = Math.min(youPct, themPct);
        const right = Math.max(youPct, themPct);
        return (
          <div key={r.k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              <span>{r.l}</span>
              <span style={{ color: 'var(--ink-2)' }}>{r.k}<span style={{ marginLeft: 6, color: delta < 25 ? 'oklch(0.50 0.12 145)' : delta > 60 ? 'oklch(0.55 0.14 25)' : 'var(--ink-3)' }}>Δ{delta}</span></span>
              <span>{r.r}</span>
            </div>
            <div style={{ height: 9, background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 999, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '50%', top: -3, width: 1, height: 15, background: 'var(--rule)' }} />
              {/* overlap shading */}
              <span style={{ position: 'absolute', left: `${left}%`, width: `${right - left}%`, top: 0, bottom: 0, background: 'oklch(0.85 0.03 250 / 0.4)' }} />
              {/* you */}
              <span style={{ position: 'absolute', left: `calc(${youPct}% - 7px)`, top: -3, width: 14, height: 14, background: 'var(--ink)', borderRadius: '50%', border: '1.5px solid var(--surface)' }} />
              {/* them */}
              <span style={{ position: 'absolute', left: `calc(${themPct}% - 7px)`, top: -3, width: 14, height: 14, background: themColor, borderRadius: '50%', border: `1.5px solid var(--surface)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared / divergent interests, three columns ───
function InterestVenn({ me, p, hue }) {
  const cats = window.IS_DATA.interestCats;
  const themColor = `oklch(0.55 0.13 ${hue})`;
  const myList = me.myInterests;
  const theirList = p.interests || [];

  const myCats = new Map(myList.map(i => [i.t.toLowerCase(), i]));
  const theirCats = new Map(theirList.map(i => [i.t.toLowerCase(), i]));

  // overlap by category
  const myCatSet = new Set(myList.map(i => i.c));
  const theirCatSet = new Set(theirList.map(i => i.c));

  const shared = [...myCatSet].filter(c => theirCatSet.has(c));
  const onlyYou = myList.filter(i => !theirCatSet.has(i.c));
  const onlyThem = theirList.filter(i => !myCatSet.has(i.c));
  const sharedYouItems = myList.filter(i => shared.includes(i.c));
  const sharedThemItems = theirList.filter(i => shared.includes(i.c));

  const emptyMark = <span style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 12, color: 'var(--ink-3)' }}>—</span>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={{ gridColumn: '1 / 3', padding: '10px 12px', background: 'oklch(0.96 0.02 80)', border: '0.5px solid var(--rule)', borderRadius: 8 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.12em', marginBottom: 6 }}>SHARED MARGINS · {shared.length} categories overlap</div>
        <div>
          {sharedYouItems.length === 0 && sharedThemItems.length === 0
            ? <span style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 12, color: 'var(--ink-3)' }}>no overlap</span>
            : <InterestRun items={[...new Map([...sharedYouItems, ...sharedThemItems].map(i => [i.t, i])).values()]} size={13} color="var(--ink)" />}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', letterSpacing: '0.12em', marginBottom: 6 }}>· ONLY YOU</div>
        <div>
          {onlyYou.length === 0
            ? emptyMark
            : <InterestRun items={onlyYou} size={12.5} />}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: themColor, letterSpacing: '0.12em', marginBottom: 6 }}>· ONLY THEM</div>
        <div>
          {onlyThem.length === 0
            ? emptyMark
            : <InterestRun items={onlyThem} size={12.5} color={`oklch(0.4 0.09 ${hue})`} dotColor={`oklch(0.65 0.07 ${hue})`} />}
        </div>
      </div>
    </div>
  );
}

// ─── Generated "where the lines cross" — small narrative ───
function alignmentNotes(me, prof, p) {
  const out = { converge: [], diverge: [] };

  const polAxes = window.IS_DATA.politicalAxes;
  // converge — small gaps
  polAxes.forEach(ax => {
    const d = Math.abs(me.political[ax.id] - prof.political[ax.id]);
    if (d < 22) out.converge.push(`both lean ${me.political[ax.id] >= 0 ? ax.poles[1] : ax.poles[0]} on ${ax.label}`);
    if (d > 70) out.diverge.push(`split on ${ax.label} — ${me.political[ax.id] >= 0 ? 'you ' + ax.poles[1] : 'you ' + ax.poles[0]}, they ${prof.political[ax.id] >= 0 ? ax.poles[1] : ax.poles[0]}`);
  });

  // morals
  const moralLabels = {
    future: ['pessimist','optimist'], circle: ['family-first','wide circle'],
    hedonism: ['duty','pleasure'], meaning: ['happy-only','suffering matters'],
    moral: ['relativist','objectivist'], beauty: ['truth-only','beauty matters'],
  };
  Object.entries(moralLabels).forEach(([k, [l, r]]) => {
    const d = Math.abs(me.morals[k] - prof.morals[k]);
    const side = (v) => v >= 0 ? r : l;
    if (d < 20) out.converge.push(`agree on ${k} — both ${side(me.morals[k])}`);
    if (d > 75) out.diverge.push(`disagree on ${k} — you ${side(me.morals[k])}, they ${side(prof.morals[k])}`);
  });

  // big5
  ['O','C','E','A','N'].forEach(k => {
    const d = Math.abs(me.personality[k] - prof.big5[k]);
    const name = { O:'openness', C:'discipline', E:'extraversion', A:'warmth', N:'sensitivity' }[k];
    if (d > 30) out.diverge.push(`differ in ${name} — Δ${Math.round(d)}`);
  });

  return {
    converge: out.converge.slice(0, 4),
    diverge: out.diverge.slice(0, 3),
  };
}

// ─── The new, expanded PersonOverlay ───
// ─── tiny seeded RNG so each person's derived data is stable across renders ───
function pRng(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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

// ─── Genetic kinship — shared DNA + how alike your inherited traits run ───
function GeneticKinship({ p, hue }) {
  const themColor = `oklch(0.52 0.14 ${hue})`;
  const rng = pRng('dna|' + (p.id || p.init || p.name || 'x'));
  const rel = (p.rel || p.role || '').toLowerCase();
  let sharedPct, relation;
  if (/sister|brother|sibling/.test(rel)) { sharedPct = 49 + rng() * 4; relation = 'full sibling'; }
  else if (/mother|father|mom|dad|parent|son|daughter/.test(rel)) { sharedPct = 50; relation = 'parent & child'; }
  else if (/grand/.test(rel)) { sharedPct = 23 + rng() * 4; relation = 'grandparent line'; }
  else if (/cousin/.test(rel)) { sharedPct = 10 + rng() * 5; relation = 'first cousin'; }
  else if (/wife|husband|partner|spouse/.test(rel)) { sharedPct = 0.05 + rng() * 0.25; relation = 'unrelated'; }
  else { const distant = rng() < 0.3; sharedPct = distant ? (0.6 + rng() * 1.6) : (0.03 + rng() * 0.4); relation = distant ? 'distant cousin' : 'no recent ancestor'; }
  const close = sharedPct > 5;
  const cM = Math.round(sharedPct / 100 * 6800);
  const segments = close ? Math.round(18 + rng() * 38) : Math.round(rng() * 6);
  const longest = close ? Math.round(45 + rng() * 170) : Math.round(rng() * 16);
  const sameHaplo = rng() < (close ? 0.9 : 0.18);
  const traits = [
    { l: 'caffeine metabolism' }, { l: 'morningness' }, { l: 'endurance type' },
    { l: 'bitter-taste sensitivity' }, { l: 'lactose tolerance' },
  ].map(t => ({ ...t, v: Math.round(38 + rng() * 60) }));

  const facts = [
    { k: 'SHARED cM', v: cM.toLocaleString() },
    { k: 'SEGMENTS', v: segments },
    { k: 'LONGEST', v: longest + ' cM' },
    { k: 'HAPLOGROUP', v: sameHaplo ? 'shared' : 'differs' },
  ];

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>Genetic kinship</Kicker>
      <div className="margin-note" style={{ fontSize: 15, marginTop: 4, marginBottom: 12 }}>
        shared DNA, and how alike your inherited traits run.
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span className="fig-num" style={{ fontSize: 46, lineHeight: 0.9, color: themColor }}><em>{sharedPct < 1 ? sharedPct.toFixed(2) : sharedPct.toFixed(1)}</em></span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>%</span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: 3 }}>DNA SHARED</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 17, color: 'var(--ink)' }}>{relation}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: 2 }}>PREDICTED RELATION</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
        {facts.map(f => (
          <div key={f.k} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 6 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink)' }}>{f.v}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 3 }}>{f.k}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>Inherited-trait similarity</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {traits.map(t => (
          <div key={t.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 124, flexShrink: 0, fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13, color: 'var(--ink-2)' }}>{t.l}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', border: '0.5px solid var(--rule)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${t.v}%`, height: '100%', background: themColor, borderRadius: 999 }} />
            </div>
            <span style={{ flexShrink: 0, width: 26, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{t.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── What someone shares with their followers (visible once you follow them) ───
function FollowerShares({ p }) {
  const themColor = `oklch(0.50 0.14 ${p.hue})`;
  const rng = pRng('follow|' + (p.id || p.init || p.name || 'x'));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const moods = ['lifted', 'even-keel', 'tired but ok', 'quietly content', 'restless', 'absorbed', 'buoyant'];
  const lines = [
    'Long walk before the rain. Needed it.',
    'Good day at the desk — three problems down.',
    'Ran into an old friend by accident. Rare luck.',
    'Slept badly, salvaged the afternoon.',
    'Cooked properly for once. Small win.',
    "Couldn't settle today. Music helped.",
  ];
  const reading = ['Tokarczuk · Flights', 'Solnit · field notes', 'a long New Yorker piece', 'Knausgård · vol. 2', 'mostly podcasts'];
  const listening = ['Arvo Pärt', 'an old Radiohead record', 'Norwegian jazz', 'silence, mostly'];
  const areas = ['Grünerløkka', 'Torshov', 'Sagene', 'St. Hanshaugen', 'Bislett'];
  const items = [
    { k: 'TODAY', v: pick(moods) + ' · ' + (58 + Math.floor(rng() * 36)) },
    { k: 'A LINE', v: '"' + pick(lines) + '"' },
    { k: 'READING', v: pick(reading) },
    { k: 'LISTENING', v: pick(listening) },
    { k: 'AROUND', v: pick(areas) },
  ];
  const first = anonFirst(p);
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Kicker>Shared with followers</Kicker>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: themColor }}>● FOLLOWING</span>
      </div>
      <div className="margin-note" style={{ fontSize: 14, marginTop: 4, marginBottom: 12 }}>
        what {first} {p.anon ? 'share' : 'shares'} with people who follow them — no follow-back needed.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {items.map((it, i) => (
          <div key={it.k} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 0', borderTop: i === 0 ? 'none' : '0.5px solid var(--rule)' }}>
            <span style={{ width: 78, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>{it.k}</span>
            <span style={{ flex: 1, fontFamily: 'var(--serif)', fontStyle: it.k === 'A LINE' ? 'var(--voice-italic)' : 'normal', fontSize: 14, color: 'var(--ink)', lineHeight: 1.4 }}>{it.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonOverlay({ p: rawP, onClose, me }) {
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
  const closestShared = prof.closest[0];
  const [, fBump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => (window.FRIENDS ? window.FRIENDS.subscribe(fBump) : undefined), []);
  const fStatus = !p.anon && p.id && window.FRIENDS ? window.FRIENDS.status(p.id) : 'none';
  const isFriend = fStatus === 'friends';
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const onFriendBtn = () => {
    if (!window.FRIENDS || !p.id) return;
    if (fStatus === 'none') window.FRIENDS.invite(p.id);
    else if (fStatus === 'invited') window.FRIENDS.cancel(p.id);
    else setConfirmRemove(true);
  };

  return (
    <div className="overlay surface-tint">
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
          const myCatSet = new Set((me.myInterests || []).map(i => i.c));
          const sharedInts = p.interests.filter(i => myCatSet.has(i.c));
          const onlyTheirs = p.interests.filter(i => !myCatSet.has(i.c));
          const chip = (shared) => ({
            padding: '5px 12px', borderRadius: 999, fontFamily: 'var(--sans)', fontSize: 12.5, whiteSpace: 'nowrap',
            fontWeight: shared ? 700 : 500,
            background: shared ? `color-mix(in oklch, ${themColor} 14%, var(--surface-2))` : 'var(--surface)',
            border: `1px solid ${shared ? `color-mix(in oklch, ${themColor} 45%, var(--rule))` : 'var(--rule)'}`,
            color: shared ? 'var(--ink)' : 'var(--ink-3)',
          });
          const interestsSlide = {
            kind: 'interests', title: 'Interests', sub: 'shared ground',
            align: Math.round(parts.interests),
            body: (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {sharedInts.map(i => <span key={'s' + i.c} style={chip(true)}>{i.t}</span>)}
                  {onlyTheirs.map(i => <span key={'o' + i.c} style={chip(false)}>{i.t}</span>)}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  filled · you both &nbsp;·&nbsp; outline · only {who}
                </div>
              </div>
            ),
          };
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 9 }}><Kicker>What makes the number</Kicker></div>
              <window.CompareCarousel
                pop={{ big5: rnd(prof.big5), political: to01(prof.political), values: to01(prof.morals) }}
                accent={themColor} label={who}
                aligns={{ big5: Math.round(parts.personality), political: Math.round(parts.politics), values: Math.round(parts.values) }}
                extra={[interestsSlide]}
              />
            </div>
          );
        })()}

        {/* ─── Their map — read-only mind map ─── */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
            <Kicker>Their map</Kicker>
            {!isFriend && <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>Friends see the full map</span>}
          </div>
          <div style={{ height: 480, borderRadius: 18, overflow: 'hidden', border: '0.5px solid var(--rule)', background: 'var(--surface)', position: 'relative' }}>
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
