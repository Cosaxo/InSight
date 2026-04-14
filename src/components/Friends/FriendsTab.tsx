import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { Users, Heart, MessageCircle, Globe, Network, TrendingUp, Sparkles } from 'lucide-react';
import SectionCard from '../shared/SectionCard';
import StatBadge from '../shared/StatBadge';
import ProgressBar from '../shared/ProgressBar';
import {
  friends,
  socialCircles,
  communicationPatterns,
  diversityIndex,
} from '../../data/mockData';

const categoryColorMap: Record<string, string> = {
  close: '#ec4899',
  regular: '#8b5cf6',
  casual: '#06b6d4',
  distant: '#64748b',
};

const avatarColors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#f43f5e', '#0ea5e9'];

const sharedInterestCount: Record<string, number> = {};
friends.forEach(f => {
  f.sharedInterests.forEach(i => {
    sharedInterestCount[i] = (sharedInterestCount[i] || 0) + 1;
  });
});
const interestOverlap = Object.entries(sharedInterestCount)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count);

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
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

export default function FriendsTab() {
  const totalFriends = friends.length;
  const avgStrength = Math.round(friends.reduce((s, f) => s + f.strength, 0) / totalFriends);
  const totalMsgsPerWeek = friends.reduce((s, f) => s + f.communicationFreq, 0);
  const cities = new Set(friends.map(f => f.city)).size;

  return (
    <div className="widget-grid">
      {/* Social Overview */}
      <SectionCard title="Social Overview" accent="friends" icon={<Users size={14} />}>
        <div className="stats-row">
          <StatBadge value={totalFriends} label="Friends" color="#0ea5e9" />
          <StatBadge value={avgStrength} label="Avg Bond" color="#ec4899" />
          <StatBadge value={totalMsgsPerWeek} label="Msgs/Wk" color="#6366f1" />
          <StatBadge value={cities} label="Cities" color="#10b981" />
        </div>
        <div style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={socialCircles}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={4}
              >
                {socialCircles.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {socialCircles.map(c => (
              <span key={c.name} className="tag">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, marginRight: 4 }} />
                {c.name}: {c.count}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Friendship Strength */}
      <SectionCard title="Friendship Strength" subtitle="Connection bond levels" accent="friends" span="2" icon={<Heart size={14} />}>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {[...friends]
            .sort((a, b) => b.strength - a.strength)
            .map((friend, idx) => (
              <div key={friend.id} className="friend-card">
                <div
                  className="avatar"
                  style={{ background: avatarColors[idx % avatarColors.length] }}
                >
                  {friend.avatar}
                </div>
                <div className="friend-info">
                  <div className="friend-name">{friend.name}</div>
                  <div className="friend-meta">
                    {friend.city} &middot; {friend.communicationFreq} msgs/wk &middot;
                    <span style={{ color: categoryColorMap[friend.category] }}> {friend.category}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <ProgressBar
                      value={friend.strength}
                      color={categoryColorMap[friend.category]}
                      height={3}
                    />
                  </div>
                </div>
                <div className="friend-strength">
                  <div className="friend-strength-value" style={{ color: categoryColorMap[friend.category] }}>
                    {friend.strength}
                  </div>
                  <div className="friend-strength-label">bond</div>
                </div>
              </div>
            ))}
        </div>
      </SectionCard>

      {/* Communication Patterns */}
      <SectionCard title="Communication Patterns" subtitle="Weekly activity" accent="friends" span="2" icon={<MessageCircle size={14} />}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={communicationPatterns}>
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="messages" fill="#0ea5e9" radius={[2, 2, 0, 0]} barSize={16} name="Messages" />
            <Bar dataKey="calls" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={16} name="Calls" />
            <Bar dataKey="meetups" fill="#10b981" radius={[2, 2, 0, 0]} barSize={16} name="Meetups" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0ea5e9' }} /> Messages
          </span>
          <span style={{ fontSize: 11, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#8b5cf6' }} /> Calls
          </span>
          <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} /> Meetups
          </span>
        </div>
      </SectionCard>

      {/* Shared Interests Overlap */}
      <SectionCard title="Shared Interests" subtitle="What connects your friends" accent="friends" icon={<Sparkles size={14} />}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={interestOverlap} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14} name="Friends">
              {interestOverlap.map((_, idx) => (
                <Cell key={idx} fill={avatarColors[idx % avatarColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Social Diversity Index */}
      <SectionCard title="Diversity Index" subtitle="How diverse is your social circle" accent="friends" span="2" icon={<Globe size={14} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
          {diversityIndex.map(d => (
            <div key={d.dimension} className="diversity-item">
              <div className="diversity-header">
                <span className="diversity-label">{d.dimension}</span>
                <span className="diversity-score" style={{
                  color: d.score >= 75 ? '#10b981' : d.score >= 60 ? '#f59e0b' : '#ef4444'
                }}>{d.score}/100</span>
              </div>
              <ProgressBar
                value={d.score}
                color={d.score >= 75 ? '#10b981' : d.score >= 60 ? '#f59e0b' : '#ef4444'}
                height={4}
              />
              <div className="diversity-desc">{d.description}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--bg-elevated)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Overall Diversity Score</div>
          <div style={{
            fontSize: 28, fontWeight: 700,
            color: '#0ea5e9',
          }}>
            {Math.round(diversityIndex.reduce((s, d) => s + d.score, 0) / diversityIndex.length)}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>out of 100</div>
        </div>
      </SectionCard>

      {/* Friendship Timeline */}
      <SectionCard title="Friendship Timeline" subtitle="When connections were made" accent="friends" icon={<TrendingUp size={14} />}>
        <div className="timeline">
          {[...friends]
            .sort((a, b) => new Date(a.metDate).getTime() - new Date(b.metDate).getTime())
            .map((friend) => (
              <div key={friend.id} className="timeline-item">
                <div className="timeline-dot" style={{ borderColor: categoryColorMap[friend.category] }} />
                <div className="timeline-content" style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{friend.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>
                      {new Date(friend.metDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {friend.city} &middot; {friend.sharedInterests.slice(0, 2).join(', ')}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </SectionCard>

      {/* Social Network Visualization */}
      <SectionCard title="Connection Network" subtitle="Your social graph" accent="friends" span="full" icon={<Network size={14} />}>
        <div style={{ position: 'relative', width: '100%', height: 300, background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden' }}>
          <svg viewBox="0 0 800 300" style={{ width: '100%', height: '100%' }}>
            {/* Center node (you) */}
            <circle cx="400" cy="150" r="20" fill="#0ea5e9" opacity="0.3" />
            <circle cx="400" cy="150" r="12" fill="#0ea5e9" />
            <text x="400" y="154" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">YOU</text>

            {/* Friend nodes radiating outward */}
            {friends.map((friend, idx) => {
              const angle = (idx / friends.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 80 + (100 - friend.strength);
              const x = 400 + Math.cos(angle) * radius;
              const y = 150 + Math.sin(angle) * radius;
              const nodeR = 4 + (friend.strength / 100) * 8;
              const color = categoryColorMap[friend.category];

              return (
                <g key={friend.id}>
                  {/* Connection line */}
                  <line
                    x1="400" y1="150" x2={x} y2={y}
                    stroke={color}
                    strokeWidth={friend.strength / 40}
                    opacity={0.3}
                  />
                  {/* Glow */}
                  <circle cx={x} cy={y} r={nodeR + 4} fill={color} opacity="0.1">
                    <animate attributeName="r" values={`${nodeR + 2};${nodeR + 6};${nodeR + 2}`} dur="4s" repeatCount="indefinite" begin={`${idx * 0.3}s`} />
                  </circle>
                  {/* Node */}
                  <circle cx={x} cy={y} r={nodeR} fill={color} stroke="var(--bg-surface)" strokeWidth="1" />
                  {/* Label */}
                  <text
                    x={x}
                    y={y + nodeR + 12}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="8"
                  >
                    {friend.name.split(' ')[0]}
                  </text>
                  <title>{friend.name} - Bond: {friend.strength}% ({friend.category})</title>

                  {/* Shared interest connections between friends */}
                  {friends.slice(idx + 1).map((other) => {
                    const shared = friend.sharedInterests.filter(i => other.sharedInterests.includes(i));
                    if (shared.length < 2) return null;
                    const angle2 = (friends.indexOf(other) / friends.length) * Math.PI * 2 - Math.PI / 2;
                    const radius2 = 80 + (100 - other.strength);
                    const x2 = 400 + Math.cos(angle2) * radius2;
                    const y2 = 150 + Math.sin(angle2) * radius2;
                    return (
                      <line
                        key={`${friend.id}-${other.id}`}
                        x1={x} y1={y} x2={x2} y2={y2}
                        stroke="#2a2a40"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                        opacity="0.5"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </SectionCard>
    </div>
  );
}
