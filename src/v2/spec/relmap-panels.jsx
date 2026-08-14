// Ported from design/spec-modules/relmap-panels.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
//
// Converted off the global bridge in D137 (D39, "convert on touch"). Its one
// consumer — relmap.jsx — read the two panels with `const { RMPersonPanel,
// RMHubPanel } = window`, a form neither the checker nor eslint could see: the
// destructuring registered both names as LOCALS, so the tags resolved locally,
// the window bag looked like it had two dead entries, and a rename here would
// have been caught by nothing. Real imports make the edge visible to both.
// `window.openPerson` below is still a global read — that owner has not moved.
import React from 'react';
import { RMCore } from './relmap-core.js';

// RelationshipMap — the selected-person and selected-circle detail panels.
const { P } = RMCore;
const SANS = "'Hanken Grotesk', sans-serif";
const SERIF = SANS;
const upLabel = { fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: P.ink3 };
const card = { background: P.card, border: '1px solid ' + P.cardBorder, boxShadow: P.shadow };

export function RMPersonPanel({ s, onSelect, onClose }) {
      const cardBtn = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px 6px 9px', borderRadius: 100, border: '1px solid ' + P.rule, background: P.canvas, cursor: 'pointer', fontFamily: SANS, fontSize: 13, color: P.ink2 };
      return (
        <div className="rm-scroll" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 20, padding: '18px 20px', maxHeight: 'min(62%, 450px)', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', zIndex: 7, animation: 'rmSheetUp 0.34s cubic-bezier(0.16,1,0.3,1) both', ...card, boxShadow: P.panelShadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 9px', borderRadius: 100, background: s.tint, fontFamily: SANS, fontSize: 12, fontWeight: 600, color: s.color }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }}></span>{s.groupLabel}
            </span>
            <button className="press" onClick={() => onClose()} style={{ border: 'none', background: P.chipBg, width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: P.ink2, fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, flex: 'none', borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.initFill, fontFamily: SANS, fontSize: 18, fontWeight: 700 }}>{s.initials}</div>
            <div>
              <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 23, lineHeight: 1.05, margin: '0 0 3px', letterSpacing: '-0.01em', color: P.inkName }}>{s.name}</h2>
              <div style={{ fontFamily: SANS, fontSize: 14, color: P.body }}>{s.relationship}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, padding: '15px 0', borderTop: '1px solid ' + P.rule, borderBottom: '1px solid ' + P.rule, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...upLabel, marginBottom: 8 }}>Age</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: s.ageColor, flex: 'none' }}></span><span style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 700, color: P.ink }}>{s.age}</span></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...upLabel, marginBottom: 8 }}>Known for</div>
              <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 700, color: P.ink }}>{s.yearsLabel}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', padding: '0 0 16px', borderBottom: '1px solid ' + P.rule, marginBottom: 16 }}>
            {(s.standings || []).map((t) => (
              <div key={t.k}>
                <div style={{ ...upLabel, marginBottom: 8 }}>{t.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color, flex: 'none' }}></span><span style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: P.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.value}</span></div>
              </div>
            ))}
          </div>
          {s.lensDetail && (
            <div style={{ padding: '0 0 14px', borderBottom: '1px solid ' + P.rule, marginBottom: 16 }}>
              <div style={{ ...upLabel, marginBottom: 10 }}>{s.lensDetail.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.lensDetail.personType.color, flex: 'none' }}></span>
                <span style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 700, color: P.ink }}>{s.lensDetail.personType.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s.lensDetail.rows.map(r => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '86px 1fr', alignItems: 'center', gap: 10, opacity: !s.lensDetail.activeAxis || s.lensDetail.activeAxis === r.id ? 1 : 0.4, transition: 'opacity 0.2s ease' }}>
                    <span style={{ fontFamily: SANS, fontSize: 12, color: s.lensDetail.activeAxis === r.id ? P.ink : P.ink3, fontWeight: s.lensDetail.activeAxis === r.id ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                    <span style={{ position: 'relative', height: 5, borderRadius: 99, background: P.chipBg2, display: 'block' }}>
                      <span style={{ position: 'absolute', top: '50%', left: r.you + '%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: P.card, border: '2px solid ' + P.ink3, boxSizing: 'border-box' }}></span>
                      <span style={{ position: 'absolute', top: '50%', left: r.v + '%', transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: r.color, border: '2px solid ' + P.card, boxSizing: 'border-box' }}></span>
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 11, fontWeight: 600, color: P.ink3 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: P.ink2 }}></span>{s.name.split(' ')[0]}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 11, fontWeight: 600, color: P.ink3 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: P.card, border: '2px solid ' + P.ink3, boxSizing: 'border-box' }}></span>you
                </span>
              </div>
            </div>
          )}
          <div style={{ ...upLabel, marginBottom: 11 }}>{s.mutualLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {s.mutuals.map(m => (
              <button key={m.id} className="press" onClick={(e) => { e.stopPropagation(); onSelect(m.id); }} style={cardBtn}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }}></span>{m.name}
              </button>
            ))}
          </div>
          {s.personRecord && window.openPerson && (
            <button className="press" onClick={(e) => { e.stopPropagation(); window.openPerson(s.personRecord); }}
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: s.color, color: P.initFill, fontFamily: SANS, fontSize: 14, fontWeight: 700 }}>
              See {s.name.split(' ')[0]}’s map&nbsp;<span style={{ fontSize: 15, lineHeight: 1 }}>↗</span></button>
          )}
        </div>
      );
    }

