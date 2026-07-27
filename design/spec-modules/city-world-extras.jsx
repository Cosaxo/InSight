// city-world-extras.jsx — six new cards giving the City and World tabs
// distinct, recurring reasons to be opened. Matches the journal vocabulary:
// Kicker / card / fig-num / margin-note / mono labels / serif italics / oklch.

const { useState: useStateCW, useMemo: useMemoCW } = React;

// ── People Profile · your social orbit (immersive hero) ──────────────────────
function PeopleProfileCard() {
  const D = window.IS_DATA;
  const people = D.people || [];
  const avgMatch = people.length ? Math.round(people.reduce((s, p) => s + p.match, 0) / people.length) : 0;
  const open = () => window.openOverlay && window.openOverlay('relmap');

  // The card is a live preview of the full relationship map. Tap anywhere to
  // open the immersive force-directed view.
  return (
    <div className="card pp-hero" onClick={open} style={{
      marginBottom: 16, padding: 0, overflow: 'hidden', cursor: 'pointer',
      borderColor: 'var(--rule)', color: 'var(--ink)', position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 16px 0' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.14em', color: 'var(--c-people)', textTransform: 'uppercase' }}>YOUR PEOPLE</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{people.length} TIES</span>
      </div>

      {/* live mini of the force-directed map */}
      <div style={{ height: 470, position: 'relative', marginTop: 10 }}>
        <RelationshipMap compact onOpen={open} />
      </div>

      {/* identity + headline figures */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px 16px', padding: '13px 16px 15px', borderTop: '0.5px solid var(--rule)' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Your people
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 18px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>{avgMatch}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.03em' }}>avg match</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── tiny inline sparkline ──────────────────────────────────────────────────
function Spark({ vals, w = 132, h = 30, hue = 145, dot = true }) {
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((v - min) / span) * (h - 8);
    return [x, y];
  });
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={`oklch(0.55 0.13 ${hue})`} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {dot && <circle cx={last[0]} cy={last[1]} r="2.4" fill={`oklch(0.55 0.15 ${hue})`} />}
    </svg>
  );
}

// ════════════════════════════ CITY ════════════════════════════

// ── 3. Kindred in Oslo · strangers in the city most aligned with you ────────
function KindredInOslo() {
  const people = [
    { init: 'AK', name: 'Anders K.',  hood: 'Torshov',     match: 92, hue: 145, shared: ['ceramics', 'cold swims', 'Pärt'] },
    { init: 'IM', name: 'Ingrid M.',  hood: 'Grünerløkka', match: 89, hue: 38,  shared: ['rye baking', 'Solnit', 'fjord walks'] },
    { init: 'PV', name: 'Petter V.',  hood: 'Sagene',      match: 85, hue: 250, shared: ['field notes', 'birding', 'silence'] },
  ];
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Kicker>Kindred in Oslo</Kicker>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: 'oklch(0.45 0.13 145)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Strangers · opt-in</span>
      </div>
      <div className="margin-note" style={{ fontSize: 15, marginTop: 4, marginBottom: 12 }}>
        strangers who scored closest to you — the fuller the ring, the closer.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {people.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 12px', background: 'var(--surface)',
            border: '1px solid color-mix(in oklch, var(--rule), transparent 25%)', borderRadius: 14,
          }}>
            <MatchRing pct={p.match} color={`oklch(0.45 0.13 ${p.hue})`} size={50} title={`${p.match} kindred`}>
              <Av init={p.init} hue={p.hue} size={36} />
            </MatchRing>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em' }}>{p.name}</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{p.hood}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {p.shared.map(s => (
                  <span key={s} style={{
                    fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 500,
                    color: `oklch(0.34 0.13 ${p.hue})`,
                    padding: '2px 9px', borderRadius: 99,
                    background: `oklch(0.95 0.03 ${p.hue})`, border: `0.5px solid oklch(0.85 0.05 ${p.hue})`,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="margin-note" style={{ fontSize: 15, marginTop: 10, textAlign: 'center' }}>
        names shown only when both of you opt in.
      </div>
    </div>
  );
}

// ════════════════════════════ WORLD ════════════════════════════

