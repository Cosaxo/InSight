import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Globe, Compass, Newspaper, Users, Sparkles, TrendingUp } from 'lucide-react';
import SectionCard from '../shared/SectionCard';
import StatBadge from '../shared/StatBadge';
import ProgressBar from '../shared/ProgressBar';
import {
  personalityTraits,
  politicalProfile,
  globalConnections,
  culturalAffinities,
  worldNewsInterests,
  timeUsage,
} from '../../data/mockData';

const personalityData = [
  { trait: 'Openness', value: personalityTraits.openness, fullMark: 100 },
  { trait: 'Conscientiousness', value: personalityTraits.conscientiousness, fullMark: 100 },
  { trait: 'Extraversion', value: personalityTraits.extraversion, fullMark: 100 },
  { trait: 'Agreeableness', value: personalityTraits.agreeableness, fullMark: 100 },
  { trait: 'Neuroticism', value: personalityTraits.neuroticism, fullMark: 100 },
];

const connectionsByType = [
  { type: 'Friend', count: globalConnections.filter(c => c.type === 'friend').length, color: '#ec4899' },
  { type: 'Colleague', count: globalConnections.filter(c => c.type === 'colleague').length, color: '#6366f1' },
  { type: 'Family', count: globalConnections.filter(c => c.type === 'family').length, color: '#10b981' },
  { type: 'Acquaintance', count: globalConnections.filter(c => c.type === 'acquaintance').length, color: '#f59e0b' },
];

const connectionsByContinent: Record<string, string[]> = {};
globalConnections.forEach(c => {
  const continent = getContinent(c.country);
  if (!connectionsByContinent[continent]) connectionsByContinent[continent] = [];
  connectionsByContinent[continent].push(c.name);
});

function getContinent(country: string): string {
  const map: Record<string, string> = {
    'Germany': 'Europe', 'Spain': 'Europe', 'France': 'Europe', 'Norway': 'Europe',
    'Japan': 'Asia', 'China': 'Asia', 'India': 'Asia',
    'USA': 'N. America', 'Brazil': 'S. America', 'Argentina': 'S. America',
    'Australia': 'Oceania', 'Morocco': 'Africa', 'Kenya': 'Africa',
  };
  return map[country] || 'Other';
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      <div className="value">{payload[0].value}</div>
    </div>
  );
}

