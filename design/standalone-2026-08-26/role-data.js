// role-data.js — YOUR ROLE, as a test result. The duels (duels-data.js) already
// record how each 1v1 and each group goes; this reads that record as an
// INSTRUMENT: four dimensions per setting, matched to a named type the same way
// every other test is. It registers itself into the test machinery — RP_TESTS,
// IS_ARCHETYPES, IS_TEST_AVG, IS_TEST_RESULTS — under 'duo' and 'group' for the
// average across settings, and 'duo:<pid>' / 'group:<gid>' for a single one. So a
// role card IS a result card: same rose, same rarity, same nearby types, no new
// visual language invented for it.
(function () {
  const MIN_DUO = 3;   // fewer revealed days than this and a run says nothing
  const MIN_GROUP = 2;

  // ── the two instruments ─────────────────────────────────────────────────────
  // 1v1 hues sit in the rose family (--c-people), groups in gold (--c-groups),
  // so a role card is already the colour of the setting it describes.
  const CFG = {
    duo: {
      banner: 'oklch(0.47 0.11 8)',
      kicker: 'Role \u00b7 in 1v1s',
      title: 'Your 1v1 role',
      accent: 'var(--c-people)',
      hues: { read: 8, seen: 35, like: 62, steady: 340 },
      poles: {
        read:   ['misses them', 'calls them'],
        seen:   ['unreadable', 'easy to call'],
        like:   ['worlds apart', 'in step'],
        steady: ['streaky', 'steady'],
      },
      labels: { read: 'Insight', seen: 'Legibility', like: 'Likeness', steady: 'Steadiness' },
    },
    group: {
      banner: 'oklch(0.47 0.10 85)',
      kicker: 'Role \u00b7 in groups',
      title: 'Your group role',
      accent: 'var(--c-groups)',
      hues: { own: 85, pull: 115, cast: 55, settle: 140 },
      poles: {
        own:    ['joins in', 'goes own way'],
        pull:   ['on the edge', 'in the middle'],
        cast:   ['unnamed', 'first pick'],
        settle: ['swings', 'settled'],
      },
      labels: { own: 'Independence', pull: 'Centrality', cast: 'Standing', settle: 'Steadiness' },
    },
  };

  const AVG = {
    duo:   { read: 62, seen: 62, like: 54, steady: 58 },
    group: { own: 32, pull: 56, cast: 50, settle: 62 },
  };

  const RULE_WORD = {
    duo:   { read: 'insight', seen: 'legibility', like: 'likeness', steady: 'steadiness' },
    group: { own: 'independence', pull: 'centrality', cast: 'standing', settle: 'steadiness' },
  };
  const RULE_ADJ = {
    duo:   { read: ['off their read', 'sharp on them'], seen: ['hard to call', 'easy to call'], like: ['unalike', 'alike'], steady: ['streaky', 'steady'] },
    group: { own: ['along with it', 'own-way'], pull: ['on the edge', 'in the middle'], cast: ['unnamed', 'first-picked'], settle: ['swinging', 'settled'] },
  };
  const DIM_WORD = {
    duo:   { read: ['less sharp on them', 'sharper on them'], seen: ['harder to call', 'easier to call'], like: ['less alike', 'more alike'], steady: ['streakier', 'steadier'] },
    group: { own: ['more along with it', 'more own-way'], pull: ['further out', 'closer to the middle'], cast: ['less named', 'more often named'], settle: ['more swinging', 'more settled'] },
  };

  // ── the named types ─────────────────────────────────────────────────────────
  // Same discipline as archetype-data.js: extreme on the 1–2 dims that DEFINE
  // the type, near-neutral elsewhere, shares summing to ~100.
  const DUO_TYPES = [
    { name: 'The Mind Reader',  share: 7,  line: 'Calls their answer before they do.',        sig: { read: 92, seen: 52, like: 55, steady: 68 } },
    { name: 'The Open Book',    share: 12, line: 'Easy to call, and fine with it.',           sig: { read: 52, seen: 92, like: 58, steady: 62 } },
    { name: 'The Poker Face',   share: 8,  line: 'Nobody\u2019s guess lands.',                sig: { read: 55, seen: 10, like: 45, steady: 60 } },
    { name: 'The Two-Way',      share: 6,  line: 'You read each other equally well.',         sig: { read: 86, seen: 86, like: 66, steady: 72 } },
    { name: 'The Stranger',     share: 9,  line: 'Two people still guessing.',                sig: { read: 18, seen: 20, like: 42, steady: 45 } },
    { name: 'The Twin',         share: 13, line: 'Same answer before either of you guesses.', sig: { read: 64, seen: 64, like: 94, steady: 70 } },
    { name: 'The Wildcard',     share: 10, line: 'Right, wrong, right \u2014 no pattern to hold.', sig: { read: 55, seen: 48, like: 50, steady: 8 } },
    { name: 'The Opposite',     share: 11, line: 'Never the same answer \u2014 you read each other anyway.', sig: { read: 72, seen: 68, like: 8, steady: 60 } },
    { name: 'The Watcher',      share: 9,  line: 'Reads more than gets read.',                sig: { read: 82, seen: 24, like: 50, steady: 66 } },
    { name: 'The Steady Hand',  share: 15, line: 'Same call, week after week.',               sig: { read: 60, seen: 60, like: 55, steady: 94 } },
  ];
  const GROUP_TYPES = [
    { name: 'The Anchor',         share: 13, line: 'Where the group lands, you already were.',   sig: { own: 12, pull: 84, cast: 68, settle: 86 } },
    { name: 'The Contrarian',     share: 9,  line: 'The one vote against, most weeks.',          sig: { own: 92, pull: 28, cast: 42, settle: 58 } },
    { name: 'The Bellwether',     share: 12, line: 'Vote with you and you vote with everyone.',  sig: { own: 20, pull: 92, cast: 48, settle: 66 } },
    { name: 'The Wildcard',       share: 11, line: 'In with them, then out, no rhythm.',         sig: { own: 58, pull: 44, cast: 38, settle: 8 } },
    { name: 'The First Pick',     share: 8,  line: 'Whatever the scenario, your name comes up.', sig: { own: 46, pull: 54, cast: 94, settle: 62 } },
    { name: 'The Quiet Majority', share: 16, line: 'With the group, never at the front.',        sig: { own: 10, pull: 68, cast: 12, settle: 78 } },
    { name: 'The Outlier',        share: 7,  line: 'Your own answer, every time.',               sig: { own: 88, pull: 10, cast: 22, settle: 54 } },
    { name: 'The Floater',        share: 14, line: 'Present, uncommitted.',                      sig: { own: 46, pull: 46, cast: 16, settle: 44 } },
    { name: 'The Spark',          share: 10, line: 'Pulls the group off its default.',           sig: { own: 72, pull: 56, cast: 78, settle: 40 } },
  ];

  // ── the maths ───────────────────────────────────────────────────────────────
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const rate = (r, t) => (t ? clamp((r / t) * 100) : 50);
  // a run's steadiness is its lack of flips: 111000 is steady, 101010 is not.
  // A coin lands near 50, which is what makes it comparable to a trait score.
  const steadiness = (arr) => {
    if (!arr || arr.length < 2) return 50;
    return clamp(100 - (flipsOf(arr) / (arr.length - 1)) * 100);
  };
  const flipsOf = (arr) => { let f = 0; for (let i = 1; i < arr.length; i++) if (!!arr[i] !== !!arr[i - 1]) f++; return f; };

  function duoDims(pid) {
    const D = window.DUELS; if (!D) return null;
    const p = D.partners().find((x) => x.id === pid);
    if (!p || p.played < MIN_DUO) return null;
    const run = (key) => Array.from({ length: p.played }, (_, i) => !!D.duoDay(pid, p.played - i)[key]);
    // likeness: days you both gave the same ANSWER — the answers, not the guesses
    const sameRun = Array.from({ length: p.played }, (_, i) => { const d = D.duoDay(pid, p.played - i); return d.myAns != null && d.myAns === d.theirAns; });
    const nSame = sameRun.filter(Boolean).length;
    const readRun = run('readRight');
    const flips = flipsOf(readRun);
    // each dim carries its receipt — the plain count the score is made of
    return {
      n: p.played,
      dims: [
        { id: 'read',   label: CFG.duo.labels.read,   value: rate(p.read.right, p.read.total),     note: `right on ${p.read.right} of your ${p.read.total} guesses` },
        { id: 'seen',   label: CFG.duo.labels.seen,   value: rate(p.readBy.right, p.readBy.total), note: `they\u2019re right on ${p.readBy.right} of their ${p.readBy.total}` },
        { id: 'like',   label: CFG.duo.labels.like,   value: rate(nSame, p.played),                note: `same answer on ${nSame} of ${p.played} days` },
        { id: 'steady', label: CFG.duo.labels.steady, value: steadiness(readRun),                  note: `your read flipped ${flips} time${flips === 1 ? '' : 's'} in ${p.played} days` },
      ],
    };
  }

  function groupDims(gid) {
    const D = window.DUELS; if (!D) return null;
    const P = D.groupPortrait(gid);
    if (!P || P.days < MIN_GROUP) return null;
    const ms = D.groupMembers(gid).filter((m) => !m.pending);
    const wm = ms.reduce((s, m) => s + (P.withMe[m.id] || 0), 0);
    const pull = ms.length ? wm / (ms.length * P.days) : 0.5;
    // standing: roles the group crowns YOU with, against an even split of them
    let cast = 50, castNote = null;
    if (D.roleVotes) {
      const rv = D.roleVotes(gid);
      if (rv && rv.roles.length && rv.targets.length) {
        const wins = rv.roles.filter((r) => r.winner === 'me').length;
        const fair = 1 / rv.targets.length;
        cast = clamp((wins / rv.roles.length / fair) * 50);
        castNote = `crowned in ${wins} of ${rv.roles.length} scenario votes`;
      }
    }
    const majRun = Array.from({ length: P.days }, (_, i) => {
      const pk = D.groupPicks(gid, i + 1);
      return pk.mine === pk.majority;
    });
    const mflips = flipsOf(majRun);
    return {
      n: P.days,
      dims: [
        { id: 'own',    label: CFG.group.labels.own,    value: clamp(100 - (P.meWithMaj / P.days) * 100), note: `away from the majority on ${P.days - P.meWithMaj} of ${P.days} days` },
        { id: 'pull',   label: CFG.group.labels.pull,   value: clamp(pull * 100), note: `others landed with you ${wm} of ${ms.length * P.days} times` },
        { id: 'cast',   label: CFG.group.labels.cast,   value: cast, note: castNote },
        { id: 'settle', label: CFG.group.labels.settle, value: steadiness(majRun), note: `switched sides ${mflips} time${mflips === 1 ? '' : 's'} in ${P.days} days` },
      ],
    };
  }

  // the average across settings, weighted by days — a three-day duel must not
  // swing the portrait as hard as a twenty-four-day one
  function blend(kind, items) {
    if (!items.length) return null;
    const ids = Object.keys(CFG[kind].hues);
    const wTotal = items.reduce((s, it) => s + it.n, 0) || 1;
    return {
      n: items.length,
      days: wTotal,
      dims: ids.map((id) => ({
        id, label: CFG[kind].labels[id],
        value: clamp(items.reduce((s, it) => s + it.dims.find((d) => d.id === id).value * it.n, 0) / wTotal),
      })),
    };
  }

  // ── the same instruments turned toward one PERSON — their vantage of the
  // shared record. Duo: swap the sides (their insight = their right guesses on
  // you; their legibility = yours on them; steadiness = THEIR guess run).
  function duoDimsTheirs(pid) {
    const D = window.DUELS; if (!D) return null;
    const p = D.partners().find((x) => x.id === pid);
    if (!p || p.played < MIN_DUO) return null;
    const byRun = Array.from({ length: p.played }, (_, i) => !!D.duoDay(pid, p.played - i).byRight);
    const sameRun = Array.from({ length: p.played }, (_, i) => { const d = D.duoDay(pid, p.played - i); return d.myAns != null && d.myAns === d.theirAns; });
    const nSame = sameRun.filter(Boolean).length;
    return {
      n: p.played,
      dims: [
        { id: 'read',   value: rate(p.readBy.right, p.readBy.total) },
        { id: 'seen',   value: rate(p.read.right, p.read.total) },
        { id: 'like',   value: rate(nSame, p.played) },
        { id: 'steady', value: steadiness(byRun) },
      ],
    };
  }
  // Group: the member's own alignment, pull, crowns and steadiness in one group.
  function groupDimsFor(gid, pid) {
    const D = window.DUELS; if (!D) return null;
    const P = D.groupPortrait(gid);
    if (!P || P.days < MIN_GROUP || P.withMaj[pid] == null) return null;
    const ms = D.groupMembers(gid).filter((m) => !m.pending);
    let withThem = 0; const majRun = [];
    for (let i = 1; i <= P.days; i++) {
      const g = D.groupPicks(gid, i);
      const row = g.rows.find((r) => r.who.some((w) => w.id === pid));
      if (!row) { majRun.push(true); continue; }
      withThem += g.counts[row.oi] - 1; // everyone on their option but them
      majRun.push(row.oi === g.majority);
    }
    const pull = ms.length && P.days ? withThem / (ms.length * P.days) : 0.5;
    let cast = 50;
    if (D.roleVotes) {
      const rv = D.roleVotes(gid);
      if (rv && rv.roles.length && rv.targets.indexOf(pid) >= 0) {
        const wins = rv.roles.filter((r) => r.winner === pid).length;
        cast = clamp((wins / rv.roles.length / (1 / rv.targets.length)) * 50);
      }
    }
    return {
      n: P.days,
      dims: [
        { id: 'own',    value: clamp(100 - (P.withMaj[pid] / P.days) * 100) },
        { id: 'pull',   value: clamp(pull * 100) },
        { id: 'cast',   value: cast },
        { id: 'settle', value: steadiness(majRun) },
      ],
    };
  }
  // nearest named type for a person: their duo run with you + all shared groups
  // (blended by days). Returns { duo: {name,line,n}|null, group: {...}|null }.
  function personTypes(pid) {
    const M = window.IS_matchArchetype;
    let A = window.IS_ARCHETYPES || {};
    // self-heal: sync() bails during module load (registries not created yet)
    // and nothing else re-runs it until a duel-state mutation
    if (M && (!A.duo || !A.group)) { sync(); A = window.IS_ARCHETYPES || {}; }
    const out = { duo: null, group: null };
    if (!M) return out;
    const d = duoDimsTheirs(pid);
    if (d && A.duo) { const m = M('duo', d.dims); if (m) out.duo = { ...m.list[m.idx], n: d.n }; }
    const shared = window.DUELS ? window.DUELS.groups().filter((g) => g.members.some((mm) => mm.id === pid)) : [];
    const items = shared.map((g) => groupDimsFor(g.id, pid)).filter(Boolean);
    const g = blend('group', items);
    if (g && A.group) { const m = M('group', g.dims); if (m) out.group = { ...m.list[m.idx], n: items.length }; }
    return out;
  }

  function duoList() {
    const D = window.DUELS; if (!D) return [];
    return D.partners().filter((p) => p.state !== 'invited').map((p) => ({ p, r: duoDims(p.id) }));
  }
  function groupList() {
    const D = window.DUELS; if (!D) return [];
    return D.groups().map((g) => ({ g, r: groupDims(g.id) }));
  }

  // ── registration: one test key per setting, plus the two averages ──────────
  function put(key, kind, res, kicker, title) {
    window.RP_TESTS[key] = { ...CFG[kind], kicker, title };
    window.IS_ARCHETYPES[key] = { list: kind === 'duo' ? DUO_TYPES : GROUP_TYPES };
    window.IS_TEST_AVG[key] = AVG[kind];
    window.IS_RULE_WORD[key] = RULE_WORD[kind];
    window.IS_RULE_ADJ[key] = RULE_ADJ[kind];
    window.IS_DIM_WORD[key] = DIM_WORD[kind];
    window.IS_TEST_RESULTS[key] = { title, accent: CFG[kind].accent, dims: res.dims };
  }

  function sync() {
    if (!window.RP_TESTS || !window.IS_ARCHETYPES || !window.IS_TEST_RESULTS) return;
    const duos = duoList().filter((x) => x.r);
    const groups = groupList().filter((x) => x.r);
    duos.forEach(({ p, r }) => put('duo:' + p.id, 'duo', r, 'Role \u00b7 1v1 with ' + String(p.name).split(' ')[0], 'With ' + String(p.name).split(' ')[0]));
    groups.forEach(({ g, r }) => put('group:' + g.id, 'group', r, 'Role \u00b7 ' + g.name, 'In ' + g.name));
    const dAvg = blend('duo', duos.map((x) => x.r));
    const gAvg = blend('group', groups.map((x) => x.r));
    if (dAvg) put('duo', 'duo', dAvg, CFG.duo.kicker, CFG.duo.title); else delete window.IS_TEST_RESULTS.duo;
    if (gAvg) put('group', 'group', gAvg, CFG.group.kicker, CFG.group.title); else delete window.IS_TEST_RESULTS.group;
    return { duos, groups, dAvg, gAvg };
  }

  // the record changes as you play — the instrument has to follow it
  if (window.DUELS) window.DUELS.subscribe(sync);
  sync();

  window.ROLES = { sync, duoDims, groupDims, duoList, groupList, personTypes, MIN_DUO, MIN_GROUP, CFG };
})();
