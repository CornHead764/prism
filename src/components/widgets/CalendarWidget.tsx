'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  format,
  isToday,
  isTomorrow,
  startOfWeek,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Grid3X3, Merge, StickyNote, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { contrastText, isLightColor } from '@/lib/utils/color';
import { UserAvatar } from '@/components/ui/avatar';
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
import { useCalendarEvents, useCalendarFilter, useCalendarNotes } from '@/lib/hooks';
import { useAuth, useFamily } from '@/components/providers';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
const MonthView = lazy(() => import('@/components/calendar/MonthView').then(m => ({ default: m.MonthView })));
const WeekView = lazy(() => import('@/components/calendar/WeekView').then(m => ({ default: m.WeekView })));
const MultiWeekView = lazy(() => import('@/components/calendar/MultiWeekView').then(m => ({ default: m.MultiWeekView })));
const DayViewSideBySide = lazy(() => import('@/components/calendar/DayViewSideBySide').then(m => ({ default: m.DayViewSideBySide })));
const WeekVerticalView = lazy(() => import('@/components/calendar/WeekVerticalView').then(m => ({ default: m.WeekVerticalView })));
const AgendaView = lazy(() => import('@/components/calendar/AgendaView').then(m => ({ default: m.AgendaView })));
import type { CalendarEvent } from '@/types/calendar';
export type { CalendarEvent };


type WidgetViewType = 'agenda' | 'list' | 'day' | 'week' | 'multiWeek' | 'multiWeek2' | 'multiWeek3' | 'multiWeek4' | 'month';

const VIEW_OPTIONS: { value: WidgetViewType; label: string }[] = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'list', label: 'List' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'multiWeek', label: '1W' },
  { value: 'multiWeek2', label: '2W' },
  { value: 'multiWeek3', label: '3W' },
  { value: 'multiWeek4', label: '4W' },
  { value: 'month', label: 'Month' },
];

/** Determine which views are available at a given grid size (48-col grid) */
function getAvailableViews(gridW: number, gridH: number): WidgetViewType[] {
  const mw: WidgetViewType[] = ['multiWeek', 'multiWeek2', 'multiWeek3', 'multiWeek4'];
  if (gridW >= 36 && gridH >= 24) return ['agenda', 'list', 'day', 'week', ...mw, 'month'];
  if (gridW >= 24 && gridH >= 36) return ['agenda', 'list', 'day', 'week', ...mw, 'month'];
  if (gridW >= 24 && gridH >= 24) return ['agenda', 'list', 'week', ...mw, 'month'];
  if (gridW >= 16 && gridH >= 16) return ['agenda', 'list', 'week', ...mw];
  return ['agenda'];
}

