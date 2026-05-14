// Reference taxonomies + curated seed lists that the app still needs.
// Personal-data seed blocks (me/people/dailyReports/connections/aggregates/
// insights/body/meals/dreams/portraits/financeAI/nutritionDeep/fitnessDeep/
// habitsDeep/groups/financeExtra/around/earth/city/cityCountries/cityRegions/
// moodDist/media/time/life/skills/skillReach/groupReach/groupPopular) are gone
// — every overlay that used them was rewired to real hooks or honest empty-states.
//
// What stays:
//   nearby         — fallback discovery cast for AroundTab when geo finds no real users.
//   cityScoreCats  — fixed taxonomy of 8 city-rating dimensions.
//   cities         — curated editorial enrichment merged into useNearbyCities by name.
//   interestCats   — fixed taxonomy of interest categories (glyph + hue per category).
//   ideologies     — fixed taxonomy of political ideologies (econ/social coords).
//   ideologyMarks  — canonical thinker positions overlaid on the politics compass.
//   politicalAxes  — fixed taxonomy of the 6 political axis labels.
//   skillCats      — fixed taxonomy of skill categories.
//   groupTest      — fixed groups-tab questionnaire (the questions and options).

/* eslint-disable */
export const IS_DATA: any = {
  nearby: [
    { id: "p1", name: "Sigrid Bø", init: "SB", age: 29, dist: "0.4 km", match: 88, hue: 38, role: "ceramicist", interests: [{t:"pottery",c:"art"},{t:"fermentation",c:"food"},{t:"Murakami",c:"literary"},{t:"yoga",c:"fitness"}], values: "change · collective", note: "Reads the same authors. Walks at dusk." },
    { id: "p2", name: "Anders Lie", init: "AL", age: 34, dist: "0.7 km", match: 81, hue: 145, role: "violinist", interests: [{t:"chamber music",c:"music"},{t:"long runs",c:"fitness"},{t:"espresso",c:"food"},{t:"chess",c:"games"}], values: "tradition · individual", note: "Plays at Sentralen Thursdays." },
    { id: "p3", name: "Eira Nordli", init: "EN", age: 27, dist: "1.1 km", match: 76, hue: 220, role: "marine biologist", interests: [{t:"fjord swims",c:"outdoor"},{t:"field notes",c:"literary"},{t:"Solnit",c:"literary"},{t:"climbing",c:"fitness"}], values: "change · collective", note: "Cold-water swim group, Sundays 7am." },
    { id: "p4", name: "Tobias Krag", init: "TK", age: 31, dist: "1.4 km", match: 64, hue: 12, role: "bookbinder", interests: [{t:"letterpress",c:"art"},{t:"Tove Jansson",c:"literary"},{t:"rye bread",c:"food"},{t:"go",c:"games"}], values: "tradition · collective", note: "Workshop above Cafilosofen." },
    { id: "p5", name: "Mai Solberg", init: "MS", age: 26, dist: "2.0 km", match: 59, hue: 280, role: "data journalist", interests: [{t:"data viz",c:"tech"},{t:"kayaking",c:"outdoor"},{t:"matcha",c:"food"},{t:"tennis",c:"sports"}], values: "change · individual", note: "Often at Tim Wendelboe." },
    { id: "p6", name: "Jonas Ek", init: "JE", age: 38, dist: "2.6 km", match: 52, hue: 60, role: "carpenter", interests: [{t:"woodworking",c:"art"},{t:"trail running",c:"fitness"},{t:"Cohen",c:"music"},{t:"football",c:"sports"}], values: "tradition · individual", note: "Built half the cabins on Nesodden." },
  ],

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

};
