'use client';

import { useFetch } from './useFetch';
import type { WeatherData } from '@/components/widgets/WeatherWidget';

interface UseWeatherOptions {
  location?: string;
  refreshInterval?: number;
  enabled?: boolean;
}

function transformWeather(json: unknown): WeatherData {
  const raw = json as {
    lastUpdated: string;
    forecast: Array<{ date: string; dayName: string; high: number; low: number; condition: string }>;
    hourly?: Array<{ time: string; condition: string; temp: number }>;
    sunrise?: string;
    sunset?: string;
    [key: string]: unknown;
  };
  return {
    ...raw,
    lastUpdated: new Date(raw.lastUpdated),
    forecast: raw.forecast.map((day) => ({
      ...day,
      date: new Date(day.date),
    })),
    hourly: raw.hourly?.map((h) => ({
      ...h,
      time: new Date(h.time),
    })),
    sunrise: raw.sunrise ? new Date(raw.sunrise) : undefined,
    sunset:  raw.sunset  ? new Date(raw.sunset)  : undefined,
  } as unknown as WeatherData;
}

export function useWeather(options: UseWeatherOptions = {}) {
  const { location, refreshInterval = 5 * 60 * 1000, enabled } = options;

  const url = location
    ? `/api/weather?location=${encodeURIComponent(location)}`
    : '/api/weather';

  const { data, loading, error, refresh } = useFetch<WeatherData | null>({
    url,
    initialData: null,
    transform: transformWeather,
    refreshInterval,
    label: 'weather',
    enabled,
  });

  return { data, loading, error, refresh };
}
