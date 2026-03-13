'use client';

import {
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  isBefore,
  startOfDay,
  isSameDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { hexToRgba } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import type { CalendarNote } from '@/lib/hooks/useCalendarNotes';

export interface WeekVerticalViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendarGroups?: Array<{ id: string; name: string; color: string }>;
  selectedCalendarIds?: Set<string>;
  mergedView?: boolean;
  bordered?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  showNotes?: boolean;
  notesByDate?: Map<string, CalendarNote>;
  onNoteChange?: (date: string, content: string) => void;
}

export function WeekVerticalView({
  currentDate,
  events,
  calendarGroups = [],
  selectedCalendarIds,
  mergedView = false,
  bordered = true,
  onEventClick,
  showNotes = false,
  notesByDate,
  onNoteChange,
}: WeekVerticalViewProps) {
  const bgOverride = useWidgetBgOverride();
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const today = startOfDay(now);
  const currentHour = now.getHours();

  // Determine display groups (same logic as DayViewSideBySide)
  const showAllInOne = calendarGroups.length === 0 || mergedView;
  const filteredGroups = selectedCalendarIds && !selectedCalendarIds.has('all')
    ? calendarGroups.filter((g) => selectedCalendarIds.has(g.id))
    : calendarGroups;
  const displayGroups = showAllInOne || filteredGroups.length === 0
    ? [{ id: 'all', name: 'All Events', color: '#3B82F6' }]
    : filteredGroups;

  const getEventsForGroup = (dayEvents: CalendarEvent[], groupId: string) => {
    if (showAllInOne || groupId === 'all') return dayEvents;
    const group = calendarGroups.find((g) => g.id === groupId);
    if (!group) return [];
    return dayEvents.filter((e) => {
      if (e.color === group.color) return true;
      if (e.calendarName?.toLowerCase().includes(group.name.toLowerCase())) return true;
      return false;
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Group column headers (no background bar to match day view) */}
      {(calendarGroups.length > 0 || showNotes) && (
        <div className="sticky top-0 z-10 flex">
          <div className="w-20 md:w-28 shrink-0" />
          {displayGroups.map((group) => (
            <div key={group.id} className="flex-1 min-w-0 px-1 py-1.5">
              <div
                className="text-xs font-medium text-center py-0.5 rounded"
                style={{ backgroundColor: group.color, color: '#fff' }}
              >
                {group.name}
              </div>
            </div>
          ))}
          {showNotes && (
            <div className="w-2/5 min-w-[180px] border-l border-border px-1 py-1.5">
              <div
                className="text-xs font-medium text-center py-0.5 rounded text-white"
                style={{ backgroundColor: '#6366f1' }}
              >
                Notes
              </div>
            </div>
          )}
        </div>
      )}

      {days.map((day) => {
        const dayStart = startOfDay(day);
        const isCurrentDay = isToday(day);
        const isPast = isBefore(dayStart, today);

        // All events for this day
        const dayEvents = events.filter((event) => {
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);
          return eventStart < addDays(dayStart, 1) && eventEnd > dayStart;
        });

        const allDayEvents = dayEvents.filter((e) => e.allDay);
        const timedEvents = dayEvents.filter((e) => !e.allDay).sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        return (
          <div
            key={day.toISOString()}
            className={cn(
              'flex',
              bordered && 'border-b border-border',
              isPast && !isCurrentDay && !cellBgStyle && 'bg-muted/15'
            )}
            style={cellBgStyle}
          >
            {/* Day label */}
            <div
              className={cn(
                'w-20 md:w-28 shrink-0 p-2 md:p-3 flex flex-col items-center justify-start',
                bordered && 'border-r border-border',
                isPast && !isCurrentDay && 'bg-muted/15',
                isCurrentDay && 'bg-primary text-primary-foreground',
              )}
            >
              <span className={cn(
                'text-xs font-medium uppercase tracking-wide',
                isCurrentDay ? 'text-primary-foreground' : 'text-muted-foreground'
              )}>
                {format(day, 'EEE')}
              </span>
              <span className={cn(
                'text-2xl font-bold leading-tight',
                isCurrentDay ? 'text-primary-foreground' : 'text-foreground'
              )}>
                {format(day, 'd')}
              </span>
              <span className={cn(
                'text-[10px]',
                isCurrentDay ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
                {format(day, 'MMM')}
              </span>
            </div>

            {/* Events area — one column per group */}
            {displayGroups.length > 1 ? (
              <div className="flex-1 flex min-w-0">
                {displayGroups.map((group) => {
                  const groupAllDay = getEventsForGroup(allDayEvents, group.id);
                  const groupTimed = getEventsForGroup(timedEvents, group.id);
                  return (
                    <div key={group.id} className="flex-1 min-w-0 border-l border-border p-1 space-y-0.5">
                      <DayEventList
                        allDayEvents={groupAllDay}
                        timedEvents={groupTimed}
                        onEventClick={onEventClick}
                        isPastDay={isPast && !isCurrentDay}
                        isCurrentDay={isCurrentDay}
                        currentHour={currentHour}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 p-1.5 min-w-0">
                <DayEventList
                  allDayEvents={allDayEvents}
                  timedEvents={timedEvents}
                  onEventClick={onEventClick}
                  isPastDay={isPast && !isCurrentDay}
                  isCurrentDay={isCurrentDay}
                  currentHour={currentHour}
                />
              </div>
            )}

            {/* Notes cell */}
            {showNotes && (
              <div className="w-2/5 min-w-[180px] border-l border-border">
                <NoteCell
                  dateKey={format(day, 'yyyy-MM-dd')}
                  content={notesByDate?.get(format(day, 'yyyy-MM-dd'))?.content || ''}
                  onNoteChange={onNoteChange}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Renders all-day events then timed events in chronological order */
function DayEventList({
  allDayEvents,
  timedEvents,
  onEventClick,
  isPastDay = false,
  isCurrentDay = false,
  currentHour = 0,
}: {
  allDayEvents: CalendarEvent[];
  timedEvents: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  isPastDay?: boolean;
  isCurrentDay?: boolean;
  currentHour?: number;
}) {
  if (allDayEvents.length === 0 && timedEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {allDayEvents.map((event) => (
        <button
          key={event.id}
          onClick={() => onEventClick(event)}
          className="w-full text-left text-xs px-1.5 py-1 rounded hover:opacity-80 transition-opacity truncate block"
          style={{ backgroundColor: event.color, borderLeft: `3px solid ${event.color}` }}
        >
          <span className="font-medium text-white">{event.title}</span>
        </button>
      ))}
      {timedEvents.map((event) => {
        const isPastEvent = isPastDay || (isCurrentDay && new Date(event.startTime).getHours() < currentHour);
        return (
          <button
            key={event.id}
            onClick={() => onEventClick(event)}
            className={cn('w-full text-left text-xs px-1.5 py-1 rounded hover:opacity-90 transition-opacity truncate block text-white', isPastEvent && 'opacity-70')}
            style={{ backgroundColor: event.color, borderLeft: `3px solid ${event.color}` }}
          >
            <span className="opacity-80 mr-1">{format(new Date(event.startTime), 'h:mm a')}</span>
            <span className="font-medium">{event.title}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Inline note editor for a single day row */
function NoteCell({
  dateKey,
  content,
  onNoteChange,
}: {
  dateKey: string;
  content: string;
  onNoteChange?: (date: string, content: string) => void;
}) {
  const editable = !!onNoteChange;
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(content);

  // Set initial content on mount
  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = content;
      lastSavedRef.current = content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external changes (only when not focused)
  useEffect(() => {
    if (editorRef.current && content !== lastSavedRef.current) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = content;
        lastSavedRef.current = content;
      }
    }
  }, [content]);

  const save = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const isEmpty = !html || html === '<br>' || html.replace(/<br\s*\/?>/g, '').trim() === '';
    const value = isEmpty ? '' : html;
    if (value !== lastSavedRef.current) {
      lastSavedRef.current = value;
      onNoteChange?.(dateKey, value);
    }
  }, [dateKey, onNoteChange]);

  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 2000);
  }, [save]);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    save();
  }, [save]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      document.execCommand('strikeThrough');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      document.execCommand('insertUnorderedList');
    }
  }, []);

  // Auto-convert "- " at line start to bullet list
  const handleBeforeInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const inputEvent = e.nativeEvent as InputEvent;
    if (inputEvent.inputType !== 'insertText' || inputEvent.data !== ' ') return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE && range.startOffset === 1 && node.textContent === '-') {
      e.preventDefault();
      // Clear the "- " and convert to list
      node.textContent = '';
      document.execCommand('insertUnorderedList');
    }
  }, []);

  return (
    <div
      ref={editorRef}
      contentEditable={editable}
      suppressContentEditableWarning
      onInput={editable ? handleInput : undefined}
      onBlur={editable ? handleBlur : undefined}
      onKeyDown={editable ? handleKeyDown : undefined}
      onBeforeInput={editable ? handleBeforeInput : undefined}
      className={cn(
        'px-3 py-2 min-h-[48px] text-sm outline-none h-full',
        editable && 'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none',
      )}
      data-placeholder={editable ? 'Add notes...' : undefined}
    />
  );
}
