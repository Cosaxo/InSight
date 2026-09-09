// oracle.jsx — the Oracle lens: ONE INSTRUMENT, no card.
// The guess is an ink disc sealed on the seam between the two option tiles. On
// your tap it travels to the option it called, and each tile fills from the
// bottom to the probability the oracle gave it. So:
//   confidence = a HEIGHT (the fill) and a SIZE (the sealed disc),
//   evidence   = ink density — a cold-start guess is a faint outline,
//   the call    = a POSITION, your pick = the accent edge,
//   the verdict = the disc's glyph on landing: solid when it had you, broken
//                 open to a RING when you broke it (the scorecard vocabulary).
// No percentage is printed anywhere. One line is available on demand: press the
// landed disc for its single strongest piece of evidence, in the Map's sentence
// style; press a ledger mark to recall that question. Nothing stands.
// Your record is the LEDGER at the foot: one mark per answer — up in accent
// when you broke the guess (taller = more surprising), down as a hairline tick
// when it had you — and the new mark lands there as you watch.
// Why the fill is a keyframe and not a transition: the sealed tile is a
// <button> and the revealed one a <div>, so the fill element is NEW to the DOM
// and a transition would never run (and a rAF-armed frame does not fire in a
// backgrounded tab).
const OR_CAP_BITS = 2.6; // a mark this surprising is full height
const OR_MASS_FULL = 3.4; // evidence mass at which the disc is fully inked
const OR_MASS_GAMMA = 0.62; // compresses the per-question jitter in that ramp
const OR_LAND_MS = 780; // travel + settle, when the verdict glyph resolves
const orTopic = (cat) => (window.WORLD_TOPICS || []).find((t) => t.id === cat);
// topic hue, worn only where it carries meaning — the People/Map dot recipe
const orHue = (c) => { const m = /([\-\d.]+)\s*\)\s*$/.exec(c || ''); return m ? parseFloat(m[1]) : null; };
const orQuiet = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const orH = (bits, base, span) => base + Math.min(1, bits / OR_CAP_BITS) * span;
// how a crowd leans, in words rather than a number
const orWord = (p) => (p >= 0.78 ? 'nearly always' : p >= 0.62 ? 'mostly' : p >= 0.54 ? 'more often than not' : 'still mostly');
// the legends: three one-time lines, each shown once and never again, so the
// instrument teaches its own grammar without ever standing there explaining it
const OR_HINT_LS = 'insight.oracle.hints.v1';
const orHints = () => { try { return JSON.parse(localStorage.getItem(OR_HINT_LS) || '{}'); } catch (e) { return {}; } };
const orSeen = (k) => { try { const h = orHints(); if (h[k]) return; h[k] = 1; localStorage.setItem(OR_HINT_LS, JSON.stringify(h)); } catch (e) {} };
const OR_HINT = {
  seal: 'Its guess is sealed — a bigger disc means surer, a fainter one means less to go on.',
  reveal: 'It moved to the side it called, and each tile filled to how sure it was. Solid disc: it had you. Ring: you broke it.',
  ledger: 'Your record is below — a mark up where you broke the guess, a tick down where it had you. Press one to recall it.',
};

// the record: one mark per answer, on a single baseline. Press one to recall it.
// In `group` mode (the done state) the same marks are re-laid by topic — most
// broken subject first, hue = topic — so the strip that IS your record is also
// the reading of it. One strip, never two.
function OrLedger({ log, qOf, sel, onPick, group, topIx }) {
  let items = log.map((r, i) => ({ r, i })).slice(-30);
  const gaps = new Set();
  const mkH = (bits) => (group ? orH(bits, 13, 63) : orH(bits, 9, 31));
  if (group) {
    const cnt = new Map();
    items.forEach(({ r }) => { const q = qOf(r.q); if (!q) return; const c = cnt.get(q.cat) || { b: 0, n: 0 }; c.n++; if (r.pred !== r.mine) c.b++; cnt.set(q.cat, c); });
    const key = (x) => { const q = qOf(x.r.q); return q ? q.cat : ''; };
    items = items.slice().sort((a, b) => {
      const ka = key(a), kb = key(b); if (ka === kb) return a.i - b.i;
      const ca = cnt.get(ka) || { b: 0, n: 0 }, cb = cnt.get(kb) || { b: 0, n: 0 };
      return cb.b - ca.b || cb.n - ca.n || (ka < kb ? -1 : 1);
    });
    let prev = null;
    items.forEach((it, ix) => { const k = key(it); if (ix > 0 && k !== prev) gaps.add(ix); prev = k; });
  }
  return (
    <div className={'or-ledger' + (group ? ' is-grouped' : '')} aria-label={group
      ? 'Your record, grouped by topic — a mark up each time you broke the guess, a tick down when it had you. Press a mark to recall that question.'
      : 'Your record — a mark up each time you broke the guess, a tick down when it had you. Press a mark to recall that question.'}>
      <span className="or-base"></span>
      {items.map(({ r, i }, ix) => {
        const broke = r.pred !== r.mine, q = qOf(r.q), t = group && q ? orTopic(q.cat) : null;
        const isTop = group && i === topIx;
        return (
          <button key={i} className={'or-cell' + (sel === i ? ' is-sel' : '') + (gaps.has(ix) ? ' is-gap' : '')} onClick={() => onPick(sel === i ? null : i)}
            aria-label={q ? q.prompt + ' — it called ' + q.options[r.pred].label + (broke ? '; you said ' + q.options[r.mine].label : '; you agreed') : 'answer'}>
            <i className={'or-mk' + (broke ? '' : ' hit') + (isTop ? ' is-top' : '')}
              style={broke ? { height: mkH(r.bits), background: (isTop || sel === i) ? undefined : (t ? window.WPAL.c(t.color) : undefined) } : undefined}></i>
          </button>
        );
      })}
    </div>
  );
}

