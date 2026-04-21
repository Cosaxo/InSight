// Icons for the Personal Insights panel tabs (mood/habits/etc).

interface IconProps {
  col: string;
}

export const IcoMood = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="9" cy="9" r="7.5" />
    <path d="M6 10.5s1 2 3 2 3-2 3-2" />
    <circle cx="6.5" cy="7" r="0.8" fill={col} />
    <circle cx="11.5" cy="7" r="0.8" fill={col} />
  </svg>
);

export const IcoHabit = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="14" height="14" rx="3" />
    <path d="M5.5 9l2.5 2.5 4.5-4.5" />
  </svg>
);

export const IcoFitness = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M2 9h2M14 9h2M4 9h10" />
    <circle cx="4" cy="9" r="1.5" />
    <circle cx="14" cy="9" r="1.5" />
    <rect x="6" y="6" width="6" height="6" rx="1" />
  </svg>
);

export const IcoNutrition = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M6 2c0 3-2 4-2 7a5 5 0 0010 0c0-3-2-4-2-7" />
    <path d="M9 2v7" />
  </svg>
);

export const IcoFinance = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="4" width="16" height="11" rx="2" />
    <path d="M1 8h16" />
    <circle cx="9" cy="12" r="1.5" />
  </svg>
);
