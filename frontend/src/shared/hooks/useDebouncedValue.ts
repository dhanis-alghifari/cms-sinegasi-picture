
import { useState, useEffect } from 'react';
import { UI_CONSTANTS } from '@/shared/constants/ui';

export function useDebouncedValue<T>(value: T, delayMs = UI_CONSTANTS.SEARCH_DEBOUNCE_MS): T {
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
