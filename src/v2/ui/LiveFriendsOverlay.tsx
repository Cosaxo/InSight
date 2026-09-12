// Your friends — the overlay of the 2026-09-12 design (VISION-2026-09-12
// §2.3, D-2026-09-12d): Requests · Suggested · Invited · Friends, and the
// remove sheet.
//
// ONE OVERLAY, TWO STORES. The demo plays the spec layer's FRIENDS
// (spec/follows.js — seeded people, a timed auto-accept standing in for
// the other person); a live build reads data/friends.ts, which folds the
// same four states off D101's follow rows. The two are held to one row
// shape here so the design is drawn once, and the difference a reader can
// see is deliberate: a demo row opens the person page, a live row does
// not — the person page is a demo surface today (derivePerson invents
// what it compares), and offering a live uid a page that would fabricate
// their profile is the D1 failure the search overlay's people section
// already refuses. The row's action is the whole row on live.
//
// EVERY LINE OF COPY IS TRUE ON LIVE, and two of the design's are not,
// so they changed: *a few streets away* would draw the presence cell (a
// D98 deny — data/friends.ts has the argument) and reads *nearby now*;
// *they'll see it soon* is true because functions/src/v2social.ts's
// onV2FollowCreated sends the push. *You'll stop comparing answers, and
// any 1v1 you have together ends. X isn't told.* is true by construction:
// unfriend deletes your row, leaves the duo room, and no push fires on a
// delete.
//
// Behind loadOverlays' await like every overlay the shell opens (the
// `friends` key in app-shell's LIVE_OVERLAYS), and a React.lazy chunk of
// its own: nothing on first paint pays for it, and the Firestore import
// data/friends.ts carries stays off the eager graph (check:bundle).
import React from "react";
import LIVE from "../data/live";
import * as F from "../data/friends";
// @ts-expect-error TS7016 — untyped spec module (the LiveWalkthrough pattern)
import { FRIENDS } from "../spec/follows.js";
// @ts-expect-error TS7016 — untyped spec module
import { IS_DATA } from "../spec/sample-data.js";
// @ts-expect-error TS7016 — untyped spec module
import { Av, Sheet, useDialog } from "../spec/primitives.jsx";
import Avatar from "./Avatar";

interface Row {
  id: string;
  name: string;
  /** The line under the name — the reason, the relation, the wait. */
  sub: string;
  /** Demo faces are drawn from initials and a hue; live ones from the uid. */
  demo?: { init: string; hue: number; person: unknown };
}
interface Lists { requests: Row[]; suggested: Row[]; invited: Row[]; friends: Row[] }

const SANS: React.CSSProperties = { fontFamily: "var(--sans)" };
const first = (n: string) => String(n || "").split(" ")[0];

// ── the demo's rows (spec/follows.js + IS_DATA) ──────────────────
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** Days since a demo person's `last` ("today", "yesterday", "2 wk", "mon"). */
function recency(last: unknown): number {
  const s = String(last || "").toLowerCase();
  if (!s) return 99;
  if (s === "today") return 0;
  if (s === "yesterday") return 1;
  let m = s.match(/(\d+)\s*wk/);
  if (m) return 7 * +m[1];
  m = s.match(/(\d+)\s*mo/);
  if (m) return 30 * +m[1];
  const d = DAYS.indexOf(s.slice(0, 3));
  if (d >= 0) { const diff = (new Date().getDay() - d + 7) % 7; return diff || 7; }
  return 50;
}
type DemoPerson = { id: string; name: string; init: string; hue: number; rel?: string; role?: string; note?: string; dist?: string; match?: number; last?: string };
const aff = (p: DemoPerson) => (p.match != null ? Math.round(p.match) + " affinity" : null);
/** The design's reason line: a note naming a friend → *through X*; a distance → the demo's own. */
function demoReason(p: DemoPerson, friends: DemoPerson[]): string {
  if (p.dist) return [p.dist, aff(p)].filter(Boolean).join(" · ");
  const txt = (p.rel || "") + " " + (p.note || "");
  const via = friends.find((f) => txt.includes(first(f.name)));
  return [via ? "through " + first(via.name) : (p.rel || p.role), aff(p)].filter(Boolean).join(" · ");
}
function demoLists(): Lists {
  const D = IS_DATA as { people?: DemoPerson[]; nearby?: DemoPerson[] };
  const people = D.people || [], nearby = D.nearby || [];
  const byId = (id: string) => people.find((p) => p.id === id) || nearby.find((p) => p.id === id);
  const row = (p: DemoPerson, sub: string): Row => ({ id: p.id, name: p.name, sub, demo: { init: p.init, hue: p.hue, person: p } });
  const friendsP = FRIENDS.list().map(byId).filter(Boolean) as DemoPerson[];
  friendsP.sort((a, b) => recency(a.last) - recency(b.last) || (b.match || 0) - (a.match || 0));
  const open = (id: string) => FRIENDS.status(id) === "none" && !FRIENDS.isDismissed(id);
  const pool = people.filter((p) => open(p.id)).concat(nearby.filter((p) => open(p.id)))
    .map((p) => ({ p, r: demoReason(p, friendsP) }))
    .sort((a, b) => (b.r.startsWith("through") ? 1 : 0) - (a.r.startsWith("through") ? 1 : 0) || (b.p.match || 0) - (a.p.match || 0));
  return {
    requests: (FRIENDS.requests().map(byId).filter(Boolean) as DemoPerson[]).map((p) => row(p, demoReason(p, friendsP))),
    suggested: pool.map(({ p, r }) => row(p, r)),
    invited: (FRIENDS.invitedList().map(byId).filter(Boolean) as DemoPerson[]).map((p) => row(p, "waiting for them to accept")),
    friends: friendsP.map((p) => row(p, [p.rel, p.last].filter(Boolean).join(" · "))),
  };
}

