// InSight — TestOverlay: pick a test, answer, see the result. Question banks
// and persistence live in test-defs.js. Results autosave the moment the last
// question lands, and a finished test opens its saved result (ResultProfileCard
// — the same treatment the profile tabs use) instead of sitting inert.
const TEST_PROGRESS_KEY = 'insight.testProgress.v1';

// One tick per question — filled = answered, here or passively in the feed.
// The same strip runs across a picker card and above the questions, so
// "how far in am I" needs no number.
function TickStrip({
  n,
  filled,
  accent,
  height = 3,
  gap = 2,
  cur = -1
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap
    },
    "aria-hidden": "true"
  }, Array.from({
    length: n
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height,
      borderRadius: height > 2 ? 999 : 0,
      background: i < filled ? accent : i === cur ? `color-mix(in oklch, ${accent} 45%, var(--surface-3))` : `color-mix(in oklch, ${accent} 12%, var(--surface-3))`,
      transition: 'background 0.25s ease'
    }
  })));
}

// The likert scale, drawn as a scale: mark size = how strong, fill = which way.
// Both ends are emphatic, the middle is small — so the row of marks reads
// before any of the words do.
const IS_SCALE = [{
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
function ScaleMark({
  side,
  strong,
  accent
}) {
  const d = side === 0 ? 9 : strong ? 20 : 14;
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
      border: `${strong ? 2.5 : 2}px solid color-mix(in oklch, ${accent} 62%, var(--rule))`
    }
  });
  return /*#__PURE__*/React.createElement("span", {
    style: {
      ...base,
      background: strong ? accent : `color-mix(in oklch, ${accent} 62%, var(--surface))`
    }
  });
}
function TestOverlay({
  onClose,
  onComplete,
  kind: initialKind
}) {
  const [kind, setKind] = React.useState(null);
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState([]);
  const [dir, setDir] = React.useState(1); // +1 forward, -1 back — drives the slide direction
  const [explain, setExplain] = React.useState(null); // testKey whose ⓘ sheet is open
  const [savedView, setSavedView] = React.useState(false); // viewing a stored result
  const entry = React.useRef(initialKind ? 'direct' : 'pick').current;

  // one sheet spec for every test: what it measures, how to read its marks
  const explainSheet = k => {
    const T2 = tests[k],
      cfg = (window.RP_TESTS || {})[k];
    if (!T2 || !window.ExplainSheet) return null;
    const dims = T2.dims.map(d => ({
      ...d,
      poles: cfg && cfg.poles ? cfg.poles[d.id] : null
    }));
    const G = window.EX_GLYPH;
    return /*#__PURE__*/React.createElement(window.ExplainSheet, {
      title: T2.title,
      kicker: "test",
      dimKey: k,
      dims: dims,
      keyRows: [[G.you(T2.accent), 'The solid dot is you.'], [G.most(), 'The hollow ring is where most people sit.'], [G.petal(T2.accent), cfg && cfg.bipolar ? 'Petal length is how far from the middle you sit — a long petal is a strong stance either way.' : 'Petal length is how strongly the trait shows.']],
      onClose: () => setExplain(null)
    });
  };

  // record an answer at the current step (replacing if revisited) and advance.
  // The last answer also SAVES the result then and there — closing with ✕ no
  // longer throws it away (completion was recorded either way).
  const choose = i => {
    const next = answers.slice();
    next[step] = i;
    setAnswers(next);
    setDir(1);
    setStep(step + 1);
    const TT = tests[kind];
    if (TT && step + 1 >= TT.questions.length && window.IS_persistTestResult) {
      window.IS_persistTestResult(kind, {
        title: TT.title,
        taken: 'just now',
        accent: TT.accent,
        dims: scoreTest(TT, next, kind)
      });
    }
  };
  const goBack = () => {
    setDir(-1);
    setStep(s => Math.max(0, s - 1));
  };

  // Keyboard: 1–5 to answer, ←/Backspace to revisit (active only during questions)
  React.useEffect(() => {
    const onKey = e => {
      if (!kind || savedView) return;
      const TT = tests[kind];
      if (!TT) return;
      if (step >= TT.questions.length) return;
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        choose(+e.key - 1);
      } else if ((e.key === 'Backspace' || e.key === 'ArrowLeft') && step > 0) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, step, savedView]);

  // Resume an unfinished test, or start clean, when a test is picked.
  // `fresh` forces a full retake — no resume, no passive prefill.
  const startTest = (k, fresh) => {
    let resume = null;
    if (!fresh) {
      try {
        const p = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}');
        if (p[k] && Array.isArray(p[k].answers) && p[k].answers.length) resume = p[k];
      } catch (e) {/* ignore */}
    }
    // no explicit progress → resume past what the feed already mapped
    // (a complete test starts clean = retake)
    let pre = null;
    if (!fresh && !resume && window.PASSIVE && !window.PASSIVE.complete(k) && window.PASSIVE.passiveDone(k) > 0) pre = window.PASSIVE.prefill(k);
    setSavedView(false);
    setKind(k);
    setAnswers(resume ? resume.answers : pre || []);
    setStep(resume ? resume.step : pre ? pre.length : 0);
    setDir(1);
  };

  // Jump straight into a specific test when opened with one (resumes saved
  // progress; a finished test opens its result instead of restarting).
  React.useEffect(() => {
    if (!initialKind) return;
    if ((window.IS_TEST_RESULTS || {})[initialKind]) {
      setKind(initialKind);
      setSavedView(true);
    } else startTest(initialKind);
  }, []);

  // Save in-progress answers so a refresh mid-test doesn't lose them.
  React.useEffect(() => {
    if (!kind || savedView) return;
    const TT = tests[kind];
    if (!TT) return;
    try {
      const p = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}');
      if (step >= TT.questions.length || answers.length === 0) delete p[kind];else p[kind] = {
        step,
        answers
      };
      localStorage.setItem(TEST_PROGRESS_KEY, JSON.stringify(p));
    } catch (e) {/* ignore */}
    if (window.PASSIVE) {
      if (step >= TT.questions.length) window.PASSIVE.markComplete(kind);else window.PASSIVE.poke();
    }
  }, [kind, step, answers, savedView]);
  const tests = window.IS_TESTS;

  // ─── result helpers ───
  function scoreTest(t, ans, k) {
    const totals = {};
    const counts = {};
    t.questions.forEach((q, i) => {
      const v = ans[i] ?? 2; // default neutral
      const norm = q.invert ? 4 - v : v; // 0..4
      totals[q.d] = (totals[q.d] || 0) + norm;
      counts[q.d] = (counts[q.d] || 0) + 1;
    });
    const pop = (window.IS_TEST_AVG || {})[k] || {};
    return t.dims.map(d => {
      const a = counts[d.id] ? totals[d.id] / counts[d.id] : 2;
      return {
        ...d,
        value: Math.round(a / 4 * 100),
        avg: pop[d.id] ?? 50
      };
    });
  }
  const finished = !!(kind && !savedView && tests[kind] && step >= tests[kind].questions.length);

  // ─── selection screen ───
  if (!kind) {
    const SAVED = window.IS_TEST_RESULTS || {};
    const minutesFor = T => Math.max(4, Math.round(T.questions.length * 0.7));
    let PROGRESS = {};
    try {
      PROGRESS = JSON.parse(localStorage.getItem(TEST_PROGRESS_KEY) || '{}');
    } catch (e) {}
    return /*#__PURE__*/React.createElement("div", {
      className: "overlay surface-tint"
    }, /*#__PURE__*/React.createElement("div", {
      className: "app-header"
    }, /*#__PURE__*/React.createElement("button", {
      className: "avatar-btn",
      onClick: onClose
    }, "\u2715"), /*#__PURE__*/React.createElement("div", {
      className: "h-title"
    }, "Take a ", /*#__PURE__*/React.createElement("em", null, "test")), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        flexShrink: 0
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "app-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "test-rows"
    }, Object.entries(tests).map(([k, T]) => {
      const saved = SAVED[k];
      const rp = (window.RP_TESTS || {})[k];
      const bip = !!(rp && rp.bipolar);
      // for bipolar tests "strongest" = most pronounced lean, not max score
      const top = saved ? [...saved.dims].sort((a, b) => bip ? Math.abs(b.value - 50) - Math.abs(a.value - 50) : b.value - a.value)[0] : null;
      const prog = PROGRESS[k];
      const inProgress = !saved && prog && prog.answers && prog.answers.length;
      const nQ = T.questions.length;
      const mapped = window.PASSIVE ? window.PASSIVE.done(k) : saved ? nQ : inProgress ? prog.step : 0;
      const partial = !!(saved && window.PASSIVE && !window.PASSIVE.complete(k));
      const chipBg = `color-mix(in oklch, ${T.accent} 9%, var(--surface-2))`;
      const chipBd = `color-mix(in oklch, ${T.accent} 28%, var(--rule))`;
      const chipFg = `color-mix(in oklch, ${T.accent} 55%, var(--ink-2))`;
      // a test with any result opens that result — the remaining
      // questions arrive through the feed, not a grind screen
      const go = () => saved ? (setKind(k), setSavedView(true)) : startTest(k);
      return /*#__PURE__*/React.createElement("div", {
        key: k,
        onClick: go,
        role: "button",
        tabIndex: 0,
        "aria-label": saved ? T.title + ' result' : (inProgress ? 'Continue ' : 'Start ') + T.title,
        onKeyDown: e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go();
          }
        },
        className: "test-row press"
      }, /*#__PURE__*/React.createElement("span", {
        className: "test-ring",
        "aria-hidden": "true",
        style: {
          background: `conic-gradient(${T.accent} ${Math.round(mapped / nQ * 100)}%, var(--rule) 0)`
        }
      }, /*#__PURE__*/React.createElement("span", null, (() => {
        const mt = saved && window.TypeMark && window.IS_matchArchetype && saved.dims ? window.IS_matchArchetype(k, saved.dims) : null;
        return mt ? React.createElement(window.TypeMark, {
          testKey: k,
          name: mt.list[mt.idx].name,
          size: 22,
          title: mt.list[mt.idx].name
        }) : /*#__PURE__*/React.createElement("i", {
          style: {
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: T.accent,
            display: 'block'
          }
        });
      })())), /*#__PURE__*/React.createElement("span", {
        className: "test-row-body"
      }, /*#__PURE__*/React.createElement("span", {
        className: "test-row-top"
      }, /*#__PURE__*/React.createElement("span", {
        className: "test-row-name"
      }, T.title), /*#__PURE__*/React.createElement("span", {
        className: "test-row-when",
        style: {
          color: saved ? chipFg : 'var(--ink-3)'
        }
      }, saved && window.TEST_PRIVACY && window.TEST_PRIVACY.isPrivate(k) ? /*#__PURE__*/React.createElement("span", {
        title: "Private",
        "aria-label": "Private",
        style: {
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--ink-2)',
          marginRight: 6,
          verticalAlign: 'middle'
        }
      }) : null, saved ? saved.taken : inProgress ? prog.step + ' of ' + nQ : '~' + minutesFor(T) + ' min')), /*#__PURE__*/React.createElement("span", {
        className: "test-row-read"
      }, saved ? (() => {
        const lead = (() => {
          if (!bip) return top.label + ' ' + top.value;
          const word = (rp.poles[top.id] || ['low', 'high'])[top.value >= 50 ? 1 : 0];
          return word.toLowerCase() === top.label.toLowerCase() ? top.label : top.label + ' \u00b7 ' + word;
        })();
        const mt = window.IS_matchArchetype && saved.dims ? window.IS_matchArchetype(k, saved.dims) : null;
        return (mt ? mt.list[mt.idx].name + ' \u00b7 ' : '') + lead.toLowerCase() + (partial ? ' \u00b7 early read' : '');
      })() : inProgress ? 'in progress \u00b7 ' + T.tag : T.tag)), /*#__PURE__*/React.createElement("span", {
        className: "test-row-go",
        "aria-hidden": "true"
      }, '\u2192'));
    }))), explain && explainSheet(explain));
  }
  const T = tests[kind];
  const qs = T.questions;
  const showResult = savedView || finished;
  const P = window.PASSIVE;
  const nLeft = P ? Math.max(0, P.needed(kind) - P.done(kind)) : 0;
  // a just-finished test is complete by definition — PASSIVE catches up in an
  // effect, so don't let its stale count offer to "finish" what just finished
  const partial = !finished && !!(P && !P.complete(kind) && nLeft > 0);
  const backToPick = () => {
    setSavedView(false);
    setKind(null);
    setStep(0);
    setAnswers([]);
  };

  // ── result: one canonical treatment (the same card the profile tabs show),
  // then a single dark CTA for whatever comes next ──
  if (showResult) {
    // No "finish the test" nudge — a partial picture fills itself in from the
    // feed. Retaking is only offered once the picture is whole.
    const cta = partial ? null : finished ? {
      text: 'Done',
      act: onComplete
    } : {
      text: 'Retake the test →',
      act: () => startTest(kind, true)
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "overlay surface-tint"
    }, /*#__PURE__*/React.createElement("div", {
      className: "app-header"
    }, /*#__PURE__*/React.createElement("button", {
      className: "avatar-btn",
      onClick: entry === 'pick' ? backToPick : onClose
    }, entry === 'pick' ? '←' : '✕'), /*#__PURE__*/React.createElement("div", {
      className: "h-title"
    }, T.title), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        flexShrink: 0
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "app-body",
      style: {
        paddingBottom: 32
      }
    }, window.ResultProfileCard ? /*#__PURE__*/React.createElement(window.ResultProfileCard, {
      testKey: kind,
      archetype: T.title
    }) : null, cta && /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: cta.act,
      style: {
        width: '100%',
        padding: '13px',
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
    }, cta.text), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'center',
        gap: 22,
        marginTop: cta ? 14 : 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: backToPick,
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
    }, "Another test"), !finished && /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
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
    }, "Close"), finished && !partial && /*#__PURE__*/React.createElement("button", {
      onClick: () => startTest(kind, true),
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
    }, "Retake"))));
  }

  // ── questions ──
  return /*#__PURE__*/React.createElement("div", {
    className: "overlay surface-tint"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "avatar-btn",
    onClick: onClose
  }, "\u2715"), /*#__PURE__*/React.createElement("div", {
    className: "h-title"
  }, T.title), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      flexShrink: 0
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "app-body",
    style: {
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(TickStrip, {
    n: qs.length,
    filled: step,
    cur: step,
    accent: T.accent,
    height: 3,
    gap: 3
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: 'auto 0',
      paddingBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: step,
    className: `q-slide ${dir < 0 ? 'q-slide-back' : 'q-slide-fwd'}`
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--sans)',
      fontWeight: 800,
      fontSize: 25,
      lineHeight: 1.15,
      letterSpacing: '-0.02em',
      textWrap: 'pretty',
      marginTop: 26
    }
  }, qs[step].q), /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "How much do you agree",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 26
    }
  }, IS_SCALE.map((o, i) => {
    const selected = answers[step] === i;
    const away = o.strong ? 11 : o.side === 0 ? 4 : 7; // tint ramps with strength, both ways
    return /*#__PURE__*/React.createElement("button", {
      key: o.label,
      className: "press",
      onClick: () => choose(i),
      role: "radio",
      "aria-checked": selected,
      style: {
        padding: '13px 15px',
        textAlign: 'left',
        background: selected ? `color-mix(in oklch, ${T.accent} 17%, var(--surface))` : `color-mix(in oklch, ${T.accent} ${away}%, var(--surface))`,
        border: selected ? `1.5px solid ${T.accent}` : `1px solid color-mix(in oklch, ${T.accent} ${o.strong ? 40 : 28}%, var(--rule))`,
        borderRadius: 16,
        cursor: 'pointer',
        boxShadow: 'none',
        WebkitAppearance: 'none',
        fontFamily: 'var(--sans)',
        fontSize: 15.5,
        fontWeight: 700,
        color: 'var(--ink)',
        display: 'flex',
        gap: 13,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 22,
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(ScaleMark, {
      side: o.side,
      strong: o.strong,
      accent: T.accent
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, o.label));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16
    }
  }, step > 0 ? /*#__PURE__*/React.createElement("button", {
    onClick: goBack,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--sans)',
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--ink-3)',
      padding: 0
    }
  }, "\u2190 Back") : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", {
    className: "kb-hint",
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--ink-3)'
    }
  }, "press 1\u20135 \xB7 \u2190 to revisit"))))), explain && explainSheet(explain));
}

