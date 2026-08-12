// src/shared/hooks/useDebouncedValue.ts
// Custom hook for debouncing fast-changing values (e.g., search inputs)
// Constitution: Custom hooks with single responsibility + memory safe cleanup

import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
