import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  MapPin, Calendar, Heart, Star, Coffee, TreePine, UtensilsCrossed, Dumbbell,
  BookOpen, Landmark, ShoppingBag, Beer,
} from 'lucide-react';
import SectionCard from '../shared/SectionCard';
import StatBadge from '../shared/StatBadge';
import ProgressBar from '../shared/ProgressBar';
import { nearbyPlaces, localEvents, neighborhoodScores } from '../../data/mockData';

const placeIcons: Record<string, React.ReactNode> = {
  cafe: <Coffee size={16} color="#f59e0b" />,
  park: <TreePine size={16} color="#10b981" />,
  restaurant: <UtensilsCrossed size={16} color="#ef4444" />,
  gym: <Dumbbell size={16} color="#6366f1" />,
  library: <BookOpen size={16} color="#06b6d4" />,
  bar: <Beer size={16} color="#f59e0b" />,
  museum: <Landmark size={16} color="#8b5cf6" />,
  shop: <ShoppingBag size={16} color="#ec4899" />,
};

const livabilityData = neighborhoodScores.map(n => ({
  category: n.category,
  score: n.score,
  fullMark: 100,
}));

const visitsByType: Record<string, number> = {};
nearbyPlaces.forEach(p => {
  visitsByType[p.type] = (visitsByType[p.type] || 0) + p.visits;
});
const visitTypeData = Object.entries(visitsByType)
  .map(([type, visits]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), visits }))
  .sort((a, b) => b.visits - a.visits);

const typeColors = ['#f43f5e', '#ec4899', '#8b5cf6', '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      <div className="value">{payload[0].value}</div>
    </div>
  );
}

export default function NearbyTab() {
  const totalVisits = nearbyPlaces.reduce((s, p) => s + p.visits, 0);
  const favorites = nearbyPlaces.filter(p => p.favorite).length;
  const avgRating = (nearbyPlaces.reduce((s, p) => s + p.rating, 0) / nearbyPlaces.length).toFixed(1);
  const upcomingEvents = localEvents.filter(e => new Date(e.date) >= new Date()).length;

  return (
    <div className="widget-grid">
      {/* Neighborhood Overview */}
      <SectionCard title="Neighborhood Pulse" subtitle="Your local footprint" accent="nearby" icon={<MapPin size={14} />}>
        <div className="stats-row">
          <StatBadge value={totalVisits} label="Total Visits" color="#f43f5e" />
          <StatBadge value={favorites} label="Favorites" color="#ec4899" />
          <StatBadge value={avgRating} label="Avg Rating" color="#f59e0b" />
          <StatBadge value={upcomingEvents} label="Events" color="#6366f1" />
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>Community Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProgressBar value={82} color="#f43f5e" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f43f5e' }}>82</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            You're an active community member — top 15% locally
          </div>
        </div>
      </SectionCard>

      {/* Livability Scores */}
      <SectionCard title="Livability Scores" subtitle="Neighborhood assessment" accent="nearby" icon={<Star size={14} />}>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={livabilityData}>
            <PolarGrid stroke="#2a2a40" />
            <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
            <Radar dataKey="score" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} strokeWidth={2} />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Visit Frequency by Type */}
      <SectionCard title="Visit Patterns" subtitle="Where you spend your time" accent="nearby" icon={<Heart size={14} />}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={visitTypeData} layout="vertical" margin={{ left: 70 }}>
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="type" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="visits" radius={[0, 4, 4, 0]} barSize={14}>
              {visitTypeData.map((_, idx) => (
                <Cell key={idx} fill={typeColors[idx % typeColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Favorite Places */}
      <SectionCard title="Local Discoveries" subtitle={`${nearbyPlaces.length} places explored`} accent="nearby" span="2" icon={<MapPin size={14} />}>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {[...nearbyPlaces]
            .sort((a, b) => b.visits - a.visits)
            .map(place => (
              <div key={place.id} className="place-card">
                <div className="place-icon">
                  {placeIcons[place.type] || <MapPin size={16} color="#94a3b8" />}
                </div>
                <div className="place-info">
                  <div className="place-name">
                    {place.name}
                    {place.favorite && <Heart size={10} color="#f43f5e" fill="#f43f5e" style={{ marginLeft: 4 }} />}
                  </div>
                  <div className="place-meta">
                    <span>{place.type}</span>
                    <span>{place.distance}</span>
                    <span>{place.visits} visits</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={12} color="#f59e0b" fill="#f59e0b" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{place.rating}</span>
                </div>
              </div>
            ))}
        </div>
      </SectionCard>

      {/* Upcoming Events */}
      <SectionCard title="Local Events" subtitle="What's happening nearby" accent="nearby" icon={<Calendar size={14} />}>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {localEvents.map(event => {
            const date = new Date(event.date);
            return (
              <div key={event.id} className="event-card">
                <div className="event-date">
                  <span className="day">{date.getDate()}</span>
                  <span className="month">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                </div>
                <div className="event-info">
                  <div className="event-title">{event.title}</div>
                  <div className="event-meta">
                    <span className="tag" style={{ padding: '1px 6px' }}>{event.type}</span>
                    <span>{event.attendees} attendees</span>
                    <span className={`attending-badge ${event.attending ? 'yes' : 'no'}`}>
                      {event.attending ? 'Going' : 'Not going'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Neighborhood Detail Scores */}
      <SectionCard title="Area Breakdown" accent="nearby" span="2" icon={<Landmark size={14} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {neighborhoodScores.map(score => (
            <div key={score.category} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, background: 'var(--bg-elevated)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: score.score >= 80 ? '#10b981' : score.score >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {score.score}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{score.category}</div>
                <ProgressBar value={score.score} color={score.score >= 80 ? '#10b981' : score.score >= 60 ? '#f59e0b' : '#ef4444'} height={3} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
