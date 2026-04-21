import type { ReactNode } from "react";

interface HScrollProps {
  children: ReactNode;
}

export function HScroll({ children }: HScrollProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "2px 0 6px",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
