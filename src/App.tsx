import { useEffect, useState } from "react";
import type { TabId } from "./types";
import { firebaseEnabled, warmFirebase } from "./lib/firebase";
import { useAuth } from "./lib/useAuth";
import { useTweaks } from "./lib/useTweaks";
import { IOSDevice } from "./components/shared/IOSDevice";
import { NavGlyph } from "./components/icons/NavGlyph";
import { AroundTab } from "./components/tabs/AroundTab";
import type { NearbyPerson } from "./components/tabs/AroundTab";
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

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        textAlign: "center",
        padding: 24,
      }}
    >
      <div className="kicker">— in the works —</div>
      <h2
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 28,
          fontWeight: 400,
        }}
      >
        the <em style={{ color: "var(--accent)" }}>{label}</em> chapter
      </h2>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--ink-3)",
          maxWidth: 280,
        }}
      >
        Coming soon — the next phase of porting will fill this page with the
        proper insights, charts, and stories.
      </p>
    </div>
  );
}

function AppShell() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const validTab = (id: TabId) =>
    TABS.some((x) => x.id === id) ? id : "around";
  const [tab, setTab] = useState<TabId>(validTab(t.tab));
  const [, setPerson] = useState<NearbyPerson | null>(null);

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
          {tab === "world" && <PlaceholderTab label="world" />}
          {tab === "city" && <PlaceholderTab label="city" />}
          {tab === "groups" && <PlaceholderTab label="groups" />}
          {tab === "people" && <PlaceholderTab label="people" />}
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
