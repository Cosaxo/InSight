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
import './spec/reveal-clock.js';
// The app-feel layer (v17). Five of these are pure side effects — they install
// one document-level listener each and no component knows they exist — so
// their only wiring IS this list. haptics.js and swipe-back.js publish named
// exports instead of globals; they are listed for check:globals rule 2, not
// because anything waits on them.
import './spec/haptics.js';
import './spec/swipe-back.js';
import './spec/sheet-escape.js';
import './spec/sheet-drag.js';
import './spec/scroll-memory.js';
import './spec/edge-fade.js';
import './spec/iOS.jsx';
import './spec/tweaks-panel.jsx';
// primitives.jsx no longer publishes globals (D39) — its consumers import
// it by name, so this line loads nothing anybody is waiting for. It stays
// because check:globals rule 2 requires every file in spec/ to appear here,
// and that rule is what catches a module silently dropping out of the
// bundle. When the next provider converts, it keeps its line for the same
// reason; the list stops being a load-order contract one module at a time.
import './spec/primitives.jsx';
// explain-sheet.jsx sits here in the standalone's order, and it is a named-
// export module too — but it builds on primitives' `Sheet`, so the line above
// it is a real dependency rather than a load-order relic.
import './spec/explain-sheet.jsx';
import './spec/viz-primitives.jsx';
import './spec/compare-breakdown.jsx';
import './spec/relmap-core.js';
import './spec/relmap-lenses.jsx';
// vote-cuts sits between the relmap lenses and their consumers, exactly where
// the standalone loads it: VOTECUTS reuses the lens band definitions, and the
// who-voted breakdowns (daily-split, world-feed) read VOTECUTS at render time.
import './spec/vote-cuts.js';
import './spec/relmap-panels.jsx';
import './spec/relmap.jsx';
import './spec/test-viz.jsx';
import './spec/profile-test-viz.jsx';
import './spec/type-marks.jsx';
import './spec/result-rose.jsx';
import './spec/result-card.jsx';
import './spec/group-daily.jsx';
import './spec/read-run.jsx';
import './spec/duo-daily.jsx';
// place-stats.js and pick-data.js must precede world-feed-data.js: the feed
// pool concatenates window.PLACE_RATE_QS and window.PICK_QS at module scope,
// so both card sets must already exist.
import './spec/place-stats.js';
import './spec/pick-data.js';
// world-palette.js — the hue gate every World surface runs its colours
// through. A named-export module; its position here is the standalone's, and
// it reads no other module at load time.
import './spec/world-palette.js';
// world-feed-data.js stays EAGER even though the feed itself does not:
// daily-split.jsx reads window.WORLD_TOPICS at MODULE scope (line 19), and
// deferring it would silently swap the real topic set for that line's
// five-entry fallback — the failure mode being a wrong chip row rather than
// an error anyone would see.
import './spec/world-feed-data.js';
// world-catalogs appends its questions to window.WORLD_FEED_QS at module
// scope, so it has to follow world-feed-data (which creates the pool) — and
// it stays eager for the same reason the pool does. In live mode live.ts
// replaces the pool wholesale, so the demo catalogue cards never leak there.
import './spec/world-catalogs.js';
import './spec/world-subtopics.js';
// The report store and the Learn stack are eager: SUBTOPICS/LEARN/LEARN_FEED
// are subscribed to from eager screens (search, map) as well as the deferred
// feed, and together they are a fraction of the feed chunk's weight.
import './spec/world-feed-report.js';
import './spec/learn-data.js';
import './spec/learn-progress.js';
import './spec/learn-social.js';
import './spec/learn-feed.js';
import './spec/learn-bits.jsx';
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
// lens-defs' feed pool (LENS_FEED_QS) is a lazy builder now — it differs
// between demo and live, and liveness lands only after boot — so nothing
// here waits on a module-scope snapshot anymore; the listing itself is
// still load-bearing (rule 2).
import './spec/lens-defs.js';
import './spec/passive-meter.jsx';
// test-overlay.jsx loads after first paint — see loadOverlays() below.
import './spec/lens-cards.jsx';
import './spec/profile-overlay.jsx';
// person-mindmap.jsx, person-overlay.jsx, city-overlay.jsx and
// suggestions.jsx load after first paint too, from the same group.
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
import './spec/map-learn-card.jsx';
import './spec/map-people.jsx';
import './spec/map-layout.js';
import './spec/map-groups.js';
import './spec/map-chiprow.jsx';
import './spec/map-tab.jsx';
// logic-test.jsx loads after first paint; it imports data/logic-gen
// directly (D52), so the generator rides the same deferred chunk without
// a listing of its own.
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
// The largest chunk in this layer — world-feed.jsx roughly doubled in the
// v15 revision — and nothing on the first frame needs it. The feed opens
// BELOW today's card once the question is answered, so a cold start paints
// the daily without it either way.
//
// This is a lazy load the spec layer could already absorb, which is why it
// is the one worth doing: `daily-split.jsx` already reads
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
// The v15 modules that landed AROUND these four in the standalone's order
// (world-catalogs, world-subtopics, world-feed-report, the learn stack) are
// all eager imports above: each publishes a self-contained store nothing in
// this group needs at module scope, so the deferred set stays exactly the
// four it was.
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

