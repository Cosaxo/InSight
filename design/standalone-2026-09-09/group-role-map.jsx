(function () {
  const {
    useState,
    useMemo
  } = React;
  const W = 360,
    H = 336,
    CX = 180,
    CY = 162;
  const hueDot = h => `oklch(0.605 0.118 ${h})`;
  function gh(s) {
    let x = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return (x >>> 8) % 100000 / 100000;
  }
  function buildField(gid) {
    const D = window.DUELS;
    const rv = D.roleVotes(gid);
    const ms = D.groupMembers(gid);
    const n = rv.targets.length;
    const ringR = n <= 3 ? 62 : 84;
    const people = rv.targets.map((id, i) => {
      const m = id === "me" ? null : ms.find(p => p.id === id);
      const a = -Math.PI / 2 + i / n * Math.PI * 2 + (gh("pa" + gid + id) - 0.5) * 0.22;
      const r = ringR + (gh("pr" + gid + id) - 0.5) * 14;
      return {
        id,
        me: id === "me",
        p: m,
        name: m ? m.name.split(" ")[0] : "You",
        init: m ? m.init : "you",
        hue: m ? m.hue : null,
        x: CX + Math.cos(a) * r,
        y: CY + Math.sin(a) * r,
        a,
        roles: [],
        shared: []
      };
    });
    const byId = {};
    people.forEach(p => {
      byId[p.id] = p;
    });
    const solo = [],
      between = [];
    rv.roles.forEach(role => {
      if (role.contested) {
        byId[role.winner].shared.push(role);
        byId[role.second].shared.push(role);
        between.push(role);
      } else {
        byId[role.winner].roles.push(role);
        solo.push(role);
      }
    });
    people.forEach(p => {
      const k = p.roles.length;
      const orbit = 33;
      p.roles.forEach((role, i) => {
        const spread = Math.min(Math.PI * 1.15, 0.75 * Math.max(k - 1, 1));
        const a = p.a + (k > 1 ? (i / (k - 1) - 0.5) * spread : 0);
        role.sx = p.x + Math.cos(a) * orbit;
        role.sy = p.y + Math.sin(a) * orbit;
        role.holderIds = [p.id];
      });
      const A = D.archetypeOf ? D.archetypeOf(gid, p.id) : null;
      p.seat = A && A.total >= 2 ? A.seat : null;
      p.top = p.seat ? {
        label: p.seat.line
      } : p.roles[0] || p.shared[0] || null;
    });
    people.forEach(p => {
      p.rr = Math.min(17.5, 11.5 + (p.roles.length + p.shared.length * 0.5) * 1.7);
    });
    between.forEach((role, bi) => {
      const a = byId[role.winner],
        b = byId[role.second];
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy) || 1;
      const off = (bi % 2 ? 1 : -1) * 10;
      role.sx = mx + -dy / len * off;
      role.sy = my + dx / len * off;
      role.holderIds = [role.winner, role.second];
    });
    const sats = solo.concat(between);
    for (let pass = 0; pass < 30; pass++) {
      for (let i = 0; i < sats.length; i++) {
        for (let j = i + 1; j < sats.length; j++) {
          const a = sats[i],
            b = sats[j];
          let dx = b.sx - a.sx,
            dy = b.sy - a.sy;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d < 16) {
            const push = (16 - d) / 2;
            a.sx -= dx / d * push;
            a.sy -= dy / d * push;
            b.sx += dx / d * push;
            b.sy += dy / d * push;
          }
        }
        const s = sats[i];
        people.forEach(p => {
          let dx = s.sx - p.x,
            dy = s.sy - p.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const min = (p.rr || 14) + 10;
          if (d < min) {
            s.sx += dx / d * (min - d);
            s.sy += dy / d * (min - d);
          }
        });
        s.sx = Math.max(12, Math.min(W - 12, s.sx));
        s.sy = Math.max(12, Math.min(H - 26, s.sy));
      }
    }
    return {
      people,
      sats,
      byId,
      scenarios: rv.scenarios
    };
  }
  function VoteDots({
    count,
    hue
  }) {
    return React.createElement("span", {
      style: {
        display: "flex",
        gap: 3.5,
        alignItems: "center",
        flexShrink: 0
      }
    }, Array.from({
      length: count
    }, (_, i) => React.createElement("span", {
      key: i,
      style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: hueDot(hue)
      }
    })));
  }
  function Av({
    person,
    size = 26
  }) {
    if (person.me) return React.createElement("span", {
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--ink)",
        color: "var(--surface)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--sans)",
        fontSize: size * 0.34,
        fontWeight: 700,
        flexShrink: 0
      }
    }, "you");
    return React.createElement(window.GDAv, {
      p: person.p,
      size: size
    });
  }
  function ScenChip({
    scen
  }) {
    return React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        background: `oklch(0.95 0.03 ${scen.hue})`,
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        color: `oklch(0.45 0.1 ${scen.hue})`,
        whiteSpace: "nowrap",
        flexShrink: 0
      }
    }, scen.label);
  }
  function RoleVoteCard({
    field,
    role
  }) {
    const rows = field.people.map(p => ({
      p,
      count: role.votes[p.id] || 0
    })).filter(r => r.count > 0).sort((a, b) => b.count - a.count);
    return React.createElement("div", {
      className: "card",
      style: {
        marginTop: 12,
        padding: "15px 16px"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 4
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 14.5,
        fontWeight: 800,
        letterSpacing: "-0.015em",
        color: "var(--ink)"
      }
    }, role.label), React.createElement(ScenChip, {
      scen: role.scen
    })), React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12,
        color: "var(--ink-3)",
        marginBottom: 12
      }
    }, role.prompt, role.r ? " \xB7 round " + role.r : "", role.contested ? " \xB7 contested" : ""), React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 9
      }
    }, rows.map((r, i) => React.createElement("div", {
      key: r.p.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement(Av, {
      person: r.p,
      size: 24
    }), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: role.holderIds.includes(r.p.id) ? 800 : 500,
        color: role.holderIds.includes(r.p.id) ? "var(--ink)" : "var(--ink-2)"
      }
    }, r.p.name), React.createElement(VoteDots, {
      count: r.count,
      hue: role.scen.hue
    })))));
  }
  function RoleSheetCard({
    field,
    person,
    gname
  }) {
    const all = person.roles.concat(person.shared);
    return React.createElement("div", {
      className: "card",
      style: {
        marginTop: 12,
        padding: "15px 16px"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: all.length ? 13 : 0
      }
    }, React.createElement(Av, {
      person: person,
      size: 30
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 14.5,
        fontWeight: 800,
        letterSpacing: "-0.015em",
        color: "var(--ink)"
      }
    }, person.name), React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 11.5,
        color: "var(--ink-3)"
      }
    }, person.seat ? `${person.seat.label} · ${person.seat.line}` : all.length ? `how ${gname} cast ${person.me ? "you" : person.name}` : `${gname} hasn't cast ${person.me ? "you" : person.name} yet`)), !person.me && window.openPerson && React.createElement("button", {
      className: "press",
      onClick: () => window.openPerson(person.id),
      style: {
        cursor: "pointer",
        WebkitAppearance: "none",
        border: "0.5px solid var(--rule)",
        background: "var(--surface)",
        borderRadius: 999,
        padding: "6px 12px",
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink-2)",
        whiteSpace: "nowrap"
      }
    }, "profile \u2192")), all.length > 0 && React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 9
      }
    }, all.map(role => {
      const rivalId = role.contested ? role.holderIds.find(id => id !== person.id) : null;
      const rival = rivalId ? field.byId[rivalId] : null;
      return React.createElement("div", {
        key: role.key,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 9
        }
      }, React.createElement("span", {
        style: {
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: hueDot(role.scen.hue),
          flexShrink: 0
        }
      }), React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          fontFamily: "var(--sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--ink)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, role.label), rival && React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 11.5,
          color: "var(--ink-3)",
          whiteSpace: "nowrap"
        }
      }, "shared with ", rival.name));
    })));
  }
  function GroupRoleMap({
    gid,
    gname
  }) {
    const [sel, setSel] = useState(null);
    const field = useMemo(() => buildField(gid), [gid]);
    const selRole = sel && sel.kind === "role" ? field.sats.find(r => r.key === sel.key) : null;
    const selPerson = sel && sel.kind === "person" ? field.people.find(p => p.id === sel.id) : null;
    const roleDim = role => {
      if (!sel) return false;
      if (selRole) return selRole.key !== role.key;
      return !(role.holderIds || []).includes(selPerson.id);
    };
    const personDim = p => {
      if (!sel) return false;
      if (selPerson) return selPerson.id !== p.id;
      return !(selRole.holderIds || []).includes(p.id);
    };
    const wrapRef = React.useRef(null);
    const [box, setBox] = useState(null);
    React.useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const read = () => {
        const r = el.getBoundingClientRect();
        if (r.width > 8 && r.height > 8) setBox({
          w: r.width,
          h: r.height
        });
      };
      read();
      if (!window.ResizeObserver) return;
      const ro = new ResizeObserver(read);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);
    const vbH = Math.max(H, box ? W * (box.h / box.w) : H);
    const vbY = H / 2 - vbH / 2;
    return React.createElement("div", {
      className: "mf-flex"
    }, React.createElement("div", {
      ref: wrapRef,
      className: "mf-canvaswrap",
      style: {
        margin: "4px -6px 0"
      }
    }, React.createElement("style", null, `@keyframes grIn { from { opacity: 0; } to { opacity: 1; } } @keyframes grDrift { to { transform: translate(var(--dx), var(--dy)); } } @keyframes grFlow { to { stroke-dashoffset: -18; } }`), React.createElement("svg", {
      viewBox: `0 ${vbY} ${W} ${vbH}`,
      preserveAspectRatio: "xMidYMid meet",
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block"
      },
      onClick: () => setSel(null)
    }, React.createElement("defs", null, React.createElement("radialGradient", {
      id: "grWash-" + gid,
      cx: "50%",
      cy: "48%",
      r: "58%"
    }, React.createElement("stop", {
      offset: "0%",
      stopColor: "var(--accent)",
      stopOpacity: "0.09"
    }), React.createElement("stop", {
      offset: "65%",
      stopColor: "var(--accent)",
      stopOpacity: "0.04"
    }), React.createElement("stop", {
      offset: "100%",
      stopColor: "var(--accent)",
      stopOpacity: "0"
    }))), React.createElement("rect", {
      x: "0",
      y: vbY,
      width: W,
      height: vbH,
      fill: `url(#grWash-${gid})`,
      style: {
        animation: "grIn 0.6s both"
      }
    }), field.sats.map(role => (role.holderIds || []).map(hid => {
      const p = field.byId[hid];
      const on = selRole && selRole.key === role.key || selPerson && selPerson.id === hid && !roleDim(role);
      {}
      const w = Math.min(2.6, 0.7 + (role.votes && role.votes[hid] || 1) * 0.4) + (role.contested ? 0.4 : 0);
      const style = {
        transition: "opacity 0.25s ease, stroke 0.25s ease",
        animation: on && role.contested ? "grFlow 0.8s linear infinite" : undefined
      };
      const stroke = on ? hueDot(role.scen.hue) : `color-mix(in oklch, ${hueDot(role.scen.hue)} 72%, var(--rule))`;
      const op = roleDim(role) ? 0.06 : on ? 0.9 : role.contested ? 0.42 : 0.45;
      if (role.contested) {
        const mx = (role.sx + p.x) / 2,
          my = (role.sy + p.y) / 2;
        const vx = mx - CX,
          vy = my - CY,
          vl = Math.hypot(vx, vy) || 1;
        const cx2 = mx + vx / vl * 30,
          cy2 = my + vy / vl * 30;
        return React.createElement("path", {
          key: role.key + hid,
          d: `M ${role.sx} ${role.sy} Q ${cx2} ${cy2} ${p.x} ${p.y}`,
          fill: "none",
          stroke: stroke,
          strokeWidth: on ? w + 0.6 : w,
          strokeDasharray: "5 4",
          opacity: op,
          style: style
        });
      }
      return React.createElement("line", {
        key: role.key + hid,
        x1: role.sx,
        y1: role.sy,
        x2: p.x,
        y2: p.y,
        stroke: stroke,
        strokeWidth: on ? w + 0.6 : w,
        opacity: op,
        style: style
      });
    })), field.sats.map((role, i) => {
      const on = selRole && selRole.key === role.key;
      const d1 = gh("d1" + role.key),
        d2 = gh("d2" + role.key),
        d3 = gh("d3" + role.key);
      return React.createElement("g", {
        key: role.key,
        onClick: e => {
          e.stopPropagation();
          setSel(on ? null : {
            kind: "role",
            key: role.key
          });
        },
        style: {
          cursor: "pointer",
          opacity: roleDim(role) ? 0.15 : 1,
          transition: "opacity 0.25s ease",
          transformBox: "fill-box",
          transformOrigin: "center",
          "--dx": (d1 * 5 - 2.5).toFixed(1) + "px",
          "--dy": (d2 * 5 - 2.5).toFixed(1) + "px",
          animation: `grIn 0.4s ${0.05 + i * 0.03}s both, grDrift ${(4.5 + d3 * 3).toFixed(1)}s ease-in-out ${(0.6 + d1 * 2).toFixed(1)}s infinite alternate`
        }
      }, React.createElement("circle", {
        cx: role.sx,
        cy: role.sy,
        r: "13",
        fill: "transparent"
      }), React.createElement("circle", {
        cx: role.sx,
        cy: role.sy,
        r: role.contested ? 7 : 6,
        fill: "var(--surface-2)"
      }), on && React.createElement("circle", {
        cx: role.sx,
        cy: role.sy,
        r: "10.5",
        fill: "none",
        stroke: hueDot(role.scen.hue),
        strokeWidth: "1.6",
        opacity: "0.7"
      }), role.contested ? React.createElement("circle", {
        cx: role.sx,
        cy: role.sy,
        r: "5",
        fill: "var(--surface-2)",
        stroke: hueDot(role.scen.hue),
        strokeWidth: "2"
      }) : React.createElement("circle", {
        cx: role.sx,
        cy: role.sy,
        r: "4.5",
        fill: hueDot(role.scen.hue)
      }));
    }), field.people.map((p, i) => {
      const on = selPerson && selPerson.id === p.id;
      const rr = p.rr;
      return React.createElement("g", {
        key: p.id,
        onClick: e => {
          e.stopPropagation();
          setSel(on ? null : {
            kind: "person",
            id: p.id
          });
        },
        style: {
          cursor: "pointer",
          opacity: personDim(p) ? 0.25 : 1,
          transition: "opacity 0.25s ease",
          animation: `grIn 0.45s ${0.08 + i * 0.05}s both`
        }
      }, React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: rr + 8,
        fill: "transparent"
      }), React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: rr + 2.5,
        fill: "var(--surface-2)"
      }), on && React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: rr + 5,
        fill: "none",
        stroke: "var(--accent)",
        strokeWidth: "1.8"
      }), React.createElement("circle", {
        cx: p.x,
        cy: p.y,
        r: rr,
        fill: p.me ? "var(--ink)" : hueDot(p.hue)
      }), React.createElement("text", {
        x: p.x,
        y: p.y + 3.6,
        textAnchor: "middle",
        fontFamily: "var(--sans)",
        fontSize: Math.min(11.5, rr * 0.72),
        fontWeight: "700",
        fill: p.me ? "var(--surface)" : "#fff"
      }, p.init), React.createElement("text", {
        x: p.x,
        y: p.y + rr + 13.5,
        textAnchor: "middle",
        fontFamily: "var(--sans)",
        fontSize: "10.5",
        fontWeight: on ? 800 : 700,
        fill: "var(--ink)",
        stroke: "var(--surface)",
        strokeWidth: "3",
        strokeLinejoin: "round",
        style: {
          paintOrder: "stroke"
        }
      }, p.name), p.top && on && React.createElement("text", {
        x: p.x,
        y: p.y + rr + 25,
        textAnchor: "middle",
        fontFamily: "var(--sans)",
        fontSize: "9.5",
        fontWeight: "500",
        fill: "var(--ink-3)",
        stroke: "var(--surface)",
        strokeWidth: "3",
        strokeLinejoin: "round",
        style: {
          paintOrder: "stroke"
        }
      }, p.top.label));
    }))), selRole && React.createElement(RoleVoteCard, {
      field: field,
      role: selRole
    }), selPerson && React.createElement(RoleSheetCard, {
      field: field,
      person: selPerson,
      gname: gname
    }));
  }
  Object.assign(window, {
    GroupRoleMap
  });
})();
