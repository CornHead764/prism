'use client';

import { useEffect } from 'react';
import { usePollingInterval } from './usePollingInterval';

/**
 * Sets up an interval that pauses when the page is hidden and resumes when visible.
 * Automatically refreshes data when the page becomes visible again.
 *
 * The provided interval is automatically stretched when Performance Mode is on
 * (see usePollingInterval). Callers pass their natural default; the hook
 * applies the stretch globally so weak-hardware tuning is centralized.
 *
 * @param callback - Function to call on each interval tick
 * @param intervalMs - Interval in milliseconds (0 or negative to disable)
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number
): void {
  const effectiveInterval = usePollingInterval(intervalMs);

  useEffect(() => {
    if (effectiveInterval <= 0) return;

    let interval = setInterval(callback, effectiveInterval);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        callback();
        interval = setInterval(callback, effectiveInterval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveInterval, callback]);
}
