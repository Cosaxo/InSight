interface IconProps {
  col: string;
}

export const IcoBack = ({ col }: IconProps) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    stroke={col}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 17l-6-6 6-6" />
  </svg>
);

export const IcoPlus = ({ col }: IconProps) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    stroke={col}
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <path d="M11 4v14M4 11h14" />
  </svg>
);

export const IcoClose = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M3 3l12 12M15 3L3 15" />
  </svg>
);

export const IcoConnect = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="3.5" cy="9" r="2" />
    <circle cx="14.5" cy="3.5" r="2" />
    <circle cx="14.5" cy="14.5" r="2" />
    <path d="M5.5 9h4M12.5 5l-3 3.5M12.5 13l-3-3.5" />
  </svg>
);

export const IcoFilter = ({ col }: IconProps) => (
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
    <path d="M2 4h14M5 9h8M8 14h2" />
  </svg>
);

export const IcoStar = ({ col }: IconProps) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill={col}>
    <path d="M9 1.5l2.2 4.5 5 .7-3.6 3.5.85 4.9L9 12.9l-4.45 2.2.85-4.9L1.8 6.7l5-.7z" />
  </svg>
);

export const IcoInfo = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="9" cy="9" r="7" />
    <path d="M9 8v5M9 5.5v.5" />
  </svg>
);

export const IcoSearch = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="8" cy="8" r="5.5" />
    <path d="M12.5 12.5L16 16" />
  </svg>
);

export const IcoAdd = ({ col }: IconProps) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke={col}
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="9" cy="7" r="3" />
    <path d="M3 17c0-3 2.5-5 6-5s6 2 6 5" />
    <path d="M14 4v6M11 7h6" />
  </svg>
);

export const IcoMap = ({ col }: IconProps) => (
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
    <path d="M6.5 3L1 5v12l5.5-2 5 2 5.5-2V3l-5.5 2-5-2z" />
    <path d="M6.5 3v12M11.5 5v12" />
  </svg>
);

export const IcoInsights = ({ col }: IconProps) => (
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
    <path d="M9 1l1.5 3.5L14 5l-2.5 2.5.6 3.5L9 9.5l-3.1 1.5.6-3.5L4 5l3.5-.5z" />
    <path d="M3 14h12M5 17h8" />
  </svg>
);

export const IcoLogo = ({ col }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)" />
    <path
      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      fill="none"
      stroke={col}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="3" fill={col} />
  </svg>
);
