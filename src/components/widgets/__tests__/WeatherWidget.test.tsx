/**
 * @jest-environment jsdom
 *
 * Tests for WeatherWidget — covering the merry-timeline integration,
 * WeatherTimeline (24-hour hourly), the day summary header, forecastDays prop,
 * condition color/icon mapping, condition legend, and current conditions.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// --- mocks (must precede component import) ---------------------------------

jest.mock('merry-timeline', () => ({
  // __esModule: true tells ts-jest's __importDefault helper that this is already
  // an ES module shape, so `import timeline from 'merry-timeline'` resolves
  // directly to `.default` (the jest.fn()) instead of being double-wrapped.
  __esModule: true,
  default: jest.fn(),
}));

// Stub WidgetContainer so we don't pull in next/link, Radix UI, etc.
jest.mock('../WidgetContainer', () => ({
  WidgetContainer: function MockWidgetContainer({
    children,
    title,
    loading,
    error,
  }: {
    children: React.ReactNode;
    title?: string;
    loading?: boolean;
    error?: string | null;
  }) {
    if (loading) return <div data-testid="loading-state">Loading</div>;
    if (error)   return <div data-testid="error-state">{error}</div>;
    return (
      <div data-testid="widget-container">
        {title && <div data-testid="widget-title">{title}</div>}
        {children}
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------

import timeline from 'merry-timeline';
import { WeatherWidget } from '../WeatherWidget';
import type { WeatherData, ForecastDay, HourlyForecast, WeatherCondition } from '../WeatherWidget';

const mockTimeline = jest.mocked(timeline);

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

// Anchor to noon tomorrow so the past-day filter never drops fixture dates.
const NOON_MS = new Date().setHours(12, 0, 0, 0);
const TOMORROW_NOON = new Date(NOON_MS + 86_400_000);
const DAY_MS = 86_400_000;

function makeForecastDay(overrides: Partial<ForecastDay> = {}): ForecastDay {
  return {
    date: TOMORROW_NOON,
    dayName: 'Tue',
    high: 72,
    low: 55,
    condition: 'sunny',
    ...overrides,
  };
}

/**
 * Build 24 hourly items anchored to a fixed local midnight so time labels
 * are deterministic regardless of when the test runs.
 *   hour 0  → '12am'
 *   hour 1  → '1am'
 *   hour 12 → '12pm'
 *   hour 14 → '2pm'
 */
function makeHourlyForecast(
  conditionOrList: WeatherCondition | WeatherCondition[] = 'sunny',
  temp = 70,
): HourlyForecast[] {
  const conditions: WeatherCondition[] = Array.isArray(conditionOrList)
    ? conditionOrList
    : Array(24).fill(conditionOrList);

  return Array.from({ length: 24 }, (_, i) => ({
    // new Date(year, month, day, hour) — local time, deterministic labels
    time:      new Date(2026, 3, 7, i),   // April 7, 2026, hour i
    condition: conditions[i] ?? 'sunny',
    temp,
  }));
}

/** Build a full WeatherData object. */
function makeWeatherData(overrides: Partial<WeatherData> = {}): WeatherData {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Start from tomorrow so no entry lands on "today" (which renders as 'TODAY'
  // rather than the dayName, breaking tests that check for specific day labels).
  const forecast: ForecastDay[] = DAY_NAMES.slice(0, 5).map((dayName, i) => ({
    date: new Date(NOON_MS + (1 + i) * DAY_MS),
    dayName,
    high: 70 + i,
    low:  50 + i,
    condition: 'sunny' as WeatherCondition,
  }));

  return {
    location: 'Chicago, IL',
    current: {
      temperature: 68,
      feelsLike:   65,
      condition:   'sunny',
      humidity:    45,
      windSpeed:   10,
      description: 'Clear sky',
    },
    forecast,
    hourly: makeHourlyForecast('sunny'),
    lastUpdated: new Date(),
    ...overrides,
  };
}

/** Render and wait for the timeline library to be called. */
async function renderAndWaitForTimeline(element: React.ReactElement) {
  const result = render(element);
  await waitFor(() => expect(mockTimeline).toHaveBeenCalled());
  return result;
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  mockTimeline.mockClear();
});


// ===========================================================================
// 1. merry-timeline integration
// ===========================================================================

