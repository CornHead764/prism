'use client';

import * as React from 'react';
import { useMemo, useCallback, lazy, Suspense } from 'react';
import { format, isToday, isTomorrow, startOfWeek, addDays } from 'date-fns';
import { Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/lib/utils/color';
import { deduplicateEvents } from '@/lib/utils/calendarDedup';
import { WidgetContainer, useWidgetBgOverride } from './WidgetContainer';
import { useCalendarEvents, useCalendarFilter, useCalendarNotes } from '@/lib/hooks';
import { useAuth } from '@/components/providers';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { useCalendarWidgetPrefs, VIEW_OPTIONS } from '@/lib/hooks/useCalendarWidgetPrefs';
import { CalendarWidgetControls } from './CalendarWidgetControls';
import type { CalendarEvent } from '@/types/calendar';
export type { CalendarEvent };

const MonthView = lazy(() => import('@/components/calendar/MonthView').then(m => ({ default: m.MonthView })));
const WeekView = lazy(() => import('@/components/calendar/WeekView').then(m => ({ default: m.WeekView })));
const MultiWeekView = lazy(() => import('@/components/calendar/MultiWeekView').then(m => ({ default: m.MultiWeekView })));
const DayViewSideBySide = lazy(() => import('@/components/calendar/DayViewSideBySide').then(m => ({ default: m.DayViewSideBySide })));
const WeekVerticalView = lazy(() => import('@/components/calendar/WeekVerticalView').then(m => ({ default: m.WeekVerticalView })));
const AgendaView = lazy(() => import('@/components/calendar/AgendaView').then(m => ({ default: m.AgendaView })));

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
  const { weekStartsOn } = useWeekStartsOn();
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;

  const {
    currentDate, setCurrentDate,
    widgetBordered, setWidgetBordered,
    mergedView, setMergedView,
    showNotes, setShowNotes,
    viewType, setViewType,
    availableViews, effectiveView, resolvedView, resolvedWeekCount, viewUnavailable,
    goToToday, goToPrevious, goToNext,
  } = useCalendarWidgetPrefs(gridW, gridH);

  const { events: apiEvents, loading: apiLoading, error: apiError } = useCalendarEvents({ daysToShow: 60 });
  const { selectedCalendarIds, toggleCalendar, filterEvents, calendarGroups } = useCalendarFilter();

  const loading = externalLoading ?? apiLoading;
  const error = externalError ?? apiError;
  const rawEvents = externalEvents ?? apiEvents;
  const events = useMemo(() => deduplicateEvents(filterEvents(rawEvents)), [filterEvents, rawEvents]);

  const notesSupported = resolvedView === 'list' || resolvedView === 'day';
  const notesDays = useMemo(() => {
    if (!notesSupported) return [];
    if (resolvedView === 'day') return [currentDate];
    const ws = startOfWeek(currentDate, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [notesSupported, resolvedView, currentDate, weekStartsOn]);

  const notesFrom = notesDays.length > 0 ? format(notesDays[0]!, 'yyyy-MM-dd') : '';
  const notesTo = notesDays.length > 0 ? format(notesDays[notesDays.length - 1]!, 'yyyy-MM-dd') : '';
  const { notesByDate, upsertNote } = useCalendarNotes({
    from: notesFrom,
    to: notesTo,
    enabled: showNotes && notesSupported,
  });

  const handleEventClick = useCallback((event: CalendarEvent) => {
    onEventClick?.(event);
  }, [onEventClick]);

  const showMerge = (resolvedView === 'day' || resolvedView === 'list') && calendarGroups.length > 1;

  // Calendar filter chips
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
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all') ? 'rgba(255,255,255,0.55)' : group.color }} />
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
      actions={
        <CalendarWidgetControls
          viewType={viewType}
          setViewType={setViewType}
          availableViews={availableViews}
          resolvedView={resolvedView}
          widgetBordered={widgetBordered}
          setWidgetBordered={setWidgetBordered}
          mergedView={mergedView}
          setMergedView={setMergedView}
          showNotes={showNotes}
          setShowNotes={setShowNotes}
          notesSupported={notesSupported}
          transparentMode={transparentMode}
          showMerge={showMerge}
          goToPrevious={goToPrevious}
          goToToday={goToToday}
          goToNext={goToNext}
        />
      }
      className={className}
    >
      {calendarChips}
      {viewUnavailable && (
        <div className="text-[10px] text-muted-foreground text-center py-1 bg-muted/50 rounded mb-1">
          Resize widget for {VIEW_OPTIONS.find(v => v.value === viewType)?.label} view
        </div>
      )}

      {/* flex-1 min-h-0: fills remaining space after chips / notices */}
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
