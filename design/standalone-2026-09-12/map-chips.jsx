function MTBranchChips({
  cats,
  activeCat,
  atHome,
  crumbs,
  onCrumb,
  onPick,
  onHome,
  findOpen,
  onFind,
  query,
  onQuery,
  fWeek,
  fRare,
  onWeek,
  onRare
}) {
  const {
    useRef,
    useEffect
  } = React;
  const rowRef = useRef(null);
  const inRef = useRef(null);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const el = row.querySelector(activeCat ? `[data-chip="${activeCat}"]` : ".mmt-trail");
    if (!el) return;
    const target = Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2);
    const from = row.scrollLeft,
      t0 = performance.now(),
      dur = 260;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      row.scrollLeft = from + (target - from) * (1 - Math.pow(1 - k, 3));
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }, [activeCat, findOpen]);
  useEffect(() => {
    if (findOpen && inRef.current) inRef.current.focus();
  }, [findOpen]);
  const trail = crumbs && crumbs.length ? crumbs : [{
    id: "home",
    label: "You"
  }];
  const deep = trail.length > 1;
  const glass = React.createElement("svg", {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    "aria-hidden": "true"
  }, React.createElement("circle", {
    cx: 7,
    cy: 7,
    r: 4.6
  }), React.createElement("path", {
    d: "M10.6 10.6 14 14"
  }));
  const crumb = (c, i) => {
    const last = i === trail.length - 1;
    const here = last && atHome;
    return React.createElement("button", {
      key: c.id,
      className: "mmt-crumb" + (last ? " is-last" : "") + (here ? " is-here" : "") + (c.hue != null ? " is-hue" : ""),
      style: c.hue != null ? {
        "--hue": c.hue
      } : undefined,
      "aria-current": here ? "location" : undefined,
      onClick: () => onCrumb ? onCrumb(c.id) : onHome && onHome()
    }, i === 0 ? deep ? React.createElement("span", {
      className: "mmt-back",
      "aria-hidden": "true"
    }, "‹") : React.createElement("span", {
      className: "mmt-chipbtn-dot is-rainbow",
      "aria-hidden": "true"
    }) : React.createElement("span", {
      className: "mmt-crumb-sep",
      "aria-hidden": "true"
    }, "›"), React.createElement("span", null, c.label));
  };
  const findUI = React.createElement("div", {
    className: "mmt-find"
  }, React.createElement("button", {
    className: "mmt-find-back",
    onClick: onFind,
    "aria-label": "Close find"
  }, "‹"), React.createElement("label", {
    className: "mmt-find-field"
  }, glass, React.createElement("input", {
    ref: inRef,
    type: "search",
    value: query || "",
    placeholder: "Find an answer…",
    autoComplete: "off",
    autoCorrect: "off",
    spellCheck: false,
    enterKeyHint: "search",
    onChange: e => onQuery(e.target.value),
    onKeyDown: e => {
      if (e.key === "Escape") onFind();
    }
  }), query ? React.createElement("button", {
    className: "mmt-find-clear",
    onClick: () => {
      onQuery("");
      inRef.current && inRef.current.focus();
    },
    "aria-label": "Clear"
  }, "✕") : null), React.createElement("button", {
    className: "mmt-findf" + (fWeek ? " is-on" : ""),
    "aria-pressed": !!fWeek,
    onClick: onWeek
  }, "This week"), React.createElement("button", {
    className: "mmt-findf" + (fRare ? " is-on" : ""),
    "aria-pressed": !!fRare,
    onClick: onRare
  }, "Rare takes"));
  const chipsUI = React.createElement(React.Fragment, null, React.createElement("div", {
    className: "mmt-chips",
    ref: rowRef,
    role: "tablist",
    "aria-label": "Map branches"
  }, React.createElement("div", {
    className: "mmt-trail" + (deep ? " is-deep" : "")
  }, trail.map(crumb)), cats.map(c => React.createElement("button", {
    key: c.id,
    "data-chip": c.id,
    className: "mmt-chipbtn" + (activeCat === c.id ? " is-on" : ""),
    style: {
      "--hue": c.hue
    },
    onClick: () => onPick(c.id)
  }, React.createElement("span", {
    className: "mmt-chipbtn-dot",
    "aria-hidden": "true"
  }), React.createElement("span", null, c.label)))), React.createElement("button", {
    className: "mmt-findbtn",
    onClick: onFind,
    "aria-label": "Find on the map"
  }, glass));
  return React.createElement("div", {
    className: "mmt-rail mmt-ui" + (findOpen ? " is-find" : ""),
    "data-nopan": ""
  }, findOpen ? findUI : chipsUI);
}
window.MTBranchChips = MTBranchChips;