describe('merry-timeline integration', () => {
  it('calls timeline() with an HTMLElement container', async () => {
    await renderAndWaitForTimeline(<WeatherWidget data={makeWeatherData()} />);

    const [containerArg] = mockTimeline.mock.calls[0]!;
    expect(containerArg).toBeInstanceOf(HTMLElement);
  });

  it('calls timeline() with exactly 24 items', async () => {
    await renderAndWaitForTimeline(<WeatherWidget data={makeWeatherData()} />);

    const [, items] = mockTimeline.mock.calls[0]!;
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(24);
  });

  it('passes width and tracker options', async () => {
    await renderAndWaitForTimeline(<WeatherWidget data={makeWeatherData()} />);

    const [, , opts] = mockTimeline.mock.calls[0]!;
    expect(opts).toMatchObject({ width: expect.any(Number), tracker: 0 });
  });

  it('does not call timeline() when hourly data is empty', async () => {
    render(<WeatherWidget data={makeWeatherData({ hourly: [] })} />);
    await act(async () => {});
    expect(mockTimeline).not.toHaveBeenCalled();
  });

  it('does NOT call timeline() when showForecast is false', async () => {
    render(<WeatherWidget data={makeWeatherData()} showForecast={false} />);
    await act(async () => {});
    expect(mockTimeline).not.toHaveBeenCalled();
  });

  it('re-calls timeline() when hourly data changes', async () => {
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny') });
    const { rerender } = await renderAndWaitForTimeline(<WeatherWidget data={data} />);

    mockTimeline.mockClear();

    const updated = makeWeatherData({ hourly: makeHourlyForecast('rainy') });
    rerender(<WeatherWidget data={updated} />);
    await waitFor(() => expect(mockTimeline).toHaveBeenCalledTimes(1));
  });

  it('does NOT re-call timeline() when only forecastDays changes', async () => {
    const data = makeWeatherData();
    const { rerender } = await renderAndWaitForTimeline(
      <WeatherWidget data={data} forecastDays={3} />
    );

    mockTimeline.mockClear();

    rerender(<WeatherWidget data={data} forecastDays={5} />);
    // Let any async effects flush — timeline should not be called again
    await act(async () => {});
    expect(mockTimeline).not.toHaveBeenCalled();
  });

  it('does NOT re-call timeline() when only useCelsius changes', async () => {
    const data = makeWeatherData();
    const { rerender } = await renderAndWaitForTimeline(
      <WeatherWidget data={data} useCelsius={false} />
    );

    mockTimeline.mockClear();

    rerender(<WeatherWidget data={data} useCelsius={true} />);
    await act(async () => {});
    expect(mockTimeline).not.toHaveBeenCalled();
  });

  it('clears the container innerHTML before each render', async () => {
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny') });
    const { rerender } = await renderAndWaitForTimeline(<WeatherWidget data={data} />);

    mockTimeline.mockClear();

    const updated = makeWeatherData({ hourly: makeHourlyForecast('rainy') });
    rerender(<WeatherWidget data={updated} />);
    await waitFor(() => expect(mockTimeline).toHaveBeenCalled());

    const [container] = mockTimeline.mock.calls[0]!;
    expect(container).toBeInstanceOf(HTMLElement);
  });
});


// ===========================================================================
// 2. Timeline items structure
// ===========================================================================

describe('timeline items structure', () => {
  async function getItemsForHourly(hourly: HourlyForecast[]) {
    const data = makeWeatherData({ hourly });
    await renderAndWaitForTimeline(<WeatherWidget data={data} />);
    return mockTimeline.mock.calls[0]![1] as Array<{
      time: number;
      color: string;
      text: string;
    }>;
  }

  it('generates exactly 24 items (next 24 hours)', async () => {
    const items = await getItemsForHourly(makeHourlyForecast('sunny'));
    expect(items).toHaveLength(24);
  });

  it('items are sorted by time ascending', async () => {
    const items = await getItemsForHourly(makeHourlyForecast('sunny'));
    for (let i = 1; i < items.length; i++) {
      expect(items[i]!.time).toBeGreaterThanOrEqual(items[i - 1]!.time);
    }
  });

  it('each item color matches its condition', async () => {
    const items = await getItemsForHourly(makeHourlyForecast('rainy'));
    for (const item of items) {
      expect(item.color).toBe('#7B9EC7');
    }
  });

  it('each item color is independent per hour', async () => {
    // First 12 hours sunny, next 12 rainy
    const conditions: WeatherCondition[] = [
      ...Array(12).fill('sunny'),
      ...Array(12).fill('rainy'),
    ];
    const items = await getItemsForHourly(makeHourlyForecast(conditions));

    for (const item of items.slice(0, 12)) expect(item.color).toBe('#EAECF0');
    for (const item of items.slice(12))    expect(item.color).toBe('#7B9EC7');
  });

  it('item text is a condition label', async () => {
    const items = await getItemsForHourly(makeHourlyForecast('sunny'));
    // All items are 'sunny' → label is 'Clear'
    for (const item of items) expect(item.text).toBe('Clear');
  });

  it('rainy condition uses "Rain" label', async () => {
    const items = await getItemsForHourly(makeHourlyForecast('rainy'));
    for (const item of items) expect(item.text).toBe('Rain');
  });

  it('all 24 items share the same label when condition is uniform', async () => {
    const items = await getItemsForHourly(makeHourlyForecast('cloudy'));
    const labels = new Set(items.map((it) => it.text));
    expect(labels.size).toBe(1);
  });
});


