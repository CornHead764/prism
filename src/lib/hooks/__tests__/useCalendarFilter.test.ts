/**
 * Tests for useCalendarFilter hook.
 *
 * We test the toggle logic and filter logic by capturing React state
 * and callbacks. The hook's core complexity is in:
 * 1. toggleCalendar: "all" behavior, auto-selecting "all" when all groups selected
 * 2. filterEvents: matching events to selected calendar groups/users
 */

// --- Mock fetch for API groups ---
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ groups: [] }),
});

// --- Mock calendar sources ---
const mockCalendarSources = [
  { id: 'src-1', enabled: true, user: { id: 'user-1', name: 'Alice', color: '#FF0000' }, groupId: 'group-1' },
  { id: 'src-2', enabled: true, user: { id: 'user-2', name: 'Bob', color: '#0000FF' }, groupId: 'group-2' },
  { id: 'src-family', enabled: true, user: null, isFamily: true, groupId: 'FAMILY' },
];

jest.mock('../useCalendarEvents', () => ({
  useCalendarSources: () => ({ calendars: mockCalendarSources }),
}));

// --- Mock React with state tracking ---
type EffectFn = () => (() => void) | void;
const capturedEffects: EffectFn[] = [];
let stateStore: Record<number, unknown> = {};
let stateIdx = 0;
const stateSetters: Record<number, (val: unknown) => void> = {};

jest.mock('react', () => ({
  useState: (init: unknown) => {
    const idx = stateIdx++;
    if (!(idx in stateStore)) {
      stateStore[idx] = typeof init === 'function' ? (init as () => unknown)() : init;
    }
    const setter = (val: unknown) => {
      stateStore[idx] = typeof val === 'function' ? (val as (prev: unknown) => unknown)(stateStore[idx]) : val;
    };
    stateSetters[idx] = setter;
    return [stateStore[idx], setter];
  },
  useEffect: (effect: EffectFn) => {
    capturedEffects.push(effect);
  },
  useCallback: (fn: (...args: unknown[]) => unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
}));

import { useCalendarFilter } from '../useCalendarFilter';

describe('useCalendarFilter', () => {
  beforeEach(() => {
    capturedEffects.length = 0;
    stateStore = {};
    stateIdx = 0;
  });

  describe('initial state', () => {
    it('starts with "all" selected', () => {
      const result = useCalendarFilter();
      expect(result.selectedCalendarIds.has('all')).toBe(true);
    });

    it('returns calendarGroups derived from sources', () => {
      const result = useCalendarFilter();
      // Should have groups from legacy fallback since apiGroups is empty
      expect(result.calendarGroups.length).toBeGreaterThan(0);
    });

    it('returns toggleCalendar and filterEvents functions', () => {
      const result = useCalendarFilter();
      expect(typeof result.toggleCalendar).toBe('function');
      expect(typeof result.filterEvents).toBe('function');
    });
  });

  describe('toggleCalendar', () => {
    it('toggling "all" when selected clears all selections', () => {
      const result = useCalendarFilter();
      // Initially 'all' is selected

      result.toggleCalendar('all');

      // State setter should have been called to produce empty set
      // After toggle('all') when 'all' is selected, it returns new Set()
      // We check the setter was called by verifying stateStore updated
      const selectedState = stateStore[0] as Set<string>;
      expect(selectedState.size).toBe(0);
    });

    it('toggling "all" when not selected selects all groups', () => {
      // Start with empty selection
      stateStore[0] = new Set<string>();

      const result = useCalendarFilter();
      result.toggleCalendar('all');

      const selectedState = stateStore[0] as Set<string>;
      expect(selectedState.has('all')).toBe(true);
    });

    it('toggling individual calendar adds it', () => {
      // Start with empty (no 'all')
      stateStore[0] = new Set<string>();

      const result = useCalendarFilter();
      result.toggleCalendar('user-1');

      const selectedState = stateStore[0] as Set<string>;
      expect(selectedState.has('user-1')).toBe(true);
      expect(selectedState.has('all')).toBe(false);
    });

    it('toggling individual calendar removes it if already selected', () => {
      stateStore[0] = new Set<string>(['user-1', 'user-2']);

      const result = useCalendarFilter();
      result.toggleCalendar('user-1');

      const selectedState = stateStore[0] as Set<string>;
      expect(selectedState.has('user-1')).toBe(false);
      expect(selectedState.has('user-2')).toBe(true);
    });

    it('removes "all" when toggling an individual calendar', () => {
      stateStore[0] = new Set<string>(['all', 'user-1', 'user-2']);

      const result = useCalendarFilter();
      result.toggleCalendar('user-1');

      const selectedState = stateStore[0] as Set<string>;
      expect(selectedState.has('all')).toBe(false);
    });
  });

  describe('filterEvents', () => {
    const mockEvents = [
      { calendarId: 'src-1', title: 'Alice Event' },
      { calendarId: 'src-2', title: 'Bob Event' },
      { calendarId: 'src-family', title: 'Family Event' },
      { calendarId: 'src-unknown', title: 'Unknown Source Event' },
    ];

    it('shows all events when "all" is selected', () => {
      const result = useCalendarFilter();
      // Default state has 'all' selected

      const filtered = result.filterEvents(mockEvents as never[]);
      expect(filtered).toHaveLength(4);
    });

    it('shows no events when nothing is selected', () => {
      stateStore[0] = new Set<string>();

      const result = useCalendarFilter();
      const filtered = result.filterEvents(mockEvents as never[]);
      expect(filtered).toHaveLength(0);
    });

    it('filters events by groupId', () => {
      stateStore[0] = new Set<string>(['group-1']);

      const result = useCalendarFilter();
      const filtered = result.filterEvents(mockEvents as never[]);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Alice Event');
    });

    it('filters events by user id (legacy)', () => {
      stateStore[0] = new Set<string>(['user-2']);

      const result = useCalendarFilter();
      const filtered = result.filterEvents(mockEvents as never[]);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Bob Event');
    });

    it('excludes events with unknown calendar source', () => {
      stateStore[0] = new Set<string>(['group-1', 'group-2', 'FAMILY']);

      const result = useCalendarFilter();
      const filtered = result.filterEvents(mockEvents as never[]);

      // Unknown source event should be excluded
      const titles = filtered.map((e: { title: string }) => e.title);
      expect(titles).not.toContain('Unknown Source Event');
    });
  });
});
