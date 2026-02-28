'use client';

import { useModeToggle } from './useModeToggle';

export function useBabysitterMode(refreshInterval = 60 * 1000) {
  return useModeToggle({
    endpoint: '/api/babysitter-mode',
    eventName: 'prism:babysitter-mode-change',
    label: 'babysitter mode',
    refreshInterval,
  });
}
