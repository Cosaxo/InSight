// duels-data.js — the "know each other" layer.
//  · GROUP: one question a day for each named circle; answers sealed until
//    tomorrow, then revealed WITH NAMES. Groups can be created, edited, left.
//  · 1v1: answer today's question AND guess what the other person picked;
//    both sides reveal tomorrow. 1v1s start with an invite (friends only).
// Partner behaviour is deterministic mock; your own answers, your custom
// groups and your invites persist to localStorage. The circle = your friends
// (window.FRIENDS). Read/being-read scores feed the Map's People branch.
(function () {
  const DAYS = ['Today', 'Yesterday', 'Tue', 'Mon', 'Sun', 'Sat', 'Fri'];
  function h01(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 8) % 100000) / 100000;
  }

  // ── persistence — your answers + your social edits ─────────────────────────
  const LS = 'insight.duels.v1';
  let S;
  try { S = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { S = {}; }
  if (!S || typeof S !== 'object') S = {};
  S.groups = S.groups || {};   // gid → { dayId → your option index }
  S.duo = S.duo || {};         // pid → { a: your answer idx, g: your guess idx } (today)
  S.duoList = Array.isArray(S.duoList) ? S.duoList : null; // active 1v1 pids (null = seed)
  S.duoInv = S.duoInv || {};   // pid → invite ts (waiting on them)
  S.myGroups = Array.isArray(S.myGroups) ? S.myGroups : []; // custom groups
  S.groupIds = S.groupIds || {};   // seeded-gid → edited member ids
  S.groupPend = S.groupPend || {}; // gid → { pid → invite ts }
  S.left = Array.isArray(S.left) ? S.left : []; // gids you left
  const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) {} });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} fire(); };

  // ── the circle — your friends ───────────────────────────────────────────────
  const IDS = ['f1', 'f2', 'f4', 'f6', 'f3']; // fallback if FRIENDS is absent
  const allPeople = () => (window.IS_DATA && window.IS_DATA.people) || [];
  const circleIds = () => (window.FRIENDS ? window.FRIENDS.list() : IDS);
  function members() { return circleIds().map((id) => allPeople().find((p) => p.id === id)).filter(Boolean); }
  const personOf = (pid) => allPeople().find((p) => p.id === pid);

  // ── invite acceptance — duos + group members, deterministic short delays ───
  function accDelay(k) { return 9000 + Math.floor(h01('acc' + k) * 18000); }
  function sweep() {
    const now = Date.now(); let hit = false;
    Object.keys(S.duoInv).forEach((pid) => {
      if (now - S.duoInv[pid] >= accDelay('d' + pid)) { delete S.duoInv[pid]; if (!duoList().includes(pid)) duoList().push(pid); hit = true; }
    });
    Object.keys(S.groupPend).forEach((gid) => {
      const m = S.groupPend[gid];
      Object.keys(m).forEach((pid) => { if (now - m[pid] >= accDelay('g' + gid + pid)) { delete m[pid]; hit = true; } });
    });
    if (hit) save();
  }
  const hasPend = () => Object.keys(S.duoInv).length > 0 || Object.keys(S.groupPend).some((g) => Object.keys(S.groupPend[g]).length > 0);
  let timer = null;
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => { if (!hasPend()) { clearInterval(timer); timer = null; return; } sweep(); }, 2500);
  }
  if (hasPend()) ensureTimer();

  // ── GROUP: one question a day (idx 0 = today) ──────────────────────────────
  // Three kinds: classic (options), 'pick' (options = the members — a verdict
  // about one of you) and 'us' (options describe the group — feeds its portrait).
  // Mostly 'us' (feeds the portrait) + verdict 'pick's. Role-cast scenarios
  // (heist/island/sitcom/zombie) live ONLY in SCENARIOS — no duplicates here.
  const GROUP_QS = [
    { id: 'gu0', kind: 'us', prompt: 'What actually holds this group together?', options: ['Food', 'Banter', 'Showing up', 'History'] },
    { id: 'gp0', kind: 'pick', prompt: "Who'd survive longest in the wild?" },
    { id: 'gu1', kind: 'us', prompt: "This group's superpower?", options: ['Honesty', 'Loyalty', 'Chaos', 'Calm'] },
    { id: 'gd3', prompt: 'Best dinner together: cook, or book a table?', options: ['Cook together', 'Book a table'] },
    { id: 'gu3', kind: 'us', prompt: 'When we disagree, we…', options: ['Talk it out', 'Vote', 'Let it slide', 'Loudest wins'] },
    { id: 'gp1', kind: 'pick', prompt: 'Who replies to the group chat within a minute?' },
    { id: 'gu4', kind: 'us', prompt: 'A stranger joins us for an evening. They leave thinking…', options: ['So loud', 'So close', 'So weird', 'So fun'] },
    { id: 'gd0', prompt: 'A winter cabin with no wifi. How long do you last?', options: ['One night', 'A weekend', 'A week', 'Move me in'] },
    { id: 'gu5', kind: 'us', prompt: 'What are we most likely to be late for?', options: ['Nothing', 'Everything', 'Dinner', 'The airport'] },
    { id: 'gp2', kind: 'pick', prompt: 'Who gives the best advice?' },
    { id: 'gu2', kind: 'us', prompt: 'Our default plan on a free Friday?', options: ['Big dinner', 'Out out', 'Sofa + film', 'Spontaneous'] },
    { id: 'gd4', prompt: 'A surprise party for you — love it or dread it?', options: ['Love it', 'Dread it'] },
    { id: 'gu6', kind: 'us', prompt: 'The thing we never say out loud?', options: ['I miss you', 'You were right', 'I need help', 'We say everything'] },
    { id: 'gp3', kind: 'pick', prompt: 'Who would you call from jail at 3am?' },
    { id: 'gu7', kind: 'us', prompt: 'In ten years, this group is…', options: ['Same but older', 'Scattered, still close', 'Neighbours', 'A yearly reunion'] },
    { id: 'gd6', prompt: 'On the road trip, you are the…', options: ['Driver', 'DJ', 'Navigator', 'Snacks'] },
    { id: 'gu8', kind: 'us', prompt: 'Our group chat is mostly…', options: ['Plans', 'Memes', 'Life updates', 'Silence'] },
    { id: 'gp4', kind: 'pick', prompt: 'Who changes the plan at the last minute?' },
    { id: 'gu9', kind: 'us', prompt: 'What would break this group?', options: ['Nothing', 'Distance', 'Money', 'A secret'] },
    { id: 'gd7', prompt: 'Group holiday: one house together, or rooms apart?', options: ['One house', 'Rooms apart'] },
    { id: 'gp5', kind: 'pick', prompt: 'Who secretly runs this group?' },
    { id: 'gu10', kind: 'us', prompt: 'Our best time together is usually…', options: ['Late night', 'Long dinner', 'Outdoors', 'Doing nothing'] },
    { id: 'gp6', kind: 'pick', prompt: 'Who would win a group argument on a technicality?' },
    { id: 'gu11', kind: 'us', prompt: 'New person wants in. We are…', options: ['Open door', 'Slow to warm', 'Full — sorry', 'Depends who'] },
  ];
  // seeded groups — each runs the shared pool at its own offset
  const GROUPS = [
    { id: 'g1', name: 'The Crew', ids: ['f1', 'f2', 'f4', 'f6', 'f3'] },
    { id: 'g2', name: 'Book Club', ids: ['f2', 'f3', 'f6'] },
    { id: 'g3', name: 'The Cousins', ids: ['f1', 'f4'] },
  ];
  // seeded (minus left, with member edits) + your custom groups
  function groupDefs() {
    const seeded = GROUPS.filter((g) => !S.left.includes(g.id)).map((g) => ({ ...g, ids: S.groupIds[g.id] || g.ids }));
    const custom = S.myGroups.filter((g) => !S.left.includes(g.id)).map((g) => ({ ...g, custom: true }));
    return seeded.concat(custom);
  }
  const groupDef = (gid) => groupDefs().find((g) => g.id === gid);
  function setIds(gid, ids) {
    const c = S.myGroups.find((g) => g.id === gid);
    if (c) c.ids = ids; else S.groupIds[gid] = ids;
  }
  const gBase = (gid) => {
    const si = GROUPS.findIndex((g) => g.id === gid);
    return si >= 0 ? si * 3 : Math.floor(h01('gb' + gid) * GROUP_QS.length);
  };
  function groupMembers(gid) {
    const G = groupDef(gid); if (!G) return [];
    const pend = S.groupPend[gid] || {};
    return G.ids.map((id) => { const p = personOf(id); return p ? (pend[id] != null ? { ...p, pending: true } : p) : null; }).filter(Boolean);
  }
  const activeMembers = (gid) => groupMembers(gid).filter((p) => !p.pending);
  function groupQ(gid, dayIdx) {
    let q = GROUP_QS[(gBase(gid) + dayIdx) % GROUP_QS.length];
    if (q.kind === 'pick') {
      const act = activeMembers(gid);
      if (act.length < 2) {
        // not enough named faces yet — slide to the next non-pick question
        const idx = (gBase(gid) + dayIdx) % GROUP_QS.length;
        for (let i = 1; i < GROUP_QS.length; i++) { const cand = GROUP_QS[(idx + i) % GROUP_QS.length]; if (cand.kind !== 'pick') { q = cand; break; } }
        return q;
      }
      return { ...q, options: act.map((p) => p.name.split(' ')[0]).concat('You') };
    }
    return q;
  }
  // custom groups start today — no fake history
  const histDays = (gid) => { const G = groupDef(gid); return G && G.custom ? 0 : 6; };
  function groupDays(gid) { return Array.from({ length: histDays(gid) + 1 }, (_, i) => ({ ...groupQ(gid, i), idx: i, label: DAYS[i] || 'Earlier' })); }

  // a member's answer for a day — biased toward a per-day majority option
  function memberAnswer(gid, dayIdx, pid) {
    const q = groupQ(gid, dayIdx);
    const n = q.options.length;
    const maj = Math.floor(h01('gm' + gid + q.id) * n);
    if (h01('gp' + gid + q.id + pid) < 0.52) return maj;
    return Math.floor(h01('ga' + gid + q.id + pid) * n);
  }
  // your own past answers are seeded (the demo has history from day one)
  function myGroup(gid, dayIdx) {
    const q = groupQ(gid, dayIdx);
    if (dayIdx === 0) { const m = S.groups[gid] || {}; return m[q.id] != null ? m[q.id] : null; }
    return Math.floor(h01('gs' + gid + q.id) * q.options.length);
  }
  function answerGroup(gid, i) { S.groups[gid] = { ...(S.groups[gid] || {}), [groupQ(gid, 0).id]: i }; save(); }
  function groupDone(gid) {
    if (gid) return myGroup(gid, 0) != null;
    return groupDefs().every((g) => myGroup(g.id, 0) != null);
  }
  function groupsPending() { return groupDefs().filter((g) => !groupDone(g.id)).length; }
  // who has already answered TODAY (deterministic demo state)
  function groupInToday(gid) {
    const q = groupQ(gid, 0);
    const act = activeMembers(gid);
    const done = act.filter((p) => h01('gi' + gid + q.id + p.id) < 0.6).map((p) => p.id);
    return { done, total: act.length + 1 };
  }
  // revealed picks for a past day: option → people (you included as pid 'me')
  function groupPicks(gid, dayIdx) {
    const q = groupQ(gid, dayIdx);
    const rows = q.options.map((label, oi) => ({ label, oi, who: [] }));
    activeMembers(gid).forEach((p) => rows[memberAnswer(gid, dayIdx, p.id)].who.push(p));
    const mine = myGroup(gid, dayIdx);
    const counts = rows.map((r) => r.who.length + (mine === r.oi ? 1 : 0));
    const majority = counts.indexOf(Math.max(...counts));
    return { q, rows, mine, counts, majority };
  }
  // how often you land with your groups' majority (revealed days only)
  function groupAlignment() {
    let withMaj = 0, total = 0;
    groupDefs().forEach((G) => {
      for (let i = 1; i <= histDays(G.id); i++) {
        const g = groupPicks(G.id, i);
        total++; if (g.mine === g.majority) withMaj++;
      }
    });
    return { withMaj, total };
  }
  // the group's accrued portrait — traits ('us' majorities), togetherness,
  // who breaks ranks, who mirrors you, and the pick-question verdicts
  function groupPortrait(gid) {
    const ms = groupMembers(gid);
    const withMaj = {}, withMe = {};
    ms.forEach((p) => { withMaj[p.id] = 0; withMe[p.id] = 0; });
    let togeth = 0, days = 0, meWithMaj = 0;
    const traits = [], verdicts = [];
    for (let i = 1; i <= histDays(gid); i++) {
      const g = groupPicks(gid, i);
      const total = g.counts.reduce((a, b) => a + b, 0) || 1;
      days++; togeth += Math.max(...g.counts) / total;
      if (g.mine === g.majority) meWithMaj++;
      ms.forEach((p) => {
        const a = memberAnswer(gid, i, p.id);
        if (a === g.majority) withMaj[p.id]++;
        if (g.mine != null && a === g.mine) withMe[p.id]++;
      });
      if (g.q.kind === 'us') traits.push(g.q.options[g.majority]);
      if (g.q.kind === 'pick') {
        const label = g.q.options[g.majority];
        verdicts.push({ prompt: g.q.prompt, label, who: label === 'You' ? null : ms.find((p) => p.name.split(' ')[0] === label) || null });
      }
    }
    const contrarian = ms.slice().sort((a, b) => withMaj[a.id] - withMaj[b.id])[0] || null;
    const twin = ms.slice().sort((a, b) => withMe[b.id] - withMe[a.id])[0] || null;
    return { days, togetherness: Math.round((togeth / Math.max(days, 1)) * 100), meWithMaj, traits: [...new Set(traits)], verdicts, contrarian, twin, withMaj, withMe };
  }

  // everything the UI needs, per group
  function groups() {
    return groupDefs().map((g) => ({ id: g.id, name: g.name, custom: !!g.custom, members: groupMembers(g.id), done: groupDone(g.id) }));
  }

  // ── group management ────────────────────────────────────────────────────────
  function createGroup(name, ids) {
    const gid = 'c' + Date.now().toString(36);
    S.myGroups.push({ id: gid, name: (name || 'New group').trim(), ids: ids.slice() });
    S.groupPend[gid] = {};
    const now = Date.now();
    ids.forEach((pid) => { S.groupPend[gid][pid] = now; });
    ensureTimer(); save();
    return gid;
  }
  function addGroupMembers(gid, ids) {
    const G = groupDef(gid); if (!G || !ids.length) return;
    setIds(gid, G.ids.concat(ids.filter((id) => !G.ids.includes(id))));
    S.groupPend[gid] = S.groupPend[gid] || {};
    const now = Date.now();
    ids.forEach((pid) => { S.groupPend[gid][pid] = now; });
    ensureTimer(); save();
  }
  function removeGroupMember(gid, pid) {
    const G = groupDef(gid); if (!G) return;
    setIds(gid, G.ids.filter((id) => id !== pid));
    if (S.groupPend[gid]) delete S.groupPend[gid][pid];
    save();
  }
  function leaveGroup(gid) {
    if (!S.left.includes(gid)) S.left.push(gid);
    S.myGroups = S.myGroups.filter((g) => g.id !== gid);
    delete S.groups[gid]; delete S.groupPend[gid]; delete S.groupIds[gid];
    save();
  }

  // ── 1v1: answer + guess, next-day reveal ───────────────────────────────────
  // Situational reads with observable tells — guessable if you truly know
  // them. Mixed option counts (2–4): more options = a right guess means more.
  // Ordered light → deep: early days stay easy, long streaks earn the
  // revealing ones (duoQ walks the pool by streak depth, not at random).
  const DUO_QS = [
    { prompt: 'Plans get cancelled last minute. First feeling?', options: ['Relief', 'Annoyed'] },
    { prompt: 'Phone rings, unknown number.', options: ['Answer', 'Ignore', 'Text back later'] },
    { prompt: 'A compliment in front of everyone — love it or squirm?', options: ['Love it', 'Squirm'] },
    { prompt: 'Running late. Their text says…', options: ['"5 min" (it\u2019s 20)', 'The honest ETA', 'Nothing — just arrives'] },
    { prompt: 'The food arrives wrong. Say something?', options: ['Say something', 'Eat it anyway'] },
    { prompt: 'Lost in a new city. They…', options: ['Ask someone', 'Map it out', 'Just wander'] },
    { prompt: 'A free Saturday, zero plans. Bliss or restless?', options: ['Bliss', 'Restless'] },
    { prompt: 'Karaoke machine appears.', options: ['Grabs the mic', 'One duet, then done', 'Vanishes'] },
    { prompt: 'Someone takes their joke too far. Laugh it off, or say so?', options: ['Laugh it off', 'Say so'] },
    { prompt: 'Big decision to make. How do they call it?', options: ['Gut', 'A list', 'Ask everyone', 'Sleep on it'] },
    { prompt: 'Cry in a film — freely, or fight it?', options: ['Freely', 'Fight it'] },
    { prompt: 'Ideal holiday day?', options: ['Packed itinerary', 'One plan, then drift', 'Pool. Book. Done.'] },
    { prompt: 'They win €10k. First move?', options: ['Save it', 'Book a trip that night', 'Treat someone else', 'Spend a little now'] },
    { prompt: 'An old friend owes an apology. Bring it up, or let it go?', options: ['Bring it up', 'Let it go'] },
    { prompt: 'Deep talk at 2am, or a proper night of sleep?', options: ['The talk', 'The sleep'] },
    { prompt: 'When hurt, they go…', options: ['Quiet', 'Loud', 'Busy'] },
    { prompt: 'Hard truth or comfortable silence?', options: ['Hard truth', 'Silence'] },
    { prompt: 'After a brutal week, what refills them?', options: ['People', 'Solitude', 'Movement', 'Sleep'] },
    { prompt: 'A week alone in a cabin. Gift or sentence?', options: ['Gift', 'Sentence'] },
    { prompt: 'Old age: surrounded, or independent?', options: ['Surrounded', 'Independent'] },
  ];
  // days already played (and revealed) with each partner; 0 = never played
  const PLAYED = { f1: 6, f2: 5, f4: 3, f6: 2, f3: 0 };
  // how well YOU tend to read them / how well THEY tend to read you
  const READ_SKILL = { f1: 0.85, f2: 0.72, f4: 0.5, f6: 0.34, f3: 0.5 };
  const BY_SKILL = { f1: 0.9, f2: 0.75, f4: 0.4, f6: 0.62, f3: 0.5 };
  // partner already played today? (deterministic demo state)
  const PARTNER_TODAY = { f1: true, f2: false, f4: true, f6: false, f3: false };

  // active 1v1 pids — seeded to the circle on first run, friends only
  function duoList() { if (!S.duoList) S.duoList = IDS.slice(); return S.duoList; }
  const duoIds = () => duoList().filter((pid) => !window.FRIENDS || window.FRIENDS.isFriend(pid));
  function duoAvailable() { return members().filter((p) => !duoList().includes(p.id) && S.duoInv[p.id] == null); }
  function startDuo(pid) { if (duoList().includes(pid) || S.duoInv[pid] != null) return; S.duoInv[pid] = Date.now(); ensureTimer(); save(); }
  function cancelDuo(pid) { delete S.duoInv[pid]; save(); }
  function endDuo(pid) { S.duoList = duoList().filter((x) => x !== pid); delete S.duoInv[pid]; delete S.duo[pid]; save(); }

  // depth ladder: the further into a streak (low dayIdx = recent), the deeper
  // the question — new pairs start at the light end of the pool.
  function duoQ(pid, dayIdx) {
    const played = PLAYED[pid] || 0;
    const depth = Math.max(played - dayIdx, 0); // 0 = first day together
    const jit = Math.floor(h01('dqb' + pid + ':' + dayIdx) * 2);
    return DUO_QS[Math.min(depth * 2 + jit, DUO_QS.length - 1)];
  }
  // one duel day; dayIdx 0 = today (yours from localStorage), 1+ = seeded history
  function duoDay(pid, dayIdx) {
    const q = duoQ(pid, dayIdx);
    const key = pid + ':' + dayIdx;
    const n = q.options.length;
    const wrong = (right, k) => (right + 1 + Math.floor(h01(k) * (n - 1))) % n; // any option but the right one
    const theirAns = Math.floor(h01('ta' + key) * n);
    const myAns = dayIdx === 0 ? ((S.duo[pid] || {}).a != null ? S.duo[pid].a : null)
      : Math.floor(h01('da' + key) * n);
    const myGuess = dayIdx === 0 ? ((S.duo[pid] || {}).g != null ? S.duo[pid].g : null)
      : (h01('dg' + key) < (READ_SKILL[pid] || 0.5) ? theirAns : wrong(theirAns, 'dgw' + key));
    const theirGuess = dayIdx === 0 ? null
      : (h01('tg' + key) < (BY_SKILL[pid] || 0.5) ? myAns : wrong(myAns, 'tgw' + key));
    const revealed = dayIdx >= 1 && dayIdx <= (PLAYED[pid] || 0);
    return {
      q, myAns, myGuess, theirAns, theirGuess, revealed,
      readRight: revealed && myGuess === theirAns,
      byRight: revealed && theirGuess === myAns,
    };
  }
  function myDuo(pid) { return S.duo[pid] || {}; }
  function answerDuo(pid, patch) { S.duo[pid] = { ...(S.duo[pid] || {}), ...patch }; save(); }
  function partnerToday(pid) { return !!PARTNER_TODAY[pid]; }

  function duoState(pid) {
    const m = myDuo(pid);
    const mine = m.a != null && m.g != null;
    if (!mine) return (PLAYED[pid] || 0) === 0 ? 'start' : 'turn';
    return partnerToday(pid) ? 'sealed' : 'waiting';
  }
  // everything the UI and the map need, per partner (invites last)
  function partners() {
    const live = duoIds().map((pid) => personOf(pid)).filter(Boolean).map((p) => {
      const played = PLAYED[p.id] || 0;
      const read = { right: 0, total: played };
      const readBy = { right: 0, total: played };
      const misses = []; // where THEY misread YOU — your impression gap
      for (let d = 1; d <= played; d++) {
        const day = duoDay(p.id, d);
        if (day.readRight) read.right++;
        if (day.byRight) readBy.right++;
        else misses.push({ pid: p.id, name: p.name, dayIdx: d, q: day.q.prompt, guessed: day.q.options[day.theirGuess], actual: day.q.options[day.myAns] });
      }
      const state = duoState(p.id);
      const streak = played + (state === 'sealed' ? 1 : 0);
      return { ...p, played, read, readBy, misses, state, streak };
    });
    const invited = Object.keys(S.duoInv).map((pid) => personOf(pid)).filter(Boolean)
      .map((p) => ({ ...p, played: 0, read: { right: 0, total: 0 }, readBy: { right: 0, total: 0 }, misses: [], state: 'invited', streak: 0 }));
    return live.concat(invited);
  }
  function pendingDuos() { return partners().filter((p) => p.state === 'turn' || p.state === 'start').length; }
  // where your people misread you, freshest first — the "how they see you" gap
  function impressions() {
    return partners().flatMap((p) => p.misses).sort((a, b) => a.dayIdx - b.dayIdx);
  }

  function resetToday() {
    groupDefs().forEach((g) => { if (S.groups[g.id]) delete S.groups[g.id][groupQ(g.id, 0).id]; });
    S.duo = {};
    save();
  }

  // ── role casts — scenario packs the group votes through, one role a day ───
  // Each role's reveal crowns someone with it ("the getaway driver"). One vote
  // per member, no self-votes, biased toward a per-(group,role) favourite so
  // most roles have a clear winner — with the occasional contested crown.
  const SCENARIOS = [
    { id: 'heist', label: 'Bank Heist', hue: 25, roles: [
      { id: 'mastermind', label: 'the mastermind', prompt: 'Who plans the whole thing?' },
      { id: 'driver', label: 'the getaway driver', prompt: 'Who drives the getaway car?' },
      { id: 'inside', label: 'the inside man', prompt: 'Who charms their way inside?' },
      { id: 'crack', label: 'first to crack', prompt: 'Who confesses after one question?' },
    ] },
    { id: 'island', label: 'Desert Island', hue: 150, roles: [
      { id: 'fire', label: 'the fire-keeper', prompt: 'Who keeps the fire going?' },
      { id: 'food', label: 'the food-finder', prompt: 'Who finds something to eat?' },
      { id: 'morale', label: 'the morale officer', prompt: 'Who keeps spirits up?' },
      { id: 'loseit', label: 'first to lose it', prompt: 'Who talks to a coconut by day three?' },
    ] },
    { id: 'sitcom', label: 'The Sitcom', hue: 285, roles: [
      { id: 'main', label: 'the main character', prompt: 'Who is the main character?' },
      { id: 'comic', label: 'the comic relief', prompt: 'Who gets the laugh track?' },
      { id: 'deadpan', label: 'the deadpan one', prompt: 'Who delivers the dry one-liners?' },
      { id: 'twist', label: 'the plot twist', prompt: 'Whose life is the plot twist?' },
    ] },
    { id: 'zombie', label: 'Zombie Plan', hue: 220, roles: [
      { id: 'leader', label: 'the reluctant leader', prompt: 'Who ends up in charge?' },
      { id: 'hoarder', label: 'the supply hoarder', prompt: 'Who already has a stockpile?' },
      { id: 'scout', label: 'the scout', prompt: 'Who goes out for the supply run?' },
      { id: 'bitten', label: 'first one bitten', prompt: 'Who pets the zombie dog?' },
    ] },
  ];
  function roleVotes(gid) {
    const targets = activeMembers(gid).map((p) => p.id).concat('me');
    const gi = Math.max(groupDefs().findIndex((g) => g.id === gid), 0);
    const all = [];
    SCENARIOS.forEach((sc) => sc.roles.forEach((r) => all.push({ ...r, scen: sc, key: sc.id + ':' + r.id })));
    // how deep this group has played through the packs
    const played = all.slice(0, Math.max(6, all.length - gi * 5));
    const roles = played.map((role) => {
      const v = {}; targets.forEach((id) => { v[id] = 0; });
      const fav = targets[Math.floor(h01('rf' + gid + role.key) * targets.length)];
      targets.forEach((voter) => {
        let pick = (voter !== fav && h01('rv' + gid + role.key + voter) < 0.62) ? fav : null;
        if (pick == null) {
          const others = targets.filter((id) => id !== voter);
          pick = others[Math.floor(h01('rw' + gid + role.key + voter) * others.length)];
        }
        v[pick]++;
      });
      const order = targets.slice().sort((a, b) => v[b] - v[a]);
      const winner = order[0], second = order[1] || null;
      const contested = second != null && v[second] >= 2 && v[winner] - v[second] <= 1;
      return { ...role, votes: v, order, winner, second, contested };
    });
    return { scenarios: SCENARIOS, roles, targets };
  }

  window.DUELS = {
    DAYS, members, personOf,
    groups, groupQ, groupDays, groupMembers, groupPicks, myGroup, answerGroup, groupDone, groupsPending, groupInToday, groupAlignment, groupPortrait,
    createGroup, addGroupMembers, removeGroupMember, leaveGroup,
    SCENARIOS, roleVotes,
    duoQ, duoDay, myDuo, answerDuo, partnerToday, duoState, partners, pendingDuos, impressions,
    duoAvailable, startDuo, cancelDuo, endDuo,
    resetToday,
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
  // circle changes (befriend / unfriend) ripple into duos & groups
  if (window.FRIENDS) window.FRIENDS.subscribe(fire);
})();
