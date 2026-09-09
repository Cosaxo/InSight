const {
  useState,
  useEffect
} = React;

// Settled experiments have been folded into the design; what stays here is
// live state (which tab, which population) plus the two demo controls.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "compact",
  "tab": "patterns",
  "mirrorPop": "circle",
  "worldZoom": "world",
  "pulseHistory": "typical",
  "friendVotes": "rows"
} /*EDITMODE-END*/;

// the world feed's card set, all shipped
const FEED_OPTS = {
  reveal: true,
  ripple: true,
  pass: true,
  clock: true,
  v2: true,
  signals: true,
  crossfire: true,
  counter: true,
  why: true,
  hier: true,
  paid: true
};

// Hand-drawn-feel SVG glyphs — each one a small ink illustration
function NavGlyph({
  id,
  active
}) {
  const stroke = active ? 'var(--ink)' : 'var(--ink-3)';
  const sw = 1.2;
  if (id === 'track') {
    // A tracked line — days joined into a rising thread, today inked at the end
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "22",
      height: "22",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M3 18.5 C6.2 18.2 6.4 12.6 9.5 12.8 C12.2 13 12.4 15.6 14.8 14.6 C17.6 13.4 18 7.4 20.6 6"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "3",
      cy: "18.5",
      r: "1.1",
      fill: stroke,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9.5",
      cy: "12.8",
      r: "1.1",
      fill: stroke,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "14.8",
      cy: "14.6",
      r: "1.1",
      fill: stroke,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "20.6",
      cy: "6",
      r: "2.6",
      fill: active ? 'var(--ink)' : 'transparent',
      fillOpacity: "0.14"
    }));
  }
  if (id === 'mirror') {
    // Two lenses overlapping — you, inked; the population, still sketched
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "22",
      height: "22",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "12",
      r: "6.4",
      fill: active ? 'var(--ink)' : 'transparent',
      fillOpacity: "0.12"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "15",
      cy: "12",
      r: "6.4",
      strokeDasharray: "1.5 1.8"
    }));
  }
  if (id === 'patterns') {
    // a constellation — points of data, joined into a figure
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "22",
      height: "22",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M5 17.5 L11.5 13.5 L18.5 15.5 M11.5 13.5 L10 6.5 M11.5 13.5 L19 5.5",
      opacity: "0.42"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "5",
      cy: "17.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "6.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18.5",
      cy: "15.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "11.5",
      cy: "13.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "19",
      cy: "5.5",
      r: "2.4",
      fill: active ? 'var(--ink)' : 'transparent',
      fillOpacity: "0.14"
    }));
  }
  return null;
}

// patterns · daily · mirror — the daily sits in the middle, so a swipe either way
// lands somewhere: left into what your answers add up to, right into who else.
// (Internal ids keep their historical names; only labels are user-facing.)
const TABS = [{
  id: 'patterns',
  label: 'patterns'
}, {
  id: 'track',
  label: 'daily'
}, {
  id: 'mirror',
  label: 'mirror'
}];
const MIRROR_POP_IDS = ['you', 'circle', 'groups', 'near', 'world'];
const WORLD_ZOOM_IDS = ['city', 'country', 'world'];

// one axis for every jump between daily modes and tabs — swipe gestures and
// cross-links both go through window.goNav with these keys
const NAV_ONE = [{
  key: 'patterns',
  tab: 'patterns'
}, {
  key: 'track:world',
  tab: 'track',
  mode: 'world'
}, {
  key: 'track:group',
  tab: 'track',
  mode: 'group'
}, {
  key: 'track:duo',
  tab: 'track',
  mode: 'duo'
}, {
  key: 'mirror',
  tab: 'mirror'
}];

// Overlays that ship.
const LIVE_OVERLAYS = ['profile', 'test', 'search', 'relmap'];

