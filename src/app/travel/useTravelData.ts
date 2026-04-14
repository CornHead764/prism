'use client';

import { useState, useCallback, useEffect } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import type { TravelPin } from './types';

export class TravelAuthError extends Error {
  constructor() { super('Not logged in'); this.name = 'TravelAuthError'; }
}

function checkResponse(res: Response, action: string): void {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new TravelAuthError();
    throw new Error(`Failed to ${action}`);
  }
}

async function fetchPins(): Promise<TravelPin[]> {
  const res = await fetch('/api/travel/pins');
  if (!res.ok) return [];
  const data = await res.json();
  return data.pins ?? [];
}

export function useTravelData() {
  const [pins, setPins] = useState<TravelPin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchPins();
    setPins(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, 300_000);

  const addPin = useCallback(async (payload: Omit<TravelPin, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    const res = await fetch('/api/travel/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'create pin');
    const pin = await res.json();
    setPins((prev) => [pin, ...prev]);
    return pin as TravelPin;
  }, []);

  const updatePin = useCallback(async (id: string, payload: Partial<TravelPin>) => {
    const res = await fetch(`/api/travel/pins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'update pin');
    const updated = await res.json();
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated as TravelPin;
  }, []);

  const deletePin = useCallback(async (id: string) => {
    const res = await fetch(`/api/travel/pins/${id}`, { method: 'DELETE' });
    checkResponse(res, 'delete pin');
    setPins((prev) => prev.filter((p) => p.id !== id && p.parentId !== id));
  }, []);

  return { pins, loading, addPin, updatePin, deletePin, refresh: load };
}
