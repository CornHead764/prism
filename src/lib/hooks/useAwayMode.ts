'use client';

import { useModeToggle } from './useModeToggle';

export function useAwayMode(refreshInterval = 60 * 1000) {
  const { isActive, ...rest } = useModeToggle({
    endpoint: '/api/away-mode',
    eventName: 'prism:away-mode-change',
    label: 'away mode',
    refreshInterval,
  });

  return { isAway: isActive, ...rest };
}
