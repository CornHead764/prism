import maplibregl from 'maplibre-gl';
import type { TravelPin } from '../types';
import { STATUS_CONFIG, BUCKET_LIST_COLOR, NPS_COLOR } from '../types';

export function getZoomTier(zoom: number): number {
  if (zoom < 3) return 0; if (zoom < 5) return 1;
  if (zoom < 7) return 2; if (zoom < 9) return 3; return 4;
}

export function pinSize(zoom: number, selected: boolean, isChild: boolean): number {
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

// Hub star marker (home base indicator)
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

export type TripMarkerContext = {
  style: 'route' | 'loop' | 'hub';
  stopNumber?: number;
  color: string;
  active: boolean;
};

export function createPinElement(
  pin: TravelPin,
  selected: boolean,
  zoom: number,
  tripContext?: TripMarkerContext
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

    if (stopNumber !== undefined) {
      const el = createNumberedStop(color, selected, size, stopNumber);
      el.title = pin.name;
      return { el, anchor: 'center' };
    }
  }

  // Parent-child stop pin
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
