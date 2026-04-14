import { useState } from 'react';
import { Globe, Building2, Sparkles, MapPin, Users, Eye } from 'lucide-react';
import WorldTab from './components/World/WorldTab';
import CityTab from './components/City/CityTab';
import InterestsTab from './components/Interests/InterestsTab';
import NearbyTab from './components/Nearby/NearbyTab';
import FriendsTab from './components/Friends/FriendsTab';
import type { TabCategory } from './types';

const tabs: { id: TabCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'world', label: 'World', icon: <Globe size={16} /> },
  { id: 'city', label: 'City', icon: <Building2 size={16} /> },
  { id: 'interests', label: 'Interests', icon: <Sparkles size={16} /> },
  { id: 'nearby', label: 'Nearby', icon: <MapPin size={16} /> },
  { id: 'friends', label: 'Friends', icon: <Users size={16} /> },
];

const tabComponents: Record<TabCategory, React.ReactNode> = {
  world: <WorldTab />,
  city: <CityTab />,
  interests: <InterestsTab />,
  nearby: <NearbyTab />,
  friends: <FriendsTab />,
};

function App() {
  const [activeTab, setActiveTab] = useState<TabCategory>('world');

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="logo-icon">
            <Eye size={18} color="white" />
          </div>
          In<span className="logo-dot">Sight</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Personal Insight Dashboard
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            data-tab={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="tab-content" key={activeTab}>
        {tabComponents[activeTab]}
      </main>
    </div>
  );
}

export default App;
