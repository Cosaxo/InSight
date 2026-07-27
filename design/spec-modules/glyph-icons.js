// glyph-icons.js — InSight's drawn icon set.
// Replaces raw Unicode glyph characters with consistent 24×24 stroke icons:
// uniform 2px stroke, round caps, currentColor, optically centered.
// Keyed by the original glyph character so data files stay untouched.
//
// Usage (React/JSX):   {GL(cat.glyph)}            — drop-in for {cat.glyph}
//                      {GL(cat.glyph, {style})}   — extra style overrides
// Unknown characters fall back to the raw character, unchanged.

(function () {
  // Each entry is inner SVG markup for a 24×24 viewBox.
  // Root svg provides: fill=none stroke=currentColor stroke-width=2
  // stroke-linecap=round stroke-linejoin=round. Filled shapes opt out per-path.
  const I = {};

  // ── balls, rings, halves ──────────────────────────────────────────────
  I['◉'] = '<circle cx="12" cy="12" r="8"/><path d="M7 6.2c2.8 2.2 2.8 9.4 0 11.6M17 6.2c-2.8 2.2-2.8 9.4 0 11.6"/>'; // ball w/ seams
  I['◯'] = '<circle cx="12" cy="12" r="8"/>';
  I['○'] = '<circle cx="11.5" cy="12.5" r="7"/><circle cx="18.6" cy="5.4" r="1.7" fill="currentColor" stroke="none"/>'; // ring + orbit
  I['◐'] = '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16V4z" fill="currentColor" stroke="none"/>';
  I['◑'] = '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16V4z" fill="currentColor" stroke="none"/>';
  I['◓'] = '<circle cx="12" cy="12" r="8"/><path d="M4 12a8 8 0 0 1 16 0H4z" fill="currentColor" stroke="none"/>';
  I['☉'] = '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>';
  I['◍'] = I['☉'];
  I['◎'] = '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>';
  I['◌'] = '<circle cx="12" cy="12" r="8" stroke-dasharray="2.4 3.6"/>';
  I['⊘'] = '<circle cx="12" cy="12" r="8"/><path d="M6.4 17.6L17.6 6.4"/>';
  I['·'] = '<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>';

  // ── diamonds & squares ────────────────────────────────────────────────
  I['◇'] = '<path d="M12 4l8 8-8 8-8-8 8-8z"/>';
  I['◆'] = '<path d="M12 4l8 8-8 8-8-8 8-8z" fill="currentColor" stroke="none"/>';
  I['◈'] = '<path d="M12 4l8 8-8 8-8-8 8-8z"/><path d="M12 9l3 3-3 3-3-3 3-3z" fill="currentColor" stroke="none"/>';
  I['❖'] = '<path d="M12 2.8l2.7 2.7L12 8.2 9.3 5.5 12 2.8zM18.5 9.3l2.7 2.7-2.7 2.7-2.7-2.7 2.7-2.7zM12 15.8l2.7 2.7-2.7 2.7-2.7-2.7 2.7-2.7zM5.5 9.3l2.7 2.7-2.7 2.7-2.7-2.7 2.7-2.7z" fill="currentColor" stroke="none"/>';
  I['▢'] = '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/>';
  I['▭'] = '<rect x="3.5" y="6.5" width="17" height="11" rx="2"/>';
  I['▣'] = '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none"/>';
  I['▤'] = '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M4.5 9.5h15M4.5 14.5h15"/>';
  I['▦'] = '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M9.5 4.5v15M14.5 4.5v15M4.5 9.5h15M4.5 14.5h15"/>';
  I['◼'] = '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>';
  I['☑'] = '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M8.4 12.3l2.5 2.5 4.7-5.1"/>';
  I['≣'] = '<path d="M5 7h14M5 12h14M5 17h14"/>';

  // ── triangles & peaks ─────────────────────────────────────────────────
  I['△'] = '<path d="M3.5 19h17"/><path d="M5.2 19l5-9.6 2.8 4.6 2-3.2L18.8 19"/>'; // peaks
  I['⛰'] = I['△'];
  I['◬'] = '<path d="M12 4.5L20 19H4L12 4.5z"/><circle cx="12" cy="14.2" r="1.6" fill="currentColor" stroke="none"/>';

  // ── arrows & motion ───────────────────────────────────────────────────
  I['↗'] = '<path d="M5.5 18.5L18 6"/><path d="M9.5 6H18v8.5"/>';
  I['↑'] = '<path d="M12 19V5.5"/><path d="M6.2 11.3L12 5.5l5.8 5.8"/>';
  I['↓'] = '<path d="M12 5v13.5"/><path d="M6.2 12.7l5.8 5.8 5.8-5.8"/>';
  I['⇄'] = '<path d="M5 8h13M14.7 4.5L18.5 8l-3.8 3.5"/><path d="M19 16H6M9.3 12.5L5.5 16l3.8 3.5"/>';
  I['⟷'] = '<path d="M4.5 12h15M8 8.5L4.5 12 8 15.5M16 8.5L19.5 12 16 15.5"/>';
  I['↺'] = '<path d="M3 3v5h5"/><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>';
  I['⟳'] = '<path d="M21 3v5h-5"/><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>';
  I['➳'] = '<path d="M4 20L18.5 5.5"/><path d="M12.5 5.5h6v6"/><path d="M6.8 13.8l3.4 3.4"/>';
  I['✈'] = '<path d="M20.5 3.5L3.5 10.6l6 2.6 2.6 6 8.4-15.7z"/><path d="M9.5 13.2l5.2-5.2"/>';

  // ── marks & symbols ───────────────────────────────────────────────────
  I['✎'] = '<path d="M5 19l.9-3.8L16.4 4.7a2.1 2.1 0 0 1 3 3L8.9 18.1 5 19z"/><path d="M14.6 6.5l2.9 2.9"/>';
  I['✦'] = '<path d="M12 3.5c.7 4.7 3.1 7.1 7.8 7.8-4.7.7-7.1 3.1-7.8 7.8-.7-4.7-3.1-7.1-7.8-7.8 4.7-.7 7.1-3.1 7.8-7.8z"/>';
  I['✶'] = '<path d="M12 4v16M5.1 8l13.8 8M18.9 8L5.1 16"/>';
  I['✷'] = I['✶'];
  I['✱'] = I['✶'];
  I['✺'] = '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4M5.8 5.8l2.4 2.4M15.8 15.8l2.4 2.4M18.2 5.8l-2.4 2.4M8.2 15.8l-2.4 2.4"/>';
  I['✚'] = '<path d="M12 5.5v13M5.5 12h13"/>';
  I['✛'] = I['✚'];
  I['+'] = '<path d="M12 6.5v11M6.5 12h11"/>';
  I['–'] = '<path d="M6.5 12h11"/>';
  I['✕'] = '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>';
  I['✟'] = '<path d="M12 4v16M7.5 9h9"/>';
  I['⚡'] = '<path d="M13 2.5L4.5 12.7h6.4L11 21.5l8.5-10.2h-6.4L13 2.5z"/>';
  I['$'] = '<path d="M12 3.5v17"/><path d="M16.3 7.4c-.7-1.4-2.3-2.1-4.3-2.1-2.4 0-4.1 1.2-4.1 3 0 4.2 8.7 2.2 8.7 6.5 0 1.9-1.9 3.1-4.6 3.1-2.2 0-3.9-.9-4.7-2.4"/>';
  I['¤'] = '<circle cx="12" cy="12" r="5.5"/><path d="M5.2 5.2l2.4 2.4M18.8 5.2l-2.4 2.4M5.2 18.8l2.4-2.4M18.8 18.8l-2.4-2.4"/>';
  I['❝'] = '<path d="M5 12.5a6.5 6.5 0 0 1 5.5-7v3.2A3.6 3.6 0 0 0 8.1 12H10.5v6.5H5v-6zM13.5 12.5a6.5 6.5 0 0 1 5.5-7v3.2a3.6 3.6 0 0 0-2.4 3.3H19v6.5h-5.5v-6z" fill="currentColor" stroke="none"/>';

  // ── nature & weather ──────────────────────────────────────────────────
  I['❀'] = '<circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="6.4" r="2.5"/><circle cx="17.3" cy="10.2" r="2.5"/><circle cx="15.3" cy="16.4" r="2.5"/><circle cx="8.7" cy="16.4" r="2.5"/><circle cx="6.7" cy="10.2" r="2.5"/>';
  I['✿'] = I['❀'];
  I['☾'] = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>';
  I['☀'] = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2L7 7M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8"/>';
  I['❄'] = '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.6 4.6L12 7l2.4-2.4M9.6 19.4L12 17l2.4 2.4"/>';
  I['❅'] = I['❄'];
  I['☂'] = '<path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5H3.5A8.5 8.5 0 0 1 12 3.5z"/><path d="M12 12v6a2 2 0 0 0 4 0"/>';
  I['⌇'] = '<path d="M3.5 9.8c2.4-2.8 4.6-2.8 7 0s4.6 2.8 7 0"/><path d="M6.5 15.2c2.4-2.8 4.6-2.8 7 0s4.6 2.8 7 0"/>';

  // ── objects ───────────────────────────────────────────────────────────
  I['♪'] = '<path d="M10 18.3V6.2l8.5-2v10.5"/><circle cx="7.4" cy="18.3" r="2.6"/><circle cx="15.9" cy="14.7" r="2.6"/>';
  I['♟'] = '<path d="M14.7 11.1a3.5 3.5 0 1 0-5.4 0c-1.7 1.2-2.8 3.4-3.1 6.4h11.6c-.3-3-1.4-5.2-3.1-6.4z"/><path d="M6.5 20.5h11"/>';
  I['♞'] = I['♟'];
  I['♡'] = '<path d="M12 19.5C7 15.6 4 12.7 4 9.4 4 7.1 5.8 5.2 8.1 5.2c1.6 0 3 .8 3.9 2.1.9-1.3 2.3-2.1 3.9-2.1 2.3 0 4.1 1.9 4.1 4.2 0 3.3-3 6.2-8 10.1z"/>';
  I['⌂'] = '<path d="M4.5 10.8L12 4l7.5 6.8"/><path d="M6.5 9.3V19a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.3"/>';
  I['☕'] = '<path d="M5 8.5h11v5.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8.5z"/><path d="M16 9.5h1.4a2.6 2.6 0 0 1 0 5.2H16"/><path d="M8.5 5.4c0-1.2 1-1.4 1-2.4M12.5 5.4c0-1.2 1-1.4 1-2.4"/>';
  I['⚖'] = '<path d="M12 4.8V19M8.5 19h7M5.2 7h13.6"/><path d="M2.8 12.6a2.7 2.7 0 0 0 5.4 0L5.5 7.2l-2.7 5.4z"/><path d="M15.8 12.6a2.7 2.7 0 0 0 5.4 0L18.5 7.2l-2.7 5.4z"/>';
  I['⚗'] = '<path d="M9.5 3.5h5"/><path d="M10.7 3.5v4.4l-5.1 8.6a2.6 2.6 0 0 0 2.2 4h8.4a2.6 2.6 0 0 0 2.2-4l-5.1-8.6V3.5"/><path d="M7.8 14.5h8.4"/>';
  I['⌖'] = '<circle cx="12" cy="12" r="6"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/>';

  // ── speech ────────────────────────────────────────────────────────────
  I['ℒ'] = '<path d="M6.5 4.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H11l-4 3.8V15h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>';
  I['ℋ'] = '<path d="M6.5 4.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H11l-4 3.8V15h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M8.7 8.4h6.6M8.7 11.2h4"/>';

  // React element — drop-in replacement for a glyph char in JSX text position.
  // Falls back to the raw character for unmapped glyphs.
  window.GL = function (ch, style) {
    const inner = I[ch];
    if (!inner || !window.React) return ch == null ? null : ch;
    return window.React.createElement('svg', {
      viewBox: '0 0 24 24', width: '1em', height: '1em', 'aria-hidden': true,
      fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round',
      style: Object.assign({ display: 'inline-block', verticalAlign: '-0.125em', flexShrink: 0 }, style || {}),
      dangerouslySetInnerHTML: { __html: inner },
    });
  };
})();
