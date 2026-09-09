(function () {
  const {
    useState,
    useEffect,
    useReducer
  } = React;
  const LINE = "0.5px solid var(--rule)";
  function gmGroupHue(g) {
    let sx = 0,
      sy = 0;
    g.members.forEach(p => {
      sx += Math.cos(p.hue * Math.PI / 180);
      sy += Math.sin(p.hue * Math.PI / 180);
    });
    return Math.round((Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360);
  }
  const gmAccent = g => window.WPAL.ink(`oklch(0.52 0.14 ${gmGroupHue(g)})`);
  function GMIdentity({
    g,
    pct
  }) {
    const [v, setV] = useState(0);
    useEffect(() => {
      setV(0);
      const t = setTimeout(() => setV(pct), 80);
      return () => clearTimeout(t);
    }, [pct, g.id]);
    const S = 64,
      R = 28.5,
      C = 2 * Math.PI * R;
    return React.createElement("span", {
      style: {
        position: "relative",
        width: S,
        height: S,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, React.createElement("svg", {
      width: S,
      height: S,
      viewBox: `0 0 ${S} ${S}`,
      style: {
        position: "absolute",
        inset: 0
      }
    }, React.createElement("circle", {
      cx: S / 2,
      cy: S / 2,
      r: R,
      fill: "none",
      stroke: "var(--surface-3)",
      strokeWidth: "3.5"
    }), React.createElement("circle", {
      cx: S / 2,
      cy: S / 2,
      r: R,
      fill: "none",
      stroke: "var(--accent)",
      strokeWidth: "3.5",
      strokeLinecap: "round",
      strokeDasharray: `${Math.max(0.01, v / 100 * C)} ${C}`,
      transform: `rotate(-90 ${S / 2} ${S / 2})`,
      style: {
        transition: "stroke-dasharray 0.9s cubic-bezier(0.2,0.8,0.2,1)"
      }
    })), React.createElement(GMCluster, {
      members: g.members,
      size: 20
    }));
  }
  function GMCluster({
    members,
    size = 26
  }) {
    const shown = members.slice(0, 3);
    return React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center"
      }
    }, shown.map((p, i) => React.createElement("span", {
      key: p.id,
      style: {
        marginLeft: i ? -Math.round(size * 0.32) : 0,
        display: "inline-flex",
        zIndex: shown.length - i,
        position: "relative"
      }
    }, React.createElement(window.GDAv, {
      p: p,
      size: size
    }))));
  }
  function GroupPicker({
    gs,
    cur,
    onPick
  }) {
    return React.createElement("div", {
      className: "h-scroll",
      style: {
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "10px 2px 2px"
      }
    }, gs.map(g => {
      const on = g.id === cur;
      return React.createElement("button", {
        key: g.id,
        className: "press",
        onClick: () => onPick(g.id),
        "aria-pressed": on,
        style: {
          "--accent": gmAccent(g),
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          cursor: "pointer",
          padding: "6px 13px 6px 8px",
          borderRadius: 999,
          WebkitAppearance: "none",
          background: on ? "color-mix(in oklch, var(--accent) 10%, var(--surface-2))" : "var(--surface-2)",
          border: on ? "1.5px solid color-mix(in oklch, var(--accent) 55%, transparent)" : LINE,
          boxShadow: "var(--shadow-card)",
          position: "relative"
        }
      }, React.createElement(GMCluster, {
        members: g.members,
        size: 22
      }), React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 12.5,
          fontWeight: on ? 800 : 600,
          color: on ? "var(--ink)" : "var(--ink-2)",
          whiteSpace: "nowrap"
        }
      }, g.name), !g.done && React.createElement("span", {
        title: "today's question waiting",
        style: {
          position: "absolute",
          top: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "var(--accent)",
          border: "2px solid var(--surface)"
        }
      }));
    }));
  }
  const gmBar = pct => React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 999,
      background: "var(--surface-3)",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      width: pct + "%",
      height: "100%",
      borderRadius: 999,
      background: "var(--accent)",
      opacity: 0.75
    }
  }));
  const scenInk = scen => window.GDScenInk ? window.GDScenInk(scen) : `oklch(0.605 0.118 ${scen.hue})`;
  const gmName = (D, id) => id === "me" ? "You" : D.first(D.personOf(id));
  function GroupVotesCard({
    g
  }) {
    const D = window.DUELS;
    const rv = D.roleVotes(g.id);
    const [open, setOpen] = useState(null);
    const packs = rv.scenarios.map(sc => ({
      sc,
      roles: rv.roles.filter(r => r.scen.id === sc.id).sort((a, b) => b.r - a.r)
    })).filter(p => p.roles.length);
    const face = (id, size) => id === "me" ? React.createElement(window.YouChip, {
      size: size
    }) : React.createElement(window.GDAv, {
      p: D.personOf(id),
      size: size,
      plain: true
    });
    const dots = (n, ink) => React.createElement("span", {
      style: {
        display: "flex",
        gap: 3,
        flexShrink: 0
      }
    }, Array.from({
      length: n
    }, (_, i) => React.createElement("span", {
      key: i,
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: ink
      }
    })));
    return React.createElement("div", {
      className: "card",
      style: {
        marginTop: 14
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline"
      }
    }, React.createElement(Kicker, null, "Who the room named"), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--ink-3)"
      }
    }, rv.roles.length, " vote", rv.roles.length === 1 ? "" : "s")), !rv.roles.length && React.createElement("div", {
      style: {
        marginTop: 10,
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "var(--ink-3)",
        textWrap: "pretty"
      }
    }, "No votes revealed yet \u2014 the first role is on the table."), packs.map(({
      sc,
      roles
    }) => {
      const ink = scenInk(sc);
      return React.createElement("div", {
        key: sc.id,
        style: {
          marginTop: 14
        }
      }, React.createElement("div", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: ink
        }
      }, sc.label), React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column"
        }
      }, roles.map(role => {
        const on = open === role.key;
        const pk = on ? D.groupPicksRound(g.id, role.r) : null;
        return React.createElement("div", {
          key: role.key,
          style: {
            borderBottom: LINE
          }
        }, React.createElement("button", {
          className: "press",
          onClick: () => setOpen(on ? null : role.key),
          "aria-expanded": on,
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            minHeight: 48,
            padding: "7px 0",
            border: "none",
            background: "none",
            color: "inherit",
            cursor: "pointer",
            textAlign: "left",
            WebkitAppearance: "none"
          }
        }, React.createElement("span", {
          style: {
            display: "flex",
            alignItems: "center",
            flexShrink: 0
          }
        }, face(role.winner, 26), role.contested && role.second && React.createElement("span", {
          style: {
            marginLeft: -7,
            display: "inline-flex",
            boxShadow: "0 0 0 2px var(--surface-2)",
            borderRadius: 999
          }
        }, face(role.second, 26))), React.createElement("span", {
          style: {
            flex: 1,
            minWidth: 0
          }
        }, React.createElement("span", {
          style: {
            display: "block",
            fontFamily: "var(--sans)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }
        }, gmName(D, role.winner), role.contested && role.second ? ` & ${gmName(D, role.second)}` : ""), React.createElement("span", {
          style: {
            display: "block",
            marginTop: 1,
            fontFamily: "var(--sans)",
            fontSize: 11.5,
            fontWeight: 500,
            color: "var(--ink-3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }
        }, role.label, role.contested ? " \xB7 contested" : "")), dots(role.votes[role.winner] || 0, ink), React.createElement("span", {
          "aria-hidden": "true",
          style: {
            width: 7,
            height: 7,
            flexShrink: 0,
            marginLeft: 2,
            borderRight: "1.5px solid var(--ink-3)",
            borderBottom: "1.5px solid var(--ink-3)",
            transform: on ? "translateY(2px) rotate(-135deg)" : "translateY(-2px) rotate(45deg)",
            transition: "transform 0.22s var(--ease-out)"
          }
        })), on && pk && React.createElement("div", {
          className: "fade-in",
          style: {
            padding: "2px 0 12px",
            display: "flex",
            flexDirection: "column",
            gap: 7
          }
        }, React.createElement("div", {
          style: {
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--ink-3)"
          }
        }, role.prompt, " \xB7 round ", role.r), pk.q.targets.map((id, i) => pk.counts[i] > 0 && React.createElement("div", {
          key: id,
          style: {
            display: "flex",
            alignItems: "center",
            gap: 9
          }
        }, face(id, 22), React.createElement("span", {
          style: {
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--sans)",
            fontSize: 13,
            fontWeight: id === role.winner ? 800 : 600,
            color: "var(--ink)"
          }
        }, gmName(D, id)), React.createElement("span", {
          style: {
            fontFamily: "var(--sans)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--ink-3)"
          }
        }, "by"), React.createElement("span", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 3
          }
        }, pk.rows[i].who.map(p => React.createElement(window.GDAv, {
          key: p.id,
          p: p,
          size: 20
        })), pk.mine === i && !pk.late && React.createElement(window.YouChip, {
          size: 20
        }))))));
      })));
    }));
  }
  function GroupScoresCard({
    g
  }) {
    const D = window.DUELS;
    const scores = D.groupScores(g.id).sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
    const total = (D.RATE_QS || []).length;
    const [open, setOpen] = useState(null);
    const pos = step => 6 + step / 4 * 88;
    const word = lean => ({
      fontFamily: "var(--sans)",
      fontSize: 11.5,
      letterSpacing: "0.01em",
      width: 72,
      flexShrink: 0,
      fontWeight: lean ? 700 : 500,
      color: lean ? "var(--accent)" : "var(--ink-3)",
      textWrap: "balance"
    });
    return React.createElement("div", {
      className: "card",
      style: {
        marginTop: 14
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline"
      }
    }, React.createElement(Kicker, null, "How the group rates itself"), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--ink-3)"
      }
    }, scores.length, " of ", total, " rated")), !scores.length && React.createElement("div", {
      style: {
        marginTop: 10,
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "var(--ink-3)",
        textWrap: "pretty"
      }
    }, "No ratings yet \u2014 every fourth round asks the group about itself."), scores.length > 0 && React.createElement("div", {
      style: {
        position: "relative",
        marginTop: 14,
        display: "flex",
        flexDirection: "column",
        gap: 4
      }
    }, scores.map(s => {
      const on = open === s.dim;
      const hi = s.score >= 58,
        lo = s.score <= 42;
      const seen = {};
      return React.createElement("div", {
        key: s.dim,
        role: "button",
        tabIndex: 0,
        "aria-expanded": on,
        onClick: () => setOpen(on ? null : s.dim),
        onKeyDown: e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(on ? null : s.dim);
          }
        },
        style: {
          cursor: "pointer"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 40
        }
      }, React.createElement("span", {
        style: {
          ...word(lo),
          textAlign: "right"
        }
      }, s.poles[0]), React.createElement("div", {
        style: {
          position: "relative",
          flex: 1,
          height: 26
        }
      }, React.createElement("span", {
        style: {
          position: "absolute",
          left: "6%",
          right: "6%",
          top: "50%",
          height: 1,
          background: "var(--rule)"
        }
      }), s.marks.filter(m => !m.me).map(m => {
        const k = seen[m.step] = (seen[m.step] || 0) + 1;
        return React.createElement("span", {
          key: m.id,
          title: m.p ? m.p.name : "",
          style: {
            position: "absolute",
            left: pos(m.step) + "%",
            top: "50%",
            transform: `translate(${-50 + (k - 1) * 45}%, -50%)`,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "color-mix(in oklch, var(--accent) 45%, var(--surface))"
          }
        });
      }), s.mine != null && React.createElement("span", {
        title: "you",
        style: {
          position: "absolute",
          left: pos(s.mine) + "%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "var(--ink)",
          border: "1.5px solid var(--surface)",
          boxSizing: "border-box",
          boxShadow: "0 0 0 0.5px var(--rule)"
        }
      }), React.createElement("span", {
        title: `the group · ${s.score}`,
        style: {
          position: "absolute",
          left: pos(s.mean) + "%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: "var(--accent)",
          border: "2px solid var(--surface)",
          boxSizing: "border-box",
          boxShadow: "0 0 0 1px var(--accent)"
        }
      })), React.createElement("span", {
        style: word(hi)
      }, s.poles[1])), on && React.createElement("div", {
        className: "fade-in",
        style: {
          margin: "0 0 8px",
          padding: "9px 12px",
          borderRadius: 12,
          background: "var(--surface-2)",
          border: LINE
        }
      }, React.createElement("div", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 12.5,
          fontWeight: 500,
          color: "var(--ink-2)",
          textWrap: "pretty"
        }
      }, s.prompt), React.createElement("div", {
        style: {
          marginTop: 5,
          fontFamily: "var(--sans)",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--ink)"
        }
      }, s.label, " ", React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: "var(--ink-3)"
        }
      }, "\xB7 ", s.score, " \xB7 round ", s.r, s.mine != null ? ` · you said ${D.stepLabel(s.poles, s.mine)}` : ""))));
    })), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        marginTop: 10,
        paddingTop: 11,
        borderTop: LINE,
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--ink-3)",
        letterSpacing: "0.09em",
        textTransform: "uppercase"
      }
    }, React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        width: 11,
        height: 11,
        borderRadius: "50%",
        background: "var(--accent)"
      }
    }), "the group"), React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: "var(--ink)"
      }
    }), "you"), React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: "color-mix(in oklch, var(--accent) 45%, var(--surface))"
      }
    }), "members")));
  }
  function GroupPeopleCard({
    g
  }) {
    const D = window.DUELS;
    const P = D.groupPortrait(g.id);
    const ms = D.groupMembers(g.id);
    const lo = Math.min(...ms.map(p => p.match)) - 8;
    const xOf = m => 6 + (m - lo) / (100 - lo) * 88;
    const placed = [];
    const pts = [...ms].sort((a, b) => a.match - b.match).map(p => {
      const x = xOf(p.match);
      let lvl = 0;
      for (const cand of [0, -1, 1, -2, 2]) {
        if (!placed.some(q => q.lvl === cand && Math.abs(q.x - x) < 15)) {
          lvl = cand;
          break;
        }
      }
      placed.push({
        x,
        lvl
      });
      return {
        p,
        x,
        lvl
      };
    });
    const maxAbs = Math.max(...pts.map(q => Math.abs(q.lvl)));
    const BH = 96 + maxAbs * 46,
      cy = BH / 2;
    const count = {};
    ms.forEach(p => (p.interests || []).forEach(t => {
      count[t] = (count[t] || 0) + 1;
    }));
    const shared = Object.entries(count).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return React.createElement("div", {
      className: "card",
      style: {
        marginTop: 14
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline"
      }
    }, React.createElement(Kicker, null, "Who's who"), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--ink-3)",
        letterSpacing: "0.09em",
        textTransform: "uppercase"
      }
    }, "closer \u2192 more like you")), React.createElement("div", {
      style: {
        position: "relative",
        height: BH,
        marginTop: 6
      }
    }, React.createElement("div", {
      style: {
        position: "absolute",
        left: "2%",
        right: "2%",
        top: cy,
        height: 1,
        background: "var(--rule)"
      }
    }), React.createElement("div", {
      style: {
        position: "absolute",
        left: xOf(100) + "%",
        top: cy,
        transform: "translate(-50%, -50%)",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "var(--ink)",
        border: "2px solid var(--surface)",
        boxShadow: "0 0 0 0.5px var(--rule)"
      }
    }), React.createElement("div", {
      style: {
        position: "absolute",
        left: xOf(100) + "%",
        transform: "translateX(-50%)",
        top: cy + 9,
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--ink-3)"
      }
    }, "you"), pts.map(({
      p,
      x,
      lvl
    }) => {
      const isTwin = P.twin && p.id === P.twin.id;
      const isCon = P.contrarian && p.id === P.contrarian.id;
      return React.createElement("div", {
        key: p.id,
        onClick: () => window.openPerson && window.openPerson(p),
        role: "button",
        tabIndex: 0,
        "aria-label": p.name,
        onKeyDown: e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            window.openPerson && window.openPerson(p);
          }
        },
        style: {
          position: "absolute",
          left: x + "%",
          top: cy + lvl * 46,
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          cursor: "pointer"
        }
      }, React.createElement("span", {
        style: {
          borderRadius: "50%",
          display: "inline-flex",
          boxShadow: isTwin ? "0 0 0 2px var(--accent)" : isCon ? "0 0 0 2px var(--ink-3)" : "0 0 0 2.5px var(--surface)"
        }
      }, React.createElement(window.GDAv, {
        p: p,
        size: 28,
        plain: true
      })), React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 10.5,
          fontWeight: 700,
          color: "var(--ink-2)",
          whiteSpace: "nowrap"
        }
      }, p.name.split(" ")[0]));
    })), (P.twin || P.contrarian) && React.createElement("div", {
      className: "legend",
      style: {
        justifyContent: "center",
        marginTop: 2
      }
    }, P.twin && React.createElement("span", {
      style: {
        "--lgc": "var(--accent)"
      }
    }, React.createElement("span", {
      className: "lg-dot"
    }), "votes like you"), P.contrarian && React.createElement("span", {
      style: {
        "--lgc": "var(--ink-3)"
      }
    }, React.createElement("span", {
      className: "lg-dot",
      "data-hollow": ""
    }), "votes against the room")), shared.length > 0 && React.createElement("div", {
      style: {
        marginTop: 13,
        paddingTop: 13,
        borderTop: LINE,
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement("span", {
      style: {
        flexShrink: 0,
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--ink-3)",
        letterSpacing: "0.09em",
        textTransform: "uppercase"
      }
    }, "in common"), React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6
      }
    }, shared.map(([t]) => React.createElement("span", {
      key: t,
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        color: "var(--ink-2)",
        padding: "4px 12px",
        borderRadius: 999,
        background: "var(--surface-2)",
        border: LINE
      }
    }, t)))));
  }
  const gmh = s => {
    let x = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return (x >>> 8) % 1000 / 1000;
  };
  function GroupCompareCard({
    g
  }) {
    const D = window.DUELS;
    const ms = D.groupMembers(g.id);
    const P = D.groupPortrait(g.id);
    const crowns = D.roleVotes(g.id).roles.filter(r => r.winner === "me" || r.contested && r.second === "me");
    const pop = React.useMemo(() => {
      const base = (window.IS_COMPARE_POP || {}).groups;
      if (!base) return null;
      const j = (k, v) => Math.max(6, Math.min(94, Math.round(v + (gmh("cb" + g.id + k) - 0.5) * 22)));
      const out = {
        label: g.name,
        n: ms.length
      };
      ["big5", "political", "values", "attachment", "cognitive"].forEach(t => {
        out[t] = {};
        Object.entries(base[t] || {}).forEach(([k, v]) => {
          out[t][k] = j(t + k, v);
        });
      });
      return out;
    }, [g.id]);
    return React.createElement(React.Fragment, null, pop && window.CompareBreakdown && React.createElement(window.CompareBreakdown, {
      pop: pop,
      label: g.name,
      accent: "var(--accent)"
    }), React.createElement("div", {
      className: "card",
      style: {
        marginTop: 12
      }
    }, React.createElement(Kicker, null, "How they see you"), crowns.length ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 12
      }
    }, crowns.map(r => React.createElement("span", {
      key: r.key,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "var(--sans)",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        color: "var(--ink-2)",
        padding: "5px 13px",
        borderRadius: 999,
        background: "var(--surface-2)",
        border: LINE
      }
    }, React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        background: r.contested ? "var(--surface)" : `oklch(0.62 0.12 ${r.scen.hue})`,
        border: r.contested ? `1.6px solid oklch(0.62 0.12 ${r.scen.hue})` : "none"
      }
    }), r.label))), crowns.some(r => r.contested) && React.createElement("div", {
      style: {
        marginTop: 9,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--ink-3)",
        letterSpacing: "0.09em",
        textTransform: "uppercase"
      }
    }, React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--surface)",
        border: "1.6px solid var(--ink-3)"
      }
    }), "hollow = contested")) : React.createElement("div", {
      style: {
        marginTop: 10,
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "var(--ink-3)"
      }
    }, "No crowns yet \u2014 the next scenario vote could change that."), React.createElement("div", {
      style: {
        marginTop: 15,
        paddingTop: 13,
        borderTop: LINE
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 5
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, "the room named you"), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 800,
        color: "var(--ink-2)"
      }
    }, P.meCrowns, " of ", P.votes, " votes")), gmBar(Math.round(P.meCrowns / Math.max(P.votes, 1) * 100)))));
  }
  function GroupsMirrorBody({
    onPerson,
    topLenses
  }) {
    const D = window.DUELS;
    const [, bump] = useReducer(x => x + 1, 0);
    useEffect(() => D.subscribe(bump), []);
    const gs = D.groups();
    const [gid, setGid] = useState(gs[0] && gs[0].id);
    const [lensOpen, setLensOpen] = useState("__ov");
    const g = gs.find(x => x.id === gid) || gs[0];
    if (!g) return null;
    const P = D.groupPortrait(g.id);
    const crownPct = Math.round(P.meCrowns / Math.max(P.votes, 1) * 100);
    const lenses = [{
      id: "votes",
      label: "Votes",
      render: () => React.createElement(GroupVotesCard, {
        g: g
      })
    }, {
      id: "people",
      label: "People",
      render: () => React.createElement(GroupPeopleCard, {
        g: g
      })
    }, {
      id: "scores",
      label: "Scores",
      render: () => React.createElement(GroupScoresCard, {
        g: g
      })
    }, {
      id: "compare",
      label: "Compare",
      render: () => React.createElement(GroupCompareCard, {
        g: g
      })
    }];
    const lensList = topLenses ? [{
      id: "__ov",
      label: "Overview"
    }, ...lenses] : lenses;
    const openId = topLenses ? lensList.some(l => l.id === lensOpen) ? lensOpen : "__ov" : null;
    const openLens = topLenses && openId !== "__ov" ? lenses.find(l => l.id === openId) : null;
    return React.createElement("div", {
      className: "mf-stage",
      "data-screen-label": "Mirror \u2014 groups",
      style: {
        "--accent": gmAccent(g)
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        margin: "6px 2px 0"
      }
    }, React.createElement(GMIdentity, {
      key: g.id,
      g: g,
      pct: crownPct
    }), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 21,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--ink)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, g.name), React.createElement("div", {
      style: {
        marginTop: 2,
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 500,
        color: "var(--ink-3)"
      }
    }, P.votes ? `named you in ${P.meCrowns} of ${P.votes} votes` : "no votes revealed yet"))), React.createElement(GroupPicker, {
      gs: gs,
      cur: g.id,
      onPick: setGid
    }), topLenses && React.createElement(window.MirrorLensRow, {
      lenses: lensList,
      open: openId,
      onOpen: setLensOpen
    }), (!topLenses || openId === "__ov") && React.createElement(React.Fragment, null, React.createElement(window.GroupRoleMap, {
      key: g.id,
      gid: g.id,
      gname: g.name
    })), openLens && React.createElement("div", {
      key: openId,
      className: "fade-in",
      style: {
        paddingTop: 4
      }
    }, React.createElement(window.Lazy, {
      minHeight: 480
    }, openLens.render())), !topLenses && React.createElement(MirrorLenses, {
      key: "lens-" + g.id,
      lenses: lenses
    }));
  }
  Object.assign(window, {
    GroupsMirrorBody
  });
})();