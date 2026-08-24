// suggestions.jsx — "Ask a question": the paid door as a page (overlay).
// No community upvotes: every question is bought for a place and a window,
// reviewed, and always marked PAID. The board is the rate card — the current
// price of each cohort and the demand on its one daily slot.
const { useState: useSgState } = React;

function useSuggestions() {
  const [, bump] = useSgState(0);
  React.useEffect(() => window.SUGGESTIONS.subscribe(() => bump((x) => x + 1)), []);
  return window.SUGGESTIONS;
}

const sgHueCol = (hue) => window.WPAL.c('oklch(0.52 0.14 ' + (hue != null ? hue : 40) + ')');
const sgOptCol = (tc, i, n) => window.WPAL.opt(tc, i, n);
const sgLabel = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' };

// read-only preview of the answer shape, tinted by the suggestion's hue
function SgPreview({ s }) {
  const col = sgHueCol(s.hue);
  if (s.type === 'scale' || s.type === 'rating') {
    const ends = s.type === 'rating' ? ['1', '10'] : ['disagree', 'agree'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{ends[0]}</span>
        <span style={{ flex: 1, height: 3, borderRadius: 999, background: 'linear-gradient(to right, color-mix(in oklch, ' + col + ' 40%, var(--surface-3)), var(--surface-3))' }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{ends[1]}</span>
      </div>
    );
  }
  const opts = s.options || [];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {opts.map((o, i) => (
        <span key={i} style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink-2)', background: 'color-mix(in oklch, ' + sgOptCol(col, i, opts.length) + ' 8%, var(--surface))', border: '0.5px solid color-mix(in oklch, ' + sgOptCol(col, i, opts.length) + ' 32%, var(--rule))', borderRadius: 999, padding: '4px 11px' }}>{o}</span>
      ))}
    </div>
  );
}

// tiny state marks — one word each, so the board needs no legend
function SgTag({ label, col }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', lineHeight: 1, color: 'color-mix(in oklch, ' + col + ' 82%, var(--ink))', background: 'color-mix(in oklch, ' + col + ' 10%, transparent)', border: '0.5px solid color-mix(in oklch, ' + col + ' 30%, var(--rule))', borderRadius: 999, padding: '4px 8px 3px' }}>{label}</span>;
}

const SG_TYPES = [['binary', 'this or that'], ['dilemma', 'dilemma'], ['choice', 'multiple choice'], ['scale', 'scale']];

