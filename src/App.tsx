import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT_STACK, SEC } from "./theme";
import type { SectionKey } from "./theme";
import type {
  CityRating,
  CityRatings,
  Habit,
  Hero,
  Me,
  Meal,
  MediaMap,
  MoodEntry,
  Person,
  TabId,
  TestResult,
  TestType,
  Transaction,
  Workout,
} from "./types";
import {
  DEFAULT_MY_DISLIKES,
  DEFAULT_MY_HEROES,
  DEFAULT_MY_LIKES,
  DEFAULT_MY_MEDIA,
} from "./data/constants";
import { INIT_RELATIONS } from "./data/profiles";
import {
  DEFAULT_HABITS,
  DEFAULT_MEALS,
  DEFAULT_MOODS,
  DEFAULT_TRANSACTIONS,
  DEFAULT_WORKOUTS,
  TODAY,
  nextHabitStyle,
} from "./data/insightDefaults";
import { loadState, saveState } from "./utils/storage";
import { firebaseEnabled, googleSignOut } from "./lib/firebase";
import { useAuth } from "./lib/useAuth";
import { useDebounce } from "./lib/useDebounce";
import {
  addHabit as remoteAddHabit,
  addMeal as remoteAddMeal,
  addRelation as remoteAddRelation,
  addTransaction as remoteAddTransaction,
  addWorkout as remoteAddWorkout,
  deleteMood as remoteDeleteMood,
  deleteRelation as remoteDeleteRelation,
  loadProfile,
  migrateFromLocal,
  profileExists,
  saveProfile,
  setCityRating as remoteSetCityRating,
  subscribeCityRatings,
  subscribeHabits,
  subscribeMeals,
  subscribeMoods,
  subscribeRelations,
  subscribeTransactions,
  subscribeWorkouts,
  updateHabit as remoteUpdateHabit,
  updateRelation as remoteUpdateRelation,
  upsertMood as remoteUpsertMood,
} from "./lib/remoteStorage";
import type { RemoteProfile } from "./lib/remoteStorage";
import { AnimationStyles } from "./components/shared/animations";
import {
  IcoAround,
  IcoCity,
  IcoGroups,
  IcoPeople,
  IcoWorld,
} from "./components/icons/NavIcons";
import { AroundTab } from "./components/tabs/AroundTab";
import { WorldTab } from "./components/tabs/WorldTab";
import { CityTab } from "./components/tabs/CityTab";
import { GroupsTab } from "./components/tabs/GroupsTab";
import { PeopleTab } from "./components/tabs/PeopleTab";
import { ProfilePanel } from "./components/panels/ProfilePanel";
import { TestFlow } from "./components/panels/TestFlow";
import { InsightsPanel } from "./components/panels/InsightsPanel";
import { FABStack } from "./components/FAB/FABStack";
import { LoadingScreen, LoginScreen } from "./components/panels/LoginScreen";

interface NavIconProps {
  col: string;
  on?: boolean;
}

const TABS: {
  id: TabId;
  label: string;
  Ico: (p: NavIconProps) => React.ReactElement;
}[] = [
  { id: "around", label: "Around", Ico: IcoAround },
  { id: "world", label: "World", Ico: IcoWorld },
  { id: "city", label: "City", Ico: IcoCity },
  { id: "groups", label: "Groups", Ico: IcoGroups },
  { id: "people", label: "People", Ico: IcoPeople },
];

const TEST_TITLES: Record<TestType, string> = {
  personality: "Personality test",
  political: "Political test",
  values: "Core Values test",
};

const DEFAULT_PERSONALITY = [78, 62, 41, 69, 74];
const DEFAULT_POLITICAL = { econ: -18, social: -15 };
const DEFAULT_CV = { indiv: -18, change: 22 };

