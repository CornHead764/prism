'use client';

import { useCallback } from 'react';
import { useFetch } from './useFetch';
import type { GiftIdea } from '@/types';

export function useGiftIdeas(userId?: string) {
  // Include userId in URL as cache key so data refreshes on user switch
  const url = userId ? `/api/gift-ideas?_u=${userId}` : '/api/gift-ideas';
  const { data: ideas, setData: setIdeas, loading, error, refresh } = useFetch<GiftIdea[]>({
    url,
    initialData: [],
    transform: (json: unknown) => {
      const data = json as { ideas: GiftIdea[] };
      return data.ideas || [];
    },
    refreshInterval: 2 * 60 * 1000,
    label: 'gift-ideas',
  });

  const addIdea = useCallback(async (data: {
    forUserId: string;
    name: string;
    url?: string;
    notes?: string;
    price?: string;
  }) => {
    const response = await fetch('/api/gift-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add gift idea');
    }
    refresh();
  }, [refresh]);

  const updateIdea = useCallback(async (id: string, data: Record<string, unknown>) => {
    const response = await fetch(`/api/gift-ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update gift idea');
    refresh();
  }, [refresh]);

  const deleteIdea = useCallback(async (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
    const response = await fetch(`/api/gift-ideas/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      refresh();
      throw new Error('Failed to delete gift idea');
    }
  }, [setIdeas, refresh]);

  const togglePurchased = useCallback(async (id: string) => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    await updateIdea(id, { purchased: !idea.purchased });
  }, [ideas, updateIdea]);

  return { ideas, loading, error, refresh, addIdea, updateIdea, deleteIdea, togglePurchased };
}
