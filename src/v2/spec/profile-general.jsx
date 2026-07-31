// Ported from design/spec-modules/profile-general.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// ─────────────────────────────────────────────────────────────
// General tab · the parts of you that aren't a test.
// Redesigned: clean sans, airy, and inline-editable. The basics
// (vitals) can be edited in place and persist to localStorage. The
// charts/patterns below it stay read-only.
//
// The store still carries `interests` / `likes` / `dislikes` /
// `heroes` even though nothing renders them any more: the cards that
// did were deleted 2026-07-31 as dead code, but GeneralPanel writes
// the WHOLE `data` object back to GKEY on every edit. Dropping the
// keys from the seed/load path would make the next basics edit
// overwrite whatever a user saved under an older build. They
// round-trip inertly instead — cheap, and lossless if a card returns.
// ─────────────────────────────────────────────────────────────
(function () {
  const { useState, useEffect, useRef } = React;

  const GKEY = 'insight.profileGeneral.v1';

  // ── seed from data.js, then overlay any saved edits ──
  function seedFromData() {
    const me = (window.IS_DATA && window.IS_DATA.me) || {};
    const s = me.stats || {};
    return {
      vitals: {
        born: String(s.birthYear ?? ''),
        bornM: s.birthMonth ?? 'July',
        bornD: s.birthDay != null ? String(s.birthDay) : '12',
        age: String(s.age ?? ''),
        job: me.job ?? '',
        education: me.education ?? '',
        chronotype: s.chronotype ?? '',
        sign: s.sign ?? '',
      },
      interests: (me.myInterests || []).map(i => (typeof i === 'string' ? i : i.t)),
      likes: [...(me.likes || [])],
      dislikes: [...(me.dislikes || [])],
      heroes: (me.heroes || []).map(h => ({ ...h })),
    };
  }
  function loadGen() {
    const seed = seedFromData();
    try {
      const saved = JSON.parse(localStorage.getItem(GKEY) || 'null');
      if (saved && typeof saved === 'object') {
        return {
          vitals: { ...seed.vitals, ...(saved.vitals || {}) },
          interests: saved.interests || seed.interests,
          likes: saved.likes || seed.likes,
          dislikes: saved.dislikes || seed.dislikes,
          heroes: saved.heroes || seed.heroes,
        };
      }
    } catch (e) { /* corrupt — fall through to seed */ }
    // live mode: no demo prefill — the basics card starts empty and
    // fills only with what the user actually enters
    if (window.LIVE && window.LIVE.enabled) {
      return { vitals: {}, interests: [], likes: [], dislikes: [], heroes: [] };
    }
    return seed;
  }

  // ── shared input styling ──
  const inputBase = {
    fontFamily: 'var(--sans)', color: 'var(--ink)',
    background: 'var(--surface)', border: '1px solid var(--rule)',
    borderRadius: 10, outline: 'none', WebkitAppearance: 'none', appearance: 'none',
    boxSizing: 'border-box', width: '100%', minWidth: 0,
    transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
  };

  // ── select (fixed options — keeps profile fields filterable) ──
  const YEAR_NOW = new Date().getFullYear();
  const YEARS = Array.from({ length: YEAR_NOW - 13 - 1929 }, (_, i) => String(YEAR_NOW - 13 - i));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const monthNum = (name) => MONTHS.indexOf(name) + 1; // 0 when unset
  function calcAge(y, mName, d) {
    if (!y) return '';
    const now = new Date();
    let a = now.getFullYear() - Number(y);
    const m = monthNum(mName);
    if (m) { const cm = now.getMonth() + 1; if (cm < m || (cm === m && now.getDate() < Number(d || 0))) a--; }
    return String(a);
  }
  const JOB_OPTS = ['Arts & culture', 'Design & creative', 'Media & publishing', 'Writing & journalism', 'Education & research', 'Science', 'Software & IT', 'Tech & engineering', 'Engineering', 'Architecture', 'Healthcare', 'Mental health & care', 'Business & finance', 'Marketing & advertising', 'Sales', 'Consulting', 'Law & government', 'Public sector & nonprofit', 'Trades & crafts', 'Construction', 'Manufacturing', 'Agriculture & environment', 'Transport & logistics', 'Service & hospitality', 'Retail', 'Entrepreneur / self-employed', 'Student', 'Homemaker', 'Between jobs', 'Retired', 'Other'];
  // Anchor vocabularies (D8). Coarse on purpose: the breakdown floors get
  // thin fast, and a free-text answer would mint a bucket per spelling.
  // "Prefer not to say" is a REAL option, not an empty string, so choosing
  // it is distinguishable from never having been asked.
  const GENDER_OPTS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];
  const REL_OPTS = ['Single', 'Dating', 'Partnered', 'Married', 'It\u2019s complicated', 'Prefer not to say'];
  // ~5-year bands under 35, widening after — matches how the splits are
  // read ("25-34 went the other way"), and keeps cells populated.
  const AGE_BANDS = [
    [0, 17, 'Under 18'], [18, 24, '18-24'], [25, 34, '25-34'],
    [35, 44, '35-44'], [45, 54, '45-54'], [55, 64, '55-64'], [65, 200, '65+'],
  ];
  function ageBandOf(age) {
    const n = Number(age);
    if (!n || Number.isNaN(n)) return '';
    const hit = AGE_BANDS.find(([lo, hi]) => n >= lo && n <= hi);
    return hit ? hit[2] : '';
  }
  // The profile\u2019s own vocabulary, mapped onto the seven rules-validated
  // anchor keys. Only the band is derived \u2014 the exact birthday never
  // leaves the device.
  function anchorsFrom(v) {
    // `city` holds the canonical catalogue key ("Oslo, NO"), which is also
    // the breakdown bucket key. `country` is DERIVED from it as the ISO
    // code, never typed: the code is locale-independent, so a French phone
    // and a Norwegian one land in the same cohort. The breakdown UI turns
    // it back into "Norway" / "Norvège" at display time.
    //
    // A profile written before the picker holds free text, which does not
    // parse — those keep their city string (it is still their answer) and
    // simply contribute no country until they re-pick.
    const city = v.city || '';
    return {
      ageBand: ageBandOf(calcAge(v.born, v.bornM, v.bornD) || v.age),
      gender: v.gender || '',
      country: (window.PLACES && window.PLACES.countryOf(city)) || '',
      city,
      education: v.education || '',
      profession: v.job || '',
      relationship: v.relationship || '',
    };
  }

  const EDU_OPTS = ['Primary school', 'Middle school', 'High school', 'Vocational / trade', 'Some college', 'Associate degree', "Bachelor's", 'Postgraduate diploma', "Master's", 'MBA', 'Doctorate', 'Postdoctoral', 'Professional certification', 'Self-taught', 'Other'];
  function Select({ value, onChange, options, placeholder = 'Choose…' }) {
    const [foc, setFoc] = useState(false);
    return (
      <span style={{ position: 'relative', display: 'block', minWidth: 0 }}>
        <select value={value} onChange={onChange} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
          style={{
            ...inputBase, fontSize: 15, padding: '8px 30px 8px 11px', cursor: 'pointer',
            fontWeight: 400, textTransform: 'none', letterSpacing: 'normal',
            color: value ? 'var(--ink)' : 'var(--ink-3)',
            borderColor: foc ? 'var(--accent)' : 'var(--rule)',
            boxShadow: foc ? '0 0 0 3px color-mix(in oklch, var(--accent) 14%, transparent)' : 'none',
          }}>
          <option value="" disabled>{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    );
  }

  // ── pencil / edit toggle ──
  function PencilIcon({ size = 14 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }
  function EditBtn({ on, onClick }) {
    return (
      <button onClick={onClick} aria-label={on ? 'Done editing' : 'Edit'} style={{
        flexShrink: 0, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 30, padding: on ? '0 13px' : '0 9px', borderRadius: 999,
        border: '1px solid ' + (on ? 'var(--ink)' : 'var(--rule)'),
        background: on ? 'var(--ink)' : 'transparent',
        color: on ? 'var(--surface)' : 'var(--ink-3)',
        fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em',
        transition: 'background 0.16s ease, color 0.16s ease, border-color 0.16s ease',
      }}>
        {on ? 'Done' : <><PencilIcon /> Edit</>}
      </button>
    );
  }

  // ── card shell with a clean header row ──
  function Card({ title, hint, editable, editing, onToggle, children, style }) {
    return (
      <div className="card" style={{ marginBottom: 16, padding: '17px 18px', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{title}</div>
            {hint && <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
          </div>
          {editable && <EditBtn on={editing} onClick={onToggle} />}
        </div>
        {children}
      </div>
    );
  }

  // ── chapter label ──
  function Chapter({ children }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '30px 2px 16px' }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{children}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
      </div>
    );
  }

  // ── Basics (vitals) ──
  function BasicsCard({ data, set }) {
    const [editing, setEditing] = useState(false);
    const v = data.vitals;
    const upd = (k, val) => set(d => ({ ...d, vitals: { ...d.vitals, [k]: val } }));
    const setPart = (k, val) => set(d => {
      const nv = { ...d.vitals, [k]: val };
      nv.age = calcAge(nv.born, nv.bornM, nv.bornD);
      return { ...d, vitals: nv };
    });
    const age = calcAge(v.born, v.bornM, v.bornD) || v.age;
    return (
      <Card title="Basics" editable editing={editing} onToggle={() => setEditing(e => !e)}>
        {!editing ? (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.55, textWrap: 'pretty' }}>
            {[age ? 'age ' + age : null, v.job || null, v.education || null].filter(Boolean).join(' · ') || 'Add your basics →'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.4fr 1.1fr 0.7fr', gap: 8 }}>
              <label style={fieldLabel}>Day<Select value={DAYS.includes(v.bornD) ? v.bornD : ''} onChange={e => setPart('bornD', e.target.value)} options={DAYS} placeholder="—" /></label>
              <label style={fieldLabel}>Month<Select value={MONTHS.includes(v.bornM) ? v.bornM : ''} onChange={e => setPart('bornM', e.target.value)} options={MONTHS} placeholder="—" /></label>
              <label style={fieldLabel}>Year<Select value={YEARS.includes(v.born) ? v.born : ''} onChange={e => setPart('born', e.target.value)} options={YEARS} placeholder="—" /></label>
              <span style={fieldLabel}>Age<span style={{ ...inputBase, fontSize: 15, padding: '8px 11px', border: '1px solid transparent', background: 'transparent', color: 'var(--ink-2)', fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>{age || '—'}</span></span>
            </div>
            <label style={fieldLabel}>Job<Select value={JOB_OPTS.includes(v.job) ? v.job : ''} onChange={e => upd('job', e.target.value)} options={JOB_OPTS} placeholder="Field…" /></label>
            <label style={fieldLabel}>Education<Select value={EDU_OPTS.includes(v.education) ? v.education : ''} onChange={e => upd('education', e.target.value)} options={EDU_OPTS} placeholder="Level…" /></label>
            <label style={fieldLabel}>Gender<Select value={GENDER_OPTS.includes(v.gender) ? v.gender : ''} onChange={e => upd('gender', e.target.value)} options={GENDER_OPTS} placeholder="—" /></label>
            <label style={fieldLabel}>Relationship<Select value={REL_OPTS.includes(v.relationship) ? v.relationship : ''} onChange={e => upd('relationship', e.target.value)} options={REL_OPTS} placeholder="—" /></label>
            {/* One picker, not two free-text boxes (D9). Country is derived
                from the chosen city rather than typed: as free text it was
                minting a bucket per spelling ("Norway"/"norway"/"NO"), each
                below the 5-person floor, so the country breakdown published
                nothing at all. The picker offers an optional "use my
                location" that resolves to a city on the device; the
                coordinate is never stored or sent (D9). */}
            <label style={fieldLabel}>City
              <CityPicker value={v.city || ''} onChange={next => upd('city', next)} />
            </label>
            {/* Every field here is optional and skippable. The note says what
                it buys, because "why does a privacy app want my age?" is the
                right question to ask and it deserves an answer in place. */}
            <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
              All optional. These are what let the daily show how each kind of
              person split — never your exact birthday, and never a group small
              enough to point at one person.
            </div>
            {/* the zodiac Sign row left with the v15 revision: signOf and
                zodiacSign are gone from the prototype, so the row is too */}
          </div>
        )}
      </Card>
    );
  }
  const fieldLabel = {
    display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
    fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: 'var(--ink-3)',
  };

  // ── the visual profile: mind-map thumbnail → Mirror · You ──
  function MapThumbCard() {
    const anchors = (window.MapAnchors && window.MapAnchors.list) ? window.MapAnchors.list() : [];
    if (!anchors.length) return null;
    return (
      <button className="card press" onClick={() => window.goTab && window.goTab('you')} style={{
        width: '100%', marginBottom: 16, padding: '13px 18px', cursor: 'pointer', textAlign: 'left',
        WebkitAppearance: 'none', appearance: 'none', display: 'flex', alignItems: 'center', gap: 15,
        border: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', color: 'var(--ink)',
      }}>
        <svg viewBox="0 0 84 84" width="70" height="70" style={{ flexShrink: 0 }} aria-hidden="true">
          <circle cx="42" cy="42" r="27" fill="none" stroke="var(--rule)" strokeWidth="0.7"></circle>
          <circle cx="42" cy="42" r="15" fill="none" stroke="var(--rule)" strokeWidth="0.7"></circle>
          {anchors.map((a, i) => {
            const ang = -Math.PI / 2 + (i / anchors.length) * Math.PI * 2;
            const r = 21 + (i % 3) * 7;
            const x = 42 + Math.cos(ang) * r, y = 42 + Math.sin(ang) * r;
            return (
              <g key={a.id}>
                <line x1="42" y1="42" x2={x} y2={y} stroke={`oklch(0.75 0.07 ${a.hue})`} strokeWidth="0.9"></line>
                <circle cx={x} cy={y} r="3.8" fill={`oklch(0.62 0.12 ${a.hue})`}></circle>
              </g>
            );
          })}
          <circle cx="42" cy="42" r="6.5" fill="var(--ink)"></circle>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Your map</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>everything known, as one field</div>
        </div>
        <span style={{ color: 'var(--ink-3)', fontSize: 16, flexShrink: 0 }}>→</span>
      </button>
    );
  }

  // ── four test arcs — each test as a filled ring, no numbers ──
  const ARC_TESTS = [
    { k: 'big5', sub: 'big5', name: 'Big Five' },
    { k: 'political', sub: 'politics', name: 'Politics' },
    { k: 'values', sub: 'values', name: 'Values' },
    { k: 'attachment', sub: 'attachment', name: 'Social' },
  ];
  // The lenses as a 3x3 of dots — filled once a lens has enough answers to
  // read. A shortcut to the Lenses sub-tab, which is otherwise only reachable
  // by knowing it is there; the sibling of TestArcsCard above it.
  function LensesRowCard({ onGo }) {
    const L = window.LENSES;
    if (!L) return null;
    const n = L.KEYS.length, m = L.mapped();
    return (
      <button className="card press" onClick={() => onGo && onGo('lenses')} style={{
        width: '100%', marginBottom: 16, padding: '13px 18px', cursor: 'pointer', textAlign: 'left',
        WebkitAppearance: 'none', appearance: 'none', display: 'flex', alignItems: 'center', gap: 15,
        border: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', color: 'var(--ink)',
      }}>
        <div style={{ width: 54, height: 54, flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, alignContent: 'center', justifyItems: 'center' }} aria-hidden="true">
          {L.all.map((l) => (
            <span key={l.id} style={{ width: 11, height: 11, borderRadius: '50%', background: L.complete(l.id) ? `oklch(0.56 0.13 ${l.hue})` : 'transparent', border: `1.5px solid oklch(0.56 0.13 ${l.hue})`, opacity: L.complete(l.id) ? 1 : 0.55 }}></span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Lenses</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{m ? m + ' of ' + n + ' smaller readings mapped' : n + ' smaller readings · filling in from the feed'}</div>
        </div>
        <span style={{ color: 'var(--ink-3)', fontSize: 16, flexShrink: 0 }}>{'\u2192'}</span>
      </button>
    );
  }

  function TestArcsCard({ onGo }) {
    const R = window.IS_TEST_RESULTS || {};
    const C = 2 * Math.PI * 23;
    return (
      <Card title="Your tests">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
          {ARC_TESTS.map(({ k, sub, name }) => {
            const res = R[k];
            const top = res ? [...res.dims].sort((a, b) => b.value - a.value)[0] : null;
            const pct = window.PASSIVE ? window.PASSIVE.pct(k) : (res ? 100 : 0);
            return (
              <button key={k} className="press" onClick={() => onGo && onGo(sub)} style={{
                cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', background: 'none', border: 'none',
                padding: '2px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                fontFamily: 'var(--sans)', color: 'var(--ink)', minWidth: 0,
              }}>
                <svg viewBox="0 0 56 56" width="54" height="54" aria-hidden="true">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="var(--surface-3)" strokeWidth="6"></circle>
                  {pct > 0 && res && <circle cx="28" cy="28" r="23" fill="none" stroke={res.accent} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 28 28)"></circle>}
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top ? top.label : name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: -4 }}>{name}</span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  // ── Logic gets its own card — a timed skill test, not a personality profile ──
  function LogicCard() {
    const lg = window.LOGIC ? window.LOGIC.load() : null;
    const C = 2 * Math.PI * 23;
    const col = window.LOGIC ? window.LOGIC.color : 'var(--ink)';
    return (
      <button className="card press" onClick={() => window.openLogicTest && window.openLogicTest()} style={{
        width: '100%', marginBottom: 16, padding: '13px 18px', cursor: 'pointer', textAlign: 'left',
        WebkitAppearance: 'none', appearance: 'none', display: 'flex', alignItems: 'center', gap: 15,
        border: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', color: 'var(--ink)',
      }}>
        <svg viewBox="0 0 56 56" width="54" height="54" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="28" cy="28" r="23" fill="none" stroke="var(--surface-3)" strokeWidth="6"></circle>
          {lg && <circle cx="28" cy="28" r="23" fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(C * lg.pctile) / 100} ${C}`} transform="rotate(-90 28 28)"></circle>}
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Logic</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{lg ? 'top ' + (100 - lg.pctile) + '% · timed reasoning' : 'timed reasoning · not taken yet'}</div>
        </div>
        <span style={{ color: 'var(--ink-3)', fontSize: 16, flexShrink: 0 }}>→</span>
      </button>
    );
  }

  // ── the panel ──
  function GeneralPanel({ onGo }) {
    const [data, set] = useState(loadGen);
    useEffect(() => {
      try { localStorage.setItem(GKEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }, [data]);
    // Mirror the anchor subset onto the owner-only profile doc (D8), so
    // later answers can snapshot it. Only in live mode — in mock mode the
    // vitals are demo data and there is no server to write to.
    //
    // Compared as JSON rather than by object identity: `data` gets a new
    // reference on every keystroke in an unrelated card (interests, heroes),
    // and each one would otherwise be a Firestore write.
    const anchorsJson = window.LIVE && window.LIVE.enabled
      ? JSON.stringify(anchorsFrom(data.vitals || {}))
      : null;
    useEffect(() => {
      if (anchorsJson == null) return;
      try { window.LIVE.saveAnchors(JSON.parse(anchorsJson)); } catch (e) { /* best-effort */ }
    }, [anchorsJson]);

    return (
      <div style={{ paddingBottom: 8 }}>
        <Chapter>About you</Chapter>
        <BasicsCard data={data} set={set} />
        <MapThumbCard />
        <TestArcsCard onGo={onGo} />
        <LensesRowCard onGo={onGo} />
        <LogicCard />
        {typeof window.MirrorFieldBody === 'function' && (
          <div>
            <Chapter>Scenes you follow</Chapter>
            <window.MirrorFieldBody pop="groups" worldZoom="world" />
          </div>
        )}
      </div>
    );
  }

  window.GeneralPanel = GeneralPanel;
})();

