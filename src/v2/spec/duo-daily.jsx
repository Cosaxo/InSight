// Ported from design/spec-modules/duo-daily.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { ReadRun, RUN_DOTS } from './read-run.jsx';
import { DUELS } from './duels-data.js';
import { RevealClock } from './reveal-clock.js';
import { Sheet } from './primitives.jsx';
import { takeDuelCue, onDuelCue } from '../data/duelCue';
import ReactDOM from 'react-dom';
import { GDAv } from './group-daily.jsx';

// duo-daily.jsx — the daily tab's 1v1 mode. A vertical stack of duels, one
// per close tie, snap-scrolling like the feed: yesterday's reveal sits quietly
// above today's question, answering morphs into guessing in place, and when a
// duel seals you just swipe down — the next person is waiting. The sticky rail
// on top shows who's left (dot) and who's done (check); tap a face to jump.
// `DuoDomains` is exported by name (D39, "convert on touch") — person-overlay
// imports it. `DuoBody` still publishes through the window bag, so the export
// is hoisted out of the IIFE rather than the IIFE unwound.
let DuoDomainsImpl;
(function () {
  const { useState, useEffect, useRef, useReducer } = React;
  const LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';
  const ACC = 'var(--c-people)';
  const ROMANCE = 'oklch(0.55 0.13 12)';
  const GOOD = 'var(--c-likeness)';
  const MISS = 'var(--ochre)';

  const col = (g) => ({ display: 'flex', flexDirection: 'column', gap: g });
  const first = (p) => p.name.split(' ')[0];
  const isPending = (p) => p.state === 'turn' || p.state === 'start';

  // Which PARTS of each other you read. One unit per domain carrying both
  // sides on a shared left edge — the interesting fact is the asymmetry, so
  // the mismatch has to be the shape you see, not something you compute.
  // Dot order is NOT chronological: across a domain it carries no meaning, so
  // filled-first clusters it into a length you can read at a glance.
  function DuoDomains({ rows, themColor, themName }) {
    // filled-first WHILE it is dots; a strip or a rate line is a timeline and
    // must stay in order, or the shape it draws is a lie
    const clust = (a) => (a.length <= RUN_DOTS ? a.slice().sort((x, y) => (y ? 1 : 0) - (x ? 1 : 0)) : a);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <span style={{ width: 88, flexShrink: 0, paddingTop: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25 }}>{r.label}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
              <ReadRun days={clust(r.read)} size={11}></ReadRun>
              <ReadRun days={clust(r.by)} color={themColor} size={11}></ReadRun>
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>
          {[['you read them', GOOD], [themName + ' reads you', themColor]].map(([t, c]) => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }}></span>{t}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── the rail: everyone at a glance — dot = waiting on you, check = done ──
  function DuoRail({ ps, cur, onPick, onAdd }) {
    return (
      <div className="h-scroll" style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '3px 6px 2px' }}>
        {ps.map((p) => {
          const invited = p.state === 'invited';
          const pending = !invited && isPending(p);
          const sel = p.id === cur;
          return (
            <button key={p.id} onClick={() => onPick(p.id)} aria-current={sel ? 'true' : undefined}
              aria-label={first(p) + ' — ' + (invited ? 'invited, waiting' : pending ? 'still to play' : 'done for today')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 7px', WebkitAppearance: 'none', flexShrink: 0 }}>
              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', padding: 2, boxShadow: sel ? `0 0 0 2px ${ACC}` : pending ? `0 0 0 1.5px color-mix(in oklch, ${ACC} 45%, transparent)` : '0 0 0 1px var(--rule)', transition: 'box-shadow .18s' }}>
                <GDAv p={p} size={38} plain></GDAv>
                {invited
                  ? <span style={{ position: 'absolute', bottom: -3, right: -3, width: 15, height: 15, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--ink-2)', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>{'\u2026'}</span>
                  : pending
                  /* only the waiting state wears a mark — a check on every tie
                     carried no information and made the rail read as noise */
                  ? <span style={{ position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: ACC, border: '2px solid var(--surface)' }}></span>
                  : null}
              </span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: sel ? 800 : 600, color: sel ? 'var(--ink)' : 'var(--ink-3)' }}>{first(p)}</span>
            </button>
          );
        })}
        {onAdd && (
          <button onClick={onAdd} aria-label="Start a new 1v1"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 7px', WebkitAppearance: 'none', flexShrink: 0 }}>
            <span style={{ width: 38, height: 38, margin: 2, borderRadius: '50%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed color-mix(in oklch, var(--ink-3) 55%, transparent)', color: 'var(--ink-2)', fontSize: 19, fontWeight: 600, lineHeight: 1 }}>+</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>New</span>
          </button>
        )}
      </div>
    );
  }

  // ── one duel card — fills the view, snaps into place ──
  function DuoCard({ p, vh, nextName, newest }) {
    const pid = p.id;
    const today = DUELS.duoDay(pid, 0);
    const m = DUELS.myDuo(pid);
    const yday = p.played >= 1 ? DUELS.duoDay(pid, 1) : null;
    const theyDone = DUELS.partnerToday(pid);
    const invited = p.state === 'invited';
    const step = m.a == null ? 'answer' : m.g == null ? 'guess' : 'done';
    const [menu, setMenu] = useState(false);
    const mode = p.mode || 'friends';
    const romantic = mode === 'romantic';
    const tint = romantic ? ROMANCE : ACC;

    // serif since 2026-09-06 (§6.3): the question is the app's voice, and the
    // 09-02 voice reaches the duel prompts last. Balance, not pretty: a duel
    // prompt is 1-3 lines and centred in its beat, where a ragged last word
    // reads as a typo.
    const prompt = (s) => (
      <div style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 27, lineHeight: 1.14, letterSpacing: '-0.01em', textWrap: 'balance' }}>{s}</div>
    );
    const optBtn = (label, onClick, lead) => (
      <button key={label} className="press" onClick={onClick} style={{
        background: `color-mix(in oklch, ${tint} 7%, var(--surface))`, border: `1px solid color-mix(in oklch, ${tint} 30%, var(--rule))`, borderRadius: 16,
        boxShadow: 'none', padding: '15px 17px', minHeight: 56,
        display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none',
      }}>
        {lead}
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{label}</span>
      </button>
    );
    // one reveal row — did the guesser call the answer?
    const revealRow = (who, right, ansLabel, guessLabel, av) => (
      <div style={{
        border: 'none', borderRadius: 0, padding: '9px 0',
        borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)',
        ...col(4),
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)' }}>{who}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {av}
          <span style={{ fontWeight: 700, fontSize: 14 }}>{ansLabel}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12.5, color: right ? GOOD : MISS, whiteSpace: 'nowrap' }}>
            {right ? 'called it' : 'guessed ' + guessLabel}
          </span>
        </span>
      </div>
    );

    const header = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <GDAv p={p} size={26}></GDAv>
        <span style={{ fontWeight: 800, fontSize: 14.5 }}>{first(p)}</span>
        {romantic && <span aria-label="romantic mode" style={{ width: 7, height: 7, borderRadius: '50%', background: ROMANCE, flexShrink: 0 }}></span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {p.streak > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>{p.streak}-day run</span>}
          {!invited && (
            <button className="tap44" aria-label={'Options for ' + first(p)} aria-expanded={menu} onClick={() => setMenu((v) => !v)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 17, fontWeight: 800, padding: '0 3px', lineHeight: 1, WebkitAppearance: 'none' }}>{'\u22ef'}</button>
          )}
        </span>
      </div>
    );
    const menuRow = menu && !invited && (
      <div style={{ ...col(9), border: LINE, borderRadius: 13, background: 'var(--surface)', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Question set</span>
          <span style={{ display: 'flex', gap: 4, flexShrink: 0, background: 'var(--surface-2)', borderRadius: 999, padding: 2 }}>
            {[['friends', 'Friends'], ['romantic', 'Romantic']].map(([k, label]) => (
              <button key={k} onClick={() => DUELS.setDuoMode(pid, k)} style={{
                border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', WebkitAppearance: 'none',
                fontFamily: 'var(--sans)', fontWeight: mode === k ? 800 : 600, fontSize: 12,
                background: mode === k ? (k === 'romantic' ? ROMANCE : 'var(--ink)') : 'transparent',
                color: mode === k ? 'var(--surface)' : 'var(--ink-3)',
              }}>{label}</button>
            ))}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', paddingTop: 9 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>End this 1v1? Your history stays on your map.</span>
          <button onClick={() => DUELS.endDuo(pid)} style={{ flexShrink: 0, border: 'none', background: 'var(--ochre-ink)', color: '#fff', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>End</button>
          <button onClick={() => setMenu(false)} style={{ flexShrink: 0, border: LINE, background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>Keep</button>
        </div>
      </div>
    );

    let body;
    if (invited) {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 13 }} key="inv">
          <GDAv p={p} size={52}></GDAv>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 21, letterSpacing: -0.4 }}>Waiting for {first(p)}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', maxWidth: 250, textWrap: 'pretty' }}>Invite sent — unlocks when they accept.</div>
          <button className="press" onClick={() => DUELS.cancelDuo(pid)} style={{ border: LINE, background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, padding: '8px 18px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>Cancel invite</button>
        </div>
      );
    } else if (step === 'answer') {
      body = (
        <div style={col(12)} key="a">
          {yday && (
            <div style={{ ...col(7), marginBottom: 4 }}>
              <span className="kicker" style={{ marginBottom: 0 }}>Yesterday {'\u00b7'} revealed</span>
              {revealRow('you read ' + first(p), yday.readRight, yday.q.options[yday.theirAns], yday.q.options[yday.myGuess], <GDAv p={p} size={20}></GDAv>)}
              {revealRow(first(p) + ' read you', yday.byRight, yday.q.options[yday.myAns], yday.q.options[yday.theirGuess],
                <span style={{ height: 20, padding: '0 7px', borderRadius: 999, display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 12, color: 'var(--surface)', background: 'var(--ink)' }}>you</span>)}
            </div>
          )}
          {prompt(today.q.prompt)}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>your answer</span>
          <div style={col(9)}>
            {today.q.options.map((o, i) => optBtn(o, () => DUELS.answerDuo(pid, { a: i })))}
          </div>
        </div>
      );
    } else if (step === 'guess') {
      body = (
        <div style={{ ...col(12), animation: 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }} key="g">
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
            You picked <b>{today.q.options[m.a]}</b>.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GDAv p={p} size={38}></GDAv>
            {prompt('And ' + first(p) + ' picked\u2026?')}
          </div>
          <div style={col(9)}>
            {today.q.options.map((o, i) => optBtn(o, () => DUELS.answerDuo(pid, { g: i })))}
          </div>
        </div>
      );
    } else {
      body = (
        <div style={{ ...col(12), animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' }} key="d">
          {prompt(today.q.prompt)}
          <div style={{ ...col(0), border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', animation: 'popIn .38s cubic-bezier(0.2,0.8,0.2,1) .05s both' }}>
              <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 999, fontWeight: 800, fontSize: 12, color: 'var(--surface)', background: 'var(--ink)' }}>you</span>
              {/* value sits next to its label — 200px of gap between them made
                  the pair impossible to read as one statement */}
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>said</span>
              <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.2, color: 'var(--ink)' }}>{today.q.options[m.a]}</span>
            </div>
          </div>
          {/* your read is ABOUT their answer, so it rides on that row instead of
              earning a labelled line of its own */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', padding: '11px 0 0' }}>
            <GDAv p={p} size={22}></GDAv>
            <div style={{ ...col(2), minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>{first(p)}{'\u2019'}s answer {'\u00b7'} <span style={{ color: 'var(--ink)', fontWeight: 800 }}>you called {today.q.options[m.g]}</span></span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', textWrap: 'pretty' }}>{theyDone ? (newest ? <RevealClock prefix="reveals in"></RevealClock> : 'reveals tomorrow') : first(p) + ' is still answering\u2026'}</span>
            </div>
            {/* withheld, not loading — one solid bar reads as a skeleton, so the
                block is broken into words the way a redacted line would be */}
            <span aria-hidden="true" style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
              {[22, 13, 18].map((w, i) => <span key={i} style={{ width: w, height: 11, borderRadius: 2, background: 'color-mix(in oklch, var(--ink) 17%, transparent)' }}></span>)}
            </span>
          </div>
          {p.read.total > 0 && (() => {
            // ReadRun picks its own resolution from the span: dots for a short
            // run, a density strip for months, a rate line for years.
            const N = p.read.total;
                    return (
            <div style={{ ...col(8), borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', paddingTop: 13 }}>
              {/* the two runs on one axis — filled dot = a right call. Each row's
                  own name is its label, so the section header is gone. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }} aria-label="How well you read them">
                <span style={{ flexShrink: 0, width: 62, padding: '3px 0', fontWeight: 800, fontSize: 12.5, color: 'var(--ink)' }}>you</span>
                <ReadRun days={Array.from({ length: N }, (_, i) => DUELS.duoDay(pid, N - i).readRight)} size={14}></ReadRun>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }} aria-label="How well they read you">
                <span style={{ flexShrink: 0, width: 62, padding: '3px 0', fontWeight: 800, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first(p)}</span>
                <ReadRun days={Array.from({ length: N }, (_, i) => DUELS.duoDay(pid, N - i).byRight)} color={ACC} size={14}></ReadRun>
              </div>
            </div>
            );
          })()}
          {nextName && <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>
            {'Swipe down \u2014 ' + nextName + ' is waiting'}
          </div>}
        </div>
      );
    }

    return (
      <div data-duo-card={pid} style={{
        minHeight: step === 'done' || invited ? 0 : Math.min(Math.max((vh || 540) - 190, 250), 380),
        boxSizing: 'border-box',
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
        display: 'flex', flexDirection: 'column', gap: 16,
        borderTop: LINE, padding: '20px 1px 26px',
      }}>
        {header}
        {menuRow}
        {body}
      </div>
    );
  }

  function DuoBody() {
    const [, bump] = useReducer((x) => x + 1, 0);
    useEffect(() => DUELS.subscribe(bump), []);
    const ps = DUELS.partners();
    // pending first, but the order is frozen at mount — finishing a duel must
    // not reshuffle the stack under your thumb
    const orderRef = useRef(null);
    // SURFACED BY D108, not introduced by it: while the store arrived as
    // `window.DUELS` the React Compiler could not resolve it and bailed out of
    // this component, so the lazy-ref block below went unreported. Verified by
    // probe — the file at the previous commit lints clean, and only the import
    // changed. Deferred on the same terms as every other Compiler finding here
    // (src/v2/README.md § Lint suppressions); the fix, behind a test that
    // asserts the order really is frozen, is `const [order] = useState(() => …)`
    // — the same once-only computation in the shape the Compiler accepts.
    // eslint-disable-next-line react-hooks/refs -- lazy ref init, see above
    if (!orderRef.current) orderRef.current = [...ps].sort((a, b) => (isPending(b) ? 1 : 0) - (isPending(a) ? 1 : 0)).map((x) => x.id);
    // 1v1s added after mount append at the end — nothing reshuffles
    // eslint-disable-next-line react-hooks/refs -- same lazy-ref block, see above
    const ordered = orderRef.current.map((id) => ps.find((x) => x.id === id)).filter(Boolean)
    // eslint-disable-next-line react-hooks/refs -- same lazy-ref block, see above
      .concat(ps.filter((x) => !orderRef.current.includes(x.id)));
    const [addOpen, setAddOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const closeAdd = () => { if (closing) return; setClosing(true); setTimeout(() => { setAddOpen(false); setClosing(false); }, 230); };
    const avail = DUELS.duoAvailable();
    const [cur, setCur] = useState(ordered[0] && ordered[0].id);
    const [vh, setVh] = useState(0);
    const rootRef = useRef(null);
    const railRef = useRef(null);
    const scRef = useRef(null);

    // snap on the tab scroller while mounted + a scroll-spy for the rail
    useEffect(() => {
      const el = rootRef.current; if (!el) return;
      let sc = el.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      scRef.current = sc;
      if (!sc) return;
      sc.style.scrollSnapType = 'y proximity';
      // snapped cards must land BELOW the sticky rail, not under it — pad the
      // snap origin by the rail's real height
      const railH = railRef.current ? railRef.current.offsetHeight : 80;
      sc.style.scrollPaddingTop = (railH + 14) + 'px';
      setVh(sc.clientHeight - railH);
      const onScroll = () => {
        const st = sc.getBoundingClientRect().top + railH;
        let best = null, bd = Infinity;
        el.querySelectorAll('[data-duo-card]').forEach((c) => {
          const d = Math.abs(c.getBoundingClientRect().top - st - 80);
          if (d < bd) { bd = d; best = c; }
        });
        if (best) setCur(best.getAttribute('data-duo-card'));
      };
      sc.addEventListener('scroll', onScroll, { passive: true });
      return () => { sc.removeEventListener('scroll', onScroll); sc.style.scrollSnapType = ''; sc.style.scrollPaddingTop = ''; };
    }, []);

    const jump = (pid) => {
      const sc = scRef.current, el = rootRef.current; if (!sc || !el) return;
      const card = el.querySelector('[data-duo-card="' + pid + '"]'); if (!card) return;
      const railH = railRef.current ? railRef.current.offsetHeight : 80;
      sc.scrollTo({ top: card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14, behavior: 'smooth' });
    };


    // a profile's "Open 1v1" lands here through the duel cue (data/duelCue,
    // 2026-08-26) — select + scroll. scroll-memory restores the fresh
    // scroller to its saved position just after mount, so a one-shot jump
    // gets undone: assert the target repeatedly for a beat, instantly,
    // until it sticks (the profile-overlay subnav race, third instance).
    // The cleanup is an explicit closure, not `return onDuelCue(go)` — the
    // Compiler bails out of the whole component on a call-result cleanup,
    // which un-reports the lazy-ref findings the disables above suppress.
    useEffect(() => {
      const go = () => {
        const f = takeDuelCue('duo'); if (!f) return;
        // existence via the store, not the ref-derived list — a render ref
        // in this closure is another shape the Compiler refuses
        if (!DUELS.partners().some((x) => x.id === f)) return;
        setCur(f);
        const t0 = Date.now();
        const step = () => {
          if (Date.now() - t0 > 1400) return; // self-terminating — no timer survives the beat
          const sc = scRef.current, el = rootRef.current;
          if (sc && el) {
            const card = el.querySelector('[data-duo-card="' + f + '"]');
            if (card) {
              const railH = railRef.current ? railRef.current.offsetHeight : 80;
              const target = Math.max(0, card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14);
              if (Math.abs(sc.scrollTop - target) > 40) sc.scrollTop = target;
              else if (Date.now() - t0 > 800) return; // held long enough — settled
            }
          }
          setTimeout(step, 120);
        };
        step();
      };
      go();
      const off = onDuelCue(go);
      return () => { off(); };
    }, []);

    const nLeft = ordered.filter(isPending).length;
    return (
      <div ref={rootRef} style={col(10)}>
        <div style={{ display: 'flex', alignItems: 'baseline', padding: '0 2px', scrollSnapAlign: 'start' }}>
          {nLeft > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>{nLeft} to play</span>}
        </div>
        <div ref={railRef} style={{ position: 'sticky', top: 0, zIndex: 6, margin: '-1px -16px 0', padding: '1px 10px 0', background: 'var(--surface-a, var(--surface))', borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' }}>
          <DuoRail ps={ordered} cur={cur} onPick={jump} onAdd={() => setAddOpen(true)}></DuoRail>
        </div>
        <div style={col(10)}>
          {ordered.map((p, i) => {
            const next = ordered.slice(i + 1).find(isPending);
            return <DuoCard key={p.id} p={p} vh={vh} nextName={next ? first(next) : null} newest={i === 0}></DuoCard>;
          })}
        </div>
        {addOpen && document.querySelector('.app') && ReactDOM.createPortal(
          <Sheet onClose={closeAdd} closing={closing} label="New 1v1">
              <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>New 1v1</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1 }}>pick a friend</span>
                <button className="tap44" onClick={closeAdd} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>{'\u2715'}</button>
              </div>
              <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {avail.length ? avail.map((p) => (
                  <button key={p.id} className="press" onClick={() => { DUELS.startDuo(p.id); closeAdd(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, border: LINE, borderRadius: 14, background: 'var(--surface-2)', padding: '11px 13px', cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none' }}>
                    <GDAv p={p} size={34} plain></GDAv>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, color: 'var(--ink)' }}>{p.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{p.rel}</span>
                    </span>
                    <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: 'var(--surface)', background: 'var(--ink)', padding: '6px 14px', borderRadius: 999 }}>Invite</span>
                  </button>
                )) : (
                  <div style={{ textAlign: 'center', padding: '26px 18px', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>
                    Everyone in your circle already has a 1v1 with you. Add friends from a person{'\u2019'}s profile to start more.
                  </div>
                )}
              </div>
          </Sheet>, document.querySelector('.app'))}
      </div>
    );
  }

  Object.assign(window, { DuoBody });
  DuoDomainsImpl = DuoDomains;
})();

// A live binding, not a wrapper component — see person-mindmap.jsx.
export { DuoDomainsImpl as DuoDomains };
