// feeds.jsx — daily-report feeds for around / city / world tabs,
// plus a shared ReportCard and an invisible "like" mechanism.
// Likes are stored locally and NEVER displayed as a count.

const { useState: useStateF, useMemo: useMemoF, useEffect: useEffectF } = React;

// ── invisible like store ───────────────────────────────────────────────────
const LIKES_KEY = 'insight.likes.v1';
function loadLikes() {
  try { return new Set(JSON.parse(localStorage.getItem(LIKES_KEY) || '[]')); }
  catch (_) { return new Set(); }
}
function saveLikes(set) {
  try { localStorage.setItem(LIKES_KEY, JSON.stringify([...set])); } catch (_) {}
}
// shared singleton so all LikeButtons stay in sync
let _likes = loadLikes();
const _likeSubs = new Set();
function isLiked(id) { return _likes.has(id); }
function toggleLike(id) {
  if (_likes.has(id)) _likes.delete(id); else _likes.add(id);
  saveLikes(_likes);
  _likeSubs.forEach(fn => fn());
}
function useLikeFlag(id) {
  const [flag, setFlag] = useStateF(() => isLiked(id));
  useEffectF(() => {
    const sub = () => setFlag(isLiked(id));
    _likeSubs.add(sub);
    return () => _likeSubs.delete(sub);
  }, [id]);
  return flag;
}

function LikeButton({ id, size = 18, hue = 12, dim = false }) {
  const liked = useLikeFlag(id);
  const stroke = liked ? `oklch(0.55 0.18 ${hue})` : (dim ? 'var(--ink-3)' : 'var(--ink-2)');
  const fill = liked ? `oklch(0.62 0.20 ${hue})` : 'transparent';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleLike(id); }}
      aria-label={liked ? 'unlike' : 'like'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 0,
      }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'transform 120ms ease', transform: liked ? 'scale(1.08)' : 'scale(1)' }}>
        <path d="M12 20.5s-7.5-4.6-9.3-9.1c-1.2-3 .6-6.4 3.8-6.9 2.1-.3 4 .9 5.5 2.6 1.5-1.7 3.4-2.9 5.5-2.6 3.2.5 5 3.9 3.8 6.9C19.5 15.9 12 20.5 12 20.5z" />
      </svg>
    </button>
  );
}

// ── synth report data for around / city / world ────────────────────────────
// Deterministic — different keys per scope so cards don't all read identical.

const AROUND_REPORTS = [
  { one_line: "Threw a pot that finally held its center. Two thumbs up at the wheel.",                     weather: 'rain · 9°',  shared: ['one_line','weather'] },
  { one_line: "The Bartók ran long. Came home and stood in the dark for a minute. Worth it.",              weather: 'wind · 11°', shared: ['one_line','weather'] },
  { one_line: "Logged seven new bryozoan colonies before the rain came. The fjord is alive this week.",   weather: 'rain · 9°',  shared: ['one_line','weather'] },
  { one_line: "First boards bound for the Solnit reprint. Smelled the glue all day. Don't mind.",          weather: 'grey · 12°', shared: ['one_line','weather'] },
  { one_line: "Three drafts, none of them right. The data is fine — the verbs aren't.",                    weather: 'sun · 14°',  shared: ['one_line','weather'] },
  { one_line: "Finished the cherrywood bowl. Took it outside to see if the grain looked the same in sun.", weather: 'sun · 14°',  shared: ['one_line','weather'] },
];
function enrich(base, i) {
  return { ...base };
}

const AROUND_SEEN = [['Henrik', 'Liv'], ['Jonas'], [], ['Mum'], ['Ingrid', 'a stranger'], ['Liv']];