// the retrospective: the record re-laid as the reading. The strip below IS the
// per-topic breakdown (grouped, hue = topic); the sentence above names its
// tallest mark. No second axis, no rows that hold one mark.
function OrDone({ log, qOf, onReset }) {
  const [sel, setSel] = React.useState(null);
  // the record's one mark worth naming: your biggest break — or, when it read
  // you every time, the closest it came to losing you
  let topIx = -1, anyBreak = false;
  log.forEach((r) => { if (r.pred !== r.mine) anyBreak = true; });
  log.forEach((r, i) => { if ((r.pred !== r.mine) === anyBreak && (topIx < 0 || r.bits > log[topIx].bits)) topIx = i; });
  const top = topIx >= 0 ? log[topIx] : null, tq = top && qOf(top.q);
  const rc = sel != null ? log[sel] : null, rq = rc && qOf(rc.q);
  return (
    <div className="or-lens">
      <div className="or-done fade-in">
        {tq && (
          <div className="or-bigtx">
            <span className="pt-kick">{anyBreak ? 'biggest break' : 'closest call'}</span>
            <p className="or-bigq">{tq.prompt}</p>
            <p className="or-bigs">It called <b>{tq.options[top.pred].label}</b>. {anyBreak
              ? <>You said <b>{tq.options[top.mine].label}</b>.</>
              : <>You did too — as you did every time.</>}</p>
          </div>
        )}
        <OrLedger log={log} qOf={qOf} sel={sel} onPick={setSel} group={true} topIx={topIx}></OrLedger>        <div className="or-slot">{rc && rq && (
          <div className="or-aside">{'\u201c' + rq.prompt + '\u201d'} — it called <b>{rq.options[rc.pred].label}</b>. {rc.pred === rc.mine ? 'You did too.' : <>You said <b>{rq.options[rc.mine].label}</b>.</>}</div>
        )}</div>
      </div>
      <div className="or-foot"><button className="or-next" onClick={onReset}>Start over</button></div>
    </div>
  );
}

