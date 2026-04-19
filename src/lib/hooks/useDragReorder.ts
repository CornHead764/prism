'use client';

import { useState, useRef, useCallback } from 'react';

interface UseDragReorderProps {
  order: string[];
  onReorder: (newOrder: string[]) => void;
}

export function useDragReorder({ order, onReorder }: UseDragReorderProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const newOrder = [...order];
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);
    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedId);
      onReorder(newOrder);
    }
  }, [draggedId, order, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  // Touch: require a 500 ms long-press before drag activates.
  // Any movement > 8px before the timer fires cancels the drag, allowing normal scroll.
  const handleTouchStart = useCallback((e: React.TouchEvent, id: string) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressRef.current = setTimeout(() => {
      longPressRef.current = null;
      setDraggedId(id);
      navigator.vibrate?.(10);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    // Cancel drag activation if user scrolled before the long-press fired
    if (longPressRef.current !== null) {
      const dx = Math.abs(touch.clientX - touchStartRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartRef.current.y);
      if (dx > 8 || dy > 8) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
      return;
    }

    if (!draggedId) return;
    e.preventDefault(); // block scroll while actively dragging

    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    for (const el of elements) {
      const targetId = el.getAttribute('data-drag-id');
      if (targetId && targetId !== draggedId) {
        const newOrder = [...order];
        const draggedIndex = newOrder.indexOf(draggedId);
        const targetIndex = newOrder.indexOf(targetId);
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          newOrder.splice(draggedIndex, 1);
          newOrder.splice(targetIndex, 0, draggedId);
          onReorder(newOrder);
        }
        break;
      }
    }
  }, [draggedId, order, onReorder]);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    setDraggedId(null);
    touchStartRef.current = { x: 0, y: 0 };
  }, []);

  /** Move item one position earlier in the list. */
  const moveUp = useCallback((id: string) => {
    const idx = order.indexOf(id);
    if (idx <= 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
    onReorder(next);
  }, [order, onReorder]);

  /** Move item one position later in the list. */
  const moveDown = useCallback((id: string) => {
    const idx = order.indexOf(id);
    if (idx < 0 || idx >= order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
    onReorder(next);
  }, [order, onReorder]);

  const getDragProps = useCallback((id: string) => ({
    draggable: true,
    'data-drag-id': id,
    onDragStart: () => handleDragStart(id),
    onDragOver: (e: React.DragEvent) => handleDragOver(e, id),
    onDragEnd: handleDragEnd,
    onTouchStart: (e: React.TouchEvent) => handleTouchStart(e, id),
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }), [handleDragStart, handleDragOver, handleDragEnd, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    draggedId, getDragProps,
    moveUp, moveDown,
    handleDragStart, handleDragOver, handleDragEnd,
    handleTouchStart, handleTouchMove, handleTouchEnd,
  };
}
