'use client';

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  getMonth,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { hexToRgba } from '@/lib/utils/color';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import type { CalendarEvent } from '@/types/calendar';
import { seasonalPalettes } from '@/lib/themes/seasonalThemes';

// Get the accent color for a month (1-12)
function getMonthColor(month: Date): string {
  const monthNum = getMonth(month) + 1;
  const palette = seasonalPalettes[monthNum];
  return palette ? `hsl(${palette.light.accent})` : '#3B82F6';
}

export interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  bordered?: boolean;
}

export function MonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
  bordered = true,
}: MonthViewProps) {
  const { weekStartsOn } = useWeekStartsOn();
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });
  const monthColor = getMonthColor(currentDate);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const numWeeks = Math.ceil(days.length / 7);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Month header with themed color */}
      <div
        className="shrink-0 text-center py-2 font-bold text-base text-white rounded-t-lg mb-2 shadow-sm"
        style={{ backgroundColor: monthColor }}
      >
        {format(currentDate, 'MMMM yyyy')}
      </div>
      <div className="shrink-0 grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Auto-scaling calendar grid */}
      <div
        className="flex-1 shrink-0 grid grid-cols-7 gap-1"
        style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(60px, 1fr))` }}
      >
        {days.map((date, index) => {
          const dayStart = startOfDay(date);
          const dayEvents = events
            .filter((event) =>
              event.allDay
                ? event.startTime <= dayStart && event.endTime > dayStart
                : isSameDay(event.startTime, date)
            )
            .sort((a, b) => {
              if (a.allDay && !b.allDay) return -1;
              if (!a.allDay && b.allDay) return 1;
              return a.startTime.getTime() - b.startTime.getTime();
            });

          const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);

          return (
            <div
              key={index}
              onClick={() => onDateClick(date)}
              className={cn(
                bordered && 'border border-border rounded-md',
                'cursor-pointer overflow-hidden',
                !transparentMode && !cellBgStyle && 'bg-card/85 backdrop-blur-sm',
                'flex flex-col min-h-0',
                !isSameMonth(date, currentDate) && 'opacity-50 text-muted-foreground',
                !transparentMode && !cellBgStyle && isPast && isSameMonth(date, currentDate) && 'bg-muted/65 text-muted-foreground',
              )}
              style={cellBgStyle}
            >
              {/* Today gets a blue bar; other days just show the date */}
              {isToday(date) ? (
                <div className="bg-primary px-1 py-0.5 mb-0.5 rounded-t-[3px]">
                  <span className="text-sm font-bold text-primary-foreground">{format(date, 'd')}</span>
                </div>
              ) : (
                <div className="text-sm font-medium px-1 pt-1 mb-0.5">
                  {format(date, 'd')}
                </div>
              )}

              <ul className="flex-1 overflow-y-auto space-y-0.5 list-none m-0 px-1 pb-1 pt-0">
                {dayEvents.map((event) => (
                  <li
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={cn(
                      'text-xs px-1 rounded truncate cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all',
                      event.allDay ? 'py-px' : 'py-0.5'
                    )}
                    style={event.allDay
                      ? { backgroundColor: event.color, color: '#fff', borderLeft: `2px solid ${event.color}` }
                      : { color: event.color }
                    }
                  >
                    {event.allDay ? event.title : `• ${format(event.startTime, 'h:mm a')} ${event.title}`}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
