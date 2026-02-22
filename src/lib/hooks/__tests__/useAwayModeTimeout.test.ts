/**
 * Tests for useAwayModeTimeout hook.
 *
 * Tests localStorage persistence, custom event dispatch,
 * and cross-component synchronization via event listeners.
 */

// --- Minimal window/localStorage mock ---
const storageData: Record<string, string> = {};
const eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
const dispatched: unknown[] = [];

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
  dispatchEvent: jest.fn((event: unknown) => { dispatched.push(event); }),
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

// Mock CustomEvent for node environment
class MockCustomEvent {
  type: string;
  detail: unknown;
  constructor(type: string, opts?: { detail?: unknown }) {
    this.type = type;
    this.detail = opts?.detail;
  }
}
Object.defineProperty(global, 'CustomEvent', { value: MockCustomEvent, writable: true, configurable: true });

// --- Mock React ---
type EffectFn = () => (() => void) | void;
const capturedEffects: EffectFn[] = [];
let stateStore: Record<number, unknown> = {};
let stateIdx = 0;

jest.mock('react', () => ({
  useState: (init: unknown) => {
    const idx = stateIdx++;
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
}));

import { useAwayModeTimeout } from '../useAwayModeTimeout';

describe('useAwayModeTimeout', () => {
  beforeEach(() => {
    capturedEffects.length = 0;
    stateStore = {};
    stateIdx = 0;
    dispatched.length = 0;
    for (const key of Object.keys(eventListeners)) {
      eventListeners[key] = [];
    }
    for (const key of Object.keys(storageData)) {
      delete storageData[key];
    }
    mockWindow.addEventListener.mockClear();
    mockWindow.removeEventListener.mockClear();
    mockWindow.dispatchEvent.mockClear();
  });

  it('returns default timeout of 0 (disabled)', () => {
    const result = useAwayModeTimeout();
    expect(result.timeout).toBe(0);
  });

  it('reads stored timeout from localStorage', () => {
    storageData['prism-away-mode-timeout'] = '24';
    stateStore = {};
    stateIdx = 0;

    const result = useAwayModeTimeout();
    expect(result.timeout).toBe(24);
  });

  it('returns a setTimeout function', () => {
    const result = useAwayModeTimeout();
    expect(typeof result.setTimeout).toBe('function');
  });

  it('setTimeout persists value to localStorage', () => {
    const result = useAwayModeTimeout();
    result.setTimeout(48);

    expect(storageData['prism-away-mode-timeout']).toBe('48');
  });

  it('setTimeout dispatches custom event', () => {
    const result = useAwayModeTimeout();
    result.setTimeout(168);

    expect(mockWindow.dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatched[0] as MockCustomEvent;
    expect(event.type).toBe('prism:away-mode-timeout-change');
    expect(event.detail).toBe(168);
  });

  it('registers event listener for cross-component sync', () => {
    useAwayModeTimeout();

    // Run captured effects
    for (const effect of capturedEffects) {
      effect();
    }

    const registeredEvents = mockWindow.addEventListener.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(registeredEvents).toContain('prism:away-mode-timeout-change');
  });

  it('effect cleanup removes event listener', () => {
    useAwayModeTimeout();

    const cleanups: (() => void)[] = [];
    for (const effect of capturedEffects) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    }

    for (const cleanup of cleanups) cleanup();

    expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
      'prism:away-mode-timeout-change',
      expect.any(Function)
    );
  });
});
