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

// Build a flat ordered node list from a route for the train map
interface TrainNode {
  name: string;
  index: number;
  isStop: boolean;    // square shape — the ETA target
  isSchool: boolean;  // diamond shape — school terminal (AM only)
}

function buildNodes(route: BusRouteStatus): TrainNode[] {
  const checkpoints = route.checkpoints || [];
  const stopIsInCheckpoints = route.stopName
    ? checkpoints.some(cp => cp.name === route.stopName)
    : false;

  const nodes: TrainNode[] = checkpoints.map((cp, i) => ({
    name: cp.name,
    index: i,
    isStop: cp.name === route.stopName,
    isSchool: false,
  }));

  // Legacy: stopName is an implicit terminal after the named list
  if (route.stopName && !stopIsInCheckpoints) {
    nodes.push({ name: route.stopName, index: checkpoints.length, isStop: true, isSchool: false });
  }

  // School is the AM terminal (diamond), not shown as destination for PM
  if (route.direction === 'AM' && route.schoolName) {
    const schoolIdx = checkpoints.length + (route.stopName && !stopIsInCheckpoints ? 1 : 0);
    nodes.push({ name: route.schoolName, index: schoolIdx, isStop: false, isSchool: true });
  }

  return nodes;
}

function RouteStatusCard({ route, compact }: { route: BusRouteStatus; compact: boolean }) {
  const p = route.prediction;
  const statusColor = getStatusColor(p);
  const statusText = getStatusText(p);
  const nodes = buildNodes(route);

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
        <div data-keep-bg className={cn('h-2 w-2 rounded-full flex-shrink-0', statusColor)} />
        <span className="text-xs text-muted-foreground">{statusText}</span>
      </div>

      {/* Train map */}
      {nodes.length > 0 && (
        <TrainMap nodes={nodes} prediction={p} compact={compact} statusColor={statusColor} />
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

function TrainMap({
  nodes,
  prediction,
  compact,
  statusColor,
}: {
  nodes: TrainNode[];
  prediction: BusPrediction;
  compact: boolean;
  statusColor: string;
}) {
  const lastIdx = prediction.lastCheckpointIndex;
  // Extra height for diagonal labels below the track
  const labelRowHeight = compact ? 0 : 40;
  const nodeSize = compact ? 10 : 14;
  const trackTop = Math.floor(nodeSize / 2) - 1; // center the track on the nodes

  return (
    <div
      className="relative w-full select-none"
      style={{ height: nodeSize + labelRowHeight + 2 }}
    >
      {/* Track segments between nodes */}
      {nodes.map((node, i) => {
        if (i === nodes.length - 1) return null;
        const segPassed = node.index < lastIdx ||
          (node.index === lastIdx && nodes[i + 1]!.index <= lastIdx);
        return (
          <div
            key={`seg-${i}`}
            data-keep-bg
            className={cn(
              'absolute',
              segPassed ? statusColor : 'bg-muted-foreground/25',
            )}
            style={{
              top: trackTop,
              height: 2,
              // Position: from this node's center to next node's center
              // Using percentage for even spacing
              left: `calc(${(i / (nodes.length - 1)) * 100}% + ${nodeSize / 2}px)`,
              right: `calc(${(1 - (i + 1) / (nodes.length - 1)) * 100}% + ${nodeSize / 2}px)`,
            }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => {
        const isReached = node.index <= lastIdx;
        const isCurrent = node.index === lastIdx && prediction.status !== 'no_data';

        // Shape: circle for regular, rounded-sm for stop, rotate-45 wrapper for school (diamond)
        const leftPct = nodes.length === 1
          ? 50
          : (i / (nodes.length - 1)) * 100;

        return (
          <div
            key={node.name}
            className="absolute flex flex-col items-center"
            style={{
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              top: 0,
            }}
          >
            {/* Node shape */}
            {node.isSchool ? (
              // Diamond via rotated square
              <div
                data-keep-bg
                className={cn(
                  'border-2 transition-all',
                  isReached
                    ? cn(statusColor, statusColor.replace('bg-', 'border-'))
                    : 'border-muted-foreground/40 bg-background',
                  isCurrent && 'animate-pulse',
                )}
                style={{
                  width: nodeSize,
                  height: nodeSize,
                  transform: 'rotate(45deg)',
                  flexShrink: 0,
                }}
                title={node.name}
              />
            ) : node.isStop ? (
              // Square
              <div
                data-keep-bg
                className={cn(
                  'border-2 transition-all rounded-sm',
                  isReached
                    ? cn(statusColor, statusColor.replace('bg-', 'border-'))
                    : 'border-muted-foreground/40 bg-background',
                  isCurrent && 'animate-pulse',
                )}
                style={{ width: nodeSize, height: nodeSize, flexShrink: 0 }}
                title={node.name}
              />
            ) : (
              // Circle
              <div
                data-keep-bg
                className={cn(
                  'border-2 rounded-full transition-all',
                  isReached
                    ? cn(statusColor, statusColor.replace('bg-', 'border-'))
                    : 'border-muted-foreground/40 bg-background',
                  isCurrent && 'animate-pulse',
                )}
                style={{ width: nodeSize, height: nodeSize, flexShrink: 0 }}
                title={node.name}
              />
            )}

            {/* Diagonal label — only in full (non-compact) mode */}
            {!compact && (
              <div
                className="absolute text-[9px] leading-none text-muted-foreground whitespace-nowrap pointer-events-none"
                style={{
                  top: nodeSize + 3,
                  left: '50%',
                  transformOrigin: 'top left',
                  transform: 'rotate(45deg)',
                  maxWidth: 64,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.name.length > 12 ? node.name.slice(0, 11) + '…' : node.name}
              </div>
            )}
          </div>
        );
      })}
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
