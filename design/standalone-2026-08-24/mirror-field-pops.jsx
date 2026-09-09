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

// ─── nearby kindred, anonymous ───
// Near is the one population where a name would be a leak: these are people
// standing nearby, not opt-in matches. Same rule as the field's anon nodes —
// a silhouette, their trade and age. Distance is never stated: knowing how
// close a stranger is, is itself a leak. Size reads alignment instead.
const mfpNearKindred = () => (window.IS_DATA.nearby || []).slice()
  .sort((a, b) => b.match - a.match).slice(0, 3)
  .map((p) => ({
    anon: true, hue: p.hue, match: p.match,
    name: (p.role || 'someone').replace(/^\w/, (c) => c.toUpperCase()) + (p.age ? ', ' + p.age : ''),
    shared: (p.interests || []).slice(0, 3).map((x) => x.t || x),
  }));

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
                {p.anon ? <window.AnonAv hue={p.hue} size={36}></window.AnonAv> : <Av init={p.init} hue={p.hue} size={36}></Av>}
              </MatchRing>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
                  {!p.anon && <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.place || p.hood}</span>}
                  {window.TypeChip && window.TYPEMIX ? <span style={{ marginLeft: 'auto', flexShrink: 0 }}><window.TypeChip name={window.TYPEMIX.typeOf(p.name)} size={16} dense /></span> : null}
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

// ─── the "so what" line — one plain-language read under every field ───
function mfpSoWhat(pop, zoom, cfg) {
  const parts = [];
  const nodes = (cfg.nodes || []).filter((n) => !n.faint && typeof n.match === 'number');
  const nm = (n) => n.label || (n.data && n.data.name) || '';
  if (nodes.length >= 2) {
    const s = nodes.slice().sort((a, b) => b.match - a.match);
    const top = s[0], low = s[s.length - 1];
    if (pop === 'circle') parts.push([{ b: nm(top) }, ' mirrors you closest; ', { b: nm(low) }, ' least']);
    else if (pop === 'groups') parts.push([{ b: nm(top) }, ' is the scene that runs most like you']);
    else if (pop === 'near') parts.push(['the nearest stranger runs ', { b: top.match + '%' }, ' like you']);
    else if (zoom === 'city') parts.push([{ b: nm(top) }, ' is your closest match in Oslo']);
    else if (zoom === 'country') parts.push([{ b: nm(top) }, ' leans your way most; ', { b: nm(low) }, ' least']);
    else parts.push([{ b: nm(top) }, ' reads most like you']);
  }
  const DQ = window.DAILYQ;
  if (DQ && cfg.answersAud) {
    const byCat = new Map();
    DQ.questions.forEach((q) => {
      const mine = DQ.myAnswer(q); if (mine == null) return;
      const d = q.dist && q.dist[cfg.answersAud]; if (!d || d[mine] == null) return;
      const lift = d[mine] * q.n / 100; // agreement over chance — comparable across question types
      const t = DQ.categoryPath(q)[0];
      const e = byCat.get(t) || { s: 0, n: 0 };
      e.s += lift; e.n += 1; byCat.set(t, e);
    });
    const cats = [...byCat.entries()].filter(([, e]) => e.n >= 2)
      .map(([t, e]) => ({ t, avg: e.s / e.n })).sort((a, b) => b.avg - a.avg);
    if (cats.length >= 2) {
      parts.push(['most in step on ', { b: cats[0].t.toLowerCase() }, ', least on ', { b: cats[cats.length - 1].t.toLowerCase() }]);
    }
  }
  return parts;
}

