// Ported from design/spec-modules/world-feed-data.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// world-feed-data.js — the World question feed. Your SCENES (scenes.js) are the
// subscription: each scene has its own questions plus the broad topic it pulls
// from; channels (formats, not communities) are always on. The feed must never
// feel like an empty room: every stream ships stocked with live questions and
// believable vote counts.

// ── topic palette ── id doubles as the question's cat. Hues share one chroma tier.
// Named export alongside the global (D39's "convert on touch", the WPAL
// precedent): typed panels — ui/PatternsTab first — import the binding, so
// the coupling meter (rule 4) never counts them, while the nine spec
// consumers keep reading the global until their own touch converts them.
export const WORLD_TOPICS = [
  { id: 'sport',   label: 'Sport',          color: 'oklch(0.52 0.14 145)' },
  { id: 'food',    label: 'Food',           color: 'oklch(0.52 0.14 40)'  },
  { id: 'movies',  label: 'Movies & TV',    color: 'oklch(0.52 0.14 310)' },
  { id: 'music',   label: 'Music',          color: 'oklch(0.52 0.14 355)' },
  { id: 'tech',    label: 'Tech',           color: 'oklch(0.52 0.14 235)' },
  { id: 'culture', label: 'Culture',        color: 'oklch(0.52 0.14 200)' },
  { id: 'dilemma', label: 'Dilemmas',       color: 'oklch(0.52 0.14 25)'  },
  { id: 'event',   label: 'World events',   color: 'oklch(0.52 0.14 260)' },
  { id: 'people',  label: 'Famous people',  color: 'oklch(0.52 0.14 85)'  },
  { id: 'bigq',    label: 'Big questions',  color: 'oklch(0.52 0.14 290)' },
  { id: 'places',  label: 'Places',         color: 'oklch(0.52 0.14 60)'  },
  // catalogue picks are a FORMAT, not a subject — so they live on a channel, the
  // same way dilemmas and rankings do. It also means they always have a home:
  // 'movies' has no scene pointing at it, so a film question filed under it can
  // never reach the feed.
  { id: 'fav',     label: 'Favourites',     color: 'oklch(0.52 0.14 170)' },
];
window.WORLD_TOPICS = WORLD_TOPICS;

// ── channels ── always-on formats (not communities); they follow your scenes in the chip row
//
// …in the DEMO, where the subject topics (sport, food, …) reach the feed
// through the communities that pull them. A live build offers no communities
// (D96) and its bank tags questions with exactly those subjects — so with the
// demo list, most of the seeded bank sat behind a door that no longer exists:
// no chip, no follow, no search result could surface it. Until scenes have a
// real backend, a live build runs every SUBJECT always-on; the chips' mute is
// unchanged, so the coarse control a follow used to give is still there. The
// two formats with no live stock stay out of the live row — the bank mapper
// (data/live.ts) emits plain votes only, so `places` (rate cards) and `fav`
// (catalogue picks) would be dead chips filtering nothing. Build flag rather
// than window.LIVE.enabled for learn-progress.js's reason: this runs at
// module scope, before the live boot attaches — and the demoInProd fallback
// needs the widening too, because a live build seeds zero follows and its
// demo-pool fallback had the same dark subjects.
const WFD_LIVE_BUILD = import.meta.env && import.meta.env.VITE_V2_LIVE === 'true';
window.WORLD_CHANNELS = WFD_LIVE_BUILD
  ? window.WORLD_TOPICS.filter((t) => t.id !== 'places' && t.id !== 'fav').map((t) => t.id)
  : ['dilemma', 'event', 'people', 'bigq', 'places', 'fav'];

