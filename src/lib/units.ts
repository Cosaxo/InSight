// User-facing unit preferences. Defaults to metric (°C / km/h); clicking
// the relevant chip on the AmbientCard toggles and persists the choice.

const KEY = "insight.units";

export type TempUnit = "C" | "F";
export type SpeedUnit = "kph" | "mph";

export interface Units {
  temp: TempUnit;
  speed: SpeedUnit;
}

const DEFAULT: Units = { temp: "C", speed: "kph" };

export function loadUnits(): Units {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Units>;
    return {
      temp: parsed.temp === "F" ? "F" : "C",
      speed: parsed.speed === "mph" ? "mph" : "kph",
    };
  } catch {
    return DEFAULT;
  }
}

export function saveUnits(u: Units): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    // ignore
  }
}

export function cToF(c: number): number {
  return c * 1.8 + 32;
}
