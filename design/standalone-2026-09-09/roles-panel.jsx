(function () {
  const {
    useState
  } = React;
  const firstName = n => String(n || "").split(" ")[0];
  function typeOf(key, dims) {
    const arch = window.IS_matchArchetype ? window.IS_matchArchetype(key, dims) : null;
    return arch ? arch.list[arch.idx] : null;
  }
  function RoleRow({
    testKey,
    label,
    span,
    open,
    onToggle,
    lead
  }) {
    const R = (window.IS_TEST_RESULTS || {})[testKey];
    if (!R) return null;
    const t = typeOf(testKey, R.dims);
    const cfg = (window.RP_TESTS || {})[testKey];
    return React.createElement("div", {
      style: {
        borderTop: "0.5px solid color-mix(in oklch, var(--rule), transparent 35%)"
      }
    }, React.createElement("button", {
      className: "press",
      onClick: onToggle,
      "aria-expanded": open,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        boxSizing: "border-box",
        border: "none",
        background: "none",
        padding: "9px 0",
        cursor: "pointer",
        textAlign: "left",
        WebkitAppearance: "none"
      }
    }, window.RoseMini ? React.createElement(window.RoseMini, {
      testKey: testKey,
      dims: R.dims,
      size: 38
    }) : null, React.createElement("span", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7
      }
    }, lead, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 750,
        color: "var(--ink)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, label)), t && React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, window.TypeMark ? React.createElement(window.TypeMark, {
      testKey: testKey,
      name: t.name,
      size: 13,
      plate: false
    }) : null, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 700,
        color: cfg ? cfg.banner : "var(--ink-2)"
      }
    }, t.name))), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--ink-3)",
        opacity: 0.85,
        whiteSpace: "nowrap",
        flexShrink: 0
      }
    }, span), React.createElement("span", {
      "aria-hidden": "true",
      style: {
        fontSize: 11,
        color: "var(--ink-3)",
        flexShrink: 0,
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform .18s"
      }
    }, "\u25BE")), open && React.createElement("div", {
      style: {
        padding: "2px 0 12px"
      }
    }, React.createElement(window.ResultProfileCard, {
      testKey: testKey,
      brief: true
    })));
  }
  function ThinRow({
    label,
    note,
    lead
  }) {
    return React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "11px 0",
        borderTop: "0.5px solid color-mix(in oklch, var(--rule), transparent 35%)"
      }
    }, React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        borderRadius: "50%",
        flexShrink: 0,
        border: "1px dashed color-mix(in oklch, var(--ink-3) 34%, transparent)"
      }
    }), React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        flex: 1,
        minWidth: 0
      }
    }, lead, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 700,
        color: "var(--ink-2)",
        whiteSpace: "nowrap"
      }
    }, label)), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--ink-3)",
        whiteSpace: "nowrap"
      }
    }, note));
  }
  function RolesPanel() {
    const [, bump] = React.useReducer(x => x + 1, 0);
    const [openKey, setOpenKey] = useState(null);
    React.useEffect(() => window.DUELS ? window.DUELS.subscribe(bump) : undefined, []);
    const RL = window.ROLES;
    if (!RL || !window.ResultProfileCard) return null;
    RL.sync();
    const duos = RL.duoList();
    const groups = RL.groupList();
    const toggle = k => setOpenKey(cur => cur === k ? null : k);
    const results = window.IS_TEST_RESULTS || {};
    const saw = RL.sawIt ? RL.sawIt() : {
      right: 0,
      total: 0
    };
    const castsOf = x => x.cast ? x.cast.n : 0;
    return React.createElement("div", null, React.createElement(window.TabSection, {
      title: "In 1v1s"
    }), results.duo ? React.createElement(React.Fragment, null, React.createElement(window.ResultProfileCard, {
      testKey: "duo",
      brief: true
    }), saw.total > 0 && React.createElement("div", {
      style: {
        marginTop: 10,
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "You guessed what they", "\u2019", "d say you are ", saw.right, " of ", saw.total, " time", saw.total === 1 ? "" : "s", ".")) : React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty",
        marginBottom: 6
      }
    }, "Every fourth round of a 1v1 asks what the other is to you ", "\u2014", " none has got there yet."), React.createElement("div", {
      className: "mmt-gwho",
      style: {
        marginTop: 16
      }
    }, "one at a time"), React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column"
      }
    }, duos.map(x => x.r ? React.createElement(RoleRow, {
      key: x.p.id,
      testKey: "duo:" + x.p.id,
      label: firstName(x.p.name),
      span: castsOf(x) + (castsOf(x) === 1 ? " round" : " rounds"),
      open: openKey === "duo:" + x.p.id,
      onToggle: () => toggle("duo:" + x.p.id),
      lead: React.createElement(window.Av, {
        init: x.p.init,
        hue: x.p.hue,
        size: 20
      })
    }) : React.createElement(ThinRow, {
      key: x.p.id,
      label: firstName(x.p.name),
      note: x.p.played ? "asked at round 4" : "not started",
      lead: React.createElement(window.Av, {
        init: x.p.init,
        hue: x.p.hue,
        size: 20
      })
    }))), React.createElement(window.TabSection, {
      title: "In groups"
    }), results.group ? React.createElement(window.ResultProfileCard, {
      testKey: "group",
      brief: true
    }) : React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty",
        marginBottom: 6
      }
    }, "No room has voted you into a role yet ", "\u2014", " the seat appears once one has."), React.createElement("div", {
      className: "mmt-gwho",
      style: {
        marginTop: 16
      }
    }, "one circle at a time"), React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column"
      }
    }, groups.map(({
      g,
      r
    }) => r ? React.createElement(RoleRow, {
      key: g.id,
      testKey: "group:" + g.id,
      label: g.name,
      span: r.n + " votes",
      open: openKey === "group:" + g.id,
      onToggle: () => toggle("group:" + g.id),
      lead: window.GDMark ? React.createElement(window.GDMark, {
        g: g,
        size: 20
      }) : null
    }) : React.createElement(ThinRow, {
      key: g.id,
      label: g.name,
      note: "not named yet",
      lead: window.GDMark ? React.createElement(window.GDMark, {
        g: g,
        size: 20
      }) : null
    }))));
  }
  Object.assign(window, {
    RolesPanel
  });
})();
