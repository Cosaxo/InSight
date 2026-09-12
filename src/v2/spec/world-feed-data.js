// Ported from design/spec-modules/world-feed-data.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
// The imported binding, not `window.LIVE` — the seam world-feed.jsx already
// uses, and the reason joinDemoStock below can ask whether this session is
// on live data without adding a shared-global reference the rule-4 ratchet
// would count. data/live is eager either way (main.jsx imports initLive),
// and it imports nothing from spec/, so this closes no cycle.
import LIVE from '../data/live.ts';

// world-feed-data.js — the World question feed. Your SCENES (scenes.js) are the
// subscription: each scene has its own questions plus the broad topic it pulls
// from; channels (formats, not communities) are always on. The feed must never
// feel like an empty room: every stream ships stocked with live questions and
// believable vote counts.

// ── topic palette ── moved to world-feed-topics.js so that daily-split.jsx
// (eager) can have the thirteen rows without this file's demo pool riding
// into first paint with them. Re-exported, so every existing consumer of
// `WORLD_TOPICS` from here is unchanged.
export { WORLD_TOPICS } from './world-feed-topics.js';
import { WORLD_TOPICS } from './world-feed-topics.js';

// ── channels ── always-on formats (not communities); they follow your scenes in the chip row
//
// …in the DEMO, where the subject topics (sport, food, …) reach the feed
// through the communities that pull them. A live build offers no communities
// (D96) and its bank tags questions with exactly those subjects — so with the
// demo list, most of the seeded bank sat behind a door that no longer exists:
// no chip, no follow, no search result could surface it. Until scenes have a
// real backend, a live build runs every SUBJECT always-on; the chips' mute is
// unchanged, so the coarse control a follow used to give is still there.
// `fav` rides the live row since D14 went live — the bank mapper emits pick
// cards from the seeded catalog questions, so the chip filters real stock.
// `places` alone stays out: rate cards are still demo-only, and a chip over
// no stock would be a dead filter. Build flag rather
// than window.LIVE.enabled for learn-progress.js's reason: this runs at
// module scope, before the live boot attaches — and the demoInProd fallback
// needs the widening too, because a live build seeds zero follows and its
// demo-pool fallback had the same dark subjects.
const WFD_LIVE_BUILD = import.meta.env && import.meta.env.VITE_V2_LIVE === 'true';
// No window mirror (D249): world-feed.jsx was the only reader.
export const WORLD_CHANNELS = WFD_LIVE_BUILD
  ? WORLD_TOPICS.filter((t) => t.id !== 'places').map((t) => t.id)
  : ['dilemma', 'event', 'people', 'bigq', 'places', 'fav', 'pulse'];

