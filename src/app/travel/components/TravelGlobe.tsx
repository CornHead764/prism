'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { format, parseISO } from 'date-fns';
import type { TravelPin, TravelTrip } from '../types';
import { STATUS_CONFIG, TRIP_STYLE_CONFIG, BUCKET_LIST_COLOR, NPS_COLOR } from '../types';

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';

function pinSize(zoom: number, selected: boolean, isChild: boolean): number {
  let base: number;
  if (zoom < 3)       base = isChild ? 10 : 14;
  else if (zoom < 5)  base = isChild ? 13 : 18;
  else if (zoom < 7)  base = isChild ? 16 : 22;
  else if (zoom < 9)  base = isChild ? 19 : 26;
  else                base = isChild ? 22 : 30;
  return selected ? base + 8 : base;
}

// Classic teardrop/drop-pin SVG — tip anchored at bottom-center
function createDropPin(color: string, selected: boolean, size: number, icon?: string): HTMLElement {
  const h = Math.round(size * 1.4);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `cursor: pointer; width: ${size}px; height: ${h}px; position: relative;`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${size}`);
  svg.setAttribute('height', `${h}`);
  svg.setAttribute('viewBox', '0 0 24 34');
  svg.style.cssText = `display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,${selected ? '0.45' : '0.3'}));`;

  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  body.setAttribute('d', 'M12 1C6.2 1 1.5 5.7 1.5 11.5c0 8.2 10.5 21 10.5 21s10.5-12.8 10.5-21C22.5 5.7 17.8 1 12 1z');
  body.setAttribute('fill', color);
  body.setAttribute('stroke', selected ? 'white' : 'rgba(255,255,255,0.85)');
  body.setAttribute('stroke-width', selected ? '2' : '1.5');
  svg.appendChild(body);

  if (selected) {
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', 'M12 1C6.2 1 1.5 5.7 1.5 11.5c0 8.2 10.5 21 10.5 21s10.5-12.8 10.5-21C22.5 5.7 17.8 1 12 1z');
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', color);
    glow.setAttribute('stroke-width', '3');
    glow.setAttribute('stroke-opacity', '0.35');
    glow.setAttribute('transform', 'scale(1.18) translate(-1.8, -1.3)');
    svg.insertBefore(glow, body);
  }

  if (icon) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '12');
    text.setAttribute('y', '16');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', `${Math.round(size * 0.45)}`);
    text.setAttribute('font-family', 'system-ui, sans-serif');
    text.setAttribute('font-weight', 'bold');
    text.textContent = icon;
    svg.appendChild(text);
  } else {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', '12');
    dot.setAttribute('cy', '11');
    dot.setAttribute('r', `${Math.round(size * 0.18)}`);
    dot.setAttribute('fill', 'rgba(255,255,255,0.75)');
    svg.appendChild(dot);
  }

  wrapper.appendChild(svg);
  return wrapper;
}

// Numbered badge circle for route/loop stops
function createNumberedStop(color: string, selected: boolean, size: number, stopNumber: number): HTMLElement {
  const wrapper = document.createElement('div');
  const fontSize = Math.max(8, Math.round(size * 0.48));
  wrapper.style.cssText = `
    cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%;
    background: ${color}; border: ${selected ? '2.5px solid white' : '2px solid rgba(255,255,255,0.9)'};
    box-shadow: 0 2px 8px rgba(0,0,0,${selected ? '0.4' : '0.25'});
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, sans-serif; font-weight: 700;
    font-size: ${fontSize}px; color: white; user-select: none;
    ${selected ? 'outline: 3px solid ' + color + '55; outline-offset: 2px;' : ''}
  `.replace(/\n\s+/g, ' ');
  wrapper.textContent = String(stopNumber);
  return wrapper;
}

// Hub star marker (⭐ or home base indicator)
function createHubStop(color: string, selected: boolean, size: number): HTMLElement {
  const wrapper = document.createElement('div');
  const fontSize = Math.max(9, Math.round(size * 0.5));
  wrapper.style.cssText = `
    cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%;
    background: ${color}; border: ${selected ? '2.5px solid white' : '2px solid rgba(255,255,255,0.9)'};
    box-shadow: 0 2px 8px rgba(0,0,0,${selected ? '0.4' : '0.25'});
    display: flex; align-items: center; justify-content: center;
    font-size: ${fontSize}px; user-select: none;
    ${selected ? 'outline: 3px solid ' + color + '55; outline-offset: 2px;' : ''}
  `.replace(/\n\s+/g, ' ');
  wrapper.textContent = '⌂';
  return wrapper;
}

// Bullet dot for hub spokes
function createSpokeStop(color: string, selected: boolean, size: number): HTMLElement {
  const inner = Math.round(size * 0.38);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%;
    background: rgba(255,255,255,0.92); border: ${selected ? '2.5px solid ' + color : '2px solid ' + color};
    box-shadow: 0 2px 6px rgba(0,0,0,0.22);
    display: flex; align-items: center; justify-content: center; user-select: none;
  `.replace(/\n\s+/g, ' ');
  const dot = document.createElement('div');
  dot.style.cssText = `width: ${inner}px; height: ${inner}px; border-radius: 50%; background: ${color};`;
  wrapper.appendChild(dot);
  return wrapper;
}

