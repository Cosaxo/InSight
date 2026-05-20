import { useEffect, useState } from "react";
import { useAuth } from "../../lib/useAuth";
import { useProfile } from "../../lib/useProfile";
import { useRelations } from "../../lib/useRelations";
import { useMyRelations } from "../../lib/useMyRelations";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  checkOutgoingFriendRequest,
  declineFriendRequest,
  firebaseEnabled,
  followUser,
  sendFriendRequest,
  sendInboundImpression,
  unblockUser,
  unfollowUser,
  unfriend,
} from "../../lib/firebase";
import type { InboundImpression } from "../../types";
import { Av, Kicker } from "../shared/primitives";
import { RadarChart } from "../shared/charts";

export interface PersonForOverlay {
  // When this person is one of the user's relations, `id` is the
  // useRelations doc id. PersonOverlay uses its presence to decide
  // whether the Big Five rating editor can save back to the relation.
  id?: string;
  init: string;
  hue: number;
  name: string;
  match: number;
  role?: string;
  rel?: string;
  dist?: string;
  note?: string;
  interests?: ({ t: string; c: string } | string)[];
  faves?: Record<string, string[]>;
  // Optional real Big Five rating (set by the user in the inline
  // rating editor below). When present we drive the radar from this
  // instead of the old synthesised-from-match-score values.
  personality?: number[];
  // Optional 6-axis politics + 8-axis morals — same provenance as
  // personality. The user rates them via the editors below.
  politicalAxes?: Record<string, number>;
  morals?: Record<string, number>;
  // When this person is a real InSight user the viewer can leave
  // them an anonymous traits-only impression. The send flow only
  // shows up when both:
  //   - linkedUid is set (they have an account we can write to)
  //   - the viewer themselves is signed in
  linkedUid?: string;
}

const BIG5_LABELS = ["Open", "Cons.", "Extra.", "Agree.", "Stable"];

interface PersonOverlayProps {
  p: PersonForOverlay;
  onClose: () => void;
}

