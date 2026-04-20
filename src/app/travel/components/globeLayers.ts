import maplibregl from 'maplibre-gl';
import type { TravelPin, TravelTrip } from '../types';
import { STATUS_CONFIG } from '../types';
import type { TripMarkerContext } from './globeMarkers';

export function addTripLinesLayer(map: maplibregl.Map) {
  if (map.getSource('trip-lines')) return;
  map.addSource('trip-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  // Inactive trips — thin, low opacity
  map.addLayer({
    id: 'trip-lines-bg', type: 'line', source: 'trip-lines',
    filter: ['!', ['get', 'active']],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.28 },
  });
  // Active trip — dashed, full opacity
  map.addLayer({
    id: 'trip-lines', type: 'line', source: 'trip-lines',
    filter: ['==', ['get', 'active'], true],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.75, 'line-dasharray': [3, 2] },
  });
}

export function buildTripFeatures(
  tripStops: TravelPin[],
  tripStyle: 'route' | 'loop' | 'hub',
  color: string,
  active: boolean
): GeoJSON.Feature[] {
  const validStops = tripStops.filter((p) => p.latitude !== 0 || p.longitude !== 0);
  if (validStops.length < 2) return [];

  if (tripStyle === 'hub') {
    const hub = validStops.find((p) => p.isHub) ?? validStops[0];
    if (!hub) return [];
    return validStops
      .filter((p) => p.id !== hub.id)
      .map((spoke) => ({
        type: 'Feature' as const,
        properties: { color, active },
        geometry: {
          type: 'LineString' as const,
          coordinates: [[hub.longitude, hub.latitude], [spoke.longitude, spoke.latitude]],
        },
      }));
  }

  const sorted = [...validStops].sort((a, b) => a.sortOrder - b.sortOrder);
  const first = sorted[0];
  const coords: [number, number][] = sorted.map((p) => [p.longitude, p.latitude]);
  if (tripStyle === 'loop' && sorted.length > 2 && first) {
    coords.push([first.longitude, first.latitude]);
  }
  return [{
    type: 'Feature' as const,
    properties: { color, active },
    geometry: { type: 'LineString' as const, coordinates: coords },
  }];
}

export function buildTripContextMap(
  currentPins: TravelPin[],
  currentTrips: TravelTrip[],
  activeTripId: string | null
): Map<string, TripMarkerContext> {
  const ctx = new Map<string, TripMarkerContext>();
  for (const trip of currentTrips) {
    const tripColor = trip.color || STATUS_CONFIG[trip.status].color;
    const tripStyle = trip.tripStyle;
    const active = trip.id === activeTripId;
    const stops = currentPins
      .filter((p) => p.tripId === trip.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    stops.forEach((stop, idx) => {
      ctx.set(stop.id, {
        style: tripStyle,
        stopNumber: (tripStyle === 'route' || tripStyle === 'loop') ? idx + 1 : undefined,
        color: tripColor,
        active,
      });
    });
  }
  return ctx;
}
