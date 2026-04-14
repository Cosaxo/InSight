interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export default function ProgressBar({ value, max = 100, color = '#6366f1', height = 6 }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className="progress-bar" style={{ height }}>
      <div
        className="progress-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
