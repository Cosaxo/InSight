// Expanded Person profile — a detailed portrait of similarity
// Replaces the basic PersonOverlay registered in overlays.jsx

(function () {
  // deterministic 0..1 from any string — their drifted test values must be stable
  function poHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 8) % 100000 / 100000;
  }

  // ─── Deterministic derivation of a person's full profile from p ───
  function derivePerson(p, me) {
    const seed = key => {
      const s = String(p.id) + ':' + key;
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };
    // 0..1 from a seed
    const r = key => seed(key) % 100000 / 100000;
    // pull toward you, strength based on match
    const pull = Math.max(0, Math.min(1, (p.match - 35) / 65));

    // mix the user's value with deterministic noise; the higher the match, the closer
    const mix = (myVal, key, slack = 90) => {
      const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.7);
      return Math.max(-100, Math.min(100, myVal + drift));
    };
    const mixBig5 = (myVal, key, slack = 55) => {
      const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.6);
      return Math.max(2, Math.min(100, myVal + drift));
    };
    const big5 = {
      O: mixBig5(me.personality.O, 'b5O'),
      C: mixBig5(me.personality.C, 'b5C'),
      E: mixBig5(me.personality.E, 'b5E'),
      A: mixBig5(me.personality.A, 'b5A'),
      N: mixBig5(me.personality.N, 'b5N')
    };
    const political = {
      econ: mix(me.political.econ, 'pe'),
      social: mix(me.political.social, 'ps'),
      foreign: mix(me.political.foreign, 'pf'),
      env: mix(me.political.env, 'pv'),
      tech: mix(me.political.tech, 'pt'),
      auth: mix(me.political.auth, 'pa'),
      estab: mix(me.political.estab, 'pb')
    };
    const morals = {
      future: mix(me.morals.future, 'mf'),
      circle: mix(me.morals.circle, 'mc'),
      hedonism: mix(me.morals.hedonism, 'mh'),
      meaning: mix(me.morals.meaning, 'mm'),
      moral: mix(me.morals.moral, 'mr'),
      beauty: mix(me.morals.beauty, 'mb')
    };

    // chronotype + rhythm
    const chronoOpts = ['early bird', 'night owl', 'biphasic'];
    const chronotype = chronoOpts[seed('chrono') % 3];
    const sleepAvg = (6.4 + r('sleep') * 2.2).toFixed(1) + 'h';

    // closest ideology in econ × social
    const ideos = window.IS_DATA.ideologies;
    const closest = ideos.map(io => {
      const dx = io.econ - political.econ,
        dy = io.social - political.social;
      return {
        ...io,
        d: Math.sqrt(dx * dx + dy * dy)
      };
    }).sort((a, b) => a.d - b.d);
    return {
      big5,
      political,
      morals,
      chronotype,
      sleepAvg,
      closest
    };
  }

  // ─── Per-dimension similarity scores (0..100) used in the affinity composer ───
  function affinityBreakdown(me, prof, p) {
    // Big5: invert mean absolute distance (0..100 each axis)
    const b5keys = ['O', 'C', 'E', 'A', 'N'];
    const b5Diff = b5keys.reduce((s, k) => s + Math.abs(me.personality[k] - prof.big5[k]), 0) / b5keys.length;
    const personality = Math.max(0, 100 - b5Diff * 1.05);
    const polKeys = ['econ', 'auth', 'foreign', 'env', 'tech', 'estab'];
    const polDiff = polKeys.reduce((s, k) => s + Math.abs(me.political[k] - prof.political[k]), 0) / polKeys.length;
    const politics = Math.max(0, 100 - polDiff * 0.52);
    const mKeys = ['future', 'circle', 'hedonism', 'meaning', 'moral', 'beauty'];
    const moralDiff = mKeys.reduce((s, k) => s + Math.abs(me.morals[k] - prof.morals[k]), 0) / mKeys.length;
    const values = Math.max(0, 100 - moralDiff * 0.50);

    // interests overlap (by category id)
    const myCats = new Set(me.myInterests.map(i => i.c));
    const theirCats = new Set((p.interests || []).map(i => i.c));
    const inter = [...myCats].filter(c => theirCats.has(c)).length;
    const union = new Set([...myCats, ...theirCats]).size;
    const interests = union ? Math.round(inter / union * 100) : 50;
    return {
      personality,
      politics,
      values,
      interests
    };
  }

  // ─── Affinity, broken into bars (replaces the donut) ───
  function AffinityBreakdown({
    parts
  }) {
    const dims = [{
      k: 'personality',
      label: 'Personality',
      col: 'oklch(0.55 0.13 38)'
    }, {
      k: 'politics',
      label: 'Politics',
      col: 'oklch(0.50 0.12 220)'
    }, {
      k: 'values',
      label: 'Values',
      col: 'oklch(0.52 0.14 305)'
    }, {
      k: 'interests',
      label: 'Interests',
      col: 'oklch(0.55 0.10 145)'
    }].map(d => ({
      ...d,
      v: Math.round(parts[d.k])
    })).sort((a, b) => b.v - a.v);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, dims.map(d => /*#__PURE__*/React.createElement("div", {
      key: d.k
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 14.5,
        fontWeight: 650,
        letterSpacing: '-0.01em',
        color: 'var(--ink)'
      }
    }, d.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: d.col
      }
    }, d.v)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 8,
        background: 'var(--surface-3)',
        borderRadius: 999,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${d.v}%`,
        height: '100%',
        background: d.col,
        borderRadius: 999
      }
    })))));
  }

  // ─── Receipts — the concrete answers behind the affinity number. Their
  // answers are derived with the SAME seed + formula as PersonMindMap, so the
  // profile, these rows and the map never disagree about what they said.
  function ReceiptsCard({
    p,
    themColor,
    firstName
  }) {
    const [open, setOpen] = React.useState(null);
    const rows = React.useMemo(() => {
      const D = window.DAILYQ;
      if (!D || !D.questions) return null;
      const seed = String(p.id || p.init || p.name || 'x');
      const H = s => poHash(seed + '|' + s);
      const agreeP = Math.min(0.9, Math.max(0.35, (p.match || 60) / 100 - 0.05));
      const ansText = (q, idx) => q.type === 'rating' ? idx + 1 + '/10' : q.options && q.options[idx] != null ? q.options[idx] : '—';
      const out = [];
      D.questions.forEach(q => {
        if (H('has' + q.id) > 0.68) return; // one they haven't answered
        const mineIdx = D.myAnswer(q);
        if (mineIdx == null) return; // receipts need both signatures
        const n = Math.max(2, q.type === 'rating' ? 10 : q.type === 'binary' ? 2 : q.type === 'scale' ? 5 : (q.options || []).length || 2);
        const gd = window.MapStats ? window.MapStats.dist(q.id, 'all', n, mineIdx) : null;
        const majIdx = gd ? gd.indexOf(Math.max(...gd)) : Math.floor(H('mj' + q.id) * n);
        let aidx;
        if (H('agree' + q.id) < agreeP) aidx = mineIdx;else {
          aidx = H('majb' + q.id) < 0.6 ? majIdx : Math.floor(H('pick' + q.id) * n);
          if (aidx === mineIdx) aidx = (aidx + 1 + Math.floor(H('shift' + q.id) * (n - 1))) % n;
        }
        const typ = gd ? gd[aidx] / 100 : 0.5; // how common their answer is
        out.push({
          id: q.id,
          prompt: q.prompt.replace(/[.\s]+$/, ''),
          same: aidx === mineIdx,
          mine: ansText(q, mineIdx),
          them: ansText(q, aidx),
          typ,
          gap: q.type === 'rating' || q.type === 'scale' ? Math.abs(aidx - mineIdx) / (n - 1) : 1
        });
      });
      return out;
    }, [p.id]);
    const [all, setAll] = React.useState(false);
    if (!rows || rows.length < 4) return null;
    // a match is strongest where the shared answer is RARE; a split where the
    // daylight is widest. Whichever side is the exception leads: with 34 of 35
    // matching, the one split IS the story.
    const matches = rows.filter(r => r.same).sort((a, b) => a.typ - b.typ);
    const splits = rows.filter(r => !r.same).sort((a, b) => b.gap - a.gap || a.typ - b.typ);
    const nSame = matches.length,
      nSplit = splits.length;
    const splitFirst = nSplit <= nSame;
    const shown = all ? splitFirst ? splits.concat(matches) : matches.concat(splits) : splitFirst ? splits.slice(0, 2).concat(matches.slice(0, 3)) : matches.slice(0, 2).concat(splits.slice(0, 3));
    const lead = nSplit === 0 ? `Same answer on all ${rows.length}.` : nSame === 0 ? `Different answers on all ${rows.length}.` : nSplit <= 2 && nSame >= 6 ? `Same answer ${nSame} times out of ${rows.length}. ${nSplit === 1 ? 'One' : 'Two'} split${nSplit === 1 ? '' : 's'}.` : `Same answer ${nSame} times out of ${rows.length}.`;
    const who = {
      fontFamily: 'var(--sans)',
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-3)'
    };
    const row = (r, i) => /*#__PURE__*/React.createElement("div", {
      key: r.id,
      style: {
        padding: '11px 0',
        borderTop: i ? '0.5px solid var(--rule)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--serif)',
        fontSize: 15.5,
        fontWeight: 500,
        lineHeight: 1.35,
        color: 'var(--ink)',
        textWrap: 'pretty'
      }
    }, r.prompt), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 5,
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: '-0.005em',
        color: 'var(--ink)',
        textWrap: 'pretty'
      }
    }, r.same ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: who
    }, "both "), r.mine) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: who
    }, "you "), r.mine, /*#__PURE__*/React.createElement("span", {
      style: who
    }, " \xB7 ", firstName, " "), /*#__PURE__*/React.createElement("span", {
      style: {
        color: themColor
      }
    }, r.them))));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 30
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement(Kicker, null, "The answers behind it")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: '-0.015em',
        lineHeight: 1.3,
        color: 'var(--ink)',
        textWrap: 'pretty'
      }
    }, lead), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        borderTop: '0.5px solid var(--rule)'
      }
    }, shown.map(row)), rows.length > shown.length || all ? /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => setAll(a => !a),
      "aria-expanded": all,
      style: {
        marginTop: 2,
        padding: '6px 0',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        WebkitAppearance: 'none',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--ink-2)'
      }
    }, all ? 'Fewer' : `All ${rows.length}`, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        fontSize: 15,
        lineHeight: 1,
        marginTop: -1
      }
    }, all ? '' : '\u203a')) : null);
  }
  function PersonOverlay({
    p: rawP,
    onClose,
    me
  }) {
    if (!rawP) return null;
    // Normalize interests — some sources (IS_DATA.people) store them as
    // category-id strings; person-overlay expects [{t, c}] objects.
    const cats = window.IS_DATA?.interestCats || [];
    const normInterests = (rawP.interests || []).map(i => {
      if (typeof i === 'string') {
        const cat = cats.find(c => c.id === i);
        return {
          t: cat ? cat.label.toLowerCase() : i,
          c: i
        };
      }
      return i;
    });
    const p = {
      ...rawP,
      interests: normInterests
    };
    const prof = derivePerson(p, me);
    const parts = affinityBreakdown(me, prof, p);
    const themColor = window.WPAL.ink(`oklch(0.55 0.13 ${p.hue})`);
    const overall = Math.round(p.match);
    const firstName = p.anon ? 'Them' : p.name ? p.name.split(' ')[0] : p.init;
    const [mapOpen, setMapOpen] = React.useState(false);
    const [, fBump] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => window.FRIENDS ? window.FRIENDS.subscribe(fBump) : undefined, []);
    React.useEffect(() => window.DUELS && window.DUELS.subscribe ? window.DUELS.subscribe(fBump) : undefined, []);
    const fStatus = !p.anon && p.id && window.FRIENDS ? window.FRIENDS.status(p.id) : 'none';
    const isFriend = fStatus === 'friends';
    const [confirmRemove, setConfirmRemove] = React.useState(false);
    const onFriendBtn = () => {
      if (!window.FRIENDS || !p.id) return;
      if (fStatus === 'none') window.FRIENDS.invite(p.id);else if (fStatus === 'invited') window.FRIENDS.cancel(p.id);else setConfirmRemove(true);
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "overlay surface-tint"
    }, /*#__PURE__*/React.createElement("div", {
      className: "app-header"
    }, /*#__PURE__*/React.createElement("button", {
      className: "avatar-btn",
      onClick: onClose
    }, "\u2190"), /*#__PURE__*/React.createElement("div", {
      className: "h-title",
      style: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textTransform: p.anon ? 'capitalize' : 'none'
      }
    }, anonName(p))), /*#__PURE__*/React.createElement("div", {
      className: "app-body"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        width: 152,
        height: 152,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 14,
        borderRadius: '50%',
        background: `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${themColor} 26%, transparent), transparent 74%)`,
        filter: 'blur(6px)'
      }
    }), /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 152 152",
      width: "152",
      height: "152",
      style: {
        position: 'absolute',
        inset: 0,
        transform: 'rotate(-90deg)'
      }
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "76",
      cy: "76",
      r: "68",
      fill: "none",
      stroke: `color-mix(in oklch, ${themColor} 16%, transparent)`,
      strokeWidth: "5"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "76",
      cy: "76",
      r: "68",
      fill: "none",
      stroke: themColor,
      strokeWidth: "5",
      strokeLinecap: "round",
      strokeDasharray: `${overall / 100 * 2 * Math.PI * 68} ${2 * Math.PI * 68}`
    })), p.anon ? /*#__PURE__*/React.createElement(AnonAv, {
      hue: p.hue,
      size: 112
    }) : /*#__PURE__*/React.createElement(Av, {
      init: p.init,
      hue: p.hue,
      size: 112
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: -4,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        background: themColor,
        color: 'white',
        padding: '4px 13px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        boxShadow: `0 6px 16px -6px color-mix(in oklch, ${themColor} 55%, transparent)`,
        border: '2.5px solid var(--surface)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 14.5,
        fontWeight: 800,
        letterSpacing: '-0.01em'
      }
    }, overall), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.09em'
      }
    }, "AFFINITY"))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 28,
        fontWeight: 800,
        marginTop: 18,
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        textTransform: p.anon ? 'capitalize' : 'none'
      }
    }, anonName(p)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--ink-3)',
        letterSpacing: '0.09em',
        marginTop: 7,
        textTransform: 'uppercase'
      }
    }, p.anon ? null : /*#__PURE__*/React.createElement(React.Fragment, null, p.role || p.rel, " \xB7 ", p.age ? `aged ${p.age} · ` : '', p.dist || 'in your orbit')), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7
      }
    }, !p.anon && p.id && window.FRIENDS && (confirmRemove ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-2)',
        whiteSpace: 'nowrap'
      }
    }, "Remove from your circle?"), /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => {
        window.FRIENDS.unfriend(p.id);
        setConfirmRemove(false);
      },
      style: {
        padding: '7px 16px',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 800,
        background: 'var(--ochre)',
        color: '#fff'
      }
    }, "Remove"), /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: () => setConfirmRemove(false),
      style: {
        padding: '7px 14px',
        borderRadius: 999,
        border: '0.5px solid var(--rule)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--sans)',
        fontSize: 12.5,
        fontWeight: 700,
        background: 'var(--surface-2)',
        color: 'var(--ink)'
      }
    }, "Keep")) : /*#__PURE__*/React.createElement("button", {
      className: "press",
      onClick: onFriendBtn,
      style: {
        padding: '9px 24px',
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--sans)',
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: '0.01em',
        background: fStatus === 'none' ? themColor : 'var(--surface-2)',
        color: fStatus === 'none' ? 'white' : 'var(--ink)',
        border: `0.5px solid ${fStatus === 'none' ? themColor : 'var(--rule)'}`,
        boxShadow: fStatus === 'none' ? `0 6px 14px -6px color-mix(in oklch, ${themColor} 50%, transparent)` : 'none',
        transition: 'background 0.15s, color 0.15s, box-shadow 0.15s'
      }
    }, isFriend ? 'Friends ✓' : fStatus === 'invited' ? 'Invited · waiting' : 'Add friend')), !p.anon && fStatus === 'invited' && !confirmRemove && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "they", '\u2019', "ll see it soon \xB7 tap to cancel"))), /*#__PURE__*/React.createElement("hr", {
      className: "rule"
    }), (() => {
      if (!window.CompareCarousel) {
        return /*#__PURE__*/React.createElement("div", {
          className: "card",
          style: {
            marginBottom: 14
          }
        }, /*#__PURE__*/React.createElement(Kicker, null, "What makes the number"), /*#__PURE__*/React.createElement("div", {
          style: {
            marginTop: 12
          }
        }, /*#__PURE__*/React.createElement(AffinityBreakdown, {
          parts: parts
        })));
      }
      const rnd = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
      const to01 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v + 100) / 2)]));
      const who = p.anon ? 'them' : p.name ? p.name.split(' ')[0] : p.init;
      // the remaining assessments (Social, Thinking) have no counterpart in
      // derivePerson — derive them the same way: their dims drift off yours,
      // deterministically per person, pulled closer the higher the match
      const drifted = kind => {
        const R = (window.IS_TEST_RESULTS || {})[kind];
        if (!R || !R.dims || !R.dims.length) return null;
        const pull = Math.max(0, Math.min(1, ((p.match || 60) - 35) / 65));
        const out = {};
        R.dims.forEach(d => {
          const r = poHash(String(p.id || p.init || p.name || 'x') + '|' + kind + '|' + d.id);
          const drift = (r - 0.5) * 2 * 46 * (1 - pull * 0.6);
          out[d.id] = Math.max(3, Math.min(100, Math.round(d.value + drift)));
        });
        return out;
      };
      const themPop = {
        big5: rnd(prof.big5),
        political: to01(prof.political),
        values: to01(prof.morals)
      };
      const social = drifted('attachment');
      const thinking = drifted('cognitive');
      if (social) themPop.attachment = social;
      if (thinking) themPop.cognitive = thinking;
      const myInts = me.myInterests || [];
      const myCatSet = new Set(myInts.map(i => i.c));
      const theirCatSet = new Set(p.interests.map(i => i.c));
      const allCats = window.IS_DATA && window.IS_DATA.interestCats || [];
      // Their interests are declared as CATEGORIES; yours as specific things
      // inside them. So the compare is a category ladder: one row per
      // category either of you keeps, your depth in it as count dots, their
      // stake as a filled mark. Rows where both marks land are the overlap.
      const rows = allCats.filter(c => myCatSet.has(c.id) || theirCatSet.has(c.id)).map(c => ({
        c,
        mine: myInts.filter(i => i.c === c.id),
        them: theirCatSet.has(c.id)
      })).sort((a, b) => {
        const rk = r => r.them && r.mine.length ? 0 : r.mine.length ? 1 : 2;
        return rk(a) - rk(b);
      });
      const bothN = rows.filter(r => r.them && r.mine.length).length;
      // one mark per side, per row: filled = keeps it, hollow = doesn't. Two
      // columns, so a shared row reads as a pair without counting anything.
      const mark = (on, col, tip) => /*#__PURE__*/React.createElement("span", {
        title: tip || undefined,
        style: {
          width: 9,
          height: 9,
          borderRadius: '50%',
          flexShrink: 0,
          boxSizing: 'border-box',
          background: on ? col : 'transparent',
          border: on ? 'none' : '1.5px solid color-mix(in oklch, var(--ink-3) 34%, transparent)'
        }
      });
      const interestsSlide = {
        kind: 'interests',
        title: 'Interests',
        sub: 'shared ground',
        align: Math.round(parts.interests),
        body: /*#__PURE__*/React.createElement("div", {
          style: {
            marginTop: 13
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            height: 7,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'var(--surface-3)'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            width: (rows.length ? bothN / rows.length * 100 : 0) + '%',
            background: themColor
          }
        })), /*#__PURE__*/React.createElement("div", {
          style: {
            marginTop: 6,
            display: 'flex',
            flexDirection: 'column'
          }
        }, rows.map(({
          c,
          mine,
          them
        }) => {
          const both = them && mine.length > 0;
          return /*#__PURE__*/React.createElement("div", {
            key: c.id,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              margin: '0 -10px',
              borderRadius: 8,
              background: both ? `color-mix(in oklch, ${themColor} 9%, transparent)` : 'transparent'
            }
          }, /*#__PURE__*/React.createElement("span", {
            style: {
              flex: 1,
              minWidth: 0,
              fontFamily: 'var(--sans)',
              fontSize: 13.5,
              fontWeight: both ? 700 : 500,
              color: both ? 'var(--ink)' : 'var(--ink-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }
          }, c.label), /*#__PURE__*/React.createElement("span", {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              flexShrink: 0
            }
          }, mark(mine.length > 0, 'var(--ink)', mine.map(i => i.t).join(', ')), mark(them, themColor, who)));
        })), /*#__PURE__*/React.createElement("div", {
          style: {
            marginTop: 11,
            paddingTop: 9,
            borderTop: '0.5px solid var(--rule)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontFamily: 'var(--sans)',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }
        }, mark(true, 'var(--ink)'), "you"), /*#__PURE__*/React.createElement("span", {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }
        }, mark(true, themColor), who)))
      };
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 20
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 9
        }
      }, /*#__PURE__*/React.createElement(Kicker, null, "What makes the number")), /*#__PURE__*/React.createElement(window.CompareCarousel, {
        pop: themPop,
        accent: themColor,
        label: who,
        aligns: {
          big5: Math.round(parts.personality),
          political: Math.round(parts.politics),
          values: Math.round(parts.values)
        },
        extra: [interestsSlide]
      }));
    })(), /*#__PURE__*/React.createElement(ReceiptsCard, {
      p: p,
      themColor: themColor,
      firstName: firstName
    }), !p.anon && p.id && window.DUELS ? (() => {
      const D = window.DUELS;
      const duo = D.partners ? D.partners().find(x => x.id === p.id) : null;
      const playing = !!(duo && duo.played > 0);
      const invited = !!(duo && duo.state === 'invited');
      const goDuo = () => {
        window.DUO_FOCUS = p.id;
        if (window.goNav) window.goNav('track:duo');
        setTimeout(() => window.dispatchEvent(new CustomEvent('is:duo-focus')), 60);
      };
      const goGroup = gid => {
        window.GROUP_FOCUS = gid;
        if (window.goNav) window.goNav('track:group');
        setTimeout(() => window.dispatchEvent(new CustomEvent('is:group-focus')), 60);
      };
      const gs = D.groups ? D.groups() : [];
      const shared = gs.filter(g => g.members.some(m => m.id === p.id));
      const addable = isFriend ? gs.filter(g => !g.members.some(m => m.id === p.id)).slice(0, 4) : [];
      if (!duo && !isFriend && !shared.length) return null;
      // their named types, read off the shared record (role-data math, their vantage)
      const pt = window.ROLES && window.ROLES.personTypes ? window.ROLES.personTypes(p.id) : {
        duo: null,
        group: null
      };
      // doors, not a card: a title, a sub-line, a chevron. The named type
      // ("The Twin") gets its one-line meaning as the sub-line instead of
      // standing alone.
      const chev = /*#__PURE__*/React.createElement("span", {
        "aria-hidden": "true",
        style: {
          flexShrink: 0,
          fontFamily: 'var(--sans)',
          fontSize: 20,
          lineHeight: 1,
          color: 'var(--ink-3)'
        }
      }, '\u203a');
      const doorBtn = {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '13px 0',
        border: 'none',
        borderTop: '0.5px solid var(--rule)',
        background: 'none',
        color: 'inherit',
        cursor: 'pointer',
        WebkitAppearance: 'none',
        appearance: 'none'
      };
      const door = (key, title, sub, onClick, right) => /*#__PURE__*/React.createElement("button", {
        key: key,
        className: "press",
        onClick: onClick,
        style: {
          ...doorBtn,
          cursor: onClick ? 'pointer' : 'default'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block',
          fontFamily: 'var(--sans)',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--ink)'
        }
      }, title), sub ? /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block',
          marginTop: 2,
          fontFamily: 'var(--sans)',
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--ink-2)',
          lineHeight: 1.4,
          textWrap: 'pretty'
        }
      }, sub) : null), right !== undefined ? right : onClick ? chev : null);
      const textBtn = (label, onClick) => /*#__PURE__*/React.createElement("span", {
        role: "button",
        tabIndex: 0,
        onClick: e => {
          e.stopPropagation();
          onClick();
        },
        onKeyDown: e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }
        },
        style: {
          flexShrink: 0,
          fontFamily: 'var(--sans)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--ink-2)',
          padding: '4px 0',
          cursor: 'pointer'
        }
      }, label);
      const typeSub = (t, tail) => t ? `${t.name} \u2014 ${t.line}` : tail;
      const duoDoor = duo && !invited ? door('duo', playing ? `1v1 \u00b7 ${duo.played} day${duo.played === 1 ? '' : 's'}` : '1v1 \u00b7 new', typeSub(pt.duo, playing ? null : 'today\u2019s question is up'), goDuo) : invited ? door('duo', '1v1 \u00b7 invited', `waiting on ${firstName}`, null, textBtn('Cancel', () => D.cancelDuo(p.id))) : isFriend ? door('duo', 'Start a 1v1', 'one question a day \u2014 read each other', () => D.startDuo(p.id), textBtn('Start', () => D.startDuo(p.id))) : door('duo', '1v1', `for friends \u2014 add ${firstName} first`, null);
      const groupDoor = shared.length ? shared.map((g, i) => {
        const mem = g.members.find(m => m.id === p.id);
        const pend = !!(mem && mem.pending);
        return door(g.id, g.name, pend ? `invited \u00b7 waiting on ${firstName}` : i === 0 ? typeSub(pt.group, 'a group you share') : 'a group you share', pend ? null : () => goGroup(g.id));
      }) : addable.length ? /*#__PURE__*/React.createElement("div", {
        key: "groups",
        style: {
          ...doorBtn,
          cursor: 'default',
          flexWrap: 'wrap'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          flex: '1 1 100%',
          fontFamily: 'var(--sans)',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--ink)'
        }
      }, "Add ", firstName, " to a group"), /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7
        }
      }, addable.map(g => /*#__PURE__*/React.createElement("button", {
        key: g.id,
        className: "press",
        onClick: () => D.addGroupMembers(g.id, [p.id]),
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          border: '0.5px solid var(--rule)',
          background: 'var(--surface-2)',
          color: 'var(--ink)',
          borderRadius: 999,
          padding: '5px 12px',
          cursor: 'pointer',
          WebkitAppearance: 'none',
          fontFamily: 'var(--sans)',
          fontSize: 12.5,
          fontWeight: 700
        }
      }, "+ ", g.name)))) : door('groups', 'Groups', 'none together yet', null);
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 30
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 6
        }
      }, /*#__PURE__*/React.createElement(Kicker, null, "Play together")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column'
        }
      }, duoDoor, groupDoor));
    })() : null, (() => {
      const D = window.DUELS;
      const duo = D && D.partners ? D.partners().find(x => x.id === p.id && x.played > 0) : null;
      if (!duo || !window.DuoDots) return null;
      // The comparison is two hit-rates, so it is drawn as two numbers per
      // row (and a short bar each), under column heads that carry the
      // legend. The dot runs stay on the 1v1 screen, where they are a diary.
      const rows = D.domainRows ? D.domainRows(duo) : [];
      const weak = rows.length >= 2 && D.weakDomain ? D.weakDomain(duo) : null;
      const hits = a => a.filter(Boolean).length;
      const readAll = Array.from({
        length: duo.read.total
      }, (_, i) => D.duoDay(p.id, duo.read.total - i).readRight);
      const byAll = Array.from({
        length: duo.readBy.total
      }, (_, i) => D.duoDay(p.id, duo.readBy.total - i).byRight);
      const pairs = rows.length >= 2 ? rows.map(r => ({
        id: r.id,
        label: r.label === 'how they see you' ? 'self-image' : r.label,
        r: hits(r.read),
        rn: r.read.length,
        b: hits(r.by),
        bn: r.by.length
      })) : [{
        id: 'all',
        label: 'all days',
        r: hits(readAll),
        rn: readAll.length,
        b: hits(byAll),
        bn: byAll.length
      }];
      const rRate = hits(readAll) / Math.max(1, readAll.length),
        bRate = hits(byAll) / Math.max(1, byAll.length);
      const gapR = rRate - bRate;
      const readerLine = Math.abs(gapR) < 0.08 ? `You and ${firstName} read each other about equally well.` : gapR > 0 ? `You read ${firstName} better than ${firstName} reads you` : `${firstName} reads you better than you read ${firstName}`;
      const lead = weak && Math.abs(gapR) >= 0.08 && weak.byRate > bRate + 0.05 ? `${readerLine}, except on ${weak.label}.` : Math.abs(gapR) < 0.08 ? readerLine : readerLine + '.';
      const cell = (n, tot, color, side) => /*#__PURE__*/React.createElement("span", {
        style: {
          width: 64,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: side === 'r' ? 'flex-end' : 'flex-start',
          gap: 5
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--sans)',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums'
        }
      }, n, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--ink-3)'
        }
      }, "/", tot)), /*#__PURE__*/React.createElement("span", {
        style: {
          width: '100%',
          height: 4,
          borderRadius: 99,
          background: 'var(--surface-3)',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: side === 'r' ? 'flex-end' : 'flex-start'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'block',
          width: `${n / Math.max(1, tot) * 100}%`,
          height: '100%',
          background: color,
          borderRadius: 99
        }
      })));
      const head = {
        fontFamily: 'var(--sans)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: 'var(--ink-3)',
        width: 64,
        flexShrink: 0
      };
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 30
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement(Kicker, null, "How well you read each other")), /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: 'var(--sans)',
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '-0.015em',
          lineHeight: 1.3,
          color: 'var(--ink)',
          textWrap: 'pretty'
        }
      }, lead), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginTop: 14,
          paddingBottom: 7
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          ...head,
          textAlign: 'right'
        }
      }, "you read ", firstName), /*#__PURE__*/React.createElement("span", {
        style: head
      }, firstName, " reads you")), pairs.map(x => /*#__PURE__*/React.createElement("div", {
        key: x.id,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '11px 0',
          borderTop: '0.5px solid var(--rule)'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--sans)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ink)',
          textWrap: 'pretty'
        }
      }, x.label), cell(x.r, x.rn, 'var(--ink)', 'r'), cell(x.b, x.bn, themColor, 'l'))));
    })(), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 26
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(Kicker, null, "Where your maps meet")), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        flexShrink: 0,
        fontFamily: 'var(--sans)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--ink-2)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: themColor
      }
    }), "same"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: `2px solid ${themColor}`
      }
    }), "differ"))), /*#__PURE__*/React.createElement("div", {
      className: "press",
      role: "button",
      tabIndex: 0,
      onClick: () => setMapOpen(true),
      onKeyDown: e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setMapOpen(true);
        }
      },
      "aria-label": `Open ${firstName}'s map`,
      style: {
        cursor: 'pointer',
        border: '0.5px solid var(--rule)',
        borderRadius: 16,
        overflow: 'hidden',
        background: `radial-gradient(120% 80% at 50% 0%, color-mix(in oklch, ${themColor} 8%, transparent), transparent 72%), var(--surface)`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 158,
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'none',
        maskImage: 'linear-gradient(180deg, transparent 0, #000 15%, #000 86%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 15%, #000 86%, transparent 100%)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 330,
        transform: 'translateY(-50%)'
      }
    }, window.PersonMindMap ? /*#__PURE__*/React.createElement(window.PersonMindMap, {
      p: p,
      following: isFriend,
      centerName: firstName,
      still: true
    }) : null)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderTop: '0.5px solid var(--rule)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontFamily: 'var(--sans)',
        fontSize: 14.5,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: 'var(--ink)'
      }
    }, "Open ", firstName, '\u2019', "s map"), !isFriend && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "partial"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--sans)',
        fontSize: 15,
        fontWeight: 700,
        color: themColor
      }
    }, "\u2197"))))), mapOpen && window.PersonMindMap ? /*#__PURE__*/React.createElement("div", {
      className: "overlay surface-tint",
      style: {
        zIndex: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "app-header"
    }, /*#__PURE__*/React.createElement("button", {
      className: "avatar-btn",
      onClick: () => setMapOpen(false)
    }, "\u2190"), /*#__PURE__*/React.createElement("div", {
      className: "h-title",
      style: {
        flex: 1,
        minWidth: 0
      }
    }, firstName, '\u2019', "s map")), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0,
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement(window.PersonMindMap, {
      p: p,
      following: isFriend,
      centerName: firstName
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flexShrink: 0,
        display: 'flex',
        gap: 16,
        padding: '10px 16px 14px',
        borderTop: '0.5px solid var(--rule)',
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 99,
        background: themColor
      }
    }), "same answer"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 99,
        boxSizing: 'border-box',
        border: `2px solid ${themColor}`
      }
    }), "you differ"))) : null);
  }

  // The one PersonOverlay — registered globally for the app shell.
  window.PersonOverlay = PersonOverlay;
})();