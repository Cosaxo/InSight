// Ported from design/InSight_standalone_17.html (the "World's palette gate"
// module; its own comments call it world-palette.js). THIS file is the live
// source now, hand-edits and all.
//
// A NEW module, so `WPAL` is an ordinary named export rather than a shared
// global (D39's "convert on touch"). The prototype read the Tweaks-panel mode
// off `window.IS_WPAL`; here the shell PUSHES it in through `WPAL.setMode`
// instead, so the dependency runs one way and this file reads nothing it does
// not own.

// ── World's palette gate ────────────────────────────────────────────────────
// World keeps its many hues — topics, learn-field subjects, catalogue hues, lens
// marks. What made them muddy was the flat `oklch(0.52 0.14 h)` they were all
// written at. Two separate faults in that one value:
//   · L .52 is simply DARK for the warm/green arc. oklch(.52 .14 85) is brown,
//     however in-gamut it is; oklch(.52 .14 145) is a dull forest. Those hues
//     need lifting before they read as gold and green at all.
//   · C .14 is outside the sRGB gamut for teal/cyan/green-yellow, so the browser
//     clips it — clipping dulls AND drags the hue — and inside it for blue,
//     violet and magenta, leaving those undersaturated.
// So each hue gets the lightness where it actually sings, and the chroma that
// hue can hold at that lightness. Nothing clipped, nothing left flat.
//
// styles.css already carries this split for one hue: --ochre (L .70) for bars,
// dots and washes, --ochre-ink (L .52) for anything carrying white text. c() is
// the ochre; ink() is the ochre-ink. Use ink() wherever a full-strength fill
// carries #fff, or where the hue is the text. wash() is how a hue becomes a
// TINT — never `color-mix(…, transparent)`, which composites in gamma sRGB and
// comes back chalky.
export const WPAL = (function () {
  // ── the sRGB boundary, solved rather than tabulated ──────────────────────
  // The old 21-row table was measured, but lerping between rows cuts the corner
  // on a curved gamut, so every hue between two knots came out a little short of
  // the chroma it could hold. Solving it exactly costs ~1ms per hue, cached.
  function inGamut(L, C, H) {
    const h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b,
      m_ = L - 0.1055613458 * a - 0.0638541728 * b,
      s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const u = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    const e = 0.0006;
    return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && u >= -e && u <= 1 + e;
  }
  function maxC(L, H) { let lo = 0, hi = 0.4, m; for (let i = 0; i < 18; i++) { m = (lo + hi) / 2; if (inGamut(L, m, H)) lo = m; else hi = m; } return lo; }
  // the lightness at which a hue is at its most colourful — sRGB's own shape,
  // found by ternary search (max chroma is unimodal in L)
  const _peak = {};
  function peakL(H) {
    const k = ((Math.round(H) % 360) + 360) % 360;
    if (_peak[k] != null) return _peak[k];
    let lo = 0.05, hi = 0.98, a, b;
    for (let i = 0; i < 26; i++) { a = lo + (hi - lo) / 3; b = hi - (hi - lo) / 3; if (maxC(a, k) < maxC(b, k)) lo = a; else hi = b; }
    return (_peak[k] = (lo + hi) / 2);
  }
  // Display value. Lightness follows the gamut's shape but only a quarter of the
  // way toward each hue's own peak — enough that gold lifts out of brown and
  // violet stays off the floor, tight enough (~.10 band) that no two topic hues
  // read as different WEIGHTS of the same app. A wider swing is what made the
  // warm arc look washed next to the rest of the app, whose hues all sit .50–.58.
  // Chroma is then whatever that lightness can actually hold.
  const CAP = 0.20, MID = 0.575, PULL = 0.25;
  const _disp = {}, _ink = {};
  function dispAt(H) {
    const k = ((Math.round(H) % 360) + 360) % 360;
    if (_disp[k]) return _disp[k];
    const L = Math.max(0.545, Math.min(0.655, MID * (1 - PULL) + PULL * peakL(k)));
    return (_disp[k] = [L, Math.min(CAP, maxC(L, k) * 0.97)]);
  }
  // Text-safe twin: lightness held at .52 so white-on-fill contrast is exactly
  // what the app already ships. Chroma is the sRGB edge at that lightness — for
  // the cyan arc that is genuinely low, and no amount of tuning beats it. Which
  // is the reason ink() must stay rare: it is for white-on-fill and hue-as-text,
  // never for a mark that could have worn c() instead.
  function inkAt(H) {
    const k = ((Math.round(H) % 360) + 360) % 360;
    return _ink[k] || (_ink[k] = [0.52, Math.min(0.155, maxC(0.52, k) * 0.97)]);
  }
  const norm = (h) => ((h % 360) + 360) % 360;
  const fmt = (v, h) => 'oklch(' + v[0].toFixed(3) + ' ' + v[1].toFixed(3) + ' ' + norm(h).toFixed(1) + ')';
  const disp = (h) => fmt(dispAt(norm(h)), h);
  const ink = (h) => fmt(inkAt(norm(h)), h);
  const litHue = (c) => {
    const mt = /^\s*(?:ok)?lch\(\s*[\d.%]+\s+[\d.%]+\s+([-\d.]+)/i.exec(c);
    return mt ? parseFloat(mt[1]) : null;
  };
  // A hue source may arrive as a CSS token (`var(--c-world)`) rather than a
  // literal. Left unresolved, hueOf returned null and c() handed the value back
  // UNGATED — the whole point of the gate, quietly skipped. Resolve off the
  // cascade instead; the static tokens cache, --accent defers to ACCENT_H.
  const _vh = {};
  const hueOf = (c) => {
    if (!c) return null;
    const h = litHue(c);
    if (h != null) return h;
    const mt = /^\s*var\(\s*(--[\w-]+)/.exec(c);
    if (!mt) return null;
    const k = mt[1];
    if (k === '--accent') return ACCENT_H();
    if (_vh[k] !== undefined) return _vh[k];
    let v = null;
    try {
      const el = document.querySelector('.app') || document.documentElement;
      v = litHue(getComputedStyle(el).getPropertyValue(k).trim());
    } catch { /* no document: stay null, the caller falls back to the accent. */ }
    return (_vh[k] = v);
  };
  // band: null keeps every source hue (World's own spectrum, cleaned);
  // a number folds the wheel into that arc around the tab accent; 0 = accent only
  const M = { full: { band: null, spin: null }, family: { band: 90, spin: 22 }, one: { band: 0, spin: 0 } };
  let _mode = 'full';
  const mode = () => (M[_mode] ? _mode : 'full');
  // the tab accent's hue, cached per frame — every accent in the app is a literal
  // oklch in styles.css, so the hue is readable off the computed value
  let _ah = 40, _ahT = 0;
  const ACCENT_H = () => {
    const now = Date.now();
    if (now - _ahT < 120) return _ah;
    _ahT = now;
    try {
      const el = document.querySelector('.app');
      if (el) { const h = hueOf(getComputedStyle(el).getPropertyValue('--accent').trim()); if (h != null) _ah = h; }
    } catch { /* no document, or a --accent this parser doesn't recognise: keep the last hue. */ }
    return _ah;
  };
  const band = (h, b, textSafe) => {
    const off = (((h - 115) % 360 + 360) % 360) * (b / 360) - b / 2;
    // the accent's hue is only known to CSS, so borrow the ramp values at the
    // accent's own position on the wheel — set per tab, read here once
    const ah = ACCENT_H(), v = textSafe ? inkAt(norm(ah + off)) : dispAt(norm(ah + off));
    return 'oklch(from var(--accent) ' + v[0].toFixed(3) + ' ' + v[1].toFixed(3) + ' calc(h ' + (off < 0 ? '- ' + (-off).toFixed(1) : '+ ' + off.toFixed(1)) + '))';
  };
  return {
    MODES: Object.keys(M),
    mode,
    setMode(m) { _mode = M[m] ? m : 'full'; },
    // the hue a card wears — washes, bars, dots, borders, tiles
    c(color) {
      if (!color) return color;
      const b = M[mode()].band, h = hueOf(color);
      if (b == null) return h == null ? color : disp(h);
      if (!b || h == null) return 'var(--accent)';
      return band(h, b, false);
    },
    // the same hue, contrast-safe: for fills that carry white text, and for the
    // hue used AS text on the light grounds
    ink(color) {
      if (!color) return color;
      const b = M[mode()].band, h = hueOf(color);
      if (b == null) return h == null ? color : ink(h);
      if (!b || h == null) return 'var(--accent)';
      return band(h, b, true);
    },
    // the ONLY way a hue becomes a tint. Mixing toward `transparent` hands the
    // job to the compositor, which blends in gamma-encoded sRGB — the path that
    // cuts through the desaturated middle and hands back chalk. Mixing into an
    // opaque surface token walks the oklch line instead: same lightness arrival,
    // far more of the hue left standing. Pass a c()'d colour in.
    wash(color, pct, base) {
      return 'color-mix(in oklch, ' + color + ' ' + pct + '%, ' + (base || 'var(--surface)') + ')';
    },
    // a side's hue, rotated off its card's — cleaned at the destination too, so a
    // rotated side never lands on a clipped chroma either
    opt(color, i, n, textSafe) {
      const s = M[mode()].spin;
      const step = s == null ? ((n || 2) > 2 ? 120 : 150) : s;
      const h = hueOf(color);
      if (!step || !i) return h == null ? color : (textSafe ? ink(h) : disp(h));
      if (h != null) return textSafe ? ink(h + i * step) : disp(h + i * step);
      const v = textSafe ? inkAt(ACCENT_H()) : dispAt(ACCENT_H());
      return 'oklch(from ' + color + ' ' + v[0].toFixed(3) + ' ' + v[1].toFixed(3) + ' calc(h + ' + Math.round(i * step) + '))';
    },
  };
})();
