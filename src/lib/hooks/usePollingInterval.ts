'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'prism-perf-mode';
const CHANGE_EVENT = 'prism:performance-mode-change';

/**
 * Stretch factor applied to all polling intervals when performance mode is on.
 * 2.5× turns 120s → 300s and 300s → 750s, materially reducing CPU/network
 * load on weak hardware without making the dashboard feel stale.
 */
export const PERF_MODE_POLL_STRETCH = 2.5;

interface PerformanceModeChangeDetail {
  enabled: boolean;
}

function readInitial(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Returns an effective polling interval given a default. When performance
 * mode is on, the interval is stretched by PERF_MODE_POLL_STRETCH. The hook
 * stays in sync with toggle changes via the global perf-mode change event.
 *
 * Pass 0 (or negative) to mean "polling disabled" — that value is returned
 * as-is, never stretched.
 */
export function usePollingInterval(defaultMs: number): number {
  const [perfModeOn, setPerfModeOn] = useState<boolean>(readInitial);

  useEffect(() => {
    setPerfModeOn(readInitial());
    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent<PerformanceModeChangeDetail>).detail;
      if (typeof detail?.enabled === 'boolean') {
        setPerfModeOn(detail.enabled);
      }
    };
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  if (defaultMs <= 0) return defaultMs;
  return perfModeOn ? Math.round(defaultMs * PERF_MODE_POLL_STRETCH) : defaultMs;
}
