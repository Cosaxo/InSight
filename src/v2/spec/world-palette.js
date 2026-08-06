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
// carries #fff, or where the hue is the text.
export const WPAL = (function () {
  // hue → [lightness, max sRGB chroma at that lightness] — the display ramp
  // Measured against the real sRGB boundary in-browser, not estimated. Lightness
  // follows the gamut's own shape — it rises through the warm/green arc (where
  // L .52 is the reason gold read brown and green read dull) and again through
  // the cyans, both of which are at their most saturated when light; it settles
  // back for the violets, which are most saturated when dark. Chroma is the edge
  // at that lightness, capped at .20 so the violets don't shout over the cyans,
  // which physically can't follow them.
  const DISP = [
    [0, .545, .200], [25, .555, .200], [40, .585, .168], [60, .640, .138],
    [85, .670, .126], [110, .655, .131], [130, .625, .154], [145, .615, .178],
    [160, .625, .130], [175, .635, .110], [195, .640, .100], [215, .630, .102],
    [235, .590, .115], [250, .555, .144], [265, .535, .200], [285, .525, .200],
    [300, .530, .200], [315, .535, .200], [330, .540, .200], [345, .545, .200],
    [360, .545, .200],
  ];
  // hue → max sRGB chroma at L .52 — the text-safe ramp (lightness held, so
  // white-on-fill contrast is exactly what the app already shipped)
  const INK = [
    [0, .155], [25, .155], [40, .149], [60, .111], [85, .098], [110, .104],
    [130, .128], [145, .150], [160, .108], [175, .090], [195, .081],
    [215, .085], [235, .101], [250, .135], [265, .155], [285, .155],
    [300, .155], [315, .155], [330, .155], [345, .155], [360, .155],
  ];
  const norm = (h) => ((h % 360) + 360) % 360;
  const at = (tbl, h) => {
    h = norm(h);
    for (let i = 1; i < tbl.length; i++) {
      if (h <= tbl[i][0]) {
        const a = tbl[i - 1], b = tbl[i], k = (h - a[0]) / (b[0] - a[0]), out = [];
        for (let j = 1; j < a.length; j++) out.push(a[j] + (b[j] - a[j]) * k);
        return out;
      }
    }
    return tbl[tbl.length - 1].slice(1);
  };
  const disp = (h) => { const v = at(DISP, h); return 'oklch(' + v[0].toFixed(3) + ' ' + v[1].toFixed(3) + ' ' + norm(h).toFixed(1) + ')'; };
  const ink = (h) => 'oklch(0.52 ' + at(INK, h)[0].toFixed(3) + ' ' + norm(h).toFixed(1) + ')';
  const hueOf = (c) => {
    const mt = /^\s*(?:ok)?lch\(\s*[\d.%]+\s+[\d.%]+\s+([-\d.]+)/i.exec(c);
    return mt ? parseFloat(mt[1]) : null;
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
  const band = (h, b, tbl) => {
    const off = (((h - 115) % 360 + 360) % 360) * (b / 360) - b / 2;
    // the accent's hue is only known to CSS, so borrow the ramp values at the
    // accent's own position on the wheel — set per tab, read here once
    const ah = ACCENT_H(), v = tbl === INK ? [0.52, at(INK, ah + off)[0]] : at(DISP, ah + off);
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
      return band(h, b, DISP);
    },
    // the same hue, contrast-safe: for fills that carry white text, and for the
    // hue used AS text on the light grounds
    ink(color) {
      if (!color) return color;
      const b = M[mode()].band, h = hueOf(color);
      if (b == null) return h == null ? color : ink(h);
      if (!b || h == null) return 'var(--accent)';
      return band(h, b, INK);
    },
    // a side's hue, rotated off its card's — cleaned at the destination too, so a
    // rotated side never lands on a clipped chroma either
    opt(color, i, n, textSafe) {
      const s = M[mode()].spin;
      const step = s == null ? ((n || 2) > 2 ? 120 : 150) : s;
      const h = hueOf(color);
      if (!step || !i) return h == null ? color : (textSafe ? ink(h) : disp(h));
      if (h != null) return textSafe ? ink(h + i * step) : disp(h + i * step);
      return 'oklch(from ' + color + ' ' + (textSafe ? '0.52 ' + at(INK, ACCENT_H())[0].toFixed(3) : at(DISP, ACCENT_H()).map((x) => x.toFixed(3)).join(' ')) + ' calc(h + ' + Math.round(i * step) + '))';
    },
  };
})();