// Big Five vector order matches computeBig5 in useProfile.ts:
// [O, C, E, A, N]. The "you" side comes from profile.personality —
// the test result the user has taken on themselves.
//
// The "them" side has two paths:
//   1. p.personality is set (the user has rated this person via the
//      inline editor below) → render real numbers.
//   2. p.personality is undefined → hide the comparison; show the
//      rating editor instead so the user can fill it in.
// The synthesised "estimate from match score" path is gone — it
// was the only place left in PersonOverlay asserting numbers it
// didn't have.
export function PersonOverlay({ p, onClose }: PersonOverlayProps) {
  const { profile } = useProfile();
  const { update } = useRelations();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editingPolitics, setEditingPolitics] = useState(false);
  const [editingMorals, setEditingMorals] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  if (!p) return null;
  const big5 = profile.personality;
  const personalityReady =
    Array.isArray(big5) &&
    big5.length === 5 &&
    big5.every((n) => typeof n === "number");
  const themReady =
    Array.isArray(p.personality) &&
    p.personality.length === 5 &&
    p.personality.every((n) => typeof n === "number");
  const dims =
    personalityReady && themReady
      ? BIG5_LABELS.map((label, i) => ({
          label,
          // The N axis (index 4) is "Neuroticism". We flip both sides
          // to "Stable" so the dial reads "more = better-feeling"
          // consistently across all five axes.
          you: i === 4 ? 100 - big5![i] : big5![i],
          them: i === 4 ? 100 - p.personality![i] : p.personality![i],
        }))
      : [];
  const interests = p.interests ?? [];
  const interestLabels = interests.map((i) =>
    typeof i === "string" ? i : i.t,
  );

  const isRelation = !!p.id;
  const saveRating = async (vec: number[]) => {
    if (!p.id) return;
    await update(p.id, { personality: vec });
  };
  const savePolitics = async (vec: Record<string, number>) => {
    if (!p.id) return;
    await update(p.id, { politicalAxes: vec });
  };
  const saveMorals = async (vec: Record<string, number>) => {
    if (!p.id) return;
    await update(p.id, { morals: vec });
  };

  const themHasPolitics = !!p.politicalAxes;
  const themHasMorals = !!p.morals;
  const profileHasPolitics =
    !!profile.political && typeof profile.political.econ === "number";
  const profileHasMorals = !!profile.morals;

  // The "leave an impression" affordance only lights up when:
  //   - the viewer is signed in (we have a senderUid to write)
  //   - the target has a linkedUid (they're a real account)
  //   - Firebase is enabled (web-only build can't talk to Firestore)
  //
  // Firestore rules separately require the viewer to be in the
  // recipient's circle — if they aren't, the write fails and we
  // surface the error.
  const canSendImpression =
    firebaseEnabled && !!user && !!p.linkedUid;

  const sendImpression = async (
    traits: string[],
    context?: string,
  ): Promise<void> => {
    if (!canSendImpression || !user || !p.linkedUid) return;
    setSending(true);
    try {
      const impression: InboundImpression = {
        id: Math.random().toString(36).slice(2, 12),
        senderUid: user.uid,
        traits,
        context,
        createdAt: Date.now(),
      };
      await sendInboundImpression(p.linkedUid, impression);
      setSentFlash(true);
      setTimeout(() => setSentFlash(false), 2500);
    } catch (err) {
      console.error("[PersonOverlay] send impression failed:", err);
      alert(
        "Couldn't send the impression — usually means they haven't added you as a relation yet.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ←
        </button>
        <div className="h-title">Person</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body">
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <Av init={p.init} hue={p.hue} size={84} />
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 24,
              marginTop: 10,
              letterSpacing: "-0.01em",
            }}
          >
            {p.name}
          </div>
          <div className="kicker" style={{ marginTop: 2 }}>
            {p.role || p.rel} · {p.dist || "in your orbit"}
          </div>
          {p.note && (
            <div
              className="margin-note"
              style={{ marginTop: 12, fontSize: 16, padding: "0 20px" }}
            >
              "{p.note}"
            </div>
          )}
        </div>

        <hr className="rule-dashed" />

        {!personalityReady ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <Kicker>You vs them · five strokes</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 8, fontSize: 13, fontStyle: "italic" }}
            >
              Take the Big Five test (from "your portrait") to see how
              your strokes line up against {p.name.split(" ")[0]}'s.
            </div>
          </div>
        ) : themReady ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <Kicker>You vs them · five strokes</Kicker>
            <div style={{ marginTop: 8 }}>
              <RadarChart
                values={dims.map((d) => d.you)}
                compareValues={dims.map((d) => d.them)}
                labels={dims.map((d) => d.label)}
                color="var(--ink)"
                compareColor={`oklch(0.55 0.13 ${p.hue})`}
                size={260}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                fontFamily: "var(--mono)",
                fontSize: 9.5,
                color: "var(--ink-3)",
                letterSpacing: "0.08em",
                marginTop: 4,
              }}
            >
              <span>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    background: "var(--ink)",
                    borderRadius: 2,
                    marginRight: 5,
                  }}
                />
                YOU
              </span>
              <span>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    background: `oklch(0.55 0.13 ${p.hue})`,
                    borderRadius: 2,
                    marginRight: 5,
                  }}
                />
                {p.init}
              </span>
            </div>
            {isRelation && (
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: "var(--ink-3)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ✎ ADJUST
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 14 }}>
            <Kicker>You vs them · five strokes</Kicker>
            <div
              className="margin-note"
              style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
            >
              {isRelation
                ? `Rate ${p.name.split(" ")[0]}'s Big Five to compare against your own. Your read — adjustable any time.`
                : `${p.name.split(" ")[0]} isn't one of your relations yet. Add them and you can rate their Big Five.`}
            </div>
            {isRelation && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  marginTop: 10,
                  padding: "8px 14px",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: 99,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                }}
              >
                + RATE BIG FIVE
              </button>
            )}
          </div>
        )}

        {editing && isRelation && (
          <Big5RatingEditor
            name={p.name}
            current={p.personality}
            onCancel={() => setEditing(false)}
            onSave={async (vec) => {
              await saveRating(vec);
              setEditing(false);
            }}
          />
        )}

        <PoliticsCardForPerson
          name={p.name}
          hue={p.hue}
          isRelation={isRelation}
          profileAxes={profile.politicalAxes}
          profilePolitical={profile.political}
          themAxes={p.politicalAxes}
          profileHasPolitics={profileHasPolitics}
          themHasPolitics={themHasPolitics}
          onEdit={() => setEditingPolitics(true)}
        />

        {editingPolitics && isRelation && (
          <PoliticsRatingEditor
            name={p.name}
            current={p.politicalAxes}
            onCancel={() => setEditingPolitics(false)}
            onSave={async (vec) => {
              await savePolitics(vec);
              setEditingPolitics(false);
            }}
          />
        )}

        <MoralsCardForPerson
          name={p.name}
          isRelation={isRelation}
          profileMorals={profile.morals}
          themMorals={p.morals}
          profileHasMorals={profileHasMorals}
          themHasMorals={themHasMorals}
          onEdit={() => setEditingMorals(true)}
        />

        {editingMorals && isRelation && (
          <MoralsRatingEditor
            name={p.name}
            current={p.morals}
            onCancel={() => setEditingMorals(false)}
            onSave={async (vec) => {
              await saveMorals(vec);
              setEditingMorals(false);
            }}
          />
        )}

        {firebaseEnabled && user && p.linkedUid && (
          <RelationActionsCard
            targetUid={p.linkedUid}
            targetName={p.name}
            myUid={user.uid}
          />
        )}

        {canSendImpression && (
          <SendImpressionInline
            name={p.name}
            onSend={sendImpression}
            sending={sending}
            sentFlash={sentFlash}
          />
        )}

        {interestLabels.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Kicker>Shared margins</Kicker>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {interestLabels.map((i) => (
                <span key={i} className="pill">
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

        {p.faves && (
          <div style={{ marginTop: 18 }}>
            <Kicker>Their shelf · what they love</Kicker>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 10,
              }}
            >
              {[
                { key: "films", label: "Films", icon: "◐" },
                { key: "books", label: "Books", icon: "▢" },
                { key: "music", label: "Music", icon: "♪" },
              ].map(
                (c) =>
                  p.faves?.[c.key] &&
                  p.faves[c.key].length > 0 && (
                    <div
                      key={c.key}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--paper-2)",
                        border: "0.5px solid var(--rule)",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--ink-3)",
                          letterSpacing: "0.1em",
                          width: 48,
                        }}
                      >
                        {c.label.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: 13,
                          fontStyle: "italic",
                          flex: 1,
                        }}
                      >
                        {p.faves[c.key].join(" · ")}
                      </span>
                    </div>
                  ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Big5RatingEditor — modal sheet for rating a relation ──────
//
// Five sliders 0..100, one per Big Five axis. Each slider starts at
// the current rating if one exists, otherwise 50 (neutral). Saves
// the full vector back via the parent's onSave; cancel discards.

const BIG5_FULL = [
  { key: "O", name: "Openness", lo: "conventional", hi: "curious" },
  { key: "C", name: "Conscientiousness", lo: "flexible", hi: "ordered" },
  { key: "E", name: "Extraversion", lo: "reserved", hi: "outgoing" },
  { key: "A", name: "Agreeableness", lo: "challenging", hi: "warm" },
  { key: "N", name: "Neuroticism", lo: "stable", hi: "sensitive" },
];

function Big5RatingEditor({
  name,
  current,
  onCancel,
  onSave,
}: {
  name: string;
  current?: number[];
  onCancel: () => void;
  onSave: (vec: number[]) => Promise<void> | void;
}) {
  const init = current && current.length === 5 ? current : [50, 50, 50, 50, 50];
  const [vec, setVec] = useState<number[]>(init);
  const [saving, setSaving] = useState(false);

  const set = (idx: number, v: number) => {
    setVec((prev) => prev.map((x, i) => (i === idx ? v : x)));
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(vec);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="app-header"
        style={{
          background: "transparent",
          borderBottom: "0.5px solid rgba(255,255,255,0.15)",
        }}
      >
        <button
          className="avatar-btn"
          onClick={onCancel}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          rate · {name}
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div
          style={{
            background: "var(--paper)",
            borderRadius: 8,
            padding: 16,
            color: "var(--ink)",
          }}
        >
          <Kicker>your read — adjustable any time</Kicker>
          <div className="margin-note" style={{ marginTop: 4, fontSize: 12 }}>
            "Five strokes. Where you'd place them on each axis — your
            sense of who they are. Stays private to you."
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 14,
            }}
          >
            {BIG5_FULL.map((axis, i) => (
              <div key={axis.key}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    color: "var(--ink-3)",
                  }}
                >
                  <span>{axis.lo.toUpperCase()}</span>
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 13,
                      color: "var(--ink-2)",
                    }}
                  >
                    {axis.name}
                  </span>
                  <span>{axis.hi.toUpperCase()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={vec[i]}
                  onChange={(e) => set(i, +e.target.value)}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9.5,
                    color: "var(--ink-3)",
                    textAlign: "center",
                    marginTop: -2,
                  }}
                >
                  {vec[i]}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SendImpressionInline ───────────────────────────────────────
