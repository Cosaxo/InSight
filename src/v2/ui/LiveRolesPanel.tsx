// The profile's Roles tab (D204) — what the people around you make you,
// read as an instrument in two settings (D437, the owner's 2026-09-09
// design): what you are to each person in a 1v1, and your seat in each
// room.
//
// Two instruments, one per setting, opening with the AVERAGE across your
// settings and then listing every setting one row deep — because a role
// is only interesting next to the other roles you play. The same rose,
// the same archetype matcher and the same nearby-type language every
// other result card uses; nothing new is invented for it. A setting
// still under its floor is listed too, as a thin row with its count in
// the floor's own unit ("1 of 3 cast rounds", "1 of 2 votes") — never
// silently missing from the average.
//
// LAZY ON PURPOSE. `profile-overlay.jsx` is in the EAGER graph and
// `check:bundle`'s MAX_EAGER_KB had ~8 KB of headroom when this shipped,
// so this panel is reached through a React.lazy boundary — the same shape
// PulseCard uses for PulseTrends. A static import here would have moved
// the roses, the matcher call and this file's own weight onto first paint
// for a tab most opens never reach.
//
// THE READS ARE PAID ON THE TAP THAT ASKS FOR THEM. Each room's reveal
// history is ONE ordered query of at most `REVEAL_HIST_CAP` reveal
// documents (ROUNDS-PLAN §7.1), cached by the store, and the duel panel
// already pays it for whichever room you open. This tab is the first
// surface that wants ALL of them, so it loads them on mount and only on
// mount — see docs/COSTS.md.
import React from "react";
import LIVE from "../data/live";
import { AXES, SEATS, blendRoles, duoRole, duoCastCount, groupRole, groupVoteCount, MIN_DUO, MIN_GROUP, type BankLookup, type DuoRoleResult, type RoleResult } from "../data/roles";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { matchArchetype } from "../spec/archetype-data.js";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { RoseMini, TestRose } from "../spec/result-rose.jsx";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { TypeMark } from "../spec/type-marks.jsx";
// @ts-expect-error TS7016 — untyped spec module (additive export)
import { ExplainBtn, ExplainSheet } from "../spec/explain-sheet.jsx";

interface Room { id: string; mode?: string; name?: string; memberUids?: string[]; memberNames?: Record<string, string>; duoMode?: string }
interface Setting { key: string; label: string; res: RoleResult }
/** A setting still under its floor — listed with how far it has got
 * (the design's ThinRow), never silently missing from the panel. */
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
  duo: AXES.map((a) => ({ id: a.id, label: a.label })),
  group: SEATS.map((s) => ({ id: s.id, label: s.label.replace(/^the /, "") })),
};

