// bodyEnergy.ts — kcal target + macro target estimation from profile.
//
// Background: BodyOverlay previously showed a static 2000-kcal
// reference. Once we have weight + birth year on the profile, we
// can compute a personalised RMR (Mifflin-St Jeor), apply an
// activity factor based on logged workouts, and surface a TDEE
// (Total Daily Energy Expenditure) the user can use as a real
// target.
//
// Caveats kept honest in the UI:
//   - Without height + sex, the formula is an approximation. We
//     use a unisex coefficient and a typical adult height (168 cm)
//     so the answer is correct in shape, not absolutely. Users
//     who care about precision will set their own target.
//   - Activity factor is a rough categorisation off recent
//     workouts — sedentary / light / moderate / active.

import type { Workout } from "../types";

interface EnergyInputs {
  weightKg?: number;
  birthYear?: number;
  recentWorkouts: Workout[]; // last 14 days
}

interface EnergyEstimate {
  rmr: number;          // resting metabolic rate, kcal/day
  tdee: number;         // total daily energy expenditure, kcal/day
  activity: "sedentary" | "light" | "moderate" | "active";
  // True when we had enough profile data to compute. False means the
  // UI should fall back to a static reference + a prompt to fill in
  // vital stats.
  personalised: boolean;
}

// Assumed values when profile fields are missing. These are the
// FDA/EU reference adult — they keep the formula from blowing up,
// not "the right answer for everyone."
const ASSUMED_HEIGHT_CM = 168;
const ASSUMED_AGE = 35;
const ASSUMED_WEIGHT_KG = 70;

export function estimateEnergy(inputs: EnergyInputs): EnergyEstimate {
  const weight = inputs.weightKg ?? ASSUMED_WEIGHT_KG;
  const age = inputs.birthYear
    ? Math.max(15, new Date().getFullYear() - inputs.birthYear)
    : ASSUMED_AGE;
  const height = ASSUMED_HEIGHT_CM;
  // Mifflin-St Jeor: 10*weight + 6.25*height - 5*age + s (s = +5 male,
  // -161 female). We don't store sex on the profile, so use the
  // average of the two: -78. This trades a few % accuracy for the
  // privacy of not asking.
  const rmr = Math.round(10 * weight + 6.25 * height - 5 * age - 78);

  // Activity factor from logged workout frequency in the last 14
  // days. The classic categories are:
  //   sedentary  ×1.2  — 0 sessions / wk
  //   light      ×1.375 — 1-3
  //   moderate   ×1.55  — 3-5
  //   active     ×1.725 — 6+
  // We treat "last 14 days" as 2 weeks and halve to get a weekly
  // rate; the rounding bucket falls out from there.
  const perWeek = inputs.recentWorkouts.length / 2;
  let factor = 1.2;
  let activity: EnergyEstimate["activity"] = "sedentary";
  if (perWeek >= 6) {
    factor = 1.725;
    activity = "active";
  } else if (perWeek >= 3) {
    factor = 1.55;
    activity = "moderate";
  } else if (perWeek >= 1) {
    factor = 1.375;
    activity = "light";
  }
  const tdee = Math.round(rmr * factor);
  return {
    rmr,
    tdee,
    activity,
    personalised: inputs.weightKg != null && inputs.birthYear != null,
  };
}

// Recommended macro targets given a kcal target. Defaults to a
// moderate-protein balanced split (25% protein / 45% carb / 30% fat).
// Protein floor of 1.6 g/kg keeps athletic users from undershooting
// even when calories run low.
export function macroTargets(
  kcalTarget: number,
  weightKg?: number,
): { protein: number; carbs: number; fat: number } {
  // Kcal-per-gram: protein 4, carbs 4, fat 9.
  const proteinFloor = weightKg != null ? Math.round(weightKg * 1.6) : 100;
  const proteinFromPct = Math.round((kcalTarget * 0.25) / 4);
  const protein = Math.max(proteinFloor, proteinFromPct);
  const carbs = Math.round((kcalTarget * 0.45) / 4);
  const fat = Math.round((kcalTarget * 0.30) / 9);
  return { protein, carbs, fat };
}

// % of kcal from each macro for a given grams intake. Used by the
// "macros · today" card to show the actual split alongside the
// target.
export function macroEnergyPct(g: { protein: number; carbs: number; fat: number }): {
  protein: number;
  carbs: number;
  fat: number;
} {
  const proteinKcal = g.protein * 4;
  const carbsKcal = g.carbs * 4;
  const fatKcal = g.fat * 9;
  const total = proteinKcal + carbsKcal + fatKcal;
  if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((proteinKcal / total) * 100),
    carbs: Math.round((carbsKcal / total) * 100),
    fat: Math.round((fatKcal / total) * 100),
  };
}

// Consecutive-day workout streak counted backwards from today. A day
// "counts" if any workout has its `date` equal to that day's ISO.
// Stops at the first day without a workout. Returns 0 for an empty
// log or no workout today / yesterday.
export function workoutStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;
  const set = new Set(workouts.map((w) => w.date));
  let streak = 0;
  // Allow a one-day grace: if today is empty but yesterday isn't,
  // count from yesterday. That stops the streak from breaking
  // before the user has logged today's session at, say, 23:30.
  const cursor = new Date();
  if (!set.has(formatIso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(formatIso(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
