import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { firebaseEnabled, subscribeToAuth } from "./firebase";
import { setSentryUser } from "./sentry";
import { setCrashlyticsUser } from "./crashlytics";

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  // When Firebase is disabled we never leave the "local-only" state.
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    loading: firebaseEnabled,
  }));

  useEffect(() => {
    if (!firebaseEnabled) return;
    return subscribeToAuth((user) => {
      setState({ user, loading: false });
      // Mirror identity into the crash reporters. We send only the
      // uid — no email, no name. Crashlytics is native-only; both
      // calls no-op when not configured.
      setSentryUser(user?.uid ?? null);
      void setCrashlyticsUser(user?.uid ?? null);
    });
  }, []);

  return state;
}