// ── question pool ──
// type: 'vote' (pick one, see the split) · 'rank' (order the items, compare
// with the crowd) · 'duel' (two image tiles head-to-head).
// duel options take an optional `img:` (any URL or local path) — the tile holds
// its own aspect ratio and fades the photo up once decoded, so dropping real
// imagery in never shifts layout. Without one, the generated tile art stands in.
// One treatment is applied in CSS (.wf-tileimg), not per photo.
// rank: items + crowd, where crowd[i] = the crowd's rank (1-based) of items[i].
window.WORLD_FEED_QS = [
  // sport
  { id: 'f01', cat: 'sport', type: 'duel', prompt: 'The better night in front of the TV?', options: [ { label: 'Champions League final', count: 6300 }, { label: 'Super Bowl', count: 4900 } ] },
  { id: 'f02', cat: 'sport', type: 'vote', prompt: 'Would you rather win\u2026', options: [ { label: 'Olympic gold', count: 4100 }, { label: 'The World Cup', count: 5600 } ] },
  { id: 'f03', cat: 'sport', type: 'rank', prompt: 'Pure athleticism \u2014 rank them', items: ['Gymnasts', 'Sprinters', 'Swimmers', 'Climbers'], crowd: [1, 2, 4, 3], votes: 2900 },
  { id: 'f04', cat: 'sport', type: 'vote', prompt: 'VAR made football better.', options: [ { label: 'Better', count: 3800 }, { label: 'Worse', count: 5200 } ] },
  { id: 'f05', cat: 'sport', type: 'vote', prompt: 'Best sport to watch live in a stadium', options: [ { label: 'Football', count: 6900 }, { label: 'Basketball', count: 3100 }, { label: 'Tennis', count: 1400 } ] },
  { id: 'f06', cat: 'sport', type: 'vote', prompt: 'E-sports are real sports.', options: [ { label: 'They are', count: 4700 }, { label: 'They\u2019re not', count: 5300 } ] },
  { id: 'f07', cat: 'sport', type: 'vote', prompt: 'Your team wins it all \u2014 but you can never watch them again. Deal?', options: [ { label: 'Take it', count: 3900 }, { label: 'Never', count: 4800 } ] },

  // food
  { id: 'f08', cat: 'food', type: 'duel', prompt: 'One cuisine forever', options: [ { label: 'Italian', count: 7800 }, { label: 'Japanese', count: 6400 } ] },
  { id: 'f09', cat: 'food', type: 'vote', prompt: 'Milk before cereal is a crime.', options: [ { label: 'A crime', count: 6100 }, { label: 'It\u2019s fine', count: 2600 } ] },
  { id: 'f10', cat: 'food', type: 'rank', prompt: 'Rank the potato formats', items: ['Fries', 'Roasted', 'Mashed', 'Crisps'], crowd: [1, 2, 4, 3], votes: 5200 },
  { id: 'f11', cat: 'food', type: 'vote', prompt: 'Would you eat lab-grown meat?', options: [ { label: 'Sure', count: 5900 }, { label: 'Never', count: 3800 } ] },
  { id: 'f12', cat: 'food', type: 'vote', prompt: 'A free pill replaces all meals. Food becomes hobby-only. Take it?', options: [ { label: 'Take it', count: 2400 }, { label: 'Keep meals', count: 8100 } ] },
  { id: 'f13', cat: 'food', type: 'duel', prompt: 'Final dessert on earth', options: [ { label: 'Tiramisu', count: 5100 }, { label: 'Cheesecake', count: 4700 } ] },
  { id: 'f14', cat: 'food', type: 'vote', prompt: 'Spicy food: worth the pain?', options: [ { label: 'Always', count: 6600 }, { label: 'No pain please', count: 2900 } ] },

  // movies & tv
  { id: 'f15', cat: 'movies', type: 'vote', prompt: 'The book is always better.', options: [ { label: 'Always', count: 3400 }, { label: 'Not always', count: 6200 } ] },
  { id: 'f16', cat: 'movies', type: 'rank', prompt: 'Rank by rewatchability', items: ['Comedies', 'Thrillers', 'Sci-fi', 'Documentaries'], crowd: [1, 3, 2, 4], votes: 3100 },
  { id: 'f17', cat: 'movies', type: 'duel', prompt: 'One world to live in', options: [ { label: 'Space opera', count: 4300 }, { label: 'Cozy fantasy', count: 5600 } ] },
  { id: 'f18', cat: 'movies', type: 'vote', prompt: 'Watching at 1.5\u00d7 speed is disrespectful.', options: [ { label: 'Disrespectful', count: 4800 }, { label: 'Efficient', count: 4100 } ] },
  { id: 'f19', cat: 'movies', type: 'vote', prompt: 'The ideal movie length', options: [ { label: '90 minutes', count: 4500 }, { label: 'Two hours', count: 5200 }, { label: 'Three-hour epic', count: 1300 } ] },
  { id: 'f20', cat: 'movies', type: 'vote', prompt: 'Spoilers ruin nothing for a good story.', options: [ { label: 'True', count: 2700 }, { label: 'Heresy', count: 7300 } ] },

  // music
  { id: 'f21', cat: 'music', type: 'vote', prompt: 'Great lyrics or great melody?', options: [ { label: 'Lyrics', count: 3900 }, { label: 'Melody', count: 6800 } ] },
  { id: 'f22', cat: 'music', type: 'rank', prompt: 'Rank the live music', items: ['Stadium show', 'Festival', 'Small club', 'Living-room gig'], crowd: [3, 2, 1, 4], votes: 2400 },
  { id: 'f23', cat: 'music', type: 'vote', prompt: 'Vinyl actually sounds better.', options: [ { label: 'It does', count: 3100 }, { label: 'It\u2019s the ritual', count: 4900 } ] },
  { id: 'f24', cat: 'music', type: 'vote', prompt: 'Music while working?', options: [ { label: 'Always', count: 4400 }, { label: 'Instrumental only', count: 3200 }, { label: 'Silence', count: 1900 } ] },
  { id: 'f25', cat: 'music', type: 'duel', prompt: 'One decade of music forever', options: [ { label: 'The 70s', count: 4600 }, { label: 'The 2000s', count: 5100 } ] },

  // tech
  { id: 'f26', cat: 'tech', type: 'vote', prompt: 'Brain-computer interface, once it\u2019s proven safe?', options: [ { label: 'Plug me in', count: 3600 }, { label: 'Absolutely not', count: 6100 } ] },
  { id: 'f27', cat: 'tech', type: 'vote', prompt: 'Phones should be banned in schools.', options: [ { label: 'Ban them', count: 6400 }, { label: 'Teach with them', count: 3300 } ] },
  { id: 'f28', cat: 'tech', type: 'rank', prompt: 'Which would you give up last?', items: ['Messaging', 'Maps', 'Music streaming', 'Social feeds'], crowd: [1, 2, 3, 4], votes: 4800 },
  { id: 'f29', cat: 'tech', type: 'vote', prompt: 'Delete all your data and start clean, or keep everything forever?', options: [ { label: 'Clean slate', count: 5700 }, { label: 'Keep it all', count: 3900 } ] },
  { id: 'f30', cat: 'tech', type: 'vote', prompt: 'A robot does your chores but records everything. Deal?', options: [ { label: 'Deal', count: 3500 }, { label: 'No deal', count: 5800 } ] },
  { id: 'f31', cat: 'tech', type: 'vote', prompt: 'Would you ride a driverless taxi tonight?', options: [ { label: 'Get in', count: 4900 }, { label: 'Not yet', count: 4400 } ] },

  // culture
  { id: 'f32', cat: 'culture', type: 'vote', prompt: 'Tipping should be abolished.', options: [ { label: 'Abolish it', count: 6800 }, { label: 'Keep it', count: 3600 } ] },
  { id: 'f33', cat: 'culture', type: 'vote', prompt: 'Ten minutes early or exactly on time?', options: [ { label: 'Early', count: 6200 }, { label: 'On the dot', count: 3500 } ] },
  { id: 'f34', cat: 'culture', type: 'rank', prompt: 'Rank the perfect weekend', items: ['Slow morning', 'Big night out', 'Day trip', 'Full-reset clean'], crowd: [1, 3, 2, 4], votes: 3300 },
  { id: 'f35', cat: 'culture', type: 'vote', prompt: 'The best age to be', options: [ { label: '18', count: 1900 }, { label: '30', count: 6100 }, { label: '50', count: 2200 }, { label: '75', count: 800 } ] },
  { id: 'f36', cat: 'culture', type: 'duel', prompt: 'The view from your window, forever', options: [ { label: 'Ocean', count: 5400 }, { label: 'Mountains', count: 5200 } ] },
  { id: 'f37', cat: 'culture', type: 'vote', prompt: 'Small talk is a skill, not a chore.', options: [ { label: 'A skill', count: 4700 }, { label: 'A chore', count: 4100 } ] },

  // dilemmas
  { id: 'f38', cat: 'dilemma', type: 'vote', prompt: 'Read minds \u2014 but everyone knows you can. Take it?', options: [ { label: 'Take it', count: 2600 }, { label: 'Pass', count: 7900 } ] },
  { id: 'f39', cat: 'dilemma', type: 'vote', prompt: '$1M now, but a stranger somewhere loses everything. Press the button?', options: [ { label: 'Press', count: 1400 }, { label: 'Never', count: 9800 } ] },
  { id: 'f40', cat: 'dilemma', type: 'vote', prompt: 'Would you want to know the date of your death?', options: [ { label: 'Tell me', count: 2900 }, { label: 'Never', count: 8400 } ] },
  { id: 'f41', cat: 'dilemma', type: 'vote', prompt: 'Five years in a job you hate, then never work again?', options: [ { label: 'Take the deal', count: 6600 }, { label: 'Keep working', count: 4100 } ] },
  { id: 'f42', cat: 'dilemma', type: 'vote', prompt: 'Restart life at 10, everything you know intact?', options: [ { label: 'Restart', count: 5100 }, { label: 'Stay here', count: 5600 } ] },
  { id: 'f43', cat: 'dilemma', type: 'vote', prompt: 'Perfect memory \u2014 but you can never forget anything. Take it?', options: [ { label: 'Take it', count: 3300 }, { label: 'Keep forgetting', count: 6200 } ] },
  { id: 'f44', cat: 'dilemma', type: 'vote', prompt: 'Your dog talks for one day, or understands you forever?', options: [ { label: 'Talks one day', count: 2800 }, { label: 'Understands forever', count: 7700 } ] },

  // world events
  { id: 'f45', cat: 'event', type: 'vote', prompt: 'Should voting be mandatory?', options: [ { label: 'Mandatory', count: 3900 }, { label: 'A right, not a duty', count: 5600 } ] },
  { id: 'f46', cat: 'event', type: 'vote', prompt: 'Four-day work week: inevitable or fantasy?', options: [ { label: 'Inevitable', count: 7200 }, { label: 'Fantasy', count: 2700 } ] },
  { id: 'f47', cat: 'event', type: 'vote', prompt: 'City centers should be car-free.', options: [ { label: 'Car-free', count: 5800 }, { label: 'Keep cars', count: 3900 } ] },
  { id: 'f48', cat: 'event', type: 'vote', prompt: 'Would you move to another country for good?', options: [ { label: 'I\u2019d go', count: 5400 }, { label: 'Home is home', count: 4700 } ] },

  // famous people
  { id: 'f49', cat: 'people', type: 'vote', prompt: 'Judge the art apart from the artist?', options: [ { label: 'Separate them', count: 4600 }, { label: 'Can\u2019t separate', count: 4900 } ] },
  { id: 'f50', cat: 'people', type: 'vote', prompt: 'Celebrities should stay out of politics.', options: [ { label: 'Stay out', count: 4200 }, { label: 'Speak up', count: 5100 } ] },
  { id: 'f51', cat: 'people', type: 'vote', prompt: 'Dinner with one', options: [ { label: 'A scientist you admire', count: 3600 }, { label: 'A musician you love', count: 4100 }, { label: 'A leader you\u2019d grill', count: 2500 } ] },

  // big questions
  { id: 'f52', cat: 'bigq', type: 'vote', prompt: 'Free will is an illusion.', options: [ { label: 'An illusion', count: 4100 }, { label: 'It\u2019s real', count: 5200 } ] },
  { id: 'f53', cat: 'bigq', type: 'vote', prompt: 'We\u2019re not alone in the universe.', options: [ { label: 'Not alone', count: 8600 }, { label: 'Just us', count: 1700 } ] },
  { id: 'f54', cat: 'bigq', type: 'vote', prompt: 'Money can buy happiness.', options: [ { label: 'It can', count: 5500 }, { label: 'It can\u2019t', count: 4300 } ] },
  { id: 'f55', cat: 'bigq', type: 'vote', prompt: 'Humanity\u2019s best days are ahead.', options: [ { label: 'Ahead', count: 6100 }, { label: 'Behind', count: 3600 } ] },
  { id: 'f56', cat: 'bigq', type: 'rank', prompt: 'What matters most \u2014 rank them', items: ['People', 'Meaning', 'Pleasure', 'Legacy'], crowd: [1, 2, 3, 4], votes: 3800 },

  // \u2500\u2500 dials & fields \u2500\u2500 continuum answers.
  // dial: a value on a range \u2014 dist: 12 crowd buckets lo\u2192hi, med: crowd median.
  // (dl1\u2013dl4 filed under always-on channels \u2014 bigq/dilemma \u2014 so they reach
  // every demo feed; later dials keep the topic their batch allocated)
  // field: a dot on a 2D plane \u2014 ax/ay: axis end labels, cloud: [x, y, count,
  // spread] clusters in 0\u2013100 coords (y runs 0=top), n: answers.
  { id: 'dl1', cat: 'bigq', type: 'dial', prompt: 'When does old age begin?', lo: 40, hi: 90, unit: 'yrs', med: 63, n: 5200, dist: [1, 3, 5, 9, 14, 18, 17, 13, 9, 6, 3, 2] },
  { id: 'dl2', cat: 'dilemma', type: 'dial', prompt: 'The right tip', lo: 0, hi: 30, unit: '%', med: 10, n: 7400, dist: [6, 9, 14, 18, 16, 12, 9, 6, 4, 3, 2, 1] },
  { id: 'dl3', cat: 'dilemma', type: 'dial', prompt: 'Daily screen time \u2014 where does \u201ctoo much\u201d start?', lo: 1, hi: 12, unit: 'h', med: 5, n: 6100, dist: [2, 6, 12, 17, 18, 14, 10, 4, 3, 2, 1, 1] },
  { id: 'dl4', cat: 'bigq', type: 'dial', prompt: 'How much of your life is actually in your control?', lo: 0, hi: 100, unit: '%', med: 55, n: 4800, dist: [4, 6, 8, 9, 10, 12, 14, 13, 10, 7, 4, 3] },
  { id: 'dl5', cat: 'event', type: 'dial', prompt: 'How many years until a human walks on Mars?', lo: 0, hi: 100, unit: 'yrs', med: 28, n: 4700, dist: [2, 9, 16, 18, 14, 10, 7, 5, 4, 3, 3, 9] },
  { id: 'fd1', cat: 'dilemma', type: 'field', prompt: 'Pineapple on pizza \u2014 place it', ax: ['tastes bad', 'tastes good'], ay: ['a crime', 'high art'], n: 6800, cloud: [[22, 72, 10, 14], [76, 26, 12, 15], [54, 50, 4, 10]] },
  { id: 'fd2', cat: 'bigq', type: 'field', prompt: 'Small talk \u2014 place it', ax: ['painful', 'pleasant'], ay: ['pointless', 'essential'], n: 4100, cloud: [[64, 32, 12, 16], [30, 60, 8, 14], [50, 48, 6, 12]] },
  { id: 'fd3', cat: 'bigq', type: 'field', prompt: 'AI assistants, today \u2014 place them', ax: ['overhyped', 'underrated'], ay: ['scary', 'exciting'], n: 5600, cloud: [[42, 38, 10, 16], [68, 30, 8, 13], [30, 66, 7, 12]] },

  // ── scene questions ── asked inside one scene; counts are community-scale
  { id: 's01', scene: 'tennis', cat: 'sport', type: 'vote', prompt: 'Doubles or singles?', options: [ { label: 'Doubles', count: 1900 }, { label: 'Singles', count: 2600 } ] },
  { id: 's02', scene: 'tennis', cat: 'sport', type: 'vote', prompt: 'Pick your surface', options: [ { label: 'Clay', count: 1400 }, { label: 'Grass', count: 1100 }, { label: 'Hard court', count: 2100 } ] },
  { id: 's03', scene: 'tennis', cat: 'sport', type: 'vote', prompt: 'Line judges or full electronic calls?', options: [ { label: 'Keep humans', count: 1300 }, { label: 'All electronic', count: 2400 } ] },
  { id: 's04', scene: 'swim', cat: 'sport', type: 'vote', prompt: 'Cold water: wetsuit or skin?', options: [ { label: 'Wetsuit', count: 1200 }, { label: 'Skin', count: 900 } ] },
  { id: 's05', scene: 'swim', cat: 'sport', type: 'rank', prompt: 'Rank the strokes', items: ['Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly'], crowd: [1, 2, 3, 4], votes: 800 },
  { id: 's06', scene: 'swim', cat: 'sport', type: 'vote', prompt: 'Pool or open water?', options: [ { label: 'Pool', count: 700 }, { label: 'Open water', count: 1600 } ] },
  { id: 's07', scene: 'writers', cat: 'culture', type: 'vote', prompt: 'First drafts: longhand or keyboard?', options: [ { label: 'Longhand', count: 800 }, { label: 'Keyboard', count: 1100 } ] },
  { id: 's08', scene: 'writers', cat: 'culture', type: 'vote', prompt: 'Plot it all, or find it as you write?', options: [ { label: 'Plot it', count: 700 }, { label: 'Find it', count: 1200 } ] },
  { id: 's09', scene: 'writers', cat: 'culture', type: 'vote', prompt: 'Can great writing be taught?', options: [ { label: 'Taught', count: 900 }, { label: 'Only sharpened', count: 600 } ] },
  { id: 's10', scene: 'philos', cat: 'bigq', type: 'vote', prompt: 'The Ship of Theseus, fully replaced \u2014 same ship?', options: [ { label: 'Same ship', count: 500 }, { label: 'A new ship', count: 480 } ] },
  { id: 's11', scene: 'philos', cat: 'bigq', type: 'vote', prompt: 'Is morality discovered or invented?', options: [ { label: 'Discovered', count: 400 }, { label: 'Invented', count: 600 } ] },
  { id: 's12', scene: 'philos', cat: 'bigq', type: 'vote', prompt: 'A perfectly happy simulated life \u2014 plug in?', options: [ { label: 'Plug in', count: 300 }, { label: 'Stay real', count: 800 } ] },
  { id: 's13', scene: 'chess', cat: 'bigq', type: 'vote', prompt: 'Blitz or classical?', options: [ { label: 'Blitz', count: 2100 }, { label: 'Classical', count: 1600 } ] },
  { id: 's14', scene: 'chess', cat: 'bigq', type: 'vote', prompt: 'Best first move', options: [ { label: 'e4', count: 2600 }, { label: 'd4', count: 1700 }, { label: 'Something weird', count: 500 } ] },
  { id: 's15', scene: 'chess', cat: 'bigq', type: 'vote', prompt: 'A draw offer from a stronger player \u2014 take it?', options: [ { label: 'Take it', count: 900 }, { label: 'Play on', count: 1400 } ] },
  { id: 's16', scene: 'ferment', cat: 'food', type: 'vote', prompt: 'Your sourdough starter deserves a name.', options: [ { label: 'Named, obviously', count: 1100 }, { label: 'It\u2019s yeast', count: 700 } ] },
  { id: 's17', scene: 'ferment', cat: 'food', type: 'vote', prompt: 'Kombucha or kefir?', options: [ { label: 'Kombucha', count: 900 }, { label: 'Kefir', count: 600 } ] },
];

// the scorecard 'rate' questions (place-stats.js) join the pool
if (window.PLACE_RATE_QS) window.WORLD_FEED_QS = window.WORLD_FEED_QS.concat(window.PLACE_RATE_QS);
// …and the catalogue 'pick' questions (pick-data.js)
if (window.PICK_QS) window.WORLD_FEED_QS = window.WORLD_FEED_QS.concat(window.PICK_QS);
