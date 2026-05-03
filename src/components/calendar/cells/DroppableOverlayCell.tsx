'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { OverlayItemsCell, type OverlayItemRef } from './OverlayItemsCell';
import type { WeekItemSize, WeekItemLayout } from './WeekItemCard';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';

interface DroppableOverlayCellProps {
  date: Date;
  bucket: Pick<DayBucket, 'meals' | 'chores' | 'tasks'> | undefined;
  size?: WeekItemSize;
  layout?: WeekItemLayout;
  /** When true, overlay items are draggable. Drop targets live on each view's outer day-cell wrapper. */
  enableDnd?: boolean;
  /** Which item kinds to include. Default: all. */
  include?: { meals?: boolean; chores?: boolean; tasks?: boolean };
  /** Override stripe color for every meal in this cell. */
  mealColor?: string;
  /** Click handler — opens edit modal for the item. */
  onItemClick?: (ref: OverlayItemRef) => void;
  className?: string;
}

/**
 * Renders a day's overlay items (meals/chores/tasks). The drop target itself
 * is registered by each view's outer day-cell wrapper (via useDayDroppable),
 * so the whole cell perimeter is hit-testable instead of just the overlay row.
 */
export function DroppableOverlayCell({
  bucket,
  size = 'sm',
  layout = 'column',
  enableDnd = false,
  include,
  mealColor,
  onItemClick,
  className,
}: DroppableOverlayCellProps) {
  if (!bucket) return null;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <OverlayItemsCell
        bucket={bucket}
        size={size}
        layout={layout}
        enableDrag={enableDnd}
        include={include}
        mealColor={mealColor}
        onItemClick={onItemClick}
      />
    </div>
  );
}
