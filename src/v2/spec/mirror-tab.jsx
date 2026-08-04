// Ported from design/spec-modules/mirror-tab.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { HAPTIC } from './haptics.js';
import { bindSwipeBack } from './swipe-back.js';

// mirror-tab.jsx — MIRROR: one tab, one verb — see yourself against a population.
// One telescope, seven stops, from fully retracted to fully extended:
//   you     → the telescope retracted — you, alone, visualized (the Map)
//   circle  → your people — close ties
//   groups  → your named circles — The Crew, Book Club… (GroupsMirrorBody)
//   near    → your city (D9; the demo field still shows the 5 km neighbours)
//   city    → demo only — live mode drops it, because Near IS your city
//   country → everyone in your country
//   world   → everyone
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
// D9 again, now on the axis: live mode drops City, because Near IS your
// city there. Two stops onto one cohort is how a scale starts lying about
// what it measures.
const mirrorStops = (live) => (live ? MIRROR_STOPS.filter((s) => s.id !== 'city') : MIRROR_STOPS);

// ─── the one selector — one graduated axis from You to World, every stop named ───
// Tap a stop, or DRAG along the ruler to scrub through the populations: the
// mirror follows your finger stop by stop, with a tick as each one passes. The
// axis is a slider, so it should feel like one; vertical pans still scroll.
function MirrorPopPicker({ stopId, onPick, live, big }) {
  const stops = mirrorStops(live);
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
      <div ref={railRef} style={{ position: 'relative', display: 'flex', height: H, touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: scrubbing ? 'grabbing' : 'default' }} role="tablist" aria-label="How far the mirror reaches"
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
  // set both halves of the old two-level state — and `live` hides the City
  // stop, which means a session that persisted zoom === 'city' would leave
  // the axis with nothing selected. Resolve that to Country here, once.
  const liveGeo = !!(window.LIVE && window.LIVE.enabled);
  const shownZoom = liveGeo && zoom === 'city' ? 'country' : zoom;
  const stopId = p.id === 'world' ? shownZoom : p.id;
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
  // near and world — in live mode these are the same question at three
  // radii, from the k-floored public aggregates, rendered as counts rather
  // than people (D9). The demo fields below are prototype data: Near's six
  // named neighbours never had a backend, and the v1 geohash one they were
  // waiting for never produced a cell. Live gets the real thing or an
  // honest empty state, never both.
  //
  // World's "City" zoom stop is gone rather than duplicated: Near IS your
  // city now, and two identical panels behind different chips is how a UI
  // starts disagreeing with itself.
  const isGeoLive = p.kind === 'geo' && liveGeo && typeof window.LiveCohortBody === 'function';
  // circle — your close ties. v2 has no person-to-person graph at all:
  // groups are the only real connection it can make, joined by an invite
  // code (D3). The 49 named people below come from relmap-core.js and are
  // prototype data, so live mode says what is missing rather than showing
  // them behind a "sample" badge.
  const isCircleLive = p.id === 'circle' && liveGeo;
  // named groups, live — the portrait computed from real reveal history
  // (LiveGroupsMirrorBody). No Preview tag: nothing on it is sample data,
  // which is the point of the replacement.
  const isGroupsLive = p.id === 'groups' && liveGeo && typeof window.LiveGroupsMirrorBody === 'function';
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
    // A session that last used the City stop still has zoom === 'city'
    // persisted. Resolve it to Country for both the panel and the control,
    // so the control does not render with nothing selected.
    const liveZoom = zoom === 'world' ? 'world' : 'country';
    const scope = p.id === 'near' ? 'city' : liveZoom;
    body = (
      <div key={'geo-live:' + scope} className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
        <window.LiveCohortBody scope={scope} />
      </div>
    );
  } else if (isCircleLive) {
    body = (
      <div key="circle-live" className="tab-swap mf-flex">
        <div style={{ padding: '30px 22px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink)', marginBottom: 7 }}>Your circle is empty</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.55, maxWidth: 330, margin: '0 auto', textWrap: 'pretty' }}>
            One-to-one connections aren&apos;t built yet. Groups are how you
            see named answers today — start one, or join with a code, and
            the day after each round you&apos;ll see who picked what.
          </div>
        </div>
      </div>
    );
  } else if (isGroupsLive) {
    body = (
      <div key="groups-live" className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
        <window.LiveGroupsMirrorBody />
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
        <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} big={topNav} />
      </div>
      {tag}
      {body}
    </div>
  );
}

Object.assign(window, { MirrorTab });

;globalThis.MirrorPopPicker = typeof MirrorPopPicker === 'undefined' ? globalThis.MirrorPopPicker : MirrorPopPicker;
;globalThis.MirrorTab = typeof MirrorTab === 'undefined' ? globalThis.MirrorTab : MirrorTab;
;globalThis.MIRROR_POPS = typeof MIRROR_POPS === 'undefined' ? globalThis.MIRROR_POPS : MIRROR_POPS;
;globalThis.mirrorPop = typeof mirrorPop === 'undefined' ? globalThis.mirrorPop : mirrorPop;
;globalThis.mirrorAccent = typeof mirrorAccent === 'undefined' ? globalThis.mirrorAccent : mirrorAccent;
;globalThis.WORLD_ZOOMS = typeof WORLD_ZOOMS === 'undefined' ? globalThis.WORLD_ZOOMS : WORLD_ZOOMS;
