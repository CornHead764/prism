'use client';

import * as React from 'react';
import { Bus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { useBusTracking } from '@/lib/hooks/useBusTracking';
import type { BusRouteStatus, BusPrediction } from '@/lib/hooks/useBusTracking';

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export interface BusTrackingWidgetProps {
  className?: string;
  gridW?: number;
  gridH?: number;
}

export function BusTrackingWidget({ className, gridW }: BusTrackingWidgetProps) {
  const { routes, loading, error } = useBusTracking();
  const isCompact = !gridW || gridW < 12;

  // In compact mode, show only the most relevant route (closest to scheduled time)
  const displayRoutes = isCompact ? getBestRoute(routes) : routes;

  return (
    <WidgetContainer
      title="Bus Tracker"
      icon={<Bus className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      className={className}
    >
      {displayRoutes.length === 0 ? (
        <WidgetEmpty
          icon={<Bus className="h-8 w-8" />}
          message="No bus routes configured"
        />
      ) : (
        <div className="overflow-auto h-full -mr-2 pr-2 space-y-3">
          {displayRoutes.map((route) => (
            <RouteStatusCard key={route.id} route={route} compact={isCompact} />
          ))}
        </div>
      )}
    </WidgetContainer>
  );
}

function RouteStatusCard({ route, compact }: { route: BusRouteStatus; compact: boolean }) {
  const p = route.prediction;
  const statusColor = getStatusColor(p);
  const statusText = getStatusText(p);
  const checkpoints = route.checkpoints || [];
  const totalDots = checkpoints.length + (route.stopName ? 1 : 0) + (route.schoolName ? 1 : 0);

  return (
    <div className="space-y-1.5">
      {/* Header row: label + scheduled time */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{route.label}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
          {route.scheduledTime}
        </span>
      </div>

      {/* Status text with color indicator */}
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full flex-shrink-0', statusColor)} />
        <span className="text-xs text-muted-foreground">{statusText}</span>
      </div>

      {/* Progress dots */}
      {!compact && totalDots > 0 && (
        <div className="flex items-center gap-1.5 py-1">
          {checkpoints.map((cp, i) => (
            <CheckpointDot
              key={cp.name}
              index={i}
              name={cp.name}
              prediction={p}
              isStop={false}
              isSchool={false}
            />
          ))}
          {route.stopName && (
            <CheckpointDot
              index={checkpoints.length}
              name={route.stopName}
              prediction={p}
              isStop={true}
              isSchool={false}
            />
          )}
          {route.schoolName && (
            <CheckpointDot
              index={checkpoints.length + (route.stopName ? 1 : 0)}
              name={route.schoolName}
              prediction={p}
              isStop={false}
              isSchool={true}
            />
          )}
        </div>
      )}

      {/* Last update info */}
      {p.lastCheckpointName && p.minutesSinceLastCheckpoint !== null && (
        <div className="text-[11px] text-muted-foreground">
          Last: {p.lastCheckpointName} ({formatMinutes(p.minutesSinceLastCheckpoint)} ago)
        </div>
      )}
    </div>
  );
}

function CheckpointDot({
  index,
  name,
  prediction,
  isStop,
  isSchool,
}: {
  index: number;
  name: string;
  prediction: BusPrediction;
  isStop: boolean;
  isSchool: boolean;
}) {
  const isReached = index <= prediction.lastCheckpointIndex;
  const isCurrent = index === prediction.lastCheckpointIndex;
  const statusColor = getStatusColor(prediction);

  // Shape: square for stop, diamond for school, circle for regular
  const shapeClass = isSchool
    ? 'rotate-45'
    : isStop
      ? 'rounded-sm'
      : 'rounded-full';

  return (
    <div className="group relative flex flex-col items-center">
      <div
        className={cn(
          'h-3 w-3 border-2 transition-all',
          shapeClass,
          isReached
            ? cn('border-current', statusColor.replace('bg-', 'text-'), 'bg-current')
            : 'border-muted-foreground/30 bg-transparent',
          isCurrent && 'animate-pulse scale-125',
        )}
        title={name}
      />
    </div>
  );
}

function getStatusColor(p: BusPrediction): string {
  switch (p.status) {
    case 'at_stop':
    case 'at_school':
      return 'bg-green-500';
    case 'in_transit':
    case 'cold_start':
      return 'bg-amber-500';
    case 'overdue':
      return 'bg-red-500';
    case 'no_data':
    default:
      return 'bg-muted-foreground/50';
  }
}

function getStatusText(p: BusPrediction): string {
  switch (p.status) {
    case 'at_stop':
      return 'Arrived at stop';
    case 'at_school':
      return 'Arrived at school';
    case 'in_transit':
      if (p.etaMinutes !== null) {
        if (p.etaRangeLow !== null && p.etaRangeHigh !== null && p.etaRangeLow !== p.etaRangeHigh) {
          return `${p.etaRangeLow}-${p.etaRangeHigh} min away`;
        }
        return `~${p.etaMinutes} min away`;
      }
      return 'In transit';
    case 'cold_start':
      if (p.lastCheckpointName && p.minutesSinceLastCheckpoint !== null) {
        return `${formatMinutes(p.minutesSinceLastCheckpoint)} ago at ${p.lastCheckpointName}`;
      }
      return 'In transit (building history)';
    case 'overdue':
      return 'Overdue — no updates';
    case 'no_data':
    default:
      return 'No updates yet';
  }
}

function getBestRoute(routes: BusRouteStatus[]): BusRouteStatus[] {
  if (routes.length === 0) return [];

  const now = new Date();

  // Find routes within bus window, sorted by closest scheduled time
  const scored = routes.map(route => {
    const parts = route.scheduledTime.split(':').map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const scheduled = new Date(now);
    scheduled.setHours(h, m, 0, 0);
    const diff = Math.abs(now.getTime() - scheduled.getTime());
    return { route, diff };
  }).sort((a, b) => a.diff - b.diff);

  return [scored[0]!.route];
}
