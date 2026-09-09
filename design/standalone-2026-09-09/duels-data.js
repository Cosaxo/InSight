(function () {
  const LEAD = 5;
  const DEADLINE = 48 * 3600e3;
  const HOUR = 3600e3;
  function h01(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 8) % 100000 / 100000;
  }
  const LS = "insight.duels.v2";
  let S;
  try {
    S = JSON.parse(localStorage.getItem(LS) || "{}");
  } catch (e) {
    S = {};
  }
  if (!S || typeof S !== "object") S = {};
  S.epoch = S.epoch || Date.now();
  S.duo = S.duo || {};
  S.duoTheirs = S.duoTheirs || {};
  S.duoDue = S.duoDue || {};
  S.groups = S.groups || {};
  S.groupIn = S.groupIn || {};
  S.groupDue = S.groupDue || {};
  S.duoList = Array.isArray(S.duoList) ? S.duoList : null;
  S.duoInv = S.duoInv || {};
  S.myGroups = Array.isArray(S.myGroups) ? S.myGroups : [];
  S.groupIds = S.groupIds || {};
  S.groupPend = S.groupPend || {};
  S.left = Array.isArray(S.left) ? S.left : [];
  S.duoMode = S.duoMode || {};
  const listeners = new Set();
  const fire = () => listeners.forEach(f => {
    try {
      f();
    } catch (e) {}
  });
  const save = () => {
    try {
      localStorage.setItem(LS, JSON.stringify(S));
    } catch (e) {}
    fire();
  };
  const IDS = ["f1", "f2", "f4", "f6", "f3"];
  const allPeople = () => window.IS_DATA && window.IS_DATA.people || [];
  const circleIds = () => window.FRIENDS ? window.FRIENDS.list() : IDS;
  function members() {
    return circleIds().map(id => allPeople().find(p => p.id === id)).filter(Boolean);
  }
  const personOf = pid => allPeople().find(p => p.id === pid);
  const first = p => (p && p.name || "").split(" ")[0];
  function accDelay(k) {
    return 9000 + Math.floor(h01("acc" + k) * 18000);
  }
  function sweep() {
    const now = Date.now();
    let hit = false;
    Object.keys(S.duoInv).forEach(pid => {
      if (now - S.duoInv[pid] >= accDelay("d" + pid)) {
        delete S.duoInv[pid];
        if (!duoList().includes(pid)) duoList().push(pid);
        hit = true;
      }
    });
    Object.keys(S.groupPend).forEach(gid => {
      const m = S.groupPend[gid];
      Object.keys(m).forEach(pid => {
        if (now - m[pid] >= accDelay("g" + gid + pid)) {
          delete m[pid];
          hit = true;
        }
      });
    });
    Object.keys(S.duoDue).forEach(pid => {
      Object.keys(S.duoDue[pid]).forEach(r => {
        if (now >= S.duoDue[pid][r]) {
          delete S.duoDue[pid][r];
          S.duoTheirs[pid] = S.duoTheirs[pid] || {};
          S.duoTheirs[pid][r] = now;
          hit = true;
        }
      });
    });
    Object.keys(S.groupDue).forEach(gid => {
      Object.keys(S.groupDue[gid]).forEach(r => {
        const due = S.groupDue[gid][r];
        Object.keys(due).forEach(pid => {
          if (now >= due[pid]) {
            delete due[pid];
            S.groupIn[gid] = S.groupIn[gid] || {};
            S.groupIn[gid][r] = S.groupIn[gid][r] || {};
            S.groupIn[gid][r][pid] = now;
            hit = true;
          }
        });
      });
    });
    if (hit) save();
  }
  const hasPend = () => Object.keys(S.duoInv).length > 0 || Object.keys(S.groupPend).some(g => Object.keys(S.groupPend[g]).length > 0) || Object.keys(S.duoDue).some(p => Object.keys(S.duoDue[p]).length > 0) || Object.keys(S.groupDue).some(g => Object.keys(S.groupDue[g]).some(r => Object.keys(S.groupDue[g][r]).length > 0));
  let timer = null;
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => {
      if (!hasPend()) {
        clearInterval(timer);
        timer = null;
        return;
      }
      sweep();
    }, 2500);
  }
  if (hasPend()) ensureTimer();
  const WORLD_FALLBACK = [{
    id: "wf1",
    prompt: "Pineapple on pizza?",
    options: ["Yes", "Never"],
    split: [54, 46]
  }, {
    id: "wf2",
    prompt: "Are people getting kinder, or meaner?",
    options: ["Kinder", "Meaner"],
    split: [38, 62]
  }, {
    id: "wf3",
    prompt: "A pill that ends your need for sleep. Take it?",
    options: ["Take it", "Never"],
    split: [41, 59]
  }, {
    id: "wf4",
    prompt: "Humanity\u2019s best invention?",
    options: ["Writing", "Medicine", "The internet", "Music"],
    split: [22, 43, 19, 16]
  }];
  function worldPool() {
    const Q = window.DAILYQ && window.DAILYQ.questions;
    const list = Q ? Q.filter(q => Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 4 && q.type !== "scale" && q.type !== "rating") : [];
    return list.length ? list.map(q => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      split: q.dist && q.dist.world || null
    })) : WORLD_FALLBACK;
  }
  function worldQ(key) {
    const pool = worldPool();
    const w = pool[Math.floor(h01("w" + key) * pool.length)];
    return {
      id: "w:" + w.id,
      prompt: w.prompt,
      options: w.options,
      split: w.split || w.options.map(() => Math.round(100 / w.options.length)),
      world: true,
      d: "world"
    };
  }
  const duoKind = r => r % 4 === 0 ? "cast" : r % 2 === 0 ? "world" : "own";
  const isWorldRound = r => duoKind(r) === "world";
  const publicAnswer = (pid, q) => q.world && h01("pub" + pid + q.id) < 0.4;
  const SEATS = [{
    id: "engine",
    label: "the Engine",
    line: "the one who gets things going"
  }, {
    id: "hands",
    label: "the Hands",
    line: "the one who gets it done"
  }, {
    id: "heart",
    label: "the Heart",
    line: "the one who holds the room together"
  }, {
    id: "wild",
    label: "the Wildcard",
    line: "the one the story happens to"
  }];
  const SCENARIOS = [{
    id: "heist",
    label: "Bank Heist",
    hue: 25,
    roles: [{
      id: "mastermind",
      seat: "engine",
      label: "the mastermind",
      prompt: "Who plans the whole thing?"
    }, {
      id: "driver",
      seat: "hands",
      label: "the getaway driver",
      prompt: "Who drives the getaway car?"
    }, {
      id: "inside",
      seat: "heart",
      label: "the inside man",
      prompt: "Who charms their way inside?"
    }, {
      id: "crack",
      seat: "wild",
      label: "first to crack",
      prompt: "Who confesses after one question?"
    }]
  }, {
    id: "island",
    label: "Desert Island",
    hue: 150,
    roles: [{
      id: "fire",
      seat: "engine",
      label: "the fire-keeper",
      prompt: "Who keeps the fire going?"
    }, {
      id: "food",
      seat: "hands",
      label: "the food-finder",
      prompt: "Who finds something to eat?"
    }, {
      id: "morale",
      seat: "heart",
      label: "the morale officer",
      prompt: "Who keeps spirits up?"
    }, {
      id: "loseit",
      seat: "wild",
      label: "first to lose it",
      prompt: "Who talks to a coconut first?"
    }]
  }, {
    id: "sitcom",
    label: "The Sitcom",
    hue: 285,
    roles: [{
      id: "main",
      seat: "engine",
      label: "the main character",
      prompt: "Who is the main character?"
    }, {
      id: "deadpan",
      seat: "hands",
      label: "the deadpan one",
      prompt: "Who delivers the dry one-liners?"
    }, {
      id: "comic",
      seat: "heart",
      label: "the comic relief",
      prompt: "Who gets the laugh track?"
    }, {
      id: "twist",
      seat: "wild",
      label: "the plot twist",
      prompt: "Whose life is the plot twist?"
    }]
  }, {
    id: "zombie",
    label: "Zombie Plan",
    hue: 220,
    roles: [{
      id: "leader",
      seat: "engine",
      label: "the reluctant leader",
      prompt: "Who ends up in charge?"
    }, {
      id: "scout",
      seat: "hands",
      label: "the scout",
      prompt: "Who goes out for the supply run?"
    }, {
      id: "medic",
      seat: "heart",
      label: "the medic",
      prompt: "Who patches everyone up?"
    }, {
      id: "bitten",
      seat: "wild",
      label: "first one bitten",
      prompt: "Who pets the zombie dog?"
    }]
  }, {
    id: "roadtrip",
    label: "Road Trip",
    hue: 60,
    roles: [{
      id: "wheel",
      seat: "engine",
      label: "the driver",
      prompt: "Who takes the wheel?"
    }, {
      id: "nav",
      seat: "hands",
      label: "the navigator",
      prompt: "Who knows the way \u2014 or says so?"
    }, {
      id: "dj",
      seat: "heart",
      label: "the DJ",
      prompt: "Who controls the music?"
    }, {
      id: "stops",
      seat: "wild",
      label: "the hourly stop",
      prompt: "Who needs to pull over every hour?"
    }]
  }];
  const ALL_ROLES = [];
  SCENARIOS.forEach(sc => sc.roles.forEach(r => ALL_ROLES.push({
    ...r,
    scen: sc,
    key: sc.id + ":" + r.id
  })));
  const RATE_QS = [{
    id: "pace",
    prompt: "This group\u2019s energy?",
    poles: ["Calm", "Chaos"]
  }, {
    id: "disagree",
    prompt: "When we disagree, we\u2026",
    poles: ["Talk it out", "Loudest wins"]
  }, {
    id: "late",
    prompt: "Our timekeeping?",
    poles: ["Punctual", "Always late"]
  }, {
    id: "plan",
    prompt: "A free evening with us is\u2026",
    poles: ["Planned", "Spontaneous"]
  }, {
    id: "door",
    prompt: "New person wants in. We are\u2026",
    poles: ["Open door", "Full \u2014 sorry"]
  }, {
    id: "say",
    prompt: "How much goes unsaid between us?",
    poles: ["We say everything", "Plenty unsaid"]
  }, {
    id: "candour",
    prompt: "How honest are we with each other?",
    poles: ["Gentle", "Brutal"]
  }, {
    id: "chat",
    prompt: "Our group chat runs on\u2026",
    poles: ["Plans", "Nonsense"]
  }, {
    id: "space",
    prompt: "A group holiday: one house, or rooms apart?",
    poles: ["One house", "Rooms apart"]
  }, {
    id: "future",
    prompt: "In ten years, this group is\u2026",
    poles: ["Same, but older", "A yearly reunion"]
  }];
  const stepLabel = (poles, i) => [poles[0], "mostly " + poles[0], "in between", "mostly " + poles[1], poles[1]][i];
  const GROUPS = [{
    id: "g1",
    name: "The Crew",
    ids: ["f1", "f2", "f4", "f6", "f3"],
    phase: 0
  }, {
    id: "g2",
    name: "Book Club",
    ids: ["f2", "f3", "f6"],
    ahead: 3,
    phase: 1
  }, {
    id: "g3",
    name: "The Cousins",
    ids: ["f1", "f4"],
    closed: true,
    phase: 2
  }];
  const HIST_G = 11;
  function groupDefs() {
    const seeded = GROUPS.filter(g => !S.left.includes(g.id)).map(g => ({
      ...g,
      ids: S.groupIds[g.id] || g.ids
    }));
    const custom = S.myGroups.filter(g => !S.left.includes(g.id)).map(g => ({
      ...g,
      custom: true
    }));
    return seeded.concat(custom);
  }
  const groupDef = gid => groupDefs().find(g => g.id === gid);
  function setIds(gid, ids) {
    const c = S.myGroups.find(g => g.id === gid);
    if (c) c.ids = ids;else S.groupIds[gid] = ids;
  }
  const gBase = gid => {
    const si = GROUPS.findIndex(g => g.id === gid);
    return si >= 0 ? si * 3 : Math.floor(h01("gb" + gid) * ALL_ROLES.length);
  };
  const gPhase = gid => {
    const G = GROUPS.find(g => g.id === gid);
    return G && G.phase ? G.phase : 0;
  };
  const gHist = gid => {
    const G = groupDef(gid);
    return G && G.custom ? 0 : HIST_G;
  };
  const isRatingRound = (gid, r) => (r + gPhase(gid)) % 4 === 0;
  function groupMembers(gid) {
    const G = groupDef(gid);
    if (!G) return [];
    const pend = S.groupPend[gid] || {};
    return G.ids.map(id => {
      const p = personOf(id);
      return p ? pend[id] != null ? {
        ...p,
        pending: true
      } : p : null;
    }).filter(Boolean);
  }
  const activeMembers = gid => groupMembers(gid).filter(p => !p.pending);
  function groupQ(gid, r) {
    const ph = gPhase(gid);
    const ratingsBefore = Math.floor((r - 1 + ph) / 4);
    if (isRatingRound(gid, r)) {
      const q = RATE_QS[(gBase(gid) + ratingsBefore) % RATE_QS.length];
      return {
        id: "rate:" + q.id,
        kind: "rate",
        dim: q.id,
        prompt: q.prompt,
        poles: q.poles,
        options: [0, 1, 2, 3, 4].map(i => stepLabel(q.poles, i))
      };
    }
    const role = ALL_ROLES[(gBase(gid) + (r - 1 - ratingsBefore)) % ALL_ROLES.length];
    const act = activeMembers(gid);
    return {
      id: "vote:" + role.key,
      kind: "vote",
      role,
      scen: role.scen,
      prompt: role.prompt,
      options: act.map(p => p.name.split(" ")[0]).concat("You"),
      targets: act.map(p => p.id).concat("me")
    };
  }
  function memberAnswer(gid, r, pid) {
    const q = groupQ(gid, r);
    if (q.kind === "rate") {
      const c = h01("gc" + gid + q.dim) * 4;
      return Math.max(0, Math.min(4, Math.round(c + (h01("gj" + gid + r + pid) - 0.5) * 2.4)));
    }
    const T = q.targets,
      k = q.role.key;
    const fav = T[Math.floor(h01("rf" + gid + k) * T.length)];
    if (pid !== fav && h01("rv" + gid + k + pid) < 0.62) return T.indexOf(fav);
    const others = T.filter(id => id !== pid);
    return T.indexOf(others[Math.floor(h01("rw" + gid + k + pid) * others.length)]);
  }
  const gState = (gid, r) => {
    const s = (S.groups[gid] || {})[r];
    if (!s) return null;
    const q = groupQ(gid, r);
    return (s.qid == null || s.qid === q.id) && (s.a == null || s.a < q.options.length) ? s : null;
  };
  function groupDeadline(gid, r) {
    const G = groupDef(gid);
    const hist = gHist(gid);
    if (r <= hist) return null;
    if (G && G.closed && r === hist + 1) return S.epoch - 2 * HOUR;
    return S.epoch + (r - hist) * DEADLINE + Math.floor(h01("gdl" + gid + r) * 6) * HOUR;
  }
  const groupClosed = (gid, r) => {
    const d = groupDeadline(gid, r);
    return d != null && Date.now() >= d;
  };
  function memberIn(gid, r, pid) {
    const G = groupDef(gid);
    if (!G) return false;
    const hist = gHist(gid);
    if (r <= hist) return true;
    if ((S.groupIn[gid] || {})[r] && S.groupIn[gid][r][pid] != null) return true;
    if (G.ahead && r - hist <= G.ahead) return true;
    if (G.closed && r === hist + 1) {
      const act = activeMembers(gid);
      const absent = act[Math.floor(h01("gabs" + gid) * act.length)];
      return !absent || absent.id !== pid;
    }
    return h01("gi" + gid + r + pid) < 0.6;
  }
  const myIn = (gid, r) => r <= gHist(gid) || !!(gState(gid, r) && gState(gid, r).a != null);
  const allIn = (gid, r) => activeMembers(gid).every(p => memberIn(gid, r, p.id));
  const groupRevealed = (gid, r) => r <= gHist(gid) || myIn(gid, r) && allIn(gid, r) || groupClosed(gid, r);
  function groupRevealedCount(gid) {
    let r = gHist(gid);
    while (groupRevealed(gid, r + 1)) r++;
    return r;
  }
  function groupOpen(gid) {
    const hist = gHist(gid);
    let mine = hist;
    while (myIn(gid, mine + 1)) mine++;
    let theirs = hist;
    while (activeMembers(gid).length && allIn(gid, theirs + 1)) theirs++;
    if (mine - theirs >= LEAD) return null;
    return mine + 1;
  }
  const groupMyTop = gid => {
    let r = gHist(gid);
    while (myIn(gid, r + 1)) r++;
    return r;
  };
  const groupTheirTop = gid => {
    let r = gHist(gid);
    while (activeMembers(gid).length && allIn(gid, r + 1)) r++;
    return r;
  };
  function myGroupRound(gid, r) {
    if (r <= gHist(gid)) return {
      a: memberAnswer(gid, r, "me"),
      late: false
    };
    const s = gState(gid, r);
    return {
      a: s ? s.a : null,
      late: !!(s && s.late)
    };
  }
  function answerGroup(gid, i, r) {
    r = r || groupOpen(gid);
    if (!r) return;
    const late = groupClosed(gid, r);
    S.groups[gid] = {
      ...(S.groups[gid] || {}),
      [r]: {
        ...(gState(gid, r) || {}),
        a: i,
        late,
        qid: groupQ(gid, r).id
      }
    };
    if (!late && !allIn(gid, r)) {
      S.groupDue[gid] = S.groupDue[gid] || {};
      S.groupDue[gid][r] = S.groupDue[gid][r] || {};
      activeMembers(gid).forEach(p => {
        if (!memberIn(gid, r, p.id)) S.groupDue[gid][r][p.id] = Date.now() + 12000 + Math.floor(h01("glag" + gid + r + p.id) * 40000);
      });
      ensureTimer();
    }
    save();
  }
  function groupDone(gid) {
    if (gid) return groupOpen(gid) == null;
    return groupDefs().every(g => groupDone(g.id));
  }
  function groupsPending() {
    return groupDefs().filter(g => !groupDone(g.id)).length;
  }
  function groupInToday(gid) {
    const r = groupOpen(gid) || groupMyTop(gid);
    const act = activeMembers(gid);
    return {
      done: act.filter(p => memberIn(gid, r, p.id)).map(p => p.id),
      total: act.length + 1,
      round: r
    };
  }
  function groupPicksRound(gid, r) {
    const q = groupQ(gid, r);
    const rows = q.options.map((label, oi) => ({
      label,
      oi,
      who: []
    }));
    const act = activeMembers(gid);
    const played = act.filter(p => memberIn(gid, r, p.id));
    played.forEach(p => rows[memberAnswer(gid, r, p.id)].who.push(p));
    const my = myGroupRound(gid, r);
    const mine = my.a;
    const counts = rows.map(row => row.who.length + (mine === row.oi && !my.late ? 1 : 0));
    const total = counts.reduce((a, b) => a + b, 0);
    const out = {
      q,
      r,
      rows,
      mine,
      late: my.late,
      counts,
      total,
      majority: 0,
      played,
      absent: act.length - played.length,
      closed: groupClosed(gid, r),
      revealed: groupRevealed(gid, r)
    };
    if (q.kind === "vote") {
      const order = q.targets.map((_, i) => i).sort((a, b) => counts[b] - counts[a] || a - b);
      const win = order[0],
        sec = order.length > 1 ? order[1] : null;
      out.majority = win;
      out.winner = q.targets[win];
      out.second = sec != null && counts[sec] > 0 ? q.targets[sec] : null;
      out.contested = out.second != null && counts[sec] >= 2 && counts[win] - counts[sec] <= 1;
      out.votes = {};
      q.targets.forEach((id, i) => {
        out.votes[id] = counts[i];
      });
      out.people = q.targets.map(id => id === "me" ? {
        id: "me",
        me: true
      } : act.find(p => p.id === id));
    } else {
      out.mean = total ? counts.reduce((s, c, i) => s + c * i, 0) / total : 2;
      out.score = Math.round(out.mean / 4 * 100);
      out.majority = Math.round(out.mean);
    }
    return out;
  }
  function groupAlignment() {
    let crowns = 0,
      votes = 0;
    groupDefs().forEach(G => {
      const n = groupRevealedCount(G.id);
      for (let r = 1; r <= n; r++) {
        if (isRatingRound(G.id, r)) continue;
        const g = groupPicksRound(G.id, r);
        if (!g.total) continue;
        votes++;
        if (g.winner === "me") crowns++;
      }
    });
    return {
      crowns,
      votes,
      withMaj: crowns,
      total: votes
    };
  }
  function groupPortrait(gid) {
    const ms = groupMembers(gid);
    const withMaj = {},
      withMe = {},
      crowns = {
        me: 0
      },
      named = {
        me: 0
      };
    ms.forEach(p => {
      withMaj[p.id] = 0;
      withMe[p.id] = 0;
      crowns[p.id] = 0;
      named[p.id] = 0;
    });
    let days = 0,
      meWithMaj = 0;
    const voteRounds = [],
      rateRounds = [];
    const n = groupRevealedCount(gid);
    for (let r = 1; r <= n; r++) {
      if (isRatingRound(gid, r)) {
        rateRounds.push(r);
        continue;
      }
      const g = groupPicksRound(gid, r);
      if (!g.total) continue;
      voteRounds.push(r);
      days++;
      const mine = g.late ? null : g.mine;
      if (mine != null && mine === g.majority) meWithMaj++;
      if (crowns[g.winner] != null) crowns[g.winner]++;
      g.q.targets.forEach((id, i) => {
        if (named[id] != null) named[id] += g.counts[i];
      });
      ms.forEach(p => {
        if (p.pending || !memberIn(gid, r, p.id)) return;
        const a = memberAnswer(gid, r, p.id);
        if (a === g.majority) withMaj[p.id]++;
        if (mine != null && a === mine) withMe[p.id]++;
      });
    }
    const act = ms.filter(p => !p.pending);
    const contrarian = act.slice().sort((a, b) => withMaj[a.id] - withMaj[b.id])[0] || null;
    const twin = act.slice().sort((a, b) => withMe[b.id] - withMe[a.id])[0] || null;
    return {
      days,
      rounds: n,
      votes: voteRounds.length,
      ratings: rateRounds.length,
      voteRounds,
      rateRounds,
      meWithMaj,
      meCrowns: crowns.me,
      crowns,
      named,
      contrarian,
      twin,
      withMaj,
      withMe
    };
  }
  function roleVotes(gid) {
    const targets = activeMembers(gid).map(p => p.id).concat("me");
    const byKey = new Map();
    const n = groupRevealedCount(gid);
    for (let r = 1; r <= n; r++) {
      if (isRatingRound(gid, r)) continue;
      const g = groupPicksRound(gid, r);
      if (!g.total) continue;
      const order = g.q.targets.slice().sort((a, b) => g.votes[b] - g.votes[a]);
      byKey.set(g.q.role.key, {
        ...g.q.role,
        r,
        votes: g.votes,
        order,
        winner: g.winner,
        second: g.second,
        contested: g.contested
      });
    }
    return {
      scenarios: SCENARIOS,
      roles: [...byKey.values()],
      targets
    };
  }
  function archetypeOf(gid, id) {
    const rv = roleVotes(gid);
    const shares = {
        engine: 0,
        hands: 0,
        heart: 0,
        wild: 0
      },
      won = {
        engine: [],
        hands: [],
        heart: [],
        wild: []
      };
    let total = 0;
    rv.roles.forEach(role => {
      const v = role.votes[id] || 0;
      shares[role.seat] += v;
      total += v;
      if (role.winner === id || role.contested && role.second === id) won[role.seat].push(role);
    });
    const pct = {};
    SEATS.forEach(s => {
      pct[s.id] = total ? Math.round(shares[s.id] / total * 100) : 0;
    });
    const seat = total ? SEATS.slice().sort((a, b) => shares[b.id] - shares[a.id] || won[b.id].length - won[a.id].length)[0] : null;
    return {
      seat,
      shares,
      pct,
      total,
      won,
      roles: rv.roles.length
    };
  }
  function groupScores(gid) {
    const byDim = new Map();
    const n = groupRevealedCount(gid);
    for (let r = 1; r <= n; r++) {
      if (!isRatingRound(gid, r)) continue;
      const g = groupPicksRound(gid, r);
      if (!g.total) continue;
      const marks = [];
      g.rows.forEach(row => row.who.forEach(p => marks.push({
        id: p.id,
        p,
        step: row.oi
      })));
      if (g.mine != null && !g.late) marks.push({
        id: "me",
        me: true,
        step: g.mine
      });
      byDim.set(g.q.dim, {
        dim: g.q.dim,
        prompt: g.q.prompt,
        poles: g.q.poles,
        r,
        marks,
        mine: g.late ? null : g.mine,
        mean: g.mean,
        score: g.score,
        counts: g.counts,
        total: g.total,
        label: stepLabel(g.q.poles, Math.round(g.mean))
      });
    }
    return [...byDim.values()];
  }
  function groupView(gid) {
    const hist = gHist(gid),
      revealed = groupRevealedCount(gid);
    const open = groupOpen(gid),
      myTop = groupMyTop(gid),
      theirTop = groupTheirTop(gid);
    const waiting = Math.max(0, theirTop - myTop);
    const ahead = Math.max(0, myTop - revealed);
    return {
      hist,
      revealed,
      open,
      myTop,
      theirTop,
      waiting,
      ahead,
      lead: open == null,
      openClosed: open != null && groupClosed(gid, open),
      lastRevealed: revealed >= 1 ? groupPicksRound(gid, revealed) : null,
      q: r => groupQ(gid, r),
      deadline: r => groupDeadline(gid, r),
      picks: r => groupPicksRound(gid, r),
      mine: r => myGroupRound(gid, r),
      who: r => activeMembers(gid).map(p => ({
        ...p,
        played: memberIn(gid, r, p.id)
      })),
      sealed: Array.from({
        length: ahead
      }, (_, i) => revealed + 1 + i)
    };
  }
  function groups() {
    return groupDefs().map(g => ({
      id: g.id,
      name: g.name,
      custom: !!g.custom,
      members: groupMembers(g.id),
      done: groupDone(g.id),
      waiting: Math.max(0, groupTheirTop(g.id) - groupMyTop(g.id))
    }));
  }
  function createGroup(name, ids) {
    const gid = "c" + Date.now().toString(36);
    S.myGroups.push({
      id: gid,
      name: (name || "New group").trim(),
      ids: ids.slice()
    });
    S.groupPend[gid] = {};
    const now = Date.now();
    ids.forEach(pid => {
      S.groupPend[gid][pid] = now;
    });
    ensureTimer();
    save();
    return gid;
  }
  function addGroupMembers(gid, ids) {
    const G = groupDef(gid);
    if (!G || !ids.length) return;
    setIds(gid, G.ids.concat(ids.filter(id => !G.ids.includes(id))));
    S.groupPend[gid] = S.groupPend[gid] || {};
    const now = Date.now();
    ids.forEach(pid => {
      S.groupPend[gid][pid] = now;
    });
    ensureTimer();
    save();
  }
  function removeGroupMember(gid, pid) {
    const G = groupDef(gid);
    if (!G) return;
    setIds(gid, G.ids.filter(id => id !== pid));
    if (S.groupPend[gid]) delete S.groupPend[gid][pid];
    save();
  }
  function leaveGroup(gid) {
    if (!S.left.includes(gid)) S.left.push(gid);
    S.myGroups = S.myGroups.filter(g => g.id !== gid);
    delete S.groups[gid];
    delete S.groupPend[gid];
    delete S.groupIds[gid];
    delete S.groupIn[gid];
    delete S.groupDue[gid];
    save();
  }
  const DUO_QS = [{
    d: "day",
    prompt: "Plans get cancelled last minute. First feeling?",
    options: ["Relief", "Annoyed"]
  }, {
    d: "day",
    prompt: "Phone rings, unknown number.",
    options: ["Answer", "Ignore", "Text back later"]
  }, {
    d: "day",
    prompt: "A compliment in front of everyone \u2014 love it or squirm?",
    options: ["Love it", "Squirm"]
  }, {
    d: "mirror",
    prompt: "The word that fits them best?",
    options: ["Warm", "Sharp", "Steady", "Restless"]
  }, {
    d: "day",
    prompt: "Running late. Their text says\u2026",
    options: ["\"5 min\" (it\u2019s 20)", "The honest ETA", "Nothing \u2014 just arrives"]
  }, {
    d: "heat",
    prompt: "The food arrives wrong. Say something?",
    options: ["Say something", "Eat it anyway"]
  }, {
    d: "mirror",
    prompt: "Their best quality, in one word?",
    options: ["Loyalty", "Humour", "Honesty", "Nerve"]
  }, {
    d: "day",
    prompt: "Lost in a new city. They\u2026",
    options: ["Ask someone", "Map it out", "Just wander"]
  }, {
    d: "day",
    prompt: "A free afternoon, zero plans. Bliss or restless?",
    options: ["Bliss", "Restless"]
  }, {
    d: "day",
    prompt: "Karaoke machine appears.",
    options: ["Grabs the mic", "One duet, then done", "Vanishes"]
  }, {
    d: "mirror",
    prompt: "In a room of strangers, they are\u2026",
    options: ["Working the room", "Talking to one person", "Near the door"]
  }, {
    d: "heat",
    prompt: "Someone takes their joke too far. Laugh it off, or say so?",
    options: ["Laugh it off", "Say so"]
  }, {
    d: "heat",
    prompt: "Big decision to make. How do they call it?",
    options: ["Gut", "A list", "Ask everyone", "Sleep on it"]
  }, {
    d: "heat",
    prompt: "Cry in a film \u2014 freely, or fight it?",
    options: ["Freely", "Fight it"]
  }, {
    d: "mirror",
    prompt: "You would call them first for\u2026",
    options: ["A crisis", "A laugh", "Advice", "A favour"]
  }, {
    d: "day",
    prompt: "Ideal holiday?",
    options: ["Packed itinerary", "One plan, then drift", "Pool. Book. Done."]
  }, {
    d: "mirror",
    prompt: "What about them would surprise a stranger?",
    options: ["How soft", "How stubborn", "How funny", "How serious"]
  }, {
    d: "day",
    prompt: "They win \u20AC10k. First move?",
    options: ["Save it", "Book a trip at once", "Treat someone else", "Spend a little now"]
  }, {
    d: "heat",
    prompt: "An old friend owes an apology. Bring it up, or let it go?",
    options: ["Bring it up", "Let it go"]
  }, {
    d: "day",
    prompt: "Deep talk at 2am, or a proper sleep?",
    options: ["The talk", "The sleep"]
  }, {
    d: "mirror",
    prompt: "Are they easy to know?",
    options: ["Yes", "Takes a while", "No"]
  }, {
    d: "heat",
    prompt: "When hurt, they go\u2026",
    options: ["Quiet", "Loud", "Busy"]
  }, {
    d: "heat",
    prompt: "Hard truth or comfortable silence?",
    options: ["Hard truth", "Silence"]
  }, {
    d: "mirror",
    prompt: "Their most underrated trait?",
    options: ["Patience", "Taste", "Generosity", "Judgement"]
  }, {
    d: "heat",
    prompt: "After a brutal stretch, what refills them?",
    options: ["People", "Solitude", "Movement", "Sleep"]
  }, {
    d: "mirror",
    prompt: "Better at giving advice, or taking it?",
    options: ["Giving", "Taking"]
  }, {
    d: "day",
    prompt: "A stretch alone in a cabin. Gift or sentence?",
    options: ["Gift", "Sentence"]
  }, {
    d: "day",
    prompt: "Old age: surrounded, or independent?",
    options: ["Surrounded", "Independent"]
  }, {
    d: "mirror",
    prompt: "What would they want to be remembered for?",
    options: ["Kindness", "Their work", "Being fun", "Being right"]
  }];
  const DUO_QS_ROMANTIC = [{
    d: "day",
    prompt: "A free evening, both home. Ideal version?",
    options: ["Out somewhere", "Sofa, one film", "Cooking together"]
  }, {
    d: "day",
    prompt: "How do they like being woken?",
    options: ["Slowly, with coffee", "Left alone", "Talked at immediately"]
  }, {
    d: "heat",
    prompt: "A good apology from them looks like\u2026",
    options: ["Words", "A gesture", "Time, then normal"]
  }, {
    d: "heat",
    prompt: "You are 20 minutes late to dinner. Their read?",
    options: ["Fine, orders a drink", "Says nothing, remembers it"]
  }, {
    d: "day",
    prompt: "Love lands hardest as\u2026",
    options: ["Being told", "Being helped", "Being touched", "Being chosen"]
  }, {
    d: "heat",
    prompt: "Mid-argument, they want\u2026",
    options: ["To finish it now", "A pause", "Space, then dinner"]
  }, {
    d: "day",
    prompt: "The better anniversary?",
    options: ["A plan they made", "Nothing planned at all"]
  }, {
    d: "ahead",
    prompt: "Money in this relationship should be\u2026",
    options: ["Fully shared", "Mostly shared", "Separate, split bills"]
  }, {
    d: "day",
    prompt: "Their idea of being taken care of?",
    options: ["Food made", "Admin handled", "Left in peace", "Asked about"]
  }, {
    d: "day",
    prompt: "A long stretch together, no phones. Bliss or too much?",
    options: ["Bliss", "Too much"]
  }, {
    d: "heat",
    prompt: "They had a hard time and did not say so. The tell?",
    options: ["Goes quiet", "Cleans something", "Talks about nothing else"]
  }, {
    d: "ahead",
    prompt: "Five years out, they picture\u2026",
    options: ["Same city, more room", "Somewhere new", "Somewhere quiet"]
  }, {
    d: "ahead",
    prompt: "A big decision that affects you both. They\u2026",
    options: ["Decide together, slowly", "Want you to choose", "Already decided"]
  }, {
    d: "heat",
    prompt: "Would they tell you a truth that would sting for a while?",
    options: ["Yes", "Only if asked", "No"]
  }, {
    d: "heat",
    prompt: "Jealousy shows up in them as\u2026",
    options: ["A question", "A joke", "Silence", "It doesn't"]
  }, {
    d: "ahead",
    prompt: "Kids, someday?",
    options: ["Yes", "Open to it", "No"]
  }, {
    d: "ahead",
    prompt: "The thing they would never compromise on?",
    options: ["Where they live", "Their work", "Their people", "Their solitude"]
  }, {
    d: "ahead",
    prompt: "If you needed a year somewhere else, they would\u2026",
    options: ["Come", "Wait", "Ask you not to go"]
  }, {
    d: "ahead",
    prompt: "What would make them feel most loved this year?",
    options: ["More time", "More plans", "More calm", "More honesty"]
  }, {
    d: "ahead",
    prompt: "Old age, the two of you: side by side, or side by side and busy?",
    options: ["Side by side", "Busy, together"]
  }];
  const DOMAIN_DEFS = {
    day: {
      id: "day",
      label: "everyday",
      noun: "everyday self"
    },
    heat: {
      id: "heat",
      label: "under pressure",
      noun: "pressure"
    },
    ahead: {
      id: "ahead",
      label: "what's ahead",
      noun: "future"
    },
    mirror: {
      id: "mirror",
      label: "how they see you",
      noun: "self-image"
    }
  };
  const DOMAIN_SET = {
    friends: ["day", "heat", "mirror"],
    romantic: ["day", "heat", "ahead"]
  };
  const domainsFor = mode => DOMAIN_SET[mode === "romantic" ? "romantic" : "friends"].map(k => DOMAIN_DEFS[k]);
  const DOMAINS = domainsFor("friends");
  const DOMAIN_MIN = 4;
  function domainRows(duo) {
    if (!duo || !duo.domains) return [];
    return domainsFor(duo.mode).map(D => {
      const d = duo.domains[D.id];
      if (!d) return null;
      if (d.read.length < DOMAIN_MIN || d.by.length < DOMAIN_MIN) return null;
      return {
        ...D,
        read: d.read,
        by: d.by,
        byMissed: d.by.filter(x => !x).length,
        byRate: d.by.filter(x => !x).length / d.by.length
      };
    }).filter(Boolean);
  }
  function weakDomain(duo) {
    const rows = domainRows(duo);
    if (rows.length < 2) return null;
    const s = rows.slice().sort((a, b) => b.byRate - a.byRate);
    return s[0].byRate - s[1].byRate >= 0.2 ? s[0] : null;
  }
  const DUO_POOL = pid => duoMode(pid) === "romantic" ? DUO_QS_ROMANTIC : DUO_QS;
  function duoMode(pid) {
    return S.duoMode[pid] === "romantic" ? "romantic" : "friends";
  }
  function setDuoMode(pid, mode) {
    S.duoMode[pid] = mode === "romantic" ? "romantic" : "friends";
    save();
  }
  const PLAYED = {
    f1: 24,
    f2: 5,
    f4: 3,
    f6: 2,
    f3: 0
  };
  const THEIR_AHEAD = {
    f1: 1,
    f2: 0,
    f4: 3,
    f6: 0,
    f3: 0
  };
  const LAG = {
    f1: 14000,
    f2: 45000,
    f4: 9000,
    f6: null,
    f3: 20000
  };
  const READ_SKILL = {
    f1: 0.85,
    f2: 0.72,
    f4: 0.5,
    f6: 0.34,
    f3: 0.5
  };
  const BY_SKILL = {
    f1: 0.9,
    f2: 0.75,
    f4: 0.4,
    f6: 0.62,
    f3: 0.5
  };
  const DOMAIN_BIAS = {
    f1: {
      read: {
        day: 1.1,
        heat: 1,
        mirror: 0.6,
        ahead: 0.55
      },
      by: {
        day: 1.1,
        heat: 0.5,
        mirror: 0.95,
        ahead: 0.95
      }
    }
  };
  function bias(pid, side, dom) {
    const b = DOMAIN_BIAS[pid];
    if (b && b[side] && b[side][dom] != null) return b[side][dom];
    return 0.75 + h01("db" + pid + side + dom) * 0.5;
  }
  const skillFor = (base, pid, side, dom) => Math.max(0.05, Math.min(0.97, (base || 0.5) * bias(pid, side, dom)));
  const dHist = pid => PLAYED[pid] || 0;
  const CAST_SETS = {
    friends: [{
      id: "confidant",
      dim: "trust",
      label: "the one you tell first",
      them: "the one {name} tells first"
    }, {
      id: "instigator",
      dim: "spark",
      label: "the one who gets you out the door",
      them: "the one who gets {name} out the door"
    }, {
      id: "compass",
      dim: "judgement",
      label: "the one you ask what to do",
      them: "the one {name} asks what to do"
    }, {
      id: "constant",
      dim: "constancy",
      label: "the one who is just always there",
      them: "the one who is just always there"
    }],
    romantic: [{
      id: "softplace",
      dim: "trust",
      label: "the one you go home to",
      them: "the one {name} goes home to"
    }, {
      id: "spark",
      dim: "spark",
      label: "the one who starts things",
      them: "the one who starts things"
    }, {
      id: "planner",
      dim: "judgement",
      label: "the one who thinks ahead for you both",
      them: "the one who thinks ahead for you both"
    }, {
      id: "anchor",
      dim: "constancy",
      label: "the one who stays when it is hard",
      them: "the one who stays when it is hard"
    }]
  };
  const castRoles = mode => CAST_SETS[mode === "romantic" ? "romantic" : "friends"];
  const castThem = (role, name) => role.them.replace("{name}", name);
  function castQ(pid, r) {
    const roles = castRoles(duoMode(pid));
    const p = personOf(pid);
    const name = p ? first(p) : "they";
    return {
      id: "cast:" + r,
      kind: "cast",
      d: "cast",
      prompt: `Most days, ${name} is\u2026`,
      options: roles.map(x => x.label),
      optionsThem: roles.map(x => castThem(x, name)),
      roles
    };
  }
  function castOf(pid) {
    const roles = castRoles(duoMode(pid));
    const n = duoRevealedCount(pid);
    const casts = [];
    for (let r = 4; r <= n; r += 4) {
      const rd = duoRound(pid, r);
      if (rd.q.kind === "cast") casts.push({
        r,
        mine: rd.myAns,
        theirs: rd.theirAns,
        myGuess: rd.myGuess,
        sawIt: !!rd.readRight
      });
    }
    const tally = key => {
      const c = roles.map(() => 0);
      casts.forEach(x => {
        if (x[key] != null) c[x[key]]++;
      });
      return c;
    };
    const top = (c, key) => {
      if (!casts.length) return null;
      const best = Math.max(...c);
      const latest = casts.slice().reverse().find(x => x[key] != null && c[x[key]] === best);
      return latest ? {
        role: roles[latest[key]],
        n: best
      } : null;
    };
    const theirs = tally("theirs"),
      mine = tally("mine");
    return {
      roles,
      casts,
      n: casts.length,
      theirs,
      mine,
      youAre: top(theirs, "theirs"),
      theyAre: top(mine, "mine"),
      sawIt: {
        right: casts.filter(x => x.sawIt).length,
        total: casts.length
      }
    };
  }
  function duoList() {
    if (!S.duoList) S.duoList = IDS.slice();
    return S.duoList;
  }
  const duoIds = () => duoList().filter(pid => !window.FRIENDS || window.FRIENDS.isFriend(pid));
  function duoAvailable() {
    return members().filter(p => !duoList().includes(p.id) && S.duoInv[p.id] == null);
  }
  function startDuo(pid) {
    if (duoList().includes(pid) || S.duoInv[pid] != null) return;
    S.duoInv[pid] = Date.now();
    ensureTimer();
    save();
  }
  function cancelDuo(pid) {
    delete S.duoInv[pid];
    save();
  }
  function endDuo(pid) {
    S.duoList = duoList().filter(x => x !== pid);
    delete S.duoInv[pid];
    delete S.duo[pid];
    delete S.duoTheirs[pid];
    delete S.duoDue[pid];
    save();
  }
  function duoQ(pid, r) {
    const kind = duoKind(r);
    if (kind === "cast") return castQ(pid, r);
    if (kind === "world") return worldQ("d" + pid + ":" + r);
    const depth = (r - 1) / 2;
    const jit = Math.floor(h01("dqb" + pid + ":" + r) * 2);
    const pool = DUO_POOL(pid);
    const step = depth * 2 + jit;
    return pool[step < pool.length ? step : pool.length - 1 - step % pool.length];
  }
  const dKey = q => q.id || q.prompt;
  const dState = (pid, r) => {
    const s = (S.duo[pid] || {})[r];
    if (!s) return null;
    const q = duoQ(pid, r),
      n = q.options.length;
    return (s.qid == null || s.qid === dKey(q)) && (s.a == null || s.a < n) && (s.g == null || s.g < n) ? s : null;
  };
  const noGuess = (pid, r) => publicAnswer(pid, duoQ(pid, r));
  const theirsIn = (pid, r) => r <= dHist(pid) + (THEIR_AHEAD[pid] || 0) || !!((S.duoTheirs[pid] || {})[r] != null);
  const mineIn = (pid, r) => {
    if (r <= dHist(pid)) return true;
    const s = dState(pid, r);
    return !!(s && s.a != null && (s.g != null || noGuess(pid, r)));
  };
  const duoRevealed = (pid, r) => r <= dHist(pid) || mineIn(pid, r) && theirsIn(pid, r);
  function duoRevealedCount(pid) {
    let r = dHist(pid);
    while (duoRevealed(pid, r + 1)) r++;
    return r;
  }
  const duoMyTop = pid => {
    let r = dHist(pid);
    while (mineIn(pid, r + 1)) r++;
    return r;
  };
  const duoTheirTop = pid => {
    let r = dHist(pid);
    while (theirsIn(pid, r + 1)) r++;
    return r;
  };
  function duoOpen(pid) {
    const mine = duoMyTop(pid);
    return mine - duoTheirTop(pid) >= LEAD ? null : mine + 1;
  }
  function duoRound(pid, r) {
    const q = duoQ(pid, r);
    const key = pid + ":r" + r;
    const n = q.options.length;
    const wrong = (right, k) => (right + 1 + Math.floor(h01(k) * (n - 1))) % n;
    const hist = r <= dHist(pid);
    const skip = noGuess(pid, r);
    const cast = q.kind === "cast";
    const sticky = who => {
      const fav = Math.floor(h01("cf" + who + pid) * n);
      return h01("cs" + who + key) < 0.72 ? fav : (fav + 1 + Math.floor(h01("cx" + who + key) * (n - 1))) % n;
    };
    const theirAns = cast ? sticky("t") : Math.floor(h01("ta" + key) * n);
    const s = dState(pid, r) || {};
    const myAns = hist ? cast ? sticky("m") : Math.floor(h01("da" + key) * n) : s.a != null ? s.a : null;
    const myGuess = skip ? null : hist ? h01("dg" + key) < skillFor(READ_SKILL[pid], pid, "read", q.d) ? theirAns : wrong(theirAns, "dgw" + key) : s.g != null ? s.g : null;
    const revealed = duoRevealed(pid, r);
    const theirGuess = revealed && myAns != null ? h01("tg" + key) < skillFor(BY_SKILL[pid], pid, "by", q.d) ? myAns : wrong(myAns, "tgw" + key) : null;
    return {
      q,
      r,
      myAns,
      myGuess,
      theirAns,
      theirGuess,
      revealed,
      noGuess: skip,
      mineIn: mineIn(pid, r),
      theirsIn: theirsIn(pid, r),
      readRight: revealed && !skip && myGuess === theirAns,
      byRight: revealed && theirGuess != null && theirGuess === myAns
    };
  }
  function duoDay(pid, idx) {
    return duoRound(pid, idx === 0 ? duoOpen(pid) || duoMyTop(pid) + 1 : duoRevealedCount(pid) - idx + 1);
  }
  function myDuo(pid) {
    const r = duoOpen(pid);
    return r ? dState(pid, r) || {} : {};
  }
  function answerDuo(pid, patch, r) {
    r = r || duoOpen(pid);
    if (!r) return;
    S.duo[pid] = {
      ...(S.duo[pid] || {}),
      [r]: {
        ...(dState(pid, r) || {}),
        ...patch,
        qid: dKey(duoQ(pid, r))
      }
    };
    if (mineIn(pid, r) && !theirsIn(pid, r) && LAG[pid] != null) {
      S.duoDue[pid] = S.duoDue[pid] || {};
      S.duoDue[pid][r] = Date.now() + LAG[pid];
      ensureTimer();
    }
    save();
  }
  const partnerToday = pid => theirsIn(pid, duoOpen(pid) || duoMyTop(pid));
  function duoState(pid) {
    const open = duoOpen(pid);
    if (open != null) return duoRevealedCount(pid) === 0 && open === 1 ? "start" : "turn";
    return "waiting";
  }
  function duoView(pid) {
    const hist = dHist(pid),
      revealed = duoRevealedCount(pid);
    const open = duoOpen(pid),
      myTop = duoMyTop(pid),
      theirTop = duoTheirTop(pid);
    const ahead = Math.max(0, myTop - revealed);
    return {
      hist,
      revealed,
      open,
      myTop,
      theirTop,
      waiting: Math.max(0, theirTop - myTop),
      ahead,
      lead: open == null,
      lastRevealed: revealed >= 1 ? duoRound(pid, revealed) : null,
      round: r => duoRound(pid, r),
      sealed: Array.from({
        length: ahead
      }, (_, i) => revealed + 1 + i)
    };
  }
  function partners() {
    const live = duoIds().map(pid => personOf(pid)).filter(Boolean).map(p => {
      const played = duoRevealedCount(p.id);
      const read = {
        right: 0,
        total: 0
      };
      const readBy = {
        right: 0,
        total: 0
      };
      const misses = [];
      const domains = {};
      domainsFor(duoMode(p.id)).forEach(k => {
        domains[k.id] = {
          read: [],
          by: []
        };
      });
      for (let r = 1; r <= played; r++) {
        const rd = duoRound(p.id, r);
        if (!rd.noGuess) {
          read.total++;
          if (rd.readRight) read.right++;
        }
        readBy.total++;
        if (rd.byRight) readBy.right++;
        const dm = domains[rd.q.d];
        if (dm) {
          if (!rd.noGuess) dm.read.push(!!rd.readRight);
          dm.by.push(!!rd.byRight);
        }
        if (!rd.byRight) misses.push({
          pid: p.id,
          name: p.name,
          dayIdx: played - r + 1,
          round: r,
          q: rd.q.prompt,
          guessed: rd.q.options[rd.theirGuess],
          actual: rd.q.options[rd.myAns]
        });
      }
      const state = duoState(p.id);
      const v = duoView(p.id);
      return {
        ...p,
        played,
        read,
        readBy,
        domains,
        misses,
        state,
        streak: played,
        rounds: played,
        waiting: v.waiting,
        ahead: v.ahead,
        open: v.open,
        mode: duoMode(p.id)
      };
    });
    const invited = Object.keys(S.duoInv).map(pid => personOf(pid)).filter(Boolean).map(p => ({
      ...p,
      played: 0,
      read: {
        right: 0,
        total: 0
      },
      readBy: {
        right: 0,
        total: 0
      },
      domains: null,
      misses: [],
      state: "invited",
      streak: 0,
      rounds: 0,
      waiting: 0,
      ahead: 0,
      open: null,
      mode: duoMode(p.id)
    }));
    return live.concat(invited);
  }
  function pendingDuos() {
    return partners().filter(p => p.state === "turn" || p.state === "start").length;
  }
  function impressions() {
    return partners().flatMap(p => p.misses).sort((a, b) => a.dayIdx - b.dayIdx);
  }
  function resetRounds() {
    S.duo = {};
    S.duoTheirs = {};
    S.duoDue = {};
    S.groups = {};
    S.groupIn = {};
    S.groupDue = {};
    save();
  }
  function fmtLeft(ms) {
    if (ms == null) return "";
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return "under a minute";
    const d = Math.floor(m / 1440),
      h = Math.floor(m % 1440 / 60);
    if (d > 0) return d + "d " + h + "h";
    return h > 0 ? h + "h " + String(m % 60).padStart(2, "0") + "m" : m + "m";
  }
  window.DUELS = {
    LEAD,
    members,
    personOf,
    first,
    fmtLeft,
    isWorldRound,
    isRatingRound,
    stepLabel,
    duoKind,
    groups,
    groupQ,
    groupMembers,
    groupPicksRound,
    groupView,
    myGroupRound,
    answerGroup,
    groupDone,
    groupsPending,
    groupInToday,
    groupAlignment,
    groupPortrait,
    groupScores,
    groupDeadline,
    groupOpen,
    createGroup,
    addGroupMembers,
    removeGroupMember,
    leaveGroup,
    SCENARIOS,
    ALL_ROLES,
    RATE_QS,
    SEATS,
    roleVotes,
    archetypeOf,
    CAST_SETS,
    castRoles,
    castThem,
    castOf,
    duoQ,
    duoDay,
    duoRound,
    duoView,
    duoOpen,
    myDuo,
    answerDuo,
    partnerToday,
    duoState,
    partners,
    pendingDuos,
    impressions,
    duoMode,
    setDuoMode,
    DOMAINS,
    domainsFor,
    domainRows,
    weakDomain,
    duoAvailable,
    startDuo,
    cancelDuo,
    endDuo,
    resetRounds,
    resetToday: resetRounds,
    subscribe: f => {
      listeners.add(f);
      return () => listeners.delete(f);
    }
  };
  if (window.FRIENDS) window.FRIENDS.subscribe(fire);
})();
