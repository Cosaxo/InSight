import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CityRatings, TabId } from "./types";
import {
  firebaseEnabled,
  migrateFromLocal,
  profileExists,
  warmFirebase,
} from "./lib/firebase";
import { useAuth } from "./lib/useAuth";
import { useMe } from "./lib/useMe";
import { readLegacyDailyReport } from "./lib/useDailyReport";
import { useTweaks } from "./lib/useTweaks";
import { IOSDevice } from "./components/shared/IOSDevice";
import { OverlayErrorBoundary } from "./components/shared/OverlayErrorBoundary";
import { NavGlyph } from "./components/icons/NavGlyph";
import { AroundTab } from "./components/tabs/AroundTab";
import { WorldTab } from "./components/tabs/WorldTab";
import { CityTab } from "./components/tabs/CityTab";
import { GroupsTab } from "./components/tabs/GroupsTab";
import { PeopleTab } from "./components/tabs/PeopleTab";
import type { NearbyPerson } from "./components/tabs/AroundTab";
import type { CitySeed } from "./components/tabs/WorldTab";
import type { CirclePerson } from "./components/tabs/PeopleTab";
import { LoadingScreen, LoginScreen } from "./components/panels/LoginScreen";
import {
  TweakRadio,
  TweakSection,
  TweakSelect,
  TweakToggle,
  TweaksPanel,
} from "./components/shared/TweaksPanel";
import type { PersonForOverlay } from "./components/overlays/PersonOverlay";
import { useDailyReport } from "./lib/useDailyReport";

// Overlays are off the critical path — none of them render on first paint.
// Lazy-load each into its own chunk so the initial JS stays small.
const PersonOverlay = lazy(() =>
  import("./components/overlays/PersonOverlay").then((m) => ({
    default: m.PersonOverlay,
  })),
);
const ProfileOverlay = lazy(() =>
  import("./components/overlays/ProfileOverlay").then((m) => ({
    default: m.ProfileOverlay,
  })),
);
const InsightsOverlay = lazy(() =>
  import("./components/overlays/InsightsOverlay").then((m) => ({
    default: m.InsightsOverlay,
  })),
);
const TestOverlay = lazy(() =>
  import("./components/overlays/TestOverlay").then((m) => ({
    default: m.TestOverlay,
  })),
);
const CityOverlay = lazy(() =>
  import("./components/overlays/CityOverlay").then((m) => ({
    default: m.CityOverlay,
  })),
);
const SharingOverlay = lazy(() =>
  import("./components/overlays/SharingOverlay").then((m) => ({
    default: m.SharingOverlay,
  })),
);
const DnaOverlay = lazy(() =>
  import("./components/overlays/DnaOverlay").then((m) => ({
    default: m.DnaOverlay,
  })),
);
const ScrapbookOverlay = lazy(() =>
  import("./components/overlays/ScrapbookOverlay").then((m) => ({
    default: m.ScrapbookOverlay,
  })),
);
const BodyOverlay = lazy(() =>
  import("./components/overlays/BodyOverlay").then((m) => ({
    default: m.BodyOverlay,
  })),
);
const DaysOverlay = lazy(() =>
  import("./components/overlays/DaysOverlay").then((m) => ({
    default: m.DaysOverlay,
  })),
);
const DailyReportOverlay = lazy(() =>
  import("./components/overlays/DailyReportOverlay").then((m) => ({
    default: m.DailyReportOverlay,
  })),
);
const ImpressionsOverlay = lazy(() =>
  import("./components/overlays/ImpressionsOverlay").then((m) => ({
    default: m.ImpressionsOverlay,
  })),
);
const LifeOverlay = lazy(() =>
  import("./components/overlays/LifeOverlay").then((m) => ({
    default: m.LifeOverlay,
  })),
);
const AddPersonFlow = lazy(() =>
  import("./components/overlays/AddPersonFlow").then((m) => ({
    default: m.AddPersonFlow,
  })),
);

// Minimal placeholder shown for the few frames between an overlay being
// requested and its chunk arriving. Matches the overlay-base styling so
// the visual transition is invisible.
function OverlayFallback() {
  return <div className="overlay paper-grain" aria-busy="true" />;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "around", label: "around" },
  { id: "world", label: "world" },
  { id: "city", label: "city" },
  { id: "groups", label: "groups" },
  { id: "people", label: "people" },
];

const TWEAK_DEFAULTS = {
  density: "compact" as "compact" | "regular",
  dark: false,
  tab: "around" as TabId,
};

type AnyPerson = NearbyPerson | CirclePerson;

function toOverlayPerson(p: AnyPerson): PersonForOverlay {
  return {
    id: "id" in p ? p.id : undefined,
    init: p.init,
    hue: p.hue,
    name: p.name,
    match: p.match,
    role: "role" in p ? p.role : undefined,
    rel: "rel" in p ? (p as CirclePerson).rel : undefined,
    dist: "dist" in p ? (p as NearbyPerson).dist : undefined,
    note: "note" in p ? (p as NearbyPerson).note : undefined,
    interests: "interests" in p ? p.interests : undefined,
    personality:
      "personality" in p && Array.isArray(p.personality)
        ? (p.personality as number[])
        : undefined,
  };
}

