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
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

export interface MultiWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  weekCount?: 1 | 2 | 3 | 4;
  bordered?: boolean;
}

export function MultiWeekView({
  currentDate,
  events,
  onEventClick,
  weekCount = 2,
  bordered = false,
}: MultiWeekViewProps) {
  const weekStart = startOfWeek(currentDate);

  const totalDays = weekCount * 7;
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    days.push(addDays(weekStart, i));
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const compact = weekCount > 2;

  // Group days into week rows
  const weeks: Date[][] = [];
  for (let w = 0; w < weekCount; w++) {
    weeks.push(days.slice(w * 7, (w + 1) * 7));
  }

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-0.5 shrink-0">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-sm font-medium text-muted-foreground py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Week rows — auto-sized to content */}
      <div
        className="flex-1 grid gap-0.5 min-h-0"
        style={{ gridTemplateRows: `repeat(${weekCount}, auto)` }}
      >
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-7 gap-0.5">
            {week.map((date, dIdx) => (
              <DayCell
                key={dIdx}
                date={date}
                events={events}
                onEventClick={onEventClick}
                compact={compact}
                bordered={bordered}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  events,
  onEventClick,
  compact,
  bordered,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  compact: boolean;
  bordered: boolean;
}) {
  const dayEvents = events.filter((event) => isSameDay(event.startTime, date));
  const sorted = [...dayEvents].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return a.startTime.getTime() - b.startTime.getTime();
  });
  const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);

  return (
    <div
      className={cn(
        'flex flex-col',
        isPast && 'opacity-50',
        bordered && 'border border-border rounded-md bg-card/85',
        bordered && isPast && 'bg-muted/65',
        !bordered && isToday(date) && 'border-2 border-primary rounded-md',
      )}
    >
      {/* Date header */}
      <div
        className={cn(
          'shrink-0 px-1',
          compact ? 'py-0.5' : 'py-1',
          isToday(date) && 'bg-primary',
          isToday(date) && (bordered ? 'rounded-t-[5px]' : 'rounded-t-[3px]'),
        )}
      >
        <div className={cn(
          'font-medium flex items-center gap-1 text-sm',
          isToday(date) && 'text-primary-foreground'
        )}>
          <span className="font-bold">{format(date, 'd')}</span>
          <span className={cn('text-xs', isToday(date) ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{format(date, 'MMM')}</span>
        </div>
        {!isToday(date) && !bordered && <div className="border-b border-border mt-0.5" />}
      </div>

      {/* Events */}
      <div className={cn('space-y-0.5', compact ? 'px-0.5 pb-0.5' : 'px-1 pb-1')}>
        {sorted.map((event) => (
          <button
            key={event.id}
            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
            className={cn(
              'w-full text-left rounded truncate hover:opacity-80 hover:ring-1 hover:ring-seasonal-accent/50 transition-all',
              compact ? 'text-[10px] px-0.5 py-px' : 'text-xs px-1 py-0.5'
            )}
            style={event.allDay
              ? { backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }
              : { color: event.color }
            }
          >
            {event.allDay ? event.title : `${format(event.startTime, 'h:mm')} ${event.title}`}
          </button>
        ))}
      </div>
    </div>
  );
}
