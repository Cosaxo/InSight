// Ported from design/spec-modules/profile-general.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_DATA } from './sample-data.js';
import { IS_TEST_RESULTS } from './test-definitions.js';
import { PASSIVE } from './passive-progress.js';
import { list as anchorList } from './map-anchors.js';
import { PROFILE_GENERAL_LS } from '../data/cityAnchor';
// An import, not the window.PLACES read this file used to carry — the
// typed module is importable from spec (logic-test precedent), and the
// two freed reference sites pay for the live scenes card's window.SCENES
// read below, so the D39 coupling meter moves DOWN with this change.
import PLACES from '../data/places';

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
  const { useState, useEffect, useRef, useId } = React;

  // Imported rather than restated: data/cityAnchor.ts writes vitals.city
  // into this same blob from the Mirror's needs-a-city empty state, and a
  // key spelled in two files is a drift waiting to strand one of them.
  const GKEY = PROFILE_GENERAL_LS;
  // The key this replaced. A v1 blob may hold the sample persona as its own
  // properties, because the build that wrote it could not tell the two apart
  // — see loadGen and migrateV1 below.
  const GKEY_V1 = 'insight.profileGeneral.v1';

  // ── seed from data.js, then overlay any saved edits ──
  function seedFromData() {
    const me = IS_DATA.me || {};
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
  // What the panel starts from, BEFORE any saved edits are laid over it. In
  // live mode that is nothing at all: the basics card fills only with what
  // the user actually enters.
  //
  // This is a base for the merge rather than a branch beside it, and the
  // difference is the whole bug. The live guard used to sit after the saved
  // blob was read, reachable only when there was no blob — and the persist
  // effect below writes one on mount, with no edit made. So the SECOND mount
  // always found a blob, always took the merge path, and that path spread
  // `seed.vitals` underneath it: a live user got the sample persona back
  // ("age 35 · Editor · MA Literature") the moment they reopened the
  // profile, whereupon the anchors effect wrote it to `v2_users/{uid}` and
  // answerAnchors() stamped it onto every answer after that. Answers are
  // create-only (D5), so the ones already written have no correction path —
  // which is why the guard has to hold on every mount, not the first.
  function baseFor(live) {
    if (!live) return seedFromData();
    return { vitals: {}, interests: [], likes: [], dislikes: [], heroes: [] };
  }

  // One-time carry-over from GKEY_V1, which on a device that ran the build
  // above holds the sample persona as own properties — indistinguishable, by
  // then, from typed input.
  //
  // In live mode a vital equal to the seed's value for that field is that
  // residue and is dropped; anything the user actually changed differs from
  // the seed and survives. The trade is explicit: someone who genuinely
  // typed a value the sample persona also has retypes one field, and the
  // alternative is leaving a fabricated anchor to be stamped onto answers
  // that cannot be edited. Demo mode carries the blob over untouched — there
  // the persona IS the content.
  function migrateV1(live) {
    let old = null;
    try {
      old = JSON.parse(localStorage.getItem(GKEY_V1) || 'null');
    } catch (e) { return null; }
    if (!old || typeof old !== 'object') return null;
    let next = old;
    if (live) {
      const seed = seedFromData();
      const vitals = {};
      for (const k of Object.keys(old.vitals || {})) {
        if (old.vitals[k] !== seed.vitals[k]) vitals[k] = old.vitals[k];
      }
      next = { ...old, vitals };
    }
    // Written before the old key is dropped, so a failure here loses the
    // migration rather than the data.
    try {
      localStorage.setItem(GKEY, JSON.stringify(next));
      localStorage.removeItem(GKEY_V1);
    } catch (e) { /* best-effort — the panel still renders `next` */ }
    return next;
  }

  function loadGen() {
    const live = !!(window.LIVE && window.LIVE.enabled);
    const base = baseFor(live);
    try {
      const saved = JSON.parse(localStorage.getItem(GKEY) || 'null') || migrateV1(live);
      if (saved && typeof saved === 'object') {
        return {
          vitals: { ...base.vitals, ...(saved.vitals || {}) },
          interests: saved.interests || base.interests,
          likes: saved.likes || base.likes,
          dislikes: saved.dislikes || base.dislikes,
          heroes: saved.heroes || base.heroes,
        };
      }
    } catch (e) { /* corrupt — fall through to the base */ }
    return base;
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
      // Imported binding — the (window.PLACES && …) load-order guard died
      // with the conversion, as the README's conversion notes prescribe.
      country: PLACES.countryOf(city) || '',
      city,
      education: v.education || '',
      profession: v.job || '',
      relationship: v.relationship || '',
    };
  }

  // Held equal to BREAKDOWN_DIM_VOCAB in functions/src/pure.ts by
  // `npm run check:anchors` — the aggregate trigger buckets on these exact
  // strings, so a label edit here silently stops that level counting.
  // 'Vocational or trade' is spelled without the slash for that reason: a
  // slash is in breakdownBucket's rejected character class, and while this
  // list said 'Vocational / trade' that option folded into no bucket at all.
  const EDU_OPTS = ['Primary school', 'Middle school', 'High school', 'Vocational or trade', 'Some college', 'Associate degree', "Bachelor's", 'Postgraduate diploma', "Master's", 'MBA', 'Doctorate', 'Postdoctoral', 'Professional certification', 'Self-taught', 'Other'];
  // `id` is threaded down to the native <select> so the caller's <label> can
  // point at it with htmlFor. Nesting the control inside the label is valid
  // implicit association on its own, but only to something that can see
  // through this component — jsx-a11y cannot, and neither can a reader of the
  // call site. The explicit pair states the association where both can check
  // it, and survives the control moving out of the label.
  function Select({ id, value, onChange, options, placeholder = 'Choose…' }) {
    const [foc, setFoc] = useState(false);
    return (
      <span style={{ position: 'relative', display: 'block', minWidth: 0 }}>
        <select id={id} value={value} onChange={onChange} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
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
    // One prefix per mounted card, so the ids stay unique if this ever
    // renders twice on a screen. Suffixes are field names rather than
    // indexes — a reordered grid must not silently re-point a label.
    const uid = useId();
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
              <label style={fieldLabel} htmlFor={`${uid}-bornD`}>Day<Select id={`${uid}-bornD`} value={DAYS.includes(v.bornD) ? v.bornD : ''} onChange={e => setPart('bornD', e.target.value)} options={DAYS} placeholder="—" /></label>
              <label style={fieldLabel} htmlFor={`${uid}-bornM`}>Month<Select id={`${uid}-bornM`} value={MONTHS.includes(v.bornM) ? v.bornM : ''} onChange={e => setPart('bornM', e.target.value)} options={MONTHS} placeholder="—" /></label>
              <label style={fieldLabel} htmlFor={`${uid}-born`}>Year<Select id={`${uid}-born`} value={YEARS.includes(v.born) ? v.born : ''} onChange={e => setPart('born', e.target.value)} options={YEARS} placeholder="—" /></label>
              <span style={fieldLabel}>Age<span style={{ ...inputBase, fontSize: 15, padding: '8px 11px', border: '1px solid transparent', background: 'transparent', color: 'var(--ink-2)', fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>{age || '—'}</span></span>
            </div>
            <label style={fieldLabel} htmlFor={`${uid}-job`}>Job<Select id={`${uid}-job`} value={JOB_OPTS.includes(v.job) ? v.job : ''} onChange={e => upd('job', e.target.value)} options={JOB_OPTS} placeholder="Field…" /></label>
            <label style={fieldLabel} htmlFor={`${uid}-education`}>Education<Select id={`${uid}-education`} value={EDU_OPTS.includes(v.education) ? v.education : ''} onChange={e => upd('education', e.target.value)} options={EDU_OPTS} placeholder="Level…" /></label>
            <label style={fieldLabel} htmlFor={`${uid}-gender`}>Gender<Select id={`${uid}-gender`} value={GENDER_OPTS.includes(v.gender) ? v.gender : ''} onChange={e => upd('gender', e.target.value)} options={GENDER_OPTS} placeholder="—" /></label>
            <label style={fieldLabel} htmlFor={`${uid}-relationship`}>Relationship<Select id={`${uid}-relationship`} value={REL_OPTS.includes(v.relationship) ? v.relationship : ''} onChange={e => upd('relationship', e.target.value)} options={REL_OPTS} placeholder="—" /></label>
            {/* One picker, not two free-text boxes (D9). Country is derived
                from the chosen city rather than typed: as free text it was
                minting a bucket per spelling ("Norway"/"norway"/"NO"), each
                below the 5-person floor, so the country breakdown published
                nothing at all. The picker offers an optional "use my
                location" that resolves to a city on the device; the
                coordinate is never stored or sent (D9). */}
            {/* A <span>, not a <label>, and this row is the reason the rule
                above is worth obeying rather than configuring away.
                CityPicker renders a <button> collapsed and an
                <input role="combobox"> open; both are labelable, so a
                wrapping <label> WINS the accessible-name computation and the
                chosen city stops reaching a screen reader entirely. That
                already happened once — ui/CityPicker.tsx carries an
                aria-label added to work around this exact wrapper. The
                caption is visual; the control names itself. */}
            <span style={fieldLabel}>City
              <CityPicker value={v.city || ''} onChange={next => upd('city', next)} />
            </span>
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
    // The load-order guard is gone with the conversion (an imported binding
    // cannot be unset); the length check is the DATA condition and stays —
    // a live account with no Basics card and no test taken has no ring, and
    // a thumbnail of an empty ring is worse than no card.
    const anchors = anchorList();
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

  // ── one arc per test — each test as a filled ring, no numbers ──
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
    const R = IS_TEST_RESULTS;
    const C = 2 * Math.PI * 23;
    return (
      <Card title="Your tests">
        {/* Column count derives from the list — it was hardcoded to 4 and the
            fifth test would have wrapped a lone ring onto its own row. The
            rings scale with the column instead of sitting at a fixed 54px:
            five columns on a 320px viewport leave ~50px each, which a fixed
            54px ring overflows. */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ARC_TESTS.length}, 1fr)`, gap: 2 }}>
          {ARC_TESTS.map(({ k, sub, name }) => {
            const res = R[k];
            const top = res ? [...res.dims].sort((a, b) => b.value - a.value)[0] : null;
            const pct = PASSIVE.pct(k);
            return (
              <button key={k} className="press" onClick={() => onGo && onGo(sub)} style={{
                cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', background: 'none', border: 'none',
                padding: '2px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                fontFamily: 'var(--sans)', color: 'var(--ink)', minWidth: 0,
              }}>
                <svg viewBox="0 0 56 56" width="54" height="54" style={{ width: '100%', maxWidth: 54, height: 'auto' }} aria-hidden="true">
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

  // The LIVE half of the scenes section: the user's real follow list and
  // nothing else. The demo field this replaces drew an orbit of invented
  // populations and likeness distances (D1 forbids those without a source);
  // what a live build genuinely has is the follow store itself — scenes.js,
  // written by the feed's topic row and search — so this renders exactly
  // that: each followed scene, its hue, and the way out. Counts and
  // likeness return when a real source feeds them, not before.
  function LiveScenesCard() {
    const [, bump] = useState(0);
    const SC = window.SCENES;
    // [SC] rather than a deps suppression: the store is a module-level
    // singleton, so the identity never changes and this still runs once.
    useEffect(() => (SC ? SC.subscribe(() => bump((b) => b + 1)) : undefined), [SC]);
    if (!SC) return null;
    const mine = SC.mine();
    if (mine.length === 0) {
      // The copy used to send you to "the daily's topic row and in search —
      // follow one", which in a live build is a door onto an empty room:
      // D96 stopped offering scenes there because every one of them was
      // sample data, so the only honest instruction is the one that is
      // actually true of this build — every subject runs, and the feed's
      // topic sheet is where you tune them.
      return (
        <div className="card" style={{ padding: '14px 15px', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          No scenes yet — every topic runs in your feed instead. Tap
          &#43; on the feed&rsquo;s topic row to see them all, with what
          each one holds, and mute the ones you would rather not get.
        </div>
      );
    }
    return (
      <div className="card" style={{ padding: '14px 15px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {mine.map((g) => (
          <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '0.5px solid var(--rule)', borderRadius: 999, padding: '5px 7px 5px 12px', background: 'var(--surface-2)' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: SC.colorOf(g.id) }}></span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{g.name}</span>
            <button className="press" aria-label={'Unfollow ' + g.name} onClick={() => SC.unfollow(g.id)}
              style={{ border: 'none', background: 'var(--rule)', color: 'var(--ink-2)', width: 17, height: 17, borderRadius: 999, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, WebkitAppearance: 'none' }}>✕</button>
          </span>
        ))}
      </div>
    );
  }

  // ── the panel ──
  function GeneralPanel({ onGo }) {
    const [data, set] = useState(loadGen);
    useEffect(() => {
      try { localStorage.setItem(GKEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }, [data]);
    // One liveness read for the panel: the anchors mirror below and the
    // demo-section gate at the foot both branch on it, and consolidating
    // here keeps the file's shared-global reference count flat (D39 rule 4).
    const LIVE_ON = !!(window.LIVE && window.LIVE.enabled);
    // Mirror the anchor subset onto the owner-only profile doc (D8), so
    // later answers can snapshot it. Only in live mode — in mock mode the
    // vitals are demo data and there is no server to write to.
    //
    // Compared as JSON rather than by object identity: `data` gets a new
    // reference on every keystroke in an unrelated card (interests, heroes),
    // and each one would otherwise be a Firestore write.
    const anchorsJson = LIVE_ON
      ? JSON.stringify(anchorsFrom(data.vitals || {}))
      : null;
    // Deliberately fires on MOUNT as well as on edit, and deliberately not
    // gated behind a first-run ref. A profile whose anchors were written by
    // the build loadGen describes still holds them server-side, and this
    // write is the only thing that corrects them: opening the profile once
    // replaces the map wholesale (saveAnchors, live.ts), so a repaired
    // device stops stamping the sample persona onto new answers. Suppressing
    // the mount write to save a Firestore write would leave the fabricated
    // anchors exactly where they are.
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
        {/* DEMO ONLY. This field body is the scenes orbit plus its lenses,
            and every number on it is invented: "5.6k people", the
            closer-means-more-like-you distances, "Who's in your circles ·
            138 members", "What they answered". A release device showed all
            of it to a real user as if it were theirs — the D66 class at
            section scale. Live mode drops the section whole; follows are
            managed from the feed's chip row and search until a live scenes
            surface exists with real numbers behind it (D1). */}
        {!LIVE_ON && typeof window.MirrorFieldBody === 'function' && (
          <div>
            <Chapter>Scenes you follow</Chapter>
            <window.MirrorFieldBody pop="groups" worldZoom="world" />
          </div>
        )}
        {LIVE_ON && (
          <div>
            <Chapter>Scenes you follow</Chapter>
            <LiveScenesCard />
          </div>
        )}
      </div>
    );
  }

  window.GeneralPanel = GeneralPanel;
})();

