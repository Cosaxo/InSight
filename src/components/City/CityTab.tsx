import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { MapPin, Calendar, Compass, BookOpen, BarChart3 } from 'lucide-react';
import SectionCard from '../shared/SectionCard';
import StatBadge from '../shared/StatBadge';
import StarRating from '../shared/StarRating';
import ProgressBar from '../shared/ProgressBar';
import { cityVisits, cityDNA } from '../../data/mockData';

const avgScores = {
  food: Math.round(cityVisits.reduce((s, c) => s + c.scores.food, 0) / cityVisits.length),
  culture: Math.round(cityVisits.reduce((s, c) => s + c.scores.culture, 0) / cityVisits.length),
  nightlife: Math.round(cityVisits.reduce((s, c) => s + c.scores.nightlife, 0) / cityVisits.length),
  safety: Math.round(cityVisits.reduce((s, c) => s + c.scores.safety, 0) / cityVisits.length),
  affordability: Math.round(cityVisits.reduce((s, c) => s + c.scores.affordability, 0) / cityVisits.length),
  nature: Math.round(cityVisits.reduce((s, c) => s + c.scores.nature, 0) / cityVisits.length),
};

const topCities = [...cityVisits].sort((a, b) => b.rating - a.rating).slice(0, 3);

function comparisonData() {
  const dimensions = ['food', 'culture', 'nightlife', 'safety', 'affordability', 'nature', 'architecture', 'people'] as const;
  return dimensions.map(d => ({
    dimension: d.charAt(0).toUpperCase() + d.slice(1),
    ...Object.fromEntries(topCities.map(c => [c.name, c.scores[d]])),
  }));
}

const radarColors = ['#6366f1', '#ec4899', '#f59e0b'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="value">{p.value}</div>
      ))}
    </div>
  );
}

export default function CityTab() {
  const totalDays = cityVisits.reduce((s, c) => s + c.daysSpent, 0);
  const avgRating = (cityVisits.reduce((s, c) => s + c.rating, 0) / cityVisits.length).toFixed(1);
  const countries = new Set(cityVisits.map(c => c.country)).size;

  return (
    <div className="widget-grid">
      {/* Stats Overview */}
      <SectionCard title="Travel Overview" accent="city" icon={<MapPin size={14} />}>
        <div className="stats-row">
          <StatBadge value={cityVisits.length} label="Cities" color="#f59e0b" />
          <StatBadge value={countries} label="Countries" color="#ec4899" />
          <StatBadge value={totalDays} label="Days" color="#6366f1" />
          <StatBadge value={avgRating} label="Avg Rating" color="#10b981" />
        </div>
        <div style={{ marginTop: 8 }}>
          {Object.entries(avgScores).map(([key, val]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{key}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{val}</span>
              </div>
              <ProgressBar value={val} color="#f59e0b" height={4} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* City Comparison Radar */}
      <SectionCard title="City Comparison" subtitle={`Top ${topCities.length} cities`} accent="city" span="2" icon={<BarChart3 size={14} />}>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={comparisonData()}>
            <PolarGrid stroke="#2a2a40" />
            <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
            {topCities.map((city, i) => (
              <Radar
                key={city.id}
                dataKey={city.name}
                stroke={radarColors[i]}
                fill={radarColors[i]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* City Logger */}
      <SectionCard title="City Logger" subtitle="All visited cities" accent="city" span="2" icon={<Calendar size={14} />}>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {[...cityVisits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()).map(city => (
            <div key={city.id} className="friend-card">
              <div style={{
                width: 40, height: 40, borderRadius: 8, background: 'var(--bg-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                flexShrink: 0,
              }}>
                {city.country === 'Japan' ? '🇯🇵' :
                 city.country === 'Spain' ? '🇪🇸' :
                 city.country === 'Germany' ? '🇩🇪' :
                 city.country === 'USA' ? '🇺🇸' :
                 city.country === 'Portugal' ? '🇵🇹' :
                 city.country === 'Morocco' ? '🇲🇦' :
                 city.country === 'Denmark' ? '🇩🇰' :
                 city.country === 'Argentina' ? '🇦🇷' : '🌍'}
              </div>
              <div className="friend-info">
                <div className="friend-name">{city.name}, {city.country}</div>
                <div className="friend-meta">
                  {city.daysSpent} days &middot; {new Date(city.visitDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {city.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StarRating rating={city.rating} size={12} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* City DNA */}
      <SectionCard title="Your City DNA" subtitle="What kind of cities you gravitate toward" accent="city" icon={<Compass size={14} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cityDNA.sort((a, b) => b.value - a.value).map(d => (
            <div key={d.trait}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{d.trait}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{d.value}%</span>
              </div>
              <ProgressBar value={d.value} color={d.value > 80 ? '#f59e0b' : d.value > 60 ? '#6366f1' : '#64748b'} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* City Impressions Timeline */}
      <SectionCard title="Travel Impressions" subtitle="Memories from the road" accent="city" span="2" icon={<BookOpen size={14} />}>
        <div className="timeline">
          {[...cityVisits]
            .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
            .slice(0, 5)
            .map(city => (
              <div key={city.id} className="timeline-item">
                <div className="timeline-dot" style={{ borderColor: '#f59e0b' }} />
                <div className="timeline-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{city.name}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {new Date(city.visitDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="impression-text" style={{ borderLeft: 'none', paddingLeft: 0 }}>
                    "{city.impression}"
                  </p>
                  <StarRating rating={city.rating} size={11} />
                </div>
              </div>
            ))}
        </div>
      </SectionCard>

      {/* Days per City */}
      <SectionCard title="Days Spent Per City" accent="city" icon={<BarChart3 size={14} />}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={[...cityVisits].sort((a, b) => b.daysSpent - a.daysSpent)} margin={{ left: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="daysSpent" radius={[4, 4, 0, 0]} barSize={24}>
              {cityVisits.map((_, idx) => (
                <Cell key={idx} fill={idx % 2 === 0 ? '#f59e0b' : '#fbbf24'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}