// First sign-in migration — moves any local daily report + city ratings
// up to Firestore the first time a user authenticates against an empty
// profile doc. Runs at most once per session per user.
function useFirstSignInMigration() {
  const { user } = useAuth();
  const ranForUid = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    if (ranForUid.current === user.uid) return;
    ranForUid.current = user.uid;

    (async () => {
      try {
        if (await profileExists(user.uid)) return;
        const local = readLegacyDailyReport();
        let cityRatings: CityRatings = {};
        try {
          cityRatings = JSON.parse(
            localStorage.getItem("insight.cityRatings.v1") || "{}",
          ) as CityRatings;
        } catch {
          // ignore
        }
        await migrateFromLocal(user.uid, {
          profile: {},
          relations: [],
          cityRatings,
          moods: [],
          habits: [],
          workouts: [],
          meals: [],
          transactions: [],
          dailyReport: local
            ? {
                date: local.date,
                mood: local.mood,
                moodLabel: local.moodLabel,
                one_line: local.one_line,
                weather: local.weather,
                hasPhoto: local.hasPhoto,
                photoId: local.photoId,
                shared: local.shared,
              }
            : null,
        });
      } catch (err) {
        console.error("[migration] first-sign-in migration failed:", err);
      }
    })();
  }, [user]);
}

