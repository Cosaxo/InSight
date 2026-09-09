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
    return React.createElement("div", null, React.createElement(window.TabSection, {
      title: "In 1v1s"
    }), results.duo ? React.createElement(window.ResultProfileCard, {
      testKey: "duo",
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
    }, "No 1v1 has run ", RL.MIN_DUO, " days yet ", "\u2014", " the role appears once one has."), React.createElement("div", {
      className: "mmt-gwho",
      style: {
        marginTop: 16
      }
    }, "one at a time"), React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column"
      }
    }, duos.map(({
      p,
      r
    }) => r ? React.createElement(RoleRow, {
      key: p.id,
      testKey: "duo:" + p.id,
      label: firstName(p.name),
      span: r.n + " days",
      open: openKey === "duo:" + p.id,
      onToggle: () => toggle("duo:" + p.id),
      lead: React.createElement(window.Av, {
        init: p.init,
        hue: p.hue,
        size: 20
      })
    }) : React.createElement(ThinRow, {
      key: p.id,
      label: firstName(p.name),
      note: p.played ? p.played + " of " + RL.MIN_DUO + " rounds" : "not started",
      lead: React.createElement(window.Av, {
        init: p.init,
        hue: p.hue,
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
    }, "No group has ", RL.MIN_GROUP, " revealed days yet ", "\u2014", " the role appears once one has."), React.createElement("div", {
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
      span: r.n + " days",
      open: openKey === "group:" + g.id,
      onToggle: () => toggle("group:" + g.id),
      lead: window.GDMark ? React.createElement(window.GDMark, {
        g: g,
        size: 20
      }) : null
    }) : React.createElement(ThinRow, {
      key: g.id,
      label: g.name,
      note: "starts today",
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