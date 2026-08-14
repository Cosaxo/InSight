// pulse-data.js — THE DAILY PULSE: one question, asked every day, unchanged.
// A line may only be drawn through a question that repeats, so the pulse is the
// one fixed question in the app. Everything here is honest by construction:
//   · a day nobody answered is ABSENT — never zero-filled, never bridged
//   · a day too thin to place keeps its count and is listed, not positioned
//   · no smoothing, no rolling mean, no invented baseline anywhere
// The reading lives in pulse-trends.jsx; the instrument in pulse-card.jsx.
(function () {
  const KEY = 'insight.pulse.v1';
  const DAYS = 21;         // three weeks — the window the reading covers
  const THIN = 20;         // fewer answers than this: counted, never placed
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const STEPS = [
    { v: 1, label: 'Rough' },
    { v: 2, label: 'Off' },
    { v: 3, label: 'Fine' },
    { v: 4, label: 'Good' },
    { v: 5, label: 'Great' },
  ];

  // ── demo histories. Each one exists to make an honest case visible:
  //   typical — a real user: mostly answered, three single skips
  //   gap     — a week away in the middle: the line must break, not dip
  //   day1    — nothing yet: one dot is not a trend
  //   perfect — twenty in a row: the streak treatment at full length
  const HISTORY = {
    typical: [3, 4, 4, null, 3, 2, 3, 4, 4, 4, null, 3, 3, 4, 5, 4, null, 3, 4, 4, null],
    gap:     [4, 3, 3, 4, 4, 3, 4, null, null, null, null, null, null, null, 3, 4, 4, 3, 4, 4, null],
    day1:    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    perfect: [4, 4, 3, 4, 5, 4, 4, 3, 4, 4, 5, 5, 4, 4, 3, 4, 4, 5, 5, 4, null],
  };

  // ── the populations you can hold your line against. Means are per-day and raw;
  // n is the count behind each one. Today's n is partial — the day isn't over.
  const SCOPES = [
    {
      id: 'city', short: 'city',
      mean: [3.4, 3.5, null, 3.2, 3.3, 3.6, 3.1, 2.9, null, 3.4, 3.5, 3.3, 3.2, 3.6, 3.7, 3.0, 3.3, 3.4, 3.5, 3.6, 3.5],
      n:    [64, 71, 0, 58, 83, 96, 41, 12, 0, 77, 88, 64, 59, 103, 96, 8, 74, 92, 118, 131, 43],
    },
    {
      id: 'country', short: 'country',
      mean: [3.3, 3.4, 3.3, 3.2, 3.3, 3.5, 3.2, 3.1, 3.2, 3.3, 3.4, 3.3, 3.2, 3.5, 3.6, 3.2, 3.3, 3.4, 3.4, 3.5, 3.4],
      n:    [1240, 1310, 980, 1120, 1420, 1510, 1180, 1260, 1090, 1330, 1470, 1280, 1210, 1560, 1620, 1180, 1390, 1480, 1620, 1710, 610],
    },
    {
      id: 'world', short: 'world', label: 'World',
      mean: [3.5, 3.5, 3.4, 3.4, 3.5, 3.6, 3.4, 3.4, 3.4, 3.5, 3.5, 3.5, 3.4, 3.6, 3.6, 3.4, 3.5, 3.5, 3.5, 3.6, 3.5],
      n:    [58200, 61400, 49800, 57300, 64100, 71200, 55600, 59800, 52100, 63400, 69700, 60200, 57900, 72300, 74800, 58600, 66200, 70400, 73900, 78100, 24800],
    },
  ];

  // today's five bins, everywhere — the crowd half of the card's reveal
  const TODAY_BINS = { city: [7, 12, 27, 35, 19], country: [8, 14, 28, 33, 17], world: [6, 13, 28, 34, 19] };

  const subs = new Set();
  const notify = () => subs.forEach((f) => { try { f(); } catch (e) {} });

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const dayAt = (i) => { const d = midnight(); d.setDate(d.getDate() - (DAYS - 1 - i)); return d; };
  const dayLabel = (d) => d.getDate() + ' ' + MON[d.getMonth()];

  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

  const hist = () => HISTORY[window.IS_PULSE_HISTORY] || HISTORY.typical;

  // one row per day: the seeded history, with anything you actually answered on top
  function days() {
    const h = hist(), mine = load();
    return h.map((v, i) => {
      const d = dayAt(i), k = iso(d);
      return {
        i, key: k, date: d, label: dayLabel(d), today: i === DAYS - 1,
        weekStart: i % 7 === 0,
        v: mine[k] != null ? mine[k] : v,
      };
    });
  }

  function scope(id) {
    const s = SCOPES.find((x) => x.id === id) || SCOPES[0];
    const me = (window.IS_DATA || {}).me || {};
    const label = s.label || (s.id === 'city' ? (me.location || 'Your city') : s.id === 'country' ? (me.country || 'Your country') : 'World');
    const series = s.mean.map((m, i) => {
      const n = s.n[i] || 0;
      return { i, mean: n > 0 ? m : null, n, placed: n >= THIN && m != null, thin: n > 0 && n < THIN };
    });
    return { id: s.id, label, short: s.short, series };
  }

  // consecutive answered days ending at the most recent answered day
  function streak() {
    const d = days();
    const live = d[DAYS - 1].v != null;
    let run = 0;
    for (let i = DAYS - 1 - (live ? 0 : 1); i >= 0; i--) { if (d[i].v == null) break; run++; }
    return { run, live, ticks: d.slice(DAYS - 14) };
  }

  const fmtN = (n) => n >= 1000000 ? (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
  const word = (v) => (STEPS.find((s) => s.v === v) || {}).label || '';

  const QDEF = { kicker: 'daily pulse', text: 'How is today going?' };

  window.PULSE = {
    DAYS, THIN, STEPS, SCOPES: SCOPES.map((s) => s.id),
    Q: QDEF,
    days, scope, streak, fmtN, word,
    bins: (id) => TODAY_BINS[id] || TODAY_BINS.world,
    mineToday: () => { const d = days(); return d[DAYS - 1].v; },
    answer(v) { const m = load(); m[iso(midnight())] = v; save(m); notify(); if (window.HAPTIC) window.HAPTIC.tick(); },
    clearToday() { const m = load(); delete m[iso(midnight())]; save(m); notify(); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    // ── onto the Map: the pulse is a branch of You with one leaf per day
    // answered. Radius stays the map's own encoding — typicality — so a day you
    // felt what everyone felt sits close in and an outlier sits at the edge.
    mapTree() {
      const d = days(), sc = scope('world');
      const nodes = d.filter((x) => x.v != null).map((x) => {
        const m = sc.series[x.i];
        return {
          id: 'pulse-' + x.key, parentId: 'pulse', pulse: true, daily: true, pidx: x.i,
          label: x.label + ' → ' + word(x.v), tag: 'Daily pulse', ans: word(x.v), prompt: QDEF.text,
          note: m.placed ? 'world ' + m.mean.toFixed(1) : 'no crowd figure',
          age: DAYS - 1 - x.i,
          typ: m.placed ? 1 - Math.min(1, Math.abs(x.v - m.mean) / 2) : 0.5,
          maj: m.placed ? Math.abs(x.v - m.mean) < 0.75 : true,
        };
      });
      return { cats: [{ id: 'pulse', label: 'Pulse', hue: 282, pulse: true }], nodes };
    },
  };
})();
