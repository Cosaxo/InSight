// Ported from design/spec-modules/consequence-beat.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// consequence-beat.jsx — the 2-second consequence after any vote: the crowd
// blooms into camps sized by the split, your dot glides to your side, the camp
// pulses once, one sentence lands. Canvas, deterministic per seed, tap to skip.
(function () {
  const st = document.createElement('style');
  st.textContent = '@keyframes cbIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';
  document.head.appendChild(st);
})();

function cbRand(seed) { let h = 2166136261; const s = String(seed); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const cbEaseOut = (x) => 1 - Math.pow(1 - x, 3);
const cbEaseInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function ConsequenceBeat({ seed, options, pcts, counts, mineIdx, height = 220, onDone }) {
  const rootRef = React.useRef(null), canvasRef = React.useRef(null), doneRef = React.useRef(false);
  const finish = () => { if (!doneRef.current) { doneRef.current = true; onDone && onDone(); } };
  const maxP = Math.max(...pcts), mineP = pcts[mineIdx];
  // name the side you picked — the number alone was never the payoff
  const mineLabel = (options[mineIdx] && options[mineIdx].label) || '';
  const chose = mineP + '% chose ' + mineLabel;
  // THE NUMBER IS A PERCENTAGE; THE VERDICT IS ABOUT VOTES. `sharePcts`
  // never inverts two counts but it can round them to the SAME integer,
  // so deciding "you're with them" off `pcts` told a voter with strictly
  // fewer votes that they had won — the same defect fixed on the line
  // under the card, which this beat is shown immediately before. Reading
  // both off percentages was at least self-consistent; reading one off
  // each would have made the beat contradict the line two seconds later.
  //
  // `counts` is optional so a caller that has none degrades exactly as
  // before rather than throwing. Today world-feed's renderBeat is the
  // only caller and it always has them.
  const rank = counts && counts.length === pcts.length ? counts : pcts;
  // Not `maxR` — that name is a RADIUS further down and shadowing it here
  // would read as the same quantity.
  const topRank = Math.max(...rank), lowRank = Math.min(...rank), myRank = rank[mineIdx];
  const msg = myRank === topRank ? chose + ' \u2014 you\u2019re with them'
    : myRank === lowRank ? 'only ' + chose + ' \u2014 you\u2019re the rare side'
    : chose + ' \u2014 you among them';

  React.useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { const t = setTimeout(finish, 400); return () => clearTimeout(t); }
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) { finish(); return; }
    // resolve CSS colors (vars, color-mix) to canvas-usable rgb
    const probe = document.createElement('span'); root.appendChild(probe);
    const resolve = (c) => { probe.style.color = c; return getComputedStyle(probe).color; };
    const campCols = options.map((o) => resolve(o.color || 'var(--ink-3)'));
    const inkCol = resolve('var(--ink)'), surfCol = resolve('var(--surface-2)');
    probe.remove();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = root.clientWidth || 300, H = height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const rand = cbRand(seed || 'beat');
    const n = options.length;
    const camps = options.map((o, i) => ({ x: W * ((i + 1) / (n + 1)), y: H * 0.5, col: campCols[i] }));
    const maxR = Math.min(W / (n * 2.6), H * 0.34);
    const rOf = pcts.map((p) => maxR * (0.4 + 0.6 * Math.sqrt(p / (maxP || 1))));
    const N = Math.round(Math.min(130, Math.max(70, W * 0.28)));
    const dots = [];
    pcts.forEach((p, campI) => {
      const cnt = Math.max(2, Math.round(N * p / 100));
      for (let k = 0; k < cnt; k++) {
        const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * rOf[campI];
        const ba = rand() * Math.PI * 2, u = Math.sqrt(rand());
        dots.push({ camp: campI,
          bx: W / 2 + Math.cos(ba) * W * 0.44 * u, by: H / 2 + Math.sin(ba) * H * 0.42 * u,
          tx: camps[campI].x + Math.cos(a) * rr, ty: camps[campI].y + Math.sin(a) * rr * 0.8,
          r: 1.8 + rand() * 1.6, ph: rand() * Math.PI * 2, d: rand() });
      }
    });
    const T1 = 160, T2 = 460, T3 = 690, T4 = 880, T5 = 1000;
    const you = { x0: W / 2, y0: H / 2, x1: camps[mineIdx].x, y1: camps[mineIdx].y };
    let raf, start;
    const frame = (now) => {
      if (!start) start = now; const t = now - start;
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        let x, y, a;
        if (t < T1) { const e = cbEaseOut(t / T1); x = W / 2 + (d.bx - W / 2) * e; y = H / 2 + (d.by - H / 2) * e; a = 0.25 + 0.5 * e; }
        else if (t < T2) { const del = d.d * 0.25, raw = (t - T1) / (T2 - T1); const e = cbEaseInOut(Math.min(1, Math.max(0, (raw - del) / (1 - del)))); x = d.bx + (d.tx - d.bx) * e; y = d.by + (d.ty - d.by) * e; a = 0.75; }
        else { x = d.tx + Math.sin(t / 900 + d.ph) * 1.2; y = d.ty + Math.cos(t / 1100 + d.ph) * 1.2; a = 0.85; }
        ctx.globalAlpha = a; ctx.fillStyle = camps[d.camp].col;
        ctx.beginPath(); ctx.arc(x, y, d.r, 0, 6.2832); ctx.fill();
      }
      if (t >= T3 && t < T3 + 600) {
        const e = (t - T3) / 600;
        ctx.globalAlpha = (1 - e) * 0.5; ctx.strokeStyle = camps[mineIdx].col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(camps[mineIdx].x, camps[mineIdx].y, rOf[mineIdx] * (0.7 + 0.7 * e), 0, 6.2832); ctx.stroke();
      }
      let yx, yy;
      if (t < T2) { yx = you.x0; yy = you.y0; }
      else if (t < T3) { const e = cbEaseInOut((t - T2) / (T3 - T2)); yx = you.x0 + (you.x1 - you.x0) * e; yy = you.y0 + (you.y1 - you.y0) * e - Math.sin(e * Math.PI) * H * 0.12; }
      else { yx = you.x1; yy = you.y1; }
      const pulse = t < T2 ? 1 + Math.sin(t / 260) * 0.12 : 1;
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(yx, yy, 6.5 * pulse, 0, 6.2832); ctx.fillStyle = surfCol; ctx.fill();
      ctx.beginPath(); ctx.arc(yx, yy, 4.6 * pulse, 0, 6.2832); ctx.fillStyle = inkCol; ctx.fill();
      ctx.beginPath(); ctx.arc(yx, yy, 7.5 * pulse, 0, 6.2832); ctx.strokeStyle = camps[mineIdx].col; ctx.lineWidth = 1.6; ctx.stroke();
      if (t >= T4) {
        const e = Math.min(1, (t - T4) / (T5 - T4));
        root.style.opacity = String(1 - e);
        if (t >= T5) { finish(); return; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
  }, []);

  return (
    // A real <button>, not a div carrying role="button" (D23's rule, and the
    // last non-autofocus finding in this layer). The div had the role and the
    // label — everything check:a11y can read — and no tabIndex and no key
    // handler, so the one control on screen was the one control a keyboard
    // could not reach, for the several seconds this animation covers the
    // result. `type="button"` because a bare <button> submits.
    //
    // The style block carries the UA reset the div did not need: border,
    // background, padding, font and display all have non-zero defaults on a
    // button, and `width: 100%` restores the block box the canvas inside
    // measures itself against.
    <button
      type="button"
      ref={rootRef}
      onClick={finish}
      aria-label="Skip"
      style={{
        position: 'relative', height, width: '100%', display: 'block',
        border: 0, padding: 0, margin: 0, background: 'transparent',
        font: 'inherit', color: 'inherit', textAlign: 'inherit',
        WebkitAppearance: 'none', appearance: 'none',
        cursor: 'pointer', transition: 'opacity .15s linear',
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', opacity: 0, animation: 'cbIn .3s cubic-bezier(0.2,0.8,0.2,1) .5s forwards', pointerEvents: 'none' }}>{msg}</div>
    </button>
  );
}

window.ConsequenceBeat = ConsequenceBeat;

;globalThis.ConsequenceBeat = typeof ConsequenceBeat === 'undefined' ? globalThis.ConsequenceBeat : ConsequenceBeat;
