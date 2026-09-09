// roleField — where the role map puts everyone (D432, the owner's
// 2026-09-09 `group-role-map.jsx`, its `buildField` typed and taken off
// the demo store). Pure geometry over `roleVotes`: the members on a ring,
// each role a satellite beside whoever holds it, a shared or contested
// role placed between the two who hold it, and a short relaxation so no
// two satellites land on one another.
//
// Seeded jitter, not random: the same room draws the same map every time
// it is opened, and a map that reshuffles on every visit reads as a
// different room. The hash is the spec layer's ghash so a member's jitter
// is stable across the app.
import type { RoleVoteRow, RoleVotes } from "./groupCast";

export const FIELD_W = 360;
export const FIELD_H = 336;
const CX = 180;
const CY = 162;

export function fieldHash(s: string): number {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return ((x >>> 8) % 100000) / 100000;
}

export interface FieldMember {
  id: string;
  name: string;
  me: boolean;
  /** The seat the room has voted them into, said as its line — or null under the floor. */
  seatLine: string | null;
}

export interface RoleSat extends RoleVoteRow {
  sx: number;
  sy: number;
  /** Who this satellite hangs off — one holder, or the two who share it. */
  holderIds: string[];
  /** Drawn between two people: a tie, or a contested runner-up. */
  shared: boolean;
}

export interface FieldPerson extends FieldMember {
  x: number;
  y: number;
  a: number;
  /** Radius of the disc — grows with the roles held. */
  rr: number;
  /** Roles held alone. */
  roles: RoleSat[];
  /** Roles shared with somebody. */
  shared: RoleSat[];
  /** The line under the name when picked: the seat, else the first role. */
  top: string | null;
}

export interface RoleField {
  people: FieldPerson[];
  sats: RoleSat[];
  byId: Record<string, FieldPerson>;
}

export function buildRoleField(gid: string, rv: RoleVotes, members: readonly FieldMember[]): RoleField {
  const n = Math.max(members.length, 1);
  const ringR = n <= 3 ? 62 : 84;
  const people: FieldPerson[] = members.map((m, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (fieldHash("pa" + gid + m.id) - 0.5) * 0.22;
    const r = ringR + (fieldHash("pr" + gid + m.id) - 0.5) * 14;
    return { ...m, x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, a, rr: 14, roles: [], shared: [], top: null };
  });
  const byId: Record<string, FieldPerson> = {};
  for (const p of people) byId[p.id] = p;

  const sats: RoleSat[] = [];
  for (const role of rv.roles) {
    // Only holders who are still in the room can carry a satellite; a role
    // held by somebody who left hangs off nobody and is not drawn.
    const holders = (role.contested && role.second ? [role.holders[0], role.second] : role.holders)
      .filter((id) => !!byId[id]);
    if (!holders.length) continue;
    const shared = holders.length > 1;
    const sat: RoleSat = { ...role, sx: 0, sy: 0, holderIds: holders.slice(0, 2), shared };
    if (shared) { byId[holders[0]].shared.push(sat); byId[holders[1]].shared.push(sat); }
    else byId[holders[0]].roles.push(sat);
    sats.push(sat);
  }

  // Solo satellites orbit their holder, fanned across the outward-facing arc.
  for (const p of people) {
    const k = p.roles.length;
    const orbit = 33;
    p.roles.forEach((role, i) => {
      const spread = Math.min(Math.PI * 1.15, 0.75 * Math.max(k - 1, 1));
      const a = p.a + (k > 1 ? (i / (k - 1) - 0.5) * spread : 0);
      role.sx = p.x + Math.cos(a) * orbit;
      role.sy = p.y + Math.sin(a) * orbit;
    });
    p.top = p.seatLine || (p.roles[0] || p.shared[0] || null)?.label || null;
    p.rr = Math.min(17.5, 11.5 + (p.roles.length + p.shared.length * 0.5) * 1.7);
  }
  // Shared satellites sit between the two, nudged off the chord so two
  // shared roles between the same pair do not stack.
  let bi = 0;
  for (const sat of sats) {
    if (!sat.shared) continue;
    const a = byId[sat.holderIds[0]], b = byId[sat.holderIds[1]];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const off = (bi % 2 ? 1 : -1) * 10;
    sat.sx = mx + (-dy / len) * off;
    sat.sy = my + (dx / len) * off;
    bi += 1;
  }
  // Relax: satellites apart from each other and clear of every disc, then
  // inside the frame.
  for (let pass = 0; pass < 30; pass++) {
    for (let i = 0; i < sats.length; i++) {
      for (let j = i + 1; j < sats.length; j++) {
        const a = sats[i], b = sats[j];
        const dx = b.sx - a.sx, dy = b.sy - a.sy;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < 16) {
          const push = (16 - d) / 2;
          a.sx -= (dx / d) * push; a.sy -= (dy / d) * push;
          b.sx += (dx / d) * push; b.sy += (dy / d) * push;
        }
      }
      const s = sats[i];
      for (const p of people) {
        const dx = s.sx - p.x, dy = s.sy - p.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = p.rr + 10;
        if (d < min) { s.sx += (dx / d) * (min - d); s.sy += (dy / d) * (min - d); }
      }
      s.sx = Math.max(12, Math.min(FIELD_W - 12, s.sx));
      s.sy = Math.max(12, Math.min(FIELD_H - 26, s.sy));
    }
  }
  return { people, sats, byId };
}
