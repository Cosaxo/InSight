// result-rose.jsx — the "results profile" treatment for the per-test
// profile tabs. Every test speaks one visual language:
//   1. a tinted archetype banner (each test owns a hue family)
//   2. a petal rose — petal length = score, one hue per trait
//   3. pole rows — the same scores on their bipolar axes, vs most people
// Colours link chart ↔ rows, so almost no labels are repeated.

// ── Per-test config: banner colour, hue per dimension, pole pairs ──
const RP_TESTS = {
  big5: {
    banner: 'oklch(0.48 0.11 30)',
    kicker: 'Personality · Big Five',
    hues: { O: 50, C: 75, E: 95, A: 25, N: 0 },
    poles: {
      O: ['practical', 'curious'],
      C: ['flexible', 'disciplined'],
      E: ['reserved', 'outgoing'],
      A: ['direct', 'warm'],
      N: ['steady', 'sensitive'],
    },
  },
  political: {
    banner: 'oklch(0.46 0.095 240)',
    kicker: 'Politics · Six axes',
    bipolar: true,
    hues: { econ: 235, auth: 265, foreign: 195, env: 170, tech: 215, estab: 285 },
    poles: {
      econ:    ['left', 'right'],
      auth:    ['liberty', 'order'],
      foreign: ['national', 'global'],
      env:     ['growth', 'green'],
      tech:    ['caution', 'optimism'],
      estab:   ['establishment', 'outsider'],
    },
  },
  values: {
    banner: 'oklch(0.45 0.10 320)',
    kicker: 'Values · Six tensions',
    bipolar: true,
    hues: { future: 322, circle: 344, hedonism: 6, meaning: 28, moral: 282, beauty: 312 },
    poles: {
      future:   ['pessimist', 'hopeful'],
      circle:   ['close', 'wide'],
      hedonism: ['duty', 'pleasure'],
      meaning:  ['happiness', 'suffering'],
      moral:    ['relativist', 'objectivist'],
      beauty:   ['truth', 'beauty'],
    },
  },
  attachment: {
    banner: 'oklch(0.47 0.09 155)',
    kicker: 'Social · The friend you are',
    hues: { warm: 120, loyal: 150, open: 180, play: 95, easy: 205 },
    poles: {
      warm:  ['reserved', 'warm'],
      loyal: ['light-touch', 'loyal'],
      open:  ['guarded', 'open'],
      play:  ['grounded', 'playful'],
      easy:  ['invested', 'easygoing'],
    },
  },
};

// hue → petal fill / deep text / dot colours (same L+C family everywhere)
const rpPetal = (h) => `oklch(0.64 0.115 ${h})`;
const rpDeep  = (h) => `oklch(0.46 0.13 ${h})`;
const rpDot   = (h) => `oklch(0.55 0.13 ${h})`;

// ── Petal rose — petal length encodes the score, 0–100 ──
function RosePetals({ dims, hueOf, subOf, animate }) {
  const W = 360, H = 330, cx = 180, cy = 168, R = 92, labelR = 106, r0 = 9;
  const n = dims.length, slice = 360 / n, gapD = n > 6 ? 9 : 12;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (aDeg, r) => [cx + Math.cos(rad(aDeg)) * r, cy + Math.sin(rad(aDeg)) * r];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Trait scores as petals; longer petal = higher score">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--rule)" strokeWidth="1"></circle>
      <circle cx={cx} cy={cy} r={R / 2} fill="none" stroke="var(--rule)" strokeWidth="1" opacity="0.5"></circle>
      {dims.map((d, i) => {
        const a0 = -90 + i * slice + gapD / 2;
        const a1 = -90 + (i + 1) * slice - gapD / 2;
        const mid = (a0 + a1) / 2;
        const v = Math.max(0, Math.min(100, d.value));
        const r = r0 + (v / 100) * (R - r0);
        const [x0i, y0i] = pt(a0, r0), [x0, y0] = pt(a0, r);
        const [x1, y1] = pt(a1, r), [x1i, y1i] = pt(a1, r0);
        const hue = hueOf(d.id, i);
        const s = Math.sin(rad(mid)), c = Math.cos(rad(mid));
        const [lx, ly0] = pt(mid, labelR);
        const anchor = c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle';
        // keep labels inside the viewBox — clamp x, and nudge clamped labels
        // vertically so they clear the petal tip
        const estW = d.label.length * 6.2;
        let lx2 = lx, nudge = 0;
        if (anchor === 'start' && lx + estW > W - 4) { lx2 = W - 4 - estW; nudge = s >= 0 ? 13 : -13; }
        else if (anchor === 'end' && lx - estW < 4) { lx2 = 4 + estW; nudge = s >= 0 ? 13 : -13; }
        else if (anchor === 'middle') { lx2 = Math.max(4 + estW / 2, Math.min(W - 4 - estW / 2, lx)); }
        const ly = ly0 + (s < -0.4 ? -10 : s > 0.4 ? 10 : -3) + nudge;
        return (
          <g key={d.id}>
            <path className={animate ? 'rp-petal' : undefined} style={animate ? { transformOrigin: `${cx}px ${cy}px`, animationDelay: `${i * 75}ms` } : undefined} d={`M ${x0i.toFixed(1)} ${y0i.toFixed(1)} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x1i.toFixed(1)} ${y1i.toFixed(1)} A ${r0} ${r0} 0 0 0 ${x0i.toFixed(1)} ${y0i.toFixed(1)} Z`} fill={rpPetal(hue)}></path>
            <text x={lx2} y={ly} textAnchor={anchor} style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, fill: 'var(--ink)' }}>{d.label}</text>
            <text x={lx2} y={ly + 13} textAnchor={anchor} style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, fill: rpDeep(hue) }}>{subOf ? subOf(d) : d.value + '%'}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={4} fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="1.5"></circle>
    </svg>
  );
}

