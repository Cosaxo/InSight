function ProfileOverlay({
  onClose,
  me,
  lensBoxed
}) {
  const dims = [{
    label: "Openness",
    v: me.personality.O
  }, {
    label: "Conscientiousness",
    v: me.personality.C
  }, {
    label: "Extraversion",
    v: me.personality.E
  }, {
    label: "Agreeableness",
    v: me.personality.A
  }, {
    label: "Sensitivity",
    v: me.personality.N
  }];
  const SUBTABS = [{
    id: "general",
    label: "General"
  }, {
    id: "big5",
    label: "Big 5"
  }, {
    id: "politics",
    label: "Politics"
  }, {
    id: "values",
    label: "Values"
  }, {
    id: "attachment",
    label: "Social"
  }, {
    id: "roles",
    label: "Roles"
  }, {
    id: "lenses",
    label: "Lenses"
  }];
  const validSub = id => SUBTABS.some(s => s.id === id) ? id : "general";
  const [sub, setSubRaw] = React.useState(validSub(window.__profileSub));
  const setSub = id => {
    window.__profileSub = id;
    setSubRaw(id);
  };
  const [, fBump] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => window.FRIENDS ? window.FRIENDS.subscribe(fBump) : undefined, []);
  const fN = window.FRIENDS ? window.FRIENDS.count() : 0;
  const fReq = window.FRIENDS && window.FRIENDS.requests ? window.FRIENDS.requests().length : 0;
  const navRef = React.useRef(null);
  React.useEffect(() => {
    const sc = navRef.current;
    if (!sc) return;
    const put = () => {
      const btn = sc.querySelector(".subnav-btn.is-on");
      if (!btn) return;
      const max = sc.scrollWidth - sc.clientWidth;
      if (max <= 0) return;
      const want = Math.max(0, Math.min(max, btn.offsetLeft - (sc.clientWidth - btn.offsetWidth) / 2));
      if (Math.abs(sc.scrollLeft - want) > 2) sc.scrollLeft = want;
    };
    const raf = requestAnimationFrame(put);
    const t1 = setTimeout(put, 140);
    const t2 = setTimeout(put, 380);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sub]);
  const panelRef = React.useRef(null);
  const bodyRef = React.useRef(null);
  window.useSubSwipe(bodyRef, panelRef, SUBTABS.map(s => s.id), sub, setSub);
  const top = [...dims].sort((a, b) => b.v - a.v)[0];
  const labels = {
    Openness: {
      name: "The Seeker",
      tag: "open, curious, drawn to the new",
      glyph: "✶"
    },
    Conscientiousness: {
      name: "The Steady",
      tag: "ordered, deliberate, finishes what begins",
      glyph: "◆"
    },
    Extraversion: {
      name: "The Spark",
      tag: "energised by people, warm in company",
      glyph: "☀"
    },
    Agreeableness: {
      name: "The Kind",
      tag: "gentle, trusting, slow to judge",
      glyph: "✿"
    },
    Sensitivity: {
      name: "The Sensitive",
      tag: "feels deeply, weather close to the skin",
      glyph: "☾"
    }
  };
  const meta = labels[top.label];
  const TestCTA = ({
    k
  }) => {
    const taken = !!(window.IS_TEST_RESULTS || {})[k];
    if (taken) return null;
    return React.createElement("button", {
      onClick: () => window.openTest ? window.openTest(k) : window.openOverlay("test"),
      style: {
        width: "100%",
        padding: "13px",
        marginBottom: 14,
        cursor: "pointer",
        WebkitAppearance: "none",
        appearance: "none",
        background: "var(--ink)",
        color: "var(--surface)",
        border: "none",
        borderRadius: 14,
        fontFamily: "var(--sans)",
        fontSize: 14.5,
        fontWeight: 700,
        letterSpacing: "-0.01em"
      }
    }, "Take this test →");
  };
  const Big5Panel = () => window.ResultProfileCard ? React.createElement(React.Fragment, null, React.createElement(window.ResultProfileCard, {
    testKey: "big5",
    archetype: meta.name,
    tagline: meta.tag
  }), window.Big5Deep ? React.createElement(window.Big5Deep, null) : null) : React.createElement(TestVizCard, {
    testKey: "big5"
  });
  const PoliticsPanel = () => React.createElement(React.Fragment, null, window.ResultProfileCard && React.createElement(window.ResultProfileCard, {
    testKey: "political",
    archetype: me.politicalIdentity.name,
    tagline: me.politicalIdentity.tag
  }), window.PoliticsDeep ? React.createElement(window.PoliticsDeep, null) : null);
  const ValuesPanel = () => window.ResultProfileCard ? React.createElement(window.ResultProfileCard, {
    testKey: "values",
    archetype: me.moralLabel,
    tagline: "beauty and meaning pull hardest"
  }) : window.ValuesTiltCard ? React.createElement(window.ValuesTiltCard, {
    me: me
  }) : null;
  const AttachmentPanel = () => window.ResultProfileCard ? React.createElement(window.ResultProfileCard, {
    testKey: "attachment",
    archetype: "The Constant",
    tagline: "steady and affectionate — the friend who stays"
  }) : window.AttachmentCard ? React.createElement(window.AttachmentCard, null) : React.createElement(TestResultCard, {
    testKey: "attachment"
  });
  return React.createElement("div", {
    className: "overlay surface-tint profile-ov",
    style: {
      "--accent": "var(--c-people)"
    }
  }, React.createElement("div", {
    className: "app-header"
  }, React.createElement("button", {
    className: "avatar-btn",
    onClick: onClose
  }, "✕"), React.createElement("div", {
    className: "h-title"
  }, "Your ", React.createElement("em", null, "profile")), React.createElement("button", {
    className: "avatar-btn",
    onClick: () => window.openOverlay && window.openOverlay("friends"),
    "aria-label": fN + " friends" + (fReq > 0 ? ", " + fReq + " pending" : ""),
    title: fN + " friends",
    style: {
      position: "relative",
      flexShrink: 0
    }
  }, React.createElement("svg", {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true
  }, React.createElement("circle", {
    cx: 9.5,
    cy: 8.5,
    r: 3.4
  }), React.createElement("path", {
    d: "M3.5 19.5c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"
  }), React.createElement("path", {
    d: "M15.2 5.6a3.2 3.2 0 0 1 0 5.8M17.4 14.4c2 .7 3.3 2.5 3.3 5.1"
  })), fReq > 0 && React.createElement("span", {
    style: {
      position: "absolute",
      top: -1,
      right: -1,
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "oklch(0.6 0.2 25)",
      boxShadow: "0 0 0 2px var(--surface-a, var(--surface))"
    }
  }))), React.createElement("div", {
    ref: bodyRef,
    className: "app-body",
    style: {
      paddingTop: 0,
      overflowX: "hidden"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      marginTop: 16
    }
  }, React.createElement(Av, {
    init: me.initials,
    hue: 38,
    size: 52
  }), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "var(--sans)",
      fontWeight: 700,
      fontSize: 20,
      letterSpacing: "-0.02em",
      lineHeight: 1.15
    }
  }, me.name), React.createElement("div", {
    style: {
      fontFamily: "var(--sans)",
      fontSize: 13,
      color: "var(--ink-3)",
      marginTop: 3
    }
  }, me.location, " · ", me.country))), React.createElement("div", {
    className: "profile-subnav"
  }, React.createElement("div", {
    ref: navRef,
    className: "subnav subnav--scroll",
    style: {
      maxWidth: "100%"
    }
  }, SUBTABS.map(s => React.createElement("button", {
    key: s.id,
    onClick: () => setSub(s.id),
    className: "subnav-btn" + (s.id === sub ? " is-on" : "")
  }, s.label)))), React.createElement("div", {
    key: sub,
    ref: panelRef,
    className: "tab-swap",
    style: {
      marginTop: 4,
      willChange: "transform"
    }
  }, sub === "general" && React.createElement(window.GeneralPanel, {
    onGo: setSub
  }), sub === "big5" && React.createElement(React.Fragment, null, React.createElement(Big5Panel, null), React.createElement(TestCTA, {
    k: "big5"
  })), sub === "politics" && React.createElement(React.Fragment, null, React.createElement(PoliticsPanel, null), React.createElement(TestCTA, {
    k: "political"
  })), sub === "values" && React.createElement(React.Fragment, null, React.createElement(ValuesPanel, null), React.createElement(TestCTA, {
    k: "values"
  })), sub === "attachment" && React.createElement(React.Fragment, null, React.createElement(AttachmentPanel, null), React.createElement(TestCTA, {
    k: "attachment"
  })), sub === "roles" && window.RolesPanel && React.createElement(window.RolesPanel, null), sub === "lenses" && window.LensesPanel && React.createElement(window.LensesPanel, {
    boxed: lensBoxed
  }))));
}
Object.assign(window, {
  ProfileOverlay
});
