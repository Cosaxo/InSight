// oracle.jsx — the Oracle lens, in the same round dusk field as the two maps.
// The guess is a disc sealed on the seam between the two halves. On your tap it
// travels to the half it called, and that half fills from the bottom to how sure
// it was. So:
//   confidence = the fill's HEIGHT and the disc's SIZE (and a word under it),
//   evidence   = ink density — a cold-start guess is a faint disc,
//   the call    = a POSITION, your pick = the "you" tag on its half,
//   the verdict = the disc's glyph on landing: solid when it had you, broken
//                 open to a RING when you broke it — and said in words below.
// The card says how it works in one sentence, so nothing has to be decoded.
// Press "Why?" for its working; press a ledger mark to recall that question.
// Your record is the LEDGER at the foot: one mark per answer — up in accent
// when you broke the guess (taller = more surprising), down as a hairline tick
// when it had you — and the new mark lands there as you watch.
const OR_CAP_BITS = 2.6; // a mark this surprising is full height
const OR_MASS_FULL = 3.4; // evidence mass at which the disc is fully inked
const OR_MASS_GAMMA = 0.62; // compresses the per-question jitter in that ramp
const OR_LAND_MS = 780; // travel + settle, when the verdict glyph resolves
const orTopic = cat => (window.WORLD_TOPICS || []).find(t => t.id === cat);
const orHue = c => {
  const m = /([\-\d.]+)\s*\)\s*$/.exec(c || '');
  return m ? parseFloat(m[1]) : null;
};
const orQuiet = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};
const orH = (bits, base, span) => base + Math.min(1, bits / OR_CAP_BITS) * span;
// how a crowd leans, in words rather than a number
const orWord = p => p >= 0.78 ? 'nearly always' : p >= 0.62 ? 'mostly' : p >= 0.54 ? 'more often than not' : 'still mostly';
// how sure the oracle was, in words — the fill height says the same thing
const orSure = c => c >= 0.82 ? 'sure' : c >= 0.68 ? 'fairly sure' : c >= 0.57 ? 'leaning' : 'guessing';
// the field: a 280 box, the seam down the middle
const OR_S = 280,
  OR_C = 140;
const orSeat = i => i === 0 ? OR_C - 66 : OR_C + 66;
// a label of up to ~11 chars fits a half on one line; longer ones break at the middle space
const orLines = s => {
  s = String(s || '');
  if (s.length <= 11) return [s];
  const ws = s.split(' ');
  if (ws.length < 2) return [s];
  let best = 1,
    bd = 1e9;
  for (let k = 1; k < ws.length; k++) {
    const d = Math.abs(ws.slice(0, k).join(' ').length - ws.slice(k).join(' ').length);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
};

// the record: one mark per answer, on a single baseline. Press one to recall it.
// In `group` mode (the done state) the same marks are re-laid by topic — most
// broken subject first, hue = topic — so the strip that IS your record is also
// the reading of it. One strip, never two.
function OrLedger({
  log,
  qOf,
  sel,
  onPick,
  group,
  topIx
}) {
  let items = log.map((r, i) => ({
    r,
    i
  })).slice(-30);
  const gaps = new Set();
  const mkH = bits => group ? orH(bits, 13, 63) : orH(bits, 9, 31);
  if (group) {
    const cnt = new Map();
    items.forEach(({
      r
    }) => {
      const q = qOf(r.q);
      if (!q) return;
      const c = cnt.get(q.cat) || {
        b: 0,
        n: 0
      };
      c.n++;
      if (r.pred !== r.mine) c.b++;
      cnt.set(q.cat, c);
    });
    const key = x => {
      const q = qOf(x.r.q);
      return q ? q.cat : '';
    };
    items = items.slice().sort((a, b) => {
      const ka = key(a),
        kb = key(b);
      if (ka === kb) return a.i - b.i;
      const ca = cnt.get(ka) || {
          b: 0,
          n: 0
        },
        cb = cnt.get(kb) || {
          b: 0,
          n: 0
        };
      return cb.b - ca.b || cb.n - ca.n || (ka < kb ? -1 : 1);
    });
    let prev = null;
    items.forEach((it, ix) => {
      const k = key(it);
      if (ix > 0 && k !== prev) gaps.add(ix);
      prev = k;
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: 'or-ledger' + (group ? ' is-grouped' : ''),
    "aria-label": group ? 'Your record, grouped by topic — a mark up each time you broke the guess, a tick down when it had you. Press a mark to recall that question.' : 'Your record — a mark up each time you broke the guess, a tick down when it had you. Press a mark to recall that question.'
  }, /*#__PURE__*/React.createElement("span", {
    className: "or-base"
  }), items.map(({
    r,
    i
  }, ix) => {
    const broke = r.pred !== r.mine,
      q = qOf(r.q),
      t = group && q ? orTopic(q.cat) : null;
    const isTop = group && i === topIx;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      className: 'or-cell' + (sel === i ? ' is-sel' : '') + (gaps.has(ix) ? ' is-gap' : ''),
      onClick: () => onPick(sel === i ? null : i),
      "aria-label": q ? q.prompt + ' — it called ' + q.options[r.pred].label + (broke ? '; you said ' + q.options[r.mine].label : '; you agreed') : 'answer'
    }, /*#__PURE__*/React.createElement("i", {
      className: 'or-mk' + (broke ? '' : ' hit') + (isTop ? ' is-top' : ''),
      style: broke ? {
        height: mkH(r.bits),
        background: isTop || sel === i ? undefined : t ? window.WPAL.c(t.color) : undefined
      } : undefined
    }));
  }));
}

