
class Component extends DCLogic {
  state = { P: null, st: 'composing', scope: 1, cur: 'EUR', prompt: '', qtype: 'vote', opts: ['', ''], axis: '', drag: false };
  TYPES = [
    { key: 'vote', label: 'Pick one', hint: '2–4 options · the split', min: 2, max: 4, ph: ['One side', 'The other', 'A third', 'A fourth'], add: 'option' },
    { key: 'rank', label: 'Rank', hint: '3–4 items · order vs the crowd', min: 3, max: 4, ph: ['First item', 'Second', 'Third', 'Fourth'], add: 'item' },
    { key: 'scale', label: 'Agree', hint: 'a statement · 5-step scale', min: 0, max: 0 },
    { key: 'rating', label: 'Rate 1–10', hint: 'a “how much” · 1–10 histogram', min: 0, max: 0 },
  ];
  rulerRef = React.createRef();
  componentDidMount() {
    fetch((window.__resources && window.__resources.pricing) || 'ask-pricing.json').then(r => r.json()).then(P => this.setState({ P })).catch(() => {});
  }
  fmt(eur) {
    const P = this.state.P; const c = (P && P.fx[this.state.cur]) || { sym: '€', rate: 1, pre: true };
    let v = eur * c.rate;
    if (v >= 1000) v = Math.round(v / 100) * 100; else if (v >= 100) v = Math.round(v / 10) * 10; else if (v >= 1) v = Math.round(v); else v = Math.round(v * 100) / 100;
    const s = v >= 1 ? v.toLocaleString('en-US').replace(/,/g, ' ') : v.toFixed(2);
    return c.pre ? c.sym + s : s + ' ' + c.sym;
  }
  n(v) { return Math.round(v).toLocaleString('en-US').replace(/,/g, ' '); }
  scopeFromEvent(e) {
    const el = this.rulerRef.current; if (!el) return null;
    const r = el.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width;
    return f < 0.29 ? 0 : f < 0.71 ? 1 : 2;
  }
  renderVals() {
    const { P, cur, prompt, scope, qtype, opts, axis } = this.state;
    const T = this.TYPES.find(t => t.key === qtype) || this.TYPES[0];
    const SCALE = ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree'];
    const defaults = { vote: ['All night', 'The hours are fine'], rank: ['Bus', 'Tram', 'Metro', 'Bike'] };
    const optsShown = T.max ? opts.map((o, i) => o || (defaults[qtype] || [])[i] || T.ph[i]) : qtype === 'scale' ? [SCALE[0], '…', SCALE[4]] : ['1', '…', '10 = ' + (axis || 'completely')];
    const st = (this.props.state && this.props.state !== 'live') ? this.props.state : this.state.st;
    const dark = (this.props.quotePanel ?? 'dark indigo') === 'dark indigo';
    const ACC = 'oklch(0.52 0.14 265)', INK = 'oklch(0.216 0.011 70)', INK3 = 'oklch(0.472 0.010 68)', RULE = 'oklch(0.905 0.006 74)';
    const cap = P ? P.capEur : 320, base = P ? P.perAnswerBaseEur : 0.16, days = P ? P.refundDays : 29;
    const cohorts = P ? P.cohorts : [{ label: 'Oslo', index: 1.1 }, { label: 'Norway', index: 1.7 }, { label: 'Everyone', index: 2.5 }];
    const xs = [9, 50, 91], hs = [9, 12, 15];
    const rates = cohorts.map(c => base * c.index);
    const answers = rates.map(r => Math.floor(cap / r));
    const stops = cohorts.map((c, i) => ({
      label: c.label, x: xs[i], idx: '×' + c.index.toFixed(1), rate: this.fmt(rates[i]), perAnswer: 'per answer',
      answers: 'up to ' + this.n(answers[i]),
      priceSize: i === scope ? '19px' : '14px', priceColor: i === scope ? INK : INK3,
      tickW: i === scope ? '3px' : '1.5px', tickH: (i === scope ? 14 : hs[i]) + 'px', tickColor: i === scope ? ACC : 'color-mix(in oklch, ' + RULE + ', ' + INK + ' 30%)',
      labelWeight: i === scope ? 800 : 600, labelColor: i === scope ? INK : 'oklch(0.41 0.011 68)',
    }));
    const a = answers[scope], ex = Math.round(a * 0.67);
    const day = new Date(); day.setUTCDate(day.getUTCDate() + 1);
    const fmtDay = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' 00:00 UTC';
    const isPanel = ['quoted', 'paying', 'declined', 'held'].includes(st);
    const pBg = dark ? 'oklch(0.235 0.045 285)' : 'oklch(0.994 0.0025 80)';
    const pInk = dark ? 'oklch(0.965 0.006 80)' : INK;
    const setScope = i => this.setState({ scope: i });
    return {
      refundDays: days, signedIn: st !== 'signed-out', signedOut: st === 'signed-out',
      isComposing: st === 'composing' || st === 'signed-out',
      isPanel, isDeclined: st === 'declined', isHeld: st === 'held', isQuoted: st === 'quoted', isPaying: st === 'paying', isQuotedOrPaying: st === 'quoted' || st === 'paying',
      prompt, promptLen: prompt.length,
      onPrompt: e => this.setState({ prompt: e.target.value.slice(0, 120) }),
      promptShown: prompt || (qtype === 'scale' ? 'Oslo feels safe after dark.' : qtype === 'rating' ? 'How safe does Oslo feel after dark?' : qtype === 'rank' ? 'Rank how you would cross Oslo at night' : 'Should Oslo’s night buses run all night at weekends?'),
      types: this.TYPES.map(t => ({ label: t.label, pick: () => this.setState({ qtype: t.key, opts: Array.from({ length: Math.max(t.min, 2) }, (_, i) => this.state.opts[i] || '') }), bg: t.key === qtype ? INK : 'oklch(0.994 0.0025 80)', ink: t.key === qtype ? 'oklch(0.965 0.004 75)' : 'oklch(0.41 0.011 68)', border: t.key === qtype ? INK : RULE })),
      typeHint: T.hint, typeLabel: T.label, hasOptions: T.max > 0, isScale: qtype === 'scale', isRating: qtype === 'rating',
      opts: opts.map((v, i) => ({ value: v, num: i + 1, placeholder: T.ph ? T.ph[i] : '', onChange: e => { const o = this.state.opts.slice(); o[i] = e.target.value; this.setState({ opts: o }); }, removable: opts.length > T.min, remove: () => this.setState({ opts: this.state.opts.filter((_, j) => j !== i) }) })),
      canAddOpt: T.max > opts.length, addOpt: () => this.setState({ opts: this.state.opts.concat('') }), addLabel: T.add || '',
      scaleSteps: SCALE, ratingSteps: Array.from({ length: 10 }, (_, i) => String(i + 1)), axis, onAxis: e => this.setState({ axis: e.target.value }),
      optsShown,
      stops, thumbX: xs[scope], activeLabel: cohorts[scope].label, activeRate: this.fmt(rates[scope]), activeIdx: '×' + cohorts[scope].index.toFixed(1), activeAnswers: this.n(a),
      capText: this.fmt(cap), adBaseText: this.fmt(P ? P.adBaseEur : 320), baseRateText: this.fmt(base), floorText: '×' + (P ? P.floorIndex : 0.9).toFixed(1), ceilingText: '×' + (P ? P.ceilingIndex : 2.5).toFixed(1),
      zeroText: this.fmt(0), exampleAnswers: this.n(ex), exampleRefund: this.fmt((a - ex) * rates[scope]),
      sourceFile: P ? P.source : 'content/pricing.json', committed: P ? P.committed : '2026-09-02',
      lockUntil: fmtDay(day), heldUntil: fmtDay(day),
      rulerRef: this.rulerRef,
      onRulerDown: e => { const i = this.scopeFromEvent(e); if (i != null) setScope(i); this.setState({ drag: true }); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); },
      onRulerMove: e => { if (!this.state.drag) return; const i = this.scopeFromEvent(e); if (i != null && i !== this.state.scope) setScope(i); },
      onRulerUp: () => this.setState({ drag: false }),
      signIn: () => this.setState({ st: 'composing' }),
      quote: () => this.setState({ st: /kommune|council|mayor|ministry|government|parliament/i.test(prompt) ? 'declined' : 'quoted' }),
      pay: () => this.setState({ st: 'paying' }),
      backToCompose: () => this.setState({ st: 'composing' }),
      backToQuote: () => this.setState({ st: 'quoted' }),
      declineReason: 'Place-civic questions — anything asked in the voice of an authority — are put by the editors, not sold. Rephrase it as a question people can answer about their own lives, or write to us and we will read it by hand.',
      panelBg: pBg, panelInk: pInk,
      panelMuted: dark ? 'oklch(0.72 0.02 285)' : INK3, panelSoft: dark ? 'oklch(0.86 0.012 285)' : 'oklch(0.41 0.011 68)',
      panelRule: dark ? 'oklch(0.40 0.04 285)' : RULE, panelWell: dark ? 'oklch(0.29 0.045 285)' : 'oklch(0.965 0.004 75)',
      panelKicker: st === 'declined' ? 'reviewed' : st === 'held' ? 'review is down' : st === 'paying' ? 'leaving for stripe' : 'quoted · price locked',
      panelStatus: st === 'declined' ? 'declined' : st === 'held' ? 'held' : st === 'paying' ? 'paying' : 'ready to pay',
      dotColor: st === 'declined' ? 'oklch(0.62 0.15 40)' : st === 'held' ? 'oklch(0.75 0.13 85)' : 'oklch(0.72 0.12 150)',
      dotAnim: st === 'paying' || st === 'held' ? 'ask-pulse 1.4s ease infinite' : 'none',
      currencies: ['EUR', 'NOK'].map(code => ({ code, pick: () => this.setState({ cur: code }), bg: code === cur ? INK : 'transparent', ink: code === cur ? 'oklch(0.965 0.004 75)' : INK3, border: code === cur ? INK : RULE })),
    };
  }
}
