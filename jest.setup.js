// jsdom doesn't implement ResizeObserver. Stub it and fire the callback
// immediately on observe() so code that calls timeline() inside the callback
// (e.g. WeatherWidget's merry-timeline integration) is exercised in tests.
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this._callback = callback;
  }
  observe(target) {
    // Simulate a 800×600 content rect so width-dependent code gets a real value.
    this._callback([{ target, contentRect: { width: 800, height: 600 } }], this);
  }
  unobserve() {}
  disconnect() {}
};
