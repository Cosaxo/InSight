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
      id: 'pd01', cat: 'culture', type: 'vote', scope: 'city', place: 'Oslo',
      prompt: 'Should Oslo’s night buses run all night at weekends?',
      options: [{ label: 'All night', count: 1840 }, { label: 'The hours are fine', count: 1120 }],
      paid: {
        buyer: 'Ruter',
        window: 'Oslo · until 21 Sep',
        why: ['you live in Oslo', 'you follow Culture'],
        gets: GETS,
        closed: false,
        atClose: 'extend', rate: 0.16, lockedIdx: '×1.0',
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
      id: 'pd02', cat: 'tech', type: 'vote', scope: 'country', place: 'Norway',
      prompt: 'Let your power company shift your heating by an hour to cut the evening peak?',
      options: [{ label: 'Shift it', count: 2260 }, { label: 'Leave it alone', count: 1480 }],
      paid: {
        buyer: 'Elvia',
        window: 'Norway · 14–21 Aug',
        why: ['you live in Norway', 'you follow Tech'],
        gets: GETS,
        closed: true,
        atClose: 'settle', rate: 0.16, lockedIdx: '×1.0',
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
    const idx = { city: 1.1, country: 1.7, world: 2.5, age: 0.9, topic: 0.9 }; // published today, from booked
    // price law: an intersection consumes inventory in every parent pool, so it
    // prices at the MAX of its parents' indices — a thin cell is never a discount.
    const rate = (scope) => base * (Array.isArray(scope)
      ? Math.max.apply(null, scope.map((s) => idx[s] || 1))
      : (idx[scope] || 1));
    const expected = (scope, dims) => Math.round((reach[scope] || reach.world) * (dims && dims.age ? dimFactor.age : 1) * (dims && dims.topic ? dimFactor.topic : 1));
    const clearsFloor = (perDay) => perDay * 7 >= floorWeek;
    const minTicket = (scope) => Math.round(floorWeek * rate(scope)); // honest entry price: the floor × the line
    const shareCap = 0.3; // no buyer holds more than 30% of a cohort's person-days in a window
    // under the floor the composer counter-offers the nearest sellable superset
    // (widen an age band, add a neighbour city) — a refusal converted into a booking
    return { base, floorX, ceilX, floorWeek, reach, dimFactor, booked, idx, rate, expected, clearsFloor, minTicket, shareCap };
  })();

  // ── subscriptions (PAID-PLAN §5, repriced): a forward contract on the same
  // market — a panel of answers each period × the posted line, −20% for the
  // standing commitment; the city/country/world tiers (PRICE) survive as panel
  // presets. Results are public, so a metric's period cost SPLITS evenly across
  // its subscribers, recomputed each period with a €24 seat floor — the second
  // subscriber halves the bill instead of buying it twice. Inactive metrics
  // take pledges and go live the day pledges cover a period. A lapse drops one
  // seat; the series keeps its history either way (law 08).
  const SUB = (function () {
    const discount = 0.2, seatFloor = 24;
    const panel = { city: 1350, country: 4300, world: 20000 }; // answers / period
    const perPeriod = (scope) => Math.round(panel[scope] * MARKET.rate(scope) * (1 - discount) / 10) * 10;
    const seat = (scope, subs) => Math.max(seatFloor, Math.round(perPeriod(scope) / Math.max(1, subs)));
    return { discount, seatFloor, panel, perPeriod, seat };
  })();

  // ── the metric catalog (PAID-PLAN §5 + E): authored ahead, kept neutral by
  // editorial; active = funded seats, pledged = pledges toward a first period.
  const CATALOG = [
    { id: 'mt1', q: 'Do buses come when the app says they will?', scope: 'city', place: 'Oslo', state: 'active', seats: 3, score: '4.0' },
    { id: 'mt2', q: 'How safe does the city feel after dark?', scope: 'city', place: 'Oslo', state: 'active', seats: 2, score: '3.6' },
    { id: 'mt3', q: 'How well is snow cleared on your street?', scope: 'city', place: 'Oslo', state: 'pledged', pledgedEur: 130 },
    { id: 'mt4', q: 'Are rents here fair for what you get?', scope: 'city', place: 'Oslo', state: 'inactive' },
    { id: 'mt5', q: 'Is it easy to see a doctor when you need one?', scope: 'country', place: 'Norway', state: 'inactive' },
    { id: 'mt6', q: 'Would you recommend living here?', scope: 'city', place: 'Bergen', state: 'active', seats: 1, score: '4.4' },
    { id: 'mt7', q: 'Do you trust what you read in the news?', scope: 'world', place: 'the world', state: 'inactive' },
  ];

  return {
    items,
    // one paid card at a time, rotating by day — a feed with two is a feed for sale
    today: () => items[day() % items.length],
    total: (q) => (q.options || []).reduce((a, o) => a + (o.count || 0), 0),
    PRICE, CURS, cur, setCur, fmt, MARKET, SUB, CATALOG,
  };
})();
