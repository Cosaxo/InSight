interface StatBadgeProps {
  value: string | number;
  label: string;
  color?: string;
  delta?: number | null;
}

export default function StatBadge({ value, label, color, delta }: StatBadgeProps) {
  const showDelta = delta != null;
  const deltaColor = showDelta ? (delta >= 0 ? '#10b981' : '#ef4444') : undefined;
  return (
    <div className="stat-badge">
      <span className="stat-value" style={color ? { color } : undefined}>{value}</span>
      {showDelta && (
        <span className="stat-delta" style={{ color: deltaColor }}>
          {delta >= 0 ? '+' : ''}{delta}
        </span>
      )}
      <span className="stat-label">{label}</span>
    </div>
  );
}