function MFSoWhat({ pop, zoom, cfg }) {
  const [, bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => (window.DAILYQ ? window.DAILYQ.subscribe(bump) : undefined), []);
  const parts = mfpSoWhat(pop, zoom, cfg);
  if (!parts.length) return null;
  return (
    <div style={{ padding: '7px 26px 0', textAlign: 'center' }}>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'balance' }}>
        {parts.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'var(--ink-3)' }}> · </span>}
            {seg.map((tk, j) => typeof tk === 'string' ? tk : <b key={j} style={{ fontWeight: 800, color: 'var(--ink)' }}>{tk.b}</b>)}
          </React.Fragment>
        ))}
      </span>
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
    // privacy: nothing here encodes distance — size is how aligned they are
    return {
      seed: -60, mist: 62, mistSeed: 3,
      header: { kicker: 'Around you', fig: '2,847', unit: 'within 5 km · Grünerløkka' },
      key: [{ label: 'closer to you = more alike' }],
      nodes: D.nearby.map((p) => ({
        id: 'n:' + p.id, kind: 'anon', match: p.match, hue: p.hue,
        size: 9 + ((Math.max(60, Math.min(95, p.match || 70)) - 60) / 35) * 4, data: p,
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
function MirrorFieldBody({ pop, worldZoom, zoomCtl, onPerson, levelTrait, levelMarker, firstRun, topLenses }) {
  const D = window.IS_DATA;
  const [lensOpen, setLensOpen] = useStateMFP('__ov');
  // ── Near: you can stand in the field or step out of it. Hidden is mutual —
  // nobody nearby sees you, and the field comes back empty for you too.
  const NEAR_LS = 'insight.near.discoverable';
  const [seen, setSeen] = React.useState(() => { try { return localStorage.getItem(NEAR_LS) !== '0'; } catch (e) { return true; } });
  const setSeenP = (v) => { setSeen(v); try { localStorage.setItem(NEAR_LS, v ? '1' : '0'); } catch (e) {} if (window.HAPTIC) window.HAPTIC.tick(); };
  const hidden = pop === 'near' && !seen;
  const seenChip = pop !== 'near' ? null : (
    <button className="press" onClick={() => setSeenP(!seen)} aria-pressed={seen}
      aria-label={seen ? 'You are discoverable nearby — tap to hide' : 'You are hidden nearby — tap to appear'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 12px 0 9px', borderRadius: 999, flex: 'none', cursor: 'pointer', WebkitAppearance: 'none',
        border: '1px solid ' + (seen ? 'color-mix(in oklch, var(--accent) 45%, transparent)' : 'var(--rule)'),
        background: seen ? 'color-mix(in oklch, var(--accent), var(--surface) 90%)' : 'var(--surface-2)',
        fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: seen ? 'var(--accent-ink, var(--accent))' : 'var(--ink-3)' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: seen ? 'var(--accent)' : 'transparent', border: seen ? 'none' : '1.5px solid var(--ink-3)' }}></span>
      {seen ? 'visible' : 'hidden'}
    </button>
  );

  const [selId, setSelId] = useStateMFP(null);
  const [mine, setMine] = useStateMFP(() => new Set(window.SCENES ? window.SCENES.list() : D.groups.filter((g) => g.joined).map((g) => g.id)));
  const [gSelId, setGSelId] = useStateMFP(() => { const g = D.groups.find((x) => x.joined); return g ? g.id : null; });

  // scenes are the shared follow list — stay in step with the feed's chips
  useEffectMFP(() => {
    if (!window.SCENES) return;
    return window.SCENES.subscribe(() => setMine(new Set(window.SCENES.list())));
  }, []);

  useEffectMFP(() => { setSelId(null); setSelNode(null); }, [pop, worldZoom]);

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
    setSelNode(null);
  };

  // lenses — everything the old scroll held, now on demand
  const gSel = D.groups.find((g) => g.id === gSelId && mine.has(g.id)) || null;
  const lenses = [];
  lenses.push({ id: 'answers', label: 'Answers', render: () => <MirrorAnswers audId={cfg.answersAud}></MirrorAnswers> });
  // Kindred + Mix travel together — one "People" lens
  const hasKindred = (pop === 'near' && !hidden) || pop === 'world';
  const hasMix = !!(cfg.makeupAud && window.DemographicsCard);
  const hasLadderBreakdown = pop === 'groups' && gSel && window.GroupLevelBreakdown;
  const hasRead = pop === 'circle' && !!window.CircleReadCard;
  // types, out in the population: who is here by type, over a stated basis
  const hasTypes = !!(cfg.makeupAud && window.TypeMixCard);
  if (hasKindred || hasMix || hasLadderBreakdown || hasRead || hasTypes) {
    lenses.push({ id: 'people', label: 'People', render: () => (
      <React.Fragment>
        {hasRead && <CircleReadCard></CircleReadCard>}
        {hasLadderBreakdown && <GroupLevelBreakdown g={gSel} defaultTrait={levelTrait} showMarker={levelMarker}></GroupLevelBreakdown>}
        {hasKindred && <KindredLensCard people={pop === 'near' ? mfpNearKindred() : worldZoom === 'city' ? MFP_KINDRED : worldZoom === 'country' ? MFP_KINDRED_COUNTRY : MFP_KINDRED_WORLD}></KindredLensCard>}
        {hasTypes && <window.TypeMixCard audId={cfg.makeupAud}></window.TypeMixCard>}
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
  if (pop === 'groups' && gSel && window.GroupCompare) {
    lenses.push({ id: 'compare', label: 'Compare', render: () => <GroupCompare g={gSel}></GroupCompare> });
  } else if (cfg.compare && window.CompareBreakdown) {
    lenses.push({ id: 'compare', label: 'Compare', render: () => <CompareBreakdown scope={cfg.compare.scope} accent="var(--accent)" label={cfg.compare.label}></CompareBreakdown> });
  }

  // Sparse mirror: the population is real, the likeness isn't yet. Field keeps
  // you, the rings and the crowd's mist; the placed dots and every lens wait.
  const readN = window.FEEDREAD ? (window.FEEDREAD.stats().n || 0) : 0;
  const sparse = !!firstRun;

  // Circle: the full relationship map IS the picture — embedded, no field canvas.
  const noCanvas = !sparse && pop === 'circle' && typeof RelationshipMap === 'function';
  // nav v2: lens row at the top, field as its first tab
  const topL = !!topLenses && !sparse;
  const lensList = topL ? [{ id: '__ov', label: 'Overview' }, ...lenses] : lenses;
  const openId = topL ? (lensList.some((l) => l.id === lensOpen) ? lensOpen : '__ov') : null;
  const showField = !topL || openId === '__ov';
  const openLens = topL && openId !== '__ov' ? lenses.find((l) => l.id === openId) : null;
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
      {!sparse && !noCanvas && <MFHeader kicker={cfg.header.kicker} fig={hidden ? '' : cfg.header.fig} unit={hidden ? 'you are not on the map' : cfg.header.unit} right={pop === 'world' ? zoomCtl : seenChip}></MFHeader>}
      {rmHeader && <MFHeader kicker="Your circle" fig={rmHeader.fig} unit={rmHeader.unit} right={null}></MFHeader>}
      {rmHeader && <MFSoWhat pop="circle" zoom={worldZoom} cfg={cfg}></MFSoWhat>}
      {topL && <MirrorLensRow lenses={lensList} open={openId} onOpen={setLensOpen}></MirrorLensRow>}
      {!sparse && !noCanvas && showField && (<>
        <MFCanvas key={pop + ':' + (pop === 'world' ? worldZoom : '') + (hidden ? ':hidden' : '')} nodes={hidden ? [] : cfg.nodes} selId={hidden ? null : selId} onSel={onSel} seedDeg={cfg.seed} mist={hidden ? 0 : cfg.mist} mistSeed={cfg.mistSeed || 1} tall={pop === 'near' || pop === 'world'} stretch={pop === 'world' ? 1.15 : 1.08} maxLabels={pop === 'world' ? (worldZoom === 'world' ? 3 : 4) : undefined}></MFCanvas>
        {hidden
          ? <MFKey items={[{ label: 'hidden — you see nobody, nobody sees you' }]}></MFKey>
          : <MFKey items={cfg.key}></MFKey>}
        {!hidden && pop !== 'near' && pop !== 'world' && <MFSoWhat pop={pop} zoom={worldZoom} cfg={cfg}></MFSoWhat>}
        {!hidden && <MFDetail node={sel} onPerson={onPerson} onJoin={onJoin} onLeave={onLeave} joined={sel && sel.kind === 'group' ? mine.has(sel.data.id) : false}></MFDetail>}
      </>)}
      {noCanvas && showField && (
        <div className="rm-embed">
          <RelationshipMap embedded={true}></RelationshipMap>
        </div>
      )}
      {openLens && (
        <div key={openId} className="fade-in" style={{ paddingTop: 4 }}>
          <Lazy minHeight={480}>{openLens.render()}</Lazy>
        </div>
      )}
      {!topL && !sparse && <MirrorLenses key={pop + ':' + (pop === 'world' ? worldZoom : '') + ':' + (gSel ? gSel.id : '')} lenses={lenses}></MirrorLenses>}
    </div>
  );
}

Object.assign(window, { MirrorFieldBody });
