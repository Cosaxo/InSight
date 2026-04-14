import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { Sparkles, Users, Clock, TrendingUp, Layers, Zap } from 'lucide-react';
import SectionCard from '../shared/SectionCard';
import StatBadge from '../shared/StatBadge';
import ProgressBar from '../shared/ProgressBar';
import { interests, groups, interestEvolution } from '../../data/mockData';

const categoryColors: Record<string, string> = {
  Creative: '#8b5cf6',
  Sport: '#10b981',
  Lifestyle: '#f59e0b',
  Tech: '#ec4899',
  Intellectual: '#06b6d4',
  Wellness: '#14b8a6',
};

const groupTypeColors: Record<string, { bg: string; text: string }> = {
  online: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8' },
  local: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
  professional: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
};

const chartColors = ['#6366f1', '#ec4899', '#f59e0b', '#06b6d4', '#10b981'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="value" style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

export default function InterestsTab() {
  const totalHours = interests.reduce((s, i) => s + i.hoursPerWeek, 0);
  const categories = [...new Set(interests.map(i => i.category))];

  return (
    <div className="widget-grid">
      {/* Interest Clusters */}
      <SectionCard title="Interest Clusters" subtitle={`${interests.length} active interests`} accent="interests" span="2" icon={<Sparkles size={14} />}>
        <div className="stats-row" style={{ marginBottom: 16 }}>
          <StatBadge value={interests.length} label="Interests" color="#10b981" />
          <StatBadge value={totalHours} label="Hrs/Week" color="#6366f1" />
          <StatBadge value={categories.length} label="Categories" color="#ec4899" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
          {interests.map(int => (
            <div
              key={int.id}
              className="interest-bubble"
              style={{
                background: int.color,
                fontSize: 10 + (int.level / 20),
                padding: `${6 + int.level / 20}px ${12 + int.level / 10}px`,
                opacity: 0.7 + (int.level / 300),
              }}
            >
              {int.name}
              <span style={{ opacity: 0.7, fontSize: 10 }}>Lv.{int.level}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <span key={cat} className="tag" style={{ borderColor: categoryColors[cat] || '#64748b' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: categoryColors[cat] || '#64748b', marginRight: 4 }} />
              {cat}
            </span>
          ))}
        </div>
      </SectionCard>

      {/* Skill Levels */}
      <SectionCard title="Skill Levels" subtitle="Proficiency tracker" accent="interests" icon={<Zap size={14} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...interests].sort((a, b) => b.level - a.level).map(int => (
            <div key={int.id} className="skill-node" style={{ borderLeftColor: int.color }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{int.name}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>Since {int.startedYear}</div>
              </div>
              <span className="skill-level" style={{ color: int.color }}>{int.level}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Interest Evolution */}
      <SectionCard title="Interest Evolution" subtitle="How your passions shifted over the year" accent="interests" span="2" icon={<TrendingUp size={14} />}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={interestEvolution}>
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            {['Photography', 'Cooking', 'Machine Learning', 'Reading', 'Rock Climbing'].map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[i]}
                fill={chartColors[i]}
                fillOpacity={0.08}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {['Photography', 'Cooking', 'Machine Learning', 'Reading', 'Rock Climbing'].map((key, i) => (
            <span key={key} style={{ fontSize: 11, color: chartColors[i], display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 3, borderRadius: 2, background: chartColors[i] }} />
              {key}
            </span>
          ))}
        </div>
      </SectionCard>

      {/* Hobby Time Tracker */}
      <SectionCard title="Weekly Time Investment" subtitle={`${totalHours} hours per week`} accent="interests" icon={<Clock size={14} />}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[...interests].sort((a, b) => b.hoursPerWeek - a.hoursPerWeek)} layout="vertical" margin={{ left: 70 }}>
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="hoursPerWeek" radius={[0, 4, 4, 0]} barSize={14}>
              {interests.map((int, idx) => (
                <Cell key={idx} fill={int.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Groups & Communities */}
      <SectionCard title="Groups & Communities" subtitle={`${groups.length} memberships`} accent="interests" span="2" icon={<Users size={14} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
          {groups.map(group => (
            <div key={group.id} className="group-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="group-name">{group.name}</div>
                <span
                  className="group-type-badge"
                  style={{
                    background: groupTypeColors[group.type].bg,
                    color: groupTypeColors[group.type].text,
                  }}
                >
                  {group.type}
                </span>
              </div>
              <div className="group-meta">
                <span>{group.members.toLocaleString()} members</span>
                <span>Joined {new Date(group.joinedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Engagement</span>
                <div style={{ flex: 1 }}>
                  <ProgressBar value={group.engagement} color={group.engagement > 80 ? '#10b981' : group.engagement > 50 ? '#f59e0b' : '#64748b'} height={4} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>{group.engagement}%</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Category Breakdown */}
      <SectionCard title="Category Breakdown" accent="interests" icon={<Layers size={14} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categories.map(cat => {
            const catInterests = interests.filter(i => i.category === cat);
            const avgLevel = Math.round(catInterests.reduce((s, i) => s + i.level, 0) / catInterests.length);
            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{cat}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{catInterests.length} interests &middot; Avg Lv.{avgLevel}</span>
                </div>
                <ProgressBar value={avgLevel} color={categoryColors[cat] || '#64748b'} />
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {catInterests.map(i => (
                    <span key={i.id} className="tag" style={{ fontSize: 10 }}>{i.name}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
