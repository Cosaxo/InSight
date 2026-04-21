import type { CohortKey } from '../../types';

interface CohortSelectorProps {
  value: CohortKey | null;
  onChange: (value: CohortKey | null) => void;
}

const options: { key: CohortKey; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'country', label: 'Country' },
  { key: 'age', label: 'Age' },
];

export default function CohortSelector({ value, onChange }: CohortSelectorProps) {
  return (
    <div className="cohort-selector" role="group" aria-label="Compare against cohort">
      <button
        type="button"
        className={`cohort-pill ${value === null ? 'active' : ''}`}
        onClick={() => onChange(null)}
      >
        Off
      </button>
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          className={`cohort-pill ${value === opt.key ? 'active' : ''}`}
          onClick={() => onChange(opt.key)}
        >
          vs {opt.label}
        </button>
      ))}
    </div>
  );
}
