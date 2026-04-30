import { C } from "../../theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  inline?: boolean;
}

// Single shimmer block. Width defaults to 100%, height to 12. Animation is
// driven by a global @keyframes shimmer rule injected once.
export function Skeleton({
  width = "100%",
  height = 12,
  radius = 6,
  inline = false,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: inline ? "inline-block" : "block",
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${C.dim} 0%, #e2e8f0 50%, ${C.dim} 100%)`,
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

interface SkeletonStackProps {
  rows?: number;
  gap?: number;
  rowHeight?: number;
}

// Convenience: a stacked block of bars to fill space while real content loads.
export function SkeletonStack({
  rows = 3,
  gap = 8,
  rowHeight = 14,
}: SkeletonStackProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={i}
          height={rowHeight}
          width={`${85 - i * 7}%`}
        />
      ))}
    </div>
  );
}
