'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'prism-perf-mode';
const PERF_CHANGE_EVENT = 'prism:performance-mode-change';

interface PerformanceModeChangeDetail {
  enabled: boolean;
}

function readPerfMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns true when motion-heavy effects (full-screen celebrations, plane
 * fly-by, confetti) should be skipped. Two reasons fold into one signal:
 *   - The OS-level `prefers-reduced-motion` accessibility preference is set.
 *   - Performance Mode is enabled (manual or auto-detected).
 *
 * Stays in sync with both signals at runtime — perf-mode toggles emit a
 * window event; the media query has a built-in change listener.
 */
export function useShouldSkipMotion(): boolean {
  const [skip, setSkip] = useState<boolean>(() => readPerfMode() || readReducedMotion());

  useEffect(() => {
    const recompute = () => setSkip(readPerfMode() || readReducedMotion());
    recompute();

    const mq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    mq?.addEventListener('change', recompute);
    window.addEventListener(PERF_CHANGE_EVENT, recompute as EventListener);
    return () => {
      mq?.removeEventListener('change', recompute);
      window.removeEventListener(PERF_CHANGE_EVENT, recompute as EventListener);
    };
  }, []);

  return skip;
}

// Re-export the same constants in case other modules want them.
export { STORAGE_KEY as PERF_STORAGE_KEY, PERF_CHANGE_EVENT };
export type { PerformanceModeChangeDetail };