//
// Anonymous traits-only feedback the viewer can leave for the
// person. Pick up to N traits from a small palette, optionally a
// pre-canned context phrase, send. The receiver sees the entry
// in their ImpressionsOverlay "of you" tab — never names, never
// longhand.
//
// Display mode: collapsed CTA card by default; tapping expands to
// the picker.

const TRAIT_PALETTE = [
  "warm",
  "curious",
  "steady",
  "guarded",
  "kind",
  "sharp",
  "quiet",
  "intense",
  "easy",
  "thoughtful",
  "remote",
  "generous",
  "dry humour",
  "careful listener",
  "playful",
  "serious",
  "undefended",
  "composed",
];

const CONTEXT_OPTIONS = [
  "after a coffee",
  "a colleague review",
  "after a long walk",
  "a group dinner",
  "a near-stranger",
  "friend, days later",
];

// RelationActionsCard — the follow / befriend / status surface for
// a person who has a linkedUid. Hidden for people without a real
// account (manual contacts in the user's circle).
//
// Five states surfaced to the UI:
//   - none           → Follow + Befriend
//   - following      → Following (with Unfollow on long-press / menu)
//                      + Befriend
//   - request-out    → "Request sent" pill (with Cancel)
//   - request-in     → Accept + Decline
//   - friend         → "Friends" pill (with Unfriend in a small menu)
//   - blocked        → "Blocked" pill (with Unblock)
//
// Block is always available via a small "•••" button regardless of
// state. It tears down every active relation in one batch.
function RelationActionsCard({
  targetUid,
  targetName,
  myUid,
}: {
  targetUid: string;
  targetName: string;
  myUid: string;
}) {
  const rel = useMyRelations();
  const [requestOut, setRequestOut] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-shot check on mount: is there an outgoing friend request
  // pending? The doc lives in the target's namespace so we can't
  // subscribe to it without a dedicated read.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pending = await checkOutgoingFriendRequest(myUid, targetUid);
        if (!cancelled) setRequestOut(pending);
      } catch (err) {
        // Permission-denied happens when the target has blocked us;
        // treat that as "no outgoing request" and let the UI
        // recover.
        if (!cancelled) setRequestOut(false);
        console.warn("[RelationActionsCard] outgoing-request check failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUid, targetUid]);

  const baseStatus = rel.statusOf(targetUid);
  // Folding in the outgoing-request status (which useMyRelations
  // doesn't subscribe to, by design — it's a target-namespace doc).
  const status: "none" | "following" | "request-out" | "request-in" | "friend" | "blocked" =
    baseStatus === "none" && requestOut === true
      ? "request-out"
      : baseStatus === "following" && requestOut === true
        ? "request-out"
        : (baseStatus as "none" | "following" | "request-in" | "friend" | "blocked");

  const wrap = async (op: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await op();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[RelationActionsCard] action failed:", err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onFollow = () => wrap(() => followUser(myUid, targetUid));
  const onUnfollow = () => wrap(() => unfollowUser(myUid, targetUid));
  const onBefriend = () =>
    wrap(async () => {
      await sendFriendRequest(myUid, targetUid);
      setRequestOut(true);
    });
  const onCancelRequest = () =>
    wrap(async () => {
      await cancelFriendRequest(myUid, targetUid);
      setRequestOut(false);
    });
  const onAccept = () => wrap(() => acceptFriendRequest(myUid, targetUid));
  const onDecline = () => wrap(() => declineFriendRequest(myUid, targetUid));
  const onUnfriend = () => wrap(() => unfriend(myUid, targetUid));
  const onBlock = () =>
    wrap(async () => {
      if (!confirm(`Block ${targetName.split(" ")[0]}? They'll lose all access to your shared content and can't send impressions.`)) return;
      await blockUser(myUid, targetUid);
      setShowOverflow(false);
    });
  const onUnblock = () => wrap(() => unblockUser(myUid, targetUid));

  const pillStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 999,
    fontFamily: "var(--mono)",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: busy ? "default" : "pointer",
    border: "0.5px solid var(--rule)",
    background: "var(--paper-2)",
    color: "var(--ink)",
    opacity: busy ? 0.6 : 1,
  };
  const filledPill: React.CSSProperties = {
    ...pillStyle,
    background: "var(--ink)",
    color: "var(--paper)",
    border: "none",
  };
  const ghostPill: React.CSSProperties = {
    ...pillStyle,
    background: "transparent",
    color: "var(--ink-3)",
    border: "0.5px dashed var(--rule)",
  };

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        padding: 14,
        borderLeft: "3px solid var(--sage)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Kicker>relation</Kicker>
        <button
          type="button"
          onClick={() => setShowOverflow((s) => !s)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 14,
            color: "var(--ink-3)",
            padding: "0 4px",
          }}
          aria-label="more actions"
        >
          •••
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {status === "blocked" && (
          <>
            <span style={ghostPill}>blocked</span>
            <button type="button" onClick={onUnblock} disabled={busy} style={pillStyle}>
              unblock
            </button>
          </>
        )}

        {status === "friend" && (
          <>
            <span style={filledPill}>friends</span>
            <button type="button" onClick={onUnfriend} disabled={busy} style={pillStyle}>
              unfriend
            </button>
          </>
        )}

        {status === "request-in" && (
          <>
            <button type="button" onClick={onAccept} disabled={busy} style={filledPill}>
              accept
            </button>
            <button type="button" onClick={onDecline} disabled={busy} style={pillStyle}>
              decline
            </button>
          </>
        )}

        {status === "request-out" && (
          <>
            <span style={ghostPill}>request sent</span>
            <button type="button" onClick={onCancelRequest} disabled={busy} style={pillStyle}>
              cancel
            </button>
          </>
        )}

        {status === "following" && (
          <>
            <button type="button" onClick={onUnfollow} disabled={busy} style={pillStyle}>
              following
            </button>
            <button type="button" onClick={onBefriend} disabled={busy || requestOut == null} style={filledPill}>
              befriend
            </button>
          </>
        )}

        {status === "none" && (
          <>
            <button type="button" onClick={onFollow} disabled={busy} style={pillStyle}>
              follow
            </button>
            <button type="button" onClick={onBefriend} disabled={busy || requestOut == null} style={filledPill}>
              befriend
            </button>
          </>
        )}
      </div>

      {showOverflow && status !== "blocked" && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={onBlock}
            disabled={busy}
            style={{
              ...pillStyle,
              color: "oklch(0.55 0.16 12)",
              borderColor: "oklch(0.55 0.16 12)",
            }}
          >
            block this person
          </button>
        </div>
      )}

      {rel.isFollower(targetUid) && status !== "friend" && status !== "blocked" && (
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 11, fontStyle: "italic" }}
        >
          {targetName.split(" ")[0]} follows you. Befriend to share at
          circle tier (both sides see each other's daily reports when
          you have it set to "circle").
        </div>
      )}

      {error && (
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 11, color: "oklch(0.55 0.16 12)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function SendImpressionInline({
  name,
  onSend,
  sending,
  sentFlash,
}: {
  name: string;
  onSend: (traits: string[], context?: string) => Promise<void>;
  sending: boolean;
  sentFlash: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [context, setContext] = useState<string>("");

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const canSend = picked.length > 0 && picked.length <= 6 && !sending;

  const submit = async () => {
    if (!canSend) return;
    await onSend(picked, context.trim() || undefined);
    setPicked([]);
    setContext("");
    setOpen(false);
  };

  if (sentFlash) {
    return (
      <div
        className="card"
        style={{
          marginTop: 16,
          padding: 14,
          textAlign: "center",
          borderLeft: "3px solid var(--accent)",
        }}
      >
        <Kicker>sent · anonymous</Kicker>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            marginTop: 4,
          }}
        >
          {name.split(" ")[0]} will see {picked.length || "your"} trait
          {picked.length === 1 ? "" : "s"} in their inbox — never your name,
          never longhand.
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div
        className="card"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 16,
          padding: 14,
          cursor: "pointer",
          borderLeft: "3px solid var(--accent)",
        }}
      >
        <Kicker>leave an impression</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}
        >
          Pick a few traits. {name.split(" ")[0]} sees them in their
          inbox anonymously — no name attached. Three per month, per
          person.
        </div>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        padding: 14,
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Kicker>leave an impression of {name.split(" ")[0]}</Kicker>
        <button
          onClick={() => {
            setOpen(false);
            setPicked([]);
            setContext("");
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ink-3)",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 11,
            padding: 0,
          }}
        >
          cancel
        </button>
      </div>

      <div
        className="margin-note"
        style={{
          marginTop: 6,
          fontSize: 11,
          fontStyle: "italic",
        }}
      >
        {picked.length}/6 selected · anonymous · traits only
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 5,
          marginTop: 10,
        }}
      >
        {TRAIT_PALETTE.map((t) => {
          const on = picked.includes(t);
          const disabled = !on && picked.length >= 6;
          return (
            <button
              key={t}
              onClick={() => !disabled && toggle(t)}
              disabled={disabled}
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 12,
                padding: "4px 9px",
                borderRadius: 999,
                cursor: disabled ? "default" : "pointer",
                background: on ? "var(--ink)" : "var(--paper-2)",
                color: on
                  ? "var(--paper)"
                  : disabled
                    ? "var(--ink-3)"
                    : "var(--ink-2)",
                border: "0.5px solid var(--rule)",
                opacity: disabled ? 0.4 : 1,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="kicker">context · optional</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginTop: 6,
          }}
        >
          {CONTEXT_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setContext(context === c ? "" : c)}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.06em",
                padding: "3px 8px",
                borderRadius: 999,
                cursor: "pointer",
                background:
                  context === c ? "var(--paper-3)" : "transparent",
                color: context === c ? "var(--ink)" : "var(--ink-3)",
                border: "0.5px solid var(--rule)",
                textTransform: "uppercase",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!canSend}
        style={{
          marginTop: 14,
          width: "100%",
          padding: "10px 14px",
          background: canSend ? "var(--ink)" : "var(--paper-3)",
          color: canSend ? "var(--paper)" : "var(--ink-3)",
          border: "none",
          borderRadius: 999,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 14,
          cursor: canSend ? "pointer" : "default",
        }}
      >
        {sending ? "sending…" : "leave it"}
      </button>
    </div>
  );
}

