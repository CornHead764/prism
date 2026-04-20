/**
 * ENDPOINT: /api/travel/geocode
 * Proxy for Nominatim geocoding (OpenStreetMap).
 * Avoids CORS issues and hides the User-Agent requirement from the client.
 *
 * GET /api/travel/geocode?q=Paris+France
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { logError } from '@/lib/utils/logError';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    municipality?: string;
    island?: string;
    archipelago?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  class?: string;
  type?: string;
  importance?: number;
}

function shortDisplayName(result: NominatimResult): string {
  const a = result.address || {};
  // Most specific to least: city > town > village > county/municipality > island > state
  const place =
    a.city || a.town || a.village ||
    a.county || a.municipality || a.island || a.archipelago;
  const parts = [place, a.state, a.country].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  // Fallback: first 3 comma-separated parts of full name
  return result.display_name.split(',').slice(0, 3).join(',').trim();
}

export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ results: [] });

  const limited = await rateLimitGuard(auth.userId, 'geocode', 10, 60);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get('q');
  if (!rawQ || rawQ.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Normalize special characters and common colloquial aliases
  const ALIASES: Record<string, string> = {
    'big island':         'Hawaii Island, Hawaii, United States',
    'big island hawaii':  'Hawaii Island, Hawaii, United States',
    'big island hi':      'Hawaii Island, Hawaii, United States',
    'the big island':     'Hawaii Island, Hawaii, United States',
    'hawaii island':      'Hawaii Island, Hawaii, United States',
    'island of hawaii':   'Hawaii Island, Hawaii, United States',
    'maui island':        'Maui, Hawaii, United States',
    'oahu':               'Oahu, Hawaii, United States',
    'the big island of hawaii': 'Hawaii Island, Hawaii, United States',
  };
  const normalized = rawQ
    .trim()
    // Replace Hawaiian ʻokina (U+02BB) and similar special apostrophes with nothing
    .replace(/[\u02BB\u02BC\u0060\u00B4]/g, '')
    // Smart/curly apostrophes → straight
    .replace(/[\u2018\u2019]/g, "'");
  const q = ALIASES[normalized.toLowerCase()] ?? normalized;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Prism-Family-Dashboard/1.0 (https://github.com/sandydargoport/prism)',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = (await response.json()) as NominatimResult[];

    // When searching for a national park/monument, prefer boundary results over
    // natural features (peaks, volcanoes) which often have wrong centroids.
    const isNationalParkSearch = /national (park|monument|recreation area)/i.test(q);
    if (isNationalParkSearch) {
      data.sort((a, b) => {
        const score = (r: NominatimResult) =>
          r.type === 'national_park' ? 0 :
          r.class === 'boundary' ? 1 :
          r.class === 'leisure' ? 2 : 3;
        return score(a) - score(b) || (b.importance ?? 0) - (a.importance ?? 0);
      });
    }

    const results = data
      .map((item) => ({
        placeId: item.place_id,
        displayName: shortDisplayName(item),
        fullName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }))
      .filter(r => isFinite(r.latitude) && isFinite(r.longitude) &&
        r.latitude >= -90 && r.latitude <= 90 &&
        r.longitude >= -180 && r.longitude <= 180);

    return NextResponse.json({ results });
  } catch (error) {
    logError('Error geocoding location:', error);
    return NextResponse.json({ results: [] });
  }
}
