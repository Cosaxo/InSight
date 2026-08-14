// type-mix.js — types leave the profile. A type is already drawn as a mark
// (type-marks.jsx); here it becomes a property of a POPULATION: who is here, by
// type, and which of them you can actually see.
//
// Honest by construction, same rules as the pulse:
//   · every count is out of a stated basis — "the latest 200 voters here"
//   · absent = zero: a type nobody in the sample carries is named as missing,
//     never drawn as a sliver
//   · a type seen once or twice is listed with its count, never ranked
//   · the sample (200) and the people you can see (the opt-ins) are different
//     numbers, and the card never blurs them
(function () {
  const TEST = 'big5';
  const THIN = 8;                 // below this, a count is listed, not ranked
  const SMALL = 40;               // below this, a basis has no shares at all

  const BASIS = {
    around:  { n: 200, label: 'of the latest 200 voters near you' },
    city:    { n: 200, label: 'of the latest 200 voters in Oslo' },
    country: { n: 200, label: 'of the latest 200 voters in Norway' },
    world:   { n: 200, label: 'of the latest 200 voters worldwide' },
    groups:  { n: 200, label: 'of the latest 200 voters in your circles' },
    people:  { n: 12,  label: 'of your 12 close ties' },
  };

  // counts per type, out of the basis. Zeros are deliberate.
  const MIX = {
    around: { 'The Quiet One': 30, 'The Dependable': 25, 'The Reader': 23, 'The Diplomat': 19, 'The Lookout': 18, 'The Host': 16, 'The Planner': 15, 'The Plain Speaker': 14, 'The Enthusiast': 12, 'The Sensitive': 11, 'The Drifter': 7, 'The Live Wire': 6, 'The Hothead': 4 },
    city:    { 'The Quiet One': 34, 'The Dependable': 27, 'The Reader': 24, 'The Diplomat': 21, 'The Lookout': 19, 'The Planner': 17, 'The Host': 15, 'The Plain Speaker': 14, 'The Enthusiast': 13, 'The Sensitive': 12, 'The Drifter': 4, 'The Live Wire': 0, 'The Hothead': 0 },
    country: { 'The Dependable': 30, 'The Quiet One': 28, 'The Lookout': 22, 'The Planner': 20, 'The Reader': 19, 'The Plain Speaker': 17, 'The Diplomat': 16, 'The Host': 15, 'The Enthusiast': 13, 'The Sensitive': 10, 'The Drifter': 7, 'The Live Wire': 3, 'The Hothead': 0 },
    world:   { 'The Dependable': 26, 'The Host': 22, 'The Quiet One': 21, 'The Reader': 19, 'The Lookout': 18, 'The Plain Speaker': 17, 'The Live Wire': 16, 'The Diplomat': 15, 'The Enthusiast': 14, 'The Planner': 13, 'The Sensitive': 10, 'The Drifter': 6, 'The Hothead': 3 },
    groups:  { 'The Host': 31, 'The Enthusiast': 26, 'The Diplomat': 24, 'The Dependable': 22, 'The Live Wire': 20, 'The Reader': 18, 'The Quiet One': 17, 'The Planner': 14, 'The Plain Speaker': 12, 'The Lookout': 10, 'The Drifter': 6, 'The Sensitive': 0, 'The Hothead': 0 },
    people:  { 'The Dependable': 3, 'The Quiet One': 2, 'The Host': 2, 'The Reader': 1, 'The Planner': 1, 'The Diplomat': 1, 'The Plain Speaker': 1, 'The Enthusiast': 1 },
  };

  // the members of each population who opted in to be seen — always fewer than
  // the sample, which is the point of the two numbers
  const ROSTER = {
    city: [
      { init: 'AK', name: 'Anders K.', place: 'Torshov', hue: 145, type: 'The Quiet One', match: 92 },
      { init: 'IM', name: 'Ingrid M.', place: 'Grünerløkka', hue: 38, type: 'The Diplomat', match: 89 },
      { init: 'PV', name: 'Petter V.', place: 'Sagene', hue: 250, type: 'The Lookout', match: 85 },
      { init: 'HR', name: 'Hedda R.', place: 'Frogner', hue: 300, type: 'The Dependable', match: 81 },
      { init: 'OB', name: 'Ola B.', place: 'Gamle Oslo', hue: 200, type: 'The Quiet One', match: 77 },
      { init: 'NS', name: 'Nora S.', place: 'Bjørvika', hue: 110, type: 'The Plain Speaker', match: 74 },
      { init: 'KL', name: 'Kaja L.', place: 'Nordstrand', hue: 24, type: 'The Reader', match: 71 },
      { init: 'SA', name: 'Sindre A.', place: 'Majorstuen', hue: 78, type: 'The Planner', match: 68 },
    ],
    country: [
      { init: 'SB', name: 'Sigrid B.', place: 'Tromsø', hue: 200, type: 'The Quiet One', match: 94 },
      { init: 'EH', name: 'Eirik H.', place: 'Bergen', hue: 220, type: 'The Dependable', match: 90 },
      { init: 'LT', name: 'Live T.', place: 'Trondheim', hue: 145, type: 'The Reader', match: 87 },
      { init: 'AN', name: 'Ask N.', place: 'Stavanger', hue: 38, type: 'The Planner', match: 82 },
      { init: 'MD', name: 'Maren D.', place: 'Ålesund', hue: 300, type: 'The Lookout', match: 78 },
      { init: 'JF', name: 'Jonas F.', place: 'Bodø', hue: 250, type: 'The Plain Speaker', match: 73 },
      { init: 'TK', name: 'Tuva K.', place: 'Kristiansand', hue: 24, type: 'The Dependable', match: 69 },
    ],
    world: [
      { init: 'YO', name: 'Yuki O.', place: 'Osaka · JP', hue: 250, type: 'The Quiet One', match: 96 },
      { init: 'RD', name: 'Rui D.', place: 'Porto · PT', hue: 38, type: 'The Dependable', match: 94 },
      { init: 'CS', name: 'Clara S.', place: 'Valparaíso · CL', hue: 145, type: 'The Host', match: 91 },
      { init: 'AO', name: 'Amara O.', place: 'Lagos · NG', hue: 78, type: 'The Live Wire', match: 88 },
      { init: 'TM', name: 'Théo M.', place: 'Lyon · FR', hue: 220, type: 'The Reader', match: 84 },
      { init: 'NH', name: 'Nadia H.', place: 'Beirut · LB', hue: 300, type: 'The Diplomat', match: 80 },
      { init: 'KA', name: 'Ken A.', place: 'Vancouver · CA', hue: 200, type: 'The Lookout', match: 76 },
      { init: 'MP', name: 'Mira P.', place: 'Delhi · IN', hue: 24, type: 'The Plain Speaker', match: 72 },
    ],
  };

  const types = () => (((window.IS_ARCHETYPES || {})[TEST] || {}).list || []).map((t) => t.name);
  const hash = (s) => { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; };

  // one type per person, stable: a roster type if there is one, else hashed off
  // the name so the same person reads the same everywhere they appear
  const byName = {};
  Object.values(ROSTER).forEach((list) => list.forEach((p) => { byName[p.name] = p.type; }));
  const typeOf = (key) => {
    if (!key) return null;
    if (byName[key]) return byName[key];
    const list = types();
    if (!list.length) return null;
    return list[Math.floor(hash(String(key)) * list.length)];
  };

  const fromData = (list) => (list || []).map((p) => ({
    init: p.init, name: p.name, place: p.hood || p.place || p.dist || p.role || '',
    hue: p.hue || 38, match: p.match, type: typeOf(p.name),
  }));

  window.TYPEMIX = {
    TEST, THIN, SMALL,
    types,
    typeOf,
    basis: (audId) => BASIS[audId] || BASIS.city,
    // ranked, thin and absent kept apart — the card never mixes them
    mix(audId) {
      const m = MIX[audId] || MIX.city;
      const rows = types().map((name) => ({ name, n: m[name] || 0 }));
      return {
        ranked: rows.filter((r) => r.n >= THIN).sort((a, b) => b.n - a.n),
        thin: rows.filter((r) => r.n > 0 && r.n < THIN).sort((a, b) => b.n - a.n),
        absent: rows.filter((r) => r.n === 0),
        counted: rows.reduce((a, r) => a + r.n, 0),
      };
    },
    people(audId) {
      const D = window.IS_DATA || {};
      if (audId === 'people' || audId === 'groups') return fromData(D.people);
      if (audId === 'around') return fromData(D.nearby);
      return ROSTER[audId] || ROSTER.city;
    },
    // your own type — from the test if you've taken it, else from your profile
    mine() {
      const R = (window.IS_TEST_RESULTS || {})[TEST];
      if (R && R.dims && window.IS_matchArchetype) {
        const a = window.IS_matchArchetype(TEST, R.dims);
        if (a) return a.list[a.idx].name;
      }
      const P = ((window.IS_DATA || {}).me || {}).personality;
      if (P && window.IS_matchArchetype) {
        const a = window.IS_matchArchetype(TEST, Object.keys(P).map((id) => ({ id, value: P[id] })));
        if (a) return a.list[a.idx].name;
      }
      return null;
    },
    line: (name) => { const t = (((window.IS_ARCHETYPES || {})[TEST] || {}).list || []).find((x) => x.name === name); return t ? t.line : ''; },
  };
})();
