// InSight — Map tab: the branch chip row along the top.
// ── branch chips — every branch one tap away, along the top ─────────────────
function MTBranchChips({ cats, activeCat, atHome, onPick, onHome }) {
  const { useRef, useEffect } = React;
  const rowRef = useRef(null);
  // keep the active chip in view (scrollTo, never scrollIntoView)
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const el = row.querySelector(activeCat ? `[data-chip="${activeCat}"]` : '[data-chip="all"]');
    if (!el) return;
    const target = Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2);
    // hand-rolled ease — scrollTo({behavior:'smooth'}) no-ops in some embeds
    const from = row.scrollLeft, t0 = performance.now(), dur = 260;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      row.scrollLeft = from + (target - from) * (1 - Math.pow(1 - k, 3));
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }, [activeCat]);
  return (
    <div className="mmt-chips mmt-ui" ref={rowRef} role="tablist" aria-label="Map branches">
      <button data-chip="all" className={'mmt-chipbtn is-all' + (atHome ? ' is-on' : '')} onClick={onHome}>
        <span className="mmt-chipbtn-dot is-rainbow" aria-hidden="true"></span>
        <span>All</span>
      </button>
      {cats.map((c) => (
        <button
          key={c.id}
          data-chip={c.id}
          className={'mmt-chipbtn' + (activeCat === c.id ? ' is-on' : '')}
          style={{ '--hue': c.hue }}
          onClick={() => onPick(c.id)}
        >
          <span className="mmt-chipbtn-dot" aria-hidden="true"></span>
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

window.MTBranchChips = MTBranchChips;
