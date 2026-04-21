import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { firebaseEnabled, subscribeToAuth } from "./firebase";

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
    });
  }, []);

  return state;
}