// ── RoseMini — tiny label-free rose for list cards (same encoding as TestRose) ──
function RoseMini({ testKey, dims, size = 46 }) {
  const cfg = RP_TESTS[testKey];
  if (!cfg || !dims || !dims.length) return null;
  const hueOf = (id, i) => (cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
  const ds = cfg.bipolar ? dims.map(d => ({ ...d, value: Math.min(100, Math.abs(d.value - 50) * 2) })) : dims;
  const C = size / 2, R = C - 1, r0 = 3, n = ds.length, slice = 360 / n, gapD = n > 6 ? 10 : 14;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (a, r) => [C + Math.cos(rad(a)) * r, C + Math.sin(rad(a)) * r];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
      {ds.map((d, i) => {
        const a0 = -90 + i * slice + gapD / 2, a1 = -90 + (i + 1) * slice - gapD / 2;
        const v = Math.max(14, Math.min(100, d.value));
        const r = r0 + (v / 100) * (R - r0);
        const [xa, ya] = pt(a0, r0), [xb, yb] = pt(a0, r), [xc, yc] = pt(a1, r), [xd, yd] = pt(a1, r0);
        return <path key={d.id} d={`M ${xa.toFixed(1)} ${ya.toFixed(1)} L ${xb.toFixed(1)} ${yb.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xc.toFixed(1)} ${yc.toFixed(1)} L ${xd.toFixed(1)} ${yd.toFixed(1)} A ${r0} ${r0} 0 0 0 ${xa.toFixed(1)} ${ya.toFixed(1)} Z`} fill={rpPetal(hueOf(d.id, i))}></path>;
      })}
    </svg>
  );
}

// ── Pole rows — each score on its bipolar axis, hollow ring = most people ──
function PoleRows({ dims, poles, hueOf, avg }) {
  const pos = (v) => 5 + (Math.max(0, Math.min(100, v)) / 100) * 90;
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 15 }}>
      <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 1, background: 'var(--rule)', transform: 'translateX(-50%)' }}></div>
      {dims.map((d, i) => {
        const pp = poles[d.id] || ['low', 'high'];
        const hue = hueOf(d.id, i);
        const col = rpDot(hue);
        const right = d.value >= 50;
        const youP = pos(d.value);
        const lo = Math.min(50, youP), hi = Math.max(50, youP);
        const t = avg && avg[d.id] != null ? pos(avg[d.id]) : null;
        const poleStyle = (isLean) => ({
          fontFamily: 'var(--sans)', fontSize: 11.5, letterSpacing: '0.01em', whiteSpace: 'nowrap',
          fontWeight: isLean ? 700 : 500, color: isLean ? rpDeep(hue) : 'var(--ink-3)', opacity: isLean ? 1 : 0.7,
        });
        return (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...poleStyle(!right), width: 66, flexShrink: 0, textAlign: 'right' }}>{pp[0]}</span>
            <div style={{ position: 'relative', flex: 1, height: 14 }}>
              <span style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 3, borderRadius: 999,
                left: `${lo}%`, width: `${hi - lo}%`,
                background: `linear-gradient(${right ? '90deg' : '270deg'}, color-mix(in oklch, ${col}, transparent 80%), ${col})`,
              }}></span>
              {t != null && (
                <span style={{ position: 'absolute', top: '50%', left: `${t}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)', opacity: 0.6 }}></span>
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

// ── TestRose — the rose with per-test encoding. Bipolar tests (politics,
// values) encode petal length as CONVICTION (distance from centre) and label
// each petal with the pole it leans toward — a raw 13-of-100 is a strong
// stance, not a short petal. Unipolar tests keep score = length. ──
function TestRose({ testKey, dims, animate }) {
  const cfg = RP_TESTS[testKey];
  if (!cfg || !dims || !dims.length) return null;
  const hueOf = (id, i) => (cfg.hues[id] != null ? cfg.hues[id] : (30 + i * 47) % 360);
  const roseDims = cfg.bipolar
    ? dims.map(d => ({ ...d, raw: d.value, value: Math.min(100, Math.abs(d.value - 50) * 2) }))
    : dims;
  const subOf = cfg.bipolar
    ? (d) => { const w = (cfg.poles[d.id] || ['low', 'high'])[(d.raw != null ? d.raw : d.value) >= 50 ? 1 : 0]; return w.toLowerCase() === d.label.toLowerCase() ? '' : w; }
    : null;
  return <RosePetals dims={roseDims} hueOf={hueOf} subOf={subOf} animate={animate} />;
}

Object.assign(window, { RosePetals, PoleRows, TestRose, RoseMini, RP_TESTS });
