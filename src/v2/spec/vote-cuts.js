// Ported from design/InSight_standalone_15.html (vote-cuts.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// InSight — VOTECUTS: the one cut list every who-voted breakdown reads from.
// Demographics first, then the four tests. A test opens into its own subvalues:
// the overall type, or a single axis split into the same five bands the Circle
// map colours people by — rm-test-lenses.js owns both, so a cut here and a lens
// there always mean the same thing.
// Converted off the shared-global bridge (D39, "convert on touch"):
// daily-split.jsx and world-feed.jsx both import this by name. The window
// mirror is GONE since D246 — world-feed.jsx was the last global reader,
// and a publication nothing reads is the residue rule 5 exists to catch.
export const VOTECUTS = (function () {
  const DEMO = [
    { id: 'friends', label: 'Friends' },
    { id: 'age',     label: 'Age',    groups: ['18–24', '25–34', '35–44', '45+'] },
    { id: 'gender',  label: 'Gender', groups: ['Women', 'Men', 'Nonbinary'] },
    // job and education carry more rows than a single list should hold, so each
    // splits into facets on the same sub-chip row a test uses — one readable
    // chart per facet instead of one twenty-row wall
    { id: 'job',     label: 'Job',    subs: [
      { id: null,     label: 'Sector', groups: ['Tech', 'Health', 'Education', 'Finance', 'Creative', 'Trades', 'Service', 'Public', 'Science'] },
      { id: 'stage',  label: 'Stage',  groups: ['Student', 'Early career', 'Mid career', 'Senior', 'Retired', 'Job hunting'] },
      { id: 'shape',  label: 'Setup',  groups: ['Employed', 'Freelance', 'Founder', 'Part-time', 'Caring'] },
    ] },
    // education gets a second tier: the level facets answer "how far", the
    // credential facets answer "in what" — which trade, which bachelor's, which
    // doctorate. Separated in the chip row by a hairline, so the two families
    // read apart without a label to explain them.
    { id: 'edu',     label: 'Education', subs: [
      { id: null,     label: 'Level',  groups: ['School', 'Trade', 'Some college', 'Bachelor’s', 'Master’s', 'Doctorate'] },
      { id: 'field',  label: 'Studied', groups: ['Arts', 'Humanities', 'Social', 'Business', 'Law', 'Sciences', 'Engineering', 'Medicine', 'Teaching'] },
      { id: 'trade',  label: 'Trade',      tier: 1, groups: ['Electrical', 'Plumbing', 'HVAC', 'Automotive', 'Welding', 'Culinary', 'Cosmetology', 'EMT / care'] },
      { id: 'ba',     label: 'Bachelor’s', tier: 1, groups: ['BA', 'BSc', 'BFA', 'BEng', 'BBA', 'BEd', 'LLB', 'BArch'] },
      { id: 'ma',     label: 'Master’s',   tier: 1, groups: ['MA', 'MSc', 'MBA', 'MFA', 'MEng', 'MEd', 'LLM', 'MPH'] },
      { id: 'phd',    label: 'Doctorate',  tier: 1, groups: ['PhD', 'MD', 'JD', 'EdD', 'DDS', 'PharmD', 'DVM', 'PsyD'] },
    ] },
    { id: 'where',   label: 'Where',  groups: ['Americas', 'Europe', 'Asia', 'Elsewhere'] },
  ];
  const TEST_IDS = ['big5', 'politics', 'values', 'social'];
  const L = () => window.RMLenses;
  const T = (id) => { const RL = L(); return RL && RL.TESTS[id] ? RL.TESTS[id] : null; };

  function dims() {
    return DEMO.map((d) => ({ id: d.id, label: d.label })).concat(
      TEST_IDS.filter(T).map((id) => ({ id, label: T(id).label, test: true }))
    );
  }
  // a cut's subvalues — a test's type + axes, or a demographic's facets
  function subs(dimId) {
    const d = DEMO.find((x) => x.id === dimId);
    if (d) return d.subs ? d.subs.map((s) => ({ id: s.id, label: s.label, tier: s.tier || 0 })) : null;
    const t = T(dimId);
    if (!t) return null;
    return [{ id: null, label: 'Type' }].concat(t.axes.map((a) => ({ id: a.id, label: a.label })));
  }
  // rows for a cut — [{label, color}]; colour only where the map has one
  function groups(dimId, axisId) {
    const t = T(dimId);
    if (!t) {
      const d = DEMO.find((x) => x.id === dimId);
      if (!d) return [];
      if (d.subs) { const s = d.subs.find((x) => x.id === (axisId || null)) || d.subs[0]; return s.groups.map((g) => ({ label: g, color: null })); }
      return (d.groups || []).map((g) => ({ label: g, color: null }));
    }
    if (!axisId) return t.types.map((x) => ({ label: x.label, color: x.color }));
    return L().axisBands(dimId, axisId).map((b) => ({ label: b.label, color: b.color }));
  }
  function key(dimId, axisId) { return axisId ? dimId + ':' + axisId : dimId; }
  // which row is yours, read off your real results
  function you(dimId, axisId) {
    const t = T(dimId);
    if (!t) return null;
    const v = L().youVals(dimId);
    if (!v) return null;
    if (!axisId) { const ty = t.typeOf(v); return ty ? ty.label : null; }
    const x = v[axisId];
    if (x == null) return null;
    const b = L().axisBands(dimId, axisId).find((bd) => x >= bd.lo && x < bd.hi);
    return b ? b.label : null;
  }
  // keep the active chip in view — same hand-rolled ease as the map's branch row.
  // Measured off rects (not offsetLeft, which reports against whatever ancestor
  // happens to be positioned) and clamped to the row's real scroll range.
  function centerChip(row) {
    if (!row) return;
    requestAnimationFrame(() => {
      const el = row.querySelector('[data-on="1"]');
      if (!el) return;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 1) return;
      const rel = el.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
      const target = Math.max(0, Math.min(max, rel - (row.clientWidth - el.offsetWidth) / 2));
      const from = row.scrollLeft;
      if (Math.abs(target - from) < 1) return;
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 260);
        row.scrollLeft = from + (target - from) * (1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(step);
      };
      step();
    });
  }

  return { dims, subs, groups, key, you, centerChip, TEST_IDS };
})();
