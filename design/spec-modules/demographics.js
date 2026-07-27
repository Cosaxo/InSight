// demographics.js — per-audience demographic profiles for the five tabs.
// Each audience mirrors the Daily-Question model: around = people near you,
// city = Oslo, groups = your circles, world = everyone, people = close ties.
// Values are plausible-but-synthetic; the user (Mira, 34, f) is marked where
// the audience contains peers so age bands can show a "you" pin.
(function () {
  const AGE_BANDS = ['<18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
  const YOU_BAND = 3; // Mira is 34 → '35–44'? she's 34 → '25–34' is 2. Set to 2.

  // gender keys + labels (shared)
  const GENDER = [
    { k: 'f', label: 'women', hue: 24 },
    { k: 'm', label: 'men', hue: 235 },
    { k: 'nb', label: 'nonbinary', hue: 300 },
  ];

  const D = {
    around: {
      title: 'Who’s around you',
      sub: 'the people within a few kilometres',
      count: '340', countLabel: 'people nearby',
      medianAge: 33,
      youBand: 2,
      age: [0, 22, 38, 19, 11, 7, 3],
      gender: { f: 49, m: 47, nb: 4 },
      // a third dimension unique to this audience
      thirdLabel: 'TIME IN THE AREA',
      third: [
        { k: 'newcomers · <2 yrs', v: 31, hue: 24 },
        { k: 'settled · 2–10 yrs', v: 44, hue: 150 },
        { k: 'locals · 10 yrs+', v: 25, hue: 38 },
      ],
      note: 'younger crowd — most arrived in the last decade.',
    },
    city: {
      title: 'Who lives in Oslo',
      sub: 'the makeup of the city around you',
      count: '709k', countLabel: 'residents',
      medianAge: 37,
      youBand: 2,
      age: [19, 8, 21, 16, 12, 11, 13],
      gender: { f: 50, m: 48, nb: 2 },
      thirdLabel: 'MEMBERS BY BOROUGH',
      third: [
        { k: 'Grünerløkka', v: 24, hue: 150 },
        { k: 'Frogner', v: 15, hue: 235 },
        { k: 'Sagene', v: 14, hue: 38 },
        { k: 'Gamle Oslo', v: 13, hue: 24 },
        { k: 'elsewhere', v: 34, hue: 110 },
      ],
      note: 'where Oslo’s InSight members live — the inner east leads.',
    },
    groups: {
      title: 'Who’s in your circles',
      sub: 'everyone across the groups you’ve joined',
      count: '138', countLabel: 'members across 5 circles',
      medianAge: 39,
      youBand: 2,
      age: [0, 9, 28, 26, 18, 12, 7],
      gender: { f: 44, m: 50, nb: 6 },
      thirdLabel: 'BY INTEREST',
      third: [
        { k: 'Chess', v: 30, hue: 235 },
        { k: 'Philosophy', v: 22, hue: 300 },
        { k: 'Tennis', v: 20, hue: 38 },
        { k: 'Cold-water swimming', v: 17, hue: 150 },
        { k: 'Writing', v: 11, hue: 24 },
      ],
      note: 'your interests skew a little older and more male than the city — chess tips it.',
    },
    country: {
      title: 'Who lives in Norway',
      sub: 'the makeup of the whole country',
      count: '5.6M', countLabel: 'residents',
      medianAge: 40,
      youBand: 2,
      age: [20, 8, 17, 15, 13, 12, 15],
      gender: { f: 49.5, m: 49.5, nb: 1 },
      thirdLabel: 'BIGGEST CITIES',
      third: [
        { k: 'Oslo', v: 39, hue: 150 },
        { k: 'Bergen', v: 16, hue: 220 },
        { k: 'Trondheim', v: 12, hue: 145 },
        { k: 'Stavanger', v: 11, hue: 38 },
        { k: 'elsewhere', v: 22, hue: 110 },
      ],
      note: 'share of InSight members by city — Oslo leads, but most of Norway is elsewhere.',
    },
    world: {
      title: 'Who shares the planet',
      sub: 'all 8.2 billion, at a glance',
      count: '8.21B', countLabel: 'people alive',
      medianAge: 30,
      youBand: 2,
      age: [25, 13, 16, 13, 11, 9, 13],
      gender: { f: 49.6, m: 50, nb: 0.4 },
      thirdLabel: 'WHERE THEY LIVE',
      third: [
        { k: 'Asia', v: 59, hue: 38 },
        { k: 'Africa', v: 18, hue: 24 },
        { k: 'Americas', v: 13, hue: 150 },
        { k: 'Europe', v: 9, hue: 235 },
        { k: 'Oceania', v: 1, hue: 300 },
      ],
      note: 'half the world is under 30, and three in five people live in Asia.',
    },
    people: {
      title: 'Who your people are',
      sub: 'the makeup of your close ties',
      count: '24', countLabel: 'close ties',
      medianAge: 35,
      youBand: 2,
      age: [1, 2, 9, 6, 3, 2, 1],
      gender: { f: 58, m: 38, nb: 4 },
      thirdLabel: 'HOW YOU KNOW THEM',
      third: [
        { k: 'friends', v: 46, hue: 38 },
        { k: 'family', v: 25, hue: 24 },
        { k: 'colleagues', v: 17, hue: 235 },
        { k: 'collaborators', v: 12, hue: 150 },
      ],
      note: 'mostly women and longtime friends.',
    },
  };

  window.DEMOGRAPHICS = { AGE_BANDS, GENDER, byAudience: (id) => D[id], audiences: D };
})();