// ── the no-button overlays, after first paint ──────────────────────────
//
// The five overlays with no control in the header or tabbar: `test`,
// `person`, `city`, `suggest` and `logic` — reached only through the
// window.open* cross-links app-shell installs in an effect. Nothing on the
// first frame can reach any of them, which is what makes them the next
// group after the feed (D25's argument, applied to the next candidate).
//
// SYNCHRONISED BY THE OPENER, NOT BY A RE-RENDER. This is the one
// structural difference from loadWorldFeed, and it is why the group is
// safe. main.jsx has to re-render after the feed lands because daily-split
// reads `window.WorldFeed` during a render nothing would re-trigger. These
// do not: every one is reachable ONLY through an opener, and the openers
// await this promise before setting the state that mounts the overlay. The
// await IS the synchronisation, so there is no window in which an overlay
// is open and its module is missing.
//
// That also means the guards at the render sites (`window.TestOverlay &&`
// …) are a second line rather than the mechanism. Without the awaits they
// would be actively wrong: `setOv('test')` with the chunk still in flight
// renders nothing, and nothing is scheduled to re-read the global, so the
// overlay would stay blank until some unrelated state change. Guard alone
// is not enough here — that is the difference between this group and the
// feed, whose absence is a legitimate frame.
//
// SEQUENTIAL awaits and this exact order, which is spec-index's own order
// with the eager modules removed. (data/logic-gen used to be listed here
// explicitly for its window.LOGIC_GEN side effect; logic-test.jsx imports
// it directly now — D52 — so the ESM graph carries it into the same
// chunk without a line of its own.)
//
// relmap.jsx is deliberately NOT here despite being the largest candidate
// (~43 KB). It is the one overlay with a first-frame consumer:
// mirror-field-pops.jsx reads `typeof RelationshipMap === 'function'` to
// decide whether the Mirror's Circle population renders the embedded map or
// the generic field canvas. That read is on a render nothing re-triggers,
// so deferring it would silently swap the Circle picture for the fallback
// until some later state change — the same failure world-feed-data.js stays
// eager to avoid. Not a size decision; a reachability one.
//
// Memoised for the same reason as loadWorldFeed: main.jsx starts it once,
// every opener awaits it, and the mount tests await it in beforeAll — all
// of them get the same promise rather than racing separate loads.
let overlaysLoad = null;
export function loadOverlays() {
  if (!overlaysLoad) {
    overlaysLoad = (async () => {
      await import('./spec/test-overlay.jsx');
      await import('./spec/person-mindmap.jsx');
      await import('./spec/person-overlay.jsx');
      await import('./spec/city-overlay.jsx');
      await import('./spec/suggestions.jsx');
      await import('./spec/logic-test.jsx');
    })();
  }
  return overlaysLoad;
}

// …and published on globalThis, because app-shell's openers have to await
// it and there is no other way for a spec module to reach it.
//
// The two alternatives both fail, and it is worth saying how so nobody
// "tidies" this into one of them:
//
//   - `await import('../spec-index.js')` inside app-shell works, but the
//     bundler then warns INEFFECTIVE_DYNAMIC_IMPORT on every single build
//     (spec-index is statically imported by main.jsx, so it cannot move to
//     its own chunk — nor should it). check-bundle.mjs's header records what
//     happens to a warning that fires on every build: it becomes background
//     noise, and the next real one is invisible behind it.
//   - publishing it from a `data/` module — the house pattern, and how
//     back.ts hands registerBackHandler to this same shell — cannot work
//     here. That module would have to import this file, and `data/` is
//     TypeScript with no `allowJs`, so importing a .js is a tsc error. The
//     one-directional boundary is deliberate: data/ and ui/ never import
//     spec/, they publish globals that spec/ reads.
//
// Publishing from here is free of both problems and costs no gate:
// scripts/spec-globals.mjs already scans spec-index.js for definitions
// (alongside main.jsx), so check:globals resolves app-shell's reference
// without an allowlist entry — which is the outcome that file's
// RUNTIME_ALLOWLIST comment asks for.
globalThis.loadOverlays = loadOverlays;
