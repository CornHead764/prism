import { useRef, useState, useEffect, useCallback } from 'react';

const SSR_FALLBACK = 60;

/**
 * Measures container width via ResizeObserver and computes square cell size.
 * In fillHeight mode, row height is derived from viewport height instead.
 * Returns width and mounted for callers that need container measurement info.
 */
export function useSquareCells(
  cols: number,
  containerPadding: number,
  gap: number,
  fillHeight = false,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(SSR_FALLBACK);
  const [width, setWidth] = useState(0);
  const [mounted, setMounted] = useState(false);

  const compute = useCallback(() => {
    if (fillHeight) {
      setMounted(true);
      const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
      setCellSize(Math.max(30, Math.floor((vh - 2 * containerPadding - 11 * gap) / 12)));
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    setWidth(w);
    setMounted(true);
    if (w <= 0) return;
    const available = w - 2 * containerPadding - (cols - 1) * gap;
    setCellSize(Math.floor(available / cols));
  }, [cols, containerPadding, gap, fillHeight]);

  useEffect(() => {
    compute();
    const el = containerRef.current;
    if (!el && !fillHeight) return;

    if (fillHeight) {
      window.addEventListener('resize', compute);
      return () => window.removeEventListener('resize', compute);
    }

    const ro = new ResizeObserver(compute);
    ro.observe(el!);
    return () => ro.disconnect();
  }, [compute, fillHeight]);

  return { containerRef, cellSize, width, mounted };
}
