import { useEffect, useState } from "react";

/**
 * Debounce any fast-changing value (e.g. search input) before it triggers
 * expensive work such as engine queries. Returns the debounced value.
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
