'use client';

import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch';

export interface CalendarNote {
  id: string;
  date: string;
  content: string;
  createdBy: string | null;
  updatedAt: string;
}

interface UseCalendarNotesOptions {
  from: string;
  to: string;
  enabled?: boolean;
}

function transformNotes(json: unknown): CalendarNote[] {
  const data = json as { notes: CalendarNote[] };
  return data.notes || [];
}

export function useCalendarNotes({ from, to, enabled = true }: UseCalendarNotesOptions) {
  const url = enabled && from && to
    ? `/api/calendar-notes?from=${from}&to=${to}`
    : '/api/calendar-notes?from=1970-01-01&to=1970-01-01';

  const { data: notes, loading, error, refresh } = useFetch<CalendarNote[]>({
    url,
    initialData: [],
    transform: transformNotes,
    refreshInterval: 300000,
    label: 'calendar-notes',
    enabled,
  });

  const notesByDate = useMemo(() => {
    const map = new Map<string, CalendarNote>();
    if (notes) {
      for (const note of notes) {
        map.set(note.date, note);
      }
    }
    return map;
  }, [notes]);

  const upsertNote = useCallback(async (date: string, content: string) => {
    try {
      await fetch('/api/calendar-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content }),
      });
      refresh();
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }, [refresh]);

  return { notesByDate, loading, error, upsertNote, refresh };
}
