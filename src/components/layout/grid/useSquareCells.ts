import { useRef, useState, useEffect, useCallback } from 'react';

const SSR_FALLBACK = 60;

/**
 * Measures container width via ResizeObserver and computes square cell size.
 * Uses a callback ref so it works even when the target element is conditionally
 * rendered (e.g. switching between display and edit mode).
 * In fillHeight mode, row height is derived from viewport height instead.
 */
export function useSquareCells(
  cols: number,
  containerPadding: number,
  gap: number,
  fillHeight = false,
) {
  const [cellSize, setCellSize] = useState(SSR_FALLBACK);
  const [width, setWidth] = useState(0);
  const [mounted, setMounted] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const compute = useCallback(() => {
    if (fillHeight) {
      setMounted(true);
      const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
      setCellSize(Math.max(30, Math.floor((vh - 2 * containerPadding - 11 * gap) / 12)));
      return;
    }
    const el = nodeRef.current;
    if (!el) return;
    const w = el.clientWidth;
    setWidth(w);
    setMounted(true);
    if (w <= 0) return;
    const available = w - 2 * containerPadding - (cols - 1) * gap;
    setCellSize(Math.floor(available / cols));
  }, [cols, containerPadding, gap, fillHeight]);

  // Callback ref — re-measures and re-attaches ResizeObserver when element changes
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (node && !fillHeight) {
      compute();
      const ro = new ResizeObserver(compute);
      ro.observe(node);
      roRef.current = ro;
    }
  }, [compute, fillHeight]);

  // fillHeight mode: listen to window resize instead
  useEffect(() => {
    if (!fillHeight) return;
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [compute, fillHeight]);

  // Cleanup ResizeObserver on unmount
  useEffect(() => {
    return () => roRef.current?.disconnect();
  }, []);

  return { containerRef, cellSize, width, mounted };
}
