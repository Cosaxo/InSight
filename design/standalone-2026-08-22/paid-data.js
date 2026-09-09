// paid-data.js — sponsored questions. The house rule recorded before the first
// paid deal: the disclosure is the app's, never the buyer's. So a paid card
// carries no brand colour, no brand logo and no topic chip — it wears an ink
// band that says PAID, the buyer's name, and the window it was bought for.
// Everything a bought question can hide is stated on the card instead:
//   · WHO paid            → the band
//   · WHO it was asked of → the window label ("asked for Oslo · this week")
//   · WHY you got it      → the two facts that matched you
//   · WHAT they receive   → counts and cuts, never names
window.WF_PAID = (function () {
  const items = [
    {
      id: 'pd01', cat: 'culture', type: 'vote',
      prompt: 'Should Oslo’s night buses run all night at weekends?',
      options: [{ label: 'All night', count: 1840 }, { label: 'The hours are fine', count: 1120 }],
      paid: {
        buyer: 'Ruter',
        window: 'Oslo · this week',
        why: ['you live in Oslo', 'you follow Culture'],
        gets: 'the counts and the standard cuts — never names, never your profile',
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
        gets: 'the counts and the standard cuts — never names, never your profile',
      },
    },
  ];
  const day = () => Math.floor(Date.now() / 864e5);
  return {
    items,
    // one paid card at a time, rotating by day — a feed with two is a feed for sale
    today: () => items[day() % items.length],
    total: (q) => (q.options || []).reduce((a, o) => a + (o.count || 0), 0),
  };
})();
