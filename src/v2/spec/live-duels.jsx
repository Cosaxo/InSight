/* eslint-disable */
// live-duels.jsx — the LIVE group/duo panel (Phase 3). Replaces the demo
// GroupDailyBody / DuoBody when window.LIVE is enabled: real groups with
// server-minted invite codes, today's question from the shared
// deterministic rotation, sealed votes, and yesterday's materialized
// reveal. This is also the v2 first-run: with no groups yet, the panel
// IS the create-or-join flow.
import React from 'react';

const LD_LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';
const LD_NAME_LS = 'insight.displayName.v1';

function ldName() {
  try { return localStorage.getItem(LD_NAME_LS) || ''; } catch (e) { return ''; }
}
function ldSaveName(n) {
  try { localStorage.setItem(LD_NAME_LS, n); } catch (e) {}
}

function LdInput({ value, onChange, placeholder, style }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ border: LD_LINE, borderRadius: 10, padding: '11px 13px', fontFamily: 'var(--sans)',
        fontSize: 14, fontWeight: 600, color: 'var(--ink)', background: 'var(--surface-2)',
        outline: 'none', minWidth: 0, width: '100%', boxSizing: 'border-box', ...style }} />
  );
}

function LdBtn({ onClick, children, primary, disabled, small }) {
  return (
    <button className="press" onClick={onClick} disabled={disabled}
      style={{ border: primary ? 'none' : LD_LINE, borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        padding: small ? '7px 14px' : '11px 20px', fontFamily: 'var(--sans)', fontWeight: 800,
        fontSize: small ? 12 : 14, WebkitAppearance: 'none', opacity: disabled ? 0.5 : 1,
        background: primary ? 'var(--accent, var(--ink))' : 'var(--surface-2)',
        color: primary ? 'var(--surface)' : 'var(--ink)' }}>{children}</button>
  );
}

// ── first-run: create or join ────────────────────────────────────
function LdOnboard({ mode }) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [me, setMe] = React.useState(ldName());
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const duo = mode === 'duo';
  const S = window.LIVE.social;
  const go = async (fn) => {
    setBusy(true); setErr(null); ldSaveName(me.trim());
    try { await fn(); } catch (e) { setErr(String((e && e.message) || e)); }
    setBusy(false);
  };
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 16px' }}>
      <div style={{ fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
        {duo ? 'Start a 1v1' : 'Start your group'}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.45 }}>
        {duo
          ? 'One question a day, both answers sealed until tomorrow — and only if you both play.'
          : 'One question a day for your circle. Answers are sealed until tomorrow, then revealed with names.'}
      </div>
      <LdInput value={me} onChange={setMe} placeholder="Your name (what friends see)" />
      <div style={{ display: 'flex', gap: 8 }}>
        <LdInput value={name} onChange={setName} placeholder={duo ? 'Name it (e.g. Mira & Leo)' : 'Group name'} />
        <LdBtn primary disabled={busy || !name.trim() || !me.trim()}
          onClick={() => go(() => S.createGroup(name.trim(), mode, me.trim()))}>Create</LdBtn>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />OR JOIN WITH A CODE<span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <LdInput value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="Invite code" style={{ fontFamily: 'var(--mono, monospace)', letterSpacing: '0.12em' }} />
        <LdBtn primary disabled={busy || code.trim().length < 6 || !me.trim()}
          onClick={() => go(() => S.joinGroup(code.trim(), me.trim()))}>Join</LdBtn>
      </div>
      {err && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'oklch(0.5 0.19 25)' }}>{err.replace(/^.*?: */, '')}</div>}
    </div>
  );
}

