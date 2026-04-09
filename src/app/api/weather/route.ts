/**
 *
 * Provides weather data from OpenWeatherMap API.
 *
 * ENDPOINT: /api/weather
 * - GET: Fetch current weather and forecast
 *
 * QUERY PARAMETERS:
 * - location: Location string (e.g., "Chicago,IL,US")
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/auth';
import { fetchWeatherData } from '@/lib/integrations/openweather';
import { getCached } from '@/lib/cache/redis';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

// Cache weather data for 30 minutes
const WEATHER_CACHE_TTL = 30 * 60;

/**
 * Resolve location string: query param > DB setting > env var > default
 */
async function resolveLocation(queryLocation: string | null): Promise<string> {
  if (queryLocation) return queryLocation;

  // DB setting takes priority over env var
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'location'));
    if (row?.value) {
      const val = row.value as { zipCode?: string; city?: string; state?: string; country?: string };
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

    // Create a cache key based on location
    const cacheKey = `weather:${location.toLowerCase().replace(/\s+/g, '-')}`;

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
