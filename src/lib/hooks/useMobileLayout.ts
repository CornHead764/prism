'use client';

import { useState, useCallback } from 'react';

export type MobileLayoutMode = 'rows' | 'tiles';

const STORAGE_KEY = 'prism-mobile-layout';
const DEFAULT: MobileLayoutMode = 'rows';

function load(): MobileLayoutMode {
  if (typeof window === 'undefined') return DEFAULT;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'tiles' ? 'tiles' : 'rows';
}

export function useMobileLayout() {
  const [layout, setLayoutState] = useState<MobileLayoutMode>(load);

  const setLayout = useCallback((mode: MobileLayoutMode) => {
    setLayoutState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  return { layout, setLayout };
}

export function getMobileLayout(): MobileLayoutMode {
  if (typeof window === 'undefined') return DEFAULT;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'tiles' ? 'tiles' : 'rows';
}
