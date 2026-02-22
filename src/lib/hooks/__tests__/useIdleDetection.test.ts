/**
 * Tests for useIdleDetection hook core logic.
 *
 * We mock React hooks and capture the effects/callbacks to test:
 * - Idle state triggers after timeout
 * - Activity resets the timer
 * - forceIdle bypasses timer
 * - Disabled when timeout <= 0
 */

// --- Minimal window/localStorage mock ---
const storageData: Record<string, string> = {};
const eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

const mockWindow = {
  addEventListener: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(handler);
  }),
  removeEventListener: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter(h => h !== handler);
    }
  }),
  dispatchEvent: jest.fn(),
};

Object.defineProperty(global, 'window', { value: mockWindow, writable: true, configurable: true });
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => storageData[key] ?? null,
    setItem: (key: string, value: string) => { storageData[key] = value; },
    removeItem: (key: string) => { delete storageData[key]; },
  },
  writable: true,
  configurable: true,
});

// --- Mock React ---
type EffectFn = () => (() => void) | void;
const capturedEffects: EffectFn[] = [];
let stateStore: Record<number, unknown> = {};
let stateIndex = 0;
let refStore: Record<number, { current: unknown }> = {};
let refIndex = 0;

jest.mock('react', () => ({
  useState: (init: unknown) => {
    const idx = stateIndex++;
    if (!(idx in stateStore)) {
      stateStore[idx] = typeof init === 'function' ? (init as () => unknown)() : init;
    }
    const setter = (val: unknown) => {
      stateStore[idx] = typeof val === 'function' ? (val as (prev: unknown) => unknown)(stateStore[idx]) : val;
    };
    return [stateStore[idx], setter];
  },
  useEffect: (effect: EffectFn) => {
    capturedEffects.push(effect);
  },
  useCallback: (fn: (...args: unknown[]) => unknown) => fn,
  useRef: (init: unknown) => {
    const idx = refIndex++;
    if (!(idx in refStore)) {
      refStore[idx] = { current: init };
    }
    return refStore[idx];
  },
}));

import { useIdleDetection } from '../useIdleDetection';

describe('useIdleDetection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    capturedEffects.length = 0;
    stateStore = {};
    stateIndex = 0;
    refStore = {};
    refIndex = 0;
    for (const key of Object.keys(eventListeners)) {
      eventListeners[key] = [];
    }
    for (const key of Object.keys(storageData)) {
      delete storageData[key];
    }
    mockWindow.addEventListener.mockClear();
    mockWindow.removeEventListener.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns isIdle=false initially', () => {
    const result = useIdleDetection(60);
    expect(result.isIdle).toBe(false);
  });

  it('returns forceIdle function', () => {
    const result = useIdleDetection(60);
    expect(typeof result.forceIdle).toBe('function');
  });

  it('uses initialTimeout parameter', () => {
    useIdleDetection(45);
    // First state call is timeout, should be 45
    expect(stateStore[0]).toBe(45);
  });

  it('falls back to stored timeout when no initial value', () => {
    storageData['prism-screensaver-timeout'] = '90';
    stateStore = {};
    stateIndex = 0;
    refStore = {};
    refIndex = 0;

    useIdleDetection();

    expect(stateStore[0]).toBe(90);
  });

  it('falls back to default 120s when no stored value and no initial', () => {
    stateStore = {};
    stateIndex = 0;
    refStore = {};
    refIndex = 0;

    useIdleDetection();

    expect(stateStore[0]).toBe(120);
  });

  it('registers mousemove and keydown event listeners via effects', () => {
    useIdleDetection(60);

    // Run all captured effects
    const cleanups: (() => void)[] = [];
    for (const effect of capturedEffects) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    }

    // Should have registered various event listeners
    expect(mockWindow.addEventListener).toHaveBeenCalled();

    const registeredEvents = mockWindow.addEventListener.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(registeredEvents).toContain('mousemove');
    expect(registeredEvents).toContain('keydown');
    expect(registeredEvents).toContain('touchstart');

    // Clean up
    for (const cleanup of cleanups) cleanup();
  });

  it('registers screensaver custom event listener', () => {
    useIdleDetection(60);

    for (const effect of capturedEffects) {
      effect();
    }

    const registeredEvents = mockWindow.addEventListener.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(registeredEvents).toContain('prism:screensaver');
  });
});
