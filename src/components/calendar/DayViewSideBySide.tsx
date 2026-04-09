'use client';

import {
  format,
  isSameDay,
  isBefore,
  startOfDay,
} from 'date-fns';
import { Clock } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { useHiddenHours } from '@/lib/hooks/useHiddenHours';
import { calculateEventPositions, positionToCSS } from '@/lib/utils/eventLayout';
import { hexToRgba } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import type { CalendarNote } from '@/lib/hooks/useCalendarNotes';

export interface DayViewSideBySideProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendarGroups: Array<{ id: string; name: string; color: string }>;
  selectedCalendarIds?: Set<string>;
  mergedView?: boolean;
  bordered?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  showNotes?: boolean;
  notesByDate?: Map<string, CalendarNote>;
  onNoteChange?: (date: string, content: string) => void;
}

export function DayViewSideBySide({
  currentDate,
  events,
  calendarGroups,
  selectedCalendarIds,
  mergedView = false,
  bordered = true,
  onEventClick,
  showNotes = false,
  notesByDate,
  onNoteChange,
}: DayViewSideBySideProps) {
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;

  // Hidden hours hook
  const { settings: hiddenSettings, toggleHidden, getVisibleHours } = useHiddenHours();

  // Time tracking
  const now = new Date();
  const isCurrentDay = isSameDay(currentDate, now);
  const isPastDay = isBefore(startOfDay(currentDate), startOfDay(now)) && !isCurrentDay;
  const currentHour = now.getHours();
  // Snap to 15-min increments: 0%, 25%, 50%, 75%
  const currentMinuteSnapped = Math.floor(now.getMinutes() / 15) * 25;

  // Get visible hours (filtered if hidden mode is enabled)
  const hours = getVisibleHours();

  const dayStart = startOfDay(currentDate);
  const dayEvents = events.filter((event) =>
    event.allDay
      ? event.startTime <= dayStart && event.endTime > dayStart
      : isSameDay(event.startTime, currentDate)
  );

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  // If there are no calendar groups configured or merged view is on, show all events in a single column
  const showAllInOne = calendarGroups.length === 0 || mergedView;

  // Filter groups to only show selected ones (hide columns when filtered out)
  const filteredGroups = selectedCalendarIds && !selectedCalendarIds.has('all')
    ? calendarGroups.filter((g) => selectedCalendarIds.has(g.id))
    : calendarGroups;

  // For single-column mode or when no groups are selected, create a synthetic group
  const displayGroups = showAllInOne || filteredGroups.length === 0
    ? [{ id: 'all', name: 'All Events', color: '#3B82F6' }]
    : filteredGroups;

  const getEventsForGroup = (gid: string) => {
    if (showAllInOne || gid === 'all') {
      return timedEvents;
    }
    return timedEvents.filter((e) => e.groupId === gid);
  };

  const getAllDayEventsForGroup = (gid: string) => {
    if (showAllInOne || gid === 'all') {
      return allDayEvents;
    }
    return allDayEvents.filter((e) => e.groupId === gid);
  };

  // Single scroll container with sticky header — same layout context keeps columns aligned.
  // min-h-full flex-col inner wrapper makes the hourly grid stretch to fill available space.
  return (
    <div className={cn('h-full rounded-md overflow-hidden', !transparentMode && 'bg-card/85 backdrop-blur-sm')}>
      <div className="h-full overflow-y-auto">
        <div className="h-full min-h-full flex flex-col">
          {/* Sticky all-day / group-label header */}
          <div className={cn('flex sticky top-0 z-20', !transparentMode && 'bg-card/95')}>
            {/* Time column header with toggle button */}
            <div className="w-16 flex-shrink-0 flex items-center justify-center">
              <button
                onClick={toggleHidden}
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  hiddenSettings.enabled
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                )}
                title={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
              >
                <Clock className="h-4 w-4" />
              </button>
            </div>
            {displayGroups.map((group) => {
              const calAllDay = getAllDayEventsForGroup(group.id);
              return (
                <div key={group.id} className="flex-1 min-w-0 border-l border-border p-1">
                  <div
                    className="text-sm font-medium text-center py-1 mb-1 rounded text-white"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.name}
                  </div>
                  {calAllDay.length > 0 && (
                    <div className="space-y-0.5">
                      {calAllDay.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className="w-full text-left text-xs px-1 py-0.5 rounded truncate hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all"
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
            {showNotes && (
              <div className="w-2/5 min-w-[180px] border-l border-border p-1">
                <div
                  className="text-sm font-medium text-center py-1 mb-1 rounded text-white"
                  style={{ backgroundColor: '#6366f1' }}
                >
                  Notes
                </div>
              </div>
            )}
          </div>

          {/* Hourly grid — flex-1 fills remaining space; 1fr rows stretch when hours are hidden */}
          <div className="flex-1 flex">
            {/* Time column */}
            <div className="w-16 flex-shrink-0 h-full grid" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
              {hours.map((hour) => {
                const isPastHour = isPastDay || (isCurrentDay && hour < currentHour);
                const isNowHour = isCurrentDay && hour === currentHour;
                return (
                  <div key={hour} className={cn(
                    'pl-1 pr-2 text-right text-xs flex items-start pt-0.5 min-h-0 relative text-muted-foreground',
                    bordered && 'border-t border-border',
                    isPastHour && 'bg-muted/15',
                    isNowHour && 'bg-primary text-primary-foreground font-semibold rounded-sm'
                  )}>
                    {format(new Date().setHours(hour, 0), 'h a')}
                    {isNowHour && (
                      <div className="absolute left-0 right-0 border-t-2 border-t-primary z-20 pointer-events-none" style={{ top: `${currentMinuteSnapped}%` }} />
                    )}
                  </div>
                );
              })}
            </div>
            {/* Group columns */}
            {displayGroups.map((group) => {
              const calEvents = getEventsForGroup(group.id);
              return (
                <div
                  key={group.id}
                  className="flex-1 min-w-0 h-full border-l border-border grid"
                  style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}
                >
                  {hours.map((hour) => {
                    const hourEvents = calEvents.filter((event) => event.startTime.getHours() === hour);
                    const positions = calculateEventPositions(hourEvents);
                    const isPastHour = isPastDay || (isCurrentDay && hour < currentHour);
                    const isNowHour = isCurrentDay && hour === currentHour;
                    return (
                      <div key={hour} className={cn(
                        'relative min-h-0 overflow-visible',
                        bordered && 'border-t border-border',
                        isPastHour && !cellBgStyle && 'bg-muted/15'
                      )} style={cellBgStyle}>
                        {isNowHour && (
                          <div className="absolute left-0 right-0 border-t-2 border-t-primary z-20 pointer-events-none" style={{ top: `${currentMinuteSnapped}%` }} />
                        )}
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
                              <div className="font-medium truncate w-full text-[11px] leading-tight">{event.title}</div>
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
            {/* Notes column */}
            {showNotes && (
              <div className="w-2/5 min-w-[180px] h-full border-l border-border flex flex-col">
                <div className={cn('shrink-0', bordered && 'border-t border-border')} />
                <div className="flex-1 min-h-0">
                  <NoteEditor
                    dateKey={format(currentDate, 'yyyy-MM-dd')}
                    content={notesByDate?.get(format(currentDate, 'yyyy-MM-dd'))?.content || ''}
                    onNoteChange={onNoteChange}
                    className="px-3 py-2 h-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

