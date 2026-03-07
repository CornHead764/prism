'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  format,
  isToday,
  isTomorrow,
  isSameDay,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/lib/utils/color';
import { deduplicateEvents } from '@/lib/utils/calendarDedup';
import { WidgetContainer, WidgetEmpty, useWidgetBgOverride } from './WidgetContainer';
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { useCalendarEvents, useCalendarFilter } from '@/lib/hooks';
import { MonthView, WeekView, MultiWeekView, DayViewSideBySide } from '@/components/calendar';
import type { CalendarEvent } from '@/types/calendar';
export type { CalendarEvent };


type WidgetViewType = 'list' | 'day' | 'week' | 'multiWeek' | 'month';

const VIEW_OPTIONS: { value: WidgetViewType; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'multiWeek', label: 'Weeks' },
  { value: 'month', label: 'Month' },
];

/** Determine which views are available at a given grid size (48-col grid) */
function getAvailableViews(gridW: number, gridH: number): WidgetViewType[] {
  if (gridW >= 36 && gridH >= 24) return ['list', 'day', 'week', 'multiWeek', 'month'];
  if (gridW >= 24 && gridH >= 36) return ['list', 'day', 'week', 'multiWeek', 'month'];
  if (gridW >= 24 && gridH >= 24) return ['list', 'week', 'multiWeek', 'month'];
  if (gridW >= 16 && gridH >= 16) return ['list', 'week', 'multiWeek'];
  return ['list'];
}


export interface CalendarWidgetProps {
  events?: CalendarEvent[];
  loading?: boolean;
  error?: string | null;
  onEventClick?: (event: CalendarEvent) => void;
  titleHref?: string;
  className?: string;
  gridW?: number;
  gridH?: number;
}


