// onboarding.ts — flag + hint type shared between App.tsx and the
// WelcomeFlow overlay. Lives outside the component file so React
// fast-refresh stays happy with WelcomeFlow.tsx being
// components-only.

const ONBOARDED_KEY = "insight.onboarded.v1";

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "true";
  } catch {
    return true; // localStorage blocked — don't loop the user.
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, "true");
  } catch {
    // Best-effort; the worst case is the user sees the flow once more.
  }
}

// Which surface AppShell should open after the user finishes the
// welcome flow. `null` means "drop me in, don't open anything".
export type WelcomeHint = "daily" | "test" | "around" | null;