// the retrospective: the record re-laid as the reading. The strip below IS the
// per-topic breakdown (grouped, hue = topic); the sentence above names its
// tallest mark. No second axis, no rows that hold one mark.
function OrDone({
  log,
  qOf,
  onReset
}) {
  const [sel, setSel] = React.useState(null);
  let topIx = -1,
    anyBreak = false;
  log.forEach(r => {
    if (r.pred !== r.mine) anyBreak = true;
  });
  log.forEach((r, i) => {
    if (r.pred !== r.mine === anyBreak && (topIx < 0 || r.bits > log[topIx].bits)) topIx = i;
  });
  const top = topIx >= 0 ? log[topIx] : null,
    tq = top && qOf(top.q);
  const rc = sel != null ? log[sel] : null,
    rq = rc && qOf(rc.q);
  return /*#__PURE__*/React.createElement("div", {
    className: "or-lens"
  }, /*#__PURE__*/React.createElement("div", {
    className: "or-done fade-in"
  }, tq && /*#__PURE__*/React.createElement("div", {
    className: "or-bigtx"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pt-kick"
  }, anyBreak ? 'biggest break' : 'closest call'), /*#__PURE__*/React.createElement("p", {
    className: "or-bigq"
  }, tq.prompt), /*#__PURE__*/React.createElement("p", {
    className: "or-bigs"
  }, "It called ", /*#__PURE__*/React.createElement("b", null, tq.options[top.pred].label), ". ", anyBreak ? /*#__PURE__*/React.createElement(React.Fragment, null, "You said ", /*#__PURE__*/React.createElement("b", null, tq.options[top.mine].label), ".") : /*#__PURE__*/React.createElement(React.Fragment, null, "You did too \u2014 as you did every time."))), /*#__PURE__*/React.createElement(OrLedger, {
    log: log,
    qOf: qOf,
    sel: sel,
    onPick: setSel,
    group: true,
    topIx: topIx
  }), log.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "or-cap",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("i", {
    className: "or-cap-up"
  }), /*#__PURE__*/React.createElement("span", null, "you broke its guess"), /*#__PURE__*/React.createElement("span", {
    className: "or-cap-dot"
  }, '\u00b7'), /*#__PURE__*/React.createElement("i", {
    className: "or-cap-dn"
  }), /*#__PURE__*/React.createElement("span", null, "it had you"), /*#__PURE__*/React.createElement("span", {
    className: "or-cap-dot"
  }, '\u00b7'), /*#__PURE__*/React.createElement("span", null, "colour = topic")), /*#__PURE__*/React.createElement("div", {
    className: "or-slot"
  }, rc && rq && /*#__PURE__*/React.createElement("div", {
    className: "or-aside"
  }, '\u201c' + rq.prompt + '\u201d', " \u2014 it called ", /*#__PURE__*/React.createElement("b", null, rq.options[rc.pred].label), ". ", rc.pred === rc.mine ? 'You did too.' : /*#__PURE__*/React.createElement(React.Fragment, null, "You said ", /*#__PURE__*/React.createElement("b", null, rq.options[rc.mine].label), ".")))), /*#__PURE__*/React.createElement("div", {
    className: "or-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "or-next",
    onClick: onReset
  }, "Start over")));
}

