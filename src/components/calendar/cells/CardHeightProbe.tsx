'use client';

import * as React from 'react';
import { WeekItemCard, type WeekItemSize, type WeekItemLayout } from './WeekItemCard';
import { useMeasuredHeight } from '@/lib/hooks/useCardCapacity';

interface CardHeightProbeProps {
  size: WeekItemSize;
  /** Layout to probe — must match what real cells render. Defaults to 'column'. */
  layout?: WeekItemLayout;
  /** Receives the measured height in px each time it changes. */
  onMeasure: (height: number | undefined) => void;
}

/**
 * Renders a representative WeekItemCard off-screen and reports its real
 * rendered height to the caller. Used to drive {@link useCardCapacity} with
 * the *actual* card height under the current font scale + theme + viewport,
 * rather than a hardcoded constant.
 *
 * The probe is `aria-hidden`, fixed-position and visually invisible, but is
 * still in the layout tree so its CSS reflects what real cards will render.
 */
export function CardHeightProbe({ size, layout = 'column', onMeasure }: CardHeightProbeProps) {
  const { ref, height } = useMeasuredHeight();

  React.useEffect(() => {
    onMeasure(height);
  }, [height, onMeasure]);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 240,
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <WeekItemCard
        variant="event"
        size={size}
        layout={layout}
        stripeColor="#3B82F6"
        title="Probe Card Title"
        timeLabel="9:00 AM"
        subtitle="probe"
      />
    </div>
  );
}