function initialsOf(name: string | null | undefined): string {
  if (!name) return "YO";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;

  const [tab, setTab] = useState<TabId>("around");
  const [showProfile, setShowProfile] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [activeTest, setActiveTest] = useState<TestType | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  const initial = useMemo(() => loadState(), []);
  const [personality, setPersonality] = useState<number[]>(
    initial.personality ?? DEFAULT_PERSONALITY,
  );
  const [political, setPolitical] = useState(
    initial.political ?? DEFAULT_POLITICAL,
  );
  const [cv, setCv] = useState(initial.cv ?? DEFAULT_CV);
  const [media, setMedia] = useState<MediaMap>(
    (initial.media as MediaMap) ?? DEFAULT_MY_MEDIA,
  );
  const [likes, setLikes] = useState<string[]>(
    initial.likes ?? DEFAULT_MY_LIKES,
  );
  const [dislikes, setDislikes] = useState<string[]>(
    initial.dislikes ?? DEFAULT_MY_DISLIKES,
  );
  const [heroes, setHeroes] = useState<Hero[]>(
    initial.heroes ?? DEFAULT_MY_HEROES,
  );
  const [relations, setRelations] = useState<Person[]>(
    (initial.relations as Person[]) ?? INIT_RELATIONS,
  );
  const [cityRatings, setCityRatings] = useState<CityRatings>(
    (initial.cityRatings as CityRatings) ?? {},
  );
  const [moods, setMoods] = useState<MoodEntry[]>(
    (initial.moods as MoodEntry[]) ?? DEFAULT_MOODS,
  );
  const [habits, setHabits] = useState<Habit[]>(
    (initial.habits as Habit[]) ?? DEFAULT_HABITS,
  );
  const [workouts, setWorkouts] = useState<Workout[]>(
    (initial.workouts as Workout[]) ?? DEFAULT_WORKOUTS,
  );
  const [meals, setMeals] = useState<Meal[]>(
    (initial.meals as Meal[]) ?? DEFAULT_MEALS,
  );
  const [transactions, setTransactions] = useState<Transaction[]>(
    (initial.transactions as Transaction[]) ?? DEFAULT_TRANSACTIONS,
  );

  // ── Remote load + subscriptions ─────────────────────────────────
  //
  // When a user signs in for the first time (no profile doc yet) we seed
  // their Firestore subtree from the current local state and then rely on
  // subscriptions to keep things in sync. Returning users load their
  // profile doc before we subscribe so we don't flash defaults.
  const profileLoadedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user) {
      profileLoadedRef.current = false;
      return;
    }

    const uid = user.uid;
    let cancelled = false;
    let unsubs: (() => void)[] = [];

    (async () => {
      try {
        const existing = await profileExists(uid);
        if (!existing) {
          await migrateFromLocal(uid, {
            profile: { personality, political, cv, media, likes, dislikes, heroes },
            relations,
            cityRatings,
            moods,
            habits,
            workouts,
            meals,
            transactions,
          });
        } else {
          const remote = await loadProfile(uid);
          if (!cancelled && remote) applyRemoteProfile(remote);
        }

        if (cancelled) return;
        profileLoadedRef.current = true;

        unsubs = [
          subscribeRelations(uid, setRelations),
          subscribeCityRatings(uid, setCityRatings),
          subscribeMoods(uid, (items) =>
            setMoods(
              [...items].sort((a, b) => (a.date < b.date ? 1 : -1)),
            ),
          ),
          subscribeHabits(uid, setHabits),
          subscribeWorkouts(uid, (items) =>
            setWorkouts(
              [...items].sort((a, b) => (a.date < b.date ? 1 : -1)),
            ),
          ),
          subscribeMeals(uid, (items) =>
            setMeals(
              [...items].sort((a, b) => (a.date < b.date ? 1 : -1)),
            ),
          ),
          subscribeTransactions(uid, (items) =>
            setTransactions(
              [...items].sort((a, b) => (a.date < b.date ? 1 : -1)),
            ),
          ),
        ];
      } catch (err) {
        console.error("[app] remote bootstrap failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      profileLoadedRef.current = false;
    };
    // Intentionally narrow deps — we only want this to run on auth change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user?.uid]);

  function applyRemoteProfile(p: RemoteProfile) {
    if (p.personality) setPersonality(p.personality);
    if (p.political) setPolitical(p.political);
    if (p.cv) setCv(p.cv);
    if (p.media) setMedia(p.media);
    if (p.likes) setLikes(p.likes);
    if (p.dislikes) setDislikes(p.dislikes);
    if (p.heroes) setHeroes(p.heroes);
  }

  // ── Persistence effects ─────────────────────────────────────────

  // Local-only: mirror everything into localStorage (preserves the guest /
  // Firebase-disabled flow).
  useEffect(() => {
    if (isSignedIn) return;
    saveState({
      personality,
      political,
      cv,
      media,
      likes,
      dislikes,
      heroes,
      relations,
      cityRatings,
      moods,
      habits,
      workouts,
      meals,
      transactions,
    });
  }, [
    isSignedIn,
    personality,
    political,
    cv,
    media,
    likes,
    dislikes,
    heroes,
    relations,
    cityRatings,
    moods,
    habits,
    workouts,
    meals,
    transactions,
  ]);

  // Remote profile save: debounced to avoid thrashing on rapid edits.
  const debouncedSaveProfile = useDebounce((uid: string, patch: RemoteProfile) => {
    saveProfile(uid, patch).catch((e) =>
      console.error("[app] saveProfile:", e),
    );
  }, 1500);

  useEffect(() => {
    if (!isSignedIn || !user || !profileLoadedRef.current) return;
    debouncedSaveProfile(user.uid, {
      personality,
      political,
      cv,
      media,
      likes,
      dislikes,
      heroes,
    });
  }, [
    isSignedIn,
    user,
    debouncedSaveProfile,
    personality,
    political,
    cv,
    media,
    likes,
    dislikes,
    heroes,
  ]);

  // ── Handlers ────────────────────────────────────────────────────

  function handleTestComplete(result: TestResult) {
    if (result.personality) setPersonality(result.personality);
    if (result.political) setPolitical(result.political);
    if (result.cv) setCv(result.cv);
    setActiveTest(null);
  }

  async function handleSignOut() {
    await googleSignOut();
    // Reset state back to defaults so the next sign-in is clean.
    setPersonality(DEFAULT_PERSONALITY);
    setPolitical(DEFAULT_POLITICAL);
    setCv(DEFAULT_CV);
    setMedia(DEFAULT_MY_MEDIA);
    setLikes(DEFAULT_MY_LIKES);
    setDislikes(DEFAULT_MY_DISLIKES);
    setHeroes(DEFAULT_MY_HEROES);
    setRelations(INIT_RELATIONS);
    setCityRatings({});
    setMoods(DEFAULT_MOODS);
    setHabits(DEFAULT_HABITS);
    setWorkouts(DEFAULT_WORKOUTS);
    setMeals(DEFAULT_MEALS);
    setTransactions(DEFAULT_TRANSACTIONS);
    setShowProfile(false);
  }

  function resetDefaults() {
    // Only meaningful in local mode; for signed-in users we expose sign-out.
    setPersonality(DEFAULT_PERSONALITY);
    setPolitical(DEFAULT_POLITICAL);
    setCv(DEFAULT_CV);
    setMedia(DEFAULT_MY_MEDIA);
    setLikes(DEFAULT_MY_LIKES);
    setDislikes(DEFAULT_MY_DISLIKES);
    setHeroes(DEFAULT_MY_HEROES);
    setRelations(INIT_RELATIONS);
    setCityRatings({});
    setMoods(DEFAULT_MOODS);
    setHabits(DEFAULT_HABITS);
    setWorkouts(DEFAULT_WORKOUTS);
    setMeals(DEFAULT_MEALS);
    setTransactions(DEFAULT_TRANSACTIONS);
    setShowProfile(false);
  }

  // Sub-collection writes fan out to both local state (so the UI updates
  // immediately) and Firestore when signed in (the subscription will later
  // reconcile). In local mode they only touch state.
  function logMood(entry: MoodEntry) {
    setMoods((prev) => [entry, ...prev.filter((m) => m.date !== entry.date)]);
    if (isSignedIn && user) {
      remoteUpsertMood(user.uid, entry).catch((e) =>
        console.error("[app] upsertMood:", e),
      );
    }
  }

  function deleteMood(date: string) {
    setMoods((prev) => prev.filter((m) => m.date !== date));
    if (isSignedIn && user) {
      remoteDeleteMood(user.uid, date).catch((e) =>
        console.error("[app] deleteMood:", e),
      );
    }
  }

  function toggleHabit(id: string) {
    let updated: Habit | undefined;
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const done = h.completions.includes(TODAY);
        updated = {
          ...h,
          completions: done
            ? h.completions.filter((d) => d !== TODAY)
            : [TODAY, ...h.completions],
        };
        return updated;
      }),
    );
    if (isSignedIn && user && updated) {
      remoteUpdateHabit(user.uid, id, {
        completions: updated.completions,
      }).catch((e) => console.error("[app] updateHabit:", e));
    }
  }

  function addHabit(name: string) {
    const style = nextHabitStyle(habits.length);
    const habit: Habit = {
      id: `h${Date.now()}`,
      name,
      icon: style.icon,
      color: style.color,
      completions: [],
    };
    setHabits((prev) => [...prev, habit]);
    if (isSignedIn && user) {
      remoteAddHabit(user.uid, habit).catch((e) =>
        console.error("[app] addHabit:", e),
      );
    }
  }

  function logWorkout(w: Omit<Workout, "id">) {
    const entry: Workout = { id: `w${Date.now()}`, ...w };
    setWorkouts((prev) => [entry, ...prev]);
    if (isSignedIn && user) {
      remoteAddWorkout(user.uid, entry).catch((e) =>
        console.error("[app] addWorkout:", e),
      );
    }
  }

  function logMeal(m: Omit<Meal, "id">) {
    const entry: Meal = { id: `m${Date.now()}`, ...m };
    setMeals((prev) => [entry, ...prev]);
    if (isSignedIn && user) {
      remoteAddMeal(user.uid, entry).catch((e) =>
        console.error("[app] addMeal:", e),
      );
    }
  }

  function logTransaction(t: Omit<Transaction, "id">) {
    const entry: Transaction = { id: `t${Date.now()}`, ...t };
    setTransactions((prev) => [entry, ...prev]);
    if (isSignedIn && user) {
      remoteAddTransaction(user.uid, entry).catch((e) =>
        console.error("[app] addTransaction:", e),
      );
    }
  }

  function rateCity(
    cityName: string,
    key: keyof CityRating,
    value: number,
  ) {
    setCityRatings((prev) => ({
      ...prev,
      [cityName]: { ...(prev[cityName] || {}), [key]: value },
    }));
    if (isSignedIn && user) {
      remoteSetCityRating(user.uid, cityName, key, value).catch((e) =>
        console.error("[app] setCityRating:", e),
      );
    }
  }

  // Relations get a setter-style wrapper so PeopleTab can stay agnostic.
  function setRelationsSmart(
    updater: Person[] | ((prev: Person[]) => Person[]),
  ) {
    setRelations((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!isSignedIn || !user) return next;

      const uid = user.uid;
      const prevById = new Map(prev.map((p) => [p.id, p]));
      const nextById = new Map(next.map((p) => [p.id, p]));

      for (const p of next) {
        const old = prevById.get(p.id);
        if (!old) {
          remoteAddRelation(uid, p).catch((e) =>
            console.error("[app] addRelation:", e),
          );
        } else if (JSON.stringify(old) !== JSON.stringify(p)) {
          remoteUpdateRelation(uid, p.id, p).catch((e) =>
            console.error("[app] updateRelation:", e),
          );
        }
      }
      for (const p of prev) {
        if (!nextById.has(p.id)) {
          remoteDeleteRelation(uid, p.id).catch((e) =>
            console.error("[app] deleteRelation:", e),
          );
        }
      }
      return next;
    });
  }

  // ── Auth gating ─────────────────────────────────────────────────

  if (firebaseEnabled && authLoading) {
    return <LoadingScreen />;
  }
  if (firebaseEnabled && !user) {
    return <LoginScreen />;
  }

  const displayName = user?.displayName || "You";
  const photoURL = user?.photoURL || null;
  const me: Me = {
    personality,
    political,
    cv,
    media,
    likes,
    dislikes,
    heroes,
    displayName,
    photoURL,
  };

  const isContent = !showProfile && !activeTest && !showInsights;

  const headerTitle = showInsights
    ? "Personal Insights"
    : showProfile
      ? "Profile"
      : activeTest
        ? TEST_TITLES[activeTest]
        : tab.charAt(0).toUpperCase() + tab.slice(1);

  function renderContent() {
    if (activeTest) {
      return (
        <TestFlow
          type={activeTest}
          onComplete={handleTestComplete}
          onCancel={() => setActiveTest(null)}
        />
      );
    }
    if (showProfile) {
      return (
        <ProfilePanel
          me={me}
          onClose={() => setShowProfile(false)}
          onTest={(t) => {
            setActiveTest(t);
            setShowProfile(false);
          }}
          onUpdateMedia={setMedia}
          onUpdateLikes={setLikes}
          onUpdateDislikes={setDislikes}
          onUpdateHeroes={setHeroes}
          onResetDefaults={resetDefaults}
          onSignOut={isSignedIn ? handleSignOut : undefined}
          signedIn={isSignedIn}
        />
      );
    }
    if (showInsights) {
      return (
        <InsightsPanel
          onClose={() => setShowInsights(false)}
          moods={moods}
          habits={habits}
          workouts={workouts}
          meals={meals}
          transactions={transactions}
          onLogMood={logMood}
          onDeleteMood={deleteMood}
          onToggleHabit={toggleHabit}
          onAddHabit={addHabit}
          onLogWorkout={logWorkout}
          onLogMeal={logMeal}
          onLogTransaction={logTransaction}
        />
      );
    }
    switch (tab) {
      case "around":
        return <AroundTab me={me} />;
      case "world":
        return <WorldTab me={me} />;
      case "city":
        return <CityTab me={me} ratings={cityRatings} onRate={rateCity} />;
      case "groups":
        return <GroupsTab me={me} />;
      case "people":
        return (
          <PeopleTab
            me={me}
            relations={relations}
            setRelations={setRelationsSmart}
          />
        );
    }
  }

  const headerInitials = initialsOf(user?.displayName);

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        overflow: "hidden",
        fontFamily: FONT_STACK,
      }}
    >
      <AnimationStyles />

      <header
        style={{
          flexShrink: 0,
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          background: C.card,
          borderBottom: `2px solid ${
            isContent
              ? (SEC[tab as SectionKey]?.accent || C.teal) + "30"
              : C.divider
          }`,
        }}
      >
        <button
          onClick={() => {
            setShowProfile((p) => !p);
            setActiveTest(null);
            setShowInsights(false);
            setFabOpen(false);
          }}
          aria-label={showProfile ? "Close profile" : "Open profile"}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: showProfile ? C.teal : `${C.teal}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: showProfile ? "#fff" : C.teal,
            boxShadow: showProfile ? `0 2px 10px ${C.teal}45` : "none",
            overflow: "hidden",
            padding: 0,
            transition: "all 0.2s",
          }}
        >
          {showProfile ? (
            <span style={{ fontSize: 14 }}>✕</span>
          ) : photoURL ? (
            <img
              src={photoURL}
              alt=""
              referrerPolicy="no-referrer"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            headerInitials
          )}
        </button>

        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: C.navy,
            letterSpacing: "-0.4px",
          }}
        >
          {headerTitle}
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            opacity: 0.28,
          }}
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 21 21"
            fill="none"
            stroke={C.navy}
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <rect x="2" y="3" width="17" height="16" rx="2" />
            <path d="M6.5 1.5v3M14.5 1.5v3M2 8.5h17" />
          </svg>
          <svg
            width="21"
            height="21"
            viewBox="0 0 21 21"
            fill="none"
            stroke={C.navy}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18.5 3h-16a1 1 0 00-1 1v10a1 1 0 001 1h4l3.5 3.5 3.5-3.5h5a1 1 0 001-1V4a1 1 0 00-1-1z" />
          </svg>
          <svg
            width="21"
            height="21"
            viewBox="0 0 21 21"
            fill="none"
            stroke={C.navy}
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M14 14L18.5 18.5" />
          </svg>
        </div>
      </header>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflowY: "auto",
            padding: "16px 16px 100px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {renderContent()}
        </div>
        {isContent && (
          <FABStack
            tab={tab}
            open={fabOpen}
            onToggle={() => setFabOpen((o) => !o)}
            onInsights={() => {
              setShowInsights(true);
              setFabOpen(false);
            }}
          />
        )}
      </div>

      {isContent && (
        <nav
          style={{
            flexShrink: 0,
            background: C.card,
            borderTop: `1.5px solid ${C.divider}`,
            paddingBottom: "env(safe-area-inset-bottom, 4px)",
            display: "flex",
          }}
        >
          {TABS.map(({ id, label, Ico }) => {
            const active = tab === id;
            const tabColor = SEC[id as SectionKey]?.accent || C.teal;
            return (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setFabOpen(false);
                }}
                aria-label={label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: "8px 2px 6px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  minHeight: 58,
                  position: "relative",
                }}
              >
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "20%",
                      right: "20%",
                      height: 3,
                      borderRadius: "0 0 4px 4px",
                      background: tabColor,
                    }}
                  />
                )}
                <Ico col={active ? tabColor : C.muted} on={active} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 400,
                    color: active ? tabColor : C.muted,
                    letterSpacing: "0.1px",
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
