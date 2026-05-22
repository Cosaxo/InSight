import { useState } from "react";
import { useGeolocation } from "../../lib/useGeolocation";
import { useDiscoverableLocation } from "../../lib/useDiscoverableLocation";
import { useAuth } from "../../lib/useAuth";
import { useProfile } from "../../lib/useProfile";
import { firebaseEnabled, type ShareLevel } from "../../lib/firebase";
import { Kicker } from "../shared/primitives";

interface ShareItem {
  id: string;
  label: string;
  sub: string;
  glyph: string;
  def: ShareLevel;
}

// Categories backed by real data + real cross-user reads (or
// real-soon ones). Dropped from the previous list: health vitals
// (no wearable), media favourites (no profile field), interests
// (never had one), DNA ancestry / health (DnaOverlay still seed).
// Their "share my X" promises had nothing behind them.
//
// Enforcement status today:
//   daily_report — enforced by firestore.rules below; rule reads
//     this writer's sharePrefs.daily_report and gates the friend
//     read accordingly.
//   discoverable location toggle — enforced by useDiscoverableLocation
//     (separate path; presence of doc in insight_discoverable IS the
//     toggle).
//   everything else — persisted as user intent, not enforced. The
//     UI honestly says "no cross-user reads exist for these yet"
//     beneath the section.
const SHARE_DATA: ShareItem[] = [
  // Public-profile fields shown on the nearby-people row. All
  // default to "nobody" — opt-in. Once enabled, the discoverable
  // upsert in useDiscoverableLocation pulls the matching value
  // off profile and writes it to the doc.
  { id: "bio", label: "short bio", sub: "≤ 280 chars, shown to nearby people", glyph: "❝", def: "nobody" },
  { id: "role", label: "what you do", sub: "ceramicist, marine biologist, …", glyph: "✎", def: "nobody" },
  { id: "age", label: "age", sub: "the integer, never the year", glyph: "◯", def: "nobody" },
  { id: "interests", label: "interests", sub: "powers Interest-tab demographics", glyph: "✦", def: "nobody" },
  { id: "gender", label: "gender", sub: "powers the demographics breakdown", glyph: "◉", def: "nobody" },
  { id: "country", label: "country", sub: "powers the world-tab country view", glyph: "△", def: "nobody" },
  { id: "daily_report", label: "daily report", sub: "your one-line summary + mood + weather", glyph: "✎", def: "circle" },
  { id: "mood", label: "mood", sub: "the 1..5 score per day", glyph: "☾", def: "circle" },
  { id: "big5", label: "personality (Big Five)", sub: "O · C · E · A · N", glyph: "✺", def: "circle" },
  { id: "political", label: "political compass", sub: "six axes", glyph: "✦", def: "nobody" },
  { id: "morals", label: "values & morals", sub: "where you sit, ethics-wise", glyph: "◇", def: "circle" },
  { id: "workouts", label: "workouts", sub: "runs, sessions, kcal", glyph: "↑", def: "circle" },
  { id: "meals", label: "meals", sub: "what you've eaten", glyph: "✦", def: "circle" },
  { id: "weighins", label: "weigh-ins", sub: "weight over time", glyph: "◐", def: "nobody" },
  { id: "scrapbook", label: "scrapbook · finds", sub: "plants, birds, weather", glyph: "❀", def: "circle" },
  { id: "dreams", label: "dream journal", sub: "private by default", glyph: "☾", def: "nobody" },
  { id: "impressions", label: "impressions of others", sub: "your sketches — always private", glyph: "❝", def: "nobody" },
  { id: "books", label: "books read", sub: "what you've finished", glyph: "▢", def: "world" },
  { id: "visits", label: "trips taken", sub: "countries & cities", glyph: "✶", def: "circle" },
  { id: "homes", label: "homes lived in", sub: "where you've been", glyph: "⌂", def: "nobody" },
  { id: "languages", label: "languages spoken", sub: "what you speak", glyph: "abc", def: "world" },
  { id: "jobs", label: "jobs held", sub: "what work you've done", glyph: "◆", def: "circle" },
  { id: "milestones", label: "life milestones", sub: "the timeline", glyph: "↑", def: "circle" },
  { id: "time_blocks", label: "time use", sub: "how the day actually went", glyph: "◐", def: "nobody" },
];

interface Level {
  id: ShareLevel;
  label: string;
  glyph: string;
  hue: number;
}