/** Resolve multiWeekN view type to base view + week count */
function resolveMultiWeek(vt: WidgetViewType): { baseView: 'agenda' | 'list' | 'day' | 'week' | 'multiWeek' | 'month'; weekCount: 1 | 2 | 3 | 4 } {
  if (vt === 'multiWeek') return { baseView: 'multiWeek', weekCount: 1 };
  if (vt === 'multiWeek2') return { baseView: 'multiWeek', weekCount: 2 };
  if (vt === 'multiWeek3') return { baseView: 'multiWeek', weekCount: 3 };
  if (vt === 'multiWeek4') return { baseView: 'multiWeek', weekCount: 4 };
  return { baseView: vt as 'agenda' | 'list' | 'day' | 'week' | 'month', weekCount: 2 };
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
  const { activeUser } = useAuth();
  const { members: familyMembers } = useFamily();
  const { weekStartsOn } = useWeekStartsOn();
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [widgetBordered, setWidgetBordered] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism-calendar-bordered') === 'true';
    }
    return false;
  });
  const [mergedView, setMergedView] = useState(false);
  const [showNotes, setShowNotes] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism-calendar-notes-visible') === 'true';
    }
    return false;
  });
  const [viewType, setViewType] = useState<WidgetViewType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prism-calendar-view');
      // Migrate old formats
      if (saved === 'twoWeek') return 'multiWeek2';
      if (saved === 'multiWeek') {
        const wc = Number(localStorage.getItem('prism-calendar-weekcount') || '2');
        if (wc === 1) return 'multiWeek';
        if (wc === 3) return 'multiWeek3';
        if (wc === 4) return 'multiWeek4';
        return 'multiWeek2';
      }
      // Migrate old 'list' to 'agenda'
      if (saved === 'list') return 'agenda';
      const valid: WidgetViewType[] = ['agenda', 'list', 'day', 'week', 'multiWeek', 'multiWeek2', 'multiWeek3', 'multiWeek4', 'month'];
      if (saved && valid.includes(saved as WidgetViewType)) {
        return saved as WidgetViewType;
      }
    }
    return 'agenda';
  });

  // Persist view type to localStorage
  useEffect(() => {
    localStorage.setItem('prism-calendar-view', viewType);
  }, [viewType]);
  useEffect(() => {
    localStorage.setItem('prism-calendar-bordered', String(widgetBordered));
  }, [widgetBordered]);
  useEffect(() => {
    localStorage.setItem('prism-calendar-notes-visible', String(showNotes));
  }, [showNotes]);

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
  const effectiveView = availableViews.includes(viewType) ? viewType : 'agenda';
  const viewUnavailable = viewType !== effectiveView;
  const { baseView: resolvedView, weekCount: resolvedWeekCount } = resolveMultiWeek(effectiveView);

  // Notes: compute date range for visible days and fetch
  const notesSupported = resolvedView === 'list' || resolvedView === 'day';
  const notesDays = useMemo(() => {
    if (!notesSupported) return [];
    if (resolvedView === 'day') return [currentDate];
    // list view = 7 days starting from week start
    const ws = startOfWeek(currentDate, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [notesSupported, resolvedView, currentDate]);

  const notesFrom = notesDays.length > 0 ? format(notesDays[0]!, 'yyyy-MM-dd') : '';
  const notesTo = notesDays.length > 0 ? format(notesDays[notesDays.length - 1]!, 'yyyy-MM-dd') : '';
  const { notesByDate, upsertNote } = useCalendarNotes({
    from: notesFrom,
    to: notesTo,
    enabled: showNotes && notesSupported,
  });

  // Navigation
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goToPrevious = useCallback(() => {
    setCurrentDate(d => {
      switch (resolvedView) {
        case 'day': return subDays(d, 1);
        case 'list':
        case 'week': return subWeeks(d, 1);
        case 'multiWeek': return subWeeks(d, resolvedWeekCount);
        case 'month': return subMonths(d, 1);
        default: return subDays(d, 3);
      }
    });
  }, [resolvedView, resolvedWeekCount]);
  const goToNext = useCallback(() => {
    setCurrentDate(d => {
      switch (resolvedView) {
        case 'day': return addDays(d, 1);
        case 'list':
        case 'week': return addWeeks(d, 1);
        case 'multiWeek': return addWeeks(d, resolvedWeekCount);
        case 'month': return addMonths(d, 1);
        default: return addDays(d, 3);
      }
    });
  }, [resolvedView, resolvedWeekCount]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    onEventClick?.(event);
  }, [onEventClick]);

  // Header actions
  const showMerge = (resolvedView === 'day' || resolvedView === 'list') && calendarGroups.length > 1;
  const headerActions = (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Navigation (hidden in agenda-only mode) */}
      {availableViews.length > 1 && resolvedView !== 'agenda' && (
        <>
          <button onClick={goToPrevious} className="p-0.5 rounded hover:opacity-70" aria-label="Previous">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={goToToday} className="px-1.5 py-0.5 rounded text-[10px] font-medium hover:opacity-70">
            Today
          </button>
          <button onClick={goToNext} className="p-0.5 rounded hover:opacity-70" aria-label="Next">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {/* Merge/Split toggle for day and list views */}
      {showMerge && (
        <button
          onClick={() => setMergedView(!mergedView)}
          className={cn('p-0.5 rounded hover:opacity-70', mergedView && 'bg-current/20')}
          title={mergedView ? 'Split by calendar' : 'Merge into one column'}
          aria-label={mergedView ? 'Split by calendar' : 'Merge calendars'}
        >
          <Merge className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Notes toggle for day and list views */}
      {notesSupported && (
        <button
          onClick={() => setShowNotes(!showNotes)}
          className={cn('p-0.5 rounded hover:opacity-70', showNotes && 'bg-current/20')}
          title={showNotes ? 'Hide notes' : 'Show notes'}
          aria-label={showNotes ? 'Hide notes' : 'Show notes'}
        >
          <StickyNote className="h-3.5 w-3.5" />
        </button>
      )}

      {/* View selector */}
      {availableViews.length > 1 && (
        <>
          <Select value={viewType} onValueChange={(v) => setViewType(v as WidgetViewType)}>
            <SelectTrigger aria-label="Calendar view" className={cn("h-6 w-[90px] text-[10px]", transparentMode && "bg-transparent border-current/20")}>
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
          {(resolvedView === 'multiWeek' || resolvedView === 'week' || resolvedView === 'day' || resolvedView === 'list' || resolvedView === 'month') && (
            <button
              onClick={() => setWidgetBordered(!widgetBordered)}
              className={cn(
                'p-0.5 rounded hover:opacity-70',
                widgetBordered && 'bg-current/20'
              )}
              title={widgetBordered ? 'Hide grid lines' : 'Show grid lines'}
              aria-label="Toggle grid lines"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
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
              ? isLightColor(group.color) ? '!text-black' : '!text-white'
              : transparentMode ? 'text-current/60 hover:text-current' : 'bg-muted text-muted-foreground hover:bg-accent'
          )}
          style={
            selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
              ? { backgroundColor: group.color }
              : undefined
          }
        >
          {(() => {
            const member = group.userId ? familyMembers.find(m => m.id === group.userId) : null;
            return member ? (
              <UserAvatar name={member.name} imageUrl={member.avatarUrl} color={member.color} size="sm" className="h-3 w-3 text-[6px]" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
            );
          })()}
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

      {/* flex-1 min-h-0: fills remaining space after calendar chips / notices so views
          get a proper definite height for their internal h-full / overflow-y-auto */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          {resolvedView === 'agenda' && (
            <AgendaView
              events={events}
              days={14}
              maxEventsPerDay={5}
              onEventClick={handleEventClick}
            />
          )}

          {resolvedView === 'list' && (
            <WeekVerticalView
              currentDate={currentDate}
              events={events}
              calendarGroups={calendarGroups}
              selectedCalendarIds={selectedCalendarIds}
              mergedView={mergedView}
              bordered={widgetBordered}
              onEventClick={handleEventClick}
              showNotes={showNotes}
              notesByDate={notesByDate}
              onNoteChange={activeUser ? upsertNote : undefined}
            />
          )}

          {resolvedView === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              bordered={widgetBordered}
              onDateClick={(date) => {
                setCurrentDate(date);
                setViewType('day');
              }}
            />
          )}

          {resolvedView === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              bordered={widgetBordered}
            />
          )}

          {resolvedView === 'multiWeek' && (
            <MultiWeekView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              weekCount={resolvedWeekCount}
              bordered={widgetBordered}
            />
          )}

          {resolvedView === 'day' && (
            <div className="h-full flex flex-col">
              <div className="text-center text-sm font-medium text-foreground mb-2 shrink-0">
                {formatDayHeader(currentDate)}
              </div>
              <div className="flex-1 min-h-0">
                <DayViewSideBySide
                  currentDate={currentDate}
                  events={events}
                  calendarGroups={calendarGroups}
                  selectedCalendarIds={selectedCalendarIds}
                  mergedView={mergedView}
                  bordered={widgetBordered}
                  onEventClick={handleEventClick}
                  showNotes={showNotes}
                  notesByDate={notesByDate}
                  onNoteChange={activeUser ? upsertNote : undefined}
                />
              </div>
            </div>
          )}
        </Suspense>
      </div>
    </WidgetContainer>
  );
});


function formatDayHeader(date: Date): string {
  const dayName = format(date, 'EEEE, MMMM d, yyyy');
  if (isToday(date)) return `Today - ${dayName}`;
  if (isTomorrow(date)) return `Tomorrow - ${dayName}`;
  return dayName;
}
