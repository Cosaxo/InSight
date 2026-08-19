// Ported from design/spec-modules/mirror-field-pops.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_DATA, fmtPop } from './sample-data.js';
import { SCENES } from './scenes.js';
import { Av, TabSection, MatchRing } from './primitives.jsx';
// The type's own mark, imported by name (D39) rather than read off the
// window bag — a window.TypeMark reference would raise this file's rule-4
// coupling count, and both modules are eager so the ESM graph carries it
// into the same chunk for free.
import { TypeMark } from './type-marks.jsx';

// mirror-field-pops.jsx — the four Mirror populations, each built as a node
// list for the shared field canvas (mirror-field.jsx). One grammar throughout:
// you at the centre, them around you, distance = likeness.

const { useState: useStateMFP, useEffect: useEffectMFP } = React;

// ─── circle: each relationship category gets an angular neighbourhood ───
const MFP_SECTORS = { family: -128, friends: -50, colleagues: 26, neighbors: 100, acquaintances: 168 };

// ─── kindred strangers in Oslo (mirrors KindredInOslo's roster) ───
// Types are the v28 roster's (design/standalone-v28/type-mix.js, byName) —
// authored demo data, Big Five only: the same instrument the live fold
// enforces (data/typeMix.ts TYPE_TEST) and the only one the prototype's
// field-row chip ever draws.
const MFP_KINDRED = [
  { init: 'AK', name: 'Anders K.', hood: 'Torshov', match: 92, hue: 145, type: 'The Quiet One', shared: ['ceramics', 'cold swims', 'Pärt'] },
  { init: 'IM', name: 'Ingrid M.', hood: 'Grünerløkka', match: 89, hue: 38, type: 'The Diplomat', shared: ['rye baking', 'Solnit', 'fjord walks'] },
  { init: 'PV', name: 'Petter V.', hood: 'Sagene', match: 85, hue: 250, type: 'The Lookout', shared: ['field notes', 'birding', 'silence'] },
];

// ─── how like-you each Norwegian city's people run (country zoom) ───
const MFP_NO_CITIES = [
  { name: 'Oslo', match: 71, hue: 150, home: true },
  { name: 'Tromsø', match: 77, hue: 200 },
  { name: 'Bergen', match: 74, hue: 220 },
  { name: 'Trondheim', match: 69, hue: 145 },
  { name: 'Stavanger', match: 63, hue: 38 },
  { name: 'Kristiansand', match: 58, hue: 60 },
];

// ─── kindred strangers across Norway (country zoom) ───
const MFP_KINDRED_COUNTRY = [
  { init: 'SB', name: 'Sigrid B.', place: 'Tromsø', match: 94, hue: 200, type: 'The Quiet One', shared: ['cold swims', 'northern light', 'Pärt'] },
  { init: 'EH', name: 'Eirik H.', place: 'Bergen', match: 90, hue: 220, type: 'The Dependable', shared: ['rye baking', 'rain walks', 'field notes'] },
  { init: 'LT', name: 'Live T.', place: 'Trondheim', match: 87, hue: 145, type: 'The Reader', shared: ['ceramics', 'birding', 'quiet mornings'] },
];

// ─── kindred strangers across the world — farther pool, closer matches ───
const MFP_KINDRED_WORLD = [
  { init: 'YO', name: 'Yuki O.',  place: 'Osaka · JP',       match: 96, hue: 250, type: 'The Quiet One',  shared: ['ceramics', 'field notes', 'quiet mornings'] },
  { init: 'RD', name: 'Rui D.',   place: 'Porto · PT',       match: 94, hue: 38,  type: 'The Dependable', shared: ['rye baking', 'cold swims', 'old stone'] },
  { init: 'CS', name: 'Clara S.', place: 'Valparaíso · CL', match: 91, hue: 145, type: 'The Host',       shared: ['birding', 'Solnit', 'hills'] },
];