// ─── PoliticsRatingEditor ───────────────────────────────────────
//
// Six sliders, one per political axis. -100..+100 each (signed) —
// matches what the test produces for the user's own profile.
// Endpoints copy mirrors the test items: each axis has a "left" and
// "right" label.

const POLITICAL_AXES_FULL: {
  key: string;
  name: string;
  lo: string;
  hi: string;
}[] = [
  { key: "econ", name: "Economy", lo: "left", hi: "right" },
  { key: "social", name: "Social", lo: "liberty", hi: "authority" },
  { key: "foreign", name: "Foreign", lo: "national", hi: "open" },
  { key: "env", name: "Environment", lo: "growth-first", hi: "climate-first" },
  { key: "tech", name: "Technology", lo: "skeptic", hi: "optimist" },
  { key: "auth", name: "Authority", lo: "open", hi: "order" },
];

function PoliticsRatingEditor({
  name,
  current,
  onCancel,
  onSave,
}: {
  name: string;
  current?: Record<string, number>;
  onCancel: () => void;
  onSave: (vec: Record<string, number>) => Promise<void> | void;
}) {
  const initial: Record<string, number> = {};
  for (const a of POLITICAL_AXES_FULL) {
    initial[a.key] = current?.[a.key] ?? 0;
  }
  const [vec, setVec] = useState<Record<string, number>>(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: number) =>
    setVec((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(vec);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RatingModal
      title={`rate · ${name}'s politics`}
      onCancel={onCancel}
      onSubmit={submit}
      saving={saving}
    >
      <Kicker>your read · adjustable any time</Kicker>
      <div className="margin-note" style={{ marginTop: 4, fontSize: 12 }}>
        "Six axes. Where you'd place them on each — your sense of
        where they sit, not theirs. Stays private to you."
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 14,
        }}
      >
        {POLITICAL_AXES_FULL.map((axis) => (
          <SignedAxisSlider
            key={axis.key}
            label={axis.name}
            lo={axis.lo}
            hi={axis.hi}
            value={vec[axis.key]}
            onChange={(v) => set(axis.key, v)}
          />
        ))}
      </div>
    </RatingModal>
  );
}

