/* eslint-disable */
// ported from design/spec-modules/mirror-field-pops.jsx — do not hand-edit load order assumptions
import React from 'react';

// mirror-field-pops.jsx — the four Mirror populations, each built as a node
// list for the shared field canvas (mirror-field.jsx). One grammar throughout:
// you at the centre, them around you, distance = likeness.

const { useState: useStateMFP, useEffect: useEffectMFP } = React;

// ─── circle: each relationship category gets an angular neighbourhood ───
const MFP_SECTORS = { family: -128, friends: -50, colleagues: 26, neighbors: 100, acquaintances: 168 };

// ─── kindred strangers in Oslo (mirrors KindredInOslo's roster) ───
const MFP_KINDRED = [
  { init: 'AK', name: 'Anders K.', hood: 'Torshov', match: 92, hue: 145, shared: ['ceramics', 'cold swims', 'Pärt'] },
  { init: 'IM', name: 'Ingrid M.', hood: 'Grünerløkka', match: 89, hue: 38, shared: ['rye baking', 'Solnit', 'fjord walks'] },
  { init: 'PV', name: 'Petter V.', hood: 'Sagene', match: 85, hue: 250, shared: ['field notes', 'birding', 'silence'] },
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
  { init: 'SB', name: 'Sigrid B.', place: 'Tromsø', match: 94, hue: 200, shared: ['cold swims', 'northern light', 'Pärt'] },
  { init: 'EH', name: 'Eirik H.', place: 'Bergen', match: 90, hue: 220, shared: ['rye baking', 'rain walks', 'field notes'] },
  { init: 'LT', name: 'Live T.', place: 'Trondheim', match: 87, hue: 145, shared: ['ceramics', 'birding', 'quiet mornings'] },
];

