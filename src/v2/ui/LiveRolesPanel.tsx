// The profile's Roles tab (D204) — the role you play in a 1v1 and the
// role you play in a group, each read as an instrument rather than as a
// scoreboard.
//
// Two instruments, one per setting, opening with the AVERAGE across your
// settings and then listing every setting one row deep — because a role
// is only interesting next to the other roles you play. The same rose,
// the same archetype matcher and the same nearby-type language every
// other result card uses; nothing new is invented for it. A setting
// still under its floor is listed too, as a thin row with its count
// ("1 of 3 days both guessed") — the prototype's shape, restored after
// this panel first shipped without it and a below-floor duel was simply
// invisible while the average silently excluded it.
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
import { blendRoles, duoRole, duoRoleDays, groupRole, groupRoleDays, MIN_DUO, MIN_GROUP, type RoleResult } from "../data/roles";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { matchArchetype } from "../spec/archetype-data.js";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { RoseMini, TestRose } from "../spec/result-rose.jsx";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { TypeMark } from "../spec/type-marks.jsx";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { ExplainBtn, ExplainSheet } from "../spec/explain-sheet.jsx";

interface Room { id: string; mode?: string; name?: string; memberUids?: string[]; memberNames?: Record<string, string> }
interface Setting { key: string; label: string; res: RoleResult }
/** A setting still under its floor — listed with how far it has got
 * (the prototype's ThinRow), never silently missing from the panel. */
interface ThinSetting { key: string; label: string; note: string }

/** The matcher, imported since the archetype module left the bridge
 * (D253) — the untyped .js export, given its shape at this one seam. */
function typeOf(kind: string, dims: { id: string; value: number }[]): { name: string; line: string } | null {
  const m = matchArchetype as (
    k: string, d: unknown,
  ) => { list: { name: string; line: string }[]; idx: number } | null;
  const hit = m(kind, dims);
  return hit ? hit.list[hit.idx] : null;
}

const firstName = (n: string): string => String(n || "").split(" ")[0];

// The sheet's dim list when a section has no reading yet — id + label only,
// mirroring the instrument in data/roles.ts (a live section hands the sheet
// its real blended dims instead, so these are never the preferred source).
const FALLBACK_DIMS: Record<"duo" | "group", { id: string; label: string }[]> = {
  duo: [
    { id: "read", label: "Insight" },
    { id: "seen", label: "Legibility" },
    { id: "like", label: "Likeness" },
    { id: "steady", label: "Steadiness" },
  ],
  group: [
    { id: "own", label: "Independence" },
    { id: "pull", label: "Centrality" },
    { id: "settle", label: "Steadiness" },
  ],
};

