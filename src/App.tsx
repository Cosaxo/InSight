import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type {
  Book,
  CityRatings,
  Dream,
  Habit,
  Home,
  Impression,
  Job,
  Language,
  Meal,
  Milestone,
  MoodEntry,
  RemoteDailyReport,
  Specimen,
  TabId,
  TimeBlock,
  Transaction,
  Visit,
  Weighin,
  Workout,
} from "./types";
import type { RemoteProfile } from "./lib/firebase";
import {
  firebaseEnabled,
  migrateFromLocal,
  profileExists,
  warmFirebase,
} from "./lib/firebase";
import { useAuth } from "./lib/useAuth";
import { useMe } from "./lib/useMe";
import {
  userPersonToPerson,
  type UserPerson,
} from "./lib/useRelations";
import { readLegacyDailyReport } from "./lib/useDailyReport";
import { useTweaks } from "./lib/useTweaks";
import { IOSDevice } from "./components/shared/IOSDevice";
import { OverlayErrorBoundary } from "./components/shared/OverlayErrorBoundary";
import { NavGlyph } from "./components/icons/NavGlyph";
import { AroundTab } from "./components/tabs/AroundTab";
import { WorldTab } from "./components/tabs/WorldTab";
import { CityTab } from "./components/tabs/CityTab";
import { InterestsTab } from "./components/tabs/InterestsTab";
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
import { useProfile } from "./lib/useProfile";
import { WelcomeFlow } from "./components/overlays/WelcomeFlow";
import { isOnboarded, type WelcomeHint } from "./lib/onboarding";

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
  { id: "interests", label: "interests" },
  { id: "people", label: "people" },
  { id: "around", label: "around" },
  { id: "city", label: "city" },
  { id: "world", label: "world" },
];

const TWEAK_DEFAULTS = {
  density: "compact" as "compact" | "regular",
  dark: false,
  tab: "around" as TabId,
};

type AnyPerson = NearbyPerson | CirclePerson;

