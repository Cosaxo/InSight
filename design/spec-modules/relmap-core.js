// RelationshipMap — core: demo data, palette, color scales, and the
// force-directed / rings layout engine. No JSX — loads as a plain script.
// View lives in relationship-map.jsx, detail panels in relationship-map-panels.jsx.
(function () {
  // ── deterministic PRNG ──
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DEFAULT_GROUPS = [
    { key: 'family',    label: 'Family',        hue: 30 },
    { key: 'close',     label: 'Close Friends', hue: 152 },
    { key: 'friends',   label: 'Friends',       hue: 255 },
    { key: 'work',      label: 'Work',          hue: 305 },
    { key: 'school',    label: 'School & Past', hue: 78 },
    { key: 'community', label: 'Community',     hue: 200 },
  ];

  const TRAITS = {
    Linda:[3,4], Robert:[4,3], Emma:[2,4], Daniel:[3,3], Rose:[4,2], Tom:[4,5], Susan:[3,4], Jake:[2,3], Mia:[1,4],
    Sofia:[2,5], Marcus:[2,4], Priya:[1,3], Leo:[3,2], Hannah:[2,3], Noah:[3,2],
    Olivia:[2,5], Ethan:[3,3], Ava:[1,2], Liam:[4,4], Chloe:[2,4], Ben:[3,3], Zoe:[1,5], Adam:[3,2], Grace:[2,3], Ryan:[4,4], Nina:[2,2],
    Sarah:[3,4], David:[3,3], Rachel:[2,3], Kevin:[3,2], Maya:[2,4], James:[4,2], Lily:[2,3], Wes:[4,4],
    Jordan:[2,3], Carmen:[1,4], Derek:[4,3], Aisha:[1,3], Felix:[3,2], Tara:[3,4], Sam:[2,2], Owen:[5,5], Bella:[4,3],
    Mike:[3,5], Pat:[4,3], Jess:[2,2], Anya:[1,2], Ruth:[2,3], Victor:[3,3],
  };

  const PEOPLE = [
    ['Linda', 'family', 'Mother', 'Calls every Sunday without fail — the steady center of the whole family.', 'Portland, OR', 30, 5],
    ['Robert', 'family', 'Father', 'Taught me to fish, to drive, and to fix almost anything with my hands.', 'Portland, OR', 30, 5],
    ['Emma', 'family', 'Sister', 'Younger sister and closest confidante; lives just two blocks away.', 'Seattle, WA', 27, 5],
    ['Daniel', 'family', 'Brother', 'Older brother and brand-new dad — we trade parenting and life advice.', 'Denver, CO', 30, 4],
    ['Rose', 'family', 'Grandmother', 'Ninety-four and sharper than all of us combined.', 'Portland, OR', 30, 4],
    ['Tom', 'family', 'Uncle', "Dad's brother and the designated comedian at every gathering.", 'Boise, ID', 25, 3],
    ['Susan', 'family', 'Aunt', "Mom's sister; hosts Thanksgiving and remembers every birthday.", 'Portland, OR', 25, 3],
    ['Jake', 'family', 'Cousin', 'We grew up more like brothers than cousins.', 'Spokane, WA', 28, 3],
    ['Mia', 'family', 'Cousin', 'We trade memes and music recommendations almost daily.', 'Eugene, OR', 22, 3],

    ['Sofia', 'close', 'Best friend', 'Met the first week of college; she knows the whole story.', 'Seattle, WA', 12, 5],
    ['Marcus', 'close', 'Best friend', 'Road-trip partner and voice of reason since freshman year.', 'San Francisco, CA', 12, 5],
    ['Priya', 'close', 'Close friend', 'We started a monthly supper club that somehow still runs.', 'Seattle, WA', 8, 4],
    ['Leo', 'close', 'Close friend', 'Climbing partner and the person I call to think out loud.', 'Bend, OR', 7, 4],
    ['Hannah', 'close', 'Close friend', 'From my very first job — we kept the friendship, lost the cubicles.', 'Seattle, WA', 9, 4],
    ['Noah', 'close', 'Close friend', 'A neighbor who quietly became one of my favorite people.', 'Seattle, WA', 6, 4],

    ['Olivia', 'friends', 'Friend', 'Anchor of our Tuesday trivia team.', 'Seattle, WA', 5, 3],
    ['Ethan', 'friends', 'Friend', 'Met through Marcus; now a friend in his own right.', 'Portland, OR', 4, 3],
    ['Ava', 'friends', 'Friend', 'From the neighborhood photography meetup.', 'Seattle, WA', 3, 2],
    ['Liam', 'friends', 'Friend', 'Saturday pickup basketball regular.', 'Tacoma, WA', 4, 2],
    ['Chloe', 'friends', 'Friend', "One of Sofia's people who became one of mine.", 'Seattle, WA', 5, 3],
    ['Ben', 'friends', 'Friend', 'Old roommate; still the best person to call after a long week.', 'Austin, TX', 8, 3],
    ['Zoe', 'friends', 'Friend', 'Ringleader of the concert crew.', 'Seattle, WA', 4, 2],
    ['Adam', 'friends', 'Friend', 'Sunday morning cycling group.', 'Seattle, WA', 3, 2],
    ['Grace', 'friends', 'Friend', 'Met while traveling in Portugal and stayed in touch.', 'Lisbon, PT', 2, 2],
    ['Ryan', 'friends', 'Friend', 'Commissioner of the fantasy league, for better or worse.', 'Chicago, IL', 6, 2],
    ['Nina', 'friends', 'Friend', 'A coffee-shop regular who turned into a real friend.', 'Seattle, WA', 3, 2],

    ['Sarah', 'work', 'Manager', 'My manager and a genuinely great mentor.', 'Seattle, WA', 4, 4],
    ['David', 'work', 'Colleague', 'Desk neighbor and reliable lunch partner.', 'Seattle, WA', 4, 3],
    ['Rachel', 'work', 'Colleague', 'Our design lead — endlessly sharp and generous with feedback.', 'Remote', 3, 3],
    ['Kevin', 'work', 'Colleague', 'On my team; we trade code reviews and bad jokes.', 'Seattle, WA', 2, 2],
    ['Maya', 'work', 'Colleague', 'We co-led a launch together and survived it.', 'Remote', 3, 3],
    ['James', 'work', 'Colleague', 'From the data team; makes great charts and better coffee.', 'Seattle, WA', 2, 2],
    ['Lily', 'work', 'Former colleague', 'Left for a startup but we still grab dinner monthly.', 'San Jose, CA', 5, 3],
    ['Wes', 'work', 'Skip-level', 'A director who has quietly been a big advocate for me.', 'Seattle, WA', 3, 2],

    ['Jordan', 'school', 'College friend', 'Freshman-year dorm-mate, now on the other coast.', 'Boston, MA', 12, 3],
    ['Carmen', 'school', 'College friend', 'Study-group ride-or-die through every all-nighter.', 'New York, NY', 12, 3],
    ['Derek', 'school', 'College friend', 'Intramural soccer and questionable late-night food runs.', 'Portland, OR', 12, 2],
    ['Aisha', 'school', 'Grad school', 'Thesis-writing buddy; we kept each other sane.', 'Seattle, WA', 6, 3],
    ['Felix', 'school', 'High school', 'Known him since we were fourteen.', 'Portland, OR', 16, 3],
    ['Tara', 'school', 'High school', 'Same prom group; still trade birthday calls.', 'Portland, OR', 16, 2],
    ['Sam', 'school', 'College friend', 'We started a band that played exactly three shows.', 'Olympia, WA', 11, 2],
    ['Owen', 'school', 'College friend', 'Debate team partner with an argument for everything.', 'Washington, DC', 12, 2],
    ['Bella', 'school', 'High school', 'Reconnected at the ten-year reunion and picked right up.', 'Salem, OR', 16, 2],

    ['Mike', 'community', 'Run-club coach', 'Leads the Saturday long runs and the pep talks.', 'Seattle, WA', 3, 2],
    ['Pat', 'community', 'Neighbor', 'Lends me tools and shares the tomato harvest.', 'Seattle, WA', 4, 2],
    ['Jess', 'community', 'Bandmate', 'Plays bass in the garage band; impeccable taste.', 'Seattle, WA', 2, 2],
    ['Anya', 'community', 'Yoga friend', 'Tuesday class regular and tea afterward.', 'Seattle, WA', 2, 1],
    ['Ruth', 'community', 'Book club', 'Reliably picks the best novel of the year.', 'Seattle, WA', 3, 2],
    ['Victor', 'community', 'Volunteer', 'Saturdays at the food bank, rain or shine.', 'Seattle, WA', 2, 1],
  ];

  const CROSS_LINKS = [
    ['Sofia', 'Chloe'], ['Marcus', 'Ethan'], ['Sofia', 'Priya'], ['Sarah', 'Lily'],
    ['Sam', 'Jess'], ['Derek', 'Felix'], ['Hannah', 'Sarah'], ['Leo', 'Adam'],
    ['Emma', 'Noah'], ['Priya', 'Olivia'], ['David', 'Maya'],
    ['Ben', 'Ryan'], ['Aisha', 'Rachel'], ['Mia', 'Tara'],
  ];

  // ── ages (years) — drives the Age lens ──
  const YOU_AGE = 33;
  const AGES = {
    Linda: 61, Robert: 64, Emma: 27, Daniel: 36, Rose: 94, Tom: 58, Susan: 59, Jake: 34, Mia: 24,
    Sofia: 33, Marcus: 33, Priya: 31, Leo: 35, Hannah: 36, Noah: 41,
    Olivia: 30, Ethan: 32, Ava: 27, Liam: 29, Chloe: 31, Ben: 34, Zoe: 26, Adam: 38, Grace: 28, Ryan: 35, Nina: 25,
    Sarah: 44, David: 37, Rachel: 39, Kevin: 26, Maya: 33, James: 29, Lily: 34, Wes: 51,
    Jordan: 33, Carmen: 34, Derek: 33, Aisha: 30, Felix: 33, Tara: 32, Sam: 32, Owen: 34, Bella: 33,
    Mike: 48, Pat: 66, Jess: 27, Anya: 42, Ruth: 71, Victor: 55,
  };
  const AGE_BANDS = [
    { key: 'a0', label: 'Under 30', min: 0,  max: 29,  color: 'oklch(0.80 0.10 150)' },
    { key: 'a1', label: '30s',      min: 30, max: 39,  color: 'oklch(0.68 0.10 185)' },
    { key: 'a2', label: '40s',      min: 40, max: 49,  color: 'oklch(0.58 0.10 220)' },
    { key: 'a3', label: '50–64',    min: 50, max: 64,  color: 'oklch(0.50 0.10 260)' },
    { key: 'a4', label: '65+',      min: 65, max: 200, color: 'oklch(0.42 0.09 300)' },
  ];
  const ageBand = (a) => AGE_BANDS.find(b => a >= b.min && a <= b.max) || AGE_BANDS[1];
  const ageColor = (a) => ageBand(a).color;

  // ── color scales (kept from the widget) ──
  const closenessColor = (c) => ({ 5: 'oklch(0.54 0.13 25)', 4: 'oklch(0.63 0.12 45)', 3: 'oklch(0.72 0.10 65)', 2: 'oklch(0.80 0.07 85)', 1: 'oklch(0.86 0.05 95)' })[c] || 'oklch(0.8 0.05 90)';
  const reconnectColor = (k) => ({ in: 'oklch(0.70 0.05 155)', due: 'oklch(0.75 0.13 80)', overdue: 'oklch(0.60 0.16 32)' })[k] || 'oklch(0.7 0.02 90)';
  function statusMeta(k) {
    return {
      color: reconnectColor(k),
      tint: ({ in: 'oklch(0.95 0.02 155)', due: 'oklch(0.96 0.05 85)', overdue: 'oklch(0.95 0.04 32)' })[k],
      label: ({ in: 'In touch', due: 'Due soon', overdue: 'Overdue' })[k],
    };
  }
  const closenessWord = (c) => ['', 'Distant', 'Acquaintance', 'Friendly', 'Close', 'Very close'][c] || '';
  const yearsWord = (y) => (y <= 0 ? '—' : (y === 1 ? '1 year' : y + ' years'));
  function humanizeDays(d) {
    if (d <= 1) return 'a day ago';
    if (d < 7) return d + ' days ago';
    if (d < 30) { const w = Math.round(d / 7); return w <= 1 ? 'a week ago' : w + ' weeks ago'; }
    if (d < 365) { const m = Math.round(d / 30); return m <= 1 ? 'a month ago' : m + ' months ago'; }
    const y = Math.round(d / 365); return y <= 1 ? 'over a year ago' : y + ' years ago';
  }
  function politicalColor(v) {
    const t = Math.max(0, Math.min(1, (v - 1) / 4));
    const hue = t < 0.5 ? 256 : 25;
    const chroma = (0.02 + 0.135 * Math.abs(t - 0.5) * 2).toFixed(3);
    return 'oklch(0.62 ' + chroma + ' ' + hue + ')';
  }
  function personalityColor(v) {
    const t = Math.max(0, Math.min(1, (v - 1) / 4));
    const hue = t < 0.5 ? 295 : 70;
    const chroma = (0.03 + 0.12 * Math.abs(t - 0.5) * 2).toFixed(3);
    return 'oklch(0.6 ' + chroma + ' ' + hue + ')';
  }
  const politicalLabel = (v) => ['', 'Progressive', 'Leans left', 'Moderate', 'Leans right', 'Conservative'][Math.round(Math.max(1, Math.min(5, v)))] || 'Moderate';
  const personalityLabel = (v) => ['', 'Introvert', 'Reserved', 'Balanced', 'Outgoing', 'Extrovert'][Math.round(Math.max(1, Math.min(5, v)))] || 'Balanced';

  // ── warm-neutral palette on the app's ~75 axis, matching the shell ramp so
  //    the embedded map sits INSIDE the page instead of reading as a cool card.
  //    The canvas drinks a whisper of the page accent for the tab's tint. ──
  const P = {
    canvas: 'var(--rm-canvas, color-mix(in oklch, var(--accent, oklch(0.55 0.14 150)) 3.5%, oklch(0.982 0.004 75)))',
    card: 'oklch(0.996 0.0025 80)',
    cardBorder: 'oklch(0.915 0.006 74)',
    rule: 'oklch(0.905 0.006 74)',
    ruleSoft: 'oklch(0.928 0.005 74)',
    ink: 'oklch(0.216 0.011 70)',
    inkName: 'oklch(0.20 0.011 70)',
    ink2: 'oklch(0.41 0.011 68)',
    ink3: 'oklch(0.55 0.010 68)',
    faint: 'oklch(0.63 0.011 68)',
    body: 'oklch(0.5 0.011 68)',
    youDot: 'oklch(0.25 0.010 70)',
    chipBg: 'oklch(0.945 0.005 74)',
    chipBg2: 'oklch(0.926 0.005 74)',
    nodeStroke: 'oklch(0.99 0.003 80)',
    initFill: 'oklch(0.99 0.003 80)',
    shadow: '0 4px 16px -8px rgba(45,38,28,0.20)',
    panelShadow: '0 24px 64px -22px rgba(45,38,28,0.28)',
  };

  function groupDefs(groups) {
    const m = { you: { label: 'You', color: P.youDot, tint: P.chipBg, hue: null } };
    (groups || DEFAULT_GROUPS).forEach(grp => {
      m[grp.key] = {
        label: grp.label,
        color: 'oklch(0.605 0.118 ' + grp.hue + ')',
        tint: 'oklch(0.95 0.03 ' + grp.hue + ')',
        hue: grp.hue,
      };
    });
    return m;
  }

  // ── build the force-directed graph ──
  function buildGraph(groups, people, W, H, gravity, layout) {
    const G = groupDefs(groups);
    W = W || 1000; H = H || 680; gravity = gravity || 0.012;
    const nodes = [{
      id: 0, name: 'You', group: 'you', relationship: 'This is you',
      note: 'The center of it all. Everyone here connects back to you.',
      location: 'Seattle, WA', years: 0, closeness: 5, age: YOU_AGE, initials: 'You',
      lastContactDays: 0, status: 'in', lastLabel: '—', r: 24, x: 0, y: 0,
    }];
    const groupMembers = {}, validGroup = {};
    groups.forEach(grp => { groupMembers[grp.key] = []; validGroup[grp.key] = true; });
    const cad = { 5: 7, 4: 21, 3: 60, 2: 150, 1: 330 };
    people.forEach((p) => {
      if (!validGroup[p.group]) return;
      const id = nodes.length;
      groupMembers[p.group].push(id);
      const r = rng(id * 977 + 13)();
      const ratio = 0.25 + r * 2.0;
      const days = Math.round((cad[p.closeness] || 120) * ratio);
      const status = ratio < 0.85 ? 'in' : (ratio < 1.5 ? 'due' : 'overdue');
      nodes.push({
        id, name: p.name, group: p.group, relationship: p.relationship, note: p.note,
        location: p.location, years: p.years, closeness: p.closeness, age: p.age,
        political: p.political, personality: p.personality,
        initials: p.name[0], lastContactDays: days, status, lastLabel: humanizeDays(days),
        r: 6.5 + p.closeness * 2.3, x: 0, y: 0,
      });
    });

    const groupHubId = {};
    Object.keys(groupMembers).forEach(gk => {
      const id = nodes.length;
      groupHubId[gk] = id;
      const mem = groupMembers[gk];
      const count = mem.length;
      const mean = (f) => count ? mem.reduce((s, mid) => s + nodes[mid][f], 0) / count : null;
      nodes.push({
        id, name: G[gk].label, group: gk, isHub: true,
        avgPolitical: mean('political'), avgPersonality: mean('personality'), avgCloseness: mean('closeness'), avgAge: mean('age'),
        relationship: 'Your ' + G[gk].label.toLowerCase() + ' circle',
        note: count + ' people gather in this circle. Tap any name to explore the connection.',
        location: '—', years: 0, closeness: 5, initials: String(count),
        lastContactDays: 0, status: 'in', lastLabel: '—', r: 19, x: 0, y: 0,
      });
    });
    const allPeople = nodes.filter(n => n.id !== 0 && !n.isHub);
    const pmean = (f) => allPeople.length ? allPeople.reduce((s, n) => s + n[f], 0) / allPeople.length : 3;
    nodes[0].avgPolitical = pmean('political');
    nodes[0].avgPersonality = pmean('personality');
    nodes[0].avgCloseness = pmean('closeness');
    nodes[0].avgAge = pmean('age');

    const idByName = {};
    nodes.forEach(n => { idByName[n.name] = n.id; });

    const edges = [];
    const addE = (a, b, s, hub) => { if (a != null && b != null && a !== b) edges.push({ a, b, strength: s, hub: !!hub }); };
    Object.keys(groupHubId).forEach(gk => {
      addE(0, groupHubId[gk], 2.6, true);
      groupMembers[gk].forEach(id => addE(groupHubId[gk], id, 2.0, true));
    });
    Object.keys(groupMembers).forEach(gk => {
      const ids = groupMembers[gk];
      for (let i = 0; i < ids.length; i++) {
        if (i + 1 < ids.length) addE(ids[i], ids[i + 1], 2.5);
        if (i + 2 < ids.length && i % 2 === 0) addE(ids[i], ids[i + 2], 2);
      }
    });
    CROSS_LINKS.forEach(([a, b]) => addE(idByName[a], idByName[b], 2));

    const adj = {};
    nodes.forEach(n => { adj[n.id] = new Set([n.id]); });
    edges.forEach(e => { adj[e.a].add(e.b); adj[e.b].add(e.a); });

    const N = nodes.length;
    if (layout === 'rings') {
      // concentric rings: closeness = distance from You, circles as wedges
      const BANDS = { 5: 92, 4: 148, 3: 204, 2: 260, 1: 316 };
      const keys = Object.keys(groupMembers);
      const wts = keys.map(gk => Math.max(groupMembers[gk].length, 2));
      const wSum = wts.reduce((s, w) => s + w, 0) || 1;
      const padAng = 0.10;
      let ang = -Math.PI / 2;
      keys.forEach((gk, gi) => {
        const span = (Math.PI * 2 - padAng * keys.length) * (wts[gi] / wSum);
        const byC = {};
        groupMembers[gk].forEach(id => { const c = nodes[id].closeness; (byC[c] = byC[c] || []).push(id); });
        Object.keys(byC).forEach(c => {
          const ids = byC[c], R = BANDS[c] || 204;
          const tight = (span * R) / ids.length < 42;
          ids.forEach((id, i) => {
            const a = ang + ((i + 0.5) / ids.length) * span;
            const r = R + (tight ? (i % 2 ? 15 : -15) : 0);
            nodes[id].x = Math.cos(a) * r; nodes[id].y = Math.sin(a) * r;
          });
        });
        const mid = ang + span / 2, hid = groupHubId[gk];
        nodes[hid].x = Math.cos(mid) * 372; nodes[hid].y = Math.sin(mid) * 372;
        ang += span + padAng;
      });
    } else {
    // Fruchterman–Reingold
    const k = Math.sqrt((W * H) / N) * 0.82;
    const rand = rng(7);
    const groupAngle = {};
    Object.keys(groupMembers).forEach((gk, gi, arr) => { groupAngle[gk] = (gi / arr.length) * Math.PI * 2; });
    nodes.forEach((n, i) => {
      if (i === 0) { n.x = 0; n.y = 0; return; }
      const ang = (groupAngle[n.group] || 0) + (rand() - 0.5) * 1.1;
      const rad = (n.isHub ? 110 : 60) + rand() * 220;
      n.x = Math.cos(ang) * rad; n.y = Math.sin(ang) * rad;
    });
    let temp = W * 0.12;
    for (let it = 0; it < 320; it++) {
      const dispX = new Float64Array(N), dispY = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const f = (k * k) / dist, ux = dx / dist, uy = dy / dist;
          dispX[i] += ux * f; dispY[i] += uy * f; dispX[j] -= ux * f; dispY[j] -= uy * f;
        }
      }
      edges.forEach(e => {
        const a = nodes[e.a], b = nodes[e.b];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (dist * dist) / k * (0.5 + e.strength * 0.18), ux = dx / dist, uy = dy / dist;
        dispX[e.a] -= ux * f; dispY[e.a] -= uy * f; dispX[e.b] += ux * f; dispY[e.b] += uy * f;
      });
      for (let i = 0; i < N; i++) { dispX[i] -= nodes[i].x * gravity; dispY[i] -= nodes[i].y * gravity; }
      for (let i = 1; i < N; i++) {
        let len = Math.sqrt(dispX[i] * dispX[i] + dispY[i] * dispY[i]) || 0.01;
        const step = Math.min(len, temp);
        nodes[i].x += (dispX[i] / len) * step; nodes[i].y += (dispY[i] / len) * step;
      }
      nodes[0].x = 0; nodes[0].y = 0;
      temp *= 0.975; if (temp < 0.6) temp = 0.6;
    }
    for (let pass = 0; pass < 70; pass++) {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const min = a.r + b.r + 17;
          if (dist < min) {
            const push = (min - dist) / 2, ux = dx / dist, uy = dy / dist;
            if (i !== 0) { a.x -= ux * push; a.y -= uy * push; }
            if (j !== 0) { b.x += ux * push; b.y += uy * push; }
          }
        }
      }
      nodes[0].x = 0; nodes[0].y = 0;
    }
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r);
    });
    const pad = 50, spanX = maxX - minX, spanY = maxY - minY;
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const offX = (W - spanX * scale) / 2 - minX * scale;
    const offY = (H - spanY * scale) / 2 - minY * scale;
    nodes.forEach(n => { n.cx = n.x * scale + offX; n.cy = n.y * scale + offY; });
    const ringGuides = layout === 'rings' ? [92, 148, 204, 260, 316].map(r => r * scale) : null;

    // Final de-overlap in render space. The layout-space collision pass mixes
    // viewBox-unit radii with layout-unit positions, so true spacing is resolved
    // here on cx/cy with the actual drawn radii, then refit so nothing clips.
    if (layout !== 'rings') {
      const cx0 = nodes[0].cx, cy0 = nodes[0].cy;
      for (let pass = 0; pass < 90; pass++) {
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const a = nodes[i], b = nodes[j];
            let dx = b.cx - a.cx, dy = b.cy - a.cy;
            let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const min = a.r + b.r + ((a.isHub || b.isHub) ? 16 : 12);
            if (dist < min) {
              const push = (min - dist) / 2, ux = dx / dist, uy = dy / dist;
              if (i !== 0) { a.cx -= ux * push; a.cy -= uy * push; }
              if (j !== 0) { b.cx += ux * push; b.cy += uy * push; }
            }
          }
        }
        nodes[0].cx = cx0; nodes[0].cy = cy0;
      }
      // refit (uniform scale preserves the gaps we just opened)
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      nodes.forEach(n => { mnx = Math.min(mnx, n.cx - n.r); mxx = Math.max(mxx, n.cx + n.r); mny = Math.min(mny, n.cy - n.r); mxy = Math.max(mxy, n.cy + n.r); });
      const fpad = 46, fs = Math.min((W - fpad * 2) / (mxx - mnx), (H - fpad * 2) / (mxy - mny), 1);
      const fox = (W - (mxx - mnx) * fs) / 2 - mnx * fs, foy = (H - (mxy - mny) * fs) / 2 - mny * fs;
      nodes.forEach(n => { n.cx = n.cx * fs + fox; n.cy = n.cy * fs + foy; n.r = n.r * fs; });
    }

    const byId = {}; nodes.forEach(n => { byId[n.id] = n; });
    // Label only You + the circle hubs at rest; people-names appear on hover/select.
    const keyNodes = new Set([0, ...Object.values(groupHubId)]);
    return { nodes, edges, adj, groupMembers, groupHubId, peopleCount: allPeople.length, byId, keyNodes, W, H, ringGuides };
  }

  function defaultPeople() {
    return PEOPLE.map(p => {
      const [name, group, relationship, note, location, years, closeness] = p;
      const tr = TRAITS[name] || [3, 3];
      return { name, group, relationship, note, location, years, closeness, age: AGES[name] || 34, political: tr[0], personality: tr[1] };
    });
  }

  window.RMCore = {
    rng, DEFAULT_GROUPS, TRAITS, PEOPLE, CROSS_LINKS, YOU_AGE, AGES,
    AGE_BANDS, ageBand, ageColor, closenessColor, reconnectColor, statusMeta,
    closenessWord, yearsWord, humanizeDays, politicalColor, personalityColor,
    politicalLabel, personalityLabel, P, groupDefs, buildGraph, defaultPeople,
  };
})();
