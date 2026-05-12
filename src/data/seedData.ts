// Sample data for InSight prototype — richer than repo defaults.
// Ported verbatim from the plan's data.js. Typed loosely on purpose; consumers
// narrow at the point of use.

/* eslint-disable */
export const IS_DATA: any = {
  me: {
    name: "Mira Halvorsen",
    initials: "MH",
    location: "Oslo",
    country: "Norway",
    personality: { O: 78, C: 62, E: 41, A: 69, N: 28 }, // Big Five
    political: { econ: -22, social: -18, foreign: -18, env: 46, tech: 12, auth: -32 }, // -100..100 each
    politicalSub: {
      // 18 sub-positions, three per axis (-100..100)
      econ:    { tax: -34, redistribution: -28, market: -8, label: 'mixed economy, tilt toward redistribution' },
      social:  { speech: 30, gender: -52, drugs: -28, label: 'civil libertarian, free speech leaning' },
      foreign: { trade: -24, defence: 6, migration: -36, label: 'open borders, cooperative posture' },
      env:     { climate: 64, biodiv: 52, urbanism: 22, label: 'climate-first, comfortable with cities' },
      tech:    { ai: -8, biotech: 28, surveil: -54, label: 'precaution on AI, allergy to surveillance' },
      auth:    { hierarchy: -38, tradition: -22, deference: -34, label: 'horizontal, sceptical of authority' },
    },
    politicalIdentity: { name: 'Green-Left Internationalist', tag: 'libertarian green, cooperative abroad' },
    values: { indiv: -14, change: 28 },
    morals: {
      tech: 18,        // -100 doomer .. +100 optimist
      future: 8,       // pessimist .. optimist
      duty: -22,       // strangers .. family
      hedonism: -10,   // duty .. pleasure
      meaning: 36,     // happiness only .. suffering has meaning
      moral: 10,       // relativist .. objectivist
      altruism: 22,    // self .. stranger
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
      { year: 2024, t: "joined the Writers' Room" },
    ],
    badges: ["365-day journal", "100 cold dips", "10k pages read", "first chess W"],
    heroes: [
      { name: "Tove Jansson", trait: "quiet defiance" },
      { name: "Hayao Miyazaki", trait: "patient craft" },
      { name: "Rebecca Solnit", trait: "wandering mind" },
    ],
    media: { books: 47, films: 112, songs: 2840 },
  },

  // Around — aggregate profile of nearby strangers within 5km
  // (added to aggregates to feed ProfileCompare)

  nearby: [
    { id: "p1", name: "Sigrid Bø", init: "SB", age: 29, dist: "0.4 km", match: 88, hue: 38, role: "ceramicist", interests: [{t:"pottery",c:"art"},{t:"fermentation",c:"food"},{t:"Murakami",c:"literary"},{t:"yoga",c:"fitness"}], values: "change · collective", note: "Reads the same authors. Walks at dusk." },
    { id: "p2", name: "Anders Lie", init: "AL", age: 34, dist: "0.7 km", match: 81, hue: 145, role: "violinist", interests: [{t:"chamber music",c:"music"},{t:"long runs",c:"fitness"},{t:"espresso",c:"food"},{t:"chess",c:"games"}], values: "tradition · individual", note: "Plays at Sentralen Thursdays." },
    { id: "p3", name: "Eira Nordli", init: "EN", age: 27, dist: "1.1 km", match: 76, hue: 220, role: "marine biologist", interests: [{t:"fjord swims",c:"outdoor"},{t:"field notes",c:"literary"},{t:"Solnit",c:"literary"},{t:"climbing",c:"fitness"}], values: "change · collective", note: "Cold-water swim group, Sundays 7am." },
    { id: "p4", name: "Tobias Krag", init: "TK", age: 31, dist: "1.4 km", match: 64, hue: 12, role: "bookbinder", interests: [{t:"letterpress",c:"art"},{t:"Tove Jansson",c:"literary"},{t:"rye bread",c:"food"},{t:"go",c:"games"}], values: "tradition · collective", note: "Workshop above Cafilosofen." },
    { id: "p5", name: "Mai Solberg", init: "MS", age: 26, dist: "2.0 km", match: 59, hue: 280, role: "data journalist", interests: [{t:"data viz",c:"tech"},{t:"kayaking",c:"outdoor"},{t:"matcha",c:"food"},{t:"tennis",c:"sports"}], values: "change · individual", note: "Often at Tim Wendelboe." },
    { id: "p6", name: "Jonas Ek", init: "JE", age: 38, dist: "2.6 km", match: 52, hue: 60, role: "carpenter", interests: [{t:"woodworking",c:"art"},{t:"trail running",c:"fitness"},{t:"Cohen",c:"music"},{t:"football",c:"sports"}], values: "tradition · individual", note: "Built half the cabins on Nesodden." },
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

  // Named thinkers — small marks on the compass for orientation
  ideologyMarks: [
    { name: 'Mill',     econ:  20, social: -55 },
    { name: 'Marx',     econ: -82, social:  -8 },
    { name: 'Rand',     econ:  84, social: -76 },
    { name: 'Hobbes',   econ:  10, social:  78 },
    { name: 'Solnit',   econ: -56, social: -52 },
    { name: 'Rawls',    econ: -28, social: -18 },
  ],

  // The 6 axes of the political compass — labels and the people-aggregate average
  // for each axis (used to draw a translucent comparison ring on the radar).
  politicalAxes: [
    { id: 'econ',    label: 'economic',    poles: ['state','market'],            avgCircle: -8,  avgWorld: 22 },
    { id: 'social',  label: 'social',      poles: ['liberty','authority'],       avgCircle: -12, avgWorld: 8  },
    { id: 'foreign', label: 'foreign',     poles: ['cooperative','sovereign'],   avgCircle: -8,  avgWorld: 14 },
    { id: 'env',     label: 'environment', poles: ['extractive','protective'],   avgCircle: 28,  avgWorld: 6  },
    { id: 'tech',    label: 'technology',  poles: ['precaution','acceleration'], avgCircle: 6,   avgWorld: 18 },
    { id: 'auth',    label: 'authority',   poles: ['horizontal','hierarchical'], avgCircle: -10, avgWorld: 12 },
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
  ],

  skills: [
    // practiced
    { id: "tennis", name: "Tennis", cat: "sport", level: 84, hours: 312, lastPracticed: "Sat 9am", joined: true,
      vibe: "doubles · clay · still working on the slice",
      growth12w: [62,64,66,68,70,72,74,76,78,80,82,84],
      sessions30: [1,0,1,1,0,0,1,0,1,0,0,1,1,0,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,1],
      milestones: ["First match win · '23", "Joined Frogner club · '24", "Beat coach 6-3 · Apr '26"] },
    { id: "swim", name: "Cold-water swimming", cat: "outdoor", level: 88, hours: 47, lastPracticed: "Sun 7am", joined: true,
      vibe: "fjord, six minutes, no excuses",
      growth12w: [70,72,74,76,78,80,82,84,85,86,87,88],
      sessions30: [0,1,0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,1,1,0,1,0,0,1,1,0,1,1,1],
      milestones: ["First plunge · Jan '25", "12 min · Apr '26", "All winter, no break"] },
    { id: "writing", name: "Writing", cat: "craft", level: 82, hours: 1240, lastPracticed: "Tue", joined: true,
      vibe: "morning pages, occasional essays, the slow novel",
      growth12w: [72,74,75,77,78,79,80,80,81,81,82,82],
      sessions30: [1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1],
      milestones: ["First essay published · '22", "20k words on the novel · '25", "Editor liked p.7"] },
    { id: "philos", name: "Philosophy", cat: "mind", level: 68, hours: 480, lastPracticed: "Wed", joined: true,
      vibe: "Stoics in the morning, Sartre after wine",
      growth12w: [60,61,62,63,64,64,65,65,66,67,67,68],
      sessions30: [0,1,0,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0],
      milestones: ["Read all of Aurelius · '24", "Started a reading group", "Plato in original (slow) · '26"] },
    { id: "chess", name: "Chess", cat: "mind", level: 71, hours: 220, lastPracticed: "Mon", joined: true,
      vibe: "blitz Mondays, classical Thursdays, 1620 ELO",
      growth12w: [55,57,60,62,63,64,65,66,68,69,70,71],
      sessions30: [1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1],
      milestones: ["Reached 1500 ELO · '24", "First tournament · '25", "Beat M (FM) · '26"] },
    { id: "norwegian", name: "Norwegian", cat: "language", level: 62, hours: 380, lastPracticed: "daily", joined: true,
      vibe: "B1 → B2, dialects still tricky",
      growth12w: [55,56,57,58,58,59,60,60,61,61,62,62],
      sessions30: [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1],
      milestones: ["A2 cert · '24", "First long convo · '25", "Read a novel · '26"] },
    { id: "piano", name: "Piano", cat: "music", level: 58, hours: 410, lastPracticed: "Thu", joined: true,
      vibe: "Chopin Nocturne 9, Bach 2-part inventions",
      growth12w: [50,51,52,53,54,55,55,56,57,57,58,58],
      sessions30: [0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],
      milestones: ["First scale all keys · '23", "Played at house party · '25", "Recorded one piece · '26"] },
    { id: "sourdough", name: "Sourdough", cat: "kitchen", level: 76, hours: 90, lastPracticed: "Sat", joined: true,
      vibe: "70% rye, 78% hydration, the long cold rise",
      growth12w: [65,67,69,71,72,73,74,75,75,76,76,76],
      sessions30: [0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,1],
      milestones: ["First loaf rose · '24", "Open crumb · '25", "Friends ask for it"] },

    // skills to develop
    { id: "running", name: "Running", cat: "sport", level: 54, hours: 180, lastPracticed: "—", joined: false,
      vibe: "5k under 24, half-marathon someday",
      growth12w: [42,44,45,46,48,49,50,51,52,53,54,54], sessions30: [],
      milestones: [] },
    { id: "yoga", name: "Yoga", cat: "outdoor", level: 32, hours: 28, lastPracticed: "—", joined: false,
      vibe: "vinyasa, breathwork, mat just unrolled",
      growth12w: [22,23,25,26,27,28,29,29,30,31,31,32], sessions30: [],
      milestones: [] },
    { id: "pottery", name: "Pottery", cat: "craft", level: 18, hours: 12, lastPracticed: "—", joined: false,
      vibe: "wheel, clay, mostly wonky bowls so far",
      growth12w: [5,7,8,10,11,12,13,14,15,16,17,18], sessions30: [],
      milestones: [] },
    { id: "spanish", name: "Spanish", cat: "language", level: 28, hours: 65, lastPracticed: "—", joined: false,
      vibe: "A2 · Duolingo morning streak",
      growth12w: [18,20,22,23,24,25,26,26,27,27,28,28], sessions30: [],
      milestones: [] },
    { id: "photo", name: "Photography", cat: "craft", level: 46, hours: 220, lastPracticed: "—", joined: false,
      vibe: "35mm film, slow days, slower edits",
      growth12w: [38,40,41,42,43,44,44,45,45,46,46,46], sessions30: [],
      milestones: [] },
    { id: "code", name: "Programming", cat: "tech", level: 38, hours: 140, lastPracticed: "—", joined: false,
      vibe: "tiny scripts, weekend projects, learning Rust",
      growth12w: [28,30,32,33,34,35,35,36,37,37,38,38], sessions30: [],
      milestones: [] },
  ],

  // Skill summary at scale
  skillReach: {
    you:     { sport: 84, outdoor: 88, craft: 82, mind: 71, language: 62, music: 58, kitchen: 76, tech: 38 },
    friends: { sport: 65, outdoor: 70, craft: 50, mind: 55, language: 45, music: 40, kitchen: 60, tech: 55 },
    city:    { sport: 58, outdoor: 52, craft: 32, mind: 28, language: 70, music: 36, kitchen: 48, tech: 50 },
    world:   { sport: 60, outdoor: 30, craft: 22, mind: 25, language: 56, music: 44, kitchen: 56, tech: 38 },
  },

  // Extended finance — additional viz data
  financeExtra: {
    incomeSources: [
      { src: "Salary",         amt: 3850, pct: 90, color: "var(--ink-2)" },
      { src: "Freelance",      amt: 320,  pct: 7,  color: "var(--sage)"  },
      { src: "Dividends",      amt: 110,  pct: 3,  color: "var(--ochre)" },
    ],
    // % of total spend by day-of-week (Mon..Sun)
    dowSpend: [12, 10, 14, 13, 18, 22, 11],
    dowAvg:   [42, 36, 48, 45, 62, 78, 38], // € avg per day
    // 12 months of savings rate %
    savingsRate12: [12, 18, 14, 22, 8, 24, 28, 19, 32, 26, 31, 43],
    // Cashflow waterfall — start at totalIn, subtract big buckets, end at net
    waterfall: [
      { label: "Income",       v: +4280, kind: "in"   },
      { label: "Rent · util",  v: -1180, kind: "out"  },
      { label: "Groceries",    v: -387,  kind: "out"  },
      { label: "Restaurants",  v: -312,  kind: "out"  },
      { label: "Cafés",        v: -142,  kind: "out"  },
      { label: "Other",        v: -397,  kind: "out"  },
      { label: "Net saved",    v: +1862, kind: "net"  },
    ],
    // budget vs actual
    budget: [
      { cat: "Rent · util",  budget: 1200, actual: 1180 },
      { cat: "Groceries",    budget: 450,  actual: 387  },
      { cat: "Restaurants",  budget: 200,  actual: 312  },
      { cat: "Cafés",        budget: 100,  actual: 142  },
      { cat: "Transit",      budget: 90,   actual: 94   },
      { cat: "Subscriptions",budget: 80,   actual: 89   },
    ],
    // hour-of-day spend heat (0..23)
    hourSpend: [0,0,0,0,0,0,0,2,8,4,3,6,18,12,6,4,5,8,22,18,9,4,2,1],
    yearProjection: { saved: 3204, ifContinue: 22344, ifTrim: 28100 },
    netWorth6m:    [12400, 13200, 13900, 14640, 15400, 17262],
    netWorthLabels: ["Dec","Jan","Feb","Mar","Apr","May"],
  },

  groups: [
    // joined
    { id: "tennis", name: "Frogner Tennis", cat: "sports", members: 28, match: 84, color: "sienna", lastMet: "Sat 9am", vibe: "doubles · clay · post-match coffee", joined: true,
      memberProfile: { age: [25, 55], O: 64, C: 76, E: 66, A: 64, N: 28, gender: { f: 46, m: 50, nb: 4 } } },
    { id: "swim", name: "Cold Water Sunday", cat: "outdoor", members: 23, match: 88, color: "sage", lastMet: "Sun 7am", vibe: "fjord swims, no excuses", joined: true,
      memberProfile: { age: [26, 55], O: 70, C: 78, E: 64, A: 66, N: 22, gender: { f: 48, m: 48, nb: 4 } } },
    { id: "writers", name: "The Writers' Room", cat: "literary", members: 14, match: 82, color: "ink", lastMet: "Tue", vibe: "Murakami, Solnit, Knausgård", joined: true,
      memberProfile: { age: [28, 42], O: 81, C: 60, E: 38, A: 70, N: 32, gender: { f: 60, m: 35, nb: 5 } } },
    { id: "philos", name: "Philosophy at Cafilosofen", cat: "thought", members: 31, match: 68, color: "ochre", lastMet: "Wed", vibe: "Stoics to Sartre", joined: true,
      memberProfile: { age: [22, 70], O: 86, C: 55, E: 50, A: 56, N: 38, gender: { f: 38, m: 56, nb: 6 } } },
    { id: "chess", name: "Oslo Chess Club", cat: "games", members: 42, match: 71, color: "ink", lastMet: "Mon", vibe: "blitz on Mondays, classical Thurs.", joined: true,
      memberProfile: { age: [16, 78], O: 70, C: 72, E: 38, A: 50, N: 30, gender: { f: 22, m: 74, nb: 4 } } },

    // suggested
    { id: "football", name: "Sunday Football", cat: "sports", members: 56, match: 64, color: "sienna", lastMet: "—", vibe: "5-a-side, all levels, Bislett", joined: false,
      memberProfile: { age: [20, 45], O: 56, C: 64, E: 70, A: 60, N: 28, gender: { f: 28, m: 68, nb: 4 } } },
    { id: "yoga", name: "Sunrise Yoga", cat: "fitness", members: 34, match: 72, color: "ochre", lastMet: "—", vibe: "vinyasa at 7, breath at 8", joined: false,
      memberProfile: { age: [22, 60], O: 76, C: 68, E: 50, A: 76, N: 30, gender: { f: 78, m: 18, nb: 4 } } },
    { id: "trail", name: "Nordmarka Trails", cat: "outdoor", members: 42, match: 79, color: "sage", lastMet: "—", vibe: "longer than yesterday", joined: false,
      memberProfile: { age: [28, 52], O: 64, C: 78, E: 60, A: 62, N: 24, gender: { f: 44, m: 52, nb: 4 } } },
    { id: "fjord", name: "Fjord Choir", cat: "music", members: 18, match: 75, color: "sienna", lastMet: "—", vibe: "shape-note in the open air", joined: false,
      memberProfile: { age: [30, 65], O: 72, C: 60, E: 70, A: 78, N: 30, gender: { f: 60, m: 35, nb: 5 } } },
    { id: "press", name: "Letterpress Guild", cat: "art", members: 8, match: 76, color: "ink", lastMet: "—", vibe: "old presses, new poems", joined: false,
      memberProfile: { age: [32, 60], O: 76, C: 84, E: 30, A: 66, N: 28, gender: { f: 50, m: 40, nb: 10 } } },
    { id: "ferment", name: "Slow Ferment", cat: "food", members: 12, match: 73, color: "ochre", lastMet: "—", vibe: "kombucha, sourdough, rye", joined: false,
      memberProfile: { age: [25, 50], O: 74, C: 70, E: 48, A: 80, N: 28, gender: { f: 65, m: 30, nb: 5 } } },
    { id: "civic_g", name: "Grønland Council", cat: "civic", members: 56, match: 61, color: "ink", lastMet: "—", vibe: "neighbourhood futures", joined: false,
      memberProfile: { age: [30, 70], O: 70, C: 72, E: 60, A: 76, N: 32, gender: { f: 52, m: 44, nb: 4 } } },
    { id: "makers", name: "Oslo Makers", cat: "tech", members: 88, match: 58, color: "ink", lastMet: "—", vibe: "hardware, type, weird software", joined: false,
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
      { name: "Frogner Tennis", cat: "sports", n: 4 },
      { name: "Cold Water Sunday", cat: "outdoor", n: 4 },
      { name: "Oslo Chess Club", cat: "games", n: 3 },
      { name: "The Writers' Room", cat: "literary", n: 3 },
      { name: "Philosophy at Cafilosofen", cat: "thought", n: 2 },
    ],
    city: [
      { name: "Football leagues", cat: "sports", n: 24_000 },
      { name: "Nordmarka Trails", cat: "outdoor", n: 1840 },
      { name: "Climbing & bouldering", cat: "fitness", n: 1620 },
      { name: "Sentralen Music", cat: "music", n: 1240 },
      { name: "Oslo Book Club", cat: "literary", n: 980 },
      { name: "Climate Action Oslo", cat: "civic", n: 640 },
    ],
    world: [
      { name: "Football", cat: "sports", n: 280_000_000 },
      { name: "Faith communities", cat: "faith", n: 4_100_000_000 },
      { name: "Yoga & meditation", cat: "fitness", n: 300_000_000 },
      { name: "Cricket", cat: "sports", n: 125_000_000 },
      { name: "Chess players", cat: "games", n: 605_000_000 },
      { name: "Reading clubs", cat: "literary", n: 38_000_000 },
      { name: "Music ensembles", cat: "music", n: 64_000_000 },
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
    { id: "f7", name: "Jonas Borg", init: "JB", rel: "writers' room", category: "acquaintances", since: "2024", match: 58, hue: 250, last: "Tue", note: "Reads Solnit, brings biscuits.", degrees: 2, favorite: false, interests: ["literary","thought","civic"],
      faves: { films: ["Stalker"], books: ["A Field Guide to Getting Lost"], music: ["Mount Eerie"] } },
  ],

  // Daily reports — only people who shared their daily.
  dailyReports: [
    { personId: "f1", date: "today",     mood: 72, moodLabel: "even-keel", weather: "raining steady · 9°", sleep: "7h 12m", moves: "ran 6.4 km along Akerselva", meal: "porridge · skyr · the last fig",                  one_line: "Found a heron at the railway bridge — stayed twenty minutes.", shared: ["mood","weather","moves","meal","one_line","sleep"] },
    { personId: "f2", date: "today",     mood: 64, moodLabel: "scattered",  weather: "wind · 11°",          sleep: null,     moves: null,                            meal: null,                                              one_line: "Bjørn made it through his first day at school without crying. I cried.", shared: ["mood","weather","one_line"] },
    { personId: "f4", date: "today",     mood: 81, moodLabel: "buoyant",    weather: "sun · 14°",           sleep: "8h 02m", moves: "garden · swam at Sørenga (cold)", meal: "sourdough · tomatoes · butter",                 one_line: "The plum tree has set fruit. Smaller than last year. Sweeter, I think.", shared: ["mood","weather","moves","meal","one_line","sleep"] },
    { personId: "f6", date: "today",     mood: 58, moodLabel: "tender",     weather: null,                  sleep: null,     moves: "walked at Bygdøy",              meal: null,                                              one_line: "Found Dad's handwriting in an old cookbook. Made his stew.", shared: ["mood","moves","one_line"] },
    { personId: "f5", date: "yesterday", mood: 75, moodLabel: "absorbed",   weather: null,                  sleep: null,     moves: "herbarium 4h",                  meal: null,                                              one_line: "Logged 32 specimens. The blue gentian is opening early this year.", shared: ["mood","moves","one_line"] },
  ],

  // Connections — pairs of person ids that know each other
  connections: [
    ["f1","f2"], ["f1","f4"], ["f2","f3"], ["f3","f4"], ["f1","p1"], ["f4","p4"], ["p1","p3"], ["p2","p3"], ["p1","p2"], ["p5","p3"], ["p4","p6"], ["f3","p5"]
  ],

  // Mood distribution: how many days at each level 1..5 over last 30 days
  moodDist: [2, 4, 9, 11, 4],

  // Aggregate profiles for comparison charts.
  // Each scope has: mood (1..5 distribution), big5 averages, political (econ, social), n (sample size)
  aggregates: {
    you: {
      label: "you",
      n: 1,
      mood: [2, 4, 9, 11, 4],          // your last 30 days
      moodAvg: 3.4,
      big5: { O: 78, C: 62, E: 41, A: 69, N: 28 },
      political: { econ: -22, social: -18 },
      mbti: "INFP",
    },
    circle: {
      label: "your circle",            // friends + people you follow
      n: 24,
      mood: [1, 3, 7, 10, 3],
      moodAvg: 3.5,
      big5: { O: 71, C: 58, E: 52, A: 64, N: 34 },
      political: { econ: -15, social: -12 },
      mbtiDist: { INFP: 5, ENFP: 4, INFJ: 3, INTP: 3, ISFP: 2, ENTP: 2, ENFJ: 2, ISTJ: 1, ISFJ: 1, OTHER: 1 },
    },
    city: {
      label: "Oslo",
      n: 1840,
      mood: [3, 5, 8, 10, 4],
      moodAvg: 3.3,
      big5: { O: 64, C: 65, E: 47, A: 62, N: 36 },
      political: { econ: -18, social: -8 },
      mbtiDist: { ISTJ: 14, ISFJ: 12, INFP: 10, INTJ: 8, INFJ: 7, ISTP: 8, ESTJ: 9, ESFJ: 9, ENFP: 7, INTP: 6, ENTP: 4, ENFJ: 3, OTHER: 3 },
    },
    world: {
      label: "the world",
      n: 184000,
      mood: [5, 7, 9, 7, 2],
      moodAvg: 2.9,
      big5: { O: 58, C: 60, E: 54, A: 60, N: 44 },
      political: { econ: 4, social: 6 },
      mbtiDist: { ISFJ: 14, ESFJ: 12, ISTJ: 11, ESTJ: 9, ESFP: 9, ISFP: 9, ENFP: 8, ISTP: 5, INFP: 4, ESTP: 4, ENTJ: 3, INTJ: 2, INFJ: 2, INTP: 3, ENFJ: 2, ENTP: 3 },
    },
    around: {
      label: "near you",
      n: 312,
      mood: [2, 3, 8, 12, 5],
      moodAvg: 3.6,
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

  insights: {
    moodWeek: [4, 3, 4, 5, 3, 4, 4],
    moodMonth: [3,4,3,2,4,4,5,3,4,5,4,3,4,4,5,4,3,4,4,5,3,4,5,4,4,3,4,5,4,4],
    sparkSwims: [1,0,2,1,2,1,2,2,1,3,2,2,1,2],
    sparkRuns: [2,1,2,3,2,3,1,2,3,2,3,2,3,3],
    sparkSpend: [40,22,55,30,18,72,45,28,60,35,48,30,55,42],
    yearGrid: Array.from({length: 7*26}, () => Math.random() < 0.78 ? Math.random() : 0),
    habits: [
      { name: "morning pages", streak: 14, done: true, hue: 38, week: [1,1,0,1,1,1,1] },
      { name: "fjord swim", streak: 6, done: true, hue: 220, week: [0,1,0,1,1,0,1] },
      { name: "no phone before 9am", streak: 3, done: false, hue: 12, week: [1,0,1,1,0,1,0] },
      { name: "walk after dinner", streak: 21, done: true, hue: 145, week: [1,1,1,1,1,1,1] },
    ],
    fitness: { steps: 8420, target: 10000, swims: 2, runs: 3 },
    nutrition: { kcal: 1840, target: 2100, water: 6, target_water: 8 },
    finance: { spent: 412, budget: 600, currency: "€", topCat: "books · 87" },
  },

  // Garmin (mock paired) — last 7 days of vitals + workouts
  body: {
    watch: { brand: "Garmin", model: "Fenix 7", paired: true, battery: 64, lastSync: "12 min ago" },
    shareWithCompare: false,
    today: {
      hr: 58, hrRest: 52, hrMax: 184,
      hrv: 64, hrvBaseline: 58,
      bodyBattery: 78,
      stress: 24,
      sleep: { hours: 7.4, deep: 1.2, rem: 1.6, light: 4.0, awake: 0.6, score: 82 },
      steps: 8420, stepsTarget: 10000,
      cals: 2310, calsActive: 540,
      vo2: 48, vo2Pct: 88,
      readiness: 84,
    },
    week: {
      sleep:    [7.1, 6.4, 7.8, 6.9, 7.4, 8.1, 7.4],
      hrv:      [56, 49, 62, 58, 64, 71, 64],
      stress:   [32, 41, 22, 28, 24, 18, 24],
      battery:  [72, 58, 86, 74, 78, 88, 78],
      readines: [78, 64, 88, 76, 82, 92, 84],
      steps:    [9200, 5400, 11800, 8100, 8420, 12400, 8420],
    },
    workouts: [
      { date: "Mon", type: "Trail run", dur: "48 min", dist: "7.2 km", hrAvg: 152, load: 64, hue: 38 },
      { date: "Wed", type: "Fjord swim", dur: "32 min", dist: "1.4 km", hrAvg: 138, load: 48, hue: 220 },
      { date: "Thu", type: "Strength", dur: "44 min", hrAvg: 118, load: 38, hue: 12 },
      { date: "Sat", type: "Long run", dur: "1 h 24", dist: "13.8 km", hrAvg: 156, load: 92, hue: 145 },
    ],
    hrZones: { z1: 14, z2: 38, z3: 24, z4: 12, z5: 4 }, // % of week
  },

  meals: {
    todayKcal: 1840,
    target: 2100,
    log: [
      {
        id: "m1", time: "08:14", name: "Sourdough, two eggs, avocado",
        kcal: 540, hue: 38,
        confidence: 0.86,
        macros: { carbs: 38, protein: 22, fat: 28, fiber: 6 },
        micro: [
          { k: "Vit. B12", pct: 64 }, { k: "Folate", pct: 42 }, { k: "Iron", pct: 24 },
          { k: "Vit. D", pct: 18 }, { k: "Magnesium", pct: 22 },
        ],
        breakdown: [
          { item: "sourdough · 2 slices", kcal: 220, hue: 38 },
          { item: "eggs · 2", kcal: 156, hue: 60 },
          { item: "avocado · ½", kcal: 120, hue: 145 },
          { item: "olive oil · drizzle", kcal: 44, hue: 80 },
        ],
        verdict: "A balanced morning — the avocado earns its place.",
      },
      {
        id: "m2", time: "12:48", name: "Mackerel, rye, cucumber",
        kcal: 480, hue: 220,
        confidence: 0.78,
        macros: { carbs: 32, protein: 34, fat: 22, fiber: 5 },
        micro: [
          { k: "Omega-3", pct: 142 }, { k: "Vit. D", pct: 88 }, { k: "Selenium", pct: 64 },
          { k: "Vit. B12", pct: 78 }, { k: "Protein", pct: 42 },
        ],
        breakdown: [
          { item: "smoked mackerel", kcal: 220, hue: 220 },
          { item: "rye bread", kcal: 180, hue: 38 },
          { item: "cucumber + dill", kcal: 28, hue: 145 },
          { item: "butter", kcal: 52, hue: 60 },
        ],
        verdict: "Nordic, almost ceremonial. Omega-3 well past target.",
      },
      {
        id: "m3", time: "16:02", name: "Black coffee, dark chocolate",
        kcal: 110, hue: 12,
        confidence: 0.92,
        macros: { carbs: 9, protein: 1, fat: 7, fiber: 2 },
        micro: [
          { k: "Antioxidants", pct: 38 }, { k: "Magnesium", pct: 14 }, { k: "Iron", pct: 8 },
        ],
        breakdown: [
          { item: "espresso", kcal: 4, hue: 12 },
          { item: "70% chocolate · 20g", kcal: 106, hue: 305 },
        ],
        verdict: "An afternoon comma. Brief, dark, deliberate.",
      },
      {
        id: "m4", time: "19:30", name: "Roasted root veg, lentils, tahini",
        kcal: 710, hue: 145,
        confidence: 0.74,
        macros: { carbs: 78, protein: 24, fat: 24, fiber: 14 },
        micro: [
          { k: "Fiber", pct: 56 }, { k: "Folate", pct: 88 }, { k: "Vit. C", pct: 64 },
          { k: "Iron", pct: 42 }, { k: "Magnesium", pct: 38 }, { k: "Potassium", pct: 48 },
        ],
        breakdown: [
          { item: "lentils · 1 cup", kcal: 230, hue: 145 },
          { item: "carrot, parsnip, beet", kcal: 220, hue: 38 },
          { item: "tahini drizzle", kcal: 140, hue: 60 },
          { item: "olive oil + herbs", kcal: 120, hue: 80 },
        ],
        verdict: "An autumn dish in spring. The fiber will thank you tomorrow.",
      },
    ],
    weekDist: { carbs: 46, protein: 22, fat: 32 }, // %
    weekKcal: [1980, 2240, 1620, 1840, 2080, 2310, 1840],
  },

  // Dream journal — 7 nights
  dreams: [
    { id: "d1", date: "Yesterday", title: "The brass elevator", lucidity: 2, vividness: 5, mood: "uneasy", hue: 220,
      tags: ["water", "elevator", "old house"],
      text: "An elevator made of brass, descending forever into a house I half-recognised. My grandmother's umbrella stand on every floor." },
    { id: "d2", date: "Tue", title: "Library underwater", lucidity: 4, vividness: 5, mood: "calm", hue: 200,
      tags: ["library", "water", "lucid"],
      text: "A library under shallow water. I noticed I was dreaming when the books didn't dissolve. I stayed and read." },
    { id: "d3", date: "Mon", title: "Dog with my voice", lucidity: 1, vividness: 4, mood: "tender", hue: 38,
      tags: ["animals", "voice"],
      text: "A small dog, white, that spoke in my own voice. It wanted to go home but didn't know where home was." },
    { id: "d4", date: "Sun", title: "—", lucidity: 0, vividness: 0, mood: "—", hue: 60,
      tags: [],
      text: "(no dream remembered)" },
    { id: "d5", date: "Sat", title: "Train station with no name", lucidity: 0, vividness: 3, mood: "anxious", hue: 305,
      tags: ["travel", "lost"],
      text: "Missing a train at a station I couldn't name. The signs kept changing language." },
    { id: "d6", date: "Fri", title: "Old apartment, new kitchen", lucidity: 2, vividness: 4, mood: "wistful", hue: 145,
      tags: ["home", "memory"],
      text: "Back in the apartment from 2014 but the kitchen had been replaced with one I'd never seen — already mine somehow." },
    { id: "d7", date: "Thu", title: "Singing on stage", lucidity: 0, vividness: 4, mood: "exposed", hue: 12,
      tags: ["performance", "fear"],
      text: "A stage I hadn't prepared for. The audience knew the words better than I did." },
  ],
  dreamThemes: { water: 4, home: 3, lost: 2, animals: 2, performance: 1, lucid: 1, memory: 3 },

  // Time use — today (24h, in minutes)
  time: {
    today: [
      { label: "Sleep", mins: 444, hue: 250, glyph: "☾" },
      { label: "Deep work", mins: 165, hue: 38, glyph: "✎" },
      { label: "Meetings", mins: 95, hue: 220, glyph: "○" },
      { label: "Reading", mins: 70, hue: 145, glyph: "▢" },
      { label: "Movement", mins: 58, hue: 12, glyph: "◐" },
      { label: "Eating", mins: 75, hue: 80, glyph: "◇" },
      { label: "Phone / scroll", mins: 132, hue: 305, glyph: "✕" },
      { label: "With others", mins: 85, hue: 60, glyph: "✦" },
      { label: "Errands", mins: 48, hue: 200, glyph: "↗" },
      { label: "Drift", mins: 268, hue: 180, glyph: "·" },
    ],
    weekHours: { sleep: 51.8, deep: 19.2, meetings: 11.1, reading: 8.2, movement: 6.8, phone: 15.4, others: 9.9 },
    intentions: { deep: 25, reading: 14, movement: 8, phone: 8 }, // weekly hour targets
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

  // Daily portrait — last 12 days
  portraits: [
    { date: "Today",     hue: 38,  weight: 74.2, mood: 4, note: "Slept well. The fjord light is back.", weather: "sun" },
    { date: "Yesterday", hue: 220, weight: 74.4, mood: 3, note: "Long meeting. Bone tired by four.",     weather: "rain" },
    { date: "Tue",       hue: 145, weight: 74.6, mood: 5, note: "Ran 7k before breakfast. Felt new.",     weather: "sun" },
    { date: "Mon",       hue: 60,  weight: 74.5, mood: 3, note: "Quiet day. Read most of it.",            weather: "cloud" },
    { date: "Sun",       hue: 305, weight: 74.8, mood: 4, note: "Eva called twice. Long bath.",            weather: "rain" },
    { date: "Sat",       hue: 12,  weight: 75.0, mood: 5, note: "Long run. The ridge was pure gold.",      weather: "sun" },
    { date: "Fri",       hue: 80,  weight: 74.9, mood: 4, note: "Dinner with Henrik. Drank one too many.", weather: "cloud" },
    { date: "Thu",       hue: 200, weight: 75.1, mood: 2, note: "Off. Couldn't write a sentence.",         weather: "rain" },
    { date: "Wed",       hue: 250, weight: 75.0, mood: 3, note: "Short walk, long thoughts.",              weather: "cloud" },
    { date: "Tue",       hue: 180, weight: 74.8, mood: 4, note: "Found a chapter that worked.",            weather: "sun" },
    { date: "Mon",       hue: 38,  weight: 74.7, mood: 4, note: "Fjord swim. Cold. Honest.",                weather: "sun" },
    { date: "Sun",       hue: 145, weight: 74.6, mood: 3, note: "—",                                       weather: "cloud" },
  ],

  // ─── FINANCE · AI bank-statement analysis ───
  financeAI: {
    bank: "Sparebanken Vest",
    account: "•• 4172 · checking",
    period: "Apr 1 – May 7, 2026",
    txCount: 142,
    totalIn: 4280,
    totalOut: 2418,
    net: 1862,
    avgDay: 71,
    byCategory: [
      { cat: "Rent · utilities",  amt: 1180, pct: 49, color: "var(--ink-2)",  trend: 0,    glyph: "▣" },
      { cat: "Groceries",         amt: 387,  pct: 16, color: "var(--sage)",   trend: -4,   glyph: "◇" },
      { cat: "Restaurants",       amt: 312,  pct: 13, color: "var(--accent)", trend: +24,  glyph: "✦" },
      { cat: "Cafés",             amt: 142,  pct: 6,  color: "var(--ochre)",  trend: +18,  glyph: "◐" },
      { cat: "Other",             amt: 127,  pct: 5,  color: "var(--ink-3)",  trend: -8,   glyph: "·" },
      { cat: "Transit",           amt: 94,   pct: 4,  color: "var(--indigo)", trend: -2,   glyph: "↗" },
      { cat: "Subscriptions",     amt: 89,   pct: 4,  color: "var(--ink-3)",  trend: 0,    glyph: "○" },
      { cat: "Books",             amt: 87,   pct: 3,  color: "var(--sienna)", trend: +12,  glyph: "▢" },
    ],
    recurring: [
      { name: "Spotify Family",   amt: 18.99, freq: "monthly", next: "May 14", note: "you're the only one using it lately", flag: "review" },
      { name: "Storytel",         amt: 12.99, freq: "monthly", next: "May 21", note: "no opens in 7 weeks — cancel?",        flag: "cancel" },
      { name: "Sats gym",         amt: 32.00, freq: "monthly", next: "May 1 (paid)", note: "you went 3× this month",          flag: "ok" },
      { name: "iCloud 200GB",     amt: 2.99,  freq: "monthly", next: "May 12", note: "",                                     flag: "ok" },
      { name: "Aftenposten",      amt: 22.00, freq: "monthly", next: "May 17", note: "",                                     flag: "ok" },
    ],
    anomalies: [
      { date: "Apr 22", merchant: "Maaemo",          amt: 940, kind: "unusual",   note: "5× larger than your typical restaurant spend." },
      { date: "Apr 30", merchant: "Apple Services",  amt: 49,  kind: "duplicate", note: "Looks like a duplicate of an earlier April charge." },
      { date: "Apr 12", merchant: "Kiwi · 3 visits", amt: 127, kind: "frequent",  note: "Three grocery runs in one day." },
    ],
    topMerchants: [
      { name: "Maaemo",                amt: 940, n: 1,  cat: "Restaurants" },
      { name: "Kiwi · groceries",      amt: 287, n: 11, cat: "Groceries" },
      { name: "Tim Wendelboe",         amt: 96,  n: 14, cat: "Cafés" },
      { name: "Tronsmo Bok",           amt: 87,  n: 4,  cat: "Books" },
      { name: "Ruter · transit",       amt: 79,  n: 22, cat: "Transit" },
      { name: "Vinmonopolet",          amt: 64,  n: 3,  cat: "Other" },
    ],
    // 33-day spend (one big spike on day 18 = Maaemo)
    daily: [38, 22, 45, 30, 18, 72, 45, 28, 60, 35, 48, 30, 55, 42, 38, 28, 50, 940, 32, 38, 42, 55, 28, 38, 40, 42, 30, 55, 42, 38, 38, 40, 42],
    // 6-month net flow (in - out) per month
    netHistory: [+820, +1240, -180, +640, +1102, +1862],
    netLabels: ["Dec","Jan","Feb","Mar","Apr","May"],
    insights: [
      { kind: "warm",    icon: "✦", title: "Restaurants up 24%",            body: "You ate out 7 times this period — last was 4. Maaemo accounts for 38% of that line." },
      { kind: "warm",    icon: "◑", title: "A subscription you've forgotten", body: "Storytel: seven weeks unopened. €12.99 / mo — €155 / year." },
      { kind: "good",    icon: "↘", title: "Groceries down a touch",        body: "Spending 4% less at Kiwi and Meny. The home cooking shows." },
      { kind: "neutral", icon: "○", title: "Café spend is your slowest leak", body: "€142 across 14 small visits — averaging four cafés a week. Worth knowing." },
      { kind: "good",    icon: "↗", title: "Net positive month",            body: "Income €4,280, spending €2,418. €1,862 sits at the end." },
    ],
    goals: [
      { label: "Restaurants under €200",  current: 312,  target: 200,  off: true  },
      { label: "Save €1,500 this month",  current: 1862, target: 1500, off: false },
      { label: "Coffee under €100",       current: 142,  target: 100,  off: true  },
    ],
    verdict: "A solid month with one expensive evening. If Maaemo were any other Tuesday, this would be your tightest spend in six.",
  },

  // ─── NUTRITION · deep ───
  nutritionDeep: {
    weekMacros: [
      { d: "Mon", carbs: 220, protein:  95, fat: 70, fiber: 28, kcal: 1980 },
      { d: "Tue", carbs: 280, protein:  88, fat: 80, fiber: 32, kcal: 2240 },
      { d: "Wed", carbs: 180, protein: 105, fat: 60, fiber: 22, kcal: 1620 },
      { d: "Thu", carbs: 210, protein:  92, fat: 75, fiber: 26, kcal: 1840 },
      { d: "Fri", carbs: 245, protein:  80, fat: 90, fiber: 24, kcal: 2080 },
      { d: "Sat", carbs: 295, protein:  95, fat: 95, fiber: 30, kcal: 2310 },
      { d: "Sun", carbs: 200, protein:  90, fat: 70, fiber: 28, kcal: 1840 },
    ],
    micronutrients: [
      { k: "Vit. C",     pct: 142, hue: 38  },
      { k: "Vit. D",     pct: 64,  hue: 60  },
      { k: "Vit. B12",   pct: 188, hue: 305 },
      { k: "Iron",       pct: 78,  hue: 12  },
      { k: "Magnesium",  pct: 92,  hue: 145 },
      { k: "Calcium",    pct: 70,  hue: 200 },
      { k: "Folate",     pct: 124, hue: 80  },
      { k: "Omega-3",    pct: 162, hue: 220 },
      { k: "Fiber",      pct: 110, hue: 45  },
      { k: "Potassium",  pct: 88,  hue: 180 },
      { k: "Zinc",       pct: 102, hue: 250 },
      { k: "Sodium",     pct: 142, hue: 12,  over: true },
    ],
    foodGroups: [
      { group: "Fish",              pct: 92, hue: 220 },
      { group: "Vegetables",        pct: 88, hue: 145 },
      { group: "Whole grains",      pct: 82, hue: 38  },
      { group: "Legumes",           pct: 64, hue: 12  },
      { group: "Fruit",             pct: 58, hue: 60  },
      { group: "Dairy",             pct: 44, hue: 200 },
      { group: "Sugar",             pct: 28, hue: 80  },
      { group: "Ultra-processed",   pct: 18, hue: 12  },
      { group: "Red meat",          pct: 12, hue: 305 },
    ],
    mealClock: [
      { hour: 8.2,  kcal: 540, label: "Breakfast", hue: 38  },
      { hour: 12.8, kcal: 480, label: "Lunch",     hue: 220 },
      { hour: 16.0, kcal: 110, label: "Snack",     hue: 12  },
      { hour: 19.5, kcal: 710, label: "Dinner",    hue: 145 },
    ],
    waterByHour: [
      { h: 7,  ml: 250 }, { h: 9,  ml: 180 }, { h: 11, ml: 0 },
      { h: 13, ml: 250 }, { h: 15, ml: 0 },   { h: 16, ml: 220 },
      { h: 18, ml: 180 }, { h: 20, ml: 250 }, { h: 22, ml: 120 },
    ],
    // 14-day eating window (start, end in hours)
    eatingWindow: [
      { d: "M", start: 7.5, end: 19.5 },
      { d: "T", start: 8.5, end: 20.0 },
      { d: "W", start: 7.0, end: 19.0 },
      { d: "T", start: 9.0, end: 21.5 },
      { d: "F", start: 7.5, end: 22.0 },
      { d: "S", start: 9.5, end: 21.0 },
      { d: "S", start: 8.5, end: 19.5 },
      { d: "M", start: 7.5, end: 19.0 },
      { d: "T", start: 8.0, end: 20.5 },
      { d: "W", start: 7.0, end: 19.5 },
      { d: "T", start: 8.5, end: 21.0 },
      { d: "F", start: 7.5, end: 22.5 },
      { d: "S", start: 9.5, end: 23.0 },
      { d: "S", start: 8.0, end: 19.5 },
    ],
    flags: [
      { kind: "low",   label: "Vit. D running low",     note: "Two weeks under 70%. Consider sun, salmon, or a supplement." },
      { kind: "good",  label: "Omega-3 generous",       note: "Mackerel weeks help. You're 62% over target." },
      { kind: "watch", label: "Calcium underplayed",    note: "Dairy intake is light — yogurt or sardines could close it." },
      { kind: "watch", label: "Sodium edging high",     note: "Mostly the rye and the smoked fish. Watch the soy sauce." },
    ],
    streaks: [
      { label: "5 servings veg",   d: 9 },
      { label: "Fish twice / wk",  d: 14 },
      { label: "No alcohol",       d: 4 },
    ],
    verdict: "Mostly Mediterranean, mostly home-cooked. Late dinners on Fri/Sat shorten your fasting window — by Monday the body knows.",
  },

  // ─── FITNESS · deep ───
  fitnessDeep: {
    zoneDist: [
      { z: "Z1", label: "Easy",      pct: 14, color: 'oklch(0.78 0.10 200)' },
      { z: "Z2", label: "Aerobic",   pct: 38, color: 'oklch(0.72 0.13 145)' },
      { z: "Z3", label: "Tempo",     pct: 24, color: 'oklch(0.65 0.15 80)'  },
      { z: "Z4", label: "Threshold", pct: 12, color: 'oklch(0.60 0.16 38)'  },
      { z: "Z5", label: "Max",       pct: 4,  color: 'oklch(0.52 0.18 12)'  },
    ],
    // 28 days of TSS-like training load (0 = rest)
    load28: [42, 38, 28, 55, 0, 68, 42, 32, 46, 0, 38, 55, 38, 42, 72, 0, 42, 28, 55, 42, 0, 68, 42, 38, 46, 55, 0, 82],
    ctl:    [38, 38, 38, 39, 39, 40, 40, 40, 41, 41, 42, 43, 44, 44, 45, 46, 46, 47, 48, 48, 49, 50, 51, 52, 53, 54, 55, 56],
    atl:    [42, 40, 35, 44, 32, 52, 48, 42, 44, 32, 38, 46, 42, 42, 56, 38, 38, 32, 46, 44, 30, 58, 52, 46, 48, 52, 38, 68],
    paceTrend: [340, 332, 336, 328, 322, 318, 320, 314, 312, 310, 308, 306, 305, 302], // sec/km, last 14 runs
    vo2Trend:  [44.5, 45.0, 45.8, 46.2, 46.8, 47.2, 47.6, 48.0],
    weekly: {
      labels:    ["W-7","W-6","W-5","W-4","W-3","W-2","W-1","this"],
      runDist:   [12.6, 13.2, 18.4, 14.1, 16.8, 19.2, 21.3, 23.1], // km
      swimDist:  [1.2,  0.8,  1.6,  1.4,  1.8,  2.1,  1.9,  2.4 ],
      strength:  [1, 0, 2, 1, 1, 2, 1, 2],
    },
    prs: [
      { name: "5 km",      val: "23:48",   date: "Apr 8",  trend: -4 },
      { name: "10 km",     val: "49:12",   date: "Mar 24", trend: -8 },
      { name: "Long run",  val: "21.3 km", date: "Mar 30", trend: +2 },
      { name: "Cold dip",  val: "12 min",  date: "Apr 14", trend: +1 },
      { name: "Resting HR", val: "52 bpm", date: "May 1",  trend: -2 },
    ],
    sportShare: [
      { sport: "Running",  pct: 52, hue: 38  },
      { sport: "Swimming", pct: 22, hue: 220 },
      { sport: "Strength", pct: 16, hue: 12  },
      { sport: "Walking",  pct: 10, hue: 145 },
    ],
    loadVerdict: { kind: "balanced", body: "ATL just above CTL — you're loading appropriately. Your legs have one more long run in them before the easy week." },
    // recovery scatter: workout load vs next-morning HRV delta (positive = recovered well)
    recoveryScatter: [
      { load: 28, hrv: +6,  d: "Mon" },
      { load: 48, hrv: +2,  d: "Wed" },
      { load: 38, hrv: -1,  d: "Thu" },
      { load: 92, hrv: -8,  d: "Sat" },
      { load: 64, hrv: +1,  d: "prev" },
      { load: 72, hrv: -4,  d: "prev" },
      { load: 22, hrv: +9,  d: "prev" },
      { load: 55, hrv: +3,  d: "prev" },
    ],
  },

  // ─── HABITS · deep ───
  habitsDeep: {
    thirtyDay: {
      "morning pages":     [1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1],
      "fjord swim":        [0,1,0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,1,1,0,1,0,0,1,1,0,1,1,1],
      "no phone before 9": [1,0,1,1,0,1,0,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,0,1,0,1,1,0,1],
      "walk after dinner": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    },
    byDow: {
      // Mon Tue Wed Thu Fri Sat Sun
      "morning pages":     [82,  95, 78, 85, 88, 70, 92],
      "fjord swim":        [25,  60, 35, 70, 45, 80, 75],
      "no phone before 9": [55,  60, 50, 55, 60, 80, 75],
      "walk after dinner": [95, 100, 95,100, 90,100,100],
    },
    timeOfDay: {
      "morning pages":     [0,0,0,0,0,0,0.10,0.85,0.95,0.60,0.20,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "fjord swim":        [0,0,0,0,0,0,0.20,0.80,0.40,0.10,0,0,0,0,0,0,0,0.10,0.30,0.20,0,0,0,0],
      "no phone before 9": [0,0,0,0,0,0,0.60,0.95,0.70,0.20,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "walk after dinner": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.40,0.95,0.70,0.20,0],
    },
    longestStreaks: {
      "morning pages":     { now: 14, best: 47 },
      "fjord swim":        { now: 6,  best: 22 },
      "no phone before 9": { now: 3,  best: 18 },
      "walk after dinner": { now: 21, best: 84 },
    },
    // correlations with mood, sleep, energy (-100..100)
    correl: [
      { habit: "fjord swim",        mood: 62, sleep: 24, energy: 70, hue: 220 },
      { habit: "morning pages",     mood: 38, sleep:  8, energy: 22, hue: 38  },
      { habit: "walk after dinner", mood: 28, sleep: 56, energy: 18, hue: 145 },
      { habit: "no phone before 9", mood: 42, sleep: 12, energy: 38, hue: 12  },
    ],
    // weekly completion % over last 12 weeks (per habit)
    trend12w: {
      "morning pages":     [62, 70, 74, 78, 70, 80, 82, 85, 88, 85, 90, 88],
      "fjord swim":        [20, 32, 28, 40, 45, 50, 48, 55, 60, 58, 62, 65],
      "no phone before 9": [40, 45, 38, 50, 48, 55, 52, 58, 62, 55, 60, 65],
      "walk after dinner": [85, 88, 92, 95, 92, 95, 98, 95, 98,100,100,100],
    },
    insights: [
      { icon: "↗", title: "Walk after dinner is unstoppable",  body: "21 days running, 84 best. Highest correlation with sleep score." },
      { icon: "◐", title: "Fjord swim → bright mood",           body: "On swim days mood averages 4.4 / 5. Without, 3.6." },
      { icon: "·", title: "Mondays are the weak link",         body: "Only 55% phone-discipline on Mondays. Saturday is strongest." },
      { icon: "✎", title: "Morning pages cluster at 8 a.m.",    body: "95% of days you've kept them, you wrote between 8 and 9." },
    ],
  },
};