// ─── kindred strangers across the world — farther pool, closer matches ───
const MFP_KINDRED_WORLD = [
  { init: 'YO', name: 'Yuki O.',  place: 'Osaka · JP',       match: 96, hue: 250, shared: ['ceramics', 'field notes', 'quiet mornings'] },
  { init: 'RD', name: 'Rui D.',   place: 'Porto · PT',       match: 94, hue: 38,  shared: ['rye baking', 'cold swims', 'old stone'] },
  { init: 'CS', name: 'Clara S.', place: 'Valparaíso · CL', match: 91, hue: 145, shared: ['birding', 'Solnit', 'hills'] },
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
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em' }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{p.place || p.hood}</span>
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
  const D = window.IS_DATA;

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
      header: { kicker: 'Your scenes', fig: String(yours.length), unit: `followed · ${window.fmtPop(totalMembers)} people` },
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
function MirrorFieldBody({ pop, worldZoom, zoomCtl, onPerson, levelTrait, levelMarker }) {
  const D = window.IS_DATA;
  const [selId, setSelId] = useStateMFP(null);
  const [mine, setMine] = useStateMFP(() => new Set(window.SCENES ? window.SCENES.list() : D.groups.filter((g) => g.joined).map((g) => g.id)));
  const [gSelId, setGSelId] = useStateMFP(() => { const g = D.groups.find((x) => x.joined); return g ? g.id : null; });

  // scenes are the shared follow list — stay in step with the feed's chips
  useEffectMFP(() => {
    if (!window.SCENES) return;
    return window.SCENES.subscribe(() => setMine(new Set(window.SCENES.list())));
  }, []);

  useEffectMFP(() => { setSelId(null); }, [pop, worldZoom]);

  const cfg = mfpConfig(pop, worldZoom, mine);
  const sel = cfg.nodes.find((n) => n.id === selId) || null;

  const onSel = (n) => {
    setSelId(n && n.id !== selId ? n.id : null);
    if (n && n.kind === 'group' && mine.has(n.data.id)) setGSelId(n.data.id);
  };
  const onJoin = (id) => {
    if (window.SCENES) window.SCENES.follow(id); else setMine((prev) => new Set(prev).add(id));
    setGSelId(id);
  };
  const onLeave = (id) => {
    if (window.SCENES) window.SCENES.unfollow(id); else setMine((prev) => { const nx = new Set(prev); nx.delete(id); return nx; });
    setGSelId((prev) => {
      if (prev !== id) return prev;
      const rest = D.groups.find((g) => g.id !== id && mine.has(g.id));
      return rest ? rest.id : null;
    });
    setSelId(null);
  };

  // lenses — everything the old scroll held, now on demand
  const gSel = D.groups.find((g) => g.id === gSelId && mine.has(g.id)) || null;
  const lenses = [];
  lenses.push({ id: 'answers', label: 'Answers', render: () => <MirrorAnswers audId={cfg.answersAud}></MirrorAnswers> });
  // Kindred + Mix travel together — one "People" lens
  const hasKindred = pop === 'near' || pop === 'world';
  const hasMix = !!(cfg.makeupAud && window.DemographicsCard);
  const hasLadderBreakdown = pop === 'groups' && gSel && window.GroupLevelBreakdown;
  const hasRead = pop === 'circle' && !!window.CircleReadCard;
  if (hasKindred || hasMix || hasLadderBreakdown || hasRead) {
    lenses.push({ id: 'people', label: 'People', render: () => (
      <React.Fragment>
        {hasRead && <CircleReadCard></CircleReadCard>}
        {hasLadderBreakdown && <GroupLevelBreakdown g={gSel} defaultTrait={levelTrait} showMarker={levelMarker}></GroupLevelBreakdown>}
        {hasKindred && <KindredLensCard people={pop !== 'world' || worldZoom === 'city' ? MFP_KINDRED : worldZoom === 'country' ? MFP_KINDRED_COUNTRY : MFP_KINDRED_WORLD}></KindredLensCard>}
        {hasMix && <DemographicsCard audId={cfg.makeupAud}></DemographicsCard>}
      </React.Fragment>
    ) });
  }
  if (pop === 'world' && window.SegmentExplorer) {
    lenses.push({ id: 'explore', label: 'Explore', render: () => <SegmentExplorer></SegmentExplorer> });
  }
  if (pop === 'groups' && gSel && window.GroupCompare) {
    lenses.push({ id: 'compare', label: 'Compare', render: () => <GroupCompare g={gSel}></GroupCompare> });
  } else if (cfg.compare && window.CompareBreakdown) {
    lenses.push({ id: 'compare', label: 'Compare', render: () => <CompareBreakdown scope={cfg.compare.scope} accent="var(--accent)" label={cfg.compare.label}></CompareBreakdown> });
  }

  // Circle: the full relationship map IS the picture — embedded, no field canvas.
  const noCanvas = pop === 'circle' && typeof RelationshipMap === 'function';
  const rm = window.RMCore;
  const rmHeader = noCanvas && rm ? { fig: String(rm.defaultPeople().length), unit: 'across ' + rm.DEFAULT_GROUPS.length + ' circles' } : null;

  return (
    <div className="mf-stage" data-screen-label={`Mirror field — ${pop}${pop === 'world' ? ' · ' + worldZoom : ''}`}>
      {!noCanvas && <MFHeader kicker={cfg.header.kicker} fig={cfg.header.fig} unit={cfg.header.unit} right={pop === 'world' ? zoomCtl : null}></MFHeader>}
      {rmHeader && <MFHeader kicker="Your circle" fig={rmHeader.fig} unit={rmHeader.unit} right={null}></MFHeader>}
      {!noCanvas && (<>
        <MFCanvas key={pop + ':' + (pop === 'world' ? worldZoom : '')} nodes={cfg.nodes} selId={selId} onSel={onSel} seedDeg={cfg.seed} mist={cfg.mist} mistSeed={cfg.mistSeed || 1} tall={pop === 'near' || pop === 'world'} stretch={pop === 'world' ? 1.15 : 1.08}></MFCanvas>
        <MFKey items={cfg.key}></MFKey>
        <MFDetail node={sel} onPerson={onPerson} onJoin={onJoin} onLeave={onLeave} joined={sel && sel.kind === 'group' ? mine.has(sel.data.id) : false}></MFDetail>
      </>)}
      {noCanvas && (
        <div className="rm-embed">
          <RelationshipMap embedded={true}></RelationshipMap>
        </div>
      )}
      <MirrorLenses key={pop + ':' + (pop === 'world' ? worldZoom : '') + ':' + (gSel ? gSel.id : '')} lenses={lenses}></MirrorLenses>
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
