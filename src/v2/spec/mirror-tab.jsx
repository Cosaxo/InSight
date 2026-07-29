// Ported from design/spec-modules/mirror-tab.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// mirror-tab.jsx — MIRROR: one tab, one verb — see yourself against a population.
// Five stops, one telescope — from fully retracted to fully extended:
//   you    → the telescope retracted — you, alone, visualized (the Map)
//   circle → your people — close ties (PeopleTab)
//   groups → your named circles — The Crew, Book Club… (GroupsMirrorBody)
//   near   → the 5 km around you (AreaBody)
//   world  → everyone — telescopes City → Country → World via the zoom control

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

// ─── the population selector — who the mirror reflects ───
function MirrorPopPicker({ popId, onPick }) {
  const idx = MIRROR_POPS.findIndex(p => p.id === popId);
  const accent = mirrorAccent(popId);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 20%)' }}>
        {MIRROR_POPS.map((p) => {
          const on = p.id === popId;
          return (
            <button key={p.id} onClick={() => onPick(p.id)} style={{
              flex: 1, minWidth: 0, padding: '9px 2px', border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none',
              fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 600, letterSpacing: '-0.01em',
              color: on ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap', transition: 'color .18s',
            }}>{p.label}</button>
          );
        })}
      </div>
      {/* sliding accent underline — the one selection signal */}
      <div style={{ position: 'relative', height: 3, marginTop: -1.5 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${100 / MIRROR_POPS.length}%`, transform: `translateX(${Math.max(0, idx) * 100}%)`, transition: 'transform 0.34s cubic-bezier(0.2,0.8,0.2,1)', display: 'flex', justifyContent: 'center' }}>
          <span style={{ width: 32, height: 3, borderRadius: 999, background: accent, transition: 'background 0.3s ease' }}></span>
        </div>
      </div>
    </div>
  );
}

// ─── World's zoom control — three telescoping stops, living inside the hero card ───
// `live` drops the City stop: after D9 the Near population IS your city, so
// keeping it here would be the same panel behind two different chips.
function WorldZoomControl({ zoom, onZoom, live }) {
  const stops = live ? WORLD_ZOOMS.filter((z) => z.id !== 'city') : WORLD_ZOOMS;
  return (
    <div style={{ display: 'inline-flex', gap: 6, margin: live ? '2px 0 8px' : 0 }}>
      {stops.map((z) => {
        const on = z.id === zoom;
        return (
          <button key={z.id} className="press" onClick={() => onZoom(z.id)} style={{
            border: '0.5px solid ' + (on ? 'color-mix(in oklch, var(--rule), var(--ink) 30%)' : 'var(--rule)'), borderRadius: 999, padding: '4px 11px', cursor: 'pointer', WebkitAppearance: 'none',
            fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: on ? 750 : 600, letterSpacing: '-0.01em',
            background: on ? 'var(--surface-2)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
            transition: 'background 0.16s ease, color 0.16s ease, border-color 0.16s ease',
          }}>{z.label}</button>
        );
      })}
    </div>
  );
}

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

  // fully retracted — you, alone, visualized: the Map lives here
  if (p.id === 'you') {
    return (
      <div className="fade-in" style={{ '--accent': 'var(--c-today)', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, padding: '10px 14px 0' }}>
          <MirrorPopPicker popId={p.id} onPick={onPop} />
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
        <MirrorPopPicker popId={p.id} onPick={onPop} />
        {p.id === 'world' && <WorldZoomControl zoom={liveZoom} onZoom={onZoom} live />}
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
        <MirrorPopPicker popId={p.id} onPick={onPop} />
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

  // named groups — their own body: member field + accrued group portrait
  if (p.id === 'groups' && typeof window.GroupsMirrorBody === 'function') {
    return (
      <div className="fade-in mf-flex" style={{ '--accent': 'var(--c-groups)' }}>
        <MirrorPopPicker popId={p.id} onPick={onPop} />
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
        <MirrorPopPicker popId={p.id} onPick={onPop} />
        <MirrorPreviewTag popId={p.id} />
        <div key={scaleId + '-field'} className="tab-swap mf-flex">
          <MirrorFieldBody pop={p.id} worldZoom={zoom} onPerson={onPerson}
            zoomCtl={p.id === 'world' ? <WorldZoomControl zoom={zoom} onZoom={onZoom} /> : null}
            levelTrait="gender" levelMarker={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ '--accent': mirrorAccent(p.id) }}>

      <MirrorPopPicker popId={p.id} onPick={onPop} />
      <MirrorPreviewTag popId={p.id} />

      <div key={scaleId} className="tab-swap">
        {p.kind === 'geo' && <AreaBody scaleId={scaleId} onPerson={onPerson} zoomCtl={p.id === 'world' ? <WorldZoomControl zoom={zoom} onZoom={onZoom} /> : null} />}
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
;globalThis.WorldZoomControl = typeof WorldZoomControl === 'undefined' ? globalThis.WorldZoomControl : WorldZoomControl;
;globalThis.MirrorTab = typeof MirrorTab === 'undefined' ? globalThis.MirrorTab : MirrorTab;
;globalThis.MIRROR_POPS = typeof MIRROR_POPS === 'undefined' ? globalThis.MIRROR_POPS : MIRROR_POPS;
;globalThis.mirrorPop = typeof mirrorPop === 'undefined' ? globalThis.mirrorPop : mirrorPop;
;globalThis.mirrorAccent = typeof mirrorAccent === 'undefined' ? globalThis.mirrorAccent : mirrorAccent;
;globalThis.WORLD_ZOOMS = typeof WORLD_ZOOMS === 'undefined' ? globalThis.WORLD_ZOOMS : WORLD_ZOOMS;
;globalThis.MIRROR_AUD = typeof MIRROR_AUD === 'undefined' ? globalThis.MIRROR_AUD : MIRROR_AUD;
;globalThis.WORLD_AUD = typeof WORLD_AUD === 'undefined' ? globalThis.WORLD_AUD : WORLD_AUD;
