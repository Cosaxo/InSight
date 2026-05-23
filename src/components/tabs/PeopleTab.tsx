import { Fragment, useCallback, useMemo, useState } from "react";
import { Av, Kicker } from "../shared/primitives";
import { Compass2D } from "../shared/charts";
import {
  ConcentricMap,
  type ConcentricPerson,
} from "../shared/ConcentricMap";
import { useRelations, type UserPerson } from "../../lib/useRelations";
import { useFriendDailies } from "../../lib/useFriendDailies";
import { useMe } from "../../lib/useMe";
import { useMyRelations } from "../../lib/useMyRelations";
import { useCircleInterestDistribution } from "../../lib/useCircleInterestDistribution";
import { useAuth } from "../../lib/useAuth";
import { acceptFriendRequest, declineFriendRequest } from "../../lib/firebase";
import { ProfileCompare } from "../insights/ProfileCompare";
import { MediaPopularity } from "../insights/MediaPopularity";

export interface CirclePerson extends ConcentricPerson {
  rel: string;
  category: string;
  match: number;
  degrees: number;
  since: string;
  interests?: ({ c: string; t: string } | string)[];
  personality?: number[];
  politicalAxes?: Record<string, number>;
  morals?: Record<string, number>;
  // Real Firebase auth uid when this relation is linked to an
  // actual InSight account — drives the "send them an impression"
  // path in PersonOverlay.
  linkedUid?: string;
}

interface PeopleTabProps {
  onPerson: (p: CirclePerson) => void;
  onOpenDaily?: () => void;
  onAddPerson?: () => void;
  myDailyReport?: DailyReport | null;
}

// Promote a user-added UserPerson into the CirclePerson shape the
// People tab + ConcentricMap consume.
function userToCircle(p: UserPerson): CirclePerson {
  return {
    id: p.id,
    name: p.name,
    init: p.init,
    hue: p.hue,
    match: p.match,
    rel: p.rel,
    category: p.category,
    degrees: p.degrees,
    since: p.since,
    personality: p.personality,
    politicalAxes: p.politicalAxes,
    morals: p.morals,
    linkedUid: p.linkedUid,
  };
}

interface DailyReport {
  personId: string;
  date: string;
  shared?: string[];
  mood?: number;
  moodLabel?: string;
  one_line?: string;
  weather?: string;
  sleep?: string;
  moves?: string;
  meal?: string;
  photo?: string;
  body?: { hrv: number; sleepScore: number };
  move?: {
    steps?: number;
    workout?: { type: string };
  };
  nutrition?: { kcal: number; water: number };
  scrapbook?: { name: string; hue: number }[];
}

const PHOTO_GRADIENTS: Record<string, string> = {
  fjord:
    "linear-gradient(160deg, oklch(0.78 0.06 220), oklch(0.55 0.10 245) 60%, oklch(0.34 0.08 260))",
  kitchen:
    "linear-gradient(180deg, oklch(0.86 0.06 60), oklch(0.72 0.09 40) 50%, oklch(0.46 0.10 30))",
  forest:
    "linear-gradient(170deg, oklch(0.74 0.09 145), oklch(0.50 0.11 155) 55%, oklch(0.30 0.08 165))",
  window:
    "linear-gradient(200deg, oklch(0.92 0.03 80), oklch(0.78 0.05 60) 50%, oklch(0.58 0.07 50))",
};

