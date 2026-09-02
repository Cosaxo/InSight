// The two imports in this file that are NOT spec modules and carry no load
// order: pure helpers for the deferred groups at the foot of the file. They
// sit above the ordered list rather than inside it because nothing in that
// list reads them, and the list's order is a contract (see below).
import { retryable } from './data/lazy';
import { rememberMirror } from './data/mirrorChunk';

// Load order mirrors the standalone's script tags — order is semantic, do not sort.
import './spec/sample-data.js';
import './spec/archetype-data.js';
// compare-pop.js stood here until D353: IS_COMPARE_POP's only readers are
// the Mirror's Compare lens and Groups portrait, so it rides loadMirrorTab()
// (the Mirror block further down) rather than first paint.
import './spec/daily-questions.js';
// suggestions.js moved to the loadOverlays group (still listed, still in
// order — the D25 move): the door's store carries the decline furniture
// and the demo room, and check:bundle's eager budget is why a closed door
// must not cost a byte at boot. Its purge listener attaches when the group
// loads, which is safe: purgeLocalTrace removes the insight.* keys
// itself, and a module that never loaded holds no in-memory state for
// the listener to clear.
// demographics.js stood here until D353 — DEMOGRAPHICS has one reader,
// demographics.jsx, a Mirror module; both ride loadMirrorTab() now.
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
// compare-breakdown.jsx stood here until D353 — the Mirror block below.
// The relmap group SPLIT at D200, and the split is by consumer rather than
// by size. relmap-lenses.jsx stays eager because it has a LIVE consumer —
// vote-cuts.js reads window.RMLenses for the who-voted sheet's Type cut
// (D146) — and it is the small one anyway. Its three siblings moved to
// loadOverlays: they are reachable only through the demo Circle field, and
// a live build never renders that (Circle takes LiveCircleBody since D101).
import './spec/relmap-lenses.jsx';
// vote-cuts sits between the relmap lenses and their consumers, exactly where
// the standalone loads it: VOTECUTS reuses the lens band definitions, and the
// who-voted breakdowns (daily-split, world-feed) read VOTECUTS at render time.
import './spec/vote-cuts.js';
// relmap-core.js and relmap-panels.jsx are not listed anywhere: relmap.jsx
// imports both by name (D137), so the ESM graph loads them into whichever
// chunk it lands in and rule 2 is satisfied without a line. relmap.jsx
// itself is named in loadOverlays at the foot of this file.
import './spec/type-marks.jsx';
import './spec/result-rose.jsx';
import './spec/result-card.jsx';
import './spec/group-daily.jsx';
import './spec/read-run.jsx';
// duo-daily.jsx moved to loadOverlays(): in a SHIPPING build daily-split
// picks LiveDuelPanel (React.lazy since D156) whenever LIVE.enabled, so the
// `window.DuoBody` arm is dead code the installed app cannot execute — the
// same argument D200 used to take relmap.jsx off this list. group-daily.jsx
// stays, because GDAv is read from the Mirror (group-mirror, group-role-map).
// place-stats.js and place-stats.jsx are gone from this list too, and they
// were the last pair. The .js was eager because the pool concatenated
// window.PLACE_RATE_QS at module scope; the .jsx was eager because the .js
// was, and it would have dragged it back in on its own. Both are in
// loadWorldFeed() now — the .jsx there rather than in loadOverlays because
// its reader (mirror-field-pops.jsx's Scores lens) is NOT reached through
// an opener, which is that group's whole contract, and main.jsx re-renders
// the root after the feed group precisely for globals read this way. The
// scorecard is "fed by rate questions in the World feed" anyway, which is
// the group it belongs to.
//
// pick-data.js is NO LONGER HERE, and it was the expensive half: 48 KB of
// catalogue demo stock, eager only because the pool concatenated
// window.PICK_QS at module scope too. That concat is `joinDemoStock()` now
// (world-feed-data.js), called from loadWorldFeed() with the module's own
// named export — so pick-data rides the feed's chunk, where its only other
// reader (world-feed.jsx's `PICKS`) already lives.
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
// world-catalogs.js is NOT here either, for pick-data's reason exactly:
// its module-scope append to window.WORLD_FEED_QS was the only thing
// holding a demo catalogue in the first-paint graph, since its one importer
// (world-feed.jsx) is deferred. It exports `WF_CATALOG_QS` now and
// loadWorldFeed() joins it.
//
// world-subtopics.js is NOT here any more either. It was the awkward one:
// it appended to the pool IN PLACE (`pool.push`) and retagged an existing
// question, where the other two concatenated — so the treatment had to be
// applied to a mutation. `installSubtopicStock()` is that, past the same
// `demoPoolOpen()` guard, and both loadWorldFeed() and loadOverlays() call
// it: the feed draws these cards and search-overlay's discover sheet asks
// `SUBTOPICS.offers()`, which reads the pool to decide which leaves are
// stocked. Its window mirror is gone with it — search-overlay imports the
// binding by name now.
// The report store stays eager. The Learn stack does NOT, any more, and
// the sentence that used to keep it here is the whole reason: it read
// "SUBTOPICS/LEARN/LEARN_FEED are subscribed to from eager screens
// (search, map) as well as the deferred feed" — D27's arithmetic verbatim,
// and both named screens have since left the eager graph. search-overlay
// moved into loadOverlays at D223; the Map's seven moved into loadMapTab at
// v28 §5. Nothing on the first frame reaches any of the five now, and the
// recorded reason expired without anything noticing.
//
// They load at the head of loadWorldFeed() instead, and learn-bits.jsx
// loads in loadMapTab() as well — see both. Measured: eager graph 849 → 813
// KB.
import './spec/world-feed-report.js';
// feed-read.js is the feed's MEMORY, not the feed: the Mirror reads its
// stats (mirror-field-pops.jsx, app-shell.jsx) on screens the feed never
// opens on. 1.6 KB, and eager.
import './spec/feed-read.js';
// The feed itself — the four modules below — loads after first paint. See
// loadWorldFeed() at the foot of this file.
import './spec/daily-split.jsx';
// search-overlay.jsx and profile-overlay.jsx moved to the loadOverlays
// group (still listed, still in order — the D25 move). Both are reachable
// only by a tap on a header control, and the criterion this list used to
// apply ("no control in the header or tabbar") was about the
// SYNCHRONISATION, not the surface: app-shell's openDeferred awaits the
// chunk before setting the state that mounts one, and since D223 every
// member of LIVE_OVERLAYS goes through it. Their render sites take the
// `window.X &&` form to match.
import './spec/test-definitions.js';
import './spec/passive-progress.js';
import './spec/test-feed-data.js';
// lens-defs.js stood here until D353 (the Mirror block below). Its old
// note survives in one line: its feed pool (LENS_FEED_QS) is a lazy
// builder, so nothing ever waited on a module-scope snapshot of it.
import './spec/passive-meter.jsx';
// test-overlay.jsx stood here (deferred, see loadOverlays below) until D121
// deleted it: the four core instruments fill from the feed and have no
// sit-down flow, so there was nothing left for it to open.
// profile-overlay.jsx: see the note at search-overlay above.
// person-mindmap.jsx, person-overlay.jsx, city-overlay.jsx and
// suggestions.jsx load after first paint too, from the same group.
//
// THE MIRROR'S THIRTEEN left this list at D353 for loadMirrorTab() at the
// foot of this file — compare-pop.js, demographics.js and
// compare-breakdown.jsx from higher up, then lens-defs.js, lens-cards.jsx,
// demographics.jsx, mirror-answers.jsx, mirror-field.jsx,
// mirror-field-pops.jsx, group-role-map.jsx, group-mirror.jsx,
// segment-explorer.jsx and mirror-tab.jsx from here. ~130 KB of the eager
// graph for a tab the app never opens ON: TWEAK_DEFAULTS.tab is 'track'
// and nothing persists a tab across launches, so the Mirror is always one
// tap away and never the first frame. Their order lives as static
// side-effect imports at the top of mirror-tab.jsx now — the Map's shape
// (v28 §5, below) — so one import of that file evaluates the family in the
// order this list used to guarantee.
//
// What had kept them eager was one JSX tag: app-shell rendered <MirrorTab>
// by name. It renders MirrorSlot now, which takes the module off
// data/mirrorChunk when the prewarm has landed it — the same tick as the
// tap, no blank frame — and imports it itself when it has not.
// The Map's seven modules (map-bottom-card, map-learn-card, map-people,
// map-layout, map-groups, map-chiprow, map-tab) left this list for
// loadMapTab() at the foot of this file (v28 §5): the Map is a Mirror-tab
// destination, not a first-paint surface, and ~93 KB of source was the
// eager graph's single cheapest win. Their order now lives as static
// imports at the top of map-tab.jsx, so one import of that file evaluates
// the family in the order this list used to guarantee. (map-branches,
// map-anchors and map-group-stats stay eager above — daily-questions,
// profile-general and the profile's stats read them on first-paint
// surfaces.)
// logic-test.jsx loads after first paint; it imports data/logic-gen
// directly (D53), so the generator rides the same deferred chunk without
// a listing of its own.
// profile-general.jsx is NOT here any more — it loads in loadOverlays(),
// immediately before the overlay that is its only reader. Nothing imports
// it by name and nothing outside profile-overlay.jsx reads
// window.GeneralPanel, so it could never be reached before that group had
// resolved — yet it and its whole static tail sat in the modulepreload set
// on every cold start. Measured: 20 KB of first paint.
// ui/CityPicker and ui/PickSearch stood here until D352's sweep. Born in
// this repo (never in design/), they self-registered on globalThis for
// render-time lookups in profile-general and world-feed, and this listing
// was what made them eager. Both consumers import them now, so each rides
// its consumer's chunk — the overlays', the feed's — and first paint
// stops paying ~11 KB for a picker and a search box nothing on the first
// frame can open. ui/LivePrivacyPanel left the same way at D344.
// NB: no other ui/ panel is listed here, and the reason is now the same one
// for all of them: nothing looks them up by name. Every remaining consumer
// imports the panel it renders, so the ESM graph loads it (rule 2 asks
// whether a file LOADS, not whether this file names it). ui/LiveCircleBody,
// ui/LiveCohortBody and ui/profileSetup additionally must not be listed —
// each is reached only past first paint (D25's deferred group; a React.lazy
// for Circle and, since D119, for Cohort; main.jsx's own dynamic import for
// the account-creation questions, D151), so a line here would drag it into
// the eager bundle, which is the whole thing the deferral bought.
//
// ui/LiveDuelPanel left this list at D156 and joined that second group: it
// is now a React.lazy in daily-split.jsx rather than a globalThis lookup,
// which took the whole live duel surface — and, with it, ui/LiveTakesPanel's
// last eager importer — out of first paint. The rebuild that gave the panel
// the prototype's rail, marks and reveal bars is what made the weight worth
// moving; the lazy split is what paid for it.
//
// ui/LiveGroupsMirrorBody was listed until D137 for a side effect it no
// longer has. It stays in the eager chunk anyway — mirror-tab.jsx imports
// it, and that is eager — so dropping the line moved no bytes.
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
// no longer split the same way, and the sentence here used to say they did
// ("all eager imports above"). world-feed-report.js still is; the learn
// stack, pick-data.js, world-catalogs.js and world-subtopics.js are in this
// group now, at its head, each for its own reason recorded where its eager
// import used to sit.
//
// Memoised, so the second caller waits on the first load rather than
// starting another — main.jsx calls it once, the mount tests call it in
// beforeAll, and both get the same promise.
//
// check:globals rule 2 is satisfied by the literal './spec/…' strings
// below exactly as it was by the static imports (it substring-matches this
// file). Rule 1 is name-level and cannot see load ORDER at all, so it would
// not notice if this list were wrong — the mount tests are what covers
// that, which is why smoke-daily.test.jsx asserts BOTH states: the app before
// the chunk lands, and the feed present after.
// retryable(), not `if (!p) p = …`: the hand-rolled memo cached a REJECTED
// promise exactly as it cached a resolved one, so one failed chunk fetch
// removed this group for the rest of the session. data/lazy.ts carries the
// reasoning and the tests; the sharing every comment here relies on is
// unchanged.
export const loadWorldFeed = retryable(async () => {
  // The catalogue pick cards and their demo store (48 KB), then the join
  // that used to happen at world-feed-data.js's module scope and made this
  // module eager. Ordered, not parallel: the pool has to take the array
  // this import produces.
  //
  // `joinDemoStock` refuses when LIVE.enabled — read its note, the guard is
  // the whole reason this deferral is safe. main.jsx runs
  // `initLive().finally(() => … loadWorldFeed())`, so unlike the module
  // scope it replaces, this runs after the live pool has been published.
  const picks = await import('./spec/pick-data.js');
  const cats = await import('./spec/world-catalogs.js');
  const places = await import('./spec/place-stats.js');
  const pool = await import('./spec/world-feed-data.js');
  pool.joinDemoStock(picks.PICK_QS, cats.WF_CATALOG_QS, places.PLACE_RATE_QS);
  // The scorecard CARD itself, which publishes window.PlaceStatsCard for
  // mirror-field-pops' Scores lens. After its store, which it imports.
  await import('./spec/place-stats.jsx');
  // …and the subtopic leaves' stock, which pushes rather than concatenates.
  // After the two concats, the order the eager list held.
  (await import('./spec/world-subtopics.js')).installSubtopicStock();
  // The Learn stack, in the order the eager list held it — learn-data
  // before learn-progress before learn-feed, because each reads the one
  // above at module scope. learn-data/learn-progress/learn-feed are also
  // reached through the ESM graph (world-feed.jsx and map-tab.jsx import
  // them by name), but learn-social.js and learn-bits.jsx publish onto
  // window and nothing imports them, so those two are here on their own
  // account and rule 2 needs the literals.
  await import('./spec/learn-data.js');
  await import('./spec/learn-progress.js');
  await import('./spec/learn-social.js');
  await import('./spec/learn-feed.js');
  await import('./spec/learn-bits.jsx');
  // world-feed-comments.js and world-feed-counters.js are NOT awaited here
  // and do not need to be — world-feed.jsx imports both by name (D246,
  // D249), so the module graph orders them and they stay in the feed
  // chunk. Same reasoning as world-feed-math.js below.
  //
  // consequence-beat.jsx IS still awaited: daily-split.jsx renders it too,
  // by bare tag through the bridge, so the feed's own import is not the
  // only thing that has to have loaded before it draws.
  await import('./spec/consequence-beat.jsx');
  // world-feed-math.js is NOT awaited here and does not need to be —
  // world-feed.jsx imports it directly, so the module graph orders it,
  // and it stays out of the entry chunk with the rest of the feed.
  //
  // It used to be named in a COMMENT below this line, to satisfy
  // check:globals rule 2 by substring match. That rule now strips
  // comments (a commented-out side-effect import loads nothing, which is
  // how five v17 modules could have been silently unwired) and instead
  // accepts a file the ESM graph already reaches. Nothing to name here.
  await import('./spec/world-feed.jsx');
});