function createPinElement(
  pin: TravelPin,
  selected: boolean,
  zoom: number,
  tripContext?: { style: 'route' | 'loop' | 'hub'; stopNumber?: number; color: string; active: boolean }
): { el: HTMLElement; anchor: maplibregl.PositionAnchor } {
  const isChild = !!pin.parentId;
  const isNP = pin.pinType === 'national_park';
  const size = pinSize(zoom, selected, isChild || !!pin.tripId);

  // National park sub-pin
  if (isNP) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%; background: ${NPS_COLOR}; border: ${selected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.85)'}; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: ${Math.max(8, Math.round(size * 0.55))}px; user-select: none;`;
    wrapper.textContent = '🌲';
    wrapper.title = pin.name;
    return { el: wrapper, anchor: 'center' };
  }

  // Inactive trip stop — small faded dot, always visible
  if (tripContext && !tripContext.active) {
    const dotSize = Math.max(7, Math.round(size * 0.65));
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `cursor: pointer; width: ${dotSize}px; height: ${dotSize}px; border-radius: 50%; background: ${tripContext.color}; opacity: 0.45; border: 1.5px solid rgba(255,255,255,0.8); box-shadow: 0 1px 4px rgba(0,0,0,0.2);`;
    wrapper.title = pin.name;
    return { el: wrapper, anchor: 'center' };
  }

  // Active trip stop markers
  if (tripContext) {
    const { style, stopNumber, color } = tripContext;

    if (style === 'hub' && pin.isHub) {
      const el = createHubStop(color, selected, size);
      el.title = pin.name;
      return { el, anchor: 'center' };
    }

    if (style === 'hub') {
      const el = createSpokeStop(color, selected, size);
      el.title = pin.name;
      return { el, anchor: 'center' };
    }

    // route or loop — numbered
    if (stopNumber !== undefined) {
      const el = createNumberedStop(color, selected, size, stopNumber);
      el.title = pin.name;
      return { el, anchor: 'center' };
    }
  }

  // Parent-child stop pin (purple circle, existing behavior)
  if (pin.pinType === 'stop' && pin.parentId) {
    const stopColor = pin.color || '#8B5CF6';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%; background: ${stopColor}; border: ${selected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.85)'}; box-shadow: 0 2px 6px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; user-select: none;`;
    wrapper.title = pin.name;
    return { el: wrapper, anchor: 'center' };
  }

  // Root / standalone location pin — drop pin shape
  const color = pin.color || (pin.isBucketList ? BUCKET_LIST_COLOR : STATUS_CONFIG[pin.status].color);
  const icon = pin.status === 'been_there' ? '✓' : undefined;
  const wrapper = createDropPin(color, selected, size, icon);
  wrapper.title = pin.name;

  const h = Math.round(size * 1.4);
  const badgeSize = Math.max(10, Math.round(size * 0.42));

  if (pin.isBucketList) {
    const star = document.createElement('div');
    star.style.cssText = `position: absolute; top: ${-badgeSize / 3}px; right: ${-badgeSize / 3}px; width: ${badgeSize}px; height: ${badgeSize}px; background: #F59E0B; border-radius: 50%; border: 1.5px solid white; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(6, badgeSize - 5)}px; line-height: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 1;`;
    star.textContent = '⭐';
    wrapper.appendChild(star);
  }

  if (pin.nationalParks && pin.nationalParks.length > 0) {
    const offset = pin.isBucketList ? badgeSize * 0.6 : 0;
    const tree = document.createElement('div');
    tree.style.cssText = `position: absolute; top: ${-badgeSize / 3}px; left: ${-badgeSize / 3 - offset}px; width: ${badgeSize}px; height: ${badgeSize}px; background: ${NPS_COLOR}; border-radius: 50%; border: 1.5px solid white; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(6, badgeSize - 5)}px; line-height: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 1;`;
    tree.textContent = '🌲';
    wrapper.appendChild(tree);
  }

  void h;
  return { el: wrapper, anchor: 'bottom' };
}

