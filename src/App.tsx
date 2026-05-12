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

function AppShell() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = (id: TabId) =>
    TABS.some((x) => x.id === id) ? id : "around";
  const [tab, setTab] = useState<TabId>(validTab(t.tab));
  const [, setPerson] = useState<AnyPerson | null>(null);
  const [, setCity] = useState<CitySeed | null>(null);

  useEffect(() => {
    const v = validTab(t.tab);
    if (v !== tab) setTab(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.tab]);
  useEffect(() => {
    if (t.tab !== tab) setTweak("tab", tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const me = IS_DATA.me;
  const appClasses = `app paper-grain ${t.dark ? "dark" : ""} ${
    t.density || "regular"
  }`;

  return (
    <IOSDevice width={402} height={874} dark={t.dark}>
      <div className={appClasses} data-tab={tab}>
        <header className="app-header">
          <button className="avatar-btn">{me.initials}</button>
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

        <nav className="tabbar">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              className={"tab-btn" + (tab === id ? " is-active" : "")}
              onClick={() => setTab(id)}
            >
              <span className="glyph">
                <NavGlyph id={id} active={tab === id} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
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
