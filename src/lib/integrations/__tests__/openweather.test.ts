/**
 * Tests for OpenWeather integration pure functions.
 *
 * The exported async functions (fetchCurrentWeather, fetchForecast, fetchWeatherData)
 * hit the OpenWeather API, so we test the internal pure functions by extracting
 * their logic into testable scenarios. We mock the module internals and test
 * the mapCondition, kelvinToFahrenheit, mpsToMph, and forecast aggregation logic
 * through the public API surface.
 */

// We need to mock getConfig and global fetch before importing
const mockApiKey = 'test-api-key';

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

// Save original env
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    OPENWEATHER_API_KEY: mockApiKey,
    WEATHER_LOCATION: 'TestCity,US',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

// Helper: build a mock OpenWeather current response
function mockCurrentResponse(overrides: {
  temp?: number;
  feels_like?: number;
  humidity?: number;
  windSpeed?: number;
  weatherId?: number;
  description?: string;
  name?: string;
} = {}) {
  return {
    main: {
      temp: overrides.temp ?? 300, // 300K ≈ 80°F
      feels_like: overrides.feels_like ?? 303,
      humidity: overrides.humidity ?? 65,
    },
    wind: {
      speed: overrides.windSpeed ?? 5, // 5 m/s ≈ 11 mph
    },
    weather: [{
      id: overrides.weatherId ?? 800,
      main: 'Clear',
      description: overrides.description ?? 'clear sky',
      icon: '01d',
    }],
    name: overrides.name ?? 'TestCity',
  };
}

// Helper: build a forecast list item
function mockForecastItem(dt: number, temp: number, weatherId: number) {
  return {
    dt,
    main: { temp, temp_min: temp - 2, temp_max: temp + 2 },
    weather: [{ id: weatherId, main: 'Weather', description: 'weather' }],
  };
}

import { fetchCurrentWeather, fetchForecast, fetchWeatherData } from '../openweather';

describe('OpenWeather integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchCurrentWeather (unit conversions + condition mapping)', () => {
    it('converts Kelvin to Fahrenheit correctly', async () => {
      // 273.15K = 32°F (freezing), 300K ≈ 80°F
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ temp: 273.15, feels_like: 273.15 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.temperature).toBe(32); // 273.15K = 32°F exactly
      expect(result.feelsLike).toBe(32);
    });

    it('converts 0K to -460°F', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ temp: 0, feels_like: 0 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.temperature).toBe(-460); // 0K = -459.67°F, rounds to -460
    });

    it('converts 373.15K (boiling) to 212°F', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ temp: 373.15, feels_like: 373.15 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.temperature).toBe(212);
    });

    it('converts wind speed from m/s to mph', async () => {
      // 10 m/s × 2.237 ≈ 22 mph
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ windSpeed: 10 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.windSpeed).toBe(22);
    });

    it('maps thunderstorm codes (200-299) to stormy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 211 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('stormy');
    });

    it('maps drizzle codes (300-399) to rainy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 301 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('rainy');
    });

    it('maps rain codes (500-599) to rainy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 502 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('rainy');
    });

    it('maps snow codes (600-699) to snowy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 601 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('snowy');
    });

    it('maps atmosphere codes (700-799) to cloudy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 741 })), // fog
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('cloudy');
    });

    it('maps clear (800) to sunny', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 800 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('sunny');
    });

    it('maps few/scattered clouds (801-802) to partly-cloudy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 802 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('partly-cloudy');
    });

    it('maps overcast clouds (803+) to cloudy', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ weatherId: 804 })),
      });

      const result = await fetchCurrentWeather();
      expect(result.condition).toBe('cloudy');
    });

    it('passes through humidity and description', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrentResponse({ humidity: 85, description: 'light rain' })),
      });

      const result = await fetchCurrentWeather();
      expect(result.humidity).toBe(85);
      expect(result.description).toBe('light rain');
    });

    it('throws on API error response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('City not found'),
      });

      await expect(fetchCurrentWeather()).rejects.toThrow('Failed to fetch current weather');
    });
  });

  describe('fetchForecast (daily aggregation)', () => {
    it('groups forecast items by day and computes high/low', async () => {
      // Two items on the same day with different temps
      const date1 = new Date('2026-03-15T06:00:00Z');
      const date2 = new Date('2026-03-15T15:00:00Z');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          list: [
            mockForecastItem(Math.floor(date1.getTime() / 1000), 280, 800), // 280K ≈ 44°F
            mockForecastItem(Math.floor(date2.getTime() / 1000), 295, 800), // 295K ≈ 71°F
          ],
          city: { name: 'TestCity', country: 'US' },
        }),
      });

      const result = await fetchForecast();
      expect(result.forecast.length).toBe(1);
      expect(result.forecast[0]!.high).toBeGreaterThan(result.forecast[0]!.low);
    });

    it('limits forecast to 5 days', async () => {
      // Create 7 days of forecast data
      const items: ReturnType<typeof mockForecastItem>[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(`2026-03-${15 + d}T12:00:00Z`);
        items.push(mockForecastItem(Math.floor(date.getTime() / 1000), 290, 800));
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          list: items,
          city: { name: 'TestCity', country: 'US' },
        }),
      });

      const result = await fetchForecast();
      expect(result.forecast.length).toBe(5);
    });

    it('uses most common condition for the day', async () => {
      const date = new Date('2026-03-15');
      const baseTs = Math.floor(date.getTime() / 1000);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          list: [
            mockForecastItem(baseTs, 290, 800),       // sunny
            mockForecastItem(baseTs + 10800, 290, 500), // rainy
            mockForecastItem(baseTs + 21600, 290, 500), // rainy
            mockForecastItem(baseTs + 32400, 290, 500), // rainy
          ],
          city: { name: 'TestCity', country: 'US' },
        }),
      });

      const result = await fetchForecast();
      // 3 rainy vs 1 sunny → rainy should win
      expect(result.forecast[0]!.condition).toBe('rainy');
    });

    it('includes location name from city data', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          list: [mockForecastItem(Math.floor(Date.now() / 1000), 290, 800)],
          city: { name: 'Springfield', country: 'US' },
        }),
      });

      const result = await fetchForecast();
      expect(result.locationName).toBe('Springfield, US');
    });
  });
});
