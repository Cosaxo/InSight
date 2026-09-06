// Ported from design/InSight_standalone_17.html (explain-sheet.jsx). THIS file
// is the live source now, hand-edits and all.
//
// A NEW module, so its three names are ordinary named exports rather than a
// window bag (D39's "convert on touch").
//
// ONE DIVERGENCE FROM THE PROTOTYPE: the sheet is built on the `Sheet`
// primitive rather than a hand-rolled wf-scrim/wf-sheet pair. Same markup,
// but with the dialog semantics D24 gave every other sheet in the layer —
// role, aria-modal, aria-label, Escape, focus trap, focus restore — and
// without the div-with-onClick scrim the a11y ratchet counts.
import React from 'react';
import ReactDOM from 'react-dom';
import { Sheet } from './primitives.jsx';

// explain-sheet.jsx — ONE place that says what every score means.
// Tests and lenses both carry an ⓘ that opens this sheet: what the instrument
// measures, how to read its marks, and a plain line per dimension. Copy rules:
// no jargon, no arguments about the trait, ≤ 12 words per dimension.
const { useState } = React;

// ── the copy ───────────────────────────────────────────────────────────────
// about: what the whole instrument measures · dims: what each axis means
const EX = {
  // the 1v1 and group readings as instruments (2026-08-24) — the Roles
  // panel's roses read these through the same ⓘ as every test
  // Every rate is scored against luck since D385 (data/roles.ts): 50 is
  // guessing at random, 100 is right every day, whatever the day's option
  // count — which is what lets a two-way day and a pick day share a petal.
  duo: {
    about: 'How a single 1v1 goes: who calls whom, how alike you answer, and whether it holds. Scored against luck — 50 is guessing at random.',
    dims: {
      read:   'Your guesses at their answer, against luck.',
      seen:   'Their guesses at yours, against luck.',
      like:   'How often you give the same answer, against luck. Days about each other don’t count.',
      steady: 'Whether your right calls come in runs or scattered.',
    },
  },
  group: {
    about: 'Where you sit in a circle: with it, against it, or calling where it lands. Scored against luck — 50 is random.',
    // no `cast` line: the prototype's fourth dimension is not computed here
    // (D204 — its only source was a demo scenario generator), and copy for a
    // dim that cannot render would only be waiting to describe a fabrication
    dims: {
      own:    'How often you land away from the majority, against luck.',
      pull:   'How often the others land where you land, against luck.',
      settle: 'Whether which side you’re on holds from day to day.',
    },
  },
  big5: {
    about: 'Five broad traits psychologists use to describe personality. Everyone sits somewhere on each one — neither end is better.',
    dims: {
      O: 'Appetite for new ideas, art and change.',
      C: 'Planning, order, and finishing what you start.',
      E: 'Whether people or quiet gives you energy.',
      A: 'How much you accommodate and trust others.',
      N: 'How hard stress and setbacks land.',
    },
  },
  political: {
    about: 'Six separate axes instead of one left–right line, each scored on its own — so you can sit left on one and right on another.',
    dims: {
      econ: 'Who should steer the economy: the state or the market.',
      auth: 'How far the state may limit personal freedom.',
      foreign: 'How open your country should be to the world.',
      env: 'What you would trade for climate action.',
      tech: 'Push new technology forward, or slow it down.',
      estab: 'Trust in established institutions versus outsiders.',
    },
  },
  values: {
    about: 'Six tensions in what makes a life good. Both ends are defensible — the reading is where you sit between them.',
    dims: {
      future: 'Whether life is getting better or worse.',
      circle: 'Whether duty stops at your people or reaches strangers.',
      hedonism: 'Enjoyment weighed against obligation.',
      meaning: 'Whether hardship adds meaning or only hurts.',
      moral: 'Whether right and wrong are fixed or made by us.',
      beauty: 'How much beauty counts beside use and truth.',
    },
  },
  attachment: {
    about: 'What kind of friend you are — not how good at it, but how you show up.',
    dims: {
      warm: 'How openly you show that you care.',
      loyal: 'Many light friendships, or few deep ones.',
      open: 'How much of yourself you let people see.',
      play: 'How much you keep things light.',
      easy: 'How easily things get under your skin.',
    },
  },
  moral: {
    about: 'Six moral instincts that sit under political and social opinions. Most people run several at once — the mix is the reading.',
    dims: {
      care: 'Aversion to anyone being hurt.',
      fair: 'Proportion — you get out what you put in.',
      liberty: 'Resistance to being told what to do.',
      loyal: 'Standing by your own group.',
      authority: 'Respect for rank and tradition.',
      sanctity: 'Things that feel degrading even when nobody is harmed.',
    },
  },
  risk: {
    about: 'Willingness to take a risk, split by area of life — because nobody is brave everywhere.',
    dims: {
      financial: 'Money you could lose.',
      health: 'Your body, and the check-ups you skip.',
      social: 'Saying the unpopular thing out loud.',
      recreational: 'Speed, height, physical thrill.',
      ethical: 'Bending a rule for a better outcome.',
    },
  },
  trust: {
    about: 'What you assume the world is like before you have checked.',
    dims: {
      trust: 'Whether strangers are safe by default.',
      zerosum: 'Whether one side gains only if another loses.',
      justworld: 'Whether outcomes are earned, or mostly luck.',
    },
  },
  time: {
    about: 'How much a reward far in the future is worth to you today.',
    dims: {
      horizon: 'How far ahead you plan.',
      patience: 'How well you sit with waiting.',
    },
  },
  taste: {
    about: 'What you reach for in film, music and food — the shape of your taste, not its quality.',
    dims: {
      novelty: 'The unknown thing, or the one you love.',
      complexity: 'Clean and direct, or dense and layered.',
      sincerity: 'Earnest, or ironic.',
      scene: 'Mainstream, or off the beaten track.',
    },
  },
  conflict: {
    about: 'What you do when a room gets tense.',
    dims: {
      assert: 'Push your position, or keep the peace.',
      engage: 'Say it now, or step away.',
    },
  },
  humor: {
    about: 'Who your jokes are for.',
    dims: {
      affiliative: 'Jokes that pull a room together.',
      selfenh: 'Finding it funny when things go wrong.',
      aggressive: 'Jokes with a target.',
      selfdef: 'Jokes at your own expense.',
    },
  },
  thinking: {
    about: 'How you reach a decision, and how tightly you hold it.',
    dims: {
      mode: 'Gut feel, or working it out.',
      update: 'How readily you change your mind.',
    },
  },
  culture: {
    about: 'How much the group shapes you, and how tight its rules feel.',
    dims: {
      self: 'Choices as yours, or your circle’s.',
      norms: 'Whether breaking a social rule should cost you.',
    },
  },
};

