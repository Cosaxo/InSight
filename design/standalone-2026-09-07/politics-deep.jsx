// politics-deep.jsx — the compass in depth: six axes first, eighteen positions
// behind them (three per axis, two questions each). Level one lives on the
// Politics tab as six rows (axis · side · reading · your positions as dots on
// one 0–100 track, a hollow ring where most people sit). Tapping a row unfolds
// the axis in place; an axis you haven't gone deep on shows its three empty
// positions and offers the six questions right there. One axis open at a time.
// Answers persist, and once an axis has positions its compass score becomes
// their mean, so level one and level two never disagree.
(function () {
  const INK = 'var(--c-world)'; // the compass's colour everywhere else in the app
  const KEY = 'insight.politicsDeep.v1';

  // score runs 0 → 100 from the first pole to the second, like the axis itself
  const AXES = [{
    id: 'econ',
    name: 'Economic',
    poles: ['left', 'right'],
    def: 'The economic axis is about how far the state should shape who gets what: taxing and spending, rules on business, and who provides the basics.',
    positions: [{
      id: 'redis',
      name: 'Redistribution',
      lo: 'tax and transfer',
      hi: 'keep what you earn',
      avg: 46,
      qs: [{
        q: 'Higher earners should pay a much larger share in tax.',
        invert: true
      }, {
        q: 'People should keep more of what they earn, even if inequality grows.'
      }],
      text: 'Whether the state should move money from those with more to those with less. Toward the left you back higher taxes at the top and stronger transfers; toward the right you would rather people keep what they earn, even at the cost of inequality.'
    }, {
      id: 'reg',
      name: 'Regulation',
      lo: 'rules on business',
      hi: 'let markets run',
      avg: 52,
      qs: [{
        q: 'Businesses need firm rules to behave well.',
        invert: true
      }, {
        q: 'Most regulation does more harm than good.'
      }],
      text: 'How tightly business should be bound by rules. Left of centre trusts rules over market discipline; right of centre expects competition to sort out most of what regulation tries to fix.'
    }, {
      id: 'pub',
      name: 'Public services',
      lo: 'state-provided',
      hi: 'privately provided',
      avg: 52,
      qs: [{
        q: 'Health, schools and transport work best run by the state.',
        invert: true
      }, {
        q: 'Private providers usually deliver services better than governments.'
      }],
      text: 'Who should run the basics: health, schools, transport. One side wants them public whatever the cost; the other expects private providers to do them better and cheaper.'
    }]
  }, {
    id: 'auth',
    name: 'Authority',
    poles: ['liberty', 'order'],
    def: 'The authority axis is about how much order a society should impose on its members: what may be said, how closely people are watched, and how they may live.',
    positions: [{
      id: 'speech',
      name: 'Speech',
      lo: 'say anything',
      hi: 'some speech restricted',
      avg: 48,
      qs: [{
        q: 'People should be free to say things others find offensive.',
        invert: true
      }, {
        q: 'Some speech does enough harm that it should be banned.'
      }],
      text: 'Where the line on speech sits. The liberty end protects offensive and unpopular speech on principle; the order end holds that some speech does enough harm to be stopped.'
    }, {
      id: 'police',
      name: 'Policing & surveillance',
      lo: 'light touch',
      hi: 'strong security',
      avg: 58,
      qs: [{
        q: 'Cameras and data-gathering are a fair price for safety.'
      }, {
        q: 'The police already have more power than they need.',
        invert: true
      }],
      text: 'How much watching and enforcing is acceptable in the name of safety. Light touch means fewer cameras and narrower police powers; strong security accepts both as the price of order.'
    }, {
      id: 'private',
      name: 'Private life',
      lo: 'state stays out',
      hi: 'state sets norms',
      avg: 50,
      qs: [{
        q: 'What adults do in private is none of the state\u2019s business.',
        invert: true
      }, {
        q: 'Society is right to set limits on how people live.'
      }],
      text: 'Whether the state has any say in how adults live. One end keeps it out of private life entirely; the other thinks society is right to set some limits.'
    }]
  }, {
    id: 'foreign',
    name: 'Foreign',
    poles: ['national', 'global'],
    def: 'The foreign axis is about where obligations end: at the border, or well past it.',
    positions: [{
      id: 'borders',
      name: 'Borders',
      lo: 'tighter',
      hi: 'more open',
      avg: 42,
      qs: [{
        q: 'Immigration should be lower than it is now.',
        invert: true
      }, {
        q: 'People should be freer to move between countries.'
      }],
      text: 'How open the border should be. The national end wants less immigration than now; the global end wants people freer to move.'
    }, {
      id: 'aid',
      name: 'Aid & alliances',
      lo: 'own country first',
      hi: 'share the burden',
      avg: 50,
      qs: [{
        q: 'We should look after our own before helping other countries.',
        invert: true
      }, {
        q: 'Rich countries owe real help to poorer ones.'
      }],
      text: 'Whether a country owes anything to others. One end puts its own people first, always; the other holds that rich countries carry real obligations to poorer ones.'
    }, {
      id: 'trade',
      name: 'Trade',
      lo: 'protect',
      hi: 'free trade',
      avg: 52,
      qs: [{
        q: 'Protecting local industry is worth paying more for goods.',
        invert: true
      }, {
        q: 'Free trade makes everyone better off in the end.'
      }],
      text: 'Protection or free trade. The national end accepts higher prices to shelter local industry; the global end expects open trade to leave everyone better off.'
    }]
  }, {
    id: 'env',
    name: 'Environment',
    poles: ['growth', 'green'],
    def: 'The environment axis is about urgency: how much to give up now for the climate, wild places, and clean air.',
    positions: [{
      id: 'climate',
      name: 'Climate',
      lo: 'gradual',
      hi: 'act now',
      avg: 58,
      qs: [{
        q: 'Climate change is an emergency that justifies drastic action.'
      }, {
        q: 'We are moving faster on climate than we can afford.',
        invert: true
      }],
      text: 'How fast to move on climate. Gradual means change at a pace the economy can absorb; act now treats it as an emergency worth real cost.'
    }, {
      id: 'land',
      name: 'Land & wildlife',
      lo: 'use',
      hi: 'conserve',
      avg: 56,
      qs: [{
        q: 'Wild places should be protected even when they could be put to use.'
      }, {
        q: 'Land is there to be used, not fenced off.',
        invert: true
      }],
      text: 'What land is for. One end sees it as something to use; the other protects wild places even when they could be put to work.'
    }, {
      id: 'growth',
      name: 'Growth trade-off',
      lo: 'jobs first',
      hi: 'green rules hold',
      avg: 51,
      qs: [{
        q: 'A cleaner environment is worth slower growth.'
      }, {
        q: 'When jobs and green rules clash, jobs should win.',
        invert: true
      }],
      text: 'What gives when jobs and green rules collide. Jobs first accepts slower environmental progress to protect work; green rules hold accepts slower growth.'
    }]
  }, {
    id: 'tech',
    name: 'Technology',
    poles: ['caution', 'optimism'],
    def: 'The technology axis is about trust in what is new: whether to slow it down and check, or let it run and adapt.',
    positions: [{
      id: 'ai',
      name: 'AI & automation',
      lo: 'slow it down',
      hi: 'let it run',
      avg: 54,
      qs: [{
        q: 'AI should be allowed to develop with few limits.'
      }, {
        q: 'Automation is taking more from people than it gives.',
        invert: true
      }],
      text: 'What to do about machines that think and work. Caution wants limits and a slower pace; optimism expects the gains to outweigh what is lost.'
    }, {
      id: 'bio',
      name: 'Bio & medicine',
      lo: 'caution',
      hi: 'embrace',
      avg: 60,
      qs: [{
        q: 'Editing genes to prevent disease should go ahead.'
      }, {
        q: 'We should be very careful about altering human biology.',
        invert: true
      }],
      text: 'How far to go with altering biology. One end is wary of touching human biology at all; the other would edit genes to prevent disease and keep going.'
    }, {
      id: 'data',
      name: 'Data & privacy',
      lo: 'privacy first',
      hi: 'convenience first',
      avg: 66,
      qs: [{
        q: 'I\u2019d trade some privacy for services that work better.'
      }, {
        q: 'Companies collect far too much data about us.',
        invert: true
      }],
      text: 'The trade between privacy and convenience. Privacy first thinks companies already know too much; convenience first will trade some privacy for things that work better.'
    }]
  }, {
    id: 'estab',
    name: 'Populism',
    poles: ['establishment', 'outsider'],
    def: 'The populism axis is about who should be trusted to decide: institutions and experts, or the people directly.',
    positions: [{
      id: 'inst',
      name: 'Institutions',
      lo: 'trust',
      hi: 'distrust',
      avg: 52,
      qs: [{
        q: 'Courts, parliaments and the press mostly do their jobs.',
        invert: true
      }, {
        q: 'Our institutions serve themselves, not the public.'
      }],
      text: 'Whether courts, parliaments and the press deserve trust. The establishment end thinks they mostly do their jobs; the outsider end thinks they serve themselves.'
    }, {
      id: 'experts',
      name: 'Experts & elites',
      lo: 'defer',
      hi: 'suspect',
      avg: 50,
      qs: [{
        q: 'On hard questions, experts should carry more weight than public opinion.',
        invert: true
      }, {
        q: 'Experts are often wrong and rarely held to account.'
      }],
      text: 'How much weight expertise should carry. Defer gives experts the last word on hard questions; suspect thinks they are often wrong and rarely answer for it.'
    }, {
      id: 'direct',
      name: 'Direct democracy',
      lo: 'representatives',
      hi: 'referendums',
      avg: 63,
      qs: [{
        q: 'Big decisions should go to a public vote, not politicians.'
      }, {
        q: 'Representatives make better decisions than referendums.',
        invert: true
      }],
      text: 'Who should take the big decisions. One end trusts elected representatives to decide; the other wants them put to a public vote.'
    }]
  }];
  window.POLITICS_DEEP = AXES;

  // demo: Mira has gone deep on three of the six (raw 0..4 answers, question order)
  const DEMO = {
    econ: [3, 1, 3, 2, 2, 2],
    foreign: [1, 2, 1, 3, 2, 3],
    env: [4, 1, 3, 1, 4, 1]
  };
  function loadAnswers() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {/* ignore */}
    return {
      ...DEMO,
      ...saved
    };
  }
  function saveAnswers(id, arr) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      s[id] = arr;
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {/* ignore */}
  }

  // six raw answers → three position scores, 0..100 from the first pole to the second
  function scorePositions(ax, ans) {
    return ax.positions.map((p, i) => {
      const vals = p.qs.map((q, k) => {
        const v = ans[i * 2 + k];
        const n = v == null ? 2 : v;
        return q.invert ? 4 - n : n;
      });
      return Math.round(vals.reduce((a, b) => a + b, 0) / (4 * vals.length) * 100);
    });
  }

  // the compass keeps its axis score equal to the mean of the three positions
  function syncAxis(id, scores) {
    const R = (window.IS_TEST_RESULTS || {}).political;
    if (!R || !R.dims) return;
    const mean = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const next = {
      ...R,
      dims: R.dims.map(d => d.id === id ? {
        ...d,
        value: mean
      } : d)
    };
    if (window.IS_persistTestResult) window.IS_persistTestResult('political', next);else window.IS_TEST_RESULTS.political = next;
  }
  const sideOf = (v, poles, mid) => v < 45 ? poles[0] : v > 55 ? poles[1] : mid;
  const polesOf = ax => (((window.RP_TESTS || {}).political || {}).poles || {})[ax.id] || ax.poles;
  const kicker = {
    fontFamily: 'var(--sans)',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)'
  };
  const bandStyle = {
    ...kicker,
    color: 'var(--ink-2)',
    whiteSpace: 'nowrap'
  };
  const capStyle = {
    fontFamily: 'var(--sans)',
    fontSize: 11.5,
    fontWeight: 600,
    color: 'var(--ink-3)'
  };

  // one shared 0–100 track: hairline, the hollow ring where most people sit, solid dots for you
  function Track({
    dots,
    avg,
    size,
    height
  }) {
    const h = height || 22;
    return /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'relative',
        height: h
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 2,
        marginTop: -1,
        borderRadius: 999,
        background: 'var(--surface-3)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '50%',
        left: `${avg}%`,
        transform: 'translate(-50%,-50%)',
        width: 10,
        height: 10,
        borderRadius: '50%',
        boxSizing: 'border-box',
        background: 'var(--surface)',
        border: '1.4px solid var(--ink-3)'
      }
    }), dots.map((v, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        position: 'absolute',
        top: '50%',
        left: `${v}%`,
        transform: 'translate(-50%,-50%)',
        width: size,
        height: size,
        borderRadius: '50%',
        background: INK,
        border: '2px solid var(--surface)'
      }
    })));
  }

  // the five-step agreement scale, compact enough to sit inside a row
  const SCALE = [{
    label: 'Strongly disagree',
    side: -1,
    strong: true
  }, {
    label: 'Disagree',
    side: -1
  }, {
    label: 'Neither',
    side: 0
  }, {
    label: 'Agree',
    side: 1
  }, {
    label: 'Strongly agree',
    side: 1,
    strong: true
  }];
  function Mark({
    side,
    strong
  }) {
    const d = side === 0 ? 8 : strong ? 16 : 12;
    const base = {
      width: d,
      height: d,
      borderRadius: '50%',
      flexShrink: 0,
      boxSizing: 'border-box'
    };
    if (side === 0) return /*#__PURE__*/React.createElement("span", {
      style: {
        ...base,
        border: '1.5px solid var(--ink-3)',
        opacity: 0.55
      }
    });
    if (side < 0) return /*#__PURE__*/React.createElement("span", {
      style: {
        ...base,
        border: `${strong ? 2.5 : 2}px solid color-mix(in oklch, ${INK} 62%, var(--rule))`
      }
    });
    return /*#__PURE__*/React.createElement("span", {
      style: {
        ...base,
        background: strong ? INK : `color-mix(in oklch, ${INK} 62%, var(--surface))`
      }
    });
  }

  // six questions, one at a time, inside the unfolded axis
  function Questions({
    ax,
    onDone,
    onCancel
  }) {
    const qs = ax.positions.flatMap(p => p.qs);
    const [step, setStep] = React.useState(0);
    const [ans, setAns] = React.useState([]);
    const choose = i => {
      const next = ans.slice();
      next[step] = i;
      setAns(next);
      if (step + 1 >= qs.length) onDone(next);else setStep(step + 1);
    };
    const q = qs[step];
    const p = ax.positions[Math.floor(step / 2)];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        paddingTop: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        display: 'flex',
        gap: 3
      }
    }, qs.map((_, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        flex: 1,
        height: 3,
        borderRadius: 2,
        background: i < step ? INK : i === step ? `color-mix(in oklch, ${INK} 45%, var(--surface-3))` : 'var(--surface-3)'
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: kicker
    }, p.name), /*#__PURE__*/React.createElement("span", {
      style: capStyle
    }, step + 1, " of ", qs.length)), /*#__PURE__*/React.createElement("div", {
      key: step,
      style: {
        marginTop: 8,
        fontFamily: 'var(--sans)',
        fontWeight: 800,
        fontSize: 19,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        color: 'var(--ink)',
        textWrap: 'pretty'
      }
    }, q.q), /*#__PURE__*/React.createElement("div", {
      role: "radiogroup",
      "aria-label": "How much do you agree",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginTop: 14
      }
    }, SCALE.map((o, i) => {
      const selected = ans[step] === i;
      const away = o.strong ? 11 : o.side === 0 ? 4 : 7;
      return /*#__PURE__*/React.createElement("button", {
        key: o.label,
        className: "press",
        onClick: () => choose(i),
        role: "radio",
        "aria-checked": selected,
        style: {
          padding: '10px 13px',
          textAlign: 'left',
          cursor: 'pointer',
          WebkitAppearance: 'none',
          appearance: 'none',
          boxShadow: 'none',
          background: selected ? `color-mix(in oklch, ${INK} 17%, var(--surface))` : `color-mix(in oklch, ${INK} ${away}%, var(--surface))`,
          border: selected ? `1.5px solid ${INK}` : `1px solid color-mix(in oklch, ${INK} ${o.strong ? 40 : 28}%, var(--rule))`,
          borderRadius: 14,
          fontFamily: 'var(--sans)',
          fontSize: 14.5,
          fontWeight: 700,
          color: 'var(--ink)',
          display: 'flex',
          gap: 12,
          alignItems: 'center'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 18,
          display: 'flex',
          justifyContent: 'center',
          flexShrink: 0
        }
      }, /*#__PURE__*/React.createElement(Mark, {
        side: o.side,
        strong: o.strong
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1
        }
      }, o.label));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => step > 0 ? setStep(step - 1) : onCancel(),
      style: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, step > 0 ? '\u2190 Back' : 'Not now')));
  }

  // ── level two: the axis unfolded under its row ──
  function AxisPanel({
    ax,
    dim,
    answers,
    onAnswered
  }) {
    const [open, setOpen] = React.useState(null);
    const [asking, setAsking] = React.useState(false);
    const poles = polesOf(ax);
    const scores = answers ? scorePositions(ax, answers) : null;
    const LW = 104,
      SW = 30; // label column, score column; the axis is the rest
    return /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--serif)',
        fontSize: 17.5,
        fontWeight: 500,
        lineHeight: 1.35,
        color: 'var(--ink)',
        textWrap: 'pretty'
      }
    }, ax.def), asking ? /*#__PURE__*/React.createElement(Questions, {
      ax: ax,
      onDone: arr => {
        setAsking(false);
        onAnswered(ax.id, arr);
      },
      onCancel: () => setAsking(false)
    }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 18,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: kicker
    }, "Positions"), /*#__PURE__*/React.createElement("span", {
      style: capStyle
    }, scores ? 'tap one to read it' : 'not placed yet')), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, ax.positions.map((p, i) => {
      const on = open === p.id;
      const v = scores ? scores[i] : null;
      const reading = v == null ? `${p.lo} \u2194 ${p.hi}` : sideOf(v, [p.lo, p.hi], 'near the middle');
      return /*#__PURE__*/React.createElement("div", {
        key: p.id,
        style: {
          borderTop: '0.5px solid var(--rule)'
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "press",
        onClick: () => setOpen(on ? null : p.id),
        "aria-expanded": on,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          width: '100%',
          textAlign: 'left',
          padding: '10px 0',
          border: 'none',
          background: 'none',
          color: 'inherit',
          cursor: 'pointer',
          WebkitAppearance: 'none',
          appearance: 'none'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: LW,
          flexShrink: 0,
          paddingRight: 10,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--sans)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
          lineHeight: 1.2,
          textWrap: 'balance'
        }
      }, p.name), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--sans)',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--ink-2)',
          lineHeight: 1.3,
          textWrap: 'pretty'
        }
      }, reading)), /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          position: 'relative',
          height: 22
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 2,
          marginTop: -1,
          borderRadius: 999,
          background: 'var(--surface-3)'
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          top: '50%',
          left: `${p.avg}%`,
          transform: 'translate(-50%,-50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          boxSizing: 'border-box',
          background: 'var(--surface)',
          border: '1.4px solid var(--ink-3)'
        }
      }), v != null ? /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          top: '50%',
          left: `${v}%`,
          transform: 'translate(-50%,-50%)',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: INK,
          border: '2px solid var(--surface)'
        }
      }) : null), /*#__PURE__*/React.createElement("span", {
        style: {
          width: SW,
          flexShrink: 0,
          textAlign: 'right',
          fontFamily: 'var(--sans)',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
          color: v == null ? 'var(--ink-3)' : 'var(--ink)'
        }
      }, v == null ? '\u2013' : v)), on ? /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '0 0 14px',
          fontFamily: 'var(--sans)',
          fontSize: 13.5,
          fontWeight: 500,
          lineHeight: 1.55,
          color: 'var(--ink-2)',
          textWrap: 'pretty'
        }
      }, p.text) : null);
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 6,
        paddingLeft: LW,
        paddingRight: SW,
        borderTop: '0.5px solid var(--rule)',
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--ink-3)'
      }
    }, /*#__PURE__*/React.createElement("span", null, poles[0]), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        textTransform: 'none',
        letterSpacing: 0,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: '1.4px solid var(--ink-3)'
      }
    }), "most people"), /*#__PURE__*/React.createElement("span", null, poles[1]))), scores ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setAsking(true),
      style: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "Answer again")) : /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => setAsking(true),
      style: {
        width: '100%',
        padding: '13px',
        marginTop: 14,
        cursor: 'pointer',
        WebkitAppearance: 'none',
        appearance: 'none',
        background: 'var(--ink)',
        color: 'var(--surface)',
        border: 'none',
        borderRadius: 14,
        fontFamily: 'var(--sans)',
        fontSize: 14.5,
        fontWeight: 700,
        letterSpacing: '-0.01em'
      }
    }, "Six questions place them ", '\u2192')));
  }

  // ── level one: six rows on the Politics tab; the open one unfolds in place ──
  function AxisRow({
    ax,
    dim,
    first,
    open,
    onToggle,
    answers,
    onAnswered
  }) {
    const poles = polesOf(ax);
    const scores = answers ? scorePositions(ax, answers) : null;
    const avg = ((window.IS_TEST_AVG || {}).political || {})[ax.id];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: first ? 'none' : '0.5px solid var(--rule)'
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => onToggle(ax.id),
      "aria-expanded": open,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '15px 0',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        color: 'inherit',
        WebkitAppearance: 'none',
        appearance: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.015em',
        color: 'var(--ink)'
      }
    }, ax.name), /*#__PURE__*/React.createElement("span", {
      style: bandStyle
    }, sideOf(dim.value, poles, 'centre'))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        fontWeight: 500,
        color: 'var(--ink-2)'
      }
    }, dim.blurb || `${poles[0]} \u2194 ${poles[1]}`), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(Track, {
      dots: scores || [dim.value],
      avg: avg != null ? avg : dim.avg != null ? dim.avg : 50,
      size: 10,
      height: 20
    }))), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        flexShrink: 0,
        display: 'inline-block',
        fontFamily: 'var(--sans)',
        fontSize: 20,
        lineHeight: 1,
        color: 'var(--ink-3)',
        transform: open ? 'rotate(90deg)' : 'none',
        transition: 'transform 0.22s var(--ease-out)'
      }
    }, '\u203a')), open ? /*#__PURE__*/React.createElement(AxisPanel, {
      ax: ax,
      dim: dim,
      answers: answers,
      onAnswered: onAnswered
    }) : null);
  }
  function PoliticsDeep() {
    const [open, setOpen] = React.useState(null);
    const [answers, setAnswers] = React.useState(loadAnswers);
    const R = (window.IS_TEST_RESULTS || {}).political;
    if (!R || !R.dims || !R.dims.length) return null;
    const placed = AXES.filter(a => answers[a.id]).length;
    const toggle = id => setOpen(cur => cur === id ? null : id);
    const onAnswered = (id, arr) => {
      saveAnswers(id, arr);
      setAnswers(a => ({
        ...a,
        [id]: arr
      }));
      const ax = AXES.find(x => x.id === id);
      if (ax) syncAxis(id, scorePositions(ax, arr));
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 26
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 4,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: kicker
    }, "In depth"), /*#__PURE__*/React.createElement("span", {
      style: capStyle
    }, "six axes ", '\u00b7', " ", placed < AXES.length ? `${placed * 3} of 18 positions placed` : 'eighteen positions')), /*#__PURE__*/React.createElement("div", null, AXES.map((ax, i) => {
      const dim = R.dims.find(d => d.id === ax.id);
      return dim ? /*#__PURE__*/React.createElement(AxisRow, {
        key: ax.id,
        ax: ax,
        dim: dim,
        first: i === 0,
        open: open === ax.id,
        onToggle: toggle,
        answers: answers[ax.id] || null,
        onAnswered: onAnswered
      }) : null;
    })));
  }
  window.PoliticsDeep = PoliticsDeep;
})();