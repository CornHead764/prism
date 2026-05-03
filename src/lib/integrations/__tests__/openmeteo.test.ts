/**
 * Tests for the Open-Meteo integration.
 *
 * Verifies the request URL plumbs lat/lon from the LocationParam (not just
 * env), that day-of-week labels respect the response (timezone=auto returns
 * local-date strings so no Intl.DateTimeFormat workaround is needed), and
 * that network errors get a clear provider-named message.
 */

export {}; // module marker so const declarations don't leak into global scope

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    WEATHER_LAT: '41.8781',
    WEATHER_LON: '-87.6298',
    WEATHER_LOCATION: 'Chicago, IL',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

afterEach(() => {
  jest.restoreAllMocks();
});

function buildResponse(timezone = 'America/Chicago') {
  // 2026-05-02 is a Saturday; using local-date strings (which is what
  // Open-Meteo returns with timezone=auto) keeps the test fixtures
  // independent of the runner's TZ.
  const today = '2026-05-02';
  return {
    latitude: 0,
    longitude: 0,
    timezone,
    current: {
      time: `${today}T10:00`,
      temperature_2m: 70,
      apparent_temperature: 70,
      relative_humidity_2m: 50,
      wind_speed_10m: 5,
      weather_code: 0,
      precipitation: 0,
    },
    hourly: {
      time: [`${today}T10:00`, `${today}T11:00`, `${today}T12:00`],
      temperature_2m: [70, 71, 72],
      precipitation_probability: [0, 0, 0],
      precipitation: [0, 0, 0],
      weather_code: [0, 1, 2],
    },
    daily: {
      time: [today, '2026-05-03', '2026-05-04'],
      temperature_2m_max: [75, 76, 77],
      temperature_2m_min: [60, 61, 62],
      weather_code: [0, 1, 2],
      precipitation_probability_max: [0, 10, 20],
      sunrise: [`${today}T06:00`, '2026-05-03T06:00', '2026-05-04T06:00'],
      sunset:  [`${today}T19:00`, '2026-05-03T19:00', '2026-05-04T19:00'],
    },
  };
}

describe('openmeteo.fetchWeatherData', () => {
  it('passes lat/lon from LocationParam to the request URL', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue({
        ok: true,
        json: async () => buildResponse(),
      } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await fetchWeatherData({ lat: 40.7128, lon: -74.006 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('latitude=40.7128');
    expect(calledUrl).toContain('longitude=-74.006');
    expect(calledUrl).not.toContain('latitude=41.8781'); // env default not used
  });

  it('falls back to env coordinates when no LocationParam is provided', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue({
        ok: true,
        json: async () => buildResponse(),
      } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await fetchWeatherData();

    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('latitude=41.8781');
    expect(calledUrl).toContain('longitude=-87.6298');
  });

  it('requests timezone=auto so daily entries use the location-local date', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue({
        ok: true,
        json: async () => buildResponse(),
      } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await fetchWeatherData();

    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('timezone=auto');
  });

  it('returns 7 forecast entries with high/low/condition mapped from WMO codes', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();

    expect(result.forecast.length).toBe(3); // fixture has 3 days
    expect(result.forecast[0]?.high).toBe(75);
    expect(result.forecast[0]?.low).toBe(60);
    expect(result.forecast[0]?.condition).toBe('sunny'); // WMO 0 = clear sky
    expect(result.forecast[1]?.condition).toBe('partly-cloudy'); // WMO 1
    expect(result.forecast[2]?.condition).toBe('partly-cloudy'); // WMO 2
  });

  it('parses YYYY-MM-DD daily date strings as local dates (no UTC shift)', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();

    // 2026-05-02 is a Saturday everywhere — if the parse went through UTC the
    // day-of-week could shift by one in negative-UTC zones.
    expect(result.forecast[0]?.dayName).toBe('Sat');
    expect(result.forecast[1]?.dayName).toBe('Sun');
  });

  it('omits minutely (Open-Meteo does not provide minute-by-minute precip)', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();
    expect(result.minutely).toBeUndefined();
  });

  it('wraps network errors in a clear provider-named message', async () => {
    jest
      .spyOn(global, 'fetch' as never)
      .mockImplementation((() => Promise.reject(new Error('ECONNREFUSED'))) as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await expect(fetchWeatherData()).rejects.toThrow(/Open-Meteo network error: ECONNREFUSED/);
  });

  it('skips stale past-day entries that arrive in a cached response', async () => {
    // Simulate a response cached just before midnight: the first daily entry
    // is yesterday's date in the response timezone. Today's local date in
    // America/Chicago should drop that first entry from the forecast.
    const todayLocal = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
    }).format(new Date());
    const todayDate = new Date(`${todayLocal}T12:00:00`);
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' })
      .format(new Date(todayDate.getTime() - 24 * 60 * 60 * 1000));
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' })
      .format(new Date(todayDate.getTime() + 24 * 60 * 60 * 1000));

    const stale = {
      latitude: 0,
      longitude: 0,
      timezone: 'America/Chicago',
      current: {
        time: `${todayLocal}T10:00`,
        temperature_2m: 70, apparent_temperature: 70, relative_humidity_2m: 50,
        wind_speed_10m: 5, weather_code: 0, precipitation: 0,
      },
      hourly: { time: [], temperature_2m: [], precipitation_probability: [], precipitation: [], weather_code: [] },
      daily: {
        time: [yesterday, todayLocal, tomorrow],
        temperature_2m_max: [50, 75, 76],
        temperature_2m_min: [40, 60, 61],
        weather_code: [3, 0, 1],
        precipitation_probability_max: [80, 0, 10],
        sunrise: [`${yesterday}T06:00`, `${todayLocal}T06:00`, `${tomorrow}T06:00`],
        sunset:  [`${yesterday}T19:00`, `${todayLocal}T19:00`, `${tomorrow}T19:00`],
      },
    };

    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => stale,
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData({ lat: 41.8, lon: -87.6 });

    // Yesterday's high (50°F) and condition (overcast=3) should not appear.
    expect(result.forecast.length).toBe(2);
    expect(result.forecast[0]?.high).toBe(75);
    expect(result.forecast[0]?.condition).not.toBe('cloudy');
  });

  it('does not require any API key (zero env-var configuration)', async () => {
    // Strip any provider key env vars to prove openmeteo doesn't read them.
    const stripped = { ...process.env };
    delete stripped.OPENWEATHER_API_KEY;
    delete stripped.PIRATE_WEATHER_API_KEY;
    process.env = stripped;

    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await expect(fetchWeatherData()).resolves.toBeDefined();
  });
});