// ── the live rows (data/friends.ts over D101's rows) ─────────────
function liveLists(): Lists {
  const v = F.friendsView();
  const name = (uid: string) => LIVE.nameFor(uid) || "Someone";
  const like = new Map<string, number>();
  for (const k of LIVE.kindredPeople()) like.set(k.uid, Math.round(k.like.pct));
  for (const m of LIVE.circle() || []) like.set(m.uid, Math.round(m.like.pct));
  const alike = (uid: string) => (like.has(uid) ? `${like.get(uid)}% alike` : null);
  return {
    requests: v.requests.map((uid) => ({ id: uid, name: name(uid), sub: alike(uid) || "" })),
    suggested: v.suggested.map((s) => ({
      id: s.uid, name: name(s.uid),
      sub: [s.via ? "through " + first(name(s.via)) : null, s.near ? "nearby now" : null, s.like != null ? `${s.like}% alike` : null].filter(Boolean).join(" · "),
    })),
    invited: v.invited.map((uid) => ({ id: uid, name: name(uid), sub: "waiting for them to accept" })),
    friends: v.friends.map((uid) => ({ id: uid, name: name(uid), sub: alike(uid) || "" })),
  };
}

// ── pieces ──────────────────────────────────────────────────────
const pill = (kind: "primary" | "quiet" | "danger", hue?: number): React.CSSProperties => {
  const base: React.CSSProperties = { ...SANS, padding: "7px 14px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontSize: 12.5, fontWeight: 700, WebkitAppearance: "none", appearance: "none", flexShrink: 0, transition: "background 0.15s, color 0.15s" };
  if (kind === "primary") {
    const c = `oklch(0.55 0.13 ${hue == null ? 282 : hue})`;
    return { ...base, fontWeight: 800, background: c, color: "#fff", border: `0.5px solid ${c}`, boxShadow: `0 6px 14px -6px color-mix(in oklch, ${c} 50%, transparent)` };
  }
  if (kind === "danger") return { ...base, fontWeight: 800, background: "var(--ochre-ink)", color: "#fff", border: "none" };
  return { ...base, background: "var(--surface-2)", color: "var(--ink)", border: "0.5px solid var(--rule)" };
};
// 30px drawn, 44 to press (.tap44 — check:tap-targets reads the class).
const ROUND: React.CSSProperties = { width: 30, height: 30, borderRadius: "50%", border: "0.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0, WebkitAppearance: "none", appearance: "none" };

function Face({ r }: { r: Row }) {
  return r.demo ? <Av init={r.demo.init} hue={r.demo.hue} size={38} /> : <Avatar uid={r.id} name={r.name} size={38} />;
}

function FriendRow({ r, onOpen, right }: { r: Row; onOpen?: () => void; right: React.ReactNode }) {
  const body = (
    <>
      <Face r={r} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
        <span style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>{r.name}</span>
        {r.sub ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-3)", textWrap: "pretty" } as React.CSSProperties}>{r.sub}</span> : null}
      </span>
    </>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 14 }}>
      {onOpen
        ? <button className="press" onClick={onOpen} aria-label={"Open " + r.name} style={{ ...SANS, display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", WebkitAppearance: "none", appearance: "none", color: "var(--ink)" }}>{body}</button>
        : <div style={{ ...SANS, display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0 }}>{body}</div>}
      <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{right}</span>
    </div>
  );
}

function Group({ label, n, children }: { label: string; n?: number; children: React.ReactNode }) {
  return (
    <>
      <div className="search-group" style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        {label}
        {n != null && <span style={{ color: "var(--ink-3)", fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>{n}</span>}
      </div>
      {children}
    </>
  );
}

// ── the overlay ─────────────────────────────────────────────────
export default function LiveFriendsOverlay({ onClose, back, onPerson }: {
  onClose: () => void;
  /** Opened from the profile: the header's control is ←, not ✕. */
  back?: boolean;
  /** A demo row's tap — the person page. Unused on live (see the header). */
  onPerson?: (p: unknown) => void;
}) {
  const dlg = useDialog(onClose, "Your friends");
  // `demoInProd` WITH `enabled`, because `enabled` alone answers the wrong
  // question. It is false for TWO reasons (D356) — this is the demo build,
  // or this is a LIVE build whose boot has not attached yet — and only the
  // first should ever reach `demoLists()`. Without the second half, every
  // cold start on a weak signal opened *Your friends* on spec/follows.js's
  // seeded roster: invented people with working Add and Dismiss buttons and
  // lines reading "through Henrik · 64 affinity", on a real person's own
  // account, two taps from first paint (profile-overlay's friends door).
  // That is D1's "no seeded fake users, ever" pointed at the user.
  //
  // app-shell.jsx guards the overlay one door over with exactly this pair
  // (`samplePeople={!liveOn && !LIVE.demoInProd}`, measured 2026-09-11);
  // this is that reading, here. Either half means "not the demo", which is
  // right for all six uses below: on a live build that has not attached,
  // the real store is still the one to subscribe to, load from and act on
  // — it is simply empty until it lands.
  const live = LIVE.enabled || LIVE.demoInProd;
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => (live ? F.subscribeFriends(bump) : FRIENDS.subscribe(bump)), [live]);
  React.useEffect(() => (live ? LIVE.subscribe(bump) : undefined), [live]);
  React.useEffect(() => { if (live) void F.loadFriends(); }, [live]);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [closing, setClosing] = React.useState(false);
  const closeConfirm = () => { if (closing) return; setClosing(true); setTimeout(() => { setConfirm(null); setClosing(false); }, 230); };
  const [more, setMore] = React.useState(false);

  const L = live ? liveLists() : demoLists();
  const view = live ? F.friendsView() : null;
  const shown = more ? L.suggested : L.suggested.slice(0, F.SUGGEST_FIRST);
  const go = (r: Row) => { if (r.demo && onPerson) onPerson(r.demo.person); };
  const open = (r: Row) => (r.demo && onPerson ? () => go(r) : undefined);
  const act = {
    accept: (id: string) => (live ? void F.invite(id) : FRIENDS.accept(id)),
    ignore: (id: string) => (live ? F.ignore(id) : FRIENDS.ignore(id)),
    add: (id: string) => (live ? void F.invite(id) : FRIENDS.invite(id)),
    dismiss: (id: string) => (live ? F.dismiss(id) : FRIENDS.dismiss(id)),
    cancel: (id: string) => (live ? void F.cancel(id) : FRIENDS.cancel(id)),
    remove: (id: string) => (live ? void F.unfriend(id) : FRIENDS.unfriend(id)),
  };
  const hueOf = (r: Row) => (r.demo ? r.demo.hue : undefined);
  const toRemove = confirm ? [...L.friends, ...L.invited].find((r) => r.id === confirm) : null;
  const empty = !L.requests.length && !L.suggested.length && !L.invited.length && !L.friends.length;

  return (
    <div className="overlay surface-tint" data-screen-label="Friends" {...dlg} style={{ "--accent": "var(--c-people)" } as React.CSSProperties}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose} aria-label={back ? "Back" : "Close"}>{back ? "←" : "✕"}</button>
        <div className="h-title">Your <em>friends</em></div>
        <div style={{ width: 32, flexShrink: 0 }} />
      </div>
      <div className="app-body" style={{ paddingTop: 0 }}>
        <div style={{ ...SANS, marginTop: 14, fontSize: 13, lineHeight: 1.45, color: "var(--ink-2)", textWrap: "pretty" } as React.CSSProperties}>
          Your circle in the app — the people you compare answers with.
        </div>
        {view && view.failed && (
          <div role="status" style={{ ...SANS, marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1 }}>Couldn’t read who follows you.</span>
            <button className="press" onClick={() => void F.loadFriends(true)} style={pill("quiet")}>Try again</button>
          </div>
        )}
        {view && view.loading && empty && (
          <div role="status" style={{ ...SANS, marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--ink-3)" }}>Reading your friends…</div>
        )}
        {L.requests.length > 0 && (
          <Group label="Requests" n={L.requests.length}>
            {L.requests.map((r) => (
              <FriendRow key={r.id} r={r} onOpen={open(r)} right={<>
                <button className="press" style={pill("primary", hueOf(r))} onClick={() => act.accept(r.id)}>Accept</button>
                <button className="press tap44" aria-label="Ignore request" style={ROUND} onClick={() => act.ignore(r.id)}>✕</button>
              </>} />
            ))}
          </Group>
        )}
        {L.suggested.length > 0 && (
          <Group label="Suggested">
            {shown.map((r) => (
              <FriendRow key={r.id} r={r} onOpen={open(r)} right={<>
                <button className="press" style={pill("primary", hueOf(r))} onClick={() => act.add(r.id)}>Add</button>
                <button className="press tap44" aria-label="Dismiss suggestion" style={ROUND} onClick={() => act.dismiss(r.id)}>✕</button>
              </>} />
            ))}
            {L.suggested.length > F.SUGGEST_FIRST && (
              <button className="press" onClick={() => setMore((m) => !m)} style={{ ...SANS, alignSelf: "flex-start", margin: "2px 6px 0", padding: "6px 0", background: "none", border: "none", cursor: "pointer", WebkitAppearance: "none", appearance: "none", fontSize: 12.5, fontWeight: 700, color: "var(--accent-ink, var(--ink-2))" }}>
                {more ? "Show fewer" : "Show " + (L.suggested.length - F.SUGGEST_FIRST) + " more"}
              </button>
            )}
          </Group>
        )}
        {L.invited.length > 0 && (
          <Group label="Invited" n={L.invited.length}>
            {L.invited.map((r) => (
              <FriendRow key={r.id} r={r} onOpen={open(r)} right={
                <button className="press" style={pill("quiet")} onClick={() => act.cancel(r.id)}>Cancel</button>
              } />
            ))}
          </Group>
        )}
        <Group label="Friends" n={L.friends.length}>
          {L.friends.length
            ? L.friends.map((r) => (
              <FriendRow key={r.id} r={r} onOpen={open(r)} right={
                <button className="press tap44" aria-label={"Options for " + first(r.name)} style={{ ...ROUND, fontSize: 16, letterSpacing: "0.06em" }} onClick={() => setConfirm(r.id)}>⋯</button>
              } />
            ))
            : (view && (view.loading || view.failed)) ? null
              : <div style={{ ...SANS, padding: "18px 6px", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", textWrap: "pretty" } as React.CSSProperties}>No friends yet — add someone from the suggestions above or from their page.</div>}
        </Group>
      </div>
      {toRemove && (
        <RemoveSheet r={toRemove} closing={closing} onCancel={closeConfirm} onConfirm={() => { act.remove(toRemove.id); closeConfirm(); }} />
      )}
    </div>
  );
}

// The remove sheet: what removing does, said before it is done. Its two
// claims are made true by data/friends.ts's unfriend (the row and the duo
// room go) and by the server sending nothing on a delete.
function RemoveSheet({ r, closing, onCancel, onConfirm }: { r: Row; closing: boolean; onCancel: () => void; onConfirm: () => void }) {
  const name = first(r.name);
  return (
    <Sheet onClose={onCancel} closing={closing} label={"Remove " + name + "?"}>
      <div className="wf-sheet-body" style={{ display: "flex", flexDirection: "column", gap: 0, paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Face r={r} />
          <div style={{ ...SANS, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>Remove {name}?</div>
            {r.sub ? <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", marginTop: 2 }}>{r.sub}</div> : null}
          </div>
        </div>
        <div style={{ ...SANS, marginTop: 12, fontSize: 13, lineHeight: 1.45, color: "var(--ink-2)", textWrap: "pretty" } as React.CSSProperties}>
          You’ll stop comparing answers, and any 1v1 you have together ends. {name} isn’t told. You can add them again later.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="press" onClick={onCancel} style={{ ...pill("quiet"), flex: 1, padding: "13px 14px", fontSize: 14, fontWeight: 700 }}>Keep</button>
          <button className="press" onClick={onConfirm} style={{ ...pill("danger"), flex: 1, padding: "13px 14px", fontSize: 14 }}>Remove</button>
        </div>
      </div>
    </Sheet>
  );
}
