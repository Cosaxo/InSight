(function () {
  const h = React.createElement;
  const first = n => String(n || "").split(" ")[0];
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  function recency(last) {
    const s = String(last || "").toLowerCase();
    if (!s) return 99;
    if (s === "today") return 0;
    if (s === "yesterday") return 1;
    let m = s.match(/(\d+)\s*wk/);
    if (m) return 7 * +m[1];
    m = s.match(/(\d+)\s*mo/);
    if (m) return 30 * +m[1];
    const d = DAYS.indexOf(s.slice(0, 3));
    if (d >= 0) {
      const diff = (new Date().getDay() - d + 7) % 7;
      return diff || 7;
    }
    return 50;
  }
  const aff = p => p.match != null ? Math.round(p.match) + " affinity" : null;
  function reasonFor(p, friends) {
    if (p.dist) return {
      via: null,
      text: [p.dist, aff(p)].filter(Boolean).join(" · ")
    };
    const txt = (p.rel || "") + " " + (p.note || "");
    const via = friends.find(f => txt.includes(first(f.name)));
    return {
      via: via ? first(via.name) : null,
      text: [via ? "through " + first(via.name) : p.rel || p.role, aff(p)].filter(Boolean).join(" · ")
    };
  }
  const SANS = {
    fontFamily: "var(--sans)"
  };
  const pill = (kind, hue) => {
    const base = {
      ...SANS,
      padding: "7px 14px",
      borderRadius: 999,
      cursor: "pointer",
      whiteSpace: "nowrap",
      fontSize: 12.5,
      fontWeight: 700,
      WebkitAppearance: "none",
      appearance: "none",
      flexShrink: 0,
      transition: "background 0.15s, color 0.15s"
    };
    if (kind === "primary") {
      const c = `oklch(0.55 0.13 ${hue == null ? 282 : hue})`;
      return {
        ...base,
        fontWeight: 800,
        background: c,
        color: "#fff",
        border: `0.5px solid ${c}`,
        boxShadow: `0 6px 14px -6px color-mix(in oklch, ${c} 50%, transparent)`
      };
    }
    if (kind === "danger") return {
      ...base,
      fontWeight: 800,
      background: "var(--ochre)",
      color: "#fff",
      border: "none"
    };
    return {
      ...base,
      background: "var(--surface-2)",
      color: "var(--ink)",
      border: "0.5px solid var(--rule)"
    };
  };
  const ROUND = {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "0.5px solid var(--rule)",
    background: "var(--surface)",
    color: "var(--ink-2)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
    WebkitAppearance: "none",
    appearance: "none"
  };
  const tick = () => {
    if (window.HAPTIC && window.HAPTIC.tick) window.HAPTIC.tick();
  };
  function Row({
    p,
    sub,
    subTone,
    onOpen,
    right
  }) {
    return h("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 6px",
        borderRadius: 14
      }
    }, h("button", {
      className: "press",
      onClick: onOpen,
      "aria-label": "Open " + p.name,
      style: {
        ...SANS,
        display: "flex",
        alignItems: "center",
        gap: 11,
        flex: 1,
        minWidth: 0,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        WebkitAppearance: "none",
        appearance: "none",
        color: "var(--ink)"
      }
    }, h(Av, {
      init: p.init,
      hue: p.hue,
      size: 38
    }), h("span", {
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2
      }
    }, h("span", {
      style: {
        fontSize: 14.5,
        fontWeight: 650,
        letterSpacing: "-0.01em",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, p.name), sub && h("span", {
      style: {
        fontSize: 12,
        fontWeight: subTone ? 600 : 500,
        color: subTone ? "var(--ink-2)" : "var(--ink-3)",
        textWrap: "pretty"
      }
    }, sub))), h("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0
      }
    }, right));
  }
  function Group({
    label,
    n,
    children
  }) {
    return h(React.Fragment, null, h("div", {
      className: "search-group",
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 7
      }
    }, label, n != null && h("span", {
      style: {
        color: "var(--ink-3)",
        fontWeight: 600,
        letterSpacing: 0,
        textTransform: "none"
      }
    }, n)), children);
  }
  function RemoveSheet({
    p,
    onCancel,
    onConfirm,
    closing
  }) {
    const host = document.querySelector(".app");
    if (!host) return null;
    return ReactDOM.createPortal(h("div", {
      className: "wf-scrim" + (closing ? " is-closing" : ""),
      onClick: onCancel
    }, h("div", {
      className: "wf-sheet",
      onClick: e => e.stopPropagation(),
      role: "dialog",
      "aria-modal": "true"
    }, h("div", {
      className: "wf-sheet-grab"
    }), h("div", {
      className: "wf-sheet-body",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 0,
        paddingTop: 4
      }
    }, h("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11
      }
    }, h(Av, {
      init: p.init,
      hue: p.hue,
      size: 40
    }), h("div", {
      style: {
        ...SANS,
        minWidth: 0
      }
    }, h("div", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: "-0.01em"
      }
    }, "Remove " + first(p.name) + "?"), h("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-3)",
        marginTop: 2
      }
    }, [p.rel, p.last].filter(Boolean).join(" · ")))), h("div", {
      style: {
        ...SANS,
        marginTop: 12,
        fontSize: 13,
        lineHeight: 1.45,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "You'll stop comparing answers, and any 1v1 you have together ends. " + first(p.name) + " isn't told. You can add them again later."), h("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 18
      }
    }, h("button", {
      className: "press",
      onClick: onCancel,
      style: {
        ...pill("quiet"),
        flex: 1,
        padding: "13px 14px",
        fontSize: 14,
        fontWeight: 700
      }
    }, "Keep"), h("button", {
      className: "press",
      onClick: onConfirm,
      style: {
        ...pill("danger"),
        flex: 1,
        padding: "13px 14px",
        fontSize: 14,
        background: "var(--ochre-ink)"
      }
    }, "Remove"))))), host);
  }
  function FriendsOverlay({
    onClose,
    onPerson,
    back
  }) {
    const F = window.FRIENDS;
    const D = window.IS_DATA || {};
    const [, bump] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => F ? F.subscribe(bump) : undefined, []);
    const [confirm, setConfirm] = React.useState(null);
    const [cClosing, setCClosing] = React.useState(false);
    const closeConfirm = () => {
      if (cClosing) return;
      setCClosing(true);
      setTimeout(() => {
        setConfirm(null);
        setCClosing(false);
      }, 230);
    };
    const [more, setMore] = React.useState(false);
    const people = D.people || [],
      nearby = D.nearby || [];
    const byId = id => people.find(p => p.id === id) || nearby.find(p => p.id === id);
    const friends = F.list().map(byId).filter(Boolean).sort((a, b) => recency(a.last) - recency(b.last) || b.match - a.match);
    const requests = F.requests().map(byId).filter(Boolean);
    const invited = F.invitedList().map(byId).filter(Boolean);
    const open = id => F.status(id) === "none" && !F.isDismissed(id);
    const pool = people.filter(p => open(p.id)).concat(nearby.filter(p => open(p.id))).map(p => ({
      p,
      r: reasonFor(p, friends)
    })).sort((a, b) => (b.r.via ? 1 : 0) - (a.r.via ? 1 : 0) || (b.p.match || 0) - (a.p.match || 0));
    const shown = more ? pool : pool.slice(0, 4);
    const go = p => {
      tick();
      onPerson && onPerson(p);
    };
    return h("div", {
      className: "overlay surface-tint",
      "data-screen-label": "Friends",
      style: {
        "--accent": "var(--c-people)"
      }
    }, h("div", {
      className: "app-header"
    }, h("button", {
      className: "avatar-btn",
      onClick: onClose,
      "aria-label": back ? "Back" : "Close"
    }, back ? "←" : "✕"), h("div", {
      className: "h-title"
    }, "Your ", h("em", null, "friends")), h("div", {
      style: {
        width: 32,
        flexShrink: 0
      }
    })), h("div", {
      className: "app-body",
      style: {
        paddingTop: 0
      }
    }, h("div", {
      style: {
        ...SANS,
        marginTop: 14,
        fontSize: 13,
        lineHeight: 1.45,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "Your circle in the app — the people you compare answers with."), requests.length > 0 && h(Group, {
      label: "Requests",
      n: requests.length
    }, requests.map(p => h(Row, {
      key: p.id,
      p: p,
      sub: reasonFor(p, friends).text,
      onOpen: () => go(p),
      right: [h("button", {
        key: "a",
        className: "press",
        style: pill("primary", p.hue),
        onClick: () => {
          tick();
          F.accept(p.id);
        }
      }, "Accept"), h("button", {
        key: "i",
        className: "press",
        "aria-label": "Ignore request",
        style: ROUND,
        onClick: () => {
          tick();
          F.ignore(p.id);
        }
      }, "✕")]
    }))), pool.length > 0 && h(Group, {
      label: "Suggested"
    }, shown.map(({
      p,
      r
    }) => h(Row, {
      key: p.id,
      p: p,
      sub: r.text,
      onOpen: () => go(p),
      right: [h("button", {
        key: "a",
        className: "press",
        style: pill("primary", p.hue),
        onClick: () => {
          tick();
          F.invite(p.id);
        }
      }, "Add"), h("button", {
        key: "d",
        className: "press",
        "aria-label": "Dismiss suggestion",
        style: ROUND,
        onClick: () => {
          tick();
          F.dismiss(p.id);
        }
      }, "✕")]
    })), pool.length > 4 && h("button", {
      className: "press",
      onClick: () => setMore(m => !m),
      style: {
        ...SANS,
        alignSelf: "flex-start",
        margin: "2px 6px 0",
        padding: "6px 0",
        background: "none",
        border: "none",
        cursor: "pointer",
        WebkitAppearance: "none",
        appearance: "none",
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--accent-ink, var(--ink-2))"
      }
    }, more ? "Show fewer" : "Show " + (pool.length - 4) + " more")), invited.length > 0 && h(Group, {
      label: "Invited",
      n: invited.length
    }, invited.map(p => h(Row, {
      key: p.id,
      p: p,
      sub: "waiting for them to accept",
      onOpen: () => go(p),
      right: h("button", {
        className: "press",
        style: pill("quiet"),
        onClick: () => {
          tick();
          F.cancel(p.id);
        }
      }, "Cancel")
    }))), h(Group, {
      label: "Friends",
      n: friends.length
    }, friends.length ? friends.map(p => h(Row, {
      key: p.id,
      p: p,
      sub: [p.rel, p.last].filter(Boolean).join(" · "),
      onOpen: () => go(p),
      right: h("button", {
        className: "press",
        "aria-label": "Options for " + first(p.name),
        style: {
          ...ROUND,
          fontSize: 16,
          letterSpacing: "0.06em"
        },
        onClick: () => {
          tick();
          setConfirm(p.id);
        }
      }, "⋯")
    })) : h("div", {
      style: {
        ...SANS,
        padding: "18px 6px",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--ink-2)",
        textWrap: "pretty"
      }
    }, "No friends yet — add someone from the suggestions above or from their page.")), confirm && byId(confirm) && h(RemoveSheet, {
      p: byId(confirm),
      closing: cClosing,
      onCancel: () => {
        tick();
        closeConfirm();
      },
      onConfirm: () => {
        tick();
        F.unfriend(confirm);
        closeConfirm();
      }
    })));
  }
  Object.assign(window, {
    FriendsOverlay
  });
})();
