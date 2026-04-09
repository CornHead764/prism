'use client';

import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useHiddenHours } from '@/lib/hooks/useHiddenHours';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { calculateEventPositions, positionToCSS } from '@/lib/utils/eventLayout';
import { hexToRgba } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';

export interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  bordered?: boolean;
}

export function WeekView({
  currentDate,
  events,
  onEventClick,
  bordered = true,
}: WeekViewProps) {
  const { weekStartsOn } = useWeekStartsOn();
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;
  const weekStart = startOfWeek(currentDate, { weekStartsOn });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';

  // Hidden hours hook
  const { settings: hiddenSettings, toggleHidden, getVisibleHours } = useHiddenHours();

  // Get visible hours (filtered if hidden mode is enabled)
  const hours = getVisibleHours();

  // Get all-day events for a day (multi-day events span across days)
  const getAllDayEvents = (date: Date) => {
    const dayStart = startOfDay(date);
    return events.filter((e) =>
      e.allDay && e.startTime <= dayStart && e.endTime > dayStart
    );
  };

  // Get timed events for a specific day and hour
  const getHourEvents = (date: Date, hour: number) =>
    events.filter(
      (e) =>
        isSameDay(e.startTime, date) &&
        !e.allDay &&
        e.startTime.getHours() === hour
    );

  // For portrait, split into two rows
  const row1Days = days.slice(0, 4); // Sun-Wed
  const nextSunday = addDays(weekStart, 7);
  const row2Days = [...days.slice(4, 7), nextSunday]; // Thu-Sat + next Sun

  const renderDayColumn = (date: Date, compact: boolean = false) => {
    const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);
    const allDayEvents = getAllDayEvents(date);

    return (
      <div key={date.toISOString()} className="flex flex-col min-w-0 flex-1">
        {/* Day header */}
        <div
          className={cn(
            'text-center py-1 shrink-0 rounded-t-md',
            !transparentMode && isPast && 'bg-muted/50 text-muted-foreground',
            isToday(date) && 'bg-primary text-primary-foreground'
          )}
        >
          <div className={cn('font-bold uppercase tracking-wide', compact ? 'text-xs' : 'text-sm')}>
            {format(date, 'EEE')}
          </div>
          <div className={cn('font-bold', compact ? 'text-lg' : 'text-xl')}>
            {format(date, 'd')}
          </div>
        </div>

        {/* All-day events - scrollable */}
        {allDayEvents.length > 0 && (
          <div className={cn('shrink-0 p-0.5 max-h-16 overflow-y-auto', !transparentMode && 'bg-card/50')}>
            {allDayEvents.map((event, idx) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="w-full text-left text-xs px-1 py-px rounded truncate hover:opacity-80 transition-all"
                style={{ backgroundColor: event.color, color: '#fff', borderLeft: `2px solid ${event.color}` }}
              >
                {event.title}
              </button>
            ))}
          </div>
        )}

        {/* Hourly grid - scales to fit available space */}
        <div
          className={cn('flex-1 shrink-0 grid', !transparentMode && isPast && 'bg-muted/20')}
          style={{ gridTemplateRows: `repeat(${hours.length}, minmax(20px, 1fr))` }}
        >
          {hours.map((hour) => {
            const hourEvents = getHourEvents(date, hour);
            const positions = calculateEventPositions(hourEvents);
            return (
              <div key={hour} className={cn('relative min-h-0 overflow-visible', bordered && 'border-t border-border/50')} style={cellBgStyle}>
                {hourEvents.map((event) => {
                  const pos = positions.get(event.id);
                  if (!pos) return null;
                  const css = positionToCSS(pos);
                  const durationMin = ((event.endTime?.getTime() ?? (event.startTime.getTime() + 3600000)) - event.startTime.getTime()) / 60000;
                  const heightPct = Math.max((durationMin / 60) * 100, 20);
                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="absolute text-left text-xs px-0.5 pt-0.5 rounded overflow-hidden hover:opacity-90 hover:ring-1 hover:ring-seasonal-accent/50 transition-all z-10 flex flex-col items-start"
                      style={{
                        backgroundColor: event.color,
                        color: '#fff',
                        borderLeft: `2px solid ${event.color}`,
                        top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                        height: `${heightPct}%`,
                        left: css.left,
                        width: css.width,
                      }}
                    >
                      <span className="truncate w-full text-[10px] font-medium leading-tight">{event.title}</span>
                      <span className="text-[9px] opacity-70 leading-tight">
                        {format(event.startTime, 'h:mm')}&ndash;{format(event.endTime ?? new Date(event.startTime.getTime() + 3600000), 'h:mm a')}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Portrait: 2 rows of 4 days each (compact) - grid ensures equal split
  if (isPortrait) {
    return (
      <div className="h-full grid gap-1 overflow-auto" style={{ gridTemplateRows: `repeat(2, minmax(${48 + hours.length * 20}px, 1fr))` }}>
        <div className={cn('flex gap-px rounded-md', !transparentMode && 'bg-card/85 backdrop-blur-sm')}>
          {/* Time column */}
          <div className="w-8 shrink-0 flex flex-col">
            {/* Header with toggle button */}
            <div className="h-12 shrink-0 flex items-center justify-center">
              <button
                onClick={toggleHidden}
                className={cn(
                  'p-1 rounded-full transition-colors',
                  hiddenSettings.enabled
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                )}
                title={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
                aria-label={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
              >
                <Clock className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 shrink-0 grid" style={{ gridTemplateRows: `repeat(${hours.length}, minmax(20px, 1fr))` }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-[9px] text-muted-foreground text-right pl-0.5 pr-0.5 border-t border-transparent flex items-start"
                >
                  {format(new Date().setHours(hour, 0), 'ha')}
                </div>
              ))}
            </div>
          </div>
          {row1Days.map((date) => renderDayColumn(date, true))}
        </div>
        <div className={cn('flex gap-px rounded-md', !transparentMode && 'bg-card/85 backdrop-blur-sm')}>
          {/* Time column */}
          <div className="w-8 shrink-0 flex flex-col">
            <div className="h-12 shrink-0" /> {/* Header spacer */}
            <div className="flex-1 shrink-0 grid" style={{ gridTemplateRows: `repeat(${hours.length}, minmax(20px, 1fr))` }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-[9px] text-muted-foreground text-right pl-0.5 pr-0.5 border-t border-transparent flex items-start"
                >
                  {format(new Date().setHours(hour, 0), 'ha')}
                </div>
              ))}
            </div>
          </div>
          {row2Days.map((date) => renderDayColumn(date, true))}
        </div>
      </div>
    );
  }

  // Landscape: single scroll container with sticky header — keeps header/content columns in
  // the same layout context so they always align (no scrollbar-width mismatch).
  // The inner min-h-full flex-col wrapper makes the hourly grid stretch to fill available
  // space; 1fr rows distribute the remaining height so hours grow when fewer are visible.
  return (
    <div className={cn('h-full rounded-md overflow-hidden', !transparentMode && 'bg-card/85 backdrop-blur-sm')}>
      <div className="h-full overflow-y-auto">
        <div className="h-full min-h-full flex flex-col">
          {/* Sticky day headers */}
          <div className={cn('flex sticky top-0 z-20', !transparentMode && 'bg-card')}>
            {/* Time column spacer with toggle button */}
            <div className="w-14 shrink-0 flex items-center justify-center">
              <button
                onClick={toggleHidden}
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  hiddenSettings.enabled
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                )}
                title={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
                aria-label={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
              >
                <Clock className="h-4 w-4" />
              </button>
            </div>
            {days.map((date) => {
              const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);
              const allDayEvents = getAllDayEvents(date);
              return (
                <div key={date.toISOString()} className="flex-1 min-w-0 border-l border-border">
                  <div
                    className={cn(
                      'text-center py-2',
                      !transparentMode && isPast && 'bg-muted/50 text-muted-foreground',
                      isToday(date) && 'bg-primary text-primary-foreground'
                    )}
                  >
                    <div className="text-sm font-bold uppercase">{format(date, 'EEE')}</div>
                    <div className="text-2xl font-bold">{format(date, 'd')}</div>
                  </div>
                  {allDayEvents.length > 0 && (
                    <div className={cn('px-0.5 pb-0.5 flex flex-col gap-px', !transparentMode && 'bg-card/50')}>
                      {allDayEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className="w-full text-left text-[10px] font-medium px-1 py-px rounded truncate hover:opacity-80 transition-all leading-tight"
                          style={{ backgroundColor: event.color, color: '#fff', borderLeft: `2px solid ${event.color}` }}
                        >
                          {event.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hourly grid — flex-1 fills remaining space; 1fr rows stretch when hours are hidden */}
          <div className="flex-1 flex">
            {/* Time column */}
            <div className="w-14 shrink-0 h-full grid" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
              {hours.map((hour) => (
                <div key={hour} className={cn('pl-1 pr-1 text-right text-xs text-muted-foreground flex items-start pt-0.5 min-h-0', bordered && 'border-t border-border')}>
                  {format(new Date().setHours(hour, 0), 'h a')}
                </div>
              ))}
            </div>
            {/* Day columns */}
            {days.map((date) => {
              const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);
              return (
                <div
                  key={date.toISOString()}
                  className={cn('flex-1 min-w-0 h-full border-l border-border grid', !transparentMode && isPast && 'bg-muted/10')}
                  style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}
                >
                  {hours.map((hour) => {
                    const hourEvents = getHourEvents(date, hour);
                    const positions = calculateEventPositions(hourEvents);
                    return (
                      <div key={hour} className={cn('relative min-h-0 overflow-visible', bordered && 'border-t border-border')} style={cellBgStyle}>
                        {hourEvents.map((event) => {
                          const pos = positions.get(event.id);
                          if (!pos) return null;
                          const css = positionToCSS(pos);
                          const durationMin = ((event.endTime?.getTime() ?? (event.startTime.getTime() + 3600000)) - event.startTime.getTime()) / 60000;
                          const heightPct = Math.max((durationMin / 60) * 100, 20);
                          return (
                            <button
                              key={event.id}
                              onClick={() => onEventClick(event)}
                              className="absolute p-0.5 rounded text-left text-xs z-10 overflow-hidden hover:opacity-90 hover:ring-2 hover:ring-seasonal-accent/50 transition-all flex flex-col items-start"
                              style={{
                                backgroundColor: event.color,
                                color: '#fff',
                                borderLeft: `2px solid ${event.color}`,
                                top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                                height: `${heightPct}%`,
                                left: css.left,
                                width: css.width,
                              }}
                            >
                              <div className="font-medium truncate w-full text-[10px] leading-tight">{event.title}</div>
                              <div className="text-[9px] opacity-70 leading-tight">
                                {format(event.startTime, 'h:mm')}&ndash;{format(event.endTime ?? new Date(event.startTime.getTime() + 3600000), 'h:mm a')}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
