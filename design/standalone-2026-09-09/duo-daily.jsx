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
    const cast = q.kind === "cast";
    const mineWord = i => q.options[i];
    const theirWord = i => cast ? q.optionsThem[i] : q.options[i];
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
    const cell = {
      padding: "10px 0",
      fontFamily: "var(--sans)",
      fontSize: 14,
      textWrap: "pretty"
    };
    return React.createElement("div", {
      style: col(10)
    }, React.createElement(window.RoundKicker, {
      r: r,
      world: q.world,
      post: "\xB7 revealed"
    }), React.createElement(window.RoundSmallPrompt, null, q.prompt), cast && rd.theirAns != null && rd.myAns != null && React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 14.5,
        fontWeight: 600,
        lineHeight: 1.4,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "You are ", React.createElement("b", {
      style: {
        color: tint
      }
    }, theirWord(rd.theirAns)), ". ", name, " is ", React.createElement("b", {
      style: {
        color: "var(--ink)"
      }
    }, mineWord(rd.myAns)), "."), q.world ? React.createElement(React.Fragment, null, React.createElement(window.WorldCols, {
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
      style: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) minmax(0, 1fr)",
        columnGap: 12,
        alignItems: "center"
      }
    }, React.createElement("span", null), React.createElement("span", {
      style: {
        ...kick,
        paddingBottom: 6
      }
    }, "said"), React.createElement("span", {
      style: {
        ...kick,
        paddingBottom: 6
      }
    }, "called"), [{
      me: true,
      said: mineWord(rd.myAns),
      guess: rd.myGuess,
      guessWord: theirWord,
      actual: rd.theirAns
    }, {
      me: false,
      said: theirWord(rd.theirAns),
      guess: rd.theirGuess,
      guessWord: mineWord,
      actual: rd.myAns
    }].map((w, i) => React.createElement(React.Fragment, {
      key: i
    }, React.createElement("span", {
      style: {
        gridColumn: "1 / -1",
        borderTop: HAIR
      }
    }), React.createElement("span", {
      style: {
        ...cell,
        display: "flex",
        alignItems: "center"
      }
    }, w.me ? React.createElement(window.YouChip, {
      size: 26
    }) : React.createElement(GDAv, {
      p: p,
      size: 26
    })), React.createElement("span", {
      style: {
        ...cell,
        fontWeight: 700,
        color: "var(--ink)"
      }
    }, w.said), React.createElement("span", {
      style: {
        ...cell,
        fontWeight: 800,
        color: w.guess == null ? "var(--ink-3)" : w.guess === w.actual ? GOOD : MISS
      }
    }, w.guess == null ? "\u2014" : (w.guess === w.actual ? "\u2713 " : "") + w.guessWord(w.guess))))));
  }
  function DuoCard({
    p,
    vh
  }) {
    const D = window.DUELS;
    const pid = p.id;
    const invited = p.state === "invited";
    const v = invited ? null : D.duoView(pid);
    const opts = window.useSheet();
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [aheadOpen, setAheadOpen] = useState(false);
    useEffect(() => {
      if (v && v.ahead === 0) setAheadOpen(false);
    }, [v && v.ahead]);
    const mode = p.mode || "friends";
    const romantic = mode === "romantic";
    const tint = romantic ? ROMANCE : ACC;
    const name = first(p);
    const Prompt = window.RoundPrompt;
    const closeOpts = () => {
      opts.close();
      setTimeout(() => setConfirmEnd(false), 240);
    };
    const head = React.createElement(window.CardHead, {
      mark: React.createElement(GDAv, {
        p: p,
        size: 30
      }),
      name: name,
      note: romantic ? React.createElement("span", {
        "aria-label": "romantic mode",
        style: {
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: ROMANCE,
          flexShrink: 0
        }
      }) : null,
      onMore: invited ? null : opts.show,
      moreLabel: "Options for " + name,
      moreOpen: opts.open
    });
    const optSheet = opts.open && React.createElement(window.RoundSheet, {
      title: name,
      sub: p.rel || "1v1",
      onClose: closeOpts,
      closing: opts.closing,
      gap: 0
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "2px 0 4px"
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
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
      "aria-pressed": mode === k,
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
    }, label)))), React.createElement(window.SheetFoot, {
      link: "End 1v1",
      ask: "End this 1v1? Your history stays on your map.",
      confirm: "End",
      keep: "Keep",
      open: confirmEnd,
      onOpen: () => setConfirmEnd(true),
      onKeep: () => setConfirmEnd(false),
      onConfirm: () => {
        closeOpts();
        setTimeout(() => D.endDuo(pid), 240);
      }
    }));
    if (invited) {
      return React.createElement(window.CardFrame, {
        id: pid
      }, head, React.createElement("div", {
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
    const isCast = rd => rd.q.kind === "cast";
    const guessOpts = rd => isCast(rd) ? rd.q.optionsThem : rd.q.options;
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
      const cast = isCast(rd);
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
      }, cast ? React.createElement(React.Fragment, null, "You said ", name, " is ", React.createElement("b", {
        style: {
          color: "var(--ink)"
        }
      }, rd.q.options[rd.myAns]), ".") : React.createElement(React.Fragment, null, "You said ", React.createElement("b", {
        style: {
          color: "var(--ink)"
        }
      }, rd.q.options[rd.myAns]), ".")), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, React.createElement(GDAv, {
        p: p,
        size: 38
      }), React.createElement(Prompt, null, cast ? React.createElement(React.Fragment, null, "And ", name, " said you are", "\u2026", "?") : React.createElement(React.Fragment, null, "And ", name, " said", "\u2026", "?"))), React.createElement("div", {
        style: col(9)
      }, guessOpts(rd).map((o, i) => React.createElement(window.OptBtn, {
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
      }, "you called ", guessOpts(rd)[rd.myGuess]))), React.createElement("span", {
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
          sub: (rd.q.world ? "World \xB7 " : "") + "you said " + rd.q.options[rd.myAns] + (rd.myGuess != null ? " \xB7 called " + guessOpts(rd)[rd.myGuess] : "")
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
    } else if (v.open != null) body = askBlock(v.open);else body = React.createElement("div", {
      key: "lead",
      style: window.RoundQuiet
    }, "Nothing waiting on you here.");
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
    return React.createElement(window.CardFrame, {
      id: pid,
      tall: v.open != null && !v.ahead,
      vh: vh
    }, head, v.waiting >= 2 && React.createElement(window.RoundBand, {
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
    })), optSheet);
  }
  function NewDuoSheet({
    close
  }) {
    const D = window.DUELS;
    const avail = D.duoAvailable ? D.duoAvailable() : [];
    if (!avail.length) {
      return React.createElement("div", {
        style: {
          textAlign: "center",
          padding: "26px 18px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-2)",
          textWrap: "pretty"
        }
      }, "Everyone in your circle already has a 1v1 with you. Add friends from a person", "\u2019", "s profile to start more.");
    }
    return avail.map(p => React.createElement("button", {
      key: p.id,
      className: "press",
      onClick: () => {
        D.startDuo(p.id);
        close();
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
    }, "Invite")));
  }
  function DuoBody({
    start
  }) {
    const D = window.DUELS;
    const [, bump] = useReducer(x => x + 1, 0);
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => D.subscribe(bump), []);
    const ps = D.partners();
    const forced = start && start !== "seeded" && !dismissed;
    if ((forced || !ps.length) && window.FirstDay) return React.createElement(window.FirstDay, {
      mode: "duo",
      state: forced ? start : "fresh",
      onDone: () => setDismissed(true)
    });
    return React.createElement(window.RoundStack, {
      items: ps,
      isPending: p => p.state !== "invited" && isPending(p),
      acc: ACC,
      rail: {
        mark: p => React.createElement(GDAv, {
          p: p,
          size: 38,
          plain: true
        }),
        label: first,
        state: p => p.state === "invited" ? "invited" : isPending(p) ? "pending" : null,
        addLabel: "Start a new 1v1"
      },
      renderCard: (p, vh) => React.createElement(DuoCard, {
        key: p.id,
        p: p,
        vh: vh
      }),
      sheet: {
        title: "New 1v1",
        sub: "pick a friend",
        Body: NewDuoSheet
      },
      focusKey: "DUO_FOCUS",
      focusEvent: "is:duo-focus"
    });
  }
  Object.assign(window, {
    DuoBody,
    DuoDots,
    DuoDomains
  });
})();
