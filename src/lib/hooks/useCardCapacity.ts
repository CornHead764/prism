'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCardCapacityOptions {
  /** Measured card height in px. While `undefined` the hook returns null. */
  cardHeight: number | undefined;
  /** Pixels reserved for the day-header inside the cell. Defaults 0. */
  headerHeight?: number;
  /** Pixels reserved for the "+N more" trigger when overflow is shown. */
  popoverHeight?: number;
  /** Vertical gap (px) between stacked cards. Defaults 0. */
  gap?: number;
  /** Floor on visible cards even in tiny cells. Defaults 1. */
  minVisible?: number;
}

interface UseCardCapacityResult {
  /** ref to attach to the cell whose available height should drive the capacity. */
  cellRef: (node: HTMLElement | null) => void;
  /** Number of cards that fit when overflow IS shown. `null` until first measurement. */
  fitWithOverflow: number | null;
  /** Number of cards that fit when overflow is NOT shown. `null` until first measurement. */
  fitWithoutOverflow: number | null;
}

/**
 * Watches the target cell's height and computes how many cards fit, accounting
 * for an optional day-header reservation and a "+N more" trigger reservation.
 *
 * Both `cardHeight` and `headerHeight` should be supplied by the caller (typically
 * via {@link useMeasuredHeight}) so the result reflects the current font scale,
 * theme, and viewport.
 *
 * Returns null on first render — caller should fall back to a sensible default
 * (or render with `visibility: hidden`) for one frame.
 */
export function useCardCapacity({
  cardHeight,
  headerHeight = 0,
  popoverHeight = 0,
  gap = 0,
  minVisible = 1,
}: UseCardCapacityOptions): UseCardCapacityResult {
  const [cellHeight, setCellHeight] = useState<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const cellRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;

    setCellHeight(node.getBoundingClientRect().height);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setCellHeight(entry.contentRect.height);
    });
    ro.observe(node);
    observerRef.current = ro;
  }, []);

  useEffect(() => () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  if (cellHeight === null || cardHeight === undefined || cardHeight <= 0) {
    return { cellRef, fitWithOverflow: null, fitWithoutOverflow: null };
  }

  // N stacked cards with gap take N*cardHeight + (N-1)*gap. Solve for N:
  //   N <= (usable + gap) / (cardHeight + gap)
  const slot = cardHeight + gap;
  const usable = Math.max(0, cellHeight - headerHeight);
  const fitWithoutOverflow = Math.max(minVisible, Math.floor((usable + gap) / slot));
  // When overflow is shown, the popover trigger consumes its own row (with its
  // own gap before it). Reserve popoverHeight + gap from the usable budget.
  const usableWithPopover = Math.max(0, usable - popoverHeight - (popoverHeight > 0 ? gap : 0));
  const fitWithOverflow = Math.max(minVisible, Math.floor((usableWithPopover + gap) / slot));

  return { cellRef, fitWithOverflow, fitWithoutOverflow };
}

/**
 * Watches an element's bounding-box height. Used by callers that need to know
 * the rendered height of a probe element (e.g. an off-screen card) so they can
 * feed it into {@link useCardCapacity}.
 */
export function useMeasuredHeight(): {
  ref: (node: HTMLElement | null) => void;
  height: number | undefined;
} {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;

    setHeight(node.getBoundingClientRect().height);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });
    ro.observe(node);
    observerRef.current = ro;
  }, []);

  useEffect(() => () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  return { ref, height };
}
