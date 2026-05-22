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
  // Money Scripts (Klontz, 2011) — short form. Four scripts on
  // 0..100. Highest score = dominant script. Powers FinanceTab
  // commentary + cross-tab framing of spending behaviour.
  moneyScripts?: {
    avoidance: number;
    worship: number;
    status: number;
    vigilance: number;
  };
  // Chronotype (Munich short form). 0 = strong morning ("lark"),
  // 100 = strong evening ("owl"). Drives Body tab workout-timing
  // hints + Days tab pattern reading.
  chronotype?: {
    score: number;
    category: "lark" | "intermediate" | "owl";
  };
  // Adult attachment (ECR-R short form). Two continuous scores;
  // style derived from quadrant. Drives People tab relationship
  // dynamics + nearby-people match enrichment.
  attachment?: {
    anxiety: number;
    avoidance: number;
    style: "secure" | "anxious" | "avoidant" | "disorganized";
  };
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

// Cosine-similarity match% between two Big Five vectors (each 0–100).
// Returns 0–100 where 100 means identical orientation, 0 means
// opposite. Returns null if either vector is missing or malformed.
//
// Inputs are clamped to [0, 100] then re-centred to [-50, +50] so
// "neutral on every trait" doesn't artificially inflate similarity
// scores — we want the angle between profiles of *deviations*, not
// the raw quadrant. A user neutral on every axis matches anyone at
// 50 (no signal, no claim).
export function big5Match(
  a: number[] | undefined,
  b: number[] | undefined,
): number | null {
  if (!a || !b || a.length !== 5 || b.length !== 5) return null;
  const ca = a.map((n) => Math.max(0, Math.min(100, n)) - 50);
  const cb = b.map((n) => Math.max(0, Math.min(100, n)) - 50);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 5; i++) {
    dot += ca[i] * cb[i];
    na += ca[i] * ca[i];
    nb += cb[i] * cb[i];
  }
  if (na === 0 || nb === 0) return 50;
  const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return Math.round(((cos + 1) / 2) * 100);
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

// Money Scripts (Klontz et al., 2011) — short form. 8 questions,
// 2 per script (Avoidance / Worship / Status / Vigilance). Likert
// 0-4. Each script averaged then scaled to 0..100.
//
// Question order (must match TestOverlay's questions array):
//   0,1 — Avoidance
//   2,3 — Worship
//   4,5 — Status
//   6,7 — Vigilance
export function computeMoneyScripts(answers: number[]): {
  avoidance: number;
  worship: number;
  status: number;
  vigilance: number;
} {
  const pair = (i: number, j: number) =>
    Math.round((((answers[i] ?? 0) + (answers[j] ?? 0)) / 8) * 100);
  return {
    avoidance: pair(0, 1),
    worship: pair(2, 3),
    status: pair(4, 5),
    vigilance: pair(6, 7),
  };
}

// Chronotype (Munich Chronotype Questionnaire — adapted short
// form). 4 questions, Likert 0-4. Questions are framed so that
// "agree" pushes toward morningness or eveningness:
//   q0 +morning: I'd rather wake early than stay up late
//   q1 +morning: I do my best thinking in the morning
//   q2 +evening: I feel most alert in the evening
//   q3 +evening: Given total freedom I'd sleep past 9 am
//
// We score 0 = pure lark, 100 = pure owl, 50 = neutral.
export function computeChronotype(answers: number[]): {
  score: number;
  category: "lark" | "intermediate" | "owl";
} {
  const a = answers.slice(0, 4).map((v) => v ?? 0);
  // Evening sum minus morning sum, normalised to 0..100.
  const eveningSum = (a[2] ?? 0) + (a[3] ?? 0);
  const morningSum = (a[0] ?? 0) + (a[1] ?? 0);
  // Difference range is -8..+8; remap to 0..100.
  const score = Math.round(((eveningSum - morningSum + 8) / 16) * 100);
  let category: "lark" | "intermediate" | "owl" = "intermediate";
  if (score < 35) category = "lark";
  else if (score > 65) category = "owl";
  return { score, category };
}

// Adult attachment (ECR-R short form). 8 questions, 4 per dimension
// (anxiety / avoidance), Likert 0-4. Each dimension averaged, scaled
// to 0..100. Style derived from the quadrant against a 50-50 midpoint:
//   low anx + low avd  → secure
//   high anx + low avd → anxious (preoccupied)
//   low anx + high avd → avoidant (dismissive)
//   high anx + high avd → disorganized (fearful-avoidant)
//
// Question order (must match TestOverlay):
//   0..3 — anxiety items
//   4..7 — avoidance items
export function computeAttachment(answers: number[]): {
  anxiety: number;
  avoidance: number;
  style: "secure" | "anxious" | "avoidant" | "disorganized";
} {
  const avg = (start: number, count: number) => {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += answers[start + i] ?? 0;
    return Math.round((sum / (count * 4)) * 100);
  };
  const anxiety = avg(0, 4);
  const avoidance = avg(4, 4);
  const style =
    anxiety < 50 && avoidance < 50
      ? "secure"
      : anxiety >= 50 && avoidance < 50
        ? "anxious"
        : anxiety < 50 && avoidance >= 50
          ? "avoidant"
          : "disorganized";
  return { anxiety, avoidance, style };
}