// RelationInbox — pending friend requests + recent followers, shown
// at the top of PeopleTab so the user notices them. Hidden entirely
// when both lists are empty (the common case).
function RelationInbox({ onOpenPerson }: { onOpenPerson: (p: CirclePerson) => void }) {
  const { user } = useAuth();
  const rel = useMyRelations();
  const [busy, setBusy] = useState<Set<string>>(new Set());

  if (!user || (rel.incomingRequests.length === 0 && rel.followers.length === 0)) {
    return null;
  }

  const handle = async (op: () => Promise<void>, uid: string) => {
    setBusy((s) => new Set(s).add(uid));
    try {
      await op();
    } catch (err) {
      console.error("[RelationInbox] action failed:", err);
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(uid);
        return next;
      });
    }
  };

  // Synthesise a CirclePerson out of just a uid so onOpenPerson
  // works (the PersonOverlay handles the linkedUid lookup). The
  // chrome (init, hue) is derived from the uid.
  const synth = (uid: string): CirclePerson => {
    let h = 0;
    for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return {
      id: uid,
      name: `User ${uid.slice(0, 4)}`,
      init: uid.slice(0, 2).toUpperCase(),
      hue: h % 360,
      rel: "",
      category: "",
      match: 50,
      degrees: 1,
      since: "",
      linkedUid: uid,
    };
  };

  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      {rel.incomingRequests.length > 0 && (
        <>
          <Kicker>friend requests · {rel.incomingRequests.length}</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 10,
            }}
          >
            {rel.incomingRequests.map((r) => (
              <div
                key={r.uid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 10,
                }}
              >
                <div
                  onClick={() => onOpenPerson(synth(r.uid))}
                  style={{
                    flex: 1,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  User {r.uid.slice(0, 6)} wants to befriend you
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handle(() => acceptFriendRequest(user.uid, r.uid), r.uid)
                  }
                  disabled={busy.has(r.uid)}
                  style={{
                    padding: "5px 10px",
                    background: "var(--ink)",
                    color: "var(--paper)",
                    border: "none",
                    borderRadius: 999,
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.12em",
                    cursor: "pointer",
                  }}
                >
                  ACCEPT
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handle(() => declineFriendRequest(user.uid, r.uid), r.uid)
                  }
                  disabled={busy.has(r.uid)}
                  style={{
                    padding: "5px 10px",
                    background: "transparent",
                    color: "var(--ink-3)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 999,
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.12em",
                    cursor: "pointer",
                  }}
                >
                  DECLINE
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {rel.followers.length > 0 && (
        <div style={{ marginTop: rel.incomingRequests.length > 0 ? 14 : 0 }}>
          <Kicker>followers · {rel.followers.length}</Kicker>
          <div
            className="margin-note"
            style={{ marginTop: 6, fontSize: 11, fontStyle: "italic" }}
          >
            People who follow you. They see what you share at "city" tier.
            Befriending grants them circle-tier access.
          </div>
        </div>
      )}
    </div>
  );
}

