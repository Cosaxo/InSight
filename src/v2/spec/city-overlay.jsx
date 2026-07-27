/* eslint-disable */
// ported from design/spec-modules/city-overlay.jsx — do not hand-edit load order assumptions
import React from 'react';

// CityOverlay — opens when you tap a city in the World tab atlas
const { useState: useStateCO } = React;

function CityOverlay({ city, onClose }) {
  const D = window.IS_DATA;
  const cats = D.cityScoreCats;
  const scores = city.scores || {};

  // your home city ratings (Oslo) for comparison
  const home = D.city;
  const homeMap = {
    commute: 80, safety: 92, beauty: 78, food: 60,
    nature: 96, nightlife: 50, climate: 38, cost: 38,
  };
  const homeVals = cats.map(c => homeMap[c.id] || 50);
  const cityVals = cats.map(c => scores[c.id] || 0);

  // top 3 dimensions
  const ranked = cats
    .map(c => ({ ...c, v: scores[c.id] || 0 }))
    .sort((a, b) => b.v - a.v);
  const tops = ranked.slice(0, 3);
  const bots = ranked.slice(-2);

  return (
    <div className="overlay surface-tint">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>←</button>
        <div className="h-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city.name}</div>
        <div className="h-meta" style={{ flexShrink: 0 }}>{city.region.toLowerCase()}</div>
      </div>
      <div className="app-body">

        {/* Header — passport stamp aesthetic */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, marginBottom: 14 }}>
          <div style={{
            width: 64, height: 80,
            background: `oklch(0.92 0.04 ${city.hue})`,
            border: '0.5px solid var(--rule)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, position: 'relative',
          }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 26, color: `oklch(0.30 0.13 ${city.hue})` }}>{city.country}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', marginTop: 4, color: 'var(--ink-3)' }}>{city.country}-VISA</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'var(--voice-italic)', margin: '0 0 4px', letterSpacing: '-0.01em', lineHeight: 1.05 }}>{city.name}</h2>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              POP {city.pop}
            </div>
            {city.blurb && (
              <div className="margin-note" style={{ marginTop: 6, fontSize: 15 }}>
                "{city.blurb}"
              </div>
            )}
          </div>
          <Donut value={city.match} color={`oklch(0.55 0.12 ${city.hue})`} label="MATCH" size={64} />
        </div>

        {/* Eight-axis radar — vs Oslo */}
        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>Eight axes · {city.name} vs. home</Kicker>
          <div style={{ marginTop: 8 }}>
            <RadarChart
              values={cityVals}
              compareValues={homeVals}
              compareColor="var(--ink-3)"
              labels={cats.map(c => c.label)}
              color={`oklch(0.55 0.12 ${city.hue})`}
              size={280}
            />
          </div>
          <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', marginTop: 4 }}>
            <span><span style={{ display:'inline-block', width:10, height:2, background:`oklch(0.55 0.12 ${city.hue})`, verticalAlign:'middle', marginRight:5 }} />{city.name.toUpperCase()}</span>
            <span><span style={{ display:'inline-block', width:10, height:2, background:'var(--ink-3)', verticalAlign:'middle', marginRight:5 }} />OSLO (HOME)</span>
          </div>
        </div>

        {/* Detailed breakdown */}
        <div className="card" style={{ marginBottom: 14 }}>
          <Kicker>The full report</Kicker>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ranked.map(r => {
              const accent = `oklch(0.55 0.12 ${city.hue})`;
              return (
                <div key={r.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: accent, width: 16 }}>{GL(r.glyph)}</span>
                      <span style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 14 }}>{r.label}</span>
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)' }}>{r.v}</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: 'var(--surface-2)', border: '0.5px solid var(--rule)', borderRadius: 3 }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${r.v}%`, background: accent, opacity: 0.65 }} />
                    {/* home tick */}
                    {homeMap[r.id] != null && (
                      <span title={`Oslo: ${homeMap[r.id]}`} style={{ position: 'absolute', left: `calc(${homeMap[r.id]}% - 1px)`, top: -2, bottom: -2, width: 2, background: 'var(--ink)', opacity: 0.55 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="margin-note" style={{ marginTop: 10, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display:'inline-block', width:2, height:8, background:'var(--ink)', opacity:0.55 }} />
            <span>marker = Oslo's score</span>
          </div>
        </div>

        {/* Verdict */}
        <div className="card" style={{ marginBottom: 14, background: `oklch(0.97 0.02 ${city.hue})`, borderColor: `oklch(0.85 0.06 ${city.hue})` }}>
          <Kicker>Where {city.name} would treat you well</Kicker>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {tops.map(r => (
              <span key={r.id} style={{
                fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.1em',
                padding: '5px 10px',
                background: 'var(--surface)', border: `0.5px solid oklch(0.55 0.12 ${city.hue})`,
                color: `oklch(0.32 0.13 ${city.hue})`, borderRadius: 999,
              }}>{GL(r.glyph)} {r.label.toUpperCase()} · {r.v}</span>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: 14, marginBottom: 6 }}>WHERE IT WOULDN'T</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {bots.map(r => (
              <span key={r.id} style={{
                fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.1em',
                padding: '5px 10px',
                background: 'var(--surface-2)', border: '0.5px solid var(--rule)',
                color: 'var(--ink-3)', borderRadius: 999,
              }}>{GL(r.glyph)} {r.label.toUpperCase()} · {r.v}</span>
            ))}
          </div>
        </div>

        {/* Add to wishlist CTA */}
        <button style={{
          width: '100%', marginTop: 4, padding: '14px',
          background: 'transparent', border: '1px solid var(--rule)', borderRadius: 12,
          fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 15, color: 'var(--ink-3)',
          cursor: 'pointer'
        }}>+ add {city.name} to the wishlist</button>
      </div>
    </div>
  );
}

Object.assign(window, { CityOverlay });

;globalThis.CityOverlay = typeof CityOverlay === 'undefined' ? globalThis.CityOverlay : CityOverlay;
