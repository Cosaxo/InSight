// paid-data.js — sponsored questions + the paid plan's shared pricing. The house
// rule recorded before the first paid deal: the disclosure is the app's, never
// the buyer's. So a paid card carries no brand colour, no brand logo and no
// topic chip — it wears an ink band that says PAID, the buyer's name (optional,
// D228), and the window it was bought for. Everything a bought question can
// hide is stated on the card instead:
//   · WHO paid            → the band
//   · WHO it was asked of → the window label ("asked for Oslo · until 21 Sep")
//   · WHY you got it      → the facts that matched you
//   · WHAT they receive   → the same public numbers you do — no private cut
window.WF_PAID = (function () {
  const GETS = 'the same public numbers you do — the split, every cut, the named who-voted roll. There is no private cut';
  const items = [
    {
      id: 'pd01', cat: 'culture', type: 'vote',
      prompt: 'Should Oslo’s night buses run all night at weekends?',
      options: [{ label: 'All night', count: 1840 }, { label: 'The hours are fine', count: 1120 }],
      paid: {
        buyer: 'Ruter',
        window: 'Oslo · until 21 Sep',
        why: ['you live in Oslo', 'you follow Culture'],
        gets: GETS,
        closed: false,
        budget: { cap: 4000, capEur: 640 },
        days: { left: 29, total: 69 },
        reports: [
          { label: 'July report', ready: true },
          { label: 'August report', note: 'builds 1 Sep' },
          { label: 'Final report', note: 'at close · 21 Sep' },
        ],
      },
    },
    {
      id: 'pd02', cat: 'tech', type: 'vote',
      prompt: 'Let your power company shift your heating by an hour to cut the evening peak?',
      options: [{ label: 'Shift it', count: 2260 }, { label: 'Leave it alone', count: 1480 }],
      paid: {
        buyer: 'Elvia',
        window: 'Norway · 14–21 Aug',
        why: ['you live in Norway', 'you follow Tech'],
        gets: GETS,
        closed: true,
        budget: { cap: 4000, capEur: 640 },
        days: { left: 0, total: 8 },
        reports: [{ label: 'Final report', ready: true }],
      },
    },
  ];
  const day = () => Math.floor(Date.now() / 864e5);

  // ── pricing (PAID-PLAN §6). Base rates in EUR; the buyer picks the currency
  // they read prices in — one preference, persisted, read everywhere a price
  // prints. Figures illustrative; the real card is computed by script and
  // committed to the repo (a price a buyer can't see can discriminate).
  const PRICE = { city: 190, country: 940, world: 6400, perAnswer: 0.16, capEur: 320 };
  const CURS = {
    EUR: { sym: '€', rate: 1, pre: true },
    NOK: { sym: 'kr', rate: 11.6, pre: false },
    USD: { sym: '$', rate: 1.08, pre: true },
  };
  const CUR_KEY = 'is_currency';
  const cur = () => { try { const c = localStorage.getItem(CUR_KEY); return CURS[c] ? c : 'EUR'; } catch (e) { return 'EUR'; } };
  const setCur = (c) => { if (!CURS[c]) return; try { localStorage.setItem(CUR_KEY, c); } catch (e) {} window.dispatchEvent(new Event('is-currency')); };
  // convert + round to a rate-card-shaped figure (never false precision)
  const fmt = (eur) => {
    const c = CURS[cur()];
    let v = eur * c.rate;
    if (v >= 1000) v = Math.round(v / 100) * 100;
    else if (v >= 100) v = Math.round(v / 10) * 10;
    else if (v >= 1) v = Math.round(v);
    else v = Math.round(v * 100) / 100;
    const s = v >= 1 ? v.toLocaleString('en-US').replace(/,/g, ' ') : v.toFixed(2);
    return c.pre ? c.sym + s : s + ' ' + c.sym;
  };

  // ── the cohort market (PAID-PLAN F). One posted per-answer line per cohort,
  // moved daily by the demand index (sold ÷ available person-days), floored and
  // ceilinged, locked at booking. Reach figures illustrative (law 11).
  const MARKET = (function () {
    const base = 0.16, floorX = 0.9, ceilX = 2.5, floorWeek = 500;
    const reach = { city: 1200, country: 6100, world: 40000 }; // expected answers / day
    const dimFactor = { age: 0.34, topic: 0.33 };
    const booked = { city: 0.31, country: 0.52, world: 0.81 }; // sold ÷ available person-days
    const idx = { city: 1.1, country: 1.7, world: 2.5 };       // published today, from booked
    const rate = (scope) => base * (idx[scope] || 1);
    const expected = (scope, dims) => Math.round((reach[scope] || reach.world) * (dims && dims.age ? dimFactor.age : 1) * (dims && dims.topic ? dimFactor.topic : 1));
    const clearsFloor = (perDay) => perDay * 7 >= floorWeek;
    return { base, floorX, ceilX, floorWeek, reach, dimFactor, booked, idx, rate, expected, clearsFloor };
  })();

  return {
    items,
    // one paid card at a time, rotating by day — a feed with two is a feed for sale
    today: () => items[day() % items.length],
    total: (q) => (q.options || []).reduce((a, o) => a + (o.count || 0), 0),
    PRICE, CURS, cur, setCur, fmt, MARKET,
  };
})();