// the called half fills from the bottom to the oracle's confidence: the region
// of that half-disc below the water line, as one path
function orFillPath(side, conf) {
  const R = OR_C,
    y0 = OR_S - conf * OR_S;
  const dx = Math.sqrt(Math.max(0, R * R - (y0 - R) * (y0 - R)));
  const x1 = side === 0 ? R - dx : R + dx,
    sweep = side === 0 ? 0 : 1;
  return 'M ' + R + ' ' + y0.toFixed(1) + ' L ' + x1.toFixed(1) + ' ' + y0.toFixed(1) + ' A ' + R + ' ' + R + ' 0 0 ' + sweep + ' ' + R + ' ' + 2 * R + ' Z';
}
function OracleLens({
  onUse,
  guide
}) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => window.PAT.sub(force), []);
  const [rec, setRec] = React.useState(null); // the reveal, held until you move on
  const [landed, setLanded] = React.useState(false); // the verdict has resolved
  const [why, setWhy] = React.useState(false);
  const [sel, setSel] = React.useState(null); // a recalled ledger mark
  const Q = window.PAT.qs();
  const qOf = id => Q.find(q => q.id === id);
  const curQ = rec ? qOf(rec.q) : window.PAT.nextQ();
  const log = window.PAT.log();
  // the sealed reading, taken once per question so the disc does not resize
  // under you at the reveal
  const pre = React.useMemo(() => curQ ? window.PAT.oracleFor(curQ.id) : null, [curQ && curQ.id]);
  React.useEffect(() => {
    if (!rec) {
      setLanded(false);
      return;
    }
    const t = setTimeout(() => {
      setLanded(true);
      if (window.HAPTIC) window.HAPTIC.tick();
    }, orQuiet() ? 60 : OR_LAND_MS);
    return () => clearTimeout(t);
  }, [rec]);
  const next = () => {
    setRec(null);
    setWhy(false);
    setSel(null);
  };
  if (!curQ) return /*#__PURE__*/React.createElement(OrDone, {
    log: log,
    qOf: qOf,
    onReset: () => window.PAT.reset()
  });
  const t = orTopic(curQ.cat);
  const tint = t ? window.WPAL.c(t.color) : null;
  const th = t ? orHue(t.color) : null;
  const brokeIt = rec && rec.pred !== rec.mine;
  const conf = rec ? rec.conf : pre ? pre.conf : 0.5;
  const sol = Math.min(1, Math.pow(Math.max(0, pre ? pre.mass : 0) / OR_MASS_FULL, OR_MASS_GAMMA)); // 0 = guessing on nothing
  const dR = 15 + Math.min(1, Math.max(0, (conf - 0.5) / 0.45)) * 11; // the disc: 15–26
  const discX = rec ? orSeat(rec.pred) : OR_C,
    discY = OR_C + 66;
  const discOp = 0.35 + 0.65 * sol;
  const rc = sel != null ? log[sel] : null,
    rq = rc && qOf(rc.q);
  // the working: the sealed reading rebuilt in the open, evidence counted live
  const work = why && rec && !rc && window.PAT.working ? window.PAT.working(rec.q) : null;
  const evFill = th != null ? 'oklch(0.78 0.07 ' + th + ')' : 'color-mix(in oklab, var(--ink), var(--surface-2) 35%)';
  const answer = i => {
    if (rec) return;
    const r = window.PAT.answer(curQ.id, i);
    if (!r) return;
    if (window.HAPTIC) window.HAPTIC.tick();
    setRec(r);
    if (onUse) onUse();
  };
  const labelOf = i => String(curQ.options[i].label || '').toUpperCase();
  const two = curQ.options.length === 2;
  return /*#__PURE__*/React.createElement("div", {
    className: "or-lens"
  }, /*#__PURE__*/React.createElement("div", {
    key: curQ.id,
    className: "ln-card fade-in",
    style: {
      padding: '14px 4px 12px',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, t && /*#__PURE__*/React.createElement("span", {
    className: "pt-cat",
    style: {
      background: window.WPAL.wash(tint, 16),
      color: window.WPAL.ink(t.color)
    }
  }, t.label), /*#__PURE__*/React.createElement("span", {
    className: "pt-kick"
  }, window.PAT.stats().answered, " of ", window.PAT.stats().total), rec ? /*#__PURE__*/React.createElement("button", {
    onClick: next,
    style: {
      marginLeft: 'auto',
      border: 'none',
      background: 'var(--ink)',
      color: 'var(--surface)',
      borderRadius: 999,
      padding: '6px 14px',
      cursor: 'pointer',
      fontFamily: 'var(--sans)',
      fontSize: 12.5,
      fontWeight: 700,
      letterSpacing: '-0.01em',
      WebkitAppearance: 'none'
    }
  }, "Next ", '\u2192') : null), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '8px 0 0',
      fontFamily: 'var(--serif)',
      fontSize: 24,
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      color: 'var(--ink)',
      textWrap: 'pretty'
    }
  }, curQ.prompt), !rec && guide && /*#__PURE__*/React.createElement("div", {
    className: "or2-how",
    style: {
      marginTop: 12,
      padding: '10px 0',
      borderTop: '1px dashed var(--rule)',
      borderBottom: '1px dashed var(--rule)'
    },
    "aria-label": "How the oracle works: it guesses your side sealed, you tap a half, then you see whether it had you"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "or2-g or2-g1"
  }), "1 \xB7 it guesses, sealed"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "or2-g or2-g2"
  }), "2 \xB7 you tap a half"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "or2-g or2-g3"
  }, '\u2713'), "3 \xB7 did it have you?")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ln-field is-bare",
    style: {
      flex: '1 1 0px',
      width: 'auto',
      minHeight: 190,
      maxHeight: 300,
      maxWidth: '100%',
      aspectRatio: '1 / 1'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    className: "ln-svg",
    viewBox: '0 0 ' + OR_S + ' ' + OR_S,
    role: "group",
    "aria-label": rec ? 'It called ' + curQ.options[rec.pred].label + '; you said ' + curQ.options[rec.mine].label : 'Its guess is sealed — pick a side',
    onClick: rec ? next : undefined,
    style: rec ? {
      cursor: 'pointer'
    } : undefined
  }, rec && /*#__PURE__*/React.createElement("path", {
    key: 'f' + rec.q,
    className: "or2-fill",
    d: orFillPath(rec.pred, rec.conf),
    fill: "var(--ln-beacon)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: OR_C,
    cy: OR_C,
    r: OR_C - 0.5,
    fill: "none",
    stroke: "var(--ln-ink)",
    strokeOpacity: "0.16",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("line", {
    x1: OR_C,
    y1: "0",
    x2: OR_C,
    y2: OR_S,
    stroke: "var(--ln-ink)",
    strokeOpacity: "0.16",
    strokeWidth: "1"
  }), two && curQ.options.map((op, i) => {
    const cx = orSeat(i),
      mine = rec && rec.mine === i,
      called = rec && rec.pred === i;
    return /*#__PURE__*/React.createElement("g", {
      key: i,
      className: rec ? undefined : 'or2-half',
      onClick: e => {
        if (!rec) {
          e.stopPropagation();
          answer(i);
        }
      }
    }, /*#__PURE__*/React.createElement("path", {
      className: "or2-halfbg",
      d: i === 0 ? 'M 140 0 A 140 140 0 0 0 140 280 Z' : 'M 140 0 A 140 140 0 0 1 140 280 Z',
      fill: "var(--ln-beacon)",
      fillOpacity: mine && !landed ? 0.08 : 0
    }), orLines(op.label).map((ln, k, arr) => /*#__PURE__*/React.createElement("text", {
      key: k,
      x: cx,
      y: OR_C - 34 + (k - (arr.length - 1) / 2) * 24,
      fill: called || !rec ? 'var(--ln-ink)' : 'var(--ln-sub)',
      textAnchor: "middle",
      dominantBaseline: "central",
      style: {
        fontSize: arr.some(w => w.length > 9) ? 17 : 20,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        fontFamily: 'var(--serif)'
      }
    }, ln)), mine && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      x: cx - 16,
      y: "152",
      width: "32",
      height: "16",
      rx: "8",
      fill: "var(--ln-beacon)"
    }), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: "160",
      fill: "var(--ln-halo)",
      textAnchor: "middle",
      dominantBaseline: "central",
      style: {
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '.08em'
      }
    }, "YOU")));
  }), rec && /*#__PURE__*/React.createElement("g", {
    style: {
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: OR_C,
    cy: discY,
    r: dR,
    fill: "none",
    stroke: "var(--ln-ring)",
    strokeWidth: "1.2",
    strokeDasharray: "3 4"
  })), /*#__PURE__*/React.createElement("g", {
    className: "or2-disc",
    style: {
      transform: 'translate(' + discX + 'px, ' + discY + 'px)',
      pointerEvents: rec ? 'auto' : 'none',
      cursor: rec ? 'pointer' : 'default'
    },
    onClick: e => {
      if (!rec) return;
      e.stopPropagation();
      setSel(null);
      setWhy(!why);
    },
    role: rec ? 'button' : undefined,
    "aria-label": rec ? why ? 'Hide the evidence' : 'Why it called ' + curQ.options[rec.pred].label : undefined
  }, !rec && /*#__PURE__*/React.createElement("circle", {
    className: "ln-pulse",
    cx: "0",
    cy: "0",
    r: dR,
    fill: "none",
    stroke: "var(--ln-beacon)",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "0",
    cy: "0",
    r: dR + 10,
    fill: "var(--ln-beacon)",
    opacity: rec ? 0.18 : 0.1
  }), landed && brokeIt ? /*#__PURE__*/React.createElement("circle", {
    cx: "0",
    cy: "0",
    r: dR - 3,
    fill: "none",
    stroke: "var(--ln-beacon)",
    strokeWidth: Math.max(4, dR * 0.34),
    opacity: discOp
  }) : /*#__PURE__*/React.createElement("circle", {
    cx: "0",
    cy: "0",
    r: dR,
    fill: "var(--ln-beacon)",
    opacity: discOp
  }))))), !two && !rec && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      marginTop: 12
    }
  }, curQ.options.map((op, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "qm-opt",
    onClick: () => answer(i)
  }, op.label))), (rec || guide) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 12
    }
  }, rec ? /*#__PURE__*/React.createElement("p", {
    className: "or2-verdict",
    style: {
      flex: 1,
      margin: 0
    }
  }, "It called ", /*#__PURE__*/React.createElement("b", null, curQ.options[rec.pred].label), ", ", orSure(rec.conf), ". You said ", curQ.options[rec.mine].label, ". ", landed ? brokeIt ? /*#__PURE__*/React.createElement("b", null, "You broke it.") : /*#__PURE__*/React.createElement("b", null, "It had you.") : '\u2026', landed && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)'
    }
  }, " ", brokeIt ? 'A broken ring means you surprised it.' : 'A solid disc means it had you.')) : /*#__PURE__*/React.createElement("p", {
    className: "or2-verdict",
    style: {
      flex: 1,
      margin: 0,
      color: 'var(--ink-3)'
    }
  }, "A bigger disc means it is surer; a fainter one has little to go on."), rec && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setSel(null);
      setWhy(!why);
    },
    style: {
      flex: 'none',
      border: 'none',
      background: 'none',
      padding: '2px 0',
      cursor: 'pointer',
      fontFamily: 'var(--sans)',
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--accent-ink)',
      WebkitAppearance: 'none'
    }
  }, why ? 'Hide' : 'Why? \u2192')), rc && rq && /*#__PURE__*/React.createElement("div", {
    className: "or-aside",
    style: {
      marginTop: 10
    }
  }, '\u201c' + rq.prompt + '\u201d', " \u2014 it called ", /*#__PURE__*/React.createElement("b", null, rq.options[rc.pred].label), ". ", rc.pred === rc.mine ? 'You did too.' : /*#__PURE__*/React.createElement(React.Fragment, null, "You said ", /*#__PURE__*/React.createElement("b", null, rq.options[rc.mine].label), ".")), why && !rc && rec && /*#__PURE__*/React.createElement("div", {
    className: "or-proof",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "or-proof-kick"
  }, "its working"), work && work.rows.length ? work.rows.map((r, k) => {
    const evq = qOf(r.id);
    if (!evq) return null;
    const sh = r.t.share[rec.pred];
    const wmax = work.rows[0].w || 1;
    return /*#__PURE__*/React.createElement("div", {
      className: "or-ev",
      key: r.id,
      style: {
        animationDelay: k * 80 + 'ms'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "or-ev-q"
    }, "You said ", /*#__PURE__*/React.createElement("b", null, evq.options[r.t.side].label), '\u2009\u2014\u2009', '\u201c' + evq.prompt + '\u201d'), /*#__PURE__*/React.createElement("span", {
      className: "or-ev-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "or-ev-bar"
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: Math.round(sh * 100) + '%',
        background: evFill,
        opacity: 0.55 + 0.45 * Math.min(1, r.w / wmax)
      }
    }), /*#__PURE__*/React.createElement("em", null)), /*#__PURE__*/React.createElement("span", {
      className: "or-ev-word"
    }, orWord(sh), " pick ", /*#__PURE__*/React.createElement("b", null, curQ.options[rec.pred].label), " ", '\u00b7', " ", r.t.n, " counted")));
  }) : /*#__PURE__*/React.createElement("span", {
    className: "or-ev-none"
  }, "Nothing in your answers pointed either way here ", '\u2014', " it guessed at the coin, and the faint disc says so."), /*#__PURE__*/React.createElement("span", {
    className: "or-proof-base"
  }, "sealed before your tap ", '\u00b7', " counted only from answers you", '\u2019', "d already given ", '\u00b7', " the mark is the coin")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      marginTop: 12,
      paddingTop: 10,
      borderTop: '1px solid var(--rule)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pt-kick"
  }, "Your record ", '\u00b7', " ", log.length, " answer", log.length === 1 ? '' : 's', guide && /*#__PURE__*/React.createElement(React.Fragment, null, " ", '\u00b7', " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: 0
    }
  }, "up = you broke it, tick = it had you"))), /*#__PURE__*/React.createElement(OrLedger, {
    log: log,
    qOf: qOf,
    sel: sel,
    onPick: k => {
      setSel(k);
      setWhy(false);
    }
  }))));
}
Object.assign(window, {
  OracleLens
});