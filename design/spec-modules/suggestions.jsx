// suggestions.jsx — "Suggest a question": community board + composer (overlay).
// Propose a question, upvote others; the top, once reviewed, become Dailies.
// Speaks the app's current voice: sans, oklch hue family, no mono micro-labels.
const { useState: useSgState } = React;

function useSuggestions() {
  const [, bump] = useSgState(0);
  React.useEffect(() => window.SUGGESTIONS.subscribe(() => bump((x) => x + 1)), []);
  return window.SUGGESTIONS;
}

const sgHueCol = (hue) => 'oklch(0.55 0.14 ' + (hue != null ? hue : 40) + ')';
// same side-hue rotation the daily uses — the preview feels like the real thing
const sgOptCol = (tc, i, n) => (i === 0 ? tc : 'oklch(from ' + tc + ' 0.55 0.14 calc(h + ' + Math.round(i * (n > 2 ? 120 : 150)) + '))');
const sgLabel = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' };

// answer-shape mark: 2 dots = this-or-that, 3 = dilemma/choice, line = scale.
// Carries the type without a word of label.
function SgMark({ type, col }) {
  if (type === 'scale' || type === 'rating') return <span aria-hidden="true" style={{ display: 'block', width: 15, height: 3.5, borderRadius: 999, background: 'linear-gradient(to right, ' + col + ', color-mix(in oklch, ' + col + ' 22%, var(--surface-3)))' }}></span>;
  const n = type === 'binary' ? 2 : 3;
  return <span aria-hidden="true" style={{ display: 'flex', gap: 3 }}>{Array.from({ length: n }).map((_, i) => <span key={i} style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: col, opacity: 1 - i * 0.26 }}></span>)}</span>;
}

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
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', lineHeight: 1, color: 'color-mix(in oklch, ' + col + ' 82%, var(--ink))', background: 'color-mix(in oklch, ' + col + ' 10%, transparent)', border: '0.5px solid color-mix(in oklch, ' + col + ' 30%, var(--rule))', borderRadius: 999, padding: '4px 8px 3px' }}>{label}</span>;
}

// Board card — the question is the only prose. Support reads as the length of
// the fill line along the card's bottom edge; type as the mark; state as a tag.
function SgCard({ s, SG, max }) {
  const col = sgHueCol(s.hue);
  const picked = s.status === 'picked';
  const opts = (s.options || []).filter(Boolean);
  // skip the option chips when the prompt already names the sides ("X or Y?")
  const showOpts = opts.length >= 3 && !/ or /i.test(s.prompt);
  const frac = Math.max(0.07, Math.min(1, s.liveVotes / (max || 1)));
  const meta = picked || s.mine;
  return (
    <div className="card" style={{ padding: '14px 15px 15px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ paddingTop: 7, flexShrink: 0 }}><SgMark type={s.type} col={col}></SgMark></span>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 16.5, lineHeight: 1.26, letterSpacing: '-0.32px', textWrap: 'pretty', color: 'var(--ink)' }}>{s.prompt}</div>
        <button className="press" onClick={() => SG.toggleVote(s.id)} aria-pressed={s.voted} aria-label={'Upvote — ' + s.liveVotes + ' votes'} style={{
          flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          width: 46, minHeight: 46, borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', fontFamily: 'var(--sans)',
          border: s.voted ? '1px solid color-mix(in oklch, var(--accent) 55%, var(--rule))' : '1px solid var(--rule)',
          background: s.voted ? 'color-mix(in oklch, var(--accent) 11%, var(--surface-2))' : 'var(--surface)',
          color: s.voted ? 'var(--accent)' : 'var(--ink-2)',
          transition: 'background .18s, color .18s, border-color .18s',
        }}>
          <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" style={{ display: 'block', opacity: s.voted ? 1 : 0.5 }}><path d="M5 0 10 6 0 6Z" fill="currentColor"></path></svg>
          <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>{s.liveVotes >= 1000 ? (s.liveVotes / 1000).toFixed(1) + 'k' : s.liveVotes}</span>
        </button>
      </div>
      {showOpts || meta ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginLeft: 27 }}>
          {picked ? <SgTag label="daily" col="var(--c-city)"></SgTag> : null}
          {s.mine ? <SgTag label="yours" col="var(--accent)"></SgTag> : null}
          {showOpts ? opts.map((o, i) => (
            <span key={i} style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink-2)', background: 'color-mix(in oklch, ' + sgOptCol(col, i, opts.length) + ' 8%, var(--surface))', border: '0.5px solid color-mix(in oklch, ' + sgOptCol(col, i, opts.length) + ' 30%, var(--rule))', borderRadius: 999, padding: '3px 10px' }}>{o}</span>
          )) : null}
        </div>
      ) : null}
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: (frac * 100) + '%', borderRadius: '0 999px 999px 0', background: picked ? col : 'color-mix(in oklch, ' + col + ' 46%, var(--surface-3))', transition: 'width .3s var(--ease-out)' }}></span>
    </div>
  );
}