export default function WorldTab() {
  const compassX = 50 + (politicalProfile.economic / 100) * 50;
  const compassY = 50 - (politicalProfile.social / 100) * 50;

  return (
    <div className="widget-grid">
      {/* Personality Radar */}
      <SectionCard title="Personality Profile" subtitle="Big Five Traits" accent="world" icon={<Sparkles size={14} />}>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={personalityData}>
            <PolarGrid stroke="#2a2a40" />
            <PolarAngleAxis dataKey="trait" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
            <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="stats-row">
          <StatBadge value={personalityTraits.openness} label="Open" color="#6366f1" />
          <StatBadge value={personalityTraits.extraversion} label="Extrav." color="#ec4899" />
          <StatBadge value={personalityTraits.agreeableness} label="Agree." color="#10b981" />
        </div>
      </SectionCard>

      {/* Political Compass */}
      <SectionCard title="Political Compass" subtitle="Economic vs Social Axis" accent="world" icon={<Compass size={14} />}>
        <div className="compass-grid" style={{ maxWidth: 240, margin: '0 auto' }}>
          <div className="compass-axis-h" />
          <div className="compass-axis-v" />
          <div className="compass-quadrant tl" style={{ color: '#ef4444' }}>Authoritarian<br/>Left</div>
          <div className="compass-quadrant tr" style={{ color: '#3b82f6' }}>Authoritarian<br/>Right</div>
          <div className="compass-quadrant bl" style={{ color: '#10b981' }}>Libertarian<br/>Left</div>
          <div className="compass-quadrant br" style={{ color: '#f59e0b' }}>Libertarian<br/>Right</div>
          <div className="compass-marker" style={{ left: `${compassX}%`, top: `${compassY}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Economic</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{politicalProfile.economic > 0 ? '+' : ''}{politicalProfile.economic}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Social</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{politicalProfile.social > 0 ? '+' : ''}{politicalProfile.social}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Environ.</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{politicalProfile.environmental}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Global</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>{politicalProfile.globalism}%</div>
          </div>
        </div>
      </SectionCard>

      {/* Time Usage */}
      <SectionCard title="Weekly Time Usage" subtitle="168 hours breakdown" accent="world" icon={<TrendingUp size={14} />}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={timeUsage}
              dataKey="hours"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {timeUsage.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {timeUsage.map(t => (
            <span key={t.category} className="tag" style={{ borderColor: t.color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, marginRight: 4 }} />
              {t.category} {t.hours}h
            </span>
          ))}
        </div>
      </SectionCard>

      {/* Global Connection Map */}
      <SectionCard title="Global Connection Map" subtitle={`${globalConnections.length} connections worldwide`} accent="world" span="2" icon={<Globe size={14} />}>
        <div className="world-map-container">
          <svg viewBox="0 0 800 400" style={{ width: '100%', height: 'auto' }}>
            {/* Simplified world map outline */}
            <rect x="0" y="0" width="800" height="400" fill="var(--bg-elevated)" rx="8" />
            {/* Grid lines */}
            {Array.from({ length: 7 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 66.7} x2="800" y2={i * 66.7} stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <line key={`v${i}`} x1={i * 66.7} y1="0" x2={i * 66.7} y2="400" stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
            ))}
            {/* Continent outlines (simplified shapes) */}
            {/* North America */}
            <path d="M120,60 L200,50 L220,80 L230,130 L200,160 L170,180 L140,170 L110,140 L100,100 Z" fill="var(--border)" opacity="0.2" />
            {/* South America */}
            <path d="M190,200 L220,190 L240,220 L250,270 L230,320 L200,340 L180,310 L170,260 L175,230 Z" fill="var(--border)" opacity="0.2" />
            {/* Europe */}
            <path d="M370,60 L420,50 L440,70 L430,100 L410,120 L380,110 L360,90 Z" fill="var(--border)" opacity="0.2" />
            {/* Africa */}
            <path d="M380,140 L420,130 L450,160 L460,220 L440,280 L410,300 L380,280 L370,220 L375,170 Z" fill="var(--border)" opacity="0.2" />
            {/* Asia */}
            <path d="M460,50 L580,40 L650,60 L680,100 L660,140 L600,160 L530,150 L480,130 L450,100 Z" fill="var(--border)" opacity="0.2" />
            {/* Australia */}
            <path d="M620,260 L680,250 L710,270 L700,310 L660,320 L630,300 L620,280 Z" fill="var(--border)" opacity="0.2" />

            {/* Connection lines from center */}
            {globalConnections.map(c => {
              const x = ((c.lng + 180) / 360) * 800;
              const y = ((90 - c.lat) / 180) * 400;
              return (
                <line key={`line-${c.id}`} x1="400" y1="200" x2={x} y2={y}
                  stroke="#6366f1" strokeWidth="1" opacity="0.15" strokeDasharray="4,4" />
              );
            })}

            {/* Connection dots */}
            {globalConnections.map(c => {
              const x = ((c.lng + 180) / 360) * 800;
              const y = ((90 - c.lat) / 180) * 400;
              const r = 3 + (c.strength / 100) * 5;
              const colors = { friend: '#ec4899', colleague: '#6366f1', family: '#10b981', acquaintance: '#f59e0b' };
              return (
                <g key={c.id}>
                  <circle cx={x} cy={y} r={r + 4} fill={colors[c.type]} opacity="0.15">
                    <animate attributeName="r" values={`${r + 2};${r + 6};${r + 2}`} dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r={r} fill={colors[c.type]} stroke="var(--bg-surface)" strokeWidth="1.5" />
                  <title>{c.name} - {c.city}, {c.country} ({c.strength}%)</title>
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {connectionsByType.map(ct => (
            <span key={ct.type} className="tag">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ct.color, marginRight: 6 }} />
              {ct.type}: {ct.count}
            </span>
          ))}
        </div>
      </SectionCard>

      {/* News Interests */}
      <SectionCard title="News Interest Map" subtitle="What topics catch your eye" accent="world" icon={<Newspaper size={14} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {worldNewsInterests.sort((a, b) => b.level - a.level).map(n => (
            <div key={n.topic}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{n.topic}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{n.level}%</span>
              </div>
              <ProgressBar value={n.level} color="#6366f1" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Cultural Affinity */}
      <SectionCard title="Cultural Affinity" subtitle="Which cultures resonate with you" accent="world" span="2" icon={<Users size={14} />}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={culturalAffinities} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="culture" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
              {culturalAffinities.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Connection Breakdown by Region */}
      <SectionCard title="Connections by Region" accent="world" icon={<Globe size={14} />}>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{ top: 10, right: 10 }}>
            <XAxis dataKey="continent" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }}
              allowDuplicatedCategory={false} />
            <YAxis dataKey="count" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <ZAxis dataKey="count" range={[100, 500]} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={Object.entries(connectionsByContinent).map(([k, v]) => ({ continent: k, count: v.length }))}
              fill="#6366f1" />
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {Object.entries(connectionsByContinent).map(([continent, names]) => (
            <div key={continent} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>{continent}</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{names.length} connections</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
