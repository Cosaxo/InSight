// predict-data.js — Predictions: two calls, both against a ten-second clock.
//
//  · CALL  (type 'predict') — a real event, sealed now, scored when it resolves.
//    The crowd's split shows the moment you seal; the truth arrives days later.
//  · READ  (type 'read')    — which side ONE slice of the world picked on a
//    question already settled. Scored instantly, because the answer already exists.
//
// The read's truth is derived with the SAME hash the who-voted sheet draws its
// group bars from, so a read can never disagree with the breakdown behind it.
// The clock is the whole design: ten seconds is long enough to know and too
// short to look up.
//
// Both feed one branch on the map — Foresight (map-fore-card.jsx), where the
// leaves are the subjects you call and the groups you read.
(function () {
  const LS = 'insight.predict.v1';
  // the who-voted sheet's hash, verbatim — the two must never disagree
  function pHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }

  // ── events ────────────────────────────────────────────────────────────────
  // `in` = days until it resolves. Negative = already settled, and `you` is the
  // call you made back then (those arrive as history, not as a fresh question).
  const EV = [
    { id: 'p01', s: 'sport',   in: 2,  prompt: 'Does the transit strike end before the derby kicks off?', a: 'It ends', b: 'It holds', c: 5400 },
    { id: 'p02', s: 'sport',   in: 7,  prompt: 'Does the underdog reach the semi-final?', a: 'They make it', b: 'Knocked out', c: 3100 },
    { id: 'p03', s: 'sport',   in: 11, prompt: 'Do the league leaders drop points before the month is out?', a: 'They slip', b: 'They hold', c: 6600 },
    { id: 'p04', s: 'sport',   in: 16, prompt: 'Does the retiring captain sign for a rival?', a: 'He signs', b: 'He retires', c: 2400 },
    { id: 'p05', s: 'tech',    in: 4,  prompt: 'Does the launch make its window this week?', a: 'It flies', b: 'It slips', c: 4700 },
    { id: 'p06', s: 'tech',    in: 18, prompt: 'Does the delayed handset ship before September?', a: 'It ships', b: 'Delayed again', c: 3900 },
    { id: 'p07', s: 'tech',    in: 26, prompt: 'Does the AI bill clear committee this session?', a: 'It clears', b: 'It stalls', c: 5100 },
    { id: 'p08', s: 'movies',  in: 6,  prompt: 'Does the sequel open above $100M?', a: 'Above', b: 'Below', c: 6100 },
    { id: 'p09', s: 'movies',  in: 14, prompt: 'Does the festival\u2019s top prize go to a first-time director?', a: 'A newcomer', b: 'A known name', c: 2800 },
    { id: 'p10', s: 'music',   in: 5,  prompt: 'Does the surprise album hold number one a second week?', a: 'It holds', b: 'It drops', c: 4300 },
    { id: 'p11', s: 'music',   in: 9,  prompt: 'Does the stadium tour add a third night?', a: 'Third night', b: 'Two only', c: 5800 },
    { id: 'p12', s: 'culture', in: 8,  prompt: 'Does the heatwave break the city\u2019s August record?', a: 'Record falls', b: 'It holds', c: 4900 },
    { id: 'p13', s: 'culture', in: 21, prompt: 'Do the museum\u2019s late openings become permanent?', a: 'Permanent', b: 'Trial ends', c: 6300 },
    { id: 'p14', s: 'event',   in: 12, prompt: 'Does the city-centre car ban survive the council vote?', a: 'It survives', b: 'Voted down', c: 5200 },
    { id: 'p15', s: 'event',   in: 30, prompt: 'Does the four-day week clear its first national vote?', a: 'It clears', b: 'It fails', c: 3600 },
    { id: 'p16', s: 'places',  in: 13, prompt: 'Does the new night line open on schedule?', a: 'On time', b: 'Late', c: 2200 },
    { id: 'p17', s: 'food',    in: 40, prompt: 'Does lab-grown meat reach supermarket shelves this year?', a: 'On shelves', b: 'Not yet', c: 3300 },
    // settled — history, with the call you made
    { id: 'p90', s: 'sport',   in: -1, prompt: 'Did the champion defend the title?', a: 'Defended', b: 'Dethroned', c: 7100, out: 0, you: 0 },
    { id: 'p91', s: 'tech',    in: -1, prompt: 'Did the chip launch slip past July?', a: 'It slipped', b: 'On time', c: 5600, out: 0, you: 1 },
    { id: 'p92', s: 'movies',  in: -2, prompt: 'Did the reboot top the weekend box office?', a: 'Number one', b: 'Beaten', c: 4400, out: 1, you: 1 },
    { id: 'p93', s: 'event',   in: -3, prompt: 'Did the rail deal pass before the deadline?', a: 'It passed', b: 'It collapsed', c: 3800, out: 0, you: 0 },
  ];

  const EVENTS = EV.map((e) => ({
    id: e.id, cat: 'predict', type: 'predict', subject: e.s, prompt: e.prompt,
    days: e.in, out: e.out != null ? e.out : null, you: e.you != null ? e.you : null,
    options: [{ label: e.a, count: e.c }, { label: e.b, count: Math.round(e.c * (0.55 + pHash(e.id + 'o') * 0.9)) }],
  }));

  // ── reads ─────────────────────────────────────────────────────────────────
  // The groups you can be asked to read: the demographic cuts. A test type is a
  // fine thing to break a vote down BY, but "how well do you read Explorers" is
  // a question about a label you invented, not about the world.
  const READ_DIMS = ['age', 'gender', 'edu', 'job', 'where'];
  const DIM_HUE = { age: 40, gender: 320, edu: 260, job: 200, where: 145 };
  // a group label alone can be ambiguous — “Education” is a job sector, “School”
  // is a level — so the chip always names the cut it came from
  const DIM_LABEL = { age: 'Age', gender: 'Gender', edu: 'Education', job: 'Job', where: 'Where' };
  const DIM_PHRASE = { age: 'age groups', gender: 'genders', edu: 'education levels', job: 'jobs', where: 'regions' };

  function grpLabels(dim) {
    const V = window.VOTECUTS;
    return V ? V.groups(dim, null).map((g) => g.label) : [];
  }
  // the sheet's own derivation for one group row — same key, same weights
  function grpPcts(qid, dim, gi, counts) {
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const key = qid + ':' + dim + ':' + gi;
    const w = counts.map((c, oi) => (c / total) * (0.55 + pHash(key + ':' + oi)));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    const ps = w.map((x) => Math.round((x / sum) * 100));
    ps[ps.indexOf(Math.max(...ps))] += 100 - ps.reduce((a, b) => a + b, 0);
    return ps;
  }

  // Build the read pool off questions the crowd has already settled. Two sides
  // only — a three-way call in ten seconds is noise — and never a coin flip:
  // a group split inside six points of even is unfair to score.
  function buildReads() {
    const pool = (window.WORLD_FEED_QS || []).filter((q) => (q.type === 'vote' || q.type === 'duel') && q.options && q.options.length === 2 && !q.scene);
    const out = [];
    pool.forEach((q, i) => {
      const dim = READ_DIMS[Math.floor(pHash(q.id + ':dim') * READ_DIMS.length)];
      const labels = grpLabels(dim);
      if (!labels.length) return;
      const gi = Math.floor(pHash(q.id + ':gi') * labels.length);
      const counts = q.options.map((o) => o.count);
      const ps = grpPcts(q.id, dim, gi, counts);
      if (Math.abs(ps[0] - 50) < 6) return;
      out.push({
        id: 'rd' + q.id, cat: 'predict', type: 'read', src: q.id, dim: dim, gi: gi,
        group: labels[gi], dimLabel: DIM_LABEL[dim], subject: q.cat, prompt: q.prompt, options: q.options,
      });
    });
    // keep it varied: no more than three reads on any one cut
    const per = {};
    return out.filter((r) => (per[r.dim] = (per[r.dim] || 0) + 1) <= 4);
  }

  // ── the log ───────────────────────────────────────────────────────────────
  // Seeded history, because a scoreboard that starts empty says nothing. Each
  // key carries a run of past calls at its own skill; your real calls append.
  const CALL_SKILL = { sport: 0.74, food: 0.66, movies: 0.55, music: 0.5, tech: 0.62, culture: 0.52, event: 0.44, places: 0.6 };
  const READ_SKILL = { age: 0.7, gender: 0.56, edu: 0.45, job: 0.52, where: 0.63 };
  const CROWD = { sport: 0.58, food: 0.55, movies: 0.53, music: 0.51, tech: 0.56, culture: 0.5, event: 0.52, places: 0.54 };

  // per-group skill inside a cut — a cut is never read evenly, so each group
  // gets its own seeded skill spread around the cut's base
  function grpSkill(dim, gi) {
    const base = READ_SKILL[dim] || 0.5;
    return Math.max(0.2, Math.min(0.94, base + (pHash('r:' + dim + ':g' + gi) - 0.5) * 0.5));
  }
  // one group's run: its seed plus every real read you logged against it
  function groupRunsOf(dim) {
    return grpLabels(dim).map((label, gi) => {
      const key = 'r:' + dim + ':g' + gi;
      const n0 = 4 + Math.floor(pHash(key + ':n') * 5);
      const seed = [];
      for (let i = 0; i < n0; i++) seed.push(pHash(key + ':d' + i) < grpSkill(dim, gi));
      const days = seed.concat(S.log.filter((r) => r.k === 'r:' + dim && r.g === gi).map((r) => !!r.ok));
      const right = days.filter(Boolean).length;
      return { gi, label, seed, days, right, n: days.length, rate: days.length ? right / days.length : 0 };
    });
  }
  function interleave(arrs) {
    const out = [];
    for (let i = 0; ; i++) {
      let hit = false;
      arrs.forEach((a) => { if (i < a.length) { out.push(a[i]); hit = true; } });
      if (!hit) return out;
    }
  }

  function seedRun(key, skill) {
    const n = 7 + Math.floor(pHash(key + ':n') * 9);
    const days = [];
    for (let i = 0; i < n; i++) days.push(pHash(key + ':d' + i) < skill);
    return days;
  }

  let S = (function () {
    try { const v = JSON.parse(localStorage.getItem(LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
    catch (e) { return {}; }
  })();
  if (!Array.isArray(S.log)) S.log = [];
  if (!S.calls || typeof S.calls !== 'object') S.calls = {};   // open calls awaiting resolution
  const subs = [];
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} subs.forEach((f) => { try { f(); } catch (e) {} }); }

  const KEYS = () => Object.keys(CALL_SKILL).map((s) => 'c:' + s).concat(READ_DIMS.map((d) => 'r:' + d));

  function runOf(key) {
    const kind = key[0], id = key.slice(2);
    const skill = kind === 'c' ? CALL_SKILL[id] : READ_SKILL[id];
    if (skill == null) return null;
    // a read's history is the sum of its groups — interleaved so it reads as one
    // mixed run — so the cut card and its group cards can never disagree
    const seeded = kind === 'r' ? interleave(groupRunsOf(id).map((g) => g.seed)) : seedRun(key, skill);
    const days = seeded.concat(S.log.filter((r) => r.k === key).map((r) => !!r.ok));
    const right = days.filter(Boolean).length;
    const rate = days.length ? right / days.length : 0;
    // the crowd's own hit rate on this key — the percentile line reads off it
    const base = kind === 'c' ? (CROWD[id] || 0.52) : 0.5 + pHash(key + ':base') * 0.1;
    const pct = Math.max(2, Math.min(98, Math.round(50 + (rate - base) * 210)));
    const mine = S.log.filter((r) => r.k === key).length;
    return { key, kind, id, days, right, n: days.length, rate, base, pct, mine, fresh: !!S.touch && S.touch[key] };
  }

  window.PREDICT = {
    EVENTS, READ_DIMS,
    subscribe(f) { subs.push(f); return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; },
    grpPcts,
    pcts(q) { return grpPcts(q.src, q.dim, q.gi, q.options.map((o) => o.count)); },
    // the group's side on a read card — the truth being called
    truth(q) { const ps = this.pcts(q); return ps.indexOf(Math.max(...ps)); },
    keyOf(q) { return q.type === 'read' ? 'r:' + q.dim : 'c:' + (CALL_SKILL[q.subject] ? q.subject : 'event'); },
    phrase(dim) { return DIM_PHRASE[dim] || dim; },
    // a read scores immediately; a call is sealed and waits for the world
    record(q, val, ok) {
      const key = this.keyOf(q);
      if (q.type === 'read') {
        if (S.log.some((r) => r.id === q.id)) return;
        S.log.push({ id: q.id, k: key, ok: !!ok, g: q.gi });
      } else {
        S.calls[q.id] = { k: key, v: val, t: Date.now() };
      }
      S.touch = S.touch || {};
      S.touch[key] = 1;
      save();
    },
    openCalls() { return Object.keys(S.calls).length; },
    groupRuns(dim) { return groupRunsOf(dim); },
    // the events behind one Calls subject — sealed calls waiting, settled ones scored
    callsFor(key) {
      const id = key.slice(2);
      const evs = EVENTS.filter((e) => (CALL_SKILL[e.subject] ? e.subject : 'event') === id);
      return {
        open: evs.filter((e) => e.days > 0 && S.calls[e.id]).map((e) => ({ prompt: e.prompt, days: e.days, pick: e.options[S.calls[e.id].v] ? e.options[S.calls[e.id].v].label : '' })),
        settled: evs.filter((e) => e.days < 0 && e.you != null).map((e) => ({ prompt: e.prompt, ok: e.you === e.out, pick: e.options[e.you].label })),
      };
    },
    runs() { return KEYS().map(runOf).filter(Boolean); },
    run(key) { return runOf(key); },
    label(key) {
      const id = key.slice(2);
      if (key[0] === 'c') { const t = (window.WORLD_TOPICS || []).find((x) => x.id === id); return t ? t.label : id; }
      const V = window.VOTECUTS; const d = V ? V.dims().find((x) => x.id === id) : null;
      return d ? d.label : id;
    },
    hueOf(key) {
      if (key[0] === 'r') return DIM_HUE[key.slice(2)] || 300;
      const t = (window.WORLD_TOPICS || []).find((x) => x.id === key.slice(2));
      const m = t && /([\d.]+)\)$/.exec(t.color);
      return m ? Math.round(parseFloat(m[1])) : 115;
    },
    // ── the map's Foresight branch ──
    // Cuts are hubs, the groups inside them are leaves — laid out like every
    // other branch cloud. Hollow marks below your average; the single sharpest
    // read and blind spot get callouts.
    mapTree() {
      // hub badge: your standing across every cut, plus how many reads wait in the feed
      const rds = this.runs().filter((x) => x.kind === 'r');
      const avg = rds.length ? Math.round(rds.reduce((s, x) => s + x.pct, 0) / rds.length) : null;
      const waiting = (window.WORLD_FEED_QS || []).filter((q) => q.type === 'read' && !S.log.some((r) => r.id === q.id)).length;
      const cats = [
        // Calls is parked for now — sealed events can't show skill until they
        // resolve, and they diluted the Reads story. Data + feed still carry them.
        { id: 'fore-reads', label: 'Intuition', hue: 282, fore: true, badge: avg != null && avg >= 50 ? 'top ' + (100 - avg) + '%' : null, waiting },
      ];
      const nodes = [];
      const reads = [];
      this.runs().forEach((r) => {
        const label = window.PREDICT.label(r.key);
        if (r.kind === 'c') return; // no Calls on the map for now
        // a cut is a hub; the groups inside it are the leaves — hollow means
        // below your average on this cut.
        const subId = 'fore-' + r.key.replace(':', '-');
        nodes.push({ id: subId, parentId: 'fore-reads', sub: true, fore: true, fkey: r.key, label, age: r.fresh ? 0 : 30 });
        groupRunsOf(r.id).forEach((g) => {
          reads.push({
            id: subId + '-g' + g.gi, parentId: subId,
            fore: true, daily: true, fkey: r.key, gi: g.gi, label: g.label, tag: g.label,
            ctx: label, ev: g.n, rate: g.rate,
            ans: g.right + '/' + g.n, prompt: label + ' · ' + g.label,
            note: g.rate >= r.rate ? 'sharp' : 'blind spot',
            age: r.fresh ? 0 : 30, typ: g.rate, maj: g.rate >= r.rate,
          });
        });
      });
      // one voice each: only the single sharpest read and the single blind spot
      // across every cut get a callout — everything else stays a quiet dot
      if (reads.length > 1) {
        const byRate = reads.slice().sort((a, b) => b.rate - a.rate);
        byRate[0].ext = 'sharpest'; byRate[0].ctx = 'sharpest';
        byRate[byRate.length - 1].ext = 'blind spot'; byRate[byRate.length - 1].ctx = 'blind spot';
      }
      reads.forEach((n) => { delete n.rate; nodes.push(n); });
      return { cats, nodes };
    },
    reset() { S = { log: [], calls: {} }; save(); },
  };

  // ── into the feed ─────────────────────────────────────────────────────────
  (window.WORLD_TOPICS || []).push({ id: 'predict', label: 'Predictions', color: 'oklch(0.52 0.14 115)' });
  if (window.WORLD_CHANNELS) window.WORLD_CHANNELS.push('predict');
  const open = EVENTS.filter((e) => e.days > 0);
  const settled = EVENTS.filter((e) => e.days < 0);
  window.WORLD_FEED_QS = (window.WORLD_FEED_QS || []).concat(open, settled, buildReads());
})();
