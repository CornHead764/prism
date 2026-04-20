import { format, parseISO } from 'date-fns';
import type { TravelPin } from '../types';
import { STATUS_CONFIG } from '../types';

export function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildTooltipHTML(
  pin: TravelPin,
  tripContext?: { style: 'route' | 'loop' | 'hub'; stopNumber?: number }
): string {
  const statusLabel = pin.isBucketList ? '⭐ Bucket List' : STATUS_CONFIG[pin.status].label;
  let dateStr = '';
  if (pin.visitedDate) {
    const start = format(parseISO(pin.visitedDate), 'MMM d, yyyy');
    const end = pin.visitedEndDate ? ` – ${format(parseISO(pin.visitedEndDate), 'MMM d, yyyy')}` : '';
    dateStr = `${start}${end}`;
  }
  const name = escapeHTML(pin.name);
  const tripLabel = pin.tripLabel ? escapeHTML(pin.tripLabel) : '';
  const tags = (pin.tags || []).slice(0, 3).map(escapeHTML).join(' · ');
  const parks = (pin.nationalParks || []).slice(0, 2).map(escapeHTML).join(', ');
  const stops = (pin.stops || []).slice(0, 3).map(escapeHTML).join(' · ');

  if (pin.pinType === 'national_park') {
    return `<div style="font-family:system-ui,sans-serif;min-width:120px;max-width:200px"><div style="font-weight:600;font-size:13px;margin-bottom:3px">🌲 ${name}</div>${dateStr ? `<div style="font-size:11px;color:#6B7280">🗓 ${dateStr}</div>` : ''}<div style="font-size:11px;color:#2D6A4F">National Park</div></div>`;
  }

  if (tripContext) {
    const stopLabel = tripContext.style === 'hub' && pin.isHub
      ? '⌂ Home Base'
      : tripContext.stopNumber !== undefined
        ? `Stop ${tripContext.stopNumber}`
        : 'Stop';
    return `<div style="font-family:system-ui,sans-serif;min-width:120px;max-width:220px"><div style="font-weight:600;font-size:13px;margin-bottom:3px">${name}</div>${dateStr ? `<div style="font-size:11px;color:#6B7280;margin-bottom:2px">🗓 ${dateStr}</div>` : ''}<div style="font-size:11px;color:#9CA3AF">${stopLabel}</div></div>`;
  }

  if (pin.pinType === 'stop') {
    return `<div style="font-family:system-ui,sans-serif;min-width:120px;max-width:200px"><div style="font-weight:600;font-size:13px;margin-bottom:3px">📍 ${name}</div>${dateStr ? `<div style="font-size:11px;color:#6B7280">🗓 ${dateStr}</div>` : ''}</div>`;
  }

  return `<div style="font-family:system-ui,sans-serif;min-width:160px;max-width:240px"><div style="font-weight:600;font-size:14px;margin-bottom:4px">${name}</div>${tripLabel ? `<div style="font-size:12px;color:#6B7280;margin-bottom:3px">📅 ${tripLabel}</div>` : ''}${stops ? `<div style="font-size:12px;color:#6B7280;margin-bottom:3px">📍 ${stops}</div>` : ''}${dateStr ? `<div style="font-size:12px;color:#6B7280;margin-bottom:3px">🗓 ${dateStr}</div>` : ''}${parks ? `<div style="font-size:12px;color:#2D6A4F;margin-bottom:3px">🌲 ${parks}</div>` : ''}<div style="font-size:11px;color:#9CA3AF">${statusLabel}${tags ? ` · ${tags}` : ''}</div></div>`;
}
