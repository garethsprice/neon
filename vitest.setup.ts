/**
 * Vitest Global Setup
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock matchMedia (not provided by jsdom)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16)
  ) as unknown as typeof requestAnimationFrame;
  global.cancelAnimationFrame = vi.fn((id: number) => clearTimeout(id));
}
