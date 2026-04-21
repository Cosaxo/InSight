interface CompareBarProps {
  value: number;
  cohortValue?: number | null;
  cohortLabel?: string;
  color: string;
  height?: number;
}

export default function CompareBar({ value, cohortValue, cohortLabel, color, height = 6 }: CompareBarProps) {
  return (
    <div className="compare-bar" style={{ height }}>
      <div className="compare-bar-track">
        <div className="compare-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      {cohortValue != null && (
        <div
          className="compare-bar-marker"
          style={{ left: `${cohortValue}%` }}
          title={cohortLabel ? `${cohortLabel}: ${cohortValue}` : `Cohort: ${cohortValue}`}
        />
      )}
    </div>
  );
}
