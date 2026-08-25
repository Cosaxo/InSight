// LiveGroupsMirrorBody — the Mirror's Groups stop, computed from REAL
// reveal history. Replaces the demo GroupsMirrorBody (sample people) when
// LIVE is enabled: the alignment ring, the answer rows and the per-member
// likeness all derive from v2_groups/{gid}/reveals/{day} docs this user
// can already read, so every number on screen is one the user could
// recompute from the reveals themselves (groupPortrait.ts holds the
// arithmetic; groupPortrait.test.ts pins it).
//
// What the demo body showed that this one deliberately does NOT: trait
// axes, compare populations and "how they see you" crowns. Those have no
// real data source — rendering them here would be the fabrication this
// replacement exists to remove. They return when something real feeds
// them, not before.
//
// Duos are excluded on purpose, not oversight: with two voters, any
// disagreement is a 1–1 tie, so "with the majority" is always true and
// the alignment ring would read 100% forever. A duo's real mirror is the
// 1v1 tab's reveal, which shows agreement directly.
//
// Born in this repo (not ported from the design prototype), so it lives
// as typed TSX. The globalThis assignment at the bottom keeps the spec
// layer's render-time lookup working unchanged.
import React from "react";
import LIVE from "../data/live";
// The rings-and-you drawing every other stop shows when it is empty (D172).
// A tiny standalone module, NOT LiveSimilarityField: this file is a static
// import in mirror-tab, and that one is the whole similarity engine.
import EmptyField from "./EmptyField";
// The stop's tab row (D190) — static like every other host's, because it IS
// the stop's navigation and a suspense gap where the tabs belong is a stop
// that looks broken.
import MirrorLensTabs from "./MirrorLensTabs";
import { useLensRowScroll } from "./lensRowScroll";
import type { LensTab } from "./lensTabs";
import { groupPortrait, MIN_SHARED, type GroupPortrait, type PortraitReveal } from "../data/groupPortrait";

// The stop's constellation (D152) — shared with Circle and the cohort
// stops, so a group's cast is arranged by the same rule as every other
// population in the Mirror. Lazy: it is an SVG canvas, and the portrait's
// numbers must not wait on it.
const LgField = React.lazy(() =>
  import("./LiveSimilarityField").then((m) => ({ default: m.PeopleField })),
);
// Compare, borrowed rather than rebuilt (D190, re-pointed at D193) — the
// same reuse Near makes (LiveRoomTabs) and for the same reason: the lens
// asks for a population and a noun, so a group reads the way a city does.
//
// LAZY IS NOT OPTIONAL HERE. This file is a STATIC import in mirror-tab, so
// a static import of the lens would put its four SVG canvases in the entry
// graph — where check:bundle leaves about a dozen kilobytes.
const GroupCompare = React.lazy(() => import("./LiveCompareLens"));

const LG_LINE = "0.5px solid var(--rule)";

/**
 * The stop's three, in the prototype's order (`group-mirror.jsx` gives the
 * demo twin exactly these, and D184's argument for ending on Compare
 * ports: the first two describe the group, the third puts you against it).
 */
const GROUP_TABS: LensTab[] = [
  { id: "answers", label: "Answers" },
  { id: "people", label: "People" },
  { id: "compare", label: "Compare" },
];

interface LiveGroup {
  id: string;
  name?: string;
  mode?: string;
  memberUids?: string[];
  memberNames?: Record<string, string>;
}

// Stable per-string hue — a rendering choice (people need consistent
// colours), not a claim about anyone. Same recipe as the spec layer's
// ghash so a member keeps one hue across the app.
function lgHash(s: string): number {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x >>> 8) % 360;
}
const lgHue = (s: string) => `oklch(0.55 0.14 ${lgHash(s)})`;

function LgMark({ name, size = 22 }: { name: string; size?: number }) {
  const init = (name || "?").trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: lgHue(name || "?"), color: "#fff", fontFamily: "var(--sans)",
      fontWeight: 800, fontSize: Math.round(size * 0.44), border: "1.5px solid var(--surface)" }}>{init}</span>
  );
}