// City — anonymous-ish neighbors, just first names + neighborhood
const CITY_REPORTS = [
  { id: 'c1', init: 'AB', name: 'Astrid',  rel: 'Grünerløkka',      hue: 38,  one_line: "Sun on the river at six. Twelve minutes I'll keep.",                                weather: 'sun · 14°', shared: ['one_line','weather'] },
  { id: 'c2', init: 'TL', name: 'Thomas',  rel: 'Frogner',          hue: 220, one_line: "The fjord did the thing where it goes silver before the boats start.",               weather: 'rain · 9°', shared: ['one_line','weather'] },
  { id: 'c3', init: 'SB', name: 'Sofie',   rel: 'Sagene',           hue: 305, one_line: "Sat with my grandmother for an hour. She didn't recognize me. We had tea anyway.",   weather: 'grey · 11°',shared: ['one_line','weather'] },
  { id: 'c4', init: 'JR', name: 'Johanne', rel: 'Tøyen',            hue: 60,  one_line: "Built half a shelf with my dad. He kept pretending he didn't need help.",            weather: 'sun · 14°', shared: ['one_line','weather'] },
  { id: 'c5', init: 'EH', name: 'Even',    rel: 'St. Hanshaugen',   hue: 145, one_line: "Tomatoes finally in. Soil under the nails. Quiet hands, busy mind.",                weather: 'sun · 14°', shared: ['one_line','weather'] },
  { id: 'c6', init: 'MM', name: 'Maja',    rel: 'Majorstuen',       hue: 25,  one_line: "Played Bach in a stairwell. Nobody came out, but nobody complained either.",         weather: 'wind · 11°',shared: ['one_line','weather'] },
];

// World — most-shared globally; city + country tag
const WORLD_REPORTS = [
  { id: 'w1', init: 'YT', name: 'Yui',     city: 'Kyoto',         country: 'JP', hue: 145, one_line: "Walked the Philosopher's Path before tourists arrived. A heron looked at me like I owed it something.", weather: 'mist · 13°',shared: ['one_line','weather'] },
  { id: 'w2', init: 'RM', name: 'Rui',     city: 'Lisbon',        country: 'PT', hue: 38,  one_line: "Old man on tram 28 sang the whole way. Nobody told him to stop. Nobody wanted to.",                       weather: 'sun · 21°', shared: ['one_line','weather'] },
  { id: 'w3', init: 'AS', name: 'Amara',   city: 'Cape Town',     country: 'ZA', hue: 195, one_line: "Swam at Camps Bay. Cold enough to remember everyone who's ever loved me.",                                weather: 'sun · 18°', shared: ['one_line','weather'] },
  { id: 'w4', init: 'LO', name: 'Lucas',   city: 'Buenos Aires',  country: 'AR', hue: 50,  one_line: "Tango at the milonga didn't go where I planned. Followed someone else's instinct for an hour.",            weather: 'cool · 12°',shared: ['one_line','weather'] },
  { id: 'w5', init: 'NF', name: 'Nour',    city: 'Marrakech',     country: 'MA', hue: 18,  one_line: "Sat on the roof at sunset and counted four calls to prayer overlapping. The medina holds itself together.", weather: 'warm · 28°',shared: ['one_line','weather'] },
  { id: 'w6', init: 'MH', name: 'Maeve',   city: 'Reykjavík',     country: 'IS', hue: 200, one_line: "Soaked in the geothermal pool while it started to snow. Best place I've ever cried.",                       weather: 'snow · 0°', shared: ['one_line','weather'] },
  { id: 'w7', init: 'LV', name: 'Léa',     city: 'Montréal',      country: 'CA', hue: 250, one_line: "Bagel at three a.m. with someone I just met. Two languages, one bag of poppyseeds.",                         weather: 'cool · 8°', shared: ['one_line','weather'] },
  { id: 'w8', init: 'KW', name: 'Kiri',    city: 'Wellington',    country: 'NZ', hue: 165, one_line: "Wind off the harbour. The kind that makes you laugh instead of curse.",                                    weather: 'wind · 14°',shared: ['one_line','weather'] },
];

Object.assign(window, {
  LikeButton,
});
