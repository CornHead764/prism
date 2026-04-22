'use client';

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 72;
const MAX_PULL = 100;

export function usePullToRefresh() {
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Only begin pull gesture when page is scrolled to the very top
      if (window.scrollY > 0) return;
      startYRef.current = e.touches[0]!.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const delta = e.touches[0]!.clientY - startYRef.current;
      if (delta <= 0) { startYRef.current = null; setPullDistance(0); return; }
      setPullDistance(Math.min(delta, MAX_PULL));
    };

    const onTouchEnd = () => {
      if (startYRef.current === null) return;
      const captured = startYRef.current !== null;
      startYRef.current = null;
      if (!captured) return;
      setPullDistance((d) => {
        if (d >= THRESHOLD) {
          setRefreshing(true);
          setTimeout(() => window.location.reload(), 300);
        }
        return 0;
      });
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return { pullDistance, refreshing };
}