const roundsWord = (n: number): string => `${n} ${n === 1 ? "round" : "rounds"}`;
const votesWord = (n: number): string => `${n} ${n === 1 ? "vote" : "votes"}`;

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
    bankQ?: (qid: string) => { options?: string[]; kind?: string; role?: { id: string; label: string; seat?: string }; them?: string[]; dims?: string[] } | null;
  };
  const uid = (LIVE.uid as string) || "";
  // What each round WAS, from the bank the store already holds: a cast
  // round and its them forms, a role vote and its seat. No bank — a
  // fixture, or a bank not yet fetched — and no round can be read, which
  // is the honest reading rather than a guessed one.
  const lookup: BankLookup | undefined = S.bankQ ? (qid) => S.bankQ!(qid) : undefined;

  // Read fresh every render, and the EFFECT keyed on the room ids rather
  // than on the array — `S.groups()` builds a new array on every call, so
  // an effect keyed on it would re-run the loader every render, and a
  // memo on `S` (the same reference forever) froze the list to whatever
  // the store held at mount.
  const rooms = LIVE.enabled ? S.groups() : [];
  const roomIds = rooms.map((r) => r.id).join(",");

  // Rooms whose history read THREW. `revealHistory` answers [] for a
  // refusal exactly as it does for a room that has revealed nothing, so
  // without this the panel states the second about the first. STATE, not
  // a ref: the notes below are drawn from it.
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(() => new Set());

  React.useEffect(() => {
    if (!LIVE.enabled || !S.loadRevealHistory) return;
    let live = true;
    // Sequential rather than parallel: the store caches per room and a
    // profile tab is not a race.
    void (async () => {
      for (const r of (LIVE.enabled ? S.groups() : [])) {
        if (!live) return;
        try {
          await S.loadRevealHistory!(r.id);
        } catch {
          if (live) setFailed((prev) => new Set(prev).add(r.id));
        }
        if (live) bump((x) => x + 1);
      }
    })();
    const un = LIVE.subscribe?.(() => bump((x) => x + 1));
    return () => { live = false; if (un) un(); };
  }, [roomIds, S]);

  /** The note for a room whose history is not a fact yet — reading, or
   * refused — or null when the room's own numbers may be stated. */
  const roomNote = (gid: string): string | null => {
    if (S.revealHistoryLoading?.(gid)) return "reading…";
    if (failed.has(gid)) return "couldn’t read this one";
    return null;
  };

  const duos: Array<Setting & { res: DuoRoleResult }> = [];
  const duosThin: ThinSetting[] = [];
  const groups: Setting[] = [];
  const groupsThin: ThinSetting[] = [];
  for (const r of rooms) {
    const hist = S.revealHistory(r.id) || [];
    if ((r.mode || "group") === "duo") {
      const them = (r.memberUids || []).find((m) => m !== uid) || "";
      // The name the duel panel itself uses: the room's own snapshot,
      // topped up by whatever the newest reveal carried — and NULL for the
      // cast text when neither knows one, so `castText` falls back to *your
      // friend* rather than to the row's label (the second review of #456
      // read "the one 1v1 tells first").
      const revealNames = (hist[0]?.names as Record<string, string> | undefined) || {};
      const known = firstName(revealNames[them] || (r.memberNames || {})[them] || "") || null;
      const label = known || firstName(r.name || "") || "1v1";
      const res = them ? duoRole(hist as never[], uid, them, lookup, known, r.duoMode === "romantic") : null;
      if (res) duos.push({ key: r.id, label, res });
      else {
        const casts = them ? duoCastCount(hist as never[], uid, them, lookup) : 0;
        duosThin.push({
          key: r.id, label,
          // The floor's own unit — cast rounds, which a pair reaches every
          // fourth round. Four states, and two of them are not claims
          // about the room: the loader walks rooms one at a time.
          note: roomNote(r.id) || (!them || !hist.length
            ? "nothing revealed yet"
            : casts === 0 ? "asked at round 4" : `${casts} of ${MIN_DUO} cast rounds`),
        });
      }
    } else {
      const res = groupRole(hist as never[], uid, lookup);
      if (res) groups.push({ key: r.id, label: r.name || "Group", res });
      else {
        const votes = groupVoteCount(hist as never[], uid, lookup);
        groupsThin.push({
          key: r.id, label: r.name || "Group",
          note: roomNote(r.id) || (!hist.length
            ? "nothing revealed yet"
            : votes === 0 ? "not named yet" : `${votes} of ${MIN_GROUP} votes`),
        });
      }
    }
  }
  // The receipt under the 1v1 average (the design's roles panel): of the
  // cast rounds you guessed at, how many you guessed right — a fact about
  // reading them that the instrument itself no longer carries.
  const saw = duos.reduce((a, d) => ({ right: a.right + d.res.sawIt.right, total: a.total + d.res.sawIt.total }), { right: 0, total: 0 });

  const section = (
    kind: "duo" | "group",
    title: string,
    settings: Setting[],
    thin: ThinSetting[],
    empty: string,
  ) => {
    const avg = blendRoles(settings.map((s) => s.res));
    const t = avg ? typeOf(kind, avg.dims) : null;
    const unit = (n: number) => (kind === "duo" ? `${roundsWord(n)} asked` : votesWord(n));
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
          // settings at all. A setting that merely has too few rounds is a
          // thin row below instead: "1 of 3" says the same thing without a
          // sentence (visual > word > sentence, D182).
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45, textWrap: "pretty" }}>
            {empty}
          </div>
        ) : (
          <>
            {avg && (
            <div style={{ marginBottom: showRows ? 14 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
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
                  {/* The unit `RoleResult.n` is counted in — cast rounds for a
                      1v1, votes received for a group — in the same words the
                      thin rows use. */}
                  <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)", marginTop: 4 }}>
                    {settings.length === 1 ? unit(avg.n) : `across ${settings.length} · ${unit(avg.n)}`}
                  </div>
                </div>
              </div>
              {kind === "duo" && saw.total > 0 && (
                <div style={{ marginTop: 10, fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", textWrap: "pretty" }}>
                  You guessed what they’d say you are {saw.right} of {saw.total} {saw.total === 1 ? "time" : "times"}.
                </div>
              )}
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
                        {st ? st.name : "—"} · {kind === "duo" ? roundsWord(s.res.n) : votesWord(s.res.n)}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--ink-3)", fontSize: 13, fontWeight: 800 }}>{isOpen ? "↑" : "↓"}</span>
                  </button>
                  {isOpen && (
                    // The receipts: the plain count each share is made of.
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
                rose will be, and how far along the count is. */}
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
      {section("duo", "In 1v1s", duos, duosThin,
        "Every fourth round of a 1v1 asks what the other is to you — none has got there yet.")}
      {section("group", "In groups", groups, groupsThin,
        "No room has voted you into a role yet — the seat appears once one has.")}
      {explain && (() => {
        const src = explain === "duo" ? duos : groups;
        const avg = blendRoles(src.map((s) => s.res));
        return (
          <ExplainSheet
            title={explain === "duo" ? "What you are to them" : "Your seat in the room"}
            kicker="role" dimKey={explain}
            dims={avg ? avg.dims : FALLBACK_DIMS[explain]}
            keyRows={null}
            onClose={() => setExplain(null)} />
        );
      })()}
    </div>
  );
}
