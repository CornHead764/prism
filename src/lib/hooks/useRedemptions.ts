'use client';

import { useCallback, useEffect, useState } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';

export interface Redemption {
  id: string;
  goalId: string;
  goalName: string | null;
  goalEmoji: string | null;
  userId: string;
  userName: string | null;
  userColor: string | null;
  pointsCost: number;
  notes: string | null;
  redeemedAt: string;
}

export function useRedemptions(options: { enabled?: boolean; refreshInterval?: number } = {}) {
  const { enabled = true, refreshInterval = 5 * 60 * 1000 } = options;
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRedemptions = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/goals/redemptions');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setRedemptions(data.redemptions ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load redemptions');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  useVisibilityPolling(fetchRedemptions, enabled ? refreshInterval : 0);

  return { redemptions, loading, error, refresh: fetchRedemptions };
}