const SG_TYPES = [['binary', 'this or that'], ['dilemma', 'dilemma'], ['choice', 'multiple choice'], ['scale', 'scale']];
const sgInput = {
  width: '100%', boxSizing: 'border-box', fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 600, color: 'var(--ink)',
  background: 'var(--surface)', border: '0.5px solid var(--rule)', borderRadius: 12, padding: '12px 13px', outline: 'none',
};

function SgForm({ SG, onDone, onCancel }) {
  const [prompt, setPrompt] = useSgState('');
  const [type, setType] = useSgState('binary');
  const [opts, setOpts] = useSgState(['', '']);
  const [topicId, setTopicId] = useSgState(null);
  const topics = window.WORLD_TOPICS || [];
  const topic = topics.find((t) => t.id === topicId) || null;
  const hue = topic ? parseFloat((topic.color.match(/([\d.]+)\)/) || [])[1]) : 282;
  const topicCol = topic ? topic.color : sgHueCol(hue);
  const needOpts = type === 'binary' || type === 'choice' || type === 'dilemma';
  const chooseType = (t) => { setType(t); const n = t === 'binary' ? 2 : t === 'dilemma' ? 3 : 4; setOpts(Array.from({ length: n }, (_, i) => opts[i] || '')); };
  const setOpt = (i, v) => setOpts((o) => o.map((x, j) => (j === i ? v : x)));
  const filled = opts.filter((o) => o.trim());
  const valid = prompt.trim() && (!needOpts || filled.length >= 2);
  const submit = () => { if (!valid) return; SG.submit({ prompt, type, options: needOpts ? opts : [], topic: topic ? topic.label : '', hue }); onDone(); };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ ...sgLabel, marginBottom: 7 }}>your question</div>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Sunrise or sunset?" autoFocus style={sgInput}></input>

      <div style={{ ...sgLabel, margin: '14px 0 7px' }}>format</div>
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

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={onCancel} style={{ flex: '0 0 auto', padding: '12px 16px', borderRadius: 999, cursor: 'pointer', background: 'var(--surface)', border: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>Cancel</button>
        <button className="press" onClick={submit} disabled={!valid} style={{
          flex: 1, padding: '12px 16px', borderRadius: 999, cursor: valid ? 'pointer' : 'default',
          background: valid ? 'var(--accent)' : 'var(--surface-3)', border: 'none', WebkitAppearance: 'none',
          color: valid ? '#fff' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 800,
          transition: 'background .18s, color .18s',
        }}>Submit for review</button>
      </div>
      <div style={{ marginTop: 9, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.4 }}>
        Reviewed before picking — the most-upvoted become Dailies.
      </div>
    </div>
  );
}

const SG_LENSES = [['top', 'Top'], ['new', 'New'], ['picked', 'Picked'], ['mine', 'Yours']];
function sgSort(list, lens) {
  if (lens === 'new') return [...list].sort((a, b) => a.days - b.days);
  if (lens === 'picked') return list.filter((s) => s.status === 'picked');
  if (lens === 'mine') return list.filter((s) => s.mine);
  return list; // top — already sorted by votes
}

function SuggestOverlay({ onClose }) {
  const SG = useSuggestions();
  const [formOpen, setFormOpen] = useSgState(false);
  const [lens, setLens] = useSgState('top');
  const c = SG.counts();
  const shown = sgSort(SG.all(), lens);
  const max = Math.max(1, ...SG.all().map((x) => x.liveVotes));
  return (
    <div className="overlay">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>✕</button>
        <div className="h-title">suggest a <em>question</em></div>
        <span style={{ width: 36, flexShrink: 0 }}></span>
      </div>
      <div className="app-body" style={{ paddingBottom: 44 }}>
        {formOpen ? (
          <SgForm SG={SG} onDone={() => { setFormOpen(false); setLens('mine'); }} onCancel={() => setFormOpen(false)}></SgForm>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <button className="press" onClick={() => setFormOpen(true)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none',
              background: 'var(--accent)', border: 'none', boxShadow: 'var(--shadow-card)',
              color: '#fff', fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.2px',
            }}>+ Suggest a question</button>
            <div style={{ marginTop: 9, textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>
              The most-upvoted become Dailies.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 18, margin: '0 2px 14px', borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' }}>
          {SG_LENSES.map(([id, label]) => {
            const on = lens === id;
            return (
              <button key={id} onClick={() => setLens(id)} aria-pressed={on} style={{ position: 'relative', border: 'none', background: 'none', padding: '0 0 10px', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: on ? 800 : 600, fontSize: 13, letterSpacing: '-0.1px', color: on ? 'var(--ink)' : 'var(--ink-3)', WebkitAppearance: 'none', transition: 'color .18s' }}>
                {label}{id === 'mine' && c.mine ? ' · ' + c.mine : ''}
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: -0.5, height: 2.5, borderRadius: 99, background: 'var(--accent)', opacity: on ? 1 : 0, transition: 'opacity .18s' }}></span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((x) => <SgCard key={x.id} s={x} SG={SG} max={max}></SgCard>)}
          {shown.length === 0 && (
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '30px 0' }}>
              {lens === 'mine' ? 'Nothing from you yet — suggest one above.' : 'Nothing here yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SuggestOverlay, useSuggestions });