// ─── the Kindred lens — the strangers most aligned with you, as a card ───
function KindredLensCard({ people = MFP_KINDRED }) {
  return (
    <div>
      <TabSection title="Kindred" sub="strangers most aligned with you — the fuller the ring, the closer" />
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {people.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 12px', background: 'var(--surface)',
              border: '1px solid color-mix(in oklch, var(--rule), transparent 25%)', borderRadius: 14,
            }}>
              <MatchRing pct={p.match} color={`oklch(0.45 0.13 ${p.hue})`} size={50} title={`${p.match} kindred`}>
                <Av init={p.init} hue={p.hue} size={36}></Av>
              </MatchRing>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.place || p.hood}</span>
                  {/* v28 §7.9: the type, as the chip the LIVE KindredCard already
                      wears (ui/LiveMirrorLenses.tsx, D156) — mark + name, one
                      shape for demo and live so a badge on a person always
                      reads the same. Big Five only, and roster-authored: the
                      demo has no per-person fold to draw from. */}
                  {p.type && (
                    <span style={{
                      marginLeft: 'auto', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                      border: '1px solid color-mix(in oklch, var(--rule), transparent 25%)', borderRadius: 999, padding: '2px 9px 2px 4px',
                      fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)',
                      background: 'var(--surface-2)', whiteSpace: 'nowrap',
                    }}>
                      <TypeMark testKey="big5" name={p.type} size={16}></TypeMark>
                      {p.type}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {p.shared.map(s => (
                    <span key={s} style={{
                      fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 500,
                      color: `oklch(0.34 0.13 ${p.hue})`,
                      padding: '2px 9px', borderRadius: 99,
                      background: `oklch(0.95 0.03 ${p.hue})`, border: `0.5px solid oklch(0.85 0.05 ${p.hue})`,
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="margin-note" style={{ marginTop: 10, textAlign: 'center' }}>
          names shown only when both of you opt in
        </div>
      </div>
    </div>
  );
}

// ─── per-population field config ───
function mfpConfig(pop, zoom, mine) {
  const D = IS_DATA;

  if (pop === 'circle') {
    return {
      seed: -84, mist: 0,
      header: { kicker: 'Your people', fig: String(D.people.length), unit: 'close ties' },
      key: [{ label: 'closer to you = more alike' }],
      nodes: D.people.map((p) => ({
        id: 'p:' + p.id, kind: 'person', match: p.match, hue: p.hue, init: p.init,
        label: p.name.split(' ')[0], sector: MFP_SECTORS[p.category] != null ? MFP_SECTORS[p.category] : 0,
        size: 14, data: p,
      })),
      answersAud: 'people', makeupAud: 'people',
      compare: { scope: 'circle', label: 'your circle' },
    };
  }

  if (pop === 'groups') {
    const yours = D.groups.filter((g) => mine.has(g.id));
    const suggested = D.groups.filter((g) => !mine.has(g.id)).sort((a, b) => b.match - a.match).slice(0, 5);
    const totalMembers = yours.reduce((s, g) => s + g.members, 0);
    const hueOf = (g) => { const c = (D.interestCats || []).find((x) => x.id === g.cat); return c ? c.hue : null; };
    // distance = how like-you the scene's average member runs (g.match, from its
    // member profile) — yours read inside the dotted threshold, suggested beyond it
    return {
      seed: -120, mist: 0,
      header: { kicker: 'Your scenes', fig: String(yours.length), unit: `followed · ${fmtPop(totalMembers)} people` },
      key: [{ label: 'closer = members more like you' }, { glyph: 'ring', label: 'suggested' }],
      nodes: [...yours, ...suggested].map((g) => {
        const isMine = mine.has(g.id);
        return {
          id: 'g:' + g.id, kind: 'group', match: g.match, hue: hueOf(g), label: g.name,
          size: isMine ? 13 : 10.5, band: isMine ? [54, 118] : [138, 162],
          faint: !isMine, data: g,
        };
      }),
      answersAud: 'groups', makeupAud: 'groups',
    };
  }

  if (pop === 'near') {
    // privacy: distances are coarse bands, never exact
    const bandSize = { 'a few streets away': 12, 'in the neighbourhood': 10.5, 'a short ride away': 9 };
    return {
      seed: -60, mist: 62, mistSeed: 3,
      header: { kicker: 'Around you', fig: '2,847', unit: 'within 5 km · Grünerløkka' },
      key: [{ label: 'closer to you = more alike' }],
      nodes: D.nearby.map((p) => ({
        id: 'n:' + p.id, kind: 'anon', match: p.match, hue: p.hue,
        size: bandSize[p.dist] || 12, data: p,
      })),
      answersAud: 'around', makeupAud: 'around',
      compare: { scope: 'around', label: 'near you' },
    };
  }

  // world — telescopes with the zoom control
  if (zoom === 'city') {
    return {
      seed: -100, mist: 48, mistSeed: 11,
      header: { kicker: 'Your city', fig: '12.6k', unit: 'in Oslo' },
      key: [{ label: 'kindred strangers · opt-in' }],
      nodes: MFP_KINDRED.map((p, i) => ({
        id: 'k:' + i, kind: 'person', match: p.match, hue: p.hue, init: p.init,
        label: p.name.split(' ')[0], size: 13, data: p,
      })),
      answersAud: 'city', makeupAud: 'city',
      compare: { scope: 'city', label: 'Oslo' },
    };
  }
  if (zoom === 'country') {
    return {
      seed: -140, mist: 40, mistSeed: 5,
      header: { kicker: 'Your country', fig: '38k', unit: 'across Norway' },
      key: [{ label: 'closer = a city more like you' }],
      nodes: MFP_NO_CITIES.map((c) => ({
        id: 'c:' + c.name, kind: 'city', match: c.match, hue: c.hue,
        label: c.name, home: c.home, size: 8, data: c,
      })),
      answersAud: 'country', makeupAud: 'country',
      compare: { scope: 'country', label: 'Norway' },
    };
  }
  const MFP_COUNTRY_NAMES = { PT: 'Portugal', JP: 'Japan', DK: 'Denmark', UK: 'United Kingdom', MX: 'Mexico', IS: 'Iceland', DE: 'Germany', FI: 'Finland', CA: 'Canada', AR: 'Argentina', GE: 'Georgia', MA: 'Morocco', ZA: 'South Africa', NZ: 'New Zealand' };
  const byCountry = new Map();
  (D.cities || []).forEach((c) => { const prev = byCountry.get(c.country); if (!prev || c.match > prev.match) byCountry.set(c.country, c); });
  const countries = [...byCountry.values()].sort((a, b) => b.match - a.match).slice(0, 9);
  return {
    seed: -20, mist: 44, mistSeed: 9,
    header: { kicker: 'Your world', fig: '412k', unit: 'worldwide' },
    key: [{ label: "closer = a country you'd belong in" }],
    nodes: countries.map((c) => ({
      id: 'co:' + c.country, kind: 'city', match: c.match, hue: c.hue,
      label: MFP_COUNTRY_NAMES[c.country] || c.country, size: 8,
      data: { name: MFP_COUNTRY_NAMES[c.country] || c.country, mood: 'closest fit · ' + c.name },
    })),
    answersAud: 'world', makeupAud: 'world',
    compare: { scope: 'world', label: 'the world' },
  };
}

// ─── the field body — canvas, detail, lenses ───
// No `levelTrait` / `levelMarker`, though v17's signature still names them:
// they only ever fed GroupLevelBreakdown, and that branch went in 2026-07-31
// (see the note below). The prototype kept both the dangling branch and the
// props; taking its parameter list would have re-declared two arguments
// nothing can read.
function MirrorFieldBody({ pop, worldZoom, zoomCtl, onPerson, firstRun }) {
  const D = IS_DATA;
  const [selId, setSelId] = useStateMFP(null);
  const [mine, setMine] = useStateMFP(() => new Set(SCENES.list()));
  const [gSelId, setGSelId] = useStateMFP(() => { const g = D.groups.find((x) => x.joined); return g ? g.id : null; });

  // scenes are the shared follow list — stay in step with the feed's chips
  useEffectMFP(() => SCENES.subscribe(() => setMine(new Set(SCENES.list()))), []);

  useEffectMFP(() => { setSelId(null); setSelNode(null); }, [pop, worldZoom]);

  // relmap.jsx left the eager graph at D200, so Circle's embedded map is not
  // on screen the first time this renders. The old test — a bare
  // `typeof RelationshipMap === 'function'` — could not survive that move:
  // it reads false, Circle draws the generic field canvas instead, and
  // nothing re-triggers the render that would read it again. So the module
  // is IMPORTED and its arrival is state.
  //
  // An import rather than `window.loadOverlays()` for two reasons: it is
  // what check:globals asks for (a name that arrives through the ESM graph
  // is not coupling, and this file's rule-4 count drops by two), and it
  // names the one module Circle needs rather than the whole overlay group.
  //
  // Only Circle asks, and only in DEMO mode — a live build takes
  // LiveCircleBody (D101) and never renders this component with
  // `pop === 'circle'` at all, so on the shipping path this effect is dead.
  const [RelMap, setRelMap] = useStateMFP(null);
  useEffectMFP(() => {
    if (RelMap || pop !== 'circle') return undefined;
    let live = true;
    // No retry and console.error rather than reportError: main.jsx already
    // reports a dead chunk once (app-shell's openDeferred says why), and the
    // fallback here is the field canvas — a real picture, not a blank.
    import('./relmap.jsx')
      .then((m) => { if (live) setRelMap(() => m.RelationshipMap); })
      .catch((e) => { console.error('[InSight] relationship map chunk failed to load:', e); });
    return () => { live = false; };
  }, [RelMap, pop]);

  const cfg = mfpConfig(pop, worldZoom, mine);
  const [selNode, setSelNode] = useStateMFP(null);
  const sel = selNode;

  const onSel = (n) => {
    const hit = n && n.id !== selId ? n : null;
    setSelId(hit ? hit.id : null);
    setSelNode(hit);
    if (n && n.kind === 'group' && mine.has(n.data.id)) setGSelId(n.data.id);
  };
  const onJoin = (id) => {
    // No local-state fallback beside this any more: the store is imported,
    // so it cannot be missing, and `mine` is driven by its subscription.
    SCENES.follow(id);
    setGSelId(id);
  };
  const onLeave = (id) => {
    SCENES.unfollow(id);
    setGSelId((prev) => {
      if (prev !== id) return prev;
      const rest = D.groups.find((g) => g.id !== id && mine.has(g.id));
      return rest ? rest.id : null;
    });
    setSelId(null);
    setSelNode(null);
  };

  // lenses — everything the old scroll held, now on demand
  const gSel = D.groups.find((g) => g.id === gSelId && mine.has(g.id)) || null;
  const lenses = [];
  lenses.push({ id: 'answers', label: 'Answers', render: () => <MirrorAnswers audId={cfg.answersAud}></MirrorAnswers> });
  // Kindred + Mix travel together — one "People" lens
  const hasKindred = pop === 'near' || pop === 'world';
  const hasMix = !!(cfg.makeupAud && window.DemographicsCard);
  const hasRead = pop === 'circle' && !!window.CircleReadCard;
  // A GroupLevelBreakdown lens was guarded here on the same pattern as the
  // GroupCompare one below — and on the same broken premise: nothing in the
  // tree has ever defined GroupLevelBreakdown, so the guard could not pass.
  // It survived because `window.X &&` reads as a feature flag rather than a
  // dangling reference; check:globals only saw it because the name sat in
  // the scanner's known-dead allowlist. Branch and allowlist entry both gone
  // 2026-07-31. Its `levelTrait` / `levelMarker` props went with it — they
  // fed nothing else, and two call sites were still passing them.
  if (hasKindred || hasMix || hasRead) {
    lenses.push({ id: 'people', label: 'People', render: () => (
      <React.Fragment>
        {hasRead && <CircleReadCard></CircleReadCard>}
        {hasKindred && <KindredLensCard people={pop !== 'world' || worldZoom === 'city' ? MFP_KINDRED : worldZoom === 'country' ? MFP_KINDRED_COUNTRY : MFP_KINDRED_WORLD}></KindredLensCard>}
        {hasMix && <DemographicsCard audId={cfg.makeupAud}></DemographicsCard>}
      </React.Fragment>
    ) });
  }
  // the member scorecard — city / country / world, fed by rate questions in the feed
  const rateScope = pop === 'world' ? (worldZoom === 'city' ? 'city' : worldZoom === 'country' ? 'country' : 'world') : null;
  if (rateScope && window.PlaceStatsCard) {
    lenses.push({ id: 'scores', label: 'Scores', render: () => <PlaceStatsCard scope={rateScope} accent="var(--accent)"></PlaceStatsCard> });
  }
  if (pop === 'world' && worldZoom !== 'city' && worldZoom !== 'country' && window.SegmentExplorer) {
    lenses.push({ id: 'explore', label: 'Explore', render: () => <SegmentExplorer></SegmentExplorer> });
  }
  // The prototype guarded a GroupCompare lens here, but its module
  // (legacy-tabs) is gone in v15 — the guard could never pass, so the
  // branch is gone rather than dead (check:globals would flag it).
  if (cfg.compare && window.CompareBreakdown) {
    lenses.push({ id: 'compare', label: 'Compare', render: () => <CompareBreakdown scope={cfg.compare.scope} accent="var(--accent)" label={cfg.compare.label}></CompareBreakdown> });
  }

  // Sparse mirror: the population is real, the likeness isn't yet. Field keeps
  // you, the rings and the crowd's mist; the placed dots and every lens wait.
  const readN = window.FEEDREAD ? (window.FEEDREAD.stats().n || 0) : 0;
  const sparse = !!firstRun;

  // Circle: the full relationship map IS the picture — embedded, no field canvas.
  const noCanvas = !sparse && pop === 'circle' && !!RelMap;
  const rm = window.RMCore;
  const rmHeader = noCanvas && rm ? { fig: String(rm.defaultPeople().length), unit: 'across ' + rm.DEFAULT_GROUPS.length + ' circles' } : null;

  return (
    <div className="mf-stage" data-screen-label={`Mirror field — ${pop}${pop === 'world' ? ' · ' + worldZoom : ''}${sparse ? ' · first run' : ''}`}>
      {sparse && (<>
        <MFHeader kicker={cfg.header.kicker} fig={cfg.header.fig} unit={cfg.header.unit}></MFHeader>
        <MFCanvas key={'sparse:' + pop + ':' + (pop === 'world' ? worldZoom : '')} nodes={[]} selId={null} onSel={() => {}}
          seedDeg={cfg.seed} mist={cfg.mist || 54} mistSeed={cfg.mistSeed || 1} tall={true} stretch={1.1}></MFCanvas>
        <MFSparse done={Math.min(readN, 8)} need={8}></MFSparse>
      </>)}
      {!sparse && !noCanvas && <MFHeader kicker={cfg.header.kicker} fig={cfg.header.fig} unit={cfg.header.unit} right={pop === 'world' ? zoomCtl : null}></MFHeader>}
      {rmHeader && <MFHeader kicker="Your circle" fig={rmHeader.fig} unit={rmHeader.unit} right={null}></MFHeader>}
      {!sparse && !noCanvas && (<>
        <MFCanvas key={pop + ':' + (pop === 'world' ? worldZoom : '')} nodes={cfg.nodes} selId={selId} onSel={onSel} seedDeg={cfg.seed} mist={cfg.mist} mistSeed={cfg.mistSeed || 1} tall={pop === 'near' || pop === 'world'} stretch={pop === 'world' ? 1.15 : 1.08} maxLabels={pop === 'world' ? (worldZoom === 'world' ? 3 : 4) : undefined}></MFCanvas>
        <MFKey items={cfg.key}></MFKey>
        <MFDetail node={sel} onPerson={onPerson} onJoin={onJoin} onLeave={onLeave} joined={sel && sel.kind === 'group' ? mine.has(sel.data.id) : false}></MFDetail>
      </>)}
      {noCanvas && (
        <div className="rm-embed">
          <RelMap embedded={true}></RelMap>
        </div>
      )}
      {!sparse && <MirrorLenses key={pop + ':' + (pop === 'world' ? worldZoom : '') + ':' + (gSel ? gSel.id : '')} lenses={lenses}></MirrorLenses>}
    </div>
  );
}

Object.assign(window, { MirrorFieldBody });

;globalThis.KindredLensCard = typeof KindredLensCard === 'undefined' ? globalThis.KindredLensCard : KindredLensCard;
;globalThis.mfpConfig = typeof mfpConfig === 'undefined' ? globalThis.mfpConfig : mfpConfig;
;globalThis.MirrorFieldBody = typeof MirrorFieldBody === 'undefined' ? globalThis.MirrorFieldBody : MirrorFieldBody;
;globalThis.MFP_SECTORS = typeof MFP_SECTORS === 'undefined' ? globalThis.MFP_SECTORS : MFP_SECTORS;
;globalThis.MFP_KINDRED = typeof MFP_KINDRED === 'undefined' ? globalThis.MFP_KINDRED : MFP_KINDRED;
;globalThis.MFP_NO_CITIES = typeof MFP_NO_CITIES === 'undefined' ? globalThis.MFP_NO_CITIES : MFP_NO_CITIES;
;globalThis.MFP_KINDRED_COUNTRY = typeof MFP_KINDRED_COUNTRY === 'undefined' ? globalThis.MFP_KINDRED_COUNTRY : MFP_KINDRED_COUNTRY;
;globalThis.MFP_KINDRED_WORLD = typeof MFP_KINDRED_WORLD === 'undefined' ? globalThis.MFP_KINDRED_WORLD : MFP_KINDRED_WORLD;