const LEVELS: Level[] = [
  { id: "nobody", label: "nobody", glyph: "✕", hue: 12 },
  { id: "circle", label: "circle", glyph: "◌", hue: 38 },
  { id: "city", label: "city", glyph: "◐", hue: 145 },
  { id: "world", label: "world", glyph: "◯", hue: 220 },
];

function ShareRow({
  item,
  value,
  onChange,
}: {
  item: ShareItem;
  value: ShareLevel;
  onChange: (v: ShareLevel) => void;
}) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--serif)",
            color: "var(--accent)",
            fontSize: 16,
          }}
        >
          {item.glyph}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 14 }}>{item.label}</div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--ink-3)",
              marginTop: 1,
            }}
          >
            {item.sub}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 10,
          padding: 3,
          background: "var(--paper-2)",
          border: "0.5px solid var(--rule)",
          borderRadius: 999,
        }}
      >
        {LEVELS.map((L) => {
          const active = value === L.id;
          return (
            <button
              key={L.id}
              onClick={() => onChange(L.id)}
              style={{
                flex: 1,
                padding: "6px 4px",
                cursor: "pointer",
                background: active
                  ? `oklch(0.55 0.13 ${L.hue})`
                  : "transparent",
                color: active ? "white" : "var(--ink-3)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {L.glyph} {L.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ImpressionAcceptance — who is allowed to leave a traits-only
// impression on the user's inbox. Reflects the new wider-tier
// writer paths added to firestore.rules:
//
//   nobody  → feature is off; rule rejects all writes.
//   circle  → only mutual friends (matches the original carve-out).
//   nearby  → followers + circle. Anyone who follows you can write.
//   anyone  → any signed-in user. Use with care.
//
// Block list still trumps everything — blocked users can't write
// regardless of the level chosen here.
function ImpressionAcceptance({
  value,
  onChange,
}: {
  value: "nobody" | "circle" | "nearby" | "anyone";
  onChange: (v: "nobody" | "circle" | "nearby" | "anyone") => void;
}) {
  const options: { id: "nobody" | "circle" | "nearby" | "anyone"; label: string; sub: string }[] =
    [
      { id: "nobody", label: "nobody", sub: "feature off; close the inbox" },
      { id: "circle", label: "circle only", sub: "mutual friends" },
      { id: "nearby", label: "followers + circle", sub: "anyone you let near you" },
      { id: "anyone", label: "anyone signed in", sub: "the most open" },
    ];

  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <Kicker>impressions inbox · who can write</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 6, marginBottom: 10, fontSize: 11.5, fontStyle: "italic" }}
      >
        Anonymous traits only — never longhand. Blocked users can
        never write regardless of this setting.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                background: on ? "var(--paper-2)" : "transparent",
                border: on
                  ? "0.5px solid var(--ink-2)"
                  : "0.5px solid var(--rule)",
                borderRadius: 10,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "0.5px solid var(--ink-2)",
                  background: on ? "var(--ink)" : "var(--paper)",
                  flexShrink: 0,
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 14,
                    color: "var(--ink)",
                  }}
                >
                  {o.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.05em",
                    color: "var(--ink-3)",
                    marginTop: 2,
                  }}
                >
                  {o.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ImpressionVisibility — who SEES the impressions left for you on
// your profile. Mirror of ImpressionAcceptance for write side, but
// flips the question. Default: nobody — keeps the inbox private.
function ImpressionVisibility({
  value,
  onChange,
}: {
  value: "nobody" | "circle" | "nearby" | "anyone";
  onChange: (v: "nobody" | "circle" | "nearby" | "anyone") => void;
}) {
  const options: { id: typeof value; label: string; sub: string }[] = [
    { id: "nobody", label: "nobody", sub: "kept private to you (default)" },
    { id: "circle", label: "circle only", sub: "mutual friends see them on your profile" },
    { id: "nearby", label: "followers + circle", sub: "wider — anyone you let near you" },
    { id: "anyone", label: "anyone signed in", sub: "fully public on your profile" },
  ];
  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <Kicker>impressions of you · who sees them</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 6, marginBottom: 10, fontSize: 11.5, fontStyle: "italic" }}
      >
        Decides who can see the impressions OTHERS have left for you
        on your profile. Senders stay anonymous; you can still
        delete any individual impression from your inbox.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                background: on ? "var(--paper-2)" : "transparent",
                border: on
                  ? "0.5px solid var(--ink-2)"
                  : "0.5px solid var(--rule)",
                borderRadius: 10,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "0.5px solid var(--ink-2)",
                  background: on ? "var(--ink)" : "var(--paper)",
                  flexShrink: 0,
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 14,
                    color: "var(--ink)",
                  }}
                >
                  {o.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.05em",
                    color: "var(--ink-3)",
                    marginTop: 2,
                  }}
                >
                  {o.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// TraitBlacklistEditor — list of trait words the user has removed
// from the impression picker. Senders can't pick them; the
// Firestore rule also rejects writes that include them. Lowercase
// is the storage canonical form so comparison is direct.
function TraitBlacklistEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (values.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...values, t].slice(0, 64));
    setDraft("");
  };
  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <Kicker>traits you don't want said about you</Kicker>
      <div
        className="margin-note"
        style={{ marginTop: 6, marginBottom: 10, fontSize: 11.5, fontStyle: "italic" }}
      >
        These traits are stripped from the impression picker when
        someone opens it for you. They never see what you've
        blocked — the option just isn't there.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {values.map((t) => (
          <span
            key={t}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.06em",
              padding: "3px 8px",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              color: "var(--ink-2)",
              display: "inline-flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== t))}
              aria-label="remove"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink-3)",
                cursor: "pointer",
                padding: 0,
                fontSize: 11,
              }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. intense"
          style={{
            flex: 1,
            padding: "8px 10px",
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 8,
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--ink)",
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          style={{
            padding: "8px 14px",
            background: draft.trim() ? "var(--ink)" : "var(--paper-3)",
            color: draft.trim() ? "var(--paper)" : "var(--ink-3)",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            cursor: draft.trim() ? "pointer" : "default",
          }}
        >
          BLOCK
        </button>
      </div>
    </div>
  );
}