// One exception in any of the ~450 components should cost a card, not the app.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      err: null
    };
  }
  static getDerivedStateFromError(err) {
    return {
      err
    };
  }
  componentDidCatch(err, info) {
    console.error('[InSight] boundary caught:', err, info && info.componentStack);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '26px 18px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        textAlign: 'center',
        padding: '26px 18px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--sans, system-ui)',
        fontSize: 21,
        color: 'var(--ink, #20211f)'
      }
    }, "This view hit a snag."), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--sans, system-ui)',
        fontSize: 11,
        color: 'var(--ink-3, #8a877f)',
        letterSpacing: '0.04em',
        margin: '10px 0 16px',
        wordBreak: 'break-word'
      }
    }, String(this.state.err && this.state.err.message || this.state.err)), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        this.setState({
          err: null
        });
        if (this.props.onReset) this.props.onReset();
      },
      style: {
        padding: '9px 22px',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: 'var(--ink, #20211f)',
        color: 'var(--surface, #faf8f2)',
        fontFamily: 'var(--sans, system-ui)',
        fontSize: 15
      }
    }, "Take me back")));
  }
}

// The daily's three modes, as dots in the header — where you are on the axis.
// The full ruler starts in the page; once it scrolls away a compact text ruler
// (label + underline on the active stop) takes the wordmark's place
// (data-docked). Patterns runs the same system with its lenses.
const DAILY_DOTS = [{
  id: 'world',
  label: 'World',
  acc: 'var(--c-around)'
}, {
  id: 'group',
  label: 'Circle',
  acc: 'var(--c-likeness)'
}, {
  id: 'duo',
  label: '1v1',
  acc: 'var(--c-people)'
}];
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = id => TABS.some(x => x.id === id) ? id : 'track';
  const [tab, setTab] = useState(validTab(t.tab));
  const [person, setPerson] = useState(null);
  const [city, setCity] = useState(null);
  // a paid question whose report is open — the card's "what they get", shown whole
  const [paidQ, setPaidQ] = useState(null);
  // ONE overlay key instead of two dozen booleans — closeAll can't drift
  const [ov, setOv] = useState(null);
  // where to return when an overlay closes (e.g. trackers opened from the profile)
  const [ovBack, setOvBack] = useState(null);
  const ovRef = React.useRef(null);
  useEffect(() => {
    ovRef.current = ov;
  }, [ov]);
  const backOv = () => {
    if (ovBack) {
      setOv(ovBack);
      setOvBack(null);
    } else {
      setOv(null);
    }
  };
  const [dailyKey, setDailyKey] = useState(0);
  const [dailyMode, setDailyMode] = useState('world');
  // true once the daily feed has scrolled past its ruler — the wordmark steps
  // aside and the ruler takes the header
  const [docked, setDocked] = useState(false);
  // which test to open TestOverlay on (null = selection screen)
  const [testKind, setTestKind] = useState(null);
  // which Patterns lens is open — lifted here so the dial can live in the header
  const [ptLens, setPtLens] = useState('map');
  const PT_DIAL = [{
    id: 'oracle',
    label: 'Oracle',
    acc: 'var(--c-today)'
  }, {
    id: 'map',
    label: 'Questions',
    acc: 'var(--c-today)'
  }, {
    id: 'people',
    label: 'People',
    acc: 'var(--c-today)'
  }];
  useEffect(() => {
    setDocked(false);
  }, [tab]);
  const mirrorPop = MIRROR_POP_IDS.includes(t.mirrorPop) ? t.mirrorPop : 'you';
  const worldZoom = WORLD_ZOOM_IDS.includes(t.worldZoom) ? t.worldZoom : 'world';
  const closeAll = () => {
    setOv(null);
    setPerson(null);
    setCity(null);
    setTestKind(null);
    setPaidQ(null);
  };
  useEffect(() => {
    window.openSuggestions = () => {
      setOv('suggest');
    };
    window.openLogicTest = () => {
      closeAll();
      setOv('logic');
    };
    // the paid card's receipt: the exact report the buyer gets, open to anyone
    window.openPaidReport = pq => {
      closeAll();
      setPaidQ(pq);
    };
    // the buyer's room — every purchase + the report shelf (PAID-PLAN §7)
    window.openAskedByYou = () => {
      closeAll();
      setOv('askedby');
    };
    // the shop window — catalog & rate card, read-only in-app (law 07)
    window.openCatalog = focus => {
      closeAll();
      setOv(focus === 'author' ? 'catalog-author' : 'catalog');
    };
    // the pulse card's own reading — the Pulse branch of your Map, one leaf a day
    window.goTrends = () => {
      closeAll();
      window.MAP_OPEN_GROUP = 'g-self';
      window.MAP_SELECT = 'pulse';
      setTweak('mirrorPop', 'you');
      setTab('mirror');
    };
    return () => {
      delete window.openSuggestions;
      delete window.openLogicTest;
      delete window.goTrends;
      delete window.openPaidReport;
      delete window.openAskedByYou;
      delete window.openCatalog;
    };
  }, []);
  useEffect(() => {
    window.openOverlay = key => {
      if (LIVE_OVERLAYS.includes(key)) {
        const from = ovRef.current;
        closeAll();
        setOv(key);
        setOvBack(from === 'profile' && key !== 'profile' ? 'profile' : null);
      }
    };
    window.goTab = id => {
      closeAll();
      if (MIRROR_POP_IDS.includes(id)) {
        setTweak('mirrorPop', id);
        setTab('mirror');
        return;
      }
      if (TABS.some(x => x.id === id)) setTab(id);
    };
    // one axis for the bottom bar: any nav key, from anywhere (swipe gestures use this)
    window.goNav = key => {
      const it = NAV_ONE.find(x => x.key === key);
      if (!it) return;
      // a cross-tab jump ends the gesture that caused it: trackpad momentum kept
      // arriving after the switch and stepped the daily one stop further
      window.NAV_AT = Date.now();
      closeAll();
      if (it.tab !== 'track') {
        if (it.tab === 'mirror') setTweak('mirrorPop', 'you');
        setTab(it.tab);
        return;
      }
      setDailyMode(it.mode);
      setTab('track');
    };
    // open the test flow — straight into a specific test, or the picker
    window.openTest = k => {
      const from = ovRef.current;
      closeAll();
      setTestKind(k || null);
      setOv('test');
      setOvBack(from === 'profile' ? 'profile' : null);
    };
    // cross-link: any component can open a city's profile by name
    window.openCity = name => {
      const c = (window.IS_DATA.cities || []).find(x => x.name === name);
      if (c) {
        closeAll();
        setCity(c);
      }
    };
    // cross-link: open a person's profile (record, or id/name lookup)
    window.openPerson = who => {
      const list = window.IS_DATA.people || [];
      const p = typeof who === 'object' ? who : list.find(x => x.id === who || x.name === who);
      if (p) {
        closeAll();
        setPerson(p);
      }
    };
    return () => {
      delete window.openOverlay;
      delete window.goTab;
      delete window.goNav;
      delete window.openCity;
      delete window.openPerson;
    };
  }, []);
  const me = window.IS_DATA.me;

  // Sync tab tweak <-> state (so Tweaks panel can drive it)
  useEffect(() => {
    const v = validTab(t.tab);
    if (v !== tab) setTab(v);
  }, [t.tab]);
  useEffect(() => {
    if (t.tab !== tab) setTweak('tab', tab);
  }, [tab]);
  const appClasses = `app surface-tint acc-now lens-paper ${t.density || 'regular'} quiet-ground`;
  // how archetype marks draw — read by TypeMark during the render below
  window.IS_MARK_STYLE = 'slice';
  // World's many topic hues, at full spread — see world-palette.js
  window.IS_WPAL = 'full';
  // which seeded pulse history the demo runs on — see pulse-data.js
  window.IS_PULSE_HISTORY = ['typical', 'gap', 'day1', 'perfect'].includes(t.pulseHistory) ? t.pulseHistory : 'typical';
  return /*#__PURE__*/React.createElement(IOSDevice, {
    width: 402,
    height: 874
  }, /*#__PURE__*/React.createElement("div", {
    className: appClasses,
    "data-tab": tab,
    "data-view": tab === 'track' ? 'track:' + dailyMode : tab === 'mirror' ? 'mirror:' + mirrorPop : tab,
    "data-lens-style": "underline",
    "data-docked": docked && (tab === 'track' || tab === 'patterns') ? '' : undefined,
    "data-mpop": tab === 'mirror' ? mirrorPop : undefined,
    style: tab === 'mirror' ? {
      '--accent': mirrorPop === 'you' ? 'var(--c-today)' : mirrorPop === 'circle' ? 'var(--c-people)' : mirrorPop === 'groups' ? 'var(--c-groups)' : mirrorPop === 'world' ? 'var(--c-world)' : 'var(--c-city)'
    } : undefined
  }, /*#__PURE__*/React.createElement("header", {
    className: "app-header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "avatar-btn" + (ov === 'profile' ? ' is-on' : ''),
    onClick: () => {
      if (ov === 'profile') {
        setOv(null);
      } else {
        closeAll();
        setOv('profile');
      }
    }
  }, ov === 'profile' ? '✕' : me.initials), /*#__PURE__*/React.createElement("div", {
    className: "h-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-title"
  }, "in", /*#__PURE__*/React.createElement("em", null, "Sight")), tab === 'track' || tab === 'patterns' ? /*#__PURE__*/React.createElement("div", {
    className: "h-dockslot",
    style: {
      justifyContent: 'center'
    },
    "aria-hidden": !docked
  }, tab === 'track' ? /*#__PURE__*/React.createElement("div", {
    className: "h-dockruler",
    role: "tablist",
    "aria-label": "Which daily"
  }, DAILY_DOTS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    role: "tab",
    "aria-selected": dailyMode === s.id,
    className: "h-dockstop" + (dailyMode === s.id ? ' is-on' : ''),
    style: {
      '--dacc': s.acc
    },
    onClick: () => {
      if (window.HAPTIC && dailyMode !== s.id) window.HAPTIC.tick();
      setDailyMode(s.id);
    }
  }, s.label))) : tab === 'patterns' ? /*#__PURE__*/React.createElement("div", {
    className: "h-dockruler",
    role: "tablist",
    "aria-label": "Which lens"
  }, PT_DIAL.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    role: "tab",
    "aria-selected": ptLens === s.id,
    className: "h-dockstop" + (ptLens === s.id ? ' is-on' : ''),
    style: {
      '--dacc': s.acc
    },
    onClick: () => {
      if (window.HAPTIC && ptLens !== s.id) window.HAPTIC.tick();
      setPtLens(s.id);
    }
  }, s.label))) : null) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, window.PassiveMeter && /*#__PURE__*/React.createElement(window.PassiveMeter, null), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    "aria-label": "Ask a question",
    onClick: () => {
      closeAll();
      setOv('suggest');
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    "aria-label": "Search",
    onClick: () => {
      closeAll();
      setOv('search');
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16.5",
    y1: "16.5",
    x2: "21",
    y2: "21"
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "app-body"
  }, /*#__PURE__*/React.createElement(ErrorBoundary, {
    key: 'tab-' + tab,
    onReset: () => {
      setTab('track');
      setTweak('tab', 'track');
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tab-swap",
    key: tab
  }, tab === 'track' && /*#__PURE__*/React.createElement(DailySplit, {
    key: dailyKey + ':' + t.pulseHistory,
    mode: dailyMode,
    onMode: setDailyMode,
    onDock: setDocked,
    hideSwitcher: true,
    ruler: true,
    dock: true,
    feedHier: true,
    pulse: true,
    feedOpts: {
      ...FEED_OPTS,
      friends: t.friendVotes || 'rows'
    }
  }), tab === 'patterns' && /*#__PURE__*/React.createElement(window.PatternsTab, {
    lens: ptLens,
    onLens: setPtLens,
    ruler: true,
    onDock: setDocked
  }), tab === 'mirror' && /*#__PURE__*/React.createElement(MirrorTab, {
    key: 'mirror-' + t.pulseHistory,
    onPerson: setPerson,
    pop: mirrorPop,
    onPop: v => setTweak('mirrorPop', v),
    worldZoom: worldZoom,
    onZoom: v => setTweak('worldZoom', v),
    firstRun: false,
    topNav: false,
    backKey: 'track:duo'
  })))), /*#__PURE__*/React.createElement("nav", {
    className: "tabbar",
    "data-n": 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "tab-group"
  }, TABS.map(({
    id,
    label
  }) => /*#__PURE__*/React.createElement("button", {
    key: id,
    className: "tab-btn" + (tab === id ? ' is-active' : ''),
    onClick: () => {
      if (window.HAPTIC && tab !== id) window.HAPTIC.tick();
      window.NAV_AT = Date.now();
      // arriving at the daily from Mirror lands on the stop next to it
      if (id === 'track' && tab === 'mirror') setDailyMode('duo');
      setTab(id);
      closeAll();
      if (id === 'mirror') setTweak('mirrorPop', 'you');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "glyph"
  }, /*#__PURE__*/React.createElement(NavGlyph, {
    id: id,
    active: tab === id
  })), /*#__PURE__*/React.createElement("span", null, label))))), /*#__PURE__*/React.createElement(ErrorBoundary, {
    key: 'ov-' + (ov || 'none') + (person ? '-p' : '') + (city ? '-c' : ''),
    onReset: closeAll
  }, person && /*#__PURE__*/React.createElement(PersonOverlay, {
    p: person,
    me: me,
    onClose: () => setPerson(null)
  }), city && /*#__PURE__*/React.createElement(CityOverlay, {
    city: city,
    onClose: () => setCity(null)
  }), paidQ && window.PaidReportOverlay && /*#__PURE__*/React.createElement(window.PaidReportOverlay, {
    q: paidQ,
    onClose: () => setPaidQ(null)
  }), ov === 'askedby' && window.AskedByYouOverlay && /*#__PURE__*/React.createElement(window.AskedByYouOverlay, {
    onClose: () => setOv(null)
  }), (ov === 'catalog' || ov === 'catalog-author') && window.CatalogSheet && /*#__PURE__*/React.createElement(window.CatalogSheet, {
    onClose: () => setOv(null),
    focus: ov === 'catalog-author' ? 'author' : null
  }), ov === 'profile' && /*#__PURE__*/React.createElement(ProfileOverlay, {
    onClose: () => setOv(null),
    me: me,
    lensBoxed: false
  }), ov === 'suggest' && /*#__PURE__*/React.createElement(SuggestOverlay, {
    onClose: () => setOv(null)
  }), ov === 'search' && /*#__PURE__*/React.createElement(SearchOverlay, {
    onClose: () => setOv(null),
    onPerson: p => {
      setOv(null);
      setPerson(p);
    },
    onCity: c => {
      setOv(null);
      setCity(c);
    }
  }), ov === 'test' && /*#__PURE__*/React.createElement(TestOverlay, {
    kind: testKind,
    onClose: () => {
      setTestKind(null);
      backOv();
    },
    onComplete: () => {
      setTestKind(null);
      backOv();
    }
  }), ov === 'logic' && window.LogicOverlay && /*#__PURE__*/React.createElement(window.LogicOverlay, {
    onClose: () => setOv(null)
  }), ov === 'relmap' && /*#__PURE__*/React.createElement(RelationshipMapOverlay, {
    onClose: () => setOv(null)
  }))), /*#__PURE__*/React.createElement(TweaksPanel, null, /*#__PURE__*/React.createElement(TweakSection, {
    label: "Display"
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Density",
    value: t.density,
    options: ['compact', 'regular'],
    onChange: v => setTweak('density', v)
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Friend votes",
    value: t.friendVotes || 'rows',
    options: [{
      value: 'rows',
      label: 'On options'
    }, {
      value: 'footer',
      label: 'Footer'
    }, {
      value: 'off',
      label: 'Off'
    }],
    onChange: v => setTweak('friendVotes', v)
  }), /*#__PURE__*/React.createElement(TweakSection, {
    label: "Demo state"
  }), /*#__PURE__*/React.createElement(TweakSelect, {
    label: "Pulse history",
    value: t.pulseHistory || 'typical',
    options: ['typical', 'gap', 'day1', 'perfect'],
    onChange: v => setTweak('pulseHistory', v)
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Reset today's answers",
    secondary: true,
    onClick: () => {
      if (window.DUELS) window.DUELS.resetToday();
      setDailyKey(k => k + 1);
    }
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Clear today's pulse",
    secondary: true,
    onClick: () => {
      if (window.PULSE) window.PULSE.clearToday();
    }
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Clear feed memory",
    secondary: true,
    onClick: () => {
      if (window.FEEDREAD) window.FEEDREAD.reset();
      setDailyKey(k => k + 1);
    }
  })));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));