// ─── A reusable card showing a saved test result (or a CTA to take it) ───
function TestResultCard({
  testKey,
  accent
}) {
  const R = (window.IS_TEST_RESULTS || {})[testKey];
  if (!R) return null;
  const top = [...R.dims].sort((a, b) => b.value - a.value)[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(Kicker, null, R.title, " \xB7 result"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 11,
      color: 'var(--ink-3)',
      letterSpacing: '0.1em'
    }
  }, R.taken)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      border: `1.2px solid ${accent || R.accent}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--sans)',
      fontSize: 18,
      color: accent || R.accent
    }
  }, top.value), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 11,
      color: 'var(--ink-3)',
      letterSpacing: '0.1em'
    }
  }, "STRONGEST"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 16
    }
  }, top.label), /*#__PURE__*/React.createElement("div", {
    className: "margin-note",
    style: {
      fontSize: 15,
      marginTop: 1
    }
  }, top.blurb))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, R.dims.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 90,
      fontFamily: 'var(--sans)',
      fontSize: 12
    }
  }, d.label), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 5,
      background: 'var(--surface-2)',
      border: '0.5px solid var(--rule)',
      borderRadius: 999
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${d.value}%`,
      background: accent || R.accent,
      borderRadius: 999
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      textAlign: 'right',
      fontFamily: 'var(--sans)',
      fontSize: 11,
      color: 'var(--ink-3)'
    }
  }, d.value)))));
}
Object.assign(window, {
  TestOverlay,
  TestResultCard,
  TickStrip
});