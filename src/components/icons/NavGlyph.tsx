import type { TabId } from "../../types";

interface NavGlyphProps {
  id: TabId;
  active: boolean;
}

export function NavGlyph({ id, active }: NavGlyphProps) {
  const stroke = active ? "var(--ink)" : "var(--ink-3)";
  const sw = 1.2;

  if (id === "around") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12" cy="12" r="5.5" strokeDasharray="1.2 1.5" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
        <circle cx="12" cy="12" r="1.6" fill="var(--ink)" stroke="none" />
      </svg>
    );
  }
  if (id === "world") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9.5" />
        <ellipse cx="12" cy="12" rx="4.5" ry="9.5" />
        <path d="M2.5 12h19" />
        <path
          d="M3.5 7.5h17M3.5 16.5h17"
          strokeWidth="0.8"
          opacity="0.6"
        />
      </svg>
    );
  }
  if (id === "city") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M2.5 21h19" />
        <path d="M4 21V12l3-2 3 2v9" />
        <path d="M10 21v-7l4-3 4 3v7" />
        <path d="M14 11V6l-1-2 1.5-1.5L16 4l-1 2v5" />
        <circle cx="14" cy="3.5" r="0.6" fill={stroke} stroke="none" />
        <path
          d="M5.5 14h1M5.5 16.5h1M11.5 16h1M11.5 18h1M15.5 16h1M15.5 18h1"
          strokeWidth="0.8"
        />
      </svg>
    );
  }
  if (id === "groups") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke={stroke}
        strokeWidth="0.7"
        strokeLinecap="round"
      >
        <path d="M5 7l6 4 8-3 -3 9 -6 -1 -5 2z" strokeDasharray="1 1.4" />
        <circle cx="5" cy="7" r="1.4" fill={stroke} stroke="none" />
        <circle cx="11" cy="11" r="1.8" fill={stroke} stroke="none" />
        <circle cx="19" cy="8" r="1.2" fill={stroke} stroke="none" />
        <circle cx="16" cy="17" r="1.4" fill={stroke} stroke="none" />
        <circle cx="10" cy="16" r="1" fill={stroke} stroke="none" />
        <circle cx="5" cy="18" r="1" fill={stroke} stroke="none" />
      </svg>
    );
  }
  if (id === "people") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="3" />
        <path d="M2.5 19c.7-3 3-5 5.5-5s4.8 2 5.5 5" />
        <circle cx="16.5" cy="9.5" r="2.4" />
        <path d="M12.5 19c.7-2.5 2.5-4 4-4s3.3 1.5 4 4" />
      </svg>
    );
  }
  return null;
}