// ── the no-button overlays, after first paint ──────────────────────────
//
// The five overlays with no control in the header or tabbar: `test`,
// `person`, `city`, `suggest` and `logic` — reached only through the
// window.open* cross-links app-shell installs in an effect. Nothing on the
// first frame can reach any of them, which is what makes them the next
// group after the feed (D25's argument, applied to the next candidate).
// (`suggest` gained a header + since D288 §1 made it the paid door — it
// stays here on exactly the argument that moved search and profile in at
// D223: the button goes through openDeferred, so the criterion is the
// synchronisation, not the surface.)
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
// That also means the guards at the render sites (`window.LogicOverlay &&`
// …) are a second line rather than the mechanism. Without the awaits they
// would be actively wrong: `setOv(k)` with the chunk still in flight
// renders nothing, and nothing is scheduled to re-read the global, so the
// overlay would stay blank until some unrelated state change. Guard alone
// is not enough here — that is the difference between this group and the
// feed, whose absence is a legitimate frame.
//
// SEQUENTIAL awaits and this exact order, which is spec-index's own order
// with the eager modules removed. (data/logic-gen used to be listed here
// explicitly for its window.LOGIC_GEN side effect; logic-test.jsx imports
// it directly now — D53 — so the ESM graph carries it into the same
// chunk without a line of its own.)
//
// relmap.jsx JOINED this group at D200, and the entry that kept it out is
// worth keeping because it was right when it was written and stopped being
// right without anything touching it. It read: relmap is the one overlay
// with a first-frame consumer — mirror-field-pops.jsx reads
// `typeof RelationshipMap === 'function'` to decide whether the Mirror's
// Circle population renders the embedded map or the generic field canvas,
// on a render nothing re-triggers, so deferring it would silently swap the
// Circle picture for the fallback. Not a size decision; a reachability one.
//
// What changed is the reachability, at D101 and not here: Circle in a live
// build takes LiveCircleBody, so MirrorFieldBody is never called with
// `pop === 'circle'` at all and that first-frame read is DEMO-ONLY. The
// argument stood for three months after its premise expired, which is the
// shape worth noticing — a correct reason for an eager import outlives the
// branch that made it true, and nothing measures a reason.
//
// The read itself is gone rather than deferred (D200): mirror-field-pops
// awaits this group and re-renders, which is the same synchronisation
// app-shell's openers use and the one thing a `typeof` probe cannot do.
//
// Memoised for the same reason as loadWorldFeed: main.jsx starts it once,
// every opener awaits it, and the mount tests await it in beforeAll — all
// of them get the same promise rather than racing separate loads.
//
// And retryable() for the same reason too — but the recovery lands harder
// here than it does on the feed. Every overlay in this group is reached ONLY
// through an opener that awaits this promise, so a cached rejection turned
// each of them into a tap that does nothing, permanently. Now the second tap
// re-attempts the import; nothing else had to change to get that.
// ── the Map, after first paint too (v28 §5) ────────────────────────────
//
// One import, not seven: map-tab.jsx carries its six siblings as static
// side-effect imports, so the ESM graph evaluates the family in the order
// the eager list used to hold — including the one hard constraint, the
// module-scope destructure of window.MapTabLayout in map-tab.jsx needing
// map-layout.js first.
//
// SYNCHRONISED BY THE CONSUMER, not by a re-render from here: mirror-tab's
// MapSlot runs its own dynamic import of the same module and holds the
// named export in state, so the You stop re-renders itself when the chunk
// lands (mirror-field-pops' relmap pattern, D200). That component did not
// exist when this paragraph was written — the stop used a `React.lazy`,
// which caches a rejection and re-throws it forever — and it does now,
// which is what makes the sentence above true. This loader exists so
// main.jsx can start the fetch right after first paint — by the time a
// thumb reaches the Mirror the module cache already has it — and so
// check:globals rule 2 sees the './spec/map-tab.jsx' literal that proves
// the family is loaded by something.
//
// person-mindmap (the loadOverlays group below) reads four of the family's
// globals at render time; it carries its own static imports of those four
// now, so the overlay chunk does not depend on this loader having run —
// the ESM graph is the guarantee there too.
export const loadMapTab = retryable(async () => {
  // learn-bits.jsx, and NOT because map-tab needs it: map-learn-card.jsx
  // reads the bare `window.LMStreak` at render (its one guard renders null
  // instead), and that module moved out of the eager list into
  // loadWorldFeed above. Two groups importing it is free — a dynamic import
  // is memoised, so whichever loader gets there first pays — and it keeps
  // this group's contract what it has always been: reachable without any
  // other group having run. The alternative is a Map that silently drops
  // its streak pips whenever it wins the race against the feed.
  //
  // learn-data/learn-progress ride the ESM graph here already (map-tab.jsx
  // and map-learn-card.jsx import them by name), which is why they are not
  // repeated.
  await import('./spec/learn-bits.jsx');
  await import('./spec/map-tab.jsx');
});