// CircleInterestCard — shows the most common interests across the
// people you can see (friends + followers + following). Reuses the
// public-profile read path the Interests tab demographics card uses.
// K-anonymity gates apply: < 3 people with shared interests yields
// an honest empty state instead of misleading 100%-of-1 numbers.
function CircleInterestCard() {
  const dist = useCircleInterestDistribution();

  if (dist.loading) {
    return (
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <Kicker>Interests · across your circle</Kicker>
        <div className="margin-note" style={{ marginTop: 8, fontSize: 12 }}>
          Loading…
        </div>
      </div>
    );
  }

  if (dist.insufficient) {
    return (
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <Kicker>Interests · across your circle</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}
        >
          {dist.totalPeople === 0
            ? "No one in your circle has shared their interests yet."
            : `Only ${dist.totalPeople} have shared — need at least 3 for a meaningful breakdown.`}
        </div>
      </div>
    );
  }

  const maxCount = dist.topInterests[0]?.count ?? 1;

  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Kicker>Interests · across your circle</Kicker>
        <span
          className="fig-num"
          style={{ fontSize: 18, fontStyle: "italic" }}
        >
          {dist.totalPeople}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 10,
        }}
      >
        {dist.topInterests.map((i) => (
          <div
            key={i.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--mono)",
              fontSize: 11,
            }}
          >
            <span
              style={{
                width: 120,
                color: "var(--ink-2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={i.name}
            >
              {i.name}
            </span>
            <div
              style={{
                flex: 1,
                height: 4,
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round((i.count / maxCount) * 100)}%`,
                  height: "100%",
                  background: "var(--sage)",
                }}
              />
            </div>
            <span
              style={{
                width: 56,
                textAlign: "right",
                color: "var(--ink-3)",
                fontSize: 10,
              }}
            >
              {i.count} · {Math.round(i.fraction * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div
        className="margin-note"
        style={{ marginTop: 10, fontSize: 11, fontStyle: "italic" }}
      >
        Aggregated from friends, followers, and people you follow
        who chose to share their interests. Each person counted once
        per unique interest.
      </div>
    </div>
  );
}

export function PeopleTab({
  onPerson,
  onOpenDaily,
  onAddPerson,
  myDailyReport,
}: PeopleTabProps) {
  const myDaily = myDailyReport ?? null;
  const me = useMe();
  const [chainTarget, setChainTarget] = useState<CirclePerson | null>(null);
  const { people: userPeople } = useRelations();
  const { dailies: friendDailies } = useFriendDailies(userPeople);

  // Friend daily reports → DailyReport view shape. Friend reports only
  // carry the public fields (no body / move / nutrition / scrapbook —
  // those are owner-only on the source doc).
  const friendReports: DailyReport[] = useMemo(
    () =>
      friendDailies.map(({ friend, report }) => ({
        personId: friend.id,
        date: report.date,
        shared: report.shared,
        mood: report.mood,
        moodLabel: report.moodLabel,
        one_line: report.one_line,
        weather: report.weather,
      })),
    [friendDailies],
  );

  const allReports: DailyReport[] = myDaily
    ? [myDaily, ...friendReports]
    : friendReports;

  const categories = [
    { key: "family", label: "Family", icon: "✦", hue: 12 },
    { key: "friends", label: "Friends", icon: "○", hue: 38 },
    { key: "colleagues", label: "Colleagues", icon: "□", hue: 220 },
    { key: "neighbors", label: "Neighbors", icon: "△", hue: 145 },
    { key: "acquaintances", label: "Acquaintances", icon: "·", hue: 250 },
  ];
  const people: CirclePerson[] = useMemo(
    () => userPeople.map(userToCircle),
    [userPeople],
  );

  // Big Five average across the people in your circle you've rated.
  // Null until at least one has a personality vector — ProfileCompare
  // shows an honest empty state in that case.
  const circleAggregate = useMemo(() => {
    const vecs = userPeople
      .filter(
        (p) => Array.isArray(p.personality) && p.personality.length === 5,
      )
      .map((p) => p.personality as number[]);
    if (vecs.length === 0) return null;
    const mean = [0, 0, 0, 0, 0];
    for (const v of vecs) for (let i = 0; i < 5; i++) mean[i] += v[i];
    return { n: vecs.length, big5: mean.map((s) => Math.round(s / vecs.length)) };
  }, [userPeople]);

  // Stable callback so the memoized ConcentricMap doesn't re-render
  // when chainTarget / other PeopleTab state changes.
  const onConcentricPerson = useCallback(
    (p: ConcentricPerson) => onPerson(p as CirclePerson),
    [onPerson],
  );

  const grouped = categories
    .map((c) => ({
      ...c,
      people: people.filter((p) => p.category === c.key),
    }))
    .filter((g) => g.people.length);

  const buildChain = (target: CirclePerson | null) => {
    if (!target) return [];
    const you = { id: "you", name: "you", init: "YOU" } as {
      id: string;
      name: string;
      init: string;
      hue?: number;
    };
    if (target.degrees === 1) return [you, target];
    const broker =
      people.find(
        (p) => p.degrees === 1 && (p.id === "f1" || p.id === "f3"),
      ) || people[0];
    return [you, broker, target];
  };
  const chain = buildChain(chainTarget);

  const avgMatch =
    people.length === 0
      ? 0
      : Math.round(people.reduce((s, p) => s + p.match, 0) / people.length);
  const sinceYears = people
    .filter((p) => p.since !== "birth")
    .map((p) => parseInt(p.since, 10))
    .filter((y) => Number.isFinite(y));
  const oldestYear = sinceYears.length === 0 ? 0 : Math.min(...sinceYears);
  const oldestLabel = oldestYear ? `${2025 - oldestYear}y` : "—";

  return (
    <div className="fade-in">

      <RelationInbox onOpenPerson={onPerson} />

      <Kicker>People · your circle</Kicker>
      <div className="sec-head">
        <h2>
          Your <em>people</em>
        </h2>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Kicker>Today, from your circle</Kicker>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "oklch(0.45 0.13 145)",
              letterSpacing: "0.1em",
            }}
          >
            · LIVE · {allReports.filter((r) => r.date === "today").length}{" "}
            TODAY
          </span>
        </div>
        <div
          className="margin-note"
          style={{
            marginTop: 4,
            marginBottom: 12,
            fontStyle: "italic",
            fontSize: 12,
          }}
        >
          friends who chose to share their day with you. they decide what; you
          decide who.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {allReports.length === 0 && (
            <div
              className="margin-note"
              style={{
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--ink-3)",
                padding: "8px 0",
              }}
            >
              {userPeople.length === 0
                ? "Add people to your circle to see their day. Log your own daily to share yours back."
                : "Nobody in your circle has shared today yet. (They each have to grant you access from their side.)"}
            </div>
          )}
          {allReports.map((r) => {
            const isMe = r.personId === "me";
            const p = isMe
              ? {
                  id: "me",
                  init: me.initials,
                  hue: me.hue,
                  name: me.name,
                  rel: "yourself",
                }
              : people.find((x) => x.id === r.personId);
            if (!p) return null;
            const rec = r as unknown as Record<string, unknown>;
            const has = (k: string) =>
              !!r.shared &&
              r.shared.includes(k) &&
              rec[k] != null &&
              rec[k] !== "";
            return (
              <div
                key={r.personId + r.date}
                onClick={() =>
                  isMe
                    ? onOpenDaily && onOpenDaily()
                    : onPerson(p as CirclePerson)
                }
                style={{
                  padding: 12,
                  background: isMe ? "var(--paper-2)" : "var(--paper)",
                  border: "0.5px solid var(--rule)",
                  borderLeft: `3px solid ${isMe ? "var(--accent)" : `oklch(0.55 0.12 ${p.hue})`}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                {isMe && (
                  <span
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 10,
                      fontFamily: "var(--mono)",
                      fontSize: 8,
                      color: "var(--accent)",
                      letterSpacing: "0.14em",
                    }}
                  >
                    · YOU ·
                  </span>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Av init={p.init} hue={p.hue} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontFamily: "var(--serif)", fontSize: 15 }}
                    >
                      {p.name.split(" ")[0]}{" "}
                      <span
                        style={{
                          color: "var(--ink-3)",
                          fontSize: 11,
                          fontStyle: "italic",
                        }}
                      >
                        · {(p as CirclePerson).rel ?? "yourself"}
                      </span>
                    </div>
                    <div
                      className="kicker"
                      style={{ marginTop: 1, fontSize: 9 }}
                    >
                      {r.date.toUpperCase()}{" "}
                      {has("mood") && "· FEELS " + r.moodLabel?.toUpperCase()}
                    </div>
                  </div>
                  {has("mood") && (
                    <div style={{ textAlign: "right" }}>
                      <div className="fig-num" style={{ fontSize: 22 }}>
                        <em>{r.mood}</em>
                      </div>
                    </div>
                  )}
                </div>

                {has("one_line") && (
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 13,
                      fontStyle: "italic",
                      color: "var(--ink-2)",
                      lineHeight: 1.45,
                      padding: "6px 0",
                      borderTop: "0.5px dashed var(--rule)",
                      borderBottom: "0.5px dashed var(--rule)",
                    }}
                  >
                    "{r.one_line}"
                  </div>
                )}

                {isMe && has("photo") && r.photo && (
                  <div
                    style={{
                      height: 120,
                      borderRadius: 6,
                      overflow: "hidden",
                      border: "0.5px solid var(--rule)",
                      margin: "8px 0",
                      background: r.photo.startsWith("data:")
                        ? `center/cover no-repeat url(${r.photo})`
                        : PHOTO_GRADIENTS[r.photo] || "var(--paper-3)",
                    }}
                  />
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 8,
                    fontFamily: "var(--serif)",
                    fontSize: 11,
                    color: "var(--ink-3)",
                  }}
                >
                  {has("weather") && <span>☾ {r.weather}</span>}
                  {has("sleep") && <span>· slept {r.sleep}</span>}
                  {has("moves") && <span>· {r.moves}</span>}
                  {has("meal") && <span>· {r.meal}</span>}
                  {isMe && has("body") && r.body && (
                    <span>
                      · hrv {r.body.hrv} · sleep {r.body.sleepScore}/100
                    </span>
                  )}
                  {isMe && has("movement") && r.move && (
                    <span>
                      · {r.move.steps?.toLocaleString()} steps
                      {r.move.workout
                        ? " · " + r.move.workout.type.toLowerCase()
                        : ""}
                    </span>
                  )}
                  {isMe && has("nutrition") && r.nutrition && (
                    <span>
                      · {r.nutrition.kcal} kcal · {r.nutrition.water}/8 water
                    </span>
                  )}
                </div>

                {isMe &&
                  has("scrapbook") &&
                  r.scrapbook &&
                  r.scrapbook.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "0.5px dashed var(--rule)",
                      }}
                    >
                      <div
                        className="kicker"
                        style={{ marginBottom: 4, fontSize: 8 }}
                      >
                        SCRAPBOOK · TODAY
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 5,
                        }}
                      >
                        {r.scrapbook.map((s, i) => (
                          <span
                            key={i}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              background: `color-mix(in oklch, oklch(0.55 0.12 ${s.hue}) 14%, var(--paper))`,
                              borderRadius: 999,
                              fontFamily: "var(--serif)",
                              fontStyle: "italic",
                              fontSize: 11.5,
                              color: "var(--ink-2)",
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: `oklch(0.55 0.13 ${s.hue})`,
                              }}
                            />
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "0.5px dashed var(--rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--ink-3)",
            }}
          >
            {myDaily ? (
              <>your daily is shared →</>
            ) : (
              <>
                log <em>your</em> daily, share what you choose →
              </>
            )}
          </span>
          <button
            onClick={() => onOpenDaily && onOpenDaily()}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              fontFamily: "var(--mono)",
              fontSize: 8.5,
              letterSpacing: "0.12em",
              background: myDaily ? "var(--paper-2)" : "var(--ink)",
              color: myDaily ? "var(--ink)" : "var(--paper)",
              border: "0.5px solid var(--rule)",
              cursor: "pointer",
            }}
          >
            {myDaily ? "EDIT TODAY" : "LOG TODAY"}
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          textAlign: "center",
        }}
      >
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{people.length}</em>
          </div>
          <div className="kicker">KEPT</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{avgMatch}</em>
          </div>
          <div className="kicker">AVG MATCH</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{oldestLabel}</em>
          </div>
          <div className="kicker">OLDEST TIE</div>
        </div>
        <div>
          <div className="fig-num" style={{ fontSize: 28 }}>
            <em>{grouped.length}</em>
          </div>
          <div className="kicker">CIRCLES</div>
        </div>
      </div>

      <CircleInterestCard />

      <div
        className="card"
        style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}
      >
        <div style={{ padding: "18px 18px 8px" }}>
          <Kicker>The relationship map · concentric orbits</Kicker>
          <div className="margin-note" style={{ marginTop: 6, marginBottom: 4 }}>
            you at the center. closer in, the more you lean on them — and the
            lines between them are shared edges.
          </div>
        </div>
        <ConcentricMap people={people} onPerson={onConcentricPerson} />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Everyone, by circle</Kicker>
        {grouped.map((cat) => (
          <div key={cat.key} style={{ marginTop: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 13,
                  color: "var(--ink-2)",
                  borderBottom: `1.5px solid oklch(0.55 0.12 ${cat.hue})`,
                  paddingBottom: 1,
                }}
              >
                {cat.label}
              </span>
              <span
                style={{
                  flex: 1,
                  borderTop: "0.5px dashed var(--rule)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--ink-3)",
                  letterSpacing: "0.08em",
                }}
              >
                {cat.people.length}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {cat.people.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onPerson(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 9px 4px 4px",
                    background: "var(--paper-2)",
                    border: `0.5px solid oklch(0.78 0.08 ${p.hue})`,
                    borderRadius: 18,
                    cursor: "pointer",
                  }}
                >
                  <Av init={p.init} hue={p.hue} size={22} />
                  <span style={{ fontFamily: "var(--serif)", fontSize: 12 }}>
                    {p.name.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>The link-chain · degrees of separation</Kicker>
        <div className="margin-note" style={{ marginTop: 6, marginBottom: 10 }}>
          how far is anyone from you, really?
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setChainTarget(p)}
              style={{
                padding: "6px 10px",
                border:
                  chainTarget?.id === p.id
                    ? "1px solid var(--c-people)"
                    : "0.75px solid var(--rule)",
                background:
                  chainTarget?.id === p.id
                    ? "oklch(0.95 0.04 25)"
                    : "var(--paper)",
                borderRadius: 14,
                cursor: "pointer",
                fontFamily: "var(--serif)",
                fontSize: 12,
                color:
                  chainTarget?.id === p.id
                    ? "var(--c-people)"
                    : "var(--ink-2)",
              }}
            >
              {p.name.split(" ")[0]}
            </button>
          ))}
        </div>

        {chainTarget ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 8px",
                background: "var(--paper-2)",
                borderRadius: 10,
              }}
            >
              {chain.map((node, i) => (
                <Fragment key={node.id}>
                  <div style={{ textAlign: "center", flex: "0 0 auto" }}>
                    {node.id === "you" ? (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: "var(--ink)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--paper)",
                          fontFamily: "var(--serif)",
                          fontStyle: "italic",
                          fontSize: 11,
                        }}
                      >
                        you
                      </div>
                    ) : (
                      <Av init={node.init} hue={node.hue ?? 38} size={44} />
                    )}
                    <div
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 11,
                        marginTop: 4,
                        color: "var(--ink-2)",
                        maxWidth: 70,
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {node.name.split(" ")[0]}
                    </div>
                  </div>
                  {i < chain.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 30,
                      }}
                    >
                      <svg
                        width="100%"
                        height="20"
                        viewBox="0 0 80 20"
                        preserveAspectRatio="none"
                      >
                        <path
                          d="M 4 10 Q 40 2 76 10"
                          stroke="var(--c-people)"
                          strokeWidth="1"
                          fill="none"
                          strokeDasharray="2 3"
                        />
                        <circle cx="76" cy="10" r="2" fill="var(--c-people)" />
                      </svg>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "0.5px solid var(--rule)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <div>
                <div className="kicker">DEGREES</div>
                <div className="fig-num" style={{ fontSize: 28 }}>
                  <em>{chainTarget.degrees}</em>
                </div>
              </div>
              <div style={{ textAlign: "right", maxWidth: "60%" }}>
                <div
                  className="margin-note"
                  style={{
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--ink-2)",
                  }}
                >
                  {chainTarget.degrees === 1
                    ? `direct — you and ${chainTarget.name.split(" ")[0]} know each other.`
                    : `via ${chain[1].name.split(" ")[0]} — one introduction away.`}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "var(--ink-3)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 13,
            }}
          >
            tap a name above to trace the path
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Closeness · over the years</Kicker>
        <div style={{ marginTop: 8 }}>
          <Compass2D
            x={0}
            y={0}
            label="you"
            xLabel={["Distant", "Close"]}
            yLabel={["Recent", "Lasting"]}
            size={260}
            comparePoints={people.map((p) => ({
              x: (p.match - 70) * 3,
              y: (p.match - 70) * 2.5,
              label: p.init,
              color: `oklch(0.55 0.12 ${p.hue})`,
            }))}
          />
        </div>
      </div>

      <hr className="rule-dashed" />
      <ProfileCompare
        label="your circle"
        accent="var(--c-people)"
        scopeAggregate={circleAggregate}
      />
      <hr className="rule-dashed" />
      <MediaPopularity label="your circle" accent="var(--c-people)" />

      <hr className="rule-dashed" />
      <Kicker>Add someone</Kicker>
      <button
        onClick={onAddPerson}
        style={{
          width: "100%",
          marginTop: 10,
          padding: 14,
          background: "transparent",
          border: "1px dashed var(--rule)",
          borderRadius: 12,
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 15,
          color: "var(--ink-3)",
          cursor: "pointer",
        }}
      >
        + name a person
      </button>
    </div>
  );
}
