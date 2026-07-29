// Ported from design/spec-modules/mirror-tab.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// mirror-tab.jsx — MIRROR: one tab, one verb — see yourself against a population.
// One telescope, seven stops, from fully retracted to fully extended:
//   you     → the telescope retracted — you, alone, visualized (the Map)
//   circle  → your people — close ties (PeopleTab)
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

// ─── glyph for each population — a solid core for your circle; geo circles telescope ───
function MirrorPopGlyph({ pop, i, on }) {
  const c = on ? 'var(--surface)' : 'color-mix(in oklch, var(--ink-3), transparent 35%)';
  if (pop.id === 'you') {
    // the telescope fully retracted — a single solid point: you
    return <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }}></span>;
  }
  if (pop.id === 'circle') {
    // your closest ties — a small solid core inside a ring
    return (
      <svg viewBox="0 0 14 14" width="13" height="13">
        <circle cx="7" cy="7" r="5.4" fill="none" stroke={c} strokeWidth="1.2"></circle>
        <circle cx="7" cy="7" r="2.3" fill={c}></circle>
      </svg>
    );
  }
  if (pop.id === 'groups') {
    // named circles — two rings overlapping: a group is people who share a middle
    return (
      <svg viewBox="0 0 14 14" width="13" height="13">
        <circle cx="5.2" cy="7" r="3.9" fill="none" stroke={c} strokeWidth="1.2"></circle>
        <circle cx="8.8" cy="7" r="3.9" fill="none" stroke={c} strokeWidth="1.2"></circle>
        <circle cx="7" cy="7" r="1.5" fill={c}></circle>
      </svg>
    );
  }
  const geoSize = pop.id === 'near' ? 9 : 13;
  return <span style={{ width: geoSize, height: geoSize, borderRadius: '50%', border: `1.2px solid ${c}`, background: on ? 'rgba(255,255,255,0.28)' : 'transparent' }}></span>;
}

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

