import { useCallback, useEffect, useRef } from "react";

// Returns a debounced copy of `fn`. The returned identity is stable across
// re-renders; when `fn` changes the wrapper uses the latest version.
export function useDebounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): (...args: TArgs) => void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const timerRef = useRef<number | null>(null);

  return useCallback(
    (...args: TArgs) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        fnRef.current(...args);
      }, ms);
    },
    [ms],
  );
}