// ===========================================================================
// 3. Condition color mapping
// ===========================================================================

describe('condition → timeline color mapping', () => {
  const EXPECTED_COLORS: [WeatherCondition, string][] = [
    ['sunny',         '#EAECF0'],
    ['partly-cloudy', '#C8CBD6'],
    ['cloudy',        '#A8ADB8'],
    ['rainy',         '#7B9EC7'],
    ['snowy',         '#B8D4E8'],
    ['stormy',        '#4A6FA5'],
  ];

  it.each(EXPECTED_COLORS)(
    'condition "%s" maps to color %s',
    async (condition, expectedColor) => {
      const data = makeWeatherData({ hourly: makeHourlyForecast(condition) });
      await renderAndWaitForTimeline(<WeatherWidget data={data} />);

      const items = mockTimeline.mock.calls[0]![1] as Array<{ color: string }>;
      // All 24 items share the same condition in this test
      for (const item of items) {
        expect(item.color).toBe(expectedColor);
      }
    }
  );
});


// ===========================================================================
// 4. Day summary header (driven by forecastDays, not the timeline)
// ===========================================================================

describe('day summary header', () => {
  it('renders a label for each forecast day', () => {
    const data = makeWeatherData({
      forecast: [
        makeForecastDay({ dayName: 'Mon' }),
        makeForecastDay({ dayName: 'Tue', date: new Date(NOON_MS + 2 * DAY_MS) }),
        makeForecastDay({ dayName: 'Wed', date: new Date(NOON_MS + 3 * DAY_MS) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={3} />);

    // Widget calls dayName.toUpperCase() — DOM has 'MON' not 'Mon'
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).not.toBeNull();
  });

  it('renders the correct number of day columns', () => {
    const data = makeWeatherData();
    const { container } = render(<WeatherWidget data={data} forecastDays={4} />);

    const dayColumns = container.querySelectorAll('[class*="flex-1"]');
    expect(dayColumns.length).toBeGreaterThanOrEqual(4);
  });

  it('shows the high temperature for each day in °F', () => {
    const data = makeWeatherData({
      forecast: [makeForecastDay({ dayName: 'Mon', high: 88, low: 60 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryByText(/88°/)).not.toBeNull();
  });

  it('shows the low temperature for each day in °F', () => {
    const data = makeWeatherData({
      forecast: [makeForecastDay({ dayName: 'Mon', high: 72, low: 44 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryByText(/44°/)).not.toBeNull();
  });

  it('converts temperatures to Celsius when useCelsius=true', () => {
    // 95°F → 35°C, 50°F → 10°C
    const data = makeWeatherData({
      forecast: [makeForecastDay({ high: 95, low: 50 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} useCelsius />);
    expect(screen.queryByText(/35°/)).not.toBeNull();
    expect(screen.queryByText(/10°/)).not.toBeNull();
  });

  it('renders an icon for each day in the header', () => {
    const data = makeWeatherData();
    const { container } = render(<WeatherWidget data={data} forecastDays={3} />);

    const svgs = container.querySelectorAll('svg');
    // At minimum: 1 current-conditions icon + 3 day header icons
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });
});


// ===========================================================================
// 5. forecastDays prop — controls the day summary; not the timeline
// ===========================================================================

describe('forecastDays prop', () => {
  it('defaults to 5 when not specified and 5+ days are available', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
  });

  it('respects an explicit forecastDays value', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} forecastDays={3} />);
    expect(screen.queryByText('3-Day Forecast')).not.toBeNull();
  });

  it('shows only forecastDays day columns in the header', () => {
    const data = makeWeatherData(); // 5 days: Mon–Fri
    render(<WeatherWidget data={data} forecastDays={2} />);

    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });

  it('shows only available days when fewer than forecastDays exist', () => {
    const data = makeWeatherData({
      forecast: [
        makeForecastDay({ dayName: 'Mon' }),
        makeForecastDay({ dayName: 'Tue', date: new Date(NOON_MS + 2 * DAY_MS) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={5} />);

    // Label reflects actual visible days, not the requested prop
    expect(screen.queryByText('2-Day Forecast')).not.toBeNull();
    // Header shows only the 2 days that exist
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });

  it('always passes exactly 24 items to merry-timeline regardless of forecastDays', async () => {
    const data = makeWeatherData();
    await renderAndWaitForTimeline(<WeatherWidget data={data} forecastDays={3} />);

    const items = mockTimeline.mock.calls[0]![1] as unknown[];
    expect(items).toHaveLength(24);
  });
});




// ===========================================================================
// 7. Current conditions display
// ===========================================================================

describe('current conditions', () => {
  it('renders the current temperature in °F by default', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 73 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('73°F')).not.toBeNull();
  });

  it('converts current temperature to °C when useCelsius=true', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 32 },
    });
    render(<WeatherWidget data={data} useCelsius />);
    expect(screen.queryByText('0°C')).not.toBeNull();
  });

  it('renders the weather description', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, description: 'Heavy thunderstorm' },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('Heavy thunderstorm')).not.toBeNull();
  });

  it('renders the location name', () => {
    const data = makeWeatherData({ location: 'Denver, CO' });
    render(<WeatherWidget data={data} />);
    // formatLocation returns the city portion only
    expect(screen.queryByText('Denver')).not.toBeNull();
  });

  it('renders the "feels like" temperature', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, feelsLike: 60 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText(/Feels like 60°F/)).not.toBeNull();
  });

  it('renders humidity percentage', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, humidity: 78 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('78%')).not.toBeNull();
  });

  it('renders wind speed in mph', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, windSpeed: 15 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('15 mph')).not.toBeNull();
  });
});