// TodayPill — persistent quick-write entry point in the app
// header. Replaces the old vol./date display. Two states:
//   - report exists today → mood label + a small coloured dot
//   - report missing      → "+ today" CTA
// Tap opens DailyReportOverlay. The mood-to-colour mapping mirrors
// the slider gradient in DailyReportOverlay's mood section.
function TodayPill({
  mood,
  moodLabel,
  onOpen,
}: {
  mood: number | null;
  moodLabel: string | null;
  onOpen: () => void;
}) {
  const hasReport = mood != null && moodLabel != null;
  // Map mood (0..100) into a warm-to-cool hue band: low=warm
  // sienna, mid=ochre, high=sage. Matches the literal mood
  // language we land on ("low", "steady", "bright").
  const dotColor = !hasReport
    ? "var(--ink-3)"
    : mood < 35
      ? "oklch(0.55 0.16 30)"
      : mood < 65
        ? "oklch(0.65 0.13 65)"
        : "oklch(0.60 0.13 145)";
  return (
    <button
      onClick={onOpen}
      style={{
        background: "transparent",
        border: "0.5px solid var(--rule)",
        borderRadius: 999,
        padding: "5px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        color: hasReport ? "var(--ink-2)" : "var(--ink-3)",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
      aria-label={hasReport ? `today's mood: ${moodLabel}` : "write today's report"}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />
      {hasReport ? moodLabel : "+ today"}
    </button>
  );
}

function toOverlayPerson(p: AnyPerson): PersonForOverlay {
  return {
    id: "id" in p ? p.id : undefined,
    init: p.init,
    hue: p.hue,
    name: p.name,
    // PersonOverlay expects a numeric match; coalesce the "unknown"
    // case to 50 (neutral) so the overlay's existing rendering works.
    match: p.match ?? 50,
    role: "role" in p ? p.role : undefined,
    rel: "rel" in p ? (p as CirclePerson).rel : undefined,
    dist: "dist" in p ? (p as NearbyPerson).dist : undefined,
    note: "note" in p ? (p as NearbyPerson).note : undefined,
    interests: "interests" in p ? p.interests : undefined,
    personality:
      "personality" in p && Array.isArray(p.personality)
        ? (p.personality as number[])
        : undefined,
    politicalAxes:
      "politicalAxes" in p && p.politicalAxes
        ? (p.politicalAxes as Record<string, number>)
        : undefined,
    morals:
      "morals" in p && p.morals
        ? (p.morals as Record<string, number>)
        : undefined,
    age: "age" in p && typeof p.age === "number" && p.age > 0 ? p.age : undefined,
    country: "country" in p ? (p as NearbyPerson).country : undefined,
    gender: "gender" in p ? (p as NearbyPerson).gender : undefined,
    political:
      "political" in p && (p as NearbyPerson).political
        ? (p as NearbyPerson).political
        : undefined,
    interestNames:
      "interestNames" in p && Array.isArray((p as NearbyPerson).interestNames)
        ? (p as NearbyPerson).interestNames
        : undefined,
    blockedImpressionTraits:
      "blockedImpressionTraits" in p && Array.isArray((p as NearbyPerson).blockedImpressionTraits)
        ? (p as NearbyPerson).blockedImpressionTraits
        : undefined,
    shareImpressionsAbout:
      "shareImpressionsAbout" in p &&
      typeof (p as NearbyPerson).shareImpressionsAbout === "string"
        ? ((p as NearbyPerson).shareImpressionsAbout as
            | "nobody"
            | "circle"
            | "nearby"
            | "anyone")
        : undefined,
    linkedUid:
      "linkedUid" in p && typeof p.linkedUid === "string"
        ? p.linkedUid
        : undefined,
  };
}

// Read a JSON array from localStorage, returning [] on parse error or
// when the key isn't set. Used by the first-sign-in migration to
// sweep every typed-item subcollection's local cache up to Firestore.
function readLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// Same, for the profile object (single doc rather than an array).
function readLocalProfile(): RemoteProfile {
  try {
    const raw = localStorage.getItem("insight.profile.v1");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as RemoteProfile)
      : {};
  } catch {
    return {};
  }
}

// First sign-in migration — moves every locally-cached subcollection
// up to Firestore the first time a user authenticates against an
// empty profile doc. Runs at most once per session per user.
//
// Why this exists: the typed-item hooks (useMeals, useWeighins,
// useImpressions, …) all store to localStorage when signed out so
// the app is fully usable without an account. When the user finally
// signs in, the hooks subscribe to Firestore — which returns []
// for a fresh account — and would otherwise overwrite the local
// cache. This migration runs first and pushes everything up so the
// subscription sees the migrated docs.
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

        // Snapshot every locally-cached subcollection. Each key
        // matches its hook's STORAGE constant; if you add another
        // typed-item hook, add the corresponding read here.
        const profile = readLocalProfile();
        // Relations are stored locally as UserPerson; the migration
        // expects the legacy Person shape, so we convert.
        const localUserPeople = readLocalArray<UserPerson>(
          "insight.relations.v1",
        );
        const relations = localUserPeople.map(userPersonToPerson);
        const moods = readLocalArray<MoodEntry>("insight.moods.v1");
        const habits = readLocalArray<Habit>("insight.habits.v1");
        const workouts = readLocalArray<Workout>("insight.workouts.v1");
        const meals = readLocalArray<Meal>("insight.meals.v1");
        const transactions = readLocalArray<Transaction>(
          "insight.transactions.v1",
        );
        const specimens = readLocalArray<Specimen>("insight.scrapbook.v1");
        const dreams = readLocalArray<Dream>("insight.dreams.v1");
        const impressions = readLocalArray<Impression>("insight.impressions.v1");
        const weighins = readLocalArray<Weighin>("insight.weighins.v1");
        const books = readLocalArray<Book>("insight.books.v1");
        const visits = readLocalArray<Visit>("insight.visits.v1");
        const homes = readLocalArray<Home>("insight.homes.v1");
        const languages = readLocalArray<Language>("insight.languages.v1");
        const jobs = readLocalArray<Job>("insight.jobs.v1");
        const milestones = readLocalArray<Milestone>("insight.milestones.v1");
        const timeBlocks = readLocalArray<TimeBlock>(
          "insight.time_blocks.v1",
        );
        const skills = readLocalArray<{ id: string }>("insight.skills.v1");

        await migrateFromLocal(user.uid, {
          profile,
          relations,
          cityRatings,
          moods,
          habits,
          workouts,
          meals,
          transactions,
          specimens,
          dreams,
          impressions,
          weighins,
          books,
          visits,
          homes,
          languages,
          jobs,
          milestones,
          timeBlocks,
          skills,
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
          dailyReportHistory: readLocalArray<RemoteDailyReport>(
            "insight.dailyReport.history.v1",
          ),
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
    "big5" | "political" | "values" | "money" | "chronotype" | "attachment" | null
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

  // First-launch onboarding. Shown when the local "onboarded" flag
  // isn't set AND the profile is empty enough to look new (no birth
  // year + no weight). The second clause keeps existing users from
  // seeing it after a clean reinstall when their Firestore profile
  // syncs back. The hint returned from WelcomeFlow decides which
  // surface to open after the user finishes.
  const { profile } = useProfile();
  const profileLooksNew = !profile.birthYear && !profile.weightKg;
  const [showWelcome, setShowWelcome] = useState(
    () => !isOnboarded() && profileLooksNew,
  );
  const handleWelcomeDone = (hint: WelcomeHint) => {
    setShowWelcome(false);
    if (hint === "daily") setShowDaily(true);
    else if (hint === "test") {
      setTestInitialKind("big5");
      setShowTest(true);
    } else if (hint === "around") setTab("around");
  };

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
          <TodayPill
            mood={myDaily?.mood ?? null}
            moodLabel={myDaily?.moodLabel ?? null}
            onOpen={() => {
              closeAll();
              setShowDaily(true);
            }}
          />
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
          {tab === "interests" && <InterestsTab />}
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
              <span style={{ color: "var(--accent)" }}>◉</span> today's report
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowBody(true);
              }}
            >
              <span style={{ color: "var(--ochre)" }}>◐</span> body · meals
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowScrap(true);
              }}
            >
              <span style={{ color: "var(--sage)" }}>❀</span> scrapbook
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
                setShowAddPerson(true);
              }}
            >
              <span style={{ color: "var(--ochre)" }}>+</span> add a person
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowDays(true);
              }}
            >
              <span style={{ color: "var(--indigo)" }}>☾</span> browse days
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowLife(true);
              }}
            >
              <span style={{ color: "var(--accent)" }}>⌇</span> life · skills · achievements
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
          {showWelcome && <WelcomeFlow onComplete={handleWelcomeDone} />}
          {showProfile && (
            <ProfileOverlay
              onClose={() => setShowProfile(false)}
              onOpenTest={(kind) => {
                setShowProfile(false);
                setTestInitialKind(kind);
                setShowTest(true);
              }}
              onOpenSharing={() => {
                setShowProfile(false);
                setShowSharing(true);
              }}
              onOpenJournal={() => {
                setShowProfile(false);
                setShowInsights(true);
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