const exSans = 'var(--sans)';
export const EX_GLYPH = {
  you: (c) => <span style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: '2px solid var(--surface-2)', boxShadow: '0 0 0 0.5px var(--rule)', flexShrink: 0 }}></span>,
  most: () => <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--surface-2)', border: '1.4px solid var(--ink-3)', flexShrink: 0 }}></span>,
  tick: () => <span style={{ width: 2, height: 13, borderRadius: 2, background: 'color-mix(in oklch, var(--ink-3) 70%, transparent)', flexShrink: 0 }}></span>,
  bar: (c) => <span style={{ width: 20, height: 8, borderRadius: 99, background: c, flexShrink: 0 }}></span>,
  pale: (c) => <span style={{ width: 20, height: 8, borderRadius: 99, background: `oklch(from ${c} 0.86 0.05 h)`, flexShrink: 0 }}></span>,
  petal: (c) => <span style={{ width: 16, height: 10, borderRadius: '2px 8px 8px 2px', background: c, flexShrink: 0 }}></span>,
};

// the ⓘ — same hairline circle the feed uses, so one glyph means one thing
export function ExplainBtn({ onClick, label }) {
  return (
    <button className="press tap44" onClick={(e) => { e.stopPropagation(); onClick(e); }} aria-label={label || 'What this measures'} style={{
      flexShrink: 0, width: 20, height: 20, borderRadius: '50%', padding: 0, cursor: 'pointer', WebkitAppearance: 'none',
      border: '0.5px solid color-mix(in oklch, var(--ink) 24%, var(--rule))', background: 'transparent',
      color: 'var(--ink-2)', fontFamily: exSans, fontSize: 11.5, fontWeight: 800, lineHeight: 1,
    }}>i</button>
  );
}

// key = [[glyph node, text], …] · dims = [{ label, poles, id }]
export function ExplainSheet({ title, kicker, keyRows, dims, dimKey, onClose }) {
  const [closing, setClosing] = useState(false);
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 240); };
  // a per-setting key ('duo:f1') explains the same instrument as its family
  // (2026-08-24) — one entry serves every 1v1, not one per pairing
  const ex = EX[dimKey] || EX[String(dimKey || '').split(':')[0]] || { about: '', dims: {} };
  const sheet = (
    <Sheet onClose={close} closing={closing} label={title + ' — what this measures'}>
      <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: exSans, fontWeight: 800, fontSize: 15 }}>{title}</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: exSans, fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kicker}</span>
        <button className="tap44" onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0 }}>✕</button>
      </div>
      <div className="wf-sheet-body">
        {ex.about && <p style={{ margin: '2px 0 0', fontFamily: exSans, fontSize: 15, fontWeight: 500, lineHeight: 1.55, color: 'var(--ink)', textWrap: 'pretty' }}>{ex.about}</p>}
        {keyRows && keyRows.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="klabel">How to read it</span>
            {keyRows.map(([g, text], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{g}</span>
                <span style={{ fontFamily: exSans, fontSize: 13.5, fontWeight: 550, color: 'var(--ink-2)', textWrap: 'pretty' }}>{text}</span>
              </div>
            ))}
          </div>
        )}
        {dims && dims.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="klabel">What each one means</span>
            {dims.map((d) => (
              <div key={d.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: exSans, fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.012em' }}>{d.label}</span>
                  {d.poles && <span style={{ fontFamily: exSans, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{d.poles[0]} → {d.poles[1]}</span>}
                </div>
                {ex.dims[d.id] && <div style={{ marginTop: 2, fontFamily: exSans, fontSize: 13.5, fontWeight: 500, lineHeight: 1.45, color: 'var(--ink-2)', textWrap: 'pretty' }}>{ex.dims[d.id]}</div>}
                {/* a caller may pin the viewer's own reading under the
                    definition (2026-08-24) — a word, not a lecture */}
                {d.note && <div style={{ marginTop: 3, fontFamily: exSans, fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>yours: {d.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
  // Portaled to the app frame, like TypeIndexSheet and the 1v1 add sheet:
  // .wf-scrim positions absolutely, and two of the three ⓘ sites render deep
  // inside the profile's scrolling body (the Lenses panel, a test's result
  // card), where the nearest containing block is as tall as the CONTENT —
  // in place, the sheet landed at the bottom of the scroll, off-screen until
  // you scrolled after it. Falls back to rendering in place for a mount with
  // no .app around it (unit tests mount panels bare).
  const host = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  return host ? ReactDOM.createPortal(sheet, host) : sheet;
}
