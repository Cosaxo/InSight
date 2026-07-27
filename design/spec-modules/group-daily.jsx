// group-daily.jsx — the daily tab's GROUP mode. Groups are named circles
// (The Crew, Book Club…), each with its own question today. Same shape as
// 1v1: a sticky rail shows every group (dot = still to play, check = done),
// and the body is a vertical snap stack — one group card per view. Yesterday's
// reveal (with names) sits above today's question; answer, then swipe down.
(function () {
  const { useState, useEffect, useRef, useReducer } = React;
  const LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';
  const ACC = 'var(--c-likeness)';

  const col = (g) => ({ display: 'flex', flexDirection: 'column', gap: g });

  function GDAv({ p, size = 22, dim }) {
    return (
      <span title={p.name + (p.pending ? ' · invited' : '')} style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: Math.round(size * 0.4),
        color: '#fff', background: `oklch(0.62 0.12 ${p.hue})`,
        opacity: dim ? 0.28 : 1, boxShadow: '0 0 0 1.5px var(--surface-2)',
      }}>{p.init}</span>
    );
  }
  function YouChip({ size = 22 }) {
    return (
      <span style={{
        height: size, padding: '0 8px', borderRadius: 999, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 10.5,
        color: 'var(--surface)', background: 'var(--ink)', boxShadow: '0 0 0 1.5px var(--surface-2)',
      }}>you</span>
    );
  }

  // small overlapping cluster — the group's face
  function GDCluster({ members, size = 30 }) {
    const shown = members.slice(0, 3);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {shown.map((p, i) => (
          <span key={p.id} style={{ marginLeft: i ? -Math.round(size * 0.3) : 0, display: 'inline-flex', zIndex: shown.length - i, position: 'relative' }}>
            <GDAv p={p} size={size} dim={p.pending}></GDAv>
          </span>
        ))}
      </span>
    );
  }

  // revealed answers for one day — names on the options, majority carries the bar
  function GDReveal({ gid, dayIdx }) {
    const D = window.DUELS;
    const { q, rows, mine, counts, majority } = D.groupPicks(gid, dayIdx);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const youRow = q.kind === 'pick' ? rows.find((r) => r.label === 'You') : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const isMine = mine === r.oi;
          const ct = counts[r.oi];
          if (!ct) return null;
          return (
            <div key={r.oi} style={{
              position: 'relative', overflow: 'hidden', borderRadius: 14,
              border: isMine ? `1.5px solid color-mix(in oklch, ${ACC} 55%, transparent)` : LINE,
              background: 'var(--surface-2)', boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: (ct / total) * 100 + '%', background: `color-mix(in oklch, ${ACC} 13%, transparent)` }}></div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13.5 }}>{r.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {r.who.map((p) => <GDAv key={p.id} p={p} size={20}></GDAv>)}
                  {isMine && <YouChip size={20}></YouChip>}
                </span>
              </div>
            </div>
          );
        })}
        {q.kind === 'pick' && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
            {'Group verdict — ' + q.options[majority] + (youRow && youRow.who.length ? ' · ' + youRow.who.length + ' picked you' : '')}
          </div>
        )}
      </div>
    );
  }

  // ── the rail: every group at a glance — dot = waiting on you, check = done ──
  function GroupRail({ gs, cur, onPick, onAdd }) {
    return (
      <div className="h-scroll" style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '3px 6px 2px' }}>
        {gs.map((g) => {
          const sel = g.id === cur;
          const pending = !g.done;
          return (
            <button key={g.id} onClick={() => onPick(g.id)} aria-current={sel ? 'true' : undefined}
              aria-label={g.name + ' — ' + (pending ? 'still to play' : 'done for today')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', WebkitAppearance: 'none', flexShrink: 0 }}>
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '3px 6px', boxShadow: sel ? `0 0 0 2px ${ACC}` : pending ? `0 0 0 1.5px color-mix(in oklch, ${ACC} 45%, transparent)` : '0 0 0 1px var(--rule)', opacity: pending || sel ? 1 : 0.55, transition: 'box-shadow .18s, opacity .18s' }}>
                <GDCluster members={g.members} size={28}></GDCluster>
                {pending
                  ? <span style={{ position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: '50%', background: ACC, border: '2px solid var(--surface)' }}></span>
                  : <span style={{ position: 'absolute', bottom: -4, right: -4, width: 15, height: 15, borderRadius: '50%', background: ACC, color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>{'\u2713'}</span>}
              </span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: sel ? 800 : 600, color: sel ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}>{g.name}</span>
            </button>
          );
        })}
        {onAdd && (
          <button onClick={onAdd} aria-label="Create a group"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', WebkitAppearance: 'none', flexShrink: 0 }}>
            <span style={{ height: 34, minWidth: 48, borderRadius: 999, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed color-mix(in oklch, var(--ink-3) 55%, transparent)', color: 'var(--ink-2)', fontSize: 18, fontWeight: 600, lineHeight: 1 }}>+</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>New</span>
          </button>
        )}
      </div>
    );
  }

  // ── one group card — fills the view, snaps into place ──
  function GroupCard({ g, vh, nextName }) {
    const D = window.DUELS;
    const [day, setDay] = useState(0);
    const [mg, setMg] = useState(false);
    const [mgClosing, setMgClosing] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const closeMg = () => { if (mgClosing) return; setMgClosing(true); setTimeout(() => { setMg(false); setMgClosing(false); setConfirmLeave(false); }, 230); };
    const days = D.groupDays(g.id);
    const d = days[day];
    const nInvited = g.members.filter((m) => m.pending).length;
    const addable = D.members().filter((f) => !g.members.some((m) => m.id === f.id));
    const prompt = (s, fs) => (
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: fs, lineHeight: 1.12, letterSpacing: -0.6, textWrap: 'pretty' }}>{s}</div>
    );
    const header = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontWeight: 800, fontSize: 14.5 }}>{g.name}</span>
        {nInvited > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>{nInvited} invited</span>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <GDCluster members={g.members} size={22}></GDCluster>
          <button aria-label={'Manage ' + g.name} onClick={() => setMg(true)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 17, fontWeight: 800, padding: '0 3px', lineHeight: 1, WebkitAppearance: 'none' }}>{'\u22ef'}</button>
        </span>
      </div>
    );
    const manageSheet = mg && document.querySelector('.app') && ReactDOM.createPortal(
      <div className={'wf-scrim' + (mgClosing ? ' is-closing' : '')} onClick={closeMg}>
        <div className="wf-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="wf-sheet-grab"></div>
          <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{g.name}</span>
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1 }}>{g.members.length + 1} members</span>
            <button onClick={closeMg} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>{'\u2715'}</button>
          </div>
          <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.members.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 11, border: LINE, borderRadius: 14, background: 'var(--surface-2)', padding: '9px 13px' }}>
                <GDAv p={m} size={30} dim={m.pending}></GDAv>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13.5 }}>{m.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{m.pending ? 'invited · waiting' : m.rel}</span>
                </span>
                <button onClick={() => D.removeGroupMember(g.id, m.id)} aria-label={'Remove ' + m.name}
                  style={{ flexShrink: 0, border: 'none', background: 'var(--surface-3)', color: 'var(--ink-2)', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 11, fontWeight: 800, WebkitAppearance: 'none' }}>{'\u2715'}</button>
              </div>
            ))}
            {addable.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 6 }}>
                <span className="kicker" style={{ marginBottom: 0 }}>Add from your circle</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {addable.map((f) => (
                    <button key={f.id} className="press" onClick={() => D.addGroupMembers(g.id, [f.id])}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, border: LINE, borderRadius: 999, background: 'var(--surface-2)', padding: '5px 13px 5px 6px', cursor: 'pointer', WebkitAppearance: 'none' }}>
                      <GDAv p={f} size={22}></GDAv>
                      <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>+ {f.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ borderTop: '0.5px solid var(--rule)', marginTop: 8, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirmLeave ? (
                <React.Fragment>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Leave {g.name}?</span>
                  <button onClick={() => { closeMg(); setTimeout(() => D.leaveGroup(g.id), 240); }} style={{ border: 'none', background: 'var(--ochre)', color: '#fff', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>Leave</button>
                  <button onClick={() => setConfirmLeave(false)} style={{ border: LINE, background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>Stay</button>
                </React.Fragment>
              ) : (
                <button onClick={() => setConfirmLeave(true)} style={{ border: 'none', background: 'none', color: 'var(--ochre)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, padding: 0, cursor: 'pointer', WebkitAppearance: 'none' }}>Leave group</button>
              )}
            </div>
          </div>
        </div>
      </div>, document.querySelector('.app'));

    let body;
    if (day > 0) {
      // an earlier day, browsed via the dots — full reveal
      const gp = D.groupPicks(g.id, day);
      body = (
        <div style={col(12)} key={'past' + day}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="kicker" style={{ marginBottom: 0 }}>{d.label} {'\u00b7'} revealed</span>
            <button onClick={() => setDay(0)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>{'\u2039'} today</button>
          </div>
          {prompt(d.prompt, 22)}
          <GDReveal gid={g.id} dayIdx={day}></GDReveal>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
            {gp.mine === gp.majority ? 'You were with the majority.' : 'You went your own way.'}
          </div>
        </div>
      );
    } else {
      const mine = D.myGroup(g.id, 0);
      const answered = mine != null;
      const inT = D.groupInToday(g.id);
      const inCount = inT.done.length + (answered ? 1 : 0);
      body = answered ? (
        <div style={{ ...col(14), animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' }} key="done">
          {prompt(d.prompt, 24)}
          <div style={{ display: 'flex' }}>
            <span style={{ background: ACC, color: '#fff', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, padding: '9px 18px', borderRadius: 999, boxShadow: 'var(--shadow-card)', animation: 'chipPop .4s cubic-bezier(0.2,0.8,0.2,1) .08s both' }}>{d.options[mine]}</span>
          </div>
          <div style={{ ...col(11), borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 20%)', padding: '16px 0 2px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              {g.members.map((p) => <GDAv key={p.id} p={p} size={30} dim={!inT.done.includes(p.id)}></GDAv>)}
              <YouChip size={30}></YouChip>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
              {nextName ? 'Reveals tomorrow \u00b7 swipe down for ' + nextName : 'Reveals tomorrow'}
            </div>
          </div>
        </div>
      ) : (
        <div style={col(12)} key="ask">
          {days[1] && (
            <div style={{ ...col(7), marginBottom: 4 }}>
              <span className="kicker" style={{ marginBottom: 0 }}>Yesterday {'\u00b7'} revealed</span>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{days[1].prompt}</div>
              <GDReveal gid={g.id} dayIdx={1}></GDReveal>
            </div>
          )}
          {prompt(d.prompt, 25)}
          <div style={col(9)}>
            {d.options.map((o, i) => {
              const mem = d.kind === 'pick' ? g.members.find((p) => p.name.split(' ')[0] === o) : null;
              return (
                <button key={o} className="press" onClick={() => D.answerGroup(g.id, i)} style={{
                  background: 'var(--surface-2)', border: LINE, borderRadius: 16,
                  boxShadow: 'var(--shadow-card)', padding: '13px 15px', gap: 10,
                  display: 'flex', alignItems: 'center', cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none',
                }}>
                  {d.kind === 'pick' && (mem ? <GDAv p={mem} size={26}></GDAv> : <YouChip size={26}></YouChip>)}
                  <span style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--ink)' }}>{o}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // day dots — oldest left, today right; tap to browse this group's history
    const dots = (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        {days.map((q) => q.idx).reverse().map((i) => {
          const done = i > 0 || D.groupDone(g.id);
          const cur = i === day;
          return (
            <button key={i} onClick={() => setDay(i)} title={days[i].prompt}
              aria-label={days[i].label + ' — ' + (done ? 'answered' : 'not answered')}
              aria-current={cur ? 'true' : undefined}
              style={{ width: 22, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppearance: 'none' }}>
              <span style={{
                width: cur ? 18 : 6, height: 6, borderRadius: 999,
                background: cur ? ACC : done ? 'color-mix(in oklch, ' + ACC + ' 45%, var(--surface-3))' : 'color-mix(in oklch, var(--ink-3) 30%, transparent)',
                transition: 'width .25s ease, background .2s ease',
              }}></span>
            </button>
          );
        })}
      </div>
    );

    return (
      <div data-group-card={g.id} style={{
        minHeight: Math.max(Math.round((vh || 540) * 0.66), 330), boxSizing: 'border-box',
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
        display: 'flex', flexDirection: 'column', gap: 12,
        border: LINE, borderRadius: 18, background: 'var(--surface-2)',
        backgroundImage: 'radial-gradient(120% 80% at 50% -25%, color-mix(in oklch, ' + ACC + ' 6%, transparent), transparent 62%)',
        boxShadow: 'var(--shadow-card)', padding: '16px 15px',
      }}>
        {header}
        <div aria-hidden="true" style={{ flex: '0.8 1 0' }}></div>
        {body}
        <div aria-hidden="true" style={{ flex: '1 1 0' }}></div>
        {days.length > 1 && dots}
        {manageSheet}
      </div>
    );
  }

  function GroupDailyBody() {
    const D = window.DUELS;
    const [, bump] = useReducer((x) => x + 1, 0);
    useEffect(() => D.subscribe(bump), []);
    const gs = D.groups();
    // pending first, frozen at mount — answering must not reshuffle the stack
    const orderRef = useRef(null);
    if (!orderRef.current) orderRef.current = [...gs].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).map((x) => x.id);
    // groups created after mount append at the end — nothing reshuffles
    const ordered = orderRef.current.map((id) => gs.find((x) => x.id === id)).filter(Boolean)
      .concat(gs.filter((x) => !orderRef.current.includes(x.id)));
    const [addOpen, setAddOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [gname, setGname] = useState('');
    const [sel, setSel] = useState([]);
    const closeAdd = () => { if (closing) return; setClosing(true); setTimeout(() => { setAddOpen(false); setClosing(false); setGname(''); setSel([]); }, 230); };
    const friends = D.members();
    const toggleSel = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.concat(id)));
    const canCreate = gname.trim().length > 0 && sel.length >= 2;
    const [cur, setCur] = useState(ordered[0] && ordered[0].id);
    const [vh, setVh] = useState(0);
    const rootRef = useRef(null);
    const railRef = useRef(null);
    const scRef = useRef(null);

    // snap on the tab scroller while mounted + a scroll-spy for the rail
    useEffect(() => {
      const el = rootRef.current; if (!el) return;
      let sc = el.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      scRef.current = sc;
      if (!sc) return;
      sc.style.scrollSnapType = 'y proximity';
      const railH = railRef.current ? railRef.current.offsetHeight : 80;
      sc.style.scrollPaddingTop = (railH + 14) + 'px';
      setVh(sc.clientHeight - railH);
      const onScroll = () => {
        const st = sc.getBoundingClientRect().top + railH;
        let best = null, bd = Infinity;
        el.querySelectorAll('[data-group-card]').forEach((c) => {
          const d = Math.abs(c.getBoundingClientRect().top - st - 80);
          if (d < bd) { bd = d; best = c; }
        });
        if (best) setCur(best.getAttribute('data-group-card'));
      };
      sc.addEventListener('scroll', onScroll, { passive: true });
      return () => { sc.removeEventListener('scroll', onScroll); sc.style.scrollSnapType = ''; sc.style.scrollPaddingTop = ''; };
    }, []);

    const jump = (gid) => {
      const sc = scRef.current, el = rootRef.current; if (!sc || !el) return;
      const card = el.querySelector('[data-group-card="' + gid + '"]'); if (!card) return;
      const railH = railRef.current ? railRef.current.offsetHeight : 80;
      sc.scrollTo({ top: card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH - 14, behavior: 'smooth' });
    };

    const nLeft = ordered.filter((g) => !g.done).length;
    return (
      <div ref={rootRef} style={col(10)}>
        <div style={{ display: 'flex', alignItems: 'baseline', padding: '0 2px', scrollSnapAlign: 'start' }}>
          <span className="kicker" style={{ marginBottom: 0 }}>Your groups</span>
          {nLeft > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>{nLeft} to play</span>}
        </div>
        <div ref={railRef} style={{ position: 'sticky', top: 0, zIndex: 6, margin: '-1px -16px 0', padding: '1px 10px 0', background: 'var(--surface-a, var(--surface))', borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' }}>
          <GroupRail gs={ordered} cur={cur} onPick={jump} onAdd={() => setAddOpen(true)}></GroupRail>
        </div>
        <div style={col(10)}>
          {ordered.map((g, i) => {
            const next = ordered.slice(i + 1).find((x) => !x.done);
            return <GroupCard key={g.id} g={g} vh={vh} nextName={next ? next.name : null}></GroupCard>;
          })}
        </div>
        {addOpen && document.querySelector('.app') && ReactDOM.createPortal(
          <div className={'wf-scrim' + (closing ? ' is-closing' : '')} onClick={closeAdd}>
            <div className="wf-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="wf-sheet-grab"></div>
              <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>New group</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1 }}>one question a day, revealed with names</span>
                <button onClick={closeAdd} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>{'\u2715'}</button>
              </div>
              <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="Group name" maxLength={24} autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', border: LINE, borderRadius: 13, background: 'var(--surface-2)', padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15.5, color: 'var(--ink)', outline: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="kicker" style={{ marginBottom: 0 }}>Who{'\u2019'}s in {'\u00b7'} pick at least 2</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {friends.map((f) => {
                      const on = sel.includes(f.id);
                      return (
                        <button key={f.id} className="press" onClick={() => toggleSel(f.id)} aria-pressed={on}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '5px 13px 5px 6px', cursor: 'pointer', WebkitAppearance: 'none',
                            border: on ? `1.5px solid ${ACC}` : LINE, background: on ? `color-mix(in oklch, ${ACC} 12%, var(--surface-2))` : 'var(--surface-2)' }}>
                          <GDAv p={f} size={22}></GDAv>
                          <span style={{ fontFamily: 'var(--sans)', fontWeight: on ? 800 : 700, fontSize: 12.5, color: 'var(--ink)' }}>{f.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button className="press" disabled={!canCreate}
                  onClick={() => { const gid = D.createGroup(gname, sel); closeAdd(); setTimeout(() => jump(gid), 300); }}
                  style={{ border: 'none', borderRadius: 999, padding: '12px 20px', cursor: canCreate ? 'pointer' : 'default', WebkitAppearance: 'none',
                    fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5,
                    background: canCreate ? 'var(--ink)' : 'var(--surface-3)', color: canCreate ? 'var(--surface)' : 'var(--ink-3)', transition: 'background .15s, color .15s' }}>
                  {canCreate ? 'Create · invites go out now' : sel.length < 2 ? 'Pick at least 2 people' : 'Name your group'}
                </button>
              </div>
            </div>
          </div>, document.querySelector('.app'))}
      </div>
    );
  }

  Object.assign(window, { GroupDailyBody, GDAv });
})();
