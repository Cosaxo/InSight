import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "insight.tweaks";

export function useTweaks<T extends Record<string, unknown>>(
  defaults: T,
): [T, (key: keyof T | Partial<T>, val?: T[keyof T]) => void] {
  const [values, setValues] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<T>;
        return { ...defaults, ...parsed };
      }
    } catch {
      // ignore
    }
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // ignore
    }
  }, [values]);

  const setTweak = useCallback(
    (keyOrEdits: keyof T | Partial<T>, val?: T[keyof T]) => {
      const edits: Partial<T> =
        typeof keyOrEdits === "object" && keyOrEdits !== null
          ? (keyOrEdits as Partial<T>)
          : ({ [keyOrEdits]: val } as Partial<T>);
      setValues((prev) => ({ ...prev, ...edits }));
    },
    [],
  );

  return [values, setTweak];
}
