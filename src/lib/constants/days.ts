/**
 * Shared day-of-week constants.
 * Single source of truth — use these everywhere instead of inline arrays.
 */

export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/** Monday-first ordering (used by calendar and meal planner when weekStartsOn = 'monday') */
export const DAYS_OF_WEEK_MON_FIRST = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** Display labels keyed by day value */
export const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

/** Short display labels keyed by day value */
export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

/** Short display labels as a Sunday-first array (index = Date.getDay()) */
export const DAYS_SHORT_ARRAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Long display labels as a Sunday-first array (index = Date.getDay()) */
export const DAYS_LONG_ARRAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Single-letter display labels as a Sunday-first array (index = Date.getDay()) */
export const DAYS_SINGLE_ARRAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