// ─── MoralsRatingEditor ─────────────────────────────────────────
//
// Eight sliders, one per moral axis. Same -100..+100 signed scale
// as politics.

const MORAL_AXES_FULL: {
  key: string;
  name: string;
  lo: string;
  hi: string;
}[] = [
  { key: "tech", name: "Tech", lo: "doomer", hi: "optimist" },
  { key: "future", name: "Future", lo: "pessimist", hi: "optimist" },
  { key: "duty", name: "Duty", lo: "strangers", hi: "family" },
  { key: "hedonism", name: "Hedonism", lo: "duty", hi: "pleasure" },
  { key: "meaning", name: "Meaning", lo: "happiness", hi: "suffering matters" },
  { key: "moral", name: "Ethics", lo: "relativist", hi: "objectivist" },
  { key: "altruism", name: "Altruism", lo: "self", hi: "stranger" },
  { key: "beauty", name: "Beauty", lo: "truth only", hi: "beauty matters" },
];

function MoralsRatingEditor({
  name,
  current,
  onCancel,
  onSave,
}: {
  name: string;
  current?: Record<string, number>;
  onCancel: () => void;
  onSave: (vec: Record<string, number>) => Promise<void> | void;
}) {
  const initial: Record<string, number> = {};
  for (const a of MORAL_AXES_FULL) {
    initial[a.key] = current?.[a.key] ?? 0;
  }
  const [vec, setVec] = useState<Record<string, number>>(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: number) =>
    setVec((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(vec);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RatingModal
      title={`rate · ${name}'s values`}
      onCancel={onCancel}
      onSubmit={submit}
      saving={saving}
    >
      <Kicker>your read · adjustable any time</Kicker>
      <div className="margin-note" style={{ marginTop: 4, fontSize: 12 }}>
        "Eight pulls. Where you'd place them on each — your sense
        of how they reason about ethics, time, meaning. Private to
        you."
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 14,
        }}
      >
        {MORAL_AXES_FULL.map((axis) => (
          <SignedAxisSlider
            key={axis.key}
            label={axis.name}
            lo={axis.lo}
            hi={axis.hi}
            value={vec[axis.key]}
            onChange={(v) => set(axis.key, v)}
          />
        ))}
      </div>
    </RatingModal>
  );
}

