(function () {
  const {
    useState,
    useEffect,
    useRef,
    useReducer
  } = React;
  const LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";
  const HAIR = "0.5px solid color-mix(in oklch, var(--rule), transparent 30%)";
  const ACC = "var(--c-people)";
  const ROMANCE = "oklch(0.55 0.13 12)";
  const GOOD = "var(--c-likeness)";
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
  const first = p => p.name.split(" ")[0];
  const isPending = p => p.state === "turn" || p.state === "start";
  function DuoDots({
    days,
    color,
    size = 8
  }) {
    return React.createElement("span", {
      style: {
        display: "flex",
        gap: size * 0.2,
        alignItems: "center"
      }
    }, days.map((ok, i) => React.createElement("span", {
      key: i,
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        boxSizing: "border-box",
        background: ok ? color || GOOD : "transparent",
        border: ok ? "none" : `1.5px solid color-mix(in oklch, ${color || GOOD} 55%, transparent)`
      }
    })));
  }
  function DuoDomains({
    rows,
    themColor,
    themName
  }) {
    const RR = window.ReadRun || DuoDots;
    const clust = a => a.length <= (window.RUN_DOTS || 14) ? a.slice().sort((x, y) => (y ? 1 : 0) - (x ? 1 : 0)) : a;
    return React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 13
      }
    }, rows.map(r => React.createElement("div", {
      key: r.id,
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 11
      }
    }, React.createElement("span", {
      style: {
        width: 88,
        flexShrink: 0,
        paddingTop: 1,
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 800,
        color: "var(--ink)",
        lineHeight: 1.25
      }
    }, r.label), React.createElement("span", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 5,
        paddingTop: 2
      }
    }, React.createElement(RR, {
      days: clust(r.read),
      size: 11
    }), React.createElement(RR, {
      days: clust(r.by),
      color: themColor,
      size: 11
    })))), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--ink-2)"
      }
    }, [["you read them", GOOD], [themName + " reads you", themColor]].map(([t, c]) => React.createElement("span", {
      key: t,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: c
      }
    }), t))));
  }
  function DuoRail({
    ps,
    cur,
    onPick,
    onAdd
  }) {
    return React.createElement("div", {
      className: "h-scroll",
      style: {
        display: "flex",
        gap: 2,
        overflowX: "auto",
        padding: "3px 6px 2px"
      }
    }, ps.map(p => {
      const invited = p.state === "invited";
      const pending = !invited && isPending(p);
      const sel = p.id === cur;
      return React.createElement("button", {
        key: p.id,
        onClick: () => onPick(p.id),
        "aria-current": sel ? "true" : undefined,
        "aria-label": first(p) + " \u2014 " + (invited ? "invited, waiting" : pending ? "your turn" : "waiting on " + first(p)),
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: "4px 7px",
          WebkitAppearance: "none",
          flexShrink: 0,
          minHeight: 44
        }
      }, React.createElement("span", {
        style: {
          position: "relative",
          display: "inline-flex",
          borderRadius: "50%",
          padding: 2,
          boxShadow: sel ? `0 0 0 2px ${ACC}` : pending ? `0 0 0 1.5px color-mix(in oklch, ${ACC} 45%, transparent)` : "0 0 0 1px var(--rule)",
          transition: "box-shadow .18s"
        }
      }, React.createElement(GDAv, {
        p: p,
        size: 38,
        plain: true
      }), invited ? React.createElement("span", {
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
        },
        "aria-hidden": "true"
      }, "\u2026") : pending ? React.createElement("span", {
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
      }) : null), React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 12,
          fontWeight: sel ? 800 : 600,
          color: sel ? "var(--ink)" : "var(--ink-3)"
        }
      }, first(p)));
    }), onAdd && React.createElement("button", {
      onClick: onAdd,
      "aria-label": "Start a new 1v1",
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "4px 7px",
        WebkitAppearance: "none",
        flexShrink: 0,
        minHeight: 44
      }
    }, React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        margin: 2,
        borderRadius: "50%",
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
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, "New")));
  }
  function DuoRevealBlock({
    rd,
    p,
    tint
  }) {
    const {
      q,
      r
    } = rd;
    const name = first(p);
    const call = (guess, actual, who) => guess == null ? null : guess === actual ? React.createElement("span", {
      style: {
        fontWeight: 800,
        color: GOOD
      }
    }, "\u2713", " ", who, " called it") : React.createElement("span", {
      style: {
        fontWeight: 800,
        color: MISS
      }
    }, who, " guessed ", q.options[guess]);
    return React.createElement("div", {
      style: col(10)
    }, React.createElement(window.RoundKicker, {
      r: r,
      world: q.world,
      post: "\xB7 revealed"
    }), React.createElement(window.RoundSmallPrompt, null, q.prompt), q.world ? React.createElement(React.Fragment, null, React.createElement(window.WorldCols, {
      q: q,
      them: name,
      themW: Math.max(44, Math.min(90, name.length * 9 + 8)),
      rows: q.options.map((label, i) => ({
        label,
        me: rd.myAns === i,
        who: rd.theirAns === i ? [p] : []
      }))
    }), React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "4px 12px",
        alignItems: "baseline",
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, rd.noGuess ? React.createElement("span", null, name, " answered this in the World feed, so there was no guess.") : React.createElement(React.Fragment, null, call(rd.myGuess, rd.theirAns, "you"), call(rd.theirGuess, rd.myAns, name)))) : React.createElement("div", {
      style: col(0)
    }, React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "72px 1fr 1fr",
        gap: 10,
        paddingBottom: 6
      }
    }, React.createElement("span", null), React.createElement("span", {
      style: kick
    }, "said"), React.createElement("span", {
      style: kick
    }, "called")), [{
      me: true,
      said: rd.myAns,
      guess: rd.myGuess,
      actual: rd.theirAns
    }, {
      me: false,
      said: rd.theirAns,
      guess: rd.theirGuess,
      actual: rd.myAns
    }].map((w, i) => React.createElement("div", {
      key: i,
      style: {
        display: "grid",
        gridTemplateColumns: "72px 1fr 1fr",
        gap: 10,
        alignItems: "center",
        padding: "10px 0",
        borderTop: HAIR
      }
    }, React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0
      }
    }, w.me ? React.createElement(window.YouChip, null) : React.createElement(React.Fragment, null, React.createElement(GDAv, {
      p: p,
      size: 26
    }), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 13,
        color: "var(--ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, name))), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 14,
        color: "var(--ink)",
        textWrap: "pretty"
      }
    }, q.options[w.said]), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 14,
        color: w.guess === w.actual ? GOOD : MISS,
        textWrap: "pretty"
      }
    }, w.guess == null ? "\u2014" : (w.guess === w.actual ? "\u2713 " : "") + q.options[w.guess])))));
  }
  function DuoCard({
    p,
    vh
  }) {
    const D = window.DUELS;
    const pid = p.id;
    const invited = p.state === "invited";
    const v = invited ? null : D.duoView(pid);
    const [menu, setMenu] = useState(false);
    const [aheadOpen, setAheadOpen] = useState(false);
    useEffect(() => {
      if (v && v.ahead === 0) setAheadOpen(false);
    }, [v && v.ahead]);
    const mode = p.mode || "friends";
    const romantic = mode === "romantic";
    const tint = romantic ? ROMANCE : ACC;
    const name = first(p);
    const Prompt = window.RoundPrompt;
    const header = React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9
      }
    }, React.createElement(GDAv, {
      p: p,
      size: 30
    }), React.createElement("span", {
      style: {
        fontWeight: 800,
        fontSize: 14.5
      }
    }, name), romantic && React.createElement("span", {
      "aria-label": "romantic mode",
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: ROMANCE,
        flexShrink: 0
      }
    }), !invited && React.createElement("button", {
      "aria-label": "Options for " + name,
      "aria-expanded": menu,
      onClick: () => setMenu(m => !m),
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
    const menuRow = menu && !invited && React.createElement("div", {
      style: {
        ...col(9),
        border: LINE,
        borderRadius: 13,
        background: "var(--surface)",
        padding: "10px 12px"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-2)"
      }
    }, "Question set"), React.createElement("span", {
      style: {
        display: "flex",
        gap: 4,
        flexShrink: 0,
        background: "var(--surface-2)",
        borderRadius: 999,
        padding: 2
      }
    }, [["friends", "Friends"], ["romantic", "Romantic"]].map(([k, label]) => React.createElement("button", {
      key: k,
      onClick: () => D.setDuoMode(pid, k),
      style: {
        border: "none",
        borderRadius: 999,
        padding: "5px 12px",
        minHeight: 32,
        cursor: "pointer",
        WebkitAppearance: "none",
        fontFamily: "var(--sans)",
        fontWeight: mode === k ? 800 : 600,
        fontSize: 12,
        background: mode === k ? k === "romantic" ? ROMANCE : "var(--ink)" : "transparent",
        color: mode === k ? "var(--surface)" : "var(--ink-3)"
      }
    }, label)))), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderTop: HAIR,
        paddingTop: 9
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "End this 1v1? Your history stays on your map."), React.createElement("button", {
      onClick: () => D.endDuo(pid),
      style: {
        flexShrink: 0,
        border: "none",
        background: "var(--ochre-ink)",
        color: "#fff",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 12,
        padding: "6px 13px",
        borderRadius: 999,
        cursor: "pointer",
        WebkitAppearance: "none"
      }
    }, "End"), React.createElement("button", {
      onClick: () => setMenu(false),
      style: {
        flexShrink: 0,
        border: LINE,
        background: "var(--surface-2)",
        color: "var(--ink)",
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: 999,
        cursor: "pointer",
        WebkitAppearance: "none"
      }
    }, "Keep")));
    if (invited) {
      return React.createElement("div", {
        "data-duo-card": pid,
        style: {
          boxSizing: "border-box",
          scrollSnapAlign: "start",
          scrollSnapStop: "always",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          borderTop: LINE,
          padding: "20px 1px 26px"
        }
      }, header, React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 13
        }
      }, React.createElement(GDAv, {
        p: p,
        size: 52
      }), React.createElement("div", {
        style: {
          fontFamily: "var(--sans)",
          fontWeight: 800,
          fontSize: 21,
          letterSpacing: -0.4
        }
      }, "Waiting for ", name), React.createElement("div", {
        style: {
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink-2)",
          maxWidth: 250,
          textWrap: "pretty"
        }
      }, "Invite sent \u2014 your first round opens when they accept."), React.createElement("button", {
        className: "press",
        onClick: () => D.cancelDuo(pid),
        style: {
          border: LINE,
          background: "var(--surface)",
          color: "var(--ink-2)",
          fontFamily: "var(--sans)",
          fontWeight: 700,
          fontSize: 12.5,
          padding: "8px 18px",
          minHeight: 44,
          borderRadius: 999,
          cursor: "pointer",
          WebkitAppearance: "none"
        }
      }, "Cancel invite")));
    }
    const askBlock = r => {
      const rd = v.round(r);
      return React.createElement("div", {
        style: col(12),
        key: "ask" + r
      }, React.createElement(window.RoundKicker, {
        r: r,
        world: rd.q.world
      }), React.createElement(Prompt, null, rd.q.prompt), React.createElement("div", {
        style: col(9)
      }, rd.q.options.map((o, i) => React.createElement(window.OptBtn, {
        key: o,
        label: o,
        tint: tint,
        onClick: () => D.answerDuo(pid, {
          a: i
        }, r)
      }))), rd.noGuess && React.createElement("div", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.45,
          color: "var(--ink-2)",
          textWrap: "pretty"
        }
      }, name, " already answered this in the World feed, so there is no guess this round."));
    };
    const guessBlock = r => {
      const rd = v.round(r);
      return React.createElement("div", {
        style: {
          ...col(12),
          animation: "popIn .3s cubic-bezier(0.2,0.8,0.2,1)"
        },
        key: "guess" + r
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
      }, rd.q.options[rd.myAns]), "."), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, React.createElement(GDAv, {
        p: p,
        size: 38
      }), React.createElement(Prompt, null, "And ", name, " picked", "\u2026", "?")), React.createElement("div", {
        style: col(9)
      }, rd.q.options.map((o, i) => React.createElement(window.OptBtn, {
        key: o,
        label: o,
        tint: tint,
        onClick: () => D.answerDuo(pid, {
          g: i
        }, r)
      }))));
    };
    const waitBlock = () => {
      const r = v.revealed + 1;
      const rd = v.round(r);
      return React.createElement("div", {
        style: {
          ...col(12),
          animation: "popIn .35s cubic-bezier(0.2,0.8,0.2,1)"
        },
        key: "wait"
      }, React.createElement(window.RoundKicker, {
        r: r,
        world: rd.q.world
      }), React.createElement(Prompt, {
        size: 24
      }, rd.q.prompt), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 0 0"
        }
      }, React.createElement(window.YouChip, null), React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 500,
          color: "var(--ink-3)"
        }
      }, "said"), React.createElement("span", {
        style: {
          fontWeight: 800,
          fontSize: 17,
          letterSpacing: -0.2,
          color: "var(--ink)"
        }
      }, rd.q.options[rd.myAns])), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderTop: HAIR,
          paddingTop: 12
        }
      }, React.createElement(GDAv, {
        p: p,
        size: 26
      }), React.createElement("div", {
        style: {
          ...col(2),
          minWidth: 0,
          flex: 1
        }
      }, React.createElement("span", {
        style: {
          fontWeight: 700,
          fontSize: 13.5,
          color: "var(--ink-2)"
        }
      }, name, "\u2019", "s answer", rd.noGuess ? "" : React.createElement(React.Fragment, null, " ", "\xB7", " ", React.createElement("span", {
        style: {
          color: "var(--ink)",
          fontWeight: 800
        }
      }, "you called ", rd.q.options[rd.myGuess]))), React.createElement("span", {
        style: {
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink-3)"
        }
      }, "waiting on ", name)), React.createElement("span", {
        "aria-hidden": "true",
        style: {
          display: "flex",
          gap: 3,
          alignItems: "center",
          flexShrink: 0
        }
      }, [22, 13, 18].map((w, i) => React.createElement("span", {
        key: i,
        style: {
          width: w,
          height: 11,
          borderRadius: 2,
          background: "color-mix(in oklch, var(--ink) 17%, transparent)"
        }
      })))));
    };
    const sealedBlock = () => React.createElement(window.SealedList, {
      key: "sealed",
      acc: tint,
      title: `${WORDS[v.ahead] || v.ahead} rounds waiting on ${name}`,
      line: `Each reveals as ${name} plays.`,
      items: v.sealed.map(r => {
        const rd = v.round(r);
        return {
          n: r,
          prompt: rd.q.prompt,
          sub: (rd.q.world ? "World \xB7 " : "") + "you: " + rd.q.options[rd.myAns] + (rd.myGuess != null ? " \xB7 called " + rd.q.options[rd.myGuess] : "")
        };
      })
    });
    let body;
    const openRd = v.open != null ? v.round(v.open) : null;
    if (openRd && openRd.myAns != null && !openRd.mineIn) body = guessBlock(v.open);else if (v.ahead >= 1 && !aheadOpen) {
      body = React.createElement("div", {
        style: col(14),
        key: "ahead"
      }, v.ahead === 1 ? waitBlock() : sealedBlock(), v.open != null && React.createElement(window.AheadBtn, {
        r: v.open,
        onClick: () => setAheadOpen(true)
      }));
    } else if (v.open != null) body = askBlock(v.open);else body = null;
    const top = Math.max(v.myTop, v.theirTop, v.open || 0);
    const mine = [],
      theirs = [];
    for (let r = 1; r <= top; r++) {
      if (r <= v.revealed) {
        const rd = v.round(r);
        mine.push(rd.noGuess ? "n" : rd.readRight ? 1 : 0);
        theirs.push(rd.byRight ? 1 : 0);
      } else {
        const k = v.round(r).mineIn ? "s" : "o";
        mine.push(k);
        theirs.push(k);
      }
    }
    return React.createElement("div", {
      "data-duo-card": pid,
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
    }, header, menuRow, v.waiting >= 2 && React.createElement(window.RoundBand, {
      acc: tint,
      big: `${v.waiting} rounds waiting for you`,
      sub: "each reveals as you answer"
    }), v.lastRevealed && React.createElement(DuoRevealBlock, {
      rd: v.lastRevealed,
      p: p,
      tint: tint
    }), v.lastRevealed && body && React.createElement(window.RoundRule, null), body, mine.length > 0 && React.createElement("div", {
      style: {
        ...col(8),
        borderTop: HAIR,
        paddingTop: 13
      }
    }, React.createElement(window.RoundRun, {
      marks: mine,
      color: GOOD,
      acc: tint,
      label: "you",
      aria: "How well you read " + name + ", one mark per round"
    }), React.createElement(window.RoundRun, {
      marks: theirs,
      color: tint,
      acc: tint,
      label: name,
      aria: "How well " + name + " reads you, one mark per round"
    })));
  }
  function DuoBody({
    start
  }) {
    const D = window.DUELS;
    const [, bump] = useReducer(x => x + 1, 0);
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => D.subscribe(bump), []);
    const ps = D.partners();
    const orderRef = useRef(null);
    if (!orderRef.current) orderRef.current = [...ps].sort((a, b) => (isPending(b) ? 1 : 0) - (isPending(a) ? 1 : 0)).map(x => x.id);
    const ordered = orderRef.current.map(id => ps.find(x => x.id === id)).filter(Boolean).concat(ps.filter(x => !orderRef.current.includes(x.id)));
    const [addOpen, setAddOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const closeAdd = () => {
      if (closing) return;
      setClosing(true);
      setTimeout(() => {
        setAddOpen(false);
        setClosing(false);
      }, 230);
    };
    const avail = D.duoAvailable ? D.duoAvailable() : [];
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
        el.querySelectorAll("[data-duo-card]").forEach(c => {
          const d = Math.abs(c.getBoundingClientRect().top - st - 80);
          if (d < bd) {
            bd = d;
            best = c;
          }
        });
        if (best) setCur(best.getAttribute("data-duo-card"));
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
    const jump = pid => {
      const sc = scRef.current,
        el = rootRef.current;
      if (!sc || !el) return;
      const card = el.querySelector("[data-duo-card=\"" + pid + "\"]");
      if (!card) return;
      const railH = railRef.current ? railRef.current.offsetHeight : 80;
      sc.scrollTo({
        top: card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14,
        behavior: "smooth"
      });
    };
    const nLeft = ordered.filter(isPending).length;
    useEffect(() => {
      const go = () => {
        const f = window.DUO_FOCUS;
        if (!f) return;
        delete window.DUO_FOCUS;
        if (!ordered.some(x => x.id === f)) return;
        setCur(f);
        const t0 = Date.now();
        const tick = setInterval(() => {
          const sc = scRef.current,
            el = rootRef.current;
          const done = () => clearInterval(tick);
          if (Date.now() - t0 > 1400) return done();
          if (!sc || !el) return;
          const card = el.querySelector("[data-duo-card=\"" + f + "\"]");
          if (!card) return;
          const railH = railRef.current ? railRef.current.offsetHeight : 80;
          const target = Math.max(0, card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14);
          if (Math.abs(sc.scrollTop - target) > 40) sc.scrollTop = target;else if (Date.now() - t0 > 800) done();
        }, 120);
      };
      go();
      window.addEventListener("is:duo-focus", go);
      return () => window.removeEventListener("is:duo-focus", go);
    }, []);
    const forced = start && start !== "seeded" && !dismissed;
    if ((forced || !ordered.length) && window.FirstDay) {
      return React.createElement("div", {
        ref: rootRef
      }, React.createElement(window.FirstDay, {
        mode: "duo",
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
    }, React.createElement(DuoRail, {
      ps: ordered,
      cur: cur,
      onPick: jump,
      onAdd: () => setAddOpen(true)
    })), React.createElement("div", {
      style: col(10)
    }, ordered.map(p => React.createElement(DuoCard, {
      key: p.id,
      p: p,
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
    }, "New 1v1"), React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: "var(--ink-3)",
        flex: 1
      }
    }, "pick a friend"), React.createElement("button", {
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
        gap: 8
      }
    }, avail.length ? avail.map(p => React.createElement("button", {
      key: p.id,
      className: "press",
      onClick: () => {
        D.startDuo(p.id);
        closeAdd();
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        border: LINE,
        borderRadius: 14,
        background: "var(--surface-2)",
        padding: "11px 13px",
        cursor: "pointer",
        textAlign: "left",
        WebkitAppearance: "none"
      }
    }, React.createElement(GDAv, {
      p: p,
      size: 34,
      plain: true
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
        fontSize: 14.5,
        color: "var(--ink)"
      }
    }, p.name), React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, p.rel)), React.createElement("span", {
      style: {
        flexShrink: 0,
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 12,
        color: "var(--surface)",
        background: "var(--ink)",
        padding: "6px 14px",
        borderRadius: 999
      }
    }, "Invite"))) : React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "26px 18px",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "Everyone in your circle already has a 1v1 with you. Add friends from a person", "\u2019", "s profile to start more.")))), document.querySelector(".app")));
  }
  Object.assign(window, {
    DuoBody,
    DuoDots,
    DuoDomains
  });
})();