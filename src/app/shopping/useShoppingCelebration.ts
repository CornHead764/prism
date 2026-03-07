'use client';

import { useState, useRef, useEffect } from 'react';

export function useShoppingCelebration(activeListId: string, checkedItems: number, totalItems: number) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCheckedCount, setLastCheckedCount] = useState<number | null>(null);
  const isInitialLoadRef = useRef(true);
  const prevListIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeListId !== prevListIdRef.current) {
      isInitialLoadRef.current = true;
      setLastCheckedCount(null);
      prevListIdRef.current = activeListId;
    }
  }, [activeListId]);

  useEffect(() => {
    if (totalItems === 0 || checkedItems !== totalItems) {
      if (totalItems > 0 && checkedItems < totalItems) {
        isInitialLoadRef.current = false;
      }
      setLastCheckedCount(checkedItems);
      return;
    }

    if (!isInitialLoadRef.current && lastCheckedCount !== null && lastCheckedCount < checkedItems) {
      setShowCelebration(true);
    }

    isInitialLoadRef.current = false;
    setLastCheckedCount(checkedItems);
  }, [checkedItems, totalItems, lastCheckedCount]);

  return {
    showCelebration,
    setShowCelebration,
  };
}