// ── yesterday's reveal ───────────────────────────────────────────
function LdReveal({ g, reveal }) {
  const uid = window.LIVE.uid;
  const names = { ...(g.memberNames || {}), ...(reveal.names || {}) };
  const votes = reveal.votes || {};
  // resolve the revealed question's prompt + options from the seeded bank
  const bankQ = reveal.qid ? window.LIVE.social.bankQ(reveal.qid) : null;
  const duo = g.mode === 'duo';
  const opts = (bankQ && bankQ.options && bankQ.options.length)
    ? bankQ.options
    : (g.memberUids || []).map((u) => names[u] || 'Member');
  const label = (idx) => (opts[idx] != null ? opts[idx] : 'Option ' + (idx + 1));
  const who = (u) => (u === uid ? 'you' : (names[u] || 'Someone'));
  return (
    <div style={{ borderRadius: 12, border: LD_LINE, background: 'var(--surface-2)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="kicker" style={{ marginBottom: 0 }}>Yesterday · revealed</div>
      {bankQ && <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.2 }}>{bankQ.prompt}</div>}
      {Object.keys(votes).map((u) => {
        const v = votes[u];
        const guessed = duo && typeof v.guessIdx === 'number';
        // in a duo, your read of the OTHER: did their guess about you land?
        const other = (g.memberUids || []).find((m) => m !== u);
        const called = guessed && votes[other] && v.guessIdx === votes[other].optionIdx;
        return (
          <div key={u} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13.5 }}>
            <span style={{ fontWeight: 800, minWidth: 64, textTransform: u === uid ? 'lowercase' : 'none' }}>{who(u)}</span>
            <span style={{ fontWeight: 600, color: 'var(--ink-2)', flex: 1 }}>{label(v.optionIdx)}</span>
            {guessed && (
              <span style={{ fontSize: 11.5, fontWeight: 800, color: called ? 'oklch(0.5 0.12 170)' : 'oklch(0.55 0.13 60)' }}>
                {called ? 'called it' : 'guessed ' + label(v.guessIdx)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── one group's daily card ───────────────────────────────────────
function LdGroupCard({ g }) {
  const S = window.LIVE.social;
  const uid = window.LIVE.uid;
  const duo = g.mode === 'duo';
  const q = S.todayQ(g.id);
  const mine = S.myDuelVote(g.id);
  const reveal = S.revealFor(g.id);
  const [guess, setGuess] = React.useState(null);
  const [pick, setPick] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const members = g.memberUids || [];
  const copy = () => {
    try { navigator.clipboard.writeText(g.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) {}
  };
  const submit = () => {
    if (pick == null) return;
    S.voteDuel(g.id, pick, duo && guess != null ? guess : undefined);
  };
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 17, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
        {duo && g.streak > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent, var(--ink-2))' }}>{g.streak}-day run</span>}
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>{members.length}{duo ? '/2' : ''}</span>
        <button onClick={copy} title="Copy invite code" style={{ border: LD_LINE, background: 'var(--surface-2)', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'var(--mono, monospace)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-2)', WebkitAppearance: 'none' }}>
          {copied ? 'copied ✓' : g.inviteCode}
        </button>
      </div>
      {duo && members.length < 2 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          Share the code above — the duel starts when they join.
        </div>
      )}
      {reveal && <LdReveal g={g} reveal={reveal} />}
      {q && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{q.prompt}</div>
          {mine ? (
            <div style={{ borderRadius: 12, border: LD_LINE, background: 'var(--surface-2)', padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45 }}>
              Sealed: <b style={{ color: 'var(--ink)' }}>{q.options[mine.optionIdx] != null ? q.options[mine.optionIdx] : '—'}</b>
              {' · '}{duo ? 'revealed tomorrow — if you both play.' : 'revealed with names tomorrow.'}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {q.options.map((o, i) => (
                  <button key={i} className="press" onClick={() => setPick(i)}
                    style={{ border: pick === i ? '2px solid var(--accent, var(--ink))' : LD_LINE, borderRadius: 12, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15, background: pick === i ? 'color-mix(in oklch, var(--accent, var(--ink)) 9%, var(--surface-2))' : 'var(--surface-2)', color: 'var(--ink)', WebkitAppearance: 'none' }}>
                    {o}
                  </button>
                ))}
              </div>
              {duo && members.length === 2 && pick != null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div className="kicker" style={{ marginBottom: 0 }}>And your guess — what did they pick?</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {q.options.map((o, i) => (
                      <button key={i} className="press" onClick={() => setGuess(i)}
                        style={{ border: guess === i ? '2px solid var(--accent, var(--ink))' : LD_LINE, borderRadius: 999, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: 'var(--surface-2)', color: 'var(--ink)', WebkitAppearance: 'none' }}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <LdBtn primary disabled={pick == null || (duo && members.length === 2 && guess == null)} onClick={submit}>
                {duo ? 'Seal answer + guess' : 'Seal your answer'}
              </LdBtn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LiveDuelPanel({ mode }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => window.LIVE ? window.LIVE.subscribe(() => tick((t) => t + 1)) : undefined, []);
  const S = window.LIVE && window.LIVE.social;
  if (!S) return null;
  const groups = S.groups(mode === 'duo' ? 'duo' : 'group');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 1px 20px' }}>
      {groups.map((g) => <LdGroupCard key={g.id} g={g} />)}
      <LdOnboard mode={mode} />
    </div>
  );
}

;globalThis.LiveDuelPanel = typeof LiveDuelPanel === 'undefined' ? globalThis.LiveDuelPanel : LiveDuelPanel;