interface SharingOverlayProps {
  onClose: () => void;
}

export function SharingOverlay({ onClose }: SharingOverlayProps) {
  const { profile, save } = useProfile();

  // Read prefs off the profile, falling back to per-category default
  // when unset. We don't keep a separate local state — every change
  // goes through save() so the dropdowns reflect persisted truth.
  const vals: Record<string, ShareLevel> = {};
  for (const d of SHARE_DATA) {
    vals[d.id] = profile.sharePrefs?.[d.id] ?? d.def;
  }
  const setLevel = (id: string, level: ShareLevel) => {
    const next = { ...(profile.sharePrefs ?? {}), [id]: level };
    void save({ sharePrefs: next });
  };

  const { user } = useAuth();
  const { position, loading: geoLoading, request: requestGeo, denied } =
    useGeolocation();
  const { enabled: discoverable, setEnabled: setDiscoverable, error: discoverableError } =
    useDiscoverableLocation(position);

  const onToggleDiscoverable = async () => {
    const next = !discoverable;
    if (next && !position) {
      // Need a location before we can actually publish anything.
      const p = await requestGeo();
      if (!p) return; // user denied or fetch failed — leave toggle off
    }
    await setDiscoverable(next);
  };

  const tally = LEVELS.map((L) => ({
    ...L,
    n: SHARE_DATA.filter((d) => vals[d.id] === L.id).length,
  }));

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          <em>Sharing</em>
        </div>
        <div style={{ width: 36 }} />
      </div>
      <div className="app-body">
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <Kicker>Sharing tiers</Kicker>
          <div
            className="margin-note"
            style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}
          >
            Each tier shares with more people. <em>Nobody</em> keeps
            something fully private.
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {tally.map((t) => (
              <div
                key={t.id}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "8px 4px",
                  background: `oklch(0.96 0.04 ${t.hue})`,
                  border: `0.5px solid oklch(0.78 0.08 ${t.hue})`,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 22,
                    fontStyle: "italic",
                    color: `oklch(0.40 0.13 ${t.hue})`,
                  }}
                >
                  {t.n}
                </div>
                <div
                  className="kicker"
                  style={{ marginTop: 2, fontSize: 8 }}
                >
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Discoverable-by-nearby toggle — binary, separate from the
            4-level perimeter matrix below. Requires sign-in. */}
        {firebaseEnabled && user && (
          <div
            className="card"
            style={{
              marginBottom: 14,
              padding: 14,
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <Kicker>Discoverable to people nearby</Kicker>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--ink-2)",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  When this is on, your location (rounded to ~100 m) is
                  added to a shared map so people standing roughly near
                  you can show up in their Around tab. Off by default.
                </div>
                {discoverableError && (
                  <div
                    className="margin-note"
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "oklch(0.55 0.16 12)",
                    }}
                  >
                    {discoverableError}
                  </div>
                )}
                {denied && !position && (
                  <div
                    className="margin-note"
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "oklch(0.55 0.16 12)",
                    }}
                  >
                    Location permission denied — re-enable in your
                    device settings to use this.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void onToggleDiscoverable()}
                disabled={geoLoading}
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 32,
                  borderRadius: 999,
                  border: "0.5px solid var(--rule)",
                  background: discoverable ? "var(--accent)" : "var(--paper-2)",
                  position: "relative",
                  cursor: geoLoading ? "wait" : "pointer",
                  opacity: geoLoading ? 0.6 : 1,
                  transition: "background 0.2s",
                }}
                aria-pressed={discoverable}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: discoverable ? 28 : 3,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--paper)",
                    border: "0.5px solid var(--rule)",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {/* Cloud photos toggle — binary opt-in for backing up
            daily-report photos to your private Firebase Storage
            folder. Off by default; the existing privacy contract is
            "photos stay on this device." */}
        {firebaseEnabled && user && (
          <div
            className="card"
            style={{
              marginBottom: 14,
              padding: 14,
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <Kicker>Cloud backup · daily photos</Kicker>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--ink-2)",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  When this is on, photos you attach to a daily report
                  are uploaded to your private cloud bucket so other
                  devices you're signed in on can see them. Off by
                  default — photos stay only on the device that
                  captured them. Cross-user sharing is unaffected.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void save({ cloudPhotos: !profile.cloudPhotos })}
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 32,
                  borderRadius: 999,
                  border: "0.5px solid var(--rule)",
                  background: profile.cloudPhotos
                    ? "var(--accent)"
                    : "var(--paper-2)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                aria-pressed={!!profile.cloudPhotos}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: profile.cloudPhotos ? 28 : 3,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--paper)",
                    border: "0.5px solid var(--rule)",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          </div>
        )}

        <ImpressionAcceptance
          value={
            (profile.acceptImpressionsFrom as
              | "nobody"
              | "circle"
              | "nearby"
              | "anyone"
              | undefined) ?? "circle"
          }
          onChange={(v) => void save({ acceptImpressionsFrom: v })}
        />

        <ImpressionVisibility
          value={
            (profile.shareImpressionsAbout as
              | "nobody"
              | "circle"
              | "nearby"
              | "anyone"
              | undefined) ?? "nobody"
          }
          onChange={(v) => void save({ shareImpressionsAbout: v })}
        />

        <TraitBlacklistEditor
          values={profile.blockedImpressionTraits ?? []}
          onChange={(next) =>
            void save({ blockedImpressionTraits: next })
          }
        />

        <Kicker>Per-category settings</Kicker>
        <div
          className="margin-note"
          style={{ marginTop: 6, marginBottom: 10, fontSize: 11.5, fontStyle: "italic" }}
        >
          Daily reports are enforced server-side — your circle only
          reads what you've set to <em>circle</em> or wider. Other
          categories save your intent for when cross-user reads land.
        </div>
        <div>
          {SHARE_DATA.map((item) => (
            <ShareRow
              key={item.id}
              item={item}
              value={vals[item.id]}
              onChange={(v) => setLevel(item.id, v)}
            />
          ))}
        </div>

        <hr className="rule-dashed" />
        <Kicker>Anonymized in aggregate</Kicker>
        <div className="margin-note" style={{ marginTop: 8, fontSize: 12 }}>
          City and world averages always include your numbers — but stripped of
          your name. There is no way to opt out and still see them; it would be
          one-way mirror.
        </div>

        <hr className="rule-dashed" />
        <Kicker>The legal bit</Kicker>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
          }}
        >
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener"
            style={{ color: "var(--ink-2)" }}
          >
            ↗ privacy policy
          </a>
          <a
            href="/terms.html"
            target="_blank"
            rel="noopener"
            style={{ color: "var(--ink-2)" }}
          >
            ↗ terms of service
          </a>
        </div>
      </div>
    </div>
  );
}
