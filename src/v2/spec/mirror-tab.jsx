// Ported from design/spec-modules/mirror-tab.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { HAPTIC } from './haptics.js';
import { bindSwipeBack } from './swipe-back.js';
// The live Mirror bodies, as ordinary imports (D39's ratchet; the
// procedure is in src/v2/README.md). All are typed TSX in ui/ with
// default exports, so nothing here needs the global scope to find them —
// and the `typeof window.X === 'function'` guards that used to wrap each
// one are GONE rather than kept: an imported binding cannot be unset, so
// the guard could only ever be false during a load-order accident that
// an import makes impossible. The data conditions beside them (`liveGeo`,
// the stop id) are unchanged, because those guard data, not loading.
import NearLiveBody from '../ui/NearLiveBody';
// Three of them load AFTER first paint, and the reason is the bundle budget
// rather than taste.
//
// Circle went first: it and data/circle.ts added 11 KB to the entry chunk,
// which put it over MAX_CHUNK_KB — the ceiling the D100 commit deliberately
// left 3 KB of headroom under so that the next eager addition would have to
// defer instead of argue. Cohort followed at D119, when the stop's tab row
// spent the eager graph's last kilobyte (check:bundle, MAX_EAGER_KB).
// Groups followed at D190, when giving it that row put the eager graph 2 KB
// off the ceiling — the rule this comment describes, applied to itself.
//
// All three are also the right ones to defer ON THE MERITS, for one reason:
// the Mirror opens on You (the Map). Circle is two stops along, Groups
// three and City four, and each needs a network round trip of its own
// before it can render anything, so the chunk fetch overlaps work the stop
// was going to do regardless. Deferring the Map or Near would not be —
// those are what the tab opens with.
const LiveCircleBody = React.lazy(() => import('../ui/LiveCircleBody'));
const LiveCohortBody = React.lazy(() => import('../ui/LiveCohortBody'));
const LiveGroupsMirrorBody = React.lazy(() => import('../ui/LiveGroupsMirrorBody'));

// mirror-tab.jsx — MIRROR: one tab, one verb — see yourself against a population.
// One telescope, seven stops, from fully retracted to fully extended:
//   you     → the telescope retracted — you, alone, visualized (the Map)
//   circle  → your people — close ties
//   groups  → your named circles — The Crew, Book Club… (GroupsMirrorBody)
//   near    → who is around you right now — the presence count (D84/D111)
//   city    → your city: its answers and its kindred constellation (D111)
//   country → everyone in your country
//   world   → everyone
//
// Near and City were one stop from D9 to D111 ("Near IS your city", City
// dropped from the live ruler). D111 un-folded them: they answer different
// questions — presence vs a profile anchor — and folding them meant the
// scale lied about what it measured while the prototype's most distinctive
// stop shipped dark.
//
// MIRROR_POPS below is still five: `pop` is the state the rest of the app
// reads, and the last three stops all resolve to pop 'world' at a
// different zoom. MIRROR_STOPS is what the user actually sees.

const MIRROR_POPS = [
  { id: 'you',    label: 'You',    kind: 'self', accent: 'var(--c-today)' },
  { id: 'circle', label: 'Circle', kind: 'set', accent: 'var(--c-people)' },
  { id: 'groups', label: 'Groups', kind: 'set', accent: 'var(--c-groups)' },
  { id: 'near',   label: 'Near',   kind: 'geo', accent: 'var(--c-city)' },
  { id: 'world',  label: 'World',  kind: 'geo', accent: 'var(--c-world)' },
];
const mirrorPop = (id) => MIRROR_POPS.find(p => p.id === id) || MIRROR_POPS[0];
const mirrorAccent = (id) => mirrorPop(id).accent || 'var(--c-city)';

// world zoom stops — how far the far mirror reaches
const WORLD_ZOOMS = [
  { id: 'city',    label: 'City' },
  { id: 'country', label: 'Country' },
  { id: 'world',   label: 'Globe' },
];

// ─── one graduated axis, from You to World, every stop named ───
// The three world zooms used to sit in a second pill row inside the hero.
// They are stops on the same telescope, so they belong on the same axis —
// which leaves the Mirror with exactly two levels: WHO (here) and WHAT
// (the lenses below) instead of three.
const MIRROR_STOPS = [
  { id: 'you', label: 'You', pop: 'you' },
  { id: 'circle', label: 'Circle', pop: 'circle' },
  { id: 'groups', label: 'Groups', pop: 'groups' },
  { id: 'near', label: 'Near', pop: 'near' },
  { id: 'city', label: 'City', pop: 'world', zoom: 'city' },
  { id: 'country', label: 'Country', pop: 'world', zoom: 'country' },
  { id: 'world', label: 'World', pop: 'world', zoom: 'world' },
];
const stopAccent = (id) => mirrorAccent((MIRROR_STOPS.find((s) => s.id === id) || MIRROR_STOPS[0]).pop);
// All seven stops in both modes since D111. The live ruler used to drop
// City (D9: Near WAS your city, and two stops on one cohort is how a
// scale starts lying) — the same rule now keeps them apart the other way:
// Near is presence only, City is the city cohort only.