function AppShell() {
  useFirstSignInMigration();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = (id: TabId) =>
    TABS.some((x) => x.id === id) ? id : "around";
  const [tab, setTab] = useState<TabId>(validTab(t.tab));
  const [person, setPerson] = useState<AnyPerson | null>(null);
  const [city, setCity] = useState<CitySeed | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showTest, setShowTest] = useState(false);
  // When set, TestOverlay opens jumped directly into that test kind
  // (used by ProfileOverlay's "take the test" empty-state CTAs).
  const [testInitialKind, setTestInitialKind] = useState<
    "big5" | "political" | "values" | null
  >(null);
  const [showSharing, setShowSharing] = useState(false);
  const [showDna, setShowDna] = useState(false);
  const [showScrap, setShowScrap] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [showDays, setShowDays] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [showImpressions, setShowImpressions] = useState(false);
  const [showLife, setShowLife] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // One-way sync: tweak.tab → tab. Comparing against `tab` inside avoids
  // re-running when tab changes through the second effect below; we
  // genuinely only want to react to tweak changes here.
  useEffect(() => {
    const v = validTab(t.tab);
    if (v !== tab) setTab(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.tab]);
  // Reverse sync: tab → tweak.tab. Same reasoning — depending on `t.tab`
  // would create a feedback loop with the effect above.
  useEffect(() => {
    if (t.tab !== tab) setTweak("tab", tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const closeAll = () => {
    setPerson(null);
    setCity(null);
    setShowProfile(false);
    setShowInsights(false);
    setShowTest(false);
    setShowSharing(false);
    setShowDna(false);
    setShowScrap(false);
    setShowBody(false);
    setShowDays(false);
    setShowDaily(false);
    setShowImpressions(false);
    setShowLife(false);
    setShowAddPerson(false);
    setFabOpen(false);
  };

  const me = useMe();
  const appClasses = `app paper-grain ${t.dark ? "dark" : ""} ${
    t.density || "regular"
  }`;

  const { report: myDaily } = useDailyReport();
  // PeopleTab's DailyReport shape requires `personId` (it's a per-person
  // feed); adapt our own daily report to fit. The auto-stats fields it
  // optionally reads (body/move/nutrition/scrapbook) aren't persisted
  // — they're seed-data-only for other people's feeds.
  const myDailyForFeed = myDaily
    ? { ...myDaily, personId: "me" as const, photo: myDaily.photo ?? undefined }
    : null;

  return (
    <IOSDevice width={402} height={874} dark={t.dark}>
      <div className={appClasses} data-tab={tab}>
        <header className="app-header">
          <button
            className={"avatar-btn" + (showProfile ? " is-on" : "")}
            onClick={() => {
              closeAll();
              setShowProfile(true);
            }}
          >
            {showProfile ? "✕" : me.initials}
          </button>
          <div className="h-title">
            in<em>Sight</em>
          </div>
          <div className="h-meta">
            vol. iii
            <br />
            may '26
          </div>
        </header>

        <div className="app-body">
          {tab === "around" && (
            <AroundTab
              onPerson={setPerson}
              onOpenTest={() => setShowTest(true)}
              onAddPerson={() => setShowAddPerson(true)}
            />
          )}
          {tab === "world" && <WorldTab onCity={setCity} />}
          {tab === "city" && <CityTab />}
          {tab === "groups" && <GroupsTab />}
          {tab === "people" && (
            <PeopleTab
              onPerson={setPerson}
              onOpenDaily={() => setShowDaily(true)}
              onAddPerson={() => setShowAddPerson(true)}
              myDailyReport={myDailyForFeed}
            />
          )}
        </div>

        {fabOpen && (
          <div className="fab-stack">
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowDaily(true);
              }}
            >
              <span style={{ color: "var(--accent)" }}>◉</span> daily report
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowInsights(true);
              }}
            >
              <span style={{ color: "var(--sienna)" }}>✦</span> open journal
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowBody(true);
              }}
            >
              <span style={{ color: "var(--ochre)" }}>◐</span> the body
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowDays(true);
              }}
            >
              <span style={{ color: "var(--indigo)" }}>☾</span> the days
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowScrap(true);
              }}
            >
              <span style={{ color: "var(--sage)" }}>❀</span> the scrapbook
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowImpressions(true);
              }}
            >
              <span style={{ color: "var(--c-people)" }}>❝</span> impressions
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowTest(true);
              }}
            >
              <span style={{ color: "var(--sage)" }}>✎</span> take a test
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowLife(true);
              }}
            >
              <span style={{ color: "var(--accent)" }}>⌇</span> life details
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowSharing(true);
              }}
            >
              <span style={{ color: "var(--ink-2)" }}>◇</span> what you share
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowAddPerson(true);
              }}
            >
              <span style={{ color: "var(--ochre)" }}>+</span> add a person
            </div>
          </div>
        )}
        <button
          className={"fab" + (fabOpen ? " is-open" : "")}
          onClick={() => setFabOpen(!fabOpen)}
        >
          +
        </button>

        <nav className="tabbar">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              className={"tab-btn" + (tab === id ? " is-active" : "")}
              onClick={() => {
                setTab(id);
                closeAll();
              }}
            >
              <span className="glyph">
                <NavGlyph id={id} active={tab === id} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <OverlayErrorBoundary
          resetKey={[
            person ? "person" : "",
            city ? "city" : "",
            showProfile && "profile",
            showInsights && "insights",
            showTest && "test",
            showSharing && "sharing",
            showDna && "dna",
            showScrap && "scrap",
            showBody && "body",
            showDays && "days",
            showDaily && "daily",
            showImpressions && "impressions",
            showLife && "life",
            showAddPerson && "addPerson",
          ]
            .filter(Boolean)
            .join(",")}
          onDismiss={closeAll}
        >
        <Suspense fallback={<OverlayFallback />}>
          {person && (
            <PersonOverlay
              p={toOverlayPerson(person)}
              onClose={() => setPerson(null)}
            />
          )}
          {showProfile && (
            <ProfileOverlay
              onClose={() => setShowProfile(false)}
              onOpenTest={(kind) => {
                setShowProfile(false);
                setTestInitialKind(kind);
                setShowTest(true);
              }}
            />
          )}
          {showInsights && (
            <InsightsOverlay onClose={() => setShowInsights(false)} />
          )}
          {showTest && (
            <TestOverlay
              kind={testInitialKind}
              onClose={() => {
                setShowTest(false);
                setTestInitialKind(null);
              }}
            />
          )}
          {showSharing && (
            <SharingOverlay onClose={() => setShowSharing(false)} />
          )}
          {showDna && <DnaOverlay onClose={() => setShowDna(false)} />}
          {showScrap && (
            <ScrapbookOverlay onClose={() => setShowScrap(false)} />
          )}
          {showBody && <BodyOverlay onClose={() => setShowBody(false)} />}
          {showDays && <DaysOverlay onClose={() => setShowDays(false)} />}
          {showDaily && (
            <DailyReportOverlay onClose={() => setShowDaily(false)} />
          )}
          {showImpressions && (
            <ImpressionsOverlay onClose={() => setShowImpressions(false)} />
          )}
          {showLife && (
            <LifeOverlay
              onClose={() => setShowLife(false)}
              onOpenDna={() => {
                setShowLife(false);
                setShowDna(true);
              }}
            />
          )}
          {city && <CityOverlay city={city} onClose={() => setCity(null)} />}
          {showAddPerson && (
            <AddPersonFlow onClose={() => setShowAddPerson(false)} />
          )}
        </Suspense>
        </OverlayErrorBoundary>
      </div>

      <TweaksPanel>
        <TweakSection label="Aesthetic" />
        <TweakToggle
          label="Dark mode"
          value={t.dark}
          onChange={(v) => setTweak("dark", v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "regular"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakSection label="Navigation" />
        <TweakSelect
          label="Active tab"
          value={t.tab}
          options={TABS.map((x) => x.id)}
          onChange={(v) => setTweak("tab", v)}
        />
      </TweaksPanel>
    </IOSDevice>
  );
}

export default function App() {
  useEffect(() => {
    warmFirebase();
  }, []);

  const { user, loading: authLoading } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;

  if (firebaseEnabled) {
    if (authLoading) return <LoadingScreen />;
    if (!isSignedIn) return <LoginScreen />;
  }

  return <AppShell />;
}
