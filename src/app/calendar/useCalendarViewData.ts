'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  subDays,
} from 'date-fns';
import { useCalendarEvents, useCalendarFilter } from '@/lib/hooks';
import { deduplicateEvents } from '@/lib/utils/calendarDedup';
import type { CalendarEvent } from '@/types/calendar';

export type CalendarViewType = 'day' | 'week' | 'weekVertical' | 'multiWeek' | 'month' | 'threeMonth';
export type MultiWeekCount = 1 | 2 | 3 | 4;

export type { CalendarGroup } from '@/lib/hooks';

export function useCalendarViewData() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [weekCount, setWeekCount] = useState<MultiWeekCount>(2);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [mergedView, setMergedView] = useState(false);
  const [weeksBordered, setWeeksBordered] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism-calendar-bordered') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('prism-calendar-bordered', String(weeksBordered));
  }, [weeksBordered]);

  const { selectedCalendarIds, toggleCalendar, filterEvents, calendarGroups } = useCalendarFilter();
  const { events: apiEvents, loading, error, refresh: refreshEvents } = useCalendarEvents({ daysToShow: 60 });

  const events: CalendarEvent[] = useMemo(() => {
    const mapped = apiEvents.map((event) => ({
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      color: event.color,
      location: event.location,
      calendarName: event.calendarName,
      calendarId: event.calendarId,
    }));
    return deduplicateEvents(filterEvents(mapped));
  }, [apiEvents, filterEvents]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const goToPrevious = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return subDays(prev, 1);
        case 'week': return subWeeks(prev, 1);
        case 'weekVertical': return subWeeks(prev, 1);
        case 'multiWeek': return subWeeks(prev, weekCount);
        case 'month': return subMonths(prev, 1);
        case 'threeMonth': return subMonths(prev, 1);
      }
    });
  }, [viewType, weekCount]);

  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return addDays(prev, 1);
        case 'week': return addWeeks(prev, 1);
        case 'weekVertical': return addWeeks(prev, 1);
        case 'multiWeek': return addWeeks(prev, weekCount);
        case 'month': return addMonths(prev, 1);
        case 'threeMonth': return addMonths(prev, 1);
      }
    });
  }, [viewType, weekCount]);

  const getDateRangeTitle = useCallback((): string => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
      case 'weekVertical': {
        const ws = startOfWeek(currentDate);
        const we = endOfWeek(currentDate);
        return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`;
      }
      case 'multiWeek': {
        const tws = startOfWeek(currentDate);
        const twe = endOfWeek(addWeeks(currentDate, weekCount - 1));
        return `${format(tws, 'MMM d')} - ${format(twe, 'MMM d, yyyy')}`;
      }
      case 'month':
      case 'threeMonth':
        return format(currentDate, 'MMMM yyyy');
    }
  }, [viewType, weekCount, currentDate]);

  return {
    currentDate, setCurrentDate,
    viewType, setViewType,
    weekCount, setWeekCount,
    selectedEvent, setSelectedEvent,
    showAddEvent, setShowAddEvent,
    editingEvent, setEditingEvent,
    selectedCalendarIds,
    calendarGroups,
    toggleCalendar,
    mergedView, setMergedView,
    weeksBordered, setWeeksBordered,
    events, loading, error, refreshEvents,
    goToToday, goToPrevious, goToNext, getDateRangeTitle,
  };
}