export function RMHubPanel({ h, onSelect, onDrill, onClose }) {
      const cardBtn = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px 6px 9px', borderRadius: 100, border: '1px solid ' + P.rule, background: P.canvas, cursor: 'pointer', fontFamily: SANS, fontSize: 13, color: P.ink2 };
      return (
        <div className="rm-scroll" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, maxHeight: 'min(62%, 450px)', overflowY: 'auto', overflowX: 'hidden', borderRadius: 20, padding: '18px 20px', display: 'flex', flexDirection: 'column', zIndex: 7, animation: 'rmSheetUp 0.34s cubic-bezier(0.16,1,0.3,1) both', ...card, boxShadow: P.panelShadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 9px', borderRadius: 100, background: h.tint, fontFamily: SANS, fontSize: 12, fontWeight: 600, color: h.color }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: h.color }}></span>Circle average
            </span>
            <button className="press" onClick={() => onClose()} style={{ border: 'none', background: P.chipBg, width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: P.ink2, fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, flex: 'none', borderRadius: '50%', background: h.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.initFill, fontFamily: SANS, fontSize: 18, fontWeight: 700 }}>{h.count}</div>
            <div>
              <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 23, lineHeight: 1.05, margin: '0 0 3px', letterSpacing: '-0.01em', color: P.inkName }}>{h.name}</h2>
              <div style={{ fontFamily: SANS, fontSize: 14, color: P.body }}>{h.countLabel}</div>
            </div>
          </div>
          <div style={{ ...upLabel, marginBottom: 13 }}>Average of this circle</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {h.averages.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: a.color, flex: 'none' }}></span>
                <span style={{ fontFamily: SANS, fontSize: 13, color: P.ink3, width: 92, flex: 'none' }}>{a.label}</span>
                <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: P.ink }}>{a.value}</span>
              </div>
            ))}
          </div>
          <div style={{ ...upLabel, marginBottom: 11 }}>Members</div>
          {h.drillable ? (
            /* too many to name — the disc is a promise you can go in, so the
               panel offers the way in instead of an arbitrary first twelve */
            <button className="press" onClick={(e) => { e.stopPropagation(); onDrill && onDrill(h.drillKey); }} style={{ ...cardBtn, padding: '9px 15px' }}>
              Open {h.name} {'\u00b7'} {h.count} people
            </button>
          ) : h.names ? (
            /* the leaf: no structure left to draw, so names become text and
               scale by scrolling — the one encoding that never runs out */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 168, overflowY: 'auto' }}>
              {h.names.map((nm, i) => (
                <span key={nm + i} style={{ ...cardBtn, cursor: 'default' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: h.color }}></span>{nm}
                </span>
              ))}
            </div>
          ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {h.members.map(m => (
              <button key={m.id} className="press" onClick={(e) => { e.stopPropagation(); onSelect(m.id); }} style={cardBtn}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }}></span>{m.name}
              </button>
            ))}
          </div>
          )}
        </div>
      );
    }