// ── the Mirror, after first paint too (D353) ───────────────────────────
//
// One import, not thirteen: mirror-tab.jsx carries its twelve siblings as
// static side-effect imports in the order the eager list used to hold, so
// the ESM graph evaluates the family in that order — loadMapTab's shape,
// applied to the tab around the Map.
//
// SYNCHRONISED BY THE CONSUMER, as the Map is: app-shell's MirrorSlot
// holds the tab's export in state and imports the same module itself, so
// a tap that beats this prewarm still lands (one empty frame, then the
// tab), and a failed chunk costs the tab its body until the next visit
// re-attempts — not the app its screen. What is NEW against the Map is
// the handoff: the resolved namespace is remembered on data/mirrorChunk,
// and the slot's state initializer reads it, so once this has landed an
// open renders in the tap's own tick with no blank frame between. That is
// the guard check:bundle's header said this tab needed and the overlays
// did not — the Mirror is one tap from first paint, and a tab that
// flashes empty on every open would be a worse trade than the bytes.
//
// This loader exists so main.jsx can start the fetch right after first
// paint, so loadOverlays below can wait on it, so the mount suites can
// await it in beforeAll, and so check:globals rule 2 sees the
// './spec/mirror-tab.jsx' literal that proves the family is loaded by
// something. The twelve siblings satisfy rule 2 through mirror-tab's own
// imports, the way map-tab's six do.
export const loadMirrorTab = retryable(async () => {
  const m = await import('./spec/mirror-tab.jsx');
  rememberMirror(m);
  return m;
});