function buildTooltipHTML(pin: TravelPin, tripContext?: { style: 'route' | 'loop' | 'hub'; stopNumber?: number }): string {
  const statusLabel = pin.isBucketList ? '⭐ Bucket List' : STATUS_CONFIG[pin.status].label;
  let dateStr = '';
  if (pin.visitedDate) {
    const start = format(parseISO(pin.visitedDate), 'MMM d, yyyy');
    const end = pin.visitedEndDate ? ` – ${format(parseISO(pin.visitedEndDate), 'MMM d, yyyy')}` : '';
    dateStr = `${start}${end}`;
  }
  const tags = (pin.tags || []).slice(0, 3).join(' · ');
  const parks = (pin.nationalParks || []).slice(0, 2).join(', ');
  const stops = (pin.stops || []).slice(0, 3).join(' · ');

  if (pin.pinType === 'national_park') {
    return `<div style="font-family:system-ui,sans-serif;min-width:120px;max-width:200px"><div style="font-weight:600;font-size:13px;margin-bottom:3px">🌲 ${pin.name}</div>${dateStr ? `<div style="font-size:11px;color:#6B7280">🗓 ${dateStr}</div>` : ''}<div style="font-size:11px;color:#2D6A4F">National Park</div></div>`;
  }

  if (tripContext) {
    const stopLabel = tripContext.style === 'hub' && pin.isHub
      ? '⌂ Home Base'
      : tripContext.stopNumber !== undefined
        ? `Stop ${tripContext.stopNumber}`
        : 'Stop';
    return `<div style="font-family:system-ui,sans-serif;min-width:120px;max-width:220px"><div style="font-weight:600;font-size:13px;margin-bottom:3px">${pin.name}</div>${dateStr ? `<div style="font-size:11px;color:#6B7280;margin-bottom:2px">🗓 ${dateStr}</div>` : ''}<div style="font-size:11px;color:#9CA3AF">${stopLabel}</div></div>`;
  }

  if (pin.pinType === 'stop') {
    return `<div style="font-family:system-ui,sans-serif;min-width:120px;max-width:200px"><div style="font-weight:600;font-size:13px;margin-bottom:3px">📍 ${pin.name}</div>${dateStr ? `<div style="font-size:11px;color:#6B7280">🗓 ${dateStr}</div>` : ''}</div>`;
  }

  return `<div style="font-family:system-ui,sans-serif;min-width:160px;max-width:240px"><div style="font-weight:600;font-size:14px;margin-bottom:4px">${pin.name}</div>${pin.tripLabel ? `<div style="font-size:12px;color:#6B7280;margin-bottom:3px">📅 ${pin.tripLabel}</div>` : ''}${stops ? `<div style="font-size:12px;color:#6B7280;margin-bottom:3px">📍 ${stops}</div>` : ''}${dateStr ? `<div style="font-size:12px;color:#6B7280;margin-bottom:3px">🗓 ${dateStr}</div>` : ''}${parks ? `<div style="font-size:12px;color:#2D6A4F;margin-bottom:3px">🌲 ${parks}</div>` : ''}<div style="font-size:11px;color:#9CA3AF">${statusLabel}${tags ? ` · ${tags}` : ''}</div></div>`;
}

