// Load order mirrors the standalone's script tags — order is semantic, do not sort.
import './spec/sample-data.js';
import './spec/archetype-data.js';
import './spec/compare-pop.js';
import './spec/daily-questions.js';
import './spec/suggestions.js';
import './spec/demographics.js';
import './spec/follows.js';
import './spec/scenes.js';
import './spec/glyph-icons.js';
import './spec/subnav-thumb.js';
import './spec/map-branches.js';
import './spec/map-anchors.js';
import './spec/map-group-stats.js';
import './spec/duels-data.js';
import './spec/iOS.jsx';
import './spec/tweaks-panel.jsx';
import './spec/primitives.jsx';
import './spec/feeds.jsx';
import './spec/viz-primitives.jsx';
import './spec/compare-breakdown.jsx';
import './spec/relmap-core.js';
import './spec/relmap-lenses.jsx';
import './spec/relmap-panels.jsx';
import './spec/relmap.jsx';
import './spec/test-viz.jsx';
import './spec/profile-test-viz.jsx';
import './spec/type-marks.jsx';
import './spec/result-rose.jsx';
import './spec/result-card.jsx';
import './spec/reveal-clock.js';
import './spec/group-daily.jsx';
import './spec/duo-daily.jsx';
// place-stats.js and pick-data.js must precede world-feed-data.js: the feed
// pool concatenates window.PLACE_RATE_QS and window.PICK_QS at module scope,
// so both card sets must already exist.
import './spec/place-stats.js';
import './spec/pick-data.js';
// world-feed-data.js stays EAGER even though the feed itself does not:
// daily-split.jsx reads window.WORLD_TOPICS at MODULE scope (line 19), and
// deferring it would silently swap the real topic set for that line's
// five-entry fallback — the failure mode being a wrong chip row rather than
// an error anyone would see.
import './spec/world-feed-data.js';
// feed-read.js is the feed's MEMORY, not the feed: the Mirror reads its
// stats (mirror-field-pops.jsx, app-shell.jsx) on screens the feed never
// opens on. 1.6 KB, and eager.
import './spec/feed-read.js';
// The feed itself — the four modules below — loads after first paint. See
// loadWorldFeed() at the foot of this file.
import './spec/daily-split.jsx';
import './spec/search-overlay.jsx';
import './spec/test-definitions.js';
import './spec/passive-progress.js';
import './spec/test-feed-data.js';
// lens-defs builds LENS_FEED_QS at module scope off window.LENSES, so it has
// to land after the core tests it deliberately trails in the feed.
import './spec/lens-defs.js';
import './spec/lens-cards.jsx';
import './spec/passive-meter.jsx';
import './spec/test-overlay.jsx';
import './spec/profile-overlay.jsx';
import './spec/person-mindmap.jsx';
import './spec/person-overlay.jsx';
import './spec/city-overlay.jsx';
import './spec/suggestions.jsx';
import './spec/demographics.jsx';
import './spec/place-stats.jsx';
import './spec/mirror-answers.jsx';
import './spec/mirror-field.jsx';
import './spec/mirror-field-pops.jsx';
import './spec/group-role-map.jsx';
import './spec/group-mirror.jsx';
import './spec/segment-explorer.jsx';
import './spec/mirror-tab.jsx';
import './spec/map-bottom-card.jsx';
import './spec/map-people.jsx';
import './spec/map-layout.js';
import './spec/map-chiprow.jsx';
import './spec/map-tab.jsx';
import './spec/logic-test.jsx';
import './spec/profile-general.jsx';
// These were born in this repo (never in design/) and live as typed TSX
// under ui/; they self-register on globalThis so the render-time lookups
// in daily-split / profile-overlay / profile-general still work.
import './ui/LiveDuelPanel';
import './ui/LivePrivacyPanel';
import './ui/CityPicker';
import './ui/PickSearch';
import './ui/LiveCohortBody';
import './ui/LiveGroupsMirrorBody';
import './spec/app-shell.jsx';

// ── the world feed, after first paint ──────────────────────────────────
//
// 85 KB of the bundle — world-feed.jsx alone is the largest module in this
// layer — and nothing on the first frame needs it. The feed opens BELOW
// today's card once the question is answered, so a cold start paints the
// daily without it either way.
//
// This is a lazy load the spec layer could already absorb, which is why it
// is the one worth doing: `daily-split.jsx` line 501 already reads
// `window.WorldFeed &&` before rendering the feed node, so an unloaded feed
// renders as no feed — exactly the frame a user who has not answered yet
// sees. No guard was added for this; the guard was already the contract.
//
// SEQUENTIAL awaits, not Promise.all. Order in this file is semantic
// (src/v2/README.md) and these four are no exception: world-feed.jsx reads
// window.WORLD_TOPICS and window.WORLD_CHANNELS at module scope, and a
// parallel load would resolve them in whatever order the network or disk
// happened to finish in.
//
// Memoised, so the second caller waits on the first load rather than
// starting another — main.jsx calls it once, the mount tests call it in
// beforeAll, and both get the same promise.
//
// check:globals rule 2 is satisfied by the literal './spec/…' strings
// below exactly as it was by the static imports (it substring-matches this
// file). Rule 1 is name-level and cannot see load ORDER at all, so it would
// not notice if this list were wrong — the mount tests are what covers
// that, which is why smoke.test.jsx now asserts BOTH states: the app before
// the chunk lands, and the feed present after.
let worldFeedLoad = null;
export function loadWorldFeed() {
  if (!worldFeedLoad) {
    worldFeedLoad = (async () => {
      await import('./spec/world-feed-comments.js');
      await import('./spec/world-feed-counters.js');
      await import('./spec/consequence-beat.jsx');
      await import('./spec/world-feed.jsx');
    })();
  }
  return worldFeedLoad;
}
