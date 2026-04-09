'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Redirects to the dashboard (/) after 5 minutes of user inactivity.
 * Only applies when the user is not already on a dashboard page.
 */
export function useInactivityRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);

  // Keep pathnameRef in sync so the timer callback sees the latest pathname
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const isDashboard = (path: string) => path === '/' || path.startsWith('/d/');

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isDashboard(pathnameRef.current)) {
        router.push('/');
      }
    }, INACTIVITY_TIMEOUT);
  }, [router]);

  useEffect(() => {
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    const handler = () => resetTimer();

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);
}
