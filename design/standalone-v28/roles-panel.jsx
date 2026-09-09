// roles-panel.jsx — the profile's Roles tab. Two instruments (role-data.js): the
// role you play in a 1v1 and the role you play in a group. Each opens with the
// AVERAGE across your settings as a full result card, then lists every setting
// one row deep — mark, type, span — because a role is only interesting next to
// the other roles you play. Tap a row for that setting's own card.
(function () {
  const { useState } = React;
  const firstName = (n) => String(n || '').split(' ')[0];

  function typeOf(key, dims) {
    const arch = window.IS_matchArchetype ? window.IS_matchArchetype(key, dims) : null;
    return arch ? arch.list[arch.idx] : null;
  }

  // one setting, one line: its rose at row size, its type, how long it has run
  function RoleRow({ testKey, label, span, open, onToggle, lead }) {
    const R = (window.IS_TEST_RESULTS || {})[testKey];
    if (!R) return null;
    const t = typeOf(testKey, R.dims);
    const cfg = (window.RP_TESTS || {})[testKey];
    return (
      <div style={{ borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 35%)' }}>
        <button className="press" onClick={onToggle} aria-expanded={open} style={{
          display: 'flex', alignItems: 'center', gap: 11, width: '100%', boxSizing: 'border-box',
          border: 'none', background: 'none', padding: '9px 0', cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none',
        }}>
          {window.RoseMini ? <window.RoseMini testKey={testKey} dims={R.dims} size={38}></window.RoseMini> : null}
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {lead}
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 750, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </span>
            {t && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {window.TypeMark ? <window.TypeMark testKey={testKey} name={t.name} size={13} plate={false}></window.TypeMark> : null}
                <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: cfg ? cfg.banner : 'var(--ink-2)' }}>{t.name}</span>
              </span>
            )}
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', opacity: 0.85, whiteSpace: 'nowrap', flexShrink: 0 }}>{span}</span>
          <span aria-hidden="true" style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}>{'\u25be'}</span>
        </button>
        {open && (
          <div style={{ padding: '2px 0 12px' }}>
            <window.ResultProfileCard testKey={testKey} brief={true}></window.ResultProfileCard>
          </div>
        )}
      </div>
    );
  }

  // a setting with too little history to read — said plainly, not drawn thin
  function ThinRow({ label, note, lead }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 35%)' }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: '1px dashed color-mix(in oklch, var(--ink-3) 34%, transparent)' }}></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          {lead}
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{label}</span>
        </span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{note}</span>
      </div>
    );
  }

  function RolesPanel() {
    const [, bump] = React.useReducer((x) => x + 1, 0);
    const [openKey, setOpenKey] = useState(null);
    React.useEffect(() => (window.DUELS ? window.DUELS.subscribe(bump) : undefined), []);
    const RL = window.ROLES;
    if (!RL || !window.ResultProfileCard) return null;
    RL.sync();
    const duos = RL.duoList();
    const groups = RL.groupList();
    const toggle = (k) => setOpenKey((cur) => (cur === k ? null : k));
    const results = window.IS_TEST_RESULTS || {};

    return (
      <div>
        <window.TabSection title="In 1v1s" sub="How you play one person, averaged across every duel you have running."></window.TabSection>
        {results.duo ? (
          <window.ResultProfileCard testKey="duo" brief={true}></window.ResultProfileCard>
        ) : (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty', marginBottom: 6 }}>
            No 1v1 has run {RL.MIN_DUO} days yet {'\u2014'} the role appears once one has.
          </div>
        )}
        <div className="mmt-gwho" style={{ marginTop: 16 }}>one at a time</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {duos.map(({ p, r }) => (r ? (
            <RoleRow key={p.id} testKey={'duo:' + p.id} label={firstName(p.name)} span={r.n + ' days'}
              open={openKey === 'duo:' + p.id} onToggle={() => toggle('duo:' + p.id)}
              lead={<window.Av init={p.init} hue={p.hue} size={20}></window.Av>}></RoleRow>
          ) : (
            <ThinRow key={p.id} label={firstName(p.name)} note={p.played ? p.played + ' of ' + RL.MIN_DUO + ' days' : 'not started'}
              lead={<window.Av init={p.init} hue={p.hue} size={20}></window.Av>}></ThinRow>
          )))}
        </div>

        <window.TabSection title="In groups" sub="How you sit in a circle: with it, against it, or the one it names."></window.TabSection>
        {results.group ? (
          <window.ResultProfileCard testKey="group" brief={true}></window.ResultProfileCard>
        ) : (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty', marginBottom: 6 }}>
            No group has {RL.MIN_GROUP} revealed days yet {'\u2014'} the role appears once one has.
          </div>
        )}
        <div className="mmt-gwho" style={{ marginTop: 16 }}>one circle at a time</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {groups.map(({ g, r }) => (r ? (
            <RoleRow key={g.id} testKey={'group:' + g.id} label={g.name} span={r.n + ' days'}
              open={openKey === 'group:' + g.id} onToggle={() => toggle('group:' + g.id)}
              lead={window.GDMark ? <window.GDMark g={g} size={20}></window.GDMark> : null}></RoleRow>
          ) : (
            <ThinRow key={g.id} label={g.name} note="starts today"
              lead={window.GDMark ? <window.GDMark g={g} size={20}></window.GDMark> : null}></ThinRow>
          )))}
        </div>
      </div>
    );
  }

  Object.assign(window, { RolesPanel });
})();
