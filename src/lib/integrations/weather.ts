/**
 * Weather provider factory.
 * Selects the active provider based on the WEATHER_PROVIDER env var.
 *
 *   WEATHER_PROVIDER=meteo       → Open-Meteo (DEFAULT — no API key required)
 *   WEATHER_PROVIDER=pirate      → Pirate Weather (Dark Sky-compatible, key required)
 *   WEATHER_PROVIDER=openweather → OpenWeatherMap (key required)
 *
 * The default is Open-Meteo so a fresh install has working weather with zero
 * env-var configuration. Users who want minutely precipitation forecasts can
 * opt into Pirate Weather by setting PIRATE_WEATHER_API_KEY.
 *
 * Usage:
 *   import { fetchWeatherData, type LocationParam } from '@/lib/integrations/weather';
 */

import type { WeatherData } from '@/components/widgets/WeatherWidget';

export type LocationParam = string | { lat: number; lon: number };

export async function fetchWeatherData(location?: LocationParam): Promise<WeatherData> {
  const provider = process.env.WEATHER_PROVIDER ?? 'meteo';

  if (provider === 'openweather') {
    const { fetchWeatherData: fetchOW } = await import('./openweather');
    return fetchOW(location);
  }

  if (provider === 'pirate') {
    const { fetchWeatherData: fetchPW } = await import('./pirateweather');
    return fetchPW(location);
  }

  const { fetchWeatherData: fetchOM } = await import('./openmeteo');
  return fetchOM(location);
}
