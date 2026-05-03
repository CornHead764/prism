/**
 * Weather API route.
 *
 * ENDPOINT: /api/weather
 *   GET — fetch current weather and forecast for the resolved location.
 *
 * Provider selection is driven by WEATHER_PROVIDER env var (see weather.ts).
 *
 * QUERY PARAMETERS:
 *   location — optional override (display string)
 */

import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/auth';
import { fetchWeatherData, type LocationParam } from '@/lib/integrations/weather';
import { getCached } from '@/lib/cache/redis';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

// Cache weather data for 30 minutes
const WEATHER_CACHE_TTL = 30 * 60;

/**
 * Resolve location: query param > DB setting (lat/lon preferred, legacy string fallback) > env var > default
 */
async function resolveLocation(queryLocation: string | null): Promise<LocationParam> {
  if (queryLocation) return queryLocation;

  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'location'));
    if (row?.value) {
      const val = row.value as {
        // New format: geocoded lat/lon
        lat?: number; lon?: number; displayName?: string;
        // Legacy format: free-text fields
        zipCode?: string; city?: string; state?: string; country?: string;
      };
      if (val.lat !== undefined && val.lon !== undefined) {
        return { lat: val.lat, lon: val.lon };
      }
      // Legacy fallback — still works for existing installs
      if (val.zipCode) return `${val.zipCode},US`;
      if (val.city) return [val.city, val.state, val.country || 'US'].filter(Boolean).join(',');
    }
  } catch { /* fall through */ }

  return process.env.WEATHER_LOCATION || 'Chicago,IL,US';
}

/**
 * GET /api/weather
 * Fetches weather data for a location (cached for 30 minutes)
 */
export async function GET(request: NextRequest) {
  // Weather is available to everyone - no auth required for read-only
  const _auth = await optionalAuth();

  try {
    const { searchParams } = new URL(request.url);
    const location = await resolveLocation(searchParams.get('location'));

    // Cache key includes the provider so switching WEATHER_PROVIDER doesn't
    // serve a stale response shaped by the previous provider (different
    // condition strings, descriptions, and forecast fields).
    const provider = process.env.WEATHER_PROVIDER ?? 'meteo';
    const locationKey = typeof location === 'string'
      ? location.toLowerCase().replace(/\s+/g, '-')
      : `${location.lat.toFixed(2)},${location.lon.toFixed(2)}`;
    const cacheKey = `weather:${provider}:${locationKey}`;

    // Get from cache or fetch fresh
    const weatherData = await getCached(
      cacheKey,
      () => fetchWeatherData(location),
      WEATHER_CACHE_TTL
    );

    return NextResponse.json(weatherData);
  } catch (error) {
    logError('Weather API error:', error);

    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        { error: 'Weather API not configured', details: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