export const loadOverlays = retryable(async () => {
  // The Mirror's family first (D353): three members of this group read
  // Mirror globals at render — profile-general's MirrorFieldBody and
  // LENSES, profile-overlay's LensesPanel, person-overlay's CompareCarousel
  // — so no overlay may be able to open before that chunk has landed.
  // Memoised, so this is the prewarm's own promise when main.jsx got here
  // first, and the fetch itself when a tap did.
  await loadMirrorTab();
  // Then relmap.jsx, because the rest of this list is spec-index's own
  // order with the eager modules removed and relmap.jsx sat above every
  // other member of it.
  await import('./spec/relmap.jsx');
  // The subtopic stock, installed for THIS group too — search-overlay.jsx
  // below reads SUBTOPICS.offers(), which is "only the stocked leaves" and
  // reads the pool to decide. Idempotent and guarded, so whichever loader
  // arrives first does the work; the point is that neither group has to
  // wait on the other. Same shape as learn-bits.jsx in loadMapTab.
  (await import('./spec/world-subtopics.js')).installSubtopicStock();
  // Demo-only in practice (see the note where this used to sit eager). A
  // demo build can reach the duo tab before this group resolves; the render
  // site's existing `window.DuoBody || 'div'` guard draws an empty div for
  // that frame rather than throwing, which is the same frame loadWorldFeed's
  // own guard accepts.
  await import('./spec/duo-daily.jsx');
  // …then the two the header opens, in the order they held in the eager
  // list above (D223). ~12 KB of the entry chunk that only a tap reaches.
  await import('./spec/search-overlay.jsx');
  // Before its reader, which is the whole contract: profile-overlay looks
  // up window.GeneralPanel at render time, and these sequential awaits are
  // what order the two.
  await import('./spec/profile-general.jsx');
  await import('./spec/profile-overlay.jsx');
  await import('./spec/person-mindmap.jsx');
  await import('./spec/person-overlay.jsx');
  await import('./spec/city-overlay.jsx');
  await import('./spec/suggestions.js');
  await import('./spec/suggestions.jsx');
  await import('./spec/logic-test.jsx');
});

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
