'use client';

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

interface UseFetchOptions<T> {
  url: string;
  initialData: T;
  transform?: (json: unknown) => T;
  refreshInterval?: number;
  label?: string;
}

interface UseFetchResult<T> {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFetch<T>(options: UseFetchOptions<T>): UseFetchResult<T> {
  const { url, initialData, transform, refreshInterval = 0, label = 'data' } = options;

  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const labelRef = useRef(label);
  labelRef.current = label;

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${labelRef.current}`);
      const json = await response.json();
      setData(transformRef.current ? transformRef.current(json) : json);
    } catch (err) {
      console.error(`Error fetching ${labelRef.current}:`, err);
      setError(err instanceof Error ? err.message : `Failed to fetch ${labelRef.current}`);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useVisibilityPolling(fetchData, refreshInterval);

  return { data, setData, loading, error, refresh: fetchData };
}