// ===========================================================================
// 8. showForecast prop
// ===========================================================================

describe('showForecast prop', () => {
  it('renders the forecast section by default', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
    expect(screen.queryByText('Next 12 Hours')).not.toBeNull();
  });

  it('hides the forecast section when showForecast=false', async () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} showForecast={false} />);
    await act(async () => {});

    expect(screen.queryByText('5-Day Forecast')).toBeNull();
    expect(screen.queryByText('Next 12 Hours')).toBeNull();
    expect(mockTimeline).not.toHaveBeenCalled();
  });
});


// ===========================================================================
// 9. Loading and error states
// ===========================================================================

describe('loading and error states', () => {
  it('renders the loading state when loading=true', () => {
    render(<WeatherWidget loading />);
    expect(screen.queryByTestId('loading-state')).not.toBeNull();
  });

  it('renders the error message when error is provided', () => {
    render(<WeatherWidget error="Weather service unavailable" />);
    expect(screen.queryByText('Weather service unavailable')).not.toBeNull();
  });

  it('renders the widget content when neither loading nor error', () => {
    render(<WeatherWidget data={makeWeatherData()} />);
    expect(screen.queryByTestId('widget-container')).not.toBeNull();
  });
});


// ===========================================================================
// 10. Demo data fallback
// ===========================================================================

describe('demo data fallback', () => {
  it('renders without errors when no data prop is provided', () => {
    expect(() => render(<WeatherWidget />)).not.toThrow();
  });

  it('uses demo location when no location or data is provided', () => {
    render(<WeatherWidget />);
    expect(screen.queryByText('Melrose')).not.toBeNull();
  });

  it('shows the passed location in demo mode', () => {
    render(<WeatherWidget location="Austin, TX" />);
    expect(screen.queryByText('Austin')).not.toBeNull();
  });

  it('renders the Next 24 Hours timeline with demo data', async () => {
    await renderAndWaitForTimeline(<WeatherWidget />);
    const [, items] = mockTimeline.mock.calls[0]!;
    expect(items).toHaveLength(24);
  });
});
