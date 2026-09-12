const {
  useState,
  useEffect
} = React;
const BRANDS = {
  doxa: {
    parts: ["Do", "x", "a"],
    serif: true
  },
  endoxa: {
    parts: ["En", "doxa", ""]
  },
  insight: {
    parts: ["in", "Sight", ""]
  }
};
const brandName = id => BRANDS[id].parts.join("");
const brandInit = () => {
  try {
    const v = localStorage.getItem("insight.brand.v2");
    if (BRANDS[v]) return v;
  } catch (e) {}
  return "doxa";
};
const TWEAK_DEFAULTS = {
  "brand": brandInit(),
  "density": "compact",
  "tab": "patterns",
  "mirrorPop": "circle",
  "worldZoom": "world",
  "pulseHistory": "typical",
  "friendVotes": "rows",
  "dailyStart": "seeded"
};
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
function NavGlyph({
  id,
  active
}) {
  const stroke = active ? "var(--ink)" : "var(--ink-3)";
  const sw = 1.2;
  if (id === "track") {
    return React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "22",
      height: "22",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M3 18.5 C6.2 18.2 6.4 12.6 9.5 12.8 C12.2 13 12.4 15.6 14.8 14.6 C17.6 13.4 18 7.4 20.6 6"
    }), React.createElement("circle", {
      cx: "3",
      cy: "18.5",
      r: "1.1",
      fill: stroke,
      stroke: "none"
    }), React.createElement("circle", {
      cx: "9.5",
      cy: "12.8",
      r: "1.1",
      fill: stroke,
      stroke: "none"
    }), React.createElement("circle", {
      cx: "14.8",
      cy: "14.6",
      r: "1.1",
      fill: stroke,
      stroke: "none"
    }), React.createElement("circle", {
      cx: "20.6",
      cy: "6",
      r: "2.6",
      fill: active ? "var(--ink)" : "transparent",
      fillOpacity: "0.14"
    }));
  }
  if (id === "mirror") {
    return React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "22",
      height: "22",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round"
    }, React.createElement("circle", {
      cx: "9",
      cy: "12",
      r: "6.4",
      fill: active ? "var(--ink)" : "transparent",
      fillOpacity: "0.12"
    }), React.createElement("circle", {
      cx: "15",
      cy: "12",
      r: "6.4",
      strokeDasharray: "1.5 1.8"
    }));
  }
  if (id === "patterns") {
    return React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "22",
      height: "22",
      fill: "none",
      stroke: stroke,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M5 17.5 L11.5 13.5 L18.5 15.5 M11.5 13.5 L10 6.5 M11.5 13.5 L19 5.5",
      opacity: "0.42"
    }), React.createElement("circle", {
      cx: "5",
      cy: "17.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), React.createElement("circle", {
      cx: "10",
      cy: "6.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), React.createElement("circle", {
      cx: "18.5",
      cy: "15.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), React.createElement("circle", {
      cx: "11.5",
      cy: "13.5",
      r: "1.4",
      fill: stroke,
      stroke: "none"
    }), React.createElement("circle", {
      cx: "19",
      cy: "5.5",
      r: "2.4",
      fill: active ? "var(--ink)" : "transparent",
      fillOpacity: "0.14"
    }));
  }
  return null;
}
const TABS = [{
  id: "patterns",
  label: "patterns"
}, {
  id: "track",
  label: "daily"
}, {
  id: "mirror",
  label: "mirror"
}];
const MIRROR_POP_IDS = ["you", "circle", "groups", "near", "world"];
const WORLD_ZOOM_IDS = ["city", "country", "world"];
const NAV_ONE = [{
  key: "patterns",
  tab: "patterns"
}, {
  key: "track:world",
  tab: "track",
  mode: "world"
}, {
  key: "track:group",
  tab: "track",
  mode: "group"
}, {
  key: "track:duo",
  tab: "track",
  mode: "duo"
}, {
  key: "mirror",
  tab: "mirror"
}];
const LIVE_OVERLAYS = ["profile", "test", "search", "relmap", "friends"];
function useLeaveHold(node, ms) {
  const last = React.useRef(null);
  const timer = React.useRef(null);
  const [leaving, setLeaving] = useState(false);
  if (node) last.current = node;
  const key = node ? node.key : null;
  useEffect(() => {
    if (node) {
      clearTimeout(timer.current);
      setLeaving(false);
      return;
    }
    if (!last.current) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      last.current = null;
      setLeaving(false);
    }, ms);
    return () => clearTimeout(timer.current);
  }, [key]);
  return {
    node: node || last.current,
    leaving: !node && leaving
  };
}
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
    console.error("[InSight] boundary caught:", err, info && info.componentStack);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return React.createElement("div", {
      style: {
        padding: "26px 18px"
      }
    }, React.createElement("div", {
      className: "card",
      style: {
        textAlign: "center",
        padding: "26px 18px"
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "var(--sans, system-ui)",
        fontSize: 21,
        color: "var(--ink, #20211f)"
      }
    }, "This view hit a snag."), React.createElement("div", {
      style: {
        fontFamily: "var(--sans, system-ui)",
        fontSize: 11,
        color: "var(--ink-3, #8a877f)",
        letterSpacing: "0.04em",
        margin: "10px 0 16px",
        wordBreak: "break-word"
      }
    }, String(this.state.err && this.state.err.message || this.state.err)), React.createElement("button", {
      onClick: () => {
        this.setState({
          err: null
        });
        if (this.props.onReset) this.props.onReset();
      },
      style: {
        padding: "9px 22px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: "var(--ink, #20211f)",
        color: "var(--surface, #faf8f2)",
        fontFamily: "var(--sans, system-ui)",
        fontSize: 15
      }
    }, "Take me back")));
  }
}
const DAILY_DOTS = [{
  id: "world",
  label: "World",
  acc: "var(--c-around)"
}, {
  id: "group",
  label: "Groups",
  acc: "var(--c-likeness)"
}, {
  id: "duo",
  label: "1v1s",
  acc: "var(--c-people)"
}];
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = id => TABS.some(x => x.id === id) ? id : "track";
  const [tab, setTab] = useState(validTab(t.tab));
  const [person, setPerson] = useState(null);
  const [city, setCity] = useState(null);
  const [ov, setOv] = useState(null);
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
  const [dailyMode, setDailyMode] = useState("world");
  const [docked, setDocked] = useState(false);
  const [testKind, setTestKind] = useState(null);
  const [ptLens, setPtLens] = useState("map");
  const PT_DIAL = [{
    id: "oracle",
    label: "Oracle",
    acc: "var(--c-today)"
  }, {
    id: "map",
    label: "Questions",
    acc: "var(--c-today)"
  }, {
    id: "people",
    label: "People",
    acc: "var(--c-today)"
  }];
  useEffect(() => {
    setDocked(false);
  }, [tab]);
  const mirrorPop = MIRROR_POP_IDS.includes(t.mirrorPop) ? t.mirrorPop : "you";
  const worldZoom = WORLD_ZOOM_IDS.includes(t.worldZoom) ? t.worldZoom : "world";
  const closeAll = () => {
    setOv(null);
    setPerson(null);
    setCity(null);
    setTestKind(null);
  };
  useEffect(() => {
    window.openLogicTest = () => {
      closeAll();
      setOv("logic");
    };
    return () => {
      delete window.openLogicTest;
    };
  }, []);
  useEffect(() => {
    window.openOverlay = key => {
      if (LIVE_OVERLAYS.includes(key)) {
        const from = ovRef.current;
        closeAll();
        setOv(key);
        setOvBack(from === "profile" && key !== "profile" ? "profile" : null);
      }
    };
    window.goTab = id => {
      closeAll();
      if (MIRROR_POP_IDS.includes(id)) {
        setTweak("mirrorPop", id);
        setTab("mirror");
        return;
      }
      if (TABS.some(x => x.id === id)) setTab(id);
    };
    window.goNav = key => {
      const it = NAV_ONE.find(x => x.key === key);
      if (!it) return;
      window.NAV_AT = Date.now();
      closeAll();
      if (it.tab !== "track") {
        if (it.tab === "mirror") setTweak("mirrorPop", "you");
        setTab(it.tab);
        return;
      }
      setDailyMode(it.mode);
      setTab("track");
    };
    window.openTest = k => {
      const from = ovRef.current;
      closeAll();
      setTestKind(k || null);
      setOv("test");
      setOvBack(from === "profile" ? "profile" : null);
    };
    window.openCity = name => {
      const c = (window.IS_DATA.cities || []).find(x => x.name === name);
      if (c) {
        closeAll();
        setCity(c);
      }
    };
    window.openPerson = who => {
      const list = window.IS_DATA.people || [];
      const p = typeof who === "object" ? who : list.find(x => x.id === who || x.name === who);
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
  const brand = BRANDS[t.brand] ? t.brand : "doxa";
  useEffect(() => {
    window.BRAND_NAME = brandName(brand);
    document.title = brandName(brand);
    try {
      localStorage.setItem("insight.brand.v2", brand);
    } catch (e) {}
  }, [brand]);
  useEffect(() => {
    const v = validTab(t.tab);
    if (v !== tab) setTab(v);
  }, [t.tab]);
  useEffect(() => {
    if (t.tab !== tab) setTweak("tab", tab);
  }, [tab]);
  const appClasses = `app surface-tint acc-now lens-paper ${t.density || "regular"} quiet-ground`;
  const ovLive = person || city || ov ? React.createElement(ErrorBoundary, {
    key: "ov-" + (ov || "none") + (person ? "-p" : "") + (city ? "-c" : ""),
    onReset: closeAll
  }, ov === "friends" && window.FriendsOverlay && React.createElement(window.FriendsOverlay, {
    onClose: backOv,
    back: !!ovBack,
    onPerson: p => setPerson(p)
  }), person && React.createElement(PersonOverlay, {
    p: person,
    me: me,
    onClose: () => setPerson(null)
  }), city && React.createElement(CityOverlay, {
    city: city,
    onClose: () => setCity(null)
  }), ov === "profile" && React.createElement(ProfileOverlay, {
    onClose: () => setOv(null),
    me: me,
    lensBoxed: false
  }), ov === "search" && React.createElement(SearchOverlay, {
    onClose: () => setOv(null),
    onPerson: p => {
      setOv(null);
      setPerson(p);
    },
    onCity: c => {
      setOv(null);
      setCity(c);
    }
  }), ov === "test" && React.createElement(TestOverlay, {
    kind: testKind,
    onClose: () => {
      setTestKind(null);
      backOv();
    },
    onComplete: () => {
      setTestKind(null);
      backOv();
    }
  }), ov === "logic" && window.LogicOverlay && React.createElement(window.LogicOverlay, {
    onClose: () => setOv(null)
  }), ov === "relmap" && React.createElement(RelationshipMapOverlay, {
    onClose: () => setOv(null)
  })) : null;
  const ovHold = useLeaveHold(ovLive, 200);
  window.IS_MARK_STYLE = "slice";
  window.IS_WPAL = "full";
  window.IS_PULSE_HISTORY = ["typical", "gap", "day1", "perfect"].includes(t.pulseHistory) ? t.pulseHistory : "typical";
  return React.createElement(IOSDevice, {
    width: 402,
    height: 874
  }, React.createElement("div", {
    className: appClasses,
    "data-tab": tab,
    "data-view": tab === "track" ? "track:" + dailyMode : tab === "mirror" ? "mirror:" + mirrorPop : tab,
    "data-lens-style": "underline",
    "data-docked": docked && (tab === "track" || tab === "patterns") ? "" : undefined,
    "data-mpop": tab === "mirror" ? mirrorPop : undefined,
    style: tab === "mirror" ? {
      "--accent": mirrorPop === "you" ? "var(--c-today)" : mirrorPop === "circle" ? "var(--c-people)" : mirrorPop === "groups" ? "var(--c-groups)" : mirrorPop === "world" ? "var(--c-world)" : "var(--c-city)"
    } : undefined
  }, React.createElement("header", {
    className: "app-header"
  }, React.createElement("button", {
    className: "avatar-btn" + (ov === "profile" ? " is-on" : ""),
    onClick: () => {
      if (ov === "profile") {
        setOv(null);
      } else {
        closeAll();
        setOv("profile");
      }
    }
  }, ov === "profile" ? "✕" : me.initials), React.createElement("div", {
    className: "h-center"
  }, React.createElement("div", {
    className: "h-title" + (BRANDS[brand].serif ? " wm-serif" : "")
  }, BRANDS[brand].parts[0], React.createElement("em", {
    style: tab === "track" ? {
      color: `color-mix(in oklch, ${(DAILY_DOTS.find(d => d.id === dailyMode) || DAILY_DOTS[0]).acc}, var(--ink) 12%)`
    } : undefined
  }, BRANDS[brand].parts[1]), BRANDS[brand].parts[2]), tab === "track" || tab === "patterns" ? React.createElement("div", {
    className: "h-dockslot",
    style: {
      justifyContent: "center"
    },
    "aria-hidden": !docked
  }, tab === "track" ? React.createElement("div", {
    className: "h-dockruler",
    role: "tablist",
    "aria-label": "Which daily"
  }, DAILY_DOTS.map(s => React.createElement("button", {
    key: s.id,
    role: "tab",
    "aria-selected": dailyMode === s.id,
    className: "h-dockstop" + (dailyMode === s.id ? " is-on" : ""),
    style: {
      "--dacc": s.acc
    },
    onClick: () => {
      if (window.HAPTIC && dailyMode !== s.id) window.HAPTIC.tick();
      setDailyMode(s.id);
    }
  }, s.label))) : tab === "patterns" ? React.createElement("div", {
    className: "h-dockruler",
    role: "tablist",
    "aria-label": "Which lens"
  }, PT_DIAL.map(s => React.createElement("button", {
    key: s.id,
    role: "tab",
    "aria-selected": ptLens === s.id,
    className: "h-dockstop" + (ptLens === s.id ? " is-on" : ""),
    style: {
      "--dacc": s.acc
    },
    onClick: () => {
      if (window.HAPTIC && ptLens !== s.id) window.HAPTIC.tick();
      setPtLens(s.id);
    }
  }, s.label))) : null) : null), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, window.PassiveMeter && React.createElement(window.PassiveMeter, null), React.createElement("button", {
    className: "icon-btn",
    "aria-label": "Search",
    onClick: () => {
      closeAll();
      setOv("search");
    }
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), React.createElement("line", {
    x1: "16.5",
    y1: "16.5",
    x2: "21",
    y2: "21"
  }))))), React.createElement("div", {
    className: "app-body"
  }, React.createElement(ErrorBoundary, {
    key: "tab-" + tab,
    onReset: () => {
      setTab("track");
      setTweak("tab", "track");
    }
  }, React.createElement("div", {
    className: "tab-swap",
    key: tab
  }, tab === "track" && React.createElement(DailySplit, {
    key: dailyKey + ":" + t.pulseHistory,
    mode: dailyMode,
    onMode: setDailyMode,
    onDock: setDocked,
    hideSwitcher: true,
    ruler: true,
    dock: true,
    start: t.dailyStart || "seeded",
    feedHier: true,
    pulse: true,
    feedOpts: {
      ...FEED_OPTS,
      friends: t.friendVotes || "rows"
    }
  }), tab === "patterns" && React.createElement(window.PatternsTab, {
    lens: ptLens,
    onLens: setPtLens,
    ruler: true,
    onDock: setDocked
  }), tab === "mirror" && React.createElement(MirrorTab, {
    key: "mirror-" + t.pulseHistory,
    onPerson: setPerson,
    pop: mirrorPop,
    onPop: v => setTweak("mirrorPop", v),
    worldZoom: worldZoom,
    onZoom: v => setTweak("worldZoom", v),
    firstRun: false,
    topNav: false,
    backKey: "track:duo"
  })))), React.createElement("nav", {
    className: "tabbar",
    "data-n": 3
  }, React.createElement("div", {
    className: "tab-group"
  }, TABS.map(({
    id,
    label
  }) => React.createElement("button", {
    key: id,
    className: "tab-btn" + (tab === id ? " is-active" : ""),
    onClick: () => {
      if (window.HAPTIC && tab !== id) window.HAPTIC.tick();
      window.NAV_AT = Date.now();
      if (id === "track" && tab === "mirror") setDailyMode("duo");
      setTab(id);
      closeAll();
      if (id === "mirror") setTweak("mirrorPop", "you");
    }
  }, React.createElement("span", {
    className: "glyph"
  }, React.createElement(NavGlyph, {
    id: id,
    active: tab === id
  })), React.createElement("span", null, label))))), React.createElement("div", {
    className: "ov-host" + (ovHold.leaving ? " is-leaving" : "")
  }, ovHold.node)), React.createElement(TweaksPanel, null, React.createElement(TweakSection, {
    label: "Brand"
  }), React.createElement(TweakRadio, {
    label: "Name",
    value: brand,
    options: [{
      value: "doxa",
      label: "Doxa"
    }, {
      value: "endoxa",
      label: "Endoxa"
    }, {
      value: "insight",
      label: "inSight"
    }],
    onChange: v => setTweak("brand", v)
  }), React.createElement(TweakSection, {
    label: "Display"
  }), React.createElement(TweakRadio, {
    label: "Density",
    value: t.density,
    options: ["compact", "regular"],
    onChange: v => setTweak("density", v)
  }), React.createElement(TweakRadio, {
    label: "Friend votes",
    value: t.friendVotes || "rows",
    options: [{
      value: "rows",
      label: "On options"
    }, {
      value: "footer",
      label: "Footer"
    }, {
      value: "off",
      label: "Off"
    }],
    onChange: v => setTweak("friendVotes", v)
  }), React.createElement(TweakSection, {
    label: "Demo state"
  }), React.createElement(TweakSelect, {
    label: "Group / 1v1 start",
    value: t.dailyStart || "seeded",
    options: [{
      value: "seeded",
      label: "sample circles"
    }, {
      value: "fresh",
      label: "fresh account"
    }, {
      value: "no-follows",
      label: "fresh · no follows"
    }, {
      value: "no-name",
      label: "fresh · no display name"
    }, {
      value: "invited",
      label: "invitation waiting"
    }, {
      value: "link",
      label: "tapped a link"
    }],
    onChange: v => setTweak("dailyStart", v)
  }), React.createElement(TweakSelect, {
    label: "Pulse history",
    value: t.pulseHistory || "typical",
    options: ["typical", "gap", "day1", "perfect"],
    onChange: v => setTweak("pulseHistory", v)
  }), React.createElement(TweakButton, {
    label: "Reset your open rounds",
    secondary: true,
    onClick: () => {
      if (window.DUELS) window.DUELS.resetRounds();
      setDailyKey(k => k + 1);
    }
  }), React.createElement(TweakButton, {
    label: "Clear today's pulse",
    secondary: true,
    onClick: () => {
      if (window.PULSE) window.PULSE.clearToday();
    }
  }), React.createElement(TweakButton, {
    label: "Clear feed memory",
    secondary: true,
    onClick: () => {
      if (window.FEEDREAD) window.FEEDREAD.reset();
      setDailyKey(k => k + 1);
    }
  })));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