// ── 1. Where You'd Belong · best-matched cities on Earth ────────────────────
function WhereYoudBelong() {
  const hero = {
    name: 'Lisbon', country: 'Portugal', code: 'PT', match: 88, hue: 38,
    why: ['light most of the year', 'slow mornings, late dinners', 'water, hills, old stone'],
    line: 'warm where Oslo is cool, unhurried where Oslo is precise.',
  };
  const others = [
    { name: 'Kyoto',     country: 'JP', match: 84, hue: 145, note: 'ritual, quiet, the seasons marked' },
    { name: 'Reykjavík', country: 'IS', match: 81, hue: 200, note: 'northern light, small and close' },
    { name: 'Wellington',country: 'NZ', match: 76, hue: 165, note: 'wind, water, makers' },
  ];
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {/* section head above carries the title — the card gets straight to the cities */}
      {/* hero — tap through to the full city profile */}
      <div className="press" onClick={() => window.openCity && window.openCity(hero.name)} style={{
        padding: 16, borderRadius: 14, cursor: 'pointer',
        background: `oklch(0.965 0.028 ${hero.hue})`,
        border: `0.5px solid oklch(0.85 0.06 ${hero.hue})`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ink)', lineHeight: 1 }}>{hero.name}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.08em', marginTop: 4, textTransform: 'uppercase' }}>{hero.country} · {hero.code}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="fig-num" style={{ fontSize: 38, lineHeight: 0.9, color: `oklch(0.44 0.14 ${hero.hue})` }}><em>{hero.match}</em></div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Life-fit</div>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, lineHeight: 1.45, marginTop: 10, color: `oklch(0.40 0.13 ${hero.hue})` }}>
          “{hero.line}”
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {hero.why.map(w => (
            <span key={w} style={{
              fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 500,
              color: `oklch(0.32 0.13 ${hero.hue})`, padding: '3px 10px', borderRadius: 99,
              background: 'var(--surface-2)', border: `0.5px solid oklch(0.84 0.06 ${hero.hue})`,
            }}>{w}</span>
          ))}
        </div>
      </div>
      {/* runners-up — each opens its city profile */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {others.map(o => (
          <div key={o.name} className="press" onClick={() => window.openCity && window.openCity(o.name)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <span style={{ width: 92, fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, letterSpacing: '-0.015em' }}>{o.name}<span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.06em', marginLeft: 5 }}>{o.country}</span></span>
            <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)' }}>{o.note}</span>
            <MatchRing pct={o.match} color={`oklch(0.45 0.13 ${o.hue})`} size={17} thick={2.6} title={`${o.match} life-fit`} />
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 14, color: 'var(--ink-3)' }}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── City voices · strengths & frictions people contribute ───────────────────
const VOICES_KEY = 'insight.cityVoices.v1';

const SEED_VOICES = {
  strengths: [
    { id: 's1', text: 'Fjord and forest, both twenty minutes from the centre.', who: 'AK', agree: 312, mine: false },
    { id: 's2', text: 'You can drink the tap water and trust the institutions.', who: 'TL', agree: 287, mine: false },
    { id: 's3', text: 'Summer evenings that go on until midnight.',              who: 'IM', agree: 241, mine: false },
    { id: 's4', text: 'Walkable, and the transit actually just works.',          who: 'PV', agree: 198, mine: false },
    { id: 's5', text: 'Coffee culture that takes itself seriously — happily.',   who: 'SB', agree: 156, mine: false },
  ],
  frictions: [
    { id: 'f1', text: 'Brutally expensive — a night out costs a fortune.',       who: 'EH', agree: 334, mine: false },
    { id: 'f2', text: 'The winter dark is long; February really gets to you.',   who: 'MM', agree: 298, mine: false },
    { id: 'f3', text: 'Hard to break into social circles as a newcomer.',        who: 'JR', agree: 256, mine: false },
    { id: 'f4', text: 'Everything closes early — especially on Sundays.',        who: 'AB', agree: 187, mine: false },
    { id: 'f5', text: 'Housing prices have outrun most salaries.',               who: 'TV', agree: 174, mine: false },
  ],
};

function loadVoices() {
  try {
    const v = JSON.parse(localStorage.getItem(VOICES_KEY) || 'null');
    if (v && v.strengths && v.frictions) return v;
  } catch (e) {}
  return JSON.parse(JSON.stringify(SEED_VOICES));
}

Object.assign(window, {
  KindredInOslo,
  WhereYoudBelong, PeopleProfileCard,
});
