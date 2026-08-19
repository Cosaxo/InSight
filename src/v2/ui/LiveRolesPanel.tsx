// The profile's Roles tab (D204) — the role you play in a 1v1 and the
// role you play in a group, each read as an instrument rather than as a
// scoreboard.
//
// Two instruments, one per setting, opening with the AVERAGE across your
// settings and then listing every setting one row deep — because a role
// is only interesting next to the other roles you play. The same rose,
// the same archetype matcher and the same nearby-type language every
// other result card uses; nothing new is invented for it.
//
// LAZY ON PURPOSE. `profile-overlay.jsx` is in the EAGER graph and
// `check:bundle`'s MAX_EAGER_KB had ~8 KB of headroom when this shipped,
// so this panel is reached through a React.lazy boundary — the same shape
// PulseCard uses for PulseTrends. A static import here would have moved
// the roses, the matcher call and this file's own weight onto first paint
// for a tab most opens never reach.
//
// THE READS ARE PAID ON THE TAP THAT ASKS FOR THEM. Each room's reveal
// history is up to 14 direct day-key gets (`REVEAL_HIST_DAYS`), cached by
// the store, and the duel panel already pays it for whichever room you
// open. This tab is the first surface that wants ALL of them, so it loads
// them on mount and only on mount — see docs/COSTS.md.
import React from "react";
import LIVE from "../data/live";
import { blendRoles, duoRole, groupRole, MIN_DUO, MIN_GROUP, type RoleResult } from "../data/roles";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { RoseMini, TestRose } from "../spec/result-rose.jsx";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { TypeMark } from "../spec/type-marks.jsx";

interface Room { id: string; mode?: string; name?: string; memberUids?: string[]; memberNames?: Record<string, string> }
interface Setting { key: string; label: string; res: RoleResult }

/** The matcher, through the one global the archetype module still owns. */
function typeOf(kind: string, dims: { id: string; value: number }[]): { name: string; line: string } | null {
  const m = (window as unknown as {
    IS_matchArchetype?: (k: string, d: unknown) => { list: { name: string; line: string }[]; idx: number } | null;
  }).IS_matchArchetype;
  if (!m) return null;
  const hit = m(kind, dims);
  return hit ? hit.list[hit.idx] : null;
}

const firstName = (n: string): string => String(n || "").split(" ")[0];

export default function LiveRolesPanel(): React.ReactElement {
  const [, bump] = React.useState(0);
  const [open, setOpen] = React.useState<string | null>(null);
  const S = LIVE.social as unknown as {
    groups: (mode?: string) => Room[];
    revealHistory: (gid: string) => Record<string, unknown>[];
    loadRevealHistory?: (gid: string) => Promise<void>;
  };
  const uid = (LIVE.uid as string) || "";

  const rooms = React.useMemo(() => (LIVE.enabled ? S.groups() : []), [S]);

  React.useEffect(() => {
    if (!LIVE.enabled || !S.loadRevealHistory) return;
    let live = true;
    // Sequential rather than parallel: the store caches per room and a
    // profile tab is not a race. Firing every room at once would spike the
    // read rate on a screen the reader is still arriving at.
    void (async () => {
      for (const r of rooms) {
        if (!live) return;
        try { await S.loadRevealHistory!(r.id); } catch { /* a room that refuses is simply absent below */ }
        if (live) bump((x) => x + 1);
      }
    })();
    const un = LIVE.subscribe?.(() => bump((x) => x + 1));
    return () => { live = false; if (un) un(); };
  }, [rooms, S]);

  const duos: Setting[] = [];
  const groups: Setting[] = [];
  for (const r of rooms) {
    const hist = S.revealHistory(r.id) || [];
    if ((r.mode || "group") === "duo") {
      const them = (r.memberUids || []).find((m) => m !== uid) || "";
      const res = them ? duoRole(hist as never[], uid, them) : null;
      // The name the duel panel itself uses: the room's own snapshot,
      // topped up by whatever the newest reveal carried.
      const revealNames = (hist[0]?.names as Record<string, string> | undefined) || {};
      const label = revealNames[them] || (r.memberNames || {})[them] || r.name || "1v1";
      if (res) duos.push({ key: r.id, label: firstName(label), res });
    } else {
      const res = groupRole(hist as never[], uid);
      if (res) groups.push({ key: r.id, label: r.name || "Group", res });
    }
  }

  const section = (
    kind: "duo" | "group",
    title: string,
    settings: Setting[],
    floor: number,
    empty: string,
  ) => {
    const avg = blendRoles(settings.map((s) => s.res));
    const t = avg ? typeOf(kind, avg.dims) : null;
    return (
      <div style={{ marginBottom: 22 }}>
        <div className="kicker" style={{ marginBottom: 9 }}>{title}</div>
        {!avg ? (
          // The honest refusal, not an empty rose. A role drawn from one
          // revealed day would be a coin flip with a name on it.
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
            {empty.replace("{n}", String(floor))}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: settings.length > 1 ? 14 : 0 }}>
              <TestRose testKey={kind} dims={avg.dims} animate={false} compact={true} />
              <div style={{ minWidth: 0 }}>
                {t && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <TypeMark testKey={kind} name={t.name} size={20} />
                      <span style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{t.name}</span>
                    </div>
                    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4, textWrap: "pretty" }}>{t.line}</div>
                  </>
                )}
                <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)", marginTop: 4 }}>
                  {settings.length === 1
                    ? `${avg.n} revealed ${avg.n === 1 ? "day" : "days"}`
                    : `across ${settings.length} · ${avg.n} revealed days`}
                </div>
              </div>
            </div>
            {/* One row per setting — a role is only interesting beside the
                other roles you play, so the average never stands alone. */}
            {settings.length > 1 && settings.map((s) => {
              const st = typeOf(kind, s.res.dims);
              const isOpen = open === s.key;
              return (
                <div key={s.key} style={{ borderTop: "0.5px solid color-mix(in oklch, var(--rule), transparent 35%)" }}>
                  <button className="press" onClick={() => setOpen(isOpen ? null : s.key)} aria-expanded={isOpen}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", border: "none", background: "none", cursor: "pointer", WebkitAppearance: "none", textAlign: "left" }}>
                    <RoseMini testKey={kind} dims={s.res.dims} size={34} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "var(--sans)", fontWeight: 750, fontSize: 13.5, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                      <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
                        {st ? st.name : "—"} · {s.res.n} {s.res.n === 1 ? "day" : "days"}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--ink-3)", fontSize: 13, fontWeight: 800 }}>{isOpen ? "↑" : "↓"}</span>
                  </button>
                  {isOpen && (
                    // The receipts: the plain count each score is made of.
                    <div style={{ padding: "0 0 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                      {s.res.dims.map((d) => (
                        <div key={d.id} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ width: 86, flexShrink: 0, fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>{d.label}</span>
                          <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.4 }}>{d.note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <div data-screen-label="Roles">
      {section("duo", "In 1v1s", duos, MIN_DUO,
        "No 1v1 has run {n} revealed days yet — the role appears once one has.")}
      {section("group", "In groups", groups, MIN_GROUP,
        "No group has run {n} revealed days yet — the role appears once one has.")}
    </div>
  );
}