// group identity — the alignment ring around the member cluster; sweep =
// how often you land with this group's majority, over days YOU played
function LgIdentity({ g, pct }: { g: LiveGroup; pct: number }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => { setV(0); const t = setTimeout(() => setV(pct), 80); return () => clearTimeout(t); }, [pct, g.id]);
  const S = 64, R = 28.5, C = 2 * Math.PI * R;
  const names = (g.memberUids || []).map((u) => (g.memberNames || {})[u] || "?").slice(0, 3);
  return (
    <span style={{ position: "relative", width: S, height: S, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: "absolute", inset: 0 }}>
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--surface-3)" strokeWidth="3.5"></circle>
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${Math.max(0.01, (v / 100) * C)} ${C}`} transform={`rotate(-90 ${S / 2} ${S / 2})`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.2,0.8,0.2,1)" }}></circle>
      </svg>
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {names.map((n, i) => (
          <span key={i} style={{ marginLeft: i ? -7 : 0, display: "inline-flex", zIndex: names.length - i, position: "relative" }}>
            <LgMark name={n} size={20} />
          </span>
        ))}
      </span>
    </span>
  );
}

function LgKicker({ children }: { children: React.ReactNode }) {
  return <div className="kicker" style={{ marginBottom: 0 }}>{children}</div>;
}

// What a revealed day's majority actually said. "pick" questions carry no
// bank options — their options ARE the members — so the label falls back
// to the picked member's name. Since D224 a pick vote snapshots WHO its
// index meant, and that snapshot is preferred: the index path below reads
// the CURRENT roster order, which a join or leave silently remaps for
// every historical pick day. The fallback survives for reveals older than
// D224 and for a snapshot naming someone no longer in memberNames.
function lgOptionLabel(g: LiveGroup, qid: string | null, idx: number, pickUid?: string | null): string {
  const pickName = pickUid ? (g.memberNames || {})[pickUid] : null;
  if (pickName) return pickName;
  const bankQ = qid ? (LIVE.social.bankQ(qid) as { options?: string[] } | null) : null;
  if (bankQ && bankQ.options && bankQ.options.length) return bankQ.options[idx] != null ? bankQ.options[idx] : `Option ${idx + 1}`;
  const uid = (g.memberUids || [])[idx];
  return (uid && (g.memberNames || {})[uid]) || `Member ${idx + 1}`;
}
function lgPrompt(qid: string | null): string | null {
  const bankQ = qid ? (LIVE.social.bankQ(qid) as { prompt?: string } | null) : null;
  return (bankQ && bankQ.prompt) || null;
}

/** A tab with nothing in it yet — one sentence, where the card would be. */
function LgEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.55, padding: "10px 2px" }}>
      {children}
    </div>
  );
}

// ── Answers: what the group landed on, one row per revealed day ──
function LgAnswersCard({ g, P }: { g: LiveGroup; P: GroupPortrait }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const rows = P.rows.slice(0, 7);
  // A TAB SAYS WHY IT IS EMPTY (D190). This returned null, which was right
  // while the card was one of two things stacked on the stop — a card that
  // draws nothing takes no space. Behind a tab somebody tapped, nothing at
  // all reads as a screen that broke.
  if (!rows.length) {
    return <LgEmpty>Nothing revealed yet — answers stay sealed until the morning after.</LgEmpty>;
  }
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <LgKicker>What the group landed on</LgKicker>
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>{P.days} {P.days === 1 ? "day" : "days"} revealed</span>
      </div>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column" }}>
        {rows.map((r, ri) => {
          const prompt = lgPrompt(r.qid);
          const mineLabel = r.mine != null && !r.withMajority ? lgOptionLabel(g, r.qid, r.mine, r.minePickUid) : null;
          return (
            // A real <button>, not a clickable <div>: this row expands and
            // collapses, so it is a control, and a control that only answers
            // to a mouse is one a keyboard user cannot reach at all. The
            // style block is the usual button reset — the row looks
            // identical, it just also takes focus and fires on Enter/Space.
            <button
              key={r.day}
              type="button"
              aria-expanded={open === r.day}
              onClick={() => setOpen(open === r.day ? null : r.day)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: "none", border: "none", font: "inherit", color: "inherit",
                WebkitAppearance: "none",
                padding: "11px 0", borderBottom: ri < rows.length - 1 ? LG_LINE : "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--ink)", textWrap: "pretty" }}>{lgOptionLabel(g, r.qid, r.majorityIdx, r.majorityPickUid)}</span>
                <span style={{ flexShrink: 0, fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>{r.day.slice(5)}</span>
              </div>
              {/* one dot per voter: filled = majority bloc, dark = you */}
              <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                {Array.from({ length: r.total }).map((_, j) => {
                  const inMaj = j < r.majorityN;
                  const isYou = r.mine != null && (r.withMajority ? j === r.majorityN - 1 : j === r.total - 1);
                  return <span key={j} style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                    background: isYou ? "var(--ink)" : inMaj ? "color-mix(in oklch, var(--accent) 75%, var(--surface))" : "var(--surface)",
                    border: isYou ? "1.5px solid var(--surface)" : inMaj ? "none" : "1.2px solid var(--ink-3)",
                    boxShadow: isYou ? "0 0 0 0.5px var(--rule)" : "none" }}></span>;
                })}
              </div>
              {open === r.day && (
                <div style={{ marginTop: 7, fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-3)", textWrap: "pretty" }}>
                  {prompt || "—"}{r.mine == null ? " — you sat this one out" : mineLabel ? ` — you picked ${mineLabel}` : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── People: how close each member runs to you, from shared days ──
function LgPeopleCard({ g, P }: { g: LiveGroup; P: GroupPortrait }) {
  const names = g.memberNames || {};
  if (!P.people.length) {
    return (
      <LgEmpty>
        {(g.memberUids || []).length > 1
          ? <>Places are taken from the first shared reveal.</>
          : <>Add someone from the daily tab and they appear here.</>}
      </LgEmpty>
    );
  }
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <LgKicker>Who runs closest to you</LgKicker>
        <span style={{ fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>same pick, same day</span>
      </div>
      {/* The cast, arranged (D152) — the Mirror's one grammar, which this
          stop had in the prototype and shipped live as bars alone. Only
          members with a shared day are placed: a radius for someone you
          have never played the same day as would be a position invented
          out of nothing, and the rows below carry them regardless. */}
      <React.Suspense fallback={null}>
        <LgField
          people={P.people.filter((p) => p.shared > 0).map((p) => ({
            id: p.uid, label: names[p.uid] || "", match: p.pct,
          }))}
          caption="closer to you = agreed more often"
          emptyLine={<>Places are taken from the first shared reveal.</>}
        />
      </React.Suspense>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 11 }}>
        {P.people.map((p) => {
          const name = names[p.uid] || "Member";
          const isTwin = P.twin && p.uid === P.twin.uid;
          const isCon = P.contrarian && p.uid === P.contrarian.uid;
          const thin = p.shared < MIN_SHARED;
          return (
            <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LgMark name={name} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                  {isTwin && <span style={{ fontFamily: "var(--sans)", fontSize: 10, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" }}>most like you</span>}
                  {isCon && <span style={{ fontFamily: "var(--sans)", fontSize: 10, fontWeight: 700, color: "var(--ink-3)", whiteSpace: "nowrap" }}>breaks ranks</span>}
                </div>
                <div style={{ marginTop: 4, height: 6, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 999, background: "var(--accent)", opacity: thin ? 0.35 : 0.75 }}></div>
                </div>
              </div>
              <span style={{ flexShrink: 0, textAlign: "right", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 800, color: "var(--ink-2)" }}>
                {p.agree}/{p.shared}
                <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)" }}>{p.shared === 1 ? "shared day" : "shared days"}</div>
              </span>
            </div>
          );
        })}
      </div>
      {P.people.some((p) => p.shared < MIN_SHARED) && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: LG_LINE, fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.02em" }}>
          Faint bars have under {MIN_SHARED} shared days — too few to mean much yet.
        </div>
      )}
    </div>
  );
}

function LiveGroupsMirrorBody() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  const S = LIVE.social;
  const groups = (LIVE.enabled ? S.groups("group") : []) as LiveGroup[];
  const [gid, setGid] = React.useState<string | null>(null);
  const g = groups.find((x) => x.id === gid) || groups[0] || null;
  // the history fetch is on-demand and idempotent — ≤13 doc reads per
  // group per session, only once this stop is actually open
  React.useEffect(() => {
    if (g) void S.loadRevealHistory(g.id);
  }, [g && g.id]); // eslint-disable-line react-hooks/exhaustive-deps -- S is a module-level singleton
  // Closed, like every other stop (D155/D190).
  const [tab, setTab] = React.useState("");
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  useLensRowScroll(tab, rowRef);

  if (!LIVE.enabled) return null;

  const reveals = g ? (S.revealHistory(g.id) as unknown as PortraitReveal[]) : [];
  const P = g ? groupPortrait(reveals, LIVE.uid) : null;

  return (
    <div className="mf-stage" data-screen-label="Mirror — groups (live)" style={{
      // The frame every other live Mirror stop wears since D188: 16px of
      // inset, and NO bottom padding, so `marginTop: auto` on the row puts
      // it against the bottom of the content box and `.app-body`'s own
      // padding is the whole gap to the app's tab bar. `.mf-stage` supplies
      // the filling column.
      padding: "4px 16px 0",
    }}>
      {g && P ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 2px 0" }}>
            <LgIdentity key={g.id} g={g} pct={P.alignPct} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--sans)", fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
              <div style={{ marginTop: 2, fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>
                {P.daysPlayed ? `aligned with you · ${P.meWithMaj} of ${P.daysPlayed} days` : "aligned with you"}
              </div>
            </div>
          </div>
          {groups.length > 1 && (
            <div className="h-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 2px 2px" }}>
              {groups.map((x) => {
                const on = x.id === g.id;
                return (
                  <button key={x.id} className="press" onClick={() => setGid(x.id)} aria-pressed={on} style={{
                    display: "flex", alignItems: "center", gap: 8, flexShrink: 0, cursor: "pointer",
                    padding: "6px 13px", borderRadius: 999, WebkitAppearance: "none",
                    background: on ? "color-mix(in oklch, var(--accent) 10%, var(--surface-2))" : "var(--surface-2)",
                    border: on ? "1.5px solid color-mix(in oklch, var(--accent) 55%, transparent)" : LG_LINE,
                    boxShadow: "var(--shadow-card)",
                    fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 800 : 600,
                    color: on ? "var(--ink)" : "var(--ink-2)", whiteSpace: "nowrap" }}>{x.name}</button>
                );
              })}
            </div>
          )}
          {/* The stop's own state, above the row rather than inside a tab:
              "nothing has been revealed yet" is true of the whole group,
              not of one reading of it. */}
          {P.days === 0 && (
            <div className="card" style={{ marginTop: 14, padding: "16px 15px" }}>
              <div style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.45 }}>
                Nothing revealed yet — answers stay sealed until the morning after.
              </div>
            </div>
          )}
        </>
      ) : (
        // The FIELD, not a card of prose (D172). This and Circle were the
        // last two stops answering an empty account with a paragraph while
        // every other one drew its rings — and they are the two a new
        // account meets first.
        //
        // The BUTTON stays. Creating a group is not something the stop can
        // fill by itself the way City fills as strangers answer, so this is
        // the only route to it and removing it would trade wordiness for a
        // dead end. The sentence around it is what shrank.
        // goNav, not goTab, and EmptyField owns that choice now: goTab("track")
        // restores whatever daily scope was last open, so a user arriving from
        // the 1v1 tab landed back on 1v1 — a button that promises a group and
        // delivers a duel. The nav key pins the mode.
        <EmptyField action={{ label: "Start a group →", nav: "track:group" }}>
          One question a day, revealed with names the morning after.
        </EmptyField>
      )}

      {/* The row, where every other stop's row is (D190) — including with
          no group at all, which is the state a new account meets. A stop
          whose tab bar appears only once it has data reads as a stop that
          was never finished. */}
      <div ref={rowRef} style={{ marginTop: "auto", paddingTop: 16 }}>
        <MirrorLensTabs tabs={GROUP_TABS} open={tab}
          onOpen={(id) => setTab(id === tab ? "" : id)} />
      </div>

      {!!tab && (
        <div className="fade-in" role="tabpanel" style={{ paddingTop: 14 }}
          aria-label={(GROUP_TABS.find((t) => t.id === tab) || { label: "" }).label}>
          {!g || !P ? (
            <LgEmpty>Start a group and this fills in from the first reveal.</LgEmpty>
          ) : tab === "people" ? (
            <LgPeopleCard g={g} P={P} />
          ) : tab === "compare" ? (
            <React.Suspense fallback={null}>
              {/* The group's own name is the noun — the lens prints it in
                  "You ↔ Book Club".

                  PEOPLE, not counts, and it is the one population that
                  has no choice (D193). A group's history is its reveals,
                  which are the group's own questions — it holds no
                  answers to the test bank for a cell fold to read. What
                  it does have is members whose completed instruments are
                  public (D98) and cached beside their names, so its side
                  is their mean, over the count the card prints. */}
              {/* WITHOUT YOU. The lens prints "You ↔ {group}", so the
                  right-hand side is the group MINUS the viewer — passing the
                  whole membership compared you with a population you are
                  inside, which drags the gap toward zero and, in a group
                  where nobody else has finished a test, makes it exactly
                  zero: "You ↔ The Crew · 100% aligned · 1 of 3 have taken
                  one", and "You ↔ Just Me · 100% aligned" for a group of
                  one. It also spent a profile read on the viewer.

                  Every sibling population already excludes the viewer:
                  Circle folds circleSplit over members only, and the room
                  the Near lens is handed has the caller removed server-side
                  (v2social.ts, "The caller is not in their own room"). The
                  People tab in this same file drops you too. */}
              <GroupCompare
                pop={{ basis: "people", uids: (g.memberUids || []).filter((u) => u !== LIVE.uid) }}
                whom={g.name || "this group"}
                emptyThem={<>Nobody here has finished a test yet.</>} />
            </React.Suspense>
          ) : (
            <LgAnswersCard g={g} P={P} />
          )}
        </div>
      )}
    </div>
  );
}

export default LiveGroupsMirrorBody;
