import { useEffect, useState } from "react";
import type { TabId } from "./types";
import { firebaseEnabled, warmFirebase } from "./lib/firebase";
import { useAuth } from "./lib/useAuth";
import { useTweaks } from "./lib/useTweaks";
import { IOSDevice } from "./components/shared/IOSDevice";
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
import { IS_DATA } from "./data/seedData";
import { PersonOverlay } from "./components/overlays/PersonOverlay";
import type { PersonForOverlay } from "./components/overlays/PersonOverlay";
import { ProfileOverlay } from "./components/overlays/ProfileOverlay";
import { InsightsOverlay } from "./components/overlays/InsightsOverlay";
import { TestOverlay } from "./components/overlays/TestOverlay";
import { CityOverlay } from "./components/overlays/CityOverlay";
import { SharingOverlay } from "./components/overlays/SharingOverlay";
import { DnaOverlay } from "./components/overlays/DnaOverlay";
import { ScrapbookOverlay } from "./components/overlays/ScrapbookOverlay";

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
    init: p.init,
    hue: p.hue,
    name: p.name,
    match: p.match,
    role: "role" in p ? p.role : undefined,
    rel: "rel" in p ? (p as CirclePerson).rel : undefined,
    dist: "dist" in p ? (p as NearbyPerson).dist : undefined,
    note: "note" in p ? (p as NearbyPerson).note : undefined,
    interests: "interests" in p ? p.interests : undefined,
  };
}

function AppShell() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = (id: TabId) =>
    TABS.some((x) => x.id === id) ? id : "around";
  const [tab, setTab] = useState<TabId>(validTab(t.tab));
  const [person, setPerson] = useState<AnyPerson | null>(null);
  const [city, setCity] = useState<CitySeed | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showSharing, setShowSharing] = useState(false);
  const [showDna, setShowDna] = useState(false);
  const [showScrap, setShowScrap] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    const v = validTab(t.tab);
    if (v !== tab) setTab(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.tab]);
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
    setFabOpen(false);
  };

  const me = IS_DATA.me;
  const appClasses = `app paper-grain ${t.dark ? "dark" : ""} ${
    t.density || "regular"
  }`;

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
          {tab === "around" && <AroundTab onPerson={setPerson} />}
          {tab === "world" && <WorldTab onCity={setCity} />}
          {tab === "city" && <CityTab />}
          {tab === "groups" && <GroupsTab />}
          {tab === "people" && <PeopleTab onPerson={setPerson} />}
        </div>

        {fabOpen && (
          <div className="fab-stack">
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
                setShowScrap(true);
              }}
            >
              <span style={{ color: "var(--sage)" }}>❀</span> the scrapbook
            </div>
            <div
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setShowDna(true);
              }}
            >
              <span style={{ color: "var(--c-groups)" }}>⌇</span> your DNA
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
                setShowSharing(true);
              }}
            >
              <span style={{ color: "var(--ink-2)" }}>◇</span> what you share
            </div>
            <div className="fab-item" onClick={() => setFabOpen(false)}>
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

        {person && (
          <PersonOverlay
            p={toOverlayPerson(person)}
            me={me}
            onClose={() => setPerson(null)}
          />
        )}
        {showProfile && (
          <ProfileOverlay onClose={() => setShowProfile(false)} />
        )}
        {showInsights && (
          <InsightsOverlay onClose={() => setShowInsights(false)} />
        )}
        {showTest && <TestOverlay onClose={() => setShowTest(false)} />}
        {showSharing && (
          <SharingOverlay onClose={() => setShowSharing(false)} />
        )}
        {showDna && <DnaOverlay onClose={() => setShowDna(false)} />}
        {showScrap && (
          <ScrapbookOverlay onClose={() => setShowScrap(false)} />
        )}
        {city && <CityOverlay city={city} onClose={() => setCity(null)} />}
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