// ─── Shared modal frame + slider component ──────────────────────

function RatingModal({
  title,
  onCancel,
  onSubmit,
  saving,
  children,
}: {
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="app-header"
        style={{
          background: "transparent",
          borderBottom: "0.5px solid rgba(255,255,255,0.15)",
        }}
      >
        <button
          className="avatar-btn"
          onClick={onCancel}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          {title}
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div
          style={{
            background: "var(--paper)",
            borderRadius: 8,
            padding: 16,
            color: "var(--ink)",
          }}
        >
          {children}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={saving}
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One slider for a -100..+100 signed axis. Used by both
// PoliticsRatingEditor and MoralsRatingEditor.
function SignedAxisSlider({
  label,
  lo,
  hi,
  value,
  onChange,
}: {
  label: string;
  lo: string;
  hi: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "var(--mono)",
          fontSize: 9,
          letterSpacing: "0.08em",
          color: "var(--ink-3)",
        }}
      >
        <span>{lo.toUpperCase()}</span>
        <span
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--ink-2)",
          }}
        >
          {label}
        </span>
        <span>{hi.toUpperCase()}</span>
      </div>
      <input
        type="range"
        min="-100"
        max="100"
        step="5"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9.5,
          color: "var(--ink-3)",
          textAlign: "center",
          marginTop: -2,
        }}
      >
        {value > 0 ? `+${value}` : value}
      </div>
    </div>
  );
}

