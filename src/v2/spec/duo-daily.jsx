// Ported from design/spec-modules/duo-daily.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all), and
// re-ported at D435 from design/standalone-2026-09-09/duo-daily.jsx: the 1v1
// card played in ROUNDS, three own rounds then a cast, on the shell
// group-daily.jsx exports.
import React from 'react';
import { ReadRun, RUN_DOTS } from './read-run.jsx';
import { DUELS } from './duels-data.js';
import {
  GDAv, YouChip, RoundRun, RoundKicker, SealedList, AheadBtn, OptBtn,
  RoundPrompt, RoundSmallPrompt, RoundBand, RoundRule, RoundQuiet,
  RoundStack, CardFrame, CardHead, RoundSheet, SheetFoot, useSheet,
} from './group-daily.jsx';

// duo-daily.jsx — the daily tab's 1v1 mode. A vertical stack of duels, one
// per close tie, snap-scrolling like the feed: the last reveal sits above
// the round in front of you, answering morphs into guessing in place, and
// when a round seals you just swipe down — the next person is waiting. The
// sticky rail on top shows who is waiting on you; tap a face to jump.
//
// Every fourth round is the CAST (D435) — "Most days, Liv is…" — four
// plain answers each carrying an axis; your guess is at what THEY said you
// are, in the *them* form, and the reveal leads with the two sentences:
// "You are the one Liv tells first. Liv is the one you ask what to do."
//
// `DuoDomains` is exported by name (D39, "convert on touch") — person-overlay
// imports it. `DuoBody` still publishes through the window bag, so the export
// is hoisted out of the IIFE rather than the IIFE unwound.
let DuoDomainsImpl;
(function () {
  const { useState, useEffect, useReducer } = React;
  const LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';
  const HAIR = '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)';
  const ACC = 'var(--c-people)';
  const ROMANCE = 'oklch(0.55 0.13 12)';
  const GOOD = 'var(--c-likeness)';
  const MISS = 'var(--ochre)';
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

  const col = (g) => ({ display: 'flex', flexDirection: 'column', gap: g });
  const kick = { fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap' };
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

  // the last revealed round: said · called, both sides; on a cast, the two
  // sentences first
  function DuoRevealBlock({ rd, p, tint }) {
    const { q, r } = rd;
    const name = first(p);
    const cast = q.kind === 'cast';
    const mineWord = (i) => q.options[i];
    const theirWord = (i) => (cast ? q.optionsThem[i] : q.options[i]);
    const cell = { padding: '10px 0', fontFamily: 'var(--sans)', fontSize: 14, textWrap: 'pretty' };
    const sides = [
      { me: true, said: mineWord(rd.myAns), guess: rd.myGuess, guessWord: theirWord, actual: rd.theirAns },
      { me: false, said: theirWord(rd.theirAns), guess: rd.theirGuess, guessWord: mineWord, actual: rd.myAns },
    ];
    return (
      <div style={col(10)}>
        <RoundKicker r={r} post="· revealed"></RoundKicker>
        <RoundSmallPrompt>{q.prompt}</RoundSmallPrompt>
        {cast && rd.theirAns != null && rd.myAns != null && (
          <div data-testid="duo-cast-line" style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, color: 'var(--ink-2)', textWrap: 'pretty' }}>
            You are <b style={{ color: tint }}>{theirWord(rd.theirAns)}</b>. {name} is <b style={{ color: 'var(--ink)' }}>{mineWord(rd.myAns)}</b>.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) minmax(0, 1fr)', columnGap: 12, alignItems: 'center' }}>
          <span></span>
          <span style={{ ...kick, paddingBottom: 6 }}>said</span>
          <span style={{ ...kick, paddingBottom: 6 }}>called</span>
          {sides.map((w, i) => (
            <React.Fragment key={i}>
              <span style={{ gridColumn: '1 / -1', borderTop: HAIR }}></span>
              <span style={{ ...cell, display: 'flex', alignItems: 'center' }}>{w.me ? <YouChip size={26}></YouChip> : <GDAv p={p} size={26}></GDAv>}</span>
              <span style={{ ...cell, fontWeight: 700, color: 'var(--ink)' }}>{w.said}</span>
              <span style={{ ...cell, fontWeight: 800, color: w.guess == null ? 'var(--ink-3)' : w.guess === w.actual ? GOOD : MISS }}>
                {w.guess == null ? '—' : (w.guess === w.actual ? '✓ ' : '') + w.guessWord(w.guess)}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // ── one duel card — fills the view, snaps into place ──
  function DuoCard({ p, vh }) {
    const pid = p.id;
    const invited = p.state === 'invited';
    const v = invited ? null : DUELS.duoView(pid);
    const opts = useSheet();
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [aheadOpen, setAheadOpen] = useState(false);
    const ahead = v ? v.ahead : 0;
    useEffect(() => { if (ahead === 0) setAheadOpen(false); }, [ahead]);
    const mode = p.mode || 'friends';
    const romantic = mode === 'romantic';
    const tint = romantic ? ROMANCE : ACC;
    const name = first(p);
    const closeOpts = () => { opts.close(); setTimeout(() => setConfirmEnd(false), 240); };
    const head = (
      <CardHead mark={<GDAv p={p} size={30}></GDAv>} name={name}
        note={romantic ? <span aria-label="romantic mode" style={{ width: 7, height: 7, borderRadius: '50%', background: ROMANCE, flexShrink: 0 }}></span> : null}
        onMore={invited ? null : opts.show} moreLabel={'Options for ' + name} moreOpen={opts.open}></CardHead>
    );
    const optSheet = opts.open && (
      <RoundSheet title={name} sub={p.rel || '1v1'} onClose={closeOpts} closing={opts.closing} gap={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 4px' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Question set</span>
          <span style={{ display: 'flex', gap: 4, flexShrink: 0, background: 'var(--surface-2)', borderRadius: 999, padding: 2 }}>
            {[['friends', 'Friends'], ['romantic', 'Romantic']].map(([k, label]) => (
              <button key={k} className="tap44 is-tight" onClick={() => DUELS.setDuoMode(pid, k)} aria-pressed={mode === k} style={{
                border: 'none', borderRadius: 999, padding: '5px 12px', minHeight: 32, cursor: 'pointer', WebkitAppearance: 'none',
                fontFamily: 'var(--sans)', fontWeight: mode === k ? 800 : 600, fontSize: 12,
                background: mode === k ? (k === 'romantic' ? ROMANCE : 'var(--ink)') : 'transparent',
                color: mode === k ? 'var(--surface)' : 'var(--ink-3)',
              }}>{label}</button>
            ))}
          </span>
        </div>
        <SheetFoot link="End 1v1" ask="End this 1v1? Your history stays on your map." confirm="End" keep="Keep"
          open={confirmEnd} onOpen={() => setConfirmEnd(true)} onKeep={() => setConfirmEnd(false)}
          onConfirm={() => { closeOpts(); setTimeout(() => DUELS.endDuo(pid), 240); }}></SheetFoot>
      </RoundSheet>
    );
    if (invited) {
      return (
        <CardFrame id={pid}>
          {head}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 13 }}>
            <GDAv p={p} size={52}></GDAv>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 21, letterSpacing: -0.4 }}>Waiting for {name}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', maxWidth: 250, textWrap: 'pretty' }}>Invite sent — your first round opens when they accept.</div>
            <button className="press" onClick={() => DUELS.cancelDuo(pid)} style={{ border: LINE, background: 'var(--surface)', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, padding: '8px 18px', minHeight: 44, borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>Cancel invite</button>
          </div>
        </CardFrame>
      );
    }
    const isCast = (rd) => rd.q.kind === 'cast';
    const guessOpts = (rd) => (isCast(rd) ? rd.q.optionsThem : rd.q.options);
    // the ask: the prompt and the options — your own answer first
    const askBlock = (r) => {
      const rd = v.round(r);
      return (
        <div style={col(12)} key={'ask' + r}>
          <RoundKicker r={r} tag={isCast(rd) ? { label: 'the cast' } : null}></RoundKicker>
          <RoundPrompt>{rd.q.prompt}</RoundPrompt>
          <div style={col(9)}>
            {rd.q.options.map((o, i) => <OptBtn key={o} label={o} tint={tint} onClick={() => DUELS.answerDuo(pid, { a: i }, r)}></OptBtn>)}
          </div>
        </div>
      );
    };
    // then the guess: what they said — on a cast, what they said you are
    const guessBlock = (r) => {
      const rd = v.round(r);
      const cast = isCast(rd);
      return (
        <div style={{ ...col(12), animation: 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }} key={'guess' + r}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
            {cast
              ? <React.Fragment>You said {name} is <b style={{ color: 'var(--ink)' }}>{rd.q.options[rd.myAns]}</b>.</React.Fragment>
              : <React.Fragment>You said <b style={{ color: 'var(--ink)' }}>{rd.q.options[rd.myAns]}</b>.</React.Fragment>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GDAv p={p} size={38}></GDAv>
            <RoundPrompt>{cast ? <React.Fragment>And {name} said you are…?</React.Fragment> : <React.Fragment>And {name} said…?</React.Fragment>}</RoundPrompt>
          </div>
          <div style={col(9)}>
            {guessOpts(rd).map((o, i) => <OptBtn key={o} label={o} tint={tint} onClick={() => DUELS.answerDuo(pid, { g: i }, r)}></OptBtn>)}
          </div>
        </div>
      );
    };
    // both in from your side, waiting on theirs
    const waitBlock = () => {
      const r = v.revealed + 1;
      const rd = v.round(r);
      return (
        <div style={{ ...col(12), animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' }} key="wait">
          <RoundKicker r={r} tag={isCast(rd) ? { label: 'the cast' } : null}></RoundKicker>
          <RoundPrompt size={24}>{rd.q.prompt}</RoundPrompt>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 0' }}>
            <YouChip></YouChip>
            {/* value sits next to its label — 200px of gap between them made
                the pair impossible to read as one statement */}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>said</span>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.2, color: 'var(--ink)' }}>{rd.q.options[rd.myAns]}</span>
          </div>
          {/* your call is ABOUT their answer, so it rides on that row instead of
              earning a labelled line of its own */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: HAIR, paddingTop: 12 }}>
            <GDAv p={p} size={26}></GDAv>
            <div style={{ ...col(2), minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>{name}’s answer · <span style={{ color: 'var(--ink)', fontWeight: 800 }}>you called {guessOpts(rd)[rd.myGuess]}</span></span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>waiting on {name}</span>
            </div>
            {/* withheld, not loading — one solid bar reads as a skeleton, so the
                block is broken into words the way a redacted line would be */}
            <span aria-hidden="true" style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
              {[22, 13, 18].map((w, i) => <span key={i} style={{ width: w, height: 11, borderRadius: 2, background: 'color-mix(in oklch, var(--ink) 17%, transparent)' }}></span>)}
            </span>
          </div>
        </div>
      );
    };
    const sealedBlock = () => (
      <SealedList key="sealed" acc={tint}
        title={`${WORDS[v.ahead] || v.ahead} rounds waiting on ${name}`}
        line={`Each reveals as ${name} plays.`}
        items={v.sealed.map((r) => {
          const rd = v.round(r);
          return { n: r, prompt: rd.q.prompt, sub: 'you said ' + rd.q.options[rd.myAns] + (rd.myGuess != null ? ' · called ' + guessOpts(rd)[rd.myGuess] : '') };
        })}></SealedList>
    );
    let body;
    const openRd = v.open != null ? v.round(v.open) : null;
    if (openRd && openRd.myAns != null && !openRd.mineIn) body = guessBlock(v.open);
    else if (v.ahead >= 1 && !aheadOpen) {
      body = (
        <div style={col(14)} key="ahead">
          {v.ahead === 1 ? waitBlock() : sealedBlock()}
          {v.open != null && <AheadBtn r={v.open} onClick={() => setAheadOpen(true)}></AheadBtn>}
        </div>
      );
    } else if (v.open != null) body = askBlock(v.open);
    else body = <div key="lead" style={RoundQuiet}>Nothing waiting on you here.</div>;
    // the two runs on one axis — filled = a right call; sealed and open
    // rounds carry their own marks so the axis reads the same on both rows
    const top = Math.max(v.myTop, v.theirTop, v.open || 0);
    const mine = [], theirs = [];
    for (let r = 1; r <= top; r++) {
      if (r <= v.revealed) {
        const rd = v.round(r);
        mine.push(rd.readRight ? 1 : 0);
        theirs.push(rd.byRight ? 1 : 0);
      } else {
        const k = v.round(r).mineIn ? 's' : 'o';
        mine.push(k); theirs.push(k);
      }
    }
    return (
      <CardFrame id={pid} tall={v.open != null && !v.ahead} vh={vh}>
        {head}
        {v.waiting >= 2 && <RoundBand acc={tint} big={`${v.waiting} rounds waiting for you`} sub="each reveals as you answer"></RoundBand>}
        {v.lastRevealed && <DuoRevealBlock rd={v.lastRevealed} p={p} tint={tint}></DuoRevealBlock>}
        {v.lastRevealed && body && <RoundRule></RoundRule>}
        {body}
        {mine.length > 0 && (
          <div style={{ ...col(8), borderTop: HAIR, paddingTop: 13 }}>
            <RoundRun marks={mine} color={GOOD} acc={tint} label="you" aria={'How well you read ' + name + ', one mark per round'}></RoundRun>
            <RoundRun marks={theirs} color={tint} acc={tint} label={name} aria={'How well ' + name + ' reads you, one mark per round'}></RoundRun>
          </div>
        )}
        {optSheet}
      </CardFrame>
    );
  }

  function NewDuoSheet({ close }) {
    const avail = DUELS.duoAvailable();
    if (!avail.length) {
      return (
        <div style={{ textAlign: 'center', padding: '26px 18px', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>
          Everyone in your circle already has a 1v1 with you. Add friends from a person’s profile to start more.
        </div>
      );
    }
    return avail.map((p) => (
      <button key={p.id} className="press" onClick={() => { DUELS.startDuo(p.id); close(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 11, border: LINE, borderRadius: 14, background: 'var(--surface-2)', padding: '11px 13px', cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none' }}>
        <GDAv p={p} size={34} plain></GDAv>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, color: 'var(--ink)' }}>{p.name}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{p.rel}</span>
        </span>
        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: 'var(--surface)', background: 'var(--ink)', padding: '6px 14px', borderRadius: 999 }}>Invite</span>
      </button>
    ));
  }

  function DuoBody() {
    const [, bump] = useReducer((x) => x + 1, 0);
    useEffect(() => DUELS.subscribe(bump), []);
    const ps = DUELS.partners();
    return (
      <RoundStack items={ps} isPending={(p) => p.state !== 'invited' && isPending(p)} acc={ACC}
        rail={{ mark: (p) => <GDAv p={p} size={38} plain></GDAv>, label: first, state: (p) => (p.state === 'invited' ? 'invited' : isPending(p) ? 'pending' : null), addLabel: 'Start a new 1v1' }}
        renderCard={(p, vh) => <DuoCard key={p.id} p={p} vh={vh}></DuoCard>}
        sheet={{ title: 'New 1v1', sub: 'pick a friend', Body: NewDuoSheet }}
        cueMode="duo"></RoundStack>
    );
  }

  Object.assign(window, { DuoBody });
  DuoDomainsImpl = DuoDomains;
})();

// A live binding, not a wrapper component — see person-mindmap.jsx.
export { DuoDomainsImpl as DuoDomains };