export default function LiveRolesPanel(): React.ReactElement {
  const [, bump] = React.useState(0);
  const [open, setOpen] = React.useState<string | null>(null);
  // the roles' ⓘ (2026-08-24): the same sheet every test opens, keyed by
  // the instrument family — the sheet also answers per-setting keys
  // ('duo:<room>') as their family, for any caller that carries one
  const [explain, setExplain] = React.useState<"duo" | "group" | null>(null);
  const S = LIVE.social as unknown as {
    groups: (mode?: string) => Room[];
    revealHistory: (gid: string) => Record<string, unknown>[];
    loadRevealHistory?: (gid: string) => Promise<void>;
    revealHistoryLoading?: (gid: string) => boolean;
  };
  const uid = (LIVE.uid as string) || "";

  // Read fresh every render, and the EFFECT keyed on the room ids rather
  // than on the array.
  //
  // This was `React.useMemo(() => (LIVE.enabled ? S.groups() : []), [S])`,
  // and `S` is `LIVE.social` — a plain property on live.ts's module-level
  // `const LIVE` object literal, so it is the same reference forever and
  // the memo ran exactly once per mount. `rooms` froze to whatever the
  // store held at that instant, even though the panel subscribes and
  // re-renders on every notify and re-reads `revealHistory` fresh each
  // time. A circle that finished hydrating a moment after this screen
  // opened, or one joined while it was open, simply never appeared.
  //
  // The memo was there for a real reason and it is why the naive fix is
  // wrong: `S.groups()` builds a new array on every call, so an effect
  // keyed on the array itself re-runs the reveal-history loader every
  // render. The ids are the stable thing to depend on.
  const rooms = LIVE.enabled ? S.groups() : [];
  const roomIds = rooms.map((r) => r.id).join(",");

  // Rooms whose history read THREW. `revealHistory` answers [] for a
  // refusal exactly as it does for a room that has revealed nothing, so
  // without this the panel states the second about the first — and keeps
  // stating it for the life of the session, since a failed read is not
  // retried. STATE, not a ref: the notes below are drawn from it, and a
  // ref read during render is the thing react-hooks/refs refuses (it
  // refused this file's first draft).
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(() => new Set());

  React.useEffect(() => {
    if (!LIVE.enabled || !S.loadRevealHistory) return;
    let live = true;
    // Sequential rather than parallel: the store caches per room and a
    // profile tab is not a race. Firing every room at once would spike the
    // read rate on a screen the reader is still arriving at.
    void (async () => {
      // Re-read rather than closing over `rooms`, so the loop walks the
      // list this run was scheduled for.
      for (const r of (LIVE.enabled ? S.groups() : [])) {
        if (!live) return;
        // A room that refuses is NOT absent below — it is listed, with a
        // note — so the refusal is recorded and the note says so. This
        // comment claimed the opposite for as long as the catch existed.
        try {
          await S.loadRevealHistory!(r.id);
        } catch {
          // A new Set each time: the notes read this during render, so it
          // has to be a value React can see change.
          if (live) setFailed((prev) => new Set(prev).add(r.id));
        }
        if (live) bump((x) => x + 1);
      }
    })();
    const un = LIVE.subscribe?.(() => bump((x) => x + 1));
    return () => { live = false; if (un) un(); };
  }, [roomIds, S]);

  /**
   * The note for a room whose history is not a fact yet — reading, or
   * refused — or null when the room's own numbers may be stated.
   */
  const roomNote = (gid: string): string | null => {
    if (S.revealHistoryLoading?.(gid)) return "reading\u2026";
    if (failed.has(gid)) return "couldn\u2019t read this one";
    return null;
  };

  const duos: Setting[] = [];
  const duosThin: ThinSetting[] = [];
  const groups: Setting[] = [];
  const groupsThin: ThinSetting[] = [];
  for (const r of rooms) {
    const hist = S.revealHistory(r.id) || [];
    if ((r.mode || "group") === "duo") {
      const them = (r.memberUids || []).find((m) => m !== uid) || "";
      const res = them ? duoRole(hist as never[], uid, them) : null;
      // The name the duel panel itself uses: the room's own snapshot,
      // topped up by whatever the newest reveal carried.
      const revealNames = (hist[0]?.names as Record<string, string> | undefined) || {};
      const label = firstName(revealNames[them] || (r.memberNames || {})[them] || r.name || "1v1");
      if (res) duos.push({ key: r.id, label, res });
      else duosThin.push({
        key: r.id, label,
        // The floor's own unit, which is not "revealed days" (see
        // duoRoleDays): a pair can reveal five days and guess on two.
        // Four states, and two of them are not claims about the room.
        // The loader walks rooms one at a time, so a later room sits on
        // its note for a while — and it said "nothing revealed yet" the
        // whole time. The Groups stop one screen over keeps the same
        // distinction, in the same words ("Reading the days…").
        note: roomNote(r.id) || (!them || !hist.length
          ? "nothing revealed yet"
          : `${duoRoleDays(hist as never[], uid, them)} of ${MIN_DUO} days both guessed`),
      });
    } else {
      const res = groupRole(hist as never[], uid);
      if (res) groups.push({ key: r.id, label: r.name || "Group", res });
      else groupsThin.push({
        key: r.id, label: r.name || "Group",
        note: roomNote(r.id) || (!hist.length
          ? "nothing revealed yet"
          : `${groupRoleDays(hist as never[], uid)} of ${MIN_GROUP} days played`),
      });
    }
  }

  const section = (
    kind: "duo" | "group",
    title: string,
    settings: Setting[],
    thin: ThinSetting[],
    floor: number,
    empty: string,
  ) => {
    const avg = blendRoles(settings.map((s) => s.res));
    const t = avg ? typeOf(kind, avg.dims) : null;
    // The unit `RoleResult.n` is actually counted in, in the panel's own
    // words — the same two phrases the empty state and the thin rows use.
    const dayUnit = kind === "duo" ? "you both guessed" : "you played";
    // The list draws whenever there is more than one thing to put in it —
    // a second reading, or a setting still on its way. With one reading
    // and nothing else, a row would only repeat the card above it.
    const showRows = settings.length > 1 || thin.length > 0;
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
          <div className="kicker">{title}</div>
          <ExplainBtn onClick={() => setExplain(kind)} label={`What the ${kind === "duo" ? "1v1" : "group"} role measures`} />
        </div>
        {!avg && !thin.length ? (
          // The honest refusal, not an empty rose — for a section with no
          // settings at all. A setting that merely has too few days is a
          // thin row below instead: "1 of 3" says the same thing without a
          // sentence (visual > word > sentence, D182).
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
            {empty.replace("{n}", String(floor))}
          </div>
        ) : (
          <>
            {avg && (
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: showRows ? 14 : 0 }}>
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
                {/* NOT "revealed days" — that is the one thing this number is
                    not. `RoleResult.n` is the same unit the floor checks:
                    days BOTH of you guessed for a 1v1 (duoRuns drops the
                    rest), days YOU played for a group. A pair can reveal
                    eight days and guess on three, so "3 revealed days" was
                    false about a pair that revealed eight — the exact copy
                    bug roles.ts says it exists to keep out of this panel,
                    in the only line that had not been fixed for it. The
                    empty state and the thin rows already say "days you both
                    guessed" and "revealed days you played"; this now says
                    the same thing in the same words. */}
                <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)", marginTop: 4 }}>
                  {settings.length === 1
                    ? `${avg.n} ${avg.n === 1 ? "day" : "days"} ${dayUnit}`
                    : `across ${settings.length} · ${avg.n} days ${dayUnit}`}
                </div>
              </div>
            </div>
            )}
            {/* One row per setting — a role is only interesting beside the
                other roles you play, so the average never stands alone. */}
            {showRows && settings.map((s) => {
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
            {/* The settings still under the floor — a dashed ring where the
                rose will be, and how far along the count is. Omitting them
                (as this panel first shipped) made the average silently
                partial: a 4-day duel drew a card while a 2-day one simply
                did not exist on screen. */}
            {showRows && thin.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "0.5px solid color-mix(in oklch, var(--rule), transparent 35%)" }}>
                <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: "1px dashed color-mix(in oklch, var(--ink-3) 40%, transparent)" }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, letterSpacing: "-0.015em", color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                <span style={{ flexShrink: 0, fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{s.note}</span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div data-screen-label="Roles">
      {/* The sentences name the floor's real unit. "Revealed days" was
          false for a 1v1: the gate counts days BOTH of you guessed, and a
          pair can reveal five days and guess on two. */}
      {section("duo", "In 1v1s", duos, duosThin, MIN_DUO,
        "No 1v1 has {n} days you both guessed yet — the role appears once one has.")}
      {section("group", "In groups", groups, groupsThin, MIN_GROUP,
        "No group has {n} revealed days you played yet — the role appears once one has.")}
      {explain && (() => {
        const src = explain === "duo" ? duos : groups;
        const avg = blendRoles(src.map((s) => s.res));
        return (
          <ExplainSheet
            title={explain === "duo" ? "Your role in a 1v1" : "Your role in a group"}
            kicker="role" dimKey={explain}
            dims={avg ? avg.dims : FALLBACK_DIMS[explain]}
            keyRows={null}
            onClose={() => setExplain(null)} />
        );
      })()}
    </div>
  );
}
