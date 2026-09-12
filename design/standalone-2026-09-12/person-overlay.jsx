(function () {
  function poHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 8) % 100000 / 100000;
  }
  function derivePerson(p, me) {
    const seed = key => {
      const s = String(p.id) + ":" + key;
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };
    const r = key => seed(key) % 100000 / 100000;
    const pull = Math.max(0, Math.min(1, (p.match - 35) / 65));
    const mix = (myVal, key, slack = 90) => {
      const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.7);
      return Math.max(-100, Math.min(100, myVal + drift));
    };
    const mixBig5 = (myVal, key, slack = 55) => {
      const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.6);
      return Math.max(2, Math.min(100, myVal + drift));
    };
    const big5 = {
      O: mixBig5(me.personality.O, "b5O"),
      C: mixBig5(me.personality.C, "b5C"),
      E: mixBig5(me.personality.E, "b5E"),
      A: mixBig5(me.personality.A, "b5A"),
      N: mixBig5(me.personality.N, "b5N")
    };
    const political = {
      econ: mix(me.political.econ, "pe"),
      social: mix(me.political.social, "ps"),
      foreign: mix(me.political.foreign, "pf"),
      env: mix(me.political.env, "pv"),
      tech: mix(me.political.tech, "pt"),
      auth: mix(me.political.auth, "pa"),
      estab: mix(me.political.estab, "pb")
    };
    const morals = {
      future: mix(me.morals.future, "mf"),
      circle: mix(me.morals.circle, "mc"),
      hedonism: mix(me.morals.hedonism, "mh"),
      meaning: mix(me.morals.meaning, "mm"),
      moral: mix(me.morals.moral, "mr"),
      beauty: mix(me.morals.beauty, "mb")
    };
    const chronoOpts = ["early bird", "night owl", "biphasic"];
    const chronotype = chronoOpts[seed("chrono") % 3];
    const sleepAvg = (6.4 + r("sleep") * 2.2).toFixed(1) + "h";
    const ideos = window.IS_DATA.ideologies;
    const closest = ideos.map(io => {
      const dx = io.econ - political.econ,
        dy = io.social - political.social;
      return {
        ...io,
        d: Math.sqrt(dx * dx + dy * dy)
      };
    }).sort((a, b) => a.d - b.d);
    return {
      big5,
      political,
      morals,
      chronotype,
      sleepAvg,
      closest
    };
  }
  function affinityBreakdown(me, prof, p) {
    const b5keys = ["O", "C", "E", "A", "N"];
    const b5Diff = b5keys.reduce((s, k) => s + Math.abs(me.personality[k] - prof.big5[k]), 0) / b5keys.length;
    const personality = Math.max(0, 100 - b5Diff * 1.05);
    const polKeys = ["econ", "auth", "foreign", "env", "tech", "estab"];
    const polDiff = polKeys.reduce((s, k) => s + Math.abs(me.political[k] - prof.political[k]), 0) / polKeys.length;
    const politics = Math.max(0, 100 - polDiff * 0.52);
    const mKeys = ["future", "circle", "hedonism", "meaning", "moral", "beauty"];
    const moralDiff = mKeys.reduce((s, k) => s + Math.abs(me.morals[k] - prof.morals[k]), 0) / mKeys.length;
    const values = Math.max(0, 100 - moralDiff * 0.5);
    const myCats = new Set(me.myInterests.map(i => i.c));
    const theirCats = new Set((p.interests || []).map(i => i.c));
    const inter = [...myCats].filter(c => theirCats.has(c)).length;
    const union = new Set([...myCats, ...theirCats]).size;
    const interests = union ? Math.round(inter / union * 100) : 50;
    return {
      personality,
      politics,
      values,
      interests
    };
  }
  const SUBNAV_GAP = 14;
  const lgTxt = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--sans)",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: "var(--ink-3)",
    whiteSpace: "nowrap"
  };
  function receiptRows(p) {
    const D = window.DAILYQ;
    if (!D || !D.questions) return null;
    const seed = String(p.id || p.init || p.name || "x");
    const H = s => poHash(seed + "|" + s);
    const agreeP = Math.min(0.9, Math.max(0.35, (p.match || 60) / 100 - 0.05));
    const ansText = (q, idx) => q.type === "rating" ? idx + 1 + "/10" : q.options && q.options[idx] != null ? q.options[idx] : "—";
    const out = [];
    D.questions.forEach(q => {
      if (H("has" + q.id) > 0.68) return;
      const mineIdx = D.myAnswer(q);
      if (mineIdx == null) return;
      const n = Math.max(2, q.type === "rating" ? 10 : q.type === "binary" ? 2 : q.type === "scale" ? 5 : (q.options || []).length || 2);
      const gd = window.MapStats ? window.MapStats.dist(q.id, "all", n, mineIdx) : null;
      const majIdx = gd ? gd.indexOf(Math.max(...gd)) : Math.floor(H("mj" + q.id) * n);
      let aidx;
      if (H("agree" + q.id) < agreeP) aidx = mineIdx;else {
        aidx = H("majb" + q.id) < 0.6 ? majIdx : Math.floor(H("pick" + q.id) * n);
        if (aidx === mineIdx) aidx = (aidx + 1 + Math.floor(H("shift" + q.id) * (n - 1))) % n;
      }
      const typ = gd ? gd[aidx] / 100 : 0.5;
      let hue = 250,
        cat = "";
      if (D.categoryPath && D.catMeta) {
        try {
          const path = D.categoryPath(q);
          const meta = D.catMeta(path[0]);
          if (meta && meta.hue != null) hue = meta.hue;
          cat = path[0] || "";
        } catch (e) {}
      }
      out.push({
        id: q.id,
        prompt: q.prompt.replace(/[.\s]+$/, ""),
        hue,
        cat,
        same: aidx === mineIdx,
        mine: ansText(q, mineIdx),
        them: ansText(q, aidx),
        typ,
        gap: q.type === "rating" || q.type === "scale" ? Math.abs(aidx - mineIdx) / (n - 1) : 1
      });
    });
    return out;
  }
  function receiptLead(rows) {
    const n = rows.length,
      nSame = rows.filter(r => r.same).length,
      nSplit = n - nSame;
    if (nSplit === 0) return {
      main: "Same answer every time.",
      tail: `All ${n}`
    };
    if (nSame === 0) return {
      main: "Different answers every time.",
      tail: `All ${n}`
    };
    return {
      main: `Same answer ${nSame} times out of ${n}.`,
      tail: nSplit === 1 ? "One split" : nSplit === 2 ? "Two splits" : `${nSplit} splits`
    };
  }
  function AnswersPanel({
    rows,
    themColor,
    firstName
  }) {
    const items = React.useMemo(() => rows.slice().sort((a, b) => a.hue - b.hue || (a.same ? 1 : 0) - (b.same ? 1 : 0) || a.typ - b.typ), [rows]);
    const splits = items.filter(r => !r.same).sort((a, b) => b.gap - a.gap || a.typ - b.typ);
    const [sel, setSel] = React.useState(() => splits[0] ? splits[0].id : null);
    const cur = items.find(r => r.id === sel) || null;
    const col = r => `oklch(0.605 0.118 ${r.hue})`;
    const who = {
      fontFamily: "var(--sans)",
      fontSize: 11.5,
      fontWeight: 600,
      color: "var(--ink-3)"
    };
    const lg = {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--sans)",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      color: "var(--ink-3)"
    };
    return React.createElement("div", {
      style: {
        paddingTop: 12,
        marginBottom: 30
      }
    }, React.createElement("div", {
      role: "listbox",
      "aria-label": `${items.length} questions you both answered`,
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        rowGap: 4
      }
    }, items.map(r => {
      const on = r.id === sel;
      return React.createElement("button", {
        key: r.id,
        role: "option",
        "aria-selected": on,
        "aria-label": `${r.prompt} \u2014 ${r.same ? "same answer" : "you differ"}`,
        onClick: () => setSel(on ? null : r.id),
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 44,
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
          WebkitAppearance: "none",
          appearance: "none"
        }
      }, React.createElement("span", {
        style: {
          width: 26,
          height: 26,
          borderRadius: "50%",
          boxSizing: "border-box",
          background: r.same ? col(r) : `color-mix(in oklch, ${col(r)}, transparent 88%)`,
          border: r.same ? "none" : `3px solid ${col(r)}`,
          boxShadow: on ? "0 0 0 2.5px var(--surface), 0 0 0 4.5px var(--ink)" : "none",
          transform: on ? "scale(1.08)" : "none",
          transition: "transform 0.22s var(--ease-spring), box-shadow 0.16s ease"
        }
      }));
    })), React.createElement("div", {
      style: {
        marginTop: 10,
        display: "flex",
        gap: 16
      }
    }, React.createElement("span", {
      style: lg
    }, React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: "var(--ink-2)"
      }
    }), "same answer"), React.createElement("span", {
      style: lg
    }, React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        boxSizing: "border-box",
        border: "2px solid var(--ink-2)"
      }
    }), "you differ")), cur ? React.createElement("div", {
      key: cur.id,
      className: "fade-in",
      style: {
        marginTop: 16,
        padding: "14px 16px 15px",
        borderRadius: 16,
        border: "0.5px solid var(--rule)",
        background: "var(--surface-2)",
        boxShadow: "var(--shadow-card)"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        boxSizing: "border-box",
        background: cur.same ? col(cur) : "transparent",
        border: cur.same ? "none" : `2px solid ${col(cur)}`
      }
    }), React.createElement(Kicker, null, cur.cat || "question")), React.createElement("div", {
      style: {
        marginTop: 8,
        fontFamily: "var(--serif)",
        fontSize: 17,
        fontWeight: 500,
        lineHeight: 1.35,
        color: "var(--ink)",
        textWrap: "pretty"
      }
    }, cur.prompt), React.createElement("div", {
      style: {
        marginTop: 7,
        fontFamily: "var(--sans)",
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: "-0.005em",
        color: "var(--ink)",
        textWrap: "pretty"
      }
    }, cur.same ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: who
    }, "both "), cur.mine) : React.createElement(React.Fragment, null, React.createElement("span", {
      style: who
    }, "you "), cur.mine, React.createElement("span", {
      style: who
    }, " ", "·", " ", firstName, " "), React.createElement("span", {
      style: {
        color: themColor
      }
    }, cur.them)))) : null);
  }
  function PersonOverlay({
    p: rawP,
    onClose,
    me
  }) {
    if (!rawP) return null;
    const p = React.useMemo(() => {
      const cats = window.IS_DATA?.interestCats || [];
      const interests = (rawP.interests || []).map(i => {
        if (typeof i === "string") {
          const cat = cats.find(c => c.id === i);
          return {
            t: cat ? cat.label.toLowerCase() : i,
            c: i
          };
        }
        return i;
      });
      return {
        ...rawP,
        interests
      };
    }, [rawP]);
    const prof = React.useMemo(() => derivePerson(p, me), [p, me]);
    const parts = React.useMemo(() => affinityBreakdown(me, prof, p), [me, prof, p]);
    const themColor = React.useMemo(() => window.WPAL.ink(`oklch(0.55 0.13 ${p.hue})`), [p.hue]);
    const overall = Math.round(p.match);
    const firstName = p.anon ? "Them" : p.name ? p.name.split(" ")[0] : p.init;
    const who = p.anon ? "them" : firstName;
    const [mapOpen, setMapOpen] = React.useState(false);
    const [, fBump] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => window.FRIENDS ? window.FRIENDS.subscribe(fBump) : undefined, []);
    React.useEffect(() => window.DUELS && window.DUELS.subscribe ? window.DUELS.subscribe(fBump) : undefined, []);
    const fStatus = !p.anon && p.id && window.FRIENDS ? window.FRIENDS.status(p.id) : "none";
    const isFriend = fStatus === "friends";
    const fPrim = fStatus === "none" || fStatus === "requested";
    const [confirmRemove, setConfirmRemove] = React.useState(false);
    const onFriendBtn = () => {
      if (!window.FRIENDS || !p.id) return;
      if (fStatus === "none") window.FRIENDS.invite(p.id);else if (fStatus === "invited") window.FRIENDS.cancel(p.id);else if (fStatus === "requested") window.FRIENDS.accept(p.id);else setConfirmRemove(true);
    };
    const rows = React.useMemo(() => receiptRows(p), [p.id]);
    const hasRows = !!(rows && rows.length >= 4);
    const leadParts = hasRows ? receiptLead(rows) : null;
    const D = window.DUELS;
    const duo = !p.anon && p.id && D && D.partners ? D.partners().find(x => x.id === p.id) : null;
    const groups = D && D.groups ? D.groups() : [];
    const shared = p.id ? groups.filter(g => g.members.some(m => m.id === p.id)) : [];
    const hasTogether = !!(!p.anon && p.id && D && (duo || isFriend || shared.length));
    const TABS = [{
      id: "match",
      label: "Match"
    }, hasRows ? {
      id: "answers",
      label: "Answers"
    } : null, hasTogether ? {
      id: "together",
      label: "Together"
    } : null, {
      id: "map",
      label: "Map"
    }].filter(Boolean);
    const [subRaw, setSub] = React.useState("match");
    const [why, setWhy] = React.useState(false);
    const sub = TABS.some(t => t.id === subRaw) ? subRaw : "match";
    const panelRef = React.useRef(null);
    const bodyRef = React.useRef(null);
    const heroRef = React.useRef(null);
    const nameRef = React.useRef(null);
    const titleRef = React.useRef(null);
    if (window.useSubSwipe) window.useSubSwipe(bodyRef, panelRef, TABS.map(t => t.id), sub, setSub);
    React.useEffect(() => {
      const root = bodyRef.current,
        el = nameRef.current,
        t = titleRef.current;
      if (!root || !el || !t) return;
      const show = on => {
        t.style.opacity = on ? "1" : "0";
        t.style.transform = on ? "none" : "translateY(5px)";
      };
      if (!("IntersectionObserver" in window)) {
        show(true);
        return;
      }
      const io = new IntersectionObserver(es => show(!es[es.length - 1].isIntersecting), {
        root,
        threshold: 0
      });
      io.observe(el);
      return () => io.disconnect();
    }, []);
    React.useLayoutEffect(() => {
      const b = bodyRef.current,
        h = heroRef.current;
      if (!b || !h) return;
      const natTop = Math.round(h.getBoundingClientRect().bottom - b.getBoundingClientRect().top + b.scrollTop + SUBNAV_GAP);
      if (b.scrollTop > natTop) b.scrollTop = natTop;
    }, [sub]);
    const themPop = React.useMemo(() => {
      const rnd = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
      const to01 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v + 100) / 2)]));
      const drifted = kind => {
        const R = (window.IS_TEST_RESULTS || {})[kind];
        if (!R || !R.dims || !R.dims.length) return null;
        const pull = Math.max(0, Math.min(1, ((p.match || 60) - 35) / 65));
        const out = {};
        R.dims.forEach(d => {
          const r = poHash(String(p.id || p.init || p.name || "x") + "|" + kind + "|" + d.id);
          const drift = (r - 0.5) * 2 * 46 * (1 - pull * 0.6);
          out[d.id] = Math.max(3, Math.min(100, Math.round(d.value + drift)));
        });
        return out;
      };
      const out = {
        big5: rnd(prof.big5),
        political: to01(prof.political),
        values: to01(prof.morals)
      };
      const social = drifted("attachment"),
        thinking = drifted("cognitive");
      if (social) out.attachment = social;
      if (thinking) out.cognitive = thinking;
      return out;
    }, [p, prof]);
    const renderMatch = () => {
      if (!window.CompareList) return null;
      const myInts = me.myInterests || [];
      const myCatSet = new Set(myInts.map(i => i.c));
      const theirCatSet = new Set(p.interests.map(i => i.c));
      const allCats = window.IS_DATA && window.IS_DATA.interestCats || [];
      const ladder = allCats.filter(c => myCatSet.has(c.id) || theirCatSet.has(c.id)).map(c => ({
        c,
        mine: myInts.filter(i => i.c === c.id),
        them: theirCatSet.has(c.id)
      })).sort((a, b) => {
        const rk = r => r.them && r.mine.length ? 0 : r.mine.length ? 1 : 2;
        return rk(a) - rk(b);
      });
      const bothN = ladder.filter(r => r.them && r.mine.length).length;
      const themFade = `color-mix(in oklch, ${themColor}, transparent 52%)`;
      const mark = (on, col, tip) => React.createElement("span", {
        title: tip || undefined,
        style: {
          width: 9,
          height: 9,
          borderRadius: "50%",
          flexShrink: 0,
          boxSizing: "border-box",
          background: on ? col : "transparent",
          border: on ? "none" : "1.5px solid color-mix(in oklch, var(--ink-3) 34%, transparent)"
        }
      });
      const interestsSlide = {
        kind: "interests",
        title: "Interests",
        sub: "shared ground",
        align: Math.round(parts.interests),
        body: React.createElement("div", {
          style: {
            marginTop: 6
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            height: 7,
            borderRadius: 999,
            overflow: "hidden",
            background: "var(--surface-3)"
          }
        }, React.createElement("span", {
          style: {
            width: (ladder.length ? bothN / ladder.length * 100 : 0) + "%",
            background: themColor
          }
        })), React.createElement("div", {
          style: {
            marginTop: 6,
            display: "flex",
            flexDirection: "column"
          }
        }, ladder.map(({
          c,
          mine,
          them
        }) => {
          const both = them && mine.length > 0;
          return React.createElement("div", {
            key: c.id,
            style: {
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              margin: "0 -10px",
              borderRadius: 8,
              background: both ? `color-mix(in oklch, ${themColor} 9%, transparent)` : "transparent"
            }
          }, React.createElement("span", {
            style: {
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--sans)",
              fontSize: 13.5,
              fontWeight: both ? 700 : 500,
              color: both ? "var(--ink)" : "var(--ink-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }
          }, c.label), React.createElement("span", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 11,
              flexShrink: 0
            }
          }, mark(mine.length > 0, themColor), mark(them, themFade)));
        })), React.createElement("div", {
          style: {
            marginTop: 11,
            paddingTop: 9,
            borderTop: "0.5px solid var(--rule)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: "var(--sans)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--ink-3)"
          }
        }, React.createElement("span", {
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }
        }, mark(true, themColor), "you"), React.createElement("span", {
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }
        }, mark(true, themFade), who)))
      };
      const lgDot = bg => React.createElement("span", {
        style: {
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: bg
        }
      });
      const matchLead = all => {
        const slides = (all || []).filter(s => s.kind !== "interests");
        if (slides.length < 2) return null;
        const top = slides[0],
          low = slides[slides.length - 1];
        const txt = low.align >= 75 ? `Closest on ${top.title}, least on ${low.title}.` : `Closest on ${top.title}. Furthest apart on ${low.title}.`;
        return React.createElement("div", {
          style: {
            marginBottom: 14,
            fontFamily: "var(--sans)",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.3,
            color: "var(--ink)",
            textWrap: "pretty"
          }
        }, txt);
      };
      return React.createElement("div", {
        style: {
          paddingTop: 16,
          marginBottom: 26
        }
      }, React.createElement("div", {
        style: {
          marginBottom: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }
      }, React.createElement(Kicker, null, "What makes the number"), React.createElement("span", {
        style: {
          display: "flex",
          gap: 12,
          flexShrink: 0
        }
      }, React.createElement("span", {
        style: lgTxt
      }, lgDot(themColor), "you"), React.createElement("span", {
        style: lgTxt
      }, lgDot(`color-mix(in oklch, ${themColor}, transparent 52%)`), who))), React.createElement(window.CompareList, {
        pop: themPop,
        accent: themColor,
        label: who,
        aligns: {
          big5: Math.round(parts.personality),
          political: Math.round(parts.politics),
          values: Math.round(parts.values)
        },
        extra: [interestsSlide],
        legend: false,
        lead: matchLead
      }));
    };
    const renderTogether = () => {
      const playing = !!(duo && duo.played > 0);
      const invited = !!(duo && duo.state === "invited");
      const goDuo = () => {
        window.DUO_FOCUS = p.id;
        if (window.goNav) window.goNav("track:duo");
        setTimeout(() => window.dispatchEvent(new CustomEvent("is:duo-focus")), 60);
      };
      const goGroup = gid => {
        window.GROUP_FOCUS = gid;
        if (window.goNav) window.goNav("track:group");
        setTimeout(() => window.dispatchEvent(new CustomEvent("is:group-focus")), 60);
      };
      const addable = isFriend ? groups.filter(g => !g.members.some(m => m.id === p.id)).slice(0, 4) : [];
      const pt = window.ROLES && window.ROLES.personTypes ? window.ROLES.personTypes(p.id) : {
        duo: null,
        group: null
      };
      const hasWhy = !!(pt.duo || pt.group);
      const cluster = (people, size = 26) => React.createElement("span", {
        style: {
          display: "flex",
          alignItems: "center",
          flexShrink: 0
        }
      }, people.slice(0, 5).map((m, i) => React.createElement("span", {
        key: m.me ? "me" : m.id || i,
        style: {
          display: "inline-flex",
          borderRadius: "50%",
          marginLeft: i ? -size * 0.28 : 0,
          position: "relative",
          zIndex: 6 - i,
          boxShadow: m.id === p.id ? `0 0 0 2px var(--surface-2), 0 0 0 3.5px ${themColor}` : "0 0 0 2px var(--surface-2)"
        }
      }, m.me ? React.createElement(Av, {
        init: me.initials,
        hue: 38,
        size: size
      }) : React.createElement(Av, {
        init: m.init,
        hue: m.hue,
        size: size
      }))), people.length > 5 ? React.createElement("span", {
        style: {
          marginLeft: 7,
          fontFamily: "var(--sans)",
          fontSize: 11.5,
          fontWeight: 700,
          color: "var(--ink-3)"
        }
      }, "+", people.length - 5) : null);
      const box = quiet => ({
        border: `0.5px solid ${quiet ? "color-mix(in oklch, var(--rule), transparent 20%)" : "var(--rule)"}`,
        borderRadius: 16,
        background: quiet ? "transparent" : "var(--surface-2)",
        boxShadow: quiet ? "none" : "var(--shadow-card)",
        color: "inherit",
        textAlign: "left",
        WebkitAppearance: "none",
        appearance: "none",
        minWidth: 0
      });
      const fig = (n, unit) => React.createElement("span", {
        style: {
          display: "flex",
          alignItems: "baseline",
          gap: 5,
          whiteSpace: "nowrap"
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums"
        }
      }, n), unit ? React.createElement("span", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--ink-3)"
        }
      }, unit) : null);
      const chev = React.createElement("span", {
        "aria-hidden": "true",
        style: {
          flexShrink: 0,
          fontFamily: "var(--sans)",
          fontSize: 20,
          lineHeight: 1,
          color: "var(--ink-3)"
        }
      }, "›");
      const textBtn = (label, onClick) => React.createElement("span", {
        role: "button",
        tabIndex: 0,
        onClick: e => {
          e.stopPropagation();
          onClick();
        },
        onKeyDown: e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }
        },
        style: {
          flexShrink: 0,
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink-2)",
          padding: "4px 0",
          cursor: "pointer"
        }
      }, label);
      const title = {
        fontFamily: "var(--sans)",
        fontSize: 14.5,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        color: "var(--ink)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      };
      const typeName = t => t ? React.createElement("span", {
        style: {
          color: themColor
        }
      }, t.name) : null;
      const subLine = s => s ? React.createElement("span", {
        style: {
          display: "block",
          marginTop: 3,
          fontFamily: "var(--sans)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--ink-2)",
          lineHeight: 1.4,
          textWrap: "pretty"
        }
      }, s) : null;
      const wide = (key, {
        people,
        figure,
        head,
        sub,
        onClick,
        right,
        quiet
      }) => React.createElement("button", {
        key: key,
        className: "press",
        onClick: onClick,
        style: {
          ...box(quiet),
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: "13px 14px",
          cursor: onClick ? "pointer" : "default"
        }
      }, people ? cluster(people, 30) : null, React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, figure, React.createElement("span", {
        style: {
          ...title,
          display: "block",
          marginTop: figure ? 4 : 0
        }
      }, head), subLine(sub)), right !== undefined ? right : onClick ? chev : null);
      const duoTile = duo && !invited ? playing ? wide("duo", {
        people: [{
          me: true
        }, p],
        figure: fig(duo.played, duo.played === 1 ? "round" : "rounds"),
        head: React.createElement(React.Fragment, null, "1v1", pt.duo ? React.createElement(React.Fragment, null, " · ", typeName(pt.duo)) : null),
        sub: why && pt.duo ? pt.duo.line : null,
        onClick: goDuo
      }) : wide("duo", {
        people: [{
          me: true
        }, p],
        head: "1v1 · new",
        sub: "the first round is open",
        onClick: goDuo
      }) : invited ? wide("duo", {
        people: [{
          me: true
        }, p],
        head: "1v1 · invited",
        sub: `waiting on ${firstName}`,
        onClick: null,
        right: textBtn("Cancel", () => D.cancelDuo(p.id))
      }) : isFriend ? wide("duo", {
        people: [{
          me: true
        }, p],
        head: "Start a 1v1",
        sub: "answer, then guess theirs — revealed when you both have played",
        onClick: () => D.startDuo(p.id),
        right: textBtn("Start", () => D.startDuo(p.id))
      }) : wide("duo", {
        people: [{
          me: true
        }, p],
        head: "1v1",
        sub: `for friends — add ${firstName} first`,
        onClick: null,
        quiet: true
      });
      const groupTiles = shared.length ? shared.map((g, i) => {
        const mem = g.members.find(m => m.id === p.id);
        const pend = !!(mem && mem.pending);
        const people = [mem, ...g.members.filter(m => m.id !== p.id)].filter(Boolean);
        const t = i === 0 ? pt.group : null;
        return React.createElement("button", {
          key: g.id,
          className: "press",
          onClick: pend ? undefined : () => goGroup(g.id),
          style: {
            ...box(false),
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            padding: "12px 13px 12px",
            cursor: pend ? "default" : "pointer"
          }
        }, React.createElement("span", {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            minHeight: 28
          }
        }, cluster(people), pend ? null : chev), React.createElement("span", {
          style: {
            marginTop: 12
          }
        }, fig(g.members.length + 1, "people")), React.createElement("span", {
          style: {
            ...title,
            display: "block",
            marginTop: 5
          }
        }, g.name), t ? React.createElement("span", {
          style: {
            display: "block",
            marginTop: 1,
            fontFamily: "var(--sans)",
            fontSize: 12.5,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }
        }, typeName(t)) : null, subLine(pend ? `invited · waiting on ${firstName}` : why && t ? t.line : null));
      }) : null;
      const groupsFallback = shared.length ? null : addable.length ? React.createElement("div", {
        style: {
          ...box(true),
          display: "flex",
          flexDirection: "column",
          gap: 9,
          padding: "13px 14px"
        }
      }, React.createElement("span", {
        style: title
      }, "Add ", firstName, " to a group"), React.createElement("span", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: 7
        }
      }, addable.map(g => React.createElement("button", {
        key: g.id,
        className: "press",
        onClick: () => D.addGroupMembers(g.id, [p.id]),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
          border: "0.5px solid var(--rule)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          borderRadius: 999,
          padding: "5px 12px 5px 6px",
          cursor: "pointer",
          WebkitAppearance: "none",
          fontFamily: "var(--sans)",
          fontSize: 12.5,
          fontWeight: 700
        }
      }, cluster(g.members.slice(0, 3), 20), "+ ", g.name)))) : React.createElement("div", {
        style: {
          ...box(true),
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 14px"
        }
      }, React.createElement("span", {
        style: {
          ...title,
          flex: 1,
          color: "var(--ink-2)",
          fontWeight: 600
        }
      }, "No groups together yet"));
      const co = playing && D.castOf ? D.castOf(p.id) : null;
      const castBlock = co && co.n > 0 && co.youAre && co.theyAre ? React.createElement("div", {
        style: {
          marginBottom: 30
        }
      }, React.createElement("div", {
        style: {
          marginBottom: 8
        }
      }, React.createElement(Kicker, null, "What you are to each other")), React.createElement("div", {
        style: {
          fontFamily: "var(--sans)",
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          lineHeight: 1.3,
          color: "var(--ink)",
          textWrap: "pretty"
        }
      }, "You are ", React.createElement("span", {
        style: {
          color: themColor
        }
      }, D.castThem ? D.castThem(co.youAre.role, firstName) : co.youAre.role.label), ". ", firstName, " is ", co.theyAre.role.label, "."), React.createElement("div", {
        style: {
          marginTop: 7,
          fontFamily: "var(--sans)",
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink-2)",
          textWrap: "pretty"
        }
      }, firstName, " said so in ", co.youAre.n, " of ", co.n, " round", co.n === 1 ? "" : "s", " asked", co.sawIt.total ? ` · you guessed it ${co.sawIt.right} of ${co.sawIt.total}` : "")) : null;
      let record = null;
      if (playing && (window.ReadRun || window.DuoDots)) {
        const RR = window.ReadRun || window.DuoDots;
        const clust = a => a.length <= (window.RUN_DOTS || 14) ? a.slice().sort((x, y) => (y ? 1 : 0) - (x ? 1 : 0)) : a;
        const drows = D.domainRows ? D.domainRows(duo) : [];
        const weak = drows.length >= 2 && D.weakDomain ? D.weakDomain(duo) : null;
        const hits = a => a.filter(Boolean).length;
        const readAll = Array.from({
          length: duo.read.total
        }, (_, i) => D.duoDay(p.id, duo.read.total - i).readRight);
        const byAll = Array.from({
          length: duo.readBy.total
        }, (_, i) => D.duoDay(p.id, duo.readBy.total - i).byRight);
        const rRate = hits(readAll) / Math.max(1, readAll.length),
          bRate = hits(byAll) / Math.max(1, byAll.length);
        const gapR = rRate - bRate;
        const readerLine = Math.abs(gapR) < 0.08 ? `You and ${firstName} read each other about equally well.` : gapR > 0 ? `You read ${firstName} better than ${firstName} reads you` : `${firstName} reads you better than you read ${firstName}`;
        const lead = weak && Math.abs(gapR) >= 0.08 && weak.byRate > bRate + 0.05 ? `${readerLine}, except on ${weak.label}.` : Math.abs(gapR) < 0.08 ? readerLine : readerLine + ".";
        const Ring = window.MatchRing;
        const ring = (n, tot, color, caption) => React.createElement("span", {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8
          }
        }, Ring ? React.createElement(Ring, {
          pct: n / Math.max(1, tot) * 100,
          color: color,
          size: 78,
          thick: 4,
          title: `${n} of ${tot}`
        }, React.createElement("span", {
          style: {
            fontFamily: "var(--sans)",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            fontVariantNumeric: "tabular-nums"
          }
        }, n, React.createElement("span", {
          style: {
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-3)"
          }
        }, "/", tot))) : React.createElement("span", {
          style: {
            fontFamily: "var(--sans)",
            fontSize: 18,
            fontWeight: 800
          }
        }, n, "/", tot), React.createElement("span", {
          style: {
            fontFamily: "var(--sans)",
            fontSize: 11.5,
            fontWeight: 700,
            color: "var(--ink-2)",
            textAlign: "center"
          }
        }, caption));
        const dot = (on, col) => React.createElement("span", {
          style: {
            width: 9,
            height: 9,
            borderRadius: "50%",
            boxSizing: "border-box",
            background: on ? col : "transparent",
            border: on ? "none" : `1.5px solid color-mix(in oklch, ${col} 55%, transparent)`
          }
        });
        const lg = {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--sans)",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--ink-3)"
        };
        record = React.createElement("div", {
          style: {
            marginBottom: 30
          }
        }, React.createElement("div", {
          style: {
            marginBottom: 8
          }
        }, React.createElement(Kicker, null, "How well you read each other")), React.createElement("div", {
          style: {
            fontFamily: "var(--sans)",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.3,
            color: "var(--ink)",
            textWrap: "pretty"
          }
        }, lead), React.createElement("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            marginTop: 18
          }
        }, ring(hits(readAll), readAll.length, "var(--ink)", `you read ${firstName}`), ring(hits(byAll), byAll.length, themColor, `${firstName} reads you`)), drows.length >= 2 ? React.createElement("div", {
          style: {
            marginTop: 22,
            display: "flex",
            flexDirection: "column",
            gap: 13
          }
        }, drows.map(r => React.createElement("div", {
          key: r.id,
          style: {
            display: "flex",
            alignItems: "flex-start",
            gap: 12
          }
        }, React.createElement("span", {
          style: {
            width: 96,
            flexShrink: 0,
            paddingTop: 1,
            fontFamily: "var(--sans)",
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1.25,
            textWrap: "pretty"
          }
        }, r.label === "how they see you" ? "self-image" : r.label), React.createElement("span", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 5,
            paddingTop: 2,
            minWidth: 0
          }
        }, React.createElement(RR, {
          days: clust(r.read),
          color: "var(--ink)",
          size: 11
        }), React.createElement(RR, {
          days: clust(r.by),
          color: themColor,
          size: 11
        }))))) : null, React.createElement("div", {
          style: {
            marginTop: 16,
            paddingTop: 10,
            borderTop: "0.5px solid var(--rule)",
            display: "flex",
            gap: 16
          }
        }, React.createElement("span", {
          style: lg
        }, dot(true, "var(--ink-2)"), "called it"), React.createElement("span", {
          style: lg
        }, dot(false, "var(--ink-2)"), "missed")));
      }
      return React.createElement("div", {
        style: {
          paddingTop: 16
        }
      }, React.createElement("div", {
        style: {
          marginBottom: 30
        }
      }, React.createElement("div", {
        style: {
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          minHeight: 28
        }
      }, React.createElement(Kicker, null, "Play together"), hasWhy ? React.createElement("button", {
        className: "pt-info" + (why ? " is-on" : ""),
        onClick: () => setWhy(w => !w),
        "aria-pressed": why,
        "aria-label": "What the names mean"
      }, "i") : null), React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 8
        }
      }, duoTile, groupTiles ? React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8
        }
      }, groupTiles) : groupsFallback)), castBlock, record);
    };
    const renderMap = () => React.createElement("div", {
      style: {
        paddingTop: 16,
        marginBottom: 26
      }
    }, React.createElement("div", {
      style: {
        marginBottom: 11,
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement(Kicker, null, firstName, "’", "s map")), !isFriend && React.createElement("span", {
      style: {
        flexShrink: 0,
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--ink-3)"
      }
    }, "some of it stays private until you are friends")), React.createElement("div", {
      className: "press",
      role: "button",
      tabIndex: 0,
      onClick: () => setMapOpen(true),
      onKeyDown: e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setMapOpen(true);
        }
      },
      "aria-label": `Open ${firstName}'s map`,
      style: {
        cursor: "pointer",
        border: "0.5px solid var(--rule)",
        borderRadius: 16,
        overflow: "hidden",
        background: `radial-gradient(120% 80% at 50% 0%, color-mix(in oklch, ${themColor} 8%, transparent), transparent 72%), var(--surface)`
      }
    }, React.createElement("div", {
      style: {
        height: 320,
        position: "relative",
        overflow: "hidden",
        pointerEvents: "none",
        maskImage: "linear-gradient(180deg, transparent 0, #000 12%, #000 90%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 12%, #000 90%, transparent 100%)"
      }
    }, React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        top: "50%",
        height: 440,
        transform: "translateY(-50%)"
      }
    }, window.PersonMindMap ? React.createElement(window.PersonMindMap, {
      p: p,
      following: isFriend,
      centerName: firstName,
      still: true,
      own: true
    }) : null)), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderTop: "0.5px solid var(--rule)"
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontFamily: "var(--sans)",
        fontSize: 14.5,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        color: "var(--ink)"
      }
    }, "Open ", firstName, "’", "s map"), !isFriend && React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, "partial"), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 15,
        fontWeight: 700,
        color: themColor
      }
    }, "↗"))));
    return React.createElement("div", {
      className: "overlay surface-tint"
    }, React.createElement("div", {
      className: "app-header"
    }, React.createElement("button", {
      className: "avatar-btn",
      onClick: onClose,
      "aria-label": "Back"
    }, "←"), React.createElement("div", {
      ref: titleRef,
      className: "h-title",
      style: {
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        textTransform: p.anon ? "capitalize" : "none",
        opacity: 0,
        transform: "translateY(5px)",
        transition: "opacity 0.18s ease, transform 0.24s var(--ease-out)"
      }
    }, anonName(p))), React.createElement("div", {
      ref: bodyRef,
      className: "app-body",
      style: {
        paddingTop: 0,
        overflowX: "hidden"
      }
    }, React.createElement("div", {
      ref: heroRef,
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        marginTop: 14
      }
    }, React.createElement("div", {
      style: {
        position: "relative",
        width: 108,
        height: 108,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        inset: 6,
        borderRadius: "50%",
        background: `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${themColor} 24%, transparent), transparent 72%)`
      }
    }), React.createElement("svg", {
      viewBox: "0 0 108 108",
      width: "108",
      height: "108",
      role: "img",
      "aria-label": `${overall} affinity`,
      style: {
        position: "absolute",
        inset: 0,
        transform: "rotate(-90deg)"
      }
    }, React.createElement("circle", {
      cx: "54",
      cy: "54",
      r: "48",
      fill: "none",
      stroke: `color-mix(in oklch, ${themColor} 16%, transparent)`,
      strokeWidth: "3.5"
    }), React.createElement("circle", {
      cx: "54",
      cy: "54",
      r: "48",
      fill: "none",
      stroke: themColor,
      strokeWidth: "3.5",
      strokeLinecap: "round",
      strokeDasharray: `${overall / 100 * 2 * Math.PI * 48} ${2 * Math.PI * 48}`
    })), p.anon ? React.createElement(AnonAv, {
      hue: p.hue,
      size: 80
    }) : React.createElement(Av, {
      init: p.init,
      hue: p.hue,
      size: 80
    }), React.createElement("div", {
      style: {
        position: "absolute",
        bottom: -7,
        left: "50%",
        transform: "translateX(-50%)",
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
        background: themColor,
        color: "white",
        padding: "2.5px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        boxShadow: `0 6px 16px -6px color-mix(in oklch, ${themColor} 55%, transparent)`,
        border: "2.5px solid var(--surface)"
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        fontVariantNumeric: "tabular-nums"
      }
    }, overall), React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.09em"
      }
    }, "AFFINITY"))), React.createElement("div", {
      ref: nameRef,
      style: {
        fontFamily: "var(--sans)",
        fontSize: 23,
        fontWeight: 800,
        marginTop: 15,
        letterSpacing: "-0.025em",
        lineHeight: 1.1,
        textTransform: p.anon ? "capitalize" : "none"
      }
    }, anonName(p)), !p.anon && React.createElement("div", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--ink-3)",
        letterSpacing: "0.09em",
        marginTop: 6,
        textTransform: "uppercase"
      }
    }, [p.role || p.rel, p.age ? `aged ${p.age}` : null, p.since ? `since ${p.since}` : null, p.dist].filter(Boolean).join(" · ") || "in your orbit"), hasRows && React.createElement("button", {
      className: "press",
      onClick: () => {
        if (sub === "answers") return;
        if (window.HAPTIC) window.HAPTIC.tick();
        setSub("answers");
        requestAnimationFrame(() => {
          const b = bodyRef.current,
            h = heroRef.current;
          if (!b || !h) return;
          const top = Math.round(h.getBoundingClientRect().bottom - b.getBoundingClientRect().top + b.scrollTop + SUBNAV_GAP);
          b.scrollTo({
            top: top,
            behavior: "smooth"
          });
        });
      },
      "aria-label": `${leadParts.main} ${leadParts.tail}. See the answers`,
      style: {
        marginTop: 8,
        padding: "2px 0",
        border: "none",
        background: "none",
        cursor: "pointer",
        WebkitAppearance: "none",
        appearance: "none",
        color: "var(--ink-2)",
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 600,
        lineHeight: 1.35,
        textAlign: "center",
        textWrap: "pretty"
      }
    }, leadParts.main, " ", React.createElement("span", {
      style: {
        color: themColor,
        fontWeight: 700,
        whiteSpace: "nowrap"
      }
    }, leadParts.tail, " ›")), React.createElement("div", {
      style: {
        marginTop: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7
      }
    }, !p.anon && p.id && window.FRIENDS && (confirmRemove ? React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-2)",
        whiteSpace: "nowrap"
      }
    }, "Remove from your circle?"), React.createElement("button", {
      className: "press",
      onClick: () => {
        window.FRIENDS.unfriend(p.id);
        setConfirmRemove(false);
      },
      style: {
        padding: "7px 16px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 800,
        background: "var(--ochre)",
        color: "#fff"
      }
    }, "Remove"), React.createElement("button", {
      className: "press",
      onClick: () => setConfirmRemove(false),
      style: {
        padding: "7px 14px",
        borderRadius: 999,
        border: "0.5px solid var(--rule)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: "var(--sans)",
        fontSize: 12.5,
        fontWeight: 700,
        background: "var(--surface-2)",
        color: "var(--ink)"
      }
    }, "Keep")) : React.createElement("button", {
      className: "press",
      onClick: onFriendBtn,
      style: {
        padding: "8px 22px",
        borderRadius: 999,
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: "0.01em",
        background: fPrim ? themColor : "var(--surface-2)",
        color: fPrim ? "white" : "var(--ink)",
        border: `0.5px solid ${fPrim ? themColor : "var(--rule)"}`,
        boxShadow: fPrim ? `0 6px 14px -6px color-mix(in oklch, ${themColor} 50%, transparent)` : "none",
        transition: "background 0.15s, color 0.15s, box-shadow 0.15s"
      }
    }, isFriend ? "Friends ✓" : fStatus === "invited" ? "Invited · waiting" : fStatus === "requested" ? "Accept request" : "Add friend")), !p.anon && fStatus === "invited" && !confirmRemove && React.createElement("span", {
      style: {
        fontFamily: "var(--sans)",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--ink-3)"
      }
    }, "they", "’", "ll see it soon · tap to cancel"))), React.createElement("div", {
      className: "profile-subnav",
      style: {
        marginTop: SUBNAV_GAP
      }
    }, React.createElement("div", {
      className: "subnav",
      role: "tablist",
      "aria-label": "Sections",
      style: {
        "--seg-fill": themColor
      }
    }, TABS.map(t => React.createElement("button", {
      key: t.id,
      role: "tab",
      "aria-selected": t.id === sub,
      onClick: () => {
        if (window.HAPTIC && t.id !== sub) window.HAPTIC.tick();
        setSub(t.id);
      },
      className: "subnav-btn" + (t.id === sub ? " is-on" : "")
    }, t.label)))), React.createElement("div", {
      key: sub,
      ref: panelRef,
      role: "tabpanel",
      className: "tab-swap",
      style: {
        willChange: "transform"
      }
    }, sub === "match" && renderMatch(), sub === "answers" && hasRows && React.createElement(AnswersPanel, {
      rows: rows,
      themColor: themColor,
      firstName: firstName
    }), sub === "together" && hasTogether && renderTogether(), sub === "map" && renderMap())), mapOpen && window.PersonMindMap ? React.createElement("div", {
      className: "overlay surface-tint",
      style: {
        zIndex: 24
      }
    }, React.createElement("div", {
      className: "app-header"
    }, React.createElement("button", {
      className: "avatar-btn",
      onClick: () => setMapOpen(false)
    }, "←"), React.createElement("div", {
      className: "h-title",
      style: {
        flex: 1,
        minWidth: 0
      }
    }, firstName, "’", "s map")), React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0,
        position: "relative"
      }
    }, React.createElement(window.PersonMindMap, {
      p: p,
      following: isFriend,
      centerName: firstName
    })), React.createElement("div", {
      style: {
        flexShrink: 0,
        display: "flex",
        gap: 16,
        padding: "10px 16px 14px",
        borderTop: "0.5px solid var(--rule)",
        fontFamily: "var(--sans)",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "var(--ink-3)"
      }
    }, React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7
      }
    }, React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 99,
        background: "var(--ink-2)"
      }
    }), "with the crowd"), React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7
      }
    }, React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 99,
        boxSizing: "border-box",
        border: "2.5px solid var(--ink-2)"
      }
    }), "a rarer take"), !isFriend && React.createElement("span", {
      style: {
        marginLeft: "auto",
        letterSpacing: 0,
        textTransform: "none",
        fontWeight: 600
      }
    }, "friends see everything"))) : null);
  }
  window.PersonOverlay = PersonOverlay;
})();