// ── your submissions: status first, and a decline that states the standard it
// missed, the number behind it, and the way forward.
function SgMine({ s, SG, onResend }) {
  const col = sgHueCol(s.hue);
  const d = SG.declineOf(s);
  const tone = s.status === 'picked' ? 'var(--c-city)' : s.status === 'declined' ? 'var(--ink-3)' : 'var(--ochre-ink)';
  const label = s.status === 'picked' ? 'ran' : s.status === 'declined' ? 'declined' : 'in review';
  return (
    <div className="card" style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SgTag label={label} col={tone}></SgTag>
        {s.featured ? <SgTag label="paid" col="var(--ink)"></SgTag> : null}
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{s.ago === 'just now' ? 'just now' : s.ago + ' ago'}</span>
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 16.5, lineHeight: 1.26, letterSpacing: '-0.32px', textWrap: 'pretty' }}>{s.prompt}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: col }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
          {s.status === 'picked' && s.ran ? s.ran : SG.audienceLabel(s.audience) + ' · ' + SG.cadenceLabel(s.cadence)}
        </span>
      </div>
      {d ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', paddingTop: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{d.line}</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>{d.why}</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>{d.offer}</span>
          {d.offerAudience ? (
            <button className="press" onClick={() => onResend(s, d.offerAudience)} style={{ alignSelf: 'flex-start', marginTop: 2, padding: '9px 15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800 }}>
              Send it for {SG.audienceLabel(d.offerAudience)}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── the paid door's instruments (PAID-PLAN artboard A)
const sgPlace = () => { const me = (window.IS_DATA || {}).me || {}; return { city: (me.location || 'Oslo').split(',')[0], country: me.country || 'Norway' }; };
const sgMeName = () => ((window.IS_DATA || {}).me || {}).name || 'You';
const sgScopeLabel = (a) => (a === 'city' ? sgPlace().city : a === 'country' ? sgPlace().country : 'everyone');
const sgScopePrice = (a) => { const P = window.WF_PAID.PRICE; return a === 'city' ? P.city : a === 'country' ? P.country : P.world; };
const sgDimCount = (a, age) => ((a === 'city' || a === 'country') ? 1 : 0) + (age ? 1 : 0);
const sgDimsLabel = (a, age, topic) => { const d = []; if (a === 'city') d.push('City: ' + sgPlace().city); if (a === 'country') d.push('Country: ' + sgPlace().country); if (age) d.push('Age: 25–34'); if (topic) d.push('Topic: ' + topic); return d.join(' · '); };
const sgWhyLine = (buyer, a, age, topic) => { const d = []; if (a === 'city') d.push(sgPlace().city); if (a === 'country') d.push(sgPlace().country); if (age) d.push('25–34'); if (topic) d.push(topic); return d.length ? buyer + ' asked for ' + d.join(' · ') + ', and your profile says that.' : buyer + ' asked everyone — nothing about you decided this.'; };
const sgFmtN = (n) => n.toLocaleString('en-US').replace(/,/g, ' ');

// ── demand on the one daily slot, per cohort: the next 14 days as ticks
// (booked vs open), the first open day marked. Mocked here; the real board is
// computed from the booking ledger.
const SG_DEMAND = {
  city: { word: 'quiet', tone: 'var(--ink-3)', booked: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], nextOpen: 'tomorrow' },
  country: { word: 'steady', tone: 'var(--ochre-ink)', booked: [1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0], nextOpen: 'Wed 26 Aug' },
  world: { word: 'contested', tone: 'var(--accent-ink)', booked: [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], nextOpen: '12 Sep' },
};

function SgRateRow({ scope, name, note, onPick }) {
  const P = window.WF_PAID;
  const M = P.MARKET;
  const d = SG_DEMAND[scope];
  const nBooked = d.booked.filter(Boolean).length;
  const firstOpen = d.booked.indexOf(0);
  return (
    <button className="card press" onClick={onPick} style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 15px 14px', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--ink)' }}>{name}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{note}</span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{P.fmt(M.rate(scope))}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>/ answer</span>
      </div>
      <div aria-label={nBooked + ' of the next 14 days booked'} style={{ display: 'flex', gap: 2.5 }}>
        {d.booked.map((b, i) => (
          <span key={i} aria-hidden="true" style={{ flex: 1, height: 7, borderRadius: 2, background: i === firstOpen ? 'var(--accent)' : b ? 'color-mix(in oklch, var(--ink) 72%, var(--surface-3))' : 'var(--surface-3)' }}></span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: d.tone }}>{d.word}</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{nBooked} of 14 days booked · ×{M.idx[scope]} today</span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 750, color: 'var(--accent-ink)' }}>next open {d.nextOpen}</span>
      </div>
    </button>
  );
}

function SgRateBoard({ onPick }) {
  const P = window.WF_PAID;
  const [, bump] = useSgState(0);
  React.useEffect(() => { const f = () => bump((x) => x + 1); window.addEventListener('is-currency', f); return () => window.removeEventListener('is-currency', f); }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 2px' }}>
        <span style={sgLabel}>the rate card · today</span>
        <span style={{ flex: 1 }}></span>
        {window.CurSwitch ? <window.CurSwitch /> : <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>prices are public</span>}
      </div>
      <SgRateRow scope="city" name={sgPlace().city} note="one paid slot a day" onPick={() => onPick('city')}></SgRateRow>
      <SgRateRow scope="country" name={sgPlace().country} note="one paid slot a day" onPick={() => onPick('country')}></SgRateRow>
      <SgRateRow scope="world" name="Everyone" note="one paid slot a day" onPick={() => onPick('world')}></SgRateRow>
      <div style={{ margin: '0 2px', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
        The line is {P.fmt(P.MARKET.base)} × the cohort's demand index — sold ÷ available person-days, recomputed daily, floored ×0.9 and ceilinged ×2.5. The line you lock at booking is the line you keep; billed per answer, capped at {P.fmt(P.PRICE.capEur)}.
      </div>
    </div>
  );
}

function SgDoorChip({ on, label, onTap }) {
  return (
    <button className="press" onClick={onTap} aria-pressed={on} style={{
      padding: '6px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
      border: on ? '0.5px solid var(--ink)' : '0.5px solid var(--rule)',
      background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--ink-2)',
      fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
      transition: 'background .16s, color .16s, border-color .16s',
    }}>{label}</button>
  );
}

// the scope ruler — city · country · world as the app's graduated-tick
// instrument, price riding the same axis: picking scope IS reading the price
function SgScopeRuler({ value, onPick }) {
  const P = window.WF_PAID;
  const M = P.MARKET;
  const stops = [['city', sgScopeLabel('city'), M.rate('city'), 9, 9], ['country', sgScopeLabel('country'), M.rate('country'), 50, 12], ['world', 'Everyone', M.rate('world'), 91, 15]];
  const active = value === 'city' || value === 'country' ? value : 'world';
  const minor = Array.from({ length: 25 }, (_, i) => ({ x: 9 + i * (82 / 24), h: 4 }));
  return (
    <div style={{ position: 'relative', height: 62, marginTop: 8 }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 4, right: 4, top: 20, height: 1, background: 'var(--rule)' }}></div>
      {minor.map((t, i) => <span key={i} aria-hidden="true" style={{ position: 'absolute', left: t.x + '%', top: 20 - t.h, width: 1, height: t.h, borderRadius: 99, background: 'color-mix(in oklch, var(--ink-3), transparent 60%)' }}></span>)}
      {stops.map(([id, label, price, x, h]) => {
        const on = id === active;
        const th = on ? 14 : 10;
        return (
          <button key={id} className="press" onClick={() => onPick(id)} aria-pressed={on} style={{ position: 'absolute', left: x + '%', top: 0, transform: 'translateX(-50%)', width: 64, height: 62, border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: 20 - th, transform: 'translateX(-50%)', width: on ? 3 : 1.5, height: th, borderRadius: 99, background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--ink-3), transparent 40%)' }}></span>
            <span style={{ position: 'absolute', left: '50%', top: 26, transform: 'translateX(-50%)', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 600, letterSpacing: '-0.01em', color: on ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ position: 'absolute', left: '50%', top: 43, transform: 'translateX(-50%)', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: on ? 800 : 650, color: on ? 'var(--accent-ink)' : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{P.fmt(price)}</span>
          </button>
        );
      })}
    </div>
  );
}

const sgInput = {
  width: '100%', boxSizing: 'border-box', fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 600, color: 'var(--ink)',
  background: 'var(--surface)', border: '0.5px solid var(--rule)', borderRadius: 12, padding: '12px 13px', outline: 'none',
};

// ── the composer IS the paid flow: question → shape → place & window → price
// → contract. Money buys the place and the window, never the review and never
// the frame. (PAID-PLAN artboard A.)
function SgForm({ SG, initialAudience, onDone, onCancel }) {
  const [prompt, setPrompt] = useSgState('');
  const [type, setType] = useSgState('binary');
  const [opts, setOpts] = useSgState(['', '']);
  const [topicId, setTopicId] = useSgState(null);
  const [cadence, setCadence] = useSgState('once');
  const [audience, setAudience] = useSgState(initialAudience || 'world');
  const [wearName, setWearName] = useSgState(true);
  const [ageDim, setAgeDim] = useSgState(false);
  const [topicDim, setTopicDim] = useSgState(false);
  const [paidStep, setPaidStep] = useSgState('form');
  const [, curBump] = useSgState(0);
  React.useEffect(() => { const f = () => curBump((x) => x + 1); window.addEventListener('is-currency', f); return () => window.removeEventListener('is-currency', f); }, []);
  const topics = window.WORLD_TOPICS || [];
  const topic = topics.find((t) => t.id === topicId) || null;
  const hue = topic ? parseFloat((topic.color.match(/([\d.]+)\)/) || [])[1]) : 282;
  const topicCol = topic ? topic.color : sgHueCol(hue);
  const needOpts = type === 'binary' || type === 'choice' || type === 'dilemma';
  const chooseType = (t) => { setType(t); const n = t === 'binary' ? 2 : t === 'dilemma' ? 3 : 4; setOpts(Array.from({ length: n }, (_, i) => opts[i] || '')); };
  const setOpt = (i, v) => setOpts((o) => o.map((x, j) => (j === i ? v : x)));
  const filled = opts.filter((o) => o.trim());
  const valid = prompt.trim() && (!needOpts || filled.length >= 2);
  const M = window.WF_PAID.MARKET;
  const scopeKey = audience === 'city' || audience === 'country' ? audience : 'world';
  const hasTopicDim = topicDim && !!topic;
  const expDay = M.expected(scopeKey, { age: ageDim, topic: hasTopicDim });
  const floorOk = M.clearsFloor(expDay);
  const parentLabel = scopeKey === 'city' ? sgScopeLabel('country') : 'everyone';
  const submit = () => { if (!valid) return; SG.submit({ prompt, type, options: needOpts ? opts : [], topic: topic ? topic.label : '', hue, cadence, audience, featured: true }); onDone(); };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
        <div style={sgLabel}>your question</div>
        <span style={{ flex: 1 }}></span>
        <button onClick={onCancel} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Cancel</button>
      </div>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Sunrise or sunset?" autoFocus autoComplete="off" autoCapitalize="sentences" enterKeyHint="done" style={sgInput}></input>

      <div style={{ ...sgLabel, margin: '14px 0 7px' }}>hints · the review decides</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SG_TYPES.map(([id, lab]) => {
          const on = type === id;
          return (
            <button key={id} onClick={() => chooseType(id)} aria-pressed={on} style={{
              flex: '1 1 auto', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
              border: on ? '0.5px solid var(--ink)' : '0.5px solid var(--rule)',
              background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--ink-2)',
              fontFamily: 'var(--sans)', fontSize: 12, fontWeight: on ? 750 : 600, whiteSpace: 'nowrap',
              transition: 'background .16s, color .16s, border-color .16s',
            }}>{lab}</button>
          );
        })}
      </div>

      {needOpts ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
          {opts.map((o, i) => (
            <input key={i} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={'Option ' + (i + 1) + (i > 1 ? ' (optional)' : '')} style={{ ...sgInput, fontSize: 14, padding: '10px 13px' }}></input>
          ))}
        </div>
      ) : null}

      <div style={{ ...sgLabel, margin: '14px 0 7px' }}>topic · optional</div>
      <div className="h-scroll" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', margin: '0 -16px', padding: '2px 16px' }}>
        {topics.map((t) => {
          const on = topicId === t.id;
          return (
            <button key={t.id} onClick={() => setTopicId(on ? null : t.id)} aria-pressed={on} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              WebkitAppearance: 'none', appearance: 'none', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: on ? 750 : 600,
              border: '0.5px solid ' + (on ? 'color-mix(in oklch, ' + t.color + ' 55%, var(--rule))' : 'var(--rule)'),
              background: on ? 'color-mix(in oklch, ' + t.color + ' 10%, var(--surface))' : 'var(--surface)',
              color: on ? 'color-mix(in oklch, ' + t.color + ' 75%, var(--ink))' : 'var(--ink-3)',
              transition: 'background .16s, color .16s, border-color .16s',
            }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, opacity: on ? 1 : 0.55 }}></span>
              {t.label.toLowerCase()}
            </button>
          );
        })}
      </div>

      {prompt.trim() ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...sgLabel, marginBottom: 7 }}>preview</div>
          <div style={{ border: '1px solid color-mix(in oklch, ' + topicCol + ' 26%, var(--rule))', borderRadius: 16, background: 'var(--surface)', padding: '14px 14px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: topicCol, flexShrink: 0 }}></span>
              <span style={sgLabel}>today{topic ? ' · ' + topic.label : ''}</span>
            </div>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 21, lineHeight: 1.12, letterSpacing: '-0.5px', textWrap: 'pretty', margin: '9px 0 11px' }}>{prompt}</div>
            {needOpts ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(filled.length ? filled : ['Option 1', 'Option 2']).map((o, i, arr) => {
                  const oc = sgOptCol(topicCol, i, arr.length);
                  return (
                    <div key={i} style={{ background: 'color-mix(in oklch, ' + oc + ' 12%, var(--surface))', border: '1.5px solid color-mix(in oklch, ' + oc + ' 55%, var(--rule))', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'center', opacity: filled.length ? 1 : 0.45 }}>
                      <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: oc }}></span>
                      <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{o}</span>
                    </div>
                  );
                })}
              </div>
            ) : <SgPreview s={{ type, hue }}></SgPreview>}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', paddingTop: 13 }}>
        {paidStep === 'contract' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ border: '0.5px solid var(--rule)', borderRadius: 12, background: 'var(--surface-2)', padding: '2px 12px' }}>
              {[['Scope', sgScopeLabel(audience)], ['Window', 'from ' + SG_DEMAND[scopeKey].nextOpen + ' · 29 days'], ['Audience', sgDimsLabel(audience, ageDim, hasTopicDim ? topic.label.toLowerCase() : null) || 'everyone — untagged'], ['Person-days', '≈ ' + sgFmtN(Math.round(expDay / 0.2) * 29) + ' · unsold at booking'], ['Rate', window.WF_PAID.fmt(M.rate(scopeKey)) + ' per answer · ×' + M.idx[scopeKey] + ' · locked'], ['Estimate', '≈ ' + sgFmtN(expDay * 29) + ' answers'], ['Your cap', window.WF_PAID.fmt(window.WF_PAID.PRICE.capEur) + ' — billing stops there']].map((r, i, arr) => (
                <div key={r[0]} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' : 'none' }}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>{r[0]}</span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 750, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{r[1]}</span>
                </div>
              ))}
            </div>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>Locked rate · the claim never shrinks · under 80% of the estimate at close, the window extends free until it's met.</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 750, color: 'var(--ink)' }}>Arranged directly for now — no self-serve yet.</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>We reply within a day with the contract, at the published rate-card line.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="press" onClick={submit} disabled={!valid} style={{ flex: 1, minHeight: 44, borderRadius: 999, cursor: valid ? 'pointer' : 'default', WebkitAppearance: 'none', border: 'none', background: valid ? 'var(--ink)' : 'var(--surface-3)', color: valid ? 'var(--surface)' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800 }}>Write to us →</button>
              <button className="press" onClick={() => setPaidStep('form')} style={{ border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Keep the draft</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={sgLabel}>scope — who gets asked</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>posted per answer · moves daily</span>
              </div>
              <SgScopeRuler value={audience} onPick={setAudience}></SgScopeRuler>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={sgLabel}>audience · combine freely</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>every dim is printed on the card</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                <SgDoorChip on={audience === 'city'} label={'City: ' + sgPlace().city} onTap={() => setAudience(audience === 'city' ? 'world' : 'city')}></SgDoorChip>
                <SgDoorChip on={audience === 'country'} label={'Country: ' + sgPlace().country} onTap={() => setAudience(audience === 'country' ? 'world' : 'country')}></SgDoorChip>
                <SgDoorChip on={ageDim} label="Age: 25–34" onTap={() => setAgeDim(!ageDim)}></SgDoorChip>
                {topic ? <SgDoorChip on={hasTopicDim} label={'Topic: ' + topic.label.toLowerCase()} onTap={() => setTopicDim(!topicDim)}></SgDoorChip> : null}
              </div>
              <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 650, color: floorOk ? 'var(--ink-3)' : 'var(--accent-ink)', lineHeight: 1.45 }}>
                {floorOk ? '≈ ' + sgFmtN(expDay) + ' answers a day · clears the 500-a-week floor' : 'under the 500-a-week floor — sold as ' + parentLabel + ', your dims still printed'}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={sgLabel}>window</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>first open day: {SG_DEMAND[audience === 'city' || audience === 'country' ? audience : 'world'].nextOpen}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                <SgDoorChip on={true} label="29 days" onTap={() => {}}></SgDoorChip>
                <SgDoorChip on={cadence === 'daily'} label="ask it daily" onTap={() => setCadence(cadence === 'daily' ? 'once' : 'daily')}></SgDoorChip>
                <SgDoorChip on={wearName} label="wear your name" onTap={() => setWearName(!wearName)}></SgDoorChip>
              </div>
            </div>
            <div style={{ border: '1px solid color-mix(in oklch, var(--ink) 22%, var(--rule))', borderRadius: 14, background: 'var(--surface-2)', padding: '11px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={sgLabel}>what everyone sees</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>position 6 · rotates by day</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: 'var(--surface)', borderRadius: 999, padding: '4px 11px', marginTop: 9, maxWidth: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', flexShrink: 0 }}>PAID</span>
                {wearName ? <span aria-hidden="true" style={{ width: 1, height: 12, background: 'color-mix(in oklch, var(--surface) 42%, transparent)', flexShrink: 0 }}></span> : null}
                {wearName ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sgMeName()}</span> : null}
                <span aria-hidden="true" style={{ width: 1, height: 12, background: 'color-mix(in oklch, var(--surface) 42%, transparent)', flexShrink: 0 }}></span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, opacity: 0.72, whiteSpace: 'nowrap', flexShrink: 0 }}>29 days</span>
              </div>
              <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>{sgWhyLine(wearName ? sgMeName() : 'The buyer', audience, ageDim, hasTopicDim ? topic.label.toLowerCase() : null)}</div>
              <div style={{ marginTop: 3, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 650, color: 'var(--ink-2)', lineHeight: 1.45 }}>They get the same public numbers you do. There is no private cut.</div>
              {prompt.trim() ? <div style={{ marginTop: 8, fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.2, textWrap: 'pretty' }}>{prompt}</div> : null}
              {prompt.trim() && needOpts ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(filled.length ? filled : ['Option 1', 'Option 2']).map((o, i, arr) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '0.5px solid var(--rule)', borderRadius: 999, padding: '4px 11px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink-2)', opacity: filled.length ? 1 : 0.45 }}>
                      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: sgOptCol(topicCol, i, arr.length) }}></span>{o}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{window.WF_PAID.fmt(M.rate(scopeKey))} / answer</span>
                  <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 600, color: 'var(--ink-3)' }}>×{M.idx[scopeKey]} · locked at booking</span>
                </span>
                <span style={{ flex: 1 }}></span>
                {window.CurSwitch ? <window.CurSwitch /> : null}
              </div>
              <button className="press" onClick={() => { if (valid) setPaidStep('contract'); }} disabled={!valid} style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: valid ? 'pointer' : 'default', WebkitAppearance: 'none', border: '1px solid var(--ink)', background: valid ? 'var(--surface)' : 'var(--surface-3)', color: valid ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
                Price it for {sgScopeLabel(audience)} →
              </button>
            </div>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty', marginTop: -4 }}>You get the same public numbers everyone reads — there is no private cut. Money buys the place and the window, never the review. The card always says PAID.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestOverlay({ onClose }) {
  const SG = useSuggestions();
  const [formOpen, setFormOpen] = useSgState(false);
  const [formAud, setFormAud] = useSgState('world');
  const c = SG.counts();
  const mine = SG.all().filter((s) => s.mine).sort((a, b) => a.days - b.days);
  return (
    <div className="overlay">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">ask a <em>question</em></div>
        <span style={{ width: 32, flexShrink: 0 }}></span>
      </div>
      <div className="app-body" style={{ paddingBottom: 44 }}>
        {formOpen ? (
          <SgForm SG={SG} initialAudience={formAud} onDone={() => setFormOpen(false)} onCancel={() => setFormOpen(false)}></SgForm>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <button className="press" onClick={() => { setFormAud('world'); setFormOpen(true); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none',
                background: 'var(--accent)', border: 'none', boxShadow: 'var(--shadow-card)',
                color: '#fff', fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.2px',
              }}>+ Ask a question</button>
              <div style={{ marginTop: 9, textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>
                One paid slot a day, each place — reviewed, and the card always says PAID.
              </div>
            </div>
            <SgRateBoard onPick={(scope) => { setFormAud(scope); setFormOpen(true); }}></SgRateBoard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...sgLabel, margin: '0 2px' }}>yours{c.mine ? ' · ' + c.mine : ''}</div>
              {mine.map((x) => (
                <SgMine key={x.id} s={x} SG={SG} onResend={(s, aud) => { SG.submit({ prompt: s.prompt, type: s.type, options: s.options || [], hue: s.hue, cadence: s.cadence, audience: aud, featured: true }); }}></SgMine>
              ))}
              {mine.length === 0 && (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '18px 0' }}>
                  Nothing from you yet — ask one above.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SuggestOverlay, useSuggestions });
