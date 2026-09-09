// LgRoleMap — the Groups stop's field: the room drawn as a cast (D435,
// the owner's 2026-09-09 `group-role-map.jsx`, ported onto real reveals).
//
// Everyone in the room on a ring; each role the room has voted somebody
// into is a satellite in its pack's colour beside its holder; a shared or
// contested role sits between the two who hold it on a dashed line. Tap a
// role and the card under the map says who voted for whom; tap a person
// and it says how the room has cast them. Nothing here is a claim the
// reveal did not already make with names attached — the geometry is
// `data/roleField.ts`, the votes are `data/groupCast.ts`, and both are
// pure over documents the viewer can read.
//
// LAZY ON PURPOSE. This is an SVG canvas with its own animation and two
// cards, reached only from the Groups stop, and the stop's body is a
// static import of the Mirror chunk. `LiveGroupsMirrorBody` loads it
// through React.lazy, the way it loads the constellation and the Compare
// lens, so the stop's numbers never wait on it.
//
// No profile door. The design's person sheet offers "profile →" through
// `NAV.openPerson`, which in a live build resolves only the demo's sample
// people — a button that promises a page and opens nothing is worse than
// no button, so the sheet ends at the roles until a live person page
// exists (request 0b's territory).
import React from "react";
import type { RoleVotes } from "../data/groupCast";
import { buildRoleField, FIELD_H, FIELD_W, type FieldMember, type FieldPerson, type RoleField, type RoleSat } from "../data/roleField";
import { DuelAv, YouChip } from "./duelMarks";
import { firstName, markHue, personInitials } from "./marks";

const packInk = (hue: number | null | undefined) => `oklch(0.605 0.118 ${hue ?? 250})`;
const satInk = (sat: RoleSat) => packInk(sat.pack ? sat.pack.hue : null);

function Face({ p, size = 26 }: { p: FieldPerson; size?: number }) {
  return p.me ? <YouChip size={size} /> : <DuelAv uid={p.id} name={p.name} size={size} />;
}

function PackChip({ pack }: { pack: { label: string; hue: number } }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
      background: `oklch(0.95 0.03 ${pack.hue})`, fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700,
      color: `oklch(0.45 0.1 ${pack.hue})`, whiteSpace: "nowrap", flexShrink: 0 }}>{pack.label}</span>
  );
}

function VoteDots({ count, ink }: { count: number; ink: string }) {
  return (
    <span aria-hidden="true" style={{ display: "flex", gap: 3.5, alignItems: "center", flexShrink: 0 }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: ink }} />
      ))}
    </span>
  );
}