// ─── the one selector — one graduated axis from You to World, every stop named ───
// Tap a stop, or DRAG along the ruler to scrub through the populations: the
// mirror follows your finger stop by stop, with a tick as each one passes. The
// axis is a slider, so it should feel like one; vertical pans still scroll.
function MirrorPopPicker({ stopId, onPick, big }) {
  const stops = MIRROR_STOPS;
  const n = stops.length;
  const idx = Math.max(0, stops.findIndex(p => p.id === stopId));
  const accent = stopAccent(stopId);
  // 38px of visual ruler, 44px of tap target — the extra 6px reaches UP into the
  // empty gap under the header, so it never steals a tap from the content below
  const H = big ? 54 : 44;
  const railRef = React.useRef(null);
  const drag = React.useRef({ on: false, last: idx, moved: false, x0: 0, t0: 0, x1: 0, t1: 0 });
  const [scrubbing, setScrubbing] = React.useState(false);

  const stopAt = (clientX) => {
    const r = railRef.current && railRef.current.getBoundingClientRect();
    if (!r || !r.width) return null;
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n)));
  };
  const goTo = (i) => {
    const j = Math.max(0, Math.min(n - 1, i));
    if (j === drag.current.last) return;
    drag.current.last = j;
    if (HAPTIC) HAPTIC.tick();
    onPick(stops[j]);
  };
  const scrub = (clientX) => { const i = stopAt(clientX); if (i != null) goTo(i); };
  const finish = () => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    setScrubbing(false);
    if (d.moved) {
      // a FLICK carries past where the finger stopped — fast and short still
      // travels, so the ruler answers a swipe as well as a slow drag
      const dt = Math.max(1, d.t1 - d.t0);
      const v = (d.x1 - d.x0) / dt;                     // px per ms
      if (Math.abs(v) > 0.35) {
        const carry = Math.min(3, Math.round(Math.abs(v) * 1.6)) * (v > 0 ? 1 : -1);
        if (carry) goTo(d.last + carry);
      }
      if (HAPTIC) HAPTIC.tap();
    }
    // `moved` stays set until the click it belongs to is swallowed, so the click
    // that follows a real drag doesn't re-pick whatever stop it lifted over
  };
  // Window-level listeners rather than pointer capture: capture on a container
  // whose children are buttons is unreliable with a mouse, and this gesture has
  // to behave the same under a finger, a mouse and a trackpad.
  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    // The event's own timestamp, not the wall clock: it is the same
    // DOMHighResTimeStamp the velocity maths below is in, and reading a
    // clock from a function declared in render is impure
    // (react-hooks/purity).
    const t = e.timeStamp;
    drag.current = { on: true, last: idx, moved: false, x0: e.clientX, t0: t, x1: e.clientX, t1: t };
    setScrubbing(true);
    const move = (ev) => {
      const d = drag.current;
      if (!d.on) return;
      const tt = ev.timeStamp;
      // keep a short window for velocity, so only the END of the gesture counts
      if (tt - d.t1 > 60) { d.x0 = d.x1; d.t0 = d.t1; }
      d.x1 = ev.clientX; d.t1 = tt;
      if (!d.moved && Math.abs(ev.clientX - d.x0) < 4) return;
      d.moved = true;
      if (ev.cancelable) ev.preventDefault();
      scrub(ev.clientX);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      finish();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div style={{ margin: big ? '0 0 6px' : '-4px 0 6px' }}>
      {/* data-nopan: the rail owns this drag (OWNS_X, swipe-back.js). The
          scrub runs on pointer events, but the same touches also reach the
          tab root's swipe-back listener — without the mark, releasing a
          rightward scrub read as the back gesture and landed on the daily
          instead of the stop under the finger. */}
      <div ref={railRef} data-nopan="" style={{ position: 'relative', display: 'flex', height: H, touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: scrubbing ? 'grabbing' : 'default' }} role="tablist" aria-label="How far the mirror reaches"
        onPointerDown={onDown}>
        {/* the axis itself — one hairline the ticks stand on */}
        <div style={{ position: 'absolute', left: 6, right: 6, bottom: big ? 20 : 15, height: 1, background: 'color-mix(in oklch, var(--rule), transparent 30%)' }}></div>
        {stops.map((p, i) => {
          const on = i === idx;
          // ticks lengthen as the telescope extends, so the axis reads as a
          // scale rather than as a row of equal buttons
          const tick = (big ? 5.5 : 4.5) + (i / (n - 1)) * (big ? 8 : 5);
          return (
            <button key={p.id} role="tab" aria-selected={on} aria-label={p.label} onClick={() => { if (drag.current.moved) { drag.current.moved = false; return; } onPick(p); }} style={{
              flex: 1, minWidth: 0, position: 'relative', height: H, border: 'none', background: 'none',
              cursor: 'pointer', WebkitAppearance: 'none', padding: 0,
            }}>
              <span style={{
                position: 'absolute', left: '50%', bottom: big ? 20 : 15, transform: 'translateX(-50%)',
                width: on ? (big ? 3.5 : 3) : 1.5, height: on ? (big ? 18 : 12) : tick, borderRadius: 99,
                background: on ? accent : 'color-mix(in oklch, var(--ink-3), transparent 45%)',
                transition: scrubbing ? 'height .12s linear, background .12s, width .12s' : 'height .28s cubic-bezier(0.2,0.8,0.2,1), background .3s, width .2s',
              }}></span>
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', whiteSpace: 'nowrap',
                fontFamily: 'var(--sans)', fontSize: on ? (big ? 14 : 12) : (big ? 11.5 : 10.5), fontWeight: on ? 800 : 600,
                letterSpacing: '-0.02em', color: on ? 'var(--ink)' : 'var(--ink-3)',
                transition: 'color .2s, font-size .2s',
              }}>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// WorldZoomControl is gone: the three zoom stops are stops on the axis
// above now, so a separate pill row would be the same choice offered
// twice. WORLD_ZOOMS survives because it still validates the persisted
// `worldZoom` tweak.

// ─── the Mirror tab ───
function MirrorPreviewTag({ popId }) {
  const L = window.LIVE;
  // Shown in live mode (populations are still demo data) AND when a
  // live build is stuck on the mock fallback (D1: never let sample
  // people pass as real, even offline).
  const demoInProd = !!(L && L.demoInProd);
  if (!(L && (L.enabled || demoInProd)) || popId === 'you') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 6px' }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', border: '1px solid var(--rule)', borderRadius: 999, padding: '3px 10px' }}>
        {demoInProd ? 'Preview · sample people — reconnecting…' : 'Preview · sample people until there’s live data here'}
      </span>
    </div>
  );
}