function MirrorPopPicker({ stopId, onPick, live }) {
  const stops = mirrorStops(live);
  const n = stops.length;
  const idx = Math.max(0, stops.findIndex(p => p.id === stopId));
  const accent = stopAccent(stopId);
  return (
    <div style={{ margin: '2px 0 10px' }}>
      <div style={{ position: 'relative', display: 'flex', height: 44 }} role="tablist" aria-label="How far the mirror reaches">
        {/* the axis itself — one hairline the ticks stand on */}
        <div style={{ position: 'absolute', left: 6, right: 6, bottom: 16, height: 1, background: 'color-mix(in oklch, var(--rule), transparent 30%)' }}></div>
        {stops.map((p, i) => {
          const on = i === idx;
          // ticks lengthen as the telescope extends, so the axis reads as a
          // scale rather than as a row of equal buttons
          const tick = 4.5 + (i / (n - 1)) * 6.5;
          return (
            <button key={p.id} role="tab" aria-selected={on} aria-label={p.label} onClick={() => onPick(p)} style={{
              flex: 1, minWidth: 0, position: 'relative', height: 44, border: 'none', background: 'none',
              cursor: 'pointer', WebkitAppearance: 'none', padding: 0,
            }}>
              <span style={{
                position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
                width: on ? 3 : 1.5, height: on ? 14 : tick, borderRadius: 99,
                background: on ? accent : 'color-mix(in oklch, var(--ink-3), transparent 45%)',
                transition: 'height .28s cubic-bezier(0.2,0.8,0.2,1), background .3s, width .2s',
              }}></span>
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', whiteSpace: 'nowrap',
                fontFamily: 'var(--sans)', fontSize: on ? 12 : 10.5, fontWeight: on ? 800 : 600,
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
// `worldZoom` tweak and maps it to an audience (WORLD_AUD).

// ─── which Daily-Question audience each population reflects ───
const MIRROR_AUD = { circle: 'people', groups: 'groups', near: 'around' };
const WORLD_AUD = { city: 'city', country: 'country', world: 'world' };

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

function MirrorTab({ onPerson, pop, onPop, worldZoom, onZoom }) {
  const p = mirrorPop(pop);
  const zoom = WORLD_ZOOMS.some(z => z.id === worldZoom) ? worldZoom : 'world';
  const scaleId = p.id === 'world' ? zoom : p.id;
  const audId = p.id === 'world' ? WORLD_AUD[zoom] : MIRROR_AUD[p.id];
  const field = typeof window.MirrorFieldBody === 'function';
  // The axis carries the world zooms as stops of its own, so a pick has to
  // set both halves of the old two-level state — and `live` hides the City
  // stop, which means a session that persisted zoom === 'city' would leave
  // the axis with nothing selected. Resolve that to Country here, once.
  const liveGeo = !!(window.LIVE && window.LIVE.enabled);
  const shownZoom = liveGeo && zoom === 'city' ? 'country' : zoom;
  const stopId = p.id === 'world' ? shownZoom : p.id;
  const pick = (s) => { if (s.pop === 'world') { onPop('world'); onZoom(s.zoom); } else onPop(s.pop); };

  // fully retracted — you, alone, visualized: the Map lives here
  if (p.id === 'you') {
    return (
      <div className="fade-in" style={{ '--accent': 'var(--c-today)', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, padding: '10px 14px 0' }}>
          <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} />
        </div>
        <div className="tab-swap" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <MapTab />
        </div>
      </div>
    );
  }

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
  if (p.kind === 'geo' && window.LIVE && window.LIVE.enabled && typeof window.LiveCohortBody === 'function') {
    // A session that last used the City stop still has zoom === 'city'
    // persisted. Resolve it to Country for both the panel and the control,
    // so the control does not render with nothing selected.
    const liveZoom = zoom === 'world' ? 'world' : 'country';
    const scope = p.id === 'near' ? 'city' : liveZoom;
    return (
      <div className="fade-in mf-flex" style={{ '--accent': mirrorAccent(p.id) }}>
        <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} />
        <div key={'geo-live:' + scope} className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
          <window.LiveCohortBody scope={scope} />
        </div>
      </div>
    );
  }

  // circle — your close ties. v2 has no person-to-person graph at all:
  // groups are the only real connection it can make, joined by an invite
  // code (D3). The 49 named people below come from relmap-core.js and are
  // prototype data, so live mode says what is missing rather than showing
  // them behind a "sample" badge.
  if (p.id === 'circle' && window.LIVE && window.LIVE.enabled) {
    return (
      <div className="fade-in mf-flex" style={{ '--accent': 'var(--c-people)' }}>
        <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} />
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
      </div>
    );
  }

  // named groups, live — the portrait computed from real reveal history
  // (LiveGroupsMirrorBody). No Preview tag: nothing on it is sample data,
  // which is the point of the replacement.
  if (p.id === 'groups' && window.LIVE && window.LIVE.enabled && typeof window.LiveGroupsMirrorBody === 'function') {
    return (
      <div className="fade-in mf-flex" style={{ '--accent': 'var(--c-groups)' }}>
        <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} />
        <div key="groups-live" className="tab-swap mf-flex" style={{ overflowY: 'auto' }}>
          <window.LiveGroupsMirrorBody />
        </div>
      </div>
    );
  }

  // named groups — their own body: member field + accrued group portrait
  if (p.id === 'groups' && typeof window.GroupsMirrorBody === 'function') {
    return (
      <div className="fade-in mf-flex" style={{ '--accent': 'var(--c-groups)' }}>
        <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} />
        <MirrorPreviewTag popId={p.id} />
        <div key="groups-mirror" className="tab-swap mf-flex">
          <window.GroupsMirrorBody onPerson={onPerson} />
        </div>
      </div>
    );
  }

  if (field) {
    return (
      <div className="fade-in mf-flex" style={{ '--accent': mirrorAccent(p.id) }}>
        <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} />
        <MirrorPreviewTag popId={p.id} />
        <div key={scaleId + '-field'} className="tab-swap mf-flex">
          <MirrorFieldBody pop={p.id} worldZoom={zoom} onPerson={onPerson}
            zoomCtl={null}
            levelTrait="gender" levelMarker={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ '--accent': mirrorAccent(p.id) }}>

      <MirrorPopPicker stopId={stopId} onPick={pick} live={liveGeo} />
      <MirrorPreviewTag popId={p.id} />

      <div key={scaleId} className="tab-swap">
        {p.kind === 'geo' && <AreaBody scaleId={scaleId} onPerson={onPerson} zoomCtl={null} />}
        {p.id === 'circle' && <PeopleTab embedded onPerson={onPerson} />}
        {p.id === 'groups' && <GroupsBody />}
        {typeof window.MirrorAnswers === 'function' && (
          <Lazy minHeight={600}>
            <MirrorAnswers audId={audId} />
          </Lazy>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { MirrorTab });

;globalThis.MirrorPopGlyph = typeof MirrorPopGlyph === 'undefined' ? globalThis.MirrorPopGlyph : MirrorPopGlyph;
;globalThis.MirrorPopPicker = typeof MirrorPopPicker === 'undefined' ? globalThis.MirrorPopPicker : MirrorPopPicker;
;globalThis.MirrorTab = typeof MirrorTab === 'undefined' ? globalThis.MirrorTab : MirrorTab;
;globalThis.MIRROR_POPS = typeof MIRROR_POPS === 'undefined' ? globalThis.MIRROR_POPS : MIRROR_POPS;
;globalThis.mirrorPop = typeof mirrorPop === 'undefined' ? globalThis.mirrorPop : mirrorPop;
;globalThis.mirrorAccent = typeof mirrorAccent === 'undefined' ? globalThis.mirrorAccent : mirrorAccent;
;globalThis.WORLD_ZOOMS = typeof WORLD_ZOOMS === 'undefined' ? globalThis.WORLD_ZOOMS : WORLD_ZOOMS;
;globalThis.MIRROR_AUD = typeof MIRROR_AUD === 'undefined' ? globalThis.MIRROR_AUD : MIRROR_AUD;
;globalThis.WORLD_AUD = typeof WORLD_AUD === 'undefined' ? globalThis.WORLD_AUD : WORLD_AUD;
