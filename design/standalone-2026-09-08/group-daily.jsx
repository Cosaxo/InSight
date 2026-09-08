(function () {
  const {
    useState,
    useEffect,
    useRef,
    useReducer
  } = React;
  const LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";
  const HAIR = "0.5px solid color-mix(in oklch, var(--rule), transparent 30%)";
  const ACC = "var(--c-likeness)";
  const WORLD = "var(--c-world)";
  const MISS = "var(--ochre-ink)";
  const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
  const col = g => ({
    display: "flex",
    flexDirection: "column",
    gap: g
  });
  const kick = {
    fontFamily: "var(--sans)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: "var(--ink-3)",
    whiteSpace: "nowrap"
  };
  const quiet = {
    fontFamily: "var(--sans)",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--ink-3)",
    lineHeight: 1.45,
    textWrap: "pretty"
  };
  const ghash = s => {
    let h = 9;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489);
    return ((h ^ h >>> 9) >>> 0) / 4294967295;
  };
  const ghue = g => Math.round(ghash(g.id) * 360);
  const ginit = name => {
    const w = name.replace(/^The\s+/i, "").split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w.slice(0, 2).map(x => x[0]).join("") : (w[0] || "?").slice(0, 2)).toUpperCase();
  };
  function GDMark({
    g,
    size = 34
  }) {
    return React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: Math.max(12, Math.round(size * 0.38)),
        letterSpacing: "-0.02em",
        color: "#fff",
        background: window.WPAL.ink(`oklch(0.52 0.12 ${ghue(g)})`)
      }
    }, ginit(g.name));
  }
  function GDAv({
    p,
    size = 26,
    sealed,
    plain
  }) {
    const open = e => {
      if (!p || p.me) return;
      e.stopPropagation();
      if (window.openPerson) window.openPerson(p);
    };
    const linked = !!(p && !p.me && !plain && window.openPerson);
    const fill = window.WPAL.ink(`oklch(0.52 0.13 ${p.hue})`);
    return React.createElement("span", {
      title: p.name + (p.pending ? " \xB7 invited" : ""),
      role: linked ? "button" : undefined,
      tabIndex: linked ? 0 : undefined,
      "aria-label": linked ? p.name + " \u2014 open profile" : undefined,
      onClick: linked ? open : undefined,
      onKeyDown: linked ? e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(e);
        }
      } : undefined,
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: Math.max(12, Math.round(size * 0.4)),
        color: "#fff",
        background: fill,
        boxShadow: sealed ? `0 0 0 1.5px var(--surface-a, var(--surface)), 0 0 0 3.5px ${window.WPAL.wash(fill, 42, "var(--surface-a, var(--surface))")}` : "0 0 0 1.5px var(--surface-a, var(--surface))",
        cursor: linked ? "pointer" : "default"
      }
    }, p.init);
  }
  function YouChip({
    size = 22,
    label = "you"
  }) {
    return React.createElement("span", {
      style: {
        height: size,
        padding: "0 9px",
        borderRadius: 999,
        flexShrink: 0,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 12,
        color: "var(--surface)",
        background: "var(--ink)",
        boxShadow: "0 0 0 1.5px var(--surface-a, var(--surface))"
      }
    }, label);
  }
  function OpenSeat({
    size = 26,
    acc = ACC
  }) {
    return React.createElement("span", {
      "aria-label": "open seat",
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        boxSizing: "border-box",
        border: `1.5px dashed color-mix(in oklch, ${acc} 72%, transparent)`
      }
    });
  }
  function SealMark({
    size = 14,
    acc = ACC,
    style
  }) {
    return React.createElement("span", {
      "aria-label": "sealed",
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: acc,
        boxShadow: `inset 0 0 0 2px var(--surface-a, var(--surface)), inset 0 0 0 3.5px ${acc}`,
        ...style
      }
    });
  }
  const RUN_TITLES = {
    1: "called it",
    0: "missed",
    n: "no call this round",
    s: "sealed \xB7 waiting for the reveal",
    o: "open \xB7 waiting for you",
    l: "late \xB7 scored nothing"
  };
  function RunDot({
    k,
    color,
    acc,
    size
  }) {
    const s = {
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: "50%",
      boxSizing: "border-box"
    };
    if (k === 1) s.background = color;else if (k === 0) s.border = `1.5px solid color-mix(in oklch, ${color} 55%, transparent)`;else if (k === "n") s.background = `color-mix(in oklch, ${color} 25%, transparent)`;else if (k === "s") {
      s.background = acc;
      s.boxShadow = `inset 0 0 0 2px var(--surface-a, var(--surface)), inset 0 0 0 3.5px ${acc}`;
    } else if (k === "o") s.border = "1.5px dashed color-mix(in oklch, var(--ink-3) 75%, transparent)";else if (k === "l") s.border = "1.5px dotted var(--ink-3)";
    return React.createElement("span", {
      title: RUN_TITLES[k],
      style: s
    });
  }
  function RoundRun({
    marks,
    color = ACC,
    acc = ACC,
    size = 13,
    label,
    aria
  }) {
    const ref = useRef(null);
    const long = marks.length > 14;
    React.useLayoutEffect(() => {
      const el = ref.current;
      if (el) el.scrollLeft = el.scrollWidth;
    }, [marks.length]);
    const scored = marks.filter(m => m === 1 || m === 0);
    const right = marks.filter(m => m === 1).length;
    return React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        minWidth: 0
      },
      "aria-label": aria
    }, label != null && React.createElement("span", {
      style: {
        flexShrink: 0,
        width: 62,
        padding: "3px 0",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 12.5,
        color: "var(--ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, label), long && React.createElement("span", {
      style: {
        flexShrink: 0,
        fontFamily: "var(--sans)",
        fontVariantNumeric: "tabular-nums",
        fontSize: size * 1.02,
        fontWeight: 800,
        color,
        letterSpacing: "-0.01em"
      }
    }, right, React.createElement("span", {
      style: {
        opacity: 0.42
      }
    }, "/", scored.length)), React.createElement("span", {
      ref: ref,
      className: long ? "h-scroll" : undefined,
      style: {
        display: "flex",
        gap: 3,
        alignItems: "center",
        overflowX: long ? "auto" : "visible",
        flex: long ? 1 : "none",
        minWidth: 0
      }
    }, marks.map((k, i) => React.createElement(RunDot, {
      key: i,
      k: k,
      color: color,
      acc: acc,
      size: size
    }))));
  }
  function RoundKicker({
    r,
    world,
    post,
    right
  }) {
    return React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10
      }
    }, React.createElement("span", {
      style: {
        display: "flex",
        gap: 5,
        alignItems: "baseline",
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      style: kick
    }, "Round ", r), world && React.createElement("span", {
      style: {
        ...kick,
        color: WORLD
      }
    }, "\xB7 World"), post && React.createElement("span", {
      style: kick
    }, post)), right && React.createElement("span", {
      style: {
        ...kick,
        fontVariantNumeric: "tabular-nums"
      }
    }, right));
  }
  const Prompt = ({
    children,
    size = 27
  }) => React.createElement("div", {
    style: {
      fontFamily: "var(--serif)",
      fontWeight: 500,
      fontSize: size,
      lineHeight: 1.14,
      letterSpacing: "-0.01em",
      textWrap: "balance",
      color: "var(--ink)"
    }
  }, children);
  const SmallPrompt = ({
    children
  }) => React.createElement("div", {
    style: {
      fontFamily: "var(--sans)",
      fontWeight: 700,
      fontSize: 17,
      lineHeight: 1.25,
      letterSpacing: "-0.01em",
      color: "var(--ink)",
      textWrap: "pretty"
    }
  }, children);
  function OptBtn({
    label,
    onClick,
    lead,
    tint = ACC
  }) {
    return React.createElement("button", {
      className: "press",
      onClick: onClick,
      style: {
        background: `color-mix(in oklch, ${tint} 7%, var(--surface))`,
        border: `1px solid color-mix(in oklch, ${tint} 30%, var(--rule))`,
        borderRadius: 16,
        boxShadow: "none",
        padding: "15px 17px",
        minHeight: 56,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 11,
        cursor: "pointer",
        textAlign: "left",
        WebkitAppearance: "none"
      }
    }, lead, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 17,
        color: "var(--ink)"
      }
    }, label));
  }
  function WorldCols({
    q,
    rows,
    them,
    themW = 92
  }) {
    const grid = {
      display: "grid",
      gridTemplateColumns: `minmax(0,1fr) 44px ${themW}px 64px`,
      gap: 8,
      alignItems: "center"
    };
    return React.createElement("div", {
      style: col(0)
    }, React.createElement("div", {
      style: {
        ...grid,
        alignItems: "baseline",
        paddingBottom: 6
      }
    }, React.createElement("span", null), React.createElement("span", {
      style: kick
    }, "you"), React.createElement("span", {
      style: {
        ...kick,
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, them), React.createElement("span", {
      style: {
        ...kick,
        color: WORLD
      }
    }, "World")), rows.map((o, i) => React.createElement("div", {
      key: i,
      style: {
        ...grid,
        padding: "10px 0",
        borderTop: HAIR
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 14,
        color: "var(--ink)",
        textWrap: "pretty"
      }
    }, o.label), React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        minHeight: 26
      }
    }, o.me ? React.createElement(YouChip, {
      label: o.meLabel || "you"
    }) : null), React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 3,
        minHeight: 26,
        flexWrap: "wrap"
      }
    }, o.who.map(p => React.createElement(GDAv, {
      key: p.id,
      p: p,
      size: 26
    }))), React.createElement("span", {
      style: col(4)
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 13,
        fontVariantNumeric: "tabular-nums",
        color: "var(--ink)"
      }
    }, q.split[i], "%"), React.createElement("span", {
      style: {
        height: 4,
        borderRadius: 999,
        background: `color-mix(in oklch, ${WORLD} 18%, transparent)`,
        overflow: "hidden"
      }
    }, React.createElement("span", {
      style: {
        display: "block",
        height: "100%",
        width: q.split[i] + "%",
        borderRadius: 999,
        background: WORLD
      }
    }))))));
  }
  function SealedList({
    title,
    items,
    line,
    acc = ACC
  }) {
    return React.createElement("div", {
      style: col(10)
    }, React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 19,
        fontWeight: 800,
        letterSpacing: -0.3,
        color: "var(--ink)"
      }
    }, title), React.createElement("div", {
      style: col(0)
    }, items.map(it => React.createElement("div", {
      key: it.n,
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 0",
        borderTop: HAIR
      }
    }, React.createElement(SealMark, {
      acc: acc,
      style: {
        marginTop: 3
      }
    }), React.createElement("span", {
      style: {
        width: 18,
        flexShrink: 0,
        paddingTop: 1,
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        color: "var(--ink-3)"
      }
    }, it.n), React.createElement("div", {
      style: {
        ...col(2),
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 700,
        lineHeight: 1.3,
        color: "var(--ink)",
        textWrap: "pretty"
      }
    }, it.prompt), React.createElement("span", {
      style: {
        ...quiet,
        lineHeight: 1.4
      }
    }, it.sub)), it.dl && React.createElement("span", {
      style: {
        flexShrink: 0,
        paddingTop: 1,
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: "var(--ink-3)",
        whiteSpace: "nowrap"
      }
    }, it.dl)))), React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.45,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, line));
  }
  function AheadBtn({
    r,
    onClick
  }) {
    return React.createElement("button", {
      className: "press",
      onClick: onClick,
      style: {
        alignSelf: "flex-start",
        minHeight: 44,
        padding: "0 4px",
        border: "none",
        background: "none",
        cursor: "pointer",
        WebkitAppearance: "none",
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 13.5,
        color: "var(--ink-2)"
      }
    }, "Round ", r, " is open ", React.createElement("span", {
      style: {
        color: "var(--ink)",
        fontWeight: 800
      }
    }, "\u2014 answer ahead ", "\u203A"));
  }
  const Band = ({
    big,
    sub,
    acc = ACC
  }) => React.createElement("div", {
    style: col(2)
  }, React.createElement("span", {
    style: {
      fontFamily: "var(--sans)",
      fontSize: 15,
      fontWeight: 800,
      letterSpacing: "-0.01em",
      color: acc
    }
  }, big), React.createElement("span", {
    style: quiet
  }, sub));
  const Rule = () => React.createElement("div", {
    style: {
      height: 0,
      borderTop: "0.5px solid var(--rule)"
    }
  });
  function GDReveal({
    picks
  }) {
    const {
      q,
      rows,
      mine,
      late,
      counts
    } = picks;
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return React.createElement("div", {
      style: col(8)
    }, rows.map(r => {
      const isMine = mine === r.oi;
      const ct = counts[r.oi] + (isMine && late ? 1 : 0);
      if (!ct) return null;
      return React.createElement("div", {
        key: r.oi,
        style: {
          position: "relative",
          overflow: "hidden",
          borderRadius: 14,
          border: isMine ? `1.5px solid color-mix(in oklch, ${ACC} 55%, transparent)` : LINE,
          background: "var(--surface-2)"
        }
      }, React.createElement("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: counts[r.oi] / total * 100 + "%",
          background: `color-mix(in oklch, ${ACC} 13%, transparent)`
        }
      }), React.createElement("div", {
        style: {
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          minHeight: 44,
          boxSizing: "border-box"
        }
      }, React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          fontFamily: "var(--sans)",
          fontWeight: 700,
          fontSize: 13.5
        }
      }, r.label), React.createElement("span", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }
      }, r.who.map(p => React.createElement(GDAv, {
        key: p.id,
        p: p,
        size: 26
      })), isMine && React.createElement(YouChip, {
        size: 26,
        label: late ? "you \xB7 late" : "you"
      }))));
    }));
  }
  function GroupRevealBlock({
    picks,
    g
  }) {
    const {
      q,
      r,
      mine,
      late,
      myCall,
      callRight,
      majority,
      played,
      absent,
      closed
    } = picks;
    const meIn = mine != null;
    const openSeats = absent + (meIn ? 0 : 1);
    return React.createElement("div", {
      style: col(10)
    }, React.createElement(RoundKicker, {
      r: r,
      world: q.world,
      post: closed && (absent || !meIn) ? "\xB7 closed at the deadline" : "\xB7 revealed"
    }), React.createElement(SmallPrompt, null, q.prompt), q.world ? React.createElement(WorldCols, {
      q: q,
      them: g.name,
      rows: picks.rows.map(row => ({
        label: row.label,
        me: mine === row.oi,
        meLabel: late ? "you \xB7 late" : "you",
        who: row.who
      }))
    }) : React.createElement(GDReveal, {
      picks: picks
    }), openSeats > 0 && React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        paddingTop: 2
      },
      "aria-label": "Who played"
    }, played.map(p => React.createElement(GDAv, {
      key: p.id,
      p: p,
      size: 30
    })), meIn && React.createElement(YouChip, {
      size: 30,
      label: late ? "you \xB7 late" : "you"
    }), Array.from({
      length: openSeats
    }, (_, i) => React.createElement(OpenSeat, {
      key: i,
      size: 30
    }))), React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "4px 12px",
        alignItems: "baseline",
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)"
      }
    }, React.createElement("span", null, "The room landed on ", q.options[majority]), myCall != null && !late && React.createElement("span", {
      style: {
        fontWeight: 800,
        color: callRight ? ACC : MISS
      }
    }, callRight ? "\u2713 you called it" : "you called " + q.options[myCall])), late && React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.45,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "Answered after the reveal. It shows, and scores nothing."));
  }
  function GroupRail({
    gs,
    cur,
    onPick,
    onAdd
  }) {
    return React.createElement("div", {
      className: "h-scroll",
      style: {
        display: "flex",
        gap: 4,
        overflowX: "auto",
        padding: "3px 6px 2px"
      }
    }, gs.map(g => {
      const sel = g.id === cur;
      const pending = !g.done;
      return React.createElement("button", {
        key: g.id,
        onClick: () => onPick(g.id),
        "aria-current": sel ? "true" : undefined,
        "aria-label": g.name + " \u2014 " + (pending ? "your turn" : "played"),
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: "4px 6px",
          WebkitAppearance: "none",
          flexShrink: 0,
          width: 62,
          minHeight: 44
        }
      }, React.createElement("span", {
        style: {
          position: "relative",
          display: "inline-flex",
          borderRadius: 14,
          padding: 2,
          boxShadow: sel ? `0 0 0 2px ${ACC}` : "none",
          transition: "box-shadow .18s"
        }
      }, React.createElement(GDMark, {
        g: g,
        size: 38
      }), pending && React.createElement("span", {
        style: {
          position: "absolute",
          top: -1,
          right: -1,
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: ACC,
          border: "2px solid var(--surface)"
        }
      })), React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 12,
          fontWeight: sel ? 800 : 600,
          color: sel ? "var(--ink)" : "var(--ink-3)",
          whiteSpace: "nowrap",
          maxWidth: 60,
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, g.name));
    }), onAdd && React.createElement("button", {
      onClick: onAdd,
      "aria-label": "Create a group",
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "4px 6px",
        WebkitAppearance: "none",
        flexShrink: 0,
        width: 62,
        minHeight: 44
      }
    }, React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        margin: 2,
        borderRadius: 11,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1.5px dashed color-mix(in oklch, var(--ink-3) 55%, transparent)",
        color: "var(--ink-2)",
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1
      }
    }, "+"), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, "New")));
  }
  function GroupCard({
    g,
    vh
  }) {
    const D = window.DUELS;
    const v = D.groupView(g.id);
    const [mg, setMg] = useState(false);
    const [mgClosing, setMgClosing] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [aheadOpen, setAheadOpen] = useState(false);
    const [, tick] = useReducer(x => x + 1, 0);
    useEffect(() => {
      const t = setInterval(tick, 30000);
      return () => clearInterval(t);
    }, []);
    useEffect(() => {
      if (v.ahead === 0) setAheadOpen(false);
    }, [v.ahead]);
    const closeMg = () => {
      if (mgClosing) return;
      setMgClosing(true);
      setTimeout(() => {
        setMg(false);
        setMgClosing(false);
        setConfirmLeave(false);
      }, 230);
    };
    const nInvited = g.members.filter(m => m.pending).length;
    const addable = D.members().filter(f => !g.members.some(m => m.id === f.id));
    const left = r => D.fmtLeft(v.deadline(r) - Date.now());
    const header = React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement(GDMark, {
      g: g,
      size: 30
    }), React.createElement("span", {
      style: {
        fontWeight: 800,
        fontSize: 15
      }
    }, g.name), nInvited > 0 && React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, nInvited, " invited"), React.createElement("button", {
      "aria-label": "Manage " + g.name,
      onClick: () => setMg(true),
      style: {
        marginLeft: "auto",
        marginRight: -12,
        width: 44,
        height: 44,
        border: "none",
        background: "none",
        cursor: "pointer",
        color: "var(--ink-3)",
        fontSize: 17,
        fontWeight: 800,
        lineHeight: 1,
        WebkitAppearance: "none"
      }
    }, "\u22EF"));
    const manageSheet = mg && document.querySelector(".app") && ReactDOM.createPortal(React.createElement("div", {
      className: "wf-scrim" + (mgClosing ? " is-closing" : ""),
      onClick: closeMg
    }, React.createElement("div", {
      className: "wf-sheet",
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      className: "wf-sheet-grab"
    }), React.createElement("div", {
      style: {
        padding: "10px 18px 8px",
        display: "flex",
        alignItems: "baseline",
        gap: 10
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 15,
        flexShrink: 0
      }
    }, g.name), React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: "var(--ink-3)",
        flex: 1
      }
    }, g.members.length + 1, " members"), React.createElement("button", {
      onClick: closeMg,
      "aria-label": "Close",
      style: {
        border: "none",
        background: "var(--surface-2)",
        width: 26,
        height: 26,
        borderRadius: "50%",
        cursor: "pointer",
        fontSize: 12,
        color: "var(--ink-2)",
        WebkitAppearance: "none"
      }
    }, "\u2715")), React.createElement("div", {
      className: "wf-sheet-body",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, g.members.map(m => React.createElement("div", {
      key: m.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        border: LINE,
        borderRadius: 14,
        background: "var(--surface-2)",
        padding: "9px 13px"
      }
    }, React.createElement(GDAv, {
      p: m,
      size: 30
    }), React.createElement("span", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 1,
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 13.5
      }
    }, m.name), React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, m.pending ? "invited \xB7 waiting" : m.rel)), React.createElement("button", {
      onClick: () => D.removeGroupMember(g.id, m.id),
      "aria-label": "Remove " + m.name,
      style: {
        flexShrink: 0,
        border: "none",
        background: "var(--surface-3)",
        color: "var(--ink-2)",
        width: 24,
        height: 24,
        borderRadius: "50%",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 800,
        WebkitAppearance: "none"
      }
    }, "\u2715"))), addable.length > 0 && React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 7,
        paddingTop: 6
      }
    }, React.createElement("span", {
      className: "kicker",
      style: {
        marginBottom: 0
      }
    }, "Add from your circle"), React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7
      }
    }, addable.map(f => React.createElement("button", {
      key: f.id,
      className: "press",
      onClick: () => D.addGroupMembers(g.id, [f.id]),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        border: LINE,
        borderRadius: 999,
        background: "var(--surface-2)",
        padding: "5px 13px 5px 6px",
        cursor: "pointer",
        WebkitAppearance: "none",
        minHeight: 44
      }
    }, React.createElement(GDAv, {
      p: f,
      size: 26,
      plain: true
    }), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 12.5,
        color: "var(--ink)"
      }
    }, "+ ", f.name.split(" ")[0]))))), React.createElement("div", {
      style: {
        borderTop: "0.5px solid var(--rule)",
        marginTop: 8,
        paddingTop: 12,
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, confirmLeave ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)"
      }
    }, "Leave ", g.name, "?"), React.createElement("button", {
      onClick: () => {
        closeMg();
        setTimeout(() => D.leaveGroup(g.id), 240);
      },
      style: {
        border: "none",
        background: "var(--ochre-ink)",
        color: "#fff",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 12,
        padding: "7px 15px",
        borderRadius: 999,
        cursor: "pointer",
        WebkitAppearance: "none"
      }
    }, "Leave"), React.createElement("button", {
      onClick: () => setConfirmLeave(false),
      style: {
        border: LINE,
        background: "var(--surface-2)",
        color: "var(--ink)",
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 12,
        padding: "7px 13px",
        borderRadius: 999,
        cursor: "pointer",
        WebkitAppearance: "none"
      }
    }, "Stay")) : React.createElement("button", {
      onClick: () => setConfirmLeave(true),
      style: {
        border: "none",
        background: "none",
        color: "var(--ochre-ink)",
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 13,
        padding: 0,
        minHeight: 44,
        cursor: "pointer",
        WebkitAppearance: "none"
      }
    }, "Leave group"))))), document.querySelector(".app"));
    const askBlock = (r, showPrompt) => {
      const q = v.q(r);
      const closed = v.openClosed && r === v.open;
      return React.createElement("div", {
        style: col(12),
        key: "ask" + r
      }, showPrompt && React.createElement(RoundKicker, {
        r: r,
        world: q.world,
        right: closed ? null : left(r) + " left"
      }), showPrompt && React.createElement(Prompt, null, q.prompt), React.createElement("div", {
        style: col(9)
      }, q.options.map((o, i) => {
        const mem = q.kind === "pick" ? g.members.find(p => p.name.split(" ")[0] === o) : null;
        const lead = q.kind === "pick" ? mem ? React.createElement(GDAv, {
          p: mem,
          size: 26,
          plain: true
        }) : React.createElement(YouChip, {
          size: 26
        }) : null;
        return React.createElement(OptBtn, {
          key: o,
          label: o,
          lead: lead,
          onClick: () => D.answerGroup(g.id, i, r)
        });
      })), closed && React.createElement("div", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.45,
          color: "var(--ink-2)",
          textWrap: "pretty"
        }
      }, "Answering now shows as late and scores nothing."));
    };
    const callBlock = r => {
      const q = v.q(r),
        mine = v.mine(r);
      return React.createElement("div", {
        style: {
          ...col(12),
          animation: "popIn .3s cubic-bezier(0.2,0.8,0.2,1)"
        },
        key: "call" + r
      }, React.createElement("div", {
        style: {
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink-2)"
        }
      }, "You picked ", React.createElement("b", {
        style: {
          color: "var(--ink)"
        }
      }, q.options[mine.a]), "."), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, React.createElement(GDMark, {
        g: g,
        size: 38
      }), React.createElement(Prompt, null, "And the room lands on", "\u2026", "?")), React.createElement("div", {
        style: col(9)
      }, q.options.map((o, i) => React.createElement(OptBtn, {
        key: o,
        label: o,
        onClick: () => D.callGroup(g.id, i, r)
      }))));
    };
    const waitBlock = () => {
      const r = v.revealed + 1;
      const q = v.q(r),
        mine = v.mine(r);
      const who = v.who(r);
      return React.createElement("div", {
        style: {
          ...col(16),
          animation: "popIn .35s cubic-bezier(0.2,0.8,0.2,1)"
        },
        key: "wait"
      }, React.createElement(RoundKicker, {
        r: r,
        world: q.world
      }), React.createElement(Prompt, {
        size: 24
      }, q.prompt), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "baseline",
          gap: 9
        }
      }, React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-3)"
        }
      }, "you said"), React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontWeight: 800,
          fontSize: 19,
          letterSpacing: -0.3,
          color: "var(--ink)"
        }
      }, q.options[mine.a])), React.createElement("div", {
        style: {
          ...col(12),
          borderTop: HAIR,
          padding: "16px 0 2px"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center"
        },
        "aria-label": "Who has played"
      }, who.map(p => React.createElement(GDAv, {
        key: p.id,
        p: p,
        size: 34,
        sealed: p.played
      })), React.createElement(YouChip, {
        size: 34
      })), React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-2)",
          fontVariantNumeric: "tabular-nums",
          textWrap: "pretty"
        }
      }, "Reveals when everyone has played ", "\xB7", " ", left(r), " at the latest")));
    };
    const sealedBlock = () => React.createElement(SealedList, {
      key: "sealed",
      title: `${WORDS[v.ahead] || v.ahead} rounds waiting on ${g.name}`,
      line: "Each reveals when everyone has played, or at its deadline.",
      items: v.sealed.map(r => {
        const q = v.q(r),
          m = v.mine(r);
        return {
          n: r,
          prompt: q.prompt,
          dl: left(r),
          sub: (q.world ? "World \xB7 " : "") + "you: " + q.options[m.a] + (m.g != null ? " \xB7 called " + q.options[m.g] : "")
        };
      })
    });
    let body;
    if (v.callDue != null) body = callBlock(v.callDue);else if (v.ahead >= 1 && !aheadOpen) {
      body = React.createElement("div", {
        style: col(14),
        key: "ahead"
      }, v.ahead === 1 ? waitBlock() : sealedBlock(), v.open != null && React.createElement(AheadBtn, {
        r: v.open,
        onClick: () => setAheadOpen(true)
      }));
    } else if (v.open != null) {
      const mine = v.mine(v.open);
      body = mine.a == null ? askBlock(v.open, !(v.openClosed && v.lastRevealed && v.lastRevealed.r === v.open)) : callBlock(v.open);
    } else {
      body = React.createElement("div", {
        key: "lead",
        style: quiet
      }, "Nothing waiting on you here.");
    }
    const top = Math.max(v.myTop, v.theirTop, v.open || 0, v.callDue || 0);
    const marks = [];
    for (let r = 1; r <= top; r++) {
      if (r <= v.revealed) {
        const pk = v.picks(r);
        marks.push(pk.late ? "l" : pk.myCall == null ? "n" : pk.callRight ? 1 : 0);
      } else marks.push(v.mine(r).a != null ? "s" : "o");
    }
    const nWait = v.waiting;
    return React.createElement("div", {
      "data-group-card": g.id,
      style: {
        minHeight: v.open != null && !v.ahead ? Math.min(Math.max((vh || 540) - 190, 250), 380) : 0,
        boxSizing: "border-box",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        borderTop: LINE,
        padding: "20px 1px 26px"
      }
    }, header, nWait >= 2 && React.createElement(Band, {
      big: `${nWait} rounds waiting for you`,
      sub: "each reveals when everyone has played, or at its deadline"
    }), v.lastRevealed && React.createElement(GroupRevealBlock, {
      picks: v.lastRevealed,
      g: g
    }), v.lastRevealed && React.createElement(Rule, null), body, marks.length > 0 && React.createElement("div", {
      style: {
        ...col(8),
        borderTop: HAIR,
        paddingTop: 13
      }
    }, React.createElement(RoundRun, {
      marks: marks,
      label: "you",
      aria: "Your calls on where the room lands, one mark per round"
    })), manageSheet);
  }
  function GroupDailyBody({
    start
  }) {
    const D = window.DUELS;
    const [, bump] = useReducer(x => x + 1, 0);
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => D.subscribe(bump), []);
    const gs = D.groups();
    const orderRef = useRef(null);
    if (!orderRef.current) orderRef.current = [...gs].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).map(x => x.id);
    const ordered = orderRef.current.map(id => gs.find(x => x.id === id)).filter(Boolean).concat(gs.filter(x => !orderRef.current.includes(x.id)));
    const [addOpen, setAddOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [gname, setGname] = useState("");
    const [sel, setSel] = useState([]);
    const closeAdd = () => {
      if (closing) return;
      setClosing(true);
      setTimeout(() => {
        setAddOpen(false);
        setClosing(false);
        setGname("");
        setSel([]);
      }, 230);
    };
    const friends = D.members();
    const toggleSel = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.concat(id));
    const canCreate = gname.trim().length > 0 && sel.length >= 2;
    const [cur, setCur] = useState(ordered[0] && ordered[0].id);
    const [vh, setVh] = useState(0);
    const rootRef = useRef(null);
    const railRef = useRef(null);
    const scRef = useRef(null);
    useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      let sc = el.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      scRef.current = sc;
      if (!sc) return;
      sc.style.scrollSnapType = "y proximity";
      const railH = railRef.current ? railRef.current.offsetHeight : 80;
      sc.style.scrollPaddingTop = railH + 14 + "px";
      setVh(sc.clientHeight - railH);
      const onScroll = () => {
        const st = sc.getBoundingClientRect().top + railH;
        let best = null,
          bd = Infinity;
        el.querySelectorAll("[data-group-card]").forEach(c => {
          const d = Math.abs(c.getBoundingClientRect().top - st - 80);
          if (d < bd) {
            bd = d;
            best = c;
          }
        });
        if (best) setCur(best.getAttribute("data-group-card"));
      };
      sc.addEventListener("scroll", onScroll, {
        passive: true
      });
      return () => {
        sc.removeEventListener("scroll", onScroll);
        sc.style.scrollSnapType = "";
        sc.style.scrollPaddingTop = "";
      };
    }, []);
    const jump = gid => {
      const sc = scRef.current,
        el = rootRef.current;
      if (!sc || !el) return;
      const card = el.querySelector("[data-group-card=\"" + gid + "\"]");
      if (!card) return;
      const railH = railRef.current ? railRef.current.offsetHeight : 80;
      sc.scrollTo({
        top: card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14,
        behavior: "smooth"
      });
    };
    useEffect(() => {
      const go = () => {
        const f = window.GROUP_FOCUS;
        if (!f) return;
        delete window.GROUP_FOCUS;
        if (!ordered.some(x => x.id === f)) return;
        setCur(f);
        const t0 = Date.now();
        const tick = setInterval(() => {
          const sc = scRef.current,
            el = rootRef.current;
          const done = () => clearInterval(tick);
          if (Date.now() - t0 > 1400) return done();
          if (!sc || !el) return;
          const card = el.querySelector("[data-group-card=\"" + f + "\"]");
          if (!card) return;
          const railH = railRef.current ? railRef.current.offsetHeight : 80;
          const target = Math.max(0, card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14);
          if (Math.abs(sc.scrollTop - target) > 40) sc.scrollTop = target;else if (Date.now() - t0 > 800) done();
        }, 120);
      };
      go();
      window.addEventListener("is:group-focus", go);
      return () => window.removeEventListener("is:group-focus", go);
    }, []);
    const nLeft = ordered.filter(g => !g.done).length;
    const forced = start && start !== "seeded" && !dismissed;
    if ((forced || !ordered.length) && window.FirstDay) {
      return React.createElement("div", {
        ref: rootRef
      }, React.createElement(window.FirstDay, {
        mode: "group",
        state: forced ? start : "fresh",
        onDone: () => setDismissed(true)
      }));
    }
    return React.createElement("div", {
      ref: rootRef,
      style: col(10)
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        padding: "0 2px",
        scrollSnapAlign: "start"
      }
    }, nLeft > 0 && React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--ink-3)"
      }
    }, nLeft, " to play")), React.createElement("div", {
      ref: railRef,
      style: {
        position: "sticky",
        top: 0,
        zIndex: 6,
        margin: "-1px -16px 0",
        padding: "1px 10px 0",
        background: "var(--surface-a, var(--surface))",
        borderBottom: "0.5px solid color-mix(in oklch, var(--rule), transparent 25%)"
      }
    }, React.createElement(GroupRail, {
      gs: ordered,
      cur: cur,
      onPick: jump,
      onAdd: () => setAddOpen(true)
    })), React.createElement("div", {
      style: col(10)
    }, ordered.map(g => React.createElement(GroupCard, {
      key: g.id,
      g: g,
      vh: vh
    }))), addOpen && document.querySelector(".app") && ReactDOM.createPortal(React.createElement("div", {
      className: "wf-scrim" + (closing ? " is-closing" : ""),
      onClick: closeAdd
    }, React.createElement("div", {
      className: "wf-sheet",
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      className: "wf-sheet-grab"
    }), React.createElement("div", {
      style: {
        padding: "10px 18px 8px",
        display: "flex",
        alignItems: "baseline",
        gap: 10
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 15,
        flexShrink: 0
      }
    }, "New group"), React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: "var(--ink-3)",
        flex: 1
      }
    }, "a question a round, revealed with names"), React.createElement("button", {
      onClick: closeAdd,
      "aria-label": "Close",
      style: {
        border: "none",
        background: "var(--surface-2)",
        width: 26,
        height: 26,
        borderRadius: "50%",
        cursor: "pointer",
        fontSize: 12,
        color: "var(--ink-2)",
        WebkitAppearance: "none"
      }
    }, "\u2715")), React.createElement("div", {
      className: "wf-sheet-body",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 13
      }
    }, React.createElement("input", {
      value: gname,
      onChange: e => setGname(e.target.value),
      placeholder: "Group name",
      maxLength: 24,
      autoFocus: true,
      autoComplete: "off",
      autoCapitalize: "words",
      enterKeyHint: "done",
      style: {
        width: "100%",
        boxSizing: "border-box",
        border: LINE,
        borderRadius: 13,
        background: "var(--surface-2)",
        padding: "12px 14px",
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 16,
        color: "var(--ink)",
        outline: "none"
      }
    }), React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, React.createElement("span", {
      className: "kicker",
      style: {
        marginBottom: 0
      }
    }, "Who", "\u2019", "s in ", "\xB7", " pick at least 2"), React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7
      }
    }, friends.map(f => {
      const on = sel.includes(f.id);
      return React.createElement("button", {
        key: f.id,
        className: "press",
        onClick: () => toggleSel(f.id),
        "aria-pressed": on,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          borderRadius: 999,
          padding: "5px 13px 5px 6px",
          cursor: "pointer",
          WebkitAppearance: "none",
          minHeight: 44,
          border: on ? `1.5px solid ${ACC}` : LINE,
          background: on ? `color-mix(in oklch, ${ACC} 12%, var(--surface-2))` : "var(--surface-2)"
        }
      }, React.createElement(GDAv, {
        p: f,
        size: 26,
        plain: true
      }), React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontWeight: on ? 800 : 700,
          fontSize: 12.5,
          color: "var(--ink)"
        }
      }, f.name.split(" ")[0]));
    }))), React.createElement("button", {
      className: "press",
      disabled: !canCreate,
      onClick: () => {
        const gid = D.createGroup(gname, sel);
        closeAdd();
        setTimeout(() => jump(gid), 300);
      },
      style: {
        border: "none",
        borderRadius: 999,
        padding: "12px 20px",
        minHeight: 48,
        cursor: canCreate ? "pointer" : "default",
        WebkitAppearance: "none",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 14.5,
        background: canCreate ? "var(--ink)" : "var(--surface-3)",
        color: canCreate ? "var(--surface)" : "var(--ink-3)",
        transition: "background .15s, color .15s"
      }
    }, canCreate ? "Create \xB7 invites go out now" : sel.length < 2 ? "Pick at least 2 people" : "Name your group")))), document.querySelector(".app")));
  }
  Object.assign(window, {
    GroupDailyBody,
    GDAv,
    GDMark,
    GDHue: ghue,
    GDInit: ginit,
    YouChip,
    OpenSeat,
    SealMark,
    RoundRun,
    RoundKicker,
    WorldCols,
    SealedList,
    AheadBtn,
    OptBtn,
    RoundPrompt: Prompt,
    RoundSmallPrompt: SmallPrompt,
    RoundBand: Band,
    RoundRule: Rule
  });
})();
