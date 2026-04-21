import { useEffect, useState } from "react";
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

interface NavIconProps {
  col: string;
  on?: boolean;
}

const TABS: { id: TabId; label: string; Ico: (p: NavIconProps) => React.ReactElement }[] = [
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

export default function App() {
  const [tab, setTab] = useState<TabId>("around");
  const [showProfile, setShowProfile] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [activeTest, setActiveTest] = useState<TestType | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  const initial = loadState();
  const [personality, setPersonality] = useState<number[]>(
    initial.personality ?? DEFAULT_PERSONALITY,
  );
  const [political, setPolitical] = useState(initial.political ?? DEFAULT_POLITICAL);
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

  // Personal Insights state.
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

  // Persist any of these whenever they change.
  useEffect(() => {
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

  function handleTestComplete(result: TestResult) {
    if (result.personality) setPersonality(result.personality);
    if (result.political) setPolitical(result.political);
    if (result.cv) setCv(result.cv);
    setActiveTest(null);
  }

  function resetDefaults() {
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

  function logMood(entry: MoodEntry) {
    setMoods((prev) => [entry, ...prev.filter((m) => m.date !== entry.date)]);
  }
  function deleteMood(date: string) {
    setMoods((prev) => prev.filter((m) => m.date !== date));
  }
  function toggleHabit(id: string) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const done = h.completions.includes(TODAY);
        return {
          ...h,
          completions: done
            ? h.completions.filter((d) => d !== TODAY)
            : [TODAY, ...h.completions],
        };
      }),
    );
  }
  function addHabit(name: string) {
    setHabits((prev) => {
      const { icon, color } = nextHabitStyle(prev.length);
      return [
        ...prev,
        { id: `h${Date.now()}`, name, icon, color, completions: [] },
      ];
    });
  }
  function logWorkout(w: Omit<Workout, "id">) {
    setWorkouts((prev) => [{ id: `w${Date.now()}`, ...w }, ...prev]);
  }
  function logMeal(m: Omit<Meal, "id">) {
    setMeals((prev) => [{ id: `m${Date.now()}`, ...m }, ...prev]);
  }
  function logTransaction(t: Omit<Transaction, "id">) {
    setTransactions((prev) => [{ id: `t${Date.now()}`, ...t }, ...prev]);
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
  }

  const me: Me = {
    personality,
    political,
    cv,
    media,
    likes,
    dislikes,
    heroes,
    displayName: "You",
    photoURL: null,
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
          <PeopleTab me={me} relations={relations} setRelations={setRelations} />
        );
    }
  }

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
          {showProfile ? <span style={{ fontSize: 14 }}>✕</span> : "YO"}
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