export const CalendarWidget = React.memo(function CalendarWidget({
  events: externalEvents,
  loading: externalLoading,
  error: externalError,
  onEventClick,
  titleHref,
  className,
  gridW = 2,
  gridH = 2,
}: CalendarWidgetProps) {
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [widgetWeekCount, setWidgetWeekCount] = useState<1 | 2 | 3 | 4>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prism-calendar-weekcount');
      const n = Number(saved);
      if (n >= 1 && n <= 4) return n as 1 | 2 | 3 | 4;
    }
    return 2;
  });
  const [widgetBordered, setWidgetBordered] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism-calendar-bordered') === 'true';
    }
    return false;
  });
  const [viewType, setViewType] = useState<WidgetViewType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prism-calendar-view');
      const mapped = saved === 'twoWeek' ? 'multiWeek' : saved;
      if (mapped && ['list', 'day', 'week', 'multiWeek', 'month'].includes(mapped)) {
        return mapped as WidgetViewType;
      }
    }
    return 'list';
  });

  // Persist view type and week count to localStorage
  useEffect(() => {
    localStorage.setItem('prism-calendar-view', viewType);
  }, [viewType]);
  useEffect(() => {
    localStorage.setItem('prism-calendar-weekcount', String(widgetWeekCount));
  }, [widgetWeekCount]);
  useEffect(() => {
    localStorage.setItem('prism-calendar-bordered', String(widgetBordered));
  }, [widgetBordered]);

  // Fetch own events if none provided
  const { events: apiEvents, loading: apiLoading, error: apiError } = useCalendarEvents({ daysToShow: 60 });
  const { selectedCalendarIds, toggleCalendar, filterEvents, calendarGroups } = useCalendarFilter();

  const loading = externalLoading ?? apiLoading;
  const error = externalError ?? apiError;
  const rawEvents = externalEvents ?? apiEvents;
  const events = useMemo(() => {
    return deduplicateEvents(filterEvents(rawEvents));
  }, [filterEvents, rawEvents]);

  // Size awareness
  const availableViews = useMemo(() => getAvailableViews(gridW, gridH), [gridW, gridH]);
  const effectiveView = availableViews.includes(viewType) ? viewType : 'list';
  const viewUnavailable = viewType !== effectiveView;

  // Navigation
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goToPrevious = useCallback(() => {
    setCurrentDate(d => {
      switch (effectiveView) {
        case 'day': return subDays(d, 1);
        case 'week': return subWeeks(d, 1);
        case 'multiWeek': return subWeeks(d, widgetWeekCount);
        case 'month': return subMonths(d, 1);
        default: return subDays(d, 3);
      }
    });
  }, [effectiveView, widgetWeekCount]);
  const goToNext = useCallback(() => {
    setCurrentDate(d => {
      switch (effectiveView) {
        case 'day': return addDays(d, 1);
        case 'week': return addWeeks(d, 1);
        case 'multiWeek': return addWeeks(d, widgetWeekCount);
        case 'month': return addMonths(d, 1);
        default: return addDays(d, 3);
      }
    });
  }, [effectiveView, widgetWeekCount]);

  // List view data
  const listDays = 14;
  const listStartDate = startOfDay(new Date());
  const listEvents = useMemo(() => {
    const endDate = addDays(listStartDate, listDays);
    return events
      .filter(e => {
        const ed = startOfDay(e.startTime);
        return ed >= listStartDate && ed < endDate;
      })
      .sort((a, b) => {
        const dc = startOfDay(a.startTime).getTime() - startOfDay(b.startTime).getTime();
        if (dc !== 0) return dc;
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.startTime.getTime() - b.startTime.getTime();
      });
  }, [events, listStartDate]);

  const eventsByDay = useMemo(() => {
    const result: Array<{ date: Date; events: CalendarEvent[] }> = [];
    for (let i = 0; i < listDays; i++) {
      const date = addDays(listStartDate, i);
      const dayEvents = listEvents.filter(e => isSameDay(e.startTime, date));
      if (dayEvents.length > 0) result.push({ date, events: dayEvents });
    }
    return result;
  }, [listEvents, listStartDate]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    onEventClick?.(event);
  }, [onEventClick]);

  // Header actions
  const headerActions = (
    <div className="flex items-center gap-1">
      {/* Navigation (hidden in list-only mode) */}
      {availableViews.length > 1 && (
        <>
          <button onClick={goToPrevious} className="p-0.5 rounded hover:bg-accent" aria-label="Previous">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={goToToday} className="px-1.5 py-0.5 rounded text-[10px] font-medium hover:bg-accent">
            Today
          </button>
          <button onClick={goToNext} className="p-0.5 rounded hover:bg-accent" aria-label="Next">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {/* View selector */}
      {availableViews.length > 1 && (
        <>
          <Select value={viewType} onValueChange={(v) => setViewType(v as WidgetViewType)}>
            <SelectTrigger aria-label="Calendar view" className={cn("h-6 w-[70px] text-[10px]", transparentMode && "bg-transparent border-current/20")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEW_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-xs"
                  disabled={!availableViews.includes(opt.value)}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {effectiveView === 'multiWeek' && (
            <>
              <Select value={String(widgetWeekCount)} onValueChange={(v) => setWidgetWeekCount(Number(v) as 1 | 2 | 3 | 4)}>
                <SelectTrigger aria-label="Number of weeks" className={cn("h-6 w-[46px] text-[10px]", transparentMode && "bg-transparent border-current/20")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n}w</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => setWidgetBordered(!widgetBordered)}
                className={cn(
                  'p-0.5 rounded hover:bg-accent',
                  widgetBordered && 'bg-accent'
                )}
                title={widgetBordered ? 'Hide cell borders' : 'Show cell borders'}
                aria-label="Toggle cell borders"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  // Calendar filter chips (shown below header when calendars exist)
  const calendarChips = calendarGroups.length > 0 ? (
    <div className="flex items-center gap-1 flex-wrap px-3 pb-2 -mt-1">
      <button
        onClick={() => toggleCalendar('all')}
        className={cn(
          'px-2 py-1 rounded-full text-[10px] font-medium transition-colors leading-none',
          selectedCalendarIds.has('all')
            ? 'bg-primary text-primary-foreground'
            : transparentMode ? 'text-current/70 hover:text-current' : 'bg-muted text-muted-foreground hover:bg-accent'
        )}
      >
        All
      </button>
      {calendarGroups.map((group) => (
        <button
          key={group.id}
          onClick={() => toggleCalendar(group.id)}
          className={cn(
            'px-2 py-1 rounded-full text-[10px] font-medium transition-colors inline-flex items-center gap-1 leading-none',
            selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
              ? isLightColor(group.color) ? 'text-gray-900' : 'text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          )}
          style={
            selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
              ? { backgroundColor: group.color }
              : undefined
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: group.color }}
          />
          {group.name}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <WidgetContainer
      title="Calendar"
      titleHref={titleHref}
      icon={<Calendar className="h-4 w-4" />}
      size="large"
      loading={loading}
      error={error}
      actions={headerActions}
      className={className}
    >
      {calendarChips}
      {viewUnavailable && (
        <div className="text-[10px] text-muted-foreground text-center py-1 bg-muted/50 rounded mb-1">
          Resize widget for {VIEW_OPTIONS.find(v => v.value === viewType)?.label} view
        </div>
      )}

      {effectiveView === 'list' && (
        listEvents.length === 0 ? (
          <WidgetEmpty
            icon={<Calendar className="h-8 w-8" />}
            message="No upcoming events"
          />
        ) : (
          <div className="overflow-auto h-full -mr-2 pr-2">
            <div className="space-y-4">
              {eventsByDay.map(({ date, events: dayEvts }) => (
                <DaySection
                  key={date.toISOString()}
                  date={date}
                  events={dayEvts}
                  maxEvents={5}
                  onEventClick={handleEventClick}
                />
              ))}
            </div>
          </div>
        )
      )}

      {effectiveView === 'month' && (
        <MonthView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
          onDateClick={(date) => {
            setCurrentDate(date);
            setViewType('day');
          }}
        />
      )}

      {effectiveView === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
        />
      )}

      {effectiveView === 'multiWeek' && (
        <MultiWeekView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
          weekCount={widgetWeekCount}
          bordered={widgetBordered}
        />
      )}

      {effectiveView === 'day' && (
        <>
          <div className="text-center text-sm font-medium text-foreground mb-2">
            {formatDayHeader(currentDate)}
          </div>
          <DayViewSideBySide
            currentDate={currentDate}
            events={events}
            calendarGroups={calendarGroups}
            selectedCalendarIds={selectedCalendarIds}
            onEventClick={handleEventClick}
          />
        </>
      )}
    </WidgetContainer>
  );
});


// ---- List view sub-components (kept from original) ----

function DaySection({
  date,
  events,
  maxEvents,
  onEventClick,
}: {
  date: Date;
  events: CalendarEvent[];
  maxEvents: number;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const displayEvents = events.slice(0, maxEvents);
  const remainingCount = events.length - maxEvents;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'text-sm font-semibold',
            isToday(date) && 'text-seasonal-accent'
          )}
        >
          {formatDayHeader(date)}
        </span>
        {isToday(date) && (
          <Badge className="text-[10px] px-1.5 py-0 bg-seasonal-highlight text-seasonal-accent-foreground">
            Today
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 pl-2 border-l-2 border-border">
        {displayEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
          />
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-muted-foreground pl-2">
            +{remainingCount} more events
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-2 p-1.5 rounded',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation'
      )}
    >
      <div
        className="w-1 h-full min-h-[24px] rounded-full flex-shrink-0"
        style={{ backgroundColor: event.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">
          {event.allDay ? 'All day' : format(event.startTime, 'h:mm a')}
        </div>
        <div className="text-sm font-medium truncate">
          {event.title}
        </div>
        {event.location && (
          <div className="text-xs text-muted-foreground truncate">
            {event.location}
          </div>
        )}
      </div>
    </button>
  );
}

function formatDayHeader(date: Date): string {
  const dayName = format(date, 'EEEE, MMMM d, yyyy');
  if (isToday(date)) return `Today — ${dayName}`;
  if (isTomorrow(date)) return `Tomorrow — ${dayName}`;
  return dayName;
}
