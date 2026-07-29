// Ported from design/spec-modules/profile-general.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// ─────────────────────────────────────────────────────────────
// General tab · the parts of you that aren't a test.
// Redesigned: clean sans, airy, and inline-editable. Every personal
// fact (basics, interests, likes/dislikes, heroes) can be edited in
// place and persists to localStorage. The charts/patterns below it
// stay read-only.
// ─────────────────────────────────────────────────────────────
(function () {
  const { useState, useEffect, useRef } = React;

  const GKEY = 'insight.profileGeneral.v1';
  const HERO_HUES = [38, 150, 220, 290, 80, 320];

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

  const initials = (name) => (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('');

  // ── shared input styling ──
  const inputBase = {
    fontFamily: 'var(--sans)', color: 'var(--ink)',
    background: 'var(--surface)', border: '1px solid var(--rule)',
    borderRadius: 10, outline: 'none', WebkitAppearance: 'none', appearance: 'none',
    boxSizing: 'border-box', width: '100%', minWidth: 0,
    transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
  };
  function TextInput(props) {
    const { style, ...rest } = props;
    const [foc, setFoc] = useState(false);
    return (
      <input
        {...rest}
        onFocus={(e) => { setFoc(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={(e) => { setFoc(false); rest.onBlur && rest.onBlur(e); }}
        style={{
          ...inputBase, fontSize: 15, padding: '8px 11px',
          borderColor: foc ? 'var(--accent)' : 'var(--rule)',
          boxShadow: foc ? '0 0 0 3px color-mix(in oklch, var(--accent) 14%, transparent)' : 'none',
          ...style,
        }}
      />
    );
  }

  // ── select (fixed options — keeps profile fields filterable) ──
  const YEAR_NOW = new Date().getFullYear();
  const YEARS = Array.from({ length: YEAR_NOW - 13 - 1929 }, (_, i) => String(YEAR_NOW - 13 - i));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
  // sign is derived from the birthday, never chosen
  function zodiacSign(m, d) {
    if (!m || !d) return '';
    const signs = ['Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius'];
    const last = [19, 18, 20, 19, 20, 20, 22, 22, 21, 22, 21, 21];
    return d > last[m - 1] ? signs[m % 12] : signs[m - 1];
  }
  const monthNum = (name) => MONTHS.indexOf(name) + 1; // 0 when unset
  function calcAge(y, mName, d) {
    if (!y) return '';
    const now = new Date();
    let a = now.getFullYear() - Number(y);
    const m = monthNum(mName);
    if (m) { const cm = now.getMonth() + 1; if (cm < m || (cm === m && now.getDate() < Number(d || 0))) a--; }
    return String(a);
  }
  function signOf(v) { return zodiacSign(monthNum(v.bornM), Number(v.bornD)); }
  function fmtBorn(v) {
    if (!v.born) return '—';
    if (v.bornM && v.bornD) return `${v.bornD} ${v.bornM.slice(0, 3)} ${v.born}`;
    return v.born;
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

  // ── editable chip set ──
  function chipStyle(tone) {
    if (tone === 'dislike') {
      return {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 13px', borderRadius: 999,
        fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500, lineHeight: 1,
        background: 'transparent',
        border: '1px solid color-mix(in oklch, var(--rule), var(--ink) 6%)',
        color: 'var(--ink-3)',
        whiteSpace: 'nowrap',
      };
    }
    const muted = tone === 'muted';
    return {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 999,
      fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500, lineHeight: 1,
      background: muted ? 'transparent' : 'var(--surface)',
      border: '1px solid ' + (muted ? 'var(--rule)' : 'color-mix(in oklch, var(--rule), var(--ink) 8%)'),
      color: muted ? 'var(--ink-3)' : 'var(--ink-2)',
      whiteSpace: 'nowrap',
    };
  }
  function Chips({ items, onChange, editing, tone, placeholder = 'Add…' }) {
    const [draft, setDraft] = useState('');
    const add = () => {
      const v = draft.trim();
      if (v && !items.includes(v)) onChange([...items, v]);
      setDraft('');
    };
    const remove = (i) => onChange(items.filter((_, j) => j !== i));
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
        {items.map((it, i) => (
          <span key={it + i} style={chipStyle(tone)}>
            {tone === 'dislike' && <span aria-hidden="true" style={{ color: 'var(--ink-3)', opacity: 0.6, fontWeight: 700, marginRight: -1 }}>−</span>}
            {it}
            {editing && (
              <button onClick={() => remove(i)} aria-label={'Remove ' + it} style={{
                cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', border: 'none', background: 'none',
                padding: 0, marginRight: -3, display: 'inline-flex', color: 'var(--ink-3)', fontSize: 15, lineHeight: 1,
              }}>×</button>
            )}
          </span>
        ))}
        {editing && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            onBlur={add}
            placeholder={placeholder}
            style={{
              ...inputBase, fontSize: 13.5, padding: '7px 13px', width: 110,
              color: 'var(--ink-2)',
            }}
          />
        )}
      </div>
    );
  }

  // ── 1. Basics (vitals) ──
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
                nothing at all. The picker asks for no device location. */}
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
            <span style={fieldLabel}>Sign{'\u2004'}<span style={{ ...inputBase, fontSize: 15, padding: '8px 11px', border: '1px solid transparent', background: 'transparent', color: 'var(--ink-2)', fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>{signOf(v) || 'set your birthday'}</span></span>
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

  // ── 2. Interests & tastes (merged — one card, one Edit) ──
  function InterestsTastesCard({ data, set }) {
    const [editing, setEditing] = useState(false);
    return (
      <Card title="Interests &amp; tastes" hint={editing ? 'Tap × to remove, type to add.' : null}
        editable editing={editing} onToggle={() => setEditing(e => !e)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={tasteLabel}>Interests</div>
            <Chips items={data.interests} editing={editing}
              onChange={(next) => set(d => ({ ...d, interests: next }))} placeholder="interest…" />
          </div>
          <div>
            <div style={tasteLabel}>Likes</div>
            <Chips items={data.likes} editing={editing}
              onChange={(next) => set(d => ({ ...d, likes: next }))} placeholder="like…" />
          </div>
          <div>
            <div style={tasteLabel}>Dislikes</div>
            <Chips items={data.dislikes} editing={editing} tone="dislike"
              onChange={(next) => set(d => ({ ...d, dislikes: next }))} placeholder="dislike…" />
          </div>
        </div>
      </Card>
    );
  }

  // ── Interests ──
  function InterestsCard({ data, set }) {
    const [editing, setEditing] = useState(false);
    return (
      <Card title="Interests" hint={editing ? 'Tap × to remove, type to add.' : null}
        editable editing={editing} onToggle={() => setEditing(e => !e)}>
        <Chips items={data.interests} editing={editing}
          onChange={(next) => set(d => ({ ...d, interests: next }))} placeholder="interest…" />
      </Card>
    );
  }

  // ── 3. Likes & dislikes ──
  function TastesCard({ data, set }) {
    const [editing, setEditing] = useState(false);
    return (
      <Card title="Likes &amp; dislikes" editable editing={editing} onToggle={() => setEditing(e => !e)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={tasteLabel}>Likes</div>
            <Chips items={data.likes} editing={editing}
              onChange={(next) => set(d => ({ ...d, likes: next }))} placeholder="like…" />
          </div>
          <div>
            <div style={tasteLabel}>Dislikes</div>
            <Chips items={data.dislikes} editing={editing} tone="muted"
              onChange={(next) => set(d => ({ ...d, dislikes: next }))} placeholder="dislike…" />
          </div>
        </div>
      </Card>
    );
  }
  const tasteLabel = {
    fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 11,
  };

  // ── 4. Heroes ──
  function HeroesCard({ data, set }) {
    const [editing, setEditing] = useState(false);
    const heroes = data.heroes;
    const updHero = (i, k, val) => set(d => ({ ...d, heroes: d.heroes.map((h, j) => j === i ? { ...h, [k]: val } : h) }));
    const removeHero = (i) => set(d => ({ ...d, heroes: d.heroes.filter((_, j) => j !== i) }));
    const addHero = () => set(d => ({
      ...d,
      heroes: [...d.heroes, { name: 'New hero', field: '', hue: HERO_HUES[d.heroes.length % HERO_HUES.length] }],
    }));
    return (
      <Card title="Heroes" editable editing={editing} onToggle={() => setEditing(e => !e)}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {heroes.map((h, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0',
              borderTop: i === 0 ? 'none' : '1px solid color-mix(in oklch, var(--rule), transparent 35%)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: `oklch(0.93 0.05 ${h.hue})`, border: `1px solid oklch(0.7 0.1 ${h.hue})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, color: `oklch(0.4 0.13 ${h.hue})`,
              }}>{initials(h.name)}</div>
              {editing ? (
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <TextInput value={h.name} onChange={e => updHero(i, 'name', e.target.value)} style={{ fontSize: 14.5, fontWeight: 600, padding: '6px 10px' }} placeholder="Name" />
                  <TextInput value={h.field} onChange={e => updHero(i, 'field', e.target.value)} style={{ fontSize: 13, padding: '6px 10px' }} placeholder="What they're known for" />
                </div>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{h.name}</div>
                  {h.field && <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{h.field}</div>}
                </div>
              )}
              {editing && (
                <button onClick={() => removeHero(i)} aria-label={'Remove ' + h.name} style={{
                  flexShrink: 0, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
                  width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--rule)', background: 'transparent',
                  color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              )}
            </div>
          ))}
        </div>
        {editing && (
          <button onClick={addHero} style={{
            marginTop: 12, width: '100%', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
            padding: '11px', borderRadius: 12, border: '1px solid var(--rule)', background: 'transparent',
            color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600,
          }}>+ Add hero</button>
        )}
      </Card>
    );
  }

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
        <LogicCard />
        {typeof window.MirrorFieldBody === 'function' && (
          <div>
            <Chapter>Scenes you follow</Chapter>
            <window.MirrorFieldBody pop="groups" worldZoom="world" levelTrait="gender" levelMarker={true} />
          </div>
        )}
      </div>
    );
  }

  window.GeneralPanel = GeneralPanel;
})();

