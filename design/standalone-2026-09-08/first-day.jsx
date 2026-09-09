(function () {
  const {
    useState,
    useEffect,
    useRef
  } = React;
  const ACCENT = {
    group: "var(--c-likeness)",
    duo: "var(--c-people)"
  };
  const SEATS = {
    group: 31,
    duo: 1
  };
  const LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";
  const RULE = "0.5px solid var(--rule)";
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
  const first = p => (p && p.name || "").split(" ")[0];
  const me = () => window.IS_DATA && window.IS_DATA.me || {};
  const people = () => window.IS_DATA && window.IS_DATA.people || [];
  const ink = hue => window.WPAL.ink(`oklch(0.52 0.13 ${hue})`);
  const MY_HUE = 38;
  const worldToday = () => window.WORLD_TODAY || (window.DAILYQ && window.DAILYQ.today && window.DAILYQ.today.options ? {
    prompt: window.DAILYQ.today.prompt,
    options: window.DAILYQ.today.options
  } : null) || {
    prompt: "Pineapple belongs on pizza.",
    options: ["Absolutely", "Never"]
  };
  function Mark({
    p,
    size = 34,
    onClick,
    pressed
  }) {
    const fill = ink(p.hue == null ? 200 : p.hue);
    const Tag = onClick ? "button" : "span";
    return React.createElement(Tag, {
      onClick: onClick,
      "aria-pressed": onClick ? !!pressed : undefined,
      "aria-label": onClick ? p.name : undefined,
      title: p.name,
      className: onClick ? "press" : undefined,
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        padding: 0,
        border: "none",
        cursor: onClick ? "pointer" : "default",
        WebkitAppearance: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: Math.max(12, Math.round(size * 0.4)),
        color: "#fff",
        background: fill,
        boxShadow: "0 0 0 1.5px var(--surface-2)"
      }
    }, p.init || (p.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2));
  }
  function MyMark({
    size = 20
  }) {
    const m = me();
    return React.createElement(Mark, {
      p: {
        name: m.name || "You",
        init: m.initials || "You",
        hue: MY_HUE
      },
      size: size
    });
  }
  function OpenSeat({
    size = 20,
    acc
  }) {
    return React.createElement("span", {
      "aria-hidden": "true",
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
  function Seal({
    acc
  }) {
    return React.createElement("span", {
      "aria-label": "sealed until the reveal",
      role: "img",
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: acc,
        boxShadow: `0 0 0 3px var(--surface), inset 0 0 0 2px var(--surface), inset 0 0 0 3.5px ${acc}`
      }
    });
  }
  function EmptyRun({
    n = 7,
    acc,
    size = 11
  }) {
    return React.createElement("span", {
      "aria-hidden": "true",
      style: {
        display: "flex",
        gap: size * 0.25,
        alignItems: "center"
      }
    }, Array.from({
      length: n
    }, (_, i) => React.createElement(OpenSeat, {
      key: i,
      size: size,
      acc: acc
    })));
  }
  const pill = (acc, on = true) => ({
    width: "100%",
    border: "none",
    borderRadius: 999,
    padding: "13px 18px",
    cursor: on ? "pointer" : "default",
    WebkitAppearance: "none",
    appearance: "none",
    fontFamily: "var(--sans)",
    fontWeight: 800,
    fontSize: 14.5,
    letterSpacing: "-0.01em",
    background: on ? acc : "var(--surface-3)",
    color: on ? "#fff" : "var(--ink-3)",
    transition: "background .15s, color .15s"
  });
  const textBtn = {
    border: "none",
    background: "none",
    padding: "8px 4px",
    minHeight: 44,
    cursor: "pointer",
    WebkitAppearance: "none",
    fontFamily: "var(--sans)",
    fontWeight: 700,
    fontSize: 13.5,
    color: "var(--ink-2)"
  };
  const field = {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    borderBottom: "1px solid color-mix(in oklch, var(--ink) 22%, var(--rule))",
    borderRadius: 0,
    background: "none",
    padding: "9px 2px",
    fontFamily: "var(--sans)",
    fontWeight: 700,
    fontSize: 16,
    color: "var(--ink)",
    outline: "none"
  };
  function Day({
    mode,
    acc,
    who
  }) {
    const q = worldToday();
    const opts = (q.options || []).slice(0, 4);
    const two = opts.length === 2;
    const group = mode === "group";
    const seats = group ? [2, 3] : [0, 1];
    const when = group ? "when everyone has played, or at the deadline" : who ? "when " + first(who) + " plays" : "when you both have played";
    return React.createElement("div", {
      style: col(0)
    }, React.createElement("div", {
      style: {
        ...col(12),
        padding: "4px 0 18px"
      }
    }, React.createElement("span", {
      style: kick
    }, "Sealed"), React.createElement("div", {
      style: {
        fontFamily: "var(--serif)",
        fontWeight: 500,
        fontSize: 25,
        lineHeight: 1.14,
        letterSpacing: "-0.01em",
        textWrap: "balance"
      }
    }, q.prompt), React.createElement("div", {
      style: {
        position: "relative",
        display: "grid",
        gridTemplateColumns: two ? "1fr 1fr" : "1fr",
        borderTop: LINE,
        borderBottom: LINE
      }
    }, opts.map((o, i) => React.createElement("div", {
      key: o,
      style: {
        minHeight: two ? 58 : 46,
        display: "flex",
        alignItems: "center",
        justifyContent: two ? "center" : "flex-start",
        padding: "12px 14px",
        borderLeft: two && i === 1 ? LINE : "none",
        borderTop: !two && i > 0 ? LINE : "none",
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 17,
        letterSpacing: "-0.015em",
        color: "var(--ink-3)",
        textWrap: "pretty",
        textAlign: two ? "center" : "left"
      }
    }, o)), React.createElement(Seal, {
      acc: acc
    })), React.createElement("div", {
      style: quiet
    }, "A World question stands in ", "\u2014", " ", group ? "a group" : "a 1v1", " draws its own.")), React.createElement("div", {
      style: {
        ...col(12),
        padding: "14px 0 6px",
        borderTop: RULE
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12
      }
    }, React.createElement("span", {
      style: kick
    }, "Revealed"), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 700,
        color: acc,
        textAlign: "right",
        lineHeight: 1.35,
        textWrap: "pretty"
      }
    }, when)), React.createElement("div", {
      style: col(8)
    }, opts.slice(0, 2).map((o, i) => React.createElement("div", {
      key: o,
      style: {
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
        border: i === 0 ? `1.5px solid color-mix(in oklch, ${acc} 55%, transparent)` : LINE,
        background: "var(--surface-2)"
      }
    }, React.createElement("div", {
      style: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
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
    }, o), React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4
      }
    }, i === 0 ? React.createElement(MyMark, {
      size: 26
    }) : null, Array.from({
      length: seats[i]
    }, (_, k) => React.createElement(OpenSeat, {
      key: k,
      size: 26,
      acc: acc
    }))))))), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }
    }, React.createElement("span", {
      style: {
        ...quiet,
        color: "var(--ink-2)"
      }
    }, group ? "Who the room crowns, round by round" : "Your guess at " + (who ? first(who) + "\u2019s" : "their") + " answer"), React.createElement(EmptyRun, {
      n: 7,
      acc: acc
    }))));
  }
  function InviteHero({
    mode,
    acc,
    onAccept,
    onDecline
  }) {
    const D = window.DUELS;
    const fs = D && D.members ? D.members() : [];
    const from = fs[0] || people()[0];
    if (!from) return null;
    const others = people().filter(p => p.id !== from.id).slice(0, 3);
    const group = mode === "group";
    return React.createElement("div", {
      style: {
        ...col(11),
        padding: "4px 0 18px",
        borderBottom: RULE,
        marginBottom: 14
      }
    }, React.createElement("span", {
      style: {
        ...kick,
        color: acc
      }
    }, "Invitation"), React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 17,
        letterSpacing: "-0.015em",
        lineHeight: 1.25,
        textWrap: "pretty"
      }
    }, first(from), " invites you to ", group ? "The Crew" : "a 1v1"), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement("span", {
      style: {
        display: "flex",
        gap: 4
      }
    }, React.createElement(Mark, {
      p: from,
      size: 26
    }), group ? others.map(p => React.createElement(Mark, {
      key: p.id,
      p: p,
      size: 26
    })) : null, React.createElement(OpenSeat, {
      size: 26,
      acc: acc
    })), React.createElement("span", {
      style: quiet
    }, group ? `${others.length + 1} people \u00b7 a role a round, revealed with names when everyone has played` : "answer, then guess " + first(from) + "\u2019s")), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("button", {
      className: "press",
      onClick: onAccept,
      style: {
        ...pill(acc),
        width: "auto",
        padding: "10px 20px",
        minHeight: 44
      }
    }, "Accept"), React.createElement("button", {
      className: "press",
      onClick: onDecline,
      style: textBtn
    }, "Decline")));
  }
  function LinkHero({
    mode,
    acc
  }) {
    const [asked, setAsked] = useState(false);
    const D = window.DUELS;
    const fs = D && D.members ? D.members() : [];
    const owner = fs[0] || people()[0];
    if (!owner) return null;
    const group = mode === "group";
    return React.createElement("div", {
      style: {
        ...col(11),
        padding: "4px 0 18px",
        borderBottom: RULE,
        marginBottom: 14
      }
    }, React.createElement("span", {
      style: {
        ...kick,
        color: acc
      }
    }, "From a link"), React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 700,
        fontSize: 17,
        letterSpacing: "-0.015em",
        lineHeight: 1.25,
        textWrap: "pretty"
      }
    }, group ? `The Crew \u00b7 ${first(owner)}\u2019s group` : `A 1v1 with ${first(owner)}`), React.createElement("div", {
      style: quiet
    }, "A link asks, it does not admit. ", first(owner), " says yes first."), asked ? React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 700,
        color: "var(--ink-2)"
      }
    }, "Asked ", "\xB7", " waiting on ", first(owner)) : React.createElement("button", {
      className: "press",
      onClick: () => setAsked(true),
      style: {
        ...pill(acc),
        width: "auto",
        padding: "10px 20px",
        alignSelf: "flex-start"
      }
    }, "Ask to join"));
  }
  function StartOne({
    mode,
    acc,
    follows,
    hasName,
    onStart
  }) {
    const [open, setOpen] = useState(false);
    const [gname, setGname] = useState("");
    const [myName, setMyName] = useState("");
    const [q, setQ] = useState("");
    const [sel, setSel] = useState([]);
    const nameRef = useRef(null);
    const group = mode === "group";
    const max = SEATS[mode];
    const full = sel.length >= max;
    useEffect(() => {
      if (open && nameRef.current) nameRef.current.focus();
    }, [open]);
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : full ? s : s.concat(id));
    const term = q.trim().toLowerCase();
    const hits = term ? people().filter(p => !sel.includes(p.id) && ((p.name || "").toLowerCase().includes(term) || (p.init || "").toLowerCase() === term)).slice(0, 5) : [];
    const pickedNotFollowed = sel.filter(id => !follows.some(f => f.id === id)).map(id => people().find(p => p.id === id)).filter(Boolean);
    const needName = !hasName && !myName.trim();
    const ok = group ? gname.trim().length > 0 && sel.length >= 2 && !needName : sel.length === 1 && !needName;
    const label = !open ? group ? "Start a group" : "Start a 1v1" : ok ? group ? "Create \xB7 invites go out now" : `Invite ${first(people().find(p => p.id === sel[0]))}` : needName && (group ? gname.trim() && sel.length >= 2 : sel.length === 1) ? "Add your name" : group ? sel.length < 2 ? "Pick at least 2 people" : "Name your group" : "Pick a friend";
    const go = () => {
      if (!open) {
        setOpen(true);
        return;
      }
      if (!ok) return;
      onStart({
        name: gname.trim(),
        ids: sel,
        myName: myName.trim() || null
      });
    };
    const chip = p => React.createElement("button", {
      key: p.id,
      className: "press",
      onClick: () => toggle(p.id),
      "aria-pressed": "true",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        borderRadius: 999,
        padding: "4px 11px 4px 4px",
        cursor: "pointer",
        WebkitAppearance: "none",
        border: `1.5px solid ${acc}`,
        background: `color-mix(in oklch, ${acc} 10%, var(--surface-2))`
      }
    }, React.createElement(Mark, {
      p: p,
      size: 26
    }), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 13,
        color: "var(--ink)"
      }
    }, first(p)), React.createElement("span", {
      "aria-hidden": "true",
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 800,
        color: "var(--ink-3)"
      }
    }, "\u2715"));
    return React.createElement("div", {
      style: {
        ...col(16),
        padding: "18px 0 6px",
        borderTop: RULE
      }
    }, open ? React.createElement("div", {
      style: col(18)
    }, group ? React.createElement("input", {
      ref: nameRef,
      value: gname,
      onChange: e => setGname(e.target.value),
      placeholder: "Group name",
      maxLength: 24,
      autoComplete: "off",
      autoCapitalize: "words",
      enterKeyHint: "done",
      style: field
    }) : null, !hasName ? React.createElement("input", {
      ref: group ? undefined : nameRef,
      value: myName,
      onChange: e => setMyName(e.target.value),
      placeholder: "Your name",
      maxLength: 40,
      autoComplete: "name",
      autoCapitalize: "words",
      enterKeyHint: "done",
      style: field
    }) : null, React.createElement("div", {
      style: col(10)
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10
      }
    }, React.createElement("span", {
      style: kick
    }, "Who", "\u2019", "s coming"), React.createElement("span", {
      style: kick
    }, sel.length, "/", max, group ? " \xB7 at least 2" : "")), follows.length || pickedNotFollowed.length ? React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 7,
        alignItems: "center"
      }
    }, follows.map(p => sel.includes(p.id) ? chip(p) : React.createElement(Mark, {
      key: p.id,
      p: p,
      size: 34,
      onClick: () => toggle(p.id),
      pressed: false
    })), pickedNotFollowed.map(chip)) : null, !full ? React.createElement("div", {
      style: col(0)
    }, React.createElement("input", {
      ref: group || !hasName ? undefined : nameRef,
      value: q,
      onChange: e => setQ(e.target.value),
      placeholder: "Name or handle",
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "none",
      spellCheck: false,
      inputMode: "search",
      enterKeyHint: "search",
      style: {
        ...field,
        fontWeight: 600,
        fontSize: 15
      }
    }), hits.map(p => React.createElement("button", {
      key: p.id,
      className: "press",
      onClick: () => {
        toggle(p.id);
        setQ("");
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        textAlign: "left",
        padding: "9px 2px",
        border: "none",
        borderBottom: RULE,
        background: "none",
        cursor: "pointer",
        WebkitAppearance: "none",
        color: "inherit"
      }
    }, React.createElement(Mark, {
      p: p,
      size: 28
    }), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontWeight: 800,
        fontSize: 14
      }
    }, p.name), p.rel ? React.createElement("span", {
      style: quiet
    }, p.rel) : null))), term && !hits.length ? React.createElement("div", {
      style: {
        ...quiet,
        padding: "9px 2px"
      }
    }, "Nobody by that name yet.") : null) : null)) : null, React.createElement("button", {
      className: "press",
      onClick: go,
      disabled: open && !ok,
      style: pill(acc, !open || ok)
    }, label), open ? React.createElement("button", {
      className: "press",
      onClick: () => setOpen(false),
      style: {
        ...textBtn,
        alignSelf: "center",
        color: "var(--ink-3)"
      }
    }, "Not now") : null);
  }
  function FirstDay({
    mode = "group",
    state = "fresh",
    onDone
  }) {
    const D = window.DUELS;
    const acc = ACCENT[mode] || ACCENT.group;
    const [hero, setHero] = useState(state);
    useEffect(() => {
      setHero(state);
    }, [state]);
    const follows = state === "no-follows" ? [] : D && D.members ? D.members() : [];
    const hasName = state === "no-name" ? false : !!me().name;
    const group = mode === "group";
    const start = ({
      name,
      ids
    }) => {
      if (!D) return;
      if (group) D.createGroup(name, ids);else if (D.startDuo) D.startDuo(ids[0]);
      if (onDone) onDone();
    };
    const accept = () => {
      if (!D) return;
      const fs = D.members ? D.members() : [];
      const from = fs[0] || people()[0];
      if (group) D.createGroup("The Crew", [from].concat(people().filter(p => p.id !== from.id).slice(0, 3)).map(p => p.id));else if (from && D.startDuo) D.startDuo(from.id);
      if (onDone) onDone();
    };
    const fs = D && D.members ? D.members() : [];
    const who = !group && (hero === "invited" || hero === "link") ? fs[0] || people()[0] || null : null;
    return React.createElement("div", {
      "data-screen-label": `${group ? "Group" : "1v1"} — first run`,
      style: {
        ...col(0),
        padding: "2px 2px 14px"
      }
    }, hero === "invited" ? React.createElement(InviteHero, {
      mode: mode,
      acc: acc,
      onAccept: accept,
      onDecline: () => setHero("fresh")
    }) : null, hero === "link" ? React.createElement(LinkHero, {
      mode: mode,
      acc: acc
    }) : null, React.createElement(Day, {
      mode: mode,
      acc: acc,
      who: who
    }), React.createElement(StartOne, {
      mode: mode,
      acc: acc,
      follows: follows,
      hasName: hasName,
      onStart: start
    }), React.createElement("div", {
      style: {
        ...quiet,
        padding: "14px 0 0",
        marginTop: 12,
        borderTop: RULE
      }
    }, "An invitation reaches you here, and a link a friend sends lands here too."));
  }
  Object.assign(window, {
    FirstDay
  });
})();