function MTCardGrab({
  mode,
  onMode
}) {
  const st = React.useRef(null);
  const ORDER = ["peek", "half", "full"];
  const step = d => {
    const i = ORDER.indexOf(mode);
    onMode(ORDER[Math.max(0, Math.min(2, i + d))]);
  };
  return React.createElement("div", {
    className: "mmt-grab",
    role: "button",
    "aria-label": "Resize card",
    onPointerDown: e => {
      st.current = {
        y: e.clientY
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
    },
    onPointerUp: e => {
      const s = st.current;
      st.current = null;
      if (!s) return;
      const dy = e.clientY - s.y;
      if (dy > 28) step(-1);else if (dy < -28) step(1);else onMode(mode === "half" ? "full" : "half");
    }
  }, React.createElement("span", {
    className: "mmt-grab-bar"
  }));
}
function MTCardNav({
  i,
  n,
  ctx,
  onPrev,
  onNext
}) {
  return React.createElement("div", {
    className: "mmt-cardnav"
  }, React.createElement("button", {
    className: "mmt-cardnav-b",
    disabled: !onPrev,
    onClick: onPrev || undefined,
    "aria-label": "Previous answer"
  }, "‹"), React.createElement("span", {
    className: "mmt-cardnav-t"
  }, React.createElement("b", null, i + 1, " of ", n), ctx ? " · " + ctx : ""), React.createElement("button", {
    className: "mmt-cardnav-b",
    disabled: !onNext,
    onClick: onNext || undefined,
    "aria-label": "Next answer"
  }, "›"));
}
function MTFindCard({
  matches,
  total,
  active,
  hueOf,
  onPick
}) {
  if (!active) return React.createElement("div", null, React.createElement("div", {
    className: "mmt-kicker"
  }, "find"), React.createElement("div", {
    className: "mmt-prompt"
  }, "Type a word from a question or an answer, or filter to this week’s and your rarer takes. ", total, " answers on the map."));
  const rows = (matches || []).slice(0, 40);
  const n = matches ? matches.length : 0;
  return React.createElement("div", null, React.createElement("div", {
    className: "mmt-kicker"
  }, n ? n + (n === 1 ? " match" : " matches") + " lit on the map" : "no matches"), rows.length ? React.createElement("div", {
    className: "mmt-matchlist is-find"
  }, rows.map(m => React.createElement("button", {
    key: m.id,
    className: "mmt-mrow mmt-frow",
    style: {
      "--hue": hueOf(m.id)
    },
    onClick: () => onPick(m.id)
  }, React.createElement("span", {
    className: "mmt-frow-top"
  }, React.createElement("span", {
    className: "mmt-dot"
  }), React.createElement("span", {
    className: "mmt-mrow-q"
  }, m.prompt), m.note ? React.createElement("span", {
    className: "mmt-frow-when"
  }, m.note) : null), React.createElement("span", {
    className: "mmt-mchip is-same"
  }, m.ans)))) : React.createElement("div", {
    className: "mmt-prompt"
  }, "Nothing on the map matches that yet."), n > rows.length ? React.createElement("div", {
    className: "mmt-prompt"
  }, "Showing the first ", rows.length, ".") : null);
}
Object.assign(window, {
  MTCardGrab,
  MTCardNav,
  MTFindCard
});