function OracleLens({ onUse }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.PAT.sub(force), []);
  const [rec, setRec] = React.useState(null); // the reveal, held until you move on
  const [landed, setLanded] = React.useState(false); // the verdict has resolved
  const [why, setWhy] = React.useState(false);
  const [sel, setSel] = React.useState(null); // a recalled ledger mark
  const [hints, setHints] = React.useState(orHints);
  const Q = window.PAT.qs();
  const qOf = (id) => Q.find((q) => q.id === id);
  const curQ = rec ? qOf(rec.q) : window.PAT.nextQ();
  const log = window.PAT.log();
  // the sealed reading, taken once per question so the disc does not resize
  // under you at the reveal
  const pre = React.useMemo(() => (curQ ? window.PAT.oracleFor(curQ.id) : null), [curQ && curQ.id]);
  React.useEffect(() => {
    if (!rec) { setLanded(false); return; }
    const t = setTimeout(() => { setLanded(true); if (window.HAPTIC) window.HAPTIC.tick(); }, orQuiet() ? 60 : OR_LAND_MS);
    return () => clearTimeout(t);
  }, [rec]);
  const next = () => { if (hintKey) { orSeen(hintKey); setHints(orHints()); } setRec(null); setWhy(false); setSel(null); };
  if (!curQ) return <OrDone log={log} qOf={qOf} onReset={() => window.PAT.reset()}></OrDone>;
  const t = orTopic(curQ.cat);
  const tint = t ? window.WPAL.c(t.color) : null;
  const th = t ? orHue(t.color) : null; // the called tile wears the topic's muted hue at reveal
  // the disc rides to the centre of the tile it called — exact, gap included
  const seat = (i) => (i === 0 ? 'calc((100% - var(--or-gap)) / 4)' : 'calc(100% - (100% - var(--or-gap)) / 4)');
  const brokeIt = rec && rec.pred !== rec.mine;
  const sol = Math.min(1, Math.pow(Math.max(0, pre ? pre.mass : 0) / OR_MASS_FULL, OR_MASS_GAMMA)); // 0 = guessing on nothing
  const dsty = {
    '--d': Math.round(21 + Math.min(1, Math.max(0, ((pre ? pre.conf : 0.5) - 0.5) / 0.45)) * 25) + 'px',
    '--or-ink': 'color-mix(in oklab, var(--ink), var(--surface-2) ' + Math.round((1 - sol) * 88) + '%)',
    '--or-edge': 'color-mix(in oklab, var(--ink), var(--surface-2) ' + Math.round((1 - sol) * 38) + '%)',
  };
  if (rec) dsty.left = seat(rec.pred);
  const rc = sel != null ? log[sel] : null, rq = rc && qOf(rc.q);
  const tell = why && rec && !rc ? (rec.ev || []).map((id) => window.PAT.tell(rec.q, id)).filter(Boolean)[0] : null;
  // one legend at a time, in the same slot as the on-demand lines, and only
  // until it has been read once
  const hintKey = !rec ? (hints.seal ? null : 'seal') : (!hints.reveal ? 'reveal' : !hints.ledger ? 'ledger' : null);
  const hint = hintKey && !rc && !why ? OR_HINT[hintKey] : null;
  return (
    <div className="or-lens">
      <div key={curQ.id} className="or-head fade-in">
        {t && <span className="pt-cat or-tag" style={{ background: window.WPAL.wash(tint, 16), color: window.WPAL.ink(t.color) }}>{t.label}</span>}
        <p className="or-prompt">{curQ.prompt}</p>
      </div>
      <div key={curQ.id + '-inst'} className={'or-inst' + (rec ? ' is-live' : '')} onClick={rec ? next : undefined}
        aria-label={rec ? 'It called ' + curQ.options[rec.pred].label + '; you said ' + curQ.options[rec.mine].label : 'Its guess is sealed — pick a side'}>
        {curQ.options.map((op, i) => rec ? (
          <div key={i} className={'or-tile' + (i === rec.mine ? ' is-mine' : '')}
            style={i !== rec.mine && th != null ? { '--or-fill': 'oklch(0.92 0.04 ' + th + ')', '--or-edge': 'oklch(0.56 0.09 ' + th + ')' } : undefined}>
            <span className="or-fill" style={{ '--p': Math.round((i === rec.pred ? rec.conf : 1 - rec.conf) * 100) + '%' }}></span>
            <span className="or-lab">{op.label}</span>
          </div>
        ) : (
          <button key={i} className="or-tile" onClick={() => {
            const r = window.PAT.answer(curQ.id, i);
            if (!r) return;
            if (window.HAPTIC) window.HAPTIC.tick();
            if (!hints.seal) { orSeen('seal'); setHints(orHints()); }
            setRec(r);
            if (onUse) onUse();
          }}>
            <span className="or-lab">{op.label}</span>
          </button>
        ))}
        {rec ? (
          <button className={'or-disc is-out' + (landed && brokeIt ? ' is-ring' : '') + (why ? ' is-asked' : '') + (landed && !hints.why ? ' is-hint' : '')} style={dsty}
            onClick={(e) => { e.stopPropagation(); setSel(null); setWhy(!why); if (!hints.why) { orSeen('why'); setHints(orHints()); } }}
            aria-label={why ? 'Hide the evidence' : 'Why it called ' + curQ.options[rec.pred].label}></button>
        ) : <span className="or-disc" style={dsty} aria-hidden="true"></span>}
      </div>
      {rc && rq && (
        <div className="or-aside">{'\u201c' + rq.prompt + '\u201d'} — it called <b>{rq.options[rc.pred].label}</b>. {rc.pred === rc.mine ? 'You did too.' : <>You said <b>{rq.options[rc.mine].label}</b>.</>}</div>
      )}
      {why && !rc && (
        <div className="or-aside">{tell
          ? <>People who picked <b>{tell.q.options[tell.side].label}</b> on {'\u201c' + tell.q.prompt + '\u201d'} {orWord(tell.share[rec.pred])} pick <b>{curQ.options[rec.pred].label}</b>.</>
          : <>Nothing in your answers pointed either way here.</>}</div>
      )}
      {hint && <div className="or-aside is-hint">{hint}</div>}
      <OrLedger log={log} qOf={qOf} sel={sel} onPick={(k) => { setSel(k); setWhy(false); }}></OrLedger>
      <div className="or-foot">
        {rec
          ? <button className="or-next" onClick={next}>Next</button>
          : <span className="or-sealed">sealed</span>}
      </div>
    </div>
  );
}
Object.assign(window, { OracleLens });
