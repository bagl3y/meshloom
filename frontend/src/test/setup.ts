import '@testing-library/jest-dom';

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserver;

// Several components call matchMedia at import time for responsive detection
if (typeof globalThis.matchMedia === 'undefined') {
  Object.defineProperty(globalThis, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
