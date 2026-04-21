interface NavIconProps {
  col: string;
  on?: boolean;
}

export function IcoWorld({ col, on }: NavIconProps) {
  if (on) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill={col} />
        <path
          d="M12 2C9.5 6 9.5 18 12 22M12 2C14.5 6 14.5 18 12 22"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M2 12h20M4 8h16M4 16h16"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={col} strokeWidth="1.8" />
      <path
        d="M12 2C9.5 6 9.5 18 12 22M12 2C14.5 6 14.5 18 12 22"
        stroke={col}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M2 12h20"
        stroke={col}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function IcoCity({ col, on }: NavIconProps) {
  if (on) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="9" width="9" height="12" rx="1" fill={col} />
        <rect x="11" y="4" width="11" height="17" rx="1" fill={col} opacity="0.8" />
        <rect x="4" y="12" width="2" height="2" fill="white" opacity="0.7" />
        <rect x="7" y="12" width="2" height="2" fill="white" opacity="0.7" />
        <rect x="13" y="7" width="2" height="2" fill="white" opacity="0.6" />
        <rect x="17" y="7" width="2" height="2" fill="white" opacity="0.6" />
        <rect x="13" y="11" width="2" height="2" fill="white" opacity="0.6" />
        <rect x="17" y="11" width="2" height="2" fill="white" opacity="0.6" />
        <path d="M1 21h22" stroke={col} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="9" width="9" height="12" rx="1" stroke={col} strokeWidth="1.7" />
      <rect x="11" y="4" width="11" height="17" rx="1" stroke={col} strokeWidth="1.7" />
      <path d="M1 21h22" stroke={col} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IcoGroups({ col, on }: NavIconProps) {
  const fillColor = on ? col : "none";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="7.5" x2="6.5" y2="17" stroke={col} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="7.5" x2="17.5" y2="17" stroke={col} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="18" x2="16" y2="18" stroke={col} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="5.5" r="3" fill={fillColor} stroke={col} strokeWidth="1.7" />
      <circle cx="5.5" cy="19" r="2.8" fill={fillColor} stroke={col} strokeWidth="1.7" />
      <circle cx="18.5" cy="19" r="2.8" fill={fillColor} stroke={col} strokeWidth="1.7" />
    </svg>
  );
}

export function IcoAround({ col, on }: NavIconProps) {
  if (on) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill={col} />
        <circle cx="12" cy="12" r="3.5" fill="white" />
        <circle cx="12" cy="12" r="1.8" fill={col} />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={col}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke={col} strokeWidth="1.8" />
    </svg>
  );
}

export function IcoPeople({ col, on }: NavIconProps) {
  if (on) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="7" r="3.5" fill={col} />
        <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill={col} />
        <circle cx="17" cy="8" r="3" fill={col} opacity="0.65" />
        <path
          d="M14.5 20c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5"
          fill={col}
          opacity="0.65"
        />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="7" r="3.5" stroke={col} strokeWidth="1.8" />
      <path
        d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke={col}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="17" cy="8" r="3" stroke={col} strokeWidth="1.6" />
      <path
        d="M14.5 20c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5"
        stroke={col}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
