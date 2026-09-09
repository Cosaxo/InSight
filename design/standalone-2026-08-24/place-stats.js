// place-stats.js — the member scorecards for Oslo / Norway / the world.
// City and country carry TWO crowds: people who live there and people who have
// only visited. The gap between them is the interesting number (a visitor's
// Oslo is safer, prettier and much more expensive than a local's), so both are
// kept, with their own averages and counts. The world has no visitors.
// Baked averages keep the cards full from day one; your own scores come from
// 'rate' questions in the World feed and land in whichever crowd you belong to.
(function () {
  const LS = 'insight.placeRatings.v1';
  const LSR = 'insight.placeRole.v1';
  let mine = {}, roles = {};
  try { mine = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { mine = {}; }
  try { roles = JSON.parse(localStorage.getItem(LSR) || '{}'); } catch (e) { roles = {}; }
  const subs = new Set();

  // [id, label, locals' avg, visitors' avg, locals rating, visitors rating]
  const SPLIT = {
    city: ['Oslo', [
      ['nature', 'Nature access', 9.0, 9.5, 4900, 3000],
      ['transit', 'Getting around', 8.7, 8.3, 4600, 2700],
      ['safety', 'Safety', 8.0, 8.9, 3900, 2200],
      ['food', 'Food scene', 7.2, 6.7, 3600, 2200],
      ['nightlife', 'Nightlife', 6.6, 5.3, 3300, 1900],
      ['friendly', 'Friendliness', 6.3, 4.7, 4200, 2400],
      ['dating', 'Dating', 4.8, 5.6, 3100, 1300],
      ['cost', 'Affordability', 3.5, 2.0, 5000, 3000],
    ]],
    country: ['Norway', [
      ['nature', 'Nature', 9.3, 9.6, 24000, 17000],
      ['safety', 'Safety', 8.7, 9.1, 22000, 16000],
      ['balance', 'Work\u2013life balance', 8.6, 8.1, 21000, 14000],
      ['health', 'Healthcare', 7.7, 8.4, 20000, 13000],
      ['services', 'Public services', 7.4, 8.2, 17000, 12000],
      ['newcomers', 'Openness to newcomers', 6.2, 4.6, 16000, 11000],
      ['weather', 'Weather', 4.4, 3.4, 23000, 16000],
      ['cost', 'Affordability', 3.9, 2.4, 24000, 16000],
    ]],
  };
  const fmtN = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n));
  const SCOPES = {};
  Object.keys(SPLIT).forEach((s) => {
    const [label, rows] = SPLIT[s];
    const cats = rows.map(([id, lab, loc, vis, nl, nv]) => ({
      id, label: lab, loc, vis, nl, nv,
      n: nl + nv, avg: +((loc * nl + vis * nv) / (nl + nv)).toFixed(2),
    }));
    SCOPES[s] = { label, split: true, cats, raters: fmtN(cats.reduce((a, c) => a + c.n, 0)) };
  });
  SCOPES.world = { label: 'the world', split: false, raters: '640k', cats: [
    { id: 'food', label: 'What we eat', avg: 7.4, n: 380000 },
    { id: 'music', label: 'Music right now', avg: 7.0, n: 350000 },
    { id: 'kindness', label: 'Kindness of strangers', avg: 6.9, n: 410000 },
    { id: 'future', label: 'Where it\u2019s heading', avg: 5.1, n: 430000 },
    { id: 'nature', label: 'State of nature', avg: 4.8, n: 440000 },
    { id: 'honesty', label: 'Public honesty', avg: 4.6, n: 340000 },
    { id: 'fairness', label: 'Fairness', avg: 4.2, n: 390000 },
    { id: 'leaders', label: 'Leadership', avg: 3.4, n: 460000 },
  ] };

  const key = (s, c) => s + ':' + c;
  const api = {
    SCOPES,
    cat(scope, catId) { const S = SCOPES[scope]; return S ? S.cats.find((c) => c.id === catId) || null : null; },
    // which crowd you belong to for this place — locals unless you say otherwise
    role(scope) { const S = SCOPES[scope]; return S && S.split ? (roles[scope] === 'visitor' ? 'visitor' : 'local') : 'local'; },
    setRole(scope, r) {
      roles[scope] = r === 'visitor' ? 'visitor' : 'local';
      try { localStorage.setItem(LSR, JSON.stringify(roles)); } catch (e) {}
      subs.forEach((f) => f());
    },
    // that crowd's average for one category (falls back to the blend)
    avgFor(scope, catId, r) {
      const c = api.cat(scope, catId); if (!c) return null;
      if (!c.loc) return c.avg;
      return (r || api.role(scope)) === 'visitor' ? c.vis : c.loc;
    },
    // the whole place, as one crowd sees it
    overall(scope, r) {
      const S = SCOPES[scope]; if (!S) return null;
      const v = S.cats.reduce((a, c) => a + (S.split ? (r === 'visitor' ? c.vis : c.loc) : c.avg), 0);
      return v / S.cats.length;
    },
    myScore(scope, catId) { const v = mine[key(scope, catId)]; return v == null ? null : v; },
    rate(scope, catId, score) {
      mine[key(scope, catId)] = score;
      try { localStorage.setItem(LS, JSON.stringify(mine)); } catch (e) {}
      subs.forEach((f) => f());
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
  window.PLACESTATS = api;

  // the feed questions that fill the scorecards — one per (scope, category)
  const P = [
    ['pr01', 'city', 'safety', 'How safe does Oslo feel?'],
    ['pr02', 'city', 'transit', 'Getting around Oslo \u2014 how good is it?'],
    ['pr03', 'city', 'cost', 'Can a normal person afford Oslo?'],
    ['pr04', 'city', 'friendly', 'How friendly are Oslo people, really?'],
    ['pr05', 'city', 'nightlife', 'Rate Oslo after dark.'],
    ['pr06', 'country', 'nature', 'Norway\u2019s nature \u2014 rate it.'],
    ['pr07', 'country', 'weather', 'The Norwegian weather. Be honest.'],
    ['pr08', 'country', 'balance', 'Work\u2013life balance in Norway?'],
    ['pr09', 'country', 'newcomers', 'How open is Norway to newcomers?'],
    ['pr10', 'world', 'leaders', 'The world\u2019s leadership right now?'],
    ['pr11', 'world', 'kindness', 'How kind are strangers these days?'],
    ['pr12', 'world', 'future', 'Where the world is heading \u2014 rate it.'],
    ['pr13', 'world', 'nature', 'The state of nature worldwide?'],
  ];
  window.PLACE_RATE_QS = P.map(([id, scope, catId, prompt]) => {
    const c = api.cat(scope, catId) || { n: 0 };
    return { id, cat: 'places', type: 'rate', scope, catId, prompt, n: c.n };
  });
})();