function MirrorTab({ onPerson, pop, onPop, worldZoom, onZoom, firstRun, topNav, backKey }) {
  const p = mirrorPop(pop);
  const zoom = WORLD_ZOOMS.some(z => z.id === worldZoom) ? worldZoom : 'world';
  const scaleId = p.id === 'world' ? zoom : p.id;
  // The axis carries the world zooms as stops of its own, so a pick has to
  // set both halves of the old two-level state. (The live City stop is
  // back since D111, so a persisted zoom === 'city' needs no resolving.)
  const liveGeo = !!(window.LIVE && window.LIVE.enabled);
  const stopId = p.id === 'world' ? zoom : p.id;
  const pick = (s) => { if (s.pop === 'world') { onPop('world'); onZoom(s.zoom); } else onPop(s.pop); };
  // one horizontal axis across the whole app: a right-swipe here falls back onto
  // whatever sits immediately before Mirror on the current nav
  const backRef = React.useRef(null);
  // The ref is written in the effect, not in render (react-hooks/refs). It has
  // to be a ref at all because bindSwipeBack binds once per element — a plain
  // closure would freeze the first backKey it ever saw.
  const backTo = React.useRef(backKey);
  React.useEffect(() => {
    backTo.current = backKey || 'track:world';
    if (backRef.current) bindSwipeBack(backRef.current, () => window.goNav && window.goNav(backTo.current));
  });

  // The ruler is ONE element across every stop — never inside a branch that can
  // unmount, or a drag that crosses into another body loses its pointer mid-scrub.
  // Every branch below therefore picks a BODY rather than returning its own
  // frame; the live-mode branches are this repo's, not the prototype's.
  const isYou = p.id === 'you';
  // The geographic stops, live (D111): Near is the presence count and
  // nothing else (NearLiveBody — the cell it reads is one of D98's three
  // surviving denies, so a count is all it will ever draw), and City /
  // Country / World are the public aggregates plus the similarity
  // constellation (LiveCohortBody + LiveSimilarityField, D112). The demo
  // fields below are prototype data — Near's six named neighbours never
  // had a backend (D2) — so live gets the real thing or an honest empty
  // state, never both.
  const isGeoLive = p.kind === 'geo' && liveGeo;
  // circle — your close ties. The 49 named people in relmap-core.js are
  // prototype data, so live mode never shows them; what it shows instead
  // changed at D101. It used to be an empty state saying one-to-one
  // connections were not built, which was true while a friend graph
  // needed a request/accept handshake. D98 removed the need for one: with
  // every answer already readable, a follow grants no access, so it is a
  // bookmark and LiveCircleBody draws the people you kept.
  const isCircleLive = p.id === 'circle' && liveGeo;
  // named groups, live — the portrait computed from real reveal history
  // (LiveGroupsMirrorBody). No Preview tag: nothing on it is sample data,
  // which is the point of the replacement.
  const isGroupsLive = p.id === 'groups' && liveGeo;
  const isGroups = p.id === 'groups' && !isGroupsLive && typeof window.GroupsMirrorBody === 'function';

  let body;
  if (isYou) {
    // fully retracted — you, alone, visualized: the Map lives here
    body = (
      <div className="tab-swap" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <MapTab />
      </div>
    );
  } else if (isGeoLive) {
    // Near draws presence; the three world zooms map one-to-one onto the
    // cohort scopes (D111).
    body = p.id === 'near' ? (
      <div key="near-live" className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
        <NearLiveBody />
      </div>
    ) : (
      <div key={'geo-live:' + zoom} className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
        {/* null fallback, not a spinner — same reasoning as Circle's: the
            body's own first frame is its heading and tab row, and a
            spinner in front of that is one loading state too many. */}
        <React.Suspense fallback={null}>
          <LiveCohortBody scope={zoom} />
        </React.Suspense>
      </div>
    );
  } else if (isCircleLive) {
    body = (
      <div key="circle-live" className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
        {/* null fallback, not a spinner: LiveCircleBody's own first frame
            is "Loading your circle…" while it reads the graph, and two
            loading states in sequence read as a stutter. */}
        <React.Suspense fallback={null}>
          <LiveCircleBody />
        </React.Suspense>
      </div>
    );
  } else if (isGroupsLive) {
    body = (
      <div key="groups-live" className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
        {/* null fallback, not a spinner — same reasoning as Circle's and
            Cohort's: the body's own first frame is its header and tab row,
            and a spinner in front of that is one loading state too many. */}
        <React.Suspense fallback={null}>
          <LiveGroupsMirrorBody />
        </React.Suspense>
      </div>
    );
  } else if (isGroups) {
    // named groups — their own body: member field + accrued group portrait
    body = (
      <div key="groups-mirror" className="tab-swap mf-flex">
        <window.GroupsMirrorBody onPerson={onPerson} topLenses={topNav} />
      </div>
    );
  } else {
    body = (
      <div key={scaleId + '-field'} className="tab-swap mf-flex">
        <MirrorFieldBody pop={p.id} worldZoom={zoom} onPerson={onPerson}
          zoomCtl={null} firstRun={firstRun} topLenses={topNav} />
      </div>
    );
  }
  // the live bodies draw real, k-floored data — only the demo fields wear the tag
  const tag = isGeoLive || isCircleLive || isGroupsLive ? null : <MirrorPreviewTag popId={p.id} />;
  // One lookup, not a ladder: the five branches above each named their own
  // accent when each returned its own frame, and MIRROR_POPS already holds
  // exactly those five values. Spelling them out again is a second copy that
  // can disagree with the first.
  const accentVar = mirrorAccent(p.id);

  return (
    <div ref={backRef} className={'fade-in' + (isYou ? '' : ' mf-flex')}
      style={isYou ? { '--accent': accentVar, height: '100%', display: 'flex', flexDirection: 'column' } : { '--accent': accentVar }}>
      <div style={isYou ? { flexShrink: 0, padding: '10px 14px 0' } : { flexShrink: 0 }}>
        <MirrorPopPicker stopId={stopId} onPick={pick} big={topNav} />
      </div>
      {tag}
      {body}
    </div>
  );
}

Object.assign(window, { MirrorTab });

;globalThis.MirrorTab = typeof MirrorTab === 'undefined' ? globalThis.MirrorTab : MirrorTab;
;globalThis.mirrorPop = typeof mirrorPop === 'undefined' ? globalThis.mirrorPop : mirrorPop;
