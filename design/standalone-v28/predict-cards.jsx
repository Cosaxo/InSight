// predict-cards.jsx — the two prediction bodies for the World feed.
// The clock is the mechanic, so it is the loudest thing on the card: one line
// that drains, and a numeral only in the last three seconds, when it stops
// being decoration and starts being pressure.
(function () {
  const { useState, useEffect, useRef } = React;
  const CLOCK = 10000;
  const GOOD = 'var(--c-likeness)';
  const MISS = 'var(--ochre)';
  const LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';
  const started = new Map();   // survives re-render; a card's clock starts once

  // starts when the card is actually in front of you, not when it mounts —
  // otherwise scrolling past burns the ten seconds you never saw.
  // The drain itself is a CSS transition, not a frame loop: a hairline emptying
  // over ten seconds does not need sixty React renders a second, and a feed this
  // long cannot afford them.
  function useClock(id, live, onExpire) {
    const ref = useRef(null);
    const [seen, setSeen] = useState(() => started.has(id));
    const [left, setLeft] = useState(null);   // only set for the last three seconds
    const fire = useRef(onExpire);
    fire.current = onExpire;
    useEffect(() => {
      if (!live || seen) return;
      const el = ref.current;
      if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
      // arm only after the card has HELD the viewport for a beat — scrolling
      // past at half-visible must not burn the clock of a question never faced
      let t = null;
      const io = new IntersectionObserver((es) => { es.forEach((e) => {
        if (e.intersectionRatio >= 0.85) { if (t == null) t = setTimeout(() => { setSeen(true); io.disconnect(); }, 550); }
        else { clearTimeout(t); t = null; }
      }); }, { threshold: [0.5, 0.85] });
      io.observe(el);
      return () => { clearTimeout(t); io.disconnect(); };
    }, [live, seen]);
    useEffect(() => {
      if (!live || !seen) return;
      if (!started.has(id)) started.set(id, Date.now());
      const rest = Math.max(0, CLOCK - (Date.now() - started.get(id)));
      const ts = [];
      ts.push(setTimeout(() => fire.current(), rest));
      const count = () => { const l = Math.max(0, CLOCK - (Date.now() - started.get(id))); setLeft(l); if (l > 0) ts.push(setTimeout(count, 1000)); };
      ts.push(setTimeout(count, Math.max(0, rest - 3000)));
      return () => ts.forEach(clearTimeout);
    }, [live, seen, id]);
    return { ref, left, rest: started.has(id) ? Math.max(0, CLOCK - (Date.now() - started.get(id))) : CLOCK, running: live && seen };
  }

  function Clock({ left, rest, running, color, big }) {
    const bar = useRef(null);
    useEffect(() => {
      const el = bar.current;
      if (!el || !running) return;
      el.style.transition = 'none';
      el.style.width = ((rest / CLOCK) * 100) + '%';
      const r = requestAnimationFrame(() => {
        el.style.transition = 'width ' + rest + 'ms linear';
        el.style.width = '0%';
      });
      return () => cancelAnimationFrame(r);
    }, [running]);
    const last = left != null && left <= 3000 && left > 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: big ? 34 : 26 }}>
        <span style={{ flex: 1, height: 3, borderRadius: 2, background: window.WPAL.wash(color, 14, 'var(--surface-2)'), overflow: 'hidden' }}>
          <span ref={bar} style={{ display: 'block', height: '100%', width: '100%', background: last ? MISS : color, transition: 'background .3s' }}></span>
        </span>
        {last && (
          <span style={{ fontFamily: 'var(--sans)', fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: big ? 30 : 23, letterSpacing: '-0.03em', color: MISS, lineHeight: 1 }}>{Math.ceil(left / 1000)}</span>
        )}
      </div>
    );
  }

  function Choice({ options, color, big, onPick }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 11 : 8 }}>
        {options.map((o, i) => (
          <button key={i} className="press" onClick={() => onPick(i)} style={{ border: '1px solid color-mix(in oklch, ' + color + ' 45%, var(--rule))', borderRadius: big ? 16 : 12, background: window.WPAL.wash(color, 10), padding: big ? '15px 16px' : '11px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: big ? 16.5 : 14, color: 'var(--ink)', WebkitAppearance: 'none' }}>{o.label}</button>
        ))}
      </div>
    );
  }

  // one split, drawn as a bar — used for the group's answer and, hairline
  // beneath it, for everyone's, so the seam between them is the story
  function Split({ q, ps, color, label, h, mine, faint }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11.5, color: faint ? 'var(--ink-3)' : 'var(--ink-2)' }}>{label}</span>
        <span style={{ display: 'flex', height: h, borderRadius: 8, overflow: 'hidden' }}>
          {ps.map((p, i) => (
            <span key={i} style={{ width: p + '%', boxSizing: 'border-box', background: faint ? window.WPAL.wash(window.WPAL.opt(color, i, 2), 34, 'var(--surface-2)') : window.WPAL.opt(color, i, 2), display: 'flex', alignItems: 'center', justifyContent: i ? 'flex-end' : 'flex-start', padding: '0 10px', gap: 6, color: faint ? 'var(--ink-2)' : '#fff', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: h > 26 ? 13 : 11, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {p >= 26 ? (h > 26 ? q.options[i].label : p + '%') : ''}
              {mine === i && h > 26 && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', flexShrink: 0 }}></span>}
            </span>
          ))}
        </span>
      </div>
    );
  }

  function Verdict({ ok, text }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: ok ? GOOD : 'transparent', border: ok ? 'none' : '1.5px solid ' + MISS }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, color: ok ? 'var(--ink)' : MISS }}>{text}</span>
      </div>
    );
  }

  // ── a call on the world: sealed now, scored when it resolves ──────────────
  function PredictBody({ q, T, big, mine, onCall }) {
    const settled = q.days < 0;
    const my = settled && mine == null ? q.you : mine;
    const live = !settled && my == null;
    const clock = useClock(q.id, live, () => onCall(-1));
    const counts = q.options.map((o) => o.count);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const ps = counts.map((c) => Math.round((c / total) * 100));
    ps[ps.indexOf(Math.max(...ps))] += 100 - ps.reduce((a, b) => a + b, 0);
    const quiet = { fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' };

    if (live) return (
      <div ref={clock.ref} style={{ display: 'flex', flexDirection: 'column', gap: big ? 13 : 10 }}>
        <Clock left={clock.left} rest={clock.rest} running={clock.running} color={T.color} big={big}></Clock>
        <Choice options={q.options} color={T.color} big={big} onPick={onCall}></Choice>
      </div>
    );
    if (my === -1) return <div style={{ ...quiet, padding: '6px 0' }}>Ran out of clock — this one closed.</div>;
    if (settled && my != null) {
      const ok = my === q.out;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Split q={q} ps={ps} color={T.color} label={'It landed \u00b7 ' + q.options[q.out].label} h={big ? 34 : 30} mine={my}></Split>
          <Verdict ok={ok} text={ok ? 'You called it' : 'You said ' + q.options[my].label}></Verdict>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ border: '1.5px solid ' + window.WPAL.wash(T.color, 55, 'var(--rule)'), borderRadius: big ? 16 : 13, background: window.WPAL.wash(T.color, 12), padding: big ? '15px 16px' : '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 17 : 15, flex: 1 }}>{q.options[my].label}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)' }}>sealed</span>
        </div>
        <Split q={q} ps={ps} color={T.color} label="Everyone" h={20} faint={true}></Split>
        <span style={quiet}>Resolves in {q.days} day{q.days === 1 ? '' : 's'}</span>
      </div>
    );
  }

  // ── a read of one slice of the world: scored the second you call it ───────
  function ReadBody({ q, T, big, mine, onCall }) {
    const live = mine == null;
    const clock = useClock(q.id, live, () => onCall(-1));
    const P = window.PREDICT;
    const gp = P.pcts(q);
    const truth = gp.indexOf(Math.max(...gp));
    const counts = q.options.map((o) => o.count);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const op = counts.map((c) => Math.round((c / total) * 100));
    op[op.indexOf(Math.max(...op))] += 100 - op.reduce((a, b) => a + b, 0);
    const hue = 'oklch(0.52 0.14 ' + (P.hueOf('r:' + q.dim) || 300) + ')';
    const chip = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', background: window.WPAL.wash(window.WPAL.c(hue), 16, 'var(--surface-2)'), border: '1px solid ' + window.WPAL.wash(window.WPAL.c(hue), 42, 'var(--rule)'), borderRadius: 999, padding: big ? '6px 14px' : '5px 12px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: window.WPAL.c(hue) }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: big ? 14 : 12.5, color: 'var(--ink-3)' }}>{q.dimLabel}</span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 15 : 13, color: 'var(--ink)' }}>{q.group}</span>
      </span>
    );
    if (live) return (
      <div ref={clock.ref} style={{ display: 'flex', flexDirection: 'column', gap: big ? 13 : 10 }}>
        {chip}
        <Clock left={clock.left} rest={clock.rest} running={clock.running} color={T.color} big={big}></Clock>
        <Choice options={q.options} color={T.color} big={big} onPick={onCall}></Choice>
      </div>
    );
    if (mine === -1) return <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', padding: '6px 0' }}>Ran out of clock — this one closed.</div>;
    const ok = mine === truth;
    const run = P.run('r:' + q.dim);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Split q={q} ps={gp} color={T.color} label={q.dimLabel + ' \u00b7 ' + q.group} h={big ? 34 : 30} mine={mine}></Split>
        <Split q={q} ps={op} color={T.color} label="Everyone" h={20} faint={true}></Split>
        <Verdict ok={ok} text={ok ? 'You read them right' : 'They went ' + q.options[truth].label}></Verdict>
        {run && run.n >= 6 && (
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>
            You read {P.phrase(q.dim)} better than {run.pct}% of people
          </span>
        )}
      </div>
    );
  }

  Object.assign(window, { PredictBody, ReadBody, PredictClock: Clock });
})();
