import '@testing-library/jest-dom';

/**
 * JSDOM does not implement ResizeObserver. Chart/layout code that observes
 * container size expects a minimal global for unit tests.
 */
globalThis.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this._callback = callback;
  }

  observe(target) {
    queueMicrotask(() => {
      this._callback([{ target }], this);
    });
  }

  unobserve() {}

  disconnect() {}
};
