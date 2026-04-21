// Small inline SVG icons used in stat cards. Replaces emoji for a cleaner,
// on-brand look.

const SI = {
  globe:
    "M10 2a8 8 0 100 16A8 8 0 0010 2zm0 0c-1.5 3-1.5 10 0 16m0-16c1.5 3 1.5 10 0 16M2 10h16",
  eye: "M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7zm9-2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  target:
    "M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4a4 4 0 100 8 4 4 0 000-8zm0 2.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z",
  sparkle: "M10 1l2 6h6l-5 3.5 2 6L10 13l-5 3.5 2-6L2 7h6z",
  brain:
    "M6 10a4 4 0 014-4 4 4 0 014 4v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-1zM8 6.5V5m4 1.5V5m-6 8h8",
  scale: "M3 6h14m-7-3v14m-7-5.5l3.5-8 3.5 8m7 0l-3.5-8-3.5 8",
  city: "M2 18V8l6-5 6 5v10M8 18v-5h4v5",
  map: "M1 4v14l5-3 8 3 5-3V1l-5 3-8-3-5 3zm5-3v14m8-11v14",
  star: "M10 1l2.5 6.5H19l-5.5 4 2 6.5L10 14l-5.5 4 2-6.5L1 7.5h6.5z",
  people: "M7 8a3 3 0 100-6 3 3 0 000 6zm-5 9s0-5 5-5 5 5 5 5m2-12a3 3 0 014 2.83M14 17s0-3.5 3-3.5",
  fire: "M12 2c0 4-3 5-3 8a3 3 0 006 0c0-2-1-3-1-5 0 0-1 2-2 2s0-5 0-5zM8 14a4 4 0 004 4",
  clock: "M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v4l3 2",
  heart: "M3.5 6.5A4.5 4.5 0 0110 3a4.5 4.5 0 016.5 3.5C17 10 10 17 10 17S3 10 3.5 6.5z",
  run: "M13 3a1 1 0 100 2 1 1 0 000-2zm-3 4l-2 3H5l3 4 2-2 3 4m2-9l-3 5",
  apple:
    "M12 3c0-2 2-2 2-2s0 2-2 2zm2 1c2 0 4 2 4 5 0 4-2 7-4 7s-2-1-4-1-2 1-4 1c-2 0-4-3-4-7 0-3 2-5 4-5z",
  wallet: "M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm14 4h-3a1 1 0 000 2h3v-2z",
  trend: "M2 16l5-5 4 3 7-9",
  checkAll: "M2 11l4 4L18 4m-8 9l-2-2",
  streak: "M5 3l2 7H2l5 5-2 5 5-3 5 3-2-5 5-5H13z",
  compass: "M10 2a8 8 0 100 16A8 8 0 0010 2zm3-1l-2 5-5 2 2 5 5-2 2-5z",
} as const;

export type StatIconName = keyof typeof SI;

interface StatIcoProps {
  name: StatIconName;
  col: string;
  size?: number;
}

export function StatIco({ name, col, size = 16 }: StatIcoProps) {
  const d = SI[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={col}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
