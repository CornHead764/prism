import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCalendarEvents, useWeather, useMessages, useTasks, useChores, useShoppingLists, useMeals, useBirthdays, useLayouts, useGoals, usePoints } from '@/lib/hooks';

const AUTO_SYNC_STALE_MINUTES = 5;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Delay (ms) before enabling non-visible widget data loading */
const DEFERRED_LOAD_DELAY_MS = 2000;

/** Maps widget IDs to the data domains they require */
const WIDGET_DOMAIN_MAP: Record<string, string[]> = {
  calendar: ['calendar'],
  weather: ['weather'],
  messages: ['messages'],
  tasks: ['tasks'],
  chores: ['chores'],
  shopping: ['shopping'],
  meals: ['meals'],
  birthdays: ['birthdays'],
  points: ['goals', 'points'],
};

export function useDashboardData(visibleWidgets?: Set<string>) {
  // After a short delay, enable ALL domains (background loading for non-visible widgets)
  const [deferredEnabled, setDeferredEnabled] = useState(false);

  useEffect(() => {
    if (!visibleWidgets) return; // No visibility info → all enabled already
    const timer = setTimeout(() => setDeferredEnabled(true), DEFERRED_LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []); // Only on mount

  // Compute which domains should be enabled right now
  const enabledDomains = useMemo(() => {
    // No visibility info or deferred timer elapsed → enable everything
    if (!visibleWidgets || deferredEnabled) return null;
    const enabled = new Set<string>();
    for (const [widget, domains] of Object.entries(WIDGET_DOMAIN_MAP)) {
      if (visibleWidgets.has(widget)) {
        for (const d of domains) enabled.add(d);
      }
    }
    return enabled;
  }, [visibleWidgets, deferredEnabled]);

  const isEnabled = (domain: string) => enabledDomains === null || enabledDomains.has(domain);

  const {
    events: calendarEvents,
    loading: calendarLoading,
    error: calendarError,
  } = useCalendarEvents({ daysToShow: 30, enabled: isEnabled('calendar') });

  const {
    data: weatherData,
    loading: weatherLoading,
    error: weatherError,
  } = useWeather({ enabled: isEnabled('weather') });

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
    deleteMessage,
  } = useMessages({ limit: 10, enabled: isEnabled('messages') });

  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    toggleTask,
  } = useTasks({ showCompleted: true, limit: 20, enabled: isEnabled('tasks') });

  const {
    chores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
    completeChore,
    approveChore,
  } = useChores({ showDisabled: false, enabled: isEnabled('chores') });

  const {
    lists: shoppingLists,
    loading: shoppingLoading,
    error: shoppingError,
    refresh: refreshShopping,
    toggleItem: toggleShoppingItem,
  } = useShoppingLists({ enabled: isEnabled('shopping') });

  const {
    meals,
    loading: mealsLoading,
    error: mealsError,
    refresh: refreshMeals,
    markCooked,
  } = useMeals({ enabled: isEnabled('meals') });

  const {
    birthdays: birthdaysList,
    loading: birthdaysLoading,
    error: birthdaysError,
    syncFromGoogle: syncBirthdays,
  } = useBirthdays({ limit: 8, enabled: isEnabled('birthdays') });

  const {
    goals: goalsList,
    progress: goalsProgress,
    goalChildren,
    loading: goalsLoading,
    error: goalsError,
  } = useGoals({ enabled: isEnabled('goals') });

  const {
    points: pointsList,
    loading: pointsLoading,
    error: pointsError,
  } = usePoints({ enabled: isEnabled('points') });

  // Layouts always load — needed for dashboard structure
  const {
    layouts: allLayouts,
    activeLayout: savedLayout,
    saveLayout,
    deleteLayout,
    loading: layoutsLoading,
  } = useLayouts();

  // Auto-sync task sources when dashboard is visible
  const lastAutoSyncRef = useRef<number>(0);

  const autoSyncTasks = useCallback(async () => {
    // Skip sync in guest/display mode — no session cookie means no write access
    if (typeof document !== 'undefined' && !document.cookie.includes('prism_session')) return;

    const now = Date.now();
    if (now - lastAutoSyncRef.current < AUTO_SYNC_INTERVAL_MS) return;

    try {
      const res = await fetch(`/api/task-sources/sync-all?staleMinutes=${AUTO_SYNC_STALE_MINUTES}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.synced > 0) {
          refreshTasks();
        }
        lastAutoSyncRef.current = now;
      }
    } catch {
      // Silently fail auto-sync
    }
  }, [refreshTasks]);

  // Auto-sync on mount and periodically
  useEffect(() => {
    autoSyncTasks();

    const interval = setInterval(() => {
      if (!document.hidden) {
        autoSyncTasks();
      }
    }, AUTO_SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        autoSyncTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoSyncTasks]);

  return {
    calendar: { events: calendarEvents, loading: calendarLoading, error: calendarError },
    weather: { data: weatherData, loading: weatherLoading, error: weatherError },
    messages: { messages, loading: messagesLoading, error: messagesError, refresh: refreshMessages, deleteMessage },
    tasks: { tasks, loading: tasksLoading, error: tasksError, refresh: refreshTasks, toggleTask },
    chores: { chores, loading: choresLoading, error: choresError, refresh: refreshChores, completeChore, approveChore },
    shopping: { lists: shoppingLists, loading: shoppingLoading, error: shoppingError, refresh: refreshShopping, toggleItem: toggleShoppingItem },
    meals: { meals, loading: mealsLoading, error: mealsError, refresh: refreshMeals, markCooked },
    birthdays: { birthdays: birthdaysList, loading: birthdaysLoading, error: birthdaysError, syncFromGoogle: syncBirthdays },
    points: { points: pointsList, goals: goalsList, progress: goalsProgress, goalChildren, loading: pointsLoading || goalsLoading, error: pointsError || goalsError },
    layouts: { allLayouts, savedLayout, saveLayout, deleteLayout, loading: layoutsLoading },
  };
}
