(function () {
  const MIN_DUO = 1;
  const MIN_GROUP = 2;
  const CFG = {
    duo: {
      banner: "oklch(0.47 0.11 8)",
      kicker: "Role \xB7 in 1v1s",
      title: "What you are to them",
      accent: "var(--c-people)",
      hues: {
        trust: 8,
        spark: 35,
        judgement: 62,
        constancy: 340
      },
      poles: {
        trust: ["told last", "told first"],
        spark: ["along for it", "starts it"],
        judgement: ["not consulted", "consulted"],
        constancy: ["comes and goes", "always there"]
      },
      labels: {
        trust: "Trust",
        spark: "Spark",
        judgement: "Judgement",
        constancy: "Constancy"
      }
    },
    group: {
      banner: "oklch(0.47 0.10 85)",
      kicker: "Role \xB7 in groups",
      title: "Your seat in the room",
      accent: "var(--c-groups)",
      hues: {
        engine: 85,
        hands: 115,
        heart: 55,
        wild: 140
      },
      poles: {
        engine: ["waits for it", "gets it going"],
        hands: ["watches", "gets it done"],
        heart: ["apart", "holds the room"],
        wild: ["predictable", "the twist"]
      },
      labels: {
        engine: "Engine",
        hands: "Hands",
        heart: "Heart",
        wild: "Wildcard"
      }
    }
  };
  const AVG = {
    duo: {
      trust: 25,
      spark: 25,
      judgement: 25,
      constancy: 25
    },
    group: {
      engine: 25,
      hands: 25,
      heart: 25,
      wild: 25
    }
  };
  const RULE_WORD = {
    duo: {
      trust: "trust",
      spark: "spark",
      judgement: "judgement",
      constancy: "constancy"
    },
    group: {
      engine: "engine",
      hands: "hands",
      heart: "heart",
      wild: "wildcard"
    }
  };
  const RULE_ADJ = {
    duo: {
      trust: ["told last", "told first"],
      spark: ["along for it", "the starter"],
      judgement: ["unconsulted", "consulted"],
      constancy: ["come-and-go", "always there"]
    },
    group: {
      engine: ["waiting for it", "getting it going"],
      hands: ["watching", "doing it"],
      heart: ["apart", "holding the room"],
      wild: ["predictable", "the twist"]
    }
  };
  const DIM_WORD = {
    duo: {
      trust: ["told later", "told first more"],
      spark: ["starting less", "starting more"],
      judgement: ["asked less", "asked more"],
      constancy: ["around less", "around more"]
    },
    group: {
      engine: ["starting less", "starting more"],
      hands: ["doing less", "doing more"],
      heart: ["holding less", "holding more"],
      wild: ["fewer twists", "more twists"]
    }
  };
  const DUO_TYPES = [{
    name: "The Confidant",
    share: 12,
    line: "The one they tell first.",
    sig: {
      trust: 76,
      spark: 8,
      judgement: 8,
      constancy: 8
    }
  }, {
    name: "The Instigator",
    share: 10,
    line: "Nothing happens until you say so.",
    sig: {
      trust: 8,
      spark: 76,
      judgement: 8,
      constancy: 8
    }
  }, {
    name: "The Compass",
    share: 10,
    line: "The one they ask when they\u2019re lost.",
    sig: {
      trust: 8,
      spark: 8,
      judgement: 76,
      constancy: 8
    }
  }, {
    name: "The Constant",
    share: 12,
    line: "Still there. Always were.",
    sig: {
      trust: 8,
      spark: 8,
      judgement: 8,
      constancy: 76
    }
  }, {
    name: "The Ride-or-Die",
    share: 10,
    line: "Trusted, and still there.",
    sig: {
      trust: 42,
      spark: 8,
      judgement: 8,
      constancy: 42
    }
  }, {
    name: "The Co-conspirator",
    share: 9,
    line: "In on it, every time.",
    sig: {
      trust: 42,
      spark: 42,
      judgement: 8,
      constancy: 8
    }
  }, {
    name: "The Sounding Board",
    share: 9,
    line: "Told first, asked second.",
    sig: {
      trust: 40,
      spark: 8,
      judgement: 44,
      constancy: 8
    }
  }, {
    name: "The Rock",
    share: 10,
    line: "Steady, and usually right.",
    sig: {
      trust: 8,
      spark: 8,
      judgement: 40,
      constancy: 44
    }
  }, {
    name: "The Ringleader",
    share: 8,
    line: "Plans it, then makes it happen.",
    sig: {
      trust: 8,
      spark: 44,
      judgement: 40,
      constancy: 8
    }
  }, {
    name: "The Everything",
    share: 10,
    line: "A bit of each, depending on the week.",
    sig: {
      trust: 25,
      spark: 25,
      judgement: 25,
      constancy: 25
    }
  }];
  const GROUP_TYPES = [{
    name: "The Engine",
    share: 11,
    line: "Nothing starts until you do.",
    sig: {
      engine: 76,
      hands: 8,
      heart: 8,
      wild: 8
    }
  }, {
    name: "The Hands",
    share: 11,
    line: "The one who actually does it.",
    sig: {
      engine: 8,
      hands: 76,
      heart: 8,
      wild: 8
    }
  }, {
    name: "The Heart",
    share: 11,
    line: "The room holds because you\u2019re in it.",
    sig: {
      engine: 8,
      hands: 8,
      heart: 76,
      wild: 8
    }
  }, {
    name: "The Wildcard",
    share: 9,
    line: "The story happens to you.",
    sig: {
      engine: 8,
      hands: 8,
      heart: 8,
      wild: 76
    }
  }, {
    name: "The Doer",
    share: 10,
    line: "Starts it, then finishes it.",
    sig: {
      engine: 44,
      hands: 40,
      heart: 8,
      wild: 8
    }
  }, {
    name: "The Organiser",
    share: 9,
    line: "Gets everyone going, and keeps them.",
    sig: {
      engine: 42,
      hands: 8,
      heart: 42,
      wild: 8
    }
  }, {
    name: "The Gamble",
    share: 8,
    line: "Gets it going \u2014 somewhere.",
    sig: {
      engine: 40,
      hands: 8,
      heart: 8,
      wild: 44
    }
  }, {
    name: "The Host",
    share: 10,
    line: "Feeds everyone and fixes the lights.",
    sig: {
      engine: 8,
      hands: 40,
      heart: 44,
      wild: 8
    }
  }, {
    name: "The Plot Twist",
    share: 8,
    line: "Adored, and unpredictable.",
    sig: {
      engine: 8,
      hands: 8,
      heart: 40,
      wild: 44
    }
  }, {
    name: "The Scout",
    share: 6,
    line: "First out the door, either way.",
    sig: {
      engine: 8,
      hands: 44,
      heart: 8,
      wild: 40
    }
  }, {
    name: "The Ensemble",
    share: 7,
    line: "Every seat, some weeks.",
    sig: {
      engine: 25,
      hands: 25,
      heart: 25,
      wild: 25
    }
  }];
  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
  const DUO_DIMS = ["trust", "spark", "judgement", "constancy"];
  const GROUP_DIMS = ["engine", "hands", "heart", "wild"];
  function castDims(pid, side) {
    const D = window.DUELS;
    if (!D || !D.castOf) return null;
    const co = D.castOf(pid);
    if (!co || co.n < MIN_DUO) return null;
    const counts = co[side];
    const byDim = {};
    DUO_DIMS.forEach(d => {
      byDim[d] = {
        n: 0,
        role: null
      };
    });
    co.roles.forEach((role, i) => {
      byDim[role.dim].n += counts[i];
      byDim[role.dim].role = role;
    });
    return {
      n: co.n,
      dims: DUO_DIMS.map(d => ({
        id: d,
        label: CFG.duo.labels[d],
        value: clamp(byDim[d].n / co.n * 100),
        note: byDim[d].role ? `${side === "theirs" ? "they said you are" : "you said they are"} ${byDim[d].role.label.replace(/\byou\b/g, side === "theirs" ? "they" : "you")} in ${byDim[d].n} of ${co.n} round${co.n === 1 ? "" : "s"}` : null
      }))
    };
  }
  const duoDims = pid => castDims(pid, "theirs");
  const duoDimsTheirs = pid => castDims(pid, "mine");
  function seatDims(gid, id) {
    const D = window.DUELS;
    if (!D || !D.archetypeOf) return null;
    const A = D.archetypeOf(gid, id);
    if (!A || A.total < MIN_GROUP) return null;
    const seatOf = d => (D.SEATS || []).find(s => s.id === d);
    return {
      n: A.total,
      seat: A.seat,
      dims: GROUP_DIMS.map(d => ({
        id: d,
        label: CFG.group.labels[d],
        value: clamp(A.shares[d] / A.total * 100),
        note: `${A.shares[d]} of ${A.total} votes in ${seatOf(d) ? seatOf(d).label.toLowerCase() : d} roles`
      }))
    };
  }
  const groupDims = gid => seatDims(gid, "me");
  const groupDimsFor = (gid, pid) => seatDims(gid, pid);
  function blend(kind, items) {
    if (!items.length) return null;
    const ids = Object.keys(CFG[kind].hues);
    const wTotal = items.reduce((s, it) => s + it.n, 0) || 1;
    return {
      n: items.length,
      days: wTotal,
      dims: ids.map(id => ({
        id,
        label: CFG[kind].labels[id],
        value: clamp(items.reduce((s, it) => s + it.dims.find(d => d.id === id).value * it.n, 0) / wTotal)
      }))
    };
  }
  function personTypes(pid) {
    const M = window.IS_matchArchetype;
    let A = window.IS_ARCHETYPES || {};
    if (M && (!A.duo || !A.group)) {
      sync();
      A = window.IS_ARCHETYPES || {};
    }
    const out = {
      duo: null,
      group: null
    };
    if (!M) return out;
    const d = duoDimsTheirs(pid);
    if (d && A.duo) {
      const m = M("duo", d.dims);
      if (m) out.duo = {
        ...m.list[m.idx],
        n: d.n
      };
    }
    const shared = window.DUELS ? window.DUELS.groups().filter(g => g.members.some(mm => mm.id === pid)) : [];
    const items = shared.map(g => groupDimsFor(g.id, pid)).filter(Boolean);
    const g = blend("group", items);
    if (g && A.group) {
      const m = M("group", g.dims);
      if (m) out.group = {
        ...m.list[m.idx],
        n: items.length
      };
    }
    return out;
  }
  function duoList() {
    const D = window.DUELS;
    if (!D) return [];
    return D.partners().filter(p => p.state !== "invited").map(p => ({
      p,
      r: duoDims(p.id),
      cast: D.castOf ? D.castOf(p.id) : null
    }));
  }
  function groupList() {
    const D = window.DUELS;
    if (!D) return [];
    return D.groups().map(g => ({
      g,
      r: groupDims(g.id)
    }));
  }
  function sawIt() {
    return duoList().reduce((s, x) => x.cast ? {
      right: s.right + x.cast.sawIt.right,
      total: s.total + x.cast.sawIt.total
    } : s, {
      right: 0,
      total: 0
    });
  }
  function put(key, kind, res, kicker, title) {
    window.RP_TESTS[key] = {
      ...CFG[kind],
      kicker,
      title
    };
    window.IS_ARCHETYPES[key] = {
      list: kind === "duo" ? DUO_TYPES : GROUP_TYPES
    };
    window.IS_TEST_AVG[key] = AVG[kind];
    window.IS_RULE_WORD[key] = RULE_WORD[kind];
    window.IS_RULE_ADJ[key] = RULE_ADJ[kind];
    window.IS_DIM_WORD[key] = DIM_WORD[kind];
    window.IS_TEST_RESULTS[key] = {
      title,
      accent: CFG[kind].accent,
      dims: res.dims
    };
  }
  function sync() {
    if (!window.RP_TESTS || !window.IS_ARCHETYPES || !window.IS_TEST_RESULTS) return;
    const duos = duoList().filter(x => x.r);
    const groups = groupList().filter(x => x.r);
    duos.forEach(({
      p,
      r
    }) => put("duo:" + p.id, "duo", r, "Role \xB7 to " + String(p.name).split(" ")[0], "To " + String(p.name).split(" ")[0]));
    groups.forEach(({
      g,
      r
    }) => put("group:" + g.id, "group", r, "Role \xB7 " + g.name, "In " + g.name));
    const dAvg = blend("duo", duos.map(x => x.r));
    const gAvg = blend("group", groups.map(x => x.r));
    if (dAvg) put("duo", "duo", dAvg, CFG.duo.kicker, CFG.duo.title);else delete window.IS_TEST_RESULTS.duo;
    if (gAvg) put("group", "group", gAvg, CFG.group.kicker, CFG.group.title);else delete window.IS_TEST_RESULTS.group;
    return {
      duos,
      groups,
      dAvg,
      gAvg
    };
  }
  if (window.DUELS) window.DUELS.subscribe(sync);
  sync();
  window.ROLES = {
    sync,
    duoDims,
    groupDims,
    duoList,
    groupList,
    personTypes,
    sawIt,
    MIN_DUO,
    MIN_GROUP,
    CFG
  };
})();
