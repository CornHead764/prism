'use client';

import { useState, useCallback } from 'react';
import { useFetch } from './useFetch';

export interface Birthday {
  id: string;
  name: string;
  birthDate: string;
  eventType: 'birthday' | 'anniversary' | 'milestone';
  age: number | null;
  daysUntil: number;
  nextBirthday: string;
  giftIdeas?: string;
}

interface UseBirthdaysOptions {
  limit?: number;
  refreshInterval?: number;
  enabled?: boolean;
}

export function useBirthdays(options: UseBirthdaysOptions = {}) {
  const { limit = 10, refreshInterval = 60 * 60 * 1000, enabled } = options;
  const [syncError, setSyncError] = useState<string | null>(null);

  const { data: birthdays, loading, error: fetchError, refresh } = useFetch<Birthday[]>({
    url: `/api/birthdays?limit=${limit}`,
    initialData: [],
    transform: (json) => (json as { birthdays?: Birthday[] }).birthdays || [],
    refreshInterval,
    label: 'birthdays',
    enabled,
  });

  const syncFromGoogle = useCallback(async () => {
    try {
      setSyncError(null);
      const response = await fetch('/api/birthdays/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to sync from Google Calendar');
      await refresh();
    } catch (err) {
      console.error('Error syncing birthdays:', err);
      setSyncError(err instanceof Error ? err.message : 'Failed to sync');
    }
  }, [refresh]);

  return {
    birthdays,
    loading,
    error: syncError || fetchError,
    refresh,
    syncFromGoogle,
  };
}
