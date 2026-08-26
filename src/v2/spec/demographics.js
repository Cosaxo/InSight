// Ported from design/spec-modules/demographics.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// demographics.js — per-audience demographic profiles for the five tabs.
// Each audience mirrors the Daily-Question model: around = people near you,
// city = Oslo, groups = your circles, world = everyone, people = close ties.
// Values are plausible-but-synthetic; the user (Mira, 34, f) is marked where
// the audience contains peers so age bands can show a "you" pin.
(function () {
  const AGE_BANDS = ['<18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+'];

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
      thirdLabel: 'TIME ON INSIGHT',
      third: [
        { k: 'new · <3 mo', v: 31, hue: 24 },
        { k: 'regulars · 3 mo–2 yrs', v: 44, hue: 150 },
        { k: 'veterans · 2 yrs+', v: 25, hue: 38 },
      ],
      note: 'younger crowd — most joined in the last two years.',
    },
    city: {
      title: 'Who’s on InSight in Oslo',
      sub: 'the members around your city',
      count: '31k', countLabel: 'members in Oslo',
      medianAge: 31,
      youBand: 2,
      age: [1, 20, 33, 21, 13, 8, 4],
      gender: { f: 49, m: 47, nb: 4 },
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
      title: 'Who’s on InSight in Norway',
      sub: 'members across the country',
      count: '182k', countLabel: 'members in Norway',
      medianAge: 32,
      youBand: 2,
      age: [1, 18, 30, 21, 14, 10, 6],
      gender: { f: 48, m: 48, nb: 4 },
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
      title: 'Who’s on InSight worldwide',
      sub: 'every member, everywhere',
      count: '2.4M', countLabel: 'members worldwide',
      medianAge: 29,
      youBand: 2,
      age: [2, 24, 31, 19, 12, 8, 4],
      gender: { f: 47, m: 48, nb: 5 },
      thirdLabel: 'MEMBERS BY REGION',
      third: [
        { k: 'Europe', v: 44, hue: 235 },
        { k: 'Americas', v: 27, hue: 150 },
        { k: 'Asia', v: 21, hue: 38 },
        { k: 'Africa', v: 5, hue: 24 },
        { k: 'Oceania', v: 3, hue: 300 },
      ],
      note: 'most members are under 35, and nearly half are in Europe.',
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

