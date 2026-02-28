'use client';

import { useFetch } from './useFetch';

export interface PointSummary {
  userId: string;
  name: string;
  color: string;
  weekly: number;
  monthly: number;
  yearly: number;
  allTime: number;
}

export function usePoints(refreshInterval = 2 * 60 * 1000) {
  const { data: points, loading, error, refresh } = useFetch<PointSummary[]>({
    url: '/api/points',
    initialData: [],
    transform: (json) => (json as { points: PointSummary[] }).points,
    refreshInterval,
    label: 'points',
  });

  return { points, loading, error, refresh };
}
