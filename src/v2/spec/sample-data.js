// Ported from design/spec-modules/sample-data.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// Sample data for InSight prototype — richer than repo defaults
export const IS_DATA = {
  me: {
    name: "Mira Halvorsen",
    initials: "MH",
    location: "Oslo",
    country: "Norway",
    job: "Editor · independent press",
    education: "MA Literature · Univ. of Oslo",
    personality: { O: 78, C: 62, E: 41, A: 69, N: 28 }, // Big Five
    political: { econ: -22, social: -18, foreign: -18, env: 46, tech: 12, auth: -32, estab: 12 }, // -100..100 each (social positions you against the ideology landmarks)
    politicalIdentity: { name: 'Green-Left Internationalist', tag: 'libertarian green, cooperative abroad' },
    values: { indiv: -14, change: 28 },
    morals: {
      future: 8,       // -100 pessimist .. +100 optimist
      circle: -8,      // close (family-first) .. wide (strangers count)
      hedonism: -10,   // duty .. pleasure
      meaning: 36,     // happiness only .. suffering has meaning
      moral: 10,       // relativist .. objectivist
      beauty: 28,      // truth-only .. beauty matters
    },
    moralLabel: "tempered optimist",
    likes: ["slow mornings", "Murakami", "fermented tea", "open water swimming", "Nordic noir", "letterpress"],
    dislikes: ["small talk", "rushed coffee", "fluorescent light"],
    myInterests: [
      { t: "tennis", c: "sports" }, { t: "cold-water swim", c: "outdoor" },
      { t: "Murakami", c: "literary" }, { t: "Solnit", c: "literary" },
      { t: "letterpress", c: "art" }, { t: "fermentation", c: "food" },
      { t: "philosophy", c: "thought" }, { t: "chess", c: "games" },
      { t: "Nick Drake", c: "music" }, { t: "trail running", c: "fitness" },
    ],
    languages: [
      { name: "Norwegian", level: "native", pct: 100 },
      { name: "English", level: "fluent", pct: 92 },
      { name: "French", level: "conversational", pct: 58 },
      { name: "Japanese", level: "beginner", pct: 18 },
    ],
    stats: {
      birthYear: 1991, age: 34,
      height: "171 cm", weight: "63 kg",
      handed: "right", eyeColor: "grey-green",
      sleep: "7h 24m avg", chronotype: "early bird",
      sign: "Cancer ☾", mbti: "INFP",
    },
    timeline: [
      { year: 1991, t: "born · Stavanger" },
      { year: 2009, t: "first journal kept whole year" },
      { year: 2013, t: "Oslo, for the studies" },
      { year: 2018, t: "first cold-water dip" },
      { year: 2022, t: "moved to Grünerløkka" },
      { year: 2024, t: "took writing seriously" },
    ],
    badges: ["365-day journal", "100 cold dips", "10k pages read", "first chess W"],
    heroes: [
      { name: "Tove Jansson", field: "Author · the Moomins", hue: 38 },
      { name: "Hayao Miyazaki", field: "Filmmaker · Studio Ghibli", hue: 150 },
      { name: "Rebecca Solnit", field: "Essayist · walking, place", hue: 220 },
    ],
    media: { books: 47, films: 112, songs: 2840 },
  },

  // Around — aggregate profile of nearby strangers within 5km
  // (added to aggregates to feed ProfileCompare)

  nearby: [
    { id: "p1", name: "Sigrid Bø", init: "SB", age: 29, dist: "a few streets away", match: 88, hue: 38, role: "ceramicist", interests: [{t:"pottery",c:"art"},{t:"fermentation",c:"food"},{t:"Murakami",c:"literary"},{t:"yoga",c:"fitness"}], values: "change · collective", note: "Reads the same authors. Walks at dusk." },
    { id: "p2", name: "Anders Lie", init: "AL", age: 34, dist: "a few streets away", match: 81, hue: 145, role: "violinist", interests: [{t:"chamber music",c:"music"},{t:"long runs",c:"fitness"},{t:"espresso",c:"food"},{t:"chess",c:"games"}], values: "tradition · individual", note: "Plays at Sentralen Thursdays." },
    { id: "p3", name: "Eira Nordli", init: "EN", age: 27, dist: "in the neighbourhood", match: 76, hue: 220, role: "marine biologist", interests: [{t:"fjord swims",c:"outdoor"},{t:"field notes",c:"literary"},{t:"Solnit",c:"literary"},{t:"climbing",c:"fitness"}], values: "change · collective", note: "Cold-water swim group, Sundays 7am." },
    { id: "p4", name: "Tobias Krag", init: "TK", age: 31, dist: "in the neighbourhood", match: 64, hue: 12, role: "bookbinder", interests: [{t:"letterpress",c:"art"},{t:"Tove Jansson",c:"literary"},{t:"rye bread",c:"food"},{t:"go",c:"games"}], values: "tradition · collective", note: "Workshop above Cafilosofen." },
    { id: "p5", name: "Mai Solberg", init: "MS", age: 26, dist: "a short ride away", match: 59, hue: 280, role: "data journalist", interests: [{t:"data viz",c:"tech"},{t:"kayaking",c:"outdoor"},{t:"matcha",c:"food"},{t:"tennis",c:"sports"}], values: "change · individual", note: "Often at Tim Wendelboe." },
    { id: "p6", name: "Jonas Ek", init: "JE", age: 38, dist: "a short ride away", match: 52, hue: 60, role: "carpenter", interests: [{t:"woodworking",c:"art"},{t:"trail running",c:"fitness"},{t:"Cohen",c:"music"},{t:"football",c:"sports"}], values: "tradition · individual", note: "Built half the cabins on Nesodden." },
    // The `near` field pop sizes each node by its distance band, so the band
    // mix is the thing under test — six nodes could not crowd one band.
    // `dist` must be one of the three band labels or the node falls back to
    // the largest size and the privacy banding reads as noise.
    { id: "p7", name: "Nina Fossum", init: "NF", age: 33, dist: "a few streets away", match: 83, hue: 165, role: "sound engineer", interests: [{t:"field recording",c:"music"},{t:"night walks",c:"outdoor"},{t:"Solnit",c:"literary"}], values: "change · collective", note: "Records the river at five in the morning." },
    { id: "p8", name: "Dmitri Sarkis", init: "DS", age: 41, dist: "in the neighbourhood", match: 47, hue: 8, role: "baker", interests: [{t:"rye",c:"food"},{t:"early shifts",c:"fitness"},{t:"backgammon",c:"games"}], values: "tradition · collective", note: "Opens before the first tram." },
    { id: "p9", name: "Hanne Lund", init: "HL", age: 24, dist: "a short ride away", match: 68, hue: 250, role: "medical student", interests: [{t:"climbing",c:"fitness"},{t:"anatomy sketches",c:"art"},{t:"techno",c:"music"}], values: "change · individual", note: "Studies on the tram, both directions." },
    { id: "p10", name: "Ola Fjeld", init: "OF", age: 52, dist: "in the neighbourhood", match: 41, hue: 100, role: "tram driver", interests: [{t:"allotment",c:"food"},{t:"football",c:"sports"},{t:"local history",c:"thought"}], values: "tradition · collective", note: "Knows which stops the light hits." },
    { id: "p11", name: "Sara Wold", init: "SW", age: 30, dist: "a few streets away", match: 74, hue: 320, role: "translator", interests: [{t:"Japanese",c:"literary"},{t:"tea",c:"food"},{t:"cycling",c:"fitness"}], values: "change · collective", note: "Working through Murakami's short ones." },
    { id: "p12", name: "Idris Yusuf", init: "IY", age: 36, dist: "a short ride away", match: 56, hue: 190, role: "physiotherapist", interests: [{t:"basketball",c:"sports"},{t:"anatomy",c:"thought"},{t:"grilling",c:"food"}], values: "tradition · individual", note: "Coaches the Saturday junior team." },
    { id: "p13", name: "Frida Nes", init: "FN", age: 28, dist: "in the neighbourhood", match: 79, hue: 55, role: "illustrator", interests: [{t:"riso print",c:"art"},{t:"Tove Jansson",c:"literary"},{t:"sauna",c:"outdoor"}], values: "change · collective", note: "Draws in the park until it's too dark." },
    { id: "p14", name: "Petter Aas", init: "PA", age: 45, dist: "a few streets away", match: 62, hue: 275, role: "civil servant", interests: [{t:"chess",c:"games"},{t:"birding",c:"outdoor"},{t:"choir",c:"music"}], values: "tradition · collective", note: "Sings Thursdays, birds Saturdays." },
  ],

  city: {
    name: "Oslo",
    pop: "709k",
    yourMatch: 71,
    score: { culture: 4, nature: 5, food: 3, pace: 4, openness: 4, cost: 2 },
    notes: "Long winters reward inwardness. The fjord is the city's living room.",
    lived: "3 yr",
    visited: ["Bergen", "Tromsø", "Lofoten", "Trondheim"],
  },

  // categories used to score every city (0..100)
  cityScoreCats: [
    { id: 'commute',   label: 'commute',   glyph: '◐', tip: 'how easily you move' },
    { id: 'safety',    label: 'safety',    glyph: '✚', tip: 'walking home at night' },
    { id: 'beauty',    label: 'beauty',    glyph: '❀', tip: 'streets that lift you' },
    { id: 'food',      label: 'food',      glyph: '◇', tip: 'a great meal under €20' },
    { id: 'nature',    label: 'nature',    glyph: '△', tip: 'green within 15 min' },
    { id: 'nightlife', label: 'nightlife', glyph: '◑', tip: 'after midnight' },
    { id: 'climate',   label: 'climate',   glyph: '☾', tip: "days you'd be outside" },
    { id: 'cost',      label: 'cost',      glyph: '$',  tip: 'higher = more affordable' },
  ],

  cities: [
    { name: "Lisbon",      country: "PT", region: "Europe",   pop: "545k", match: 84, hue: 38,  mood: "warm · slow · tiled",
      scores: { commute: 62, safety: 78, beauty: 92, food: 86, nature: 64, nightlife: 80, climate: 88, cost: 64 },
      blurb: 'azulejo light, hilly mornings, fado drifting through Alfama' },
    { name: "Porto",       country: "PT", region: "Europe",   pop: "237k", match: 78, hue: 28,  mood: "river · stone · port",
      scores: { commute: 60, safety: 80, beauty: 88, food: 84, nature: 70, nightlife: 70, climate: 80, cost: 72 },
      blurb: 'granite churches, port at sunset, the Douro doing the work' },
    { name: "Kyoto",       country: "JP", region: "Asia",     pop: "1.46M", match: 81, hue: 145, mood: "ritual · seasonal · still",
      scores: { commute: 78, safety: 96, beauty: 94, food: 88, nature: 78, nightlife: 50, climate: 70, cost: 50 },
      blurb: 'cedar temples, river herons, rituals you can set a clock by' },
    { name: "Tokyo",       country: "JP", region: "Asia",     pop: "13.96M", match: 70, hue: 155, mood: "dense · neon · polite",
      scores: { commute: 94, safety: 96, beauty: 72, food: 96, nature: 38, nightlife: 92, climate: 64, cost: 40 },
      blurb: 'trains on time, alleys for the listening, neon as weather' },
    { name: "Copenhagen",  country: "DK", region: "Europe",   pop: "660k", match: 79, hue: 220, mood: "design · cycling · candle",
      scores: { commute: 92, safety: 90, beauty: 80, food: 80, nature: 70, nightlife: 70, climate: 50, cost: 30 },
      blurb: 'cycle lanes, candle-light, calm Saturdays' },
    { name: "Edinburgh",   country: "UK", region: "Europe",   pop: "525k", match: 74, hue: 280, mood: "stone · literary · windswept",
      scores: { commute: 70, safety: 80, beauty: 86, food: 70, nature: 78, nightlife: 68, climate: 40, cost: 52 },
      blurb: 'closes and crags, bookshops, weather as moral force' },
    { name: "Glasgow",     country: "UK", region: "Europe",   pop: "635k", match: 66, hue: 270, mood: "warm · loud · post-industrial",
      scores: { commute: 70, safety: 60, beauty: 64, food: 68, nature: 60, nightlife: 80, climate: 38, cost: 60 },
      blurb: 'red sandstone, rave Fridays, the kindest strangers' },
    { name: "Mexico City", country: "MX", region: "Americas", pop: "9.21M", match: 62, hue: 12,  mood: "loud · layered · alive",
      scores: { commute: 50, safety: 48, beauty: 78, food: 96, nature: 40, nightlife: 92, climate: 80, cost: 70 },
      blurb: 'taco light, jacaranda streets, museums by the dozen' },
    { name: "Oaxaca",      country: "MX", region: "Americas", pop: "270k",  match: 71, hue: 24,  mood: "mole · fiesta · highland",
      scores: { commute: 50, safety: 64, beauty: 88, food: 96, nature: 76, nightlife: 70, climate: 78, cost: 78 },
      blurb: 'seven moles, brass bands at dawn, weaving on the patio' },
    { name: "Reykjavík",   country: "IS", region: "Europe",   pop: "139k",  match: 76, hue: 200, mood: "moss · geothermal · sparse",
      scores: { commute: 64, safety: 96, beauty: 84, food: 64, nature: 96, nightlife: 60, climate: 36, cost: 22 },
      blurb: 'lava fields, hot pools, sentences that take their time' },
    { name: "Berlin",      country: "DE", region: "Europe",   pop: "3.85M", match: 73, hue: 240, mood: "permissive · raw · cheap",
      scores: { commute: 86, safety: 72, beauty: 64, food: 78, nature: 64, nightlife: 96, climate: 52, cost: 64 },
      blurb: 'lake summers, all-night Saturdays, the freedom of the unfinished' },
    { name: "Helsinki",    country: "FI", region: "Europe",   pop: "658k",  match: 80, hue: 210, mood: "sauna · taciturn · forest",
      scores: { commute: 84, safety: 92, beauty: 70, food: 70, nature: 86, nightlife: 56, climate: 44, cost: 36 },
      blurb: 'sauna, silence, a forest at the tram stop' },
    { name: "Montréal",    country: "CA", region: "Americas", pop: "1.78M", match: 69, hue: 250, mood: "bilingual · brick · brisk",
      scores: { commute: 76, safety: 78, beauty: 70, food: 82, nature: 60, nightlife: 80, climate: 46, cost: 54 },
      blurb: 'plateau brick, bagels at three, two languages on every block' },
    { name: "Buenos Aires",country: "AR", region: "Americas", pop: "3.07M", match: 60, hue: 50,  mood: "tango · café · late",
      scores: { commute: 60, safety: 50, beauty: 78, food: 86, nature: 38, nightlife: 92, climate: 70, cost: 78 },
      blurb: 'belle-époque facades, milongas at midnight, asado smoke' },
    { name: "Tbilisi",     country: "GE", region: "Asia",     pop: "1.18M", match: 64, hue: 28,  mood: "khachapuri · sulfur · hill",
      scores: { commute: 50, safety: 70, beauty: 74, food: 84, nature: 72, nightlife: 84, climate: 64, cost: 80 },
      blurb: 'wooden balconies, sulphur baths, supra tables that keep going' },
    { name: "Marrakech",   country: "MA", region: "Africa",   pop: "928k",  match: 58, hue: 18,  mood: "ochre · spice · medina",
      scores: { commute: 44, safety: 60, beauty: 84, food: 78, nature: 50, nightlife: 50, climate: 76, cost: 70 },
      blurb: 'ochre walls, riad courtyards, evening call from every roof' },
    { name: "Cape Town",   country: "ZA", region: "Africa",   pop: "4.62M", match: 65, hue: 195, mood: "table · vine · ocean",
      scores: { commute: 40, safety: 38, beauty: 96, food: 80, nature: 92, nightlife: 70, climate: 78, cost: 60 },
      blurb: 'mountain at your back, vines, swims that wake you up' },
    { name: "Wellington",  country: "NZ", region: "Oceania",  pop: "215k",  match: 72, hue: 165, mood: "windy · indie · green",
      scores: { commute: 66, safety: 84, beauty: 78, food: 76, nature: 90, nightlife: 64, climate: 56, cost: 38 },
      blurb: 'cable cars, indie cafés, weather that has opinions' },
  ],

  cityCountries: [
    { code: "ALL", name: "everywhere", flag: "◯" },
    { code: "PT",  name: "Portugal",   flag: "PT" },
    { code: "JP",  name: "Japan",      flag: "JP" },
    { code: "DK",  name: "Denmark",    flag: "DK" },
    { code: "UK",  name: "U.K.",       flag: "UK" },
    { code: "MX",  name: "Mexico",     flag: "MX" },
    { code: "IS",  name: "Iceland",    flag: "IS" },
    { code: "DE",  name: "Germany",    flag: "DE" },
    { code: "FI",  name: "Finland",    flag: "FI" },
    { code: "CA",  name: "Canada",     flag: "CA" },
    { code: "AR",  name: "Argentina",  flag: "AR" },
    { code: "GE",  name: "Georgia",    flag: "GE" },
    { code: "MA",  name: "Morocco",    flag: "MA" },
    { code: "ZA",  name: "S. Africa",  flag: "ZA" },
    { code: "NZ",  name: "N. Zealand", flag: "NZ" },
  ],

  cityRegions: ["all", "Europe", "Asia", "Americas", "Africa", "Oceania"],

  // Hyper-local conditions — your 5km
  around: {
    place: "Grünerløkka, Oslo",
    temp: 11, tempUnit: "°C", feels: 9,
    weather: "low cloud, breaking", icon: "sun-cloud",
    high: 14, low: 6,
    aqi: 22, aqiLabel: "good",
    uv: 3, uvLabel: "moderate",
    humidity: 64, wind: 8, windDir: "WNW",
    pressure: 1014, pollen: "low · birch trace",
    sunrise: "04:42", sunset: "21:38",
    daylight: "16h 56m",
    moon: "waxing gibbous · 78%",
    nearby: { cafés: 18, parks: 4, libraries: 2, kiosks: 6 },
    crowdedness: 32, // % of typical
  },

  // Today, on Earth
  earth: {
    date: "May 7, 2026",
    population: "8.21B", popDelta: "+221k since yesterday",
    co2: 426.4, co2Delta: "+2.1 ppm yoy",
    temp: 1.49, tempLabel: "°C above pre-industrial",
    species: { extinctToday: 38, namedToday: 6 },
    quakes: 24, quakesMag: 5.4,
    sun: "K-index 3 · quiet",
    holiday: "World Athletics Day",
    moon: "waxing gibbous",
    seasonNorth: "spring", seasonSouth: "autumn",
    arcticIce: 12.4, arcticDelta: "−1.8M km² vs 1981–2010",
  },

  // Interest categories — taxonomy for groups
  interestCats: [
    { id: "sports",    label: "Sports",     hue: 12,  glyph: "◉" },
    { id: "outdoor",   label: "Outdoor",    hue: 145, glyph: "△" },
    { id: "fitness",   label: "Fitness",    hue: 25,  glyph: "↗" },
    { id: "literary",  label: "Literary",   hue: 38,  glyph: "✎" },
    { id: "thought",   label: "Thought",    hue: 250, glyph: "○" },
    { id: "music",     label: "Music",      hue: 305, glyph: "♪" },
    { id: "art",       label: "Art & craft",hue: 80,  glyph: "✦" },
    { id: "games",     label: "Games",      hue: 200, glyph: "♟" },
    { id: "tech",      label: "Tech",       hue: 260, glyph: "◇" },
    { id: "food",      label: "Food",       hue: 30,  glyph: "◐" },
    { id: "civic",     label: "Civic",      hue: 220, glyph: "✚" },
    { id: "faith",     label: "Faith",      hue: 285, glyph: "✟" },
  ],

  // Named ideologies — placed on the 2D econ × social compass for landmarks
  // econ: -100 (state) .. +100 (market) ; social: -100 (liberty) .. +100 (authority)
  ideologies: [
    { id: 'soc-dem',     name: 'Social Democrat',         econ: -34, social: -10 },
    { id: 'green-left',  name: 'Green-Left',              econ: -50, social: -45 },
    { id: 'liberal',     name: 'Liberal',                 econ:  10, social: -34 },
    { id: 'libertarian', name: 'Libertarian',             econ:  72, social: -68 },
    { id: 'conservat',   name: 'Conservative',            econ:  40, social:  46 },
    { id: 'communit',    name: 'Communitarian',           econ: -28, social:  44 },
    { id: 'anarcho',     name: 'Anarchist',               econ: -78, social: -78 },
    { id: 'tech-prog',   name: 'Technoprogressive',       econ:  18, social: -22 },
  ],

  // Skill categories
  skillCats: [
    { id: "sport",    label: "Sport",     hue: 12,  glyph: "◉" },
    { id: "outdoor",  label: "Outdoor",   hue: 145, glyph: "△" },
    { id: "craft",    label: "Craft",     hue: 38,  glyph: "✎" },
    { id: "mind",     label: "Mind",      hue: 80,  glyph: "◇" },
    { id: "language", label: "Language",  hue: 220, glyph: "ℒ" },
    { id: "music",    label: "Music",     hue: 305, glyph: "♪" },
    { id: "kitchen",  label: "Kitchen",   hue: 60,  glyph: "◐" },
    { id: "tech",     label: "Tech",      hue: 250, glyph: "▢" },
    { id: "money",    label: "Money",     hue: 165, glyph: "❖" },
  ],

  // Base skill types — the underlying faculties a pursuit draws on.
  // A skill can belong to several. Used to show what kinds of skills you gravitate to.
  baseCats: [
    { id: "logic",      label: "Logic",      hue: 80,  glyph: "◇" },
    { id: "creative",   label: "Creative",   hue: 305, glyph: "✷" },
    { id: "physical",   label: "Physical",   hue: 12,  glyph: "◉" },
    { id: "technical",  label: "Technical",  hue: 250, glyph: "▢" },
    { id: "linguistic", label: "Linguistic", hue: 220, glyph: "ℋ" },
    { id: "strategic",  label: "Strategic",  hue: 35,  glyph: "◆" },
    { id: "social",     label: "Social",     hue: 340, glyph: "❀" },
    { id: "sensory",    label: "Sensory",    hue: 160, glyph: "❖" },
  ],

  skills: [
    // practiced
    { id: "tennis", name: "Tennis", cat: "sport", level: 84, hours: 312, lastPracticed: "Sat 9am", joined: true,
      vibe: "doubles · clay · still working on the slice",
      base: ["physical", "strategic"],
      metric: { value: "6.4", unit: "UTR", label: "match rating", note: "4.0 NTRP · solid club player" },
      growth12w: [62,64,66,68,70,72,74,76,78,80,82,84],
      sessions30: [1,0,1,1,0,0,1,0,1,0,0,1,1,0,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,1],
      milestones: ["First match win · '23", "First league match · '24", "Beat coach 6-3 · Apr '26"] },
    { id: "swim", name: "Cold-water swimming", cat: "outdoor", level: 88, hours: 47, lastPracticed: "Sun 7am", joined: true,
      vibe: "fjord, six minutes, no excuses",
      base: ["physical", "sensory"],
      metric: { value: "12", unit: "min", label: "longest immersion", note: "at 4°C · all winter, no wetsuit" },
      growth12w: [70,72,74,76,78,80,82,84,85,86,87,88],
      sessions30: [0,1,0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,1,1,0,1,0,0,1,1,0,1,1,1],
      milestones: ["First plunge · Jan '25", "12 min · Apr '26", "All winter, no break"] },
    { id: "writing", name: "Writing", cat: "craft", level: 82, hours: 1240, lastPracticed: "Tue", joined: true,
      vibe: "morning pages, occasional essays, the slow novel",
      base: ["creative", "linguistic"],
      metric: { value: "1,240", unit: "wd/day", label: "daily output", note: "3 essays published · novel at 20k" },
      growth12w: [72,74,75,77,78,79,80,80,81,81,82,82],
      sessions30: [1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1],
      milestones: ["First essay published · '22", "20k words on the novel · '25", "Editor liked p.7"] },
    { id: "philos", name: "Philosophy", cat: "mind", level: 68, hours: 480, lastPracticed: "Wed", joined: true,
      vibe: "Stoics in the morning, Sartre after wine",
      base: ["logic", "linguistic"],
      metric: { value: "24", unit: "texts", label: "primary works read", note: "+ a standing reading group" },
      growth12w: [60,61,62,63,64,64,65,65,66,67,67,68],
      sessions30: [0,1,0,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0],
      milestones: ["Read all of Aurelius · '24", "Started a reading group", "Plato in original (slow) · '26"] },
    { id: "chess", name: "Chess", cat: "mind", level: 71, hours: 220, lastPracticed: "Mon", joined: true,
      vibe: "blitz Mondays, classical Thursdays, 1620 ELO",
      base: ["logic", "strategic"],
      metric: { value: "1,620", unit: "ELO", label: "blitz rating", note: "top 12% online · peak 1,685" },
      growth12w: [55,57,60,62,63,64,65,66,68,69,70,71],
      sessions30: [1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1],
      milestones: ["Reached 1500 ELO · '24", "First tournament · '25", "Beat M (FM) · '26"] },
    { id: "norwegian", name: "Norwegian", cat: "language", level: 62, hours: 380, lastPracticed: "daily", joined: true,
      vibe: "B1 → B2, dialects still tricky",
      base: ["linguistic", "social"],
      metric: { value: "B2", unit: "CEFR", label: "proficiency", note: "upper-intermediate · dialects still tricky" },
      growth12w: [55,56,57,58,58,59,60,60,61,61,62,62],
      sessions30: [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1],
      milestones: ["A2 cert · '24", "First long convo · '25", "Read a novel · '26"] },
    { id: "piano", name: "Piano", cat: "music", level: 58, hours: 410, lastPracticed: "Thu", joined: true,
      vibe: "Chopin Nocturne 9, Bach 2-part inventions",
      base: ["creative", "sensory"],
      metric: { value: "Gr 6", unit: "ABRSM", label: "repertoire grade", note: "Chopin Nocturne 9 · Bach inventions" },
      growth12w: [50,51,52,53,54,55,55,56,57,57,58,58],
      sessions30: [0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],
      milestones: ["First scale all keys · '23", "Played at house party · '25", "Recorded one piece · '26"] },
    { id: "sourdough", name: "Sourdough", cat: "kitchen", level: 76, hours: 90, lastPracticed: "Sat", joined: true,
      vibe: "70% rye, 78% hydration, the long cold rise",
      base: ["sensory", "technical"],
      metric: { value: "78%", unit: "hydration", label: "best bake", note: "open crumb · 70% rye · long cold rise" },
      growth12w: [65,67,69,71,72,73,74,75,75,76,76,76],
      sessions30: [0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,1],
      milestones: ["First loaf rose · '24", "Open crumb · '25", "Friends ask for it"] },

    // skills to develop
    { id: "running", name: "Running", cat: "sport", level: 54, hours: 180, lastPracticed: "—", joined: false,
      vibe: "5k under 24, half-marathon someday",
      base: ["physical"],
      metric: { value: "23:40", unit: "5k", label: "personal best", note: "pace 4:44/km · half someday" },
      growth12w: [42,44,45,46,48,49,50,51,52,53,54,54], sessions30: [],
      milestones: [] },
    { id: "yoga", name: "Yoga", cat: "outdoor", level: 32, hours: 28, lastPracticed: "—", joined: false,
      vibe: "vinyasa, breathwork, mat just unrolled",
      base: ["physical", "sensory"],
      metric: { value: "45", unit: "sec", label: "headstand hold", note: "vinyasa · breathwork" },
      growth12w: [22,23,25,26,27,28,29,29,30,31,31,32], sessions30: [],
      milestones: [] },
    { id: "pottery", name: "Pottery", cat: "craft", level: 18, hours: 12, lastPracticed: "—", joined: false,
      vibe: "wheel, clay, mostly wonky bowls so far",
      base: ["creative", "sensory"],
      metric: { value: "12", unit: "pieces", label: "thrown & fired", note: "mostly wonky bowls so far" },
      growth12w: [5,7,8,10,11,12,13,14,15,16,17,18], sessions30: [],
      milestones: [] },
    { id: "spanish", name: "Spanish", cat: "language", level: 28, hours: 65, lastPracticed: "—", joined: false,
      vibe: "A2 · Duolingo morning streak",
      base: ["linguistic", "social"],
      metric: { value: "A2", unit: "CEFR", label: "proficiency", note: "Duolingo streak · 65h in" },
      growth12w: [18,20,22,23,24,25,26,26,27,27,28,28], sessions30: [],
      milestones: [] },
    { id: "photo", name: "Photography", cat: "craft", level: 46, hours: 220, lastPracticed: "—", joined: false,
      vibe: "35mm film, slow days, slower edits",
      base: ["creative", "sensory"],
      metric: { value: "40", unit: "rolls", label: "film shot", note: "35mm · slow edits" },
      growth12w: [38,40,41,42,43,44,44,45,45,46,46,46], sessions30: [],
      milestones: [] },
    { id: "code", name: "Programming", cat: "tech", level: 38, hours: 140, lastPracticed: "—", joined: false,
      vibe: "tiny scripts, weekend projects, learning Rust",
      base: ["logic", "technical"],
      metric: { value: "8", unit: "projects", label: "shipped", note: "weekend scripts · learning Rust" },
      growth12w: [28,30,32,33,34,35,35,36,37,37,38,38], sessions30: [],
      milestones: [] },
    { id: "investing", name: "Investing", cat: "money", level: 64, hours: 300, lastPracticed: "daily", joined: true,
      vibe: "index core, a few convictions, boring on purpose",
      base: ["logic", "strategic"],
      metric: { value: "+14.2%", unit: "/yr", label: "annualized return", note: "vs +9.1% index · 6-yr track" },
      growth12w: [54,55,57,58,59,60,61,61,62,63,63,64],
      sessions30: [1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1],
      milestones: ["First index fund · '20", "Beat the market 3 yrs · '25", "Six-figure portfolio · '26"] },
  ],

  // Skill summary at scale
  skillReach: {
    you:     { sport: 84, outdoor: 88, craft: 82, mind: 71, language: 62, music: 58, kitchen: 76, tech: 38 },
    friends: { sport: 65, outdoor: 70, craft: 50, mind: 55, language: 45, music: 40, kitchen: 60, tech: 55 },
    city:    { sport: 58, outdoor: 52, craft: 32, mind: 28, language: 70, music: 36, kitchen: 48, tech: 50 },
    world:   { sport: 60, outdoor: 30, craft: 22, mind: 25, language: 56, music: 44, kitchen: 56, tech: 38 },
  },

  groups: [
    // joined
    { id: "tennis", name: "Tennis", cat: "sports", members: 9400, match: 84, color: "sienna", vibe: "doubles · clay · post-match coffee", joined: true,
      memberProfile: { age: [25, 55], O: 64, C: 76, E: 66, A: 64, N: 28, gender: { f: 46, m: 50, nb: 4 } } },
    { id: "swim", name: "Swimming", cat: "outdoor", members: 3200, match: 88, color: "sage", vibe: "fjord swims, no excuses", joined: true,
      memberProfile: { age: [26, 55], O: 70, C: 78, E: 64, A: 66, N: 22, gender: { f: 48, m: 48, nb: 4 } } },
    { id: "writers", name: "Writing", cat: "literary", members: 2100, match: 82, color: "ink", vibe: "Murakami, Solnit, Knausgård", joined: true,
      memberProfile: { age: [28, 42], O: 81, C: 60, E: 38, A: 70, N: 32, gender: { f: 60, m: 35, nb: 5 } } },
    { id: "philos", name: "Philosophy", cat: "thought", members: 1300, match: 68, color: "ochre", vibe: "Stoics to Sartre", joined: true,
      memberProfile: { age: [22, 70], O: 86, C: 55, E: 50, A: 56, N: 38, gender: { f: 38, m: 56, nb: 6 } } },
    { id: "chess", name: "Chess", cat: "games", members: 5600, match: 71, color: "ink", vibe: "blitz to classical", joined: true,
      memberProfile: { age: [16, 78], O: 70, C: 72, E: 38, A: 50, N: 30, gender: { f: 22, m: 74, nb: 4 } } },

    // suggested
    { id: "football", name: "Football", cat: "sports", members: 14200, match: 64, color: "sienna", vibe: "5-a-side to full pitch", joined: false,
      memberProfile: { age: [20, 45], O: 56, C: 64, E: 70, A: 60, N: 28, gender: { f: 28, m: 68, nb: 4 } } },
    { id: "yoga", name: "Yoga", cat: "fitness", members: 12800, match: 72, color: "ochre", vibe: "vinyasa to yin", joined: false,
      memberProfile: { age: [22, 60], O: 76, C: 68, E: 50, A: 76, N: 30, gender: { f: 78, m: 18, nb: 4 } } },
    { id: "trail", name: "Trail running", cat: "outdoor", members: 4700, match: 79, color: "sage", vibe: "longer than yesterday", joined: false,
      memberProfile: { age: [28, 52], O: 64, C: 78, E: 60, A: 62, N: 24, gender: { f: 44, m: 52, nb: 4 } } },
    { id: "fjord", name: "Choir", cat: "music", members: 2600, match: 75, color: "sienna", vibe: "shape-note in the open air", joined: false,
      memberProfile: { age: [30, 65], O: 72, C: 60, E: 70, A: 78, N: 30, gender: { f: 60, m: 35, nb: 5 } } },
    { id: "press", name: "Letterpress", cat: "art", members: 340, match: 76, color: "ink", vibe: "old presses, new poems", joined: false,
      memberProfile: { age: [32, 60], O: 76, C: 84, E: 30, A: 66, N: 28, gender: { f: 50, m: 40, nb: 10 } } },
    { id: "ferment", name: "Fermenting", cat: "food", members: 1900, match: 73, color: "ochre", vibe: "kombucha, sourdough, rye", joined: false,
      memberProfile: { age: [25, 50], O: 74, C: 70, E: 48, A: 80, N: 28, gender: { f: 65, m: 30, nb: 5 } } },
    { id: "civic_g", name: "Local politics", cat: "civic", members: 2200, match: 61, color: "ink", vibe: "neighbourhood futures", joined: false,
      memberProfile: { age: [30, 70], O: 70, C: 72, E: 60, A: 76, N: 32, gender: { f: 52, m: 44, nb: 4 } } },
    { id: "makers", name: "Making", cat: "tech", members: 3800, match: 58, color: "ink", vibe: "hardware, type, weird software", joined: false,
      memberProfile: { age: [22, 48], O: 84, C: 62, E: 40, A: 56, N: 32, gender: { f: 30, m: 64, nb: 6 } } },
  ],

  // Group breakdowns at scale — share of population in groups by category
  groupReach: {
    you: { sports: 70, outdoor: 80, fitness: 30, literary: 70, thought: 60, music: 30, art: 40, games: 60, tech: 25, food: 20, civic: 10, faith: 5 },
    friends: { sports: 60, outdoor: 65, fitness: 50, literary: 55, thought: 45, music: 40, art: 30, games: 38, tech: 35, food: 35, civic: 18, faith: 12 },
    city: { sports: 58, outdoor: 52, fitness: 48, literary: 28, thought: 22, music: 36, art: 24, games: 20, tech: 30, food: 30, civic: 38, faith: 18 },
    world: { sports: 72, outdoor: 30, fitness: 40, literary: 14, thought: 12, music: 48, art: 18, games: 28, tech: 26, food: 24, civic: 22, faith: 60 },
  },

  // Specific popular groups (top in each scope)
  groupPopular: {
    friends: [
      { name: "Tennis", cat: "sports", n: 4 },
      { name: "Swimming", cat: "outdoor", n: 4 },
      { name: "Chess", cat: "games", n: 3 },
      { name: "Writing", cat: "literary", n: 3 },
      { name: "Philosophy", cat: "thought", n: 2 },
    ],
    city: [
      { name: "Football", cat: "sports", n: 24_000 },
      { name: "Trail running", cat: "outdoor", n: 1840 },
      { name: "Climbing", cat: "fitness", n: 1620 },
      { name: "Live music", cat: "music", n: 1240 },
      { name: "Reading", cat: "literary", n: 980 },
      { name: "Climate action", cat: "civic", n: 640 },
    ],
    world: [
      { name: "Football", cat: "sports", n: 280_000_000 },
      { name: "Faith & practice", cat: "faith", n: 4_100_000_000 },
      { name: "Yoga & meditation", cat: "fitness", n: 300_000_000 },
      { name: "Cricket", cat: "sports", n: 125_000_000 },
      { name: "Chess", cat: "games", n: 605_000_000 },
      { name: "Reading", cat: "literary", n: 38_000_000 },
      { name: "Making music", cat: "music", n: 64_000_000 },
    ],
  },

  // Group-finder questionnaire
  groupTest: [
    { q: "Best Sunday morning?",
      opts: [
        { t: "Sweat, ball, score", cats: ["sports", "fitness"] },
        { t: "A long swim, then bread", cats: ["outdoor", "food"] },
        { t: "Pages and a window", cats: ["literary", "thought"] },
        { t: "Hands moving, a workshop", cats: ["art", "tech"] },
        { t: "A board, two cups", cats: ["games"] },
      ] },
    { q: "What you secretly want more of",
      opts: [
        { t: "A racquet, a partner", cats: ["sports"] },
        { t: "Lungs that ache (good)", cats: ["outdoor", "fitness"] },
        { t: "Conversations that turn", cats: ["thought", "literary"] },
        { t: "Songs you can't shake", cats: ["music"] },
        { t: "Pieces that move just so", cats: ["games", "art"] },
      ] },
    { q: "How you'd rather show up",
      opts: [
        { t: "Kit on, ready", cats: ["sports", "fitness"] },
        { t: "In wool and wet socks", cats: ["outdoor"] },
        { t: "With a notebook", cats: ["literary", "thought"] },
        { t: "With your hands stained", cats: ["art", "food"] },
        { t: "With a folding chair", cats: ["civic", "music"] },
      ] },
  ],

  // The circle. Twenty-four records, which is not decoration: every surface
  // that reads this list is a "does it hold at N" question, and at seven it
  // answered none of them — the daily's 1v1 rail held five partners, the
  // group duels three groups, `duoAvailable()` could offer two people, and
  // the circle field pop (the fallback when the relationship map is absent)
  // laid out seven nodes across five sectors with no crowding to resolve.
  // Seven also contradicted the fixture below: `aggregates.circle.n` is 24
  // and its `mbtiDist` sums to 24, so this file already described a circle
  // three times the size of the one you could open.
  //
  // Half are friends on first run (follows.js SEED) and half are not, on
  // purpose: the invite → accept path and `duoAvailable()` both need people
  // who are reachable but not yet yours. `category` must be one of
  // MFP_SECTORS' five keys or the node lands in sector 0; `interests` are
  // `interestCats` ids (person-overlay maps them to labels), and `hue` is
  // the avatar's — spread, so a crowded field stays readable.
  people: [
    { id: "f1", name: "Henrik Vold", init: "HV", rel: "oldest friend", category: "friends", since: "2009", match: 91, hue: 38, last: "yesterday", note: "Knows your weather before you do.", degrees: 1, favorite: true, interests: ["outdoor","literary","thought"],
      faves: { films: ["Paterson", "Stalker"], books: ["The Summer Book"], music: ["Nick Drake"] } },
    { id: "f2", name: "Liv Aasen", init: "LA", rel: "sister", category: "family", since: "birth", match: 86, hue: 12, last: "Sun", note: "Calls only with good news or great gossip.", degrees: 1, favorite: true, interests: ["family","art","food"],
      faves: { films: ["Spirited Away"], books: ["Norwegian Wood"], music: ["Sufjan Stevens"] } },
    { id: "f3", name: "Marcus Holm", init: "MH", rel: "ex-colleague", category: "colleagues", since: "2018", match: 73, hue: 220, last: "3 wk", note: "The one who taught you to read footnotes.", degrees: 1, favorite: false, interests: ["thought","literary","tech"],
      faves: { films: ["Drive My Car"], books: ["The Unbearable Lightness of Being"], music: ["Bon Iver"] } },
    { id: "f4", name: "Petra Sand", init: "PS", rel: "neighbor", category: "neighbors", since: "2022", match: 68, hue: 145, last: "Mon", note: "Brings sourdough on grey days.", degrees: 1, favorite: true, interests: ["food","outdoor","art"],
      faves: { films: ["In the Mood for Love"], books: ["The Summer Book"], music: ["Pink Moon"] } },
    { id: "f5", name: "Ingrid Vold", init: "IV", rel: "Henrik's wife", category: "friends", since: "2014", match: 64, hue: 60, last: "2 wk", note: "Through Henrik. Botanist.", degrees: 2, favorite: false, interests: ["outdoor","art","thought"],
      faves: { films: ["Paterson"], books: ["A Field Guide to Getting Lost"], music: ["Aurora"] } },
    { id: "f6", name: "Eva Aasen", init: "EA", rel: "mother", category: "family", since: "birth", match: 78, hue: 305, last: "Fri", note: "Calls every Friday at 4.", degrees: 1, favorite: true, interests: ["family","music","literary"],
      faves: { films: ["The Worst Person in the World"], books: ["Sofies verden"], music: ["a-ha"] } },
    { id: "f7", name: "Jonas Borg", init: "JB", rel: "fellow writer", category: "acquaintances", since: "2024", match: 58, hue: 250, last: "Tue", note: "Reads Solnit, brings biscuits.", degrees: 2, favorite: false, interests: ["literary","thought","civic"],
      faves: { films: ["Stalker"], books: ["A Field Guide to Getting Lost"], music: ["Mount Eerie"] } },

    // family — the Aasen side, so the family sector carries a spread of ages
    // and closeness rather than a mother and a sister
    { id: "f8", name: "Kristian Aasen", init: "KA", rel: "brother", category: "family", since: "birth", match: 74, hue: 200, last: "Thu", note: "Sends match reports nobody asked for.", degrees: 1, favorite: false, interests: ["sports","games","tech"],
      faves: { films: ["Headhunters"], books: ["Naiv. Super."], music: ["Karpe"] } },
    { id: "f9", name: "Solveig Halvorsen", init: "SH", rel: "grandmother", category: "family", since: "birth", match: 61, hue: 330, last: "Sat", note: "Writes letters. Actual letters.", degrees: 1, favorite: true, interests: ["food","literary","faith"],
      faves: { films: ["The Summer Book"], books: ["Kristin Lavransdatter"], music: ["Edvard Grieg"] } },
    { id: "f10", name: "Tor Aasen", init: "TA", rel: "father", category: "family", since: "birth", match: 66, hue: 25, last: "Fri", note: "Forwards articles without comment.", degrees: 1, favorite: false, interests: ["outdoor","music","civic"],
      faves: { films: ["Force Majeure"], books: ["Min kamp"], music: ["a-ha"] } },
    { id: "f11", name: "Bjørn Aasen", init: "BA", rel: "nephew · Liv's boy", category: "family", since: "2019", match: 52, hue: 90, last: "Sun", note: "Started school this week. Cried less than his mother.", degrees: 2, favorite: true, interests: ["games","sports","art"],
      faves: { films: ["Spirited Away"], books: ["The Moomins and the Great Flood"], music: ["Aurora"] } },

    // friends — the sector the daily's 1v1s and the Map's People branch draw
    // from, so it needs more than two names to say anything
    { id: "f12", name: "Nora Lind", init: "NL", rel: "swim group", category: "friends", since: "2019", match: 84, hue: 195, last: "Sun", note: "First in the water, every Sunday.", degrees: 1, favorite: true, interests: ["outdoor","fitness","thought"],
      faves: { films: ["Drive My Car"], books: ["A Field Guide to Getting Lost"], music: ["Aurora"] } },
    { id: "f13", name: "Aksel Nyhus", init: "AN", rel: "chess club", category: "friends", since: "2021", match: 70, hue: 210, last: "Mon", note: "Plays the Sicilian and nothing else.", degrees: 1, favorite: false, interests: ["games","thought","music"],
      faves: { films: ["Stalker"], books: ["The Unbearable Lightness of Being"], music: ["Arvo Pärt"] } },
    { id: "f14", name: "Yara Haddad", init: "YH", rel: "from the writing course", category: "friends", since: "2023", match: 81, hue: 300, last: "Wed", note: "Cuts your best sentence and is always right.", degrees: 1, favorite: true, interests: ["literary","art","food"],
      faves: { films: ["In the Mood for Love"], books: ["Norwegian Wood"], music: ["Sufjan Stevens"] } },
    { id: "f15", name: "Kaja Rud", init: "KR", rel: "trail runs", category: "friends", since: "2020", match: 63, hue: 130, last: "2 wk", note: "Decides the route at the trailhead.", degrees: 1, favorite: false, interests: ["fitness","outdoor","food"],
      faves: { films: ["Force Majeure"], books: ["Sapiens"], music: ["Sigrid"] } },
    { id: "f16", name: "Emil Strand", init: "ES", rel: "old flatmate", category: "friends", since: "2015", match: 57, hue: 45, last: "6 wk", note: "Still owes you a bookshelf.", degrees: 1, favorite: false, interests: ["music","games","tech"],
      faves: { films: ["Paterson"], books: ["Naiv. Super."], music: ["Nick Drake"] } },

    // colleagues — the press
    { id: "f17", name: "Ravi Menon", init: "RM", rel: "editor-in-chief", category: "colleagues", since: "2020", match: 69, hue: 265, last: "yesterday", note: "Reads a manuscript the way you read weather.", degrees: 1, favorite: false, interests: ["literary","civic","thought"],
      faves: { films: ["Drive My Car"], books: ["The Unbearable Lightness of Being"], music: ["Bon Iver"] } },
    { id: "f18", name: "Hedda Nilsen", init: "HN", rel: "designer at the press", category: "colleagues", since: "2021", match: 76, hue: 340, last: "Tue", note: "Sets type like it's a moral position.", degrees: 1, favorite: true, interests: ["art","literary","tech"],
      faves: { films: ["In the Mood for Love"], books: ["The Summer Book"], music: ["Mount Eerie"] } },
    { id: "f19", name: "Tomas Berg", init: "TB", rel: "printer", category: "colleagues", since: "2019", match: 54, hue: 70, last: "3 wk", note: "Knows every press in the city by its noise.", degrees: 2, favorite: false, interests: ["art","food","sports"],
      faves: { films: ["Headhunters"], books: ["Min kamp"], music: ["Karpe"] } },

    // neighbors — the yard
    { id: "f20", name: "Amina Osman", init: "AO", rel: "downstairs", category: "neighbors", since: "2022", match: 72, hue: 160, last: "Mon", note: "Runs the yard's compost and its politics.", degrees: 1, favorite: false, interests: ["food","civic","faith"],
      faves: { films: ["The Worst Person in the World"], books: ["Sapiens"], music: ["Sigrid"] } },
    { id: "f21", name: "Lars Fjell", init: "LF", rel: "across the yard", category: "neighbors", since: "2023", match: 46, hue: 15, last: "5 wk", note: "Waves. Has never once come in for coffee.", degrees: 2, favorite: false, interests: ["sports","tech","games"],
      faves: { films: ["Inception"], books: ["Atomic Habits"], music: ["The Weeknd"] } },

    // acquaintances — the loose edge, where most invites still are
    { id: "f22", name: "Sofie Dahl", init: "SD", rel: "book club regular", category: "acquaintances", since: "2024", match: 65, hue: 285, last: "2 wk", note: "Has opinions about endings.", degrees: 2, favorite: false, interests: ["literary","thought","art"],
      faves: { films: ["Paterson"], books: ["Sofies verden"], music: ["Aurora"] } },
    { id: "f23", name: "Elias Vik", init: "EV", rel: "café regular", category: "acquaintances", since: "2025", match: 43, hue: 55, last: "4 wk", note: "Same corner table, same order, every morning.", degrees: 2, favorite: false, interests: ["food","music","fitness"],
      faves: { films: ["The Worst Person in the World"], books: ["Naiv. Super."], music: ["Nick Drake"] } },
    { id: "f24", name: "Miriam Torp", init: "MT", rel: "fermenting workshop", category: "acquaintances", since: "2025", match: 49, hue: 105, last: "7 wk", note: "Gave you the kombucha scoby that keeps living.", degrees: 2, favorite: false, interests: ["food","art","outdoor"],
      faves: { films: ["Spirited Away"], books: ["The Summer Book"], music: ["Sufjan Stevens"] } },
  ],

  // Daily notes — only people who shared today's line.
  dailyReports: [
    { personId: "f1", date: "today",     weather: "raining steady · 9°", one_line: "Found a heron at the railway bridge — stayed twenty minutes.", shared: ["weather","one_line"] },
    { personId: "f2", date: "today",     weather: "wind · 11°",          one_line: "Bjørn made it through his first day at school without crying. I cried.", shared: ["weather","one_line"] },
    { personId: "f4", date: "today",     weather: "sun · 14°",           one_line: "The plum tree has set fruit. Smaller than last year. Sweeter, I think.", shared: ["weather","one_line"] },
    { personId: "f6", date: "today",     one_line: "Found Dad's handwriting in an old cookbook. Made his stew.", shared: ["one_line"] },
    { personId: "f5", date: "yesterday", one_line: "Logged 32 specimens. The blue gentian is opening early this year.", shared: ["one_line"] },
    { personId: "f12", date: "today",     weather: "cloud · 12°",       one_line: "Six minutes today. The fjord is warmer than the air, which feels like cheating.", shared: ["weather","one_line"] },
    { personId: "f18", date: "today",     one_line: "Set the whole cover in Garamond, hated it, set it again.", shared: ["one_line"] },
    { personId: "f20", date: "yesterday", weather: "rain · 10°",        one_line: "The compost committee has a chair now. It is me.", shared: ["weather","one_line"] },
    { personId: "f9",  date: "yesterday", one_line: "Wrote to Mira. The pen skips on the new paper.", shared: ["one_line"] },
  ],

  // Connections — pairs of person ids that know each other. Both halves of
  // the roster appear: the f-side is the circle, the p-side the strangers
  // nearby, and an edge across the two is how someone becomes reachable.
  connections: [
    ["f1","f2"], ["f1","f4"], ["f2","f3"], ["f3","f4"], ["f1","p1"], ["f4","p4"], ["p1","p3"], ["p2","p3"], ["p1","p2"], ["p5","p3"], ["p4","p6"], ["f3","p5"],
    ["f2","f8"], ["f2","f11"], ["f6","f8"], ["f6","f10"], ["f8","f10"], ["f9","f10"], ["f2","f10"], ["f8","f11"],
    ["f1","f12"], ["f12","f15"], ["f1","f15"], ["f5","f12"], ["f13","f16"], ["f3","f13"], ["f7","f14"], ["f14","f22"],
    ["f17","f18"], ["f17","f19"], ["f18","f19"], ["f3","f17"], ["f7","f17"], ["f14","f18"],
    ["f4","f20"], ["f4","f21"], ["f20","f24"], ["f22","f23"],
    ["f12","p3"], ["f14","p11"], ["f18","p13"], ["f20","p8"], ["f13","p14"], ["f15","p6"],
    ["p7","p9"], ["p7","p13"], ["p8","p10"], ["p10","p14"], ["p11","p13"], ["p9","p12"], ["p12","p6"]
  ],

  // Aggregate profiles for comparison charts.
  // Each scope has: big5 averages, political (econ, social), n (sample size)
  aggregates: {
    you: {
      label: "you",
      n: 1,
      big5: { O: 78, C: 62, E: 41, A: 69, N: 28 },
      political: { econ: -22, social: -18 },
      mbti: "INFP",
    },
    circle: {
      label: "your circle",            // friends + people you follow
      n: 24,
      big5: { O: 71, C: 58, E: 52, A: 64, N: 34 },
      political: { econ: -15, social: -12 },
      mbtiDist: { INFP: 5, ENFP: 4, INFJ: 3, INTP: 3, ISFP: 2, ENTP: 2, ENFJ: 2, ISTJ: 1, ISFJ: 1, OTHER: 1 },
    },
    city: {
      label: "Oslo",
      n: 1840,
      big5: { O: 64, C: 65, E: 47, A: 62, N: 36 },
      political: { econ: -18, social: -8 },
      mbtiDist: { ISTJ: 14, ISFJ: 12, INFP: 10, INTJ: 8, INFJ: 7, ISTP: 8, ESTJ: 9, ESFJ: 9, ENFP: 7, INTP: 6, ENTP: 4, ENFJ: 3, OTHER: 3 },
    },
    world: {
      label: "the world",
      n: 184000,
      big5: { O: 58, C: 60, E: 54, A: 60, N: 44 },
      political: { econ: 4, social: 6 },
      mbtiDist: { ISFJ: 14, ESFJ: 12, ISTJ: 11, ESTJ: 9, ESFP: 9, ISFP: 9, ENFP: 8, ISTP: 5, INFP: 4, ESTP: 4, ENTJ: 3, INTJ: 2, INFJ: 2, INTP: 3, ENFJ: 2, ENTP: 3 },
    },
    around: {
      label: "near you",
      n: 312,
      big5: { O: 68, C: 60, E: 49, A: 66, N: 32 },
      political: { econ: -16, social: -14 },
      mbtiDist: { INFP: 8, ENFP: 7, INFJ: 5, ISFP: 6, INTP: 5, ENTP: 4, ISFJ: 6, ENFJ: 4, ISTJ: 7, ESFJ: 5, ESFP: 4, INTJ: 3, ESTJ: 3, ENTJ: 2, ISTP: 3, ESTP: 2 },
    },
  },

  // Media — your favorites across categories
  media: {
    you: {
      films: [
        { title: "Spirited Away", year: 2001, rating: 5, hue: 38, tag: "patient craft" },
        { title: "In the Mood for Love", year: 2000, rating: 5, hue: 12, tag: "longing" },
        { title: "Stalker", year: 1979, rating: 4, hue: 145, tag: "slow questions" },
        { title: "Paterson", year: 2016, rating: 5, hue: 60, tag: "small days" },
        { title: "Drive My Car", year: 2021, rating: 4, hue: 220, tag: "grief, gentle" },
      ],
      books: [
        { title: "Norwegian Wood", author: "Murakami", rating: 5, hue: 38, tag: "youth, blue" },
        { title: "A Field Guide to Getting Lost", author: "Solnit", rating: 5, hue: 220, tag: "wandering" },
        { title: "The Summer Book", author: "Tove Jansson", rating: 5, hue: 145, tag: "island, grandmother" },
        { title: "The Unbearable Lightness of Being", author: "Kundera", rating: 4, hue: 305, tag: "weight" },
      ],
      games: [
        { title: "Outer Wilds", rating: 5, hue: 80, tag: "wonder" },
        { title: "Journey", rating: 5, hue: 38, tag: "wordless" },
        { title: "Disco Elysium", rating: 4, hue: 12, tag: "pages of self" },
        { title: "Stardew Valley", rating: 4, hue: 145, tag: "small life" },
      ],
      music: [
        { title: "For Emma, Forever Ago", artist: "Bon Iver", rating: 5, hue: 220, tag: "cabin" },
        { title: "Pink Moon", artist: "Nick Drake", rating: 5, hue: 60, tag: "hush" },
        { title: "A Crow Looked at Me", artist: "Mount Eerie", rating: 4, hue: 250, tag: "grief" },
        { title: "Carrie & Lowell", artist: "Sufjan Stevens", rating: 5, hue: 305, tag: "memory" },
      ],
      people: [
        { title: "Tove Jansson", trait: "quiet defiance", rating: 5, hue: 38, tag: "Moomins, islands" },
        { title: "Hayao Miyazaki", trait: "patient craft", rating: 5, hue: 145, tag: "wind, breath" },
        { title: "Rebecca Solnit", trait: "wandering mind", rating: 5, hue: 220, tag: "essays, walking" },
        { title: "Agnes Martin", trait: "stillness", rating: 4, hue: 60, tag: "horizons" },
      ],
    },
    aggregates: {
      circle: {
        label: "your circle",
        films: { "Spirited Away": 82, "In the Mood for Love": 64, "Paterson": 71, "Drive My Car": 58, "Stalker": 38 },
        books: { "Norwegian Wood": 76, "A Field Guide to Getting Lost": 52, "The Summer Book": 64, "The Unbearable Lightness of Being": 58 },
        games: { "Outer Wilds": 48, "Journey": 56, "Stardew Valley": 71, "Disco Elysium": 38 },
        music: { "For Emma, Forever Ago": 68, "Pink Moon": 41, "Carrie & Lowell": 54, "A Crow Looked at Me": 22 },
        people: { "Tove Jansson": 78, "Rebecca Solnit": 64, "Hayao Miyazaki": 71 },
        avgRating: 4.2,
      },
      city: {
        label: "Oslo",
        films: { "Spirited Away": 71, "In the Mood for Love": 48, "Paterson": 42, "Drive My Car": 51, "Stalker": 28 },
        books: { "Norwegian Wood": 64, "A Field Guide to Getting Lost": 38, "The Summer Book": 78, "The Unbearable Lightness of Being": 49 },
        games: { "Outer Wilds": 31, "Journey": 38, "Stardew Valley": 64, "Disco Elysium": 28 },
        music: { "For Emma, Forever Ago": 52, "Pink Moon": 34, "Carrie & Lowell": 41, "A Crow Looked at Me": 14 },
        people: { "Tove Jansson": 58, "Rebecca Solnit": 24, "Hayao Miyazaki": 48 },
        avgRating: 3.6,
      },
      world: {
        label: "the world",
        films: { "Spirited Away": 64, "In the Mood for Love": 32, "Paterson": 18, "Drive My Car": 24, "Stalker": 11 },
        books: { "Norwegian Wood": 41, "A Field Guide to Getting Lost": 18, "The Summer Book": 22, "The Unbearable Lightness of Being": 38 },
        games: { "Outer Wilds": 22, "Journey": 31, "Stardew Valley": 58, "Disco Elysium": 18 },
        music: { "For Emma, Forever Ago": 38, "Pink Moon": 22, "Carrie & Lowell": 28, "A Crow Looked at Me": 6 },
        people: { "Tove Jansson": 14, "Rebecca Solnit": 8, "Hayao Miyazaki": 62 },
        avgRating: 3.3,
      },
      around: {
        label: "near you",
        films: { "Spirited Away": 74, "In the Mood for Love": 52, "Paterson": 48, "Drive My Car": 54, "Stalker": 32 },
        books: { "Norwegian Wood": 68, "A Field Guide to Getting Lost": 42, "The Summer Book": 71, "The Unbearable Lightness of Being": 52 },
        games: { "Outer Wilds": 38, "Journey": 44, "Stardew Valley": 62, "Disco Elysium": 32 },
        music: { "For Emma, Forever Ago": 58, "Pink Moon": 36, "Carrie & Lowell": 44, "A Crow Looked at Me": 16 },
        people: { "Tove Jansson": 64, "Rebecca Solnit": 38, "Hayao Miyazaki": 58 },
        avgRating: 3.5,
      },
    },
    // Most-loved per scope (top 3 of the most popular ITEMS, not your faves)
    topByScope: {
      around: {
        films: ["Drive", "Force Majeure", "The Worst Person in the World"],
        books: ["Min kamp", "The Summer Book", "Sapiens"],
        music: ["Karpe", "Aurora", "Sigrid"],
        people: ["Erna Solberg", "Karl Ove Knausgård", "Aurora"],
      },
      city: {
        films: ["The Worst Person in the World", "Force Majeure", "Headhunters"],
        books: ["Min kamp", "Sofies verden", "Naiv. Super."],
        music: ["a-ha", "Aurora", "Karpe"],
        people: ["Karl Ove Knausgård", "Erna Solberg", "Jo Nesbø"],
      },
      world: {
        films: ["Inception", "The Dark Knight", "Parasite"],
        books: ["Atomic Habits", "Sapiens", "1984"],
        music: ["Taylor Swift", "Bad Bunny", "The Weeknd"],
        people: ["Taylor Swift", "Barack Obama", "Elon Musk"],
      },
      circle: {
        films: ["Spirited Away", "Paterson", "In the Mood for Love"],
        books: ["The Summer Book", "Norwegian Wood", "Field Guide to Getting Lost"],
        music: ["Bon Iver", "Sufjan Stevens", "Nick Drake"],
        people: ["Tove Jansson", "Rebecca Solnit", "Hayao Miyazaki"],
      },
    },
  },

  // Life used / remaining — born 1991-04-12, life expectancy 84
  life: {
    bornISO: "1991-04-12",
    expectancy: 84, // years
    label: "born under a quiet planet",
    waking: 16, // hours/day
    weeksLived: 1832,
    weeksLeft: 2536,
  },

  // On this day — lines resurfaced from old logs, same calendar date
  lookback: [
    { yearsAgo: 1, date: "June 10, 2025", weather: "sun",
      note: "Swam at Sørenga before work. Henrik said the water teaches you what you can stand.",
      where: "Oslo" },
    { yearsAgo: 3, date: "June 10, 2023", weather: "rain",
      note: "First night in the Grünerløkka flat. Boxes everywhere, but the light through the kitchen window — I knew.",
      where: "Oslo" },
  ],

};

// compact population formatter — 340, 9.4k, 1.2M
export function fmtPop(n) {
  if (n == null) return '—';
  if (n >= 1e6) { const v = n / 1e6; return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + 'M'; }
  if (n >= 1000) { const v = n / 1000; return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + 'k'; }
  return String(n);
}
