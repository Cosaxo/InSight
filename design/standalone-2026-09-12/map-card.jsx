function mtNOpts(node) {
  return node.qtype === "rating" ? 10 : node.opts ? node.opts.length : 2;
}
function mtOptLabel(node, i) {
  return node.qtype === "rating" ? i + 1 + "/10" : node.opts ? node.opts[i] : "—";
}
function MTFilterChips({
  anchors,
  activeA,
  onPick
}) {
  return React.createElement("div", {
    className: "mmt-fchips"
  }, anchors.map(a => React.createElement("button", {
    key: a.id,
    className: "mmt-fchip" + (activeA === a.id ? " is-on" : ""),
    onClick: () => onPick(a.id)
  }, a.label)));
}
function MTAnchorChips({
  anchors,
  activeId,
  onPick
}) {
  const box = React.useRef(null);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = el.querySelector(".is-on");
    if (!on) return;
    el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
  }, [activeId]);
  return React.createElement("div", {
    className: "mmt-achips-bar"
  }, React.createElement("div", {
    className: "mmt-fchips mmt-achips",
    ref: box
  }, anchors.map(a => React.createElement("button", {
    key: a.id,
    className: "mmt-fchip" + (activeId === a.id ? " is-on" : ""),
    style: {
      "--hue": a.hue
    },
    onClick: () => onPick(a.id)
  }, a.label))));
}
function mtAnchorSelf(anchor) {
  if (!anchor) return "";
  if (anchor.id === "age") {
    const a = parseInt(String(anchor.value).replace(/\D/g, ""), 10);
    if (a) {
      const lo = Math.floor(a / 10) * 10;
      return lo + "–" + (lo + 9);
    }
    return anchor.value;
  }
  if (anchor.id === "job" || anchor.id === "edu") return anchor.value;
  return String(anchor.value || "").split("·")[0].trim();
}
function MTVerdict({
  pct,
  who,
  self,
  isMode
}) {
  return React.createElement("div", {
    className: "mmt-verdict" + (isMode ? " is-maj" : " is-min")
  }, React.createElement("span", {
    className: "mmt-matchpct"
  }, pct, "%"), React.createElement("span", {
    className: "mmt-matchtext"
  }, React.createElement("b", null, isMode ? "You’re with the majority" : "A minority take"), React.createElement("span", null, "of ", who, " chose the same", self ? " · you: " + self : "")));
}
function MTGroupBars({
  node,
  anchor
}) {
  const n = mtNOpts(node);
  const d = window.MapStats.dist(node.qid, anchor.id, n, node.aidx);
  const max = Math.max(...d);
  const who = window.MapStats.groupLabel(anchor.id);
  const self = mtAnchorSelf(anchor);
  const gmode = d.indexOf(max);
  const isMode = gmode === node.aidx;
  if (node.qtype === "rating") {
    const you = node.aidx;
    const youMid = (you + 0.5) / n * 100;
    return React.createElement("div", null, React.createElement(MTVerdict, {
      pct: d[you],
      who: who,
      self: self,
      isMode: isMode
    }), React.createElement("div", {
      className: "mmt-ridge"
    }, React.createElement("span", {
      className: "mmt-ridge-youlab",
      style: {
        left: Math.max(9, Math.min(91, youMid)) + "%"
      }
    }, "you · ", you + 1), React.createElement("div", {
      className: "mmt-ridge-cols"
    }, d.map((p, i) => React.createElement("span", {
      key: i,
      className: "mmt-ridge-col" + (i === you ? " is-you" : "") + (i === gmode && gmode !== you ? " is-peak" : "")
    }, React.createElement("i", {
      style: {
        height: Math.max(7, p / max * 100) + "%"
      }
    })))), React.createElement("div", {
      className: "mmt-ridge-foot"
    }, React.createElement("span", null, "1"), gmode !== you ? React.createElement("span", {
      className: "mmt-ridge-peaklab"
    }, "most chose ", gmode + 1) : null, React.createElement("span", null, "10"))));
  }
  const total = d.reduce((a, b) => a + b, 0) || 100;
  const center = idx => {
    let c = 0;
    for (let i = 0; i < idx; i++) c += d[i];
    return (c + d[idx] / 2) / total * 100;
  };
  const labIdx = d.map((_, i) => i);
  return React.createElement("div", null, React.createElement(MTVerdict, {
    pct: d[node.aidx],
    who: who,
    self: self,
    isMode: isMode
  }), React.createElement("div", {
    className: "mmt-dbar-wrap"
  }, React.createElement("span", {
    className: "mmt-dbar-mark is-you",
    style: {
      left: center(node.aidx) + "%"
    }
  }, "you"), !isMode ? React.createElement("span", {
    className: "mmt-dbar-mark is-most",
    style: {
      left: center(gmode) + "%"
    }
  }, "most") : null, React.createElement("div", {
    className: "mmt-dbar"
  }, d.map((p, i) => React.createElement("span", {
    key: i,
    className: "mmt-dbar-seg" + (i === node.aidx ? " is-you" : "") + (i === gmode && !isMode ? " is-mode" : ""),
    style: {
      flexGrow: Math.max(p, 1.2)
    }
  })))), React.createElement("div", {
    className: "mmt-dbar-labs"
  }, labIdx.map(i => React.createElement("span", {
    key: i,
    className: "mmt-dbar-lab" + (i === node.aidx ? " is-you" : i === gmode ? " is-most" : "")
  }, React.createElement("b", null, mtOptLabel(node, i)), React.createElement("em", null, Math.round(d[i]), "%")))));
}
function MTAnswerBody({
  node,
  anchors,
  activeA,
  onFilter
}) {
  const A = anchors.find(a => a.id === activeA) || anchors[0];
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "mmt-q"
  }, node.prompt), React.createElement(MTFilterChips, {
    anchors: anchors,
    activeA: A.id,
    onPick: onFilter
  }), React.createElement(MTGroupBars, {
    node: node,
    anchor: A,
    key: A.id + node.id
  }));
}
function MTAnswerCard({
  node,
  cat,
  anchors,
  activeA,
  onFilter
}) {
  return React.createElement("div", {
    style: {
      "--hue": cat ? cat.hue : 282
    }
  }, React.createElement("div", {
    className: "mmt-kicker"
  }, React.createElement("span", {
    className: "mmt-dot"
  }), cat ? cat.label : "answer", " · ", node.note), React.createElement(MTAnswerBody, {
    node: node,
    anchors: anchors,
    activeA: activeA,
    onFilter: onFilter
  }));
}
function mtDimEnds(testKey, dimId) {
  const T = (window.IS_TESTS || {})[testKey];
  const d = T && T.dims ? T.dims.find(x => x.id === dimId) : null;
  if (d && d.blurb && d.blurb.includes("←→")) return d.blurb.split("←→").map(s => s.trim());
  return null;
}
function MTAnchorStat({
  anchor,
  openDim,
  onDim
}) {
  const R = (window.IS_TEST_RESULTS || {})[anchor.id];
  if (R && R.dims) {
    return React.createElement("div", {
      className: "mmt-astat"
    }, R.dims.map(d => {
      const isOpen = openDim === d.id;
      const gv = window.MapStats.dimVal(anchor.id, d.id, d.value);
      const ends = mtDimEnds(anchor.id, d.id);
      return React.createElement("div", {
        key: d.id,
        className: "mmt-astat-item" + (isOpen ? " is-open" : "")
      }, React.createElement("button", {
        className: "mmt-astat-row",
        onClick: () => onDim(isOpen ? null : d.id)
      }, React.createElement("span", {
        className: "mmt-astat-lab"
      }, d.label), React.createElement("span", {
        className: "mmt-astat-bar"
      }, React.createElement("i", {
        style: {
          width: d.value + "%"
        }
      }), React.createElement("b", {
        className: "mmt-astat-them",
        style: {
          left: gv + "%"
        }
      }))), isOpen ? React.createElement("div", {
        className: "mmt-astat-x"
      }, ends ? React.createElement("div", {
        className: "mmt-astat-ends"
      }, React.createElement("span", null, ends[0]), React.createElement("span", null, ends[1])) : null, React.createElement("div", {
        className: "mmt-astat-key"
      }, d.blurb && !d.blurb.includes("←→") ? React.createElement("span", {
        className: "mmt-astat-blurb"
      }, d.blurb) : React.createElement("span", null), React.createElement("span", {
        className: "mmt-mchip is-them"
      }, React.createElement("i", null, "them"), gv))) : null);
    }), React.createElement("div", {
      className: "mmt-astat-legend"
    }, React.createElement("span", {
      className: "mmt-astat-legkey"
    }, React.createElement("span", {
      className: "lk-you"
    }), "you"), React.createElement("span", {
      className: "mmt-astat-legkey"
    }, React.createElement("span", {
      className: "lk-them"
    }), "them")));
  }
  return React.createElement("div", {
    className: "mmt-astat"
  }, React.createElement("div", {
    className: "mmt-astat-big"
  }, String(anchor.value || "").replace(/^age /, "")), anchor.sub ? React.createElement("div", {
    className: "mmt-astat-sub"
  }, anchor.sub) : null);
}
function MTAnchorCard({
  anchor,
  items,
  onPick,
  anchors,
  onAnchor
}) {
  const [dimId, setDimId] = React.useState(null);
  const hasChips = !!(anchors && anchors.length > 1 && onAnchor);
  const R = (window.IS_TEST_RESULTS || {})[anchor.id];
  const dim = dimId && R && R.dims ? R.dims.find(d => d.id === dimId) : null;
  const gkey = dim ? anchor.id + "·" + dim.id : anchor.id;
  const who = dim ? "people near you on " + dim.label : window.MapStats.groupLabel(anchor.id);
  const rows = items.map(node => {
    const n = mtNOpts(node);
    const gmode = window.MapStats.mode(node.qid, gkey, n, node.aidx);
    return {
      node,
      gmode,
      match: gmode === node.aidx
    };
  });
  const same = rows.filter(r => r.match);
  const diffs = rows.filter(r => !r.match);
  const pct = rows.length ? Math.round(same.length / rows.length * 100) : 0;
  const [showSame, setShowSame] = React.useState(false);
  const T = (window.IS_TEST_RESULTS || {})[anchor.id];
  return React.createElement("div", {
    style: {
      "--hue": anchor.hue
    }
  }, hasChips ? React.createElement(MTAnchorChips, {
    anchors: anchors,
    activeId: anchor.id,
    onPick: onAnchor
  }) : null, hasChips ? T && T.taken ? React.createElement("div", {
    className: "mmt-astat-sub"
  }, "taken ", T.taken) : null : React.createElement("div", {
    className: "mmt-kicker"
  }, React.createElement("span", {
    className: "mmt-dot"
  }), anchor.label, T && T.taken ? " · taken " + T.taken : ""), React.createElement(MTAnchorStat, {
    anchor: anchor,
    openDim: dimId,
    onDim: setDimId,
    key: anchor.id
  }), React.createElement("div", {
    className: "mmt-matchhead"
  }, React.createElement("span", {
    className: "mmt-matchpct"
  }, pct, "%"), React.createElement("span", {
    className: "mmt-matchwho"
  }, "of your answers match ", who)), React.createElement("div", {
    className: "mmt-matchbar"
  }, React.createElement("i", {
    style: {
      width: pct + "%"
    }
  })), diffs.length ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "mmt-gwho"
  }, "where you differ"), React.createElement("div", {
    className: "mmt-matchlist"
  }, diffs.map(({
    node,
    gmode
  }) => React.createElement("button", {
    key: node.id,
    className: "mmt-mrow",
    onClick: () => onPick(node.id)
  }, React.createElement("span", {
    className: "mmt-mrow-q"
  }, node.prompt), React.createElement("span", {
    className: "mmt-mrow-chips"
  }, React.createElement("span", {
    className: "mmt-mchip is-you"
  }, React.createElement("i", null, "you"), node.ans), React.createElement("span", {
    className: "mmt-mchip is-them"
  }, React.createElement("i", null, "them"), mtOptLabel(node, gmode))))))) : React.createElement("div", {
    className: "mmt-allsame"
  }, "You answered like most of them on every question."), same.length ? React.createElement(React.Fragment, null, React.createElement("button", {
    className: "mmt-samehead" + (showSame ? " is-open" : ""),
    onClick: () => setShowSame(s => !s)
  }, "you agree on ", same.length, " ", same.length === 1 ? "answer" : "answers", React.createElement("span", {
    className: "mmt-samehead-chev"
  }, "▾")), showSame ? React.createElement("div", {
    className: "mmt-matchlist is-quiet"
  }, same.map(({
    node
  }) => React.createElement("button", {
    key: node.id,
    className: "mmt-mrow",
    onClick: () => onPick(node.id)
  }, React.createElement("span", {
    className: "mmt-mrow-q"
  }, node.prompt), React.createElement("span", {
    className: "mmt-mchip is-same"
  }, node.ans)))) : null) : null);
}
function MTRootCard({
  count,
  anchorCount
}) {
  const L = [["", "near the centre — with the crowd"], ["is-far", "far out — a rarer take"], ["is-fresh", "halo — answered this week"], ["is-rare", "hollow — a minority answer"]];
  return React.createElement("div", null, React.createElement("div", {
    className: "mmt-kicker"
  }, "your map"), React.createElement("div", {
    className: "mmt-title"
  }, "You"), React.createElement("div", {
    className: "mmt-prompt"
  }, count, " answers · tap a profile dot to compare yourself with people like you."), React.createElement("div", {
    className: "mmt-legend"
  }, L.map(([k, t]) => React.createElement("div", {
    key: t,
    className: "mmt-leg"
  }, React.createElement("span", {
    className: "mmt-legdot " + k,
    "aria-hidden": "true"
  }), t))));
}
function MTSwipeRow({
  items,
  onPick,
  activeId
}) {
  return React.createElement("div", {
    className: "mmt-swipe"
  }, items.map(it => React.createElement("button", {
    key: it.id,
    className: "mmt-tok" + (activeId === it.id ? " is-on" : ""),
    style: {
      "--hue": it.hue
    },
    onClick: () => onPick(it.id)
  }, React.createElement("span", {
    className: "mmt-tok-q"
  }, it.q), React.createElement("span", {
    className: "mmt-tok-ans"
  }, it.ans))));
}
function MTBranchCard({
  cat,
  items,
  onPick
}) {
  return React.createElement("div", {
    style: {
      "--hue": cat.hue
    }
  }, React.createElement("div", {
    className: "mmt-slim"
  }, React.createElement("span", {
    className: "mmt-dot"
  }), React.createElement("span", {
    className: "mmt-slim-name"
  }, cat.label), React.createElement("span", {
    className: "mmt-slim-ct"
  }, items.length)), React.createElement(MTSwipeRow, {
    items: items,
    onPick: onPick
  }));
}
function MTSubCard({
  node,
  cat,
  rows,
  anchors,
  activeA,
  onFilter
}) {
  const hue = cat ? cat.hue : 282;
  const [cur, setCur] = React.useState(rows[0] ? rows[0].id : null);
  const active = rows.find(r => r.id === cur) || rows[0];
  return React.createElement("div", {
    style: {
      "--hue": hue
    }
  }, React.createElement("div", {
    className: "mmt-slim"
  }, React.createElement("span", {
    className: "mmt-dot"
  }), React.createElement("span", {
    className: "mmt-slim-name"
  }, cat ? cat.label + " · " : "", node.label), React.createElement("span", {
    className: "mmt-slim-ct"
  }, rows.length)), rows.length > 1 ? React.createElement(MTSwipeRow, {
    items: rows.map(r => ({
      id: r.id,
      q: r.prompt,
      ans: r.ans,
      hue
    })),
    activeId: active ? active.id : null,
    onPick: setCur
  }) : null, active ? React.createElement(MTAnswerBody, {
    node: active,
    anchors: anchors,
    activeA: activeA,
    onFilter: onFilter,
    key: active.id
  }) : null);
}
Object.assign(window, {
  MTRootCard,
  MTAnswerBody,
  MTAnswerCard,
  MTAnchorCard,
  MTAnchorChips,
  MTAnchorStat,
  MTBranchCard,
  MTSubCard,
  MTSwipeRow
});
