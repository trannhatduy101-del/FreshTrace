import { useEffect, useState } from "react";

// Returns a value that only updates after `delay` ms of no changes.
// Used to avoid firing RPC calls on every keystroke in search fields.
export function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
