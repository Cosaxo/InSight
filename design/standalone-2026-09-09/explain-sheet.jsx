(function () {
  const {
    useState
  } = React;
  const EX = {
    duo: {
      about: "What you are to them: which of four things they say is true of you, as a share of the rounds that ask.",
      dims: {
        trust: "How often they say you are the one they tell first.",
        spark: "How often they say you are the one who gets them out the door.",
        judgement: "How often they say you are the one they ask what to do.",
        constancy: "How often they say you are the one who is just always there."
      }
    },
    group: {
      about: "Your seat in the room: every vote you received, by the part it was cast in.",
      dims: {
        engine: "The share of your votes in the roles that get things going.",
        hands: "The share in the roles that get it done.",
        heart: "The share in the roles that hold the room together.",
        wild: "The share in the roles the story happens to."
      }
    },
    big5: {
      about: "Five broad traits psychologists use to describe personality. Everyone sits somewhere on each one \u2014 neither end is better.",
      dims: {
        O: "Appetite for new ideas, art and change.",
        C: "Planning, order, and finishing what you start.",
        E: "Whether people or quiet gives you energy.",
        A: "How much you accommodate and trust others.",
        N: "How hard stress and setbacks land."
      }
    },
    political: {
      about: "Six separate axes instead of one left\u2013right line, each scored on its own \u2014 so you can sit left on one and right on another.",
      dims: {
        econ: "Who should steer the economy: the state or the market.",
        auth: "How far the state may limit personal freedom.",
        foreign: "How open your country should be to the world.",
        env: "What you would trade for climate action.",
        tech: "Push new technology forward, or slow it down.",
        estab: "Trust in established institutions versus outsiders."
      }
    },
    values: {
      about: "Six tensions in what makes a life good. Both ends are defensible \u2014 the reading is where you sit between them.",
      dims: {
        future: "Whether life is getting better or worse.",
        circle: "Whether duty stops at your people or reaches strangers.",
        hedonism: "Enjoyment weighed against obligation.",
        meaning: "Whether hardship adds meaning or only hurts.",
        moral: "Whether right and wrong are fixed or made by us.",
        beauty: "How much beauty counts beside use and truth."
      }
    },
    attachment: {
      about: "What kind of friend you are \u2014 not how good at it, but how you show up.",
      dims: {
        warm: "How openly you show that you care.",
        loyal: "Many light friendships, or few deep ones.",
        open: "How much of yourself you let people see.",
        play: "How much you keep things light.",
        easy: "How easily things get under your skin."
      }
    },
    cognitive: {
      about: "How you get to an answer. Most people run two of these together.",
      dims: {
        analyst: "Breaks a problem into parts.",
        systems: "Looks first at how the parts connect.",
        empath: "Reads people, mood and motive.",
        maker: "Learns by building the thing."
      }
    },
    moral: {
      about: "Six moral instincts that sit under political and social opinions. Most people run several at once \u2014 the mix is the reading.",
      dims: {
        care: "Aversion to anyone being hurt.",
        fair: "Proportion \u2014 you get out what you put in.",
        liberty: "Resistance to being told what to do.",
        loyal: "Standing by your own group.",
        authority: "Respect for rank and tradition.",
        sanctity: "Things that feel degrading even when nobody is harmed."
      }
    },
    risk: {
      about: "Willingness to take a risk, split by area of life \u2014 because nobody is brave everywhere.",
      dims: {
        financial: "Money you could lose.",
        health: "Your body, and the check-ups you skip.",
        social: "Saying the unpopular thing out loud.",
        recreational: "Speed, height, physical thrill.",
        ethical: "Bending a rule for a better outcome."
      }
    },
    trust: {
      about: "What you assume the world is like before you have checked.",
      dims: {
        trust: "Whether strangers are safe by default.",
        zerosum: "Whether one side gains only if another loses.",
        justworld: "Whether outcomes are earned, or mostly luck."
      }
    },
    time: {
      about: "How much a reward far in the future is worth to you today.",
      dims: {
        horizon: "How far ahead you plan.",
        patience: "How well you sit with waiting."
      }
    },
    taste: {
      about: "What you reach for in film, music and food \u2014 the shape of your taste, not its quality.",
      dims: {
        novelty: "The unknown thing, or the one you love.",
        complexity: "Clean and direct, or dense and layered.",
        sincerity: "Earnest, or ironic.",
        scene: "Mainstream, or off the beaten track."
      }
    },
    conflict: {
      about: "What you do when a room gets tense.",
      dims: {
        assert: "Push your position, or keep the peace.",
        engage: "Say it now, or step away."
      }
    },
    humor: {
      about: "Who your jokes are for.",
      dims: {
        affiliative: "Jokes that pull a room together.",
        selfenh: "Finding it funny when things go wrong.",
        aggressive: "Jokes with a target.",
        selfdef: "Jokes at your own expense."
      }
    },
    thinking: {
      about: "How you reach a decision, and how tightly you hold it.",
      dims: {
        mode: "Gut feel, or working it out.",
        update: "How readily you change your mind."
      }
    },
    culture: {
      about: "How much the group shapes you, and how tight its rules feel.",
      dims: {
        self: "Choices as yours, or your circle\u2019s.",
        norms: "Whether breaking a social rule should cost you."
      }
    }
  };
  const exSans = "var(--sans)";
  const exGlyph = {
    you: c => React.createElement("span", {
      style: {
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: c,
        border: "2px solid var(--surface-2)",
        boxShadow: "0 0 0 0.5px var(--rule)",
        flexShrink: 0
      }
    }),
    most: () => React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "var(--surface-2)",
        border: "1.4px solid var(--ink-3)",
        flexShrink: 0
      }
    }),
    tick: () => React.createElement("span", {
      style: {
        width: 2,
        height: 13,
        borderRadius: 2,
        background: "color-mix(in oklch, var(--ink-3) 70%, transparent)",
        flexShrink: 0
      }
    }),
    bar: c => React.createElement("span", {
      style: {
        width: 20,
        height: 8,
        borderRadius: 99,
        background: c,
        flexShrink: 0
      }
    }),
    pale: c => React.createElement("span", {
      style: {
        width: 20,
        height: 8,
        borderRadius: 99,
        background: `oklch(from ${c} 0.86 0.05 h)`,
        flexShrink: 0
      }
    }),
    petal: c => React.createElement("span", {
      style: {
        width: 16,
        height: 10,
        borderRadius: "2px 8px 8px 2px",
        background: c,
        flexShrink: 0
      }
    })
  };
  function ExplainBtn({
    onClick,
    label
  }) {
    return React.createElement("button", {
      className: "press tap44",
      onClick: e => {
        e.stopPropagation();
        onClick(e);
      },
      "aria-label": label || "What this measures",
      style: {
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: "50%",
        padding: 0,
        cursor: "pointer",
        WebkitAppearance: "none",
        border: "0.5px solid color-mix(in oklch, var(--ink) 24%, var(--rule))",
        background: "transparent",
        color: "var(--ink-2)",
        fontFamily: exSans,
        fontSize: 11.5,
        fontWeight: 800,
        lineHeight: 1
      }
    }, "i");
  }
  function ExplainSheet({
    title,
    kicker,
    keyRows,
    dims,
    dimKey,
    onClose
  }) {
    const [closing, setClosing] = useState(false);
    const close = () => {
      if (closing) return;
      setClosing(true);
      setTimeout(onClose, 240);
    };
    const ex = EX[dimKey] || EX[String(dimKey || "").split(":")[0]] || {
      about: "",
      dims: {}
    };
    return React.createElement("div", {
      className: "wf-scrim" + (closing ? " is-closing" : ""),
      onClick: close
    }, React.createElement("div", {
      className: "wf-sheet",
      onClick: e => e.stopPropagation(),
      style: {
        maxHeight: "78%"
      }
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
        fontFamily: exSans,
        fontWeight: 800,
        fontSize: 15
      }
    }, title), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontFamily: exSans,
        fontWeight: 600,
        fontSize: 12,
        color: "var(--ink-3)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, kicker), React.createElement("button", {
      onClick: close,
      "aria-label": "Close",
      style: {
        border: "none",
        background: "var(--surface-2)",
        width: 26,
        height: 26,
        borderRadius: "50%",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--ink-2)",
        flexShrink: 0
      }
    }, "\u2715")), React.createElement("div", {
      className: "wf-sheet-body"
    }, ex.about && React.createElement("p", {
      style: {
        margin: "2px 0 0",
        fontFamily: exSans,
        fontSize: 15,
        fontWeight: 500,
        lineHeight: 1.55,
        color: "var(--ink)",
        textWrap: "pretty"
      }
    }, ex.about), keyRows && keyRows.length > 0 && React.createElement("div", {
      style: {
        marginTop: 16,
        paddingTop: 14,
        borderTop: "0.5px solid var(--rule)",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, React.createElement("span", {
      style: {
        fontFamily: exSans,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "var(--ink-3)"
      }
    }, "How to read it"), keyRows.map(([g, text], i) => React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement("span", {
      style: {
        width: 22,
        display: "flex",
        justifyContent: "center",
        flexShrink: 0
      }
    }, g), React.createElement("span", {
      style: {
        fontFamily: exSans,
        fontSize: 13.5,
        fontWeight: 550,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, text)))), dims && dims.length > 0 && React.createElement("div", {
      style: {
        marginTop: 18,
        paddingTop: 14,
        borderTop: "0.5px solid var(--rule)",
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, React.createElement("span", {
      style: {
        fontFamily: exSans,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "var(--ink-3)"
      }
    }, "What each one means"), dims.map(d => React.createElement("div", {
      key: d.id
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        fontFamily: exSans,
        fontSize: 14.5,
        fontWeight: 800,
        letterSpacing: "-0.012em"
      }
    }, d.label), d.poles && React.createElement("span", {
      style: {
        fontFamily: exSans,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, d.poles[0], " \u2192 ", d.poles[1])), ex.dims[d.id] && React.createElement("div", {
      style: {
        marginTop: 2,
        fontFamily: exSans,
        fontSize: 13.5,
        fontWeight: 500,
        lineHeight: 1.45,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, ex.dims[d.id]), d.note && React.createElement("div", {
      style: {
        marginTop: 3,
        fontFamily: exSans,
        fontSize: 12,
        fontWeight: 700,
        color: "var(--ink-3)"
      }
    }, "yours: ", d.note)))))));
  }
  Object.assign(window, {
    ExplainBtn,
    ExplainSheet,
    EX_GLYPH: exGlyph
  });
})();
