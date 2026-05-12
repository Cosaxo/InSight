// useIsMobile — true when the viewport is ≤480 px wide.
// Used by the iOS device frame to render bare on real phones (no
// simulated dynamic island / status bar / home indicator, no rounded
// outer frame) while preserving the desktop preview frame at larger
// widths.

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 480px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
