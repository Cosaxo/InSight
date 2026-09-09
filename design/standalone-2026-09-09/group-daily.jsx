function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function (n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}
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
  const scenInk = scen => `oklch(0.605 0.118 ${scen.hue})`;
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
    size,
    sq,
    title,
    ring
  }) {
    const s = {
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: sq ? Math.round(size * 0.24) : "50%",
      boxSizing: "border-box"
    };
    if (k === 1) s.background = color;else if (k === 0) s.border = `1.5px solid color-mix(in oklch, ${color} 55%, transparent)`;else if (k === "n") s.background = `color-mix(in oklch, ${color} 25%, transparent)`;else if (k === "s") {
      s.background = acc;
      s.boxShadow = `inset 0 0 0 2px var(--surface-a, var(--surface)), inset 0 0 0 3.5px ${acc}`;
    } else if (k === "o") s.border = "1.5px dashed color-mix(in oklch, var(--ink-3) 75%, transparent)";else if (k === "l") s.border = "1.5px dotted var(--ink-3)";
    if (ring) s.boxShadow = (s.boxShadow ? s.boxShadow + ", " : "") + "0 0 0 2px var(--surface-a, var(--surface)), 0 0 0 3.5px var(--ink)";
    return React.createElement("span", {
      title: title || RUN_TITLES[k],
      style: s
    });
  }
  function RoundRun({
    marks,
    color = ACC,
    acc = ACC,
    size = 13,
    label,
    aria,
    score = true,
    onPick,
    picked
  }) {
    const ref = useRef(null);
    const long = marks.length > 14;
    React.useLayoutEffect(() => {
      const el = ref.current;
      if (el) el.scrollLeft = el.scrollWidth;
    }, [marks.length]);
    const ms = marks.map(m => m && typeof m === "object" ? m : {
      k: m
    });
    const scored = ms.filter(m => m.k === 1 || m.k === 0);
    const right = ms.filter(m => m.k === 1).length;
    const pick = e => {
      if (!onPick || !ref.current) return;
      let best = -1,
        bd = Infinity;
      [...ref.current.children].forEach((d, i) => {
        const r = d.getBoundingClientRect();
        const dx = Math.abs(e.clientX - (r.left + r.width / 2));
        if (dx < bd) {
          bd = dx;
          best = i;
        }
      });
      if (best >= 0) onPick(best === picked ? null : best);
    };
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
    }, label), long && score && React.createElement("span", {
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
      onClick: onPick ? pick : undefined,
      style: {
        display: "flex",
        gap: 3,
        alignItems: "center",
        overflowX: long ? "auto" : "visible",
        flex: long ? 1 : "none",
        minWidth: 0,
        padding: onPick ? "6px 0" : 0,
        cursor: onPick ? "pointer" : "default"
      }
    }, ms.map((m, i) => React.createElement(RunDot, {
      key: i,
      k: m.k,
      color: m.color || color,
      acc: acc,
      size: size,
      sq: m.sq,
      title: m.title,
      ring: picked === i
    }))));
  }
  function RoundKicker({
    r,
    world,
    tag,
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
    }, "\xB7 World"), tag && React.createElement("span", {
      style: {
        ...kick,
        color: tag.color || "var(--ink-3)"
      }
    }, "\xB7 ", tag.label), post && React.createElement("span", {
      style: kick
    }, post)), right && React.createElement("span", {
      style: {
        ...kick,
        fontVariantNumeric: "tabular-nums"
      }
    }, right));
  }
  const qTag = q => q.kind === "vote" ? {
    label: q.scen.label,
    color: scenInk(q.scen)
  } : q.kind === "rate" ? {
    label: "Rate the group"
  } : null;
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
    sub,
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
        padding: sub ? "12px 17px" : "15px 17px",
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
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 17,
        color: "var(--ink)"
      }
    }, label), sub && React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 500,
        fontSize: 12.5,
        color: "var(--ink-3)"
      }
    }, sub)));
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
  const poleWord = {
    fontFamily: "var(--sans)",
    fontWeight: 700,
    fontSize: 13.5,
    letterSpacing: "-0.01em",
    color: "var(--ink)",
    textWrap: "balance",
    flex: 1,
    minWidth: 0
  };
  function PoleBallot({
    q,
    onPick,
    tint = ACC
  }) {
    return React.createElement("div", {
      style: col(10)
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 14
      }
    }, React.createElement("span", {
      style: poleWord
    }, q.poles[0]), React.createElement("span", {
      style: {
        ...poleWord,
        textAlign: "right"
      }
    }, q.poles[1])), React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, [0, 1, 2, 3, 4].map(i => {
      const d = Math.abs(i - 2);
      return React.createElement("button", {
        key: i,
        className: "press",
        onClick: () => onPick(i),
        "aria-label": q.options[i],
        style: {
          flex: 1,
          height: 56,
          borderRadius: 16,
          cursor: "pointer",
          WebkitAppearance: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `color-mix(in oklch, ${tint} 7%, var(--surface))`,
          border: `1px solid color-mix(in oklch, ${tint} 30%, var(--rule))`,
          boxShadow: "none"
        }
      }, React.createElement("span", {
        style: {
          width: 10 + d * 5,
          height: 10 + d * 5,
          borderRadius: "50%",
          background: d === 0 ? "transparent" : tint,
          border: d === 0 ? `2px solid ${tint}` : "none",
          boxSizing: "border-box"
        }
      }));
    })));
  }
  function VoteReveal({
    picks
  }) {
    const {
      q,
      rows,
      mine,
      late,
      counts,
      winner,
      second,
      contested,
      people
    } = picks;
    const ink = scenInk(q.scen);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const order = rows.map(r => r.oi).filter(oi => counts[oi] > 0).sort((a, b) => counts[b] - counts[a] || a - b);
    return React.createElement("div", {
      style: col(8)
    }, order.map(oi => {
      const row = rows[oi],
        id = q.targets[oi],
        who = people[oi];
      const crown = id === winner,
        rival = contested && id === second;
      const hi = crown || rival;
      return React.createElement("div", {
        key: oi,
        style: {
          position: "relative",
          overflow: "hidden",
          borderRadius: 14,
          border: hi ? `1.5px solid color-mix(in oklch, ${ink} ${crown ? 60 : 40}%, transparent)` : LINE,
          background: "var(--surface-2)"
        }
      }, React.createElement("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: counts[oi] / total * 100 + "%",
          background: `color-mix(in oklch, ${ink} ${hi ? 14 : 7}%, transparent)`
        }
      }), React.createElement("div", {
        style: {
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px 8px 9px",
          minHeight: 46,
          boxSizing: "border-box"
        }
      }, who && who.me ? React.createElement(YouChip, {
        size: 26
      }) : who ? React.createElement(GDAv, {
        p: who,
        size: 26,
        plain: true
      }) : null, React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          fontFamily: "var(--sans)",
          fontWeight: hi ? 800 : 700,
          fontSize: 13.5,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, row.label), React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontWeight: 800,
          fontSize: 12.5,
          fontVariantNumeric: "tabular-nums",
          color: hi ? ink : "var(--ink-3)"
        }
      }, counts[oi]), React.createElement("span", {
        "aria-label": "voted by",
        style: {
          display: "flex",
          alignItems: "center",
          gap: 3,
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }
      }, row.who.map(p => React.createElement(GDAv, {
        key: p.id,
        p: p,
        size: 22
      })), mine === oi && React.createElement(YouChip, {
        size: 22,
        label: late ? "you \xB7 late" : "you"
      }))));
    }));
  }
  function RateReveal({
    picks
  }) {
    const {
      q,
      rows,
      mine,
      late,
      mean,
      score
    } = picks;
    const stops = [0, 1, 2, 3, 4];
    const lean = score >= 58 ? q.poles[1] : score <= 42 ? q.poles[0] : null;
    return React.createElement("div", {
      style: col(0)
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 14
      }
    }, React.createElement("span", {
      style: {
        ...poleWord,
        color: lean === q.poles[0] ? ACC : "var(--ink-2)",
        fontWeight: lean === q.poles[0] ? 800 : 600
      }
    }, q.poles[0]), React.createElement("span", {
      style: {
        ...poleWord,
        textAlign: "right",
        color: lean === q.poles[1] ? ACC : "var(--ink-2)",
        fontWeight: lean === q.poles[1] ? 800 : 600
      }
    }, q.poles[1])), React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        alignItems: "end",
        marginTop: 10,
        minHeight: 26
      }
    }, stops.map(i => React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "center",
        gap: 3
      }
    }, rows[i].who.map(p => React.createElement(GDAv, {
      key: p.id,
      p: p,
      size: 22
    })), mine === i && React.createElement(YouChip, {
      size: 22,
      label: late ? "you \xB7 late" : "you"
    })))), React.createElement("div", {
      style: {
        position: "relative",
        height: 30
      }
    }, React.createElement("div", {
      style: {
        position: "absolute",
        left: "10%",
        right: "10%",
        top: 14,
        height: 1.5,
        background: "var(--rule)"
      }
    }), stops.map(i => React.createElement("span", {
      key: i,
      style: {
        position: "absolute",
        left: 10 + i * 20 + "%",
        top: 14,
        transform: "translate(-50%, -50%)",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--surface)",
        border: "1.5px solid var(--ink-3)",
        boxSizing: "border-box"
      }
    })), React.createElement("span", {
      title: `the group · ${score}`,
      style: {
        position: "absolute",
        left: 10 + mean * 20 + "%",
        top: 14,
        transform: "translate(-50%, -50%)",
        width: 17,
        height: 17,
        borderRadius: "50%",
        background: ACC,
        border: "2.5px solid var(--surface)",
        boxShadow: `0 0 0 1px ${ACC}`,
        boxSizing: "border-box",
        transition: "left .4s cubic-bezier(0.2,0.8,0.2,1)"
      }
    })));
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
      played,
      absent,
      closed
    } = picks;
    const meIn = mine != null;
    const openSeats = absent + (meIn ? 0 : 1);
    const D = window.DUELS;
    let verdict = null;
    if (q.kind === "vote") {
      const name = id => id === "me" ? "You" : D.first(D.personOf(id));
      const ink = scenInk(q.scen);
      const w = picks.winner,
        s = picks.second;
      verdict = picks.contested && s ? React.createElement("span", null, React.createElement("b", {
        style: {
          color: ink
        }
      }, name(w)), " and ", React.createElement("b", {
        style: {
          color: ink
        }
      }, name(s)), " share ", React.createElement("b", null, q.role.label), " \xB7 contested") : React.createElement("span", null, React.createElement("b", {
        style: {
          color: ink
        }
      }, name(w)), " ", w === "me" ? "are" : "is", " ", React.createElement("b", null, q.role.label));
    } else {
      verdict = React.createElement("span", null, "The group lands on ", React.createElement("b", {
        style: {
          color: ACC
        }
      }, D.stepLabel(q.poles, Math.round(picks.mean))), " ", React.createElement("span", {
        style: {
          color: "var(--ink-3)"
        }
      }, "\xB7 ", picks.score));
    }
    return React.createElement("div", {
      style: col(10)
    }, React.createElement(RoundKicker, {
      r: r,
      tag: qTag(q),
      post: closed && (absent || !meIn) ? "\xB7 closed at the deadline" : "\xB7 revealed"
    }), React.createElement(SmallPrompt, null, q.prompt), q.kind === "rate" ? React.createElement(RateReveal, {
      picks: picks
    }) : React.createElement(VoteReveal, {
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
        fontFamily: "var(--sans)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--ink-2)",
        lineHeight: 1.4,
        textWrap: "pretty"
      }
    }, verdict), late && React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.45,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "Answered after the reveal. It shows, and counts for nothing."));
  }
  const railBtn = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    border: "none",
    background: "none",
    cursor: "pointer",
    padding: "4px 6px",
    WebkitAppearance: "none",
    flexShrink: 0,
    width: 62,
    minHeight: 44
  };
  const railLabel = sel => ({
    fontFamily: "var(--sans)",
    fontSize: 12,
    fontWeight: sel ? 800 : 600,
    color: sel ? "var(--ink)" : "var(--ink-3)",
    whiteSpace: "nowrap",
    maxWidth: 60,
    overflow: "hidden",
    textOverflow: "ellipsis"
  });
  function Rail({
    items,
    cur,
    onPick,
    onAdd,
    addLabel,
    mark,
    label,
    state,
    square,
    acc = ACC
  }) {
    return React.createElement("div", {
      className: "h-scroll",
      style: {
        display: "flex",
        gap: 2,
        overflowX: "auto",
        padding: "3px 6px 2px"
      }
    }, items.map(it => {
      const sel = it.id === cur,
        st = state(it);
      return React.createElement("button", {
        key: it.id,
        onClick: () => onPick(it.id),
        "aria-current": sel ? "true" : undefined,
        "aria-label": label(it) + " \u2014 " + (st === "invited" ? "invited, waiting" : st === "pending" ? "your turn" : "played"),
        style: railBtn
      }, React.createElement("span", {
        style: {
          position: "relative",
          display: "inline-flex",
          borderRadius: square ? 14 : "50%",
          padding: 2,
          boxShadow: sel ? `0 0 0 2px ${acc}` : square ? "none" : st === "pending" ? `0 0 0 1.5px color-mix(in oklch, ${acc} 45%, transparent)` : "0 0 0 1px var(--rule)",
          transition: "box-shadow .18s"
        }
      }, mark(it), st === "invited" ? React.createElement("span", {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          bottom: -3,
          right: -3,
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: "var(--surface-3)",
          color: "var(--ink-2)",
          fontSize: 9,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid var(--surface)"
        }
      }, "\u2026") : st === "pending" ? React.createElement("span", {
        style: {
          position: "absolute",
          top: -1,
          right: -1,
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: acc,
          border: "2px solid var(--surface)"
        }
      }) : null), React.createElement("span", {
        style: railLabel(sel)
      }, label(it)));
    }), onAdd && React.createElement("button", {
      onClick: onAdd,
      "aria-label": addLabel,
      style: railBtn
    }, React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        margin: 2,
        borderRadius: square ? 11 : "50%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1.5px dashed color-mix(in oklch, var(--ink-3) 55%, transparent)",
        color: "var(--ink-2)",
        fontSize: 19,
        fontWeight: 600,
        lineHeight: 1
      }
    }, "+"), React.createElement("span", {
      style: railLabel(false)
    }, "New")));
  }
  function useSheet() {
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const close = () => {
      if (closing) return;
      setClosing(true);
      setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, 230);
    };
    return {
      open,
      closing,
      show: () => setOpen(true),
      close
    };
  }
  function Sheet({
    title,
    sub,
    onClose,
    closing,
    children,
    gap = 8
  }) {
    const host = document.querySelector(".app");
    if (!host) return null;
    return ReactDOM.createPortal(React.createElement("div", {
      className: "wf-scrim" + (closing ? " is-closing" : ""),
      onClick: onClose
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
    }, title), React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: "var(--ink-3)",
        flex: 1,
        minWidth: 0
      }
    }, sub), React.createElement("button", {
      onClick: onClose,
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
        gap
      }
    }, children))), host);
  }
  const dangerBtn = {
    border: "none",
    background: "var(--ochre-ink)",
    color: "#fff",
    fontFamily: "var(--sans)",
    fontWeight: 800,
    fontSize: 12,
    padding: "7px 15px",
    borderRadius: 999,
    cursor: "pointer",
    WebkitAppearance: "none",
    flexShrink: 0
  };
  const ghostBtn = {
    border: LINE,
    background: "var(--surface-2)",
    color: "var(--ink)",
    fontFamily: "var(--sans)",
    fontWeight: 700,
    fontSize: 12,
    padding: "7px 13px",
    borderRadius: 999,
    cursor: "pointer",
    WebkitAppearance: "none",
    flexShrink: 0
  };
  const dangerLink = {
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
  };
  function SheetFoot({
    ask,
    confirm,
    onConfirm,
    keep,
    link,
    open,
    onOpen,
    onKeep
  }) {
    return React.createElement("div", {
      style: {
        borderTop: "0.5px solid var(--rule)",
        marginTop: 8,
        paddingTop: 12,
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, open ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, ask), React.createElement("button", {
      onClick: onConfirm,
      style: dangerBtn
    }, confirm), React.createElement("button", {
      onClick: onKeep,
      style: ghostBtn
    }, keep)) : React.createElement("button", {
      onClick: onOpen,
      style: dangerLink
    }, link));
  }
  function CardFrame({
    id,
    tall,
    vh,
    children
  }) {
    return React.createElement("div", {
      "data-stack-card": id,
      style: {
        minHeight: tall ? Math.min(Math.max((vh || 540) - 190, 250), 380) : 0,
        boxSizing: "border-box",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        borderTop: LINE,
        padding: "20px 1px 26px"
      }
    }, children);
  }
  function CardHead({
    mark,
    name,
    note,
    onMore,
    moreLabel,
    moreOpen
  }) {
    return React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, mark, React.createElement("span", {
      style: {
        fontWeight: 800,
        fontSize: 15,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, name), note, onMore && React.createElement("button", {
      "aria-label": moreLabel,
      "aria-expanded": moreOpen,
      onClick: onMore,
      style: {
        marginLeft: "auto",
        marginRight: -12,
        width: 44,
        height: 44,
        flexShrink: 0,
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
  }
  function RoundStack({
    items,
    isPending,
    acc = ACC,
    rail,
    renderCard,
    sheet,
    focusKey,
    focusEvent
  }) {
    const orderRef = useRef(null);
    if (!orderRef.current) orderRef.current = [...items].sort((a, b) => (isPending(b) ? 1 : 0) - (isPending(a) ? 1 : 0)).map(x => x.id);
    const ordered = orderRef.current.map(id => items.find(x => x.id === id)).filter(Boolean).concat(items.filter(x => !orderRef.current.includes(x.id)));
    const add = useSheet();
    const [cur, setCur] = useState(ordered[0] && ordered[0].id);
    const [vh, setVh] = useState(0);
    const rootRef = useRef(null),
      railRef = useRef(null),
      scRef = useRef(null);
    const railH = () => railRef.current ? railRef.current.offsetHeight : 80;
    const cardTop = id => {
      const sc = scRef.current,
        el = rootRef.current;
      if (!sc || !el) return null;
      const card = el.querySelector("[data-stack-card=\"" + id + "\"]");
      if (!card) return null;
      return Math.max(0, card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH() - 14);
    };
    useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      let sc = el.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      scRef.current = sc;
      if (!sc) return;
      sc.style.scrollSnapType = "y proximity";
      sc.style.scrollPaddingTop = railH() + 14 + "px";
      setVh(sc.clientHeight - railH());
      const onScroll = () => {
        const st = sc.getBoundingClientRect().top + railH();
        let best = null,
          bd = Infinity;
        el.querySelectorAll("[data-stack-card]").forEach(c => {
          const d = Math.abs(c.getBoundingClientRect().top - st - 80);
          if (d < bd) {
            bd = d;
            best = c;
          }
        });
        if (best) setCur(best.getAttribute("data-stack-card"));
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
    const jump = id => {
      const top = cardTop(id);
      if (top != null) scRef.current.scrollTo({
        top,
        behavior: "smooth"
      });
    };
    useEffect(() => {
      if (!focusKey) return;
      const go = () => {
        const f = window[focusKey];
        if (!f) return;
        delete window[focusKey];
        if (!ordered.some(x => x.id === f)) return;
        setCur(f);
        const t0 = Date.now();
        const tick = setInterval(() => {
          const done = () => clearInterval(tick);
          if (Date.now() - t0 > 1400) return done();
          const target = cardTop(f);
          if (target == null) return;
          const sc = scRef.current;
          if (Math.abs(sc.scrollTop - target) > 40) sc.scrollTop = target;else if (Date.now() - t0 > 800) done();
        }, 120);
      };
      go();
      window.addEventListener(focusEvent, go);
      return () => window.removeEventListener(focusEvent, go);
    }, []);
    const nLeft = ordered.filter(isPending).length;
    const SheetBody = sheet && sheet.Body;
    return React.createElement("div", {
      ref: rootRef,
      style: col(10)
    }, React.createElement("div", {
      ref: railRef,
      style: {
        position: "sticky",
        top: 0,
        zIndex: 6,
        margin: "-1px -16px 0",
        padding: "1px 10px 0",
        background: "var(--surface-a, var(--surface))",
        borderBottom: "0.5px solid color-mix(in oklch, var(--rule), transparent 25%)",
        display: "flex",
        alignItems: "center"
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement(Rail, _extends({
      items: ordered,
      cur: cur,
      onPick: jump,
      onAdd: SheetBody ? add.show : null,
      acc: acc
    }, rail))), nLeft > 0 && React.createElement("span", {
      style: {
        flexShrink: 0,
        padding: "0 2px 0 8px",
        fontFamily: "var(--sans)",
        fontSize: 11.5,
        fontWeight: 800,
        color: "var(--ink-3)",
        whiteSpace: "nowrap"
      }
    }, nLeft, " to play")), React.createElement("div", {
      style: col(10)
    }, ordered.map(it => renderCard(it, vh))), add.open && SheetBody && React.createElement(Sheet, {
      title: sheet.title,
      sub: sheet.sub,
      gap: sheet.gap,
      onClose: add.close,
      closing: add.closing
    }, React.createElement(SheetBody, {
      close: add.close,
      jump: jump
    })));
  }
  function GroupCard({
    g,
    vh
  }) {
    const D = window.DUELS;
    const v = D.groupView(g.id);
    const mg = useSheet();
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [aheadOpen, setAheadOpen] = useState(false);
    const [capR, setCapR] = useState(null);
    const [, tick] = useReducer(x => x + 1, 0);
    useEffect(() => {
      const t = setInterval(tick, 30000);
      return () => clearInterval(t);
    }, []);
    useEffect(() => {
      if (v.ahead === 0) setAheadOpen(false);
    }, [v.ahead]);
    const closeMg = () => {
      mg.close();
      setTimeout(() => setConfirmLeave(false), 240);
    };
    const nInvited = g.members.filter(m => m.pending).length;
    const addable = D.members().filter(f => !g.members.some(m => m.id === f.id));
    const left = r => D.fmtLeft(v.deadline(r) - Date.now());
    const head = React.createElement(CardHead, {
      mark: React.createElement(GDMark, {
        g: g,
        size: 30
      }),
      name: g.name,
      note: nInvited > 0 ? React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink-3)",
          flexShrink: 0
        }
      }, nInvited, " invited") : null,
      onMore: mg.show,
      moreLabel: "Manage " + g.name,
      moreOpen: mg.open
    });
    const manageSheet = mg.open && React.createElement(Sheet, {
      title: g.name,
      sub: `${g.members.length + 1} members`,
      onClose: closeMg,
      closing: mg.closing
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
    }, "+ ", f.name.split(" ")[0]))))), React.createElement(SheetFoot, {
      link: "Leave group",
      ask: `Leave ${g.name}?`,
      confirm: "Leave",
      keep: "Stay",
      open: confirmLeave,
      onOpen: () => setConfirmLeave(true),
      onKeep: () => setConfirmLeave(false),
      onConfirm: () => {
        closeMg();
        setTimeout(() => D.leaveGroup(g.id), 240);
      }
    }));
    const askBlock = (r, showPrompt) => {
      const q = v.q(r);
      const closed = v.openClosed && r === v.open;
      return React.createElement("div", {
        style: col(12),
        key: "ask" + r
      }, showPrompt && React.createElement(RoundKicker, {
        r: r,
        tag: qTag(q),
        right: closed ? null : left(r) + " left"
      }), showPrompt && React.createElement(Prompt, null, q.prompt), q.kind === "rate" ? React.createElement(PoleBallot, {
        q: q,
        onPick: i => D.answerGroup(g.id, i, r)
      }) : React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8
        }
      }, q.options.map((o, i) => {
        const id = q.targets[i];
        const mem = id === "me" ? null : g.members.find(p => p.id === id);
        return React.createElement("button", {
          key: id,
          className: "press",
          onClick: () => D.answerGroup(g.id, i, r),
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 56,
            padding: "8px 12px 8px 10px",
            borderRadius: 14,
            border: LINE,
            background: "var(--surface-2)",
            cursor: "pointer",
            textAlign: "left",
            color: "inherit",
            WebkitAppearance: "none"
          }
        }, mem ? React.createElement(GDAv, {
          p: mem,
          size: 34,
          plain: true
        }) : React.createElement(YouChip, {
          size: 34
        }), React.createElement("span", {
          style: {
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--sans)",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }
        }, o));
      })), closed && React.createElement("div", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.45,
          color: "var(--ink-2)",
          textWrap: "pretty"
        }
      }, "Answering now shows as late and counts for nothing."));
    };
    const saidWord = q => q.kind === "vote" ? "you named" : "you said";
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
        tag: qTag(q)
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
      }, saidWord(q)), React.createElement("span", {
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
          sub: (q.kind === "vote" ? q.scen.label : "Rate the group") + " \xB7 " + saidWord(q) + " " + q.options[m.a]
        };
      })
    });
    let body;
    if (v.ahead >= 1 && !aheadOpen) {
      body = React.createElement("div", {
        style: col(14),
        key: "ahead"
      }, v.ahead === 1 ? waitBlock() : sealedBlock(), v.open != null && React.createElement(AheadBtn, {
        r: v.open,
        onClick: () => setAheadOpen(true)
      }));
    } else if (v.open != null) {
      body = askBlock(v.open, !(v.openClosed && v.lastRevealed && v.lastRevealed.r === v.open));
    } else {
      body = React.createElement("div", {
        key: "lead",
        style: quiet
      }, "Nothing waiting on you here.");
    }
    const top = Math.max(v.myTop, v.theirTop, v.open || 0);
    const marks = [];
    for (let r = 1; r <= top; r++) {
      if (r <= v.revealed) {
        const pk = v.picks(r);
        if (pk.q.kind === "rate") marks.push({
          k: pk.late ? "l" : 1,
          sq: true,
          title: "rated the group"
        });else marks.push({
          k: pk.late ? "l" : 1,
          color: scenInk(pk.q.scen),
          title: pk.q.scen.label + " \xB7 " + pk.q.role.label
        });
      } else marks.push(v.mine(r).a != null ? "s" : "o");
    }
    const caption = r => {
      if (r > v.revealed) return `Round ${r} \u00b7 ` + (v.mine(r).a != null ? "sealed, waiting for the reveal" : "open, waiting for you");
      const pk = v.picks(r);
      const who = pk.winner === "me" ? "You are" : D.first(D.personOf(pk.winner)) + " is";
      const what = pk.q.kind === "rate" ? `Rate the group \u00b7 ${D.stepLabel(pk.q.poles, Math.round(pk.mean))} \u00b7 ${pk.score}` : `${pk.q.scen.label} \u00b7 ${who} ${pk.q.role.label}${pk.contested ? " \xB7 contested" : ""}`;
      return `Round ${r} \u00b7 ${what}${pk.late ? " \xB7 you were late" : ""}`;
    };
    return React.createElement(CardFrame, {
      id: g.id,
      tall: v.open != null && !v.ahead,
      vh: vh
    }, head, v.waiting >= 2 && React.createElement(Band, {
      big: `${v.waiting} rounds waiting for you`,
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
      score: false,
      onPick: setCapR,
      picked: capR,
      aria: "The cast so far, one mark per round: a dot in the pack's colour for a vote, a square for a rating. Tap a mark to read it."
    }), capR != null && capR < marks.length && React.createElement("div", {
      className: "fade-in",
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, caption(capR + 1))), manageSheet);
  }
  function NewGroupSheet({
    close,
    jump
  }) {
    const D = window.DUELS;
    const [gname, setGname] = useState("");
    const [sel, setSel] = useState([]);
    const friends = D.members();
    const toggleSel = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.concat(id));
    const canCreate = gname.trim().length > 0 && sel.length >= 2;
    return React.createElement(React.Fragment, null, React.createElement("input", {
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
        close();
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
    }, canCreate ? "Create \xB7 invites go out now" : sel.length < 2 ? "Pick at least 2 people" : "Name your group"));
  }
  function GroupDailyBody({
    start
  }) {
    const D = window.DUELS;
    const [, bump] = useReducer(x => x + 1, 0);
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => D.subscribe(bump), []);
    const gs = D.groups();
    const forced = start && start !== "seeded" && !dismissed;
    if ((forced || !gs.length) && window.FirstDay) return React.createElement(window.FirstDay, {
      mode: "group",
      state: forced ? start : "fresh",
      onDone: () => setDismissed(true)
    });
    return React.createElement(RoundStack, {
      items: gs,
      isPending: g => !g.done,
      acc: ACC,
      rail: {
        square: true,
        mark: g => React.createElement(GDMark, {
          g: g,
          size: 38
        }),
        label: g => g.name,
        state: g => g.done ? null : "pending",
        addLabel: "Create a group"
      },
      renderCard: (g, vh) => React.createElement(GroupCard, {
        key: g.id,
        g: g,
        vh: vh
      }),
      sheet: {
        title: "New group",
        sub: "a role a round, revealed with names",
        gap: 13,
        Body: NewGroupSheet
      },
      focusKey: "GROUP_FOCUS",
      focusEvent: "is:group-focus"
    });
  }
  Object.assign(window, {
    GroupDailyBody,
    GDAv,
    GDMark,
    GDHue: ghue,
    GDInit: ginit,
    GDScenInk: scenInk,
    YouChip,
    OpenSeat,
    SealMark,
    RoundRun,
    RoundKicker,
    WorldCols,
    SealedList,
    AheadBtn,
    OptBtn,
    PoleBallot,
    RoundPrompt: Prompt,
    RoundSmallPrompt: SmallPrompt,
    RoundBand: Band,
    RoundRule: Rule,
    RoundQuiet: quiet,
    RoundStack,
    CardFrame,
    CardHead,
    RoundSheet: Sheet,
    SheetFoot,
    useSheet
  });
})();