function addTripLinesLayer(map: maplibregl.Map) {
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

function buildTripFeatures(
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

interface TravelGlobeProps {
  pins: TravelPin[];
  trips: TravelTrip[];
  selectedPinId: string | null;
  selectedTripId: string | null;
  darkMode: boolean;
  overlayOpen: boolean;
  onPinClick: (pin: TravelPin) => void;
  onTripStopClick: (pin: TravelPin, trip: TravelTrip) => void;
  onMapClick: (lat: number, lng: number) => void;
}

export function TravelGlobe({
  pins, trips, selectedPinId, selectedTripId, darkMode, overlayOpen,
  onPinClick, onTripStopClick, onMapClick,
}: TravelGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onPinClickRef = useRef(onPinClick);
  const onTripStopClickRef = useRef(onTripStopClick);
  const onMapClickRef = useRef(onMapClick);
  const pinsRef = useRef(pins);
  const tripsRef = useRef(trips);
  const [zoomTier, setZoomTier] = useState(0);

  // Auto-rotation refs
  const rotationFrameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRotatingRef = useRef(false);
  const overlayOpenRef = useRef(overlayOpen);
  // Far-side culling
  const updateCullingRef = useRef<(() => void) | null>(null);

  useEffect(() => { overlayOpenRef.current = overlayOpen; }, [overlayOpen]);

  const startRotation = useCallback(() => {
    if (!mapRef.current || isRotatingRef.current) return;
    isRotatingRef.current = true;
    const tick = () => {
      if (!mapRef.current || !isRotatingRef.current) return;
      const { lng, lat } = mapRef.current.getCenter();
      // Keep longitude within -180..180 to prevent click coordinate drift
      const next = ((lng + 0.04 + 180) % 360) - 180;
      mapRef.current.setCenter([next, lat]);
      rotationFrameRef.current = requestAnimationFrame(tick);
    };
    rotationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRotation = useCallback(() => {
    isRotatingRef.current = false;
    if (rotationFrameRef.current !== null) {
      cancelAnimationFrame(rotationFrameRef.current);
      rotationFrameRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current !== null) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      if (!overlayOpenRef.current) startRotation();
    }, 60_000);
  }, [startRotation]);

  // When overlay opens: stop rotation + cancel resume. When closes: start 1-min timer.
  useEffect(() => {
    if (overlayOpen) {
      stopRotation();
      if (resumeTimerRef.current !== null) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
    } else {
      scheduleResume();
    }
  }, [overlayOpen, stopRotation, scheduleResume]);

  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);
  useEffect(() => { onTripStopClickRef.current = onTripStopClick; }, [onTripStopClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { tripsRef.current = trips; }, [trips]);

  function getZoomTier(zoom: number): number {
    if (zoom < 3) return 0; if (zoom < 5) return 1;
    if (zoom < 7) return 2; if (zoom < 9) return 3; return 4;
  }

  // Build a lookup: pinId → { style, stopNumber, color, active } for trip stops
  function buildTripContextMap(currentPins: TravelPin[], currentTrips: TravelTrip[], activeTripId: string | null) {
    const ctx = new Map<string, { style: 'route' | 'loop' | 'hub'; stopNumber?: number; color: string; active: boolean }>();
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

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_LIGHT,
      zoom: 1.5, center: [0, 20], pitchWithRotate: false, attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('style.load', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setProjection({ type: 'globe' });
      addTripLinesLayer(map);
      if (!overlayOpenRef.current) startRotation();
    });

    map.on('zoomend', () => {
      const tier = getZoomTier(map.getZoom());
      setZoomTier((prev) => (prev !== tier ? tier : prev));
    });

    // Far-side culling — hide/fade pins behind the globe
    const updateCulling = () => {
      const { lng: cLng, lat: cLat } = map.getCenter();
      const toRad = (d: number) => (d * Math.PI) / 180;
      const cx = Math.cos(toRad(cLat)) * Math.cos(toRad(cLng));
      const cy = Math.cos(toRad(cLat)) * Math.sin(toRad(cLng));
      const cz = Math.sin(toRad(cLat));
      for (const [id, marker] of markersRef.current) {
        const pin = pinsRef.current.find((p) => p.id === id);
        if (!pin) continue;
        const px = Math.cos(toRad(pin.latitude)) * Math.cos(toRad(pin.longitude));
        const py = Math.cos(toRad(pin.latitude)) * Math.sin(toRad(pin.longitude));
        const pz = Math.sin(toRad(pin.latitude));
        const dot = cx * px + cy * py + cz * pz;
        const el = marker.getElement();
        if (dot < 0.05) {
          el.classList.add('travel-pin-hidden');
          el.style.opacity = '';
          el.style.pointerEvents = 'none';
        } else {
          el.classList.remove('travel-pin-hidden');
          const base = parseFloat(el.dataset.baseOpacity ?? '1');
          const factor = dot < 0.2 ? (dot - 0.05) / 0.15 : 1;
          el.style.opacity = String(base * factor);
          el.style.pointerEvents = '';
        }
      }
    };
    updateCullingRef.current = updateCulling;
    map.on('move', updateCulling);

    // Stop rotation on any user interaction; schedule resume after 1 min
    const onInteraction = () => { stopRotation(); scheduleResume(); };
    map.on('mousedown', onInteraction);
    map.on('touchstart', onInteraction);
    map.on('wheel', onInteraction);

    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'travel-pin-popup' });
    map.on('click', (e) => {
      // Normalize longitude to -180..180 in case globe rotation drifted it
      const lng = ((e.lngLat.lng + 180) % 360 + 360) % 360 - 180;
      onMapClickRef.current(e.lngLat.lat, lng);
    });
    mapRef.current = map;

    return () => {
      stopRotation();
      if (resumeTimerRef.current !== null) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    const tripCtx = buildTripContextMap(pins, trips, selectedTripId);
    const currentIds = new Set(pins.map((p) => p.id));

    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    }

    for (const pin of pins) {
      if (pin.latitude === 0 && pin.longitude === 0) continue;
      const isSelected = pin.id === selectedPinId;
      const ctx = tripCtx.get(pin.id);

      const buildMarker = () => {
        const { el, anchor } = createPinElement(pin, isSelected, zoom, ctx);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popupRef.current?.remove();
          if (pin.tripId) {
            const trip = tripsRef.current.find((t) => t.id === pin.tripId);
            if (trip) { onTripStopClickRef.current(pin, trip); return; }
          }
          onPinClickRef.current(pin);
        });
        el.addEventListener('mouseenter', () => {
          if (!map) return;
          popupRef.current?.setLngLat([pin.longitude, pin.latitude]).setHTML(buildTooltipHTML(pin, ctx)).addTo(map);
        });
        el.addEventListener('mouseleave', () => { popupRef.current?.remove(); });
        return { el, anchor };
      };

      const existing = markersRef.current.get(pin.id);
      if (existing) { existing.remove(); markersRef.current.delete(pin.id); }
      const { el, anchor } = buildMarker();
      el.dataset.baseOpacity = el.style.opacity || '1';
      const marker = new maplibregl.Marker({ element: el, anchor })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map);
      markersRef.current.set(pin.id, marker);
    }
    updateCullingRef.current?.();
  }, [pins, trips, selectedPinId, zoomTier]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trip lines — always render all trips; active trip gets full style, others get faded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('trip-lines') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    // Build features for every trip
    const tripFeatures: GeoJSON.Feature[] = trips.flatMap((trip) => {
      const tripStops = pins.filter((p) => p.tripId === trip.id);
      const color = trip.color || STATUS_CONFIG[trip.status].color;
      const active = trip.id === selectedTripId;
      return buildTripFeatures(tripStops, trip.tripStyle, color, active);
    });

    // Also draw spokes for a selected standalone pin with children
    const spokeFeatures: GeoJSON.Feature[] = [];
    if (selectedPinId) {
      const parent = pins.find((p) => p.id === selectedPinId);
      if (parent && !parent.tripId && (parent.latitude !== 0 || parent.longitude !== 0)) {
        const children = pins.filter((p) => p.parentId === selectedPinId && (p.latitude !== 0 || p.longitude !== 0));
        children.forEach((c) => {
          spokeFeatures.push({
            type: 'Feature' as const,
            properties: { color: c.pinType === 'national_park' ? NPS_COLOR : '#8B5CF6', active: true },
            geometry: { type: 'LineString' as const, coordinates: [[parent.longitude, parent.latitude], [c.longitude, c.latitude]] },
          });
        });
      }
    }

    source.setData({ type: 'FeatureCollection', features: [...tripFeatures, ...spokeFeatures] });
  }, [pins, trips, selectedPinId, selectedTripId]);

  // Fly to selected trip (center on its stops) or selected pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedTripId) {
      const tripStops = pins.filter((p) => p.tripId === selectedTripId && (p.latitude !== 0 || p.longitude !== 0));
      if (tripStops.length === 0) return;
      const firstStop = tripStops[0]!;
      if (tripStops.length === 1) {
        map.flyTo({ center: [firstStop.longitude, firstStop.latitude], zoom: Math.max(map.getZoom(), 4), duration: 800, essential: true });
        return;
      }
      const bounds = tripStops.reduce(
        (b, p) => b.extend([p.longitude, p.latitude]),
        new maplibregl.LngLatBounds([firstStop.longitude, firstStop.latitude], [firstStop.longitude, firstStop.latitude])
      );
      map.fitBounds(bounds, { padding: 80, duration: 800, essential: true, maxZoom: 10 });
      return;
    }

    if (selectedPinId) {
      const pin = pins.find((p) => p.id === selectedPinId);
      if (!pin || (pin.latitude === 0 && pin.longitude === 0)) return;
      map.flyTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(map.getZoom(), 4), duration: 800, essential: true });
    }
  }, [selectedPinId, selectedTripId, pins]);

  return (
    <>
      <style>{`
        .travel-pin-popup .maplibregl-popup-content { padding: 10px 12px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); border: 1px solid rgba(0,0,0,0.08); }
        .travel-pin-popup .maplibregl-popup-tip { border-top-color: white; }
        .globe-dark .maplibregl-canvas-container { filter: brightness(0.72) saturate(0.55) contrast(1.08) hue-rotate(5deg); }
        .travel-pin-hidden { opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; }
      `}</style>
      <div ref={containerRef} className={`flex-1 rounded-lg overflow-hidden${darkMode ? ' globe-dark' : ''}`} />
    </>
  );
}
