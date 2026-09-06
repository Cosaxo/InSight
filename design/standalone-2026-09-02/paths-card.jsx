// paths-card.jsx — CROSSROADS in the feed (paths-data.js). Walk a story three
// forks deep; the reveal is the whole tree — the crowd's flow through every
// branch, your road inked, your ending named, and how rare the walk was.
const ppC = h => window.WPAL.c(`oklch(0.52 0.14 ${h})`);
const ppInk = h => window.WPAL.ink(`oklch(0.52 0.14 ${h})`);
function PathsTree({
  st,
  walk
}) {
  const W = 372,
    H = 176,
    xs = [12, 130, 248, 362];
  const yOf = key => {
    const d = key.length;
    if (!d) return H / 2;
    let idx = 0;
    for (const ch of key) idx = idx * 2 + (ch === 'B' ? 1 : 0);
    return (idx + 0.5) * (H / Math.pow(2, d));
  };
  const keys = [];
  ['A', 'B'].forEach(a => {
    keys.push(a);
    ['A', 'B'].forEach(b => {
      keys.push(a + b);
      ['A', 'B'].forEach(c => keys.push(a + b + c));
    });
  });
  const end = st.endings[walk];
  return /*#__PURE__*/React.createElement("svg", {
    className: "pt-svg",
    viewBox: `0 0 ${W} ${H}`,
    style: {
      marginTop: 14
    }
  }, keys.map(k => {
    const x1 = xs[k.length - 1],
      y1 = yOf(k.slice(0, -1)),
      x2 = xs[k.length],
      y2 = yOf(k);
    const mx = (x1 + x2) / 2;
    const f = window.PATHS.flowOf(st.id, k);
    const on = walk.startsWith(k);
    // the walked road is the only strong ink; every other branch is a quiet
    // tint whose width is the crowd's flow, so the tree reads as one path
    // through a faint delta rather than a tangle of rivers
    return /*#__PURE__*/React.createElement("path", {
      key: k,
      d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
      fill: "none",
      stroke: on ? 'var(--pp-ink)' : 'color-mix(in oklch, var(--pp-c), var(--surface) 64%)',
      strokeWidth: on ? 3.5 : Math.max(1.1, f * 9),
      strokeLinecap: "round",
      opacity: on ? 1 : 0.9
    });
  }), keys.filter(k => walk.startsWith(k)).map(k => {
    const x1 = xs[k.length - 1],
      y1 = yOf(k.slice(0, -1)),
      x2 = xs[k.length],
      y2 = yOf(k);
    const mx = (x1 + x2) / 2;
    return /*#__PURE__*/React.createElement("path", {
      key: 'r' + k,
      d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
      fill: "none",
      stroke: "var(--pp-ink)",
      strokeWidth: "3.5",
      strokeLinecap: "round"
    });
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs[0],
    cy: H / 2,
    r: "4.5",
    fill: "var(--pp-ink)"
  }), keys.filter(k => k.length === 3).map(k => /*#__PURE__*/React.createElement("circle", {
    key: k,
    cx: xs[3],
    cy: yOf(k),
    r: k === walk ? 5 : 2.6,
    fill: k === walk ? 'var(--pp-ink)' : 'color-mix(in oklch, var(--pp-c), var(--surface) 40%)'
  })));
}
function PathsCard() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => window.PATHS.sub(force), []);
  const stories = window.PATHS.stories();
  const [sid, setSid] = React.useState(stories[0].id);
  const st = window.PATHS.storyOf(sid);
  const walk = window.PATHS.walkOf(sid);
  const done = walk.length >= 3;
  const node = done ? null : st.nodes[walk];
  const end = done ? st.endings[walk] : null;
  const flow = done ? window.PATHS.flowOf(sid, walk) : 0;
  const style = {
    '--pp-c': ppC(st.hue),
    '--pp-ink': ppInk(st.hue)
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "ar-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ar-kick",
    style: {
      color: 'var(--pp-ink)'
    }
  }, "Crossroads"), /*#__PURE__*/React.createElement("span", {
    className: "pp-steps"
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("i", {
    key: i,
    className: i < walk.length ? 'on' : ''
  })))), /*#__PURE__*/React.createElement("div", {
    className: "ar-name"
  }, st.title), !done && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "ar-rule"
  }, walk ? node.q : st.intro), !walk && /*#__PURE__*/React.createElement("div", {
    className: "pp-q"
  }, node.q), /*#__PURE__*/React.createElement("div", {
    className: "pp-choices"
  }, node.a.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "pp-choice",
    onClick: () => {
      if (window.HAPTIC) window.HAPTIC.tick();
      window.PATHS.choose(sid, i);
    }
  }, c.t)))), done && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PathsTree, {
    st: st,
    walk: walk
  }), /*#__PURE__*/React.createElement("div", {
    className: "pp-end"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 24,
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.1,
      color: 'var(--pp-ink)'
    }
  }, end.name), /*#__PURE__*/React.createElement("div", {
    className: "pp-line"
  }, end.line), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap',
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ar-chip",
    style: {
      background: 'color-mix(in oklch, var(--pp-c), var(--surface) 82%)',
      color: 'var(--pp-ink)'
    }
  }, "you and ", Math.round(flow * 100), "% ended here"), /*#__PURE__*/React.createElement("span", {
    className: "ar-chip",
    style: {
      background: 'color-mix(in oklch, var(--pp-c), var(--surface) 82%)',
      color: 'var(--pp-ink)'
    }
  }, "1 in ", Math.max(2, Math.round(1 / flow)), " walks your road"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "ar-next",
    style: {
      borderColor: 'var(--rule)',
      color: 'var(--ink-3)'
    },
    onClick: () => window.PATHS.reset(sid)
  }, "Walk again"))));
}
// the map's Crossroads leaf: the walked road, small — tree, ending, rarity
function MTPathsCard({
  node
}) {
  const st = window.PATHS.storyOf(node.sid);
  const walk = window.PATHS.walkOf(node.sid);
  if (!st || walk.length < 3) return null;
  const end = st.endings[walk],
    f = window.PATHS.flowOf(node.sid, walk);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      '--pp-c': ppC(st.hue),
      '--pp-ink': ppInk(st.hue),
      '--hue': st.hue
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mmt-kicker"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mmt-dot"
  }), "Crossroads"), /*#__PURE__*/React.createElement("div", {
    className: "mmt-title",
    style: {
      marginTop: 4
    }
  }, st.title), /*#__PURE__*/React.createElement(PathsTree, {
    st: st,
    walk: walk
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 9,
      marginTop: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 14.5,
      color: 'var(--ink)'
    }
  }, end.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--sans)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--ink-3)'
    }
  }, "1 in ", Math.max(2, Math.round(1 / f)), " walks this road")));
}
Object.assign(window, {
  PathsCard,
  PathsTree,
  MTPathsCard
});