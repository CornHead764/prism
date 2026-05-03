'use client';

import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';

interface UseDayDroppableOptions {
  date: Date;
  enabled: boolean;
  /**
   * Optional region suffix (e.g. 'body', 'header'). When the same date needs
   * multiple drop targets in one view (e.g. WeekView landscape sticky header
   * + scrollable time-grid body), each region must have a distinct droppable
   * id. The drop handler strips the suffix when looking up the target date.
   */
  region?: string;
}

interface UseDayDroppableResult {
  setNodeRef: (node: HTMLElement | null) => void;
  isOver: boolean;
  droppableId: string;
}

/**
 * Wraps useDroppable with a stable yyyy-MM-dd id (optionally suffixed with
 * `:<region>`) so calendar views can register day cells as drop targets.
 *
 * When `enabled` is false, useDroppable still runs (rules-of-hooks) but is
 * disabled, so dragging a chore/task/meal onto the cell is a no-op.
 */
export function useDayDroppable({ date, enabled, region }: UseDayDroppableOptions): UseDayDroppableResult {
  const base = format(date, 'yyyy-MM-dd');
  const droppableId = region ? `${base}:${region}` : base;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !enabled,
  });
  return { setNodeRef, isOver, droppableId };
}