// ─── PoliticsCardForPerson ──────────────────────────────────────
//
// Compares the user's own 6-axis politics against the relation's
// rated 6-axis politics. Renders a radar when both sides are
// present. When the viewer hasn't taken the test, points them to
// it. When the viewer has taken the test but hasn't rated this
// relation yet, shows a "rate them" CTA.

function PoliticsCardForPerson({
  name,
  hue,
  isRelation,
  profileAxes,
  profilePolitical,
  themAxes,
  profileHasPolitics,
  themHasPolitics,
  onEdit,
}: {
  name: string;
  hue: number;
  isRelation: boolean;
  profileAxes?: Record<string, number>;
  profilePolitical?: { econ: number; social: number };
  themAxes?: Record<string, number>;
  profileHasPolitics: boolean;
  themHasPolitics: boolean;
  onEdit: () => void;
}) {
  if (!profileHasPolitics) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>You vs them · politics</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 13, fontStyle: "italic" }}
        >
          Take the politics test (from "your portrait") to compare
          your six axes against {name.split(" ")[0]}'s.
        </div>
      </div>
    );
  }

  // Build the user's own 6-axis vector. politicalAxes is preferred;
  // fall back to the 2-axis `political` for econ/social with zeros
  // elsewhere if axes is missing.
  const yourAxes: Record<string, number> = {
    econ: profileAxes?.econ ?? profilePolitical?.econ ?? 0,
    social: profileAxes?.social ?? profilePolitical?.social ?? 0,
    foreign: profileAxes?.foreign ?? 0,
    env: profileAxes?.env ?? 0,
    tech: profileAxes?.tech ?? 0,
    auth: profileAxes?.auth ?? 0,
  };

  if (!themHasPolitics) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>You vs them · politics</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
        >
          {isRelation
            ? `Rate ${name.split(" ")[0]}'s six axes to compare. Your read — adjustable any time.`
            : `${name.split(" ")[0]} isn't a relation yet. Add them and you can rate their politics.`}
        </div>
        {isRelation && (
          <button
            onClick={onEdit}
            style={{
              marginTop: 10,
              padding: "8px 14px",
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 99,
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            + RATE POLITICS
          </button>
        )}
      </div>
    );
  }

  // Both ready — radar overlay. Axes are -100..+100 signed; the
  // RadarChart wants 0..100, so map each signed value to its
  // absolute distance from center on its native side. To keep this
  // simple and readable, we map +-100 onto a 0..100 radius linearly
  // (so a -100 econ shows as "100 toward the lo end"). The legend
  // labels each axis with its hi-side label so readers know the
  // direction.
  const axes = POLITICAL_AXES_FULL.map((a) => ({
    label: a.name,
    you: ((yourAxes[a.key] ?? 0) + 100) / 2,
    them: ((themAxes![a.key] ?? 0) + 100) / 2,
  }));
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>You vs them · politics</Kicker>
      <div style={{ marginTop: 8 }}>
        <RadarChart
          values={axes.map((a) => a.you)}
          compareValues={axes.map((a) => a.them)}
          labels={axes.map((a) => a.label)}
          color="var(--ink)"
          compareColor={`oklch(0.55 0.13 ${hue})`}
          size={260}
        />
      </div>
      <div
        className="margin-note"
        style={{
          marginTop: 8,
          fontSize: 11,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        each axis: full outer = your read of them at "right" pole; full
        inner = "left" pole. signed values flipped to 0..100 for the
        radar.
      </div>
      {isRelation && (
        <div style={{ marginTop: 4, textAlign: "center" }}>
          <button
            onClick={onEdit}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "var(--ink-3)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            ✎ ADJUST
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MoralsCardForPerson ────────────────────────────────────────
//
// 8-axis diverging-bar comparison. Each axis has a -100..+100
// signed value. We render a horizontal track per axis with two
// markers: the viewer's value and the relation's. Centre line is
// the neutral 0.

function MoralsCardForPerson({
  name,
  isRelation,
  profileMorals,
  themMorals,
  profileHasMorals,
  themHasMorals,
  onEdit,
}: {
  name: string;
  isRelation: boolean;
  profileMorals?: Record<string, number>;
  themMorals?: Record<string, number>;
  profileHasMorals: boolean;
  themHasMorals: boolean;
  onEdit: () => void;
}) {
  if (!profileHasMorals) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>You vs them · values</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 13, fontStyle: "italic" }}
        >
          Take the values test (from "your portrait") to compare your
          eight pulls against {name.split(" ")[0]}'s.
        </div>
      </div>
    );
  }

  if (!themHasMorals) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>You vs them · values</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
        >
          {isRelation
            ? `Rate ${name.split(" ")[0]}'s eight pulls to compare. Your read — adjustable any time.`
            : `${name.split(" ")[0]} isn't a relation yet. Add them and you can rate their values.`}
        </div>
        {isRelation && (
          <button
            onClick={onEdit}
            style={{
              marginTop: 10,
              padding: "8px 14px",
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 99,
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            + RATE VALUES
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>You vs them · values</Kicker>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {MORAL_AXES_FULL.map((axis) => {
          const yv = profileMorals![axis.key] ?? 0;
          const tv = themMorals![axis.key] ?? 0;
          const yPct = (yv + 100) / 2;
          const tPct = (tv + 100) / 2;
          return (
            <div key={axis.key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                <span>{axis.lo}</span>
                <span style={{ color: "var(--ink-2)" }}>{axis.name}</span>
                <span>{axis.hi}</span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 999,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: -2,
                    width: 1,
                    height: 12,
                    background: "var(--rule)",
                  }}
                />
                <span
                  title={`you · ${yv}`}
                  style={{
                    position: "absolute",
                    left: `calc(${yPct}% - 5px)`,
                    top: -2,
                    width: 10,
                    height: 12,
                    borderRadius: 6,
                    background: "var(--ink)",
                    border: "1px solid var(--paper)",
                  }}
                />
                <span
                  title={`${name.split(" ")[0]} · ${tv}`}
                  style={{
                    position: "absolute",
                    left: `calc(${tPct}% - 5px)`,
                    top: -2,
                    width: 10,
                    height: 12,
                    borderRadius: 6,
                    background: "var(--c-people)",
                    border: "1px solid var(--paper)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          justifyContent: "center",
          fontFamily: "var(--mono)",
          fontSize: 9.5,
          color: "var(--ink-3)",
          letterSpacing: "0.08em",
          marginTop: 10,
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: "var(--ink)",
              borderRadius: 4,
              marginRight: 5,
              verticalAlign: "middle",
            }}
          />
          YOU
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: "var(--c-people)",
              borderRadius: 4,
              marginRight: 5,
              verticalAlign: "middle",
            }}
          />
          {name.split(" ")[0].toUpperCase()}
        </span>
      </div>
      {isRelation && (
        <div style={{ marginTop: 4, textAlign: "center" }}>
          <button
            onClick={onEdit}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "var(--ink-3)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            ✎ ADJUST
          </button>
        </div>
      )}
    </div>
  );
}
