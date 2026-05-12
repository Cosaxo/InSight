// useCityRatings — single source of truth for the user's city ratings.
// Star ratings live at insight_users/{uid}/insight_cityratings/{cityName}
// when signed in; localStorage under `insight.cityRatings.v1` otherwise.

import { useEffect, useState } from "react";
import type { CityRating, CityRatings } from "../types";
import {
  firebaseEnabled,
  setCityRating,
  subscribeCityRatings,
} from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.cityRatings.v1";

function readLocal(): CityRatings {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "{}") as CityRatings;
  } catch {
    return {};
  }
}

function writeLocal(ratings: CityRatings): void {
  localStorage.setItem(STORAGE, JSON.stringify(ratings));
}

export function useCityRatings(): {
  ratings: CityRatings;
  setRating: (city: string, key: keyof CityRating, value: number) => void;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocalState] = useState<CityRatings>(() => readLocal());
  const [remote, setRemote] = useState<CityRatings | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const unsub = subscribeCityRatings(user.uid, (r) => {
      setRemote(r);
      writeLocal(r);
    });
    return unsub;
  }, [isSignedIn, user]);

  // When the user signs out (or Firebase is disabled), ignore any
  // stale `remote` from a previous session — fall through to local.
  const ratings: CityRatings = isSignedIn ? remote || {} : local;

  const setRating = (
    city: string,
    key: keyof CityRating,
    value: number,
  ): void => {
    const next: CityRatings = {
      ...ratings,
      [city]: { ...(ratings[city] || {}), [key]: value },
    };
    setLocalState(next);
    writeLocal(next);
    if (isSignedIn && user) {
      void setCityRating(user.uid, city, key, value).catch((err) =>
        console.error("[useCityRatings] setCityRating failed:", err),
      );
    }
  };

  return { ratings, setRating };
}