// ── question pool ──
// type: 'vote' (pick one, see the split) · 'rank' (order the items, compare
// with the crowd) · 'duel' (two image tiles head-to-head).
// duel options take an optional `img:` (any URL or local path) — the tile holds
// its own aspect ratio and fades the photo up once decoded, so dropping real
// imagery in never shifts layout. Without one, the generated tile art stands in.
// One treatment is applied in CSS (.wf-tileimg), not per photo.
// rank: items + crowd, where crowd[i] = the crowd's rank (1-based) of items[i].
// EAGER, and this assignment is the second reason why (the first is
// daily-split.jsx reading window.WORLD_TOPICS at module scope — see
// spec-index.js). It replaces the pool unconditionally, which is safe only
// because this module runs BEFORE `initLive`: in live mode
// `buildFeedGlobals` then overwrites it. Deferring this file would put an
// unguarded clobber after the live boot, which is exactly what
// `joinDemoStock` and `installSubtopicStock` exist to avoid — so if it ever
// moves, this line moves behind `demoPoolOpen()` with them.
// GUARDED, and this is the line the note above said would have to move.
// The pool is DEMO stock: on a live build `buildFeedGlobals` (data/live.ts)
// publishes the real feed to this same global. While this file was eager it
// ran BEFORE `initLive` and the clobber was harmless; now that it loads from
// loadWorldFeed() — after the live boot — an unguarded assignment would
// overwrite the real feed with invented questions. `demoPoolOpen()` is the
// one definition of that test, shared with joinDemoStock and
// installSubtopicStock for exactly this reason.
const WFD_DEMO_POOL = [
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
  // (The two Crossroads stubs used to sit here — the prototype's pair were
  // both dilemmas. D413 retired those stories and the demo pool now
  // carries two of the bank's, filed under their own genres: 'blackout'
  // opens the world events group and 'capsule' closes big questions.)
  { id: 'f38', cat: 'dilemma', type: 'vote', prompt: 'Read minds \u2014 but everyone knows you can. Take it?', options: [ { label: 'Take it', count: 2600 }, { label: 'Pass', count: 7900 } ] },
  { id: 'f39', cat: 'dilemma', type: 'vote', prompt: '$1M now, but a stranger somewhere loses everything. Press the button?', options: [ { label: 'Press', count: 1400 }, { label: 'Never', count: 9800 } ] },
  { id: 'f40', cat: 'dilemma', type: 'vote', prompt: 'Would you want to know the date of your death?', options: [ { label: 'Tell me', count: 2900 }, { label: 'Never', count: 8400 } ] },
  { id: 'f41', cat: 'dilemma', type: 'vote', prompt: 'Five years in a job you hate, then never work again?', options: [ { label: 'Take the deal', count: 6600 }, { label: 'Keep working', count: 4100 } ] },
  { id: 'f42', cat: 'dilemma', type: 'vote', prompt: 'Restart life at 10, everything you know intact?', options: [ { label: 'Restart', count: 5100 }, { label: 'Stay here', count: 5600 } ] },
  { id: 'f43', cat: 'dilemma', type: 'vote', prompt: 'Perfect memory \u2014 but you can never forget anything. Take it?', options: [ { label: 'Take it', count: 3300 }, { label: 'Keep forgetting', count: 6200 } ] },
  { id: 'f44', cat: 'dilemma', type: 'vote', prompt: 'Your dog talks for one day, or understands you forever?', options: [ { label: 'Talks one day', count: 2800 }, { label: 'Understands forever', count: 7700 } ] },

  // world events
  // The two Crossroads stories ride the pool as members (D341) — a story is
  // a feed question, placed by the mix like everything else, and both can
  // be on screen at once. Only what the feed mechanics read lives here (id,
  // home topic, a prompt for search and the pass row); the CONTENT is
  // paths-data.js's, resolved by id at render (paths-card.jsx srcOf), so
  // the story is written once. Each stub's genre is ALSO an always-on
  // channel ('event' here, 'bigq' for the other), which is what keeps them
  // reachable with no scene followed. One early in its group and one deep
  // in a later one on purpose: the mix serves streams round-robin, so the
  // reader meets the first story a few cards in and the second a couple of
  // screens later — not stacked, not pinned.
  { id: 'blackout', cat: 'event', type: 'path', prompt: 'The Blackout' },
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
  { id: 'capsule', cat: 'bigq', type: 'path', prompt: 'The Time Capsule' },

  // \u2500\u2500 dials & fields \u2500\u2500 continuum answers.
  // dial: a value on a range \u2014 dist: 12 crowd buckets lo\u2192hi, med: crowd median.
  // (dl1\u2013dl4 filed under always-on channels \u2014 bigq/dilemma \u2014 so they reach
  // every demo feed; later dials keep the topic their batch allocated.
  // Ranges: whole units per bucket where the unit allows \u2014 a step under
  // one unit prints twin labels like "18\u201318 h", D358.)
  // dl30\u2013dl43 (D358) are the WIDENED twins of dl3, dl6\u2013dl8 and dl10\u2013dl19:
  // a shipped range is frozen with its bucket labels (D114), so the old
  // ids retired (`active: false` in content/feed-questions.json) and the
  // same copy came back under a new id on the wider range. The demo pool
  // carries only the live id \u2014 a retired dial has no card to draw.
  // field: a dot on a 2D plane \u2014 ax/ay: axis end labels, cloud: [x, y, count,
  // spread] clusters in 0\u2013100 coords (y runs 0=top), n: answers.
  { id: 'dl1', cat: 'bigq', type: 'dial', prompt: 'When does old age begin?', lo: 40, hi: 90, unit: 'yrs', med: 63, n: 5200, dist: [1, 3, 5, 9, 14, 18, 17, 13, 9, 6, 3, 2] },
  { id: 'dl2', cat: 'dilemma', type: 'dial', prompt: 'The right tip', lo: 0, hi: 30, unit: '%', med: 10, n: 7400, dist: [6, 9, 14, 18, 16, 12, 9, 6, 4, 3, 2, 1] },
  { id: 'dl30', cat: 'dilemma', type: 'dial', prompt: 'Daily screen time \u2014 where does \u201ctoo much\u201d start?', lo: 0, hi: 24, unit: 'h', med: 6, n: 6100, dist: [3, 10, 18, 20, 15, 10, 7, 5, 4, 3, 2, 2] },
  { id: 'dl4', cat: 'bigq', type: 'dial', prompt: 'How much of your life is actually in your control?', lo: 0, hi: 100, unit: '%', med: 55, n: 4800, dist: [4, 6, 8, 9, 10, 12, 14, 13, 10, 7, 4, 3] },
  { id: 'dl5', cat: 'event', type: 'dial', prompt: 'How many years until a human walks on Mars?', lo: 0, hi: 100, unit: 'yrs', med: 28, n: 4700, dist: [2, 9, 16, 18, 14, 10, 7, 5, 4, 3, 3, 9] },
  { id: 'dl31', cat: 'sport', type: 'dial', prompt: 'At what age is an athlete past their peak?', lo: 20, hi: 50, unit: 'yrs', med: 33, n: 5100, dist: [1, 3, 8, 14, 18, 17, 13, 10, 7, 4, 3, 2] },
  { id: 'dl32', cat: 'food', type: 'dial', prompt: 'How many coffees a day is too many?', lo: 0, hi: 12, unit: 'cups', med: 4, n: 5100, dist: [2, 4, 9, 15, 19, 16, 12, 9, 6, 4, 2, 2] },
  { id: 'dl33', cat: 'music', type: 'dial', prompt: 'How long should a concert be?', lo: 30, hi: 270, unit: 'min', med: 120, n: 4600, dist: [1, 3, 8, 15, 19, 17, 13, 9, 6, 4, 3, 2] },
  { id: 'dl9', cat: 'movies', type: 'dial', prompt: 'Trailers before the film \u2014 how many minutes is right?', lo: 0, hi: 30, unit: 'min', med: 10, n: 4300, dist: [6, 9, 13, 17, 16, 12, 9, 7, 5, 3, 2, 1] },
  { id: 'dl34', cat: 'bigq', type: 'dial', prompt: 'How many close friends does a person need?', lo: 0, hi: 12, unit: 'friends', med: 3, n: 4900, dist: [4, 9, 16, 20, 16, 12, 8, 6, 4, 2, 2, 1] },
  { id: 'dl35', cat: 'tech', type: 'dial', prompt: 'How many hours a day on a phone is too many?', lo: 0, hi: 24, unit: 'h', med: 4, n: 4600, dist: [5, 16, 20, 17, 12, 9, 7, 5, 4, 2, 2, 1] },
  { id: 'dl36', cat: 'culture', type: 'dial', prompt: 'Books finished last year — how many?', lo: 0, hi: 60, unit: 'books', med: 8, n: 4200, dist: [22, 20, 15, 11, 8, 6, 5, 4, 3, 2, 2, 2] },
  { id: 'dl37', cat: 'sport', type: 'dial', prompt: 'Hours of live sport in a good week?', lo: 0, hi: 24, unit: 'h', med: 4, n: 4100, dist: [15, 18, 16, 13, 10, 8, 6, 5, 4, 2, 2, 1] },
  { id: 'fd1', cat: 'dilemma', type: 'field', prompt: 'Pineapple on pizza \u2014 place it', ax: ['tastes bad', 'tastes good'], ay: ['a crime', 'high art'], n: 6800, cloud: [[22, 72, 10, 14], [76, 26, 12, 15], [54, 50, 4, 10]] },
  { id: 'fd2', cat: 'bigq', type: 'field', prompt: 'Small talk \u2014 place it', ax: ['painful', 'pleasant'], ay: ['pointless', 'essential'], n: 4100, cloud: [[64, 32, 12, 16], [30, 60, 8, 14], [50, 48, 6, 12]] },
  { id: 'fd3', cat: 'bigq', type: 'field', prompt: 'AI assistants, today \u2014 place them', ax: ['overhyped', 'underrated'], ay: ['scary', 'exciting'], n: 5600, cloud: [[42, 38, 10, 16], [68, 30, 8, 13], [30, 66, 7, 12]] },
  // 2026-08-26 lane batch (D309) and after \u2014 continuum twins; copy matches
  // content/feed-questions.json exactly, texture is this demo pool's own
  { id: 'dl38', cat: 'music', type: 'dial', prompt: 'How old were you when your taste in music settled?', lo: 5, hi: 50, unit: 'yrs', med: 17, n: 3400, dist: [3, 8, 16, 20, 16, 11, 8, 6, 4, 3, 3, 2] },
  { id: 'dl39', cat: 'food', type: 'dial', prompt: 'Meals cooked from scratch in a week?', lo: 0, hi: 21, unit: 'meals', med: 5, n: 4000, dist: [9, 12, 14, 15, 13, 11, 8, 6, 5, 3, 2, 2] },
  { id: 'dl40', cat: 'food', type: 'dial', prompt: 'The ideal dinner hour?', lo: 12, hi: 24, unit: 'h', med: 19, n: 4400, dist: [1, 1, 2, 3, 5, 9, 15, 20, 18, 12, 8, 6] },
  { id: 'dl41', cat: 'bigq', type: 'dial', prompt: 'How many years ahead do you actually plan?', lo: 0, hi: 30, unit: 'years', med: 3, n: 4300, dist: [16, 19, 15, 12, 9, 7, 6, 5, 4, 3, 2, 2] },
  { id: 'dl42', cat: 'culture', type: 'dial', prompt: 'Minutes late before it counts as late?', lo: 0, hi: 60, unit: 'min', med: 12, n: 4500, dist: [8, 14, 19, 17, 12, 9, 6, 5, 4, 3, 2, 1] },
  { id: 'dl43', cat: 'music', type: 'dial', prompt: 'How many songs on a perfect album?', lo: 6, hi: 30, unit: 'songs', med: 12, n: 4300, dist: [4, 11, 18, 20, 15, 10, 7, 5, 4, 3, 2, 1] },
  { id: 'dl44', cat: 'sport', type: 'dial', prompt: 'Push-ups you could do right now?', lo: 0, hi: 60, unit: 'push-ups', med: 12, n: 4100, dist: [10, 15, 17, 15, 12, 9, 7, 5, 4, 3, 2, 1] },
  { id: 'dl45', cat: 'tech', type: 'dial', prompt: 'Unread notifications right now?', lo: 0, hi: 120, unit: 'notifications', med: 9, n: 4300, dist: [16, 19, 15, 12, 9, 7, 6, 5, 4, 3, 2, 2] },
  { id: 'dl46', cat: 'bigq', type: 'dial', prompt: 'How many lives would you want to live, if you could?', lo: 0, hi: 12, unit: 'lives', med: 3, n: 3900, dist: [6, 14, 18, 17, 13, 9, 7, 5, 4, 3, 2, 2] },
  { id: 'dl47', cat: 'culture', type: 'dial', prompt: 'Decorations up — from which week of the year?', lo: 0, hi: 52, unit: 'weeks', med: 47, n: 4000, dist: [3, 2, 2, 2, 3, 3, 4, 5, 7, 12, 25, 32] },
  { id: 'dl48', cat: 'dilemma', type: 'dial', prompt: 'The most you’d queue for anything, in minutes?', lo: 0, hi: 120, unit: 'min', med: 25, n: 4200, dist: [7, 12, 16, 16, 13, 10, 8, 6, 5, 4, 2, 1] },
  { id: 'dl49', cat: 'event', type: 'dial', prompt: 'Fireworks on New Year’s: how many minutes is right?', lo: 0, hi: 24, unit: 'min', med: 10, n: 4100, dist: [5, 8, 12, 15, 16, 14, 10, 8, 5, 4, 2, 1] },
  { id: 'dl50', cat: 'food', type: 'dial', prompt: 'Spice jars in your kitchen?', lo: 0, hi: 48, unit: 'jars', med: 14, n: 4000, dist: [6, 10, 14, 16, 15, 12, 9, 7, 5, 3, 2, 1] },
  { id: 'dl51', cat: 'movies', type: 'dial', prompt: 'Times you’ve seen your most-watched film?', lo: 0, hi: 24, unit: 'times', med: 6, n: 4200, dist: [8, 14, 17, 15, 12, 10, 8, 6, 4, 3, 2, 1] },
  { id: 'dl52', cat: 'music', type: 'dial', prompt: 'Songs on your on-repeat playlist right now?', lo: 0, hi: 36, unit: 'songs', med: 8, n: 4300, dist: [9, 15, 17, 14, 11, 9, 7, 6, 5, 4, 2, 1] },
  { id: 'dl53', cat: 'people', type: 'dial', prompt: 'Posters on your teenage bedroom wall — how many?', lo: 0, hi: 12, unit: 'posters', med: 3, n: 3800, dist: [12, 16, 17, 14, 11, 9, 7, 5, 4, 3, 1, 1] },
  { id: 'dl54', cat: 'event', type: 'dial', prompt: 'New Year’s resolutions you actually kept, of your last 12?', lo: 0, hi: 12, unit: 'kept', med: 2, n: 4100, dist: [22, 20, 16, 12, 9, 7, 5, 3, 2, 2, 1, 1] },
  { id: 'dl55', cat: 'movies', type: 'dial', prompt: 'Films you watched last month?', lo: 0, hi: 24, unit: 'films', med: 5, n: 4300, dist: [9, 16, 19, 16, 12, 9, 6, 4, 3, 3, 2, 1] },
  { id: 'dl56', cat: 'people', type: 'dial', prompt: 'Biographies you’ve read, roughly, ever?', lo: 0, hi: 48, unit: 'biographies', med: 6, n: 3900, dist: [18, 21, 17, 12, 9, 7, 5, 4, 3, 2, 1, 1] },
  { id: 'dl57', cat: 'dilemma', type: 'dial', prompt: 'Minutes you can sit with a menu before deciding?', lo: 0, hi: 24, unit: 'minutes', med: 6, n: 4200, dist: [8, 14, 18, 17, 13, 10, 7, 5, 3, 2, 2, 1] },
  { id: 'dl58', cat: 'sport', type: 'dial', prompt: 'Workouts in your last month?', lo: 0, hi: 24, unit: 'workouts', med: 6, n: 4100, dist: [14, 12, 14, 15, 12, 10, 8, 6, 4, 3, 1, 1] },
  { id: 'dl59', cat: 'tech', type: 'dial', prompt: 'Apps on your phone right now?', lo: 0, hi: 120, unit: 'apps', med: 55, n: 4400, dist: [2, 5, 9, 13, 16, 15, 12, 9, 7, 5, 4, 3] },
  { id: 'dl60', cat: 'bigq', type: 'dial', prompt: 'How many people truly know you?', lo: 0, hi: 12, unit: 'people', med: 3, n: 4300, dist: [6, 14, 20, 19, 13, 9, 6, 4, 3, 3, 2, 1] },
  { id: 'dl61', cat: 'culture', type: 'dial', prompt: 'Holiday cards you send a year?', lo: 0, hi: 48, unit: 'cards', med: 6, n: 3800, dist: [24, 16, 13, 11, 9, 7, 6, 5, 4, 2, 2, 1] },
  { id: 'dl62', cat: 'food', type: 'dial', prompt: 'Meals out in a month?', lo: 0, hi: 24, unit: 'meals', med: 6, n: 4200, dist: [7, 13, 17, 16, 13, 10, 8, 6, 4, 3, 2, 1] },
  { id: 'dl63', cat: 'music', type: 'dial', prompt: 'Concerts in your last year?', lo: 0, hi: 24, unit: 'concerts', med: 3, n: 4000, dist: [26, 22, 15, 10, 8, 6, 4, 3, 2, 2, 1, 1] },
  { id: 'dl64', cat: 'sport', type: 'dial', prompt: 'Kilometres you run or walk in an average week?', lo: 0, hi: 48, unit: 'km', med: 10, n: 4100, dist: [14, 16, 15, 13, 11, 9, 7, 5, 4, 3, 2, 1] },
  { id: 'dl65', cat: 'bigq', type: 'dial', prompt: 'Hours of your day spent on autopilot?', lo: 0, hi: 24, unit: 'hours', med: 8, n: 4200, dist: [3, 6, 10, 14, 16, 14, 11, 9, 7, 5, 3, 2] },
  { id: 'dl66', cat: 'event', type: 'dial', prompt: 'Meetings this week that could have been an email?', lo: 0, hi: 24, unit: 'meetings', med: 4, n: 4300, dist: [12, 18, 17, 14, 11, 8, 6, 5, 4, 2, 2, 1] },
  { id: 'dl67', cat: 'event', type: 'dial', prompt: 'Holiday days you’ll lose unused this year?', lo: 0, hi: 24, unit: 'days', med: 3, n: 3900, dist: [26, 20, 14, 10, 8, 6, 5, 4, 3, 2, 1, 1] },
  { id: 'dl68', cat: 'food', type: 'dial', prompt: 'Glasses of water you actually drink a day?', lo: 0, hi: 12, unit: 'glasses', med: 4, n: 4400, dist: [4, 9, 14, 17, 16, 13, 10, 7, 5, 3, 1, 1] },
  { id: 'dl69', cat: 'people', type: 'dial', prompt: 'Living famous people you could name in sixty seconds?', lo: 0, hi: 60, unit: 'names', med: 25, n: 3900, dist: [3, 6, 10, 14, 16, 15, 12, 9, 7, 4, 3, 1] },
  { id: 'dl70', cat: 'movies', type: 'dial', prompt: 'Minutes before you abandon a bad film?', lo: 0, hi: 120, unit: 'minutes', med: 35, n: 4200, dist: [4, 8, 12, 15, 16, 13, 10, 8, 6, 4, 2, 2] },
  { id: 'dl71', cat: 'music', type: 'dial', prompt: 'Years since you last bought physical music?', lo: 0, hi: 24, unit: 'years', med: 6, n: 4000, dist: [12, 10, 11, 12, 12, 10, 9, 8, 6, 5, 3, 2] },
  { id: 'dl72', cat: 'tech', type: 'dial', prompt: 'Devices in your home that need charging?', lo: 0, hi: 24, unit: 'devices', med: 8, n: 4300, dist: [2, 5, 9, 13, 16, 15, 12, 10, 7, 5, 4, 2] },
  { id: 'dl73', cat: 'people', type: 'dial', prompt: 'Creators you’d notice going quiet for a week?', lo: 0, hi: 24, unit: 'creators', med: 3, n: 3800, dist: [22, 20, 15, 11, 8, 6, 5, 4, 3, 3, 2, 1] },
  { id: 'dl74', cat: 'dilemma', type: 'dial', prompt: 'Share of your decisions you’d hand to a flawless advisor?', lo: 0, hi: 100, unit: '%', med: 25, n: 3500, dist: [18, 16, 14, 12, 10, 8, 7, 5, 4, 3, 2, 1] },
  { id: 'dl75', cat: 'event', type: 'dial', prompt: 'Days of annual leave that would feel right?', lo: 0, hi: 60, unit: 'days', med: 30, n: 3700, dist: [1, 2, 3, 5, 8, 12, 16, 18, 14, 10, 7, 4] },
  { id: 'dl76', cat: 'movies', type: 'dial', prompt: 'The right age for a first horror film?', lo: 6, hi: 18, unit: 'years', med: 12, n: 3400, dist: [2, 3, 5, 8, 12, 16, 18, 14, 10, 6, 4, 2] },
  { id: 'dl77', cat: 'tech', type: 'dial', prompt: 'Share of your work an AI could do today, honestly?', lo: 0, hi: 100, unit: '%', med: 30, n: 3900, dist: [10, 12, 14, 15, 13, 11, 9, 7, 4, 3, 1, 1] },
  { id: 'dl78', cat: 'culture', type: 'dial', prompt: 'Days to reply to a non-urgent message before it’s rude?', lo: 0, hi: 14, unit: 'days', med: 2, n: 3600, dist: [20, 22, 16, 12, 9, 6, 5, 3, 2, 2, 2, 1] },
  { id: 'dl79', cat: 'sport', type: 'dial', prompt: 'Minimum minutes for it to count as a run?', lo: 5, hi: 60, unit: 'min', med: 20, n: 3300, dist: [8, 12, 16, 18, 15, 11, 8, 5, 3, 2, 1, 1] },
  { id: 'dl80', cat: 'bigq', type: 'dial', prompt: 'Alien civilisations in our galaxy right now — your guess?', lo: 0, hi: 100, unit: 'worlds', med: 10, n: 3400, dist: [20, 18, 14, 11, 9, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'dl81', cat: 'food', type: 'dial', prompt: 'The right number of guests at a dinner table?', lo: 2, hi: 16, unit: 'guests', med: 6, n: 3600, dist: [4, 8, 14, 18, 17, 13, 9, 6, 4, 3, 2, 2] },
  { id: 'dl82', cat: 'music', type: 'dial', prompt: 'Share of your listening older than you are?', lo: 0, hi: 100, unit: '%', med: 30, n: 3500, dist: [8, 11, 14, 16, 14, 12, 9, 7, 4, 3, 1, 1] },
  { id: 'dl83', cat: 'people', type: 'dial', prompt: 'How many years behind is your celebrity knowledge?', lo: 0, hi: 20, unit: 'years', med: 4, n: 3400, dist: [14, 16, 15, 13, 10, 8, 7, 5, 4, 3, 3, 2] },
  { id: 'dl84', cat: 'dilemma', type: 'dial', prompt: 'White lies this week, at an honest count?', lo: 0, hi: 20, unit: 'lies', med: 3, n: 3500, dist: [10, 18, 17, 14, 11, 8, 6, 5, 4, 3, 2, 2] },
  { id: 'dl85', cat: 'event', type: 'dial', prompt: 'Weeks ahead you start looking forward to your favourite season?', lo: 0, hi: 26, unit: 'weeks', med: 6, n: 3300, dist: [8, 12, 15, 16, 13, 10, 8, 6, 5, 3, 2, 2] },
  { id: 'dl86', cat: 'movies', type: 'dial', prompt: 'Series you’re “currently watching”, honestly?', lo: 0, hi: 12, unit: 'shows', med: 4, n: 3600, dist: [6, 10, 14, 16, 15, 12, 9, 7, 4, 3, 2, 2] },
  { id: 'dl87', cat: 'tech', type: 'dial', prompt: 'Times you used an AI yesterday, roughly?', lo: 0, hi: 50, unit: 'times', med: 6, n: 3800, dist: [12, 15, 14, 13, 11, 9, 7, 6, 5, 4, 2, 2] },
  { id: 'dl88', cat: 'sport', type: 'dial', prompt: 'The longest you’ve ever run, ever?', lo: 0, hi: 50, unit: 'km', med: 8, n: 3400, dist: [14, 15, 14, 12, 10, 9, 8, 6, 5, 3, 2, 2] },
  { id: 'dl89', cat: 'bigq', type: 'dial', prompt: 'Minutes you can sit doing absolutely nothing?', lo: 0, hi: 60, unit: 'min', med: 8, n: 3500, dist: [12, 16, 15, 13, 11, 9, 7, 6, 4, 3, 2, 2] },
  { id: 'dl90', cat: 'food', type: 'dial', prompt: 'Weeknight dinner, hob to table — minutes?', lo: 5, hi: 90, unit: 'min', med: 30, n: 3600, dist: [4, 8, 13, 16, 16, 13, 10, 8, 5, 4, 2, 1] },
  { id: 'dl91', cat: 'music', type: 'dial', prompt: 'The perfect gig crowd, roughly?', lo: 20, hi: 2000, unit: 'people', med: 400, n: 3300, dist: [6, 10, 13, 15, 14, 12, 9, 7, 5, 4, 3, 2] },
  { id: 'dl20', cat: 'sport', type: 'dial', prompt: 'Minutes of stoppage time that feel honest?', lo: 0, hi: 15, unit: 'min', med: 4, n: 4100, dist: [6, 10, 15, 17, 15, 11, 8, 6, 4, 3, 3, 2] },
  { id: 'dl21', cat: 'tech', type: 'dial', prompt: 'Browser tabs open right now?', lo: 0, hi: 50, unit: 'tabs', med: 9, n: 4400, dist: [10, 16, 17, 14, 11, 8, 7, 6, 4, 3, 2, 2] },
  { id: 'dl22', cat: 'culture', type: 'dial', prompt: 'Seconds a silence can sit comfortably?', lo: 0, hi: 60, unit: 's', med: 8, n: 4000, dist: [12, 18, 17, 13, 10, 8, 6, 5, 4, 3, 2, 2] },
  { id: 'dl23', cat: 'food', type: 'dial', prompt: 'Too late for coffee — from what hour?', lo: 10, hi: 22, unit: 'h', med: 16, n: 4300, dist: [3, 5, 8, 11, 14, 16, 14, 11, 8, 5, 3, 2] },
  { id: 'dl24', cat: 'movies', type: 'dial', prompt: 'Cinema trips in a year?', lo: 0, hi: 50, unit: 'trips', med: 6, n: 4200, dist: [14, 19, 16, 12, 10, 8, 6, 5, 4, 3, 2, 1] },
  { id: 'dl25', cat: 'bigq', type: 'dial', prompt: 'How many big decisions does a life turn on?', lo: 0, hi: 20, unit: 'decisions', med: 5, n: 3900, dist: [4, 8, 14, 17, 15, 12, 9, 7, 5, 4, 3, 2] },
  { id: 'dl26', cat: 'dilemma', type: 'dial', prompt: "A fair finder's fee, in percent?", lo: 0, hi: 50, unit: '%', med: 10, n: 4100, dist: [10, 14, 16, 15, 12, 9, 7, 6, 4, 3, 2, 2] },
  { id: 'dl27', cat: 'event', type: 'dial', prompt: 'Hours of news in your week?', lo: 0, hi: 20, unit: 'h', med: 4, n: 4200, dist: [9, 15, 17, 14, 11, 9, 7, 6, 5, 3, 2, 2] },
  { id: 'dl28', cat: 'music', type: 'dial', prompt: 'Your favourite song comes on — volume, in percent?', lo: 0, hi: 100, unit: '%', med: 78, n: 4500, dist: [1, 2, 3, 4, 5, 7, 9, 12, 15, 17, 14, 11] },
  { id: 'dl29', cat: 'people', type: 'dial', prompt: "Autographs you've asked for, ever?", lo: 0, hi: 20, unit: 'autographs', med: 1, n: 3800, dist: [30, 22, 14, 10, 7, 5, 4, 3, 2, 1, 1, 1] },
  { id: 'fd4', cat: 'bigq', type: 'field', prompt: 'Human nature \u2014 place it', ax: ['selfish', 'kind'], ay: ['fixed', 'changeable'], n: 4700, cloud: [[70, 30, 11, 15], [28, 68, 9, 14], [50, 48, 5, 12]] },
  { id: 'fd5', cat: 'sport', type: 'field', prompt: 'Losing — place it', ax: ['shrug it off', 'carry it'], ay: ['just a game', 'personal'], n: 4300, cloud: [[30, 35, 10, 14], [72, 68, 11, 13], [50, 50, 5, 10]] },
  { id: 'fd6', cat: 'tech', type: 'field', prompt: 'Your phone — place it', ax: ['a tool', 'a limb'], ay: ['serves you', 'runs you'], n: 5100, cloud: [[25, 30, 10, 13], [74, 70, 12, 14], [55, 52, 6, 11]] },
  { id: 'fd7', cat: 'culture', type: 'field', prompt: 'Hosting — place it', ax: ['full house', 'quiet house'], ay: ['a joy', 'a duty'], n: 4000, cloud: [[28, 30, 11, 14], [70, 62, 10, 13], [48, 50, 5, 11]] },
  { id: 'fd8', cat: 'food', type: 'field', prompt: 'Cooking — place it', ax: ['a chore', 'therapy'], ay: ['by the book', 'improvised'], n: 4600, cloud: [[30, 38, 11, 13], [72, 64, 10, 14], [52, 50, 6, 10]] },
  { id: 'fd9', cat: 'movies', type: 'field', prompt: 'Horror films — place it', ax: ['can’t watch', 'can’t stop'], ay: ['silly', 'art'], n: 4400, cloud: [[24, 40, 10, 13], [74, 60, 11, 14], [50, 48, 5, 11]] },
  { id: 'fd10', cat: 'sport', type: 'field', prompt: 'Team loyalty — place it', ax: ['born into it', 'chosen'], ay: ['for life', 'transferable'], n: 4200, cloud: [[26, 28, 11, 14], [70, 66, 10, 13], [50, 50, 5, 10]] },
  { id: 'fd11', cat: 'tech', type: 'field', prompt: 'Social media — place it', ax: ['drains me', 'feeds me'], ay: ['quitting soon', 'here to stay'], n: 5000, cloud: [[28, 64, 11, 13], [70, 70, 10, 14], [48, 50, 6, 11]] },
  { id: 'fd12', cat: 'culture', type: 'field', prompt: 'Traditions — place it', ax: ['keep them all', 'invent new'], ay: ['comforting', 'confining'], n: 4100, cloud: [[28, 30, 11, 13], [68, 62, 10, 14], [50, 48, 5, 11]] },
  { id: 'fd13', cat: 'food', type: 'field', prompt: 'Snacking — place it', ax: ['a grazer', 'three meals'], ay: ['proud', 'guilty'], n: 4400, cloud: [[30, 36, 11, 13], [70, 62, 10, 14], [50, 50, 6, 10]] },
  { id: 'fd14', cat: 'movies', type: 'field', prompt: 'Sequels — place it', ax: ['never needed', 'keep them'], ay: ['cash grabs', 'real stories'], n: 4300, cloud: [[28, 36, 10, 13], [72, 62, 11, 14], [50, 48, 5, 11]] },
  { id: 'fd15', cat: 'event', type: 'field', prompt: 'The Olympics — place it', ax: ['pure sport', 'pure show'], ay: ['must-watch', 'skippable'], n: 4100, cloud: [[30, 34, 11, 13], [68, 58, 12, 14], [50, 50, 6, 10]] },
  { id: 'fd16', cat: 'movies', type: 'field', prompt: 'Cinemas — place it', ax: ['dying out', 'here forever'], ay: ['go often', 'rarely go'], n: 4200, cloud: [[28, 62, 11, 12], [70, 36, 12, 13], [52, 50, 6, 11]] },
  { id: 'fd17', cat: 'people', type: 'field', prompt: 'Celebrity culture — place it', ax: ['harmless fun', 'corrosive'], ay: ['I follow it', 'I avoid it'], n: 3900, cloud: [[26, 32, 10, 12], [70, 64, 12, 13], [48, 52, 6, 10]] },
  { id: 'fd18', cat: 'dilemma', type: 'field', prompt: 'Hard choices — place it', ax: ['head decides', 'heart decides'], ay: ['agonise', 'decide fast'], n: 4000, cloud: [[30, 36, 12, 13], [66, 60, 12, 14], [50, 48, 6, 11]] },
  { id: 'fd19', cat: 'food', type: 'field', prompt: 'Eating out — place it', ax: ['a treat', 'routine'], ay: ['food first', 'company first'], n: 4100, cloud: [[28, 40, 11, 13], [68, 56, 12, 13], [48, 52, 6, 10]] },
  { id: 'fd20', cat: 'culture', type: 'field', prompt: 'Manners — place it', ax: ['strict', 'relaxed'], ay: ['improving', 'decaying'], n: 4000, cloud: [[30, 62, 12, 13], [68, 38, 12, 13], [50, 50, 6, 10]] },
  { id: 'fd21', cat: 'dilemma', type: 'field', prompt: 'Risk — place it', ax: ['seek it', 'avoid it'], ay: ['regret risks', 'regret passes'], n: 4100, cloud: [[32, 36, 12, 13], [66, 60, 12, 13], [50, 48, 6, 10]] },
  { id: 'fd22', cat: 'people', type: 'field', prompt: 'Heroes — place it', ax: ['born', 'made'], ay: ['have one', 'outgrew them'], n: 3800, cloud: [[66, 34, 12, 13], [30, 60, 11, 13], [50, 50, 6, 10]] },
  { id: 'fd23', cat: 'movies', type: 'field', prompt: 'Animation — place it', ax: ['for kids', 'for everyone'], ay: ['watch lots', 'rarely watch'], n: 4000, cloud: [[70, 36, 12, 13], [32, 62, 11, 13], [52, 50, 6, 10]] },
  { id: 'fd24', cat: 'music', type: 'field', prompt: 'Festivals — place it', ax: ['the music', 'the scene'], ay: ['yearly', 'never again'], n: 4100, cloud: [[34, 36, 12, 13], [66, 62, 12, 13], [50, 50, 6, 10]] },
  { id: 'fd25', cat: 'tech', type: 'field', prompt: 'The cloud — place it', ax: ['trust it', 'fear it'], ay: ['all in', 'local first'], n: 4200, cloud: [[30, 38, 12, 13], [68, 58, 12, 13], [48, 50, 6, 10]] },
  { id: 'fd26', cat: 'people', type: 'field', prompt: 'Your feed — place it', ax: ['curated', 'chaos'], ay: ['inspires', 'drains'], n: 3600, cloud: [[35, 40, 14, 12], [65, 68, 13, 14], [52, 52, 7, 9]] },
  { id: 'fd27', cat: 'tech', type: 'field', prompt: 'AI — place it', ax: ['tool', 'colleague'], ay: ['thrilling', 'worrying'], n: 3700, cloud: [[32, 36, 13, 12], [60, 64, 14, 13], [48, 50, 8, 9]] },
  { id: 'fd28', cat: 'sport', type: 'field', prompt: 'Competition — place it', ax: ['seek it', 'avoid it'], ay: ['my best', 'my worst'], n: 3500, cloud: [[34, 38, 14, 13], [64, 60, 13, 12], [50, 50, 7, 8]] },
  { id: 'fd29', cat: 'food', type: 'field', prompt: 'Groceries — place it', ax: ['list, always', 'vibes'], ay: ['daily trips', 'one big shop'], n: 3400, cloud: [[34, 40, 13, 12], [64, 62, 14, 13], [50, 50, 7, 8]] },
  { id: 'fd30', cat: 'music', type: 'field', prompt: 'Listening — place it', ax: ['albums whole', 'shuffle'], ay: ['old friends', 'new finds'], n: 3300, cloud: [[38, 40, 13, 12], [64, 58, 13, 13], [50, 52, 8, 9]] },
  { id: 'fd31', cat: 'event', type: 'field', prompt: 'Your year — place it', ax: ['planned', 'improvised'], ay: ['flew by', 'crawled'], n: 3400, cloud: [[36, 38, 13, 12], [62, 60, 14, 13], [50, 50, 7, 9]] },
  { id: 'fd32', cat: 'movies', type: 'field', prompt: 'Your watching — place it', ax: ['films', 'series'], ay: ['together', 'alone'], n: 3500, cloud: [[38, 40, 13, 12], [64, 58, 13, 13], [50, 52, 8, 9]] },
  { id: 'fd33', cat: 'culture', type: 'field', prompt: 'Your bookshelf — place it', ax: ['all read', 'aspirational'], ay: ['on display', 'boxed away'], n: 3300, cloud: [[36, 40, 13, 12], [62, 58, 14, 13], [50, 50, 7, 8]] },
  { id: 'fd34', cat: 'bigq', type: 'field', prompt: 'Time — place it', ax: ['friend', 'enemy'], ay: ['too much', 'never enough'], n: 3300, cloud: [[38, 60, 13, 12], [62, 40, 13, 13], [50, 50, 7, 8]] },

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
// GUARDED, and this is the line the note above said would have to move.
// The pool is DEMO stock: on a live build `buildFeedGlobals` (data/live.ts)
// publishes the real feed to this same global. While this file was eager it
// ran BEFORE `initLive` and the assignment was harmless; now that it loads
// from loadWorldFeed() — after the live boot — an unguarded one would
// overwrite the real feed with invented questions. `demoPoolOpen()` is the
// single definition of that test, shared with joinDemoStock and
// installSubtopicStock for exactly this reason.
//
// The literal is a named const rather than an inline right-hand side so the
// bank parsers can still find it: question-quality.mjs and
// question-neighbors.mjs both read this pool by marker, and a ternary in the
// assignment hid it from them.
if (demoPoolOpen()) window.WORLD_FEED_QS = WFD_DEMO_POOL;

/**
 * The demo stock that is not in the literal above, joined ON DEMAND rather
 * than at module scope: the catalogue 'pick' questions (pick-data.js and
 * world-catalogs.js) and the scorecard 'rate' questions (place-stats.js).
 *
 * WHY IT MOVED. This used to read `window.PICK_QS` right here, which made
 * pick-data.js a module-scope dependency of the pool and therefore eager —
 * 48 KB of catalogue demo stock in the first-paint graph of a build whose
 * feed is deferred and whose pool `live.ts` replaces wholesale. Called from
 * `loadWorldFeed()` instead, after pick-data lands in the feed's own chunk.
 *
 * THE GUARD IS LOAD-BEARING, and the ordering is why. `main.jsx` runs
 * `initLive().finally(() => … loadWorldFeed())`, so this now runs AFTER the
 * live boot rather than before it: where the old module-scope concat could
 * only ever be overwritten by `buildFeedGlobals`, this one could append
 * demo catalogue cards ON TOP of the published live pool. `LIVE.enabled` is
 * the test, read through the imported binding rather than off `window` (the
 * seam world-feed.jsx already uses) so the coupling meter does not count it.
 *
 * It reads a settled value on the ordinary path — `initLive` resolves
 * before `loadWorldFeed` is called — and the one path where it does not is
 * covered from the other side: a boot that lost the 2500 ms race leaves
 * `enabled` false here, the demo pool joins, and `buildFeedGlobals()`
 * replaces it wholesale the moment the late boot lands. That is exactly
 * what happened before this change, on every boot.
 *
 * Idempotent: `loadWorldFeed` is memoised, but a second call must not
 * double the pool.
 *
 * Variadic because three demo modules were eager for the same reason and
 * all three now hand their array over: pick-data.js's `PICK_QS` (25 cards,
 * the 48 KB module), world-catalogs.js's `WF_CATALOG_QS` (2), and
 * place-stats.js's `PLACE_RATE_QS` (13). The last of those was concatenated
 * right here at module scope until its own pair left the eager list.
 */
/**
 * Whether the demo pool may still be written.
 *
 * The predicate has ONE definition on purpose. Two demo modules now hand
 * their stock over instead of writing the pool at module scope — this
 * file's `joinDemoStock` and world-subtopics.js's `installSubtopicStock` —
 * and both run past the live boot, so both need exactly this test. A second
 * copy of it is a second chance to get the live/demo boundary wrong.
 */
export function demoPoolOpen() {
  return !LIVE.enabled;
}

let stockJoined = false;
export function joinDemoStock(...sets) {
  if (stockJoined || !demoPoolOpen()) return;
  const add = sets.filter((s) => Array.isArray(s) && s.length).flat();
  if (!add.length) return;
  stockJoined = true;
  window.WORLD_FEED_QS = (window.WORLD_FEED_QS || []).concat(add);
}
