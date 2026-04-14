interface StatBadgeProps {
  value: string | number;
  label: string;
  color?: string;
}

export default function StatBadge({ value, label, color }: StatBadgeProps) {
  return (
    <div className="stat-badge">
      <span className="stat-value" style={color ? { color } : undefined}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
