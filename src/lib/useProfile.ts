// useProfile — single source of truth for the user's saved profile (the
// pieces a test can write: Big Five personality vector, 2-axis political
// position, 2-axis core values, optional rich political sub-axes and
// morals).
//
// • Signed-out (or Firebase not configured): reads + writes localStorage
//   under `insight.profile.v1`.
// • Signed-in: subscribes to insight_users/{uid} via loadProfile, writes
//   via saveProfile, and mirrors the latest remote into localStorage so
//   sync readers see the same data.

import { useCallback, useEffect, useState } from "react";
import type { CoreValues, Political } from "../types";
import { firebaseEnabled, loadProfile, saveProfile } from "./firebase";
import type { RemoteProfile } from "./firebase";
import { useAuth } from "./useAuth";

const STORAGE = "insight.profile.v1";

export interface ProfileExt extends RemoteProfile {
  // The six-axis political sub-positions used by the political test.
  // Keys: econ / social / foreign / env / tech / auth.
  politicalAxes?: Record<string, number>;
  // The eight moral axes used by the values test.
  // Keys: tech / future / duty / hedonism / meaning / moral / altruism / beauty.
  morals?: Record<string, number>;
}

function readLocal(): ProfileExt {
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw ? (JSON.parse(raw) as ProfileExt) : {};
  } catch {
    return {};
  }
}

function writeLocal(p: ProfileExt): void {
  localStorage.setItem(STORAGE, JSON.stringify(p));
}

export function useProfile(): {
  profile: ProfileExt;
  save: (patch: Partial<ProfileExt>) => Promise<void>;
} {
  const { user } = useAuth();
  const isSignedIn = firebaseEnabled && !!user;
  const [local, setLocal] = useState<ProfileExt>(() => readLocal());
  const [remote, setRemote] = useState<ProfileExt | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    let cancelled = false;
    void loadProfile(user.uid).then((r) => {
      if (cancelled) return;
      if (r) {
        setRemote(r as ProfileExt);
        writeLocal(r as ProfileExt);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user]);

  const profile: ProfileExt = isSignedIn ? remote || local : local;

  const save = useCallback(
    async (patch: Partial<ProfileExt>) => {
      const next: ProfileExt = { ...profile, ...patch };
      writeLocal(next);
      setLocal(next);
      if (isSignedIn && user) {
        // saveProfile already merges on the Firestore side.
        await saveProfile(user.uid, patch as RemoteProfile);
        setRemote(next);
      }
    },
    [profile, isSignedIn, user],
  );

  return { profile, save };
}

// Score computation for the three test kinds.

// Big Five — 5 items, one per OCEAN trait. Likert 0-4 → 0-100.
export function computeBig5(answers: number[]): number[] {
  // Question order: Open, Conscientious, Extra, Agreeable, Neurotic.
  return answers.slice(0, 5).map((a) => Math.round(a * 25));
}

// Political — 12 items mapped to 6 axes. Each axis is the signed average
// of its contributing items, scaled to -100 .. +100.
//
// Each "+" weight item means "agree pushes this axis right"; each "-"
// weight item means "agree pushes this axis left". Likert 0..4 →
// re-centred to -2..+2, multiplied by 50, signed by direction.
const POLITICAL_KEY: { axis: keyof PoliticalSix; sign: 1 | -1 }[] = [
  { axis: "econ", sign: 1 },    // 1: markets distribute fairly
  { axis: "econ", sign: 1 },    // 2: inequality is the price of progress
  { axis: "auth", sign: 1 },    // 3: tradition deserves benefit of the doubt
  { axis: "social", sign: -1 }, // 4: state should keep out of private life (lower auth)
  { axis: "social", sign: 1 },  // 5: some speech harmful enough to restrict
  { axis: "econ", sign: -1 },   // 6: judged by how we treat the weakest (left)
  { axis: "env", sign: 1 },     // 7: climate action worth real economic cost
  { axis: "foreign", sign: 1 }, // 8: help others before its own poor (open)
  { axis: "tech", sign: 1 },    // 9: new tech makes life better (optimist)
  { axis: "auth", sign: 1 },    // 10: strong leaders > strong institutions
  { axis: "foreign", sign: 1 }, // 11: borders more open than now
  { axis: "auth", sign: 1 },    // 12: some order requires surveillance
];

interface PoliticalSix {
  econ: number;
  social: number;
  foreign: number;
  env: number;
  tech: number;
  auth: number;
}

export function computePolitical(answers: number[]): {
  political: Political;
  axes: PoliticalSix;
} {
  const sums: Record<keyof PoliticalSix, number> = {
    econ: 0,
    social: 0,
    foreign: 0,
    env: 0,
    tech: 0,
    auth: 0,
  };
  const counts: Record<keyof PoliticalSix, number> = {
    econ: 0,
    social: 0,
    foreign: 0,
    env: 0,
    tech: 0,
    auth: 0,
  };
  answers.slice(0, POLITICAL_KEY.length).forEach((a, i) => {
    const { axis, sign } = POLITICAL_KEY[i];
    sums[axis] += sign * (a - 2) * 50;
    counts[axis] += 1;
  });
  const axes: PoliticalSix = {
    econ: counts.econ ? Math.round(sums.econ / counts.econ) : 0,
    social: counts.social ? Math.round(sums.social / counts.social) : 0,
    foreign: counts.foreign ? Math.round(sums.foreign / counts.foreign) : 0,
    env: counts.env ? Math.round(sums.env / counts.env) : 0,
    tech: counts.tech ? Math.round(sums.tech / counts.tech) : 0,
    auth: counts.auth ? Math.round(sums.auth / counts.auth) : 0,
  };
  return {
    political: { econ: axes.econ, social: axes.social },
    axes,
  };
}

// Values — 8 items, one per moral axis. Likert 0-4 → -100..+100.
// Returns the 8-axis morals object plus the 2-axis CV summary used by
// the existing CV compass: indiv = (1 - altruism) negated, change =
// (future + tech)/2 (rough mapping — kept stable across deployments).
const MORAL_KEYS = [
  "tech",
  "future",
  "duty",
  "hedonism",
  "meaning",
  "moral",
  "altruism",
  "beauty",
] as const;

export function computeValues(answers: number[]): {
  cv: CoreValues;
  morals: Record<string, number>;
} {
  const morals: Record<string, number> = {};
  answers.slice(0, MORAL_KEYS.length).forEach((a, i) => {
    morals[MORAL_KEYS[i]] = (a - 2) * 50;
  });
  const cv: CoreValues = {
    // Individualist ↔ collective. duty > stranger means more
    // collective; flip sign so collective is positive.
    indiv: -morals.altruism,
    // Stability ↔ change. Future-optimism + tech-optimism drives "change".
    change: Math.round(((morals.future ?? 0) + (morals.tech ?? 0)) / 2),
  };
  return { cv, morals };
}