// ── the vote, when a role is picked ──────────────────────────────
function RoleVoteCard({ field, role }: { field: RoleField; role: RoleSat }) {
  const rows = field.people
    .map((p) => ({ p, count: role.votes[p.id] || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  return (
    <div className="card fade-in" style={{ marginTop: 12, padding: "15px 16px" }} aria-label={`${role.label} — the vote`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--ink)" }}>{role.label}</span>
        {role.pack && <PackChip pack={role.pack} />}
      </div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-3)", marginBottom: 12 }}>
        {role.prompt}{role.round ? ` · round ${role.round}` : ""}{role.contested ? " · contested" : role.holders.length > 1 ? " · shared" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((r) => {
          const holds = role.holderIds.includes(r.p.id);
          return (
            <div key={r.p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Face p={r.p} size={24} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: holds ? 800 : 500, color: holds ? "var(--ink)" : "var(--ink-2)" }}>
                {r.p.me ? "You" : r.p.name}
              </span>
              <VoteDots count={r.count} ink={satInk(role)} />
              <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                {r.count} {r.count === 1 ? "vote" : "votes"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── the person, when one is picked ───────────────────────────────
function RoleSheetCard({ field, person, gname }: { field: RoleField; person: FieldPerson; gname: string }) {
  const all = person.roles.concat(person.shared);
  const whom = person.me ? "you" : firstName(person.name) || person.name;
  return (
    <div className="card fade-in" style={{ marginTop: 12, padding: "15px 16px" }} aria-label={`${person.me ? "You" : person.name} — the roles`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: all.length ? 13 : 0 }}>
        <Face p={person} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--ink)" }}>{person.me ? "You" : person.name}</div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 11.5, color: "var(--ink-3)", textWrap: "pretty" }}>
            {person.seatLine
              ? person.seatLine
              : all.length
                ? `how ${gname} cast ${whom}`
                : `${gname} hasn't cast ${whom} yet`}
          </div>
        </div>
      </div>
      {all.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {all.map((role) => {
            const rivalId = role.shared ? role.holderIds.find((id) => id !== person.id) : null;
            const rival = rivalId ? field.byId[rivalId] : null;
            return (
              <div key={role.key} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: satInk(role), flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role.label}</span>
                {rival && (
                  <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                    {role.contested ? "contested with " : "shared with "}{rival.me ? "you" : firstName(rival.name) || rival.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Sel = { kind: "role"; key: string } | { kind: "person"; id: string } | null;

export default function LgRoleMap({ gid, gname, rv, members }: {
  gid: string;
  gname: string;
  rv: RoleVotes;
  members: readonly FieldMember[];
}) {
  const [sel, setSel] = React.useState<Sel>(null);
  const field = React.useMemo(() => buildRoleField(gid, rv, members), [gid, rv, members]);
  const selRole = sel && sel.kind === "role" ? field.sats.find((r) => r.key === sel.key) || null : null;
  const selPerson = sel && sel.kind === "person" ? field.people.find((p) => p.id === sel.id) || null : null;
  const roleDim = (role: RoleSat): boolean => {
    if (!sel) return false;
    if (selRole) return selRole.key !== role.key;
    return !!selPerson && !role.holderIds.includes(selPerson.id);
  };
  const personDim = (p: FieldPerson): boolean => {
    if (!sel) return false;
    if (selPerson) return selPerson.id !== p.id;
    return !!selRole && !selRole.holderIds.includes(p.id);
  };
  const pickRole = (role: RoleSat) => setSel(selRole && selRole.key === role.key ? null : { kind: "role", key: role.key });
  const pickPerson = (p: FieldPerson) => setSel(selPerson && selPerson.id === p.id ? null : { kind: "person", id: p.id });
  const onKey = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };

  // The canvas fills whatever the stage gives it; the drawing is designed
  // at 360×336 and the viewBox grows vertically to keep the ring round on
  // a taller stage rather than stretching it.
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 8 && r.height > 8) setBox({ w: r.width, h: r.height });
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vbH = Math.max(FIELD_H, box ? FIELD_W * (box.h / box.w) : FIELD_H);
  const vbY = FIELD_H / 2 - vbH / 2;
  const holdersOf = (role: RoleSat) => role.holderIds.map((id) => (field.byId[id].me ? "you" : field.byId[id].name)).join(" and ");

  return (
    <div className="mf-flex" data-testid="lg-role-map">
      <div ref={wrapRef} className="mf-canvaswrap" style={{ margin: "4px -6px 0" }}>
        <svg viewBox={`0 ${vbY} ${FIELD_W} ${vbH}`} preserveAspectRatio="xMidYMid meet"
          role="group" aria-label={`${gname} as a cast — the roles the room has voted people into`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
          <defs>
            <radialGradient id={`lgWash-${gid}`} cx="50%" cy="48%" r="58%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.09" />
              <stop offset="65%" stopColor="var(--accent)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y={vbY} width={FIELD_W} height={vbH} fill={`url(#lgWash-${gid})`} style={{ animation: "lgIn 0.6s both" }} />
          {/* the threads: each satellite to each holder */}
          {field.sats.map((role) => role.holderIds.map((hid) => {
            const p = field.byId[hid];
            const on = (selRole && selRole.key === role.key) || (!!selPerson && selPerson.id === hid && !roleDim(role));
            const w = Math.min(2.6, 0.7 + (role.votes[hid] || 1) * 0.4) + (role.shared ? 0.4 : 0);
            const ink = satInk(role);
            const stroke = on ? ink : `color-mix(in oklch, ${ink} 72%, var(--rule))`;
            const op = roleDim(role) ? 0.06 : on ? 0.9 : 0.45;
            const style: React.CSSProperties = { transition: "opacity 0.25s ease, stroke 0.25s ease", animation: on && role.shared ? "lgFlow 0.8s linear infinite" : undefined };
            if (role.shared) {
              const mx = (role.sx + p.x) / 2, my = (role.sy + p.y) / 2;
              const vx = mx - FIELD_W / 2, vy = my - FIELD_H / 2 + 18, vl = Math.hypot(vx, vy) || 1;
              const cx2 = mx + (vx / vl) * 30, cy2 = my + (vy / vl) * 30;
              return <path key={role.key + hid} d={`M ${role.sx} ${role.sy} Q ${cx2} ${cy2} ${p.x} ${p.y}`} fill="none" stroke={stroke} strokeWidth={on ? w + 0.6 : w} strokeDasharray="5 4" opacity={op} style={style} />;
            }
            return <line key={role.key + hid} x1={role.sx} y1={role.sy} x2={p.x} y2={p.y} stroke={stroke} strokeWidth={on ? w + 0.6 : w} opacity={op} style={style} />;
          }))}
          {/* the roles */}
          {field.sats.map((role, i) => {
            const on = !!selRole && selRole.key === role.key;
            const d1 = ((i * 37) % 11) / 11, d2 = ((i * 53) % 7) / 7, d3 = ((i * 17) % 5) / 5;
            const ink = satInk(role);
            return (
              <g key={role.key} className="lg-sat" role="button" tabIndex={0} aria-pressed={on}
                aria-label={`${role.label} · ${holdersOf(role)}${role.contested ? " · contested" : role.shared ? " · shared" : ""}`}
                onClick={() => pickRole(role)} onKeyDown={onKey(() => pickRole(role))}
                style={{
                  cursor: "pointer", outline: "none", opacity: roleDim(role) ? 0.15 : 1, transition: "opacity 0.25s ease",
                  transformBox: "fill-box", transformOrigin: "center",
                  ["--dx" as string]: (d1 * 5 - 2.5).toFixed(1) + "px",
                  ["--dy" as string]: (d2 * 5 - 2.5).toFixed(1) + "px",
                  animation: `lgIn 0.4s ${0.05 + i * 0.03}s both, lgDrift ${(4.5 + d3 * 3).toFixed(1)}s ease-in-out ${(0.6 + d1 * 2).toFixed(1)}s infinite alternate`,
                } as React.CSSProperties}>
                <circle cx={role.sx} cy={role.sy} r="13" fill="transparent" />
                <circle cx={role.sx} cy={role.sy} r={role.shared ? 7 : 6} fill="var(--surface-2)" />
                {on && <circle cx={role.sx} cy={role.sy} r="10.5" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.7" />}
                {role.shared
                  ? <circle cx={role.sx} cy={role.sy} r="5" fill="var(--surface-2)" stroke={ink} strokeWidth="2" />
                  : <circle cx={role.sx} cy={role.sy} r="4.5" fill={ink} />}
              </g>
            );
          })}
          {/* the people */}
          {field.people.map((p, i) => {
            const on = !!selPerson && selPerson.id === p.id;
            const rr = p.rr;
            const init = p.me ? "you" : personInitials(p.name) || "·";
            return (
              <g key={p.id} role="button" tabIndex={0} aria-pressed={on}
                aria-label={p.me ? `You${p.top ? " · " + p.top : ""}` : `${p.name}${p.top ? " · " + p.top : ""}`}
                onClick={() => pickPerson(p)} onKeyDown={onKey(() => pickPerson(p))}
                style={{ cursor: "pointer", outline: "none", opacity: personDim(p) ? 0.25 : 1, transition: "opacity 0.25s ease", animation: `lgIn 0.45s ${0.08 + i * 0.05}s both` }}>
                <circle cx={p.x} cy={p.y} r={rr + 8} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={rr + 2.5} fill="var(--surface-2)" />
                {on && <circle cx={p.x} cy={p.y} r={rr + 5} fill="none" stroke="var(--accent)" strokeWidth="1.8" />}
                <circle cx={p.x} cy={p.y} r={rr} fill={p.me ? "var(--ink)" : `oklch(0.52 0.13 ${markHue(p.id)})`} />
                <text x={p.x} y={p.y + 3.6} textAnchor="middle" fontFamily="var(--sans)" fontSize={Math.min(11.5, rr * 0.72)} fontWeight="700" fill={p.me ? "var(--surface)" : "#fff"}>{init}</text>
                <text x={p.x} y={p.y + rr + 13.5} textAnchor="middle" fontFamily="var(--sans)" fontSize="10.5" fontWeight={on ? 800 : 700}
                  fill="var(--ink)" stroke="var(--surface)" strokeWidth="3" strokeLinejoin="round" style={{ paintOrder: "stroke" }}>
                  {p.me ? "You" : firstName(p.name) || p.name || "Someone"}
                </text>
                {p.top && on && (
                  <text x={p.x} y={p.y + rr + 25} textAnchor="middle" fontFamily="var(--sans)" fontSize="9.5" fontWeight="500"
                    fill="var(--ink-3)" stroke="var(--surface)" strokeWidth="3" strokeLinejoin="round" style={{ paintOrder: "stroke" }}>{p.top}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {selRole && <RoleVoteCard field={field} role={selRole} />}
      {selPerson && <RoleSheetCard field={field} person={selPerson} gname={gname} />}
    </div>
  );
}
