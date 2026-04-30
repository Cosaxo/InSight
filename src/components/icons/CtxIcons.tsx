// Compact 18×18 stroke-based icons used in the ContextBar tiles. They
// replace emojis (which render inconsistently across platforms) with
// consistent vector glyphs in the section colour.

const PATHS = {
  pin: "M12 2c-3.5 0-6 2.6-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.4-2.5-6-6-6zm0 8.2a2.2 2.2 0 110-4.4 2.2 2.2 0 010 4.4z",
  radar:
    "M12 12 L18 6 M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0",
  people: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-7 9c0-3 3-5 7-5s7 2 7 5M16 11a3 3 0 100-6m6 14c0-2.6-2.5-4.5-5.5-4.5",
  target: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M12 12m-1.7 0a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 1 0-3.4 0",
  sparkle:
    "M12 3l1.6 5L19 9.5l-4.6 2.5L13 18l-1-5-5.5-1.5L11 8z",
  city: "M3 21V8l5-4 5 4v13M13 21V12h8v9M3 21h18M6 11v2M6 16v2M9 11v2M9 16v2M16 14v2M19 14v2M16 18v2M19 18v2",
  plane: "M3 18l18-7-3-3-15 6 4 6 5-3-1-3z",
  globe:
    "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M12 3c-3 4-3 14 0 18 M12 3c3 4 3 14 0 18 M3 12h18 M5 7.5h14 M5 16.5h14",
  star: "M12 3l2.5 6.5H21l-5.5 4 2 6.5L12 16l-5.5 4 2-6.5L3 9.5h6.5z",
  chart:
    "M4 19V9 M9 19V5 M14 19v-8 M19 19v-3 M3 21h18",
  compass:
    "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M16 8l-2 6-6 2 2-6z",
  scale:
    "M12 4v17 M5 9l-3 7c0 2 1.5 3 3 3s3-1 3-3l-3-7zm0 0V6 M19 9l-3 7c0 2 1.5 3 3 3s3-1 3-3l-3-7zm0 0V6 M5 6h14",
  brain:
    "M9 4a3 3 0 100 6h6a3 3 0 100-6 M6 10a4 4 0 100 8 M18 10a4 4 0 110 8 M9 18a3 3 0 006 0 M9 4v14m6-14v14",
  map: "M3 6v15l6-3 6 3 6-3V3l-6 3-6-3-6 3zm6-3v15m6-12v15",
  heart:
    "M12 21s-9-6-9-12.5S6 3 9 3s3 2 3 2 0-2 3-2 6 2.5 6 5.5S12 21 12 21z",
  handshake:
    "M3 13l2 2 4-4 4 4 6-6 2 2 M5 12l4-4 4 4M9 17h6",
  groups:
    "M12 6a3 3 0 100-6 3 3 0 000 6zm-6.5 18l3.5-9 3 9 M5.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M18.5 24l-3.5-9-3 9 M18.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  fire: "M12 2c0 5-4 6-4 10a4 4 0 008 0c0-3-1-4-1-6 0 0-1 2-2 2s0-6-1-6zM10 14a3 3 0 003 4",
  clock: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M12 7v5l3 2",
  refresh: "M3 12a9 9 0 0115-6.7l3-3v8h-8l3.3-3.3 M21 12a9 9 0 01-15 6.7l-3 3v-8h8L7.7 17",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  cosmic: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M5 9c2 0 3 1 3 3s-1 3-3 3 M16 9c2 0 3 1 3 3s-1 3-3 3 M12 5v2 M12 17v2",
} as const;

export type CtxIconName = keyof typeof PATHS;

interface CtxIcoProps {
  name: CtxIconName;
  col: string;
  size?: number;
}

export function CtxIco({ name, col, size = 18 }: CtxIcoProps) {
  const d = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={col}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
